// Chaos garden for the 05 Contact section: an ensemble of undamped double
// pendulums launched from the same state, each offset by a thousandth of a
// radian. They hug one path for a few seconds, then sensitive dependence on
// initial conditions fans them into divergent glowing threads. Grab and fling
// the lead pendulum and the whole ensemble re-launches from where you let go.
//
// Two layers: threads accumulate on an offscreen canvas faded with
// destination-out (so the page shows through), while the lead pendulum is
// drawn crisp on the visible canvas every frame.

import type { RGB, SimHooks } from './host';
import { palette, rgba } from './host';

const G = 980; // px/s^2, gravity scaled to the pixel lengths
const SUB = 1 / 240;
const OMEGA_MAX = 16;
const GRAB_R = 34;
const OFFSET = 1e-3; // initial-condition spread between neighbors, rad
const RESYNC_AFTER = 40; // seconds of divergence before re-converging

// Shared derivative temps written by accel(), read immediately by rk4.
let dW1 = 0;
let dW2 = 0;

// Double pendulum equations of motion, equal masses and lengths (m1 = m2 = 1).
function accel(t1: number, t2: number, w1: number, w2: number, L1: number, L2: number): void {
  const d = t1 - t2;
  const cd = Math.cos(d);
  const sd = Math.sin(d);
  const den = 4 - 2 * cd * cd; // 3 - cos(2d)
  dW1 =
    (-G * (3 * Math.sin(t1) + Math.sin(t1 - 2 * t2)) -
      2 * sd * (w2 * w2 * L2 + w1 * w1 * L1 * cd)) /
    (L1 * den);
  dW2 =
    (2 * sd * (2 * w1 * w1 * L1 + 2 * G * Math.cos(t1) + w2 * w2 * L2 * cd)) /
    (L2 * den);
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function createPendulum(canvas: HTMLCanvasElement): SimHooks | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const coarse = matchMedia('(pointer: coarse)').matches;
  const N = coarse ? 10 : 16;

  let dpr = 1;
  let w = 0;
  let h = 0;
  let L1 = 100;
  let L2 = 100;
  let pivotX = 0;
  let pivotY = 0;

  // Ensemble state. Index 0 is the lead (grabbable) pendulum.
  const th1 = new Float64Array(N);
  const th2 = new Float64Array(N);
  const om1 = new Float64Array(N);
  const om2 = new Float64Array(N);
  // Previous tip position per pendulum, for thread segments.
  const tipX = new Float32Array(N);
  const tipY = new Float32Array(N);
  let haveTips = false;

  // Offscreen thread accumulation layer.
  const trail = document.createElement('canvas');
  const tctx = trail.getContext('2d');
  if (!tctx) return null;

  let acc = 0;
  let lastSync = 0;
  let simT = 0;

  // Grab state. 0 none, 1 bob1, 2 bob2 of the lead pendulum.
  let grabbed = 0;
  let grabX = 0;
  let grabY = 0;
  const HIST = 8;
  const histA = new Float64Array(HIST);
  const histT = new Float64Array(HIST);
  let histIdx = 0;
  let histCount = 0;

  // Symmetric neighbor offsets around the lead: +1, -1, +2, -2, ... times OFFSET.
  function spread(i: number): number {
    if (i === 0) return 0;
    const k = (i + 1) >> 1;
    return (i % 2 === 1 ? k : -k) * OFFSET;
  }

  function resyncFromLead() {
    for (let i = 1; i < N; i++) {
      const d = spread(i);
      th1[i] = th1[0] + d;
      th2[i] = th2[0] + d * 1.3;
      om1[i] = om1[0];
      om2[i] = om2[0];
    }
    lastSync = simT;
    haveTips = false;
  }

  function seed() {
    th1[0] = Math.PI * 0.85;
    th2[0] = Math.PI * 0.55;
    om1[0] = 0;
    om2[0] = 0;
    resyncFromLead();
  }

  function rk4(i: number, dt: number) {
    const hdt = dt * 0.5;
    const t1 = th1[i]!;
    const t2 = th2[i]!;
    const w1 = om1[i]!;
    const w2 = om2[i]!;

    accel(t1, t2, w1, w2, L1, L2);
    const k1t1 = w1;
    const k1t2 = w2;
    const k1w1 = dW1;
    const k1w2 = dW2;

    accel(t1 + k1t1 * hdt, t2 + k1t2 * hdt, w1 + k1w1 * hdt, w2 + k1w2 * hdt, L1, L2);
    const k2t1 = w1 + k1w1 * hdt;
    const k2t2 = w2 + k1w2 * hdt;
    const k2w1 = dW1;
    const k2w2 = dW2;

    accel(t1 + k2t1 * hdt, t2 + k2t2 * hdt, w1 + k2w1 * hdt, w2 + k2w2 * hdt, L1, L2);
    const k3t1 = w1 + k2w1 * hdt;
    const k3t2 = w2 + k2w2 * hdt;
    const k3w1 = dW1;
    const k3w2 = dW2;

    accel(t1 + k3t1 * dt, t2 + k3t2 * dt, w1 + k3w1 * dt, w2 + k3w2 * dt, L1, L2);
    const k4t1 = w1 + k3w1 * dt;
    const k4t2 = w2 + k3w2 * dt;
    const k4w1 = dW1;
    const k4w2 = dW2;

    const s = dt / 6;
    th1[i] = t1 + s * (k1t1 + 2 * k2t1 + 2 * k3t1 + k4t1);
    th2[i] = t2 + s * (k1t2 + 2 * k2t2 + 2 * k3t2 + k4t2);
    om1[i] = w1 + s * (k1w1 + 2 * k2w1 + 2 * k3w1 + k4w1);
    om2[i] = w2 + s * (k1w2 + 2 * k2w2 + 2 * k3w2 + k4w2);

    if (om1[i]! > OMEGA_MAX) om1[i] = OMEGA_MAX;
    else if (om1[i]! < -OMEGA_MAX) om1[i] = -OMEGA_MAX;
    if (om2[i]! > OMEGA_MAX) om2[i] = OMEGA_MAX;
    else if (om2[i]! < -OMEGA_MAX) om2[i] = -OMEGA_MAX;

    if (!Number.isFinite(th1[i]!) || !Number.isFinite(th2[i]!)) {
      th1[i] = th1[0]!;
      th2[i] = th2[0]!;
      om1[i] = om1[0]!;
      om2[i] = om2[0]!;
    }
  }

  function tip(i: number, out: { x1: number; y1: number; x2: number; y2: number }) {
    out.x1 = pivotX + L1 * Math.sin(th1[i]!);
    out.y1 = pivotY + L1 * Math.cos(th1[i]!);
    out.x2 = out.x1 + L2 * Math.sin(th2[i]!);
    out.y2 = out.y1 + L2 * Math.cos(th2[i]!);
  }

  const pos = { x1: 0, y1: 0, x2: 0, y2: 0 };

  return {
    resize(width, height, ratio) {
      dpr = ratio;
      w = width;
      h = height;
      L1 = Math.max(60, Math.min(150, 0.13 * Math.min(w, h)));
      L2 = L1;
      // Narrow layouts stack the footer content, so hang the ensemble from the
      // center instead of hugging a right column that no longer exists.
      pivotX = w < 640 ? w * 0.5 : Math.min(w * 0.72, w - 280);
      pivotY = h * (w < 640 ? 0.1 : 0.16);
      trail.width = canvas.width;
      trail.height = canvas.height;
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tctx.lineCap = 'round';
      if (th1[0] === 0 && om1[0] === 0 && th2[0] === 0) seed();
      haveTips = false;
    },

    step(dt, t) {
      simT += dt;
      const p = palette();

      if (grabbed) {
        // Grabbed link rigidly tracks the pointer; the free link keeps swinging
        // as a damped simple pendulum so the chain never feels frozen.
        const anchorX = grabbed === 1 ? pivotX : pivotX + L1 * Math.sin(th1[0]!);
        const anchorY = grabbed === 1 ? pivotY : pivotY + L1 * Math.cos(th1[0]!);
        const ang = Math.atan2(grabX - anchorX, grabY - anchorY);
        if (grabbed === 1) {
          th1[0] = ang;
          om1[0] = 0;
          om2[0] = (om2[0]! - (G / L2) * Math.sin(th2[0]!) * dt) * Math.exp(-0.3 * dt);
          th2[0] = th2[0]! + om2[0]! * dt;
        } else {
          th2[0] = ang;
          om2[0] = 0;
          om1[0] = (om1[0]! - (G / L1) * Math.sin(th1[0]!) * dt) * Math.exp(-0.3 * dt);
          th1[0] = th1[0]! + om1[0]! * dt;
        }
        histA[histIdx] = ang;
        histT[histIdx] = t;
        histIdx = (histIdx + 1) % HIST;
        if (histCount < HIST) histCount++;
        // The rest of the ensemble keeps evolving while the lead is held.
        acc += dt;
        while (acc >= SUB) {
          for (let i = 1; i < N; i++) rk4(i, SUB);
          acc -= SUB;
        }
      } else {
        acc += dt;
        while (acc >= SUB) {
          for (let i = 0; i < N; i++) rk4(i, SUB);
          acc -= SUB;
        }
        if (simT - lastSync > RESYNC_AFTER) resyncFromLead();
      }

      // Threads: fade the accumulation layer toward transparent, then lay down
      // one segment per pendulum from the previous tip to the new one.
      tctx.globalCompositeOperation = 'destination-out';
      tctx.fillStyle = 'rgba(0, 0, 0, 0.035)';
      tctx.fillRect(0, 0, w, h);
      tctx.globalCompositeOperation = 'source-over';
      tctx.lineWidth = 1.2;

      for (let i = N - 1; i >= 0; i--) {
        tip(i, pos);
        if (haveTips) {
          const f = N === 1 ? 0 : i / (N - 1);
          const col =
            i === 0 ? p.fg : mix(p.accent, p.accentSoft, f);
          tctx.strokeStyle = rgba(col, i === 0 ? 0.4 : 0.34);
          tctx.beginPath();
          tctx.moveTo(tipX[i]!, tipY[i]!);
          tctx.lineTo(pos.x2, pos.y2);
          tctx.stroke();
        }
        tipX[i] = pos.x2;
        tipY[i] = pos.y2;
      }
      haveTips = true;

      // Composite: threads below, lead pendulum crisp on top.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(trail, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      tip(0, pos);
      ctx.strokeStyle = rgba(p.fg, 0.25);
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(pos.x1, pos.y1);
      ctx.lineTo(pos.x2, pos.y2);
      ctx.stroke();

      ctx.fillStyle = rgba(p.fg, 0.3);
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = rgba(p.fg, 0.45);
      ctx.beginPath();
      ctx.arc(pos.x1, pos.y1, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = rgba(p.accent, 0.85);
      ctx.beginPath();
      ctx.arc(pos.x2, pos.y2, 7, 0, Math.PI * 2);
      ctx.fill();
    },

    pointerMove(x, y) {
      if (grabbed) {
        grabX = x;
        grabY = y;
      }
    },

    pointerDown(x, y) {
      tip(0, pos);
      const d2 = (x - pos.x2) * (x - pos.x2) + (y - pos.y2) * (y - pos.y2);
      const d1 = (x - pos.x1) * (x - pos.x1) + (y - pos.y1) * (y - pos.y1);
      if (d2 <= GRAB_R * GRAB_R) grabbed = 2;
      else if (d1 <= GRAB_R * GRAB_R) grabbed = 1;
      else return;
      grabX = x;
      grabY = y;
      histIdx = 0;
      histCount = 0;
    },

    pointerUp() {
      if (!grabbed) return;
      const li = grabbed === 1 ? 0 : 1;
      let vel = 0;
      if (histCount >= 2) {
        const newest = (histIdx - 1 + HIST) % HIST;
        const oldest = (histIdx - histCount + HIST) % HIST;
        let da = histA[newest]! - histA[oldest]!;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const dtHist = histT[newest]! - histT[oldest]!;
        if (dtHist > 1e-4) vel = da / dtHist;
      }
      if (vel > OMEGA_MAX) vel = OMEGA_MAX;
      else if (vel < -OMEGA_MAX) vel = -OMEGA_MAX;
      if (li === 0) om1[0] = vel;
      else om2[0] = vel;
      grabbed = 0;
      // The whole ensemble re-launches from the flung state: one tight bundle
      // of threads that will fan apart all over again.
      resyncFromLead();
    },
  };
}
