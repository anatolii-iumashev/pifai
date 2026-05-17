---
name: llm-wiki
description: Use as an umbrella orchestrator for LLM Wiki work in this repository. Route tasks to wiki-init, wiki-ingest, wiki-query, wiki-lint, or wiki-update while enforcing shared wiki rules.
---

# LLM Wiki Skill

Top-level orchestrator for the WP Knowledge LLM Wiki workflow.

## Source Basis

This setup follows:
- Internal LLM Wiki pattern: persistent, compounding wiki between sources and chat
- wiki-skills flow: `init -> ingest -> query -> lint -> update`

## Repository Scope

Wiki root in this repo:
- Sources: `raw/YYYY/MMDD/file.{md,pdf}` (immutable, date-organized)
- Pages: `src/content/docs/`
- Catalog: `src/content/docs/index.md`
- Log: `src/content/docs/log.md`

### Raw Structure

Sources are organized by ingestion date:

```
raw/
  2026/
    0501/          # May 1, 2026
      article.md
    0427/          # April 27, 2026
      source.pdf
```

- Top level: `YYYY` (year)
- Second level: `MMDD` (month + day, zero-padded)
- Files: original filenames preserved
- Never modify files under `raw/`
- When fetching URLs for ingest, use `summarize "URL" --extract --format md` as the primary extraction tool (better image/media preservation than web_fetch)

## Routing Rules

Use this mapping:
- Structure bootstrap or repair -> `wiki-init`
- Add source content -> `wiki-ingest`
- Answer from wiki pages -> `wiki-query`
- Health audit -> `wiki-lint`
- Revise existing content -> `wiki-update`

If a request spans multiple operations, run them in this order:
1. `wiki-ingest` or `wiki-update`
2. `wiki-lint`
3. optional `wiki-query` filing for newly derived analysis

## Shared Invariants

These rules apply to all wiki-* skills:

0. **Fetch rule — ALWAYS use `summarize`:**
- For any URL content extraction, use `summarize "URL" --extract --format md`.
- Never use `web_fetch`, `browser`, or other tools for primary extraction.
- `web_fetch` is only a fallback if `summarize` fails with an error.

1. Read-first:
- Read `src/content/docs/index.md` before query/update work.

2. Raw is immutable:
- Never modify files under `raw/`.

3. Bookkeeping is mandatory:
- Keep `index.md` and `log.md` updated on ingest, update, lint, and filed query operations.

4. Cross-links are first-class:
- Maintain bidirectional links where pages are semantically related.

5. Content conventions:
- Wiki content language is ru-RU.
- **Focus is WordPress open-source** (WordPress.org / self-hosted). Sources from WordPress.com must be adapted: .com-specific features → open-source equivalents, .com-only features marked explicitly.
- Every wiki page except `index.md` and `log.md` includes frontmatter with `title` and `description`.
- Do NOT duplicate frontmatter `title` with an `# H1` heading — Starlight renders the title as H1. Start content from `##`.
- **«Материалы и источники»:** every page ends with links to original URL(s). External links automatically get `target="_blank"` at build time — write plain markdown in source: `[text](https://...)`.
- **Ссылки всегда с `.md`:** все относительные ссылки на wiki-страницы пишутся с расширением `.md` (напр. `[text](./page.md)`, `[dir](./category/index.md)`). НИКОГДА без `.md` или с `/` в конце. Плагин `remarkStripMdLinks` сам уберёт расширения при сборке.

## Specialized Skills

- `../wiki-init/SKILL.md`
- `../wiki-ingest/SKILL.md`
- `../wiki-query/SKILL.md`
- `../wiki-lint/SKILL.md`
- `../wiki-update/SKILL.md`

## Trigger Phrases

Activate this umbrella skill on requests like:
- "собери/поддерживай llm wiki"
- "прогони полный цикл ingest-query-lint-update"
- "веди wiki по правилам и синхронизируй index/log"

## Done Definition

A task is complete only when:
- Appropriate specialized wiki-* skill has been used.
- Resulting pages are created/updated as needed.
- `src/content/docs/index.md` and `src/content/docs/log.md` are consistent.
- Cross-references are reconciled.
- User receives a concrete touched-files report.
