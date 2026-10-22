import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, type WebhookConfig } from '../src/server.js';
import { jobFromUpdate } from '../src/job.js';

const config: WebhookConfig = { webhookSecret: 'telegram-secret', triggerSecretKey: 'trigger-secret' };
const update = { update_id: 123, message: { message_id: 8, chat: { id: 42, type: 'private' }, from: { id: 42 }, text: 'Как справиться с тревогой?' } };
const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://bot.example/webhook', {
  method: 'POST',
  headers: { 'X-Telegram-Bot-Api-Secret-Token': config.webhookSecret, 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

const queue = (status = 200) => {
  const calls: { url: string; body: unknown }[] = [];
  const http: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return Response.json(status === 200 ? { id: 'run_1' } : {}, { status });
  };
  return { http, calls };
};

test('health and routing disclose no configuration', async () => {
  const app = createApp(config);
  const health = await app.request('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  assert.equal((await app.request('/webhook')).status, 405);
  assert.equal((await app.request('/other')).status, 404);
});

test('rejects unauthenticated updates before the body is read', async () => {
  const { http, calls } = queue();
  const app = createApp(config, http);
  const response = await app.request(post(update, { 'X-Telegram-Bot-Api-Secret-Token': 'wrong' }));
  assert.equal(response.status, 401);
  assert.deepEqual(calls, []);
});

test('enqueues private text with stable idempotency and per-chat queue', async () => {
  const { http, calls } = queue();
  const app = createApp(config, http);
  for (let i = 0; i < 2; i++) {
    const response = await app.request(post(update));
    assert.equal(response.status, 200);
  }
  assert.equal(calls.length, 2);
  const first = calls[0].body as { options: unknown; payload: Record<string, unknown> };
  const second = calls[1].body as { options: unknown };
  assert.deepEqual(first.options, second.options);
  assert.deepEqual(first.options, { idempotencyKey: 'pifai:tg:123', idempotencyKeyTTL: '7d', concurrencyKey: '42' });
  assert.equal(first.payload.schemaVersion, 1);
  assert.equal(first.payload.text, 'Как справиться с тревогой?');
  assert.match(String(first.payload.receivedAt), /^20\d\d-/);
});

test('ignores group and media updates, rejects malformed text', async () => {
  const { http, calls } = queue();
  const app = createApp(config, http);
  assert.equal((await app.request(post({ ...update, message: { ...update.message, chat: { id: -1, type: 'supergroup' } } }))).status, 200);
  assert.equal((await app.request(post({ ...update, message: { ...update.message, text: undefined } }))).status, 200);
  assert.equal((await app.request(post({ ...update, message: { ...update.message, text: '' } }))).status, 400);
  assert.equal((await app.request(post({ ...update, update_id: 'x' }))).status, 400);
  assert.deepEqual(calls, []);
});

test('returns 503 when the run is not confirmed so Telegram retries', async () => {
  const failing = createApp(config, async () => Response.json({}, { status: 500 }));
  assert.equal((await failing.request(post(update))).status, 503);
  const noRun = createApp(config, async () => Response.json({}));
  assert.equal((await noRun.request(post(update))).status, 503);
  const broken = createApp(config, async () => { throw new Error('network down'); });
  assert.equal((await broken.request(post(update))).status, 503);
});

test('limits the body to 16 KiB', async () => {
  const { http, calls } = queue();
  const app = createApp(config, http);
  // Declared size over the limit: rejected before the body is read.
  assert.equal((await app.request(new Request('https://bot.example/webhook', {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': config.webhookSecret, 'Content-Length': '999999' },
    body: JSON.stringify(update),
  }))).status, 413);
  // Actual body over the limit: rejected by the streaming reader.
  const huge = { ...update, message: { ...update.message, text: 'а'.repeat(9000) } };
  assert.equal((await app.request(new Request('https://bot.example/webhook', {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': config.webhookSecret },
    body: JSON.stringify(huge),
  }))).status, 413);
  assert.deepEqual(calls, []);
});

test('jobFromUpdate preserves the Telegram payload contract', () => {
  const job = jobFromUpdate(update);
  assert.deepEqual(job, {
    schemaVersion: 1, updateId: 123, chatId: 42, messageId: 8, userId: 42,
    text: 'Как справиться с тревогой?', receivedAt: job?.receivedAt,
  });
});
