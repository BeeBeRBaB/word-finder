// Clocks: drawn clock faces with hour, minute and second hands, each running at its own rate, so
// some barely move while on others the minute hand sweeps round. Never fast: a second hand shows
// only while it takes 6 s or more a turn. The seed picks the variant: a wall of clocks of many
// sizes, a few running backwards; one huge chronograph dial off the screen's edges with subdials
// counting at different rates; a grid of small clocks whose hands turn together into travelling
// patterns of lines, waves and rings.

import { stage, TAU, clamp, mix } from './stage.js';
import { makeRng } from '../rng.js';

/** @typedef {{x:number, y:number, r:number, rate:number, t0:number, c:number, h:number, num:boolean, tick:boolean}} Clock
 * Centre and radius; it shows t0 + rate·t clock seconds; colour c, hand colour h; numerals or
 * ticks; a ticking second hand steps once a second. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { layout } = s;
    const nc = s.colors.length;
    /** @type {Clock[]} */
    let clocks = [];
    /** The chronograph's subdials, as clocks with a single hand. @type {Clock[]} */
    let subs = [];
    let cols = 0, rows = 0, cell = 0, gx = 0, gy = 0;

    /** Packs clocks over the screen, big ones first. @returns {void} */
    function wall() {
      // The same clocks for the same size: a fresh rng from the seed each lay.
      const rng = makeRng(s.seed * 7919 + 3);
      const m = Math.min(s.W, s.H);
      const big = clamp(m * 0.2, 56, 190), gap = clamp(m * 0.025, 6, 18);
      /** @type {Clock[]} */
      const list = [];
      const rates = [1, 1, 1, 6, 10, 30, 60, 120, -20, -60];
      for (let i = 0; i < 1500 && list.length < 40; i++) {
        const r = big * (1 - 0.68 * Math.min(1, i / 900));
        const x = -r * 0.3 + rng.random() * (s.W + r * 0.6), y = -r * 0.3 + rng.random() * (s.H + r * 0.6);
        if (list.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r + gap)) continue;
        list.push({ x, y, r, rate: rates[rng.int(rates.length)], t0: rng.random() * 43200, c: rng.int(nc),
          h: rng.int(nc), num: r > 70 && rng.random() < 0.5, tick: rng.random() < 0.5 });
      }
      clocks = list;
    }

    /** One huge chronograph dial and its subdials. @returns {void} */
    function chrono() {
      // The same clocks for the same size: a fresh rng from the seed each lay.
      const rng = makeRng(s.seed * 7919 + 3);
      const R = Math.max(s.W, s.H) * 0.5;
      const cx = s.W / 2, cy = s.H / 2;
      clocks = [{ x: cx, y: cy, r: R, rate: 1, t0: rng.random() * 43200, c: 0, h: 1 % nc, num: false, tick: false }];
      // Subdials left, right and below, kept on screen, their hands turning once in 1, 5 and 30
      // minutes. A subdial hand turns once per 3600 of its clock seconds.
      const d = Math.min(R * 0.45, s.W * 0.3, s.H * 0.3), sr = Math.min(R * 0.19, d * 0.62);
      const spots = [[-d, 0, 60], [d, 0, 300], [0, d, 1800]];
      subs = spots.map(([dx, dy, turn], i) => ({ x: cx + dx, y: cy + dy, r: sr, rate: 3600 / turn,
        t0: rng.random() * 3600, c: (i + 2) % nc, h: (i + 1) % nc, num: false, tick: false }));
    }

    /** The grid for the pattern variant. @returns {void} */
    function grid() {
      cell = clamp(Math.min(s.W, s.H) * 0.16, 56, 112);
      cols = Math.ceil(s.W / cell) + 1; rows = Math.ceil(s.H / cell) + 1;
      gx = (s.W - (cols - 1) * cell) / 2; gy = (s.H - (rows - 1) * cell) / 2;
    }

    /** A face: rim, hour marks (numerals on some) and minute ticks. @param {Clock} c @param {number} A @returns {void} */
    function face(c, A) {
      const { ctx } = s;
      const { x, y, r } = c;
      ctx.fillStyle = ctx.strokeStyle = s.colors[c.c];
      ctx.globalAlpha = A * 0.12;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = A * 0.6;
      ctx.lineWidth = clamp(r * 0.035, 1.5, 4);
      ctx.stroke();
      ctx.lineWidth = clamp(r * 0.03, 1.5, 4);
      ctx.beginPath();
      for (let k = 0; k < 12; k++) {
        if (c.num && k % 3 === 0) continue;
        const a = k * TAU / 12, l = k % 3 ? 0.1 : 0.16;
        ctx.moveTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86);
        ctx.lineTo(x + Math.cos(a) * r * (0.86 - l), y + Math.sin(a) * r * (0.86 - l));
      }
      ctx.stroke();
      if (r > 50) {
        ctx.lineWidth = 1;
        ctx.globalAlpha = A * 0.4;
        ctx.beginPath();
        for (let k = 0; k < 60; k++) {
          if (k % 5 === 0) continue;
          const a = k * TAU / 60;
          ctx.moveTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86);
          ctx.lineTo(x + Math.cos(a) * r * 0.81, y + Math.sin(a) * r * 0.81);
        }
        ctx.stroke();
      }
      if (c.num) {
        ctx.globalAlpha = A * 0.7;
        ctx.font = `600 ${Math.round(r * 0.2)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const [n, a] of [[12, 0], [3, 1], [6, 2], [9, 3]]) {
          const ang = a * Math.PI / 2 - Math.PI / 2;
          ctx.fillText(String(n), x + Math.cos(ang) * r * 0.66, y + Math.sin(ang) * r * 0.66);
        }
      }
    }

    /** A hand from the centre at bearing a (0 = twelve o'clock), with a short tail.
     * @param {number} x @param {number} y @param {number} a @param {number} len @param {number} tail @returns {void} */
    function hand(x, y, a, len, tail) {
      const { ctx } = s;
      const dx = Math.sin(a), dy = -Math.cos(a);
      ctx.moveTo(x - dx * tail, y - dy * tail);
      ctx.lineTo(x + dx * len, y + dy * len);
    }

    /** Hands of a clock showing `t` clock seconds. @param {Clock} c @param {number} A @returns {void} */
    function hands(c, A) {
      const { ctx } = s;
      const t = c.t0 + c.rate * s.t, { x, y, r } = c;
      ctx.strokeStyle = s.colors[c.h];
      ctx.lineCap = 'round';
      ctx.globalAlpha = A * 0.65;
      ctx.lineWidth = clamp(r * 0.065, 2.5, 9);
      ctx.beginPath();
      hand(x, y, t / 43200 * TAU, r * 0.5, r * 0.08);
      ctx.stroke();
      ctx.lineWidth = clamp(r * 0.04, 2, 6);
      ctx.beginPath();
      hand(x, y, t / 3600 * TAU, r * 0.76, r * 0.1);
      ctx.stroke();
      // A second hand only while it is slow: 6 s a turn or more.
      if (Math.abs(c.rate) <= 10) {
        const sec = c.tick && c.rate === 1 ? Math.floor(t) : t;
        ctx.strokeStyle = s.colors[(c.h + 1) % nc];
        ctx.lineWidth = clamp(r * 0.015, 1.2, 2.5);
        ctx.beginPath();
        hand(x, y, sec / 60 * TAU, r * 0.82, r * 0.2);
        ctx.stroke();
      }
      ctx.fillStyle = s.colors[c.h];
      ctx.globalAlpha = A * 0.85;
      ctx.beginPath();
      ctx.arc(x, y, clamp(r * 0.06, 2.5, 8), 0, TAU);
      ctx.fill();
    }

    /** The chronograph: tachymeter scale, baton indices, subdials and big hands. @param {number} A @returns {void} */
    function drawChrono(A) {
      const { ctx } = s;
      const c = clocks[0], { x, y, r } = c;
      ctx.strokeStyle = s.colors[c.c];
      ctx.globalAlpha = A * 0.45;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.97, 0, TAU);
      ctx.moveTo(x + r * 0.88, y);
      ctx.arc(x, y, r * 0.88, 0, TAU);
      ctx.stroke();
      // Fine scale between the outer rings, every 1/240 of a turn.
      ctx.lineWidth = 1;
      ctx.globalAlpha = A * 0.35;
      ctx.beginPath();
      for (let k = 0; k < 240; k++) {
        const a = k * TAU / 240, l = k % 4 ? 0.02 : 0.045;
        ctx.moveTo(x + Math.cos(a) * r * 0.97, y + Math.sin(a) * r * 0.97);
        ctx.lineTo(x + Math.cos(a) * r * (0.97 - l), y + Math.sin(a) * r * (0.97 - l));
      }
      ctx.stroke();
      // Baton hour indices.
      ctx.globalAlpha = A * 0.55;
      ctx.lineWidth = clamp(r * 0.018, 4, 14);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k < 12; k++) {
        const a = k * TAU / 12;
        ctx.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
        ctx.lineTo(x + Math.cos(a) * r * (k % 3 ? 0.74 : 0.7), y + Math.sin(a) * r * (k % 3 ? 0.74 : 0.7));
      }
      ctx.stroke();
      for (const sd of subs) {
        face(sd, A);
        const t = sd.t0 + sd.rate * s.t;
        ctx.strokeStyle = s.colors[sd.h];
        ctx.globalAlpha = A * 0.75;
        ctx.lineWidth = clamp(sd.r * 0.04, 1.5, 4);
        ctx.beginPath();
        hand(sd.x, sd.y, t / 3600 * TAU, sd.r * 0.8, sd.r * 0.15);
        ctx.stroke();
        ctx.fillStyle = s.colors[sd.h];
        ctx.beginPath();
        ctx.arc(sd.x, sd.y, clamp(sd.r * 0.06, 2, 6), 0, TAU);
        ctx.fill();
      }
      // Hour and minute hands at 20x, and a chronograph seconds hand once round a minute.
      const t = c.t0 + 20 * s.t;
      ctx.strokeStyle = s.colors[c.h];
      ctx.globalAlpha = A * 0.42;
      ctx.lineWidth = clamp(r * 0.025, 5, 18);
      ctx.beginPath();
      hand(x, y, t / 43200 * TAU, r * 0.5, r * 0.06);
      ctx.stroke();
      ctx.lineWidth = clamp(r * 0.016, 4, 12);
      ctx.beginPath();
      hand(x, y, t / 3600 * TAU, r * 0.78, r * 0.06);
      ctx.stroke();
      ctx.strokeStyle = s.colors[(c.h + 1) % nc];
      ctx.globalAlpha = A * 0.55;
      ctx.lineWidth = 2;
      ctx.beginPath();
      hand(x, y, s.t / 60 * TAU + c.t0, r * 0.92, r * 0.15);
      ctx.stroke();
      ctx.fillStyle = s.colors[c.h];
      ctx.globalAlpha = A * 0.7;
      ctx.beginPath();
      ctx.arc(x, y, clamp(r * 0.025, 5, 16), 0, TAU);
      ctx.fill();
    }

    /** Hand bearings for pattern k at cell (i, j), time t. @param {number} k @param {number} i @param {number} j @param {number} t @returns {number[]} */
    function pattern(k, i, j, t) {
      const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
      switch (k) {
        case 0: { // Parallel lines, the whole field turning slowly.
          const a = t * 0.12;
          return [a, a + Math.PI];
        }
        case 1: { // A wave travelling across: hands open and close like wings.
          const p = Math.sin(i * 0.55 - j * 0.3 - t * 0.6) * 1.1;
          return [Math.PI / 2 + p, -Math.PI / 2 - p];
        }
        case 2: { // Rings: hands tangent to circles round the middle, turning with them.
          const a = Math.atan2(j - cy, i - cx) + t * 0.08;
          return [a, a + Math.PI];
        }
        default: { // Diamonds: hands make a lattice of Vs that shifts with a slow phase.
          const p = (i + j) % 2 ? 1 : -1, q = Math.sin(t * 0.25) * 0.4;
          return [Math.PI * 0.25 * p + q, Math.PI * (1 - 0.25 * p) - q];
        }
      }
    }

    /** The pattern grid: each clock's two hands go to the current pattern, the change sweeping
     * across the grid over a few seconds. @param {number} A @returns {void} */
    function drawGrid(A) {
      const { ctx } = s;
      const hold = 9, move = 5, cyc = hold + move;
      const n = Math.floor(s.t / cyc), into = s.t - n * cyc;
      const k0 = (n + s.seed) % 4, k1 = (n + 1 + s.seed) % 4;
      const r = cell * 0.44;
      ctx.strokeStyle = s.colors[0];
      ctx.globalAlpha = A * 0.4;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = gx + i * cell, y = gy + j * cell;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
      ctx.stroke();
      ctx.strokeStyle = s.colors[1 % nc];
      ctx.globalAlpha = A * 0.6;
      ctx.lineWidth = clamp(cell * 0.055, 3, 6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = gx + i * cell, y = gy + j * cell;
        const a = pattern(k0, i, j, s.t);
        if (into > hold) {
          // Each hand turns forward to its next bearing, the sweep crossing the grid diagonally.
          const lag = (i + j) / (cols + rows) * 0.5;
          const u = clamp(((into - hold) / move - lag) / 0.5, 0, 1), e = u * u * (3 - 2 * u);
          const b = pattern(k1, i, j, s.t);
          for (let h = 0; h < 2; h++) {
            const d = ((b[h] - a[h]) % TAU + TAU) % TAU;
            a[h] = mix(a[h], a[h] + d, e);
          }
        }
        hand(x, y, a[0], r * 0.82, 0);
        hand(x, y, a[1], r * 0.82, 0);
      }
      ctx.stroke();
    }

    return {
      lay() {
        if (layout === 0) wall();
        else if (layout === 1) chrono();
        else grid();
      },
      step() {},
      draw() {
        const A = s.dark ? 1 : 1.05;
        if (layout === 0) for (const c of clocks) { face(c, A); hands(c, A); }
        else if (layout === 1) drawChrono(A);
        else drawGrid(A);
      },
    };
  });
}
