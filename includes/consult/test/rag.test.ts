import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import { createAgent } from 'langchain';
import { clearRagCache, createKnowledgeTool, getSourceById, KnowledgeRetriever, loadRagIndex, markUnverifiedUrls, RagIndex, searchRag, tokens, type RagChunk, type RagManifest } from '../src/rag/index.js';

const sample = (id: string, pageId: string, text: string): RagChunk => ({
  id, kind: 'page', pageId, title: 'Тень', section: 'Работа с тенью', category: 'authors/jung',
  url: `https://example.org/${pageId}/#работа-с-тенью`, text, contentHash: 'sha256:x', metadata: {},
});
const chunks = [sample('shadow#0', 'authors/jung/shadow', 'Тенью называют вытесненные качества личности.'), sample('shadow#1', 'authors/jung/shadow', 'Работа с Тенью требует принятия.'), sample('shadow#2', 'authors/jung/shadow', 'Тень влияет на поведение.'), sample('other#0', 'practices/shadow-work', 'Практика наблюдения за тенью.')];
const manifest: RagManifest = { schemaVersion: 1, buildId: 'fixture-1', createdAt: '2026-09-28T00:00:00Z', siteUrl: 'https://example.org', chunkCount: chunks.length, pageCount: 2, quoteCount: 0, embedding: null, files: {} };

function artifact(override: Partial<RagManifest> = {}) {
  const bytes = Buffer.from(JSON.stringify(chunks));
  const index = { ...manifest, ...override, files: { 'chunks.json': `sha256:${createHash('sha256').update(bytes).digest('hex')}`, ...override.files } };
  const files = new Map([['manifest.json', Buffer.from(JSON.stringify(index))], ['chunks.json', bytes]]);
  let reads = 0;
  const reader = async (url: string) => { reads++; const value = files.get(url.split('/').at(-1)!); if (!value) throw new Error(`Missing ${url}`); return value; };
  return { reader, files, reads: () => reads };
}

test('loader rejects unknown schema and bad hash, then caches valid artifact', async () => {
  clearRagCache();
  await assert.rejects(loadRagIndex('https://example.org/bad', artifact({ schemaVersion: 999 }).reader), /schemaVersion/);
  clearRagCache();
  await assert.rejects(loadRagIndex('https://example.org/bad', artifact({ files: { 'chunks.json': 'sha256:bad' } }).reader), /hash mismatch/);
  clearRagCache();
  const fixture = artifact();
  const first = await loadRagIndex('https://example.org/rag', fixture.reader);
  const second = await loadRagIndex('https://example.org/rag', fixture.reader);
  assert.strictEqual(first, second);
  assert.equal(fixture.reads(), 2);
  assert.equal(getSourceById(first, 'shadow#0')?.text, chunks[0].text);
});

test('Russian stemming, page cap, fallback and LangChain retriever', async () => {
  const index = new RagIndex(manifest, chunks);
  assert.deepEqual(tokens('тени тенью'), ['тен', 'тен']);
  const found = await searchRag(index, 'Как работать с тенью?', { k: 8 });
  assert.ok(found.some((chunk) => chunk.pageId === 'authors/jung/shadow'));
  assert.ok(found.filter((chunk) => chunk.pageId === 'authors/jung/shadow').length <= 2);
  const warnings: string[] = [];
  assert.deepEqual(await searchRag(index, 'тенью', { mode: 'hybrid', warn: (message) => warnings.push(message) }), await searchRag(index, 'тенью'));
  assert.equal(warnings.length, 1);
  const docs = await new KnowledgeRetriever(index, { k: 2 }).invoke('тени');
  assert.equal(docs.length, 2);
  assert.equal(docs[0].metadata.sourceId, docs[0].id);
});

test('tool returns bounded structured sources and mock LangChain agent calls it', async () => {
  const index = new RagIndex(manifest, chunks);
  const search = createKnowledgeTool(index, { budget: 360 });
  const direct = JSON.parse(await search.invoke({ query: 'тенью', k: 8 }) as string) as { sourceId: string; text: string }[];
  assert.ok(direct.length >= 1);
  assert.ok(JSON.stringify(direct).length <= 360);
  assert.ok(direct.every((item) => item.sourceId && item.text));
  const model = fakeModel()
    .respondWithTools([{ name: 'search_knowledge_base', args: { query: 'тенью', k: 2 } }])
    .respond(new AIMessage('В базе знаний есть материал о Тени.'));
  const agent = createAgent({ model, tools: [search] });
  const answer = await agent.invoke({ messages: [new HumanMessage('Что Юнг говорил о тени?')] });
  assert.ok(answer.messages.some((message) => message instanceof ToolMessage && message.name === 'search_knowledge_base'));
  assert.equal(model.callCount, 2);
  assert.match(markUnverifiedUrls('См. https://invented.invalid/ и ' + chunks[0].url, [chunks[0]]), /непроверенная ссылка/);
});

test('1000-chunk cold index and lexical search meet local latency budget', async () => {
  const many = Array.from({ length: 1000 }, (_, i) => sample(`sample-${i}`, `page-${i}`, `Тень и работа с тенью. Материал ${i}.`));
  const started = performance.now();
  const index = new RagIndex({ ...manifest, chunkCount: many.length }, many);
  const builtMs = performance.now() - started;
  const searchStart = performance.now();
  await searchRag(index, 'работа с тенью', { k: 3 });
  const searchMs = performance.now() - searchStart;
  assert.ok(builtMs < 1000, `build ${builtMs.toFixed(1)} ms`);
  assert.ok(searchMs < 20, `search ${searchMs.toFixed(1)} ms`);
});
