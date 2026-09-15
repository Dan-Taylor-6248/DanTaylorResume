const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const SYSTEM_PROMPT = require('../context/systemPrompt');

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const LOG_CONTAINER = 'chat-logs';
const SESSION_ID_PATTERN = /^[a-zA-Z0-9-]{8,100}$/;

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

    const fullHistory = [...history, { role: 'assistant', content: reply }];

    try {
      await saveConversation(sessionId, fullHistory);
    } catch (err) {
      context.error('Failed to save conversation log', err);
    }

    return { status: 200, jsonBody: { reply } };
  },
});

async function saveConversation(sessionId, messages) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) return;

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
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
