// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';
import tailwindcss from '@tailwindcss/vite';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://irvingernesto.com',
  trailingSlash: 'never',
  integrations: [
    expressiveCode({
      themes: ['github-dark-default', 'github-light'],
      themeCssSelector: (theme) =>
        theme.name === 'github-light' ? '[data-theme="light"]' : '[data-theme="dark"]',
      styleOverrides: {
        borderRadius: '0.75rem',
        borderColor: 'var(--color-line)',
        codeFontFamily: "'JetBrains Mono Variable', monospace",
        codeFontSize: '0.875rem',
        frames: {
          shadowColor: 'transparent',
        },
      },
    }),
    mdx(),
    sitemap(),
  ],
  markdown: {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
