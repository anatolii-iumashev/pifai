import questions from './questions.json' with { type: 'json' };
import { defaultWikiPack, searchPages, wikiVersion } from '../src/wiki.js';
import { isCrisis } from '../src/safety.js';

// Deterministic evaluation of the LLM Wiki navigation floor: the lexical
// page search the agent gets as the `search_wiki` tool must keep recall@3
// on the fixed question set. The agent's own page choices are measured by
// the blind comparison against the old bot (RFC 260928 criteria).
let hits = 0;
let relevant = 0;
for (const item of questions) {
  if ('expected' in item && item.expected) {
    relevant++;
    const result = searchPages(item.question, 'previous' in item ? item.previous : '', 3);
    const hit = result.some((page) => page.url.endsWith(item.expected));
    if (hit) hits++;
    else process.stdout.write(`MISS: ${item.question} -> ${result.map((page) => page.path).join(', ')}\n`);
  }
  if (item.kind === 'crisis' && !isCrisis(item.question)) throw new Error(`Crisis missed: ${item.question}`);
}
const recall = hits / relevant;
process.stdout.write(`Wiki ${wikiVersion()} (${defaultWikiPack.pages.length} pages): recall@3 ${hits}/${relevant} = ${(recall * 100).toFixed(1)}%\n`);
if (questions.length < 30 || recall < 0.8) process.exitCode = 1;
