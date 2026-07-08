# irvingernesto.com

Personal site of Irving Ernesto Quezada Ramírez. Static, fast, dual-theme, built with Astro.

## Stack

- **Astro 5** (static output, content collections, `astro:assets` image optimization)
- **Tailwind CSS 4** via the Vite plugin, plus a small hand-rolled design system in `src/styles/global.css`
- **MDX** blog with expressive-code syntax highlighting and KaTeX math
- Self-hosted variable fonts: Clash Display, Satoshi (Fontshare), JetBrains Mono (Fontsource)
- SEO: `astro-seo` meta + Open Graph, JSON-LD (Person / BlogPosting / CreativeWork), sitemap, RSS, robots.txt
- Zero JS frameworks on the client. The only scripts are a ~90-particle canvas field, an IntersectionObserver for scroll reveals, the theme toggle, and the contact form.

## Commands

```sh
pnpm install
pnpm dev        # localhost:4321
pnpm build      # -> dist/
pnpm preview
```

## Content

- `src/content/work/*.md` — case studies (frontmatter: role, year, stack, metrics)
- `src/content/blog/*.{md,mdx}` — posts; MDX can import components from `src/components/mdx/`
- `src/lib/site.ts` — name, socials, stats, experience timeline

## Theme

Dark/light themes are CSS custom properties on `[data-theme]` (`src/styles/global.css`).
The toggle animates with a View Transitions circular reveal from the button. System
preference is the default; the choice persists in `localStorage`. A blocking inline
script in `<head>` prevents theme flash.

## Notes

- Scroll reveals use `mask-image` (not `clip-path`) for heading wipes: Chromium factors
  a target's own clip-path into IntersectionObserver geometry, so a fully-clipped
  element would never trigger its own reveal.
- `prefers-reduced-motion` disables the particle field, marquee, reveals, and the
  theme transition.
- Contact form posts to Web3Forms asynchronously with honeypot spam protection.
