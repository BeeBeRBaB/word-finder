// Flow field: many short-lived particles ride an invisible, slowly changing flow, each trailing a
// fading line, so the curls of the field draw themselves. The seed picks the variant: eddies, a
// field of curling vortices that swirl and drift; wind, a steady stream across the host bending
// round slow meanders, like a wind map; or springs, particles welling out of a few drifting
// sources and swirling down into drains, tracing arcs like field lines between poles.

import { stage, TAU, clamp } from './stage.js';

const L = 43;      // trail points kept per particle (at most 7 pieces of SEG)
const SEG = 6;     // points per alpha step of a trail
const LV = 8;      // alpha levels the trails are batched into

/** @typedef {{hx:Float32Array, hy:Float32Array, head:number, n:number, age:number, life:number, c:number}} Mote */
/** @typedef {{x:number, y:number, q:number, fx:number, fy:number, ph:number}} Pole */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    /** @type {Mote[]} */
    let motes = [];
    let m = 1, speed = 50, warmed = false;
    // Eddies and wind: a stream function of a few travelling sines, so the flow never diverges.
    const waves = Array.from({ length: 4 }, (_, i) => ({ a: rng.random() * TAU, k: 1.6 + i * 0.9 + rng.random(),
      w: (rng.random() - 0.5) * 0.25, ph: rng.random() * TAU }));
    const wind = rng.random() < 0.5 ? 1 : -1;
    const tilt = (rng.random() - 0.5) * 0.5;
    // Springs: sources (q > 0) and drains (q < 0) wandering on slow loops, with a little swirl.
    /** @type {Pole[]} */
    const poles = [1, 1, -1, -1].map((q) => ({ x: rng.random(), y: rng.random(), q, fx: 0.02 + rng.random() * 0.02,
      fy: 0.02 + rng.random() * 0.02, ph: rng.random() * TAU }));
    const swirl = (rng.random() < 0.5 ? 1 : -1) * 0.45;
    /** @type {number[][]} */
    let polePts = [];
    /** Trail pieces per colour and alpha level, as mote index * 8 + piece. @type {number[][]} */
    const bins = Array.from({ length: C * LV }, () => []);

    /** @param {number} t */
    function placePoles(t) {
      polePts = poles.map((p) => [s.W * (0.12 + 0.76 * (0.5 + 0.5 * Math.sin(t * p.fx + p.ph + p.x * TAU))),
        s.H * (0.12 + 0.76 * (0.5 + 0.5 * Math.cos(t * p.fy + p.ph * 1.7 + p.y * TAU)))]);
    }

    /** The flow at x, y now, in px/s. @param {number} x @param {number} y @param {number[]} out */
    function flow(x, y, out) {
      const t = s.t;
      if (layout === 2) {
        let vx = 0, vy = 0;
        for (let i = 0; i < polePts.length; i++) {
          const dx = x - polePts[i][0], dy = y - polePts[i][1];
          const d2 = dx * dx + dy * dy + m * m * 0.002;
          const q = poles[i].q * m * 0.35 / d2;
          vx += q * (dx - swirl * dy); vy += q * (dy + swirl * dx);
        }
        const v = Math.hypot(vx, vy), lim = Math.min(1, 1.6 / Math.max(v, 1e-6));
        out[0] = vx * speed * lim; out[1] = vy * speed * lim;
        return;
      }
      // Velocity is the stream function's curl: (dpsi/dy, -dpsi/dx).
      let vx = 0, vy = 0;
      const amp = layout === 1 ? 0.5 : 1;
      for (const w of waves) {
        const kx = Math.cos(w.a) * w.k / m * TAU * 0.5, ky = Math.sin(w.a) * w.k / m * TAU * 0.5;
        const c = Math.cos(kx * x + ky * y + w.ph + t * w.w + 0.6 * Math.sin(t * 0.05 + w.ph)) * amp / w.k * 1.4;
        vx += c * Math.sin(w.a); vy -= c * Math.cos(w.a);
      }
      if (layout === 1) { vx += wind * Math.cos(tilt); vy += wind * Math.sin(tilt); }
      out[0] = vx * speed; out[1] = vy * speed;
    }

    /** @param {Mote} p */
    function spawn(p) {
      let x = rng.random() * s.W, y = rng.random() * s.H;
      if (layout === 2 && rng.random() < 0.6) {
        // Most well up from a source.
        const src = polePts[rng.int(2)], a = rng.random() * TAU, r = m * (0.02 + rng.random() * 0.05);
        x = src[0] + Math.cos(a) * r; y = src[1] + Math.sin(a) * r;
      }
      p.head = 0; p.n = 1; p.hx[0] = x; p.hy[0] = y; p.age = 0; p.life = 2.5 + rng.random() * 4;
    }

    const v2 = [0, 0];
    /** @param {number} dt */
    function advance(dt) {
      if (layout === 2) placePoles(s.t);
      for (const p of motes) {
        p.age += dt;
        const x = p.hx[p.head], y = p.hy[p.head];
        flow(x, y, v2);
        const nx = x + v2[0] * dt, ny = y + v2[1] * dt;
        let dead = p.age > p.life || nx < -40 || ny < -40 || nx > s.W + 40 || ny > s.H + 40;
        if (layout === 2) for (let i = 2; i < 4; i++) if (Math.hypot(nx - polePts[i][0], ny - polePts[i][1]) < m * 0.02) dead = true;
        if (dead) { spawn(p); continue; }
        p.head = (p.head + 1) % L; p.hx[p.head] = nx; p.hy[p.head] = ny;
        if (p.n < L) p.n++;
      }
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        speed = clamp(m * 0.08, 32, 80);
        placePoles(s.t);
        const n = clamp(Math.round(s.W * s.H / 3000), 140, 480);
        while (motes.length < n) {
          const p = { hx: new Float32Array(L), hy: new Float32Array(L), head: 0, n: 1, age: 0, life: 1, c: rng.int(C) };
          spawn(p);
          p.age = rng.random() * p.life;
          motes.push(p);
        }
        motes.length = n;
        for (const p of motes) {
          if (p.hx[p.head] > s.W + 40 || p.hy[p.head] > s.H + 40) spawn(p);
        }
        // Warm up once, so the first paint (all reduced motion shows) has full trails.
        if (!warmed) { warmed = true; for (let i = 0; i < 45; i++) advance(1 / 30); }
      },
      step(dt) { advance(Math.min(dt, 0.1)); },
      draw() {
        const { ctx } = s;
        for (const b of bins) b.length = 0;
        const pieces = Math.ceil((L - 1) / SEG);
        motes.forEach((p, i) => {
          const env = Math.min(1, p.age / 0.8, (p.life - p.age) / 1);
          for (let k = 0; k < pieces && k * SEG < p.n - 1; k++) {
            const lv = Math.round(env * (1 - k / pieces) * LV);
            if (lv > 0) bins[p.c * LV + lv - 1].push(i * 8 + k);
          }
        });
        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = clamp(m / 380, 1.3, 2.4);
        ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
        const top = s.dark ? 0.72 : 0.7;
        for (let c = 0; c < C; c++) {
          ctx.strokeStyle = s.colors[c];
          for (let lv = 0; lv < LV; lv++) {
            const b = bins[c * LV + lv];
            if (!b.length) continue;
            ctx.globalAlpha = top * (lv + 1) / LV;
            ctx.beginPath();
            for (const code of b) {
              const p = motes[code >> 3], k = code & 7;
              const j0 = k * SEG, j1 = Math.min(p.n - 1, j0 + SEG);
              let idx = (p.head - j0 + L) % L;
              ctx.moveTo(p.hx[idx], p.hy[idx]);
              for (let j = j0 + 1; j <= j1; j++) {
                idx = (p.head - j + L) % L;
                ctx.lineTo(p.hx[idx], p.hy[idx]);
              }
            }
            ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  });
}
