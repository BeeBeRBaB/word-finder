// Dominoes: lines of dominoes topple in a chain, each knocked by the one before and coming to
// rest leaning on the next, the last lying flat; after a pause they stand back up in a wave from
// the start. The seed picks the variant: rows seen side on, each on its own clock, falling one
// way and then the other; one long chain seen from above, snaking across the page, the falling
// front chased by the rising one so pips appear and vanish; or side-on rows that grow, each
// domino a little bigger than the one before, from a small end that swaps row to row.

import { roundRect } from './shapes.js';
import { stage, clamp } from './stage.js';

const FALL = 0.55;     // s for a 50px domino to fall flat untouched
const HOLD = 2;        // s a row lies fallen
const LIFT = 0.8;      // s for one domino to stand back up
const RIPPLE = 0.07;   // s between neighbours standing up
const HALF = Math.PI / 2;

/** @typedef {{x:number, h:number, t:number, hit:number, fin:number, at:number, dur:number}} Piece
 * In fall order, laid out falling rightward: x its centre, hit the tilt at which it strikes the
 * next, fin its tilt at rest, at when it starts to fall (s into the cycle), dur its own fall. */
/** @typedef {{y:number, c:number, off:number, flip:boolean, swap:boolean, x0:number, x1:number, ps:Piece[], tilt:Float32Array, F:number, L:number}} Row
 * flip: falls leftward first; swap: changes direction every cycle. */
/** @typedef {{x:number, y:number, a:number, f:number, c:number}} Spot a place on the chain seen from above */

