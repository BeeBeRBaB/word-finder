// Blueprint: technical drawings draft themselves on a grid, a crosshair at the pen: centre lines
// first, then outlines, hatching, and dimension lines with their arrows and figures. The seed
// picks the variant: a drawing sheet, its border and title block drawn first, then parts
// (flanges, brackets, shafts, nuts) one after another until it is full, then a fresh sheet; a
// catalogue grid of numbered parts, the oldest fading and drafted anew; or a house's floor plan,
// walls, doors and windows, dimension chains and room names, drawn and then begun again.

import { stage, clamp, mix } from './stage.js';

/** @typedef {{k:number, r:number, p:number[], L:number[], t?:string, a?:number}} Op
 * k: 0 a line drawn along p, 1 a filled polygon, 2 text at p (turned a), 3 a wall, a rect
 * p = [x, y, w, h] that grows along its length; r its role (OUT, THIN...); L lengths along p. */
/** @typedef {{x:number, y:number, w:number, h:number, ops:Op[], oi:number, dd:number, c:number,
 *   cv:HTMLCanvasElement|null, g:CanvasRenderingContext2D|null, fade:number, cell:number}} Part
 * x, y, w, h its box; ops drawn up to oi, dd px into that one; c its colour; cv its own small
 * canvas (none for the sheet border and the plan, drawn as lines each frame); fade when it began
 * to fade (-1 not); cell its catalogue cell. */

