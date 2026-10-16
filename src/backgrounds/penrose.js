// Penrose: a Penrose rhomb tiling, never repeating, grows out from the centre of the screen tile
// by tile, each tile easing in, until the screen is covered; then it fades and grows again turned
// a little. The seed picks the variant: fat and thin rhombs in two colours, laid in widening rings;
// pale outlined rhombs carrying the matching-rule arcs, which join into circles and long curves,
// laid along five spiral arms; or rhombs coloured by which of the five ways they point, laid in a
// growing five-pointed star.

import { stage, TAU, clamp } from './stage.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const GROW = 32;     // seconds to cover the screen
const EASE = 0.8;    // seconds one tile takes to settle in
const HOLD = 10;     // seconds it stays whole
const FADE = 5;      // seconds it takes to fade
const REST = 1;      // seconds bare before the next

/** @typedef {[number, number, number, number, number, number, number]} Tri a Robinson triangle:
 * kind (0 half of a thin rhomb, 1 half of a fat one), then apex A, B, C as x, y pairs; BC is the
 * rhomb's inner diagonal.
 * @typedef {{k:number, p:number[], ax:number, ay:number, x:number, y:number, d:number, dir:number, half:boolean}} Tile
 * p the corners as x, y pairs; x, y the centre; d the order it is laid in; dir which way it points;
 * a, the apex A for the arcs. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const i0 = rng.int(nc), cFat = s.colors[i0], cThin = s.colors[(i0 + 1 + rng.int(Math.max(1, nc - 1))) % nc];
    const off = rng.int(nc), dirCols = Array.from({ length: 5 }, (_, i) => s.colors[(i + off) % nc]);
    /** @type {Tile[]} */
    let tiles = [];
    let rot = rng.random() * TAU, edge = 40, cx = 0, cy = 0;
    let shown = 0, drawn = 0, mode = 0, clock = 0;
    // Settled tiles, painted once at device pixels; only the few still easing in are drawn live.
    const pane = document.createElement('canvas');

    /** Tiles the screen for the current size and turn. @returns {void} */
    function build() {
      const m = Math.min(s.W, s.H);
      cx = s.W / 2; cy = s.H / 2;
      edge = clamp(m * 0.075, 30, 80);
      const R = Math.hypot(s.W, s.H) / 2 / Math.cos(Math.PI / 10) * 1.05;
      const n = Math.max(1, Math.ceil(Math.log(R / edge) / Math.log(PHI)));
      /** @type {Tri[]} */
      let tris = [];
      // A wheel of ten thin halves round the centre, which deflation turns into the sun pattern.
      for (let i = 0; i < 10; i++) {
        let b = (2 * i - 1) * Math.PI / 10 + rot, c = (2 * i + 1) * Math.PI / 10 + rot;
        if (i % 2 === 0) [b, c] = [c, b];
        tris.push([0, cx, cy, cx + R * Math.cos(b), cy + R * Math.sin(b), cx + R * Math.cos(c), cy + R * Math.sin(c)]);
      }
      const pad = R / Math.pow(PHI, n) * 2;
      for (let g = 0; g < n; g++) {
        /** @type {Tri[]} */
        const next = [];
        for (const [k, ax, ay, bx, by, qx, qy] of tris) {
          if (k === 0) {
            const px = ax + (bx - ax) / PHI, py = ay + (by - ay) / PHI;
            next.push([0, qx, qy, px, py, bx, by], [1, px, py, qx, qy, ax, ay]);
          } else {
            const ux = bx + (ax - bx) / PHI, uy = by + (ay - by) / PHI, vx = bx + (qx - bx) / PHI, vy = by + (qy - by) / PHI;
            next.push([1, vx, vy, qx, qy, ax, ay], [1, ux, uy, vx, vy, bx, by], [0, vx, vy, ux, uy, ax, ay]);
          }
        }
        // Keep only what can still reach the screen.
        tris = next.filter((t) => Math.max(t[1], t[3], t[5]) > -pad && Math.min(t[1], t[3], t[5]) < s.W + pad
          && Math.max(t[2], t[4], t[6]) > -pad && Math.min(t[2], t[4], t[6]) < s.H + pad);
      }
      // Pair the halves across their inner diagonals into rhombs.
      /** @type {Map<string, Tri>} */
      const open = new Map();
      tiles = [];
      const key = (/** @type {number} */ x, /** @type {number} */ y) => `${Math.round(x * 4)},${Math.round(y * 4)}`;
      for (const t of tris) {
        const a = key(t[3], t[4]), b = key(t[5], t[6]), id = a < b ? a + b : b + a;
        const o = open.get(id);
        if (o) { open.delete(id); tiles.push(tile(t, o)); } else open.set(id, t);
      }
      for (const t of open.values()) tiles.push(tile(t, null));
      tiles = tiles.filter((t) => t.x > -edge && t.x < s.W + edge && t.y > -edge && t.y < s.H + edge);
      const th0 = rng.random() * TAU;
      for (const t of tiles) {
        const r = Math.hypot(t.x - cx, t.y - cy), th = Math.atan2(t.y - cy, t.x - cx);
        const j = (rng.random() - 0.5) * edge * 0.8;
        if (layout === 0) t.d = r + j;
        else if (layout === 1) t.d = r * 0.6 + (((th - r / (edge * 4) + th0) % (TAU / 5) + TAU) % (TAU / 5)) / (TAU / 5) * edge * 7 + j * 0.5;
        else t.d = r * (1 + 0.3 * Math.cos(5 * (th - rot))) + j;
      }
      tiles.sort((a, b) => a.d - b.d);
    }

    /** A rhomb from two halves, or a lone half at the rim. @param {Tri} t @param {Tri|null} o @returns {Tile} */
    function tile(t, o) {
      const p = o ? [t[1], t[2], t[3], t[4], o[1], o[2], t[5], t[6]] : [t[1], t[2], t[3], t[4], t[5], t[6]];
      const x = o ? (t[1] + o[1]) / 2 : (t[1] + t[3] + t[5]) / 3, y = o ? (t[2] + o[2]) / 2 : (t[2] + t[4] + t[6]) / 3;
      // Which way the rhomb's long axis points: one of ten steps of 18 degrees round a half turn,
      // thin and fat alternating, paired into five.
      const ang = t[0] === 0 ? Math.atan2(y - t[2], x - t[1]) : Math.atan2(t[6] - t[4], t[5] - t[3]);
      const dir = Math.floor((((Math.round((ang - rot) / (Math.PI / 10)) % 10) + 10) % 10) / 2);
      return { k: t[0], p, ax: t[1], ay: t[2], x, y, d: 0, dir, half: !o };
    }

    /** Adds tile t's shape, eased in by u (0..1), to ctx's path. @param {CanvasRenderingContext2D} g
     * @param {Tile} t @param {number} u */
    function shape(g, t, u) {
      const sc = 0.55 + 0.45 * u, p = t.p;
      g.moveTo(t.x + (p[0] - t.x) * sc, t.y + (p[1] - t.y) * sc);
      for (let i = 2; i < p.length; i += 2) g.lineTo(t.x + (p[i] - t.x) * sc, t.y + (p[i + 1] - t.y) * sc);
      g.closePath();
    }

    /** Paints one tile at ease u. @param {CanvasRenderingContext2D} g @param {Tile} t @param {number} u */
    function paintTile(g, t, u) {
      g.beginPath();
      shape(g, t, u);
      const a = u * u * (3 - 2 * u);
      if (layout === 1) {
        g.globalAlpha = a * (s.dark ? 0.07 : 0.09);
        g.fillStyle = t.k ? cFat : cThin;
        g.fill();
        g.globalAlpha = a * (s.dark ? 0.22 : 0.28);
        g.strokeStyle = s.ink;
        g.lineWidth = 1;
        g.stroke();
        // Arcs round each half's apex through the middles of its sides: across the tiling they
        // join into the closed circles and long curves of Penrose's matching rule.
        g.beginPath();
        const sc = 0.55 + 0.45 * u, hs = t.half ? [0] : [0, 4];
        for (const h of hs) {
          const ax = t.x + (t.p[h] - t.x) * sc, ay = t.y + (t.p[h + 1] - t.y) * sc;
          const bx = t.x + (t.p[(h + 2) % t.p.length] - t.x) * sc, by = t.y + (t.p[(h + 3) % t.p.length] - t.y) * sc;
          const qx = t.x + (t.p[(h + t.p.length - 2) % t.p.length] - t.x) * sc, qy = t.y + (t.p[(h + t.p.length - 1) % t.p.length] - t.y) * sc;
          const r = Math.hypot(bx - ax, by - ay) * 0.5;
          let a0 = Math.atan2(by - ay, bx - ax), a1 = Math.atan2(qy - ay, qx - ax);
          if ((((a1 - a0) % TAU) + TAU) % TAU > Math.PI) [a0, a1] = [a1, a0];
          g.moveTo(ax + r * Math.cos(a0), ay + r * Math.sin(a0));
          g.arc(ax, ay, r, a0, a1);
        }
        g.globalAlpha = a * (s.dark ? 0.45 : 0.55);
        g.strokeStyle = t.k ? cFat : cThin;
        g.lineWidth = clamp(edge * 0.06, 1.5, 3);
        g.stroke();
        return;
      }
      g.globalAlpha = a * (layout === 0 ? (t.k ? 0.3 : 0.2) : 0.26) * (s.dark ? 1 : 1.15);
      g.fillStyle = layout === 0 ? (t.k ? cFat : cThin) : dirCols[t.dir];
      g.fill();
      g.globalAlpha = a * (s.dark ? 0.3 : 0.35);
      g.strokeStyle = s.ink;
      g.lineWidth = 1;
      g.stroke();
    }

    /** Paints settled tiles a..b into the pane. @param {number} a @param {number} b */
    function settle(a, b) {
      const g = pane.getContext('2d');
      drawn = b;
      if (!g) return;
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      g.lineJoin = 'round';
      for (let i = a; i < b; i++) paintTile(g, tiles[i], 1);
    }

    /** Clears the pane. @returns {void} */
    function wipe() {
      const g = pane.getContext('2d');
      g?.setTransform(1, 0, 0, 1, 0, 0);
      g?.clearRect(0, 0, pane.width, pane.height);
      drawn = 0;
    }

    return {
      lay() {
        const frac = tiles.length ? shown / tiles.length : 0.55;
        build();
        pane.width = s.cv.width; pane.height = s.cv.height;
        wipe();
        // The first lay starts part-grown, so the first frame (and reduced motion) shows it spreading.
        shown = frac * tiles.length;
        // Settled: all those whose ease has finished.
        settle(0, clamp(Math.floor(shown - EASE * tiles.length / GROW), 0, tiles.length));
      },
      step(dt) {
        clock += dt;
        if (mode === 0) {
          shown += dt * tiles.length / GROW;
          const done = clamp(Math.floor(shown - EASE * tiles.length / GROW), 0, tiles.length);
          if (done >= tiles.length) { mode = 1; clock = 0; }
        } else if (mode === 1 && clock > HOLD) { mode = 2; clock = 0; }
        else if (mode === 2 && clock > FADE) { mode = 3; clock = 0; }
        else if (mode === 3 && clock > REST) {
          rot += 0.3 + rng.random() * 0.6;
          shown = 0; mode = 0; clock = 0;
          build(); wipe();
        }
      },
      draw() {
        const { ctx } = s;
        if (mode === 3) return;
        const per = tiles.length / GROW;
        const done = clamp(Math.floor(shown - EASE * per), 0, tiles.length);
        if (done > drawn) settle(drawn, done);
        const u = mode === 2 ? clamp(clock / FADE, 0, 1) : 0;
        const fade = 1 - u * u * (3 - 2 * u);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = fade;
        ctx.drawImage(pane, 0, 0);
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
        ctx.lineJoin = 'round';
        // The tiles still easing in, drawn live over the settled ones.
        const top = Math.min(tiles.length, Math.ceil(shown));
        for (let i = drawn; i < top; i++) paintTile(ctx, tiles[i], clamp((shown - i) / (EASE * per), 0, 1));
      },
    };
  });
}
