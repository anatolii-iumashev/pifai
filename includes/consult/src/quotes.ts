import { tokens } from './rag/index.js';
import type { PackQuote, WikiPack } from './wiki.js';

export interface ParsedQuote { text: string; author: string }

export const quotesHeading = '## Мысли великих';

const QUOTES_HEADING_RE = /^#{1,3}\s*Мысли великих\s*$/im;

/**
 * The model may end its answer with a quote section (see the support skill):
 * `## Мысли великих` followed by blockquotes in the form `> «текст»` / `> — **Автор**`.
 * The section is split off so the application can validate the quotes against the
 * wiki pack, re-render them canonically and top them up when too few remain.
 */
export function splitQuotes(text: string): { answer: string; quotes: ParsedQuote[] } {
  const match = text.match(QUOTES_HEADING_RE);
  if (!match || match.index === undefined) return { answer: text.trim(), quotes: [] };
  const answer = text.slice(0, match.index).trim();
  return { answer, quotes: parseQuoteGroups(text.slice(match.index + match[0].length)) };
}

function parseQuoteGroups(section: string): ParsedQuote[] {
  const groups: string[] = [];
  let lines: string[] = [];
  for (const raw of section.split('\n')) {
    if (/^\s*>/.test(raw)) lines.push(raw.replace(/^\s*>\s?/, ''));
    else if (lines.length) { groups.push(lines.join(' ')); lines = []; }
  }
  if (lines.length) groups.push(lines.join(' '));
  const quotes: ParsedQuote[] = [];
  for (const group of groups) {
    const text = group.match(/«([^»]+)»/)?.[1]?.trim();
    if (!text) continue;
    // The author stands after the quote, so search outside the «» span only.
    const after = group.replace(/«[^»]*»/, ' ');
    const author = (/—\s*([^—]*)$/.exec(after)?.[1] ?? '').replace(/\*/g, '').trim();
    quotes.push({ text, author });
  }
  return quotes;
}

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/[«»"'`„“”]/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** The model's quote counts as valid when its text (and author) matches a pack quote. */
function matchesPackQuote(candidate: ParsedQuote, quote: PackQuote): boolean {
  const packText = normalizeText(quote.text);
  const modelText = normalizeText(candidate.text);
  if (packText.length < 20 || modelText.length < 20) return false;
  if (!packText.includes(modelText) && !modelText.includes(packText)) return false;
  const modelAuthor = normalizeText(candidate.author);
  const packAuthor = normalizeText(quote.author);
  // An omitted author may be repaired; a stated author must agree with the pack.
  if (!modelAuthor || !packAuthor) return Boolean(packAuthor);
  const authorTerms = tokens(`${modelAuthor} ${packAuthor}`);
  return authorTerms.length >= 2 && new Set(authorTerms).size < authorTerms.length;
}

function packQuoteOf(pack: WikiPack, candidate: ParsedQuote): PackQuote | undefined {
  return (pack.quotes ?? []).find((quote) => matchesPackQuote(candidate, quote));
}

/** Quotes the retrieval finds for the conversation, ranked by stem overlap with the query. */
export function retrieveQuotes(pack: WikiPack, context: string, taken: Set<string>, limit: number): PackQuote[] {
  const queryTerms = new Set(tokens(context));
  if (!queryTerms.size) return [];
  const bag = (quote: PackQuote) => new Set(tokens([quote.text, quote.context, quote.reflection, quote.topics.map((topic) => topic.replaceAll('-', ' '))].join(' ')));
  return (pack.quotes ?? [])
    .filter((quote) => !taken.has(quote.text))
    .map((quote) => {
      const haystack = bag(quote);
      return { quote, score: [...queryTerms].filter((term) => haystack.has(term)).length };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.quote.text.localeCompare(b.quote.text, 'ru'))
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.quote);
}

/**
 * Splits the model's own quote section off the answer, keeps only quotes provable
 * against the pack and tops the section up from retrieval so it carries 2–4 quotes
 * ("Мысли великих на эту тему"). Returns the cleaned answer and the canonical section.
 */
export function composeQuotes(pack: WikiPack, modelText: string, context: string): { answer: string; quotes: string | null } {
  const { answer, quotes: modelQuotes } = splitQuotes(modelText);
  const chosen: PackQuote[] = [];
  const seen = new Set<string>();
  for (const candidate of modelQuotes) {
    const quote = packQuoteOf(pack, candidate);
    if (quote && !seen.has(quote.text)) { chosen.push(quote); seen.add(quote.text); }
  }
  const MIN_QUOTES = 2;
  const MAX_QUOTES = 4;
  if (chosen.length < MIN_QUOTES) {
    chosen.push(...retrieveQuotes(pack, context, seen, MAX_QUOTES - chosen.length));
  }
  if (!chosen.length) return { answer, quotes: null };
  const block = [quotesHeading, ...chosen
    .slice(0, MAX_QUOTES)
    .map((quote) => [`> «${quote.text}»`, `> — **${quote.author}**`].join('\n'))]
    .join('\n\n');
  return { answer, quotes: block };
}
