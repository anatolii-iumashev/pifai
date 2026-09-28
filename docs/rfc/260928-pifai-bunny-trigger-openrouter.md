---
title: "ПиФ: Telegram webhook на Bunny Edge Scripting, консультации в Trigger.dev"
status: delivery
created: 2026-09-28
---

# RFC: Перенос Telegram-бота ПиФ с Cloudflare на Bunny и Trigger.dev

## Вводные

Сайт и база знаний **остаются на GitHub Pages** по прежнему адресу. Меняется только серверная цепочка Telegram: Bunny Edge Script принимает webhook, Trigger.dev выполняет консультацию, OpenRouter предоставляет модель, Postgres хранит ограниченную историю. Старый Cloudflare Worker остаётся доступным для отката до завершения наблюдения. Сборка и публикация Astro/Starlight в `.github/workflows/deploy.yml` не меняют площадку.

## Цели и границы

- Сохранить существующего Telegram-бота и команды `/start`, `/help`, `/clear`.
- Быстро и безопасно принимать Telegram update: секретный заголовок, проверка формата, 2xx только после подтверждённой постановки задачи.
- Обрабатывать личные текстовые чаты в Trigger.dev, обращаться к OpenRouter, отвечать по актуальной wiki с проверенными ссылками на GitHub Pages.
- Не дублировать ответ при повторе webhook или задачи; ограничить историю 20 сообщениями и семью днями.
- Не отправлять личные сообщения и секреты в логи приложения. Проверить видимость и срок хранения payload в самом Trigger.dev до включения продового webhook.

**Вне рамок:** перенос GitHub Pages на Bunny Storage/CDN, группы, голосовые сообщения, веб-чат, перенос старой Cloudflare KV-истории без отдельного решения. Развёртывание сайта по `.github/workflows/deploy.yml` сохраняется.

## Проверенное исходное состояние

| Область | До миграции | Целевая версия |
| --- | --- | --- |
| Сайт | Astro/Starlight на GitHub Pages (`/pifai`) | Без изменений |
| Webhook | `bot/src/index.ts` в Cloudflare Worker, синхронный LLM-вызов, нет проверки секретного заголовка | `includes/edge/src/handler.ts` в standalone Bunny Edge Script |
| Консультация | `bot/src/bot.ts`, Groq, поиск по старому `knowledge.ts` | `includes/consult/src/trigger/consult-telegram.ts`, OpenRouter, свежая сборка wiki |
| История | Cloudflare KV по userId, 20 сообщений / 7 дней | Postgres по chatId, 20 сообщений / 7 дней |
| Публикация бота | Cloudflare job на каждом push | Отдельный проверяемый и вручную запускаемый `bot-v2.yml` |

## Составляющие и контракты

### 1. Bunny Edge Script — только приём

- Standalone Deno/JavaScript script принимает `POST /webhook` и `GET /health`. Другие маршруты и методы отклоняются.
- `X-Telegram-Bot-Api-Secret-Token` проверяется до чтения тела. Тело ограничено 16 KiB. Принимаются личные текстовые сообщения и команды, группы и медиа игнорируются без передачи текста в модель.
- Из update создаётся `ConsultationJob` версии 1: `updateId`, `chatId`, `messageId`, `userId`, `text`, `receivedAt`. Через Trigger.dev REST запускается `consult-telegram` с ключом `pifai:tg:<updateId>` (TTL 7 дней) и `concurrencyKey` по chatId.
- 2xx возвращается после ответа Trigger.dev с run ID; сбой enqueue возвращает 503 для повтора Telegram. Секреты Bunny: `TELEGRAM_WEBHOOK_SECRET` и `TRIGGER_SECRET_KEY`. Скрипт не содержит токен бота, OpenRouter, БД или wiki.
- Для webhook нужен отдельный hostname Bunny Edge Script; статический CDN сайта в этой цепочке не участвует.

### 2. Trigger.dev — консультация и знания

