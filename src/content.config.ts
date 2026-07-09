import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const work = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    role: z.string(),
    year: z.string(),
    order: z.number(),
    link: z.string().url().optional(),
    stack: z.array(z.string()),
    metrics: z.array(z.object({ value: z.string(), label: z.string() })),
    summary: z.string(),
  }),
});

// Plain-language companions to blog posts, keyed by the same id as the post
// they explain. A post with a matching entry here gets a Technical / Plain
// English toggle. Optional label overrides for the toggle chips.
const plain = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/plain' }),
  schema: z.object({
    title: z.string().optional(),
    summary: z.string().optional(),
  }),
});

export const collections = { blog, work, plain };
