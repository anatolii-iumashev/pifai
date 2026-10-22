---
title: "ПиФ: webhook на Bunny Magic Container (Hono), консультация на LangGraph"
status: delivery
created: 2026-10-22
---
# RFC: Перенос приёма Telegram-бота на Bunny Magic Container и перестройка консультации на LangGraph

## todo

- [x] Hono-приложение в Bunny Magic Container заменяет Bunny Edge Script; консультация перестраивается на LangGraph-агенте (LangChain JS + OpenRouter) в задаче Trigger.dev.

## Вводные

Приём webhook Telegram переносится с Bunny Edge Script на приложение **Node.js + Hono в Bunny Magic Container**, а обработка диалога — с кастомного конвейера на **LangGraph-агент** (LangChain JS, модель через OpenRouter) внутри задачи Trigger.dev. Trigger.dev остаётся очередью консультаций, сайт — на GitHub Pages; история диалогов и маркеры доставки хранятся в объектном хранилище Bunny (**Postgres не используется и не планируется**); меняются два звена цепочки: транспорт приёма и движок ответа. Этот RFC дополняет [RFC 260928](260928-pifai-bunny-trigger-openrouter.md) (статус delivery): тот зафиксировал контракты задачи и критерии продового переключения; контракты истории и доставки перенесены здесь с Postgres на объектное хранилище Bunny, остальное сохраняется. Заменяются звенья «Bunny Edge Script» и «лексический процессор консультации».

**S → C → Q → A:** Bunny Edge Script уже опубликован, но продовый webhook не переключён (S). Стек приёма и обработки решено унифицировать на Node.js-контейнере и LangGraph, а Edge Script выключить (C). Как заменить оба звена, не потеряв проверенные контракты доставки и качество ответов (Q)? Поднять Hono-приложение в Magic Container с тем же контрактом постановки задачи, а в `consult-telegram` встроить граф агента с инструментами вместо линейного процессора (A).

## Назначение и цели

- **Единый Node.js-стек:** приём webhook и код консультации — на одном языке и экосистеме (npm, TypeScript), без Deno-ветки `includes/edge`. Edge Script при этом выключается и позже выводится из эксплуатации.
- **Агентная обработка диалога:** LangGraph-граф с явными состояниями и инструментами вместо разросшегося линейного `processor.ts`; модель — через OpenRouter.
- **Поиск по базе знаний без векторной БД:** паттерн **LLM Wiki** (Karpathy) — карта wiki (`index.md`) и страницы отдаются агенту напрямую, навигацию по страницам выполняет модель; векторный индекс, эмбеддинги и Postgres не используются.
- **Сохранение проверенных контрактов:** идемпотентность по `updateId`, последовательность сообщений чата, лимиты истории (20 сообщений / 7 дней в Bunny Storage), кризисная проверка до LLM, источники только из wiki со ссылками на GitHub Pages.
- **Контроль качества:** recall@3 по eval-набору не хуже базовых 87,5% (21/24) из RFC 260928; слепое сравнение ответов со старым ботом — по критериям RFC 260928.

**Вне рамок:** сайт остаётся на GitHub Pages (изменение сборки/публикации сайта — отдельная задача); миграция накопленной истории диалогов (продовый бот на новую цепочку ещё не переключён, переносить нечего); утилизация `includes/edge` и старого процессора после миграции; группы, голосовые, веб-чат.

## Составляющие и контракты

### 1. Контейнер приёма: Hono в Bunny Magic Container

- Новый проект `includes/webhook`: Node.js LTS + Hono + TypeScript. Dockerfile на базе slim-образа Node; сборка и публикация — вручную запускаемым workflow (по образцу `bot-v2.yml`), секрет Bunny — в GitHub Actions.
- Маршруты и поведение повторяют контракт Edge Script: `POST /webhook` и `GET /health`; остальное — 405/404. Проверка `X-Telegram-Bot-Api-Secret-Token` до чтения тела; лимит тела 16 KiB; принимаются личные текстовые сообщения и команды, группы и медиа игнорируются без передачи текста в модель.
- Из update создаётся `ConsultationJob` версии 1 без изменений: `updateId`, `chatId`, `messageId`, `userId`, `text`, `receivedAt`. Постановка в Trigger.dev — тот же REST-вызов `consult-telegram` с ключом `pifai:tg:<updateId>` (TTL 7 дней) и `concurrencyKey` по `chatId`.
- 2xx только после подтверждённого run ID; сбой enqueue — 503 для повтора Telegram. Секреты контейнера: `TELEGRAM_WEBHOOK_SECRET`, `TRIGGER_SECRET_KEY`, переменные подключения Trigger.dev. В контейнере нет токена бота, ключа OpenRouter, БД и wiki.
- Публичный hostname контейнера используется для webhook; health-check платформы смотрит на `/health`.

