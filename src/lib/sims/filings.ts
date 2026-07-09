import { type SimHooks, palette, rgba } from '@/lib/sims/host';

// Iron filings drifting along a pseudo-curl magnetic flow field. The pointer is
// a magnet: a dipole swirl bends the field toward the tangent within 200 px,
// with a mild radial push inside 60 px so filings part around the cursor. This
// is the quietest section sim, so alphas stay very low and it never competes
// with the case-study rows above it.

const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const COUNT = COARSE ? 140 : 320;
const SWIRL_R = 200; // pointer influence radius
const PUSH_R = 60; // radial parting radius
const ACCENT_FRACTION = 0.06;

export function createFilings(canvas: HTMLCanvasElement): SimHooks {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  let w = 0;
  let h = 0;
  let dpr = 1;

  const xs = new Float32Array(COUNT);
  const ys = new Float32Array(COUNT);
  const spd = new Float32Array(COUNT); // per-particle speed, 22..40 px/s
  const isAccent = new Uint8Array(COUNT);

  let px = -1e5;
  let py = -1e5;
  let havePointer = false;

  function seed() {
    for (let i = 0; i < COUNT; i++) {
      xs[i] = Math.random() * (w || 1);
      ys[i] = Math.random() * (h || 1);
      spd[i] = 22 + Math.random() * 18;
      isAccent[i] = Math.random() < ACCENT_FRACTION ? 1 : 0;
    }
  }

  function resize(width: number, height: number, deviceRatio: number) {
    const first = w === 0 && h === 0;
    w = width;
    h = height;
    dpr = deviceRatio;
    if (first) seed();
  }

  // Analytic time-varying pseudo-curl field plus a gentle constant drift.
  function fieldAngle(x: number, y: number, t: number): number {
    return 1.6 * Math.sin(x * 0.006 + 0.35 * t) + 1.6 * Math.cos(y * 0.005 - 0.27 * t) + 0.2;
  }

  function step(dt: number, t: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pal = palette();
    const fgStroke = rgba(pal.fg, 0.07);
    const accentStroke = rgba(pal.accent, 0.12);

    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    // Two passes so we only swap strokeStyle twice per frame.
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? fgStroke : accentStroke;
      ctx.beginPath();
      for (let i = 0; i < COUNT; i++) {
        if (isAccent[i] !== pass) continue;

        let ang = fieldAngle(xs[i], ys[i], t);
        let ux = Math.cos(ang);
        let uy = Math.sin(ang);

        if (havePointer) {
          const rx = xs[i] - px;
          const ry = ys[i] - py;
          const d2 = rx * rx + ry * ry;
          if (d2 < SWIRL_R * SWIRL_R) {
            const d = Math.sqrt(d2) || 1e-4;
            const fall = 1 - d / SWIRL_R; // 1 at center, 0 at edge
            const smooth = fall * fall * (3 - 2 * fall); // smoothstep falloff
            // Tangent (dipole swirl) direction: perpendicular to the radial.
            const tx = -ry / d;
            const ty = rx / d;
            ux += tx * smooth * 1.4;
            uy += ty * smooth * 1.4;
            // Mild radial parting close to the cursor.
            if (d < PUSH_R) {
              const pf = (1 - d / PUSH_R) * 0.8;
              ux += (rx / d) * pf;
              uy += (ry / d) * pf;
            }
            const m = Math.hypot(ux, uy) || 1e-4;
            ux /= m;
            uy /= m;
          }
        }

        const s = spd[i];
        const nx = xs[i] + ux * s * dt;
        const ny = ys[i] + uy * s * dt;
        xs[i] = nx;
        ys[i] = ny;

        // Wrap at edges.
        if (xs[i] < 0) xs[i] += w;
        else if (xs[i] >= w) xs[i] -= w;
        if (ys[i] < 0) ys[i] += h;
        else if (ys[i] >= h) ys[i] -= h;

        // Short streak along velocity, 6..10 px, keyed off speed.
        const len = 6 + (s - 22) * (4 / 18);
        ctx.moveTo(xs[i], ys[i]);
        ctx.lineTo(xs[i] - ux * len, ys[i] - uy * len);
      }
      ctx.stroke();
    }
  }

  function pointerMove(x: number, y: number) {
    px = x;
    py = y;
    havePointer = x >= -SWIRL_R && x <= w + SWIRL_R && y >= -SWIRL_R && y <= h + SWIRL_R;
  }

  return { resize, step, pointerMove };
}
