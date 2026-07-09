// Real-time GPU stable-fluids simulation for the hero background, following the
// classic Pavel Dobryakov WebGL approach. Transparent premultiplied canvas
// composited over the near-black page, so smoke reads as ink drifting behind the
// title. Returns null when WebGL2 or float color buffers are unavailable, so the
// caller can fall back to the particle field. No GL blending anywhere: the
// double-buffered FBOs and premultiplied canvas compositing do all the work.

import { palette, type SimHooks } from './host';

interface FluidOptions {
  onFail?: () => void;
}

const COARSE = matchMedia('(pointer: coarse)').matches;

// Quality knobs, split by device class.
const SIM_RES = COARSE ? 72 : 112;
const DYE_RES = COARSE ? 288 : 448;
const PRESSURE_ITERS_FULL = COARSE ? 10 : 18;
const VORTICITY = COARSE ? 0 : 12;
const VEL_DISSIPATION = 0.4;
// Low dye dissipation keeps a standing haze in the hero: the smoke is a
// presence, not an occasional event.
const DYE_DISSIPATION = 0.65;
const SPLAT_RADIUS = 0.0022;

interface FBO {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  texelX: number;
  texelY: number;
}

interface DoubleFBO {
  read: FBO;
  write: FBO;
  width: number;
  height: number;
  texelX: number;
  texelY: number;
  swap(): void;
}

interface Splat {
  x: number;
  y: number;
  dx: number;
  dy: number;
  r: number;
  g: number;
  b: number;
  strength: number;
  radius: number;
}

const BASE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
uniform vec2 uTexel;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const ADVECT_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  outColor = texture(uSource, coord) / (1.0 + uDissipation * uDt);
}`;

const DIVERGENCE_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main() {
  float l = texture(uVelocity, vL).x;
  float r = texture(uVelocity, vR).x;
  float t = texture(uVelocity, vT).y;
  float b = texture(uVelocity, vB).y;
  vec2 c = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) l = -c.x;
  if (vR.x > 1.0) r = -c.x;
  if (vT.y > 1.0) t = -c.y;
  if (vB.y < 0.0) b = -c.y;
  float div = 0.5 * (r - l + t - b);
  outColor = vec4(div, 0.0, 0.0, 1.0);
}`;

const CURL_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main() {
  float l = texture(uVelocity, vL).y;
  float r = texture(uVelocity, vR).y;
  float t = texture(uVelocity, vT).x;
  float b = texture(uVelocity, vB).x;
  float curl = 0.5 * (r - l - t + b);
  outColor = vec4(curl, 0.0, 0.0, 1.0);
}`;

const VORTICITY_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;
void main() {
  float l = texture(uCurl, vL).x;
  float r = texture(uCurl, vR).x;
  float t = texture(uCurl, vT).x;
  float b = texture(uCurl, vB).x;
  float c = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * c;
  force.y *= -1.0;
  vec2 vel = texture(uVelocity, vUv).xy;
  vel += force * uDt;
  vel = clamp(vel, -1000.0, 1000.0);
  outColor = vec4(vel, 0.0, 1.0);
}`;

// Multiplies a texture by a scalar: used to decay last frame's pressure into a
// warm start for the Jacobi solve, much better convergence than a cold zero.
const DECAY_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform float uValue;
void main() {
  outColor = uValue * texture(uTexture, vUv);
}`;

const PRESSURE_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float l = texture(uPressure, vL).x;
  float r = texture(uPressure, vR).x;
  float t = texture(uPressure, vT).x;
  float b = texture(uPressure, vB).x;
  float div = texture(uDivergence, vUv).x;
  float p = (l + r + t + b - div) * 0.25;
  outColor = vec4(p, 0.0, 0.0, 1.0);
}`;

