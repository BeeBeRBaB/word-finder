// Trail: the subject's icons follow one another nose to tail along a winding path, each turned
// to the way it goes, a faint line linking them. The seed picks the variant: one long trail
// snaking freely round the host, two trains running round a looping track, or three short
// lines each led by a bigger icon, wandering on their own.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';

/** @typedef {{xs:number[], ys:number[], x:number, y:number, a:number, ph:number, px:number, py:number,
 *   ks:number[], lead:number}} Line
 * A wandering line: the head's past points (oldest first), the head and its heading, and the
 * icons from head to tail; lead scales the first icon; px, py phase the target it chases. */

const STEP = 2;    // px between recorded points of a head's path
const DT = 1 / 15; // seconds per warm-up step

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    const pick = () => rng.random() < 0.15 ? 0 : 1 + rng.int(Math.max(1, s.n - 1));
    /** @type {Line[]} */
    const lines = [];
    let size = 40, gap = 44, v = 60, clock = 0, W0 = 0, H0 = 0;
    // The track (variant 1): sampled points, their running length, and the drawn rails.
    /** @type {number[]} */ let tx = [];
    /** @type {number[]} */ let ty = [];
    /** @type {number[]} */ let tl = [];
    let L = 1, along = 0;
    /** @type {Path2D|null} */ let rails = null;
    /** @type {number[][]} */ const trains = [[], []];
    const shape = rng.random() * TAU, lobes = 2 + rng.int(2);

    /** @param {number} n @returns {number[]} */
    const ksOf = (n) => { const ks = []; for (let i = 0; i < n; i++) ks.push(pick()); return ks; };

    /** Builds the track to fit the host. @returns {void} */
    function track() {
      const { W, H } = s;
      tx = []; ty = []; tl = [];
      const N = 720;
      for (let i = 0; i <= N; i++) {
        const th = i / N * TAU, r = 1 + 0.17 * Math.sin(lobes * th + shape);
        tx.push(W / 2 + W * 0.39 * r * Math.cos(th)); ty.push(H / 2 + H * 0.37 * r * Math.sin(th));
        tl.push(i ? tl[i - 1] + Math.hypot(tx[i] - tx[i - 1], ty[i] - ty[i - 1]) : 0);
      }
      L = tl[N];
      rails = new Path2D();
      const g = Math.max(3, size * 0.12);
      for (const side of [-1, 1]) {
        for (let i = 0; i <= N; i++) {
          const j = Math.min(N, i + 1), h = Math.max(0, i - 1);
          const dx = tx[j] - tx[h], dy = ty[j] - ty[h], d = Math.hypot(dx, dy) || 1;
          const x = tx[i] - dy / d * g * side, y = ty[i] + dx / d * g * side;
          if (i) rails.lineTo(x, y); else rails.moveTo(x, y);
        }
      }
      // Sleepers across the rails.
      for (let i = 0, next = 0; i < N; i++) {
        if (tl[i] < next) continue;
        next = tl[i] + g * 3.2;
        const dx = tx[i + 1] - tx[i], dy = ty[i + 1] - ty[i], d = Math.hypot(dx, dy) || 1;
        rails.moveTo(tx[i] - dy / d * g * 1.6, ty[i] + dx / d * g * 1.6);
        rails.lineTo(tx[i] + dy / d * g * 1.6, ty[i] - dx / d * g * 1.6);
      }
    }

    /** Point and heading at distance d along the track. @param {number} d @returns {[number, number, number, number]} */
    function onTrack(d) {
      d = ((d % L) + L) % L;
      let lo = 0, hi = tl.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tl[m] <= d) lo = m; else hi = m; }
      const u = (d - tl[lo]) / Math.max(1e-6, tl[hi] - tl[lo]);
      return [tx[lo] + (tx[hi] - tx[lo]) * u, ty[lo] + (ty[hi] - ty[lo]) * u, tx[hi] - tx[lo], ty[hi] - ty[lo]];
    }

    /** Moves each free head on and records its path. @param {number} dt @returns {void} */
    function wander(dt) {
      clock += dt;
      const { W, H } = s, m = Math.min(W, H) * 0.05;
      for (const l of lines) {
        // Chases a target that roams the whole host on a slow Lissajous, so the line keeps
        // out at the sides as much as across the middle, turning no tighter than it can.
        const gx = W * (0.5 + 0.4 * Math.sin(clock * 0.071 + l.px)), gy = H * (0.5 + 0.4 * Math.sin(clock * 0.053 + l.py));
        let d = Math.atan2(gy - l.y, gx - l.x) - l.a;
        d = ((d % TAU) + TAU + Math.PI) % TAU - Math.PI;
        const out = l.x < m || l.x > W - m || l.y < m || l.y > H - m;
        l.a += (clamp(d * 0.8, -0.45, 0.45) * (out ? 2 : 1) + 0.25 * Math.sin(clock * 0.4 + l.ph)) * dt;
        l.x += Math.cos(l.a) * v * dt * (layout === 2 ? 0.8 : 1);
        l.y += Math.sin(l.a) * v * dt * (layout === 2 ? 0.8 : 1);
        const n = l.xs.length;
        if (!n || Math.hypot(l.x - l.xs[n - 1], l.y - l.ys[n - 1]) >= STEP) { l.xs.push(l.x); l.ys.push(l.y); }
        // Keep a little more path than the line needs.
        const keep = Math.ceil(l.ks.length * gap * 1.6 / STEP) + 20;
        if (l.xs.length > keep * 2) { l.xs.splice(0, l.xs.length - keep); l.ys.splice(0, l.ys.length - keep); }
      }
    }

    /** Draws one icon facing along (dx, dy). @param {number} k @param {number} x @param {number} y
     * @param {number} dx @param {number} dy @param {number} sz @param {number} alpha @returns {void} */
    function put(k, x, y, dx, dy, sz, alpha) {
      const dir = dx < 0 ? -1 : 1;
      const rot = clamp(Math.atan2(dy * dir, dx * dir), -0.8, 0.8);
      s.icon(k, x, y, sz, rot, alpha, dir);
    }

    return {
      lay() {
        const { W, H } = s;
        const unit = Math.min(W, H);
        size = clamp(unit * 0.075, 28, 70); gap = size * 1.12; v = clamp(unit * 0.11, 40, 110);
        if (layout === 1) {
          track();
          const n = clamp(Math.floor(L * 0.3 / gap), 5, 18);
          for (const tr of trains) while (tr.length < n) tr.push(pick());
          for (const tr of trains) tr.length = n;
          return;
        }
        if (!lines.length) {
          const count = layout === 2 ? 3 : 1;
          const n = layout === 2 ? clamp(Math.round(W * H / (size * size * 60)), 4, 8)
            : clamp(Math.round(W * H / (size * size * 16)), 12, 30);
          // Run long enough that every line is out at full length in the first frame, its
          // target then out at one side, not behind the board in the middle.
          const warm = (n + 2) * gap * 1.3 / v;
          const side = rng.random() < 0.5 ? 0 : Math.PI;
          for (let j = 0; j < count; j++) {
            const ks = ksOf(n + (layout === 2 ? 1 : 0));
            if (layout === 2) ks[0] = j ? 1 + rng.int(Math.max(1, s.n - 1)) : 0;
            lines.push({ xs: [], ys: [], x: W * (0.25 + 0.25 * j), y: H * (0.3 + 0.2 * j), a: rng.random() * TAU,
              ph: rng.random() * TAU, px: Math.PI / 2 + side + j * Math.PI - warm * 0.071,
              py: (j - 1) * 0.9 - warm * 0.053, ks, lead: layout === 2 ? 1.35 : 1 });
          }
          for (let t = 0; t < warm; t += DT) wander(DT);
        } else if (W0 && H0) {
          // A resize stretches the paths rather than restarting them.
          for (const l of lines) {
            l.x *= W / W0; l.y *= H / H0;
            for (let i = 0; i < l.xs.length; i++) { l.xs[i] *= W / W0; l.ys[i] *= H / H0; }
          }
        }
        W0 = W; H0 = H;
      },
      step(dt) {
        if (layout === 1) along += v * dt;
        else wander(dt);
      },
      draw() {
        const { ctx } = s;
        ctx.strokeStyle = s.ink;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = ctx.lineCap = 'round';
        if (layout === 1) {
          if (rails) { ctx.globalAlpha = 0.14; ctx.stroke(rails); }
          trains.forEach((tr, j) => {
            const head = along + j * L / 2;
            for (let i = tr.length - 1; i >= 0; i--) {
              const [x, y, dx, dy] = onTrack(head - i * gap);
              put(tr[i], x, y, dx, dy, size * (i ? 1 : 1.12), i ? 0.46 : 0.58);
            }
          });
          return;
        }
        for (const l of lines) {
          // Walk back along the path once, dropping each icon a gap further behind.
          const n = l.xs.length;
          /** @type {number[]} */ const at = [];
          let want = 0, run = 0;
          for (let i = n - 1; i > 0 && at.length < l.ks.length; i--) {
            const d = Math.hypot(l.xs[i] - l.xs[i - 1], l.ys[i] - l.ys[i - 1]);
            while (at.length < l.ks.length && run + d >= want) { at.push(i); want += (at.length === 1 ? gap * (l.lead + 1) / 2 : gap); }
            run += d;
          }
          ctx.globalAlpha = 0.14;
          ctx.beginPath();
          const end = at.length ? at[at.length - 1] : n - 1;
          for (let i = n - 1; i >= end; i -= 2) i === n - 1 ? ctx.moveTo(l.xs[i], l.ys[i]) : ctx.lineTo(l.xs[i], l.ys[i]);
          ctx.stroke();
          for (let j = at.length - 1; j >= 0; j--) {
            const i = at[j], h = Math.max(0, i - 3);
            const fade = 1 - j / Math.max(1, l.ks.length) * 0.35;
            put(l.ks[j], l.xs[i], l.ys[i], l.xs[i] - l.xs[h], l.ys[i] - l.ys[h], size * (j ? 1 : l.lead), (j ? 0.5 : 0.58) * fade);
          }
        }
      },
    };
  });
}
