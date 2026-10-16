// Pegboard: balls drop one by one from a funnel through rows of pegs, bouncing left or right at
// each, and pile up in bins below, the columns growing into a bell curve; when a bin is full the
// floor gives way, the piles slide out and filling starts again. The seed picks the variant: one
// large triangle of pegs; a few small boards side by side, each its own colour and rhythm; or a
// field of pegs the full width of the page fed by two or three funnels, the piles making a range
// of overlapping humps where their colours mix.

import { stage, clamp } from './stage.js';

const HOP = 0.2;       // s from one peg row to the next
const DRAIN = 1.6;     // s for full bins to empty

/** @typedef {{q:number, row:number, u:number, d:number, c:number, fall:boolean, y:number, vy:number}} Ball
 * q its place across in half peg spacings, row the peg row it last struck (-1 in the funnel), u
 * progress of the hop to the next row, d which way that hop goes (-1, 0, 1); fall: dropping into a bin. */
/** @typedef {{q:number, c:number, next:number}} Source */
/** @typedef {{x0:number, top:number, sx:number, sy:number, R:number, qlo:number, qhi:number, tri:boolean,
 *   bins:number[][], binTop:number, binBot:number, cap:number, srcs:Source[], balls:Ball[], drain:number}} Board */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    const sprites = s.colors.map((c) => ball(c));
    const first = rng.int(C);
    /** @type {Board[]} */
    let boards = [];
    let warm = false;

    /** x of half-spacing place q on board b. @param {Board} b @param {number} q */
    const xOf = (b, q) => b.x0 + (q - b.qlo) * b.sx / 2;
    /** y of a ball resting on peg row r. @param {Board} b @param {number} r */
    const yOf = (b, r) => b.top + r * b.sy - b.sx * 0.36;

    /** A triangle board filling a box. @param {number} bx @param {number} by @param {number} bw @param {number} bh
     * @param {number} R rows @param {number} c colour @returns {Board} */
    function triangle(bx, by, bw, bh, R, c) {
      // The big board is a little flatter, so it spreads wider than the board on top of it.
      const f = layout === 0 ? 0.6 : 0.87, sx = Math.min(bh * (layout === 0 ? 0.6 : 0.55) / (R + 1.5) / f, bw / (R + 2)), sy = sx * f;
      const top = by + sy * 1.9;
      return board(bx + bw / 2 - R * sx / 2, top, sx, sy, R, -R, R, true, by + bh, [{ q: 0, c, next: rng.random() }]);
    }

    /** @param {number} x0 @param {number} top @param {number} sx @param {number} sy @param {number} R @param {number} qlo
     * @param {number} qhi @param {boolean} tri @param {number} bot @param {Source[]} srcs @returns {Board} */
    function board(x0, top, sx, sy, R, qlo, qhi, tri, bot, srcs) {
      const binTop = top + (R - 1) * sy + sy * 0.75;
      const cap = Math.max(4, Math.floor((bot - binTop) / (sx * 0.54)));
      return { x0, top, sx, sy, R, qlo, qhi, tri, bins: Array.from({ length: (qhi - qlo) / 2 + 1 }, () => []),
        binTop, binBot: bot, cap, srcs, balls: [], drain: -1 };
    }

    function build() {
      const old = boards;
      const m = Math.min(s.W, s.H);
      if (layout === 0) {
        const bw = Math.min(s.W * 0.94, s.H * 1.4), bh = s.H * 0.94;
        boards = [triangle((s.W - bw) / 2, s.H * 0.03, bw, bh, s.W < 500 ? 12 : 14, first)];
      } else if (layout === 1) {
        // Side by side when wide, stacked when tall.
        const wide = s.W >= s.H, n = wide ? clamp(Math.round(s.W / (s.H * 0.72)), 2, 4) : 2;
        boards = Array.from({ length: n }, (_, i) => wide
          ? triangle(s.W * i / n + 6, s.H * 0.08, s.W / n - 12, s.H * 0.86, 9, (first + i) % C)
          : triangle(s.W * 0.06, s.H * (0.03 + i * 0.49), s.W * 0.88, s.H * 0.45, 9, (first + i) % C));
      } else {
        const sx = clamp(m * 0.05, 16, 44), sy = sx * 0.87;
        const R = clamp(Math.floor(s.H * 0.48 / sy), 6, 16);
        const nb = Math.max(4, Math.floor((s.W - sx * 0.6) / sx)), qlo = R % 2, qhi = qlo + 2 * (nb - 1);
        const k = s.W > s.H * 1.2 ? 3 : 2;
        const srcs = Array.from({ length: k }, (_, i) => {
          let q = qlo + 2 * Math.round((i + 0.5) / k * (nb - 1)) + (R % 2 ? 1 : 0);
          if (q > qhi) q -= 2;
          return { q, c: (first + i) % C, next: rng.random() };
        });
        boards = [board((s.W - (nb - 1) * sx) / 2, sy * 2.4, sx, sy, R, qlo, qhi, false, s.H - 4, srcs)];
      }
      // Keep the piles through a resize when the bins still match.
      boards.forEach((b, i) => {
        const o = old[i];
        if (o && o.bins.length === b.bins.length) b.bins = o.bins.map((p) => p.slice(0, b.cap - 1));
      });
    }

    /** @param {Board} b @param {number} dt */
    function stepBoard(b, dt) {
      if (b.drain >= 0) {
        b.drain += dt;
        if (b.drain > DRAIN) { b.drain = -1; for (const p of b.bins) p.length = 0; }
      }
      for (const src of b.srcs) {
        src.next -= dt;
        if (src.next <= 0 && b.drain < 0) {
          src.next = (b.tri ? 0.34 : 0.5) + rng.random() * 0.22;
          b.balls.push({ q: src.q, row: -1, u: 0, d: 0, c: b.tri && layout === 0 ? rng.int(C) : src.c, fall: false, y: 0, vy: 0 });
        }
      }
      const g = b.sx * 40;
      for (let i = b.balls.length - 1; i >= 0; i--) {
        const p = b.balls[i];
        if (p.fall) {
          const k = (p.q - b.qlo) >> 1, pile = b.bins[k];
          p.vy += g * dt; p.y += p.vy * dt;
          const land = b.binBot - (pile.length + 0.5) * b.sx * 0.54;
          if (p.y >= land) {
            b.balls.splice(i, 1);
            if (b.drain < 0) {
              pile.push(p.c);
              if (pile.length >= b.cap) b.drain = 0;
            }
          }
          continue;
        }
        p.u += dt / HOP;
        if (p.u < 1) continue;
        p.u -= 1; p.q += p.d; p.row++;
        if (p.row === b.R - 1) {
          // Off the last row and down into a bin.
          let d = rng.random() < 0.5 ? -1 : 1;
          if (p.q + d < b.qlo || p.q + d > b.qhi) d = -d;
          p.q += d; p.fall = true; p.y = yOf(b, p.row); p.vy = -b.sx * 3;
          continue;
        }
        let d = rng.random() < 0.5 ? -1 : 1;
        // A field's side walls turn a ball back in.
        if (p.q + d < b.qlo || p.q + d > b.qhi) d = -d;
        p.d = d;
      }
    }

    return {
      lay() {
        build();
        if (!warm) {
          // Warm up, so the first (and, with reduced motion, only) frame has piles and balls in flight.
          warm = true;
          const n = Math.round((8 + rng.random() * 14) * 15);
          for (let i = 0; i < n; i++) for (const b of boards) stepBoard(b, 1 / 15);
        }
      },
      step(dt) { for (const b of boards) stepBoard(b, dt); },
      draw() {
        const { ctx } = s;
        const lift = s.dark ? 1 : 1.12;
        for (const b of boards) {
          const pr = Math.max(1.8, b.sx * 0.12), rb = b.sx * 0.27;
          ctx.fillStyle = s.ink;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          for (let r = 0; r < b.R; r++) {
            const lo = b.tri ? -r : b.qlo + ((b.qlo + r) % 2 ? 1 : 0), hi = b.tri ? r : b.qhi;
            const y = b.top + r * b.sy;
            for (let q = lo; q <= hi; q += 2) { const x = xOf(b, q); ctx.moveTo(x + pr, y); ctx.arc(x, y, pr, 0, 6.2832); }
          }
          ctx.fill();
          // Bin walls and floor, and the funnels.
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = clamp(b.sx * 0.06, 1.2, 2.2);
          ctx.globalAlpha = s.dark ? 0.3 : 0.34;
          ctx.beginPath();
          for (let q = b.qlo - 1; q <= b.qhi + 1; q += 2) { const x = xOf(b, q); ctx.moveTo(x, b.binTop); ctx.lineTo(x, b.binBot); }
          ctx.moveTo(xOf(b, b.qlo - 1), b.binBot); ctx.lineTo(xOf(b, b.qhi + 1), b.binBot);
          for (const src of b.srcs) {
            const x = xOf(b, src.q), y = b.top - b.sy * 0.9;
            ctx.moveTo(x - b.sx * 1.3, y - b.sy * 1.1); ctx.lineTo(x - rb * 1.3, y); ctx.lineTo(x - rb * 1.3, y + b.sy * 0.2);
            ctx.moveTo(x + b.sx * 1.3, y - b.sy * 1.1); ctx.lineTo(x + rb * 1.3, y); ctx.lineTo(x + rb * 1.3, y + b.sy * 0.2);
          }
          ctx.stroke();
          const a = (s.dark ? 0.62 : 0.7) * lift, fall = b.drain < 0 ? 0 : 0.5 * b.sx * 40 * b.drain * b.drain;
          ctx.globalAlpha = b.drain < 0 ? a : a * Math.max(0, 1 - b.drain / DRAIN);
          b.bins.forEach((pile, k) => {
            const x = xOf(b, b.qlo + k * 2);
            for (let j = 0; j < pile.length; j++) {
              ctx.drawImage(sprites[pile[j]], x - rb, b.binBot - (j + 1) * b.sx * 0.54 + fall, rb * 2, rb * 2);
            }
          });
          ctx.globalAlpha = a;
          for (const p of b.balls) {
            let x, y;
            if (p.fall) { x = xOf(b, p.q); y = p.y; }
            else if (p.row < 0) {
              // Dropping out of the funnel onto the top peg.
              x = xOf(b, p.q); y = b.top - b.sy * 1.2 + (yOf(b, 0) - b.top + b.sy * 1.2) * p.u * p.u;
            } else {
              // A hop: across half a spacing, up a little and down onto the next peg.
              x = xOf(b, p.q + p.d * p.u);
              y = yOf(b, p.row) + b.sy * p.u * p.u - b.sy * 0.55 * Math.sin(Math.PI * p.u) * (1 - p.u * 0.5);
            }
            ctx.drawImage(sprites[p.c], x - rb, y - rb, rb * 2, rb * 2);
          }
        }
      },
    };
  });
}

/** A ball with a highlight, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function ball(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 40;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.beginPath(); g.arc(20, 20, 19, 0, 6.2832); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.beginPath(); g.ellipse(14, 13, 6, 4, -0.6, 0, 6.2832); g.fill();
  return c;
}
