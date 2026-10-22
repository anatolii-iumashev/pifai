---
title: "Webhook: приём Telegram-обновлений в Bunny Magic Container"
status: done
completed: 2026-10-22
rfc: ../../rfc/261022-pifai-magic-container-langgraph.md
---

# Spec: Webhook — Hono-приёмник Telegram-обновлений

`includes/webhook` — Node.js LTS + Hono + TypeScript, публикуется как Docker-образ в Bunny Magic Container. Заменил Deno Edge Script 92871 (удалён 2026-10-22 вместе с pull zone и `includes/edge`; решение — [RFC утилизации](../../rfc/261022-pifai-cleanup-deno-wrangler.md)): принимает `POST /webhook`, проверяет секретный заголовок Telegram и ставит личные текстовые сообщения в задачу `consult-telegram` на Trigger.dev. `GET /health` — для health-check платформы. В контейнере нет токена бота, ключа OpenRouter, БД и wiki — только секреты приёма и переменные Trigger.dev.

## Контракт приёма

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

## Развёрнутое состояние (2026-10-22)

- Приложение `pifai-webhook` в Bunny Magic Container, app id `AXg55OpMsJ6JwQR`, контейнер `webhook`, регион DE (единственный required), runtime `shared`, autoscaling 1–10.
- Первый образ `ghcr.io/aiiddqd/pifai-webhook:20261022` собран и запушен вручную (podman, linux/amd64); в Bunny подключён приватный GitHub-registry namespace `aiiddqd` (registry id `10060`).
- Эндпоинт: `https://mc-of7dlol10n.bunny.run` (CDN, pull zone `6845699`, SSL, container port 8080). Health-check платформы: readiness/liveness HTTP GET `/health:8080`.
- Env контейнера: `TELEGRAM_WEBHOOK_SECRET` (сгенерирован, хранится локально в `.env` и в Bunny), `TRIGGER_SECRET_KEY` (плейсхолдер до предоставления ключа проекта Trigger.dev), `TRIGGER_API_URL=https://api.trigger.dev`.
- Проверено на проде: `/health` 200, `POST /webhook` без/с неверным секретом 401, `GET /webhook` 405, прочие пути 404.
- Очистка истории (Bunny Storage): ежедневный cron [storage-cleanup.yml](../../../.github/workflows/storage-cleanup.yml) → [storage-cleanup.mjs](../../../scripts/storage-cleanup.mjs); зона `pifai-dialogues` (id `2007933`, DE), пароль — GitHub секрет `PIFAI_STORAGE_ACCESS_KEY` + env задачи Trigger.dev. Нативных lifecycle у Bunny Storage нет.
- Автоматические релизы (workflow пушит `ghcr.io/anatolii-iumashev/pifai-webhook`) заработают после того, как пакет станет публичным в GitHub UI либо в Bunny будет подключён второй registry; до этого — ручная сборка и `podman push` в namespace `aiiddqd` + обновление тега контейнера (PATCH через Magic Containers API).

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
