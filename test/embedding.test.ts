import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

test('embedding build writes binary vectors and reuses unchanged content hashes', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'pifai-rag-'));
  mkdirSync(resolve(root, 'dist/rag'), { recursive: true });
  const chunks = [
    { id: 'a', kind: 'page', pageId: 'basics/a', title: 'A', section: '', url: 'https://example.org/basics/a/', text: 'Текст A', contentHash: 'sha256:a', metadata: {} },
    { id: 'b', kind: 'page', pageId: 'basics/b', title: 'B', section: '', url: 'https://example.org/basics/b/', text: 'Текст B', contentHash: 'sha256:b', metadata: {} },
  ];
  const chunksPath = resolve(root, 'dist/rag/chunks.json');
  const server = createServer(async (request, response) => {
    assert.equal(request.url, '/embeddings');
    requests++;
    const parts: Uint8Array[] = [];
    for await (const part of request) parts.push(part);
    const input = JSON.parse(Buffer.concat(parts).toString()).input as string;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ data: [{ embedding: [input.length, 1, 0] }] }));
  });
  let requests = 0;
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test server address');
  const script = resolve('scripts/build-rag-embeddings.ts');
  const run = async () => {
    writeFileSync(chunksPath, JSON.stringify(chunks));
    await new Promise<void>((done, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', script], {
        cwd: root,
        env: { ...process.env, RAG_EMBEDDINGS: 'on', RAG_EMBED_API_KEY: 'test', RAG_EMBED_MODEL: 'test-multilingual', RAG_EMBED_BASE_URL: `http://127.0.0.1:${address.port}`, RAG_BUILD_ID: 'test-build' },
        stdio: 'pipe',
      });
      let error = '';
      child.stderr.on('data', (data) => { error += data; });
      child.on('error', reject);
      child.on('close', (code) => code === 0 ? done() : reject(new Error(error)));
    });
  };
  try {
    await run();
    assert.equal(requests, 2);
    assert.equal(readFileSync(resolve(root, 'dist/rag/embeddings.bin')).byteLength, 2 * 3 * 4);
    await run();
    assert.equal(requests, 2);
    chunks[1].text = 'Изменённый текст B';
    chunks[1].contentHash = 'sha256:changed';
    await run();
    assert.equal(requests, 3);
    assert.equal(JSON.parse(readFileSync(resolve(root, 'dist/rag/manifest.json'), 'utf8')).embedding.dim, 3);
  } finally {
    server.close();
    rmSync(root, { recursive: true, force: true });
  }
});
