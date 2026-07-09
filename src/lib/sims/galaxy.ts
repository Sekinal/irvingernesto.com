// Barnes-Hut N-body galaxy for the About section background. All body state and
// the quadtree live in preallocated typed arrays, rebuilt each frame by resetting
// counters. Zero per-frame object allocation in the hot loops. Leapfrog
// kick-drift-kick with a fixed 1/60 s substep. Rendering uses a destination-out
// fade so the canvas stays transparent and the section text stays legible.

import type { SimHooks } from './host';
import { palette, rgba } from './host';

const THETA = 0.7;
const THETA2 = THETA * THETA;
const EPS = 4; // Plummer softening, px
const EPS2 = EPS * EPS;
const SUBSTEP = 1 / 60;
const MAX_SUBSTEPS = 2;

// Central point mass holds this fraction of the total mass.
const CORE_FRACTION = 0.6;

export function createGalaxy(canvas: HTMLCanvasElement): SimHooks {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Should not happen for a plain 2d canvas, but keep the contract honest.
    return {
      resize() {},
      step() {},
    };
  }

  const coarse = matchMedia('(pointer: coarse)').matches;
  let n = coarse ? 1200 : 4000;
  const cap = n; // arrays sized to the initial N, degradation only shrinks n.

  const px = new Float32Array(cap);
  const py = new Float32Array(cap);
  const vx = new Float32Array(cap);
  const vy = new Float32Array(cap);
  const mass = new Float32Array(cap);
  // Per-body color bucket: 0 fg, 1 accentSoft, 2 accent.
  const bucket = new Uint8Array(cap);

  // Quadtree pooled in flat arrays. Children are allocated lazily, so a fully
  // built tree uses under ~2*N nodes. Budget generously for clustering.
  const MAX_NODES = cap * 3 + 64;
  const nCx = new Float32Array(MAX_NODES); // node center x
  const nCy = new Float32Array(MAX_NODES); // node center y
  const nHalf = new Float32Array(MAX_NODES); // node half size
  const nMass = new Float32Array(MAX_NODES);
  const nComX = new Float32Array(MAX_NODES); // center of mass x
  const nComY = new Float32Array(MAX_NODES);
  const nBody = new Int32Array(MAX_NODES); // body index if a leaf holds one body, else -1
  const nInternal = new Uint8Array(MAX_NODES); // 1 once a node has been split
  // Four child node indices per node, -1 when absent.
  const nChild = new Int32Array(MAX_NODES * 4);
  let nodeCount = 0;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let coreMass = 0;
  let diskR = 0;
  let G = 1;

  // Pointer gravity well state.
  let pointerX = 0;
  let pointerY = 0;
  let pointerIn = false;
  let pointerDown = false;

  // Center-of-mass tracker for the central glow.
  let comX = 0;
  let comY = 0;

  // Frame-time EMA driven degradation.
  let ema = 16;
  let slowFrames = 0;
  let degraded = false;

  function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  // The dense core must not hide under the opaque portrait or the stat cards:
  // anchor it in the left text column on wide layouts, and below the stacked
  // photo on narrow ones.
  function anchorX(): number {
    return w < 768 ? w * 0.5 : w * 0.33;
  }
  function anchorY(): number {
    return w < 768 ? h * 0.7 : h * 0.42;
  }

  function seed() {
    cx = anchorX();
    cy = anchorY();
    diskR = 0.35 * Math.min(w, h);

    // Total mass normalized to 1. Core holds CORE_FRACTION, disk bodies share
    // the rest evenly. Each disk body mass is small relative to the core.
    const total = 1;
    coreMass = total * CORE_FRACTION;
    const diskMass = total - coreMass;
    const bodyMass = diskMass / n;

    // Tune G so a body at r = diskR orbits in ~30 s. For a near-Keplerian core,
    // v = sqrt(G * Menc / r) and T = 2*pi*r / v, so
    // G = (2*pi*r / T)^2 * r / Menc. Use the enclosed mass at diskR.
    const targetT = 30;
    const vTarget = (2 * Math.PI * diskR) / targetT;
    const mEncAtR = coreMass + diskMass; // essentially all mass inside diskR
    G = (vTarget * vTarget * diskR) / mEncAtR;

    for (let i = 0; i < cap; i++) {
      // Exponential disk: sample radius via inverse-CDF-ish exponential, scale
      // length ~ diskR * 0.45 so most bodies sit inside diskR with a tail out.
      const scale = diskR * 0.45;
      let r = -scale * Math.log(1 - Math.random() * 0.98);
      if (r < diskR * 0.04) r = diskR * 0.04;
      const a = Math.random() * Math.PI * 2;

      // Slight ellipticity so arms shear out over the first minute.
      const ell = 1.18;
      const ex = Math.cos(a) * r * ell;
      const ey = Math.sin(a) * r;
      px[i] = cx + ex;
      py[i] = cy + ey;
      mass[i] = bodyMass;

      // Enclosed mass at this radius: core plus the disk fraction inside r
      // (exponential CDF), for a near-circular speed.
      const encFrac = 1 - Math.exp(-r / scale);
      const mEnc = coreMass + diskMass * encFrac;
      const vc = Math.sqrt((G * mEnc) / (r + EPS));

      // Tangential direction (perpendicular to radius), one rotation sense.
      const tx = -Math.sin(a);
      const ty = Math.cos(a);
      const noise = 1 + rand(-0.12, 0.12);
      vx[i] = tx * vc * noise;
      vy[i] = ty * vc * noise;

      // Color buckets: 84% fg, 12% accentSoft, 4% accent.
      const b = Math.random();
      bucket[i] = b < 0.84 ? 0 : b < 0.96 ? 1 : 2;
    }
  }

  function respawn(i: number) {
    const scale = diskR * 0.45;
    let r = -scale * Math.log(1 - Math.random() * 0.98);
    if (r < diskR * 0.04) r = diskR * 0.04;
    const a = Math.random() * Math.PI * 2;
    px[i] = cx + Math.cos(a) * r * 1.18;
    py[i] = cy + Math.sin(a) * r;
    const diskMass = 1 - coreMass;
    const encFrac = 1 - Math.exp(-r / scale);
    const mEnc = coreMass + diskMass * encFrac;
    const vc = Math.sqrt((G * mEnc) / (r + EPS));
    const tx = -Math.sin(a);
    const ty = Math.cos(a);
    const noise = 1 + rand(-0.12, 0.12);
    vx[i] = tx * vc * noise;
    vy[i] = ty * vc * noise;
  }

  // Build a fresh quadtree over the active bodies. Returns the root index or -1.
  function buildTree(): number {
    nodeCount = 0;
    // Bounding box over active bodies, made square and centered.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      if (px[i] < minX) minX = px[i];
      if (py[i] < minY) minY = py[i];
      if (px[i] > maxX) maxX = px[i];
      if (py[i] > maxY) maxY = py[i];
    }
    if (!isFinite(minX)) return -1;
    const bx = (minX + maxX) * 0.5;
    const by = (minY + maxY) * 0.5;
    const half = Math.max(maxX - minX, maxY - minY) * 0.5 + 1;

    const root = newNode(bx, by, half);
    for (let i = 0; i < n; i++) insertBody(root, i);
    computeMass(root);
    return root;
  }

  function newNode(centerX: number, centerY: number, half: number): number {
    // Pool is sized for ~2*N nodes; return -1 on the rare overflow so callers
    // can drop a body from the tree this frame instead of corrupting the pool.
    if (nodeCount >= MAX_NODES) return -1;
    const idx = nodeCount++;
    nCx[idx] = centerX;
    nCy[idx] = centerY;
    nHalf[idx] = half;
    nMass[idx] = 0;
    nComX[idx] = 0;
    nComY[idx] = 0;
    nBody[idx] = -1;
    nInternal[idx] = 0;
    const c = idx * 4;
    nChild[c] = -1;
    nChild[c + 1] = -1;
    nChild[c + 2] = -1;
    nChild[c + 3] = -1;
    return idx;
  }

  function quadrant(node: number, x: number, y: number): number {
    // 0 NW, 1 NE, 2 SW, 3 SE relative to node center.
    const east = x >= nCx[node] ? 1 : 0;
    const south = y >= nCy[node] ? 2 : 0;
    return east + south;
  }

  function childCenterX(node: number, q: number): number {
    const off = nHalf[node] * 0.5;
    return q & 1 ? nCx[node] + off : nCx[node] - off;
  }

  function childCenterY(node: number, q: number): number {
    const off = nHalf[node] * 0.5;
    return q & 2 ? nCy[node] + off : nCy[node] - off;
  }

  function insertBody(node: number, i: number) {
    // Iterative descent to avoid deep recursion on clustered bodies. Children
    // are allocated lazily, so only visited quadrants consume node slots.
    let cur = node;
    while (true) {
      if (nInternal[cur]) {
        // Internal node: descend into the child for i, allocating it if absent.
        const q = quadrant(cur, px[i], py[i]);
        let ch = nChild[cur * 4 + q];
        if (ch === -1) {
          ch = newNode(childCenterX(cur, q), childCenterY(cur, q), nHalf[cur] * 0.5);
          if (ch === -1) return; // pool full: drop this body from the tree
          nChild[cur * 4 + q] = ch;
        }
        cur = ch;
        continue;
      }

      const existing = nBody[cur];
      if (existing === -1) {
        // Empty leaf: place the body here.
        nBody[cur] = i;
        return;
      }

      // Occupied leaf: split into an internal node, push the existing body down,
      // then loop again to place i. Guard degenerate coincident points.
      if (nHalf[cur] < 0.05) {
        // Points effectively coincident: nudge i so gravity stays finite. The
        // Plummer softening absorbs the rest and prevents runaway forces.
        px[i] += (Math.random() - 0.5) * 0.05;
        py[i] += (Math.random() - 0.5) * 0.05;
      }
      const qe = quadrant(cur, px[existing], py[existing]);
      const ce = newNode(childCenterX(cur, qe), childCenterY(cur, qe), nHalf[cur] * 0.5);
      if (ce === -1) return; // pool full: leave cur as a single-body leaf, drop i
      nInternal[cur] = 1;
      nBody[cur] = -1;
      nChild[cur * 4 + qe] = ce;
      nBody[ce] = existing;
      // Loop: cur is now internal, i descends on the next iteration.
    }
  }

  function computeMass(_root: number) {
    // Post-order mass and center-of-mass accumulation without recursion. Every
    // child is allocated after its parent, so a single reverse walk over the
    // creation-ordered pool aggregates leaves into parents correctly.
    for (let node = nodeCount - 1; node >= 0; node--) {
      const b = nBody[node];
      if (!nInternal[node]) {
        if (b !== -1) {
          nMass[node] = mass[b];
          nComX[node] = px[b];
          nComY[node] = py[b];
        } else {
          nMass[node] = 0;
          nComX[node] = nCx[node];
          nComY[node] = nCy[node];
        }
        continue;
      }
      let m = 0;
      let sx = 0;
      let sy = 0;
      for (let q = 0; q < 4; q++) {
        const ch = nChild[node * 4 + q];
        if (ch === -1) continue;
        const cm = nMass[ch];
        if (cm > 0) {
          m += cm;
          sx += nComX[ch] * cm;
          sy += nComY[ch] * cm;
        }
      }
      nMass[node] = m;
      if (m > 0) {
        nComX[node] = sx / m;
        nComY[node] = sy / m;
      } else {
        nComX[node] = nCx[node];
        nComY[node] = nCy[node];
      }
    }
  }

  // Accumulate acceleration on body i from the tree into (accX, accY).
  let accX = 0;
  let accY = 0;
  // Explicit traversal stack, sized to tree depth * fanout. Preallocated.
  const stack = new Int32Array(4096);

  function accel(i: number, root: number) {
    accX = 0;
    accY = 0;
    if (root < 0) return;
    const bx = px[i];
    const by = py[i];
    let sp = 0;
    stack[sp++] = root;
    while (sp > 0) {
      const node = stack[--sp];
      const m = nMass[node];
      if (m <= 0) continue;
      const dx = nComX[node] - bx;
      const dy = nComY[node] - by;
      const d2 = dx * dx + dy * dy;
      const size = nHalf[node] * 2;
      const internal = nInternal[node] === 1;

      if (!internal || size * size < THETA2 * d2) {
        // Far enough, or a leaf: treat as a single mass. Skip self.
        if (!internal && nBody[node] === i) continue;
        const inv = 1 / (d2 + EPS2);
        const invD = Math.sqrt(inv);
        const f = G * m * inv * invD; // G*m / (d2+eps2)^(3/2)
        accX += dx * f;
        accY += dy * f;
      } else {
        for (let q = 0; q < 4; q++) {
          const ch = nChild[node * 4 + q];
          if (ch !== -1 && nMass[ch] > 0 && sp < stack.length) stack[sp++] = ch;
        }
      }
    }

    // Central point mass at the disk center pulls every body.
    {
      const dx = cx - bx;
      const dy = cy - by;
      const d2 = dx * dx + dy * dy;
      const inv = 1 / (d2 + EPS2);
      const invD = Math.sqrt(inv);
      const f = G * coreMass * inv * invD;
      accX += dx * f;
      accY += dy * f;
    }

    // Pointer gravity well: 2% of core mass when inside, 10% when held down.
    if (pointerIn) {
      const wellMass = coreMass * (pointerDown ? 0.1 : 0.02);
      const dx = pointerX - bx;
      const dy = pointerY - by;
      const d2 = dx * dx + dy * dy;
      const inv = 1 / (d2 + EPS2 * 16); // softer well so it stirs, not collapses
      const invD = Math.sqrt(inv);
      const f = G * wellMass * inv * invD;
      accX += dx * f;
      accY += dy * f;
    }
  }

  // Preallocated per-body acceleration for the leapfrog KDK substep.
  const ax = new Float32Array(cap);
  const ay = new Float32Array(cap);

  function computeAccelAll() {
    const root = buildTree();
    for (let i = 0; i < n; i++) {
      accel(i, root);
      ax[i] = accX;
      ay[i] = accY;
    }
  }

  function substep(dt: number) {
    // Leapfrog kick-drift-kick. ax/ay hold acceleration at the current position.
    const halfDt = dt * 0.5;
    for (let i = 0; i < n; i++) {
      vx[i] += ax[i] * halfDt;
      vy[i] += ay[i] * halfDt;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
    }
    computeAccelAll();
    const boundR = diskR * 1.8;
    const boundR2 = boundR * boundR;
    for (let i = 0; i < n; i++) {
      vx[i] += ax[i] * halfDt;
      vy[i] += ay[i] * halfDt;
      const dx = px[i] - cx;
      const dy = py[i] - cy;
      if (dx * dx + dy * dy > boundR2) respawn(i);
    }
  }

  function degrade() {
    // Halve N in place by dropping the tail. Bodies keep their slots, we just
    // stop iterating past the new n.
    if (n <= 200) return;
    n = Math.floor(n / 2);
    degraded = true;
  }

  return {
    resize(width, height, ratio) {
      const first = w === 0 && h === 0;
      w = width;
      h = height;
      dpr = ratio;
      if (first) {
        seed();
        computeAccelAll();
      } else {
        // Recenter on resize without a full reseed so the sim keeps its state.
        const ncx = anchorX();
        const ncy = anchorY();
        const shiftX = ncx - cx;
        const shiftY = ncy - cy;
        for (let i = 0; i < cap; i++) {
          px[i] += shiftX;
          py[i] += shiftY;
        }
        cx = ncx;
        cy = ncy;
        diskR = 0.35 * Math.min(w, h);
      }
      // Clear on resize so no stale trails linger from the old buffer size.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },

    step(dt) {
      const t0 = performance.now();

      // Fixed substeps, at most 2 per frame.
      const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.round(dt / SUBSTEP)));
      for (let s = 0; s < steps; s++) substep(SUBSTEP);

      // Track center of mass of active bodies for the central glow.
      let sx = 0;
      let sy = 0;
      let sm = 0;
      for (let i = 0; i < n; i++) {
        sx += px[i] * mass[i];
        sy += py[i] * mass[i];
        sm += mass[i];
      }
      // Include the core so the glow sits at the true barycenter.
      sx += cx * coreMass;
      sy += cy * coreMass;
      sm += coreMass;
      comX = sm > 0 ? sx / sm : cx;
      comY = sm > 0 ? sy / sm : cy;

      draw();

      const frameMs = performance.now() - t0;
      ema = ema * 0.9 + frameMs * 0.1;
      if (!degraded && ema > 26) {
        slowFrames++;
        if (slowFrames >= 120) degrade();
      } else if (ema <= 26) {
        slowFrames = 0;
      }
    },

    pointerMove(x, y) {
      pointerX = x;
      pointerY = y;
      pointerIn = x >= 0 && y >= 0 && x <= w && y <= h;
    },

    pointerDown(x, y) {
      pointerX = x;
      pointerY = y;
      pointerIn = x >= 0 && y >= 0 && x <= w && y <= h;
      pointerDown = true;
    },

    pointerUp() {
      pointerDown = false;
    },
  };

  function draw() {
    const p = palette();

    // Fade the whole canvas toward transparent for trails that keep the
    // background see-through, never toward an opaque color.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'source-over';

    // Soft central glow at the center of mass, accent at low alpha.
    const glowR = 90 * dpr;
    const gx = comX * dpr;
    const gy = comY * dpr;
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, glowR);
    // Redrawn every frame over the 0.10 fade, so it accumulates: 0.012 per
    // frame settles near 0.1 visible alpha at the core.
    grad.addColorStop(0, rgba(p.accent, 0.012));
    grad.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(gx - glowR, gy - glowR, glowR * 2, glowR * 2);

    // Draw bodies in three color passes to minimize fillStyle churn.
    const size = dpr; // 1 px times dpr
    // fg bucket.
    ctx.fillStyle = rgba(p.fg, 0.32);
    for (let i = 0; i < n; i++) {
      if (bucket[i] !== 0) continue;
      ctx.fillRect(px[i] * dpr, py[i] * dpr, size, size);
    }
    ctx.fillStyle = rgba(p.accentSoft, 0.4);
    for (let i = 0; i < n; i++) {
      if (bucket[i] !== 1) continue;
      ctx.fillRect(px[i] * dpr, py[i] * dpr, size, size);
    }
    ctx.fillStyle = rgba(p.accent, 0.55);
    for (let i = 0; i < n; i++) {
      if (bucket[i] !== 2) continue;
      ctx.fillRect(px[i] * dpr, py[i] * dpr, size, size);
    }
  }
}
