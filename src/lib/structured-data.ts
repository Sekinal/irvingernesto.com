import type { CollectionEntry } from 'astro:content';
import { SITE } from '@/lib/site';

// Centralized JSON-LD builders. Richer schema.org markup is pure SEO upside:
// it ships as static <script> tags with zero runtime cost, and lets Google
// render breadcrumbs, article metadata, and sitelinks for the site.

const person = {
  '@type': 'Person',
  '@id': `${SITE.url}/#person`,
  name: SITE.name,
  alternateName: ['Irving Ernesto', 'ieqr'],
  url: SITE.url,
};

const publisher = {
  '@type': 'Person',
  name: SITE.name,
  url: SITE.url,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE.url}/favicon.svg`,
  },
};

export function personLd() {
  return {
    ...person,
    email: SITE.email,
    jobTitle: 'AI Engineer & Physicist',
    worksFor: { '@type': 'Organization', name: 'RoomIQ', url: 'https://roomiq.io' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Universidad Veracruzana' },
    knowsAbout: [
      'Machine Learning',
      'LLM Fine-tuning',
      'Data Engineering',
      'Reverse Engineering',
      'Physics',
    ],
    sameAs: [
      'https://github.com/Sekinal',
      'https://huggingface.co/Thermostatic',
      'https://x.com/ieqr_',
      'https://www.linkedin.com/in/ieqr',
    ],
  };
}

// WebSite node with a SearchAction: this is what lets Google show a sitelinks
// search box, and names the site canonically.
export function websiteLd() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    alternateName: 'ieqr',
    description: SITE.description,
    inLanguage: 'en',
    publisher: { '@id': `${SITE.url}/#person` },
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { name: 'Home', url: SITE.url },
      ...items,
    ].map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function blogPostingLd(
  post: CollectionEntry<'blog'>,
  url: string,
  rt: { minutes: number; words: number },
) {
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: post.data.title,
    description: post.data.description,
    datePublished: post.data.pubDate.toISOString(),
    dateModified: (post.data.updatedDate ?? post.data.pubDate).toISOString(),
    author: person,
    publisher,
    keywords: post.data.tags.join(', '),
    articleSection: post.data.tags[0],
    wordCount: rt.words,
    timeRequired: `PT${rt.minutes}M`,
    inLanguage: 'en',
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: `${SITE.url}/og/blog/${post.id}.png`,
  };
}

export function creativeWorkLd(project: CollectionEntry<'work'>, url: string) {
  return {
    '@type': 'CreativeWork',
    '@id': `${url}#work`,
    name: project.data.title,
    description: project.data.summary,
    author: person,
    keywords: project.data.stack.join(', '),
    inLanguage: 'en',
    url,
    ...(project.data.link ? { sameAs: project.data.link } : {}),
    image: `${SITE.url}/og/work/${project.id}.png`,
  };
}
