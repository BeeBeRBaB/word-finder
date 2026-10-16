// Attractor: a few hundred particles follow the flow of a strange attractor, each trailing a
// short tail, and the whole figure turns slowly in 3D, nearer tails brighter, so the lobes and
// sheets of the attractor read over a faint trace of its shape. The seed picks the variant: the Lorenz
// butterfly, its two wings seen from the side as it turns; the Aizawa attractor, a sphere-like
// shell with a tube up its axis, seen from a little above; or the Halvorsen attractor, three
// curled lobes like a propeller, seen from near its axis of symmetry as it turns about it.

import { stage, TAU, clamp } from './stage.js';

/**
 * An attractor: its flow, a start point and the largest step that integrates it cleanly.
 * @typedef {{f:(p:number[], o:number[]) => void, p0:number[], h:number}} Flow
 * @typedef {{p:number[], hx:Float32Array, hy:Float32Array, hz:Float32Array, i:number, c:number}} Mote
 */

/** @type {Flow[]} */
const FLOWS = [
  // Lorenz, sigma 10, rho 28, beta 8/3; z is up.
  { f: (p, o) => { o[0] = 10 * (p[1] - p[0]); o[1] = p[0] * (28 - p[2]) - p[1]; o[2] = p[0] * p[1] - 8 / 3 * p[2]; },
    p0: [1, 1, 20], h: 0.004 },
  // Aizawa, a .95, b .7, c .6, d 3.5, e .25, f .1; z is up.
  { f: (p, o) => {
    const [x, y, z] = p;
    o[0] = (z - 0.7) * x - 3.5 * y; o[1] = 3.5 * x + (z - 0.7) * y;
    o[2] = 0.6 + 0.95 * z - z * z * z / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x * x * x;
  }, p0: [0.1, 0, 0], h: 0.01 },
  // Halvorsen, a 1.4, cyclically symmetric about the (1,1,1) diagonal.
  { f: (p, o) => {
    const [x, y, z] = p;
    o[0] = -1.4 * x - 4 * y - 4 * z - y * y; o[1] = -1.4 * y - 4 * z - 4 * x - z * z; o[2] = -1.4 * z - 4 * x - 4 * y - x * x;
  }, p0: [-1.48, -1.51, 2.04], h: 0.004 },
];

