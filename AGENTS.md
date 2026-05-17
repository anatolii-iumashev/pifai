# AGENTS.md — pl-chat Knowledge Base

LLM Wiki schema для базы знаний чат-бота Психолог (ННО Маршала Розенберга + Карл Юнг).

Key RFC ([docs/rfc/260517-kb-pl-chat.md](./docs/rfc/260517-kb-pl-chat.md))

> **⚠️ FETCH RULE:** Для получения ЛЮБОГО контента с URL всегда используй `summarize "URL" --extract --format md`. Не используй `web_fetch`, `browser`, или другие инструменты для первичного извлечения — только `summarize`. Fallback: `web_fetch` допустим только если `summarize` упал с ошибкой.

## Wiki Structure

```
pl-chat/
├── raw/                       # Immutable source documents — READ ONLY
│   └── YYYY/                  # Year (e.g. 2026)
│       └── MMDD/              # Month + Day (e.g. 0501 = May 1)
│           └── file.{md,pdf}  # Source files
├── src/content/docs/          # ★ WIKI PAGES — you write and maintain these
│   ├── basics/                # 1. База и вводные — с чего начать
│   ├── use-cases/             # 2. Проблематика и Use cases
│   ├── practices/             # 3. Практики и техники
│   ├── quotes/                # 4. Цитаты великих людей
│   ├── authors/               # 5. Авторы и школы
│   │   ├── nvc/               #   ННО / Nonviolent Communication (Розенберг)
│   │   ├── jung/              #   Юнгианская психология (Карл Юнг)
│   │   ├── frankl/            #   Логотерапия (Виктор Франкл)
│   │   ├── wilber/            #   Интегральная теория (Кен Уилбер)
│   │   ├── mindell/           #   Процессуальная психология (Арнольд Минделл)
│   │   ├── adizes/            #   Методология Адизеса (PAEI)
│   │   └── litvak/            #   Психологическое айкидо (Михаил Литвак)
│   ├── typology/              # 6. Классификация и типология
│   │   └── mbti/              #   MBTI — 8 когнитивных функций, 16 типов
│   ├── addons/                # 7. Дополнения
│   │   ├── integral/          #   Интеграция всех подходов
│   │   ├── faq/               #   FAQ и сравнения
│   │   └── queries/           #   Filed answers from user queries
│   ├── index.md               # Catalog of all pages (update on every ingest)
│   └── log.md                 # Chronological operations log (append on every operation)
├── AGENTS.md                  # This file — wiki schema
└── package.json
```

## Page Format

Every wiki page (except index.md and log.md) starts with Starlight-compatible frontmatter:

```yaml
---
title: "Page Title"
description: "One-line summary of this page"
---
```

**Important:** Do NOT start pages with an `# H1` heading that duplicates the frontmatter `title`. Starlight already renders the `title` as the page's H1. Start content directly with `##` level headings.

### Источники (Source Attribution)

Каждая wiki-страница должна заканчиваться секцией **«Материалы и источники»**:

```md
## Материалы и источники

- [Оригинальная статья](https://...)
- [Связанная страница](./related/page.md)
```

- Ссылка на оригинальный URL (из frontmatter `source` raw-файла)
- Если страница собрана из нескольких источников — перечислить все
- Внутренние ссылки на wiki-страницы

### Code Blocks

Use fenced code blocks with language when needed (JSON configs, code examples):

```json
{
  "technique": "reflective-listening",
  "steps": ["listen", "reflect", "validate"]
}
```

## Operations

### Source Extraction

When fetching a URL for ingest, use tools in priority order:

1. **Primary:** `summarize "URL" --extract --format md` — best image/media preservation
2. **Fallback:** `web_fetch` with `extractMode: "markdown"`
3. **Last resort:** `skills/jina-ai/extract.mjs <URL>` — for Cloudflare-protected sites

Save extracted content to `raw/YYYY/MMDD/` before ingesting.

### Ingest

When asked to ingest a source:

0. **Fetch the source** — use extraction tools above if URL, save to `raw/YYYY/MMDD/`
1. **Read the source** from `raw/YYYY/MMDD/` or provided URL
2. **Read `src/content/docs/index.md`** to understand current wiki structure
3. **Discuss key takeaways** with the user before writing:
   - 3-5 main points
   - What to emphasize/de-emphasize
   - Potential contradictions with existing pages
4. **Create/update pages** in the appropriate `src/content/docs/` subdirectory:
   - Базовая теория, вводные → `basics/`
   - Проблемы, запросы, use cases → `use-cases/`
   - Техники и упражнения → `practices/`
   - Вдохновляющие цитаты → `quotes/`
   - ННО / NVC concepts → `authors/nvc/`
   - Юнгианская психология → `authors/jung/`
   - Логотерапия Франкла → `authors/frankl/`
   - Интегральная теория Уилбера → `authors/wilber/`
   - Процессуальная психология Минделла → `authors/mindell/`
   - Методология Адизеса → `authors/adizes/`
   - Психологическое айкидо Литвака → `authors/litvak/`
   - MBTI / Типология → `typology/` / `typology/mbti/`
   - Интеграция подходов → `addons/integral/`
   - FAQ/comparisons → `addons/faq/`
   - Сохранённые ответы → `addons/queries/`
   - If a new category is needed → propose it to the user
   - **Every page must include «Материалы и источники»** at the bottom
