# ПиФ — Психология и Философия

Психология и философия связаны исторически: до XIX века психология была частью философии, а ключевые вопросы сознания и познания они исследуют совместно. Философия задаёт мировоззренческие рамки и ставит фундаментальные вопросы, а психология предлагает эмпирические методы их изучения и решения практических задач. Эта связка позволяет глубже понять человека — и теоретически, и на уровне конкретных механизмов психики. Поэтому объединение этих дисциплин в базе знаний и чат‑боте даёт комплексный взгляд на природу человека, его мышление и поведение.


GitHub: https://github.com/anatolii-iumashev/pif


## Сценарии использования (Use Cases)

Чат-бот ПиФ помогает в типовых жизненных ситуациях — каждый сценарий рассматривается через призму разных психологических школ:

- **Тревога, страхи, фобии** — КПТ, экспозиция, техники самопомощи при панических атаках и генерализованной тревоге
- **Депрессия, апатия, выгорание** — как различить, стадии выгорания, когда нужен врач
- **Зависимости и компульсивное поведение** — понимание механизмов, первые шаги к изменениям
- **Кризисы: идентичности, смысла, возрастные** — экзистенциальные вопросы, поиск себя, переходные периоды
- **Самоотношение: стыд, вина, низкая самооценка** — работа с внутренним критиком, принятие себя
- **Отношения: конфликты, границы, привязанность** — ННО-диалог, амортизация, здоровые границы
- **Травма, горе и утрата** — проживание потери, работа с тяжёлыми воспоминаниями
- **Трудности с мотивацией и дисциплиной** — прокрастинация, постановка целей, работа со смыслом
- **Духовные кризисы и поиск себя** — интегральная карта, работа с Тенью, юнгианский анализ

> Подробнее: [Проблематика и Use cases](src/content/docs/use-cases/index.md)

## Составляющие и особенности

- **🫂 Чат-бот 24/7** — эмпатичная психологическая поддержка в Telegram, доступная в любое время. Не заменяет терапию, но помогает между сессиями и в кризисные моменты.
- **🧠 7 подходов + MBTI** — интегральный синтез: ННО (Розенберг), аналитическая психология (Юнг), логотерапия (Франкл), интегральная теория (Уилбер), процессуальная психология (Минделл), методология Адизеса, психологическое айкидо (Литвак) и типология MBTI.
- **💬 ННО-диалог** — каждый ответ строится на 4 компонентах ненасильственного общения: наблюдение → чувство → потребность → просьба. Без оценок, без советов, с безусловным принятием.
- **🛡️ Кризисное распознавание** — автоматически определяет суицидальные и кризисные маркеры, предлагает контакты экстренных служб и эскалирует к специалисту.
- **🔧 Техники самопомощи** — не просто разговоры, а рабочие инструменты: заземление 5-4-3-2-1, дневник эмоций, работа с Тенью, парадоксальная интенция, амортизация в конфликтах.
- **🔐 Полная анонимность** — никаких персональных данных, открытый код, минимальные логи (только технические без содержания и истории), шифрование. Приватность как фундаментальный принцип.
- **📚 Открытая база знаний** — LLM Wiki (Andrej Karpathy), открытый стек на Astro + Starlight. Всё в открытом доступе на GitHub Pages.
- **🧩 Интегральная мета-карта** — AQAL-модель Уилбера как навигатор по всем подходам: помогает подобрать нужную технику под конкретный запрос и уровень.


---

## 📚 База знаний

Проект использует LLM Wiki архитектуру для накопления и структурирования знаний.

### Структура

```
pl-chat/
├── raw/                       # Immutable источники
│   └── YYYY/MMDD/             # Дата-организованные файлы
├── src/content/docs/          # Wiki-страницы
│   ├── basics/                # 1. База и вводные — с чего начать
│   ├── use-cases/              # 2. Проблематика и Use cases
│   ├── practices/             # 3. Практики и техники
│   ├── quotes/                # 4. Цитаты великих людей
│   ├── authors/               # 5. Авторы и школы
│   │   ├── nvc/               #   ННО (Розенберг)
│   │   ├── jung/              #   Юнгианская психология
│   │   ├── frankl/            #   Логотерапия (Франкл)
│   │   ├── wilber/            #   Интегральная теория (Уилбер)
│   │   ├── mindell/           #   Процессуальная психология (Минделл)
│   │   ├── adizes/            #   Методология Адизеса
│   │   └── litvak/            #   Психологическое айкидо (Литвак)
│   ├── typology/              # 6. Классификация и типология
│   │   └── mbti/              #   MBTI
│   ├── addons/                  # 7. Дополнения
│   │   ├── integral/          #   Интеграция подходов
│   │   ├── faq/               #   FAQ
│   │   └── queries/           #   Сохранённые ответы
│   ├── index.md               # Каталог
│   └── log.md                 # Журнал операций
├── .agents/skills/            # Скиллы для работы с вики (в проекте!)
├── AGENTS.md                  # Wiki schema
└── README.md
```

