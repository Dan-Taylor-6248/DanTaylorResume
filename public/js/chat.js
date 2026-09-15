// Chat assistant widget. Talks to /api/chat and persists the conversation
// (and whether the panel is open) in sessionStorage, so it survives
// navigating between pages in the same tab, not just page reloads. Lets
// the visitor download their own transcript client-side.
(function () {
  var SESSION_KEY = 'dtr-chat-session-id';
  var HISTORY_KEY = 'dtr-chat-history';
  var OPEN_KEY = 'dtr-chat-open';

  var widget = document.getElementById('chat-widget');
  if (!widget) return;

  var toggle = document.getElementById('chat-toggle');
  var panel = document.getElementById('chat-panel');
  var closeBtn = document.getElementById('chat-close');
  var messagesEl = document.getElementById('chat-messages');
  var form = document.getElementById('chat-form');
  var input = document.getElementById('chat-input');
  var sendBtn = form.querySelector('.chat-send');
  var downloadBtn = document.getElementById('chat-download');

  var sending = false;

  function getSessionId() {
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;
    } catch (e) {}
    var id = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2);
    try {
      sessionStorage.setItem(SESSION_KEY, id);
    } catch (e) {}
    return id;
  }

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(HISTORY_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {}
  }

  function saveOpenState(isOpen) {
    try {
      sessionStorage.setItem(OPEN_KEY, isOpen ? '1' : '0');
    } catch (e) {}
  }

  function wasOpen() {
    try {
      return sessionStorage.getItem(OPEN_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  var sessionId = getSessionId();
  var history = loadHistory();

  function openPanel(focusInput) {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    saveOpenState(true);
    if (focusInput !== false) input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    saveOpenState(false);
  }

  toggle.addEventListener('click', function () {
    if (panel.hidden) openPanel(); else closePanel();
  });
  closeBtn.addEventListener('click', closePanel);

  function renderMessage(role, text) {
    var bubble = document.createElement('div');
    bubble.className = 'chat-message chat-message-' + role;
    bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function setSending(isSending) {
    sending = isSending;
    sendBtn.disabled = isSending;
    input.disabled = isSending;
  }

  // Restore any conversation from a previous page on this same visit.
  history.forEach(function (m) {
    renderMessage(m.role, m.content);
  });
  if (history.length > 0) downloadBtn.disabled = false;
  if (wasOpen()) openPanel(false);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    history.push({ role: 'user', content: text });
    saveHistory();
    renderMessage('user', text);
    downloadBtn.disabled = false;

    var pending = renderMessage('assistant', 'Thinking...');
    pending.classList.add('chat-message-pending');
    setSending(true);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, messages: history }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error((data && data.error) || 'Request failed');
          return data;
        });
      })
      .then(function (data) {
        pending.remove();
        history.push({ role: 'assistant', content: data.reply });
        saveHistory();
        renderMessage('assistant', data.reply);
      })
      .catch(function () {
        pending.remove();
        history.pop();
        saveHistory();
        renderMessage('assistant', "Sorry, I'm having trouble responding right now. Please try again in a moment.");
      })
      .finally(function () {
        setSending(false);
        input.focus();
      });
  });

  downloadBtn.addEventListener('click', function () {
    if (history.length === 0) return;
    var lines = history.map(function (m) {
      return (m.role === 'user' ? 'You' : 'Assistant') + ': ' + m.content;
    });
    var blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'dan-taylor-chat-' + sessionId.slice(0, 8) + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
})();
