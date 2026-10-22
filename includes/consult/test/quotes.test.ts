import test from 'node:test';
import assert from 'node:assert/strict';
import { composeQuotes, normalizeText, retrieveQuotes, splitQuotes } from '../src/quotes.js';
import type { PackQuote, WikiPack } from '../src/wiki.js';

const quotes: PackQuote[] = [
  { author: 'Эпиктет', text: 'Не вещи расстраивают нас, а представления о вещах.', context: 'О власти над своими суждениями.', reflection: '', topics: ['thoughts-reality'] },
  { author: 'Марк Аврелий', text: 'Сила наша — в уме, а не в обстоятельствах.', context: '', reflection: 'Что зависит от тебя, а что нет?', topics: ['fate-acceptance'] },
  { author: 'Лев Толстой', text: 'Хочешь быть счастливым — будь им.', context: 'О выборе.', reflection: '', topics: ['freedom-slavery'] },
  { author: 'Иммануил Кант', text: 'Поступай так, чтобы человек был всегда целью, а не средством.', context: '', reflection: '', topics: ['good-deeds-service'] },
  { author: 'Сенека', text: 'Мы страдаем больше в воображении, чем в действительности.', context: 'О страхе.', reflection: '', topics: ['memento-mori'] },
];

const base: WikiPack = { schemaVersion: 1, buildId: 't', createdAt: '', baseUrl: 'https://x', skill: 's', quotes, pages: [] };

test('offline split keeps the answer and parses quote blockquotes', () => {
  const { answer, quotes: found } = splitQuotes(
    'Ответ целиком.\n\n## Мысли великих\n\n> «Не вещи расстраивают нас, а представления о вещах.»\n> — **Эпиктет**\n\n> «Хочешь быть счастливым — будь им.»\n> — **Лев Толстой**',
  );
  assert.equal(answer, 'Ответ целиком.');
  assert.deepEqual(found, [
    { text: 'Не вещи расстраивают нас, а представления о вещах.', author: 'Эпиктет' },
    { text: 'Хочешь быть счастливым — будь им.', author: 'Лев Толстой' },
  ]);
});

test('no quote heading means no quote parsing', () => {
  const { answer, quotes: found } = splitQuotes('> обычная цитата из текста\nи дальше ответ');
  assert.equal(found.length, 0);
  assert.match(answer, /обычная цитата/);
});

test('the model quote section is replaced by a canonical validated block', () => {
  const model = 'Ответ.\n\n## Мысли великих\n\n> «Не вещи расстраивают нас, а представления о вещах.»\n> — **Эпиктет**';
  const { answer, quotes: block } = composeQuotes(base, model, 'как справиться с обидой на человека');
  assert.equal(answer, 'Ответ.');
  assert.match(block!, /^## Мысли великих\n\n> «Не вещи расстраивают нас/);
  assert.match(block!, /> — \*\*Эпиктет\*\*/);
  // topped up to two from the pack by topic stems
  const quotesInBlock = (block!.match(/«/gu) ?? []).length;
  assert.ok(quotesInBlock >= 2 && quotesInBlock <= 4);
});

test('invented quotes are dropped and replaced by retrieval', () => {
  const model = 'Ответ.\n\n## Мысли великих\n\n> «Выдуманная цитата, которой нет в базе знаний вообще и никогда не было.»\n> — **Выдуманный Автор**';
  const { quotes: block } = composeQuotes(base, model, 'вещи представления расстраивают');
  assert.doesNotMatch(block!, /Выдуманн/);
  assert.match(block!, /Эпиктет/);
});

test('retrieval alone fills the section from the conversation', () => {
  const { answer, quotes: block } = composeQuotes(base, 'Обычный ответ.', 'страх воображение страдаем');
  assert.equal(answer, 'Обычный ответ.');
  assert.match(block!, /Сенека/);
  assert.match(block!, /страдаем больше в воображении/);
});

test('an answer with no matching quotes gets no quote section', () => {
  const { quotes: block } = composeQuotes(base, 'Ответ про борщ.', 'борщ свёкла кастрюля');
  assert.equal(block, null);
});

test('retrieval deduplicates and respects the limit', () => {
  const taken = new Set([quotes[0].text]);
  const found = retrieveQuotes(base, 'вещи представления страх счастливым', taken, 4);
  assert.ok(found.length <= 4);
  assert.ok(found.every((quote) => !taken.has(quote.text)));
  assert.ok(found.length >= 1);
});

test('normalizeText clears punctuation and ё', () => {
  assert.equal(normalizeText('«Елки-палки»!'), 'елки палки');
});
