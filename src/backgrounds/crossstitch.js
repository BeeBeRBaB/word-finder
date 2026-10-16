// Cross-stitch: a pattern is stitched X by X on aida cloth, row by row the way stitchers work a
// run of one colour: a line of half stitches out, then back the other way to cross them, a
// needle and its thread at work. The seed picks the variant: a sampler of small motifs (a
// heart, a tree, a house, a bird...) worked one after another, the oldest unpicked and redone;
// bands of repeating border pattern across the cloth, each with its own needle; or a few
// embroidery hoops, each with its patch of cloth and one motif, a new hoop as the oldest goes.

import { stage, TAU, clamp, mix } from './stage.js';

// Motifs: rows of cells, '.' bare cloth, 1-3 the thread colour.
/** @type {string[][]} */
const MOTIFS = [
  ['.11...11.', '1111.1111', '111111111', '111111111', '.1111111.', '..11111..', '...111...', '....1....'],
  ['....1....', '...111...', '..11111..', '...111...', '..11111..', '.1111111.', '..11111..', '.1111111.', '111111111', '....2....', '....2....'],
  ['....1....', '...111...', '..11111..', '.1111111.', '111111111', '.2222222.', '.2332332.', '.2222222.', '.2223222.', '.2223222.'],
  ['...111...', '..11111..', '.1122211.', '.1122211.', '..11111..', '...111...', '....3....', '.33.3....', '..333.33.', '....333..', '....3....'],
  ['..11......', '.1311.....', '11111...1.', '..1111.11.', '..111111..', '...1111...', '....2.....', '...22.....'],
  ['..11111..', '.1131311.', '113111311', '111111111', '...222...', '...222...', '..22222..'],
  ['....3....', '....3....', '...111...', '..1.1.1..', '.1111111.', '..2...2..', '.2.2.2.2.', '..2...2..'],
  ['....1....', '...121...', '..12221..', '.1223221.', '..12221..', '...121...', '....1....'],
];

/** @typedef {{x:number, y:number, cols:number, rows:number, cs:number, cell:Uint8Array, seq:number[],
 *   k:number, c0:number, cv:HTMLCanvasElement, g:CanvasRenderingContext2D, fade:number, hoop:number,
 *   slot:number}} Work
 * A piece of stitching: its cell (0,0) at x, y on screen, cols by rows cells of cs px, each
 * cell's thread (0 none); seq the half stitches in the order sewn (cell * 2, + 1 for the
 * crossing one), k of them done; colours from c0; its own canvas cv; fade when it began to
 * fade (-1 not); hoop the hoop's radius (0: plain cloth); slot where it sits. */
