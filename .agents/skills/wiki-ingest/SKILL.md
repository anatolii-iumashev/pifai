---
name: wiki-ingest
description: Use when adding a new source (file or URL) into the WP Knowledge wiki with synthesis, cross-linking, index updates, and log bookkeeping.
---

# Wiki Ingest

Compile a new source into the persistent wiki. **База знаний сфокусирована на WordPress open-source.** Источники с WordPress.com требуют адаптации.

## WordPress.com → Open-Source Adaptation

При ingest источников с wordpress.com/support:

- **Адаптировать:** планы/цены → self-hosted стоимость; managed хостинг → самостоятельное управление; .com-фичи → opensource-аналоги
- **Пометить .com-only:** AI Website Builder, Express Design Service, onboarding sessions — явно указать «⚠️ Только WordPress.com»
- **Сохранять:** концепции WordPress, плагины/темы из .org, технические руководства, WooCommerce
- **Уточнять через web_search:** если не уверен в opensource-эквиваленте

## Pre-condition

0. **⚠️ Всегда `summarize` для URL:** `summarize "URL" --extract --format md`. Не используй `web_fetch` или `browser`.
1. Read `src/content/docs/index.md` first.
2. Read related existing pages before writing.
3. Confirm source location:
   - **Local:** `raw/YYYY/MMDD/filename.{md,pdf}` — date-organized, immutable
   - **URL:** fetch with `summarize "URL" --extract --format md` (primary), fallback to `web_fetch` or `skills/jina-ai/extract.mjs`
4. If source is a URL, extract and save it to `raw/YYYY/MMDD/` (using current date), then ingest from that local copy.

## Process

1. Read the source fully.
2. **Adapt .com → open-source** — если источник с WordPress.com, адаптируй контент (см. секцию выше). Используй web_search для уточнения opensource-эквивалентов.
3. Present key takeaways to user before writing:
- 3-5 main points.
- What to emphasize/de-emphasize.
- Potential contradictions with existing pages.
3. Create or update relevant pages in the correct category folder.
4. Add or update cross-references in both directions.
5. Update `src/content/docs/index.md` entries.
6. Append `src/content/docs/log.md`:
   - `## [YYYY-MM-DD] ingest | <source title>`
7. Report all touched files.

## Placement Heuristic

- Core concepts -> `how-to/`
- FAQ/comparisons -> `faq/`
- Plugin-specific -> `plugins/`
- Theme-specific -> `themes/`
- Security -> `security/`
- Performance -> `performance/`
- Reusable recipes -> `snippets/`

If none fit, propose a new category before creating it.

## Quality Bar

- Wiki content in ru-RU.
- No copy-paste dumps from source; synthesize.
- Every new page has frontmatter (`title`, `description`).
- Do NOT start pages with an `# H1` heading; Starlight renders frontmatter `title` as H1. Start content from `##`.
- **«Материалы и источники» обязательны:** каждая страница заканчивается ссылкой на оригинальный URL. Внешние ссылки автоматически получают `target="_blank"` при сборке — в исходниках пиши обычный markdown: `[текст](https://...)`.
- **Ссылки всегда с `.md`:** все относительные ссылки на wiki-страницы пиши с расширением `.md` (напр. `[text](./page.md)`). Для index-файлов: `./category/index.md`. НИКОГДА не пиши без `.md` или с `/` в конце. Плагин `remarkStripMdLinks` сам уберёт расширения при сборке.
- Backlink pass is mandatory.

## Done Criteria

- Pages created/updated.
- Cross-links reconciled.
- `index.md` updated.
- `log.md` appended.
