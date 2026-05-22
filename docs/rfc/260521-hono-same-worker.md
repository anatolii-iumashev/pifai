# RFC: Hono в том же Worker-е

## Цель

Добавить веб-интерфейс в тот же Cloudflare Worker, где уже работает Telegram-бот, используя Hono как общий роутер. Бот должен работать через оба канала: Telegram и веб.

## Задачи

- сохранить текущий Telegram webhook в `POST /webhook`
- добавить веб-API `POST /api/chat`
- добавить страницу или shell UI на `GET /ui` / `GET /`
- использовать одну общую LLM-логику и ту же сессионную KV-базу
- сохранить развертывание в одном Cloudflare Worker через `wrangler`

## Почему Hono

- легковесный роутер для Cloudflare Workers
- поддерживает и API, и статический UI в одном обработчике
- позволяет объединить телеграмный webhook и веб-канал в одном приложении

## Архитектура

```
bot/
├── src/
│   ├── index.ts           # Hono router
│   ├── bot.ts             # Telegraf + общий message handler
│   ├── llm.ts             # Groq client
│   ├── session.ts         # KV sessions
│   ├── knowledge.ts       # знание из wiki
│   ├── prompts.ts         # system prompt
│   └── ui.ts              # optional built-in HTML/JS page
├── wrangler.toml
├── package.json
```

## Маршруты

- `GET /health` — статус Worker и наличие секретов
- `POST /webhook` — Telegram updates
- `POST /api/chat` — веб-клиент отправляет сообщение, получает ответ
- `GET /ui` — простая web-страница для чата

## Общая логика

- Telegram-обработчики остаются в `bot.ts`
- Общий message flow выносится в helper `handleUserMessage(userId, text)`
- Web UI вызывает тот же helper через `/api/chat`
- История сессий хранится в Cloudflare KV, как и сейчас

## Хранение данных

- Сессии и истории — в Cloudflare KV
- База знаний и код — в Worker
- Веб-клиент не хранит данные отдельно, он просто вызывает API

## Поддержка обоих каналов

Да, требование выполнено:

- `POST /webhook` работает для Telegram
- `POST /api/chat` работает для веб
- единый backend обслуживает оба канала
