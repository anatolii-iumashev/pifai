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
