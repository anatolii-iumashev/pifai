---
name: wiki-lint
description: Use when auditing wiki health for contradictions, broken links, orphan pages, stale content, and missing cross-references, then log findings.
---

# Wiki Lint

Run a health audit over wiki pages.

## Scope

Scan under `src/content/docs/`, excluding:
- `src/content/docs/index.md`
- `src/content/docs/log.md`

## Checks

В дополнение к Markdown-страницам проверь коллекцию цитат в `src/content/quotes/*.yaml` и `src/lib/quote-topics.ts`:
- одинаковые `name` или `fullName` в разных YAML-файлах;
- повторяющийся текст цитаты внутри файла и между авторами;
- каждый topic входит в `QUOTE_TOPICS` и имеет страницу `src/content/docs/quotes/<topic>.mdx`;
- каждый slug из `QUOTE_TOPICS` имеет такую страницу.
Схему Astro проверяй командой `npm run check`.

Priority order:
1. Errors:
- Broken relative links.
- Missing required frontmatter fields (`title`, `description`).
- Duplicate `# H1` heading that repeats frontmatter `title` (Starlight already renders the title as H1).

2. Warnings:
- Orphan pages (no inbound links).
- Contradictory statements between pages.
- Clearly stale claims.

3. Info:
- Missing cross-references between related pages.
- Concepts repeatedly mentioned but lacking a dedicated page.

## Process

1. Build page/link inventory.
2. Produce severity-grouped report with concrete file paths.
3. Suggest precise fixes for each issue.
4. Append `src/content/docs/log.md`:
   - `## [YYYY-MM-DD] lint | <N issues found>`

## Quality Bar

- Findings first, summary second.
- Prefer actionable fixes over generic advice.

## Done Criteria

- Severity-ordered findings are reported.
- `log.md` has lint entry.
