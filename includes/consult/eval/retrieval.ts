import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadRagIndex, searchRag, type RagIndex } from '../src/rag/index.js';
import { createRetriever } from '../../bot/src/retriever.js';
import { KNOWLEDGE_CHUNKS } from '../../bot/src/knowledge.js';
import { embedQuery } from '../src/rag/runtime.js';
import thresholds from './thresholds.json' with { type: 'json' };

interface Question { query: string; previous?: string; expectedPageId: string | null; kind?: string }
const questions = readFileSync(resolve(import.meta.dirname, 'retrieval.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Question);
if (questions.length < 30) throw new Error('Retrieval evaluation requires at least 30 questions');
const source = process.env.RAG_INDEX_SOURCE ?? resolve(import.meta.dirname, '../../../dist/rag');
const index = await loadRagIndex(source);
const old = createRetriever(KNOWLEDGE_CHUNKS);
const modes = ['legacy', 'bm25', 'hybrid'] as const;
type Mode = typeof modes[number];

function pageId(path: string): string { return path.replace(/\.(md|mdx)$/, '').replace(/\/index$/, ''); }
async function results(mode: Mode, item: Question): Promise<string[]> {
  const query = item.previous ? `${item.previous} ${item.query}` : item.query;
  if (mode === 'legacy') return old.retrieve(query, 3).map((chunk) => pageId(chunk.sourcePath));
  return (await searchRag(index, query, {
    k: 3,
    kind: item.kind === 'quote' ? 'quote' : 'any',
    mode: mode === 'hybrid' ? 'hybrid' : 'bm25',
    embed: mode === 'hybrid' && index.vectors && process.env.RAG_EMBED_API_KEY ? embedQuery : undefined,
    warn: () => {},
  })).map((chunk) => chunk.pageId);
}

const rows: string[] = [];
const metrics: Record<Mode, { hits: number; reciprocal: number; falsePositives: number }> = {
  legacy: { hits: 0, reciprocal: 0, falsePositives: 0 },
  bm25: { hits: 0, reciprocal: 0, falsePositives: 0 },
  hybrid: { hits: 0, reciprocal: 0, falsePositives: 0 },
};
for (const item of questions) {
  const found: Record<Mode, string[]> = { legacy: [], bm25: [], hybrid: [] };
  for (const mode of modes) {
    found[mode] = await results(mode, item);
    if (item.expectedPageId) {
      const rank = found[mode].indexOf(item.expectedPageId);
      if (rank >= 0) { metrics[mode].hits++; metrics[mode].reciprocal += 1 / (rank + 1); }
    } else if (mode === 'legacy') {
      if (found[mode].length) metrics[mode].falsePositives++;
    } else {
      const query = item.previous ? `${item.previous} ${item.query}` : item.query;
      if ((index.lexical(query)[0]?.score ?? 0) >= thresholds.outsideBm25ScoreThreshold) metrics[mode].falsePositives++;
    }
  }
  if (item.expectedPageId && !found.bm25.includes(item.expectedPageId)) rows.push(`- MISS BM25: ${item.query} → ${found.bm25.join(', ')}`);
}
const relevant = questions.filter((item) => item.expectedPageId).length;
const outside = questions.length - relevant;
const recall = (mode: Mode) => metrics[mode].hits / relevant;
const hybridAvailable = Boolean(index.vectors && process.env.RAG_EMBED_API_KEY);
const decision = hybridAvailable && (recall('hybrid') - recall('bm25')) * 100 >= thresholds.hybridGainPercentagePoints && metrics.hybrid.falsePositives <= metrics.bm25.falsePositives ? 'hybrid' : 'bm25';
const lines = [
  `# Retrieval evaluation ${index.manifest.buildId}`,
  '',
  `Вопросов: ${questions.length}; по базе: ${relevant}; вне базы: ${outside}.`,
  `Порог hybrid зафиксирован в [thresholds.json](../thresholds.json): +${thresholds.hybridGainPercentagePoints} п.п. recall@3 при не большей доле ложных срабатываний.`,
  `Отсечение вне базы для BM25: score ≥ ${thresholds.outsideBm25ScoreThreshold}.`,
  '',
  '| Режим | Recall@3 | MRR | Ложные вне базы |',
  '| --- | ---: | ---: | ---: |',
  ...modes.map((mode) => `| ${mode}${mode === 'hybrid' && !hybridAvailable ? ' (fallback BM25: векторы недоступны)' : ''} | ${(recall(mode) * 100).toFixed(1)}% (${metrics[mode].hits}/${relevant}) | ${(metrics[mode].reciprocal / relevant).toFixed(3)} | ${metrics[mode].falsePositives}/${outside} |`),
  '',
  `Режим по умолчанию: **${decision}**.`,
  '',
  ...rows,
  '',
];
mkdirSync(resolve(import.meta.dirname, 'reports'), { recursive: true });
const reportPath = resolve(import.meta.dirname, 'reports', `${index.manifest.buildId.replace(/[^a-zA-Z0-9_-]/g, '-')}.md`);
writeFileSync(reportPath, lines.join('\n'));
process.stdout.write(`Report: ${reportPath}\n${lines.slice(6, 13).join('\n')}\n`);
if (recall('bm25') < recall('legacy') || recall(decision) < thresholds.minRecallAt3) process.exitCode = 1;
