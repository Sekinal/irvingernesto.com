import { palette, rgba, type SimHooks } from '@/lib/sims/host';

// 04 Writing background: sheets of paper fluttering down, pointer is wind.
// Flakes tumble as they sway (rotation coupled to sway phase). Horizontal wind
// is an EMA of recent pointer dx that decays toward 0 over about 1.5 s and
// pushes smaller flakes harder.

interface Flake {
  x: number;
  y: number;
  size: number;
  vy: number; // current fall speed
  term: number; // terminal velocity for this flake
  swayPhase: number;
  swaySpeed: number;
  swayAmp: number;
  rot: number;
  accent: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function createPaper(canvas: HTMLCanvasElement): SimHooks {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');

  const coarse = matchMedia('(pointer: coarse)').matches;
  const count = coarse ? 16 : 30;

  let w = 0;
  let h = 0;
  let dpr = 1;

  // Wind: EMA of pointer dx, decays toward 0. Tau about 1.5 s.
  let wind = 0;
  const windDecay = 1.5;

  const flakes: Flake[] = [];

  function spawn(f: Flake, top: boolean) {
    f.size = rand(5, 10);
    f.x = rand(0, w);
    f.y = top ? rand(-40, -10) : rand(0, h);
    f.term = rand(18, 34) * (0.6 + f.size / 20);
    f.vy = f.term * rand(0.4, 0.9);
    f.swayPhase = rand(0, Math.PI * 2);
    f.swaySpeed = rand(0.6, 1.4);
    f.swayAmp = rand(8, 22);
    f.rot = rand(0, Math.PI * 2);
  }

  function build() {
    flakes.length = 0;
    for (let i = 0; i < count; i++) {
      const f: Flake = {
        x: 0,
        y: 0,
        size: 0,
        vy: 0,
        term: 0,
        swayPhase: 0,
        swaySpeed: 0,
        swayAmp: 0,
        rot: 0,
        accent: i < 3,
      };
      spawn(f, false);
      flakes.push(f);
    }
  }

  return {
    resize(width, height, ratio) {
      w = width;
      h = height;
      dpr = ratio;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (flakes.length === 0) build();
    },

    step(dt) {
      // Decay wind toward 0 exponentially.
      wind *= Math.exp(-dt / windDecay);

      const pal = palette();
      const fillCol = rgba(pal.fg, 0.05);
      const strokeCol = rgba(pal.fg, 0.12);
      const accentCol = rgba(pal.accent, 0.2);

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];

        // Ease fall speed toward terminal velocity.
        f.vy += (f.term - f.vy) * Math.min(1, dt * 1.5);
        f.y += f.vy * dt;

        // Sway: horizontal oscillation. Smaller flakes get pushed harder by wind.
        f.swayPhase += f.swaySpeed * dt;
        const sway = Math.cos(f.swayPhase) * f.swayAmp;
        const windPush = wind * (12 / f.size);
        f.x += (sway * dt) + (windPush * dt);

        // Rotation coupled to sway so they tumble as they swing.
        f.rot = f.swayPhase * 0.8 + Math.sin(f.swayPhase) * 0.5;

        // Respawn when leaving bottom or sides.
        if (f.y - f.size > h || f.x < -f.size * 2 || f.x > w + f.size * 2) {
          spawn(f, true);
        }

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.beginPath();
        ctx.rect(-f.size / 2, -f.size / 2, f.size, f.size * 1.3);
        ctx.fillStyle = fillCol;
        ctx.fill();
        ctx.strokeStyle = f.accent ? accentCol : strokeCol;
        ctx.stroke();
        ctx.restore();
      }
    },

    pointerMove(_x, _y, dx) {
      // EMA of dx: fast swipe gusts flakes sideways.
      wind = wind * 0.7 + dx * 0.3;
    },
  };
}
