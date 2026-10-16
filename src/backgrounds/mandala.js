// Mandala: a symmetric mandala draws itself ring by ring from the centre out, petals growing,
// dots swelling and circles sweeping on in every symmetric copy at once; it rests, turning very
// slowly, then fades and a new one with a new symmetry begins. The seed picks the variant: one
// large mandala in the middle, a scattered few smaller ones each on its own cycle, or two big
// mandalas centred on opposite corners that draw in turn and leave the middle quiet.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {'petal'|'dots'|'circle'|'scallop'|'zigzag'|'rays'} Kind */
/** @typedef {{kind:Kind, r0:number, r1:number, k:number, off:number, c:number, spin:number}} Ring */
/** @typedef {{x:number, y:number, R:number, rings:Ring[], t0:number, life:number}} Mandala */

const RING_T = 0.9;   // seconds between ring starts
const GROW = 1.6;     // seconds a ring takes to draw
const HOLD = 6;       // seconds the finished mandala rests
const FADE = 3;       // seconds it takes to fade

/** @param {number} u @returns {number} */
const ease = (u) => { const v = clamp(u, 0, 1); return v * v * (3 - 2 * v); };

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    /** @type {Mandala[]} */
    let ms = [];
    let warmed = false, pw = 1, ph = 1;

    /** Builds a mandala's rings out to radius R. @param {number} x @param {number} y
     * @param {number} R @param {number} t0 @returns {Mandala} */
    function make(x, y, R, t0) {
      const n = [6, 8, 8, 10, 12, 12, 16][rng.int(7)];
      const kinds = /** @type {Kind[]} */ (['petal', 'dots', 'circle', 'scallop', 'zigzag', 'rays']);
      /** @type {Ring[]} */
      const rings = [];
      const count = clamp(Math.round(R / 34), 6, 11);
      let r = R * 0.06;
      const c0 = rng.int(s.colors.length);
      for (let i = 0; i < count && r < R; i++) {
        // Petal rings take the most room; plain circles the least.
        let kind = /** @type {Kind} */ ('petal');
        while (i > 0 && kind === rings[i - 1].kind) kind = kinds[rng.int(kinds.length)];
        const w = (kind === 'circle' ? 0.25 : kind === 'petal' ? 1.4 : 0.8 + rng.random() * 0.5) * (R - R * 0.06) / count;
        const r1 = Math.min(R, r + w);
        // Outer rings repeat more often than the symmetry, so their copies stay close together.
        const gap = clamp(R / 8, 28, 76) * (kind === 'dots' || kind === 'rays' ? 0.6 : 1);
        const k = n * clamp(Math.round((r + r1) / 2 * TAU / n / gap), 1, 8);
        rings.push({ kind, r0: r, r1, k, off: rng.random() < 0.5 ? 0 : 0.5, c: (c0 + i) % s.colors.length,
          spin: (i % 2 ? -1 : 1) * 0.018 });
        r = r1 + (kind === 'circle' ? 0 : w * 0.12);
      }
      const life = rings.length * RING_T + GROW + HOLD + FADE;
      return { x, y, R, rings, t0, life };
    }

    /** Where the mandalas sit for this size and variant, new ones from `t`. @param {number} t */
    function place(t) {
      const m = Math.min(s.W, s.H);
      if (s.layout === 0) {
        ms = [make(s.W / 2, s.H / 2, clamp(Math.hypot(s.W, s.H) * 0.33, 150, 760), t)];
      } else if (s.layout === 2) {
        const R = clamp(Math.max(m * 0.8, Math.max(s.W, s.H) * 0.5), 200, 900);
        const a = make(0, 0, R, t);
        const b = make(s.W, s.H, R, t);
        b.t0 = t - a.life / 2;
        ms = [a, b];
      } else {
        const n = clamp(Math.round(s.W * s.H / 260000), 3, 5);
        ms = [];
        for (let i = 0; i < n; i++) ms.push(scatter(t - (i / n) * 30));
      }
    }

    /** A smaller mandala at a free spot. @param {number} t0 @returns {Mandala} */
    function scatter(t0) {
      const m = Math.min(s.W, s.H);
      const R = clamp(m * (0.17 + rng.random() * 0.12), 70, 260);
      let best = { x: s.W / 2, y: s.H / 2 }, bestD = -1;
      for (let j = 0; j < 14; j++) {
        const x = R * 0.5 + rng.random() * (s.W - R), y = R * 0.5 + rng.random() * (s.H - R);
        let d = Infinity;
        for (const o of ms) d = Math.min(d, Math.hypot(o.x - x, o.y - y) - o.R);
        if (d > bestD) { bestD = d; best = { x, y }; }
      }
      return make(best.x, best.y, R, t0);
    }

    /** @param {Ring} g @param {Mandala} M @param {number} p 0..1 drawn @param {number} a alpha */
    function ring(g, M, p, a) {
      const { ctx } = s;
      const step = TAU / g.k, rot = s.t * g.spin + g.off * step;
      const mid = (g.r0 + g.r1) / 2, w = g.r1 - g.r0;
      const lw = clamp(M.R / 190, 1.5, 2.6);
      ctx.beginPath();
      let fill = false;
      for (let i = 0; i < g.k; i++) {
        const t = rot + i * step, cs = Math.cos(t), sn = Math.sin(t);
        // Local frame: u outward along the spoke, v across it.
        /** @param {number} u @param {number} v @returns {[number, number]} */
        const P = (u, v) => [M.x + cs * u - sn * v, M.y + sn * u + cs * v];
        if (g.kind === 'petal') {
          fill = true;
          const tip = g.r0 + w * p, half = Math.min(w * 0.4, mid * step * 0.5) * p;
          const m1 = g.r0 + w * p * 0.5;
          ctx.moveTo(...P(g.r0, 0));
          ctx.quadraticCurveTo(...P(m1, half * 2), ...P(tip, 0));
          ctx.quadraticCurveTo(...P(m1, -half * 2), ...P(g.r0, 0));
        } else if (g.kind === 'dots') {
          fill = true;
          const r = Math.min(w * 0.42, mid * step * 0.32) * p;
          if (r > 0.3) { const [x, y] = P(mid, 0); ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
        } else if (g.kind === 'circle') {
          // Each copy sweeps its own arc, so the circle closes symmetrically.
          ctx.moveTo(...P(mid, 0));
          ctx.arc(M.x, M.y, mid, t, t + step * p);
        } else if (g.kind === 'scallop') {
          const rr = Math.min(mid * Math.sin(step / 2), w * 0.9);
          const [x, y] = P(g.r0 + rr * 0.15, 0);
          ctx.moveTo(x + Math.cos(t - Math.PI / 2) * rr, y + Math.sin(t - Math.PI / 2) * rr);
          ctx.arc(x, y, rr, t - Math.PI / 2, t - Math.PI / 2 + Math.PI * p);
        } else if (g.kind === 'zigzag') {
          // One tooth per copy: up to the outer radius and back down.
          const h = mid * step / 2, [x0, y0] = P(g.r0, -h), [x1, y1] = P(g.r1, 0), [x2, y2] = P(g.r0, h);
          ctx.moveTo(x0, y0);
          const q = p * 2;
          if (q <= 1) ctx.lineTo(x0 + (x1 - x0) * q, y0 + (y1 - y0) * q);
          else { ctx.lineTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * (q - 1), y1 + (y2 - y1) * (q - 1)); }
        } else {
          ctx.moveTo(...P(g.r0, 0));
          ctx.lineTo(...P(g.r0 + w * p, 0));
          const [x, y] = P(g.r0 + w * p, 0), r = Math.max(1.5, lw * 1.2) * p;
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
        }
      }
      const col = s.colors[g.c];
      if (g.kind === 'dots') {
        // Dots are filled solid and not outlined: an outline round each costs more than it shows.
        ctx.fillStyle = col;
        ctx.globalAlpha = a * (s.dark ? 0.45 : 0.5);
        ctx.fill();
        return;
      }
      if (fill) {
        ctx.fillStyle = col;
        ctx.globalAlpha = a * (s.dark ? 0.2 : 0.24);
        ctx.fill();
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.globalAlpha = a * (s.dark ? 0.55 : 0.6);
      ctx.stroke();
    }

    return {
      lay() {
        if (warmed) {
          // A resize keeps each mandala where it was in the frame; new ones take the new size.
          for (const M of ms) { M.x = M.x * s.W / pw; M.y = M.y * s.H / ph; }
          pw = s.W; ph = s.H;
          return;
        }
        pw = s.W; ph = s.H;
        place(s.t);
        {
          warmed = true;
          // Start part-way through, so the first frame already shows rings.
          for (const M of ms) M.t0 -= M.rings.length * RING_T * 0.6;
        }
      },
      step() {
        for (let i = 0; i < ms.length; i++) {
          const M = ms[i];
          if (s.t - M.t0 < M.life) continue;
          if (s.layout === 1) { ms.splice(i, 1); ms.splice(i, 0, scatter(s.t)); }
          else ms[i] = make(M.x, M.y, M.R, s.t);
        }
      },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const M of ms) {
          const age = s.t - M.t0;
          if (age < 0) continue;
          const a = 1 - ease((age - (M.life - FADE)) / FADE);
          M.rings.forEach((g, i) => {
            const p = ease((age - i * RING_T) / GROW);
            if (p > 0.01) ring(g, M, p, a);
          });
        }
      },
    };
  });
}
