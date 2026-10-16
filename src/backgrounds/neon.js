// Neon: glass tubes, faint while off, light up from one end to the other, a bright point running
// ahead of the glow, then hold with a slow, even breath (never a flicker) and fade back out. The
// seed picks the variant: a wall of small signs (heart, star, moon, bolt, note and more) each on
// its own clock, nested frames lighting from the middle outward one after another, or rows of
// looping script that write themselves across the host.

import { stage, TAU, clamp } from './stage.js';

/**
 * @typedef {{lines:Float32Array[], cum:Float32Array[], len:number}} Tube
 * lines are strokes of x, y pairs; cum[k][i] the length along the tube to point i of stroke k.
 * @typedef {{tube:Tube, x:number, y:number, sc:number, rot:number, c:number, phase:number,
 *   wait:number, u:number, ph:number, kind:number, cv:HTMLCanvasElement|null, baked:boolean,
 *   box:number[]}} Sign
 * phase 0 off, 1 lighting (u 0..1), 2 lit, 3 fading, 4 a new tube fading in while off, 5 done
 * (nest and rows wait for the rest); cv holds the lit tube once baked, over box x, y, w, h.
 */

/** Points of a curve x(t), y(t) for t in 0..1. @param {(t:number) => number[]} f @param {number} n @returns {number[]} */
function curve(f, n) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(...f(i / n));
  return out;
}

/** The small signs, in a unit box about the origin, y down. Each is one or more strokes. */
const SHAPES = [
  // heart
  () => [curve((t) => { const a = t * TAU; return [Math.sin(a) ** 3 * 0.95, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17 - 0.1]; }, 72)],
  // star
  () => [curve((t) => { const k = Math.round(t * 10) % 10, a = k / 10 * TAU - Math.PI / 2, r = k % 2 ? 0.42 : 1; return [Math.cos(a) * r, Math.sin(a) * r + 0.08]; }, 10)],
  // crescent moon
  () => [[...curve((t) => { const a = (0.3 + 1.4 * t) * Math.PI; return [Math.cos(a), Math.sin(a)]; }, 48),
    ...curve((t) => { const a = (1.5 - t) * Math.PI; return [0.6 + Math.cos(a) * 0.81, Math.sin(a) * 0.81]; }, 36)]],
  // lightning bolt
  () => [[0.25, -1, -0.45, 0.12, -0.02, 0.12, -0.25, 1, 0.5, -0.18, 0.06, -0.18, 0.4, -1, 0.25, -1]],
  // music note: head, stem, flag
  () => [curve((t) => [-0.35 + Math.cos(t * TAU) * 0.3, 0.65 + Math.sin(t * TAU) * 0.22], 30),
    [-0.05, 0.62, -0.05, -0.95], curve((t) => [-0.05 + t * 0.55, -0.95 + Math.sin(t * Math.PI * 0.9) * 0.25 + t * 0.55], 16)],
  // cocktail glass
  () => [[-0.85, -0.8, 0.85, -0.8, 0, 0.15, -0.85, -0.8], [0, 0.15, 0, 0.85], [-0.45, 0.88, 0.45, 0.88],
    curve((t) => [0.45 + Math.cos(t * TAU) * 0.18, -0.95 + Math.sin(t * TAU) * 0.18], 20)],
  // spiral
  () => [curve((t) => { const a = t * 3.2 * TAU, r = 0.08 + t * 0.92; return [Math.cos(a) * r, Math.sin(a) * r]; }, 120)],
  // cloud
  () => [curve((t) => {
    const a = t * TAU, bumps = 0.12 * Math.max(0, Math.sin(a * 5));
    return [Math.cos(a) * (0.95 + bumps), Math.sin(a) * (0.55 + bumps) - (Math.sin(a) < 0 ? 0.1 : 0)];
  }, 90)],
  // arrow, bent
  () => [curve((t) => [-0.95 + t * 1.75, 0.35 - Math.sin(t * Math.PI) * 0.5 + t * 0.1], 30), [0.45, 0.1, 0.82, 0.45, 0.35, 0.68]],
  // eye
  () => [curve((t) => { const a = t * TAU; return [Math.cos(a), Math.sin(a) * 0.48 * Math.abs(Math.sin(a)) ** 0.2]; }, 60),
    curve((t) => [Math.cos(t * TAU) * 0.28, Math.sin(t * TAU) * 0.28], 24)],
];

