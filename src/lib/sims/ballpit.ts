import { type SimHooks, palette, rgba } from './host';

// Ballpit background for the Open source section. Verlet integrated circles that
// rain in from above, stack on the floor, and can be flicked with the pointer.
// Kept quieter than the repo cards: hollow strokes at low alpha, only a handful
// of accent fills.

const COARSE = matchMedia('(pointer: coarse)').matches;
const COUNT = COARSE ? 14 : 26;
const FILLED = 5; // first N balls draw as accent fills, the rest hollow
const R_MIN = 6;
const R_MAX = 18;
const GRAVITY = 1100;
const DRAG = 0.998; // velocity retention per step via prev-position scaling
const ITER = 2;
const GRAB_R = 40;
const PUSH_R = 70;
const PUSH_CAP = 900; // max impulse speed injected by a pointer flick, px/s

export function createBallpit(canvas: HTMLCanvasElement): SimHooks {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { resize() {}, step() {} };

  let w = 0;
  let h = 0;
  let dpr = 1;
  let seeded = false;

  const n = COUNT;
  const px = new Float32Array(n); // current position
  const py = new Float32Array(n);
  const ox = new Float32Array(n); // previous position
  const oy = new Float32Array(n);
  const r = new Float32Array(n);

  // Pointer state.
  let pointerX = 0;
  let pointerY = 0;
  let grabbed = -1;
  let dragDX = 0;
  let dragDY = 0;

  function seed() {
    // Stagger the balls above the top edge so they visibly rain down on first
    // reveal. Slight horizontal spread and no initial velocity.
    for (let i = 0; i < n; i++) {
      r[i] = R_MIN + Math.random() * (R_MAX - R_MIN);
      const x = r[i] + Math.random() * Math.max(1, w - 2 * r[i]);
      const y = -r[i] - i * 46 - Math.random() * 30;
      px[i] = x;
      py[i] = y;
      ox[i] = x;
      oy[i] = y;
    }
    seeded = true;
  }

  function resize(width: number, height: number, ratio: number) {
    w = width;
    h = height;
    dpr = ratio;
    if (!seeded && w > 0 && h > 0) seed();
    // Keep balls inside the new width so a resize never traps them off screen.
    for (let i = 0; i < n; i++) {
      if (px[i] > w - r[i]) px[i] = w - r[i];
      if (px[i] < r[i]) px[i] = r[i];
    }
  }

  function solve() {
    // Circle-circle overlap resolution.
    for (let i = 0; i < n; i++) {
      const ri = r[i];
      for (let j = i + 1; j < n; j++) {
        let dx = px[j] - px[i];
        let dy = py[j] - py[i];
        const min = ri + r[j];
        let d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const overlap = (min - d) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        px[i] -= nx * overlap;
        py[i] -= ny * overlap;
        px[j] += nx * overlap;
        py[j] += ny * overlap;
      }
    }
    // Wall and floor constraints, no ceiling. Contacts reflect the previous
    // position a little so collisions keep a touch of bounce instead of dying
    // flat against the boundary.
    for (let i = 0; i < n; i++) {
      const ri = r[i];
      if (px[i] < ri) {
        px[i] = ri;
        ox[i] = px[i] + (px[i] - ox[i]) * 0.4;
      } else if (px[i] > w - ri) {
        px[i] = w - ri;
        ox[i] = px[i] + (px[i] - ox[i]) * 0.4;
      }
      if (py[i] > h - ri) {
        py[i] = h - ri;
        oy[i] = py[i] + (py[i] - oy[i]) * 0.35;
      }
    }
  }

  function step(dt: number, _t: number) {
    if (w === 0 || h === 0) return;
    if (!seeded) seed();

    const g = GRAVITY * dt * dt;
    for (let i = 0; i < n; i++) {
      if (i === grabbed) {
        // Carry the grabbed ball with the pointer. Setting prev from the
        // pointer delta means release flings it at the drag velocity.
        px[i] = pointerX;
        py[i] = pointerY;
        ox[i] = px[i] - dragDX;
        oy[i] = py[i] - dragDY;
        // Decay the remembered delta so holding still releases gently instead
        // of flinging with the last recorded motion.
        dragDX *= 0.8;
        dragDY *= 0.8;
        continue;
      }
      const vx = (px[i] - ox[i]) * DRAG;
      const vy = (py[i] - oy[i]) * DRAG;
      ox[i] = px[i];
      oy[i] = py[i];
      px[i] += vx;
      py[i] += vy + g;
    }

    for (let k = 0; k < ITER; k++) solve();

    draw();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pal = palette();
    const stroke = rgba(pal.fg, 0.16);
    const fill = rgba(pal.accent, 0.4);

    // Hollow balls first.
    ctx.lineWidth = 1;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    for (let i = FILLED; i < n; i++) {
      ctx.moveTo(px[i] + r[i], py[i]);
      ctx.arc(px[i], py[i], r[i], 0, Math.PI * 2);
    }
    ctx.stroke();

    // Accent fills, no stroke.
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < FILLED && i < n; i++) {
      ctx.moveTo(px[i] + r[i], py[i]);
      ctx.arc(px[i], py[i], r[i], 0, Math.PI * 2);
    }
    ctx.fill();
  }

  return {
    resize,
    step,
    pointerMove(x, y, dx, dy) {
      pointerX = x;
      pointerY = y;
      dragDX = dx;
      dragDY = dy;
      if (grabbed >= 0) return;
      // Flick nearby balls proportional to pointer velocity, capped.
      const speed = Math.hypot(dx, dy);
      if (speed < 0.01) return;
      let ix = dx;
      let iy = dy;
      if (speed > PUSH_CAP) {
        const s = PUSH_CAP / speed;
        ix *= s;
        iy *= s;
      }
      for (let i = 0; i < n; i++) {
        const ddx = px[i] - x;
        const ddy = py[i] - y;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 > PUSH_R * PUSH_R) continue;
        const falloff = 1 - Math.sqrt(d2) / PUSH_R;
        // Push by displacing prev position: Verlet reads it as velocity.
        ox[i] -= ix * falloff * 0.5;
        oy[i] -= iy * falloff * 0.5;
      }
    },
    pointerDown(x, y) {
      pointerX = x;
      pointerY = y;
      let best = -1;
      let bestD2 = GRAB_R * GRAB_R;
      for (let i = 0; i < n; i++) {
        const ddx = px[i] - x;
        const ddy = py[i] - y;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = i;
        }
      }
      grabbed = best;
      dragDX = 0;
      dragDY = 0;
    },
    pointerUp() {
      grabbed = -1;
    },
  };
}