/** @param {number} u @returns {number} */
const ease = (u) => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    const edges = s.colors.map((c) => edge(c));
    const faces = s.colors.map((c) => Array.from({ length: 5 }, () => face(c, 1 + rng.int(6), rng.int(7))));
    const first = rng.int(C);
    const phase = rng.random();
    /** @type {Row[]} */
    let rows = [];
    /** @type {Spot[]} */
    let spots = [];
    let w = 20, len = 40, thick = 8, gap = 22, period = 1, beat = 0.3, lane = 0;

    /** Fills in when each piece is struck, its tilts, and the row's timings. @param {Row} r */
    function timeRow(r) {
      const n = r.ps.length;
      let at = 0;
      for (let k = 0; k < n; k++) {
        const p = r.ps[k], q = r.ps[k + 1];
        p.dur = FALL * Math.sqrt(p.h / 50);
        p.at = at;
        if (!q) { p.hit = HALF; p.fin = HALF; break; }
        // Its top corner meets the next one's back face; at rest it lies flush on it.
        const reach = (q.x - q.t / 2) - (p.x + p.t / 2);
        p.hit = Math.asin(clamp(reach / p.h, 0, 1));
        p.fin = k === n - 2 ? Math.acos(clamp(q.t / p.h, 0, 1)) : Math.min(Math.acos(clamp(p.t / (reach + p.t), 0, 1)) * 0.98, 1.4);
        at += p.dur * Math.sqrt(p.hit / HALF);
      }
      const last = r.ps[n - 1];
      r.F = last.at + last.dur;
      r.L = r.F + HOLD + n * RIPPLE + LIFT + 1.5;
      r.tilt = new Float32Array(n);
    }

    /** Lays rows across the page: uniform pieces, or growing ones. */
    function layRows() {
      const m = Math.min(s.W, s.H);
      const h = clamp(m * 0.085, 26, 64);
      const grow = layout === 2;
      const big = grow ? h * 1.45 : h, pitch = big * (grow ? 1.45 : 1.75);
      const n = clamp(Math.floor((s.H - big * 0.6) / pitch), 2, 10);
      const top = (s.H - n * pitch) / 2 + pitch * 0.85;
      const x0 = Math.max(big * 0.5, s.W * 0.04), x1 = s.W - x0;
      rows = [];
      for (let i = 0; i < n; i++) {
        /** @type {Piece[]} */
        const ps = [];
        const piece = (/** @type {number} */ x, /** @type {number} */ ph) => ({ x, h: ph, t: ph * 0.17, hit: 0, fin: 0, at: 0, dur: 0 });
        if (grow) {
          // Sizes grow by a fixed ratio; the most that fit, with room for the last to lie flat.
          const lo = h * 0.4, room = x1 - x0 - big * 1.05;
          let k = 4;
          const widthOf = (/** @type {number} */ c) => { const g = Math.pow(big / lo, 1 / (c - 1)); let sum = 0; for (let j = 0; j < c - 1; j++) sum += lo * Math.pow(g, j) * 0.62; return sum; };
          while (k < 80 && widthOf(k + 1) < room) k++;
          const g = Math.pow(big / lo, 1 / (k - 1));
          let x = x0;
          for (let j = 0; j < k; j++) { const ph = lo * Math.pow(g, j); ps.push(piece(x, ph)); x += ph * 0.62; }
        } else {
          const d = h * 0.58, k = Math.max(4, Math.floor((x1 - x0 - h) / d) + 1);
          const start = (s.W - (k - 1) * d - h) / 2 + h * 0.08;
          for (let j = 0; j < k; j++) ps.push(piece(start + j * d, h));
        }
        /** @type {Row} */
        const r = { y: top + i * pitch, c: (first + i) % C, off: 0, flip: i % 2 === 1, swap: !grow, x0, x1, ps,
          tilt: new Float32Array(0), F: 0, L: 1 };
        timeRow(r);
        r.off = ((phase + i * 0.381) % 1) * r.L;
        rows.push(r);
      }
    }

    /** Lays one chain snaking across the page, seen from above. */
    function laySnake() {
      const area = s.W * s.H;
      // About 300 pieces whatever the size: each one a few sprite draws.
      w = clamp(Math.sqrt(area / 1000), 14, 90);
      len = w * 2; thick = w * 0.42; gap = w * 1.1;
      lane = len * 1.55;
      const mx = Math.max(w * 1.5, s.W * 0.05);
      const n = Math.max(2, Math.floor((s.H - w * 2) / lane));
      const y0 = (s.H - (n - 1) * lane) / 2, run = s.W - mx * 2 - lane;
      spots = [];
      let a = 0;
      // Walk the path: straight runs joined by half turns of diameter `lane`.
      const total = n * run + (n - 1) * Math.PI * lane / 2;
      for (let k = 0; a < total; k++, a += gap) {
        const leg = run + Math.PI * lane / 2, i = Math.floor(a / leg), u = a - i * leg;
        const right = i % 2 === 0, cx = right ? mx + lane / 2 + run : mx + lane / 2;
        let x, y, ang;
        if (u < run) {
          x = right ? mx + lane / 2 + u : mx + lane / 2 + run - u; y = y0 + i * lane; ang = right ? 0 : Math.PI;
        } else {
          const th = (u - run) / (lane / 2);
          ang = (right ? 0 : Math.PI) + (right ? th : -th);
          x = cx + Math.sin(th) * lane / 2 * (right ? 1 : -1); y = y0 + i * lane + lane / 2 - Math.cos(th) * lane / 2;
        }
        spots.push({ x, y, a: ang, f: 0, c: (first + Math.floor(k / 9)) % C });
      }
      const fall = FALL * Math.sqrt(len / 50), hit = Math.asin(clamp((gap - thick) / len, 0, 1));
      beat = fall * Math.sqrt(hit / HALF);
      period = spots.length + Math.max(14, spots.length * 0.08);
    }

    /** The tilt of each piece of row r at time t. @param {Row} r @param {number} t */
    function tilts(r, t) {
      const n = r.ps.length, tau = t % r.L;
      if (tau < r.F) {
        // Each falls under its own weight, but no further than the next one lets it.
        let next = HALF, nextFin = HALF;
        for (let k = n - 1; k >= 0; k--) {
          const p = r.ps[k], u = (tau - p.at) / p.dur;
          let a = u <= 0 ? 0 : Math.min(HALF, HALF * u * u);
          if (k < n - 1) a = Math.min(a, p.hit + (next / nextFin) * (p.fin - p.hit));
          r.tilt[k] = a; next = a; nextFin = p.fin;
        }
      } else {
        const up = tau - r.F - HOLD;
        for (let k = 0; k < n; k++) r.tilt[k] = r.ps[k].fin * (1 - ease((up - k * RIPPLE) / LIFT));
      }
    }

    return {
      lay() {
        if (layout === 1) laySnake(); else layRows();
      },
      step() {},
      draw() {
        const { ctx, dpr } = s;
        ctx.globalAlpha = s.dark ? 0.6 : 0.68;
        if (layout === 1) {
          const f = (s.t / beat + phase * period) % period, rise = period * 0.5;
          for (let k = spots.length - 1; k >= 0; k--) {
            const p = spots[k];
            let u = f - k; if (u < 0) u += period;
            const ts = u * beat;
            // Down by its own weight to rest, then back up when the rising front comes.
            p.f = u < rise ? Math.min(1.2, HALF * Math.pow(Math.min(1, ts / (FALL * Math.sqrt(len / 50))), 2))
              : 1.2 * (1 - ease((u - rise) * beat / LIFT));
          }
          ctx.globalAlpha = s.dark ? 0.62 : 0.7;
          // Draw from the far end back, so each leans over the one it rests on.
          for (let k = spots.length - 1; k >= 0; k--) {
            const p = spots[k], sn = Math.sin(p.f), L = thick * Math.cos(p.f) + len * sn;
            const c = Math.cos(p.a), si = Math.sin(p.a);
            ctx.setTransform(c * dpr, si * dpr, -si * dpr, c * dpr, p.x * dpr, p.y * dpr);
            ctx.drawImage(edges[p.c], -thick / 2, -w / 2, L, w);
            if (sn > 0.4) {
              ctx.globalAlpha = (s.dark ? 0.62 : 0.7) * (sn - 0.4) / 0.6;
              ctx.drawImage(faces[p.c][k % 5], -thick / 2, -w / 2, L, w);
              ctx.globalAlpha = s.dark ? 0.62 : 0.7;
            }
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          return;
        }
        ctx.globalAlpha = s.dark ? 0.22 : 0.26;
        ctx.strokeStyle = s.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (const r of rows) { ctx.moveTo(r.x0, r.y + 0.75); ctx.lineTo(r.x1, r.y + 0.75); }
        ctx.stroke();
        // Side on, each row is three paths (slabs, middle lines, pips): far cheaper on a big
        // screen than a rotated sprite per piece.
        for (const r of rows) {
          const t = s.t + r.off;
          tilts(r, t);
          // A swapping row mirrors every other cycle; a growing row keeps its side.
          const mirror = r.flip !== (r.swap && Math.floor(t / r.L) % 2 === 1);
          const sum = r.x0 + r.x1, sg = mirror ? -1 : 1;
          const slabs = new Path2D(), lines = new Path2D(), pips = new Path2D();
          for (let k = 0; k < r.ps.length; k++) {
            const p = r.ps[k], a = r.tilt[k], c = Math.cos(a), si = Math.sin(a);
            const px = mirror ? sum - (p.x + p.t / 2) : p.x + p.t / 2, py = r.y;
            // Local (lx, ly) about the pivot corner, lx in -t..0 and ly in -h..0.
            const X = (/** @type {number} */ lx, /** @type {number} */ ly) => px + sg * (c * lx - si * ly);
            const Y = (/** @type {number} */ lx, /** @type {number} */ ly) => py + si * lx + c * ly;
            slabs.moveTo(X(0, 0), Y(0, 0)); slabs.lineTo(X(-p.t, 0), Y(-p.t, 0));
            slabs.lineTo(X(-p.t, -p.h), Y(-p.t, -p.h)); slabs.lineTo(X(0, -p.h), Y(0, -p.h)); slabs.closePath();
            lines.moveTo(X(-p.t * 0.85, -p.h / 2), Y(-p.t * 0.85, -p.h / 2)); lines.lineTo(X(-p.t * 0.15, -p.h / 2), Y(-p.t * 0.15, -p.h / 2));
            const pr = p.t * 0.17;
            for (const f of [0.25, 0.75]) { const x = X(-p.t / 2, -p.h * f), y = Y(-p.t / 2, -p.h * f); pips.moveTo(x + pr, y); pips.arc(x, y, pr, 0, 6.2832); }
          }
          const col = s.colors[r.c];
          ctx.fillStyle = col; ctx.strokeStyle = col;
          ctx.lineJoin = 'round';
          ctx.globalAlpha = s.dark ? 0.27 : 0.3;
          ctx.fill(slabs);
          ctx.globalAlpha = s.dark ? 0.62 : 0.7;
          ctx.lineWidth = clamp(r.ps[0].t * 0.12, 1, 1.8);
          ctx.stroke(slabs);
          ctx.stroke(lines);
          ctx.fill(pips);
        }
      },
    };
  });
}

