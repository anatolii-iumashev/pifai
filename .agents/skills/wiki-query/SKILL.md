---
name: wiki-query
description: Use when answering user questions strictly from wiki pages, with citations and optional filing of the answer into queries/ plus index/log updates.
---

# Wiki Query

Answer from the wiki, not from model memory.

## Pre-condition

1. Read `src/content/docs/index.md`.
2. Read relevant pages in full.
3. Follow one level of related links when needed.

## Process

1. Synthesize answer grounded in read pages.
2. Cite concrete wiki pages in the response.
3. Explicitly note disagreements/contradictions and coverage gaps.
4. Ask whether to file the answer as a new page in `src/content/docs/queries/`.
5. If user agrees:
- Create query page with frontmatter (`title`, `description`). Do NOT add an `# H1` heading — Starlight renders the `title` as H1. Start content from `##`.
- Add entry to `src/content/docs/index.md`.
- Append `src/content/docs/log.md`:
  - `## [YYYY-MM-DD] query | <question summary>`

## Output Shaping

- Factual question -> concise cited explanation.
- Comparison question -> table-style comparison with citations.
- How-it-works question -> ordered steps with citations.

## Quality Bar

- Never answer from unstated prior knowledge when wiki evidence is required.
- Make missing knowledge explicit and propose next ingest candidates.

## Done Criteria

- User receives cited answer.
- If filed: query page exists and index/log are updated.