### Оглавление

- **[1. База и вводные](src/content/docs/basics/index.md)** — с чего начать, базовая психологическая грамотность
  - [Что такое психика](src/content/docs/basics/what-is-psyche.md) — сознание, бессознательное и модель Фрейда
  - [Эмоции и потребности](src/content/docs/basics/emotions-and-needs.md) — эмоциональная грамотность и 6 групп потребностей
- **[2. Проблематика и Use cases](src/content/docs/use-cases/index.md)** — типовые запросы: тревога, депрессия, кризисы, отношения
  - [Тревога, страхи, фобии](src/content/docs/use-cases/anxiety-fears.md) — виды расстройств, КПТ, экспозиция
  - [Депрессия, апатия, выгорание](src/content/docs/use-cases/depression-burnout.md) — как различить и что делать
- **[3. Практики и техники](src/content/docs/practices/index.md)** — рабочие инструменты
  - [Техника ННО: 4 шага](src/content/docs/practices/nvc-4-steps.md)
  - [Работа с Тенью](src/content/docs/practices/shadow-work.md)
  - [Техника парадоксальной интенции](src/content/docs/practices/paradoxical-intention-exercise.md)
  - [Техника амортизации в конфликте](src/content/docs/practices/amortization-exercise.md)
  - [Дневник эмоций и потребностей](src/content/docs/practices/emotional-diary.md)
  - [Техника заземления 5-4-3-2-1](src/content/docs/practices/grounding-5-4-3-2-1.md)
- **[4. Цитаты великих людей](src/content/docs/quotes/index.md)** — вдохновение и мотивация
  - [Лев Толстой](src/content/docs/quotes/tolstoy.md) — из «Круга Чтения» и «Пути Жизни»
  - [Карл Юнг](src/content/docs/quotes/jung.md) — о самопознании и Тени
  - [Виктор Франкл](src/content/docs/quotes/frankl.md) — о смысле и страдании
  - [Маршалл Розенберг](src/content/docs/quotes/rosenberg.md) — об эмпатии и потребностях
  - [Другие мыслители](src/content/docs/quotes/others.md) — Фрейд, Эпиктет, Марк Аврелий, Будда и др.
- **[5. Авторы и школы](src/content/docs/authors/index.md)** — ключевые идеи авторов и подходов
  - [ННО — Розенберг](src/content/docs/authors/rosenberg/index.md)
    - [4 компонента ННО](src/content/docs/authors/rosenberg/4-components.md)
  - [Юнг](src/content/docs/authors/jung/index.md)
    - [Архетипы](src/content/docs/authors/jung/archetypes.md)
    - [Тень](src/content/docs/authors/jung/shadow.md)
  - [Франкл](src/content/docs/authors/frankl/index.md)
    - [Три источника смысла](src/content/docs/authors/frankl/three-sources-of-meaning.md)
    - [Парадоксальная интенция](src/content/docs/authors/frankl/paradoxical-intention.md)
  - [Уилбер](src/content/docs/authors/wilber/index.md)
    - [AQAL-модель](src/content/docs/authors/wilber/aqal-four-quadrants.md)
  - [Минделл](src/content/docs/authors/mindell/index.md)
    - [Dreambody](src/content/docs/authors/mindell/dreambody.md)
  - [Адизес](src/content/docs/authors/adizes/index.md)
    - [PAEI-роли](src/content/docs/authors/adizes/paei-roles.md)
  - [Литвак](src/content/docs/authors/litvak/index.md)
    - [Метод амортизации](src/content/docs/authors/litvak/amortization.md)
- **[6. Классификация и типология](src/content/docs/typology/index.md)** — справочник моделей и аббревиатур
  - [MBTI](src/content/docs/typology/mbti/index.md) — 4 дихотомии, 8 функций, 16 типов
