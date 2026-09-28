import { assertEquals } from '@std/assert';
import { handleRequest } from '../src/handler.ts';

const config = { webhookSecret: 'telegram-secret', triggerSecretKey: 'trigger-secret' };
const update = { update_id: 123, message: { message_id: 8, chat: { id: 42, type: 'private' }, from: { id: 42 }, text: 'Как справиться с тревогой?' } };
const request = (body: unknown, headers: Record<string, string> = {}) => new Request('https://bot.bunny.run/webhook', {
  method: 'POST',
  headers: { 'X-Telegram-Bot-Api-Secret-Token': config.webhookSecret, ...headers },
  body: JSON.stringify(body),
});

Deno.test('rejects unauthenticated updates before enqueue', async () => {
  let calls = 0;
  const response = await handleRequest(request(update, { 'X-Telegram-Bot-Api-Secret-Token': 'wrong' }), config, () => {
    calls++;
    return Promise.resolve(Response.json({ id: 'run_1' }));
  });
  assertEquals(response.status, 401);
  assertEquals(calls, 0);
});

Deno.test('enqueues private text once with stable idempotency and per-chat queue', async () => {
  const bodies: { options: unknown }[] = [];
  const http = (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Promise.resolve(Response.json({ id: 'run_1' }));
  };
  assertEquals((await handleRequest(request(update), config, http)).status, 200);
  assertEquals((await handleRequest(request(update), config, http)).status, 200);
  assertEquals(bodies.length, 2);
  assertEquals(bodies[0].options, bodies[1].options);
  assertEquals(bodies[0].options, {
    idempotencyKey: 'pifai:tg:123', idempotencyKeyTTL: '7d', concurrencyKey: '42',
  });
});

Deno.test('ignores group/media updates and rejects malformed text', async () => {
  const unreachable = () => Promise.reject(new Error('must not enqueue'));
  assertEquals((await handleRequest(request({ ...update, message: { ...update.message, chat: { id: -1, type: 'supergroup' } } }), config, unreachable)).status, 200);
  assertEquals((await handleRequest(request({ ...update, message: { ...update.message, text: undefined } }), config, unreachable)).status, 200);
  assertEquals((await handleRequest(request({ ...update, message: { ...update.message, text: '' } }), config, unreachable)).status, 400);
});

Deno.test('returns 503 when enqueue is not confirmed so Telegram retries', async () => {
  const failure = () => Promise.resolve(new Response('failure', { status: 500 }));
  assertEquals((await handleRequest(request(update), config, failure)).status, 503);
  const brokenResponse = () => Promise.resolve(Response.json({}));
  assertEquals((await handleRequest(request(update), config, brokenResponse)).status, 503);
});

Deno.test('health and method handling disclose no configuration', async () => {
  const health = await handleRequest(new Request('https://bot.bunny.run/health'), config);
  assertEquals(await health.json(), { status: 'ok' });
  assertEquals((await handleRequest(new Request('https://bot.bunny.run/webhook'), config)).status, 405);
});
