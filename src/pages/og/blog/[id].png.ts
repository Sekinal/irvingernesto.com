import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOg } from '@/lib/og';

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { id: post.id }, props: { post } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: import('astro:content').CollectionEntry<'blog'> };
  const png = await renderOg({
    eyebrow: 'Writing',
    title: post.data.title,
    subtitle: post.data.description,
    tags: post.data.tags,
  });
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
