import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'astro/zod';
import { buildRagChunks, RAG_CHUNK_CONFIG, type RagPage } from '../src/lib/rag';

const chunkSchema = z.object({
  id: z.string().min(1), kind: z.enum(['page', 'quote']), pageId: z.string().min(1),
  title: z.string().min(1), section: z.string(), category: z.string().min(1),
  url: z.url(), text: z.string().min(1).max(RAG_CHUNK_CONFIG.max),
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  metadata: z.object({ description: z.string().optional(), references: z.array(z.string()).optional(), author: z.string().optional(), topics: z.array(z.string()).optional(), work: z.string().optional() }),
});

const site = 'https://example.org/pifai';
const page: RagPage = { id: 'quotes/test', title: 'Тестовая страница', description: 'Описание', body: 'import QuoteList from "file";\n\n## Первый раздел\nОбычный текст про тень и чувства.\n\n<QuoteList topic="test" />\n\n## Второй раздел\nСвой текст.\n\n## Материалы и источники\n- [Источник](https://example.org/source)' };

test('collection extraction sanitizes MDX and includes each quote once', () => {
  const chunks = buildRagChunks([page], [{ id: 'author', name: 'Автор', quotes: [{ text: 'Тестовая цитата', topics: ['test'] }] }], site, '/pifai');
  assert.equal(chunks.filter((chunk) => chunk.kind === 'quote').length, 1);
  assert.equal(chunks.filter((chunk) => chunk.kind === 'page').length >= 1, true);
  assert.equal(chunks.every((chunk) => !/import QuoteList|<QuoteList|Материалы и источники/.test(chunk.text)), true);
  assert.equal(chunks.find((chunk) => chunk.kind === 'page')?.metadata.references?.[0], 'https://example.org/source');
  chunks.forEach((chunk) => chunkSchema.parse(chunk));
  assert.throws(() => buildRagChunks([{ ...page, title: '' }], [], site, '/pifai'), /missing title/);
  assert.throws(() => buildRagChunks([page], [{ id: 'author', name: 'Автор', quotes: [{ text: 'x', topics: ['missing'] }] }], site, '/pifai'), /no published topic page/);
});

test('IDs and hashes are stable and only edited section changes', () => {
  const first = buildRagChunks([page], [], site, '/pifai');
  const second = buildRagChunks([page], [], site, '/pifai');
  assert.deepEqual(second.map(({ id, contentHash }) => [id, contentHash]), first.map(({ id, contentHash }) => [id, contentHash]));
  const revised = buildRagChunks([{ ...page, body: page.body.replace('Свой текст.', 'Другой текст.') }], [], site, '/pifai');
  const original = new Map(first.map((chunk) => [chunk.id, chunk.contentHash]));
  assert.equal(revised.filter((chunk) => original.get(chunk.id) !== chunk.contentHash).length, 1);
});

test('built artifact has complete corpus, valid hashes, pages and anchors', () => {
  const root = resolve('dist');
  const chunksBytes = readFileSync(resolve(root, 'rag/chunks.json'));
  const chunks = JSON.parse(chunksBytes.toString()) as z.infer<typeof chunkSchema>[];
  const manifest = JSON.parse(readFileSync(resolve(root, 'rag/manifest.json'), 'utf8'));
  assert.equal(manifest.files['chunks.json'], `sha256:${createHash('sha256').update(chunksBytes).digest('hex')}`);
  assert.equal(manifest.chunkCount, chunks.length);
  assert.equal(manifest.quoteCount, 78);
  assert.equal(manifest.pageCount, 47);
  assert.equal(chunks.filter((chunk) => chunk.kind === 'quote').length, 78);
  const home = readFileSync(resolve(root, 'index.html'), 'utf8');
  assert.match(home, new RegExp(manifest.buildId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const basePath = new URL(manifest.siteUrl).pathname;
  for (const chunk of chunks) {
    chunkSchema.parse(chunk);
    const url = new URL(chunk.url);
    assert.ok(url.pathname.startsWith(basePath));
    const pagePath = url.pathname.slice(basePath.length).replace(/^\//, '');
    const htmlPath = resolve(root, pagePath, 'index.html');
    assert.ok(existsSync(htmlPath), `${chunk.id}: missing ${htmlPath}`);
    if (url.hash) assert.ok(readFileSync(htmlPath, 'utf8').includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `${chunk.id}: missing anchor ${url.hash}`);
  }
});
