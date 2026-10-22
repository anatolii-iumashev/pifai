import test from 'node:test';
import assert from 'node:assert/strict';
import { AIMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import packJson from '../generated/wiki-pack.json' with { type: 'json' };
import { ackMessage, processConsultation, type Dependencies } from '../src/graph.js';
import type { DialogueStore, HistoryMessage } from '../src/storage.js';
import type { ConsultationJob } from '../src/types.js';
import type { PackQuote, WikiPack } from '../src/wiki.js';

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
  const acks: string[] = [];
  const sends: { text: string; editId?: number }[] = [];
  const telegram = {
    async ack(_chatId: number, text: string) { acks.push(text); return 555; },
    async send(_chatId: number, text: string, editId?: number) { sends.push({ text, editId }); return [99]; },
  };
  const model = fakeModel();
  const deps: Dependencies = {
    store,
    model,
    telegram,
    skill: wiki.skill,
    wiki,
    log: () => {},
  };
  return {
    deps,
    calls,
    acks,
    sends,
    model,
    telegram,
    finalText: () => sends.find((item) => item.editId !== undefined)?.text ?? sends.at(-1)?.text ?? '',
  };
}

test('consults through wiki tools with a thinking ack replaced by the answer', async () => {
  const { deps, model, acks, sends, calls } = fixture();
  model
    .respondWithTools([{ name: 'read_wiki_page', args: { path: 'authors/rosenberg/4-components.md' } }])
    .respond(new AIMessage('ННО — четыре шага: наблюдение, чувство, потребность, просьба. https://invented.invalid/x'));
  const page = wiki.pages.find((item) => item.path === 'authors/rosenberg/4-components.md');
  assert.ok(page);
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivered' });
  assert.equal(model.callCount, 2);
  assert.deepEqual(acks, [ackMessage]);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].editId, 555);
  assert.match(sends[0].text, new RegExp(page.url.replace(/[/.]/g, '\\$&')));
  assert.match(sends[0].text, /Материалы базы знаний/);
  assert.doesNotMatch(sends[0].text, /invented\.invalid/);
  assert.deepEqual(calls.saved, [{ chatId: 42, user: 'Я тревожусь', response: sends[0].text }]);
});

