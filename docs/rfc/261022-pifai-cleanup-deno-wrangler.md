---
title: "ПиФ: утилизация Deno Edge Script и Cloudflare Worker после миграции на Bunny Magic Container"
status: done
created: 2026-10-22
completed: 2026-10-22
---

# RFC: Уборка остатков Deno (`includes/edge`) и Cloudflare/Wrangler (`includes/bot`)

## Вводные

Продовый Telegram-бот работает на новой цепочке: **Bunny Magic Container (Hono) → Trigger.dev (LangGraph) → OpenRouter**, история — в Bunny Storage, сайт — на GitHub Pages (S). Миграция завершена, продовый webhook переключён на контейнер, а в репозитории и CI остались два неиспользуемых контура: Deno-проект Bunny Edge Script (`includes/edge`, сборка через экспериментальный `deno bundle`) и прежний Cloudflare Worker (`includes/bot`, `wrangler.toml`) — плюс зависшие ссылки на них в Makefile, workflow и документации (C). Как утилизировать оба контура, не сломав действующую цепочку деплоя и не оставив мёртвых ссылок (Q)? Удалить `includes/edge` и `includes/bot` из репозитория, вычистить Deno/Wrangler-шаги из Makefile и `bot-v2.yml`, отключить и удалить Edge Script в Bunny и привести спецификации и README к целевому состоянию: **Bunny Net + Trigger.dev + GitHub Pages + Telegram-бот** (A).

**S → C → Q → A:** продовый webhook принимает контейнер `mc-of7dlol10n.bunny.run`, Edge Script и Cloudflare Worker не обслуживают трафик (S). Оба контура продолжают жить в репо: тянут Deno в CI, держат воркфлоу деплоя и путают картину в спеках (C). Как убрать остатки, сохранив работающий деплой (Q)? Удалить код, вычистить CI/сборку, снести Edge Script в Bunny и обновить документы (A).

## Назначение и цели

- **Целевая архитектура без трёх лишних стеков:** в проекте остаётся один бот-контур (Node.js: webhook-контейнер + задача Trigger.dev), один стек сайта (Astro → GitHub Pages). Deno и Cloudflare/Wrangler как рантаймы и как понятия исчезают из репозитория, CI и документации.
- **Почему сейчас:** миграция выполнена (RFC 261022, продовый webhook на контейнере), период отката по факту не используется, а мёртвый код продолжает стоить: лишний `deno bundle` (экспериментальная команда) в CI и Makefile, риск случайного деплоя устаревшего приёмника, рассинхрон спецификаций с реальностью.
- **Что сохраняется без изменений:** сайт и wiki (GitHub Pages), контейнер приёма, задача `consult-telegram`, Bunny Storage, все workflow нового контура (`webhook-container.yml`, `services-setup.yml`, `storage-cleanup.yml`, `deploy.yml`), альтернатива build-time RAG (`includes/consult/src/rag/`, `scripts/build-rag-embeddings.ts`, `test/rag.test.ts`) — она осознанно оставлена открытым вопросом RFC 261022 и к Deno/Cloudflare не относится.

## Составляющие и особенности

Разбиение — по типу артефакта, который утилизируется: код, сборка/CI, облачная инфраструктура, документация.

### 1. Код-наследие: удаление `includes/edge` и `includes/bot`

- Удаляется каталог `includes/edge` целиком: `src/`, `test/`, `deno.json`, `deno.lock`, `dist/` — Bunny Edge Script на Deno, заменённый контейнером.
- Удаляется каталог `includes/bot` целиком: `src/`, `scripts/`, `wrangler.toml`, `package.json`, lock-файлы, `CHANGELOG.md`, `test-rag.mjs`, `tsconfig.json` — прежний Cloudflare Worker на Groq/KV.
- Удаляется пустой файл `pif-bot@1.0.0` в корне репозитория (мусорный артефакт, вероятно от ошибочного `npm install`).
- История в git сохраняется — откат к коду возможен через историю коммитов, эксплуатационный откат к Edge Script после удаления — нет (см. «Открытые вопросы»).

### 2. Сборка и CI: очистка Deno/Wrangler-шагов

- **Makefile:** удаляется таргет `deploy-bot` (Deno-проверки + деплой Edge Script), переменная `BUNNY_EDGE_SCRIPT_ID`, упоминания Edge Script в шапке раздела деплоя; таргет `deploy` перестаёт включать `deploy-bot` и сводится к `deploy-website deploy-trigger`.
- **`.github/workflows/bot-v2.yml`:** удаляются шаги `denoland/setup-deno` и `deno task check/test/build` из `verify`; из `deploy` удаляются шаги сборки Edge Script и его публикации через `@bunny.net/cli`; из `paths`-триггера push убирается `includes/edge/**`. Шаги `includes/consult` и `includes/webhook` сохраняются без изменений.
- **`.gitignore`:** убирается строка `.wrangler/`.
- Базовый `npm run test:rag` (Astro-сторона, `test/rag.test.ts`) в `verify` сохраняется — он не связан с удаляемыми контурами.

