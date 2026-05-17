# pl-chat

Чат-бот Психолог — на основе идей ННО Маршала Розенберга и идей Карла Юнга.

GitHub: https://github.com/anatolii-iumashev/pl-chat

---

## 📚 База знаний

Проект использует LLM Wiki архитектуру для накопления и структурирования знаний.

### Структура

```
pl-chat/
├── raw/                       # Immutable источники
│   └── YYYY/MMDD/             # Дата-организованные файлы
├── src/content/docs/          # Wiki-страницы
│   ├── nvc/                   # Ненасильственное общение
│   ├── jung/                  # Юнгианская психология
│   ├── psychology/            # Общая психология
│   ├── techniques/            # Техники и упражнения
│   ├── faq/                   # FAQ
│   ├── queries/               # Сохранённые ответы
│   ├── index.md               # Каталог
│   └── log.md                 # Журнал операций
├── .agents/skills/            # Скиллы для работы с вики (в проекте!)
├── AGENTS.md                  # Wiki schema
└── README.md
```

### Оглавление

- **[ННО (Ненасильственное общение)](src/content/docs/nvc/index.md)** — 4 компонента ННО, принципы, применение
- **[Юнгианская психология](src/content/docs/jung/index.md)** — архетипы, коллективное бессознательное, индивидуация

---

## 🛠️ Скиллы (внутри проекта)

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