- **[7. Дополнения](src/content/docs/addons/index.md)** — служебные и мета-материалы
  - [Интеграция подходов](src/content/docs/addons/integral/index.md)
  - [FAQ](src/content/docs/addons/faq/index.md)
  - [Queries](src/content/docs/addons/queries/index.md)

---
---
## 🤖 Чат-бот (Telegram)

Telegram-бот на стеке **Node.js + Cloudflare Workers + Groq (Llama-3.3-70B)** с базой знаний из вики.

### Архитектура

```
bot/
├── src/
│   ├── index.ts           # Cloudflare Workers entry (webhook + health)
│   ├── bot.ts             # Обработчики Telegram
│   ├── knowledge.ts       # База знаний (конденсированная для TPM-лимитов)
│   ├── llm.ts             # Клиент Groq (raw fetch, CF Workers compatible)
│   ├── session.ts         # История чатов (Cloudflare KV)
│   ├── prompts.ts         # System prompt + шаблоны
│   └── utils.ts           # Вспомогательные функции
├── scripts/
│   └── build-knowledge.ts # Скрипт сборки знаний из src/content/docs/
├── wrangler.toml          # Cloudflare Workers конфиг
├── package.json
└── .dev.vars              # Локальные переменные (не коммитить)
```

### Быстрый старт

```bash
cd bot
npm install
# Заполнить .dev.vars токенами
npm run dev            # Локальный запуск (Node.js long polling)
npm run build          # Сборка базы знаний из вики
npm run deploy         # Деплой в Cloudflare Workers
```

### Статус

- ✅ Работает на **Cloudflare Workers** — без постоянного сервера
- ✅ Webhook от Telegram через `POST /webhook`
- ✅ Long polling для локальной разработки (`npm run dev`)
- ✅ История сессий в KV (7 дней, 20 сообщений)
- ✅ Retry при rate limit Groq
- ✅ Дисклеймер после каждого ответа

### Команды бота

- `/start` — начать диалог
- `/help` — справка
- `/clear` — сбросить историю

---
## �️ Дорожная карта

Планы по развитию проекта «ПиФ»:

- [ ] **Чат-бот в Telegram** — запуск первой версии бота ./docs/rfc/260515-bot.md
- [ ] **Интеграция с LLM** — подключение языковой модели для эмпатичных ответов в стиле ННО
- [ ] **Практики и упражнения** — интерактивные техники: дневник эмоций, заземление 5-4-3-2-1, работа с Тенью
- [ ] **Персонализация** — учёт типа личности (MBTI), истории диалогов, индивидуальных потребностей
- [ ] **Голосовой ввод** — поддержка голосовых сообщений в Telegram-боте
- [ ] **Расширение базы знаний** — добавление материалов по процессуальной психологии Минделла, интегральной теории Уилбера
- [ ] **Веб-приложение** — полноценный веб-интерфейс с историей диалогов и статистикой
- [ ] **Партнёрские интеграции** — интеграция с сервисами психологической помощи и медитации

---

## Скиллы (внутри проекта)

Все скиллы находятся в **`.agents/skills/`** внутри проекта — никаких внешних зависимостей.

### 🧠 LLM Wiki — Управление базой знаний

**Путь:** `.agents/skills/llm-wiki/SKILL.md`

Два режима работы:

**1. Raw-only (сохранить источник)**
- Триггеры: «сохрани туда», «закинь ссылку», «скачай в базу»
- Процесс: извлечение через `summarize "URL" --extract --format md` → сохранение в `raw/YYYY/MMDD/`
- ⚠️ Не создаёт wiki-страницы, только raw-источник

**2. Full Ingest (обработать + вики)**
- Триггеры: «ingest», «добавь в базу», «обработай»
- Процесс:
  1. Извлечение контента в `raw/YYYY/MMDD/`
  2. Синтез key takeaways (3-5 главных тезисов)
  3. Создание/обновление страниц в `src/content/docs/<category>/`
  4. Обновление `index.md` и `log.md`
  5. Перекрёстные ссылки

**⚠️ Full Ingest запускает только пользователь.** Без явной команды — только raw.

---

### 📋 Wiki FAQ

**Путь:** `.agents/skills/wiki-faq/SKILL.md`

Создание коротких FAQ-страниц — прямые ответы на вопросы со ссылками на вики.

**Процесс:**
1. Ответ кратко: 3-5 предложений основной мысли
2. Добавить шаги (если how-to вопрос)
3. Добавить таблицу сравнения (если сравнительный вопрос)
4. Ссылки на wiki: 2-5 релевантных страниц
5. Создание страницы в `faq/` с frontmatter

