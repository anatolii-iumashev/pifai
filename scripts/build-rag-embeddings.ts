import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RagChunk } from '../src/lib/rag';

const output = resolve('dist/rag');
const cachePath = resolve('.cache/rag-embeddings.json');
const chunksPath = resolve(output, 'chunks.json');
const chunksBytes = readFileSync(chunksPath);
const chunks = JSON.parse(chunksBytes.toString()) as RagChunk[];
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const embeddingEnabled = process.env.RAG_EMBEDDINGS === 'on' && Boolean(process.env.RAG_EMBED_API_KEY);
const model = process.env.RAG_EMBED_MODEL;
const baseUrl = process.env.RAG_EMBED_BASE_URL;
let embedding: { provider: string; model: string; dim: number } | null = null;
let embeddingBytes: Buffer | undefined;
if (embeddingEnabled) {
  if (!model || !baseUrl) throw new Error('RAG_EMBED_MODEL and RAG_EMBED_BASE_URL are required when embeddings are enabled');
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) as Record<string, number[]> : {};
  const vectors: number[][] = [];
  let requests = 0;
  for (const chunk of chunks) {
    const key = `${model}:${chunk.contentHash}`;
    let vector = cache[key];
    if (!vector) {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RAG_EMBED_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: `${chunk.title}\n${chunk.section}\n${chunk.text}` }),
      });
      if (!response.ok) throw new Error(`Embedding API returned ${response.status}`);
      const result = await response.json() as { data?: { embedding?: number[] }[] };
      vector = result.data?.[0]?.embedding;
      if (!vector?.length || vector.some((item) => !Number.isFinite(item))) throw new Error(`Invalid embedding for ${chunk.id}`);
      cache[key] = vector;
      requests++;
    }
    vectors.push(vector);
  }
  const dim = vectors[0]?.length ?? 0;
  if (!dim || vectors.some((vector) => vector.length !== dim)) throw new Error('Embedding dimensions mismatch');
  embeddingBytes = Buffer.allocUnsafe(chunks.length * dim * 4);
  vectors.forEach((vector, row) => vector.forEach((value, column) => embeddingBytes!.writeFloatLE(value, (row * dim + column) * 4)));
  writeFileSync(resolve(output, 'embeddings.bin'), embeddingBytes);
  mkdirSync(resolve('.cache'), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache));
  embedding = { provider: new URL(baseUrl).host, model, dim };
  process.stdout.write(`RAG embeddings: ${requests} API requests, ${chunks.length - requests} cache hits\n`);
} else {
  process.stdout.write('RAG embeddings: disabled\n');
}
let sha = 'nogit';
try { sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* source archive */ }
const createdAt = new Date().toISOString();
const buildId = process.env.RAG_BUILD_ID || `${sha}-${createdAt}`;
const firstPage = chunks.find((chunk) => chunk.kind === 'page');
const pageUrl = firstPage ? new URL(firstPage.url) : undefined;
const pageRoute = firstPage ? `/${firstPage.pageId}/` : '';
const siteUrl = pageUrl ? pageUrl.origin + pageUrl.pathname.slice(0, -pageRoute.length) : '';
const manifest = {
  schemaVersion: 1,
  buildId,
  createdAt,
  siteUrl,
  chunkCount: chunks.length,
  pageCount: new Set(chunks.filter((chunk) => chunk.kind === 'page').map((chunk) => chunk.pageId)).size,
  quoteCount: chunks.filter((chunk) => chunk.kind === 'quote').length,
  embedding,
  files: { 'chunks.json': `sha256:${hash(chunksBytes)}`, ...(embeddingBytes ? { 'embeddings.bin': `sha256:${hash(embeddingBytes)}` } : {}) },
};
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
process.stdout.write(`RAG ${buildId}: ${manifest.chunkCount} chunks, ${manifest.pageCount} pages, ${manifest.quoteCount} quotes\n`);