- Задача `consult-telegram` повторно валидирует payload. Очередь выполняет задачи одного чата по одной; лимиты общей параллельности и затрат задаются в проекте Trigger.dev.
- `includes/consult/scripts/build-knowledge.mjs` собирает статьи `.md`, `.mdx` и цитаты YAML при деплое задачи. Детерминированный `buildId` идентифицирует версию знаний. Ссылки продолжают вести на GitHub Pages. Публикация сайта и задачи выполняются раздельно, поэтому порядок релизов и проверка ссылок нужны перед переключением.
- Поиск — BM25-подобное лексическое ранжирование с учётом предыдущего вопроса и удалением повторных URL в top-3. Контекст источников передаётся модели как недоверенные данные.
- OpenRouter вызывается только из задачи. Модель, резервная модель, токены и таймаут заданы окружением; транзитные сбои повторяются ограниченно. Текст модели очищается от URL, а ссылки добавляются приложением только из найденного индекса.
- Кризисные сигналы проверяются до поиска и LLM. В кризисном ответе нет географически конкретного номера до проверки контактов для целевой географии. Это правило требует отдельного ручного ревью до релиза.

### 3. История и доставка

- Postgres хранит статусы `processing → ready → attempted → delivered` и сообщения чата. Ключ `(platform, update_id)` защищает задачу от повтора, `(platform, chat_id, input_message_id, role)` — историю.
- Ответ и история сохраняются транзакционно до отправки. Перед запросом Telegram статус становится `attempted`. Если запрос сорвался после фактической отправки, повтор задачи **не отправляет второй ответ**; статус остаётся `attempted` для ручной проверки. Это консервативная политика доставки, а не гарантия exactly-once.
- Сообщения отправляются простым текстом, при длине свыше лимита Telegram разбиваются на части. `/clear` удаляет историю только текущего личного чата. Старую KV-историю автоматически не импортируем.

### 4. Переключение и откат

- Bunny script уже опубликован по адресу `https://pifai-telegram-webhook-cxv54.bunny.run` (script ID `92871`): `/health` возвращает 200, `GET /webhook` — 405. Проект Trigger.dev `proj_rfldgyqffeltidshyifn` содержит версию задачи `20260928.1`. Токен Telegram, ключ запуска Trigger.dev, Postgres и модель ещё не настроены; продовый webhook не переключён.
- Для функционального запуска применить миграцию БД, задать оставшиеся секреты Trigger.dev и Bunny, проверить задачу на тестовом боте.
- Продовый `setWebhook` существующего бота делать после оценки качества и приватности, без `drop_pending_updates`. Проверить `getWebhookInfo` и реальные диалоги.
- Для отката вернуть прежний URL Cloudflare Worker через `setWebhook`. После периода наблюдения удалить активные Cloudflare/Groq зависимости. Job автоматического Cloudflare-деплоя отключён, сам Worker пока остаётся в аккаунте.

## Критерии приёмки

### Код и локальная проверка

- [x] Bunny webhook проверяет секрет, метод, payload и лимит размера; не запускает задачу для неподдерживаемого update.
- [x] Успешный enqueue подтверждает run; неуспешный даёт 503; стабильный ключ защищает от повторов.
- [x] Команды, кризисный сценарий, источники из индекса, длинный текст и повтор задачи покрыты тестами.
- [x] Индекс собран из текущей wiki и YAML-цитат; на 30 фиксированных вопросах recall@3 для вопросов по базе составляет 21/24 = 87,5%.
- [x] GitHub Pages workflow сохраняет сборку и публикацию сайта; Cloudflare Worker больше не деплоится автоматически.

### Продовая проверка

- [ ] Развёрнуты Postgres, Trigger.dev task и Bunny script; секреты заданы только в серверных окружениях.
- [ ] Проверены 401 без секретного заголовка, 405 для метода, 503 при сбое Trigger.dev, повтор update и последовательность двух сообщений одного чата.
- [ ] Проверены `/start`, `/help`, `/clear`, обычный вопрос, follow-up, вопрос вне базы, кризис, длинный ответ и неопределённая доставка на тестовом боте.
- [ ] Проведено слепое сравнение минимум 30 ответов со старым ботом: не менее 70% обычных ответов не хуже и не менее 50% лучше; нет критической ошибки на кризисном наборе.
- [ ] Проверены доступность ссылок GitHub Pages, отсутствие личного текста в прикладных логах, срок хранения и доступ к payload Trigger.dev, удаление истории через 7 дней.
- [ ] Зафиксировано решение по старой KV-истории и срок отката; затем `getWebhookInfo` показывает Bunny URL без растущей очереди ошибок.

