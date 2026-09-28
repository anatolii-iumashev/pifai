import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { QUOTE_TOPICS } from './lib/quote-topics';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { pageThemeObsidianSchema } from 'starlight-theme-obsidian/schema';

const quote = z.object({
  text: z.string().min(1),
  topics: z.array(z.enum(QUOTE_TOPICS)).min(1),
  context: z.string().optional(),
  reflection: z.string().optional(),
  source: z.object({
    work: z.string().optional(),
    via: z.string().optional(),
    url: z.url().optional(),
  }).optional(),
});

export const collections = {
  quoteAuthors: defineCollection({
    loader: glob({ base: './src/content/quotes', pattern: '*.yaml' }),
    schema: z.object({
      name: z.string().min(1),
      fullName: z.string().optional(),
      years: z.string().optional(),
      kind: z.enum(['person', 'scripture', 'tradition']),
      wikiPage: z.string().optional(),
      quotes: z.array(quote).min(1),
    }),
  }),
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({ extend: pageThemeObsidianSchema }),
  }),
};
