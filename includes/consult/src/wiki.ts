import pack from '../generated/wiki-pack.json' with { type: 'json' };
import { tokens } from './rag/index.js';

export interface WikiPage {
  path: string;
  title: string;
  description: string;
  url: string;
  content: string;
}

export interface WikiPack {
  schemaVersion: 1;
  buildId: string;
  createdAt: string;
  baseUrl: string;
  skill: string;
  pages: WikiPage[];
}

export { pack as defaultWikiPack };

const MAX_PAGE_CHARS = 12_000;

interface IndexedPage { page: WikiPage; terms: string[]; tf: Map<string, number> }

class PageIndex {
  private readonly docs: IndexedPage[];
  private readonly df = new Map<string, number>();
  private readonly avgLength: number;
  constructor(readonly pages: WikiPage[]) {
    this.docs = pages.map((page) => {
      const terms = tokens(`${page.title} ${page.description} ${page.content}`);
      const tf = new Map<string, number>();
      for (const term of terms) tf.set(term, (tf.get(term) ?? 0) + 1);
      for (const term of tf.keys()) this.df.set(term, (this.df.get(term) ?? 0) + 1);
      return { page, terms, tf };
    });
    this.avgLength = this.docs.reduce((sum, doc) => sum + doc.terms.length, 0) / Math.max(1, this.docs.length);
  }

  search(query: string, previousUser = '', k = 3): { page: WikiPage; score: number }[] {
    const queryTerms = new Set(tokens(query.length < 50 && previousUser ? `${previousUser} ${query}` : query));
    if (!queryTerms.size) return [];
    return this.docs.map((doc) => {
      let score = 0;
      const titleTerms = new Set(tokens(`${doc.page.title} ${doc.page.description}`));
      for (const term of queryTerms) {
        const tf = doc.tf.get(term) ?? 0;
        if (!tf) continue;
        const df = this.df.get(term) ?? 0;
        const idf = Math.log(1 + (this.docs.length - df + 0.5) / (df + 0.5));
        score += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * doc.terms.length / Math.max(1, this.avgLength)));
        if (titleTerms.has(term)) score += idf;
      }
      return { page: doc.page, score };
    }).filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.page.path.localeCompare(b.page.path))
      .slice(0, k);
  }
}

const index = new PageIndex((pack as WikiPack).pages);

export function wikiVersion(): string {
  return pack.buildId;
}

export function wikiIndexText(): string {
  return pack.pages.map((page) => `- ${page.path} — ${page.title}: ${page.description}`).join('\n');
}

export function readPage(path: string, wiki: WikiPack = pack as WikiPack): WikiPage | undefined {
  return wiki.pages.find((page) => page.path === path);
}

export function pageContent(page: WikiPage): string {
  return `# ${page.title} (${page.url})\n\n${page.content.slice(0, MAX_PAGE_CHARS)}`;
}

export function searchPages(query: string, previousUser = '', k = 3): WikiPage[] {
  return index.search(query, previousUser, k).map((entry) => entry.page);
}

export function searchResults(query: string, previousUser = '', k = 3): { path: string; title: string; description: string; url: string }[] {
  return searchPages(query, previousUser, k).map(({ path, title, description, url }) => ({ path, title, description, url }));
}