/** @typedef {{w:Work|null, acc:number, rate:number}} Needle */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const A = s.dark ? 0.66 : 0.7, nc = s.colors.length;
    /** @type {Work[]} */
    let works = [];
    /** @type {Needle[]} */
    let needles = [];
    let cs = 12, ox = 0, oy = 0, lastW = 0, lastH = 0, wait = 0;
    /** The weave as a tile one cell square at device pixels, filled across the screen. @type {CanvasPattern|null} */
    let cloth = null;
    const tile = document.createElement('canvas');
    /** Sampler cells, band rows or hoop spots. @type {{x:number, y:number, w:number, h:number}[]} */
    let slots = [];

    /** The order a stitcher works: row by row, each run of one colour out in half stitches and
     * back crossing them. @param {Uint8Array} cell @param {number} cols @param {number} rows @returns {number[]} */
    function order(cell, cols, rows) {
      const seq = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols;) {
          const v = cell[r * cols + c];
          if (!v) { c++; continue; }
          let e = c;
          while (e < cols && cell[r * cols + e] === v) e++;
          for (let i = c; i < e; i++) seq.push((r * cols + i) * 2);
          for (let i = e - 1; i >= c; i--) seq.push((r * cols + i) * 2 + 1);
          c = e;
        }
      }
      return seq;
    }

    /** A motif's cells, sometimes mirrored, or a random four-way symmetric one. @returns {[Uint8Array, number, number]} */
    function motif() {
      if (rng.random() < 0.25) {
        // A snowflake-like tile: one quarter at random, mirrored both ways.
        const h = 5, n = h * 2 - 1, cell = new Uint8Array(n * n);
        for (let r = 0; r < h; r++) {
          for (let c = 0; c < h; c++) {
            const v = rng.random() < (r === h - 1 || c === h - 1 ? 0.75 : 0.45) ? 1 + (Math.max(r, c) % 3) : 0;
            for (const [rr, cc] of [[r, c], [n - 1 - r, c], [r, n - 1 - c], [n - 1 - r, n - 1 - c]]) cell[rr * n + cc] = v;
          }
        }
        return [cell, n, n];
      }
      const m = MOTIFS[rng.int(MOTIFS.length)], flip = rng.random() < 0.5, rows = m.length, cols = m[0].length;
      const cell = new Uint8Array(rows * cols);
      m.forEach((row, r) => { for (let c = 0; c < cols; c++) { const ch = row[flip ? cols - 1 - c : c]; cell[r * cols + c] = ch === '.' ? 0 : Number(ch); } });
      return [cell, cols, rows];
    }

    /** A border band's cells: a repeating figure between two edge lines. @param {number} cols @param {number} rows @returns {Uint8Array} */
    function band(cols, rows) {
      const cell = new Uint8Array(cols * rows), kind = rng.int(4), p = 6 + 2 * rng.int(3), mid = (rows - 1) / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let v = 0;
          if (r === 0 || r === rows - 1) v = 3;
          else if (kind === 0) {
            // Zigzag.
            const t = Math.abs((c % p) - p / 2) / (p / 2) * (rows - 3) + 1;
            v = Math.abs(r - t) < 0.6 ? 1 : 0;
          } else if (kind === 1) {
            // Diamonds with a dot inside.
            const d = Math.abs((c % p) - p / 2) + Math.abs(r - mid);
            v = Math.abs(d - Math.min(p / 2, mid - 0.5)) < 0.6 ? 1 : d < 0.6 ? 2 : 0;
          } else if (kind === 2) {
            // A row of small hearts.
            const hx = c % p - Math.floor((p - 5) / 2), hy = r - Math.round(mid - 1.5);
            const H = ['.1.1.', '11111', '.111.', '..1..'];
            v = hx >= 0 && hx < 5 && hy >= 0 && hy < 4 && H[hy][hx] === '1' ? 1 + Math.floor(c / p) % 2 : 0;
          } else {
            // Crosses on a chequer.
            const cx = c % p - p / 2, cy = r - mid;
            v = (cx === 0 && Math.abs(cy) <= 1.5) || (Math.abs(cy) < 0.6 && Math.abs(cx) <= 1.5) ? 1 + Math.floor(c / p) % 2 : 0;
          }
          cell[r * cols + c] = v;
        }
      }
      return cell;
    }

    /** A piece of work over cells, with its canvas. @returns {Work} */
    function work(/** @type {number} */ x, /** @type {number} */ y, /** @type {Uint8Array} */ cell, /** @type {number} */ cols, /** @type {number} */ rows, /** @type {number} */ size, hoop = 0, slot = -1) {
      const cv = document.createElement('canvas');
      /** @type {Work} */
      const w = { x, y, cols, rows, cs: size, cell, seq: order(cell, cols, rows), k: 0, c0: rng.int(nc), cv,
        g: /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')), fade: -1, hoop, slot };
      render(w);
      return w;
    }
    /** The canvas's box about the work: room for the hoop, else a cell's margin. @param {Work} w @returns {number[]} */
    function frame(w) {
      if (w.hoop) {
        const cx = w.x + w.cols * w.cs / 2, cy = w.y + w.rows * w.cs / 2, r = w.hoop + w.cs * 1.2;
        return [cx - r, cy - r * 1.25, r * 2, r * 2.25];
      }
      return [w.x - w.cs, w.y - w.cs, (w.cols + 2) * w.cs, (w.rows + 2) * w.cs];
    }
    /** Redraws a work's canvas: its hoop and cloth, and the stitches done. @param {Work} w */
    function render(w) {
      const [fx, fy, fw, fh] = frame(w), { g } = w;
      w.cv.width = Math.ceil(fw * s.dpr); w.cv.height = Math.ceil(fh * s.dpr);
      g.setTransform(s.dpr, 0, 0, s.dpr, -fx * s.dpr, -fy * s.dpr);
      g.lineCap = 'round';
      if (w.hoop) {
        const cx = w.x + w.cols * w.cs / 2, cy = w.y + w.rows * w.cs / 2, r = w.hoop;
        // The cloth in the hoop, its weave, then the wooden rings and the clasp.
        g.save();
        g.beginPath(); g.arc(cx, cy, r, 0, TAU);
        g.globalAlpha = s.dark ? 0.1 : 0.14;
        g.fillStyle = s.ink; g.fill();
        g.clip();
        g.globalAlpha = s.dark ? 0.12 : 0.13;
        g.strokeStyle = s.ink; g.lineWidth = 1;
        g.beginPath();
        for (let x = w.x - Math.ceil(r / w.cs) * w.cs; x < cx + r; x += w.cs) { g.moveTo(x, cy - r); g.lineTo(x, cy + r); }
        for (let y = w.y - Math.ceil(r / w.cs) * w.cs; y < cy + r; y += w.cs) { g.moveTo(cx - r, y); g.lineTo(cx + r, y); }
        g.stroke();
        g.restore();
        const wood = s.colors[(w.c0 + 2) % nc], t = clamp(r * 0.06, 4, 9);
        g.globalAlpha = s.dark ? 0.45 : 0.5;
        g.strokeStyle = wood; g.lineWidth = t;
        g.beginPath(); g.arc(cx, cy, r + t * 0.5, 0, TAU); g.stroke();
        g.globalAlpha = s.dark ? 0.3 : 0.35;
        g.lineWidth = t * 0.6;
        g.beginPath(); g.arc(cx, cy, r + t * 1.3, 0, TAU); g.stroke();
        g.globalAlpha = s.dark ? 0.5 : 0.55;
        g.fillStyle = wood;
        g.fillRect(cx - t * 1.1, cy - r - t * 3.6, t * 2.2, t * 2.4);
      }
      for (let i = 0; i < w.k; i++) stitch(w, w.seq[i]);
    }
    /** Sews half stitch q onto a work's canvas. @param {Work} w @param {number} q */
    function stitch(w, q) {
      const { g } = w, i = q >> 1, c = i % w.cols, r = (i - c) / w.cols, z = w.cs, x = w.x + c * z, y = w.y + r * z, e = z * 0.14;
      const [x0, y0, x1, y1] = q & 1 ? [x + z - e, y + z - e, x + e, y + e] : [x + e, y + z - e, x + z - e, y + e];
      g.globalAlpha = A;
      g.strokeStyle = s.colors[(w.c0 + w.cell[i]) % nc];
      g.lineWidth = z * 0.28;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      // The sheen of the floss along it.
      const nx = (y1 - y0) / z * 0.06 * z, ny = -(x1 - x0) / z * 0.06 * z;
      g.globalAlpha = A * (s.dark ? 0.35 : 0.45);
      g.strokeStyle = '#fff';
      g.lineWidth = z * 0.07;
      g.beginPath(); g.moveTo(x0 + nx, y0 + ny); g.lineTo(x1 + nx, y1 + ny); g.stroke();
    }

    /** Snaps a px position to the cloth's weave. @param {number} v @param {number} o @returns {number} */
    const snap = (v, o) => o + Math.round((v - o) / cs) * cs;

    /** A new piece for a slot (layouts 0, 1) or a clear spot (layout 2). @param {number} si @returns {Work|null} */
    function make(si) {
      if (layout === 1) {
        const b = slots[si], cols = Math.ceil(s.W / cs) + 1, rows = Math.round(b.h / cs);
        return work(snap(0, ox) - cs, snap(b.y, oy), band(cols, rows), cols, rows, cs, 0, si);
      }
      const [cell, cols, rows] = motif();
      if (layout === 0) {
        const b = slots[si];
        return work(snap(b.x + (b.w - cols * cs) / 2, ox), snap(b.y + (b.h - rows * cs) / 2, oy), cell, cols, rows, cs, 0, si);
      }
      // A hoop somewhere clear, away from the middle where it can be.
      const R = clamp(Math.min(s.W, s.H) * 0.17, 66, 170), z = Math.min(cs * 1.5, R * 1.45 / Math.max(cols, rows));
      let best = -Infinity, at = { x: 0, y: 0 };
      for (let t = 0; t < 14; t++) {
        const x = mix(R * 1.25, s.W - R * 1.25, rng.random()), y = mix(R * 1.55, s.H - R * 1.25, rng.random());
        let far = s.W + s.H;
        for (const o of works) if (o.fade < 0) far = Math.min(far, Math.hypot(o.x + o.cols * o.cs / 2 - x, o.y + o.rows * o.cs / 2 - y) - o.hoop - R * 1.25);
        const score = Math.min(far, R) * 3 + Math.hypot(x - s.W / 2, y - s.H / 2) * 0.3;
        if (score > best) { best = score; at = { x, y }; }
      }
      if (best < 0 && works.length) return null;
      return work(at.x - cols * z / 2, at.y - rows * z / 2, cell, cols, rows, z, R);
    }

    /** What a free needle takes on next. @param {Needle} n @param {number} ni */
    function assign(n, ni) {
      n.w = null;
      if (layout === 1) {
        // Each band has its own needle; a finished band holds, fades, and is worked anew.
        const old = works.find((w) => w.slot === ni && w.fade < 0);
        if (old && old.k >= old.seq.length) { old.fade = s.t + 6; n.acc = -8.5; }
        if (!old || old.fade >= 0) { const w = make(ni); if (w) { works.push(w); n.w = w; } }
        else n.w = old;
        return;
      }
      if (s.t < wait) return;
      const live = works.filter((w) => w.fade < 0);
      const most = layout === 0 ? slots.length : clamp(Math.round(s.W * s.H / 260000), 2, 6);
      if (live.length < most) {
        const used = new Set(live.map((w) => w.slot));
        const free = slots.map((_, i) => i).filter((i) => !used.has(i));
        const w = make(layout === 0 ? free[rng.int(free.length)] : -1);
        if (w) { works.push(w); n.w = w; n.acc = -0.6; return; }
      }
      // Full: after a hold, the oldest is taken out and its place worked again.
      if (live.length) { live[0].fade = s.t + 3; wait = s.t + 5.2; }
    }

    /** Lays out fresh cloth and stitches much of it, so a still frame shows the idea. */
    function build() {
      const m = Math.min(s.W, s.H);
      cs = clamp(Math.round(m * 0.022), 8, 15);
      ox = (s.W % cs) / 2; oy = (s.H % cs) / 2;
      works = []; slots = []; wait = 0;
      weave();
      if (layout === 0) {
        const cols = clamp(Math.round(s.W / (cs * 15)), 2, 8), rows = clamp(Math.round(s.H / (cs * 15)), 2, 6);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ x: c * s.W / cols, y: r * s.H / rows, w: s.W / cols, h: s.H / rows });
      } else if (layout === 1) {
        const rows = 7 + 2 * rng.int(2), n = clamp(Math.floor(s.H / (cs * (rows + 4))), 2, 6), gap = s.H / n;
        for (let i = 0; i < n; i++) slots.push({ x: 0, y: gap * (i + 0.5) - rows * cs / 2, w: s.W, h: rows * cs });
      }
      const nn = layout === 1 ? slots.length : 1;
      needles = Array.from({ length: nn }, () => ({ w: null, acc: 0, rate: layout === 1 ? 0.045 : 0.075 }));
      // Warm up: whole pieces done, and the one in hand part-way.
      if (layout === 1) {
        needles.forEach((n, i) => {
          assign(n, i);
          if (n.w) { n.w.k = Math.floor(n.w.seq.length * (0.3 + rng.random() * 0.65)); render(n.w); }
        });
        return;
      }
      const done = layout === 0 ? Math.max(1, slots.length - 1 - rng.int(Math.ceil(slots.length * 0.3))) : clamp(Math.round(s.W * s.H / 260000), 2, 6) - 1;
      for (let i = 0; i <= done; i++) {
        assign(needles[0], 0);
        const w = needles[0].w;
        if (!w) break;
        w.k = i < done ? w.seq.length : Math.floor(w.seq.length * (0.25 + rng.random() * 0.5));
        render(w);
      }
      needles[0].acc = 0;
    }

    /** Paints the weave tile: one line down its left and one along its top. */
    function weave() {
      cloth = null;
      const g = tile.getContext('2d');
      if (layout === 2 || !g) return;
      tile.width = tile.height = Math.max(2, Math.round(cs * s.dpr));
      g.globalAlpha = s.dark ? 0.07 : 0.09;
      g.fillStyle = s.ink;
      const t = Math.max(1, Math.round(s.dpr));
      g.fillRect(0, 0, t, tile.height); g.fillRect(t, 0, tile.width - t, t);
      cloth = s.ctx.createPattern(tile, 'repeat');
    }

    s.onDpr = () => { weave(); for (const w of works) render(w); };

    /** Where a needle is: the corners of the half stitch it is making. @param {Needle} n @returns {number[]|null} */
    function at(n) {
      const w = n.w;
      if (!w || w.k >= w.seq.length || n.acc < 0) return null;
      const q = w.seq[w.k], i = q >> 1, c = i % w.cols, r = (i - c) / w.cols, z = w.cs, x = w.x + c * z, y = w.y + r * z;
      const u = clamp(n.acc / n.rate, 0, 1);
      const [x0, y0, x1, y1] = q & 1 ? [x + z, y + z, x, y] : [x, y + z, x + z, y];
      return [mix(x0, x1, u), mix(y0, y1, u), (w.c0 + w.cell[i]) % nc];
    }

    return {
      lay() {
        if (s.W === lastW && s.H === lastH) return;
        lastW = s.W; lastH = s.H;
        build();
      },
      step(dt) {
        needles.forEach((n, i) => {
          if (!n.w) { assign(n, i); return; }
          n.acc += dt;
          while (n.w && n.acc >= n.rate) {
            n.acc -= n.rate;
            const w = n.w;
            stitch(w, w.seq[w.k]);
            if (++w.k >= w.seq.length) { assign(n, i); if (n.acc > 0) n.acc = Math.min(n.acc, 0); }
          }
        });
        works = works.filter((w) => w.fade < 0 || s.t - w.fade < 2);
      },
      draw() {
        const { ctx } = s, k = 1 / s.dpr;
        if (cloth) {
          // In device pixels, so the tile lines up with the stitches' cells.
          const d = s.dpr, q = tile.width;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1;
          ctx.fillStyle = cloth;
          ctx.translate(Math.round(ox * d) % q, Math.round(oy * d) % q);
          ctx.fillRect(-q, -q, s.cv.width + q, s.cv.height + q);
          ctx.setTransform(d, 0, 0, d, 0, 0);
        }
        for (const w of works) {
          const [fx, fy] = frame(w);
          ctx.globalAlpha = w.fade < 0 || s.t < w.fade ? 1 : clamp(1 - (s.t - w.fade) / 2, 0, 1);
          ctx.drawImage(w.cv, Math.round(fx * s.dpr) * k, Math.round(fy * s.dpr) * k, w.cv.width * k, w.cv.height * k);
        }
        // Each needle, its point at the stitch, its thread trailing from the eye.
        ctx.lineCap = 'round';
        for (const n of needles) {
          const p = at(n);
          if (!p || !n.w) continue;
          const z = n.w.cs, ex = p[0] + z * 1.7, ey = p[1] - z * 1.7;
          ctx.globalAlpha = s.dark ? 0.5 : 0.55;
          ctx.strokeStyle = s.colors[p[2]];
          ctx.lineWidth = z * 0.16;
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.quadraticCurveTo(ex + z * 2.5, ey + z * 0.5, ex + z * 3, ey + z * 2.5); ctx.stroke();
          ctx.globalAlpha = s.dark ? 0.7 : 0.75;
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = Math.max(1.2, z * 0.11);
          ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(ex, ey); ctx.stroke();
        }
      },
    };
  });
}
