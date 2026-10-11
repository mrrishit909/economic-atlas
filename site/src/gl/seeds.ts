/**
 * The seed renderer (MOTION_SYSTEM 9.1, ENGINEERING_DECISIONS #24): raw WebGL2, one instanced quad
 * per seed, ONE drawArraysInstanced call per layer (a layer is one transition; the S03a year
 * crossfade is the only two-layer frame). The transition is evaluated in the vertex shader with the
 * same arithmetic as gl/transition.ts evalSeed. The fragment shader draws a disc with an analytic
 * 1-device-pixel edge and the bin's radial highlight (tint at 42% / 38% of the box, bin colour at the
 * edge); hollow seeds draw a 0.8px ring in their colour.
 * Seeds2D is the Canvas2D sprite fallback (no WebGL2, context loss) and the reduced-motion painter.
 * No rotation uniform exists: positions are mix(from, to, e(t)) in world units, then the camera
 * (c, s) maps world units to CSS px.
 */
import { BIN_COLORS, NEUTRAL, hexRgb } from "../model/bins";
import { STRIDE, evalSeed, type SeedState, type Transition } from "./transition";

/** Camera: centre and spacing in CSS px; `rw` is the disc radius in world units (sqrt N) for the luminance ramp (0 = off). */
export interface Cam { cx: number; cy: number; s: number; rw?: number }

/**
 * Luminance ramp by rank radius (ruling, P05-FE-001 review): a grain's light falls with its own
 * distance from the core, so the highest-ranked (innermost) grains of every territory are brightest
 * and the disc reads as one lit form. Bin hue is unchanged; only brightness and a small core tint move.
 */
export const RAMP = { dim: 0.3, tint: 0.12 };
export function rampLight(dist: number, rw: number) {
  const k = rw > 0 ? Math.min(1, dist / rw) : 0;
  return 1 - RAMP.dim * k;
}
export interface LayerDraw { tr: Transition; now: number; alpha: number }
export interface SeedDrawer {
  readonly kind: "gl" | "2d";
  frames: number;
  resize(w: number, h: number, dpr: number): void;
  draw(cam: Cam, layers: LayerDraw[]): void;
}

const PALETTE = [...BIN_COLORS, NEUTRAL, "#ffffff"]; // index 7 = neutral (-1), 8 = white (-2)
const palIndex = (bin: number) => (bin >= 0 ? bin : bin === -1 ? 7 : 8);
const PAL_RGB = new Float32Array(PALETTE.flatMap((h) => hexRgb(h)));