5. **Update `src/content/docs/index.md`** — add entry with relative link + one-line summary
6. **Append to `src/content/docs/log.md`**: `## [YYYY-MM-DD] ingest | Title`
7. **Add cross-references** in related existing pages (links back to the new page)
8. **Report**: list all files created/modified

A single source typically touches 5-15 wiki pages. Don't be lazy — update everything relevant.

### Query

When asked a question against the wiki:

1. **Read `src/content/docs/index.md`** to find relevant pages
2. **Read the relevant pages** — don't guess, actually read them
3. **Synthesize a complete answer** with citations to specific pages
4. **Ask the user** if the answer should be filed back into the wiki
5. If yes → create a new page in `queries/`, update `index.md`, append to `log.md`

### Lint

When asked to lint the wiki:

1. **Scan all pages** in `src/content/docs/` (excluding `index.md` and `log.md`)
2. **Check for**:
   - Contradictions between pages
   - Broken relative links (links to non-existent pages)
   - Orphan pages with no inbound links from other pages
   - Missing cross-references (pages that should link to each other but don't)
   - Outdated information
   - Pages missing `description` in frontmatter
   - Important concepts mentioned but lacking their own page
3. **Report findings** with specific file paths and suggested fixes
4. **Append to `log.md`**: `## [YYYY-MM-DD] lint | N issues found`

### Update

When asked to update existing wiki content:

1. **Identify affected pages** from new information or lint findings
2. **Propose changes with source attribution** before writing (what changes and why)
3. **Apply updates** to target pages and related linked pages if consistency requires it
4. **Update `src/content/docs/index.md`** if page summary meaning changed
5. **Append to `src/content/docs/log.md`**: `## [YYYY-MM-DD] update | Topic`

## Skills (Project)

These skills are available in this repository under `.agents/skills/`:

- `llm-wiki` — umbrella/orchestrator for full LLM Wiki workflow in this repo
- `summarize` — install and use the `summarize` CLI for web content extraction to Markdown
- `wiki-init` — bootstrap/repair wiki structure and conventions
- `wiki-ingest` — ingest source into pages + cross-links + index/log updates
- `wiki-query` — answer strictly from wiki pages, optionally file to `queries/`
- `wiki-lint` — run health audit (contradictions, links, orphans, stale sections)
- `wiki-update` — revise existing pages with source-backed updates and consistency sweep
- `wiki-faq` — создание FAQ-страниц (короткие ответы на вопросы)
- `wiki-images` — скачивание изображений с URL и вставка в статьи
- `legal-response` — генерация ответов на юридические запросы по шаблонам

### Skill Routing

Use this mapping for task routing:

- "install/setup/use summarize tool" → `summarize`
- "initialize/fix wiki structure" → `wiki-init`
- "ingest article/source" → `wiki-ingest`
- "answer from wiki" → `wiki-query`
- "lint wiki" → `wiki-lint`
- "apply new facts/fix outdated pages" → `wiki-update`
- "create FAQ page" → `wiki-faq`
- "download images from URL" → `wiki-images`
- "run end-to-end wiki maintenance" → `llm-wiki` (then route internally)

### Shared Skill Invariants

All wiki skills must enforce:

1. Read `src/content/docs/index.md` before query/update work
2. Never modify `raw/` documents
3. Keep `index.md` and `log.md` synchronized with operations
4. Maintain bidirectional cross-references where relevant
5. Keep wiki content in ru-RU and include required frontmatter (`title`, `description`)

## General Rules

- **Ссылки в исходниках — всегда с `.md`:** все относительные ссылки на wiki-страницы (`[text](./path/page.md)`) пишутся с расширением `.md`. Для index-файлов каталогов — `./category/index.md`. Это нужно для работы ссылок в VS Code и GitHub. НИКОГДА не пиши ссылки без `.md`, НИКОГДА не пиши ссылки с `/` в конце вместо `.md`.
- **Focus:** База знаний про **ННО (Маршал Розенберг), Юнгианскую психологию, MBTI, логотерапию (Франкл), интегральную теорию (Уилбер), процессуальную психологию (Минделл), методологию Адизеса, психологическое айкидо (Литвак), практические техники**.
- **Language**: All wiki content in Russian (ru-RU)
- **Tone**: Эмпатичный, точный, без воды, с уважением к теме
- **Sources**: When ingesting, preserve links to original sources
- **index.md format**: `- [Page Title](relative/path.md) — One-line summary`
- **log.md format**: `## [YYYY-MM-DD] operation | Title` followed by brief notes
- **README.md sync**: При ЛЮБОМ изменении `src/content/docs/index.md` (добавление/удаление/переименование страниц) — синхронизируй оглавление в `README.md` в секцию `## Оглавление`. Ссылки в README должны быть с префиксом `src/content/docs/` (от корня репо), чтобы работали в VS Code и GitHub.

## When New Categories Emerge

If content doesn't fit existing directories, propose a new one to the user before creating it. Example categories that might emerge: `emotions/`, `needs/`, `archetypes/`, `dreams/`, `communication/`, `somatics/`, `leadership/`.
