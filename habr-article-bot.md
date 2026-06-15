# Делаем базу знаний и Телеграм бота психотерапевта, с использованием LLM Wiki и CF Workers

В [предыдущей статье](https://habr.com/ru/articles/1042264/) разбирали, как собрать структурированную wiki из markdown-файлов на Astro/Starlight — на примере личного карьерного менеджера. В комментариях появились закономерные вопросы: «почему именно так?», «что за странный выбор стека?», «а для чего ещё это можно использовать, кроме как для себя?».

Хороший вопрос. Эта статья отвечает на него делом.

Та же механика — wiki из markdown — но теперь с Telegram-ботом поверх. Бот умеет искать по базе знаний и отвечать с цитатами и ссылками на источники. В качестве предметной области выбрана психология и философия: получился [@pif_bbot](https://t.me/pif_bbot) — эмпатичный помощник, который работает на основе [открытой базы знаний](https://anatolii-iumashev.github.io/pifai/) по НВО, Юнгу, Франклу и другим авторам.

Весь код — в [репозитории на GitHub](https://github.com/anatolii-iumashev/pifai), папка `bot/`.

---

Когда хочется сделать «умного» бота на своих данных, первая мысль — RAG: векторная БД, эмбеддинги, Pinecone или pgvector. Это работает, но тащит за собой инфраструктуру, зависимости и расходы.

Есть подход проще — **LLM Wiki**: берём статичную базу знаний в markdown, разбиваем на чанки, ищем по ним keyword-поиском и подсовываем найденное в контекст LLM. Никаких эмбеддингов, никаких векторных БД, никаких внешних API для retrieval. Если предметная область достаточно специализирована — психология, юриспруденция, техническая документация — результат сравним с полноценным RAG.

В этой статье мы построим Telegram-бота, который:
- **ищет по базе знаний** с помощью алгоритма Jaccard — детерминированно и быстро
- **цитирует источники** со ссылками на конкретные статьи wiki
- **помнит историю** диалога между сессиями через Cloudflare KV
- **деплоится одной командой** на Cloudflare Workers — бесплатно при умеренной нагрузке

## Стек

- **TypeScript** — единый язык и для бота, и для скриптов сборки
- **Telegraf** — фреймворк для Telegram Bot API
- **Groq API** — бесплатный LLM (Llama-3.1-8b-instant, очень низкая латентность)
- **Cloudflare Workers** — serverless edge, cold start < 5ms, бесплатный tier
- **Cloudflare KV** — хранение истории сессий

## Архитектура

```
Wiki (Markdown) ──► build-knowledge.ts ──► knowledge.ts
                                               │
                                         256 чанков с
                                         предвычисленными
                                         ключевыми словами
                                               │
Telegram ──► CF Worker ──► Retriever ──────────┘
                               │         (Jaccard)
                               ▼
                          Groq LLM ──► ответ с цитатами
                               ▲
                          KV (история)
```

Главная идея: **база знаний встроена прямо в код**. При деплое `knowledge.ts` с 256 чанками загружается в память воркера — никаких запросов к БД, нулевая латентность поиска. Звучит немного безумно, но на практике работает отлично: 29 статей, ~620KB, поиск занимает единицы миллисекунд.

## Подготовка

Нужно:
- Node.js 20+
- Аккаунт [Cloudflare](https://cloudflare.com) (бесплатный)
- Токен Telegram-бота — получить у [@BotFather](https://t.me/BotFather)
- API-ключ [Groq](https://console.groq.com) (бесплатный tier)

Структура проекта (wiki уже есть из предыдущей статьи, добавляем папку `bot/`):

```
pif/
├── src/content/docs/      # Wiki из предыдущей статьи
│   ├── authors/
│   │   ├── jung/
│   │   │   └── shadow.md
│   │   └── frankl/
│   │       └── logotherapy.md
│   └── practices/
│       └── nvc.md
└── bot/
    ├── src/
    │   ├── index.ts       # точка входа CF Workers
    │   ├── bot.ts         # Telegram-обработчики
    │   ├── knowledge.ts   # автогенерированный индекс (не редактировать)
    │   ├── retriever.ts   # поиск
    │   ├── llm.ts         # клиент Groq
    │   ├── session.ts     # сессии через KV
    │   └── prompts.ts     # system prompt
    ├── scripts/
    │   └── build-knowledge.ts
    └── wrangler.toml
```

Установка зависимостей:

```bash
cd bot
npm init -y
npm install telegraf
npm install -D wrangler tsx typescript @cloudflare/workers-types
```

## Шаг 1. Генерация базы знаний

Первый шаг — превратить markdown-файлы wiki в индекс для поиска.

Скрипт `scripts/build-knowledge.ts` делает три вещи:

1. Сканирует `src/content/docs/**/*.md`
2. Разбивает каждую страницу на секции по `## заголовкам`
3. Для каждой секции генерирует список ключевых слов

```typescript
interface WikiChunk {
  id: string;         // "authors/jung/shadow#Тень"
  title: string;      // заголовок страницы
  sourcePath: string; // "authors/jung/shadow.md"
  section: string;    // "## Тень"
  text: string;       // текст секции
  keywords: string[]; // предвычисленные ключевые слова
}
```

Ключевая функция — разбивка страницы на чанки:

```typescript
function chunkPage(page: WikiPage): WikiChunk[] {
  const chunks: WikiChunk[] = [];

  // Убираем секцию "Материалы и источники" — не нужна для поиска
  const body = page.content.replace(/## Материалы и источники[\s\S]*$/, '').trim();

  // Разбиваем по ## заголовкам
  const sections = body.split(/(?=^## )/m);

  for (const section of sections) {
    const headerMatch = section.match(/^## (.+)$/m);
    const sectionName = headerMatch ? headerMatch[1].trim() : '';

    const text = section.replace(/^## .+\n*/m, '').trim();
    if (!text || text.length < 20) continue;

    // Ключевые слова: токенизация заголовка + секции + первых 500 символов текста
    const keywords = tokenize(`${page.title} ${sectionName} ${text.slice(0, 500)}`);

    chunks.push({
      id: `${page.path}#${sectionName}`,
      title: page.title,
      sourcePath: page.path,
      section: sectionName,
      text,
      keywords,
    });
  }

  return chunks;
}
```

Токенизация простая: разбиваем на слова, фильтруем стоп-слова (русские + английские), убираем слова короче 3 символов, дедуплицируем:

```typescript
const STOPWORDS = new Set([
  'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со',
  // ... полный список в репозитории
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on',
]);

function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[а-яёa-z]+/gi) || [];
  return [...new Set(words.filter(w => w.length > 2 && !STOPWORDS.has(w)))];
}
```

Результат — файл `src/knowledge.ts` с массивом `KNOWLEDGE_CHUNKS`. При 29 страницах wiki получается ~256 чанков.

```bash
npm run build  # запускает build-knowledge.ts через tsx
```

> **Важно:** `knowledge.ts` — автогенерированный файл, его не нужно редактировать вручную. Каждый раз при обновлении wiki запускайте `npm run build` перед деплоем.

## Шаг 2. Retriever: поиск по чанкам

Файл `src/retriever.ts` — поиск по чанкам базы знаний.

Для поиска используем **Jaccard-подобное сходство по ключевым словам**:

```
score = |queryTokens ∩ chunkKeywords| / |queryTokens ∪ chunkKeywords|
```

Чем больше общих слов между запросом и чанком — тем выше score. Берём top-K чанков с ненулевым score.

```typescript
export function createRetriever(chunks: WikiChunk[], baseUrl: string): Retriever {
  return {
    retrieve(query: string, topK: number = 3): RetrievedChunk[] {
      const queryTokens = tokenize(query);
      if (queryTokens.length === 0) return [];

      const scored = chunks.map(chunk => {
        const overlap = queryTokens.filter(t => chunk.keywords.includes(t)).length;
        const union = new Set([...queryTokens, ...chunk.keywords]);
        const score = union.size > 0 ? overlap / union.size : 0;
        return { chunk, score };
      });

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .filter(c => c.score > 0)
        .map(c => ({ ...c.chunk }));
    },
    // ...
  };
}
```

**Почему не векторы?**

Вопрос из комментариев к первой статье — отвечаю: семантический поиск через эмбеддинги действительно лучше понимает синонимы и смысловые связи. Но за это нужно платить: API для генерации эмбеддингов, векторное хранилище, дополнительный сетевой вызов на каждый запрос.

Jaccard по ключевым словам оправдан, когда:
- Предметная область узкая и имеет чёткую терминологию
- Пользователи используют термины из самой базы знаний
- Нужна детерминированность — один и тот же запрос всегда даёт одинаковый результат
- Важна минимальная инфраструктура и нулевые операционные расходы

Для психологической базы знаний это работает: запрос «тревога и страх» найдёт чанк про страх в логотерапии Франкла, «конфликт в отношениях» — чанк про амортизацию по Литваку. [Проверьте сами](https://t.me/pif_bbot).

Retriever также отвечает за форматирование найденных чанков для LLM:

```typescript
formatContext(entries: RetrievedChunk[]): string {
  if (entries.length === 0) return '';

  return entries.map((e, i) => {
    const url = `${baseUrl}${wikiPathToUrl(e.sourcePath)}`;
    return `[Источник ${i + 1}]: ${e.title} → ${url}
> ${e.section ? `*${e.section}*` : ''}
>
${e.text.split('\n').map(line => `> ${line}`).join('\n')}`;
  }).join('\n\n---\n\n');
},
```

И за генерацию URL из пути к файлу:

```typescript
function wikiPathToUrl(sourcePath: string): string {
  const withoutExt = sourcePath.replace(/\.md$/, '');
  if (withoutExt.endsWith('/index')) {
    return '/' + withoutExt.replace('/index', '') + '/';
  }
  return '/' + withoutExt + '/';
}
// "authors/jung/shadow.md" → "/authors/jung/shadow/"
```

## Шаг 3. LLM-клиент

Файл `src/llm.ts` — минималистичный враппер над Groq API.

Никаких SDK — только `fetch`. Это принципиально для Cloudflare Workers: крупные SDK вроде официального OpenAI-клиента могут не поддерживать Workers runtime или тащить за собой полтонны зависимостей. Простой `fetch`-враппер надёжнее.

```typescript
export function initLLM(config: LLMConfig): LLMClient {
  return {
    async chat(messages) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq API error ${response.status}: ${err}`);
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || '';
    },
  };
}
```

Groq выбран по трём причинам: бесплатный tier с приличными лимитами, Llama-3.1-8b-instant отвечает за 200–500ms, API совместим с OpenAI — при желании можно поменять провайдер одной строкой. Модель задаётся через env `GROQ_MODEL`, так что для смены модели не нужен редеплой.

## Шаг 4. Сессии в Cloudflare KV

Файл `src/session.ts` — история диалога.

Cloudflare Workers stateless: каждый входящий запрос — чистый контекст. Историю диалога нужно хранить снаружи. KV — идеальный выбор: глобально распределённый key-value store, бесплатный tier включает 100K операций чтения в день.

```typescript
const MAX_HISTORY = 20;

export function initSessionStore(env: { SESSIONS?: KVNamespace }): SessionStore {
  const kv = env.SESSIONS;

  return {
    async get(userId: number): Promise<SessionMessage[]> {
      if (!kv) return [];
      const raw = await kv.get(`session:${userId}`, 'text');
      return raw ? JSON.parse(raw) : [];
    },

    async add(userId: number, message: SessionMessage): Promise<void> {
      if (!kv) return;
      const history = await this.get(userId);
      history.push(message);
      // Храним не больше 20 последних сообщений
      const trimmed = history.slice(-MAX_HISTORY);
      await kv.put(`session:${userId}`, JSON.stringify(trimmed), {
        expirationTtl: 86400 * 7, // TTL 7 дней
      });
    },

    async clear(userId: number): Promise<void> {
      if (!kv) return;
      await kv.delete(`session:${userId}`);
    },
  };
}
```

Ключ сессии: `session:{telegramUserId}`. TTL 7 дней — старые сессии удаляются автоматически, ручная очистка не нужна.

Лимит в 20 сообщений — защита от переполнения контекста LLM. Если история всё равно оказалась слишком большой (Groq вернул `Request too large`), бот сообщает пользователю и предлагает написать `/clear`.

## Шаг 5. System prompt и сборка контекста

Файл `src/prompts.ts` определяет личность и поведение бота.

```typescript
export function SYSTEM_PROMPT(): string {
  return `
Ты — ПиФ, эмпатичный психологический помощник.

База знаний: ННО (Розенберг), Юнг, Франкл, Уилбер, Минделл, Адизес, Литвак.

## Правила

### Структура ответа
- Валидация — отрази чувства
- Наблюдение — факты без оценок
- Концепция — 1-2 предложения из базы знаний
- Вопрос — открытый вопрос или техника

### Цитирование
Когда тебе переданы статьи в контексте:
- Используй ТОЛЬКО URL, которые даны в контексте — копируй как есть
- Формат цитаты: > текст\n> -- [Название](URL)
- НИКОГДА не выдумывай цитаты

### Безопасность
При суициде/самоповреждении: «Пожалуйста, позвони 112 или 8-800-2000-122».
  `;
}
```

Теперь самое интересное — как бот собирает запрос к LLM в `src/bot.ts`:

```typescript
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;

  await ctx.sendChatAction('typing');

  // 1. Получаем историю диалога из KV
  const history = await config.sessions.get(userId);

  // 2. Ищем релевантные статьи в базе знаний
  const relevant = config.retriever.retrieve(userMessage, 2);
  const knowledgeContext = config.retriever.formatContext(relevant);

  // 3. Собираем messages для LLM
  const messages = [
    { role: 'system', content: config.systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
  ];

  // 4. Инжектируем контекст в сообщение пользователя
  const userContent = knowledgeContext
    ? `Найденные статьи (цитируй их):\n\n${knowledgeContext}\n\nВопрос пользователя: ${userMessage}`
    : userMessage;

  messages.push({ role: 'user', content: userContent });

  // 5. Запрос к LLM
  const response = await config.llm.chat(messages);

  // 6. Сохраняем в историю (оригинальное сообщение, без RAG-контекста)
  await config.sessions.add(userId, { role: 'user', content: userMessage, timestamp: Date.now() });
  await config.sessions.add(userId, { role: 'assistant', content: response, timestamp: Date.now() });

  await ctx.reply(response, { parse_mode: 'Markdown' });
});
```

Обратите внимание на шаг 6: в историю сохраняется **оригинальное** сообщение пользователя, без RAG-контекста. Это важно — иначе история раздуется очень быстро. Каждое следующее сообщение потянуло бы за собой несколько статей из базы знаний, и через несколько обменов контекст LLM переполнился бы.

Вот что получает LLM в `userContent`:

```
Найденные статьи (цитируй их):

[Источник 1]: Тень (Юнг) → https://anatolii-iumashev.github.io/pifai/authors/jung/shadow/
> *## Что такое Тень*
>
> Тень — это та часть нашей личности, которую мы отвергаем...

---

[Источник 2]: Эмоции и потребности → https://anatolii-iumashev.github.io/pifai/basics/emotions/
> *## Чувства как сигнал*
>
> В ННО чувства — это индикатор удовлетворённости потребностей...

Вопрос пользователя: почему я злюсь на близких без причины?
```

## Шаг 6. Точка входа: Cloudflare Workers

Файл `src/index.ts` — HTTP-обработчик для Workers.

```typescript
let botInstance: ReturnType<typeof createBot> | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        knowledgeVersion: env.KNOWLEDGE_VERSION || '1.0.0',
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Telegram webhook
    if (request.method === 'POST' && url.pathname === '/webhook') {
      // Lazy init — создаём бота один раз
      if (!botInstance) {
        const llm = initLLM({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL || 'llama-3.1-8b-instant' });
        const sessions = initSessionStore(env);
        const retriever = createRetriever(KNOWLEDGE_CHUNKS, env.KNOWLEDGE_BASE_URL);
        botInstance = createBot({ token: env.TELEGRAM_BOT_TOKEN, llm, sessions, systemPrompt: SYSTEM_PROMPT(), retriever });
      }

      const update = await request.json() as any;
      await botInstance.handleUpdate(update);
      return new Response('ok', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  },
};
```

Два момента, которые важно понять:

**Lazy init.** Воркер инициализируется при первом запросе и переиспользует экземпляр `botInstance`. Cloudflare Workers не гарантирует, что один и тот же инстанс будет жить вечно, но на практике при регулярном трафике он живёт долго — cold start случается редко.

**Всегда 200 для Telegram.** Если вернуть 4xx/5xx, Telegram начнёт повторять запрос с нарастающими интервалами. Мы возвращаем 200 даже при ошибке — Telegram считает, что сообщение доставлено, и не засыпает бота ретраями.

## Конфигурация: wrangler.toml

```toml
name = "pif-bot"
main = "src/index.ts"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]

# KV для сессий
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-kv-namespace-id"

# Переменные окружения
[vars]
GROQ_MODEL = "llama-3.1-8b-instant"
KNOWLEDGE_VERSION = "1.0.0"
KNOWLEDGE_BASE_URL = "https://anatolii-iumashev.github.io/pifai"
```

Флаг `nodejs_compat` нужен, потому что Telegraf использует некоторые Node.js API. Без него при деплое получите ошибки.

## Деплой

### 1. Создаём KV namespace

```bash
npx wrangler kv namespace create SESSIONS
```

Берём `id` из вывода и прописываем в `wrangler.toml`.

### 2. Добавляем секреты

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# вводим токен бота

npx wrangler secret put GROQ_API_KEY
# вводим ключ Groq
```

### 3. Собираем базу знаний и деплоим

```bash
npm run build    # генерирует src/knowledge.ts из wiki
npm run deploy   # wrangler deploy
```

После деплоя Wrangler выведет URL воркера вида `https://pif-bot.username.workers.dev`.

### 4. Регистрируем webhook

```bash
curl "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook?url=https://pif-bot.username.workers.dev/webhook"
```

Проверяем:

```bash
curl "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Должны увидеть `"url": "https://pif-bot.username.workers.dev/webhook"` и `"pending_update_count": 0`.

### 5. Проверяем health

```bash
curl https://pif-bot.username.workers.dev/health
# {"status":"ok","knowledgeVersion":"1.0.0"}
```

Всё — бот работает. Открываем Telegram и пишем.

## Локальная разработка

Для тестирования без деплоя создаём файл `bot/.dev.vars`:

```
TELEGRAM_BOT_TOKEN=your_token_here
GROQ_API_KEY=your_key_here
```

И запускаем:

```bash
npm run dev
# node --env-file=.dev.vars --import tsx src/index.ts
```

В локальном режиме Workers-среды нет, KV тоже нет — история не сохраняется. Но LLM-ответы с RAG работают. Для отладки webhook локально используйте [ngrok](https://ngrok.com) или `wrangler dev` с туннелем.

## Обновление базы знаний

Один из неочевидных плюсов такого подхода — насколько просто обновлять знания бота. Добавили статью в wiki:

```bash
npm run build   # перегенерирует knowledge.ts
npm run deploy  # загружает обновлённый воркер
```

Два шага. Никаких миграций, никакого переиндексирования, никаких embedding-батчей.

Если wiki живёт в отдельном репозитории или как submodule, это легко автоматизируется через GitHub Actions:

```yaml
on:
  push:
    paths:
      - 'src/content/docs/**'

jobs:
  deploy-bot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

Теперь каждый коммит в wiki автоматически обновляет знания бота.

## Что получилось

Итоговый бот [@pif_bbot](https://t.me/pif_bbot) умеет:

- **Находить релевантные статьи** по запросу — даже при неточных формулировках
- **Цитировать источники** со ссылками на [конкретные страницы wiki](https://anatolii-iumashev.github.io/pifai/)
- **Помнить контекст диалога** — отвечает с учётом предыдущих сообщений
- **Сбрасывать историю** командой `/clear`
- **Реагировать на кризисные ситуации** — сразу давать номера телефонов доверия

При этом инфраструктура минимальная: Cloudflare Workers free tier + Groq free tier = **~0₽/мес** при умеренной нагрузке. Для личного проекта или небольшого сообщества — идеально.

## Что можно улучшить

**Семантический поиск.** Jaccard хорошо работает для предметных областей с устойчивой терминологией. Для более размытых запросов стоит посмотреть на [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/) с Workers AI для генерации эмбеддингов — всё в рамках той же платформы, никаких внешних сервисов.

**Автоматическое определение кризисных состояний.** В `prompts.ts` уже есть `CRISIS_DETECTION_PROMPT()` — промпт для классификации сообщений. Можно добавить предварительный вызов LLM перед основным ответом: если бот распознал кризис — сразу переключается на кризисный сценарий, не дожидаясь конца диалога.

**Hybrid search.** Jaccard + BM25 улучшат поиск по длинным запросам без перехода на векторы.

**Мониторинг.** Cloudflare Workers Analytics из коробки показывает запросы, ошибки и latency. Можно добавить структурированное логирование через R2 для более детального анализа.

---

Код проекта: [github.com/anatolii-iumashev/pifai](https://github.com/anatolii-iumashev/pifai) (папка `bot/`)

База знаний: [anatolii-iumashev.github.io/pifai](https://anatolii-iumashev.github.io/pifai/)

Бот: [@pif_bbot](https://t.me/pif_bbot)

Предыдущая статья — [Создание wiki на Astro/Starlight](https://habr.com/ru/articles/1042264/)
