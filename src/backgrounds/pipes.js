// Pipes: shaded 3D pipes grow through a hidden lattice a cell at a time, running straight or
// turning at right angles, each a new colour, until the space is busy and it clears for more.
// The seed picks the variant: the classic view into a box in perspective, a ball joint at every
// turn; an isometric run of plumbing with smooth bent elbows; or a deep tunnel where the pipes
// never clear at once but the old ones slowly fade behind the new.

import { stage, clamp } from './stage.js';

/** @typedef {{c:number, a:number, b:number, next:number, u:number, len:number, max:number, turn:boolean, first:boolean, end:boolean}} Pipe
 * A growing pipe: its leg runs from the middle of a..b, through b, to the middle of b..next
 * (only to b on its last leg, from a itself on its first); u 0..1 along it. */

const D6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const iso = layout === 1, tunnel = layout === 2, balls = !iso;
    const RATE = iso ? 2.6 : 2.3; // legs a second
    const PIPES = tunnel ? 4 : iso ? 3 : 2;
    let NX = 0, NY = 0, NZ = 0, g = 60, clock = 0, fading = -1, since = 0, used = 0, valid = 0;
    /** Per cell: screen x, y and pipe radius, 0 radius off screen. @type {Float32Array} */
    let px = new Float32Array(0), py = new Float32Array(0), pr = new Float32Array(0);
    /** Per cell: fog alpha toward the back. @type {Float32Array} */
    let fog = new Float32Array(0);
    /** Per cell: when a pipe took it, -1 while free. @type {Float32Array} */
    let taken = new Float32Array(0);
    /** @type {Pipe[]} */
    let pipes = [];
    let hue = rng.int(nc);
    /** Settled pipes, at device pixels. @type {HTMLCanvasElement} */
    const cache = document.createElement('canvas');
    const cx = /** @type {CanvasRenderingContext2D} */ (cache.getContext('2d'));
    const FOGS = 6;
    const rgb = s.colors.map(rgbOf);
    const far = s.dark ? [0, 0, 0] : [255, 255, 255];
    /** Opaque body, shadow and highlight colours per colour and fog level, so pieces that
     * overlap never build up. @type {string[][][]} */
    const shades = rgb.map((c) => Array.from({ length: FOGS }, (_, f) => {
      const k = f / (FOGS - 1) * (s.dark ? 0.5 : 0.5);
      const base = c.map((v, i) => v + (far[i] - v) * k);
      return [base, base.map((v) => v * 0.68), base.map((v) => v + (255 - v) * 0.45)]
        .map((m) => `rgb(${m.map((v) => Math.round(v)).join(',')})`);
    }));
    /** @type {HTMLCanvasElement[][]} */
    const spheres = shades.map((c) => c.map((sh) => sphere(sh[0])));
    /** @param {number} f 1 front .. 0 back @returns {number} */
    const level = (f) => clamp(Math.round((1 - f) * (FOGS - 1)), 0, FOGS - 1);

    /** @param {number} i @param {number} j @param {number} k */
    const at = (i, j, k) => (k * NY + j) * NX + i;

    /** The neighbour of cell `c` along direction `d`, or -1. @param {number} c @param {number} d */
    function step6(c, d) {
      const i = c % NX + D6[d][0], j = Math.floor(c / NX) % NY + D6[d][1], k = Math.floor(c / (NX * NY)) + D6[d][2];
      if (i < 0 || j < 0 || k < 0 || i >= NX || j >= NY || k >= NZ) return -1;
      const n = at(i, j, k);
      return pr[n] > 0 ? n : -1;
    }

    /** @param {number} c */
    const free = (c) => c >= 0 && taken[c] < 0;

    /** @param {number} c */
    function take(c) { taken[c] = clock; used++; }

    /** Starts a pipe on a free cell. @returns {Pipe|null} */
    function spawn() {
      for (let k = 0; k < 60; k++) {
        const a = rng.int(NX * NY * NZ);
        if (!free(a) || pr[a] <= 0) continue;
        const ds = rng.shuffle([0, 1, 2, 3, 4, 5]);
        const d = ds.find((e) => free(step6(a, e)));
        if (d === undefined) continue;
        const b = step6(a, d);
        take(a); take(b);
        hue = (hue + 1 + rng.int(Math.max(1, nc - 1))) % nc;
        // Start ball (or flange) at the first cell.
        drawBall(a, hue, balls ? 1.45 : 1.25);
        return { c: hue, a, b, next: -1, u: 0, len: 0, max: 14 + rng.int(36), turn: false, first: true, end: false };
      }
      return null;
    }

    /** Chooses the cell after `p.b`: on ahead mostly, else a free turn. @param {Pipe} p */
    function choose(p) {
      const dir = dirOf(p.a, p.b);
      const ahead = step6(p.b, dir);
      /** @type {number[]} */
      const turns = [];
      for (let d = 0; d < 6; d++) if ((d >> 1) !== (dir >> 1) && free(step6(p.b, d))) turns.push(d);
      let n = -1;
      if (free(ahead) && (rng.random() < 0.7 || !turns.length)) n = ahead;
      else if (turns.length) n = step6(p.b, turns[rng.int(turns.length)]);
      if (p.len >= p.max) n = -1;
      p.next = n;
      p.turn = n >= 0 && n !== ahead;
      p.end = n < 0;
      if (n >= 0) take(n);
    }

    /** @param {number} a @param {number} b @returns {number} the direction from cell a to its neighbour b */
    function dirOf(a, b) {
      for (let d = 0; d < 6; d++) if (step6(a, d) === b) return d;
      return 0;
    }

    /** A point on `p`'s leg at u: [x, y, radius, fog]. @param {Pipe} p @param {number} u @returns {number[]} */
    function leg(p, u) {
      const { a, b } = p;
      // Start and end of the leg: middles of the cell pairs, or the cells themselves at the ends.
      const s0 = p.first ? 1 : 0.5;
      const ax = px[a] + (px[b] - px[a]) * (1 - s0), ay = py[a] + (py[b] - py[a]) * (1 - s0);
      const ar = pr[a] + (pr[b] - pr[a]) * (1 - s0), af = fog[a] + (fog[b] - fog[a]) * (1 - s0);
      const n = p.end ? b : p.next;
      const e0 = p.end ? 0 : 0.5;
      const ex = px[b] + (px[n] - px[b]) * e0, ey = py[b] + (py[n] - py[b]) * e0;
      const er = pr[b] + (pr[n] - pr[b]) * e0, ef = fog[b] + (fog[n] - fog[b]) * e0;
      if (!iso || !p.turn) {
        // Straight through b: a polyline, so ball joints sit on a sharp corner.
        const w = s0 / (s0 + e0 || 1);
        if (u <= w) { const v = w ? u / w : 1; return [ax + (px[b] - ax) * v, ay + (py[b] - ay) * v, ar + (pr[b] - ar) * v, af + (fog[b] - af) * v]; }
        const v = (u - w) / (1 - w || 1);
        return [px[b] + (ex - px[b]) * v, py[b] + (ey - py[b]) * v, pr[b] + (er - pr[b]) * v, fog[b] + (ef - fog[b]) * v];
      }
      // An elbow: a quadratic bend with b as its control point.
      const m = 1 - u, k0 = m * m, k1 = 2 * m * u, k2 = u * u;
      return [k0 * ax + k1 * px[b] + k2 * ex, k0 * ay + k1 * py[b] + k2 * ey, k0 * ar + k1 * pr[b] + k2 * er, k0 * af + k1 * fog[b] + k2 * ef];
    }

    /** One shaded piece of tube on the cache. @param {number[]} p @param {number[]} q @param {number} c */
    function tube(p, q, c) {
      let dx = q[0] - p[0], dy = q[1] - p[1];
      const len = Math.hypot(dx, dy);
      if (len < 0.01) return;
      dx /= len; dy /= len;
      const r = (p[2] + q[2]) / 2;
      // Back the start up a touch so pieces round a bend leave no seams, the shading further
      // than the body so it covers the body's soft edge where the last piece met this one.
      const b0 = Math.min(r * 0.12, 1.5), b1 = b0 * 2.2;
      const bx = p[0] - dx * b0, by = p[1] - dy * b0, sx = p[0] - dx * b1, sy = p[1] - dy * b1;
      // The normal on the side away from the light (upper left).
      let nx = -dy, ny = dx;
      if (nx + ny < 0) { nx = -nx; ny = -ny; }
      const sh = shades[c][level((p[3] + q[3]) / 2)];
      cx.lineCap = 'butt';
      cx.strokeStyle = sh[0];
      cx.lineWidth = r * 2;
      line(bx, by, q[0], q[1], 0, 0);
      cx.strokeStyle = sh[1];
      cx.lineWidth = r * 0.7;
      line(sx, sy, q[0], q[1], nx * r * 0.6, ny * r * 0.6);
      cx.strokeStyle = sh[2];
      cx.lineWidth = r * 0.4;
      line(sx, sy, q[0], q[1], -nx * r * 0.36, -ny * r * 0.36);
    }

    /** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {number} ox @param {number} oy */
    function line(x0, y0, x1, y1, ox, oy) {
      cx.beginPath(); cx.moveTo(x0 + ox, y0 + oy); cx.lineTo(x1 + ox, y1 + oy); cx.stroke();
    }

    /** A ball on cell `c`. @param {number} c @param {number} hueIx @param {number} k radius over the pipe's */
    function drawBall(c, hueIx, k) {
      const r = pr[c] * k;
      cx.drawImage(spheres[hueIx][level(fog[c])], px[c] - r, py[c] - r, r * 2, r * 2);
    }

    /** Grows every pipe by dt, drawing what it adds onto the cache. @param {number} dt */
    function grow(dt) {
      clock += dt;
      for (let n = 0; n < pipes.length; n++) {
        const p = pipes[n];
        let left = dt * RATE;
        while (left > 0) {
          if (p.next < 0 && !p.end) choose(p);
          const u0 = p.u, u1 = Math.min(1, u0 + left);
          left -= u1 - u0;
          // Short pieces round a bend; straight runs in one.
          const parts = iso && p.turn ? Math.max(1, Math.ceil((u1 - u0) / 0.08)) : 1;
          let q = leg(p, u0);
          for (let k = 1; k <= parts; k++) {
            const r = leg(p, u0 + (u1 - u0) * k / parts);
            tube(q, r, p.c);
            q = r;
          }
          p.u = u1;
          // A ball at a turn, redrawn over the outgoing pipe while it is still inside it.
          if (balls && p.turn && u1 > 0.4) drawBall(p.b, p.c, 1.5);
          if (p.u < 1) break;
          if (p.end) {
            drawBall(p.b, p.c, balls ? 1.45 : 1.25);
            const fresh = spawn();
            if (fresh) pipes[n] = fresh; else pipes.splice(n--, 1);
            break;
          }
          p.a = p.b; p.b = p.next; p.next = -1; p.u = 0; p.len++; p.first = false; p.turn = false;
        }
      }
      while (pipes.length < PIPES) {
        const p = spawn();
        if (!p) break;
        pipes.push(p);
      }
    }

    /** Clears the lattice and cache for a fresh start. */
    function reset() {
      taken.fill(-1);
      used = 0;
      pipes = [];
      fading = -1;
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.clearRect(0, 0, cache.width, cache.height);
      cx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    }

    /** Tunnel: the cache dims a step, and cells long faded free up again. */
    function dim() {
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.globalCompositeOperation = 'destination-out';
      cx.globalAlpha = 0.035;
      cx.fillRect(0, 0, cache.width, cache.height);
      cx.globalCompositeOperation = 'source-over';
      cx.globalAlpha = 1;
      cx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      for (let c = 0; c < taken.length; c++) if (taken[c] >= 0 && clock - taken[c] > 45) { taken[c] = -1; used--; }
    }

    /** @param {number} dt */
    function advance(dt) {
      if (fading >= 0) {
        fading += dt;
        if (fading > 2.5) reset();
        return;
      }
      grow(dt);
      if (tunnel) {
        since += dt;
        if (since > 0.5) { since -= 0.5; dim(); }
      } else if (used > valid * (iso ? 0.3 : 0.26)) fading = 0;
    }

    /** Builds the lattice for this size and starts over, part grown. */
    function build() {
      const m = Math.min(s.W, s.H);
      if (iso) {
        g = clamp(m / 8.5, 38, 92);
        NY = 4;
        const c30 = Math.cos(Math.PI / 6);
        // i - k spans the width, i + k the height; one square of both covers the host.
        NX = NZ = Math.ceil(s.W / (2 * g * c30) + (s.H + NY * g) / g) + 2;
      } else {
        g = clamp(m / 7.2, 46, 124);
        NX = Math.ceil(s.W / g) + 1; NY = Math.ceil(s.H / g) + 1; NZ = tunnel ? 9 : 6;
      }
      const n = NX * NY * NZ;
      px = new Float32Array(n); py = new Float32Array(n); pr = new Float32Array(n); fog = new Float32Array(n);
      taken = new Float32Array(n);
      valid = 0;
      const kz = (tunnel ? 2.6 : 1.4) / (NZ - 1);
      for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const c = at(i, j, k);
        let x, y, sc;
        if (iso) {
          const c30 = Math.cos(Math.PI / 6);
          x = s.W / 2 + (i - k) * g * c30;
          y = (i + k) * g * 0.5 - j * g - NX * g * 0.5 + s.H / 2 + NY * g * 0.5;
          sc = 1;
        } else {
          sc = 1 / (1 + k * kz);
          x = s.W / 2 + (i - (NX - 1) / 2) * g * sc;
          y = s.H / 2 + (j - (NY - 1) / 2) * g * sc;
        }
        px[c] = x; py[c] = y;
        const on = x > -g * 0.2 && x < s.W + g * 0.2 && y > -g * 0.2 && y < s.H + g * 0.2;
        pr[c] = on ? g * (iso ? 0.17 : 0.19) * sc : 0;
        fog[c] = iso ? 1 : 1 - k / (NZ - 1);
        if (on) valid++;
      }
      cache.width = s.cv.width; cache.height = s.cv.height;
      reset();
      // Grow a while at once, so the first (or only) frame already has pipes.
      for (let i = 0; i < (tunnel ? 300 : 170); i++) advance(1 / 15);
      if (fading >= 0) { reset(); for (let i = 0; i < 90; i++) advance(1 / 15); }
    }

    return {
      lay: build,
      step: advance,
      draw() {
        const { ctx } = s;
        let a = s.dark ? 0.5 : 0.48;
        if (fading >= 0) a *= clamp(1 - fading / 2.2, 0, 1);
        if (a <= 0) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = a;
        ctx.drawImage(cache, 0, 0);
      },
    };
  });
}

/** A shaded ball in `color`, lit from the upper left, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function sphere(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.beginPath(); g.arc(32, 32, 31, 0, Math.PI * 2); g.fill();
  const shade = g.createRadialGradient(24, 22, 2, 32, 32, 32);
  shade.addColorStop(0, 'rgba(255,255,255,.55)');
  shade.addColorStop(0.25, 'rgba(255,255,255,.12)');
  shade.addColorStop(0.7, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = shade;
  g.beginPath(); g.arc(32, 32, 31, 0, Math.PI * 2); g.fill();
  return c;
}

/** A CSS colour as [r, g, b]. @param {string} color @returns {number[]} */
function rgbOf(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = '#888';
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = v.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