## Дорожная карта

1. Реализовать Edge Script и Trigger task, собрать знания при деплое, покрыть локальными тестами. **Выполнено.**
2. Создать Trigger.dev проект и развернуть задачу и Bunny Script. **Код опубликован; функциональная настройка ещё нужна.**
3. Выбрать Postgres и модель OpenRouter, задать оставшиеся секреты, применить SQL-миграцию, проверить на отдельном тестовом боте и закрыть вопросы приватности и кризисного ответа.
4. Выполнить оценку ответов и продовое переключение `setWebhook` с наблюдением и готовым откатом.
5. После периода отката удалить старые Cloudflare/Groq ресурсы и обновить актуальные спецификации.

## Тест инструкции

### 1. Локальные тесты

- [includes/edge/test/handler.test.ts](../../includes/edge/test/handler.test.ts) — `cd includes/edge && npm ci && npm test && npm run check && npm run build`.
- [includes/consult/test/processor.test.ts](../../includes/consult/test/processor.test.ts) и [includes/consult/test/telegram.test.ts](../../includes/consult/test/telegram.test.ts) — `cd includes/consult && npm ci && npm test && npm run check`.
- [includes/consult/eval/questions.json](../../includes/consult/eval/questions.json) — 30 размеченных вопросов, запуск `cd includes/consult && npm run eval`.

### 2. Подготовка сервисов

- [includes/consult/migrations/001_dialogues.sql](../../includes/consult/migrations/001_dialogues.sql) — применить в выбранном Postgres.
- [includes/consult/trigger.config.ts](../../includes/consult/trigger.config.ts) — задать `TRIGGER_PROJECT_REF`; в Trigger.dev установить `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `OPENROUTER_API_KEY` и выбранный `OPENROUTER_MODEL`.
- [includes/edge/src/index.ts](../../includes/edge/src/index.ts) — в Bunny установить секреты `TELEGRAM_WEBHOOK_SECRET` и `TRIGGER_SECRET_KEY`; развернуть через [bot-v2.yml](../../.github/workflows/bot-v2.yml).

### 3. Проверка тестового webhook

- `GET /health` на Bunny hostname — только `{"status":"ok"}`.
- `POST /webhook` без секретного заголовка — 401; с неверным методом — 405.
- На тестовом боте отправить два быстрых сообщения, повторить тот же update и проверить ровно один run/ответ, затем проверить команды и кризисный сценарий.
- Проверить в Postgres статусы доставки, изоляцию `/clear` и удаление сообщений старше семи дней; в Trigger.dev проверить видимость payload и логи.

### 4. Продовое переключение

- Через [Telegram Bot API](https://core.telegram.org/bots/api#setwebhook) установить Bunny URL с `secret_token` без `drop_pending_updates`; проверить `getWebhookInfo`.
- При сбое вернуть прежний Cloudflare URL тем же API и проверить ответ старого Worker.

## Открытые вопросы

- Где размещать Postgres с учётом географии пользователей и чувствительности переписки?
- Проект Trigger.dev создан; для Bunny нужен отдельный продовый ключ Trigger.dev с доступом только к запуску `consult-telegram`. Кто создаёт и хранит его после настройки?
- Какую модель OpenRouter выбрать после сравнительной оценки? Текущий код требует явный `OPENROUTER_MODEL`.
- Допустим ли сброс истории KV при переключении, и сколько дней держать старый Worker для отката?
- Кто утверждает кризисный ответ и контакты помощи для целевой географии?
- Какой срок хранения и режим доступа к текстовым payload предлагает выбранный план Trigger.dev?

## Материалы и источники

- [Bunny: standalone Edge Scripts](https://docs.bunny.net/docs/scripting/standalone/overview)
- [Bunny: секреты Edge Scripts](https://docs.bunny.net/docs/scripting/secrets)
- [Trigger.dev: постановка задач](https://trigger.dev/docs/triggering)
- [Trigger.dev: очереди и concurrency keys](https://trigger.dev/docs/queue-concurrency)
- [OpenRouter: Chat Completions](https://openrouter.ai/docs/quickstart)
- [Telegram Bot API](https://core.telegram.org/bots/api)
