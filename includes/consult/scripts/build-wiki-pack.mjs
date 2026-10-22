import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import YAML from 'yaml';

const root = resolve(import.meta.dirname, '../../..');
const docs = join(root, 'src/content/docs');
const quotes = join(root, 'src/content/quotes');
const skillPath = join(root, '.agents/skills/support/SKILL.md');
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

// Quotes listed on a topic page through <QuoteList topic="..."/> are rendered at
// site build time; the wiki pack inlines them so the agent reads the same content a visitor sees.
// The quotes collection also feeds the bot's own quote picker (quotes in the pack).
function quoteCollection() {
  const byTopic = new Map();
  const list = [];
  for (const file of walk(quotes).filter((file) => file.endsWith('.yaml'))) {
    const author = YAML.parse(readFileSync(file, 'utf8'));
    if (!author?.name || !Array.isArray(author.quotes)) throw new Error(`Invalid quotes: ${file}`);
    for (const quote of author.quotes) {
      const line = `**${author.name}**: «${quote.text}» ${quote.context ?? ''} ${quote.reflection ?? ''}`.trim();
      for (const topic of quote.topics ?? []) {
        if (!byTopic.has(topic)) byTopic.set(topic, []);
        byTopic.get(topic).push(line);
      }
      list.push({
        author: author.name,
        text: quote.text,
        context: quote.context ?? '',
        reflection: quote.reflection ?? '',
        topics: quote.topics ?? [],
      });
    }
  }
  return { byTopic, list };
}

function pageBody(raw, path, quotesByTopic) {
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fm) throw new Error(`Missing frontmatter in ${path}`);
  const metadata = YAML.parse(fm[1]);
  if (!metadata?.title || !metadata?.description) throw new Error(`Missing title or description in ${path}`);
  const body = raw.slice(fm[0].length)
    .replace(/^import\s+.+$/gm, ' ')
    .replace(/<QuoteList\s+topic=["']([^"']+)["']\s*\/?>/g, (_, topic) => {
      const lines = quotesByTopic.get(topic) ?? [];
      if (!lines.length) throw new Error(`No quotes for topic ${topic} on ${path}`);
      return lines.map((line) => `- ${line}`).join('\n');
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/## Материалы и источники[\s\S]*$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { metadata, body };
}

const { byTopic: quotesByTopic, list: quoteList } = quoteCollection();
const pages = [];
for (const file of walk(docs).filter((file) => /\.(md|mdx)$/.test(file))) {
  const path = relative(docs, file).replaceAll('\\', '/');
  if (path === 'index.md' || path === 'log.md') continue;
  const { metadata, body } = pageBody(readFileSync(file, 'utf8'), path, quotesByTopic);
  if (!body) throw new Error(`Empty page body: ${path}`);
  pages.push({ path, title: metadata.title, description: metadata.description, url: `${baseUrl}${toRoute(path)}`, content: body });
}
pages.sort((a, b) => a.path.localeCompare(b.path));

const skill = readFileSync(skillPath, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
if (!skill) throw new Error('Support skill is empty');
const pack = { schemaVersion: 1, buildId: hash(JSON.stringify({ baseUrl, skill, quotes: quoteList, pages })).slice(0, 16), createdAt: new Date().toISOString(), baseUrl, skill, quotes: quoteList, pages };
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'wiki-pack.json'), JSON.stringify(pack));
process.stdout.write(`Wiki pack ${pack.buildId}: ${pages.length} pages, ${quoteList.length} quotes, skill ${skill.length} chars\n`);
