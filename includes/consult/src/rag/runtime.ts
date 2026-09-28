import { loadRagIndex, searchRag, type RagChunk } from './index.js';

export async function embedQuery(query: string, model: string, env: NodeJS.ProcessEnv = process.env, http: typeof fetch = fetch): Promise<Float32Array> {
  if (!env.RAG_EMBED_API_KEY || !env.RAG_EMBED_BASE_URL) throw new Error('RAG embedding query credentials are missing');
  const response = await http(`${env.RAG_EMBED_BASE_URL.replace(/\/$/, '')}/embeddings`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.RAG_EMBED_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: query }),
  });
  if (!response.ok) throw new Error(`RAG query embedding HTTP ${response.status}`);
  const result = await response.json() as { data?: { embedding?: number[] }[] };
  const vector = result.data?.[0]?.embedding;
  if (!vector?.length || vector.some((value) => !Number.isFinite(value))) throw new Error('Invalid RAG query embedding');
  return Float32Array.from(vector);
}

export async function searchPublishedKnowledge(question: string, previousUser = '', env: NodeJS.ProcessEnv = process.env): Promise<{ chunks: RagChunk[]; buildId: string }> {
  const source = env.RAG_INDEX_SOURCE ?? 'https://anatolii-iumashev.github.io/pifai/rag';
  const index = await loadRagIndex(source);
  const query = question.length < 50 && previousUser ? `${previousUser} ${question}` : question;
  const mode = env.RAG_MODE === 'hybrid' ? 'hybrid' : 'bm25';
  const chunks = await searchRag(index, query, { k: 3, mode, embed: index.manifest.embedding && env.RAG_EMBED_API_KEY ? (text, model) => embedQuery(text, model, env) : undefined });
  return { chunks, buildId: index.manifest.buildId };
}