/** @param {number} w @param {number} h @returns {[HTMLCanvasElement, CanvasRenderingContext2D|null]} */
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/** A domino from above while upright: its top edge. @param {string} color @returns {HTMLCanvasElement} */
function edge(color) {
  const [c, g] = canvas(64, 64);
  if (!g) return c;
  g.fillStyle = color; g.strokeStyle = color; g.lineWidth = 4;
  g.globalAlpha = 0.5;
  g.beginPath(); roundRect(g, 2, 2, 60, 60, 6); g.fill();
  g.globalAlpha = 1;
  g.stroke();
  return c;
}

/** A domino's face, lying down: two halves of pips along x. @param {string} color @param {number} a @param {number} b
 * @returns {HTMLCanvasElement} */
function face(color, a, b) {
  const [c, g] = canvas(128, 64);
  if (!g) return c;
  g.fillStyle = color; g.strokeStyle = color; g.lineWidth = 4;
  g.globalAlpha = 0.35;
  g.beginPath(); roundRect(g, 2, 2, 124, 60, 8); g.fill();
  g.globalAlpha = 1;
  g.stroke();
  g.fillRect(62, 8, 4, 48);
  /** Standard pip spots on a 3x3 grid. */
  const spots = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
  g.beginPath();
  [a, b].forEach((v, half) => {
    for (const q of spots[v]) {
      const x = half * 64 + 16 + (q % 3) * 16, y = 16 + Math.floor(q / 3) * 16;
      g.moveTo(x + 5, y); g.arc(x, y, 5, 0, 6.2832);
    }
  });
  g.fill();
  return c;
}
