import test from 'node:test';
import assert from 'node:assert/strict';
import { splitMessage, telegramClient } from '../src/telegram.js';

test('splits long Unicode messages within Telegram limit', () => {
  const parts = splitMessage('🙂'.repeat(8000));
  assert.equal(parts.length, 3);
  assert.equal(parts.join(''), '🙂'.repeat(8000));
  assert.ok(parts.every((part) => Array.from(part).length <= 3900));
});

test('Telegram delivery uses plain text and captures message IDs', async () => {
  const bodies: unknown[] = [];
  const http = async (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ ok: true, result: { message_id: bodies.length } });
  };
  const ids = await telegramClient('token', http).send(42, 'hello');
  assert.deepEqual(ids, [1]);
  assert.deepEqual(bodies, [{ chat_id: 42, text: 'hello', disable_web_page_preview: true }]);
});

test('the first part edits the thinking ack and the rest go as new messages', async () => {
  const bodies: { url: string; body: Record<string, unknown> }[] = [];
  const http = async (url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return Response.json({ ok: true, result: { message_id: bodies.length } });
  };
  const ids = await telegramClient('token', http).send(42, '🙂'.repeat(8000), 555);
  assert.deepEqual(ids, [1, 2, 3]); // the edited ack + two follow-up parts
  assert.equal(bodies.length, 3);
  assert.match(bodies[0].url, /editMessageText/);
  assert.equal(bodies[0].body.chat_id, 42);
  assert.equal(bodies[0].body.message_id, 555);
  assert.match(bodies[1].url, /sendMessage/);
  assert.match(bodies[2].url, /sendMessage/);
});

test('ack sends the thinking message and returns its id', async () => {
  const bodies: unknown[] = [];
  const http = async (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ ok: true, result: { message_id: 777 } });
  };
  assert.equal(await telegramClient('token', http).ack(42, 'Давайте подумаем…'), 777);
  assert.deepEqual(bodies, [{ chat_id: 42, text: 'Давайте подумаем…', disable_web_page_preview: true }]);
});
