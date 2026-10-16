// Conveyor: the subject's icons ride conveyor belts, the belts' rollers turning and their surface
// marks running with them, neighbouring belts going opposite ways. The seed picks the variant:
// full-width lanes stacked down the host, a zigzag of short belts each tipping its icons onto the
// one below, or two looped belts one inside the other, like a baggage carousel.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';

/** @typedef {{k:number, x:number, y:number, vy:number, rot:number, belt:number, dir:number}} Item
 * An icon: x, y its centre in CSS px, or on a loop x its distance round and y unused; belt the
 * belt it rides (or is falling toward), vy its fall speed while it falls and dir the way it faces.
 * @typedef {{a:number, b:number, y:number, dir:number, v:number, off:number, need:number, items:Item[]}} Belt
 * A straight belt from x a to b with its top surface at y, running dir (1 right) at v px/s;
 * off is how far it has run, for the rollers and the marks; need the gap before its next icon.
 * @typedef {{x:number, y:number, w:number, h:number, r:number, dir:number, v:number, off:number, items:Item[]}} Loop
 * A looped belt round a rounded rectangle, running dir (1 clockwise) at v px/s. */

const ALPHA = 0.58;
const G = 900;   // px/s², for icons tipping off a belt

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Belt[]} */
    let belts = [];
    /** @type {Loop[]} */
    let loops = [];
    /** @type {Item[]} */
    let falling = [];   // the zigzag's icons, on a belt or between two
    let size = 40, r = 6, gap = 100, due = 0, picks = 0, warm = false;

    /** @returns {number} an icon, the hero a little more often */
    const pickK = () => (picks++ % 5 === 0 ? 0 : rng.int(s.n));
    /** @returns {number} a spacing between icons */
    const space = () => gap * (0.7 + rng.random() * 0.6);

    /** Length round a loop. @param {Loop} L @returns {number} */
    const perim = (L) => 2 * (L.w + L.h - 4 * L.r) + TAU * L.r;

    /** The point `d` px clockwise round loop L from the start of its top edge, and its heading.
     * @param {Loop} L @param {number} d @returns {[number, number, number]} */
    function along(L, d) {
      const sw = L.w - 2 * L.r, sh = L.h - 2 * L.r, q = Math.PI * L.r / 2;
      const segs = [sw, q, sh, q, sw, q, sh, q];
      d = ((d % perim(L)) + perim(L)) % perim(L);
      let i = 0;
      while (i < 7 && d > segs[i]) d -= segs[i++];
      const x0 = L.x + L.r, x1 = L.x + L.w - L.r, y0 = L.y + L.r, y1 = L.y + L.h - L.r;
      /** @param {number} cx @param {number} cy @param {number} a0 @returns {[number, number, number]} */
      const arc = (cx, cy, a0) => { const a = a0 + d / L.r; return [cx + Math.cos(a) * L.r, cy + Math.sin(a) * L.r, -Math.sin(a)]; };
      switch (i) {
        case 0: return [x0 + d, L.y, 1];
        case 1: return arc(x1, y0, -Math.PI / 2);
        case 2: return [L.x + L.w, y0 + d, 0];
        case 3: return arc(x1, y1, 0);
        case 4: return [x1 - d, L.y + L.h, -1];
        case 5: return arc(x0, y1, Math.PI / 2);
        case 6: return [L.x, y1 - d, 0];
        default: return arc(x0, y0, Math.PI);
      }
    }

    /** @returns {void} */
    function lay() {
      const m = Math.min(s.W, s.H);
      if (layout === 0) {
        const laneH = clamp(m * 0.2, 90, 150);
        const n = clamp(Math.floor(s.H * 0.94 / laneH), 3, 7);
        size = clamp(laneH * 0.45, 28, 62);
        r = clamp(size * 0.16, 5, 9);
        gap = Math.max(size * 2.2, n * (s.W + 2 * size) / 40);
        const old = belts;
        belts = [];
        for (let i = 0; i < n; i++) {
          const b = old[i] ?? { a: 0, b: 0, y: 0, dir: i % 2 ? -1 : 1, v: clamp(m * 0.06, 24, 48) * (0.8 + rng.random() * 0.4), off: 0, need: 0, items: [] };
          Object.assign(b, { a: -3 * r, b: s.W + 3 * r, y: s.H * (i + 0.5) / n + size * 0.5 });
          belts.push(b);
          b.items = b.items.filter((it) => it.x > -size && it.x < s.W + size);
          if (!b.items.length) {
            for (let x = space() * rng.random(); x < s.W + size; x += space()) b.items.push({ k: pickK(), x, y: 0, vy: 0, rot: 0, belt: i, dir: b.dir });
          }
        }
      } else if (layout === 1) {
        const n = clamp(Math.round(s.H / 150), 3, 6);
        size = clamp(m * 0.09, 30, 58);
        r = clamp(size * 0.16, 5, 9);
        const step = (s.H - size * 1.2) / n;
        const old = belts;
        belts = [];
        for (let i = 0; i < n; i++) {
          const b = old[i] ?? { a: 0, b: 0, y: 0, dir: i % 2 ? -1 : 1, v: clamp(m * 0.07, 28, 56), off: 0, need: 0, items: [] };
          const lo = s.W * (i % 2 ? 0.16 : 0.07), hi = s.W * (i % 2 ? 0.93 : 0.84);
          Object.assign(b, { a: lo, b: hi, y: size * 1.4 + step * (i + 0.5) });
          belts.push(b);
        }
        const len = belts.reduce((t, b) => t + b.b - b.a, 0);
        gap = Math.max(size * 2, len / 34);
        falling = falling.filter((it) => it.belt < n);
      } else {
        const pad = clamp(m * 0.08, 24, 70), band = clamp(m * 0.2, 70, 170);
        size = clamp(m * 0.085, 30, 60);
        const out = { x: pad, y: pad, w: s.W - 2 * pad, h: s.H - 2 * pad };
        const old = loops;
        loops = [];
        for (let i = 0; i < 2; i++) {
          const w = out.w - 2 * i * band, h = out.h - 2 * i * band;
          if (w < size * 3 || h < size * 3) break;
          const L = old[i] ?? { x: 0, y: 0, w: 0, h: 0, r: 0, dir: i ? -1 : 1, v: clamp(m * 0.06, 24, 46) * (i ? 0.8 : 1), off: 0, items: [] };
          Object.assign(L, { x: out.x + i * band, y: out.y + i * band, w, h, r: Math.min(w, h) * 0.28 });
          loops.push(L);
        }
        const len = loops.reduce((t, L) => t + perim(L), 0);
        gap = Math.max(size * 2.2, len / 38);
        for (const L of loops) {
          const P = perim(L), n = Math.max(3, Math.floor(P / gap));
          if (L.items.length !== n) {
            L.items = [];
            for (let j = 0; j < n; j++) L.items.push({ k: pickK(), x: (j + rng.random() * 0.4) * P / n, y: 0, vy: 0, rot: 0, belt: 0, dir: 1 });
          }
        }
      }
    }

    /** @param {number} dt @returns {void} */
    function step(dt) {
      for (const b of belts) b.off += b.v * dt;
      for (const L of loops) L.off += L.v * dt;
      if (layout === 0) {
        for (const b of belts) {
          for (const it of b.items) it.x += b.dir * b.v * dt;
          b.items = b.items.filter((it) => it.x > -size && it.x < s.W + size);
          // A new icon comes on at the entry edge once the last one is a gap clear of it.
          const edge = b.dir > 0 ? -size * 0.9 : s.W + size * 0.9;
          const last = b.items.reduce((d, it) => Math.min(d, Math.abs(it.x - edge)), Infinity);
          if (last > b.need) {
            b.items.push({ k: pickK(), x: edge, y: 0, vy: 0, rot: 0, belt: belts.indexOf(b), dir: b.dir });
            b.need = space();
          }
        }
      } else if (layout === 1) {
        // New icons drop onto the top belt from above, near its start.
        const top = belts[0];
        due -= dt;
        if (due <= 0) {
          due = space() / top.v;
          falling.push({ k: pickK(), x: top.a + size * (0.6 + rng.random() * 0.8), y: -size, vy: 0, rot: 0, belt: 0, dir: top.dir });
        }
        for (const it of falling) {
          const b = belts[it.belt];
          const rest = b ? b.y - size / 2 : Infinity;
          if (it.vy === 0 && b && it.y >= rest) {
            it.x += b.dir * b.v * dt;
            it.dir = b.dir;
            it.rot *= Math.max(0, 1 - dt * 8);
            // Off the end: it tips over and falls toward the next belt.
            if ((b.dir > 0 && it.x > b.b + size * 0.15) || (b.dir < 0 && it.x < b.a - size * 0.15)) { it.belt++; it.vy = 1; }
            continue;
          }
          it.vy += G * dt;
          it.y += it.vy * dt;
          if (it.vy > 1) it.x += it.dir * (b ? b.v : 40) * dt * 0.6;
          it.rot += it.dir * dt * 1.2;
          if (b && it.y >= rest && it.x >= b.a && it.x <= b.b) { it.y = rest; it.vy = 0; }
        }
        falling = falling.filter((it) => it.y < s.H + size);
      } else {
        for (const L of loops) {
          for (const it of L.items) it.x += L.dir * L.v * dt;
        }
      }
    }

    /** A belt's outline round its end rollers, its rollers with a turning spoke, and the marks
     * along its top. @param {CanvasRenderingContext2D} ctx @param {Belt} b @param {string} color @returns {void} */
    function drawBelt(ctx, b, color) {
      const cy = b.y + r;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = s.dark ? 0.3 : 0.4;
      ctx.beginPath();
      ctx.moveTo(b.a, b.y); ctx.lineTo(b.b, b.y);
      ctx.arc(b.b, cy, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(b.a, b.y + 2 * r);
      ctx.arc(b.a, cy, r, Math.PI / 2, Math.PI * 1.5);
      const rr = r * 0.62, spin = b.dir * b.off / rr;
      const n = Math.max(2, Math.round((b.b - b.a) / (r * 7)));
      for (let i = 0; i <= n; i++) {
        const x = b.a + (b.b - b.a) * i / n;
        ctx.moveTo(x + rr, cy);
        ctx.arc(x, cy, rr, 0, TAU);
        ctx.moveTo(x - Math.cos(spin) * rr, cy - Math.sin(spin) * rr);
        ctx.lineTo(x + Math.cos(spin) * rr, cy + Math.sin(spin) * rr);
      }
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = s.dark ? 0.38 : 0.48;
      ctx.setLineDash([size * 0.12, size * 0.32]);
      ctx.lineDashOffset = -b.dir * b.off;
      ctx.beginPath();
      ctx.moveTo(b.a, b.y - 1.5); ctx.lineTo(b.b, b.y - 1.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w
     * @param {number} h @param {number} rc @returns {void} */
    function rounded(ctx, x, y, w, h, rc) {
      ctx.moveTo(x + rc, y);
      ctx.arcTo(x + w, y, x + w, y + h, rc);
      ctx.arcTo(x + w, y + h, x, y + h, rc);
      ctx.arcTo(x, y + h, x, y, rc);
      ctx.arcTo(x, y, x + w, y, rc);
      ctx.closePath();
    }

    return {
      lay() {
        lay();
        // Long enough for the zigzag's first icons to have reached the bottom belt.
        if (!warm) { warm = true; for (let i = 0; i < 2400; i++) step(1 / 15); }
      },
      step,
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'butt';
        if (layout === 0) {
          belts.forEach((b, i) => {
            drawBelt(ctx, b, s.colors[i % s.colors.length]);
            for (const it of b.items) {
              const bump = Math.abs(Math.sin((it.x - b.a) / (r * 7) * Math.PI)) * 1.2;
              s.icon(it.k, it.x, b.y - size / 2 - 2 - bump, size, 0, ALPHA, b.dir);
            }
          });
        } else if (layout === 1) {
          belts.forEach((b, i) => drawBelt(ctx, b, s.colors[i % s.colors.length]));
          for (const it of falling) s.icon(it.k, it.x, it.y - 2, size, it.rot, ALPHA * clamp((it.y + size) / size, 0, 1), it.dir);
        } else {
          loops.forEach((L, i) => {
            const half = size * 0.62;
            ctx.strokeStyle = s.colors[i % s.colors.length];
            ctx.lineWidth = 2;
            ctx.globalAlpha = s.dark ? 0.3 : 0.4;
            ctx.beginPath();
            rounded(ctx, L.x - half, L.y - half, L.w + 2 * half, L.h + 2 * half, L.r + half);
            rounded(ctx, L.x + half, L.y + half, L.w - 2 * half, L.h - 2 * half, Math.max(2, L.r - half));
            ctx.stroke();
            // Slats across the band, running round with it.
            ctx.lineWidth = size * 1.0;
            ctx.globalAlpha = s.dark ? 0.1 : 0.14;
            ctx.setLineDash([2, size * 0.36]);
            ctx.lineDashOffset = -L.dir * L.off;
            ctx.beginPath();
            rounded(ctx, L.x, L.y, L.w, L.h, L.r);
            ctx.stroke();
            ctx.setLineDash([]);
            for (const it of L.items) {
              const [x, y, tx] = along(L, it.x);
              if (Math.abs(tx) > 0.3) it.dir = Math.sign(tx) * L.dir;
              s.icon(it.k, x, y, size, 0, ALPHA, it.dir);
            }
          });
        }
      },
    };
  });
}
