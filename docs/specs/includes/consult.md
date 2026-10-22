---
title: "Consult: консультации в Trigger.dev"
status: done
completed: 2026-10-22
rfc: ../../rfc/261022-pifai-magic-container-langgraph.md
---

# Spec: Consult — LangGraph-агент консультации в Trigger.dev

`includes/consult` — самостоятельный проект Trigger.dev. Задача `consult-telegram` выполняет граф агента (LangGraph, LangChain JS): валидация payload → загрузка истории → маршрут (команда / кризис / консультация) → вызов модели через OpenRouter с навигацией по wiki → сборка ответа → сохранение истории → маркер доставки → отправка в Telegram. Postgres не используется: история диалогов и маркеры доставки лежат в бакете Bunny Storage.

## Граф и файлы

Узлы и условные переходы определены явно в [графе](../../../includes/consult/src/graph.ts) (`validate → load_history → plan_route → {answer_command | answer_crisis | agent ⇄ wiki_tools → assemble} → save_history → claim_delivery → send`):

- [задача](../../../includes/consult/src/trigger/consult-telegram.ts) — вход, очередь и retry-политика
- [граф](../../../includes/consult/src/graph.ts) — узлы, рёбра, сборка ответа, контракты доставки
- [инструменты wiki](../../../includes/consult/src/tools.ts) — `search_wiki` и `read_wiki_page`
- [навигация по wiki](../../../includes/consult/src/wiki.ts) — пакет знаний, карта разделов, лексический поиск по страницам
- [хранилище](../../../includes/consult/src/storage.ts) — история чатов и маркеры доставки в Bunny Storage
- [модель](../../../includes/consult/src/model.ts) — ChatOpenAI через OpenRouter
- [безопасность](../../../includes/consult/src/safety.ts) — кризисные сигналы, очистка URL из текста модели
- [сборка пакета знаний](../../../includes/consult/scripts/build-wiki-pack.mjs) — страницы `src/content/docs/` + скилл поддержки + цитаты → `generated/wiki-pack.json` с `buildId`

## Паттерн LLM Wiki

Поиск по базе знаний — по паттерну LLM Wiki (Karpathy): карта разделов входит в системный контекст, агент сам выбирает и читает страницы инструментами; векторный индекс, эмбеддинги и БД не используются. Измеримый floor навигации — recall@3 лексического поиска по страницам (95,8% на eval-наборе из 30 вопросов, жёсткий порог 80% в `eval/run.ts`). Альтернатива build-time RAG сохранена в репозитории (`src/lib/rag.ts`, `scripts/build-rag-embeddings.ts`, `src/rag/`) и измеряется `npm run eval:retrieval` — переключение на неё возможно при отклонении качества.

## Скилл поддержки

Системный контекст агента формируется из `.agents/skills/support/SKILL.md` (принципы ННО Розенберга: наблюдение — чувство — потребность — просьба, без диагнозов и «надо/должен»). Скилл — источник правил, а не кода: он собирается в пакет задачи при деплое (вместе с wiki, тем же `buildId`); правки правил производятся правкой файла скилла, не кода.

## Хранилище: Bunny Storage вместо Postgres

История чата — JSON-объект `pifai/chats/<chatId>.json` (последние 20 сообщений, lifecycle-правило бакета удаляет объекты старше 7 дней). Маркер доставки — объект `pifai/delivered/telegram/<updateId>`, записывается до отправки; существующий маркер означает «повторный ответ не отправлять». Политика «не отправить дважды» держится на трёх инвариантах: ключ идемпотентности Trigger.dev `pifai:tg:<updateId>` (TTL 7 дней) сериализует повторы одного update, `concurrencyKey` по `chatId` сохраняет порядок сообщений чата, claim пишется до отправки. Условных записей в Bunny Storage нет — GET-then-PUT; миграция `migrations/001_dialogues.sql` из RFC 260928 не применяется.

## Команды

Из `includes/consult`:

```sh
npm ci
npm run check       # сборка пакета знаний + tsc
npm test            # сборка пакета знаний + node:test
npm run eval        # recall@3 навигации по wiki (порог 80%)
npm run eval:retrieval  # сравнение legacy/bm25/hybrid (альтернатива build-time RAG)
npm run dev
npm run deploy
```

Корневые команды: `make consult-test`, `make consult-eval`, `make consult-deploy`, `make bot-test`.

## Окружение

`TELEGRAM_BOT_TOKEN`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (опционально `OPENROUTER_FALLBACK_MODEL`, `OPENROUTER_MAX_TOKENS`, `OPENROUTER_TIMEOUT_MS`), `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_ACCESS_KEY` (опционально `BUNNY_STORAGE_HOST`), `TRIGGER_PROJECT_REF`. Секреты задаются только в серверном окружении Trigger.dev. Порядок переключения продового webhook — в [RFC 260928](../../rfc/260928-pifai-bunny-trigger-openrouter.md).

## Известные ограничения

- Модель OpenRouter и утверждение кризисных контактов — решения отложены (открытые вопросы RFC 260928/261022).
- Если отправка в Telegram упала после успешного claim, повтор задачи ответ не отправит (сообщение могло дойти) — поведение прежней цепочки сохранено.
- История сохраняется после успешной отправки; потеря записи истории при сбое между отправкой и PUT — деградация, влияющая только на контекст следующего ответа.
