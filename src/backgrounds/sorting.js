// Sorting: rows of bars put themselves in order of height by bubble, insertion or quick sort,
// the pair being compared lit and swapped bars gliding past each other; once sorted a check runs
// along them, they shuffle and the next sort begins. The seed picks the variant: rows stacked
// down the page, each on its own sort; one wide chart along the bottom; or a ring of spokes.

import { stage, TAU, clamp } from './stage.js';

const SORTS = 3;    // bubble, insertion, quick
const RUN = 40;     // s a sort aims to take, however many steps it needs
const CHECK = 1.6;  // s for the check to run along a sorted row
const MIX = 1.8;    // s to shuffle

/** @typedef {{n:number, order:Int32Array, px:Float32Array, hot:Float32Array, ops:Int32Array,
 *   k:number, dt:number, clock:number, algo:number, phase:number, pt:number,
 *   x:number, y:number, w:number, h:number}} Row
 * order: the value at each slot (0..n-1); px: each value's shown slot, easing to its place; hot:
 * each value's highlight; ops: the sort, as (0 compare | 1 swap, i, j) triples, k the next and
 * dt the time each takes; phase 0 sorting, 1 checking, 2 shuffling. x, y, w, h: the box (rows
 * and chart: left, baseline, width, tallest bar; ring: centre, outer and inner radius). */

/**
 * Runs sort `algo` on a copy and records its steps.
 * @param {Int32Array} start @param {number} algo @returns {Int32Array}
 */
