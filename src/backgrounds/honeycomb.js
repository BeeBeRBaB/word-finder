// Honeycomb: a faint grid of hexagons that pulses of colour ripple outward through, cell by cell,
// in hexagonal rings. The seed picks the variant: drops landing at random and spreading out
// fading, beacons at fixed cells sending rings out in turn that lift the cells they pass and
// brighten where they cross, or bees hopping cell to cell, leaving honey that slowly drains.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{q:number, r:number, t0:number, v:number, reach:number, c:number, a:number}} Pulse
 * A ring spreading from axial cell q, r since time t0 at v cells a second, gone at `reach`. */
/** @typedef {{i:number, from:number, u:number, hop:number, c:number, n:number}} Bee
 * A bee on cell i (coming from cell `from`, u of the way there), hopping every `hop` s. */

const BAND = 1.25;   // a ring's half-width in cells: a cell takes about a second to light

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    let R = 24, cols = 0, rows = 0, n = 0, next = 0;
    let now = 0;   // the pulses' clock, which warm-up runs ahead
    // Per cell: centre, axial coordinates, light and its colour, honey and its colour.
    let cx = new Float32Array(0), cy = cx, aq = new Int16Array(0), ar = aq;
    let lit = new Float32Array(0), hon = lit, col = new Uint8Array(0), hcol = col;
    /** @type {Pulse[]} */
    let pulses = [];
    /** @type {Bee[]} */
    const bees = [];
    /** @type {{i:number, c:number, ph:number}[]} */
    let beacons = [];
    let outline = new Path2D();
    const hx = new Float32Array(6), hy = new Float32Array(6);
    const glow = sprite(s.colors[1 % nc]);

    /** Cell index at offset column, row, or -1 off the grid. @param {number} c @param {number} r @returns {number} */
    const at = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c);

    /** The six neighbours of cell i that are on the grid. @param {number} i @returns {number[]} */
    function around(i) {
      const r = Math.floor(i / cols), c = i % cols, o = r & 1;
      return [at(c - 1, r), at(c + 1, r), at(c - 1 + o, r - 1), at(c + o, r - 1), at(c - 1 + o, r + 1), at(c + o, r + 1)]
        .filter((j) => j >= 0);
    }

    /** A cell well inside the screen. @returns {number} */
    function inner() {
      const c = 1 + rng.int(Math.max(1, cols - 2)), r = 1 + rng.int(Math.max(1, rows - 2));
      return at(c, r);
    }

    /** @param {number} i @param {number} t0 @param {number} v @param {number} reach @param {number} c @param {number} a @returns {void} */
    function pulse(i, t0, v, reach, c, a) {
      pulses.push({ q: aq[i], r: ar[i], t0, v, reach, c, a });
    }

    /** Hops bee b on to a neighbour, not straight back, steering clear of the edges. @param {Bee} b @returns {void} */
    function hop(b) {
      const opts = around(b.i).filter((j) => j !== b.from);
      const near = opts.filter((j) => cx[j] > R && cx[j] < s.W - R && cy[j] > R && cy[j] < s.H - R);
      const pick = near.length ? near : opts;
      b.from = b.i;
      b.i = pick[rng.int(pick.length)];
      b.u = 0;
      if (++b.n % 6 === 0) pulse(b.i, now, 2, 4, b.c, 0.55);
    }

    /** Lights every cell from the pulses, the beacons and the honey. @returns {void} */
    function shade() {
      lit.fill(0);
      for (const p of pulses) {
        const f = (now - p.t0) * p.v;
        if (f < -BAND) continue;
        const fade = p.a * (1 - f / p.reach);
        for (let i = 0; i < n; i++) {
          const dq = aq[i] - p.q, dr = ar[i] - p.r;
          const d = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
          const x = (d - f) / BAND;
          if (x < -1 || x > 1) continue;
          const v = fade * (0.5 + 0.5 * Math.cos(x * Math.PI));
          if (layout === 1) {
            // Crossing rings add up; the colour is the brighter one's.
            if (v > lit[i] * 0.6) col[i] = p.c;
            lit[i] = Math.min(1, lit[i] + v);
          } else if (v > lit[i]) { lit[i] = v; col[i] = p.c; }
        }
      }
      for (const b of beacons) {
        const v = 0.55 + 0.25 * Math.sin(now * 0.8 + b.ph);
        if (v > lit[b.i]) { lit[b.i] = v; col[b.i] = b.c; }
      }
    }

    /** Six corners of the hexagon round x, y at radius r, into hx, hy. @param {number} x @param {number} y @param {number} r @returns {void} */
    function corners(x, y, r) {
      for (let k = 0; k < 6; k++) {
        const a = (k + 0.5) * Math.PI / 3;
        hx[k] = x + Math.cos(a) * r; hy[k] = y + Math.sin(a) * r;
      }
    }

    /** @param {number} x @param {number} y @param {number} r @returns {void} */
    function hexPath(x, y, r) {
      const { ctx } = s;
      corners(x, y, r);
      ctx.beginPath();
      ctx.moveTo(hx[0], hy[0]);
      for (let k = 1; k < 6; k++) ctx.lineTo(hx[k], hy[k]);
      ctx.closePath();
    }

    /** Starts this variant's sources on a fresh grid, already running. @returns {void} */
    function seed() {
      pulses = [];
      beacons = [];
      bees.length = 0;
      if (layout === 0) {
        // A drop every ~1.7s; seed the last ten seconds' worth so the first frame is full.
        for (let t = -10; t < 0; t += 1.7) pulse(inner(), now + t + rng.random(), 1.4, 10 + rng.random() * 5, rng.int(nc), 0.85);
        next = now + 1;
      } else if (layout === 1) {
        const k = clamp(Math.round(s.W * s.H / 260000), 2, 4);
        for (let j = 0; j < k; j++) {
          // Spread round the host: a ring of beacon spots, jittered.
          const a = j / k * TAU + rng.random() * 0.8;
          const c = Math.round(cols / 2 + Math.cos(a) * cols * 0.3), r = Math.round(rows / 2 + Math.sin(a) * rows * 0.3);
          beacons.push({ i: Math.max(0, at(clamp(c, 0, cols - 1), clamp(r, 0, rows - 1))), c: (j * 2 + rng.int(nc)) % nc, ph: rng.random() * TAU });
        }
        // Each beacon sends a ring every 7s, the beacons in turn.
        next = now;
        for (let t = -14; t < 0; t += 7) {
          beacons.forEach((b, j) => pulse(b.i, now + t + j * 7 / beacons.length, 1.5, Math.max(cols, rows) * 0.65, b.c, 0.6));
        }
      } else {
        const k = clamp(Math.round(s.W * s.H / 200000), 2, 6);
        for (let j = 0; j < k; j++) {
          bees.push({ i: inner(), from: -1, u: 1, hop: 0.55 + rng.random() * 0.3, c: (j + rng.int(nc)) % nc, n: rng.int(6) });
        }
        // Fly a while, so honey and a ripple are already down.
        for (let j = 0; j < 160; j++) tick(0.1);
      }
    }

    /** Advances the sources by dt. @param {number} dt @returns {void} */
    function tick(dt) {
      now += dt;
      pulses = pulses.filter((p) => (now - p.t0) * p.v < p.reach + BAND);
      if (layout === 0 && now >= next) {
        pulse(inner(), now, 1.4, 10 + rng.random() * 5, rng.int(nc), 0.85);
        next = now + 1.4 + rng.random() * 0.8;
      } else if (layout === 1 && now >= next) {
        next = now + 7 / beacons.length;
        const b = beacons[Math.floor(now / (7 / beacons.length)) % beacons.length];
        pulse(b.i, now, 1.5, Math.max(cols, rows) * 0.65, b.c, 0.6);
      } else if (layout === 2) {
        for (let i = 0; i < n; i++) hon[i] = Math.max(0, hon[i] - dt / 14);
        for (const b of bees) {
          b.u += dt / b.hop;
          if (b.u >= 1) {
            hon[b.i] = 1; hcol[b.i] = b.c;
            hop(b);
          }
        }
      }
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        const r = clamp(m / 17, 18, 44);
        const c = Math.ceil(s.W / (r * Math.sqrt(3))) + 2, rw = Math.ceil(s.H / (r * 1.5)) + 2;
        if (r === R && c === cols && rw === rows && n) return;
        R = r; cols = c; rows = rw; n = cols * rows;
        cx = new Float32Array(n); cy = new Float32Array(n); aq = new Int16Array(n); ar = new Int16Array(n);
        lit = new Float32Array(n); hon = new Float32Array(n); col = new Uint8Array(n); hcol = new Uint8Array(n);
        const w = R * Math.sqrt(3);
        outline = new Path2D();
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            cx[i] = (x - 0.5 + (y & 1) * 0.5) * w; cy[i] = (y - 0.5) * R * 1.5;
            aq[i] = x - (y - (y & 1)) / 2; ar[i] = y;
            corners(cx[i], cy[i], R * 0.92);
            outline.moveTo(hx[0], hy[0]);
            for (let k = 1; k < 6; k++) outline.lineTo(hx[k], hy[k]);
            outline.closePath();
          }
        }
        seed();
        shade();
      },
      step(dt) {
        tick(dt);
        shade();
      },
      draw() {
        const { ctx } = s;
        ctx.globalAlpha = s.dark ? 0.13 : 0.17;
        ctx.strokeStyle = s.ink;
        ctx.lineWidth = Math.max(1.5, R * 0.06);
        ctx.stroke(outline);
        const fa = s.dark ? 0.42 : 0.46;
        for (let i = 0; i < n; i++) {
          const h = layout === 2 ? hon[i] : 0, v = lit[i];
          if (h > 0.01) {
            // Honey: a cell fading and shrinking as it drains.
            const e = h * h * (3 - 2 * h);
            ctx.fillStyle = s.colors[hcol[i]];
            ctx.globalAlpha = fa * 0.85 * e;
            hexPath(cx[i], cy[i], R * (0.55 + 0.33 * e));
            ctx.fill();
          }
          if (v < 0.01) continue;
          const sc = layout === 1 ? 0.8 + 0.14 * v : 0.88;
          ctx.fillStyle = s.colors[col[i]];
          ctx.globalAlpha = fa * v;
          hexPath(cx[i], cy[i], R * sc);
          ctx.fill();
          // A rim brighter than the fill, so a lit cell reads as lit glass, not a blot.
          ctx.strokeStyle = s.colors[col[i]];
          ctx.globalAlpha = Math.min(1, fa * v * 1.4);
          ctx.stroke();
        }
        for (const b of bees) {
          // Glide from the last cell to this one, easing in and out.
          const u = Math.min(1, b.u), e = u * u * (3 - 2 * u);
          const f = b.from < 0 ? b.i : b.from;
          const x = cx[f] + (cx[b.i] - cx[f]) * e, y = cy[f] + (cy[b.i] - cy[f]) * e - Math.sin(u * Math.PI) * R * 0.35;
          const d = R * 0.9;
          if (s.dark) ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = s.dark ? 0.45 : 0.35;
          ctx.drawImage(glow, x - d, y - d, d * 2, d * 2);
          ctx.globalCompositeOperation = 'source-over';
          // The bee: two pale wings over a body pointing the way it flies.
          const a = Math.atan2(cy[b.i] - cy[f], cx[b.i] - cx[f]);
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = s.ink;
          ctx.beginPath();
          ctx.ellipse(x - Math.sin(a) * R * 0.12, y + Math.cos(a) * R * 0.12 - R * 0.12, R * 0.16, R * 0.09, a + 0.9, 0, TAU);
          ctx.ellipse(x + Math.sin(a) * R * 0.12, y - Math.cos(a) * R * 0.12 - R * 0.12, R * 0.16, R * 0.09, a - 0.9, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 0.62;
          ctx.fillStyle = s.colors[b.c];
          ctx.beginPath();
          ctx.ellipse(x, y, R * 0.26, R * 0.15, a, 0, TAU);
          ctx.fill();
        }
      },
    };
  });
}

/** A soft round glow as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function sprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,.9)');
  grad.addColorStop(0.4, 'rgba(0,0,0,.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