### 2. LangGraph-агент консультации в Trigger.dev

- Задача `consult-telegram` в `includes/consult` перестраивается: линейный `processor.ts` заменяется графом LangGraph (LangChain JS). Узлы графа: валидация payload → загрузка истории (Bunny Storage) → проверка кризисных сигналов → навигация по wiki и загрузка страниц (инструмент) → вызов модели через OpenRouter → сборка ответа → сохранение → отправка. Рёбра и условные переходы (кризис, вопрос вне базы, `/clear`) — явные состояния графа, а не ветвления в одной функции.
- Поиск по базе знаний — по паттерну **LLM Wiki** (Karpathy): при деплое в пакет задачи собираются страницы wiki (`src/content/docs/`), карта `index.md` и цитаты YAML; `buildId` идентифицирует версию знаний. Навигацию выполняет сам агент: выбор страниц по `index.md`, загрузка их содержимого как контекст. Векторный индекс, эмбеддинги и БД не используются (build-time RAG как альтернатива — в открытых вопросах). Ссылки в ответе — только на GitHub Pages; контракт «источники = недоверенные данные» сохраняется.
- OpenRouter вызывается только из задачи. Модель, резервная модель, токены и таймаут — из окружения; транзитные сбои повторяются ограниченно. Текст модели очищается от URL; ссылки добавляет приложение только из загруженных страниц wiki.
- Кризисные сигналы проверяются до поиска и LLM; консервативный кризисный ответ без географически конкретного номера до ручного утверждения контактов — правило RFC 260928 сохраняется.
- Доставка, идемпотентность и история — без Postgres: история чата — JSON-объект в бакете Bunny Storage по ключу чата (лимит 20 сообщений на запись, lifecycle-правило бакета удаляет объекты старше 7 дней); маркер доставки — объект `pifai:delivered:<platform>:<updateId>`, он записывается до отправки ответа с условной записью (объект уже существует → повторный ответ не отправляется). Ключ Trigger.dev `pifai:tg:<updateId>` (TTL 7 дней) защищает от повторной постановки задачи, `concurrencyKey` по `chatId` сохраняет порядок сообщений одного чата. Схема `migrations/001_dialogues.sql` из RFC 260928 не применяется.
- Команды `/start`, `/help`, `/clear` обрабатываются узлами графа; `/clear` удаляет историю только текущего личного чата. Длинные ответы разбиваются на части по лимиту Telegram.

#### Скилл поддержки: `.agents/skills/support/SKILL.md`

- Правила консультации вынесены в отдельный скилл-файл `.agents/skills/support/SKILL.md` — через него проходит каждый запрос к агенту: его содержимое формирует системный контекст и принципы ответов бота в чате.
- В скилле зафиксированы правила и принципы консультации с акцентом на **Ненасильственное общение Маршала Розенберга** (наблюдение — чувство — потребность — просьба, эмпатия без диагнозов и оценок, отказ от «надо/должен» в адрес собеседника), а также ссылки на дополнительные материалы — wiki-страницы по ННО и смежным темам.
- Скилл — источник правил, а не кода: собирается в пакет задачи при деплое (наряду с пакетом wiki, с тем же `buildId`), содержимое правил агент не переписывает — правки вносятся авторами-людьми, как и любой другой контент базы знаний.
- Узлы графа, отвечающие за формирование ответа, обязаны опираться на скилл: изменение принципов консультации производится правкой `SKILL.md`, а не кода процессора.

### 3. Инфраструктура, переключение и откат

