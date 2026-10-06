# Bot: прежний Cloudflare Worker

`includes/bot` — предыдущая версия Telegram-бота на Cloudflare Worker. Она использует Groq для ответов, Cloudflare KV для истории и собственный индекс `src/knowledge.ts`. Проект сохранён для отката во время миграции на Bunny и Trigger.dev; автоматический деплой Worker отключён.

Основные файлы: [обработчик](../../../includes/bot/src/index.ts), [бот](../../../includes/bot/src/bot.ts), [конфигурация Wrangler](../../../includes/bot/wrangler.toml). Для работы нужны секреты Cloudflare `TELEGRAM_BOT_TOKEN` и `GROQ_API_KEY`; настройки модели и базы знаний заданы в `wrangler.toml`.

## Команды

Из `includes/bot`:

```sh
npm ci
npx tsc --noEmit
npm run build
npm run preview
```

`npm run build` пересоздаёт `src/knowledge.ts` из wiki. `npm run preview` запускает Worker через Wrangler для локальной проверки. При необходимости ручной публикации старой версии:

```sh
npm run deploy
```

Развёртывание старого Worker само по себе не меняет адрес webhook Telegram. Процедура отката описана в [RFC](../../rfc/260928-pifai-bunny-trigger-openrouter.md).
