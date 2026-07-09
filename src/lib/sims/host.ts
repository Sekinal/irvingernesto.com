// Shared client-side harness for the section background simulations. Six sim
// modules build against the SimHooks contract below. All DOM access happens
// inside functions so this stays safe to import at module scope during view
// transitions. One rAF loop per host, gated on viewport intersection and tab
// visibility, torn down on astro:before-swap.

export type RGB = [number, number, number];
export interface Palette {
  theme: 'dark' | 'light';
  fg: RGB;
  accent: RGB;
  accentSoft: RGB;
}

const DARK: Palette = {
  theme: 'dark',
  fg: [240, 237, 229],
  accent: [255, 77, 0],
  accentSoft: [255, 140, 64],
};
const LIGHT: Palette = {
  theme: 'light',
  fg: [25, 23, 19],
  accent: [227, 61, 0],
  accentSoft: [140, 38, 0],
};

export function palette(): Palette {
  return document.documentElement.dataset.theme === 'light' ? LIGHT : DARK;
}

export function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

export interface SimHooks {
  resize(width: number, height: number, dpr: number): void;
  step(dt: number, t: number): void;
  pointerMove?(x: number, y: number, dx: number, dy: number): void;
  pointerDown?(x: number, y: number): void;
  pointerUp?(x: number, y: number): void;
  destroy?(): void;
}

export interface HostOptions {
  maxDpr?: number;
  interactWith?: HTMLElement | null;
}

export function hostSim(
  canvas: HTMLCanvasElement,
  make: (canvas: HTMLCanvasElement) => SimHooks | null,
  opts: HostOptions = {},
): boolean {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduceMotion.matches) return false;
  const hooks = make(canvas);
  if (!hooks) return false;

  const dpr = Math.min(devicePixelRatio || 1, opts.maxDpr ?? 1.5);
  const ctrl = new AbortController();
  const { signal } = ctrl;

  let raf = 0;
  let last = 0;
  let visible = false;
  let cssW = 0;
  let cssH = 0;
  let px = 0;
  let py = 0;
  let havePointer = false;
  let running = false;
  let destroyed = false;

  const local = (clientX: number, clientY: number): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [clientX - r.left, clientY - r.top];
  };

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    // Ignore mobile URL bar jitter: same width, tiny height delta.
    if (w === cssW && Math.abs(h - cssH) < 2) return;
    cssW = w;
    cssH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    hooks.resize(w, h, dpr);
  }

  function frame(now: number) {
    raf = 0;
    if (destroyed) return;
    if (!canvas.isConnected) {
      destroy();
      return;
    }
    if (!running) return;
    const dt = Math.min(Math.max((now - last) / 1000, 0), 1 / 30);
    last = now;
    hooks.step(dt, now / 1000);
    raf = requestAnimationFrame(frame);
  }

  function shouldRun() {
    return visible && !document.hidden && !destroyed;
  }

  function sync() {
    if (reduceMotion.matches) {
      destroy();
      return;
    }
    if (shouldRun()) {
      if (!running) {
        running = true;
        last = performance.now(); // reset clock so first dt is not huge
        if (!raf) raf = requestAnimationFrame(frame);
      }
    } else if (running) {
      running = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    io.disconnect();
    ctrl.abort();
    hooks.destroy?.();
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) visible = e.isIntersecting;
      sync();
    },
    { rootMargin: '120px' },
  );
  io.observe(canvas);

  addEventListener(
    'pointermove',
    (e) => {
      const [x, y] = local(e.clientX, e.clientY);
      // Deltas from client coords: scrolling moves the canvas under a resting
      // pointer, and that must not read as pointer motion.
      const dx = havePointer ? e.clientX - px : 0;
      const dy = havePointer ? e.clientY - py : 0;
      px = e.clientX;
      py = e.clientY;
      havePointer = true;
      hooks.pointerMove?.(x, y, dx, dy);
    },
    { passive: true, signal },
  );

  const downTarget = opts.interactWith ?? canvas.parentElement ?? canvas;
  downTarget.addEventListener(
    'pointerdown',
    (e) => {
      const [x, y] = local(e.clientX, e.clientY);
      hooks.pointerDown?.(x, y);
    },
    { passive: true, signal },
  );

  const onUp = (e: PointerEvent) => {
    const [x, y] = local(e.clientX, e.clientY);
    hooks.pointerUp?.(x, y);
  };
  addEventListener('pointerup', onUp, { passive: true, signal });
  addEventListener('pointercancel', onUp, { passive: true, signal });

  document.addEventListener('visibilitychange', sync, { signal });
  reduceMotion.addEventListener('change', sync, { signal });
  document.addEventListener('astro:before-swap', () => destroy(), { signal });

  resize();
  return true;
}
