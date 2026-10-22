import test from 'node:test';
import assert from 'node:assert/strict';
import { bunnyStore } from '../src/storage.js';

function storageHttp(responses: (request: { method: string; path: string; body?: string }) => Response | Promise<Response>) {
  const calls: { method: string; path: string; body?: string }[] = [];
  const http: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const request = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      body: typeof init?.body === 'string' ? init.body : undefined,
    };
    calls.push(request);
    return responses(request);
  };
  return { http, calls };
}

const env = { BUNNY_STORAGE_ZONE: 'pifai-dialogues', BUNNY_STORAGE_ACCESS_KEY: 'zone-password' };

test('reads chat history as a JSON object, missing means empty', async () => {
  const { http, calls } = storageHttp(({ method, path }) => {
    assert.equal(method, 'GET');
    assert.match(path, /^\/pifai-dialogues\/pifai\/chats\/42\.json$/);
    return Response.json({ updatedAt: '2026-10-22T00:00:00Z', messages: [
      { role: 'user', content: 'первый' },
      { role: 'assistant', content: 'ответ' },
      { role: 'system', content: 'лишний' },
    ] });
  });
  const store = bunnyStore(env, http);
  assert.deepEqual(await store.history(42), [
    { role: 'user', content: 'первый' },
    { role: 'assistant', content: 'ответ' },
  ]);
  assert.equal(calls.length, 1);
});

test('missing history object returns an empty list', async () => {
  const { http } = storageHttp(() => new Response('not found', { status: 404 }));
  assert.deepEqual(await bunnyStore(env, http).history(42), []);
});

test('saveHistory appends the turn and trims to the last 20 messages', async () => {
  const existing = { updatedAt: 'x', messages: Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `m${i}` })) };
  const { http, calls } = storageHttp(({ method, body }) => {
    if (method === 'PUT') return new Response(null, { status: 201 });
    return Response.json(existing);
  });
  await bunnyStore(env, http).saveHistory(42, 'вопрос', 'ответ');
  const put = calls.find((call) => call.method === 'PUT');
  const saved = JSON.parse(put!.body!);
  assert.equal(saved.messages.length, 20);
  assert.deepEqual(saved.messages.at(-2), { role: 'user', content: 'вопрос' });
  assert.deepEqual(saved.messages.at(-1), { role: 'assistant', content: 'ответ' });
});

test('clear deletes only the current chat object', async () => {
  const { http, calls } = storageHttp(({ method, path }) => {
    assert.equal(method, 'DELETE');
    assert.match(path, /\/chats\/42\.json$/);
    return new Response(null, { status: 200 });
  });
  await bunnyStore(env, http).clear(42);
  assert.equal(calls.length, 1);
});

test('delivery claim: first run wins, replays lose', async () => {
  const objects = new Map<string, string>();
  const { http, calls } = storageHttp(({ method, path, body }) => {
    assert.match(path, /^\/pifai-dialogues\/pifai\/delivered\/telegram\/12$/);
    if (method === 'GET') return objects.has(path) ? Response.json(JSON.parse(objects.get(path)!)) : new Response('not found', { status: 404 });
    objects.set(path, body!);
    return new Response(null, { status: 201 });
  });
  const store = bunnyStore(env, http);
  assert.equal(await store.claimDelivery(12), true);
  assert.equal(await store.claimDelivery(12), false);
  assert.equal(calls.length, 3); // claim 1: GET+PUT, claim 2: GET (already claimed)
});

test('delivery claim with an existing marker does not write', async () => {
  const { http, calls } = storageHttp(({ method }) => method === 'GET' ? Response.json({ claimedAt: 'x' }) : new Response(null, { status: 201 }));
  assert.equal(await bunnyStore(env, http).claimDelivery(12), false);
  assert.deepEqual(calls.map((call) => call.method), ['GET']);
});

test('a concurrent-claim 4xx write is reported as already claimed', async () => {
  const { http } = storageHttp(({ method }) => method === 'GET' ? new Response('not found', { status: 404 }) : new Response('conflict', { status: 409 }));
  assert.equal(await bunnyStore(env, http).claimDelivery(12), false);
});

test('storage failures propagate so the task retries', async () => {
  const { http } = storageHttp(() => new Response('boom', { status: 500 }));
  await assert.rejects(bunnyStore(env, http).history(42), /HTTP 500/);
});

test('missing configuration is an error', () => {
  assert.throws(() => bunnyStore({}, fetch), /BUNNY_STORAGE_ZONE/);
});
