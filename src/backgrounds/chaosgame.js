// Chaos game: a point jumps again and again a set fraction of the way toward a corner picked at
// random, and every landing is a dot coloured by its corner, so a Sierpinski-like fractal builds up
// out of noise; a slow pen shows single jumps. Once a figure is dense it fades and a new rule
// starts. The seed picks the variant: one large figure at the centre; a gallery of small figures,
// each on its own rule and pace; or one figure whose corners sit at the edges of the host itself.

import { stage, TAU, clamp } from './stage.js';

/**
 * A rule: corners in unit space (-1..1), the fraction of the distance kept to the picked corner,
 * and which corners may not follow the last one (0 any, 1 not the same, 2 not the next one round).
 * @typedef {{v:number[][], r:number, ban:number}} Rule
 * @typedef {{x:number, y:number, w:number, h:number, rule:Rule, vx:number[], vy:number[],
 *   px:number, py:number, last:number, n:number, N:number, age:number, cv:HTMLCanvasElement|null,
 *   g:CanvasRenderingContext2D|null, ox:number, oy:number, pen:Pen, pace:number, ri:number}} Fig
 * @typedef {{x0:number, y0:number, x1:number, y1:number, v:number, u:number, wait:number, lit:number[]}} Pen
 */

/** @param {number} n @param {number} a0 @returns {number[][]} */
const poly = (n, a0) => {
  const v = Array.from({ length: n }, (_, k) => [Math.cos(a0 + k * TAU / n), Math.sin(a0 + k * TAU / n)]);
  // Centred on its box, so an odd polygon sits in the middle of its place.
  const ys = v.map((p) => p[1]), dy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return v.map(([x, y]) => [x, y - dy]);
};
const SQ = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

/** @type {Rule[]} */
const RULES = [
  { v: poly(3, -TAU / 4), r: 0.5, ban: 0 },                                      // Sierpinski triangle
  { v: SQ, r: 0.5, ban: 1 },                                                       // square, no repeat
  { v: poly(5, -TAU / 4), r: 0.382, ban: 0 },                                      // pentaflake
  { v: [...SQ, [0, -1], [1, 0], [0, 1], [-1, 0]], r: 1 / 3, ban: 0 },              // carpet
  { v: poly(6, -TAU / 4), r: 1 / 3, ban: 0 },                                      // hexaflake
  { v: SQ, r: 0.5, ban: 2 },                                                       // square, not next
  { v: [...SQ, [0, 0]], r: 1 / 3, ban: 0 },                                        // Vicsek cross
  { v: poly(5, -TAU / 4), r: 0.5, ban: 1 },                                        // pentagon, no repeat
];

