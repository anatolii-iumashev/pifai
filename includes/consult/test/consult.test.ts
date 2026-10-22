import test from 'node:test';
import assert from 'node:assert/strict';
import { AIMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import packJson from '../generated/wiki-pack.json' with { type: 'json' };
import { processConsultation, type Dependencies } from '../src/graph.js';
import type { DialogueStore, HistoryMessage } from '../src/storage.js';
import type { ConsultationJob } from '../src/types.js';
import type { WikiPack } from '../src/wiki.js';

const wiki = packJson as WikiPack;

const job: ConsultationJob = { schemaVersion: 1, updateId: 12, chatId: 42, messageId: 7, userId: 42, text: 'Я тревожусь', receivedAt: '2026-10-22T00:00:00Z' };

function storeFixture() {
  const calls = { clear: [] as number[], saved: [] as { chatId: number; user: string; response: string }[], history: [] as HistoryMessage[] };
  const claimed = new Set<number>();
  const store: DialogueStore = {
    async history() { return calls.history; },
    async saveHistory(chatId, user, response) { calls.saved.push({ chatId, user, response }); },
    async clear(chatId) { calls.clear.push(chatId); },
    async claimDelivery(updateId) {
      if (claimed.has(updateId)) return false;
      claimed.add(updateId);
      return true;
    },
  };
  return { store, calls };
}

function fixture() {
  const { store, calls } = storeFixture();
  const sent: string[] = [];
  const model = fakeModel();
  const deps: Dependencies = {
    store,
    model,
    telegram: { async send(_chatId: number, text: string) { sent.push(text); return [99]; } },
    skill: wiki.skill,
    wiki,
    log: () => {},
  };
  return { deps, calls, sent, model };
}

test('consults through wiki tools and appends only verified sources', async () => {
  const { deps, sent, model, calls } = fixture();
  model
    .respondWithTools([{ name: 'read_wiki_page', args: { path: 'authors/rosenberg/4-components.md' } }])
    .respond(new AIMessage('ННО — четыре шага: наблюдение, чувство, потребность, просьба. https://invented.invalid/x'));
  const page = wiki.pages.find((item) => item.path === 'authors/rosenberg/4-components.md');
  assert.ok(page);
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivered' });
  assert.equal(model.callCount, 2);
  assert.match(sent[0], new RegExp(page.url.replace(/[/.]/g, '\\$&')));
  assert.match(sent[0], /Материалы базы знаний/);
  assert.doesNotMatch(sent[0], /invented\.invalid/);
  assert.deepEqual(calls.saved, [{ chatId: 42, user: 'Я тревожусь', response: sent[0] }]);
});

test('search_wiki finds pages without attaching sources', async () => {
  const { deps, sent, model } = fixture();
  model
    .respondWithTools([{ name: 'search_wiki', args: { query: 'работа с тенью Юнг' } }])
    .respond(new AIMessage('Работа с Тенью описана в базе знаний.'));
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivered' });
  assert.equal(model.callCount, 2);
  assert.doesNotMatch(sent[0], /Материалы базы знаний/);
});

test('a question outside the knowledge base finds no pages', async () => {
  const { deps, sent, model } = fixture();
  model
    .respondWithTools([{ name: 'search_wiki', args: { query: 'приготовить борщ рецепт' } }])
    .respond(new AIMessage('В базе знаний нет подходящего материала. Расскажу о психологии, если хочешь.'));
  assert.deepEqual(await processConsultation({ ...job, text: 'Как приготовить борщ?' }, deps), { status: 'delivered' });
  assert.doesNotMatch(sent[0], /Материалы базы знаний/);
  assert.doesNotMatch(sent[0], /https?:\/\//);
});

test('crisis messages bypass the model and do not enter history', async () => {
  const { deps, sent, model, calls } = fixture();
  assert.deepEqual(await processConsultation({ ...job, text: 'Я хочу покончить с собой' }, deps), { status: 'delivered' });
  assert.equal(model.callCount, 0);
  assert.match(sent[0], /экстренную службу/);
  assert.deepEqual(calls.saved, []);
});

test('/start and /clear reset only the current chat', async () => {
  const { deps, calls, sent, model } = fixture();
  assert.deepEqual(await processConsultation({ ...job, text: '/clear' }, deps), { status: 'delivered' });
  assert.deepEqual(calls.clear, [42]);
  assert.equal(model.callCount, 0);
  assert.match(sent[0], /История этого чата очищена/);
  await processConsultation({ ...job, updateId: 13, text: '/start' }, deps);
  assert.deepEqual(calls.clear, [42, 42]);
  assert.match(sent[1], /Привет! Я ПиФ/);
});

test('/help answers without the model or wiki', async () => {
  const { deps, sent, model } = fixture();
  assert.deepEqual(await processConsultation({ ...job, updateId: 14, text: '/help' }, deps), { status: 'delivered' });
  assert.equal(model.callCount, 0);
  assert.match(sent[0], /\/clear — удалить историю/);
});

test('a claimed run is not sent again', async () => {
  const { deps, sent, model } = fixture();
  model.respond(new AIMessage('Первый ответ.'));
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivered' });
  assert.deepEqual(await processConsultation(job, deps), { status: 'already-attempted' });
  assert.equal(sent.length, 1);
});

test('uncertain delivery is not repeated on replay', async () => {
  const { deps, sent, model } = fixture();
  model.respond(new AIMessage('Ответ.'));
  deps.telegram.send = async () => { sent.push('attempt'); throw new Error('network timeout'); };
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivery-uncertain' });
  assert.deepEqual(await processConsultation(job, deps), { status: 'already-attempted' });
  assert.equal(sent.length, 1);
});

test('a failed model call produces one neutral response without history', async () => {
  const { deps, sent, calls, model } = fixture();
  model.respond(new Error('upstream failure'));
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivered' });
  assert.match(sent[0], /попробуй ещё раз позже/iu);
  assert.deepEqual(calls.saved, []);
});

test('an invalid payload aborts without side effects', async () => {
  const { deps, sent, model } = fixture();
  assert.deepEqual(await processConsultation({ schemaVersion: 1 }, deps), { status: 'invalid' });
  assert.equal(model.callCount, 0);
  assert.deepEqual(sent, []);
});
