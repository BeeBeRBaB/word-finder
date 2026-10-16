// Juggle: the subject's icons are tossed in arcs between pairs of hands that scoop and throw them
// in real juggling patterns (siteswaps), each icon turning in the air. The seed picks the variant:
// a few small jugglers doing cascades and fountains, two or three big ones doing showers where the
// icons go round in a circle, or a ring of hands passing a stream of icons round the room.

import { iconStage } from './icon-stage.js';
import { TAU, clamp, mix } from './stage.js';

/** @typedef {{k:number, from:number, to:number, t0:number, t1:number, spin:number}} Ball
 * An icon in a pattern: thrown from hand `from` on beat t0, caught by hand `to` DWELL before t1
 * and thrown again on t1; spin is its turns per throw.
 * @typedef {{x:number, y:number, w:number, size:number, beat:number, g:number, ss:number[],
 *   clock:number, next:number, land:Map<number, Ball>, balls:Ball[]}} Juggler
 * One pair of hands centred on x with its hands at y, w apart from the middle, a beat of `beat`
 * seconds and gravity g in px per beat²; clock is in beats and `next` the next beat to throw on. */

const DWELL = 0.55;   // beats a ball sits in the hand
const ALPHA = 0.58;
const CASCADES = ['3', '3', '4', '5', '423', '441', '531'];
const SHOWERS = ['51', '51', '71', '531'];
const RING_BEAT = 0.9;   // seconds between one hand's throw and the next's, round the ring
const RING_AIR = 0.7;    // share of that an icon is in the air

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Juggler[]} */
    let jugglers = [];
    let picks = 0;
    // The ring variant: hands round an ellipse, and icons spaced along the stream.
    let ringN = 6, ringBalls = 9, ringT = 0, rcx = 0, rcy = 0, rx = 1, ry = 1, rsize = 30, rdir = 1;
    /** @type {number[]} */
    let ringK = [];

    /** @returns {number} an icon, the hero a little more often */
    const pickK = () => (picks++ % 4 === 0 ? 0 : rng.int(s.n));

    /** Runs a juggler's throws up to its clock. @param {Juggler} j @returns {void} */
    function throws(j) {
      while (j.next <= j.clock) {
        const b = j.next++, v = j.ss[b % j.ss.length];
        if (!v) continue;
        let ball = j.land.get(b);
        if (ball) j.land.delete(b);
        else { ball = { k: pickK(), from: 0, to: 0, t0: 0, t1: 0, spin: (rng.random() < 0.5 ? -1 : 1) * (0.5 + rng.random() * 0.5) }; j.balls.push(ball); }
        Object.assign(ball, { from: b % 2, to: (b + v) % 2, t0: b, t1: b + v });
        j.land.set(b + v, ball);
      }
    }

    /** Where hand h of j is at clock c, scooping in from its catch to its throw.
     * @param {Juggler} j @param {number} h @param {number} c @returns {[number, number]} */
    function hand(j, h, c) {
      const side = h ? 1 : -1;
      const u = c - h - 2 * Math.floor((c - h) / 2);   // beats since this hand last threw, 0..2
      const inner = j.x + side * j.w * 0.3, outer = j.x + side * j.w;
      if (u < 2 - DWELL) {
        const a = u / (2 - DWELL);
        return [mix(inner, outer, a), j.y - Math.sin(Math.PI * a) * j.w * 0.12];
      }
      const a = (u - 2 + DWELL) / DWELL;
      return [mix(outer, inner, a), j.y + Math.sin(Math.PI * a) * j.w * 0.18];
    }

    /** @param {number} x @param {number} y @param {number} w @param {number} hs height its highest throw reaches
     * @param {string} pattern @returns {Juggler} */
    function juggler(x, y, w, hs, pattern) {
      const ss = [...pattern].map(Number);
      const top = Math.max(...ss) - DWELL;
      const beat = 0.34 + rng.random() * 0.06;
      return { x, y, w, size: clamp(w * 0.42, 24, 58), beat, g: 8 * hs / (top * top), ss,
        clock: 0, next: 0, land: new Map(), balls: [] };
    }

    /** @returns {void} */
    function layJugglers() {
      const m = Math.min(s.W, s.H);
      const old = jugglers;
      jugglers = [];
      if (layout === 0) {
        const cols = clamp(Math.round(s.W / 560), 1, 3), rows = clamp(Math.round(s.H / 400), 1, 2);
        const cw = s.W / cols, ch = s.H / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            const w = clamp(Math.min(cw, ch) * 0.22, 40, 100);
            const x = cw * (c + 0.5 + (r % 2 ? 0.18 : -0.18) * (cols > 1 ? 1 : 0.6));
            jugglers.push(old[i] ?? juggler(0, 0, 0, 0, CASCADES[rng.int(CASCADES.length)]));
            Object.assign(jugglers[i], { x, y: ch * (r + 0.86), w, size: clamp(w * 0.55, 30, 60) });
            jugglers[i].g = 8 * ch * 0.6 / (Math.max(...jugglers[i].ss) - DWELL) ** 2;
          }
        }
      } else {
        const n = s.W > s.H * 1.5 ? 3 : 2, tall = s.H > s.W;
        for (let i = 0; i < n; i++) {
          const x = tall ? s.W * (i ? 0.66 : 0.34) : s.W * (i + 0.5) / n;
          const y = tall ? s.H * (i ? 0.93 : 0.27) : s.H * (0.9 - (i % 2) * 0.06);
          const w = clamp(m * 0.16, 50, 140);
          jugglers.push(old[i] ?? juggler(0, 0, 0, 0, SHOWERS[rng.int(SHOWERS.length)]));
          Object.assign(jugglers[i], { x, y, w, size: clamp(w * 0.5, 34, 64) });
          const hs = tall ? s.H * 0.27 : s.H * 0.62;
          jugglers[i].g = 8 * hs / (Math.max(...jugglers[i].ss) - DWELL) ** 2;
        }
      }
      for (const j of jugglers) if (!old.includes(j)) { j.clock = 24 + rng.random() * 12; throws(j); }
    }

    /** @returns {void} */
    function layRing() {
      const m = Math.min(s.W, s.H);
      rcx = s.W / 2; rcy = s.H * 0.57; rx = s.W * 0.4; ry = s.H * 0.31;
      ringN = clamp(Math.round(TAU * Math.sqrt((rx * rx + ry * ry) / 2) / 190), 6, 12);
      ringBalls = Math.round(ringN * 1.6);
      rsize = clamp(m * 0.075, 28, 56);
      while (ringK.length < ringBalls) ringK.push(pickK());
      ringK.length = ringBalls;
    }

    /** Hand i of the ring, numbered the way the icons go round. @param {number} i @returns {[number, number]} */
    function ringHand(i) {
      const a = -Math.PI / 2 + rdir * i * TAU / ringN;
      return [rcx + Math.cos(a) * rx, rcy + Math.sin(a) * ry];
    }

    /** Where ball b of j is at clock c while in the air: level between the hands, and under
     * gravity up and down. @param {Juggler} j @param {Ball} b @param {number} c @returns {[number, number, number]} */
    function flight(j, b, c) {
      const catchAt = b.t1 - DWELL, u = (c - b.t0) / (catchAt - b.t0);
      const [x0, y0] = hand(j, b.from, b.t0), [x1, y1] = hand(j, b.to, catchAt);
      return [mix(x0, x1, u), mix(y0, y1, u) - 0.5 * j.g * (c - b.t0) * (catchAt - c), Math.sign(x1 - x0) || 1];
    }

    /** Where the ring's stream is at phase p (in beats round from hand 0).
     * @param {number} p @returns {[number, number, number]} */
    function ringAt(p) {
      const i = Math.floor(p), u = p - i;
      const [ax, ay] = ringHand(i % ringN), [bx, by] = ringHand((i + 1) % ringN);
      if (u >= RING_AIR) return [bx, by, Math.sign(bx - ax)];
      const a = u / RING_AIR, g = 0.25 * Math.min(s.W, s.H);
      return [mix(ax, bx, a), mix(ay, by, a) - 4 * g * a * (1 - a) * (0.3 + Math.hypot(bx - ax, by - ay) / (rx + ry)),
        Math.sign(bx - ax)];
    }

    /** A faint tail back along a flight: `span` of a beat long in steps of `d`.
     * @param {CanvasRenderingContext2D} ctx @param {string} color @param {number} span @param {number} d
     * @param {(d:number) => [number, number, number]} at @returns {void} */
    function trail(ctx, color, span, d, at) {
      if (span <= 0) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = s.dark ? 0.2 : 0.26;
      ctx.beginPath();
      const [x, y] = at(0);
      ctx.moveTo(x, y);
      for (let e = d; e >= -span; e += d) { const [px, py] = at(e); ctx.lineTo(px, py); }
      ctx.stroke();
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @returns {void} */
    function cup(ctx, x, y, w) {
      ctx.moveTo(x - w, y - w * 0.35);
      ctx.quadraticCurveTo(x, y + w * 0.9, x + w, y - w * 0.35);
    }

    return {
      lay() {
        if (layout === 2) { if (!ringK.length) rdir = rng.random() < 0.5 ? -1 : 1; layRing(); }
        else layJugglers();
      },
      step(dt) {
        if (layout === 2) { ringT += dt; return; }
        for (const j of jugglers) { j.clock += dt / j.beat; throws(j); }
      },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        ctx.globalAlpha = s.dark ? 0.32 : 0.42;
        if (layout === 2) {
          ctx.strokeStyle = s.colors[0];
          ctx.beginPath();
          for (let i = 0; i < ringN; i++) {
            const [x, y] = ringHand(i);
            cup(ctx, x, y + rsize * 0.55, rsize * 0.32);
          }
          ctx.stroke();
          for (let b = 0; b < ringBalls; b++) {
            const p = ringT / RING_BEAT + b * ringN / ringBalls;
            const u = p - Math.floor(p);
            const [x, y, dir] = ringAt(p);
            if (u < RING_AIR) trail(ctx, s.hue(ringK[b]), Math.min(u, 0.25), -0.06, (d) => ringAt(p + d));
            s.icon(ringK[b], x, y, rsize, u < RING_AIR ? TAU * (u / RING_AIR) * (b % 2 ? 0.5 : -0.5) : 0, ALPHA, dir);
          }
          return;
        }
        for (const j of jugglers) {
          ctx.strokeStyle = s.colors[jugglers.indexOf(j) % s.colors.length];
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = s.dark ? 0.32 : 0.42;
          ctx.beginPath();
          for (const h of [0, 1]) {
            const [x, y] = hand(j, h, j.clock);
            cup(ctx, x, y + j.size * 0.52, j.size * 0.4);
          }
          ctx.stroke();
          for (const b of j.balls) {
            const c = j.clock, catchAt = b.t1 - DWELL;
            if (b.t0 > c) continue;
            let x, y, rot = 0, dir = b.to ? -1 : 1;
            if (c < catchAt) {
              const T = catchAt - b.t0, u = (c - b.t0) / T;
              [x, y, dir] = flight(j, b, c);
              rot = TAU * b.spin * u * Math.min(1, T / 2);
              trail(ctx, s.hue(b.k), Math.min(c - b.t0, 0.45), -0.09, (d) => flight(j, b, c + d));
            } else {
              [x, y] = hand(j, b.to, c);
            }
            s.icon(b.k, x, y, j.size, rot, ALPHA, dir);
          }
        }
      },
    };
  });
}
