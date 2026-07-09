import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOg } from '@/lib/og';

export async function getStaticPaths() {
  const projects = await getCollection('work');
  return projects.map((project) => ({ params: { id: project.id }, props: { project } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { project } = props as { project: import('astro:content').CollectionEntry<'work'> };
  const png = await renderOg({
    eyebrow: `Case study / ${String(project.data.order).padStart(2, '0')}`,
    title: project.data.title,
    subtitle: project.data.tagline,
    tags: project.data.stack,
  });
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
