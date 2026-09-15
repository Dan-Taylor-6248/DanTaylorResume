// Chat assistant widget. Talks to /api/chat, keeps the conversation in
// memory for this tab (sessionStorage just remembers the session id across
// reloads), and lets the visitor download their own transcript client-side.
(function () {
  var STORAGE_KEY = 'dtr-chat-session-id';

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

  var history = [];
  var sending = false;

  function getSessionId() {
    try {
      var existing = sessionStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
    } catch (e) {}
    var id = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2);
    try {
      sessionStorage.setItem(STORAGE_KEY, id);
    } catch (e) {}
    return id;
  }

  var sessionId = getSessionId();

  function openPanel() {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
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

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    history.push({ role: 'user', content: text });
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
        renderMessage('assistant', data.reply);
      })
      .catch(function () {
        pending.remove();
        history.pop();
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
