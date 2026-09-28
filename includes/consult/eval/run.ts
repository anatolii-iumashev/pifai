import questions from './questions.json' with { type: 'json' };
import { search, knowledgeVersion } from '../src/retriever.js';
import { isCrisis } from '../src/safety.js';

let hits = 0;
let relevant = 0;
for (const item of questions) {
  if ('expected' in item && item.expected) {
    relevant++;
    const result = search(item.question, 'previous' in item ? item.previous : '', 3);
    const hit = result.some((chunk) => chunk.url.endsWith(item.expected));
    if (hit) hits++;
    else process.stdout.write(`MISS: ${item.question} -> ${result.map((chunk) => chunk.url).join(', ')}\n`);
  }
  if (item.kind === 'crisis' && !isCrisis(item.question)) throw new Error(`Crisis missed: ${item.question}`);
}
const recall = hits / relevant;
process.stdout.write(`Knowledge ${knowledgeVersion}: recall@3 ${hits}/${relevant} = ${(recall * 100).toFixed(1)}%\n`);
if (questions.length < 30 || recall < 0.8) process.exitCode = 1;
