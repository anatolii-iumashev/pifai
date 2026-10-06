import knowledge from '../generated/knowledge.json' with { type: 'json' };

export interface KnowledgeChunk {
  id: string;
  title: string;
  section: string;
  url: string;
  text: string;
  contentHash: string;
}

export interface KnowledgeIndex {
  buildId: string;
  baseUrl: string;
  chunks: KnowledgeChunk[];
}

const index: KnowledgeIndex = knowledge;
const stopwords = new Set(['как', 'что', 'это', 'мне', 'моя', 'мой', 'при', 'для', 'или', 'его', 'она', 'они', 'есть', 'если', 'можно', 'почему', 'когда', 'тебя', 'меня', 'очень']);

function normalize(token: string): string {
  return token.toLowerCase().replace(/ё/g, 'е').replace(/(иями|ями|ами|ого|ему|ыми|ими|иях|иях|иях|ость|ости|ений|ения|ение|ать|ить|ешь|ете|ют|ет|ом|ем|ой|ая|ое|ые|ий|ый|ых|ам|ям|ах|ях|ов|ев|ом|а|я|ы|и|е|у|ю|о)$/u, '');
}

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[а-яёa-z]{3,}/gu) ?? [])
    .filter((token) => !stopwords.has(token))
    .map(normalize)
    .filter((token) => token.length >= 3);
}

export function search(query: string, previousUser = '', topK = 3, source: KnowledgeIndex = index): KnowledgeChunk[] {
  const queryTerms = tokens(query.length < 50 && previousUser ? `${previousUser} ${query}` : query);
  if (!queryTerms.length) return [];
  const docs = source.chunks.map((chunk) => ({ chunk, terms: tokens(`${chunk.title} ${chunk.section} ${chunk.text}`) }));
  const avgLength = docs.reduce((sum, doc) => sum + doc.terms.length, 0) / Math.max(1, docs.length);
  const df = new Map<string, number>();
  for (const doc of docs) for (const term of new Set(doc.terms)) df.set(term, (df.get(term) ?? 0) + 1);
  const ranked = docs.map((doc) => {
    let score = 0;
    const frequencies = new Map<string, number>();
    for (const term of doc.terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    const titleTerms = new Set(tokens(`${doc.chunk.title} ${doc.chunk.section}`));
    for (const term of new Set(queryTerms)) {
      const tf = frequencies.get(term) ?? 0;
      if (!tf) continue;
      const idf = Math.log(1 + (docs.length - (df.get(term) ?? 0) + 0.5) / ((df.get(term) ?? 0) + 0.5));
      score += idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * doc.terms.length / Math.max(1, avgLength)));
      if (titleTerms.has(term)) score += idf;
    }
    return { chunk: doc.chunk, score };
  }).filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));
  const distinct = new Set<string>();
  return ranked.filter((entry) => {
    if (distinct.has(entry.chunk.url)) return false;
    distinct.add(entry.chunk.url);
    return true;
  }).slice(0, topK).map((entry) => entry.chunk);
}

export const knowledgeVersion = index.buildId;
export const knowledgeBaseUrl = index.baseUrl;
export const allKnowledgeUrls = new Set(index.chunks.map((chunk) => chunk.url));
