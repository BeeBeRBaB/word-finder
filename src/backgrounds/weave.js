// Weave: warp threads hang taut on a loom while a shuttle runs back and forth across them, each
// pass laying one weft row that goes over and under the warp by the pattern, so the cloth grows
// row by row up from the bottom; when it is done it rests, fades and a new cloth begins. The
// seed picks the variant: a two-colour cloth in twill, herringbone, diamond or satin across the
// whole screen; a tartan, its colour stripes the same in warp and weft, in 2/2 twill; or a few
// narrow ribbons side by side, each on its own small loom with its own pattern and pace.

import { stage, clamp } from './stage.js';

/** @typedef {(i:number, j:number) => boolean} Pattern true where the warp lies on top */
/** @typedef {{x0:number, n:number, c:number, rows:number, rowT:number, t0:number, pat:Pattern,
 *   warp:number[], weft:number[], built:number, wefts:Map<number, Path2D>, warps:Map<number, Path2D>}} Bolt
 * warp and weft are colour indices repeating along the threads; built is how many rows the cached
 * paths hold */

const HOLD = 5;   // seconds the finished cloth rests
const FADE = 3;   // seconds it takes to fade

/** @type {Record<string, Pattern>} */
const PATTERNS = {
  twill: (i, j) => (i + j) % 4 < 2,
  herringbone: (i, j) => ((((Math.floor(i / 6) % 2 ? -i : i) + j) % 4) + 4) % 4 < 2,
  diamond: (i, j) => (Math.abs((i % 12) - 6) + Math.abs((j % 12) - 6)) % 4 < 2,
  satin: (i, j) => (i * 2 + j) % 5 === 0,
  basket: (i, j) => (Math.floor(i / 2) + Math.floor(j / 2)) % 2 === 0,
  plain: (i, j) => (i + j) % 2 === 0,
};

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    /** @type {Bolt[]} */
    let bolts = [];
    let warmed = false;

    /** A colour sequence: two colours, or a mirrored tartan sett. @param {boolean} tartan
     * @returns {number[]} */
    function sett(tartan) {
      if (!tartan) return [rng.int(nc)];
      /** @type {number[]} */
      const half = [];
      const k = 3 + rng.int(3);
      let last = -1;
      for (let i = 0; i < k; i++) {
        let col = rng.int(nc);
        if (col === last) col = (col + 1) % nc;
        last = col;
        const w = [1, 2, 4, 6][rng.int(4)];
        for (let q = 0; q < w; q++) half.push(col);
      }
      return half.concat(half.slice(1, -1).reverse());
    }

    /** @param {number} x0 @param {number} n warps @param {number} c cell @param {number} t0
     * @returns {Bolt} */
    function bolt(x0, n, c, t0) {
      const names = s.layout === 1 ? ['twill'] : s.layout === 2
        ? ['diamond', 'basket', 'herringbone', 'twill', 'satin'] : ['twill', 'herringbone', 'diamond', 'satin'];
      const pat = PATTERNS[names[rng.int(names.length)]];
      let warp = sett(s.layout === 1), weft = warp;
      if (s.layout !== 1) {
        weft = [(warp[0] + 1 + rng.int(Math.max(1, nc - 1))) % nc];
        if (s.layout === 2 && rng.random() < 0.6) warp = [warp[0], warp[0], weft[0], warp[0], warp[0]];
      }
      const rows = Math.ceil(s.H / c) + 1;
      const rowT = clamp(n * c / 520, 0.8, 2.6);
      return { x0, n, c, rows, rowT, t0, pat, warp, weft, built: -1, wefts: new Map(), warps: new Map() };
    }

    /** @param {number} t0 */
    function place(t0) {
      const m = Math.min(s.W, s.H);
      if (s.layout === 2) {
        const c = clamp(Math.round(m / 30), 12, 24);
        const k = clamp(Math.round(s.W / 280), 2, 6), slot = s.W / k;
        bolts = [];
        for (let q = 0; q < k; q++) {
          const n = clamp(Math.floor(slot * 0.62 / c), 6, 16);
          const b = bolt(Math.round(q * slot + (slot - n * c) / 2), n, c, t0 - q * 9 - rng.random() * 5);
          b.rowT *= 0.9 + rng.random() * 0.5;
          bolts.push(b);
        }
      } else {
        const c = clamp(Math.round(m / 24), 16, 34);
        const n = Math.ceil(s.W / c) + 1;
        bolts = [bolt(Math.round((s.W - n * c) / 2), n, c, t0)];
      }
    }

    /** Row j's centre, rows counted up from the bottom. @param {Bolt} b @param {number} j */
    const rowY = (b, j) => s.H - (j + 0.5) * b.c;

    /** Adds the weft of row j to `p`, in runs between the warps that lie on top, up to x = `to`.
     * @param {Bolt} b @param {number} j @param {Path2D|CanvasRenderingContext2D} p @param {number} to */
    function weftRow(b, j, p, to) {
      const y = rowY(b, j), tw = b.c * 0.64, gap = b.c * 0.06;
      let x = b.x0;
      for (let i = 0; i <= b.n; i++) {
        const wx = b.x0 + (i + 0.5) * b.c;
        if (i === b.n || b.pat(i, j)) {
          const end = Math.min(i === b.n ? b.x0 + b.n * b.c : wx - tw / 2 - gap, to);
          if (end > x) { p.moveTo(x, y); p.lineTo(end, y); }
          x = wx + tw / 2 + gap;
          if (x >= to) return;
        }
      }
    }

    /** Rebuilds the cached paths of the finished rows. @param {Bolt} b @param {number} done */
    function build(b, done) {
      b.built = done;
      b.wefts.clear(); b.warps.clear();
      /** @param {Map<number, Path2D>} map @param {number} k @returns {Path2D} */
      const get = (map, k) => { let p = map.get(k); if (!p) map.set(k, p = new Path2D()); return p; };
      for (let j = 0; j < done; j++) weftRow(b, j, get(b.wefts, b.weft[j % b.weft.length]), Infinity);
      // Each warp's runs on top, as one segment a run, stopping short where a weft crosses over.
      const inset = b.c * 0.08;
      for (let i = 0; i < b.n; i++) {
        const p = get(b.warps, b.warp[i % b.warp.length]), x = b.x0 + (i + 0.5) * b.c;
        let from = -1;
        for (let j = 0; j <= done; j++) {
          const on = j < done && b.pat(i, j);
          if (on && from < 0) from = j;
          if (!on && from >= 0) {
            p.moveTo(x, rowY(b, from) + b.c / 2 - inset);
            p.lineTo(x, rowY(b, j - 1) - b.c / 2 + inset);
            from = -1;
          }
        }
      }
    }

    return {
      lay() {
        if (!warmed) {
          warmed = true;
          place(s.t);
          // Start part-way, so the first frame already shows cloth.
          for (const b of bolts) b.t0 -= b.rows * b.rowT * 0.55;
          return;
        }
        // A resize rebuilds the loom, keeping how far each cloth had got.
        const prog = bolts.map((b) => (s.t - b.t0) / (b.rows * b.rowT + HOLD + FADE));
        place(s.t);
        bolts.forEach((b, q) => { b.t0 = s.t - (prog[q % prog.length] ?? 0) * (b.rows * b.rowT + HOLD + FADE); });
      },
      step() {
        bolts.forEach((b, q) => {
          if (s.t - b.t0 < b.rows * b.rowT + HOLD + FADE) return;
          const nb = bolt(b.x0, b.n, b.c, s.t);
          if (s.layout === 2) nb.rowT = b.rowT;
          bolts[q] = nb;
        });
      },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'butt';
        for (const b of bolts) {
          const age = s.t - b.t0, weave = b.rows * b.rowT;
          if (age < 0) continue;
          const fade = 1 - clamp((age - weave - HOLD) / FADE, 0, 1);
          const at = clamp(age / b.rowT, 0, b.rows), done = Math.floor(at), frac = at - done;
          if (done !== b.built) build(b, done);
          const tw = b.c * 0.64, left = b.x0, right = b.x0 + b.n * b.c;
          const fell = done < b.rows ? rowY(b, done) + b.c / 2 : 0;
          // The bare warp above the cloth, thin and taut.
          if (fell > 0) {
            ctx.beginPath();
            for (let i = 0; i < b.n; i++) { const x = b.x0 + (i + 0.5) * b.c; ctx.moveTo(x, 0); ctx.lineTo(x, fell); }
            ctx.strokeStyle = s.colors[b.warp[0]];
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = fade * clamp(age / 1.5, 0, 1) * (s.dark ? 0.22 : 0.28);
            ctx.stroke();
          }
          ctx.lineWidth = tw;
          ctx.globalAlpha = fade * (s.dark ? 0.32 : 0.4);
          for (const [k, p] of b.wefts) { ctx.strokeStyle = s.colors[k]; ctx.stroke(p); }
          ctx.globalAlpha = fade * (s.dark ? 0.42 : 0.5);
          for (const [k, p] of b.warps) { ctx.strokeStyle = s.colors[k]; ctx.stroke(p); }
          if (done >= b.rows) continue;
          // The row being laid: the shuttle runs left to right on even rows, back on odd ones.
          const ltr = done % 2 === 0, e = frac * frac * (3 - 2 * frac);
          const sx = ltr ? left + (right - left) * e : right - (right - left) * e;
          const y = rowY(b, done), wc = s.colors[b.weft[done % b.weft.length]];
          ctx.beginPath();
          if (ltr) weftRow(b, done, ctx, sx);
          else {
            // Laid from the right: the same runs, clipped to the right of the shuttle.
            ctx.save();
            ctx.beginPath(); ctx.rect(sx, y - b.c, right - sx + 1, b.c * 2); ctx.clip();
            ctx.beginPath();
            weftRow(b, done, ctx, Infinity);
          }
          ctx.strokeStyle = wc;
          ctx.globalAlpha = fade * (s.dark ? 0.32 : 0.4);
          ctx.stroke();
          ctx.globalAlpha = fade * (s.dark ? 0.42 : 0.5);
          for (const k of new Set(b.warp)) {
            ctx.beginPath();
            for (let i = 0; i < b.n; i++) {
              const x = b.x0 + (i + 0.5) * b.c;
              if (b.warp[i % b.warp.length] !== k || !b.pat(i, done) || (ltr ? x > sx : x < sx)) continue;
              ctx.moveTo(x, y + b.c / 2 - b.c * 0.08); ctx.lineTo(x, y - b.c / 2 + b.c * 0.08);
            }
            ctx.strokeStyle = s.colors[k];
            ctx.stroke();
          }
          if (!ltr) ctx.restore();
          // The shuttle: a pointed boat carrying the weft colour.
          const L = b.c * 1.3, Hh = b.c * 0.42, dir = ltr ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(sx + dir * L, y);
          ctx.quadraticCurveTo(sx, y - Hh * 2, sx - dir * L, y);
          ctx.quadraticCurveTo(sx, y + Hh * 2, sx + dir * L, y);
          ctx.fillStyle = wc;
          ctx.globalAlpha = fade * (s.dark ? 0.6 : 0.62);
          ctx.fill();
        }
      },
    };
  });
}
