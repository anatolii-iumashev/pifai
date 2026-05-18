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

// === MAIN ===

console.log('📚 Сборка базы знаний ПиФ...');
console.log(`📁 Директория: ${DOCS_DIR}`);

const pages = collectPages(DOCS_DIR, DOCS_DIR);
console.log(`📄 Найдено страниц: ${pages.length}`);

const knowledgeBase = buildKnowledgeBase(pages);
const totalTokens = estimateTokens(knowledgeBase);

console.log(`📏 Размер KB: ${knowledgeBase.length} символов, ~${totalTokens} токенов`);

if (totalTokens > 100000) {
  console.warn('⚠️  KB превышает 100K токенов! Возможно, потребуется сокращение.');
}

// Генерируем TS-файл
const output = `/**
 * knowledge.ts — База знаний ПиФ
 *
 * ⚠️ АВТОМАТИЧЕСКИ СГЕНЕРИРОВАН. Не редактировать вручную.
 * Сгенерирован: ${new Date().toISOString()}
 * Страниц: ${pages.length}
 * Токенов: ~${totalTokens}
 */

export const KNOWLEDGE_BASE = \`${knowledgeBase.replace(/`/g, '\\`')}\`;

export const KNOWLEDGE_METADATA = {
  version: process.env.KNOWLEDGE_VERSION || '1.0.0',
  totalPages: ${pages.length},
  totalTokens: ${totalTokens},
  generatedAt: '${new Date().toISOString()}',
};
`;

writeFileSync(OUTPUT_FILE, output, 'utf-8');
console.log(`✅ KB сгенерирован: ${OUTPUT_FILE}`);
console.log('🎉 Готово!');
