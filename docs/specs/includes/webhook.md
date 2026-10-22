---
title: "Webhook: приём Telegram-обновлений в Bunny Magic Container"
status: done
completed: 2026-10-22
rfc: ../../rfc/261022-pifai-magic-container-langgraph.md
---

# Spec: Webhook — Hono-приёмник Telegram-обновлений

`includes/webhook` — Node.js LTS + Hono + TypeScript, публикуется как Docker-образ в Bunny Magic Container. Заменяет Bunny Edge Script (см. [edge](./edge.md), выводится из эксплуатации): принимает `POST /webhook`, проверяет секретный заголовок Telegram и ставит личные текстовые сообщения в задачу `consult-telegram` на Trigger.dev. `GET /health` — для health-check платформы. В контейнере нет токена бота, ключа OpenRouter, БД и wiki — только секреты приёма и переменные Trigger.dev.

## Контракт (наследован от Edge Script)

- `POST /webhook`: проверка `X-Telegram-Bot-Api-Secret-Token` до чтения тела; 401 без/с неверным секретом; лимит тела 16 KiB (объявленный `Content-Length` и поток), 413; 400 для malformed payload; 200 «Ignored» для групп, медиа и не-текстовых сообщений без постановки задачи; 405 для других методов, 404 для остальных путей.
- Из update создаётся `ConsultationJob` версии 1 (`updateId`, `chatId`, `messageId`, `userId`, `text`, `receivedAt`) и ставится в Trigger.dev REST-вызовом `POST /api/v1/tasks/consult-telegram/trigger` с `idempotencyKey: pifai:tg:<updateId>` (TTL 7 дней) и `concurrencyKey: <chatId>`.
- 2xx только после подтверждённого run ID; сбой постановки — 503, чтобы Telegram повторил доставку.

## Файлы

- [приложение](../../../includes/webhook/src/server.ts) — маршруты, проверка секрета, лимиты
- [контракт задачи](../../../includes/webhook/src/job.ts) — `ConsultationJob`, разбор update
- [постановка](../../../includes/webhook/src/trigger.ts) — вызов Trigger.dev
- [тесты](../../../includes/webhook/test/server.test.ts) — весь контракт приёма

## Сборка и публикация

- [Dockerfile](../../../includes/webhook/Dockerfile) — multi-stage на `node:22-slim`, non-root user, `EXPOSE 8080`, порт из `PORT`. Секреты не попадают в образ: они задаются в окружении контейнера Bunny.
- Публикация — вручную запускаемым workflow [webhook-container.yml](../../../.github/workflows/webhook-container.yml): verify → сборка образа → GHCR → rolling update через `BunnyWay/actions/container-update-image`. Секреты workflow: `BUNNYNET_API_KEY` (Actions); переменная `WEBHOOK_APP_ID` (ID приложения в Magic Containers); секреты окружения контейнера задаются в Bunny, не в Actions: `TELEGRAM_WEBHOOK_SECRET` и `TRIGGER_SECRET_KEY`.
- Приложение в Bunny создаётся один раз (образ из GHCR, health-check на `/health`); дальнейшие релизы — обновлением тега образа workflow.
- Публичный hostname контейнера используется для `setWebhook` продового бота (порядок переключения и откат — [RFC 260928](../../rfc/260928-pifai-bunny-trigger-openrouter.md)).

## Команды

Из корня репозитория:

```sh
make webhook-test    # npm ci + tsc + node:test
make webhook-image   # docker build
make webhook-deploy  # ручной запуск GitHub Actions
```

Из `includes/webhook`: `npm run dev` (локальный сервер), `npm run build && npm start`.

## Окружение контейнера

`TELEGRAM_WEBHOOK_SECRET`, `TRIGGER_SECRET_KEY`, опционально `TRIGGER_API_URL` (по умолчанию `https://api.trigger.dev`) и `PORT` (по умолчанию 8080).
