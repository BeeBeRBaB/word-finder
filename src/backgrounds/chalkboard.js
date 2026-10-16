// Chalkboard: sums, graphs and diagrams are written in chalk stroke by stroke, a chalk stick
// at the tip, then wiped away. The seed picks the variant: a board of mixed working laid out in
// a grid, written in reading order, held, then wiped clean by a damp cloth swept across it;
// columns of worked algebra, line by line, the oldest column rubbed out with a felt eraser and
// written again; or larger diagrams scattered about, the oldest erased as each new one goes up.

import { stage, clamp, mix } from './stage.js';
import { roundRect } from './shapes.js';

// A hand-drawn stroke font, 6 wide and 10 tall (y down); s: rounded strokes that are smoothed.
/** @type {Record<string, {k:number[][], s?:boolean}>} */
const FONT = {
  0: { k: [ring(3, 5, 2.8, 5)], s: true },
  1: { k: [[1, 2.2, 3.2, 0, 3.2, 10]] },
  2: { k: [[0.4, 2.4, 1.4, 0.6, 3.2, 0, 5, 0.8, 5.6, 2.6, 4.8, 4.8, 0.2, 10, 6, 10]], s: true },
  3: { k: [[0.4, 1.2, 2.2, 0, 4.4, 0.3, 5.4, 2.2, 4.4, 4.2, 2.4, 4.8, 4.6, 5.4, 5.8, 7.4, 4.9, 9.4, 2.8, 10, 0.4, 9]], s: true },
  4: { k: [[4.6, 10, 4.6, 0, 0, 7, 6, 7]] },
  5: { k: [[5.6, 0, 1.2, 0, 0.7, 4.4, 2.8, 3.8, 4.9, 4.4, 5.8, 6.8, 5, 9.2, 2.8, 10, 0.3, 9]], s: true },
  6: { k: [[5, 0.5, 3.2, 0, 1.2, 1.2, 0.2, 4.4, 0.3, 7.8, 1.8, 9.8, 4.2, 9.8, 5.7, 8, 5.5, 5.8, 3.8, 4.7, 1.7, 5, 0.3, 6.8]], s: true },
  7: { k: [[0, 0, 6, 0, 2.2, 10]] },
  8: { k: [[3, 4.7, 4.9, 3.6, 5.3, 1.6, 4, 0.1, 2, 0.1, 0.7, 1.6, 1.1, 3.6, 3, 4.7, 5.2, 5.9, 5.8, 8, 4.4, 9.9, 1.6, 9.9, 0.2, 8, 0.8, 5.9, 3, 4.7]], s: true },
  9: { k: [[5.6, 3, 4.2, 4.9, 1.9, 5, 0.3, 3.2, 0.8, 0.8, 3, 0, 5, 0.8, 5.8, 3, 5.5, 7, 3.8, 9.8, 1, 9.4]], s: true },
  '+': { k: [[3, 2.5, 3, 8.5], [0, 5.5, 6, 5.5]] },
  '-': { k: [[0.5, 5.5, 5.5, 5.5]] },
  '=': { k: [[0.4, 4, 5.6, 4], [0.4, 7, 5.6, 7]] },
  '*': { k: [[1, 3, 5, 8], [5, 3, 1, 8]] },
  '/': { k: [[0.4, 5.5, 5.6, 5.5], [2.9, 2.4, 3.1, 3], [2.9, 8, 3.1, 8.6]] },
  x: { k: [[0.8, 4.5, 5.2, 10], [5.2, 4.5, 0.8, 10]] },
};

/** An ellipse as a stroke, from the top round and a little past. @param {number} cx @param {number} cy
 * @param {number} rx @param {number} ry @returns {number[]} */
