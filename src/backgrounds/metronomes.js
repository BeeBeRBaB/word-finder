// Metronomes: rows of metronomes tick out of step, each at its own tempo, and slowly fall into
// step as they pull on each other; after a while they are let go and drift apart again.
// Layout 0: shelves of metronomes, each shelf a board on two rollers that sways under them and
// so couples them. 1: a wide table of small ones, each pulled only by its neighbours, so step
// spreads in patches. 2: a few big ones whose weights slide to one height as they fall in step.

import { stage, clamp, TAU } from './stage.js';

/** @typedef {{x:number, y:number, h:number, ph:number, w:number, d:number, home:number, c:number,
 *   nb:number[], g:number, tick:number}} Metro
 * Base middle x, y and body height h; phase ph and natural rate w (rad/s); the weight's place d
 * along the arm and where it rests (home), 0..1; colour c; neighbours nb that pull on it; its
 * group g; seconds since its last tick. */
/** @typedef {{K:number, on:boolean, wait:number, sway:number, y:number, x0:number, x1:number}} Group
 * A set pulling on each other: coupling K (rad/s), whether pulling, seconds to the next change,
 * and for a shelf its sway (px), board y and ends. */

const A = 0.42;      // half swing in radians
const KMAX = 0.9;    // full coupling
const RAMP = 14;     // seconds coupling takes to come on

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const nc = s.colors.length;
    /** @type {Metro[]} */
    let ms = [];
    /** @type {Group[]} */
    let groups = [];
    let key = '', warm = true;

    /** Rate for a weight at d: higher up the arm swings slower. @param {number} d @returns {number} */
    const rate = (d) => TAU / (1.3 + d * 1.6);

    /** @param {number} x @param {number} y @param {number} h @param {number} g @returns {Metro} */
    function metro(x, y, h, g) {
      const home = L === 2 ? 0.25 + rng.random() * 0.65 : 0.45 + rng.random() * 0.1;
      return { x, y, h, ph: rng.random() * TAU, w: rate(home) * (L === 2 ? 1 : 0.93 + rng.random() * 0.14),
        d: home, home, c: rng.int(nc), nb: [], g, tick: 9 };
    }

    /** @param {number} y @param {number} x0 @param {number} x1 @returns {Group} */
    const group = (y, x0, x1) => ({ K: 0, on: false, wait: 3 + rng.random() * 10, sway: 0, y, x0, x1 });

    /** Fresh metronomes for this size. @returns {void} */
    function deal() {
      const m = Math.min(s.W, s.H);
      ms = []; groups = [];
      if (L === 0) {
        const h = clamp(m * 0.11, 34, 84), gap = h * 0.85;
        const rows = clamp(Math.floor(s.H / (h * 2.1)), 2, 6), gy = s.H / rows;
        for (let j = 0; j < rows; j++) {
          const n = clamp(Math.floor((s.W * 0.86 - gap) / gap), 3, 12);
          const x0 = (s.W - (n - 1) * gap) / 2, y = gy * (j + 0.5) + h * 0.6;
          const g = groups.length;
          groups.push(group(y, x0 - gap * 0.7, x0 + (n - 1) * gap + gap * 0.7));
          const first = ms.length;
          for (let i = 0; i < n; i++) ms.push(metro(x0 + i * gap, y, h, g));
          for (let i = first; i < ms.length; i++) for (let k = first; k < ms.length; k++) if (k !== i) ms[i].nb.push(k);
        }
      } else if (L === 1) {
        const h = clamp(m * 0.075, 26, 58), dx = h * 0.95, dy = h * 1.75;
        const cols = clamp(Math.floor(s.W / dx), 3, 16), rows = clamp(Math.floor(s.H / dy), 3, 9);
        const ox = (s.W - (cols - 1) * dx) / 2, oy = (s.H - (rows - 1) * dy) / 2 + h * 0.55;
        groups.push(group(0, 0, 0));
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          ms.push(metro(ox + i * dx + (j % 2 ? dx * 0.25 : -dx * 0.25), oy + j * dy, h, 0));
        }
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const me = ms[j * cols + i];
          if (i > 0) me.nb.push(j * cols + i - 1);
          if (i < cols - 1) me.nb.push(j * cols + i + 1);
          if (j > 0) me.nb.push((j - 1) * cols + i);
          if (j < rows - 1) me.nb.push((j + 1) * cols + i);
        }
      } else {
        const n = clamp(Math.round(s.W / clamp(m * 0.42, 120, 330)), 3, 6);
        const gap = s.W / n, h = clamp(Math.min(s.H * 0.42, gap * 1.15), 70, 300);
        const tall = s.H > s.W * 1.2;
        groups.push(group(0, 0, 0));
        if (tall) {
          // Two rows on a tall screen, the upper above the board's usual place.
          const k = 3, gx = s.W / k, hh = clamp(Math.min(s.H * 0.2, gx * 1.1), 70, 220);
          for (let j = 0; j < 2; j++) for (let i = 0; i < k; i++) ms.push(metro(gx * (i + 0.5), s.H * (j ? 0.95 : 0.3), hh, 0));
        } else {
          for (let i = 0; i < n; i++) ms.push(metro(gap * (i + 0.5), (s.H + h) / 2 + h * 0.1, h, 0));
        }
        for (let i = 0; i < ms.length; i++) for (let k = 0; k < ms.length; k++) if (k !== i) ms[i].nb.push(k);
      }
    }

    /** @param {number} dt @returns {void} */
    function advance(dt) {
      for (const g of groups) {
        g.wait -= dt;
        if (g.wait <= 0) { g.on = !g.on; g.wait = g.on ? 34 + rng.random() * 14 : 16 + rng.random() * 12; }
        g.K = clamp(g.K + (g.on ? dt : -dt * 3) * KMAX / RAMP, 0, KMAX);
      }
      const n = ms.length;
      const dph = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const me = ms[i], g = groups[me.g];
        let pull = 0;
        if (g.K > 0) {
          for (const k of me.nb) pull += Math.sin(ms[k].ph - me.ph);
          pull *= g.K / me.nb.length;
        }
        dph[i] = me.w + pull;
      }
      // Layout 2: weights slide toward the group's middle while pulling, home once let go.
      let mid = 0;
      if (L === 2) { for (const me of ms) mid += me.home; mid /= n || 1; }
      for (let i = 0; i < n; i++) {
        const me = ms[i];
        const before = Math.cos(me.ph);
        me.ph += dph[i] * dt;
        // A tick at each end of the swing, where cos(ph) changes sign.
        if ((before > 0) !== (Math.cos(me.ph) > 0)) me.tick = 0; else me.tick += dt;
        if (L === 2) {
          const to = groups[0].on ? mid : me.home;
          me.d += (to - me.d) * Math.min(1, dt * 0.12);
          me.w = rate(me.d);
        }
      }
      for (const g of groups) g.sway = 0;
      if (L === 0) {
        // Each board moves against the arms' mean swing: that motion is what couples them.
        const sum = groups.map(() => 0), cnt = groups.map(() => 0);
        for (const me of ms) { sum[me.g] += Math.sin(me.ph); cnt[me.g]++; }
        groups.forEach((g, j) => { g.sway = -sum[j] / (cnt[j] || 1) * ms[0].h * 0.09 * (0.3 + 0.7 * g.K / KMAX); });
      }
    }

    return {
      lay() {
        const k = `${s.W}x${s.H}`;
        if (k === key) return;
        key = k;
        const old = ms;
        deal();
        if (old.length === ms.length) old.forEach((o, i) => { ms[i].ph = o.ph; ms[i].c = o.c; });
        if (warm) {
          // Begin part-way in: one shelf or the table already half in step.
          warm = false;
          groups[0].on = true; groups[0].wait = 18; groups[0].K = KMAX;
          for (let i = 0; i < 90; i++) advance(1 / 15);
        }
      },
      step(dt) { if (dt > 0) advance(dt); },
      draw() {
        const { ctx } = s;
        /** @type {Path2D[]} */
        const bodies = s.colors.map(() => new Path2D()), weights = s.colors.map(() => new Path2D());
        const arms = new Path2D(), ticks = [new Path2D(), new Path2D(), new Path2D()], boards = new Path2D(), faces = new Path2D();
        let lw = 1.5;
        for (const g of groups) {
          if (L !== 0) continue;
          const h = ms[0].h;
          boards.rect(g.x0 + g.sway, g.y, g.x1 - g.x0, h * 0.09);
          // Two rollers that turn as the board slides.
          for (const rx of [g.x0 + (g.x1 - g.x0) * 0.18, g.x0 + (g.x1 - g.x0) * 0.82]) {
            const r = h * 0.13, cx = rx + g.sway / 2, cy = g.y + h * 0.09 + r;
            boards.moveTo(cx + r, cy); boards.arc(cx, cy, r, 0, TAU);
            const a = g.sway / 2 / r;
            boards.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r); boards.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          }
        }
        for (const me of ms) {
          const { h } = me;
          const x = me.x + groups[me.g].sway, y = me.y;
          const bw = h * 0.31, tw = h * 0.1;
          const b = bodies[me.c];
          b.moveTo(x - bw, y); b.lineTo(x + bw, y); b.lineTo(x + tw, y - h); b.lineTo(x - tw, y - h); b.closePath();
          // The scale behind the arm.
          faces.moveTo(x - tw * 0.55, y - h * 0.9); faces.lineTo(x + tw * 0.55, y - h * 0.9);
          faces.lineTo(x + bw * 0.4, y - h * 0.25); faces.lineTo(x - bw * 0.4, y - h * 0.25); faces.closePath();
          const th = A * Math.sin(me.ph), sx = Math.sin(th), cy = Math.cos(th);
          const px = x, py = y - h * 0.15, len = h * 0.95;
          arms.moveTo(px, py); arms.lineTo(px + sx * len, py - cy * len);
          // The sliding weight, a small block across the arm.
          const wd = (0.3 + me.d * 0.62) * len, wx = px + sx * wd, wy = py - cy * wd;
          const ux = cy * h * 0.075, uy = sx * h * 0.075, vx = sx * h * 0.06, vy = -cy * h * 0.06;
          const wp = weights[me.c];
          wp.moveTo(wx - ux - vx, wy - uy - vy); wp.lineTo(wx + ux - vx, wy + uy - vy);
          wp.lineTo(wx + ux * 0.7 + vx, wy + uy * 0.7 + vy); wp.lineTo(wx - ux * 0.7 + vx, wy - uy * 0.7 + vy); wp.closePath();
          if (me.tick < 0.45) {
            // A short arc past the arm's end, fading, marks the tick.
            const side = Math.sin(me.ph) > 0 ? 1 : -1, r = len * 1.06;
            const a0 = -Math.PI / 2 + side * (A - 0.06), a1 = -Math.PI / 2 + side * (A + 0.08);
            const tp = ticks[Math.min(2, Math.floor(me.tick / 0.15))];
            tp.moveTo(px + Math.cos(a0) * r, py + Math.sin(a0) * r);
            tp.arc(px, py, r, a0, a1, side < 0);
          }
          lw = Math.max(1.5, h * 0.02);
        }
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.strokeStyle = s.ink; ctx.fillStyle = s.ink;
        if (L === 0) {
          ctx.globalAlpha = s.dark ? 0.14 : 0.16; ctx.fill(boards, 'evenodd');
          ctx.globalAlpha = s.dark ? 0.38 : 0.45; ctx.lineWidth = 1.5; ctx.stroke(boards);
        }
        for (let k = 0; k < nc; k++) {
          ctx.fillStyle = s.colors[k];
          ctx.globalAlpha = s.dark ? 0.24 : 0.3; ctx.fill(bodies[k]);
          ctx.strokeStyle = s.colors[k];
          ctx.globalAlpha = s.dark ? 0.5 : 0.6; ctx.lineWidth = 1.5; ctx.stroke(bodies[k]);
        }
        ctx.fillStyle = s.ink; ctx.globalAlpha = s.dark ? 0.1 : 0.12; ctx.fill(faces);
        ctx.strokeStyle = s.ink;
        ctx.globalAlpha = s.dark ? 0.5 : 0.55; ctx.lineWidth = lw; ctx.stroke(arms);
        ctx.lineWidth = 1.5;
        ticks.forEach((tp, i) => { ctx.globalAlpha = (s.dark ? 0.4 : 0.48) * (1 - i / 3); ctx.stroke(tp); });
        for (let k = 0; k < nc; k++) {
          ctx.fillStyle = s.colors[k]; ctx.globalAlpha = s.dark ? 0.62 : 0.6; ctx.fill(weights[k]);
        }
      },
    };
  });
}
