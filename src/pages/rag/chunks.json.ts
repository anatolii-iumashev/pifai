import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildRagChunks } from '../../lib/rag';

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('RAG build requires Astro site URL');
  const [docs, quoteAuthors] = await Promise.all([getCollection('docs'), getCollection('quoteAuthors')]);
  const chunks = buildRagChunks(
    docs.map((entry) => ({ id: entry.id, title: entry.data.title, description: entry.data.description, body: entry.body ?? '', draft: entry.data.draft })),
    quoteAuthors.map((entry) => ({ id: entry.id, name: entry.data.name, fullName: entry.data.fullName, quotes: entry.data.quotes })),
    site.href,
    import.meta.env.BASE_URL,
  );
  return new Response(JSON.stringify(chunks), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
