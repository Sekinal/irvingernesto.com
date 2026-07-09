import type { CollectionEntry } from 'astro:content';

export interface ReadStat {
  minutes: number;
  words: number;
  label: string;
}

// Reading time from a raw markdown body: no runtime cost, no remark plugin, no
// extra dependency. Strips code fences, frontmatter, and markdown syntax so the
// count reflects prose, then estimates at 200 wpm (technical reading).
export function readingTimeFor(raw: string): ReadStat {
  const prose = raw
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images, keep label
    .replace(/[#>*_~|-]/g, ' '); // markdown punctuation
  const words = prose.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return { minutes, words, label: `${minutes} min read` };
}

export function readingTime(entry: CollectionEntry<'blog'>): ReadStat {
  return readingTimeFor(entry.body ?? '');
}