test('model quotes are validated against the pack and topped up by retrieval', async () => {
  const packQuote: PackQuote = { author: 'Эпиктет', text: 'Не вещи расстраивают нас, а представления о вещах.', context: '', reflection: '', topics: [] };
  const localWiki: WikiPack = { ...wiki, quotes: [packQuote] };
  const { deps, model, sends, calls } = fixture();
  deps.wiki = localWiki;
  const invented = 'Придуманная цитата, которой в базе никогда не было и не будет.';
  model
    .respondWithTools([{ name: 'read_wiki_page', args: { path: 'authors/rosenberg/4-components.md' } }])
    .respond(new AIMessage(`Ответ.\n\n## Мысли великих\n\n> «${invented}»\n> — **Никто Нибудь**`));
  const question: ConsultationJob = { ...job, text: 'Я расстраиваюсь из-за вещей и представлений о них' };
  assert.deepEqual(await processConsultation(question, deps), { status: 'delivered' });
  const final = sends.at(-1)!.text;
  const quoteSection = final.slice(final.indexOf('## Мысли великих'), final.indexOf('## Материалы базы знаний'));
  assert.doesNotMatch(quoteSection, new RegExp(invented));
  assert.doesNotMatch(quoteSection, /Никто Нибудь/);
  assert.match(quoteSection, /Эпиктет/);
  assert.match(quoteSection, /«Не вещи расстраивают нас, а представления о вещах\.»/);
  assert.match(final, /## Материалы базы знаний/);
  assert.deepEqual(calls.saved, [{ chatId: 42, user: question.text, response: final }]);
});

test('search_wiki finds pages without attaching sources', async () => {
  const { deps, model, sends, finalText } = fixture();
  model
    .respondWithTools([{ name: 'search_wiki', args: { query: 'работа с тенью Юнг' } }])
    .respond(new AIMessage('Работа с Тенью описана в базе знаний.'));
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivered' });
  assert.equal(model.callCount, 2);
  assert.doesNotMatch(finalText(), /Материалы базы знаний/);
});

test('a question outside the knowledge base finds no pages', async () => {
  const { deps, model, finalText } = fixture();
  model
    .respondWithTools([{ name: 'search_wiki', args: { query: 'приготовить борщ рецепт' } }])
    .respond(new AIMessage('В базе знаний нет подходящего материала. Расскажу о психологии, если хочешь.'));
  assert.deepEqual(await processConsultation({ ...job, text: 'Как приготовить борщ?' }, deps), { status: 'delivered' });
  assert.doesNotMatch(finalText(), /Материалы базы знаний/);
  assert.doesNotMatch(finalText(), /https?:\/\//);
});

test('crisis messages bypass the model, the ack and the history', async () => {
  const { deps, model, acks, sends, finalText, calls } = fixture();
  assert.deepEqual(await processConsultation({ ...job, text: 'Я хочу покончить с собой' }, deps), { status: 'delivered' });
  assert.equal(model.callCount, 0);
  assert.deepEqual(acks, []);
  assert.deepEqual(sends, [{ text: finalText(), editId: undefined }]);
  assert.match(finalText(), /экстренную службу/);
  assert.deepEqual(calls.saved, []);
});

test('/start, /clear and /help answer instantly without the ack', async () => {
  const { deps, calls, acks, sends, model } = fixture();
  assert.deepEqual(await processConsultation({ ...job, text: '/clear' }, deps), { status: 'delivered' });
  assert.deepEqual(calls.clear, [42]);
  assert.equal(model.callCount, 0);
  assert.deepEqual(acks, []);
  assert.equal(sends.length, 1);
  assert.match(sends[0].text, /История этого чата очищена/);
  await processConsultation({ ...job, updateId: 13, text: '/start' }, deps);
  assert.deepEqual(calls.clear, [42, 42]);
  assert.match(sends[1].text, /Привет! Я ПиФ/);
  await processConsultation({ ...job, updateId: 14, text: '/help' }, deps);
  assert.match(sends[2].text, /\/clear — удалить историю/);
});

test('a claimed run is not sent again', async () => {
  const { deps, acks, sends, model } = fixture();
  model.respond(new AIMessage('Первый ответ.'));
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivered' });
  assert.deepEqual(await processConsultation(job, deps), { status: 'already-attempted' });
  assert.equal(sends.length, 1);
  assert.equal(acks.length, 1);
});

test('uncertain delivery is not repeated on replay', async () => {
  const { deps, acks, sends, model, telegram } = fixture();
  model.respond(new AIMessage('Ответ.'));
  telegram.send = async (_chatId: number, _text: string, editId?: number) => {
    sends.push({ text: _text, editId });
    throw new Error('network timeout');
  };
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivery-uncertain' });
  assert.deepEqual(await processConsultation(job, deps), { status: 'already-attempted' });
  assert.equal(acks.length, 1); // only the first run acked
  assert.equal(sends.length, 1);
});

test('a failed model call replaces the ack with the neutral response', async () => {
  const { deps, acks, sends, model, calls } = fixture();
  model.respond(new Error('upstream failure'));
  assert.deepEqual(await processConsultation(job, deps), { status: 'delivered' });
  assert.deepEqual(acks, [ackMessage]);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].editId, 555);
  assert.match(sends[0].text, /попробуй ещё раз позже/iu);
  assert.deepEqual(calls.saved, []);
});

test('an invalid payload aborts without side effects', async () => {
  const { deps, acks, sends, model } = fixture();
  assert.deepEqual(await processConsultation({ schemaVersion: 1 }, deps), { status: 'invalid' });
  assert.equal(model.callCount, 0);
  assert.deepEqual(acks, []);
  assert.deepEqual(sends, []);
});
