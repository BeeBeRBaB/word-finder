// Slinky: coil springs walk down flights of stairs, the top coils arching over to the next step
// and pouring after them, bunched on the steps and stretched in the arch, in bands of colour.
// Layout 0: long diagonal flights crossing the screen, springs going over the edge and coming
// back at the top. 1: a stairwell whose flights turn back at landings. 2: stepped pyramids
// that springs set off from at the top, walking down either side.

import { stage, clamp, mix } from './stage.js';

/** @typedef {{x:number, y:number}[]} Flight the tread middles a spring stands on, in order */
/** @typedef {{f:number, i:number, u:number, flip:boolean, T:number}} Spring
 * On flight f, moving from tread i to i+1, u 0..1 of the way; flip when its coils lead from the
 * other end; seconds a step takes. */

const N = 22;          // coils
const ARCH = 13;       // coils in the arch while it pours over
const SAMPLES = 16;    // steps along the arch when measuring it
const arc = new Float32Array(SAMPLES + 1);

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const nc = s.colors.length;
    /** @type {Flight[]} */
    let flights = [];
    /** @type {Spring[]} */
    let springs = [];
    let run = 40, R = 12, key = '';
    /** @type {Path2D} */
    let stairs = new Path2D(), solid = new Path2D();
    // Whether a flight is open-ended (runs off screen) or fades its springs in and out.
    const open = L === 0;

    /** Treads and the drawn stairs for this size. @returns {void} */
    function build() {
      const m = Math.min(s.W, s.H);
      run = clamp(m * 0.085, 34, 80);
      R = run * 0.22;
      flights = [];
      if (L === 0) {
        const rise = run * clamp(s.H / s.W, 0.55, 0.9);
        const n = Math.ceil((s.W + run * 4) / run);
        const drop = n * rise, gap = clamp(run * 4, 150, 420);
        // Parallel flights from upper left to lower right, enough to cover the screen.
        const k0 = Math.floor(-drop / gap), k1 = Math.ceil(s.H / gap);
        for (let k = k0; k <= k1; k++) {
          /** @type {Flight} */
          const f = [];
          for (let i = 0; i < n; i++) f.push({ x: -run * 2 + i * run, y: k * gap + i * rise });
          if (f[n - 1].y > 0 && f[0].y < s.H + run) flights.push(f);
        }
      } else if (L === 1) {
        const rise = run * 0.6, w = clamp(s.W * 0.8, run * 5, run * 16);
        const steps = Math.floor(w / run) - 2, x0 = (s.W - steps * run) / 2;
        const ystep = steps * rise + run * 1.2;
        const turns = clamp(Math.floor((s.H - run * 2) / ystep), 2, 8);
        /** @type {Flight} */
        const f = [];
        let y = (s.H - (turns * ystep - run * 1.2)) / 2 + run * 0.6;
        for (let k = 0; k < turns; k++) {
          const d = k % 2 ? -1 : 1;
          for (let i = 0; i <= steps; i++) f.push({ x: d > 0 ? x0 + i * run : x0 + (steps - i) * run, y: y + i * rise });
          y += steps * rise;
          // The landing: one more tread past the flight's end, then a drop to the next flight.
          if (k < turns - 1) { f.push({ x: d > 0 ? x0 + (steps + 1) * run : x0 - run, y: y + rise }); y += run * 1.2; }
        }
        flights.push(f);
      } else {
        // One pyramid, two side by side on a very wide screen, or one above the other on a tall one.
        const cols = s.W > s.H * 2.2 ? 2 : 1, rows = s.H > s.W * 1.2 ? 2 : 1;
        const cw = s.W / cols, ch = s.H / rows;
        const half = clamp(Math.floor(cw / 2 / run) - 1, 3, 14);
        const rise = clamp(ch * 0.7 / half, run * 0.35, run * 1.1);
        for (let p = 0; p < cols * rows; p++) {
          const i = p % cols, j = Math.floor(p / cols);
          const at = rows > 1 ? (j ? 0.72 : 0.3) : 0.5;
          const cx = cw * (i + 0.5), top = ch * (j + at) - half * rise / 2 + (i % 2 ? run * 0.5 : 0);
          for (const d of [-1, 1]) {
            /** @type {Flight} */
            const f = [];
            for (let i = 0; i <= half; i++) f.push({ x: cx + d * i * run, y: top + i * rise });
            flights.push(f);
          }
        }
      }
      stairs = new Path2D(); solid = new Path2D();
      for (const f of flights) draft(f);
    }

    /** Adds a flight's treads and risers to the stair paths, a new run of them wherever the
     * flight turns back. @param {Flight} f @returns {void} */
    function draft(f) {
      const h = run / 2, depth = run * 0.5;
      /** @type {number[][][]} */
      const runs = [[]];
      let was = 0;
      for (let i = 0; i < f.length; i++) {
        const p = f[i], q = f[i + 1];
        const d = i > 0 ? Math.sign(p.x - f[i - 1].x) || 1 : Math.sign(f[1].x - p.x) || 1;
        if (was && d !== was) runs.push([]);
        was = d;
        const pts = runs[runs.length - 1];
        pts.push([p.x - d * h, p.y], [p.x + d * h, p.y]);
        if (q && Math.sign(q.x - p.x) === d) pts.push([p.x + d * h, q.y]);
      }
      for (const pts of runs) {
        stairs.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) stairs.lineTo(p[0], p[1]);
        // The stair's body, a band under the treads.
        solid.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) solid.lineTo(p[0], p[1]);
        for (let i = pts.length - 1; i >= 0; i--) solid.lineTo(pts[i][0], pts[i][1] + depth);
        solid.closePath();
      }
    }

    /** New springs spread along the flights. @returns {void} */
    function deal() {
      springs = [];
      for (let f = 0; f < flights.length; f++) {
        const len = flights[f].length;
        const per = L === 1 ? clamp(Math.round(len / 7), 2, 7) : Math.max(1, Math.round(len / 12));
        const T = 1.5 + rng.random() * 0.4;
        const off = rng.random();
        for (let k = 0; k < per; k++) {
          const at = ((k + off) / per) * (len - 1);
          springs.push({ f, i: Math.floor(at), u: L === 2 ? 0.3 + rng.random() * 0.4 : at % 1, flip: rng.random() < 0.5, T });
        }
      }
    }

    /** Smooth 0..1. @param {number} u @returns {number} */
    const ease = (u) => u * u * (3 - 2 * u);

    return {
      lay() {
        const k = `${s.W}x${s.H}`;
        if (k === key) return;
        key = k;
        // Keep how far along each spring is through a resize.
        const old = springs.map((sp) => [sp.f, (sp.i + sp.u) / Math.max(1, flights[sp.f].length - 1)]);
        build();
        deal();
        if (old.length === springs.length && old.every((o) => o[0] < flights.length)) {
          springs.forEach((sp, j) => {
            const at = old[j][1] * (flights[sp.f].length - 1);
            sp.i = Math.min(Math.floor(at), flights[sp.f].length - 2); sp.u = at - Math.floor(at);
          });
        }
      },
      step(dt) {
        for (const sp of springs) {
          sp.u += dt / sp.T;
          if (sp.u < 1) continue;
          sp.u -= 1; sp.i++; sp.flip = !sp.flip;
          // Back to the top: off screen for a long flight, faded out for the others.
          if (sp.i >= flights[sp.f].length - 1) sp.i = 0;
        }
      },
      draw() {
        const { ctx } = s;
        ctx.fillStyle = s.ink; ctx.globalAlpha = s.dark ? 0.06 : 0.08; ctx.fill(solid);
        ctx.strokeStyle = s.ink; ctx.globalAlpha = s.dark ? 0.32 : 0.4; ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round'; ctx.stroke(stairs);
        // Coils by colour and by fade level (springs fading in or out at a flight's ends).
        /** @type {Path2D[][]} */
        const rings = [0, 1, 2].map(() => s.colors.map(() => new Path2D()));
        const g = R * 2.4 / N;
        for (const sp of springs) {
          const f = flights[sp.f], A = f[sp.i], B = f[sp.i + 1];
          const last = f.length - 2;
          let fade = 0;
          if (!open) {
            const a = sp.i === 0 ? sp.u : sp.i === last ? 1 - sp.u : 1;
            fade = a > 0.66 ? 0 : a > 0.33 ? 1 : 2;
            if (a < 0.08) continue;
          }
          const Fl = ease(sp.u) * (N - 1 + ARCH);
          const ns = clamp(N - Fl, 0, N), nd = clamp(Fl - ARCH + 1, 0, N);
          const sx = A.x, sy = A.y - ns * g, dx = B.x, dy = B.y - nd * g;
          // The arch: a cubic leaving each stack straight up, peaking above the higher one.
          const top = Math.min(sy, dy) - Math.max(R * 3.2, Math.abs(dx - sx) * 0.6);
          const c1y = sy + (top - sy) * 1.33, c2y = dy + (top - dy) * 1.33;
          /** @param {number} p @returns {number} */
          const by = (p) => { const q = 1 - p; return q * q * q * sy + 3 * q * q * p * c1y + 3 * q * p * p * c2y + p * p * p * dy; };
          // Arc length along the arch, so its coils spread evenly instead of bunching at the top.
          let len = 0;
          for (let i = 1; i <= SAMPLES; i++) {
            const p0 = (i - 1) / SAMPLES, p1 = i / SAMPLES;
            const ex = (sx + (dx - sx) * (p1 * p1 * (3 - 2 * p1))) - (sx + (dx - sx) * (p0 * p0 * (3 - 2 * p0)));
            len += Math.hypot(ex, by(p1) - by(p0));
            arc[i] = len;
          }
          for (let k = 0; k < N; k++) {
            const pa = clamp((Fl - k) / ARCH, 0, 1);
            let x, y, rot = 0;
            if (pa <= 0) { x = A.x; y = A.y - (N - 1 - k + 0.5) * g; }
            else if (pa >= 1) { x = B.x; y = B.y - (k + 0.5) * g; }
            else {
              const want = pa * len;
              let i = 1;
              while (i < SAMPLES && arc[i] < want) i++;
              const p = (i - 1 + (want - arc[i - 1]) / Math.max(1e-6, arc[i] - arc[i - 1])) / SAMPLES;
              const q = 1 - p;
              x = q * q * q * sx + 3 * q * q * p * sx + 3 * q * p * p * dx + p * p * p * dx;
              y = q * q * q * sy + 3 * q * q * p * c1y + 3 * q * p * p * c2y + p * p * p * dy;
              const tx = 6 * q * p * (dx - sx);
              const ty = 3 * q * q * (c1y - sy) + 6 * q * p * (c2y - c1y) + 3 * p * p * (dy - c2y);
              rot = Math.atan2(ty, tx) + Math.PI / 2;
            }
            const band = Math.floor((sp.flip ? N - 1 - k : k) / N * nc);
            const path = rings[fade][band];
            path.moveTo(x + Math.cos(rot) * R, y + Math.sin(rot) * R);
            path.ellipse(x, y, R, R * 0.3, rot, 0, Math.PI * 2);
          }
        }
        ctx.lineWidth = clamp(R * 0.1, 1.2, 2);
        for (let a = 0; a < 3; a++) for (let c = 0; c < nc; c++) {
          ctx.strokeStyle = s.colors[c];
          ctx.globalAlpha = (s.dark ? 0.62 : 0.6) * mix(1, 0.3, a / 2);
          ctx.stroke(rings[a][c]);
        }
      },
    };
  });
}
