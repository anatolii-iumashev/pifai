import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import YAML from 'yaml';

const root = resolve(import.meta.dirname, '../../..');
const docs = join(root, 'src/content/docs');
const quotes = join(root, 'src/content/quotes');
const output = join(root, 'includes/consult/generated');
const baseUrl = (process.env.KNOWLEDGE_BASE_URL ?? 'https://anatolii-iumashev.github.io/pifai').replace(/\/$/, '');
const hash = (value) => createHash('sha256').update(value).digest('hex');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function toRoute(path) {
  const noExt = path.replace(/\.(md|mdx)$/, '');
  return `/${noExt.replace(/(^|\/)index$/, '').replace(/\/$/, '')}/`.replace('//', '/');
}

function plain(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^import\s+.+$/gm, ' ')
    .replace(/<QuoteList\b[^>]*\/>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\*_`~>|#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function split(text, max = 1000) {
  const result = [];
  for (let i = 0; i < text.length; i += max) {
    const piece = text.slice(i, i + max).trim();
    if (piece) result.push(piece);
  }
  return result;
}

const chunks = [];
const topics = new Map();
for (const file of walk(docs).filter((file) => /\.(md|mdx)$/.test(file))) {
  const path = relative(docs, file).replaceAll('\\', '/');
  if (path === 'index.md' || path === 'log.md') continue;
  const raw = readFileSync(file, 'utf8');
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fm) throw new Error(`Missing frontmatter in ${path}`);
  const metadata = YAML.parse(fm[1]);
  if (!metadata?.title || !metadata?.description) throw new Error(`Missing title or description in ${path}`);
  const body = raw.slice(fm[0].length).replace(/## Материалы и источники[\s\S]*$/, '');
  const topic = body.match(/<QuoteList\s+topic=["']([^"']+)["']/)?.[1];
  if (topic) topics.set(topic, toRoute(path));
  const url = `${baseUrl}${toRoute(path)}`;
  for (const [sectionIndex, section] of body.split(/(?=^## )/m).entries()) {
    const title = section.match(/^##\s+(.+)$/m)?.[1] ?? '';
    split(plain(section)).forEach((text, chunkIndex) => chunks.push({
      id: `${path}#${sectionIndex}-${chunkIndex}`,
      title: metadata.title,
      section: title,
      url,
      text,
      contentHash: hash(text),
    }));
  }
}

for (const file of walk(quotes).filter((file) => file.endsWith('.yaml'))) {
  const authorId = file.split('/').at(-1).replace(/\.yaml$/, '');
  const author = YAML.parse(readFileSync(file, 'utf8'));
  if (!author?.name || !Array.isArray(author.quotes)) throw new Error(`Invalid quotes: ${authorId}`);
  author.quotes.forEach((quote, index) => {
    const topic = quote.topics?.find((item) => topics.has(item));
    if (!topic) throw new Error(`No published topic for ${authorId} quote ${index + 1}`);
    const text = `${author.name}: «${quote.text}» ${quote.context ?? ''} ${quote.reflection ?? ''}`.trim();
    chunks.push({
      id: `quote:${authorId}:${index + 1}`,
      title: author.name,
      section: 'Цитата',
      url: `${baseUrl}${topics.get(topic)}#${authorId}-${index + 1}`,
      text,
      contentHash: hash(text),
    });
  });
}

chunks.sort((a, b) => a.id.localeCompare(b.id));
const buildId = hash(JSON.stringify({ baseUrl, chunks })).slice(0, 16);
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'knowledge.json'), JSON.stringify({ buildId, baseUrl, chunks }));
process.stdout.write(`Knowledge ${buildId}: ${chunks.length} chunks\n`);