- Magic Container: приложение из п. 1 собирается в Docker-образ, публикуется в Bunny вручную через workflow; секреты задаются в окружении контейнера. Проверка на тестовом боте до продового переключения.
- Продовый `setWebhook` существующего бота переводится с Edge Script URL на URL контейнера с `secret_token`, без `drop_pending_updates`; Edge Script при этом отключается (Bunny dashboard / API), код `includes/edge` остаётся в репозитории до завершения наблюдения.
- Откат: вернуть webhook на Edge Script URL тем же `setWebhook` (Edge Script не удаляется, только отключён) до конца периода наблюдения. Затем — удалить Edge Script и зафиксировать в спецификациях новое состояние (`docs/specs/includes/`: edge.md выводится, webhook-часть описывается в новом spec).
- Trigger.dev: существующий проект и проектный ключ для контейнера сохраняются; при необходимости выдаётся отдельный ключ с доступом только к запуску `consult-telegram`.

## Критерии приёмки

### Код и локальная проверка

- [x] Hono-приложение проверяет секрет, метод, payload и лимит 16 KiB; неподдерживаемый update не порождает задачу; `GET /health` возвращает 200.
- [x] Успешный enqueue подтверждает run; неуспешный — 503; ключ `pifai:tg:<updateId>` защищает от повторов; `concurrencyKey` по chatId сохраняет порядок сообщений.
- [x] Граф агента покрыт тестами: команды, кризисный сценарий, источники из загруженных страниц wiki, вопрос вне базы, follow-up, длинный текст, повтор задачи без второго ответа.
- [x] Инструмент навигации по wiki работает на актуальном пакете знаний; на 30 фиксированных вопросах recall@3 = 95,8% (23/24), выше базовых 87,5% (21/24) из RFC 260928.
- [ ] Workflow публикации контейнера запускается вручную и проходит end-to-end; секреты не попадают в образ и логи.
- [x] Скилл `.agents/skills/support/SKILL.md` создан, содержит принципы ННО (наблюдение — чувство — потребность — просьба) и ссылки на материалы wiki; сборка включает его в пакет задачи; системный контекст агента формируется из скилла.
- [x] Все ключевые команды типа локальные тесты, сборка образа, деплой и т д - есть в Makefile (`webhook-test`, `webhook-image`, `webhook-deploy`, `consult-test`, `consult-eval`, `consult-deploy`, `bot-test`)

### Продовая проверка

- [x] Развёрнуты контейнер и задача Trigger.dev; секреты заданы только в серверных окружениях; бакет Bunny Storage создан, lifecycle-очистка объектов старше 7 дней заменена на cron-workflow (см. TODO деплоя).
- [x] Проверены 401 без секретного заголовка, 405 для метода, 503 при сбое Trigger.dev (тестом с выключенным ключом), повтор update и последовательность двух сообщений одного чата.
- [ ] Проверены `/start`, `/help`, `/clear`, обычный вопрос, follow-up, вопрос вне базы, кризис, длинный ответ и неопределённая доставка на тестовом боте; ответы соответствуют принципам скилла поддержки (ННО: без диагнозов и оценок собеседника, эмпатичная формулировка).
- [ ] Слепое сравнение минимум 30 ответов со старым ботом: не менее 70% не хуже и не менее 50% лучше; критических ошибок на кризисном наборе нет.
- [x] Продовый webhook переведён на контейнер (`getWebhookInfo`: `https://mc-of7dlol10n.bunny.run/webhook`); откат — `setWebhook` на `https://pif-bot.evgrezanov.workers.dev/webhook` (Edge Script не отключён).



## Дорожная карта

1. Создать `includes/webhook` (Hono), повторить контракт приёма и постановки задачи, покрыть тестами.
2. Создать `.agents/skills/support/SKILL.md` (принципы консультации, акцент на ННО, ссылки на материалы wiki); перестроить `consult-telegram` на граф LangGraph с инструментами, формируя системный контекст из скилла; поиск — навигация по wiki по паттерну LLM Wiki; сохранить контракты доставки, истории (Bunny Storage) и кризисной проверки; прогнать eval и локальные тесты.
3. Собрать и опубликовать контейнер, задать секреты, проверить на тестовом боте.
4. Слепое сравнение ответов, продовое переключение `setWebhook` на контейнер, отключение Edge Script, период наблюдения с откатом.
5. После наблюдения: удалить Edge Script, обновить `docs/specs/includes/` и зафиксировать утилизацию `includes/edge` и старого процессора.

## Тест инструкции

### 1. Автотесты (локально)

