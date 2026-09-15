const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const SYSTEM_PROMPT = require('../context/systemPrompt');

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const LOG_CONTAINER = 'chat-logs';
const USAGE_CONTAINER = 'usage';
const USAGE_BLOB_NAME = 'current.json';
const SESSION_ID_PATTERN = /^[a-zA-Z0-9-]{8,100}$/;

const MONTHLY_CAP_USD = Number(process.env.AZURE_OPENAI_MONTHLY_CAP_USD) || 10;
// gpt-5-mini Azure OpenAI GlobalStandard pricing as of 2026-09. Update these if the
// deployed model or Azure's published pricing changes.
const PRICE_PER_INPUT_TOKEN_USD = 0.75 / 1_000_000;
const PRICE_PER_OUTPUT_TOKEN_USD = 4.5 / 1_000_000;
const BUDGET_REACHED_REPLY =
  "This month's chat budget has been used up, so I can't respond right now. " +
  'Please check back next month, or reach out to Dan directly at dantaylor6248@gmail.com.';

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'chat',
  handler: async (request, context) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
    const rawMessages = Array.isArray(body.messages) ? body.messages : null;

    if (!sessionId || !SESSION_ID_PATTERN.test(sessionId) || !rawMessages || rawMessages.length === 0) {
      return { status: 400, jsonBody: { error: 'A valid sessionId and messages are required' } };
    }

    const history = rawMessages
      .slice(-MAX_HISTORY_MESSAGES)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

    if (history.length === 0 || history[history.length - 1].role !== 'user') {
      return { status: 400, jsonBody: { error: 'The last message must be from the user' } };
    }

    const blobServiceClient = getBlobServiceClient();

    if (blobServiceClient) {
      const withinBudget = await isBudgetAvailable(blobServiceClient, context);
      if (!withinBudget) {
        return { status: 200, jsonBody: { reply: BUDGET_REACHED_REPLY } };
      }
    }

    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

    if (!endpoint || !apiKey || !deployment) {
      context.error('Missing Azure OpenAI configuration');
      return { status: 500, jsonBody: { error: 'Chat is not configured' } };
    }

    const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
    const url = `${baseUrl}openai/v1/chat/completions`;

    let reply;
    let usage;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: deployment,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
          max_completion_tokens: 800,
          reasoning_effort: 'minimal',
        }),
      });

      const debugAuthorized = request.headers.get('x-debug-key') === apiKey;

      if (!response.ok) {
        const errText = await response.text();
        context.error('Azure OpenAI error', response.status, errText);
        return {
          status: 502,
          jsonBody: {
            error: 'The assistant is temporarily unavailable',
            ...(debugAuthorized ? { debug: { status: response.status, body: errText, url } } : {}),
          },
        };
      }

      const data = await response.json();
      reply = data.choices?.[0]?.message?.content?.trim();
      usage = data.usage;
      if (!reply) {
        return {
          status: 502,
          jsonBody: {
            error: 'The assistant is temporarily unavailable',
            ...(debugAuthorized ? { debug: { data } } : {}),
          },
        };
      }
    } catch (err) {
      context.error('Azure OpenAI request failed', err);
      const debugAuthorized = request.headers.get('x-debug-key') === apiKey;
      return {
        status: 502,
        jsonBody: {
          error: 'The assistant is temporarily unavailable',
          ...(debugAuthorized ? { debug: { message: err.message, url } } : {}),
        },
      };
    }

    if (blobServiceClient && usage) {
      try {
        await recordUsage(blobServiceClient, usage.prompt_tokens || 0, usage.completion_tokens || 0);
      } catch (err) {
        context.error('Failed to record usage', err);
      }
    }

    const fullHistory = [...history, { role: 'assistant', content: reply }];

    if (blobServiceClient) {
      try {
        await saveConversation(blobServiceClient, sessionId, fullHistory);
      } catch (err) {
        context.error('Failed to save conversation log', err);
      }
    }

    return { status: 200, jsonBody: { reply } };
  },
});

function getBlobServiceClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) return null;
  return BlobServiceClient.fromConnectionString(connectionString);
}

function currentMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function streamToString(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    readable.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    readable.on('error', reject);
  });
}

async function readUsage(containerClient) {
  const blobClient = containerClient.getBlockBlobClient(USAGE_BLOB_NAME);
  try {
    const download = await blobClient.download();
    const text = await streamToString(download.readableStreamBody);
    return { data: JSON.parse(text), etag: download.etag };
  } catch (err) {
    if (err.statusCode === 404) return { data: null, etag: undefined };
    throw err;
  }
}

async function writeUsage(containerClient, data, etag) {
  const blobClient = containerClient.getBlockBlobClient(USAGE_BLOB_NAME);
  const payload = JSON.stringify(data);
  const options = { blobHTTPHeaders: { blobContentType: 'application/json' } };
  options.conditions = etag ? { ifMatch: etag } : { ifNoneMatch: '*' };
  await blobClient.upload(payload, Buffer.byteLength(payload), options);
}

async function isBudgetAvailable(blobServiceClient, context) {
  try {
    const containerClient = blobServiceClient.getContainerClient(USAGE_CONTAINER);
    const { data } = await readUsage(containerClient);
    if (!data || data.month !== currentMonthKey()) return true;
    return data.costUsd < MONTHLY_CAP_USD;
  } catch (err) {
    context.error('Failed to read usage budget, allowing request', err);
    return true;
  }
}

async function recordUsage(blobServiceClient, promptTokens, completionTokens) {
  const containerClient = blobServiceClient.getContainerClient(USAGE_CONTAINER);
  const month = currentMonthKey();
  const addedCost = promptTokens * PRICE_PER_INPUT_TOKEN_USD + completionTokens * PRICE_PER_OUTPUT_TOKEN_USD;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, etag } = await readUsage(containerClient);
    const baseCost = data && data.month === month ? data.costUsd : 0;
    const updated = { month, costUsd: baseCost + addedCost, updatedAt: new Date().toISOString() };
    try {
      await writeUsage(containerClient, updated, etag);
      return;
    } catch (err) {
      if (err.statusCode === 412 && attempt < 2) continue;
      throw err;
    }
  }
}

async function saveConversation(blobServiceClient, sessionId, messages) {
  const containerClient = blobServiceClient.getContainerClient(LOG_CONTAINER);
  const blobClient = containerClient.getBlockBlobClient(`${sessionId}.json`);

  const payload = JSON.stringify(
    { sessionId, updatedAt: new Date().toISOString(), messages },
    null,
    2
  );

  await blobClient.upload(payload, Buffer.byteLength(payload), {
    overwrite: true,
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
}