const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aPos;
layout(location=2) in vec4 aRB;
layout(location=3) in vec4 aHA;
layout(location=4) in vec4 aFDS;
uniform vec2 uView;
uniform vec3 uCam;
uniform float uNow, uT0, uDur, uDpr, uAlpha, uRw, uDim, uTint;
uniform vec4 uBez;
uniform vec3 uPal[9];
out vec2 vP;
out float vR, vHalf, vHollow, vAlpha, vK;
out vec3 vCol;
float bez(float a, float b, float t) { return ((1.0 - 3.0 * b + 3.0 * a) * t + (3.0 * b - 6.0 * a)) * t * t + 3.0 * a * t; }
float bezD(float a, float b, float t) { return 3.0 * (1.0 - 3.0 * b + 3.0 * a) * t * t + 2.0 * (3.0 * b - 6.0 * a) * t + 3.0 * a; }
float ease(float x) {
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return 1.0;
  float t = x;
  for (int i = 0; i < 8; i++) {
    float e = bez(uBez.x, uBez.z, t) - x;
    float d = bezD(uBez.x, uBez.z, t);
    if (abs(e) < 1e-6 || abs(d) < 1e-6) break;
    t = clamp(t - e / d, 0.0, 1.0);
  }
  return bez(uBez.y, uBez.w, t);
}
int pal(float b) { return b >= 0.0 ? int(b + 0.5) : (b > -1.5 ? 7 : 8); }
void main() {
  float raw = uDur > 0.0 ? (uNow - uT0 - aFDS.z) / uDur : 1.0;
  float lt = clamp(raw, 0.0, 1.0);
  float e = ease(lt);
  vec2 world = mix(aPos.xy, aPos.zw, e);
  float r = mix(aRB.x, aRB.y, e) * uCam.z;
  float w = clamp((lt - aFDS.x) / max(1e-6, aFDS.y - aFDS.x), 0.0, 1.0);
  w = w * w * (3.0 - 2.0 * w);
  vAlpha = mix(aHA.z, aHA.w, w) * uAlpha;
  vHollow = mix(aHA.x, aHA.y, e);
  vCol = uPal[pal(raw >= aFDS.w ? aRB.w : aRB.z)];
  vK = uRw > 0.0 ? clamp(length(world) / uRw, 0.0, 1.0) : -1.0;
  vR = r;
  vHalf = r + 1.5 / uDpr;
  vP = aCorner * vHalf;
  vec2 px = uCam.xy + world * uCam.z + vP;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vP;
in float vR, vHalf, vHollow, vAlpha, vK;
in vec3 vCol;
uniform float uDpr, uDim, uTint;
out vec4 outColor;
void main() {
  float d = length(vP);
  float fill = clamp((vR - d) * uDpr + 0.5, 0.0, 1.0);
  float inner = clamp((vR - 0.8 - d) * uDpr + 0.5, 0.0, 1.0);
  float ring = fill - inner;
  // radial highlight: lighter tint at (42%, 38%) of the box, the bin colour at the edge
  vec2 hl = vec2(-0.16, -0.24) * vR;
  float g = clamp(length(vP - hl) / max(vR * 1.15, 1e-3), 0.0, 1.0);
  vec3 tint = mix(vCol, vec3(1.0), 0.4);
  vec3 c = mix(tint, vCol, g);
  // a 0.8px ring fills a grain under about 2px radius, so tiny hollow grains also dim to read as set aside
  float small = clamp((2.0 - vR) / 1.2, 0.0, 1.0);
  float a = (fill * (1.0 - vHollow) + ring * vHollow * (1.0 - 0.55 * small)) * vAlpha;
  vec3 col = mix(c, vCol, vHollow);
  if (vK >= 0.0) col = mix(col * (1.0 - uDim * vK), vec3(1.0), uTint * (1.0 - vK) * (1.0 - vHollow));
  if (a <= 0.002) discard;
  outColor = vec4(col * a, a);
}`;

interface Buf { vao: WebGLVertexArrayObject; buf: WebGLBuffer; version: number; n: number }

export class SeedsGL implements SeedDrawer {
  readonly kind = "gl" as const;
  frames = 0;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private corner: WebGLBuffer;
  private bufs = new WeakMap<Transition, Buf>();
  private w = 1; private h = 1; private dpr = 1;

  static create(canvas: HTMLCanvasElement): SeedsGL | null {
    const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: true, alpha: true, depth: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    if (!gl || gl.isContextLost()) return null;
    try { return new SeedsGL(gl, canvas); } catch (e) { console.warn("WebGL2 init failed", e); return null; }
  }

  private constructor(readonly gl: WebGL2RenderingContext, readonly canvas: HTMLCanvasElement) {
    const p = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]] as const) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    this.prog = p;
    for (const n of ["uView", "uCam", "uNow", "uT0", "uDur", "uDpr", "uAlpha", "uBez", "uPal", "uRw", "uDim", "uTint"]) this.u[n] = gl.getUniformLocation(p, n);
    this.corner = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corner);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  }

  resize(w: number, h: number, dpr: number) {
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    this.w = w; this.h = h; this.dpr = dpr;
  }

  private buffer(tr: Transition): Buf {
    const gl = this.gl;
    let b = this.bufs.get(tr);
    if (b && b.version === tr.version) return b;
    if (!b) {
      const vao = gl.createVertexArray()!, buf = gl.createBuffer()!;
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.corner);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      for (let a = 0; a < 4; a++) {
        gl.enableVertexAttribArray(1 + a);
        gl.vertexAttribPointer(1 + a, 4, gl.FLOAT, false, STRIDE * 4, a * 16);
        gl.vertexAttribDivisor(1 + a, 1);
      }
      gl.bindVertexArray(null);
      b = { vao, buf, version: -1, n: 0 };
      this.bufs.set(tr, b);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
    gl.bufferData(gl.ARRAY_BUFFER, tr.data, gl.STATIC_DRAW);
    b.version = tr.version; b.n = tr.n;
    return b;
  }

  draw(cam: Cam, layers: LayerDraw[]) {
    const gl = this.gl, u = this.u;
    this.frames++;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    gl.uniform2f(u.uView!, this.w, this.h);
    gl.uniform3f(u.uCam!, cam.cx, cam.cy, cam.s);
    gl.uniform1f(u.uDpr!, this.dpr);
    gl.uniform3fv(u.uPal!, PAL_RGB);
    gl.uniform1f(u.uRw!, cam.rw ?? 0);
    gl.uniform1f(u.uDim!, RAMP.dim);
    gl.uniform1f(u.uTint!, RAMP.tint);
    for (const L of layers) {
      if (L.alpha <= 0 || !L.tr.n) continue;
      const b = this.buffer(L.tr);
      gl.uniform1f(u.uNow!, L.now);
      gl.uniform1f(u.uT0!, L.tr.t0);
      gl.uniform1f(u.uDur!, L.tr.dur);
      gl.uniform1f(u.uAlpha!, L.alpha);
      gl.uniform4f(u.uBez!, L.tr.bez[0], L.tr.bez[1], L.tr.bez[2], L.tr.bez[3]);
      gl.bindVertexArray(b.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, b.n);
    }
    gl.bindVertexArray(null);
  }
}

// ------------------------------------------------------------------ Canvas2D sprite fallback
const SPRITE = 48;
let sprites: HTMLCanvasElement[] | null = null;
function spriteSet(): HTMLCanvasElement[] {
  if (sprites) return sprites;
  sprites = PALETTE.map((hex) => {
    const c = document.createElement("canvas");
    c.width = c.height = SPRITE * 2;
    const x = c.getContext("2d")!;
    const [r, g, b] = hexRgb(hex).map((v) => Math.round(v * 255));
    const tint = `rgb(${Math.round(r! + (255 - r!) * 0.4)},${Math.round(g! + (255 - g!) * 0.4)},${Math.round(b! + (255 - b!) * 0.4)})`;
    const grad = x.createRadialGradient(SPRITE * 0.84, SPRITE * 0.76, 0, SPRITE * 0.84, SPRITE * 0.76, SPRITE * 1.15);
    grad.addColorStop(0, tint);
    grad.addColorStop(1, hex);
    x.fillStyle = grad;
    x.beginPath(); x.arc(SPRITE, SPRITE, SPRITE, 0, Math.PI * 2); x.fill();
    return c;
  });
  return sprites;
}

/** Draw one seed in CSS px on a 2D context (shared by the fallback and the reduced-motion static discs). */
export function paintSeed(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, bin: number, hollow: number, alpha: number) {
  if (alpha <= 0.002 || r <= 0) return;
  const p = palIndex(bin);
  if (hollow < 1) {
    ctx.globalAlpha = alpha * (1 - hollow);
    ctx.drawImage(spriteSet()[p]!, x - r, y - r, r * 2, r * 2);
  }
  if (hollow > 0) {
    ctx.globalAlpha = alpha * hollow * (1 - 0.55 * Math.min(1, Math.max(0, (2 - r) / 1.2)));
    ctx.strokeStyle = PALETTE[p]!;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.4, r - 0.4), 0, Math.PI * 2); ctx.stroke();
  }
}

/** Paint a resting state (reduced-motion static discs, the S00/S08 glow source). */
export function paintState(ctx: CanvasRenderingContext2D, cam: Cam, s: SeedState) {
  for (let i = 0; i < s.key.length; i++) {
    const a = s.alpha[i]! * (cam.rw ? rampLight(Math.hypot(s.x[i]!, s.y[i]!), cam.rw) : 1);
    paintSeed(ctx, cam.cx + s.x[i]! * cam.s, cam.cy + s.y[i]! * cam.s, s.r[i]! * cam.s, s.bin[i]!, s.hollow[i]!, a);
  }
  ctx.globalAlpha = 1;
}

export class Seeds2D implements SeedDrawer {
  readonly kind = "2d" as const;
  frames = 0;
  private ctx: CanvasRenderingContext2D;
  private w = 1; private h = 1; private dpr = 1;
  constructor(readonly canvas: HTMLCanvasElement) { this.ctx = canvas.getContext("2d")!; }
  resize(w: number, h: number, dpr: number) {
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    this.w = w; this.h = h; this.dpr = dpr;
  }
  draw(cam: Cam, layers: LayerDraw[]) {
    const c = this.ctx;
    this.frames++;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    for (const L of layers) {
      if (L.alpha <= 0) continue;
      for (let i = 0; i < L.tr.n; i++) {
        const v = evalSeed(L.tr, i, L.now);
        const x = cam.cx + v.x * cam.s, y = cam.cy + v.y * cam.s, r = v.r * cam.s;
        if (x < -r || y < -r || x > this.w + r || y > this.h + r) continue;
        paintSeed(c, x, y, r, v.bin, v.hollow, v.alpha * L.alpha * (cam.rw ? rampLight(Math.hypot(v.x, v.y), cam.rw) : 1));
      }
    }
    c.globalAlpha = 1;
  }
}