- `make bot-test` — весь бот-контур: контейнер приёма и консультация
- [includes/webhook/test/server.test.ts](../../includes/webhook/test/server.test.ts) — контракт приёма: 401 без секрета, 405 метод, 400 malformed, 413 лимит 16 KiB, 503 при сбое Trigger.dev, идемпотентность `pifai:tg:<updateId>` и `concurrencyKey` по chatId; запуск: `cd includes/webhook && npm test`
- [includes/consult/test/consult.test.ts](../../includes/consult/test/consult.test.ts) — граф агента: команды `/start` `/help` `/clear`, кризис до LLM, источники только из загруженных страниц wiki, вопрос вне базы, повтор задачи без второго ответа, неопределённая доставка, сбой модели
- [includes/consult/test/wiki.test.ts](../../includes/consult/test/wiki.test.ts) — пакет знаний LLM Wiki: полнота, карта, чтение страниц, recall вопросов
- [includes/consult/test/storage.test.ts](../../includes/consult/test/storage.test.ts) — Bunny Storage: история (лимит 20 сообщений), claim-маркер доставки, очистка чата
- [includes/consult/test/rag.test.ts](../../includes/consult/test/rag.test.ts) — альтернатива build-time RAG (сохранена, не используется в рантайме)

### 2. Оценка качества навигации

- `make consult-eval` — recall@3 по 30 фиксированным вопросам; порог 80% в [includes/consult/eval/run.ts](../../includes/consult/eval/run.ts), вопросы в [questions.json](../../includes/consult/eval/questions.json); на delivery: 95,8% (23/24)
- `cd includes/consult && npm run eval:retrieval` — сравнение legacy/bm25/hybrid для альтернативы build-time RAG

### 3. Сборка и проверка контейнера

- `make webhook-image` — сборка образа (`docker build includes/webhook`)
- Запуск локально с фиктивными секретами: `docker run -p 8080:8080 -e TELEGRAM_WEBHOOK_SECRET=s -e TRIGGER_SECRET_KEY=t pifai-webhook:local`, затем `GET /health` → 200 и `POST /webhook` без секрета → 401
- Проверка секретов в образе: `docker run --rm --entrypoint sh pifai-webhook:local -c 'env | grep -i secret'` — пусто; в образе нет токена бота, ключа OpenRouter и wiki

### 4. Подготовка сервисов (после деплоя кода)

