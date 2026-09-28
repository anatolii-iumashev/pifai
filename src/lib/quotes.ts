import { getCollection } from 'astro:content';
import type { QuoteTopic } from './quote-topics';

export async function getQuotes(filters: { topic?: QuoteTopic; author?: string } = {}) {
  const authors = await getCollection('quoteAuthors');
  return authors
    .filter((entry) => !filters.author || entry.id === filters.author)
    .flatMap((entry) =>
      entry.data.quotes.map((quote, index) => ({
        id: `${entry.id}/${index + 1}`,
        author: {
          name: entry.data.name,
          fullName: entry.data.fullName,
          years: entry.data.years,
          kind: entry.data.kind,
          wikiPage: entry.data.wikiPage,
        },
        ...quote,
      })),
    )
    .filter((quote) => !filters.topic || quote.topics.includes(filters.topic))
    .sort((a, b) => a.author.name.localeCompare(b.author.name, 'ru') ||
      Number(a.id.split('/').at(-1)) - Number(b.id.split('/').at(-1)));
}
