import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/handler.js';

const config = { webhookSecret: 'telegram-secret', triggerSecretKey: 'trigger-secret' };
const update = { update_id: 123, message: { message_id: 8, chat: { id: 42, type: 'private' }, from: { id: 42 }, text: 'Как справиться с тревогой?' } };
const request = (body: unknown, headers: Record<string, string> = {}) => new Request('https://bot.bunny.run/webhook', {
  method: 'POST',
  headers: { 'X-Telegram-Bot-Api-Secret-Token': config.webhookSecret, ...headers },
  body: JSON.stringify(body),
});

test('rejects unauthenticated updates before enqueue', async () => {
  let calls = 0;
  const response = await handleRequest(request(update, { 'X-Telegram-Bot-Api-Secret-Token': 'wrong' }), config, async () => {
    calls++;
    return Response.json({ id: 'run_1' });
  });
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test('enqueues private text once with stable idempotency and per-chat queue', async () => {
  const bodies: unknown[] = [];
  const http = async (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ id: 'run_1' });
  };
  assert.equal((await handleRequest(request(update), config, http)).status, 200);
  assert.equal((await handleRequest(request(update), config, http)).status, 200);
  assert.equal(bodies.length, 2);
  assert.deepEqual((bodies[0] as any).options, (bodies[1] as any).options);
  assert.deepEqual((bodies[0] as any).options, {
    idempotencyKey: 'pifai:tg:123', idempotencyKeyTTL: '7d', concurrencyKey: '42',
  });
});

test('ignores group/media updates and rejects malformed text', async () => {
  const unreachable = async () => { throw new Error('must not enqueue'); };
  assert.equal((await handleRequest(request({ ...update, message: { ...update.message, chat: { id: -1, type: 'supergroup' } } }), config, unreachable)).status, 200);
  assert.equal((await handleRequest(request({ ...update, message: { ...update.message, text: undefined } }), config, unreachable)).status, 200);
  assert.equal((await handleRequest(request({ ...update, message: { ...update.message, text: '' } }), config, unreachable)).status, 400);
});

test('returns 503 when enqueue is not confirmed so Telegram retries', async () => {
  const failure = async () => new Response('failure', { status: 500 });
  assert.equal((await handleRequest(request(update), config, failure)).status, 503);
  const brokenResponse = async () => Response.json({});
  assert.equal((await handleRequest(request(update), config, brokenResponse)).status, 503);
});

test('health and method handling disclose no configuration', async () => {
  const health = await handleRequest(new Request('https://bot.bunny.run/health'), config);
  assert.deepEqual(await health.json(), { status: 'ok' });
  assert.equal((await handleRequest(new Request('https://bot.bunny.run/webhook'), config)).status, 405);
});
