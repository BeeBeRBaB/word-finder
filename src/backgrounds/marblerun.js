// Marble run: glass marbles ride a lift up the side of a run, roll down zig-zag ramps, dropping
// from each ramp's end onto the next, and come back to the lift at the bottom, round and round.
// Layout 0: runs of plain zig-zag ramps side by side. 1: fewer, longer ramps, each dropping
// into a funnel that the marbles spiral round before falling through. 2: each run starts with
// a corkscrew wound round a post, then ramps the rest of the way down.

import { stage, clamp, TAU } from './stage.js';

/** @typedef {{d:number, at:(u:number) => [number, number]}} Seg a part of the loop: seconds
 * it takes and where a marble is at u 0..1 of the way through it */
/** @typedef {{segs:Seg[], ends:Float32Array, T:number, M:number, lift:[number, number, number, number],
 *   track:Path2D, back:Path2D, marbles:{slot:number, c:number}[]}} Run
 * Its loop as segments with cumulative end times, the loop's length T in seconds, M slots round
 * it; the lift's x, top y, bottom y and its start time in the loop; the drawn track (back is
 * the far side of a corkscrew, drawn fainter); which slots carry a marble, and in what colour. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const sprites = s.colors.map((c) => marble(c));
    /** @type {Run[]} */
    let runs = [];
    let r = 8, key = '';
    // Colours of every run's marbles, kept through a resize.
    const tint = Array.from({ length: 200 }, () => rng.int(sprites.length));

    /** @param {number} x0 @param {number} x1 @param {number} side the lift's side, 1 right or -1 left
     * @param {number} k which run @returns {Run} */
    function build(x0, x1, side, k) {
      /** @type {Seg[]} */
      const segs = [];
      const track = new Path2D(), back = new Path2D();
      const vr = r * 10, vl = r * 4.2, top = s.H * 0.07 + r, bot = s.H * 0.94 - r;
      const lx = side > 0 ? x1 - r * 3 : x0 + r * 3;
      const a = side > 0 ? x0 + r * 2 : lx + r * 4, b = side > 0 ? lx - r * 4 : x1 - r * 2;
      const span = b - a;

      /** A straight roll from p to q, speeding up a little, on a rail under the marble.
       * @param {number} px @param {number} py @param {number} qx @param {number} qy @returns {void} */
      function ramp(px, py, qx, qy) {
        const len = Math.hypot(qx - px, qy - py);
        segs.push({ d: len / vr, at: (u) => { const f = 0.7 * u + 0.3 * u * u; return [px + (qx - px) * f, py + (qy - py) * f]; } });
        track.moveTo(px - Math.sign(qx - px) * r, py + r); track.lineTo(qx, qy + r);
      }
      /** A drop straight down, quickening. @param {number} x @param {number} y0 @param {number} y1 @returns {void} */
      function drop(x, y0, y1) {
        segs.push({ d: Math.sqrt(2 * (y1 - y0) / (r * 160)), at: (u) => [x, y0 + (y1 - y0) * u * u] });
      }
      /** A funnel with its rim at y, round x: in at the rim, out at the neck.
       * @param {number} x @param {number} y @param {number} rf @param {number} dir @returns {number} the neck's y */
      function funnel(x, y, rf, dir) {
        const depth = rf * 1.1, neck = r * 1.4, turns = 2.25;
        segs.push({ d: 3.2, at: (u) => {
          // Faster round as it nears the neck, as a coin in a wishing well does.
          const w = 1 - Math.pow(1 - u, 1.7);
          const th = w * turns * TAU, rad = neck * 0.5 + (rf - r - neck * 0.5) * Math.pow(1 - w, 0.8);
          return [x + dir * rad * Math.cos(th), y + depth * w * w + rad * 0.28 * Math.sin(th)];
        } });
        track.moveTo(x + rf, y); track.ellipse(x, y, rf, rf * 0.28, 0, 0, TAU);
        track.moveTo(x - rf, y); track.lineTo(x - neck, y + depth + r);
        track.lineTo(x - neck, y + depth + r * 2.5);
        track.moveTo(x + rf, y); track.lineTo(x + neck, y + depth + r);
        track.lineTo(x + neck, y + depth + r * 2.5);
        return y + depth + r * 2.5;
      }
      /** A corkscrew down a post at x, from y, starting on the lift's side.
       * @param {number} x @param {number} y @param {number} rad @param {number} turns @returns {number} its foot's y */
      function screw(x, y, rad, turns) {
        const pitch = r * 6, h = pitch * turns, len = turns * Math.hypot(TAU * rad, pitch);
        segs.push({ d: len / vr, at: (u) => { const th = u * turns * TAU; return [x + side * rad * Math.cos(th), y + h * u + rad * 0.3 * Math.sin(th)]; } });
        const n = Math.ceil(turns * 28);
        let wasFront = true;
        for (let i = 0; i <= n; i++) {
          const th = i / n * turns * TAU, px = x + side * rad * Math.cos(th), py = y + h * i / n + rad * 0.3 * Math.sin(th) + r;
          const front = Math.sin(th) >= 0, path = front ? track : back;
          if (i === 0 || front !== wasFront) path.moveTo(px, py); else path.lineTo(px, py);
          wasFront = front;
        }
        back.moveTo(x, y - r * 2); back.lineTo(x, y + h + r * 3);
        return y + h;
      }

      // Up the lift, then along the top to where the run begins.
      const liftD = (bot - top) / vl;
      segs.push({ d: liftD, at: (u) => [lx, bot + (top - bot) * u] });
      track.moveTo(lx - r * 1.4, top - r * 0.5); track.lineTo(lx - r * 1.4, bot + r * 1.2);
      track.moveTo(lx + r * 1.4, top - r * 0.5); track.lineTo(lx + r * 1.4, bot + r * 1.2);
      for (const py of [top, bot]) { track.moveTo(lx + r * 1.4, py + r); track.arc(lx, py + r, r * 1.4, 0, TAU); }
      let y = top + r * 2;
      let x = side > 0 ? b : a;
      ramp(lx, top, x, y);
      if (L === 2) {
        // The corkscrew's top is under the end of the top rail.
        const rad = clamp(span * 0.32, r * 3, r * 9), cx = x - side * rad;
        const turns = clamp(Math.round((bot - top) * 0.45 / (r * 6)), 2, 6);
        y = screw(cx, y, rad, turns);
        ramp(x, y, x - side * r * 2, y + r); y += r;
        x -= side * r * 2;
      }
      // Ramps back and forth to the bottom; the last one runs to the lift's foot.
      const room = bot - y - r * 2;
      const big = L === 1;
      let n = Math.max(2, Math.round(room / (big ? r * 18 : r * 9)));
      if (n % 2) n++;
      const h = room / n, rf = clamp(span * 0.16, r * 3, r * 7);
      let dir = -side;
      for (let i = 0; i < n; i++) {
        const last = i === n - 1;
        const fall = big && !last ? Math.min(h * 0.5, rf * 1.1 + r * 3.5) : h * 0.5;
        // A funnel's middle sits a rim's width in from the edge; the ramp ends at its rim.
        const fx = dir > 0 ? b - rf : a + rf;
        const ex = last ? lx : big ? fx - dir * (rf - r) : dir > 0 ? b : a;
        const ey = last ? bot : y + h - fall;
        ramp(x, y, ex, ey);
        if (last) break;
        if (big) {
          // Over the rim into the funnel; out of the neck onto the next ramp.
          const ny = funnel(fx, ey, rf, -dir);
          drop(fx, ey + rf * 1.1 + r * 0.2, ny + r * 0.5);
          y = ny + r * 0.5;
          x = fx; dir = -dir;
          continue;
        } else {
          drop(ex, ey, ey + fall);
          y = ey + fall;
          // A stop at the end of the ramp turns the marble down.
          track.moveTo(ex + dir * r * 1.3, ey - r); track.lineTo(ex + dir * r * 1.3, ey + r * 1.2);
        }
        x = ex; dir = -dir;
      }
      const ends = new Float32Array(segs.length);
      let T = 0;
      segs.forEach((g, i) => { T += g.d; ends[i] = T; });
      // Slots round the loop, a cup apiece on the lift, two and a bit marbles apart.
      const M = Math.max(4, Math.floor(T / (r * 4.5 / vl)));
      const count = Math.min(M, clamp(Math.round(M * 0.6), 4, 16));
      const marbles = [];
      for (let i = 0; i < count; i++) marbles.push({ slot: Math.floor(i * M / count), c: tint[(k * 17 + i) % tint.length] });
      return { segs, ends, T, M, lift: [lx, top, bot, 0], track, back, marbles };
    }

    /** Where a marble is, `tau` seconds into its run's loop. @param {Run} run @param {number} tau @returns {[number, number]} */
    function where(run, tau) {
      let i = 0;
      while (i < run.ends.length - 1 && run.ends[i] < tau) i++;
      const t0 = i ? run.ends[i - 1] : 0, g = run.segs[i];
      return g.at(clamp((tau - t0) / g.d, 0, 1));
    }

    return {
      lay() {
        const k = `${s.W}x${s.H}`;
        if (k === key) return;
        key = k;
        r = clamp(Math.min(s.W, s.H) * 0.013, 5, 11);
        const n = clamp(Math.round(s.W / clamp(Math.min(s.W, s.H) * 0.55, 200, 460)), 1, 5);
        const w = s.W / n;
        runs = [];
        for (let i = 0; i < n; i++) runs.push(build(w * i, w * (i + 1), i % 2 ? -1 : 1, i));
      },
      step() {},
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = s.ink;
        ctx.lineWidth = 1.5;
        const cups = new Path2D();
        for (const run of runs) {
          ctx.globalAlpha = s.dark ? 0.16 : 0.2; ctx.stroke(run.back);
          ctx.globalAlpha = s.dark ? 0.38 : 0.45; ctx.stroke(run.track);
          // The lift's cups, one per slot, wherever a slot is on the lift.
          const [lx, top, bot] = run.lift, up = run.ends[0], d = run.T / run.M;
          for (let j = 0; j < run.M; j++) {
            const tau = (s.t + j * d) % run.T;
            if (tau > up) continue;
            const y = bot + (top - bot) * tau / up + r;
            cups.moveTo(lx - r * 1.4, y - r * 0.8); cups.lineTo(lx - r * 1.1, y); cups.lineTo(lx + r * 1.1, y); cups.lineTo(lx + r * 1.4, y - r * 0.8);
          }
        }
        ctx.globalAlpha = s.dark ? 0.42 : 0.5; ctx.lineWidth = 2; ctx.stroke(cups);
        ctx.globalAlpha = s.dark ? 0.6 : 0.58;
        for (const run of runs) {
          const d = run.T / run.M;
          for (const m of run.marbles) {
            const [x, y] = where(run, (s.t + m.slot * d) % run.T);
            ctx.drawImage(sprites[m.c], x - r, y - r, r * 2, r * 2);
          }
        }
      },
    };
  });
}

/** A glass marble in `color` with a swirl and a highlight, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function marble(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.beginPath(); g.arc(24, 24, 22, 0, TAU); g.fill();
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createRadialGradient(18, 16, 2, 24, 24, 26);
  sh.addColorStop(0, 'rgba(255,255,255,.35)');
  sh.addColorStop(0.6, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = sh; g.fillRect(0, 0, 48, 48);
  g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(10, 30); g.bezierCurveTo(18, 18, 28, 36, 38, 22); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.beginPath(); g.arc(16, 14, 4, 0, TAU); g.fill();
  return c;
}
