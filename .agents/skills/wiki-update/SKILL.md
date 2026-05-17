---
name: wiki-update
description: Use when revising existing wiki pages due to new information, contradictions, or user-requested corrections, with source attribution and downstream consistency checks.
---

# Wiki Update

Revise existing pages while preserving auditability.

## Pre-condition

1. Read `src/content/docs/index.md`.
2. Identify all impacted pages (direct and linked).
3. Require source context for factual changes.

## Process

For each page:
1. Read current content fully.
2. Propose update before writing:
- Current
- Proposed
- Reason
- Source
3. Confirm before applying substantial edits.
4. Check downstream pages that reference changed content.
5. Update one-line summaries in `index.md` if meaning changed.
6. Append `src/content/docs/log.md`:
   - `## [YYYY-MM-DD] update | <topic or pages>`

## Consistency Sweep

- Search for duplicated stale claims across related pages.
- Fix contradictions in all affected pages, not just one.
- Ensure cross-links still reflect updated relationships.

## Quality Bar

- No unsourced factual edits.
- No silent broad rewrites.
- Keep edits minimal and explicit.
- Do NOT add an `# H1` heading that duplicates frontmatter `title` — Starlight renders the title as H1.
- **Ссылки всегда с `.md`:** все относительные ссылки пиши с расширением `.md` (напр. `[text](./page.md)`, `./category/index.md`). НИКОГДА без `.md` или с `/` в конце. Плагин `remarkStripMdLinks` сам уберёт расширения при сборке.

## Done Criteria

- Target pages updated with rationale.
- Downstream consistency checked.
- Index/log updated.
