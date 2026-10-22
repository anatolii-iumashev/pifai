import test from 'node:test';
import assert from 'node:assert/strict';
import { splitMessage, telegramClient } from '../src/telegram.js';

test('splits long Unicode messages within Telegram limit', () => {
  const parts = splitMessage('🙂'.repeat(8000));
  assert.equal(parts.length, 3);
  assert.equal(parts.join(''), '🙂'.repeat(8000));
  assert.ok(parts.every((part) => Array.from(part).length <= 3900));
});

function httpMock(reject: (body: Record<string, unknown>, callNumber: number) => boolean) {
  const bodies: { url: string; body: Record<string, unknown> }[] = [];
  let sentMessages = 0;
  const http = async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    bodies.push({ url: String(url), body });
    if (reject(body, bodies.length - 1)) {
      return Response.json({ ok: false, error_code: 400, description: 'Bad Request: can not parse rich message' }, { status: 400 });
    }
    sentMessages++;
    return Response.json({ ok: true, result: { message_id: sentMessages } });
  };
  return { bodies, http };
}

test('answers go out as rich messages and capture message IDs', async () => {
  const { bodies, http } = httpMock(() => false);
  const ids = await telegramClient('token', http).send(42, '## Ответ\n- пункт');
  assert.deepEqual(ids, [1]);
  assert.equal(bodies.length, 1);
  assert.match(bodies[0].url, /sendRichMessage$/);
  assert.deepEqual(bodies[0].body, { chat_id: 42, rich_message: { markdown: '## Ответ\n- пункт' } });
});

test('the first part edits the thinking ack as rich and the rest go as new rich messages', async () => {
  const { bodies, http } = httpMock(() => false);
  const text = 'п.'.repeat(17_500); // 35 000 characters → two rich parts
  const ids = await telegramClient('token', http).send(42, text, 555);
  assert.deepEqual(ids, [1, 2]);
  assert.equal(bodies.length, 2);
  assert.match(bodies[0].url, /editMessageText$/);
  assert.equal(bodies[0].body.message_id, 555);
  assert.deepEqual(bodies[0].body.rich_message, { markdown: text.slice(0, 32_000) });
  assert.match(bodies[1].url, /sendRichMessage$/);
  assert.deepEqual(bodies[1].body.rich_message, { markdown: text.slice(32_000) });
});

test('a Telegram 4xx on the rich edit falls back to a plain edit', async () => {
  const { bodies, http } = httpMock((body) => Boolean(body.rich_message));
  const ids = await telegramClient('token', http).send(42, 'привет', 555);
  assert.deepEqual(ids, [1]);
  assert.equal(bodies.length, 2);
  assert.match(bodies[0].url, /editMessageText$/);
  assert.ok('rich_message' in bodies[0].body);
  assert.match(bodies[1].url, /editMessageText$/);
  assert.deepEqual(bodies[1].body, { chat_id: 42, message_id: 555, text: 'привет', disable_web_page_preview: true });
});

test('a Telegram 4xx mid-stream sends only the undelivered remainder as plain text', async () => {
  const { bodies, http } = httpMock((_body, callNumber) => callNumber === 2); // the second sendRichMessage call fails
  const text = 'п.'.repeat(33_000); // 66 000 characters → three rich parts
  const ids = await telegramClient('token', http).send(42, text, 555);
  // The edited ack and the first rich part succeeded; the last part went out plain.
  assert.deepEqual(ids, [1, 2, 3]);
  assert.equal(bodies.length, 4); // three rich calls (one rejected) + one plain call
  assert.match(bodies[0].url, /editMessageText$/);
  assert.ok('rich_message' in bodies[0].body);
  assert.match(bodies[1].url, /sendRichMessage$/);
  assert.ok('rich_message' in bodies[1].body);
  assert.match(bodies[2].url, /sendRichMessage$/); // rejected
  assert.ok('rich_message' in bodies[2].body);
  assert.match(bodies[3].url, /sendMessage$/);
  assert.ok('rich_message' in bodies[3].body === false);
  assert.deepEqual(bodies[3].body.text, text.slice(64_000));
});

test('ack sends the thinking message and returns its id', async () => {
  const { bodies, http } = httpMock(() => false);
  assert.equal(await telegramClient('token', http).ack(42, 'Давайте подумаем…'), 1);
  assert.match(bodies[0].url, /sendMessage$/);
  assert.deepEqual(bodies[0].body, { chat_id: 42, text: 'Давайте подумаем…', disable_web_page_preview: true });
});