const GRADIENT_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float l = texture(uPressure, vL).x;
  float r = texture(uPressure, vR).x;
  float t = texture(uPressure, vT).x;
  float b = texture(uPressure, vB).x;
  vec2 vel = texture(uVelocity, vUv).xy;
  vel -= vec2(r - l, t - b);
  outColor = vec4(vel, 0.0, 1.0);
}`;

// Adds gaussian * uColor. For the dye target rgb carries premultiplied color
// and .a the ink opacity, scaled independently: on the dark theme the color
// outruns the opacity so the smoke glows additively over the near-black page,
// while the light theme keeps them equal for true occluding ink. For velocity
// the rg components are the force vector.
const SPLAT_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec4 uColor;
uniform float uRadius;
uniform float uAspect;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  float g = exp(-dot(p, p) / uRadius);
  outColor = texture(uTarget, vUv) + g * uColor;
}`;

// dye.a is ink amount, dye.rgb premultiplied color. Dense ink brightens a touch
// so cores read hot, then Jimenez interleaved gradient noise dithers the output.
// The dither is scaled by a so fully transparent pixels stay exactly zero,
// which premultiplied compositing requires.
const DISPLAY_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
void main() {
  vec4 dye = texture(uTexture, vUv);
  float a = clamp(dye.a, 0.0, 1.0);
  vec3 rgb = min(dye.rgb * (1.0 + 0.22 * a), vec3(1.2));
  float d = (ign(gl_FragCoord.xy) - 0.5) * (2.0 / 255.0) * clamp(a + dot(rgb, vec3(1.0)), 0.0, 1.0);
  outColor = vec4(max(rgb + d, 0.0), a);
}`;

export function createFluid(
  canvas: HTMLCanvasElement,
  opts: FluidOptions = {},
): SimHooks | null {
  // Capability probe on a throwaway canvas: once a canvas has held a webgl2
  // context it can never yield a 2d one, so the real canvas is only claimed
  // after the probe passes. Software rasterizers (SwiftShader, llvmpipe) run
  // the solver on the CPU and jank the whole page, so they get the cheap
  // constellation fallback instead.
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) return null;
  const probeOk = !!probe.getExtension('EXT_color_buffer_float');
  const dbg = probe.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg ? String(probe.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  if (!probeOk || /swiftshader|software|llvmpipe/i.test(renderer)) return null;

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;
  if (!gl.getExtension('EXT_color_buffer_float')) return null;
  const linearFloat = gl.getExtension('OES_texture_float_linear');

  const HALF = gl.HALF_FLOAT;
  const RG16F = gl.RG16F;
  const RGBA16F = gl.RGBA16F;
  const R16F = gl.R16F;
  // Fall back to NEAREST for velocity and dye if linear float filtering is
  // missing, so we still render rather than returning null.
  const LIN = linearFloat ? gl.LINEAR : gl.NEAREST;

  // Pipelined program setup: compile everything, link everything, check status
  // once at the end. Every status query is a sync point that stalls the main
  // thread, so batching them (plus KHR_parallel_shader_compile where present)
  // lets the driver compile in parallel instead of blocking per shader.
  gl.getExtension('KHR_parallel_shader_compile');

  function compile(type: number, src: string): WebGLShader {
    const sh = gl!.createShader(type)!;
    gl!.shaderSource(sh, src);
    gl!.compileShader(sh);
    return sh;
  }

  const vert = compile(gl.VERTEX_SHADER, BASE_VERT);

  function program(fragSrc: string): WebGLProgram {
    const fs = compile(gl!.FRAGMENT_SHADER, fragSrc);
    const prog = gl!.createProgram()!;
    gl!.attachShader(prog, vert);
    gl!.attachShader(prog, fs);
    gl!.linkProgram(prog);
    gl!.deleteShader(fs);
    return prog;
  }

  const pAdvect = program(ADVECT_FRAG);
  const pDivergence = program(DIVERGENCE_FRAG);
  const pCurl = program(CURL_FRAG);
  const pVorticity = program(VORTICITY_FRAG);
  const pPressure = program(PRESSURE_FRAG);
  const pGradient = program(GRADIENT_FRAG);
  const pSplat = program(SPLAT_FRAG);
  const pDisplay = program(DISPLAY_FRAG);
  const pDecay = program(DECAY_FRAG);
  gl.deleteShader(vert);
  const programs = [
    pAdvect, pDivergence, pCurl, pVorticity, pPressure, pGradient, pSplat, pDisplay, pDecay,
  ];
  if (programs.some((p) => !gl!.getProgramParameter(p, gl!.LINK_STATUS))) return null;

  // Cache uniform locations per program.
  type Locs = Record<string, WebGLUniformLocation | null>;
  const locCache = new Map<WebGLProgram, Locs>();
  function loc(prog: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = locCache.get(prog);
    if (!m) {
      m = {};
      locCache.set(prog, m);
    }
    if (!(name in m)) m[name] = gl!.getUniformLocation(prog, name);
    return m[name];
  }

  // Fullscreen triangle-strip quad.
  const quad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  function createFBO(
    w: number,
    h: number,
    internal: number,
    format: number,
    filter: number,
  ): FBO {
    const g = gl!;
    const tex = g.createTexture()!;
    g.bindTexture(g.TEXTURE_2D, tex);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, filter);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, filter);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texImage2D(g.TEXTURE_2D, 0, internal, w, h, 0, format, HALF, null);
    const fbo = g.createFramebuffer()!;
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
    g.viewport(0, 0, w, h);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    return { tex, fbo, width: w, height: h, texelX: 1 / w, texelY: 1 / h };
  }

  function createDouble(
    w: number,
    h: number,
    internal: number,
    format: number,
    filter: number,
  ): DoubleFBO {
    let a = createFBO(w, h, internal, format, filter);
    let b = createFBO(w, h, internal, format, filter);
    return {
      width: w,
      height: h,
      texelX: 1 / w,
      texelY: 1 / h,
      get read() {
        return a;
      },
      get write() {
        return b;
      },
      swap() {
        const t = a;
        a = b;
        b = t;
      },
    };
  }

  function deleteFBO(f: FBO) {
    gl!.deleteTexture(f.tex);
    gl!.deleteFramebuffer(f.fbo);
  }

  let velocity: DoubleFBO | null = null;
  let dye: DoubleFBO | null = null;
  let pressure: DoubleFBO | null = null;
  let divergence: FBO | null = null;
  let curl: FBO | null = null;

  let simW = 0;
  let simH = 0;
  let dyeW = 0;
  let dyeH = 0;
  let aspect = 1;

  function dims(res: number, w: number, h: number): [number, number] {
    // Fix the smaller side to res, derive the larger from aspect.
    const ar = w / h;
    if (ar >= 1) return [Math.round(res * ar), res];
    return [res, Math.round(res / ar)];
  }

  function allocate(bufW: number, bufH: number) {
    const [sw, sh] = dims(SIM_RES, bufW, bufH);
    const [dw, dh] = dims(DYE_RES, bufW, bufH);
    if (velocity) {
      deleteFBO(velocity.read);
      deleteFBO(velocity.write);
    }
    if (dye) {
      deleteFBO(dye.read);
      deleteFBO(dye.write);
    }
    if (pressure) {
      deleteFBO(pressure.read);
      deleteFBO(pressure.write);
    }
    if (divergence) deleteFBO(divergence);
    if (curl) deleteFBO(curl);

    velocity = createDouble(sw, sh, RG16F, gl!.RG, LIN);
    dye = createDouble(dw, dh, RGBA16F, gl!.RGBA, LIN);
    pressure = createDouble(sw, sh, R16F, gl!.RED, gl!.NEAREST);
    divergence = createFBO(sw, sh, R16F, gl!.RED, gl!.NEAREST);
    curl = createFBO(sw, sh, R16F, gl!.RED, gl!.NEAREST);
    simW = sw;
    simH = sh;
    dyeW = dw;
    dyeH = dh;
    aspect = bufW / bufH;
  }

  function blit(target: FBO | null, w: number, h: number) {
    const g = gl!;
    g.bindFramebuffer(g.FRAMEBUFFER, target ? target.fbo : null);
    g.viewport(0, 0, w, h);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  }

  function bindTex(prog: WebGLProgram, name: string, tex: WebGLTexture, unit: number) {
    const g = gl!;
    g.activeTexture(g.TEXTURE0 + unit);
    g.bindTexture(g.TEXTURE_2D, tex);
    g.uniform1i(loc(prog, name), unit);
  }

  // Queued splats, drained each step. Only populated on pointer or ambient
  // events, so the hot simulation loop itself allocates nothing.
  const queue: Splat[] = [];

  function enqueueSplat(
    x: number,
    y: number,
    dx: number,
    dy: number,
    r: number,
    g: number,
    b: number,
    strength: number,
    radius: number,
  ) {
    queue.push({ x, y, dx, dy, r, g, b, strength, radius });
  }

  function applySplat(s: Splat) {
    const g = gl!;
    const rad = s.radius;
    // Velocity splat: force in rg.
    g.useProgram(pSplat!);
    bindTex(pSplat!, 'uTarget', velocity!.read.tex, 0);
    g.uniform2f(loc(pSplat!, 'uPoint'), s.x, s.y);
    g.uniform1f(loc(pSplat!, 'uAspect'), aspect);
    g.uniform1f(loc(pSplat!, 'uRadius'), rad);
    g.uniform4f(loc(pSplat!, 'uColor'), s.dx, s.dy, 0, 0);
    blit(velocity!.write, simW, simH);
    velocity!.swap();

    // Dye splat: premultiplied color in rgb, ink opacity in alpha, scaled
    // independently upstream.
    bindTex(pSplat!, 'uTarget', dye!.read.tex, 0);
    g.uniform4f(loc(pSplat!, 'uColor'), s.r, s.g, s.b, s.strength);
    blit(dye!.write, dyeW, dyeH);
    dye!.swap();
  }

  // Ink color per splat from the active palette theme.
  const DARK_STOPS: [number, number, number][] = [
    [1, 0.3, 0.02],
    [1, 0.56, 0.16],
    [0.95, 0.93, 0.88],
  ];
  const LIGHT_STOPS: [number, number, number][] = [
    [0.62, 0.15, 0],
    [0.3, 0.1, 0.02],
    [0.12, 0.1, 0.08],
  ];
  const WEIGHTS = [0.62, 0.85, 1.0]; // cumulative: .62, .23, .15
  const INK_SCALE = 0.55;

  function pickInk(): [number, number, number] {
    const stops = palette().theme === 'light' ? LIGHT_STOPS : DARK_STOPS;
    const rnd = Math.random();
    const idx = rnd < WEIGHTS[0]! ? 0 : rnd < WEIGHTS[1]! ? 1 : 2;
    // Raw stop color: the splat pass scales the whole vec4 by INK_SCALE via
    // uStrength, so scaling rgb here too would wash the hue out quadratically.
    return stops[idx]!;
  }

  // Pointer state, in UV space. y flipped: UV origin is bottom left.
  let simTime = 0;
  let seeded = false;

  // Wandering emitters keep the fluid alive without any input: invisible smoke
  // sources drifting along slow Lissajous paths, injecting ink along the path
  // tangent with a little buoyancy so it rises like incense.
  const EMITTERS = COARSE ? 1 : 2;
  const EMIT_INTERVAL = 0.11;
  let nextEmit = 0;
  const emitInk: [number, number, number][] = [];
  const emitInkUntil: number[] = [];

  function emit(e: number, t: number) {
    const p1 = e * 2.4 + 0.7;
    const x = 0.5 + 0.3 * Math.sin(0.21 * t + p1) + 0.13 * Math.sin(0.083 * t + 2.1 * p1);
    const y = 0.45 + 0.26 * Math.sin(0.17 * t + 1.7 * p1) + 0.12 * Math.sin(0.064 * t + 3.3 * p1);
    // Analytic path tangent, normalized, so the ink is pushed where the
    // emitter travels.
    let tx = 0.063 * Math.cos(0.21 * t + p1) + 0.0108 * Math.cos(0.083 * t + 2.1 * p1);
    let ty = 0.0442 * Math.cos(0.17 * t + 1.7 * p1) + 0.0077 * Math.cos(0.064 * t + 3.3 * p1);
    const m = Math.hypot(tx, ty) || 1e-4;
    tx /= m;
    ty /= m;
    // Each emitter keeps one ink color for a few seconds so its plume reads as
    // a continuous ribbon rather than confetti.
    if ((emitInkUntil[e] ?? 0) <= t) {
      emitInkUntil[e] = t + 5;
      // Emitters stay in the orange range: the cream ink is reserved for
      // pointer strokes, so the standing ambient plume never builds into a
      // white mass that washes out the type.
      const stops = palette().theme === 'light' ? LIGHT_STOPS : DARK_STOPS;
      emitInk[e] = stops[Math.random() < 0.7 ? 0 : 1]!;
    }
    const [r, g, b, a] = inkVec(emitInk[e]!, 0.42);
    enqueueSplat(x, y, tx * 260, ty * 260 + 110, r, g, b, a, SPLAT_RADIUS * 1.8);
  }

  // Pointer events coalesce into one splat per frame: a 1000 Hz mouse would
  // otherwise queue dozens of two-pass splats between rAF ticks.
  let pendHas = false;
  let pendX = 0;
  let pendY = 0;
  let pendDX = 0;
  let pendDY = 0;

  // Split color and opacity strengths per theme: dark lets the color outrun
  // the opacity so smoke glows additively over the near-black page, light
  // keeps them equal so the ink truly occludes the cream.
  function inkVec(
    c: [number, number, number],
    soft: number,
  ): [number, number, number, number] {
    const dark = palette().theme !== 'light';
    const cs = INK_SCALE * soft;
    const as = (dark ? 0.26 : 0.55) * soft;
    return [c[0] * cs, c[1] * cs, c[2] * cs, as];
  }

  function queuePointerSplat(uvx: number, uvy: number, fdx: number, fdy: number) {
    const [r, g, b, a] = inkVec(pickInk(), 1);
    // Force proportional to pointer delta in UV units.
    enqueueSplat(uvx, uvy, fdx * 6000, fdy * 6000, r, g, b, a, SPLAT_RADIUS);
  }

  function queueAmbient(uvx: number, uvy: number, dirx: number, diry: number, soft: number) {
    const [r, g, b, a] = inkVec(pickInk(), soft);
    enqueueSplat(uvx, uvy, dirx, diry, r, g, b, a, SPLAT_RADIUS * 2);
  }

  function seedAmbient() {
    // A loose 3 by 3 field of large soft splats with swirling directions, so
    // the hero opens already filled with smoke instead of building up from
    // nothing. Jitter keeps it organic; the projection step ties it together
    // into one drifting body within a second.
    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        const x = 0.2 + gx * 0.3 + (Math.random() - 0.5) * 0.14;
        const y = 0.24 + gy * 0.26 + (Math.random() - 0.5) * 0.12;
        // Roughly tangential directions around the canvas center: the field
        // starts with one large slow swirl instead of colliding jets.
        const ang = Math.atan2(y - 0.5, x - 0.5) + Math.PI / 2 + (Math.random() - 0.5) * 0.8;
        const force = 260 + Math.random() * 240;
        queueAmbient(x, y, Math.cos(ang) * force, Math.sin(ang) * force, 0.75);
      }
    }
    // One brighter kernel near the type for the first impression.
    queueAmbient(0.62, 0.5, -320, 260, 1.0);
  }

  // Adaptive quality.
  let pressureIters = PRESSURE_ITERS_FULL;
  let vorticity = VORTICITY;
  let ema = 16;
  let slowFrames = 0;
  let stage = 0; // 0 full, 1 reduced, 2 failed
  let lastStepStart = 0;

  function step(dt: number, _t: number) {
    const g = gl!;
    if (!velocity || !dye || !pressure || !divergence || !curl) return;
    const now = performance.now();
    if (lastStepStart) {
      const frameMs = now - lastStepStart;
      ema = ema * 0.9 + frameMs * 0.1;
    }
    lastStepStart = now;

    simTime += dt;

    if (!seeded) {
      seeded = true;
      seedAmbient();
    }

    // Continuous ambient life: emitter pulses on a fixed clock, so the density
    // of the plume is frame-rate independent.
    if (simTime >= nextEmit) {
      nextEmit = simTime + EMIT_INTERVAL;
      for (let e = 0; e < EMITTERS; e++) emit(e, simTime);
    }

    g.bindBuffer(g.ARRAY_BUFFER, quad);
    g.enableVertexAttribArray(0);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    g.disable(g.BLEND);

    // Flush the coalesced pointer splat, then drain the queue.
    if (pendHas) {
      pendHas = false;
      queuePointerSplat(pendX, pendY, pendDX, pendDY);
      pendDX = 0;
      pendDY = 0;
    }
    if (queue.length) {
      for (const s of queue) applySplat(s);
      queue.length = 0;
    }

    // Advect velocity.
    g.useProgram(pAdvect!);
    g.uniform2f(loc(pAdvect!, 'uTexel'), velocity.texelX, velocity.texelY);
    bindTex(pAdvect!, 'uVelocity', velocity.read.tex, 0);
    bindTex(pAdvect!, 'uSource', velocity.read.tex, 1);
    g.uniform1f(loc(pAdvect!, 'uDt'), dt);
    g.uniform1f(loc(pAdvect!, 'uDissipation'), VEL_DISSIPATION);
    blit(velocity.write, simW, simH);
    velocity.swap();

    // Curl then vorticity confinement, desktop only.
    if (vorticity > 0) {
      g.useProgram(pCurl!);
      g.uniform2f(loc(pCurl!, 'uTexel'), velocity.texelX, velocity.texelY);
      bindTex(pCurl!, 'uVelocity', velocity.read.tex, 0);
      blit(curl, simW, simH);

      g.useProgram(pVorticity!);
      g.uniform2f(loc(pVorticity!, 'uTexel'), velocity.texelX, velocity.texelY);
      bindTex(pVorticity!, 'uVelocity', velocity.read.tex, 0);
      bindTex(pVorticity!, 'uCurl', curl.tex, 1);
      g.uniform1f(loc(pVorticity!, 'uCurlStrength'), vorticity);
      g.uniform1f(loc(pVorticity!, 'uDt'), dt);
      blit(velocity.write, simW, simH);
      velocity.swap();
    }

    // Divergence.
    g.useProgram(pDivergence!);
    g.uniform2f(loc(pDivergence!, 'uTexel'), velocity.texelX, velocity.texelY);
    bindTex(pDivergence!, 'uVelocity', velocity.read.tex, 0);
    blit(divergence, simW, simH);

    // Warm-start the Jacobi solve from a decayed copy of last frame's pressure.
    g.useProgram(pDecay!);
    g.uniform1f(loc(pDecay!, 'uValue'), 0.8);
    bindTex(pDecay!, 'uTexture', pressure.read.tex, 0);
    blit(pressure.write, simW, simH);
    pressure.swap();

    // Jacobi pressure solve.
    g.useProgram(pPressure!);
    g.uniform2f(loc(pPressure!, 'uTexel'), velocity.texelX, velocity.texelY);
    bindTex(pPressure!, 'uDivergence', divergence.tex, 0);
    for (let i = 0; i < pressureIters; i++) {
      bindTex(pPressure!, 'uPressure', pressure.read.tex, 1);
      blit(pressure.write, simW, simH);
      pressure.swap();
    }

    // Gradient subtract.
    g.useProgram(pGradient!);
    g.uniform2f(loc(pGradient!, 'uTexel'), velocity.texelX, velocity.texelY);
    bindTex(pGradient!, 'uPressure', pressure.read.tex, 0);
    bindTex(pGradient!, 'uVelocity', velocity.read.tex, 1);
    blit(velocity.write, simW, simH);
    velocity.swap();

    // Advect dye at dye resolution, using the velocity field.
    g.useProgram(pAdvect!);
    g.uniform2f(loc(pAdvect!, 'uTexel'), dye.texelX, dye.texelY);
    bindTex(pAdvect!, 'uVelocity', velocity.read.tex, 0);
    bindTex(pAdvect!, 'uSource', dye.read.tex, 1);
    g.uniform1f(loc(pAdvect!, 'uDt'), dt);
    g.uniform1f(loc(pAdvect!, 'uDissipation'), DYE_DISSIPATION);
    blit(dye.write, dyeW, dyeH);
    dye.swap();

    // Display to the canvas.
    g.useProgram(pDisplay!);
    bindTex(pDisplay!, 'uTexture', dye.read.tex, 0);
    blit(null, canvas.width, canvas.height);

    // Adaptive quality throttling.
    tuneQuality();
  }

  function tuneQuality() {
    if (stage === 2) return;
    if (stage === 0) {
      if (ema > 24) {
        slowFrames++;
        if (slowFrames >= 150) {
          stage = 1;
          pressureIters = 8;
          vorticity = 0;
          slowFrames = 0;
        }
      } else {
        slowFrames = 0;
      }
    } else if (stage === 1) {
      if (ema > 30) {
        slowFrames++;
        if (slowFrames >= 150) {
          stage = 2;
          opts.onFail?.();
        }
      } else {
        slowFrames = 0;
      }
    }
  }

  let bufW = 0;
  let bufH = 0;

  return {
    resize() {
      // host set canvas.width/height already. Rebuild only on real drawing
      // buffer changes.
      if (canvas.width === bufW && canvas.height === bufH) return;
      if (canvas.width === 0 || canvas.height === 0) return;
      bufW = canvas.width;
      bufH = canvas.height;
      allocate(bufW, bufH);
    },
    step,
    pointerMove(x, y, dx, dy) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // Bound-check against the canvas itself.
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      pendX = x / rect.width;
      pendY = 1 - y / rect.height;
      pendDX += dx / rect.width;
      pendDY += -dy / rect.height;
      pendHas = true;
    },
    destroy() {
      const g = gl;
      if (!g) return;
      if (velocity) {
        deleteFBO(velocity.read);
        deleteFBO(velocity.write);
      }
      if (dye) {
        deleteFBO(dye.read);
        deleteFBO(dye.write);
      }
      if (pressure) {
        deleteFBO(pressure.read);
        deleteFBO(pressure.write);
      }
      if (divergence) deleteFBO(divergence);
      if (curl) deleteFBO(curl);
      g.deleteBuffer(quad);
      g.deleteProgram(pAdvect);
      g.deleteProgram(pDivergence);
      g.deleteProgram(pCurl);
      g.deleteProgram(pVorticity);
      g.deleteProgram(pPressure);
      g.deleteProgram(pGradient);
      g.deleteProgram(pSplat);
      g.deleteProgram(pDisplay);
      g.deleteProgram(pDecay);
      const ext = g.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    },
  };
}