function ring(cx, cy, rx, ry) {
  const out = [];
  for (let i = 0; i <= 26; i++) {
    const a = -Math.PI / 2 - (i / 24) * Math.PI * 2;
    out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return out;
}

/** Catmull-Rom through the points, three steps a span. @param {number[]} k @returns {number[]} */
function smooth(k) {
  const n = k.length / 2, out = [k[0], k[1]];
  const at = (/** @type {number} */ i) => Math.max(0, Math.min(n - 1, i)) * 2;
  for (let i = 0; i < n - 1; i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
    for (let j = 1; j <= 3; j++) {
      const t = j / 3, t2 = t * t, t3 = t2 * t;
      for (let e = 0; e < 2; e++) {
        out.push(0.5 * (2 * k[b + e] + (k[c + e] - k[a + e]) * t + (2 * k[a + e] - 5 * k[b + e] + 4 * k[c + e] - k[d + e]) * t2
          + (3 * k[b + e] - k[a + e] - 3 * k[c + e] + k[d + e]) * t3));
      }
    }
  }
  return out;
}

/** @typedef {{p:number[], L:number[]}} Stroke points x,y,... in the figure's px, and the length to each */
/** @typedef {{x:number, y:number, w:number, h:number, ks:Stroke[], si:number, dd:number, c:number,
 *   cv:HTMLCanvasElement, g:CanvasRenderingContext2D, fade:number, col:number}} Fig
 * x, y, w, h its box on screen; ks its strokes, written up to stroke si, dd px along it; c its
 * colour; cv its own small canvas holding the chalk so far; fade when it began to fade (-1 not);
 * col the column it belongs to (algebra). */
/** @typedef {{kind:'write', f:Fig} | {kind:'wait', until:number} | {kind:'erase', p:number[], L:number[],
 *   d:number, figs:Fig[]} | {kind:'sweep', x:number, figs:Fig[]}} Task */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const CHALK = s.dark ? 0.62 : 0.6, nc = s.colors.length;
    const grain = s.colors.map(dust);
    /** @type {Fig[]} */
    let figs = [];
    /** @type {HTMLCanvasElement[]} */
    const pool = [];
    /** @type {Task|null} */
    let task = null;
    let gh = 20, cw = 2.5, v = 200, ve = 300, eh = 30, bw = 90, pad = 4, slot = 0, col = 0;
    let lw = 0, lh = 0;
    // The pen: where the chalk is, and the lift between strokes.
    const pen = { x: -99, y: -99, lift: 0 };
    let wipeX = -1;
    /** Column boxes for the algebra, and grid slots for the board. @type {{x:number, y:number, w:number, h:number}[]} */
    let boxes = [];
    /** The order the board's slots are written in, anywhere there is room. @type {number[]} */
    let order = [];

    /** Turns flat font coordinates into a stroke at x, y, size gh. @param {number[]} k
     * @param {number} x @param {number} y @param {number} sz glyph height @returns {Stroke} */
    function stroke(k, x, y, sz) {
      const j = sz * 0.025, p = [];
      for (let i = 0; i < k.length; i += 2) p.push(x + k[i] * sz / 10 + (rng.random() - 0.5) * j, y + k[i + 1] * sz / 10 + (rng.random() - 0.5) * j);
      return measure(p);
    }
    /** @param {number[]} p @returns {Stroke} */
    function measure(p) {
      const L = [0];
      for (let i = 2; i < p.length; i += 2) L.push(L[L.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
      return { p, L };
    }
    /** A line from a to b, a little wobbly. @returns {Stroke} */
    function line(/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) {
      const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 30)), p = [], j = gh * 0.03;
      for (let i = 0; i <= n; i++) {
        const t = i / n, w = i && i < n ? (rng.random() - 0.5) * j : 0;
        p.push(mix(x0, x1, t) + w, mix(y0, y1, t) + w);
      }
      return measure(p);
    }
    /** Text in the stroke font. @param {Stroke[]} out @param {string} str @param {number} x
     * @param {number} y @param {number} sz @returns {number} the x after it */
    function text(out, str, x, y, sz) {
      for (const ch of str) {
        const f = FONT[ch];
        if (f) for (const k of f.k) out.push(stroke(f.s ? smooth(k) : k, x, y + (rng.random() - 0.5) * sz * 0.06, sz));
        x += sz * (ch === '1' ? 0.72 : 0.85);
      }
      return x;
    }

    /** Column addition, subtraction or multiplication, worked out right. @returns {[Stroke[], number, number]} */
    function column() {
      const op = rng.int(3);
      let a = 10 + rng.int(890), b = 10 + rng.int(op === 2 ? 8 : 890);
      if (op === 1 && b > a) [a, b] = [b, a];
      if (op === 2) a = 10 + rng.int(90);
      const r = op === 0 ? a + b : op === 1 ? a - b : a * b, ks = /** @type {Stroke[]} */ ([]);
      const n = Math.max(String(a).length, String(b).length, String(r).length) + 1, adv = gh * 0.85;
      const right = n * adv, row = gh * 1.45;
      text(ks, String(a), right - String(a).length * adv, 0, gh);
      text(ks, '+-*'[op], 0, row, gh);
      text(ks, String(b), right - String(b).length * adv, row, gh);
      ks.push(line(-gh * 0.1, row * 2 - gh * 0.25, right, row * 2 - gh * 0.2));
      text(ks, String(r), right - String(r).length * adv, row * 2 + gh * 0.05, gh);
      return [ks, right + gh * 0.2, row * 2 + gh * 1.1];
    }
    /** One sum on a line: a op b = c. @returns {[Stroke[], number, number]} */
    function sum() {
      const op = rng.int(4), ks = /** @type {Stroke[]} */ ([]);
      let a = 2 + rng.int(18), b = 2 + rng.int(op === 2 ? 8 : 18);
      if (op === 1 && b > a) [a, b] = [b, a];
      if (op === 3) a *= b;
      const r = [a + b, a - b, a * b, a / b][op];
      const w = text(ks, `${a}${'+-*/'[op]}${b}=${r}`, 0, 0, gh);
      return [ks, w, gh * 1.1];
    }
    /** Axes with ticks, then a curve, a line through points or bars. @param {number} sc @returns {[Stroke[], number, number]} */
    function graph(sc) {
      const w = gh * 7 * sc, h = gh * 5 * sc, ox = gh * 0.4, oy = h - gh * 0.5, ks = /** @type {Stroke[]} */ ([]);
      const a = gh * 0.3;
      ks.push(measure([ox - a, a * 1.4, ox, 0, ox + a, a * 1.4]), line(ox, 0, ox, h));
      ks.push(line(0, oy, w, oy), measure([w - a * 1.4, oy - a, w, oy, w - a * 1.4, oy + a]));
      const kind = rng.int(4), n = 5;
      for (let i = 1; i <= n; i++) { const x = ox + (w - ox - a * 2) * i / n; ks.push(line(x, oy - a * 0.5, x, oy + a * 0.5)); }
      const X = (/** @type {number} */ t) => ox + t * (w - ox - a * 3), Y = (/** @type {number} */ t) => oy - t * (oy - a * 2);
      if (kind === 0 || kind === 1) {
        const p = [], ph = rng.random() * 6;
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          p.push(X(t), Y(kind === 0 ? 0.5 + 0.42 * Math.sin(t * 9 + ph) : 1 - 3.6 * (t - 0.5) ** 2 - 0.05));
        }
        ks.push(measure(p));
      } else if (kind === 2) {
        const m = 0.15 + rng.random() * 0.7;
        for (let i = 0; i < 6; i++) {
          const t = 0.1 + i * 0.16, y = Y(clamp(m * t + 0.12 + (rng.random() - 0.5) * 0.18, 0.05, 1)), x = X(t);
          ks.push(measure(ring(x, y, a * 0.35, a * 0.35)));
        }
        ks.push(line(X(0.02), Y(m * 0.02 + 0.12), X(1), Y(m + 0.12)));
      } else {
        for (let i = 0; i < 5; i++) {
          const x0 = X(0.06 + i * 0.19), x1 = X(0.19 + i * 0.19), y = Y(0.2 + rng.random() * 0.75);
          ks.push(measure([x0, oy, x0, y, x1, y, x1, oy]));
        }
      }
      return [ks, w, h];
    }
    /** A right triangle with its square corner and an angle; or a circle with its radius; or a
     * box in perspective. @param {number} sc @returns {[Stroke[], number, number]} */
    function shape(sc) {
      const kind = rng.int(3), d = gh * 4.4 * sc, ks = /** @type {Stroke[]} */ ([]);
      if (kind === 0) {
        const w = d * (1.1 + rng.random() * 0.4), q = gh * 0.5;
        ks.push(line(0, d, w, d), line(w, d, w, 0), line(w, 0, 0, d));
        ks.push(measure([w - q, d, w - q, d - q, w, d - q]));
        const p = [], r = gh * 1.1, t = Math.atan2(d, w);
        for (let i = 0; i <= 10; i++) { const u = -t * i / 10; p.push(Math.cos(u) * r, d + Math.sin(u) * r); }
        ks.push(measure(p));
        return [ks, w, d];
      }
      if (kind === 1) {
        const r = d / 2, a = rng.random() * 6;
        ks.push(measure(smooth(ring(r, r, r, r))), line(r, r, r + Math.cos(a) * r, r + Math.sin(a) * r));
        ks.push(measure(ring(r, r, gh * 0.08, gh * 0.08)));
        return [ks, d, d];
      }
      const e = d * 0.72, o = e * 0.4;
      ks.push(measure([0, o, e, o, e, o + e, 0, o + e, 0, o]), measure([0, o, o, 0, o + e, 0, e, o]), line(o + e, 0, o + e, e), line(o + e, e, e, o + e));
      return [ks, o + e, o + e];
    }
    /** A number line with hops along it. @returns {[Stroke[], number, number]} */
    function numberLine() {
      const n = 6, step = gh * 1.3, w = step * n, y = gh * 1.6, ks = /** @type {Stroke[]} */ ([]);
      ks.push(line(0, y, w, y));
      for (let i = 0; i < n; i++) {
        const x = step * (i + 0.5);
        ks.push(line(x, y - gh * 0.2, x, y + gh * 0.2));
        text(ks, String(i), x - gh * 0.24, y + gh * 0.45, gh * 0.75);
      }
      for (let i = rng.int(2), hop = 1 + rng.int(2); i + hop < n; i += hop) {
        const p = [], x0 = step * (i + 0.5), x1 = step * (i + hop + 0.5);
        for (let k = 0; k <= 12; k++) { const t = k / 12; p.push(mix(x0, x1, t), y - gh * 0.3 - Math.sin(t * Math.PI) * gh * 0.8 * hop); }
        ks.push(measure(p));
      }
      return [ks, w, y + gh * 1.4];
    }
    /** A pie cut in equal slices, some shaded, and its fraction. @param {number} sc @returns {[Stroke[], number, number]} */
    function pie(sc) {
      const n = 3 + rng.int(4), k = 1 + rng.int(n - 1), r = gh * 2 * sc, ks = /** @type {Stroke[]} */ ([]);
      ks.push(measure(smooth(ring(r, r, r, r))));
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / n; ks.push(line(r, r, r + Math.cos(a) * r, r + Math.sin(a) * r)); }
      // Shading: short strokes across the first k slices.
      for (let i = 0; i < k; i++) {
        for (let j = 1; j <= 3; j++) {
          const a0 = -Math.PI / 2 + (i + 0.2) * Math.PI * 2 / n, a1 = -Math.PI / 2 + (i + 0.8) * Math.PI * 2 / n, rr = r * j / 4;
          ks.push(line(r + Math.cos(a0) * rr, r + Math.sin(a0) * rr, r + Math.cos(a1) * rr, r + Math.sin(a1) * rr));
        }
      }
      const fx = r * 2 + gh * 0.8;
      text(ks, String(k), fx, r - gh * 1.15, gh);
      ks.push(line(fx - gh * 0.15, r, fx + gh * 0.75, r));
      text(ks, String(n), fx, r + gh * 0.2, gh);
      return [ks, fx + gh, r * 2];
    }

    /** A figure from its strokes, with a canvas of its own. @param {[Stroke[], number, number]} made
     * @param {number} x @param {number} y @returns {Fig} */
    function fig([ks, w, h], x, y) {
      const cv = pool.pop() ?? document.createElement('canvas');
      const f = { x, y, w, h, ks, si: 0, dd: 0, c: rng.int(nc), cv, g: /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')), fade: -1, col };
      for (const k of ks) for (let i = 0; i < k.p.length; i += 2) { k.p[i] += x; k.p[i + 1] += y; }
      size(f);
      return f;
    }
    /** Sizes a figure's canvas at device pixels, cleared, with chalk set. @param {Fig} f */
    function size(f) {
      f.cv.width = Math.ceil((f.w + pad * 2) * s.dpr); f.cv.height = Math.ceil((f.h + pad * 2) * s.dpr);
      const { g } = f;
      g.setTransform(s.dpr, 0, 0, s.dpr, (pad - f.x) * s.dpr, (pad - f.y) * s.dpr);
      g.lineCap = g.lineJoin = 'round';
      g.lineWidth = cw;
      g.strokeStyle = g.createPattern(grain[f.c], 'repeat') ?? s.colors[f.c];
    }
    /** Redraws a figure's canvas to how far it is written. @param {Fig} f */
    function render(f) {
      size(f);
      for (let i = 0; i < f.si && i < f.ks.length; i++) draw(f, f.ks[i], 0, Infinity);
      if (f.si < f.ks.length && f.dd > 0) draw(f, f.ks[f.si], 0, f.dd);
    }
    /** Chalks a stroke from d0 to d1 px along it onto its figure. @param {Fig} f @param {Stroke} k
     * @param {number} d0 @param {number} d1 */
    function draw(f, k, d0, d1) {
      const { g } = f, { p, L } = k;
      g.beginPath();
      let i = 1;
      while (i < L.length - 1 && L[i] < d0) i++;
      const at = (/** @type {number} */ d) => {
        const t = clamp((d - L[i - 1]) / ((L[i] - L[i - 1]) || 1), 0, 1);
        return [mix(p[i * 2 - 2], p[i * 2], t), mix(p[i * 2 - 1], p[i * 2 + 1], t)];
      };
      const a = at(d0);
      g.moveTo(a[0], a[1]);
      while (i < L.length - 1 && L[i] < d1) { g.lineTo(p[i * 2], p[i * 2 + 1]); i++; }
      const b = at(Math.min(d1, L[L.length - 1]));
      g.lineTo(b[0], b[1]);
      g.stroke();
    }
    /** @param {Fig} f */
    function free(f) { f.cv.width = f.cv.height = 1; pool.push(f.cv); }

    /** A place for a figure of w by h that overlaps no other (layout 2), or null. @param {number} w @param {number} h */
    function room(w, h) {
      for (let k = 0; k < 30; k++) {
        const x = gh + rng.random() * (s.W - w - gh * 2), y = gh + rng.random() * (s.H - h - gh * 2);
        if (figs.every((f) => x > f.x + f.w + gh * 1.5 || x + w + gh * 1.5 < f.x || y > f.y + f.h + gh * 1.5 || y + h + gh * 1.5 < f.y)) return { x, y };
      }
      return null;
    }

    /** A figure made to fit a box, placed in it. @param {{x:number, y:number, w:number, h:number}} b @returns {Fig} */
    function boardFig(b) {
      const kinds = [column, sum, () => graph(1), () => shape(0.9), numberLine, () => pie(0.9)];
      for (let tries = 0; ; tries++) {
        const made = kinds[rng.int(kinds.length)]();
        if (made[1] <= b.w - gh && made[2] <= b.h - gh || tries > 8) {
          const sc = Math.min(1, (b.w - gh) / made[1], (b.h - gh) / made[2]);
          if (sc < 1) for (const k of made[0]) { for (let i = 0; i < k.p.length; i++) k.p[i] *= sc; for (let i = 0; i < k.L.length; i++) k.L[i] *= sc; }
          const w = made[1] * sc, h = made[2] * sc;
          return fig([made[0], w, h], b.x + (b.w - w) * (0.2 + rng.random() * 0.6), b.y + (b.h - h) * (0.2 + rng.random() * 0.6));
        }
      }
    }

    /** The algebra for a column, from the top: solve a·x + b = c, line by line. @param {number} c @returns {Fig[]} */
    function algebra(c) {
      const b = boxes[c], out = /** @type {Fig[]} */ ([]), row = gh * 1.6;
      col = c;
      for (let y = b.y; y + row * 3 <= b.y + b.h;) {
        const x = 2 + rng.int(8), a = 2 + rng.int(8), k = 1 + rng.int(20), r = a * x + k;
        for (const str of [`${a}x+${k}=${r}`, `${a}x=${r - k}`, `x=${x}`]) {
          const ks = /** @type {Stroke[]} */ ([]);
          const w = text(ks, str, 0, 0, gh);
          if (str[0] === 'x') ks.push(line(-gh * 0.15, gh * 1.25, w, gh * 1.22), line(-gh * 0.15, gh * 1.45, w, gh * 1.42));
          out.push(fig([ks, w, gh * 1.5], b.x + gh * 0.3, y));
          y += row;
        }
        y += row * 0.5;
      }
      return out;
    }

    /** The felt eraser's zigzag over a box. @param {number} x @param {number} y @param {number} w @param {number} h @returns {Task} */
    function rub(x, y, w, h, /** @type {Fig[]} */ which) {
      const p = [];
      for (let yy = y + eh * 0.4, k = 0; yy < y + h + eh * 0.3; yy += eh * 0.7, k++) {
        p.push(k % 2 ? x + w : x, yy, k % 2 ? x : x + w, yy + eh * 0.25);
      }
      const { L } = measure(p);
      return { kind: 'erase', p, L, d: 0, figs: which };
    }

    /** The next task, for the variant. @returns {Task} */
    function next() {
      const busy = figs.filter((f) => f.fade < 0);
      if (layout === 0) {
        if (task?.kind === 'sweep') return { kind: 'wait', until: s.t + 1.5 };
        if (busy.length < boxes.length) { const f = boardFig(boxes[order[slot++ % boxes.length]]); figs.push(f); return { kind: 'write', f }; }
        if (task?.kind === 'wait') { slot = 0; rng.shuffle(order); return { kind: 'sweep', x: -bw, figs: busy }; }
        return { kind: 'wait', until: s.t + 4 };
      }
      if (layout === 1) {
        const pending = figs.find((f) => f.si === 0 && f.dd === 0 && f.fade < 0);
        if (pending) return { kind: 'write', f: pending };
        if (task?.kind === 'erase') { figs.push(...algebra(col)); return { kind: 'wait', until: s.t + 0.6 }; }
        if (task?.kind !== 'wait') return { kind: 'wait', until: s.t + 3 };
        // The oldest column goes next.
        col = (col + 1) % boxes.length;
        const b = boxes[col], mine = busy.filter((f) => f.col === col);
        return rub(b.x, b.y, b.w, b.h, mine);
      }
      const most = clamp(Math.round(s.W * s.H / 170000), 3, 9);
      if (busy.length >= most && task?.kind !== 'erase') {
        const f = busy[0];
        return rub(f.x - pad, f.y - pad, f.w + pad * 2, f.h + pad * 2, [f]);
      }
      const kinds = [() => graph(1.3), () => shape(1.3), () => pie(1.2), numberLine, column, () => graph(1)];
      for (let t = 0; t < 6; t++) {
        const made = kinds[rng.int(kinds.length)](), at = room(made[1], made[2]);
        if (at) { const f = fig(made, at.x, at.y); figs.push(f); return { kind: 'write', f }; }
      }
      return busy.length ? rub(busy[0].x - pad, busy[0].y - pad, busy[0].w + pad * 2, busy[0].h + pad * 2, [busy[0]]) : { kind: 'wait', until: s.t + 1 };
    }

    /** Advances whatever is under way by dt. @param {number} dt */
    function advance(dt) {
      if (!task) task = next();
      if (task.kind === 'wait') { if (s.t >= task.until) task = next(); return; }
      if (task.kind === 'write') {
        const f = task.f, k = f.ks[f.si];
        if (pen.lift > 0) {
          // Lifted between strokes: drift to the next stroke's start.
          const u = Math.min(1, dt / pen.lift);
          pen.x = mix(pen.x, k.p[0], u); pen.y = mix(pen.y, k.p[1], u); pen.lift -= dt;
          return;
        }
        const d0 = f.dd, end = k.L[k.L.length - 1];
        f.dd = Math.min(end, f.dd + v * dt);
        draw(f, k, d0, f.dd);
        const i = Math.max(1, k.L.findIndex((l) => l >= f.dd));
        const t = clamp((f.dd - k.L[i - 1]) / ((k.L[i] - k.L[i - 1]) || 1), 0, 1);
        pen.x = mix(k.p[i * 2 - 2], k.p[i * 2], t); pen.y = mix(k.p[i * 2 - 1], k.p[i * 2 + 1], t);
        if (f.dd >= end) {
          f.si++; f.dd = 0;
          if (f.si >= f.ks.length) { task = next(); pen.lift = task.kind === 'write' ? 0.5 : 0; }
          else pen.lift = 0.14;
        }
        return;
      }
      if (task.kind === 'erase') {
        const { p, L } = task, end = L[L.length - 1], d0 = task.d;
        task.d = Math.min(end, task.d + ve * dt);
        for (const f of task.figs) {
          const { g } = f;
          g.globalCompositeOperation = 'destination-out';
          g.globalAlpha = 0.6;
          g.lineWidth = eh * 0.8;
          g.strokeStyle = '#000';
          draw(f, task, d0, task.d);
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = 1;
          g.lineWidth = cw;
          g.strokeStyle = g.createPattern(grain[f.c], 'repeat') ?? s.colors[f.c];
        }
        if (task.d >= end) { for (const f of task.figs) f.fade = s.t; task = next(); }
        return;
      }
      // The damp cloth: wipes a strip at its leading edge, leaving a faint smear that dries.
      const x0 = task.x + bw / 2;
      task.x += ve * 0.7 * dt;
      const x1 = task.x + bw / 2;
      for (const f of task.figs) {
        if (x1 < f.x - pad || x0 > f.x + f.w + pad) continue;
        f.g.globalCompositeOperation = 'destination-out';
        f.g.globalAlpha = 0.85;
        f.g.fillRect(x0, f.y - pad, x1 - x0, f.h + pad * 2);
        f.g.globalCompositeOperation = 'source-over';
        f.g.globalAlpha = 1;
        if (f.fade < 0 && x1 > f.x + f.w + pad) f.fade = s.t;
      }
      wipeX = task.x;
      if (task.x > s.W + bw * 3) { wipeX = -1; task = next(); }
    }

    /** Lays the board out afresh and works it part of the way, so a still frame shows the idea. */
    function build() {
      for (const f of figs) free(f);
      figs = []; task = null; slot = 0; col = 0; wipeX = -1;
      const m = Math.min(s.W, s.H);
      gh = clamp(m * 0.04, 15, 30);
      cw = clamp(gh * 0.12, 1.8, 3.4);
      pad = cw * 2;
      v = clamp(m * 0.4, 150, 340);
      ve = clamp(m * 0.55, 220, 460);
      eh = clamp(gh * 2, 34, 60);
      bw = clamp(m * 0.1, 50, 120);
      boxes = [];
      if (layout === 0) {
        const cols = clamp(Math.round(s.W / 290), 2, 7), rows = clamp(Math.round(s.H / 210), 2, 4);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) boxes.push({ x: c * s.W / cols, y: r * s.H / rows, w: s.W / cols, h: s.H / rows });
        order = rng.shuffle(boxes.map((_, i) => i));
      } else if (layout === 1) {
        const cw2 = gh * 9.5, cols = clamp(Math.floor(s.W / cw2), 1, 8), gap = (s.W - cols * cw2) / (cols + 1);
        for (let c = 0; c < cols; c++) boxes.push({ x: gap + c * (cw2 + gap), y: gh, w: cw2, h: s.H - gh * 2 });
        for (let c = 0; c < cols; c++) figs.push(...algebra(c));
        // Warm up: every column full but one, which is part-way through being written again.
        col = rng.int(cols);
        const mine = figs.filter((f) => f.col === col), k = rng.int(mine.length);
        for (const f of figs) if (f.col !== col || mine.indexOf(f) < k) { f.si = f.ks.length; render(f); }
      }
      // Warm up: most of a board done, the next piece part-written.
      const warm = layout === 0 ? Math.max(1, Math.round(boxes.length * (0.5 + rng.random() * 0.4)))
        : layout === 1 ? 0 : clamp(Math.round(s.W * s.H / 170000), 3, 9) - 1;
      for (let n = 0; n < warm; n++) {
        const t = next();
        if (t.kind !== 'write') break;
        t.f.si = t.f.ks.length;
        render(t.f);
      }
      task = next();
      if (task.kind === 'write') {
        task.f.si = Math.floor(task.f.ks.length * (0.3 + rng.random() * 0.4));
        render(task.f);
        const k = task.f.ks[task.f.si];
        pen.x = k.p[0]; pen.y = k.p[1];
      }
    }

    s.onDpr = () => { for (const f of figs) render(f); };

    return {
      lay() {
        if (s.W === lw && s.H === lh) return;
        lw = s.W; lh = s.H;
        build();
      },
      step(dt) {
        advance(dt);
        figs = figs.filter((f) => {
          if (f.fade < 0 || s.t - f.fade < 1.6) return true;
          free(f);
          return false;
        });
      },
      draw() {
        const { ctx } = s, k = 1 / s.dpr;
        for (const f of figs) {
          ctx.globalAlpha = CHALK * (f.fade < 0 ? 1 : clamp(1 - (s.t - f.fade) / 1.6, 0, 1));
          // Whole device pixels, so the chalk copies 1:1.
          ctx.drawImage(f.cv, Math.round((f.x - pad) * s.dpr) * k, Math.round((f.y - pad) * s.dpr) * k, f.cv.width * k, f.cv.height * k);
        }
        if (wipeX > -bw) {
          // The cloth and the damp band drying behind it.
          ctx.globalAlpha = s.dark ? 0.07 : 0.06;
          ctx.fillStyle = s.ink;
          ctx.fillRect(wipeX - bw / 2, 0, bw, s.H);
          for (let i = 1; i <= 3; i++) {
            ctx.globalAlpha = (s.dark ? 0.05 : 0.04) * (1 - i / 4);
            ctx.fillRect(wipeX - bw / 2 - bw * i, 0, bw, s.H);
          }
        }
        if (task?.kind === 'write') {
          // The chalk stick, leaning, its tip on the line.
          const c = s.colors[task.f.c], l = gh * 1.1, w = cw * 2.2;
          ctx.setTransform(s.dpr, 0, 0, s.dpr, pen.x * s.dpr, pen.y * s.dpr);
          ctx.rotate(-0.95);
          ctx.globalAlpha = s.dark ? 0.7 : 0.75;
          ctx.fillStyle = c;
          ctx.beginPath();
          roundRect(ctx, 0, -w / 2, l, w, w * 0.4);
          ctx.fill();
          ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
        } else if (task?.kind === 'erase') {
          // The felt eraser, on its way.
          const { p, L, d } = task, i = Math.max(1, L.findIndex((l) => l >= d));
          const t = clamp((d - L[i - 1]) / ((L[i] - L[i - 1]) || 1), 0, 1);
          const x = mix(p[i * 2 - 2], p[i * 2], t), y = mix(p[i * 2 - 1], p[i * 2 + 1], t), w = eh * 1.9, h = eh * 0.85;
          ctx.globalAlpha = s.dark ? 0.3 : 0.26;
          ctx.fillStyle = s.ink;
          ctx.beginPath();
          roundRect(ctx, x - w / 2, y - h / 2, w, h, h * 0.25);
          ctx.fill();
          ctx.globalAlpha = s.dark ? 0.4 : 0.36;
          ctx.fillStyle = s.colors[0];
          ctx.beginPath();
          roundRect(ctx, x - w / 2, y - h / 2, w, h * 0.42, h * 0.2);
          ctx.fill();
        }
      },
      stop() { for (const f of figs) free(f); },
    };
  });
}

/** Chalk grain in a colour: specks of it with gaps between, as a small tile. @param {string} color @returns {HTMLCanvasElement} */
function dust(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 32, 32);
  g.globalCompositeOperation = 'destination-out';
  // A fixed speckle so every tile matches; about a third of the board shows through.
  let h = 0x9e3779b9;
  for (let i = 0; i < 360; i++) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    g.globalAlpha = 0.5 + (h & 255) / 510;
    g.fillRect(h % 32, (h >>> 8) % 32, 1 + ((h >>> 16) & 1), 1);
  }
  return c;
}