/** Builds a tube from strokes, measuring it. @param {number[][]} strokes @returns {Tube} */
function tube(strokes) {
  const lines = strokes.map((p) => new Float32Array(p));
  let len = 0;
  const cum = lines.map((p) => {
    const c = new Float32Array(p.length / 2);
    for (let i = 1; i < c.length; i++) { len += Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]); c[i] = len; }
    if (c.length) c[0] = c.length > 1 ? c[1] - Math.hypot(p[2] - p[0], p[3] - p[1]) : len;
    return c;
  });
  return { lines, cum, len };
}

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Sign[]} */
    let signs = [];
    let w = 2;
    const tip = [0, 0];
    /** @type {HTMLCanvasElement[]} */
    const sparks = s.colors.map((c) => spark(c));
    // Glow passes: width times the tube's, and alpha. Kept narrow: wide strokes cost on big hosts.
    const PASSES = s.dark ? [[3.4, 0.14], [1, 0.8], [0.4, 0.4]] : [[3, 0.16], [1, 0.82]];

    /**
     * Adds the first `upto` of a tube's length to the path, in screen space via `map`; leaves
     * the far end in `tip`.
     * @param {Tube} t @param {number} upto @param {(x:number, y:number) => void} move @param {(x:number, y:number) => void} line
     */
    function trace(t, upto, move, line) {
      for (let k = 0; k < t.lines.length; k++) {
        const p = t.lines[k], c = t.cum[k];
        if (c[0] > upto) return;
        move(p[0], p[1]); tip[0] = p[0]; tip[1] = p[1];
        for (let i = 1; i < c.length; i++) {
          if (c[i] <= upto) { line(p[i * 2], p[i * 2 + 1]); tip[0] = p[i * 2]; tip[1] = p[i * 2 + 1]; continue; }
          const f = (upto - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]);
          tip[0] = p[i * 2 - 2] + (p[i * 2] - p[i * 2 - 2]) * f; tip[1] = p[i * 2 - 1] + (p[i * 2 + 1] - p[i * 2 - 1]) * f;
          line(tip[0], tip[1]);
          return;
        }
      }
    }

    /** A sign's tube for its kind, in its own units. @param {Sign} g @returns {Tube} */
    function build(g) {
      if (layout === 0) return tube(SHAPES[g.kind]());
      if (layout === 1) {
        // A rounded frame k of the nest, in px about the host's centre, starting top middle.
        const k = g.kind, f = 0.14 + k * 0.155, hw = s.W / 2 * f + w * 6, hh = s.H / 2 * f + w * 6;
        const r = Math.min(hw, hh) * (k % 2 ? 0.2 : 0.5);
        const pts = [0, -hh];
        /** @param {number} cx @param {number} cy @param {number} a0 */
        const arc = (cx, cy, a0) => { for (let i = 0; i <= 16; i++) { const a = a0 + i / 16 * Math.PI / 2; pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } };
        arc(hw - r, -hh + r, -Math.PI / 2); arc(hw - r, hh - r, 0); arc(-hw + r, hh - r, Math.PI / 2); arc(-hw + r, -hh + r, Math.PI);
        pts.push(0, -hh);
        return tube([pts]);
      }
      // A row of loops across the host: a trochoid, its loop size and count from the seed.
      const m = Math.min(s.W, s.H), r = clamp(m * 0.07, 22, 70), step = r * (1.5 + rng.random() * 0.7);
      const loops = Math.ceil((s.W + 4 * r) / step), sx = -2 * r, dir = g.kind % 2 ? -1 : 1;
      const pts = curve((t) => {
        const a = t * loops * TAU;
        const x = sx + t * loops * step - r * Math.sin(a) * 0.9;
        return [dir > 0 ? x : s.W - x, r * -Math.cos(a) * 0.9 + Math.sin(t * 5 + g.ph) * r * 0.25];
      }, loops * 28);
      return tube([pts]);
    }

    /** Puts signs on the host for its size. @returns {void} */
    function place() {
      const m = Math.min(s.W, s.H);
      w = clamp(m / 260, 1.8, 3.6);
      /** @type {Sign[]} */
      const out = [];
      /** @param {number} kind @param {number} x @param {number} y @param {number} sc @param {number} rot */
      const add = (kind, x, y, sc, rot) => {
        const old = signs[out.length];
        /** @type {Sign} */
        const g = { tube: { lines: [], cum: [], len: 0 }, x, y, sc, rot, cv: null, baked: false, box: [0, 0, 0, 0], c: old ? old.c : rng.int(nc), phase: old ? old.phase : 0,
          wait: old ? old.wait : 0, u: old ? old.u : 0, ph: old ? old.ph : rng.random() * TAU, kind: old && layout === 0 ? old.kind : kind };
        g.tube = build(g);
        out.push(g);
      };
      if (layout === 0) {
        const cell = clamp(m / 3.2, 120, 260), nx = Math.max(2, Math.round(s.W / cell)), ny = Math.max(2, Math.round(s.H / cell));
        const gw = s.W / nx, gh = s.H / ny, sc = Math.min(gw, gh) * 0.3;
        const deck = rng.shuffle([...SHAPES.keys()]);
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          add(deck[(j * nx + i) % deck.length], gw * (i + 0.5 + (rng.random() - 0.5) * 0.3), gh * (j + 0.5 + (rng.random() - 0.5) * 0.3),
            sc * (0.8 + rng.random() * 0.35), (rng.random() - 0.5) * 0.4);
        }
      } else if (layout === 1) {
        for (let k = 0; k < 6; k++) add(k, s.W / 2, s.H / 2, 1, 0);
      } else {
        const rows = clamp(Math.round(s.H / 300), 2, 3);
        for (let k = 0; k < rows; k++) add(k, 0, s.H * (k + 0.5) / rows, 1, 0);
      }
      signs = out;
    }

    /** Starts the cycle over for the nest or the rows, each tube a beat after the last. @returns {void} */
    function relight() {
      const c0 = rng.int(nc);
      signs.forEach((g, k) => { g.phase = 4; g.u = 0; g.baked = false; g.wait = 0.2 + k * (layout === 1 ? 0.9 : 1.8); g.c = (c0 + k) % nc; g.ph = rng.random() * TAU; });
      if (layout === 2) for (const g of signs) g.tube = build(g);
    }

    /** Strokes the current path as a lit tube. @param {CanvasRenderingContext2D} c @param {string} col @param {number} a */
    function glow(c, col, a) {
      for (let i = 0; i < PASSES.length; i++) {
        c.globalAlpha = PASSES[i][1] * a;
        c.strokeStyle = i === 2 ? '#fff' : col;
        c.lineWidth = w * PASSES[i][0];
        c.stroke();
      }
    }

    /** Paints a sign's lit tube once into its own canvas, to blit while it holds. @param {Sign} g @returns {void} */
    function bake(g) {
      const co = Math.cos(g.rot) * g.sc, si = Math.sin(g.rot) * g.sc;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of g.tube.lines) {
        for (let i = 0; i < p.length; i += 2) {
          const x = g.x + p[i] * co - p[i + 1] * si, y = g.y + p[i] * si + p[i + 1] * co;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      }
      const m = w * 2 + 2;
      g.box = [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
      const cv = g.cv ?? document.createElement('canvas');
      g.cv = cv;
      cv.width = Math.ceil(g.box[2] * s.dpr); cv.height = Math.ceil(g.box[3] * s.dpr);
      const c = cv.getContext('2d');
      g.baked = true;
      if (!c) return;
      c.setTransform(s.dpr, 0, 0, s.dpr, -g.box[0] * s.dpr, -g.box[1] * s.dpr);
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath();
      trace(g.tube, Infinity, (x, y) => c.moveTo(g.x + x * co - y * si, g.y + x * si + y * co),
        (x, y) => c.lineTo(g.x + x * co - y * si, g.y + x * si + y * co));
      glow(c, s.colors[g.c % nc], 1);
    }

    /** Runs a sign's clock on. @param {Sign} g @param {number} dt @param {number} k its place @returns {void} */
    function tick(g, dt, k) {
      g.wait -= dt;
      if (g.phase === 1) {
        // Light along the tube at a steady pace, whatever its length.
        const pace = layout === 0 ? 2.4 : layout === 1 ? 2.8 : 7;
        g.u = Math.min(1, g.u + dt / pace);
        if (g.u >= 1) { g.phase = 2; g.wait = layout === 0 ? 5 + rng.random() * 4 : 4 + (signs.length - k) * (layout === 1 ? 0.9 : 1.8); }
      } else if (g.wait > 0) return;
      else if (g.phase === 2) { g.phase = 3; g.wait = 1.6; }
      else if (g.phase === 3) {
        if (layout !== 0) { g.phase = 5; return; }
        g.phase = 4; g.wait = 1.2; g.kind = (g.kind + 1 + rng.int(SHAPES.length - 1)) % SHAPES.length; g.c = rng.int(nc); g.baked = false;
        g.tube = build(g);
      } else if (g.phase === 4) { g.phase = 1; g.u = 0; }
      else if (g.phase === 0) { g.phase = 1; g.u = 0; }
    }

    return {
      lay() {
        const first = !signs.length;
        place();
        if (!first) return;
        if (layout === 0) {
          // Each sign somewhere in its cycle: some lit, some lighting, a few dark.
          for (const g of signs) {
            const r = rng.random();
            if (r < 0.55) { g.phase = 2; g.u = 1; g.wait = rng.random() * 6; } else if (r < 0.85) { g.phase = 1; g.u = rng.random(); } else { g.phase = 0; g.wait = rng.random() * 2; }
          }
        } else {
          relight();
          // Warm up so the first tubes are lit and the next mid-way.
          for (let i = 0; i < (layout === 1 ? 70 : 60); i++) signs.forEach((g, k) => tick(g, 0.1, k));
        }
      },
      step(dt) {
        signs.forEach((g, k) => tick(g, dt, k));
        if (layout !== 0 && signs.every((g) => g.phase === 5)) relight();
      },
      draw() {
        const { ctx, dpr } = s;
        // Bevel joins: the curves are fine enough to hide them, and round joins cost on big hosts.
        ctx.lineJoin = 'bevel'; ctx.lineCap = 'round';
        for (const g of signs) {
          const co = Math.cos(g.rot) * g.sc, si = Math.sin(g.rot) * g.sc;
          /** @param {number} x @param {number} y */
          const move = (x, y) => ctx.moveTo(g.x + x * co - y * si, g.y + x * si + y * co);
          /** @param {number} x @param {number} y */
          const line = (x, y) => ctx.lineTo(g.x + x * co - y * si, g.y + x * si + y * co);
          // The glass, faint, whether lit or not.
          const glass = g.phase === 4 ? clamp(1 - g.wait / 1.2, 0, 1) : g.phase === 5 ? 0 : 1;
          const off = g.phase === 3 ? Math.max(0, g.wait) / 1.6 : 1;
          // The glass, unless the lit tube hides it.
          if (g.phase !== 2) {
            ctx.beginPath();
            trace(g.tube, Infinity, move, line);
            ctx.globalAlpha = (s.dark ? 0.1 : 0.14) * (g.phase === 3 && layout !== 0 ? off : glass);
            ctx.strokeStyle = s.ink; ctx.lineWidth = w * 1.4; ctx.stroke();
          }
          if (g.phase !== 1 && g.phase !== 2 && g.phase !== 3) continue;
          const lit = g.tube.len * (g.phase === 1 ? g.u : 1);
          if (g.phase === 1 || layout === 1) { ctx.beginPath(); trace(g.tube, lit, move, line); }
          const breath = g.phase === 1 ? 1 : 0.9 + 0.1 * Math.sin(s.t * TAU / 4.5 + g.ph);
          if (g.phase !== 1 && layout !== 1) {
            // A held tube is blitted from its bake: stroking long glows each frame costs.
            if (!g.baked) bake(g);
            ctx.globalAlpha = breath * off;
            if (g.cv) ctx.drawImage(g.cv, g.box[0], g.box[1], g.box[2], g.box[3]);
          } else glow(ctx, s.colors[g.c % nc], breath * off);
          if (g.phase === 1) {
            // The bright point at the tube's lit end.
            const x = g.x + tip[0] * co - tip[1] * si, y = g.y + tip[0] * si + tip[1] * co, d = w * 7;
            ctx.globalAlpha = s.dark ? 0.7 : 0.8;
            ctx.drawImage(sparks[g.c % nc], x - d, y - d, d * 2, d * 2);
          }
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      },
    };
  });
}

/** A small round glow, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function spark(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 32, 32);
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.25, 'rgba(0,0,0,.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return c;
}