### 3. Облачная инфраструктура Bunny: вывод Edge Script

- Edge Script `BUNNY_EDGE_SCRIPT_ID = 92871` отключается и удаляется в Bunny (dashboard или API с `BUNNY_API_KEY` из `.env` — по правилам AGENTS.md операция выполняется локально, не через `gh workflow run`).
- GitHub-переменная `BUNNY_EDGE_SCRIPT_ID` удаляется; секрет `BUNNYNET_API_KEY` проверяется на прочие потребители (нужен ли ещё API-ключ после сноса Edge Script — если нет, удаляется).
- Перед удалением подтверждается `getWebhookInfo`: URL webhook указывает на контейнер `https://mc-of7dlol10n.bunny.run/webhook`, а не на Edge Script.

### 4. Документация: спецификации и README

- Удаляются спецификации [edge.md](../specs/includes/edge.md) и [bot.md](../specs/includes/bot.md) — описывают выводимые контура.
- **README.md:** блок «🤖 Чат-бот (Telegram)» переписывается в целевом состоянии (без «продовый webhook ещё не переключён»); из дерева архитектуры убираются строки `includes/edge/` и `includes/bot/`; пункт «История» приводится к факту (cron-очистка `storage-cleanup.yml` вместо «lifecycle-бакета»).
- **RFC 261022** (статус delivery): открытый вопрос о периоде наблюдения закрывается решением «утилизация без ожидания» со ссылкой на этот RFC; разделы про откат на Edge Script помечаются как исторические. Архивация RFC 260928 и 261022 в `docs/rfc/archive/` — по решению на delivery (см. открытые вопросы).
- **AGENTS.md** проекта правок не требует (единственное упоминание Cloudflare — про защищённые сайты при ингесте, не относится к боту).

## Критерии приемки

### Код и CI

- [x] `includes/edge/`, `includes/bot/` и файл `pif-bot@1.0.0` отсутствуют в репозитории; `git grep -i -E "deno|wrangler|cloudflare"` по репо (за исключением исторических RFC и `AGENTS.md`-упоминания защищённых сайтов) не даёт совпадений (шум совпадений допустим только в `package-lock.json` — `@deno/kv` там лишь опциональный peer-деп transitively-зависимого `unstorage` пакета Astro, кода Deno в репо больше нет).
- [x] В Makefile нет `deploy-bot` и `BUNNY_EDGE_SCRIPT_ID`; `make deploy` выполняет только `deploy-website deploy-trigger`; `make` проходит без ошибок.
- [ ] В `bot-v2.yml` нет шагов Deno и публикации Edge Script; workflow проходит end-to-end при ручном запуске (verify + deploy задачи Trigger.dev). *Проверяется после коммита/пуша пользователя (Agent не пушит по правилам AGENTS.md).*
- [x] В `.gitignore` нет `.wrangler/`.

### Инфраструктура

- [x] `getWebhookInfo` возвращает URL контейнера `mc-of7dlol10n.bunny.run` (проверено 2026-10-22, `pending_update_count: 0`); живое сообщение бота в проде — контрольная проверка пользователя после мержа.
- [x] Edge Script 92871 отсутствует в Bunny (удалён 2026-10-22; повторный GET — 404); вместе с ним удалена обслуживавшая его pull zone `pifai-telegram-webhook-cxv54` (6700643). GitHub-переменная `BUNNY_EDGE_SCRIPT_ID` удалена; попутно удалены мёртвые секреты `CF_API_TOKEN` и `GROQ_API_KEY` (остатки deleted `includes/bot`). Секрет `BUNNYNET_API_KEY` оставлен — его используют действующие `webhook-container.yml` и `services-setup.yml`.

### Документация

- [x] `docs/specs/includes/edge.md` и `bot.md` удалены; битых ссылок на них вне исторических RFC нет (проверено grep по документации).
- [x] README описывает только действующую архитектуру (webhook + consult + Bunny Storage + GitHub Pages); дерево каталогов не содержит удалённых путей.
- [x] RFC 261022 обновлён: период наблюдения закрыт («утилизация без ожидания»), откат на Edge Script помечен историческим. Этот RFC заполнен «Тест инструкциями»; архивация RFC 260928/261022 перенесена по решению пользователя.

## Дорожная карта

1. **Код:** удалить `includes/edge/`, `includes/bot/`, `pif-bot@1.0.0`.
2. **Сборка и CI:** почистить Makefile (`deploy-bot`, `BUNNY_EDGE_SCRIPT_ID`, шапку), `bot-v2.yml` (Deno-шаги, деплой Edge Script, path-триггер), `.gitignore`.
3. **Инфраструктура:** подтвердить `getWebhookInfo` на контейнер, отключить и удалить Edge Script 92871 в Bunny, убрать GitHub-переменную `BUNNY_EDGE_SCRIPT_ID`.
4. **Документация:** удалить спеки `edge.md`/`bot.md`, переписать блок бота в README, закрыть открытый вопрос в RFC 261022, дописать «Тест инструкции» в этот RFC, при утверждении — архивировать RFC 260928/261022.

