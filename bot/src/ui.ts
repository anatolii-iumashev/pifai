export function renderChatPage() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ПиФ Web Chat</title>
  <style>
    body { margin: 0; min-height: 100vh; font-family: Inter, system-ui, sans-serif; background: #f5f6fa; color: #111827; }
    .page { max-width: 760px; margin: 0 auto; padding: 20px; }
    .title { margin: 0 0 14px; font-size: clamp(24px, 5vw, 32px); font-weight: 700; }
    .subtitle { margin: 0 0 20px; color: #4b5563; line-height: 1.6; }
    .chat { display: grid; gap: 16px; }
    .bubble { padding: 14px 16px; border-radius: 18px; line-height: 1.6; max-width: 100%; white-space: pre-wrap; word-break: break-word; }
    .bubble.user { background: #e0f2fe; color: #0f172a; align-self: flex-end; margin-left: auto; }
    .bubble.assistant { background: #f8fafc; color: #111827; border: 1px solid #e2e8f0; }
    .bubble.assistant.loading { background: #eef4ff; border-color: #cfe0ff; }
    .bubble.loading { opacity: 1; font-style: normal; display: inline-flex; align-items: center; gap: 12px; }
    .spinner {
      width: 20px;
      height: 20px;
      min-width: 20px;
      display: inline-block;
      border: 3px solid rgba(37, 99, 235, 0.25);
      border-top-color: #2563eb;
      border-radius: 9999px;
      animation: spin 0.9s linear infinite;
    }
    .loading-text { color: #1f2937; font-style: italic; }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .log { min-height: 320px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    form { display: grid; gap: 12px; }
    textarea { width: 100%; min-height: 100px; resize: vertical; padding: 14px; border: 1px solid #cbd5e1; border-radius: 14px; font: 16px Inter, system-ui, sans-serif; line-height: 1.5; }
    button { width: 100%; padding: 14px 18px; border: none; border-radius: 14px; background: #2563eb; color: white; font-weight: 600; cursor: pointer; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .note { margin-top: 8px; color: #475569; font-size: 14px; }

    @media (max-width: 640px) {
      .page { padding: 16px; }
      .bubble { border-radius: 16px; }
      textarea { min-height: 90px; }
      button { padding: 12px 16px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <h1 class="title">ПиФ Chat</h1>
    <p class="subtitle">Общайтесь с ботом на основе базы знаний по психологии и философии. Он работает через Telegram и веб в одном Worker-е.</p>
    <div class="chat">
      <div id="log" class="log"></div>
      <form id="chat-form">
        <textarea id="message" placeholder="Напишите, что вас беспокоит..." required></textarea>
        <button type="submit">Отправить</button>
      </form>
      <p class="note">История хранится локально и в Cloudflare KV для вашего sessionId.</p>
    </div>
  </div>
  <script>
    const storageKey = 'pif-web-user-id';
    let userId = localStorage.getItem(storageKey);
    if (!userId) {
      userId = 'web-' + Math.random().toString(36).slice(2);
      localStorage.setItem(storageKey, userId);
    }

    const form = document.getElementById('chat-form');
    const messageInput = document.getElementById('message');
    const log = document.getElementById('log');

    function appendBubble(role, text) {
      const el = document.createElement('div');
      el.className = 'bubble ' + role;
      if (role.includes('loading')) {
        el.innerHTML = '<span class="spinner"></span><span class="loading-text">' + text + '</span>';
      } else {
        el.textContent = text;
      }
      log.appendChild(el);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return el;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = messageInput.value.trim();
      if (!message) return;

      appendBubble('user', message);
      const loadingBubble = appendBubble('assistant loading', 'Пишу...');
      messageInput.value = '';
      messageInput.disabled = true;
      form.querySelector('button').disabled = true;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, message }),
        });

        const payload = await response.json();
        if (response.ok && payload.answer) {
          loadingBubble.textContent = payload.answer;
          loadingBubble.classList.remove('loading');
        } else {
          loadingBubble.textContent = payload.error || 'Не удалось получить ответ. Попробуйте позже.';
          loadingBubble.classList.remove('loading');
        }
      } catch (error) {
        loadingBubble.textContent = 'Сервер недоступен. Попробуйте снова.';
        loadingBubble.classList.remove('loading');
      } finally {
        messageInput.disabled = false;
        form.querySelector('button').disabled = false;
        messageInput.focus();
      }
    });

    messageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
  </script>
</body>
</html>`;
}

