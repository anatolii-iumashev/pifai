import { createHash } from 'node:crypto';
import GithubSlugger from 'github-slugger';

export const RAG_SCHEMA_VERSION = 1;
export const RAG_CHUNK_CONFIG = { min: 80, target: 1100, max: 1500, overlap: 150 } as const;

export interface RagChunk {
  id: string;
  kind: 'page' | 'quote';
  pageId: string;
  title: string;
  section: string;
  category: string;
  url: string;
  text: string;
  contentHash: string;
  metadata: { description?: string; references?: string[]; author?: string; topics?: string[]; work?: string };
}

export interface RagPage {
  id: string;
  title?: string;
  description?: string;
  body: string;
  draft?: boolean;
}

export interface RagAuthor {
  id: string;
  name: string;
  fullName?: string;
  quotes: { text: string; topics: string[]; context?: string; reflection?: string; source?: { work?: string; via?: string; url?: string } }[];
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sitePageUrl(site: string, base: string, slug: string): string {
  const siteUrl = new URL(site);
  const prefix = (base === '/' ? siteUrl.pathname : base).replace(/^\/+|\/+$/g, '');
  const route = slug.replace(/(?:^|\/)index$/, '').replace(/^\/+|\/+$/g, '');
  const pathname = `/${[prefix, route].filter(Boolean).join('/')}/`.replace(/\/\/$/, '/');
  return new URL(pathname, siteUrl.origin).href;
}

function plainMarkdown(value: string): string {
  return value
    .replace(/^\s*(?:import|export)\s+[^\n]*(?:\n|$)/gm, '')
    .replace(/<([A-Z][\w.]*)\b[^>]*\/>/gs, '')
    .replace(/<\/?[A-Z][\w.]*\b[^>]*>/gs, '')
    .replace(/<[^>]+>/g, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\*_`~>|#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitLongText(value: string, config = RAG_CHUNK_CONFIG): string[] {
  if (value.length <= config.max) return [value];
  const words = value.split(/\s+/);
  const pieces: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > config.max) throw new Error(`RAG word exceeds max chunk length: ${word.slice(0, 40)}`);
    if (current && current.length + word.length + 1 > config.target) {
      pieces.push(current);
      const overlap = current.slice(-config.overlap);
      current = overlap.replace(/^\S*\s/, '') || overlap;
    }
    current = current ? `${current} ${word}` : word;
  }
  if (current) pieces.push(current);
  return pieces;
}

function sectionPieces(raw: string, config = RAG_CHUNK_CONFIG): string[] {
  const paragraphs = raw.split(/\n\s*\n/).map(plainMarkdown).filter(Boolean);
  const pieces: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    for (const part of splitLongText(paragraph, config)) {
      if (current && current.length + part.length + 1 > config.target) {
        pieces.push(current);
        current = '';
      }
      current = current ? `${current} ${part}` : part;
    }
  }
  if (current) pieces.push(current);
  if (pieces.length > 1 && pieces.at(-1)!.length < config.min) {
    const tail = pieces.pop()!;
    if (pieces.at(-1)!.length + tail.length + 1 <= config.max) pieces[pieces.length - 1] += ` ${tail}`;
    else pieces.push(tail);
  }
  return pieces;
}

function contentHash(title: string, section: string, text: string): string {
  return `sha256:${sha256(`${title}\n${section}\n${text}`)}`;
}

export function buildRagChunks(pages: RagPage[], authors: RagAuthor[], site: string, base: string): RagChunk[] {
  const published = pages.filter((page) => !page.draft && !['index', 'log'].includes(page.id));
  const pageIds = new Set(published.map((page) => page.id.replace(/\/index$/, '')));
  const chunks: RagChunk[] = [];
  for (const page of published.sort((a, b) => a.id.localeCompare(b.id))) {
    if (!page.title?.trim()) throw new Error(`RAG page ${page.id}: missing title`);
    const [body, sources = ''] = page.body.split(/^## Материалы и источники\s*$/m, 2);
    const references = [...sources.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
    const stripped = body.replace(/^\s*(?:import|export)\s+[^\n]*(?:\n|$)/gm, '').replace(/<QuoteList\b[^>]*\/>/gs, '');
    if (!plainMarkdown(stripped)) throw new Error(`RAG page ${page.id}: empty body`);
    const category = page.id.split('/').slice(0, page.id.startsWith('authors/') ? 2 : 1).join('/');
    const slugger = new GithubSlugger();
    const headings = [...stripped.matchAll(/^##\s+(.+)$/gm)];
    const sections = [{ title: '', anchor: '', raw: stripped.slice(0, headings[0]?.index ?? stripped.length) }];
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      sections.push({ title: heading[1].trim(), anchor: slugger.slug(heading[1].trim()), raw: stripped.slice(heading.index! + heading[0].length, headings[i + 1]?.index ?? stripped.length) });
    }
    let pending = '';
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const text = [pending, section.raw].filter(Boolean).join('\n\n');
      pending = '';
      const cleaned = plainMarkdown(text);
      if (cleaned.length < RAG_CHUNK_CONFIG.min && i < sections.length - 1) { pending = text; continue; }
      for (const [part, piece] of sectionPieces(text).entries()) {
        if (piece.length > RAG_CHUNK_CONFIG.max) throw new Error(`RAG page ${page.id}: oversized chunk`);
        chunks.push({
          id: `${page.id}#${section.title || 'intro'}#${part}`,
          kind: 'page', pageId: page.id.replace(/\/index$/, ''), title: page.title,
          section: section.title, category,
          url: sitePageUrl(site, base, page.id) + (section.anchor ? `#${section.anchor}` : ''),
          text: piece, contentHash: contentHash(page.title, section.title, piece),
          metadata: { description: page.description, references },
        });
      }
    }
    if (!chunks.some((chunk) => chunk.pageId === page.id.replace(/\/index$/, ''))) throw new Error(`RAG page ${page.id}: no chunks`);
  }
  for (const author of [...authors].sort((a, b) => a.id.localeCompare(b.id))) {
    author.quotes.forEach((quote, index) => {
      const topic = quote.topics[0];
      const pageId = `quotes/${topic}`;
      if (!pageIds.has(pageId)) throw new Error(`RAG quote ${author.id}/${index + 1}: no published topic page ${pageId}`);
      const text = [quote.text, quote.context, quote.reflection].filter(Boolean).join(' ');
      const title = author.fullName || author.name;
      chunks.push({
        id: `quote:${author.id}:${index + 1}`, kind: 'quote', pageId, title,
        section: 'Цитата', category: 'quotes',
        url: `${sitePageUrl(site, base, pageId)}#${author.id}-${index + 1}`,
        text, contentHash: contentHash(title, 'Цитата', text),
        metadata: { author: title, topics: quote.topics, work: quote.source?.work, references: quote.source?.url ? [quote.source.url] : [] },
      });
    });
  }
  return chunks.sort((a, b) => a.id.localeCompare(b.id));
}