Зависимости: шаг 3 выполняется после 1–2 (код отката не нужен, пока он есть в git, но эксплуатационный откат теряется сразу); шаг 4 — последним, фиксирует результат.

## Итого и рекомендации

Удаляем `includes/edge` (Deno Edge Script) и `includes/bot` (Cloudflare Worker) как класс, вычищаем Deno/Wrangler из Makefile, `bot-v2.yml` и `.gitignore`, сносим Edge Script 92871 в Bunny и приводим спецификации и README к целевому состоянию: **Bunny Net (Magic Container + Storage) + Trigger.dev + GitHub Pages + Telegram-бот** — один бот-контур на Node.js без Deno- и Cloudflare-веток. Рекомендуемый порядок: код → CI → инфраструктура → документация.

## Тест инструкции

### 1. Отсутствие кода и ссылок

- `ls includes/` — только действующие каталоги: `consult`, `landing`, `webhook`; файлов `includes/edge`, `includes/bot`, `pif-bot@1.0.0` нет
- `git grep -i -E "deno|wrangler|edge.?script|includes/edge|includes/bot" -- ':!docs/rfc' ':!package-lock.json'` — пусто (в `package-lock.json` допустим только опциональный peer-деп `@deno/kv` у `unstorage` из Astro)

### 2. Makefile и CI

- `make -n` и `make -n deploy` — без ошибок; `deploy` выполняет только `deploy-website deploy-trigger` ([Makefile](../Makefile))
- [.github/workflows/bot-v2.yml](../../.github/workflows/bot-v2.yml) — нет шагов `denoland/setup-deno`, `deno task …`, публикации `@bunny.net/cli` и пути `includes/edge/**` в триггере; валидность YAML: `npx yaml-lint .github/workflows/bot-v2.yml`
- [test/rag.test.ts](../../test/rag.test.ts) — базовые тесты Astro-стороны: `npm run test:rag` (4/4 pass, запуск 2026-10-22)

### 3. Инфраструктура Bunny / GitHub

- `source .env && curl -s -H "AccessKey: $BUNNY_API_KEY" https://api.bunny.net/compute/script/92871` — 404 `edgeScript.not_found` (скрипт удалён)
- `source .env && curl -s -H "AccessKey: $BUNNY_API_KEY" https://api.bunny.net/pullzone/6700643` — 404 `pullZone.not_found` (зона удалённого Edge Script удалена)
- Приёмники prod-цепочки не затронуты: `curl -s -o /dev/null -w "%{http_code}" https://mc-of7dlol10n.bunny.run/health` → 200; `getWebhookInfo` (`api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo`) → URL `https://mc-of7dlol10n.bunny.run/webhook`
- `gh variable list` — нет `BUNNY_EDGE_SCRIPT_ID`; `gh secret list` — нет `CF_API_TOKEN`/`GROQ_API_KEY`, но есть `BUNNYNET_API_KEY` (нужен `webhook-container.yml` и `services-setup.yml`)

### 4. Прод-пользовательская проверка (после коммита и пуша)

- Коммит и пуш изменений, затем ручной запуск workflow `bot-v2.yml` (workflow_dispatch): job `verify` зелёный без Deno-шагов
- Отправить боту тестовое сообщение в проде — ответ приходит в стиле ННО (webhook-контейнер жив, изменения не трогали приём)

## Открытые вопросы

- ~~**Период наблюдения 14 дней (рекомендация RFC 261022) vs утилизация сегодня.**~~ **Решено:** утилизация проведена сразу (2026-10-22), от консервативной рекомендации отказано — отклонение от RFC 261022 зафиксировано в нём и в [webhook spec](../specs/includes/webhook.md). Эксплуатационный откат на Edge Script невозможен; код остаётся в git-истории.
- ~~**Удалять Edge Script 92871 полностью или только отключить?**~~ **Решено:** удалён полностью (2026-10-22); вместе с ним удалена его обслуживающая pull zone `pifai-telegram-webhook-cxv54` (решение пользователя в ходе delivery — не ограничивалось RFC).
- ~~**Архивация RFC.**~~ **Решено:** отложено — RFC 260928 и RFC 261022 остаются в `docs/rfc/` до отдельной команды пользователя.
- ~~**Секреты GitHub:**~~ **Решено:** `BUNNYNET_API_KEY` остаётся — его активно используют `webhook-container.yml` (обновление образа контейнера) и `services-setup.yml` (env контейнера). Мёртвые секреты `CF_API_TOKEN` и `GROQ_API_KEY` (Cloudflare Worker на Groq, `includes/bot`) удалены — тоже решение пользователя сверх RFC.
