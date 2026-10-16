// Tower of Hanoi: discs move one at a time from peg to peg, never a larger on a smaller, until the
// tower stands on a new peg; then a larger disc fades in under it and it is solved again, and
// after the largest it clears and starts small. The seed picks the variant: one big puzzle seen
// side on; a grid of small ones, each on its own clock; or one seen from above, the discs as
// rings round three pegs set in a triangle.

import { roundRect } from './shapes.js';
import { stage, TAU, clamp, mix } from './stage.js';

const HOLD = 1.6;   // s a solved tower stands before it grows
const FADE = 1.2;   // s for a disc or a tower to fade in or out
const GAP = 0.14;   // s between moves

/** @typedef {{pegs:number[][], n:number, lo:number, hi:number, dst:number, moves:number[][],
 *   k:number, u:number, wait:number, phase:number, pt:number, x:number, y:number, sp:number,
 *   dh:number}} Tower
 * pegs hold disc sizes (1 smallest) bottom first; moves the solution, k the next one, u its
 * progress; phase 0 solving, 1 holding, 2 growing, 3 fading out, 4 fading in, pt its clock.
 * x, y the base's centre (side on) or the triangle's centre (above), sp the peg spacing, dh a
 * disc's height (side on) or the ring step (above). */

/** @param {number} u @returns {number} */
const ease = (u) => u * u * (3 - 2 * u);

