// Brushstrokes: broad strokes of paint sweep on in the look's colours, swelling from a pressed
// start and thinning to a dry-brush end where the bristles part into streaks; each rests a few
// seconds, fades, and a new one is laid somewhere else. The seed picks the variant: loose
// gestural strokes at any angle; long washes dragged across the whole width in bands, like a
// painted landscape; or ensō, single brushed circles left open where the brush lifted.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{xs:Float32Array, ys:Float32Array, nx:Float32Array, ny:Float32Array, w:Float32Array,
 *   bristles:{v:number, end:number}[], at:number, sweep:number, hold:number, c:number,
 *   cx:number, cy:number}} Stroke points along the spine with their normals and widths */

const M = 40;      // points along a spine
const FADE = 3;    // seconds a stroke takes to fade
const BODY = 0.8;  // fraction of the stroke the solid paint reaches; bristles carry on past it

/** @param {number} u @returns {number} */
const ease = (u) => { const v = clamp(u, 0, 1); return v * v * (3 - 2 * v); };

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    /** @type {Stroke[]} */
    let strokes = [];
    let band = 0, warmed = false, pw = 1, ph = 1;

    /** Turns a spine function into a stroke. @param {(u:number) => [number, number]} at
     * @param {number} width @param {number} t0 @returns {Stroke} */
    function make(at, width, t0) {
      const xs = new Float32Array(M), ys = new Float32Array(M), nx = new Float32Array(M);
      const ny = new Float32Array(M), w = new Float32Array(M);
      const ph1 = rng.random() * TAU, ph2 = rng.random() * TAU;
      for (let i = 0; i < M; i++) {
        const u = i / (M - 1), [x, y] = at(u);
        xs[i] = x; ys[i] = y;
        // Pressed on fast, carried with a slow wobble, thinned out towards the lift.
        const press = 0.55 + 0.45 * Math.min(1, u / 0.1) ** 0.6, lift = 1 - 0.55 * ease((u - 0.45) / 0.55);
        w[i] = width * press * lift * (1 + 0.08 * Math.sin(u * 9 + ph1) + 0.05 * Math.sin(u * 23 + ph2));
      }
      for (let i = 0; i < M; i++) {
        const a = Math.max(0, i - 1), b = Math.min(M - 1, i + 1);
        const dx = xs[b] - xs[a], dy = ys[b] - ys[a], d = Math.hypot(dx, dy) || 1;
        nx[i] = -dy / d; ny[i] = dx / d;
      }
      const bristles = [];
      const k = 7 + rng.int(5);
      for (let q = 0; q < k; q++) {
        bristles.push({ v: (rng.random() * 2 - 1) * 0.85,
          end: BODY + 0.08 + rng.random() * (1 - BODY - 0.08) });
      }
      const len = xs.reduce((sum, x, i) => i ? sum + Math.hypot(x - xs[i - 1], ys[i] - ys[i - 1]) : 0, 0);
      return { xs, ys, nx, ny, w, bristles, at: t0, sweep: clamp(len / 420, 0.9, 2.4), hold: 4 + rng.random() * 4,
        c: rng.int(s.colors.length), cx: xs[M >> 1], cy: ys[M >> 1] };
    }

    /** A free spot, away from the strokes still showing. @param {number} pad @returns {[number, number]} */
    function spot(pad) {
      let best = /** @type {[number, number]} */ ([s.W / 2, s.H / 2]), bestD = -1;
      for (let j = 0; j < 10; j++) {
        const x = pad + rng.random() * Math.max(1, s.W - pad * 2), y = pad + rng.random() * Math.max(1, s.H - pad * 2);
        let d = Infinity;
        for (const o of strokes) d = Math.min(d, Math.hypot(o.cx - x, o.cy - y));
        if (d > bestD) { bestD = d; best = [x, y]; }
      }
      return best;
    }

    /** A new stroke of this variant, starting at t0. @param {number} t0 @returns {Stroke} */
    function next(t0) {
      const m = Math.min(s.W, s.H);
      if (s.layout === 1) {
        // A wash across the whole width, at the next of a few bands down the screen.
        const bands = clamp(Math.round(s.H / 150), 3, 8);
        band = (band + 1 + rng.int(2)) % bands;
        const y0 = (band + 0.5 + (rng.random() - 0.5) * 0.5) * s.H / bands, dir = rng.random() < 0.5 ? 1 : -1;
        const amp = s.H / bands * (0.15 + rng.random() * 0.25), f = 1 + rng.random() * 1.5, ph = rng.random() * TAU;
        const x0 = s.W * (dir > 0 ? -0.05 - rng.random() * 0.1 : 1.05 + rng.random() * 0.1);
        const span = s.W * (0.75 + rng.random() * 0.35) * dir;
        const st = make((u) => [x0 + span * u, y0 + Math.sin(u * f * Math.PI + ph) * amp + u * amp * 0.5],
          clamp(s.H / bands * (0.55 + rng.random() * 0.3), 30, 130), t0);
        st.sweep = clamp(Math.abs(span) / 600, 1.4, 3);
        return st;
      }
      if (s.layout === 2) {
        // An ensō: most of a circle, closing anticlockwise or clockwise, lifted before it meets.
        const r = clamp(m * (0.14 + rng.random() * 0.12), 50, 230);
        const [x, y] = spot(r * 0.9), a0 = rng.random() * TAU, dir = rng.random() < 0.5 ? 1 : -1;
        const sweep = TAU * (0.8 + rng.random() * 0.12), wob = rng.random() * TAU;
        const st = make((u) => {
          const a = a0 + dir * sweep * u, rr = r * (1 + 0.04 * Math.sin(u * 5 + wob));
          return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
        }, clamp(r * (0.22 + rng.random() * 0.1), 14, 60), t0);
        st.cx = x; st.cy = y;
        return st;
      }
      const len = clamp(m * (0.35 + rng.random() * 0.35), 140, 620);
      const [x, y] = spot(len * 0.3), a = rng.random() * TAU, bend = (rng.random() - 0.5) * len * 0.7;
      const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2, cs = -Math.sin(a), sn = Math.cos(a);
      return make((u) => {
        // A quadratic from one end to the other, bowed sideways by `bend`.
        const k = 4 * u * (1 - u);
        return [x - dx + 2 * dx * u + cs * bend * k, y - dy + 2 * dy * u + sn * bend * k];
      }, clamp(m * (0.06 + rng.random() * 0.05), 22, 90), t0);
    }

    const count = () => s.layout === 2 ? clamp(Math.round(s.W * s.H / 220000), 3, 7)
      : s.layout === 1 ? clamp(Math.round(s.H / 110), 4, 9) : clamp(Math.round(s.W * s.H / 110000), 5, 14);
    /** @param {Stroke} st @returns {number} */
    const life = (st) => st.sweep + st.hold + FADE;

    /** @param {Stroke} st */
    function paint(st) {
      const { ctx } = s, age = s.t - st.at;
      if (age <= 0) return;
      const p = ease(age / st.sweep), fade = 1 - ease((age - st.sweep - st.hold) / FADE);
      if (fade <= 0) return;
      const col = s.colors[st.c];
      // The body: the outline up one side and back down the other, as far as the brush has got.
      const reach = p * (M - 1), body = Math.min(reach, BODY * (M - 1));
      const n = Math.floor(body);
      if (n >= 1) {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) ctx.lineTo(st.xs[i] + st.nx[i] * st.w[i] / 2, st.ys[i] + st.ny[i] * st.w[i] / 2);
        // A round-ish tip where the paint is still arriving or thins into bristles.
        // The tangent is the normal turned back a quarter: (ny, -nx).
        const hx = st.xs[n], hy = st.ys[n], hw = st.w[n];
        ctx.quadraticCurveTo(hx + st.ny[n] * hw * 0.6, hy - st.nx[n] * hw * 0.6,
          hx - st.nx[n] * hw / 2, hy - st.ny[n] * hw / 2);
        for (let i = n; i >= 0; i--) ctx.lineTo(st.xs[i] - st.nx[i] * st.w[i] / 2, st.ys[i] - st.ny[i] * st.w[i] / 2);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.globalAlpha = fade * (s.dark ? 0.24 : 0.28);
        ctx.fill();
      }
      // Bristle streaks, darker lines of paint along the stroke that run on past the body.
      ctx.beginPath();
      for (const b of st.bristles) {
        const to = Math.min(reach, b.end * (M - 1));
        for (let i = 0; i <= to; i++) {
          const o = b.v * st.w[i] / 2;
          const x = st.xs[i] + st.nx[i] * o, y = st.ys[i] + st.ny[i] * o;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = clamp(st.w[M >> 2] * 0.04, 1.5, 3);
      ctx.globalAlpha = fade * (s.dark ? 0.3 : 0.34);
      ctx.stroke();
    }

    return {
      lay() {
        if (warmed) {
          // A resize keeps the strokes where they were in the frame; new ones take the new size.
          const fx = s.W / pw, fy = s.H / ph;
          for (const st of strokes) {
            for (let i = 0; i < M; i++) { st.xs[i] *= fx; st.ys[i] *= fy; }
            st.cx *= fx; st.cy *= fy;
          }
          pw = s.W; ph = s.H;
          return;
        }
        warmed = true; pw = s.W; ph = s.H;
        // Begin with strokes at every stage, so the first frame is already a painting.
        const n = count();
        for (let i = 0; i < n; i++) {
          const st = next(0);
          st.at = s.t - (i / n) * (st.sweep + st.hold) - st.sweep * 0.9;
          strokes.push(st);
        }
      },
      step() {
        const n = count();
        for (let i = strokes.length - 1; i >= 0; i--) if (s.t - strokes[i].at > life(strokes[i])) strokes.splice(i, 1);
        // Stagger new strokes a little, so they do not all start in the same frame.
        if (strokes.length < n && rng.random() < 0.05) strokes.push(next(s.t));
      },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const st of strokes) paint(st);
      },
    };
  });
}