const BUILD = 24, HOLD = 8, FADE = 3;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const col = (/** @type {number} */ k) => s.colors[k % s.colors.length];
    /** @type {Fig[]} */
    let figs = [];
    let order = rng.shuffle(RULES.map((_, k) => k));
    let next = 0;
    let laid = false;
    /** @type {number[][]} */
    const bucket = [];

    /** @param {Fig} f @param {number} ri */
    function setRule(f, ri) {
      f.ri = ri;
      f.rule = RULES[ri];
      f.vx = f.rule.v.map((p) => f.x + p[0] * f.w);
      f.vy = f.rule.v.map((p) => f.y + p[1] * f.h);
      f.px = f.x; f.py = f.y; f.last = 0; f.n = 0; f.age = 0;
      // Dots enough to fill it densely, by its area, so small figures finish as fine as big ones.
      f.N = clamp(f.w * f.h * 0.6, 12000, 160000);
      f.pen.lit = f.vx.map(() => 0);
      f.pen.v = 0; f.pen.u = 1;
      f.pen.x0 = f.pen.x1 = f.x; f.pen.y0 = f.pen.y1 = f.y;
      // Burn in the first few jumps, which land off the fractal.
      for (let k = 0; k < 30; k++) jump(f);
      f.g?.clearRect(0, 0, f.cv?.width ?? 0, f.cv?.height ?? 0);
    }

    /** One jump toward a permitted corner; returns that corner. @param {Fig} f @returns {number} */
    function jump(f) {
      const n = f.vx.length;
      let v = 0;
      for (;;) {
        v = Math.floor(rng.random() * n);
        if (f.rule.ban === 1 && v === f.last) continue;
        if (f.rule.ban === 2 && v === (f.last + 1) % n) continue;
        break;
      }
      f.last = v;
      f.px = f.vx[v] + (f.px - f.vx[v]) * f.rule.r;
      f.py = f.vy[v] + (f.py - f.vy[v]) * f.rule.r;
      return v;
    }

    /** Plots k more dots into the figure's own canvas. @param {Fig} f @param {number} k */
    function plot(f, k) {
      const g = f.g;
      if (!g || k <= 0) return;
      const n = f.vx.length;
      for (let i = 0; i < n; i++) (bucket[i] ??= []).length = 0;
      for (let i = 0; i < k; i++) {
        const v = jump(f);
        bucket[v].push(f.px * s.dpr - f.ox, f.py * s.dpr - f.oy);
      }
      const d = Math.max(1, Math.round(1.1 * s.dpr));
      for (let i = 0; i < n; i++) {
        const b = bucket[i];
        if (!b.length) continue;
        g.fillStyle = col(i + f.ri);
        for (let j = 0; j < b.length; j += 2) g.fillRect(Math.floor(b[j]), Math.floor(b[j + 1]), d, d);
      }
      f.n += k;
    }

    /** The share of N a figure has by age `a`: quick at first, so the shape shows early. @param {number} a */
    const built = (a) => { const u = clamp(a / BUILD, 0, 1); return 1 - (1 - u) * (1 - u); };

    /** Sizes a figure's canvas to it and replots what it had. @param {Fig} f */
    function canvasFor(f) {
      const pad = 3;
      const x0 = Math.min(...f.vx), x1 = Math.max(...f.vx), y0 = Math.min(...f.vy), y1 = Math.max(...f.vy);
      f.ox = Math.floor(x0 * s.dpr) - pad; f.oy = Math.floor(y0 * s.dpr) - pad;
      const w = Math.ceil(x1 * s.dpr) - f.ox + pad, h = Math.ceil(y1 * s.dpr) - f.oy + pad;
      if (!f.cv) f.cv = document.createElement('canvas');
      f.cv.width = Math.max(1, w); f.cv.height = Math.max(1, h);
      f.g = f.cv.getContext('2d');
    }

    /** @param {number} x @param {number} y @param {number} w @param {number} h @param {number} age @returns {Fig} */
    function fig(x, y, w, h, age) {
      /** @type {Fig} */
      const f = { x, y, w, h, rule: RULES[0], vx: [], vy: [], px: x, py: y, last: 0, n: 0, N: 0, age: 0,
        cv: null, g: null, ox: 0, oy: 0, pace: 0.85 + rng.random() * 0.3, ri: 0,
        pen: { x0: x, y0: y, x1: x, y1: y, v: 0, u: 1, wait: rng.random(), lit: [] } };
      setRule(f, order[next++ % order.length]);
      canvasFor(f);
      f.age = age;
      plot(f, Math.round(f.N * built(age)));
      return f;
    }

    /** Where the figures go for this size: [x, y, half width, half height] each. @returns {number[][]} */
    function slots() {
      const m = Math.min(s.W, s.H);
      if (s.layout === 0) {
        const h = m * 0.44;
        return [[s.W / 2, s.H / 2, h, h]];
      }
      if (s.layout === 2) return [[s.W / 2, s.H / 2, s.W * 0.46, s.H * 0.45]];
      const cs = clamp(m * 0.5, 160, 440);
      let cols = Math.max(1, Math.round(s.W / cs)), rows = Math.max(1, Math.round(s.H / cs));
      while (cols * rows > 6) { if (cols >= rows) cols--; else rows--; }
      const cw = s.W / cols, ch = s.H / rows, h = Math.min(cw, ch) * 0.4;
      /** @type {number[][]} */
      const out = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([cw * (c + 0.5), ch * (r + 0.5), h, h]);
      return out;
    }

    return {
      lay() {
        const sl = slots();
        if (!laid || figs.length !== sl.length) {
          // New figures start part built, staggered so they never all fade together.
          const age0 = s.reduced ? BUILD * 0.7 : BUILD * 0.3;
          figs = sl.map(([x, y, w, h], k) => fig(x, y, w, h, sl.length > 1 ? (k * 9.7) % (BUILD + HOLD) : age0));
          laid = true;
          return;
        }
        // Same figures at a new size: rebuild each at its place and age.
        figs.forEach((f, k) => {
          const [x, y, w, h] = sl[k];
          const age = f.age;
          Object.assign(f, { x, y, w, h });
          setRule(f, f.ri);
          canvasFor(f);
          f.age = age;
          plot(f, Math.round(f.N * built(age)));
        });
      },
      step(dt) {
        for (const f of figs) {
          f.age += dt * f.pace;
          if (f.age > BUILD + HOLD + FADE) {
            if (next >= order.length) { order = rng.shuffle(order); next = 0; }
            if (order[next % order.length] === f.ri) next++;
            setRule(f, order[next++ % order.length]);
            continue;
          }
          plot(f, Math.round(f.N * built(f.age)) - f.n);
          // The pen takes one jump at a time, gliding to where it lands.
          const p = f.pen;
          p.u = Math.min(1, p.u + dt / 0.45);
          for (let i = 0; i < p.lit.length; i++) p.lit[i] = Math.max(0, p.lit[i] - dt / 1.2);
          p.wait -= dt;
          if (p.wait <= 0 && p.u >= 1) {
            p.x0 = p.x1; p.y0 = p.y1;
            const save = [f.px, f.py, f.last];
            f.px = p.x0; f.py = p.y0; f.last = p.v;
            p.v = jump(f);
            p.x1 = f.px; p.y1 = f.py;
            [f.px, f.py, f.last] = save;
            p.u = 0; p.wait = 0.8;
            p.lit[p.v] = 1;
          }
        }
      },
      draw() {
        const { ctx } = s;
        for (const f of figs) {
          const over = f.age - BUILD - HOLD;
          const fade = over > 0 ? clamp(1 - over / FADE, 0, 1) : clamp(f.age / 1.5, 0, 1);
          if (fade <= 0) continue;
          if (f.cv) {
            // The dots are drawn 1:1 at device pixels.
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = (s.dark ? 0.6 : 0.62) * fade;
            ctx.drawImage(f.cv, f.ox, f.oy);
            ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
          }
          // Corners, and the pen's jump from its last landing toward the corner it picked.
          const p = f.pen;
          const e = p.u * p.u * (3 - 2 * p.u);
          const x = p.x0 + (p.x1 - p.x0) * e, y = p.y0 + (p.y1 - p.y0) * e;
          const rr = clamp(Math.min(f.w, f.h) * 0.02, 2.5, 5);
          ctx.lineWidth = 1.5;
          for (let i = 0; i < f.vx.length; i++) {
            ctx.strokeStyle = ctx.fillStyle = col(i + f.ri);
            ctx.globalAlpha = 0.5 * fade;
            ctx.beginPath(); ctx.arc(f.vx[i], f.vy[i], rr, 0, TAU); ctx.stroke();
            if (p.lit[i] > 0) { ctx.globalAlpha = 0.5 * p.lit[i] * fade; ctx.fill(); }
          }
          ctx.strokeStyle = ctx.fillStyle = col(p.v + f.ri);
          ctx.globalAlpha = 0.35 * fade;
          ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.moveTo(p.x0, p.y0); ctx.lineTo(f.vx[p.v], f.vy[p.v]); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.62 * fade;
          ctx.beginPath(); ctx.arc(x, y, rr * 0.8, 0, TAU); ctx.fill();
        }
      },
    };
  });
}
