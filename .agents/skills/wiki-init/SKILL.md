---
name: wiki-init
description: Use when bootstrapping or repairing the WP Knowledge wiki structure, schema rules, index, and log so all other wiki operations can run consistently.
---

# Wiki Init

Initialize or normalize the LLM Wiki structure for this repository.

## Repository Target

Expected wiki root:
- `src/content/docs/`

Expected core files:
- `src/content/docs/index.md`
- `src/content/docs/log.md`
- `AGENTS.md`

Expected raw structure:
- `raw/YYYY/MMDD/` — date-organized immutable sources

Expected category folders:
- `core/`, `plugins/`, `themes/`, `security/`, `performance/`, `snippets/`, `queries/`

## Pre-flight

1. Check if the structure already exists.
2. If it exists, run in repair mode (fix missing files/sections, do not overwrite useful content).
3. If anything would be destructive, ask before changing.

## Process

1. Validate folder tree and required files.
2. Ensure `index.md` has category-level catalog entries format:
   - `- [Page Title](relative/path.md) - One-line summary`
3. Ensure `log.md` has append-only convention:
   - `## [YYYY-MM-DD] <operation> | <title>`
4. Ensure wiki writing conventions are explicit and enforced from `AGENTS.md`:
- Content language: ru-RU.
- All wiki pages except `index.md` and `log.md` include frontmatter with `title` and `description`.
- Do NOT duplicate frontmatter `title` with an `# H1` heading — Starlight renders the title as H1. Start content from `##`.
- **Ссылки всегда с `.md`:** все относительные ссылки на wiki-страницы пишутся с расширением `.md` (напр. `[text](./page.md)`, `./category/index.md`). НИКОГДА без `.md` или с `/` в конце. Плагин `remarkStripMdLinks` сам уберёт расширения при сборке.
- Relative markdown links only.
5. Report what was created or repaired.

## Guardrails

- Never modify `raw/` sources during init.
- Preserve existing useful content whenever possible.
- Prefer minimal edits over full rewrites.

## Done Criteria

- Structure is valid.
- `index.md` and `log.md` are present and usable.
- Conventions are explicit for downstream skills.