/** The moves taking n discs from peg a to peg b. @param {number} n @param {number} a @param {number} b */
function solve(n, a, b) {
  /** @type {number[][]} */
  const out = [];
  /** @param {number} m @param {number} f @param {number} t @param {number} v */
  const rec = (m, f, t, v) => { if (!m) return; rec(m - 1, f, v, t); out.push([f, t]); rec(m - 1, v, t, f); };
  rec(n, a, b, 3 - a - b);
  return out;
}

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const above = layout === 2;
    const FILL = s.dark ? 0.32 : 0.38, EDGE = s.dark ? 0.6 : 0.7, POST = s.dark ? 0.3 : 0.36;
    /** @type {Tower[]} */
    const towers = [];

    /** A tower part way through solving, so the first frame is mid-game. @param {number} lo
     * @param {number} hi @param {number} n discs it starts with */
    function tower(lo, hi, n) {
      const src = rng.int(3), dst = (src + 1 + rng.int(2)) % 3;
      /** @type {Tower} */
      const t = { pegs: [[], [], []], n, lo, hi, dst, moves: solve(n, src, dst), k: 0, u: 0, wait: 0,
        phase: 0, pt: 0, x: 0, y: 0, sp: 0, dh: 0 };
      for (let d = n; d >= 1; d--) t.pegs[src].push(d);
      const k = rng.int(t.moves.length);
      while (t.k < k) land(t);
      t.u = 0.3 + rng.random() * 0.4; t.wait = 0;
      return t;
    }

    /** Ends the current move. @param {Tower} t */
    function land(t) {
      const [f, to] = t.moves[t.k++];
      t.pegs[to].push(/** @type {number} */ (t.pegs[f].pop()));
      t.u = 0;
      t.wait = GAP;
    }

    /** Where peg p of t stands (above: its centre). @param {Tower} t @param {number} p @returns {[number, number]} */
    function peg(t, p) {
      if (!above) return [t.x + (p - 1) * t.sp, t.y];
      const a = -Math.PI / 2 + p * TAU / 3, R = t.sp / Math.sqrt(3);
      return [t.x + Math.cos(a) * R, t.y + Math.sin(a) * R];
    }

    /** A side-on disc's width. @param {Tower} t @param {number} d */
    const width = (t, d) => t.sp * mix(0.3, 0.92, (d - 1) / Math.max(1, t.hi - 1));
    /** A ring's radius from above. @param {Tower} t @param {number} d */
    const radius = (t, d) => t.dh * (d + 1.2);
    /** Height of the posts and of the lift over them, side on. @param {Tower} t */
    const top = (t) => t.y - (t.hi + 1.6) * t.dh;

    /** The moving disc's centre and lift (0..1), u through its move. @param {Tower} t @returns {[number, number, number]} */
    function flight(t) {
      const [f, to] = t.moves[t.k];
      const [xa, ya0] = peg(t, f), [xb, yb0] = peg(t, to);
      const v = ease(t.u);
      if (above) return [mix(xa, xb, v), mix(ya0, yb0, v), Math.sin(Math.PI * t.u)];
      const ya = ya0 - (t.pegs[f].length - 0.5) * t.dh, yb = yb0 - (t.pegs[to].length + 0.5) * t.dh;
      const yt = top(t) - t.dh * 0.6;
      const l1 = ya - yt, l2 = Math.abs(xb - xa), l3 = yb - yt;
      let d = v * (l1 + l2 + l3);
      if (d < l1) return [xa, ya - d, 1];
      d -= l1;
      if (d < l2) return [mix(xa, xb, d / Math.max(1, l2)), yt, 1];
      return [xb, yt + (d - l2), 1];
    }

    /** Seconds for t's next move: a steady pace along its path. @param {Tower} t */
    function dur(t) {
      const [f, to] = t.moves[t.k];
      const span = Math.abs(f - to) * t.sp;
      return above ? 0.5 + span / (t.sp * 1.3) : 0.4 + (span + (t.hi + 1) * t.dh * 1.6) / (t.sp * 2.4);
    }

    /** @param {Tower} t @param {number} dt */
    function advance(t, dt) {
      t.pt += dt;
      if (t.phase === 0) {
        if (t.wait > 0) { t.wait -= dt; return; }
        t.u += dt / dur(t);
        if (t.u >= 1) land(t);
        if (t.k >= t.moves.length) { t.phase = 1; t.pt = 0; }
      } else if (t.phase === 1 && t.pt > HOLD) {
        t.phase = t.n < t.hi ? 2 : 3; t.pt = 0;
      } else if (t.phase === 2 && t.pt > FADE) {
        t.n++;
        t.pegs[t.dst].unshift(t.n);
        renew(t, t.dst);
      } else if (t.phase === 3 && t.pt > FADE) {
        t.n = t.lo;
        t.pegs = [[], [], []];
        for (let d = t.n; d >= 1; d--) t.pegs[t.dst].push(d);
        t.phase = 4; t.pt = 0;
      } else if (t.phase === 4 && t.pt > FADE) {
        renew(t, t.dst);
      }
    }

    /** Sets t to solve again from peg src. @param {Tower} t @param {number} src */
    function renew(t, src) {
      t.dst = (src + 1 + rng.int(2)) % 3;
      t.moves = solve(t.n, src, t.dst);
      t.k = 0; t.u = 0; t.wait = 0.4; t.phase = 0; t.pt = 0;
    }

    /** @param {CanvasRenderingContext2D} ctx @param {Tower} t @param {number} d size @param {number} x @param {number} y centre @param {number} a alpha @param {number} lift */
    function disc(ctx, t, d, x, y, a, lift) {
      const col = s.colors[(d - 1) % nc];
      ctx.strokeStyle = ctx.fillStyle = col;
      if (above) {
        const r = radius(t, d) * (1 + 0.06 * lift);
        ctx.lineWidth = t.dh * 0.78;
        if (lift > 0) {
          ctx.globalAlpha = a * 0.14 * lift;
          ctx.strokeStyle = s.ink;
          ctx.beginPath(); ctx.arc(x + t.dh * 0.5 * lift, y + t.dh * 0.8 * lift, r, 0, TAU); ctx.stroke();
          ctx.strokeStyle = col;
        }
        ctx.globalAlpha = a * (FILL + 0.08);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = a * EDGE * 0.55;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, r + t.dh * 0.39, 0, TAU); ctx.stroke();
        return;
      }
      const w = width(t, d), h = t.dh * 0.86;
      ctx.beginPath();
      roundRect(ctx, x - w / 2, y - h / 2, w, h, h * 0.4);
      ctx.globalAlpha = a * FILL; ctx.fill();
      ctx.globalAlpha = a * EDGE; ctx.lineWidth = 1.5; ctx.stroke();
    }

    /** @param {CanvasRenderingContext2D} ctx @param {Tower} t */
    function paintTower(ctx, t) {
      const all = t.phase === 3 ? 1 - ease(clamp(t.pt / FADE, 0, 1)) : t.phase === 4 ? ease(clamp(t.pt / FADE, 0, 1)) : 1;
      const grow = t.phase === 2 ? ease(clamp(t.pt / FADE, 0, 1)) : 0;
      const moving = t.phase === 0 && t.wait <= 0 && t.k < t.moves.length ? t.moves[t.k][0] : -1;
      // Posts and base.
      ctx.strokeStyle = ctx.fillStyle = s.ink;
      if (above) {
        ctx.globalAlpha = POST;
        for (let p = 0; p < 3; p++) {
          const [x, y] = peg(t, p);
          ctx.beginPath(); ctx.arc(x, y, Math.max(2.5, t.dh * 0.3), 0, TAU); ctx.fill();
        }
      } else {
        const lw = Math.max(2, t.dh * 0.2), yt = top(t);
        ctx.globalAlpha = POST; ctx.lineWidth = lw; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let p = 0; p < 3; p++) { const [x] = peg(t, p); ctx.moveTo(x, t.y); ctx.lineTo(x, yt); }
        ctx.stroke();
        ctx.beginPath();
        roundRect(ctx, t.x - t.sp * 1.55, t.y, t.sp * 3.1, Math.max(3, t.dh * 0.32), Math.max(1.5, t.dh * 0.16));
        ctx.globalAlpha = POST * 0.8; ctx.fill();
      }
      for (let p = 0; p < 3; p++) {
        const st = t.pegs[p], [x, y] = peg(t, p);
        const m = p === moving ? st.length - 1 : st.length;
        const rise = p === t.dst ? grow * t.dh : 0;
        for (let i = 0; i < m; i++) disc(ctx, t, st[i], x, above ? y : y - (i + 0.5) * t.dh - rise, all, 0);
        if (p === t.dst && grow > 0) disc(ctx, t, t.n + 1, x, above ? y : y - 0.5 * t.dh, grow, 0);
      }
      if (moving >= 0) {
        const [x, y, lift] = flight(t);
        disc(ctx, t, t.pegs[moving][t.pegs[moving].length - 1], x, y, all, above ? lift : 0);
      }
    }

    return {
      lay() {
        const { W, H } = s;
        const m = Math.min(W, H);
        if (layout === 1) {
          // A grid of small puzzles, as many as fit.
          const w = clamp(m * 0.42, 150, 330), h = w * 0.62;
          const cols = Math.max(1, Math.floor(W / (w * 1.18))), rows = Math.max(1, Math.floor(H / (h * 1.3)));
          while (towers.length < cols * rows) towers.push(tower(3, 6, 3 + rng.int(3)));
          towers.length = cols * rows;
          towers.forEach((t, i) => {
            const c = i % cols, r = Math.floor(i / cols);
            t.sp = w / 3.1;
            t.dh = Math.min(h * 0.62 / 7.6, t.sp * 0.17);
            t.x = W * (c + 0.5) / cols + (r % 2 ? 0.08 : -0.08) * W / cols;
            t.y = H * (r + 0.5) / rows + (t.hi + 1.6) * t.dh * 0.5;
          });
          return;
        }
        if (!towers.length) towers.push(above ? tower(3, 7, 5 + rng.int(2)) : tower(3, 8, 5 + rng.int(3)));
        const t = towers[0];
        if (above) {
          // Ring radius = dh * (d + 1.2) and the outermost must clear its neighbours.
          const R = Math.min(H / 3.3, W / 3.5);
          t.sp = R * Math.sqrt(3);
          t.dh = R * 0.8 / (t.hi + 1.6);
          t.x = W / 2; t.y = H / 2 + R * 0.25;
        } else {
          t.sp = Math.min(W * 0.94, 1300) / 3.1;
          t.dh = clamp(H * 0.42 / (t.hi + 1.6), 6, t.sp * (W < H ? 0.22 : 0.13));
          t.x = W / 2; t.y = H / 2 + (t.hi + 1.6) * t.dh * 0.5;
        }
      },
      step(dt) { for (const t of towers) advance(t, dt); },
      draw() {
        const { ctx } = s;
        for (const t of towers) paintTower(ctx, t);
      },
    };
  });
}
