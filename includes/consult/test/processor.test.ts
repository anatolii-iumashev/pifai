import test from 'node:test';
import assert from 'node:assert/strict';
import { processConsultation } from '../src/processor.js';
import type { DialogueStore, HistoryMessage, JobRecord } from '../src/store.js';
import type { ConsultationJob } from '../../edge/src/handler.js';

const job: ConsultationJob = { schemaVersion: 1, updateId: 12, chatId: 42, messageId: 7, userId: 42, text: 'Я тревожусь', receivedAt: '2026-09-28T00:00:00Z' };

function fixture(initial: JobRecord = { status: 'processing', responseText: null }) {
  let record = { ...initial };
  const calls = { clear: [] as number[], sent: [] as string[], model: 0, saved: [] as boolean[] };
  const store: DialogueStore = {
    async getOrCreate() { return record; },
    async history() { return [] as HistoryMessage[]; },
    async clear(chatId) { calls.clear.push(chatId); },
    async saveResult(_job, response, _model, _version, saveHistory) { record = { status: 'ready', responseText: response }; calls.saved.push(saveHistory); },
    async markAttempted() { if (record.status !== 'ready') return false; record.status = 'attempted'; return true; },
    async markDelivered() { record.status = 'delivered'; },
  };
  const deps = {
    store,
    model: { async answer() { calls.model++; return { text: 'Попробуйте описать чувство. https://invented.invalid/path', model: 'test-model' }; } },
    telegram: { async send(_chatId: number, text: string) { calls.sent.push(text); return [99]; } },
    retrieve: () => [{ id: 'a', title: 'Эмоции и потребности', section: 'Практика', text: 'Назовите чувство', url: 'https://example.org/emotions/', contentHash: 'a' }],
  };
  return { deps, calls, getRecord: () => record };
}

test('sends source URLs from the index and removes invented model URLs', async () => {
  const { deps, calls } = fixture();
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivered' });
  assert.equal(calls.model, 1);
  assert.match(calls.sent[0], /https:\/\/example\.org\/emotions\//);
  assert.doesNotMatch(calls.sent[0], /invented\.invalid/);
  assert.deepEqual(calls.saved, [true]);
});

test('crisis messages bypass the model and do not enter chat history', async () => {
  const { deps, calls } = fixture();
  await processConsultation({ ...job, text: 'Я хочу покончить с собой' }, deps);
  assert.equal(calls.model, 0);
  assert.deepEqual(calls.saved, [false]);
  assert.match(calls.sent[0], /экстренную службу/);
});

test('/clear affects only the current chat', async () => {
  const { deps, calls } = fixture();
  await processConsultation({ ...job, text: '/clear' }, deps);
  assert.deepEqual(calls.clear, [42]);
  assert.equal(calls.model, 0);
});

test('a delivered run is not sent again', async () => {
  const { deps, calls } = fixture({ status: 'delivered', responseText: 'already sent' });
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivered' });
  assert.equal(calls.sent.length, 0);
});

test('uncertain Telegram delivery is not repeated on task replay', async () => {
  const { deps, calls } = fixture();
  deps.telegram.send = async () => { calls.sent.push('attempt'); throw new Error('network timeout'); };
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivery-uncertain' });
  assert.deepEqual(await processConsultation(job, deps), { status: 'attempted' });
  assert.equal(calls.sent.length, 1);
});

test('failed model call produces one neutral response without history', async () => {
  const { deps, calls } = fixture();
  deps.model.answer = async () => { throw new Error('upstream failure'); };
  await processConsultation(job, deps);
  assert.deepEqual(calls.saved, [false]);
  assert.match(calls.sent[0], /попробуй ещё раз позже/);
});
