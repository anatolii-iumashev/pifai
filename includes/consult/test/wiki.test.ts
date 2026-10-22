import test from 'node:test';
import assert from 'node:assert/strict';
import packJson from '../generated/wiki-pack.json' with { type: 'json' };
import { pageContent, readPage, searchPages, wikiIndexText, wikiVersion, type WikiPack } from '../src/wiki.js';

const wiki = packJson as WikiPack;

test('the pack is complete and well-formed', () => {
  assert.equal(wiki.schemaVersion, 1);
  assert.match(wiki.buildId, /^[0-9a-f]{16}$/);
  assert.ok(wiki.skill.includes('Ненасильственное общение'));
  assert.ok(wiki.pages.length >= 30);
  for (const page of wiki.pages) {
    assert.match(page.path, /\.(md|mdx)$/);
    assert.ok(page.title && page.description && page.content && page.url.startsWith(wiki.baseUrl));
    assert.doesNotMatch(page.content, /<QuoteList|^import\s+|## Материалы и источники/);
  }
});

test('page navigation: read by path, content carries the public URL', () => {
  const page = readPage('practices/nvc-4-steps.md', wiki);
  assert.ok(page);
  assert.match(pageContent(page), new RegExp(page.url.replace(/[/.]/g, '\\$&')));
  assert.equal(readPage('no/such-page.md', wiki), undefined);
});

test('the index map lists every page with title and description', () => {
  const map = wikiIndexText();
  assert.equal(map.split('\n').length, wiki.pages.length);
  assert.match(map, /practices\/nvc-4-steps\.md/);
});

test('search returns relevant pages for eval-style questions', () => {
  const cases: { question: string; expected: string; previous?: string }[] = [
    { question: 'Какие четыре компонента ненасильственного общения?', expected: '/authors/rosenberg/4-components/' },
    { question: 'Что Юнг называл Тенью?', expected: '/authors/jung/shadow/' },
    { question: 'Как заземлиться при сильной тревоге?', expected: '/practices/grounding-5-4-3-2-1/' },
    { question: 'А как применить это в разговоре?', previous: 'Какие четыре шага ННО?', expected: '/practices/nvc-4-steps/' },
  ];
  for (const item of cases) {
    const found = searchPages(item.question, item.previous ?? '', 3);
    assert.ok(found.some((page) => page.url.endsWith(item.expected)), `${item.question} → ${found.map((page) => page.path).join(', ')}`);
  }
});

test('wiki version follows the pack build id', () => {
  assert.equal(wikiVersion(), wiki.buildId);
});