const OUT = 0, THIN = 1, CTR = 2, HATCH = 3, TEXT = 4, HID = 5, WALL = 6;
// Per role: line width (times the base), alpha, and how fast the pen goes.
const ROLE = [
  { w: 1.7, a: 1, v: 1 }, { w: 0.85, a: 0.75, v: 1.5 }, { w: 0.85, a: 0.8, v: 1.7 },
  { w: 0.8, a: 0.55, v: 2.4 }, { w: 1, a: 0.85, v: 1 }, { w: 0.9, a: 0.75, v: 1.5 }, { w: 1, a: 0.5, v: 0.9 },
];
const ROOMS = ['LIVING', 'KITCHEN', 'BED', 'BED 2', 'BATH', 'HALL', 'STUDY', 'STORE', 'DINING', 'UTILITY', 'WC', 'PORCH'];
const FONT = "500 {}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const LINE = s.dark ? 0.62 : 0.66, nc = s.colors.length;
    /** @type {Part[]} */
    let parts = [];
    /** The sheet border or the floor plan: drawn as lines every frame. @type {Part|null} */
    let vec = null;
    /** @type {Part|null} */
    let cur = null;
    let wait = 0, gap = 0, lw = 1, fs = 10, as = 6, pv = 200, m = 400, lastW = 0, lastH = 0, count = 0;
    /** @type {Path2D|null} */
    let minor = null;
    /** @type {Path2D|null} */
    let major = null;
    /** Catalogue cells. @type {{x:number, y:number, w:number, h:number}[]} */
    let cells = [];
    const pen = { x: -99, y: -99, on: false };

    /** @param {number[]} p @returns {number[]} */
    function lens(p) {
      const L = [0];
      for (let i = 2; i < p.length; i += 2) L.push(L[L.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
      return L;
    }
    /** @param {number} r @param {number[]} p @returns {Op} */
    const path = (r, p) => ({ k: 0, r, p, L: lens(p) });
    /** @returns {Op} */
    const ln = (/** @type {number} */ r, /** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) => path(r, [x0, y0, x1, y1]);
    /** A circle (or an arc from a0 to a1) as a line. @returns {Op} */
    function circ(/** @type {number} */ r, /** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ rad, a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2) {
      const n = Math.max(10, Math.ceil(Math.abs(a1 - a0) * rad / 5)), p = [];
      for (let i = 0; i <= n; i++) { const a = mix(a0, a1, i / n); p.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
      return path(r, p);
    }
    /** @param {number} x @param {number} y @param {string} t @param {number} [a] @returns {Op} */
    const txt = (x, y, t, a = 0) => ({ k: 2, r: TEXT, p: [x, y], L: [0, 0], t, a });
    /** An arrowhead with its tip at x, y, pointing along a. @returns {Op} */
    function arrow(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ a) {
      const c = Math.cos(a), s2 = Math.sin(a), w = as * 0.32;
      return { k: 1, r: THIN, p: [x, y, x - c * as - s2 * w, y - s2 * as + c * w, x - c * as + s2 * w, y - s2 * as - c * w], L: [0, 0] };
    }
    /** A closed outline. @param {number} r @param {number[]} p @returns {Op} */
    const poly = (r, p) => path(r, [...p, p[0], p[1]]);
    /** @param {number} mm @returns {string} */
    const num = (mm) => String(Math.max(5, Math.round(mm / 5) * 5));

    /** A horizontal dimension: extension lines down (or up) from y to the line at yd. @param {Op[]} o
     * @param {number} x1 @param {number} x2 @param {number} y @param {number} yd @param {number} k px to mm */
    function dimH(o, x1, x2, y, yd, k) {
      const sg = Math.sign(yd - y), e = as * 0.7;
      o.push(ln(THIN, x1, y + sg * 2, x1, yd + sg * e), ln(THIN, x2, y + sg * 2, x2, yd + sg * e), ln(THIN, x1, yd, x2, yd),
        arrow(x1, yd, Math.PI), arrow(x2, yd, 0), txt((x1 + x2) / 2, yd - 3, num((x2 - x1) * k)));
    }
    /** A vertical dimension, its figure turned to read from the right. @param {Op[]} o @param {number} y1
     * @param {number} y2 @param {number} x @param {number} xd @param {number} k */
    function dimV(o, y1, y2, x, xd, k) {
      const sg = Math.sign(xd - x), e = as * 0.7;
      o.push(ln(THIN, x + sg * 2, y1, xd + sg * e, y1), ln(THIN, x + sg * 2, y2, xd + sg * e, y2), ln(THIN, xd, y1, xd, y2),
        arrow(xd, y1, -Math.PI / 2), arrow(xd, y2, Math.PI / 2), txt(xd - 3, (y1 + y2) / 2, num((y2 - y1) * k), -Math.PI / 2));
    }
    /** A diameter: a leader from the circle out at angle a, with a shelf for the figure. @param {Op[]} o */
    function dia(o, /** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ rad, /** @type {number} */ a, /** @type {number} */ k, /** @type {number} */ out) {
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad, x2 = cx + Math.cos(a) * (rad + out), y2 = cy + Math.sin(a) * (rad + out);
      const sh = Math.cos(a) >= 0 ? fs * 3.2 : -fs * 3.2;
      o.push(path(THIN, [x, y, x2, y2, x2 + sh, y2]), arrow(x, y, a + Math.PI), txt(x2 + sh / 2, y2 - 3, 'Ø' + num(rad * 2 * k)));
    }
    /** 45-degree hatching across a rect. @param {Op[]} o */
    function hatch(o, /** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) {
      const sp = clamp(m * 0.012, 4.5, 8);
      for (let c = x0 + y0 + sp * 0.5; c < x1 + y1; c += sp) {
        const xa = Math.max(x0, c - y1), xb = Math.min(x1, c - y0);
        if (xb - xa > 0.5) o.push(ln(HATCH, xa, c - xa, xb, c - xb));
      }
    }
    /** A centre cross for a hole. @param {Op[]} o */
    function cross(o, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
      o.push(ln(CTR, x - r, y, x + r, y), ln(CTR, x, y - r, x, y + r));
    }

    // The parts, each about d across, drawn in this order: centre lines, outlines, hatching,
    // dimensions, label. Built about 0,0 and moved into place after.
    /** @param {number} d @param {number} k @returns {Op[]} */
    function flange(d, k) {
      const R = d / 2, r = R * (0.26 + rng.random() * 0.12), n = [4, 6, 8][rng.int(3)], br = R * 0.72, hr = R * 0.085;
      const x0 = R * 1.6, t = R * (0.32 + rng.random() * 0.12), o = /** @type {Op[]} */ ([]);
      o.push(ln(CTR, -R * 1.18, 0, x0 + t + R * 0.18, 0), ln(CTR, 0, -R * 1.18, 0, R * 1.18), circ(CTR, 0, 0, br));
      o.push(circ(OUT, 0, 0, R), circ(OUT, 0, 0, r));
      for (let i = 0; i < n; i++) { const a = (i + 0.5) * Math.PI * 2 / n; o.push(circ(OUT, Math.cos(a) * br, Math.sin(a) * br, hr)); }
      o.push(poly(OUT, [x0, -R, x0 + t, -R, x0 + t, -r, x0, -r]), poly(OUT, [x0, r, x0 + t, r, x0 + t, R, x0, R]));
      hatch(o, x0, -R, x0 + t, -r); hatch(o, x0, r, x0 + t, R);
      dia(o, 0, 0, R, -Math.PI / 4, k, R * 0.3);
      dia(o, 0, 0, r, Math.PI * 0.8, k, R * 0.95);
      dimH(o, x0, x0 + t, R, R + R * 0.32, k);
      dimV(o, -R, R, x0 + t, x0 + t + R * 0.36, k);
      o.push(txt(x0 + t / 2, -R - fs, 'A-A'));
      return o;
    }
    /** @param {number} d @param {number} k @returns {Op[]} */
    function bracket(d, k) {
      const w = d * (1.1 + rng.random() * 0.3), h = d * (0.8 + rng.random() * 0.25), t = d * 0.25, f = t * 0.5, hr = t * 0.22;
      const o = /** @type {Op[]} */ ([]), p = [0, 0, t, 0, t, h - t - f];
      for (let i = 1; i <= 8; i++) { const a = Math.PI - i / 8 * Math.PI / 2; p.push(t + f + Math.cos(a) * f, h - t - f + Math.sin(a) * f); }
      p.push(w, h - t, w, h, 0, h);
      cross(o, t / 2, h * 0.3, hr * 1.7); cross(o, w * 0.74, h - t / 2, hr * 1.7);
      o.push(poly(OUT, p), circ(OUT, t / 2, h * 0.3, hr), circ(OUT, w * 0.74, h - t / 2, hr));
      // The hidden counterbore under the first hole.
      o.push(ln(HID, 0, h * 0.3 - hr * 1.6, t, h * 0.3 - hr * 1.6), ln(HID, 0, h * 0.3 + hr * 1.6, t, h * 0.3 + hr * 1.6));
      dimH(o, 0, w, h, h + d * 0.26, k); dimV(o, 0, h, 0, -d * 0.26, k);
      dimH(o, 0, t, 0, -d * 0.2, k); dimV(o, h - t, h, w, w + d * 0.2, k);
      return o;
    }
    /** @param {number} d @param {number} k @returns {Op[]} */
    function shaft(d, k) {
      const n = 3 + rng.int(3), len = d * 1.9, o = /** @type {Op[]} */ ([]);
      const ls = Array.from({ length: n }, () => 0.6 + rng.random()), sum = ls.reduce((a, b) => a + b, 0);
      const mid = rng.int(n), rs = ls.map((_, i) => d * (0.34 - Math.abs(i - mid) * 0.07 - rng.random() * 0.03));
      const xs = [0];
      for (const l of ls) xs.push(xs[xs.length - 1] + l / sum * len);
      const top = [], bot = [], c = rs[0] * 0.15, c2 = rs[n - 1] * 0.15;
      top.push(0, -rs[0] + c, c, -rs[0]);
      for (let i = 0; i < n; i++) { top.push(i === n - 1 ? xs[n] - c2 : xs[i + 1], -rs[i]); if (i < n - 1) top.push(xs[i + 1], -rs[i + 1]); }
      top.push(xs[n], -rs[n - 1] + c2);
      for (let i = top.length - 2; i >= 0; i -= 2) bot.push(top[i], -top[i + 1]);
      o.push(ln(CTR, -d * 0.1, 0, len + d * 0.1, 0));
      o.push(path(OUT, [...top, ...bot, top[0], top[1]]));
      for (let i = 1; i < n; i++) { const r = Math.min(rs[i - 1], rs[i]); o.push(ln(OUT, xs[i], -r, xs[i], r)); }
      o.push(ln(OUT, c, -rs[0], c, rs[0]), ln(OUT, xs[n] - c2, -rs[n - 1], xs[n] - c2, rs[n - 1]));
      // A keyway on the widest step.
      const kx = (xs[mid] + xs[mid + 1]) / 2, kl = (xs[mid + 1] - xs[mid]) * 0.3, kh = rs[mid] * 0.16;
      o.push(path(OUT, [kx - kl, -kh, kx + kl, -kh, ...circ(OUT, kx + kl, 0, kh, -Math.PI / 2, Math.PI / 2).p.slice(2),
        kx - kl, kh, ...circ(OUT, kx - kl, 0, kh, Math.PI / 2, Math.PI * 1.5).p.slice(2)]));
      const rm = Math.max(...rs);
      dimH(o, 0, len, rs[0], rm + d * 0.42, k);
      dimH(o, xs[mid], xs[mid + 1], rs[mid], rm + d * 0.2, k);
      const j = mid ? 0 : n - 1, dx = (xs[j] + xs[j + 1]) / 2;
      o.push(ln(THIN, dx, -rs[j], dx, rs[j]), arrow(dx, -rs[j], -Math.PI / 2), arrow(dx, rs[j], Math.PI / 2),
        txt(dx - 3, 0, 'Ø' + num(rs[j] * 2 * k), -Math.PI / 2));
      return o;
    }
    /** @param {number} d @param {number} k @returns {Op[]} */
    function nut(d, k) {
      const R = d * 0.48, af = R * Math.cos(Math.PI / 6), hr = R * 0.42, o = /** @type {Op[]} */ ([]), hex = [];
      for (let i = 0; i < 6; i++) hex.push(Math.cos(i * Math.PI / 3) * R, Math.sin(i * Math.PI / 3) * R);
      const x0 = R * 1.5, th = R * 0.85;
      o.push(ln(CTR, -R * 1.2, 0, x0 + th + R * 0.2, 0), ln(CTR, 0, -R * 1.2, 0, R * 1.2));
      o.push(poly(OUT, hex), circ(THIN, 0, 0, af), circ(OUT, 0, 0, hr), circ(THIN, 0, 0, hr * 1.2, 0, Math.PI * 1.5));
      o.push(poly(OUT, [x0, -R, x0 + th, -R, x0 + th, R, x0, R]), ln(OUT, x0, -R / 2, x0 + th, -R / 2), ln(OUT, x0, R / 2, x0 + th, R / 2));
      o.push(ln(HID, x0, -hr, x0 + th, -hr), ln(HID, x0, hr, x0 + th, hr));
      dimV(o, -af, af, -R, -R - d * 0.24, k);
      dimH(o, x0, x0 + th, R, R + d * 0.24, k);
      return o;
    }
    const MAKERS = [flange, bracket, shaft, nut];

    /** Moves ops by dx, dy and scales them by sc about 0,0. @param {Op[]} o @returns {number[]} their box */
    function box(o) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const op of o) {
        const pad = op.k === 2 ? fs * 2.2 : 0;
        for (let i = 0; i < op.p.length; i += 2) {
          if (op.k === 3 && i) break;
          x0 = Math.min(x0, op.p[i] - pad); x1 = Math.max(x1, op.p[i] + pad); y0 = Math.min(y0, op.p[i + 1] - pad); y1 = Math.max(y1, op.p[i + 1] + pad);
        }
      }
      return [x0, y0, x1, y1];
    }
    /** @param {Op[]} o @param {number} dx @param {number} dy */
    function shift(o, dx, dy) { for (const op of o) { op.p[0] += dx; op.p[1] += dy; if (op.k !== 3) for (let i = 2; i < op.p.length; i += 2) { op.p[i] += dx; op.p[i + 1] += dy; } } }

    /** A part that fits w by h, at x, y (its middle there when centred). @returns {Part} */
    function part(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ h, label = '', centred = true) {
      const make = MAKERS[rng.int(MAKERS.length)], k = 0.4 + rng.random() * 0.5;
      let d = Math.min(w, h) * 0.6, o = make(d, k), b = box(o);
      const sc = Math.min(1, w / (b[2] - b[0]), h / (b[3] - b[1]));
      if (sc < 1) { d *= sc * 0.97; o = make(d, k / sc); b = box(o); }
      if (label) { o.push(txt((b[0] + b[2]) / 2, b[3] + fs * 0.6, label)); b = box(o); }
      const bw = b[2] - b[0], bh = b[3] - b[1];
      shift(o, (centred ? x + (w - bw) / 2 : x) - b[0], (centred ? y + (h - bh) / 2 : y) - b[1]);
      const p = { x: (centred ? x + (w - bw) / 2 : x), y: (centred ? y + (h - bh) / 2 : y), w: bw, h: bh, ops: o, oi: 0, dd: 0, c: rng.int(nc), cv: /** @type {HTMLCanvasElement|null} */ (null), g: /** @type {CanvasRenderingContext2D|null} */ (null), fade: -1, cell: -1 };
      p.cv = document.createElement('canvas');
      p.g = p.cv.getContext('2d');
      size(p);
      return p;
    }
    /** Sizes a part's canvas at device pixels, cleared. @param {Part} p */
    function size(p) {
      if (!p.cv || !p.g) return;
      p.cv.width = Math.ceil((p.w + 6) * s.dpr); p.cv.height = Math.ceil((p.h + 6) * s.dpr);
      p.g.setTransform(s.dpr, 0, 0, s.dpr, (3 - p.x) * s.dpr, (3 - p.y) * s.dpr);
      p.g.lineJoin = 'round';
    }
    /** Redraws a part's canvas as far as it has got. @param {Part} p */
    function render(p) {
      if (!p.g) return;
      size(p);
      for (let i = 0; i < p.oi && i < p.ops.length; i++) put(p.g, p, p.ops[i], 0, Infinity, 1);
      if (p.oi < p.ops.length && p.dd > 0) put(p.g, p, p.ops[p.oi], 0, p.dd, 1);
    }

    /** Draws an op from d0 to d1 px along it. @param {CanvasRenderingContext2D} g @param {Part} p
     * @param {Op} op @param {number} d0 @param {number} d1 @param {number} alpha @param {boolean} [track] moves the pen */
    function put(g, p, op, d0, d1, alpha, track = false) {
      const st = ROLE[op.r], col = op.r === THIN || op.r === TEXT ? s.ink : s.colors[p.c];
      g.globalAlpha = st.a * alpha;
      if (op.k === 2) {
        g.fillStyle = col;
        g.font = FONT.replace('{}', String(Math.round(fs)));
        g.textAlign = 'center';
        if (op.a) { g.save(); g.translate(op.p[0], op.p[1]); g.rotate(op.a); g.fillText(op.t ?? '', 0, 0); g.restore(); }
        else g.fillText(op.t ?? '', op.p[0], op.p[1]);
        return;
      }
      if (op.k === 1) {
        g.fillStyle = col;
        g.beginPath(); g.moveTo(op.p[0], op.p[1]); g.lineTo(op.p[2], op.p[3]); g.lineTo(op.p[4], op.p[5]); g.fill();
        return;
      }
      if (op.k === 3) {
        // A wall: x, y, w, h, filled from its start along its longer side.
        const [x, y, w, h] = op.p, u = clamp(d1 / Math.max(w, h), 0, 1) - clamp(d0 / Math.max(w, h), 0, 1);
        const v0 = clamp(d0 / Math.max(w, h), 0, 1);
        g.fillStyle = col;
        if (w >= h) g.fillRect(x + w * v0, y, w * u, h); else g.fillRect(x, y + h * v0, w, h * u);
        return;
      }
      const { p: pt, L } = op;
      g.strokeStyle = col;
      g.lineWidth = st.w * lw;
      g.setLineDash(op.r === CTR ? [lw * 9, lw * 2.5, lw * 1.5, lw * 2.5] : op.r === HID ? [lw * 4, lw * 2.5] : []);
      g.lineDashOffset = d0;
      g.beginPath();
      let i = 1;
      while (i < L.length - 1 && L[i] < d0) i++;
      const at = (/** @type {number} */ d) => { const t = clamp((d - L[i - 1]) / ((L[i] - L[i - 1]) || 1), 0, 1); return [mix(pt[i * 2 - 2], pt[i * 2], t), mix(pt[i * 2 - 1], pt[i * 2 + 1], t)]; };
      const a = at(d0);
      g.moveTo(a[0], a[1]);
      while (i < L.length - 1 && L[i] < d1) { g.lineTo(pt[i * 2], pt[i * 2 + 1]); i++; }
      const b = at(Math.min(d1, L[L.length - 1]));
      g.lineTo(b[0], b[1]);
      g.stroke();
      if (op.r === CTR || op.r === HID) g.setLineDash([]);
      if (track) { pen.x = b[0]; pen.y = b[1]; }
    }
    /** An op's length for the pen. @param {Op} op @returns {number} */
    const span = (op) => (op.k === 3 ? Math.max(op.p[2], op.p[3]) : op.L[op.L.length - 1]);

    /** A clear spot for a box of w by h on the sheet, or null. @param {number} w @param {number} h */
    function room(w, h, /** @type {number[]} */ area) {
      for (let t = 0; t < 40; t++) {
        const x = mix(area[0], area[2] - w, rng.random()), y = mix(area[1], area[3] - h, rng.random());
        if (x < area[0] || y < area[1]) return null;
        if (parts.every((q) => q.fade >= 0 || x > q.x + q.w + gap || x + w + gap < q.x || y > q.y + q.h + gap || y + h + gap < q.y)) return { x, y };
      }
      return null;
    }

    /** The sheet's border and title block (layout 0). @returns {Part} */
    function sheet() {
      const mg = clamp(m * 0.03, 10, 24), o = /** @type {Op[]} */ ([]), x1 = s.W - mg, y1 = s.H - mg;
      o.push(poly(THIN, [mg * 0.6, mg * 0.6, s.W - mg * 0.6, mg * 0.6, s.W - mg * 0.6, s.H - mg * 0.6, mg * 0.6, s.H - mg * 0.6]));
      o.push(poly(OUT, [mg, mg, x1, mg, x1, y1, mg, y1]));
      const tw = clamp(s.W * 0.32, 150, 300), th = fs * 5.2, tx = x1 - tw, ty = y1 - th;
      o.push(path(OUT, [tx, y1, tx, ty, x1, ty]), ln(THIN, tx, ty + th / 2, x1, ty + th / 2), ln(THIN, tx + tw * 0.55, ty, tx + tw * 0.55, y1));
      o.push(txt(tx + tw * 0.275, ty + th * 0.36, 'DRAWN  WF'), txt(tx + tw * 0.775, ty + th * 0.36, 'SCALE 1:' + (1 + rng.int(4))),
        txt(tx + tw * 0.275, ty + th * 0.86, 'DWG ' + (100 + rng.int(900)) + '-' + 'ABCD'[rng.int(4)]), txt(tx + tw * 0.775, ty + th * 0.86, 'SHEET 1/1'));
      return { x: 0, y: 0, w: s.W, h: s.H, ops: o, oi: 0, dd: 0, c: 0, cv: null, g: null, fade: -1, cell: -1 };
    }

    /** A floor plan over the screen (layout 2): rooms split from one rectangle. @returns {Part} */
    function plan() {
      const mg = clamp(m * 0.1, 34, 100), X0 = mg, Y0 = mg, X1 = s.W - mg * 0.5, Y1 = s.H - mg * 0.5;
      const te = clamp(m * 0.012, 4, 9), ti = te * 0.55, min = clamp(m * 0.2, 80, 260), k = 1000 / clamp(m * 0.11, 40, 120);
      /** @type {number[][]} */
      const rooms = [], splits = /** @type {number[][]} */ ([]);
      // Split the biggest room across its length until there are enough, or none will go.
      const most = clamp(Math.round((X1 - X0) * (Y1 - Y0) / (min * min * 1.5)), 4, 12);
      rooms.push([X0, Y0, X1, Y1]);
      while (rooms.length < most) {
        const can = rooms.filter((q) => Math.max(q[2] - q[0], q[3] - q[1]) >= min * 2);
        if (!can.length) break;
        const r = can.reduce((p, q) => ((q[2] - q[0]) * (q[3] - q[1]) > (p[2] - p[0]) * (p[3] - p[1]) ? q : p));
        const v = r[2] - r[0] >= r[3] - r[1];
        const at = Math.round(mix(r[v ? 0 : 1] + min, r[v ? 2 : 3] - min, rng.random()));
        splits.push(v ? [at, r[1], at, r[3]] : [r[0], at, r[2], at]);
        rooms.splice(rooms.indexOf(r), 1, v ? [r[0], r[1], at, r[3]] : [r[0], r[1], r[2], at], v ? [at, r[1], r[2], r[3]] : [r[0], at, r[2], r[3]]);
      }
      const o = /** @type {Op[]} */ ([]), dw = clamp(m * 0.06, 22, 46);
      /** A wall from a to b along x (h false) or y, with openings [from, to] along it. */
      const wall = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ at, /** @type {boolean} */ hz, /** @type {number} */ t, /** @type {number[][]} */ gaps) => {
        let from = a - t / 2;
        for (const [g0, g1] of [...gaps.sort((p, q) => p[0] - q[0]), [b + t / 2, b + t / 2]]) {
          if (g0 > from) o.push({ k: 3, r: WALL, p: hz ? [from, at - t / 2, g0 - from, t] : [at - t / 2, from, t, g0 - from], L: [0, 0] });
          from = g1;
        }
      };
      // Outer walls with a window in most rooms' outside walls.
      /** @type {Op[]} */
      const glass = [];
      for (const [hz, at, a, b] of /** @type {[boolean, number, number, number][]} */ ([[true, Y0, X0, X1], [false, X1, Y0, Y1], [true, Y1, X0, X1], [false, X0, Y0, Y1]])) {
        const gaps = [];
        for (const r of rooms) {
          const on = hz ? Math.abs(r[at === Y0 ? 1 : 3] - at) < 1 : Math.abs(r[at === X0 ? 0 : 2] - at) < 1;
          if (!on || rng.random() < 0.25) continue;
          const lo = hz ? r[0] : r[1], hi = hz ? r[2] : r[3], ww = (hi - lo) * 0.4, c = (lo + hi) / 2;
          gaps.push([c - ww / 2, c + ww / 2]);
          for (const off of [-te * 0.5, 0, te * 0.5]) glass.push(hz ? ln(THIN, c - ww / 2, at + off, c + ww / 2, at + off) : ln(THIN, at + off, c - ww / 2, at + off, c + ww / 2));
        }
        wall(a, b, at, hz, te, gaps);
      }
      // Inner walls, each with a door, its leaf and swing.
      /** @type {Op[]} */
      const doors = [];
      for (const [x0, y0, x1, y1] of splits) {
        const hz = y0 === y1, a = hz ? x0 : y0, b = hz ? x1 : y1, at = hz ? y0 : x0;
        const d0 = mix(a + ti + 4, b - dw - ti - 4, rng.random() < 0.5 ? 0.08 : 0.85), sg = rng.random() < 0.5 ? -1 : 1;
        wall(a, b, at, hz, ti, [[d0, d0 + dw]]);
        if (hz) doors.push(ln(THIN, d0, at, d0, at + sg * dw), circ(THIN, d0, at, dw, sg > 0 ? Math.PI / 2 : -Math.PI / 2, 0));
        else doors.push(ln(THIN, at, d0, at + sg * dw, d0), circ(THIN, at, d0, dw, sg > 0 ? 0 : Math.PI, Math.PI / 2));
      }
      o.push(...glass, ...doors);
      // Dimension chains along the top and down the left, through every wall that meets them.
      const xs = [...new Set([X0, X1, ...splits.filter((q) => q[0] === q[2] && q[1] === Y0).map((q) => q[0])])].sort((p, q) => p - q);
      const ys = [...new Set([Y0, Y1, ...splits.filter((q) => q[1] === q[3] && q[0] === X0).map((q) => q[1])])].sort((p, q) => p - q);
      const yd = Y0 - mg * 0.45, xd = X0 - mg * 0.45, tk = as * 0.6;
      o.push(ln(THIN, X0 - tk, yd, X1 + tk, yd));
      for (let i = 0; i < xs.length; i++) {
        o.push(ln(THIN, xs[i], Y0 - te, xs[i], yd - tk), ln(THIN, xs[i] - tk * 0.7, yd + tk * 0.7, xs[i] + tk * 0.7, yd - tk * 0.7));
        if (i) o.push(txt((xs[i - 1] + xs[i]) / 2, yd - 4, num((xs[i] - xs[i - 1]) * k)));
      }
      o.push(ln(THIN, xd, Y0 - tk, xd, Y1 + tk));
      for (let i = 0; i < ys.length; i++) {
        o.push(ln(THIN, X0 - te, ys[i], xd - tk, ys[i]), ln(THIN, xd - tk * 0.7, ys[i] + tk * 0.7, xd + tk * 0.7, ys[i] - tk * 0.7));
        if (i) o.push(txt(xd - 4, (ys[i - 1] + ys[i]) / 2, num((ys[i] - ys[i - 1]) * k), -Math.PI / 2));
      }
      const names = rng.shuffle(ROOMS.slice());
      rooms.forEach((r, i) => {
        const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2, a = (r[2] - r[0]) * (r[3] - r[1]) * k * k / 1e6;
        o.push(txt(cx, cy, names[i % names.length]), txt(cx, cy + fs * 1.4, a.toFixed(1) + ' m²'));
      });
      return { x: 0, y: 0, w: s.W, h: s.H, ops: o, oi: 0, dd: 0, c: rng.int(nc), cv: null, g: null, fade: -1, cell: -1 };
    }

    /** What to draft next, or null to wait a while. @returns {Part|null} */
    function next() {
      if (layout === 2) {
        if (vec && vec.fade < 0) { vec.fade = s.t + 6; wait = s.t + 8.4; return null; }
        vec = plan();
        return vec;
      }
      if (layout === 0) {
        if (!vec) { vec = sheet(); return vec; }
        const mg = clamp(m * 0.03, 10, 24) + gap * 0.5, d = clamp(m * 0.34, 110, 260);
        const area = [mg, mg, s.W - mg, s.H - mg - fs * 5.2 - gap * 0.4];
        const live = parts.filter((q) => q.fade < 0);
        if (live.length < 7) {
          for (let t = 0; t < 4; t++) {
            const w = d * (0.85 + rng.random() * 0.5), h = d * (0.7 + rng.random() * 0.3), at = room(w, h, area);
            if (at) { const p = part(at.x, at.y, w, h); parts.push(p); return p; }
          }
        }
        // Full: hold, then a fresh sheet.
        if (live.length) { for (const q of live) q.fade = s.t + 5; wait = s.t + 7.5; } else wait = s.t + 1;
        return null;
      }
      // Catalogue: an empty cell first, else the oldest is redrawn.
      const live = parts.filter((q) => q.fade < 0);
      if (live.length < cells.length) {
        const free = cells.map((_, i) => i).filter((i) => !live.some((q) => q.cell === i));
        const ci = free[rng.int(free.length)], c = cells[ci];
        const p = part(c.x + gap * 0.5, c.y + gap * 0.5, c.w - gap, c.h - gap - fs * 2, 'No. ' + String(++count).padStart(3, '0'));
        p.cell = ci;
        parts.push(p);
        return p;
      }
      live[0].fade = s.t; wait = s.t + 1.8;
      return null;
    }

    /** Lays everything out afresh and drafts some of it, so a still frame shows the idea. */
    function build() {
      parts = []; vec = null; cur = null; wait = 0; count = rng.int(200);
      m = Math.min(s.W, s.H);
      lw = clamp(m * 0.0016, 0.9, 1.5);
      fs = clamp(m * 0.016, 9, 13);
      as = clamp(m * 0.012, 5, 9);
      pv = clamp(m * 0.5, 170, 400);
      gap = clamp(m * 0.05, 18, 44);
      // The grid: fine lines and every fifth one stronger.
      const gs = clamp(m * 0.03, 14, 28);
      minor = new Path2D(); major = new Path2D();
      for (let i = 0, x = (s.W % gs) / 2; x < s.W; x += gs, i++) { const q = i % 5 ? minor : major; q.moveTo(Math.round(x) + 0.5, 0); q.lineTo(Math.round(x) + 0.5, s.H); }
      for (let i = 0, y = (s.H % gs) / 2; y < s.H; y += gs, i++) { const q = i % 5 ? minor : major; q.moveTo(0, Math.round(y) + 0.5); q.lineTo(s.W, Math.round(y) + 0.5); }
      cells = [];
      if (layout === 1) {
        const cols = clamp(Math.round(s.W / 300), 1, 7), rows = clamp(Math.round(s.H / 250), 2, 5);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: c * s.W / cols, y: r * s.H / rows, w: s.W / cols, h: s.H / rows });
      }
      // Warm up: whole parts done, then one part-way.
      const warm = layout === 0 ? 3 + rng.int(4) : layout === 1 ? Math.round(cells.length * (0.6 + rng.random() * 0.3)) : 0;
      for (let n = 0; n <= warm; n++) {
        const p = next();
        if (!p) break;
        if (n < warm) { p.oi = p.ops.length; render(p); continue; }
        p.oi = Math.floor(p.ops.length * (layout === 2 ? 0.6 + rng.random() * 0.35 : 0.3 + rng.random() * 0.4));
        render(p);
        cur = p;
      }
    }

    s.onDpr = () => { for (const p of parts) render(p); };

    return {
      lay() {
        if (s.W === lastW && s.H === lastH) return;
        lastW = s.W; lastH = s.H;
        build();
      },
      step(dt) {
        if (!cur && s.t >= wait) { cur = next(); if (cur && cur === vec && layout === 0) wait = 0; }
        pen.on = !!cur;
        if (cur) {
          let left = dt;
          // Arrows and figures take a moment; a line takes its length at the pen's speed.
          while (cur && left > 0) {
            const p = cur, op = p.ops[p.oi], len = span(op), sp = pv * ROLE[op.r].v, d0 = p.dd;
            if (op.k === 1 || op.k === 2 || len <= 0) { p.dd = len; left -= 0.03; }
            else { p.dd = Math.min(len, d0 + sp * left); left = p.dd < len ? 0 : left - (p.dd - d0) / sp; }
            if (p.g) put(p.g, p, op, d0, p.dd, 1, true);
            if (p.dd >= len) {
              p.oi++; p.dd = 0;
              if (p.oi >= p.ops.length) { cur = null; wait = Math.max(wait, s.t + 0.6); }
            }
          }
        }
        if (vec && vec.fade >= 0 && s.t - vec.fade > 2.2) vec = null;
        parts = parts.filter((p) => p.fade < 0 || s.t - p.fade < 2);
      },
      draw() {
        const { ctx } = s, k = 1 / s.dpr;
        ctx.strokeStyle = s.colors[0];
        ctx.lineWidth = 1;
        if (minor && major) {
          ctx.globalAlpha = s.dark ? 0.07 : 0.08; ctx.stroke(minor);
          ctx.globalAlpha = s.dark ? 0.13 : 0.15; ctx.stroke(major);
        }
        for (const p of parts) {
          if (!p.cv) continue;
          ctx.globalAlpha = LINE * (p.fade < 0 || s.t < p.fade ? 1 : clamp(1 - (s.t - p.fade) / 2, 0, 1));
          ctx.drawImage(p.cv, Math.round((p.x - 3) * s.dpr) * k, Math.round((p.y - 3) * s.dpr) * k, p.cv.width * k, p.cv.height * k);
        }
        if (vec) {
          // Lines drawn so far, then the one under way.
          const a = LINE * (vec.fade < 0 || s.t < vec.fade ? 1 : clamp(1 - (s.t - vec.fade) / 2, 0, 1));
          ctx.lineJoin = 'round';
          const n = vec === cur ? vec.oi : vec.ops.length;
          for (let i = 0; i < n; i++) put(ctx, vec, vec.ops[i], 0, Infinity, a);
          if (vec === cur && vec.oi < vec.ops.length) put(ctx, vec, vec.ops[vec.oi], 0, vec.dd, a, true);
        }
        if (pen.on && cur) {
          // The pen: a small crosshair where it draws.
          const r = as * 0.9;
          ctx.globalAlpha = s.dark ? 0.55 : 0.6;
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pen.x - r * 1.8, pen.y); ctx.lineTo(pen.x - r * 0.5, pen.y); ctx.moveTo(pen.x + r * 0.5, pen.y); ctx.lineTo(pen.x + r * 1.8, pen.y);
          ctx.moveTo(pen.x, pen.y - r * 1.8); ctx.lineTo(pen.x, pen.y - r * 0.5); ctx.moveTo(pen.x, pen.y + r * 0.5); ctx.lineTo(pen.x, pen.y + r * 1.8);
          ctx.stroke();
        }
      },
    };
  });
}