function record(start, algo) {
  const a = Int32Array.from(start), n = a.length;
  /** @type {number[]} */
  const out = [];
  /** @param {number} i @param {number} j */
  const swap = (i, j) => { out.push(1, i, j); const t = a[i]; a[i] = a[j]; a[j] = t; };
  if (algo === 0) {
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1 - i; j++) { out.push(0, j, j + 1); if (a[j] > a[j + 1]) swap(j, j + 1); }
    }
  } else if (algo === 1) {
    for (let i = 1; i < n; i++) {
      for (let j = i; j > 0; j--) { out.push(0, j - 1, j); if (a[j - 1] > a[j]) swap(j - 1, j); else break; }
    }
  } else {
    /** @param {number} lo @param {number} hi */
    const quick = (lo, hi) => {
      if (lo >= hi) return;
      let i = lo;
      for (let j = lo; j < hi; j++) { out.push(0, j, hi); if (a[j] < a[hi]) { if (i !== j) swap(i, j); i++; } }
      if (i !== hi) swap(i, hi);
      quick(lo, i - 1); quick(i + 1, hi);
    };
    quick(0, n - 1);
  }
  return Int32Array.from(out);
}

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const FILL = s.dark ? 0.26 : 0.32, LIT = s.dark ? 0.42 : 0.4;
    /** @type {Row[]} */
    let rows = [];

    /** A row of n bars part way through sort algo. @param {number} n @param {number} algo @returns {Row} */
    function row(n, algo) {
      const order = Int32Array.from(rng.shuffle([...Array(n).keys()]));
      /** @type {Row} */
      const r = { n, order, px: new Float32Array(n), hot: new Float32Array(n), ops: new Int32Array(0), k: 0, dt: 0,
        clock: 0, algo, phase: 0, pt: 0, x: 0, y: 0, w: 0, h: 0 };
      begin(r);
      const k = Math.floor(r.ops.length / 3 * (0.15 + rng.random() * 0.6));
      while (r.k < k) apply(r);
      for (let i = 0; i < n; i++) r.px[order[i]] = i;
      // Only the latest steps stay lit.
      r.hot.fill(0);
      for (let q = 3; q >= 1; q--) {
        const o = (r.k - q) * 3;
        if (o >= 0) r.hot[order[r.ops[o + 1]]] = r.hot[order[r.ops[o + 2]]] = 1 - (q - 1) * 0.3;
      }
      return r;
    }

    /** @param {Row} r */
    function begin(r) {
      r.ops = record(r.order, r.algo);
      r.k = 0; r.clock = 0; r.phase = 0; r.pt = 0;
      r.dt = clamp(RUN / Math.max(1, r.ops.length / 3), 1 / 90, 0.25);
    }

    /** Takes the next step. @param {Row} r */
    function apply(r) {
      const o = r.k * 3, i = r.ops[o + 1], j = r.ops[o + 2], { order } = r;
      if (r.ops[o]) { const t = order[i]; order[i] = order[j]; order[j] = t; }
      r.hot[order[i]] = r.hot[order[j]] = 1;
      r.k++;
    }

    /** @param {Row} r @param {number} dt */
    function advance(r, dt) {
      r.pt += dt;
      if (r.phase === 0) {
        r.clock += dt;
        while (r.clock >= r.dt && r.k * 3 < r.ops.length) { r.clock -= r.dt; apply(r); }
        if (r.k * 3 >= r.ops.length) { r.phase = 1; r.pt = 0; }
      } else if (r.phase === 1) {
        const i = Math.floor(r.pt / CHECK * r.n);
        if (i < r.n) r.hot[r.order[i]] = 1;
        if (r.pt > CHECK + 0.8) {
          r.order = Int32Array.from(rng.shuffle([...r.order]));
          r.phase = 2; r.pt = 0;
        }
      } else if (r.pt > MIX) {
        r.algo = (r.algo + 1) % SORTS;
        begin(r);
      }
      // Bars glide to their slots, slower while shuffling; highlights fade.
      const ease = 1 - Math.exp(-dt * (r.phase === 2 ? 2.6 : 16)), fade = Math.exp(-dt * 3.5);
      for (let i = 0; i < r.n; i++) {
        const v = r.order[i];
        r.px[v] += (i - r.px[v]) * ease;
        r.hot[i] *= fade;
      }
    }

    /** @param {Row} r */
    function paintRow(r) {
      const { ctx } = s, n = r.n;
      if (layout === 2) {
        ctx.lineCap = 'butt';
        ctx.lineWidth = Math.max(2, TAU * r.h / n * 0.72);
        for (let v = 0; v < n; v++) {
          const a = -Math.PI / 2 + (r.px[v] + 0.5) / n * TAU, len = r.h + (r.w - r.h) * (v + 1) / n;
          const c = Math.cos(a), sn = Math.sin(a);
          ctx.strokeStyle = s.colors[Math.floor(v * nc / n)];
          ctx.globalAlpha = FILL + LIT * r.hot[v];
          ctx.beginPath(); ctx.moveTo(r.x + c * r.h, r.y + sn * r.h); ctx.lineTo(r.x + c * len, r.y + sn * len); ctx.stroke();
        }
        return;
      }
      const pitch = r.w / n, bw = Math.max(1.5, pitch * 0.68);
      for (let v = 0; v < n; v++) {
        const h = r.h * (v + 1) / n;
        ctx.fillStyle = s.colors[Math.floor(v * nc / n)];
        ctx.globalAlpha = FILL + LIT * r.hot[v];
        ctx.fillRect(r.x + r.px[v] * pitch + (pitch - bw) / 2, r.y - h, bw, h);
      }
    }

    return {
      lay() {
        const { W, H } = s;
        const m = Math.min(W, H);
        /** @type {{n:number, x:number, y:number, w:number, h:number}[]} */
        const boxes = [];
        if (layout === 0) {
          const k = clamp(Math.round(H / 190), 2, 6), bh = H / k, n = clamp(Math.round(W / 24), 16, 48);
          for (let i = 0; i < k; i++) boxes.push({ n, x: W * 0.04, y: (i + 1) * bh - bh * 0.14, w: W * 0.92, h: bh * 0.7 });
        } else if (layout === 1) {
          boxes.push({ n: clamp(Math.round(W / 18), 24, 72), x: W * 0.03, y: H * 0.95, w: W * 0.94, h: H * 0.72 });
        } else {
          // A long page holds two rings along it.
          const tall = H > W * 1.4, wide = W > H * 1.65;
          const R = tall ? Math.min(W * 0.47, H * 0.24) : wide ? Math.min(H * 0.47, W * 0.24) : m * 0.47;
          const n = clamp(Math.round(R * 0.17), 28, 64);
          for (let i = 0; i < (tall || wide ? 2 : 1); i++) {
            const u = tall || wide ? (i ? 0.73 : 0.27) : 0.5;
            boxes.push({ n, x: wide ? W * u : W / 2, y: tall ? H * u : H / 2, w: R, h: R * 0.34 });
          }
        }
        const first = rng.int(SORTS);
        rows.length = boxes.length;
        boxes.forEach((b, i) => {
          if (!rows[i] || rows[i].n !== b.n) rows[i] = row(b.n, (first + i) % SORTS);
          Object.assign(rows[i], { x: b.x, y: b.y, w: b.w, h: b.h });
        });
      },
      step(dt) { for (const r of rows) advance(r, dt); },
      draw() { for (const r of rows) paintRow(r); },
    };
  });
}
