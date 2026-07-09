import rss from '@astrojs/rss';
import { getCollection, render } from 'astro:content';
import { SITE } from '@/lib/site';
import sanitizeHtml from 'sanitize-html';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { getContainerRenderer as mdxRenderer } from '@astrojs/mdx';

// Full-content RSS: renders each post to HTML at build and inlines it, so feed
// readers get the whole article, not just a blurb. Better for syndication and
// discovery. Still fully static, generated at build time only. The MDX
// renderer is loaded explicitly so posts using MDX components still render.
export async function GET(context) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  const renderers = await loadRenderers([mdxRenderer()]);
  const container = await AstroContainer.create({ renderers });

  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      const html = await container.renderToString(Content);
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: `/blog/${post.id}`,
        categories: post.data.tags,
        content: sanitizeHtml(html, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption']),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ['src', 'alt', 'width', 'height'],
          },
        }),
      };
    })
  );

  return rss({
    title: `${SITE.shortName} · Writing`,
    description: SITE.description,
    site: context.site,
    items,
    customData: '<language>en-us</language>',
  });
}
