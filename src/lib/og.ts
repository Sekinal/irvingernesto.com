import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Build-time Open Graph image generator. Runs only during `astro build` inside
// static endpoints, so it ships zero bytes to the browser: every page just
// gets its own 1200x630 branded share card. On-brand with the dark theme,
// burnt-orange accent, Clash Display heading, JetBrains-style mono labels.

const clash = readFileSync(
  fileURLToPath(new URL('../../scripts/og-assets/ClashDisplay-600.ttf', import.meta.url)),
);
const satoshi = readFileSync(
  fileURLToPath(new URL('../../scripts/og-assets/Satoshi-500.ttf', import.meta.url)),
);

const BG = '#0b0a09';
const FG = '#f0ede5';
const MUTED = '#8f8a7f';
const ACCENT = '#ff4d00';

export interface OgInput {
  eyebrow: string; // mono kicker, e.g. "CASE STUDY / 01"
  title: string;
  subtitle?: string;
  tags?: string[];
}

// Satori consumes a React-element-shaped object tree. We build it by hand to
// avoid pulling JSX into a plain .ts module.
function h(type: string, props: Record<string, unknown>, ...children: unknown[]) {
  // Satori requires an explicit display on every div; default to flex so no
  // node ever trips its "more than one child" guard.
  const style = (props.style as Record<string, unknown>) ?? {};
  const merged = type === 'div' && style.display == null ? { ...style, display: 'flex' } : style;
  const kids = children.filter((c) => c !== null && c !== undefined);
  return {
    type,
    props: { ...props, style: merged, children: kids.length === 1 ? kids[0] : kids },
  };
}

function template({ eyebrow, title, subtitle, tags }: OgInput) {
  return h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: BG,
        padding: '72px',
        fontFamily: 'Satoshi',
        position: 'relative',
      },
    },
    // Accent hairline down the left edge.
    h('div', {
      style: {
        position: 'absolute',
        left: '0px',
        top: '0px',
        bottom: '0px',
        width: '10px',
        background: ACCENT,
      },
    }),
    // Top row: eyebrow + wordmark.
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h(
        'div',
        {
          style: {
            fontFamily: 'JetBrains',
            fontSize: '22px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: MUTED,
          },
        },
        eyebrow,
      ),
      h(
        'div',
        { style: { display: 'flex', fontFamily: 'Clash', fontSize: '30px', color: FG } },
        'ieqr',
        h('span', { style: { color: ACCENT } }, '.'),
      ),
    ),
    // Title block.
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '24px' } },
      h(
        'div',
        {
          style: {
            fontFamily: 'Clash',
            fontSize: title.length > 34 ? '84px' : '104px',
            lineHeight: 1.02,
            color: FG,
            letterSpacing: '-2px',
          },
        },
        title,
      ),
      subtitle
        ? h(
            'div',
            { style: { fontSize: '30px', lineHeight: 1.35, color: MUTED, maxWidth: '900px' } },
            subtitle,
          )
        : null,
    ),
    // Bottom row: tags + name.
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' } },
      h(
        'div',
        { style: { display: 'flex', gap: '12px' } },
        ...(tags ?? []).slice(0, 4).map((t) =>
          h(
            'div',
            {
              style: {
                fontFamily: 'JetBrains',
                fontSize: '18px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: MUTED,
                border: `1px solid #2a2823`,
                borderRadius: '999px',
                padding: '8px 18px',
              },
            },
            t,
          ),
        ),
      ),
      h(
        'div',
        { style: { fontFamily: 'JetBrains', fontSize: '20px', color: MUTED } },
        'Irving Ernesto Quezada Ramírez',
      ),
    ),
  );
}

export async function renderOg(input: OgInput): Promise<Buffer> {
  const svg = await satori(template(input) as never, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Clash', data: clash, weight: 600, style: 'normal' },
      { name: 'Satoshi', data: satoshi, weight: 500, style: 'normal' },
      // Mono labels reuse Satoshi metrics-wise via a distinct family name; the
      // uppercase tracked styling carries the "mono" read well enough at this
      // size without shipping a fourth font buffer.
      { name: 'JetBrains', data: satoshi, weight: 500, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return Buffer.from(png);
}
