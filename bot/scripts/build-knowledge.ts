/**
 * build-knowledge.ts — Скрипт сборки базы знаний
 *
 * Собирает все .md файлы из ../src/content/docs/ в единую KB_STRING
 * и генерирует src/knowledge.ts с актуальным содержимым.
 *
 * Запуск: bun run scripts/build-knowledge.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = resolve(__dirname, '../../src/content/docs');
const OUTPUT_FILE = resolve(__dirname, '../src/knowledge.ts');

interface WikiPage {
  path: string;
  title: string;
  content: string;
  size: number;
}

interface WikiChunk {
  id: string;
  title: string;
  sourcePath: string;
  section: string;
  text: string;
  keywords: string[];
}

function collectPages(dir: string, baseDir: string): WikiPage[] {
  const pages: WikiPage[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      pages.push(...collectPages(fullPath, baseDir));
    } else if (entry.name.endsWith('.md') && entry.name !== 'index.md' && entry.name !== 'log.md') {
      const content = readFileSync(fullPath, 'utf-8');
      const relPath = relative(baseDir, fullPath);

      // Извлекаем title из frontmatter
      const titleMatch = content.match(/^---\s*\n\s*title:\s*"([^"]+)"\s*\n/m);
      const title = titleMatch ? titleMatch[1] : relPath;

      // Убираем frontmatter
      const cleanContent = content.replace(/^---[\s\S]*?---\s*\n/, '').trim();

      pages.push({
        path: relPath,
        title,
        content: cleanContent,
        size: cleanContent.length,
      });
    }
  }

  return pages;
}

function buildKnowledgeBase(pages: WikiPage[]): string {
  const sections = new Map<string, WikiPage[]>();

  for (const page of pages) {
    const section = page.path.split('/')[0];
    if (!sections.has(section)) {
      sections.set(section, []);
    }
    sections.get(section)!.push(page);
  }

  let kb = '# База знаний ПиФ (Психология и Философия)\n\n';

  for (const [section, sectionPages] of sections) {
    const sectionTitle = section.charAt(0).toUpperCase() + section.slice(1);
    kb += `## Раздел: ${sectionTitle}\n\n`;

    for (const page of sectionPages) {
      kb += `### ${page.title}\n\n`;
      kb += `${page.content}\n\n`;
    }
  }

  return kb;
}

function estimateTokens(text: string): number {
  const russianChars = (text.match(/[а-яёА-ЯЁ]/g) || []).length;
  const otherChars = text.length - russianChars;
  return Math.ceil(russianChars / 2 + otherChars / 4);
}

// Стоп-слова для токенизации
const STOPWORDS = new Set([
  'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то',
  'все', 'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за',
  'бы', 'по', 'из', 'об', 'от', 'этот', 'эта', 'эти', 'о', 'для', 'или',
  'уже', 'нет', 'если', 'когда', 'тебя', 'меня', 'его', 'её', 'их', 'нас',
  'вас', 'себя', 'кто', 'что', 'том', 'тем', 'там', 'тут', 'здесь',
  'весь', 'сам', 'сама', 'сами', 'само', 'самом', 'самой', 'самих',
  'может', 'можно', 'нужно', 'надо', 'чтобы', 'также', 'потому', 'поэтому',
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'it', 'its', 'this', 'that', 'these', 'those', 'not', 'no',
]);

function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[а-яёa-z]+/gi) || [];
  return [...new Set(words.filter(w => w.length > 2 && !STOPWORDS.has(w)))];
}

/**
 * Разбивает содержимое страницы на секции (по ## heading).
 * Каждая секция становится отдельным WikiChunk для поиска.
 */
function chunkPage(page: WikiPage): WikiChunk[] {
  const chunks: WikiChunk[] = [];

  // Убираем секцию "Материалы и источники" — она не нужна для поиска
  const body = page.content.replace(/## Материалы и источники[\s\S]*$/, '').trim();

  // Разбиваем по ## заголовкам
  const sections = body.split(/(?=^## )/m);

  for (const section of sections) {
    const headerMatch = section.match(/^## (.+)$/m);
    const sectionName = headerMatch ? headerMatch[1].trim() : '';

    // Убираем сам заголовок из текста
    const text = section.replace(/^## .+\n*/m, '').trim();
    if (!text || text.length < 20) continue;

    const keywords = tokenize(`${page.title} ${sectionName} ${text.slice(0, 500)}`);

    chunks.push({
      id: `${page.path}#${sectionName}`,
      title: page.title,
      sourcePath: page.path,
      section: sectionName,
      text,
      keywords,
    });
  }

  return chunks;
}

// === MAIN ===

console.log('📚 Сборка базы знаний ПиФ...');
console.log(`📁 Директория: ${DOCS_DIR}`);

const pages = collectPages(DOCS_DIR, DOCS_DIR);
console.log(`📄 Найдено страниц: ${pages.length}`);

// Плоская KB для system prompt
const knowledgeBase = buildKnowledgeBase(pages);
const totalTokens = estimateTokens(knowledgeBase);

console.log(`📏 Размер KB: ${knowledgeBase.length} символов, ~${totalTokens} токенов`);

if (totalTokens > 100000) {
  console.warn('⚠️  KB превышает 100K токенов! Возможно, потребуется сокращение.');
}

// Чанки для RAG-поиска
const allChunks: WikiChunk[] = [];
for (const page of pages) {
  const pageChunks = chunkPage(page);
  allChunks.push(...pageChunks);
}
console.log(`🔍 Сгенерировано чанков: ${allChunks.length}`);

// Генерируем TS-файл
const genDate = new Date().toISOString();
const chunksJSON = JSON.stringify(allChunks, null, 2)
  .replace(/\\`/g, '\\\\`') // экранируем обратные кавычки внутри JSON
  .replace(/`/g, '\\`');    // экранируем обратные кавычки

const output = `/**
 * knowledge.ts — База знаний ПиФ
 *
 * ⚠️ АВТОМАТИЧЕСКИ СГЕНЕРИРОВАН. Не редактировать вручную.
 * Сгенерирован: ${genDate}
 * Страниц: ${pages.length}
 * Токенов: ~${totalTokens}
 * Чанков: ${allChunks.length}
 */

import type { WikiChunk } from './retriever';

export const KNOWLEDGE_BASE = \`${knowledgeBase.replace(/`/g, '\\`')}\`;

export const KNOWLEDGE_METADATA = {
  version: '1.0.0',
  totalPages: ${pages.length},
  totalTokens: ${totalTokens},
  chunkCount: ${allChunks.length},
  generatedAt: '${genDate}',
};

/**
 * KNOWLEDGE_CHUNKS — индекс для RAG-поиска.
 * Каждый чанк = секция статьи с предвычисленными ключевыми словами.
 */
export const KNOWLEDGE_CHUNKS: WikiChunk[] = ${JSON.stringify(allChunks, null, 2)};
`;

writeFileSync(OUTPUT_FILE, output, 'utf-8');
console.log(`✅ KB сгенерирован: ${OUTPUT_FILE}`);
console.log('🎉 Готово!');