**Формат:**
```markdown
---
title: "Вопрос?"
description: "Короткий ответ в одно предложение."
---

## Краткий ответ

2-4 предложения сути.

## Как сделать (если how-to)

1. Шаг 1
2. Шаг 2
```

---

### 🖼️ Wiki Images

**Путь:** `.agents/skills/wiki-images/SKILL.md`

Скачивание изображений с веб-страниц и вставка их в статьи базы знаний.

**Процесс:**
1. Открыть страницу-источник
2. Найти информативные изображения (скриншоты, схемы, диаграммы)
3. Скачать: `curl -sLo "src/content/images/name.png" "URL"`
4. Вставить в статью: `![alt](../../images/name.png)`

---

### 📥 Summarize CLI

**Путь:** `.agents/skills/summarize/SKILL.md`

Инструмент для извлечения веб-контента в Markdown. **Основной** для получения контента с URL.

**⚠️ Fetch Rule:**
- **Всегда:** `summarize "URL" --extract --format md`
- **Никогда:** `web_fetch`, `browser` для первичного извлечения

**Установка:**
```bash
brew install summarize
npm install -g @steipete/summarize
```

**Настройка браузера:**
1. Установить расширение Summarize из Chrome Web Store
2. Скопировать токен из Side Panel
3. Подключить: `summarize daemon install --token ТОКЕН`

---

### ⚖️ Legal Response

**Путь:** `.agents/skills/legal-response/SKILL.md`

Генерация ответов на юридические запросы по шаблонам.

**Типы запросов:**
- `dsr` — Data Subject Request (доступ/удаление данных)
- `hold` — Litigation Hold Notice
- `vendor` — Vendor Legal Questions
- `nda` — NDA Requests
- `privacy` — Privacy Inquiries
- `subpoena` — Subpoena / Legal Process

**⚠️ Escalation Triggers:** потенциальный иск, запрос от регулятора, уголовное дело, медийное внимание — требуют проверки юристом.

---

### 🔧 Другие скиллы

| Скилл | Назначение |
|-------|-----------|
| `wiki-init` | Bootstrap структуры вики |
| `wiki-ingest` | Добавление источников с синтезом |
| `wiki-query` | Ответы из wiki-страниц с цитатами |
| `wiki-lint` | Аудит: битые ссылки, orphan pages |
| `wiki-update` | Ревизия страниц |

---

## 🌟 Astro JS — Конструктор сайта

Проект использует **Astro + Starlight** для генерации статического сайта документации.

### Архитектура

```
pl-chat/
├── raw/                       # Immutable источники
├── src/content/docs/          # Wiki-страницы (Markdown)
│   ├── index.md               # Каталог
│   └── log.md                 # Журнал
├── astro.config.mjs           # Starlight config
└── package.json
```

### Ключевые Astro API

**Content Collections:**
```typescript
import { getCollection, getEntry } from 'astro:content';

const posts = await getCollection('docs');
const post = await getEntry('docs', 'page-slug');
```

**Client Directives:**
```astro
<Component client:load />      <!-- Немедленная загрузка -->
<Component client:idle />      <!-- Когда браузер свободен -->
<Component client:visible />   <!-- Когда элемент виден -->
```

**Dynamic Routes:**
```typescript
export async function getStaticPaths() {
  const entries = await getCollection('docs');
  return entries.map(entry => ({
    params: { slug: entry.slug },
    props: { entry }
  }));
}
```

---

## 🔗 Ссылки

- **Astro Docs:** [docs.astro.build](https://docs.astro.build)
- **Starlight:** [starlight.astro.build](https://starlight.astro.build)
- **Summarize CLI:** [summarize.sh](https://summarize.sh)
- **CNVC (ННО):** [cnvc.org](https://www.cnvc.org/)
- **Jungian Psychology:** [jungiananalysis.org](https://www.jungiananalysis.org/)

---

## 📝 Правила и конвенции

- **Язык:** Все wiki-страницы на русском (ru-RU)
- **Тон:** Эмпатичный, точный, без воды
- **Raw-источники:** Immutable (только чтение)
- **Ссылки с `.md`:** Относительные ссылки в wiki всегда с `.md` (напр. `[text](./page.md)`)
- **Frontmatter:** Каждая страница имеет `title` и `description`
- **Без дублирования H1:** Frontmatter `title` рендерится как H1 автоматически
- **Материалы и источники:** Каждая страница заканчивается ссылками на оригиналы