const TAIL = 24;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const flow = FLOWS[s.layout];
    const nc = Math.min(s.colors.length, 4);
    /** @type {Mote[]} */
    let motes = [];
    const k1 = [0, 0, 0], k2 = [0, 0, 0], mid = [0, 0, 0];

    /** One midpoint step of h. @param {number[]} p @param {number} h */
    function rk2(p, h) {
      flow.f(p, k1);
      for (let i = 0; i < 3; i++) mid[i] = p[i] + k1[i] * h / 2;
      flow.f(mid, k2);
      for (let i = 0; i < 3; i++) p[i] += k2[i] * h;
    }

    const s3 = 1 / Math.sqrt(3), s2 = 1 / Math.sqrt(2), s6 = 1 / Math.sqrt(6);
    /** The flow's point in view axes, up last: Halvorsen's (1,1,1) diagonal is brought up. @param {number[]} p @returns {number[]} */
    const axes = (p) => s.layout === 2
      ? [(p[0] - p[1]) * s2, (p[0] + p[1] - 2 * p[2]) * s6, (p[0] + p[1] + p[2]) * s3] : p.slice();

    // A long probe run gives start points spread along the attractor, its centre and size, its
    // typical speed, so every flow moves its particles alike on screen, and the faint trace
    // of its whole shape drawn behind them.
    /** @type {number[][]} */
    const seeds = [];
    const C = [0, 0, 0];
    let K = 1, pace = 1;
    /** @type {number[]} */
    const ghost = [];
    {
      const p = flow.p0.slice();
      for (let i = 0; i < 4000; i++) rk2(p, flow.h);
      const N = 24000;
      /** @type {number[][]} */
      const all = [];
      let sum = 0;
      for (let i = 0; i < N; i++) {
        const q = p.slice();
        rk2(p, flow.h);
        sum += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / flow.h;
        all.push(axes(p));
        if (i % 20 === 0) seeds.push(p.slice());
      }
      // Centred on the middle of its spread, not its mean, so lopsided lobes still sit centred.
      for (let j = 0; j < 3; j++) {
        const v = all.map((q) => q[j]).sort((a, b) => a - b);
        C[j] = (v[Math.floor(N * 0.01)] + v[Math.floor(N * 0.99)]) / 2;
      }
      const d = all.map((q) => Math.hypot(q[0] - C[0], q[1] - C[1], q[2] - C[2])).sort((u, v) => u - v);
      K = 1 / d[Math.floor(N * 0.98)];
      pace = 0.24 / (sum / N * K);
      // The trace keeps a point every 0.018 of the unit size along the path, up to 2400.
      let lx = 1e9, ly = 0, lz = 0;
      for (let i = 0; i < N && ghost.length < 7200; i++) {
        const x = (all[i][0] - C[0]) * K, y = (all[i][1] - C[1]) * K, z = (all[i][2] - C[2]) * K;
        if (Math.hypot(x - lx, y - ly, z - lz) < 0.018) continue;
        ghost.push(x, y, z); lx = x; ly = y; lz = z;
      }
    }

    /** Advances p by `sim` time units in clean steps. @param {number[]} p @param {number} sim */
    function advance(p, sim) {
      const n = Math.max(1, Math.ceil(sim / flow.h));
      for (let i = 0; i < n; i++) rk2(p, sim / n);
    }

    /** A particle at a random point of the attractor, its tail already run. @returns {Mote} */
    function mote() {
      const p = seeds[rng.int(seeds.length)].slice();
      const m = { p, hx: new Float32Array(TAIL), hy: new Float32Array(TAIL), hz: new Float32Array(TAIL), i: 0, c: 0 };
      for (let j = 0; j < TAIL; j++) { advance(p, pace / 30); push(m); }
      return m;
    }

    /** Records the particle's place as its newest tail point. @param {Mote} m */
    function push(m) {
      m.i = (m.i + 1) % TAIL;
      const q = axes(m.p);
      m.hx[m.i] = (q[0] - C[0]) * K;
      m.hy[m.i] = (q[1] - C[1]) * K;
      m.hz[m.i] = (q[2] - C[2]) * K;
    }

    let S = 100, cx = 0, cy = 0, sub = 0;
    const yaw0 = rng.random() * TAU;
    const spin = (rng.random() < 0.5 ? -1 : 1) * 0.05;
    /** Stroke buckets: colour x depth x age. @type {Path2D[]} */
    let paths = [];

    return {
      lay() {
        const n = clamp(Math.round(s.W * s.H / 3000), 140, 440);
        while (motes.length < n) { const m = mote(); m.c = motes.length % nc; motes.push(m); }
        motes.length = n;
        // A tall phone crops the sides a little rather than leave the figure behind the board.
        S = Math.min(Math.max(s.W * 0.46, s.H * 0.36), s.H * 0.56) * [1, 0.92, 0.85][s.layout];
        cx = s.W / 2; cy = s.H / 2;
      },
      step(dt) {
        // Tails take a point a frame (30 a second), whatever the frame rate gives.
        sub += dt * 30;
        const n = Math.min(3, Math.floor(sub));
        sub -= n;
        for (let j = 0; j < n; j++) {
          for (const m of motes) {
            advance(m.p, pace / 30);
            if (!(Math.abs(m.p[0]) + Math.abs(m.p[1]) + Math.abs(m.p[2]) < 1e4)) {
              const r = seeds[rng.int(seeds.length)]; m.p[0] = r[0]; m.p[1] = r[1]; m.p[2] = r[2];
            }
            push(m);
          }
        }
      },
      draw() {
        const { ctx } = s;
        const yaw = yaw0 + spin * s.t;
        const cyw = Math.cos(yaw), syw = Math.sin(yaw);
        // Lorenz and Aizawa stand on z; Halvorsen turns about its (1,1,1) diagonal, seen from near it.
        const tilt = s.layout === 0 ? 0.12 : s.layout === 1 ? 0.42 : 1.05;
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        const D = 3.4;
        paths = Array.from({ length: nc * 6 }, () => new Path2D());
        /** Each particle's head, a small square, by colour. */
        const heads = Array.from({ length: nc }, () => new Path2D());
        const hs = 2 / s.dpr * Math.max(1, Math.round(s.dpr));
        const out = [0, 0, 0];
        /** Projects a point into out: screen x, y and depth. @param {number} x @param {number} y @param {number} z */
        const proj = (x, y, z) => {
          // Turn about up, then tip toward the viewer.
          const rx = x * cyw - y * syw, ry = x * syw + y * cyw;
          const dz = ry * ct - z * st, up = ry * st + z * ct;
          const f = D / (D + dz);
          out[0] = cx + rx * S * f; out[1] = cy - up * S * f; out[2] = dz;
        };
        /** @param {Mote} m @param {number} q */
        const project = (m, q) => proj(m.hx[q], m.hy[q], m.hz[q]);
        // The faint trace of the whole attractor, so its shape reads behind the particles.
        const trace = new Path2D();
        for (let i = 0; i < ghost.length; i += 3) {
          proj(ghost[i], ghost[i + 1], ghost[i + 2]);
          if (i) trace.lineTo(out[0], out[1]); else trace.moveTo(out[0], out[1]);
        }
        for (const m of motes) {
          project(m, m.i);
          const base = (m.c * 2 + (out[2] > 0 ? 1 : 0)) * 3;
          for (let j = 0; j < TAIL; j++) {
            project(m, (m.i + 1 + j) % TAIL);
            // Oldest third faintest; each third starts where the last ended, so tails stay joined.
            const age = j < 8 ? 0 : j < 16 ? 1 : 2;
            const path = paths[base + age];
            if (j === 0) path.moveTo(out[0], out[1]);
            else path.lineTo(out[0], out[1]);
            if (j === 7 || j === 15) paths[base + age + 1].moveTo(out[0], out[1]);
          }
          heads[m.c].rect(out[0] - hs / 2, out[1] - hs / 2, hs, hs);
        }
        // One device pixel wide on a plain screen, where a hairline is far cheaper to draw than any
        // wider line; a little wider on dense screens, where one device pixel would be too fine.
        ctx.lineWidth = s.dpr < 1.5 ? 1 / s.dpr : 1.25;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = s.colors[0];
        ctx.globalAlpha = s.dark ? 0.16 : 0.2;
        ctx.stroke(trace);
        const al = s.dark ? [0.2, 0.42, 0.7] : [0.24, 0.48, 0.75];
        for (let c = 0; c < nc; c++) {
          ctx.strokeStyle = s.colors[c];
          for (let b = 0; b < 2; b++) {
            for (let a = 0; a < 3; a++) {
              ctx.globalAlpha = al[a] * (b ? 0.6 : 1);
              ctx.stroke(paths[(c * 2 + b) * 3 + a]);
            }
          }
          ctx.fillStyle = s.colors[c];
          ctx.globalAlpha = al[2];
          ctx.fill(heads[c]);
        }
      },
    };
  });
}
