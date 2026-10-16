// Stack: the subject's icons drop one at a time into columns and pile up; when a row is full it
// fades away and everything above it settles into the gap, like a falling-block game. The seed
// picks the variant: a narrow walled well in the middle, a low pile across the whole floor with
// several drops in the air at once, or a pile against the left wall that icons slide in to sideways.

import { iconStage } from './icon-stage.js';
import { clamp } from './stage.js';

/** @typedef {{k:number, y:number, v:number, land:number}} Cell
 * An icon in a column, its slot its index there: y is where it is now in cells from the floor
 * (above its slot while it falls), v its speed in cells/s and land the seconds since it landed. */

const ACCEL = 9;     // cells/s²
const VMAX = 4.5;    // cells/s
const CLEAR = 1;     // seconds a full row takes to fade
const ALPHA = 0.56;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    const side = layout === 2;
    /** @type {Cell[][]} */
    const cols = [];
    let cell = 40, x0 = 0, base = 0, maxRows = 4, top = 10, gap = 0.5, wait = 0, warm = false;
    /** The row fading out, and how far through it is. */
    let clearing = -1, cu = 0;

    /** A column to drop into, at random so the pile grows ragged, never a full one or one still
     * receiving. @returns {number} -1 when none will take one */
    function pick() {
      const open = [];
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i], tip = c[c.length - 1];
        if (c.length < maxRows && !(tip && tip.y > top - 2)) open.push(i);
      }
      return open.length ? open[rng.int(open.length)] : -1;
    }

    /** @param {number} dt @returns {void} */
    function step(dt) {
      wait -= dt;
      if (wait <= 0) {
        wait = gap * (0.7 + rng.random() * 0.6);
        const i = pick();
        if (i >= 0) cols[i].push({ k: rng.random() < 0.2 ? 0 : rng.int(s.n), y: top + rng.random() * 0.5, v: 0, land: 9 });
      }
      for (const c of cols) {
        c.forEach((p, slot) => {
          p.land += dt;
          if (p.y <= slot) return;
          p.v = Math.min(VMAX, p.v + ACCEL * dt);
          p.y -= p.v * dt;
          if (p.y <= slot) { p.y = slot; p.v = 0; p.land = 0; }
        });
      }
      if (clearing >= 0) {
        cu += dt / CLEAR;
        if (cu >= 1) {
          for (const c of cols) c.splice(clearing, 1);
          clearing = -1;
        }
        return;
      }
      // The lowest row with a landed icon in every column fades out.
      for (let r = 0; r < maxRows; r++) {
        if (cols.every((c) => c[r] && c[r].y === r && c[r].v === 0)) { clearing = r; cu = 0; break; }
      }
    }

    /** Screen centre of a spot `y` cells up column `i`. @param {number} i @param {number} y
     * @returns {[number, number]} */
    const at = (i, y) => side
      ? [x0 + (y + 0.5) * cell, base + (i + 0.5) * cell]
      : [x0 + (i + 0.5) * cell, base - (y + 0.5) * cell];

    return {
      lay() {
        const m = Math.min(s.W, s.H), pad = clamp(m * 0.04, 10, 28);
        let n;
        if (layout === 0) {
          cell = clamp(m / 9, 38, 70);
          n = clamp(Math.floor(s.W * 0.66 / cell), 5, 8);
          maxRows = clamp(Math.floor(44 / n), 3, Math.floor((s.H - 2 * pad) / cell) - 2);
          gap = 0.55;
        } else if (layout === 1) {
          cell = clamp(m / 8, 40, 76);
          n = Math.min(12, Math.floor((s.W - 2 * pad) / cell));
          maxRows = clamp(Math.floor(50 / n), 3, 5);
          gap = 2.2 / n;
        } else {
          cell = clamp(m / 8.5, 38, 72);
          n = Math.min(11, Math.floor((s.H - 2 * pad) / cell));
          maxRows = clamp(Math.floor(44 / n), 3, Math.floor((s.W - 2 * pad) / cell) - 2);
          gap = 0.5;
        }
        if (side) {
          x0 = pad; base = (s.H - n * cell) / 2;
          top = (s.W - x0) / cell + 0.2;
        } else {
          x0 = (s.W - n * cell) / 2; base = s.H - pad;
          top = base / cell + 0.2;
        }
        while (cols.length < n) cols.push([]);
        if (cols.length > n) { cols.length = n; clearing = -1; }
        for (const c of cols) {
          if (c.length > maxRows) c.length = maxRows;
          for (const p of c) p.y = Math.min(p.y, top);
        }
        if (!warm) {
          warm = true;
          for (let i = 0; i < 600; i++) step(1 / 15);
        }
      },
      step,
      draw() {
        const { ctx } = s;
        const n = cols.length, size = cell * 0.84;
        // The walls: a well, a floor, or the side wall.
        ctx.strokeStyle = s.colors[0];
        ctx.globalAlpha = s.dark ? 0.3 : 0.4;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (layout === 0) {
          const h = (maxRows + 1.5) * cell, r = x0 + n * cell + 4;
          ctx.moveTo(x0 - 4, base - h); ctx.lineTo(x0 - 4, base + 3); ctx.lineTo(r, base + 3); ctx.lineTo(r, base - h);
        } else if (layout === 1) {
          ctx.moveTo(x0 - cell * 0.3, base + 3); ctx.lineTo(x0 + n * cell + cell * 0.3, base + 3);
        } else {
          ctx.moveTo(x0 - 3, base - cell * 0.3); ctx.lineTo(x0 - 3, base + n * cell + cell * 0.3);
        }
        ctx.stroke();
        // The row going, as a soft band that rises and falls once.
        if (clearing >= 0) {
          const [a, b] = at(0, clearing), [c, d] = at(n - 1, clearing);
          ctx.fillStyle = s.colors[1 % s.colors.length];
          ctx.globalAlpha = 0.16 * Math.sin(Math.PI * cu);
          const h = cell * 0.5;
          if (side) ctx.fillRect(a - h, b - h, cell, d - b + cell);
          else ctx.fillRect(a - h, b - h, c - a + cell, cell);
        }
        cols.forEach((c, i) => {
          c.forEach((p, slot) => {
            const [x, y] = at(i, p.y);
            const fade = slot === clearing ? 1 - cu : 1;
            if (fade <= 0 || y < -cell || x > s.W + cell) return;
            // A short squash on landing, kept sitting on its slot.
            const sq = p.land < 0.24 ? 0.13 * Math.sin(Math.PI * p.land / 0.24) : 0;
            const sz = size * (slot === clearing ? 1 - 0.25 * cu : 1);
            if (side) s.icon(p.k, x - sz * sq / 2, y, sz * (1 - sq * 0.5), 0, ALPHA * fade, -1);
            else s.icon(p.k, x, y + sz * sq / 2, sz, 0, ALPHA * fade, 0, 1 - sq);
          });
        });
      },
    };
  });
}