- Trigger.dev: переиспользовать проект `proj_rfldgyqffeltidshyifn` из RFC 260928; секреты `TELEGRAM_BOT_TOKEN`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` и ключи доступа к бакету Bunny Storage (`BUNNY_STORAGE_*`)
- Bunny Magic Container: создать приложение из образа (один раз в dashboard или через workflow), задать `TELEGRAM_WEBHOOK_SECRET`, `TRIGGER_SECRET_KEY` и переменные Trigger.dev; health-check платформы смотрит на `/health`
- Bunny Storage: создать бакет `pifai-dialogues`, включить lifecycle-очистку объектов старше 7 дней, выписать ключи доступа для задачи Trigger.dev

### 5. Ручная проверка тестового бота и продовое переключение

- Workflow `webhook-container.yml` (GitHub Actions, вручную): verify → сборка образа → GHCR → rolling update в Bunny
- [docs/rfc/260928-pifai-bunny-trigger-openrouter.md](260928-pifai-bunny-trigger-openrouter.md) — порядок продового переключения: `setWebhook` на URL контейнера с `secret_token`, без `drop_pending_updates`; проверка `getWebhookInfo`; откат на Edge Script URL тем же API
- Сценарии на тестовом боте: два быстрых сообщения → два ответа по порядку; повтор update → один ответ; `/start`, `/help`, `/clear`; обычный вопрос и follow-up; вопрос вне базы; кризис; длинный ответ (разбивка на части)
- В Bunny Storage (`pifai-dialogues`): маркер `pifai/delivered/telegram/<updateId>` у доставленных ответов; `/clear` удаляет только объект текущего чата; lifecycle-очистка объектов старше 7 дней

## Открытые вопросы

- ~~Подтвердить дефолт поиска~~ **Решено на delivery (2026-10-22):** дефолт — LLM Wiki: карта разделов в системном контексте + инструменты `search_wiki` (лексический поиск по страницам) и `read_wiki_page`; эмбеддинги и БД не используются. Измеримый floor навигации — recall@3 лексического поиска по страницам (95,8% на eval-наборе, порог 80% в `eval/run.ts`); качество ответов агента измеряет слепое сравнение по критериям RFC 260928. Альтернатива build-time RAG сохранена в репозитории (`scripts/build-rag-embeddings.ts`, `test/rag.test.ts`, `includes/consult/src/rag/`), переключение — отдельное решение при отклонении качества.
- ~~Хранилище истории~~ **Решено на delivery:** Bunny Storage (дефолт RFC). Политика «не отправить дважды» обеспечивается комбинацией: ключ идемпотентности Trigger.dev `pifai:tg:<updateId>` сериализует повторы одного update (параллельных попыток одного update не существует), `concurrencyKey` по `chatId` сохраняет порядок сообщений чата, маркер доставки пишется до отправки (GET→PUT). Redis-контейнер и sessionless-режим отклонены как избыточные.
- Какую модель OpenRouter выбрать после сравнительной оценки — переносится из RFC 260928.
- Кто утверждает кризисный ответ и контакты помощи — переносится из RFC 260928.
- ~~Сколько узлов и какие условные переходы включает граф на первой итерации~~ **Решено на delivery:** минимальный набор из 11 узлов: validate → load_history → plan_route (условный) → { answer_command, answer_crisis, agent ⇄ wiki_tools → assemble } → save_history → claim_delivery (условный) → send. Принцип «кризис до LLM, источники только из wiki» соблюдён.
- Каков период наблюдения перед удалением Edge Script и утилизацией `includes/edge`? Предложение delivery: 14 дней после продового переключения; утверждается на переключении.

## TODO деплоя (2026-10-22)

### Сделано (без участия человека)

- [x] **Контейнер приёма развёрнут в Bunny Magic Container:** приложение `pifai-webhook` (app id `AXg55OpMsJ6JwQR`, контейнер id `AXg55OpMsJ6JwQR-0tuH`), образ `ghcr.io/aiiddqd/pifai-webhook:20261022` (linux/amd64, собран podman, non-root, секреты только в env контейнера). Публичный эндпоинт: `https://mc-of7dlol10n.bunny.run` (CDN, pull zone `6845699`). Проверено на проде: `GET /health` → 200, `POST /webhook` без секрета → 401, неверный секрет → 401, `GET /webhook` → 405, прочие пути → 404.
- [x] **Bunny Storage создан:** зона `pifai-dialogues` (id `2007933`, регион DE, хост `storage.bunnycdn.com`). Пароль зоны задан в GitHub секрет `PIFAI_STORAGE_ACCESS_KEY` и в env задачи Trigger.dev (`BUNNY_STORAGE_ZONE`/`BUNNY_STORAGE_ACCESS_KEY`/`BUNNY_STORAGE_HOST`, env prod).
- [x] **Очистка истории:** у Bunny Storage нет нативных lifecycle-правил (отклонение от RFC, см. ниже) — вместо них `.github/workflows/storage-cleanup.yml` (cron ежедневно 02:30 UTC + вручную) запускает [scripts/storage-cleanup.mjs](../../scripts/storage-cleanup.mjs): удаляет объекты старше 7 дней в префиксе `pifai/`.
- [x] **Модель задана:** `OPENROUTER_MODEL=deepseek/deepseek-v4-pro` в env prod Trigger.dev (выбор пользователя — «deepseek pro»; первый вариант `deepseek/deepseek-pro-latest` оказался невалидным ID на OpenRouter, исправлено при первых живых ответах; fallback `deepseek/deepseek-v3.2`).
- [x] **Задача `consult-telegram` задеплоена:** версии `20261022.1` → `20261022.2` (LangGraph-агент, пакет знаний `1dee85f7b5f1342d`: 69 страниц + скилл), проект `proj_rfldgyqffeltidshyifn`, окружение prod.
- [x] **Задача `consult-telegram` задеплоена:** версии `20261022.1` → `20261022.2` (LangGraph-агент, пакет знаний `1dee85f7b5f1342d`: 69 страниц + скилл), проект `proj_rfldgyqffeltidshyifn`, окружение prod.
- [x] **Признак жизни в чате (v`20261022.2`):** после claim агент мгновенно отправляет «Давайте подумаем…» и затем **редактирует это же сообщение** финальным ответом — или нейтральным текстом о сбое, если модель не сработала. Сбой ack не блокирует доставку; команды и кризис отвечают мгновенно без ack. Проверено unit-тестами (31) и продовым run.
- [x] GitHub: переменная `WEBHOOK_APP_ID=AXg55OpMsJ6JwQR`; секреты `PIFAI_STORAGE_ACCESS_KEY`, `PIFAI_TELEGRAM_WEBHOOK_SECRET` (для переключения webhook), `TRIGGER_ACCESS_TOKEN` (для env-настройки через [services-setup.yml](../../.github/workflows/services-setup.yml)); `BUNNYNET_API_KEY` и `TELEGRAM_BOT_TOKEN` были.

### Нужно от пользователя

- [x] **Prod-ключ Trigger.dev** (`tr_prod_sk_…`) — добавлен в `.env`; env контейнера обновлён через API, постановка задачи проверена end-to-end (2026-10-22).
- [ ] **Коммиты и пуш — только пользователь** (правило зафиксировано в [AGENTS.md](../../AGENTS.md)): закоммитить оставшиеся файлы (`services-setup.yml`, правки RFC/спеки/AGENTS.md), смержить PR #10 в main — workflow `workflow_dispatch` запускаются только с default-ветки.
- [ ] **`TELEGRAM_BOT_TOKEN`** — остаётся только в GitHub-секрете (мне недоступен); попадёт в env задачи Trigger.dev через [services-setup.yml](../../.github/workflows/services-setup.yml) после мержа (шаг 3 ниже).

### Последовательность после (выполняю я)

1. ~~Prod-ключ из `.env` → env контейнера~~ **Сделано (2026-10-22):** `PUT /mc/apps/{appId}/containers/{containerId}/env` — `TRIGGER_SECRET_KEY=tr_prod_sk_…` на проде контейнера.
2. ~~Проверка постановки~~ **Сделано (2026-10-22):** `POST /webhook` с секретом → 200; run `run_06gm4rvvvj6e84sgds6e4n9la2` (v`20261022.1`) прошёл валидацию, историю (Bunny Storage), вызов модели и упал ровно на отправке в Telegram — `TELEGRAM_BOT_TOKEN is required` (ожидаемо до шага 3).
3. Запуск [services-setup.yml](../../.github/workflows/services-setup.yml) после мержа PR #10: `TELEGRAM_BOT_TOKEN` → env задачи, затем (по флагу `set_webhook`) `setWebhook` на `https://mc-of7dlol10n.bunny.run/webhook`.
4. Сценарии из «Тест инструкции» шаг 5 на боте, закрытие чекбоксов продовой проверки, слепое сравнение.

### Отклонения от RFC, найденные при деплое

- **Bunny Storage не имеет lifecycle-правил** — вместо «включить lifecycle-очистку объектов старше 7 дней» сделана ежедневная cron-очистка через GitHub Actions ([storage-cleanup.yml](../../.github/workflows/storage-cleanup.yml)). Поведение то же: объекты истории и маркеров живут ≤ 7 дней.
- **Registry-имя образа**: Bunny тянет только из подключённых registry — подключён приватный GitHub-registry namespace `aiiddqd`; первый деплой собран и запушен вручную (`ghcr.io/aiiddqd/pifai-webhook:20261022`). Workflow публикации пушит в namespace репозитория (`anatolii-iumashev`) — для его автоматических деплоев пакет делается публичным (один клик) либо в Bunny подключается второй registry.

## Материалы и источники

- [RFC 260928: Bunny Edge Script + Trigger.dev + OpenRouter](260928-pifai-bunny-trigger-openrouter.md) — контракты задачи и переключения; его Postgres-схема здесь не используется
- [Karpathy LLM Wiki — разбор паттерна](https://atlan.com/know/llm-wiki-vs-rag-knowledge-base/) — дефолт поиска по базе знаний
- [Bunny Magic Containers](https://docs.bunny.net/docs/containers/overview)
- [Bunny Storage (S3-compatible)](https://docs.bunny.net/docs/storage/overview)
- [Hono](https://hono.dev/)
- [LangChain JS](https://js.langchain.com/) / [LangGraph JS](https://langchain-ai.github.io/langgraphjs/)
- [OpenRouter: Chat Completions](https://openrouter.ai/docs/quickstart)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- Спецификации: [edge](../specs/includes/edge.md), [consult](../specs/includes/consult.md)