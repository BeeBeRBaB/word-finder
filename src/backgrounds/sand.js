// Falling sand: a coarse grid of grains, each falling straight down or sliding off diagonally,
// so streams pour from spouts and settle into 45-degree piles. The seed picks the variant:
// spouts sweeping slowly along the top lay down coloured strata until the floor turns to a
// sieve and the piles sink away; fixed spouts pour onto slanting shelves that fill, spill over their
// low ends and cascade to the floor; or a row of hourglasses that run through their necks, then
// empty out below while a spout refills the top.

import { stage, clamp } from './stage.js';

const WALL = 255;
const SHADES = 8;

/** @typedef {{x:number, w:number, ph:number, k:number}} Spout  x in cells (or sweep centre), w sweep rate */
/** @typedef {{cx:number, t0:number, b0:number, mid:number, wb:number, n0:number, hw:Int16Array,
 *   run:boolean, k:number, full:number, tm:number}} Glass  rows t0..b0 inside, hw the half width per row */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const off = document.createElement('canvas');
    const g = /** @type {CanvasRenderingContext2D} */ (off.getContext('2d'));
    let cs = 5, gw = 0, gh = 0, ox = 0, oy = 0, frame = 0, seedBits = (s.seed * 2654435761) >>> 0 || 1;
    let grid = new Uint8Array(0), sink = new Uint8Array(0);
    /** @type {ImageData|null} */
    let img = null;
    let px = new Uint32Array(0);
    /** @type {Spout[]} */
    let spouts = [];
    /** @type {Glass[]} */
    let glasses = [];
    let draining = false, clock = 0, grains = 0, lastGrains = 0, quietFor = 0;

    // Packed RGBA per cell value: grains by colour and shade, walls in ink, empty clear.
    const lut = new Uint32Array(256);
    const le = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
    /** @param {number[]} c @param {number} a 0..1 @returns {number} */
    const pack = (c, a) => {
      const [r, gg, b] = c.map((v) => clamp(Math.round(v), 0, 255)), A = Math.round(a * 255);
      return le ? ((A << 24) | (b << 16) | (gg << 8) | r) >>> 0 : ((r << 24) | (gg << 16) | (b << 8) | A) >>> 0;
    };
    const rgbs = s.colors.map(rgbOf);
    for (let k = 0; k < nc && k < 30; k++) {
      for (let j = 0; j < SHADES; j++) {
        const f = 0.8 + 0.06 * j;
        lut[1 + k * SHADES + j] = pack(rgbs[k].map((v) => v * f), s.dark ? 0.44 : 0.42);
      }
    }
    lut[WALL] = pack(rgbOf(s.ink), s.dark ? 0.3 : 0.32);

    /** A cheap random bit stream for the grain rule. @returns {number} */
    const bit = () => { seedBits ^= seedBits << 13; seedBits ^= seedBits >>> 17; seedBits ^= seedBits << 5; return seedBits & 1; };

    /** A grain of colour k. @param {number} k @returns {number} */
    const grain = (k) => 1 + (k % nc) * SHADES + rng.int(SHADES);

    /** Drops grains in a two-wide stream at column x of row 0. @param {number} x @param {number} k @returns {void} */
    function pour(x, k) {
      for (let i = 0; i < 2; i++) {
        const c = Math.round(x) + i;
        if (c >= 0 && c < gw && grid[c] === 0) grid[c] = grain(k);
      }
    }

    /** One step of the grain rule, bottom row up. @returns {void} */
    function update() {
      frame++;
      let n = 0;
      for (let y = gh - 2; y >= 0; y--) {
        const row = y * gw, below = row + gw, right = (y + frame) & 1;
        for (let i = 0; i < gw; i++) {
          const x = right ? i : gw - 1 - i, v = grid[row + x];
          if (v === 0 || v === WALL) continue;
          n++;
          if (grid[below + x] === 0) { grid[below + x] = v; grid[row + x] = 0; continue; }
          // Slide down a diagonal, only through a gap a grain fits (the side is clear too).
          const a = bit() ? 1 : -1;
          let nx = x + a;
          if (nx < 0 || nx >= gw || grid[below + nx] !== 0 || grid[row + nx] !== 0) {
            nx = x - a;
            if (nx < 0 || nx >= gw || grid[below + nx] !== 0 || grid[row + nx] !== 0) continue;
          }
          grid[below + nx] = v; grid[row + x] = 0;
        }
      }
      // The floor: grains leave through the columns that sink.
      const last = (gh - 1) * gw;
      for (let x = 0; x < gw; x++) {
        const v = grid[last + x];
        if (v === 0 || v === WALL) continue;
        // A sieve floor lets some grains through each step, so piles sink keeping their shape.
        if (sink[x] === 2 || (sink[x] && bit() && bit())) grid[last + x] = 0; else n++;
      }
      grains = n;
    }

    /** Marks a wall cell. @param {number} x @param {number} y @returns {void} */
    function wall(x, y) {
      if (x >= 0 && y >= 0 && x < gw && y < gh) grid[y * gw + x] = WALL;
    }

    /** Fills empty cells of column x from row `from` up, `h` cells, in strata.
     * @param {number} x @param {number} from @param {number} h @param {number} band @param {number} ph @returns {void} */
    function heap(x, from, h, band, ph) {
      for (let j = 0; j < h; j++) {
        const y = from - j;
        if (y < 0) break;
        const p = y * gw + x;
        if (grid[p] === 0) grid[p] = grain(Math.floor(j / band + ph));
      }
    }

    /** Sets the hourglass gates: the neck open while it runs, the caps while it refills.
     * @param {Glass} q @returns {void} */
    function gates(q) {
      for (let i = -q.n0; i < q.n0; i++) {
        grid[q.mid * gw + q.cx + i] = q.run ? 0 : WALL;
      }
      for (let i = -2; i < 2; i++) grid[(q.t0 - 1) * gw + q.cx + i] = q.run ? WALL : 0;
      // The bottom is a trapdoor: it drops the whole bulb's sand out at once.
      const h = q.hw[q.b0 - q.t0];
      for (let x = q.cx - h - 2; x <= q.cx + h + 1; x++) grid[(q.b0 + 1) * gw + x] = q.run ? WALL : 0;
    }

    /** Whether any of the spout's grains are still on their way to the top of glass q.
     * @param {Glass} q @returns {boolean} */
    function falling(q) {
      for (let y = 0; y < q.t0; y++) {
        for (let x = q.cx - 3; x < q.cx + 3; x++) { const v = grid[y * gw + x]; if (v && v !== WALL) return true; }
      }
      return false;
    }

    /** Grains in rows a..b of a glass. @param {Glass} q @param {number} a @param {number} b @returns {number} */
    function count(q, a, b) {
      let n = 0;
      for (let y = a; y <= b; y++) {
        const h = q.hw[y - q.t0], row = y * gw;
        for (let x = q.cx - h; x < q.cx + h; x++) { const v = grid[row + x]; if (v && v !== WALL) n++; }
      }
      return n;
    }

    /** Builds walls, spouts and a settled first state for this size. @returns {void} */
    function build() {
      const was = { grid, gw, gh };
      cs = clamp(Math.round(Math.min(s.W, s.H) / 150), 3, 6);
      gw = Math.ceil(s.W / cs); gh = Math.ceil(s.H / cs);
      ox = (s.W - gw * cs) / 2; oy = s.H - gh * cs;
      grid = new Uint8Array(gw * gh); sink = new Uint8Array(gw);
      off.width = gw; off.height = gh;
      img = g.createImageData(gw, gh);
      px = new Uint32Array(img.data.buffer);
      draining = false; clock = 0; quietFor = 0;
      const band = Math.max(3, Math.round(gh / 28));
      if (layout === 2) {
        const nh = clamp(Math.round(s.W / (s.H * 0.62)), 1, 4), slot = gw / nh;
        sink.fill(2);
        glasses = [];
        for (let i = 0; i < nh; i++) {
          const t0 = Math.round(gh * 0.12), b0 = gh - Math.round(gh * 0.08), mid = Math.round((t0 + b0) / 2);
          const wb = Math.round(Math.min(slot * 0.38, (b0 - t0) * 0.3)), n0 = cs > 4 ? 2 : 3;
          const hw = new Int16Array(b0 - t0 + 1);
          // Walls steeper than 45 degrees by the neck, rounding out to upright: a pile's own slope
          // is 45, so then every grain lies above the neck and each bulb empties.
          for (let y = t0; y <= b0; y++) {
            const u = Math.min(1, Math.abs(y - mid) * 0.7 / (2 * (wb - n0)));
            hw[y - t0] = Math.round(n0 + (wb - n0) * (1 - (1 - u) * (1 - u)));
          }
          /** @type {Glass} */
          const q = { cx: Math.round(slot * (i + 0.5)), t0, b0, mid, wb, n0, hw, run: true, k: rng.int(nc), full: 0, tm: 0 };
          for (let y = t0; y <= b0; y++) {
            const h = hw[y - t0];
            for (let k = h; k <= h + 1; k++) { wall(q.cx - k - 1, y); wall(q.cx + k, y); }
          }
          for (let x = q.cx - hw[0] - 2; x <= q.cx + hw[0] + 1; x++) wall(x, t0 - 1);
          // Part run already: the top holds a share of the sand, the bottom the rest, in strata.
          const share = 0.25 + rng.random() * 0.5;
          for (let y = t0; y < mid; y++) q.full += 2 * hw[y - t0];
          for (let x = q.cx - wb; x < q.cx + wb; x++) {
            heap(x, mid - 1, Math.round((mid - t0) * share), band, q.k);
          }
          for (let x = q.cx - wb; x < q.cx + wb; x++) {
            const peak = Math.round((b0 - mid) * (1 - share) * 0.8);
            heap(x, b0, clamp(peak - Math.abs(x - q.cx) + Math.round(wb * 0.3), 0, b0 - mid), band, q.k + 2);
          }
          glasses.push(q);
        }
        // Clip what heap() put outside each glass, and redraw its walls.
        for (let y = 0; y < gh; y++) {
          for (let x = 0; x < gw; x++) {
            const p = y * gw + x;
            if (grid[p] === 0 || grid[p] === WALL) continue;
            const q = glasses.find((o) => y >= o.t0 && y <= o.b0 && x >= o.cx - o.hw[y - o.t0] && x < o.cx + o.hw[y - o.t0]);
            if (!q) grid[p] = 0;
          }
        }
        for (const q of glasses) gates(q);
      } else {
        // Shelves first, so the spouts can be set above them.
        spouts = [];
        if (layout === 1) {
          const m = clamp(Math.round(s.W * s.H / 220000), 2, 6);
          // One shelf to each band across, so none overlap.
          for (let i = 0; i < m; i++) {
            const band = gw / m, L = Math.round(band * (0.55 + rng.random() * 0.25)), side = rng.random() < 0.5 ? 1 : -1;
            const x0 = Math.round(band * i + (band - L) * rng.random());
            const y0 = Math.round(gh * (0.3 + rng.random() * 0.38));
            let py = y0;
            for (let j = 0; j <= L; j++) {
              const y = y0 + Math.round(j * 0.32);
              for (let yy = py; yy <= y; yy++) wall(side > 0 ? x0 + j : x0 + L - j, yy);
              py = y;
            }
            // The spout pours on the shelf's high end, which is x0 when it slopes down to the right.
            spouts.push({ x: side > 0 ? x0 + 3 : x0 + L - 4, w: 0, ph: 0, k: rng.int(nc) });
          }
        } else {
          const m = clamp(Math.round(s.W / 360), 2, 5);
          for (let i = 0; i < m; i++) spouts.push({ x: gw * (i + 0.5) / m, w: 0.05 + rng.random() * 0.05, ph: rng.random() * 6.28, k: i });
        }
        // Settled piles to start from: mounds under the spouts in strata, the old grains kept.
        const top = new Float32Array(gw);
        for (const sp of spouts) {
          const h = gh * (0.12 + rng.random() * 0.14), at = layout === 0 ? gw * (0.15 + rng.random() * 0.7) : sp.x;
          for (let x = 0; x < gw; x++) top[x] = Math.max(top[x], h - Math.abs(x - at) * 0.9);
        }
        for (let x = 0; x < gw; x++) heap(x, gh - 1, Math.round(top[x]), band, 0);
        if (was.gw && layout === 0) {
          // Keep what was there, set on the floor and centred.
          const dx = (was.gw - gw) >> 1;
          for (let y = 1; y <= Math.min(gh, was.gh); y++) {
            for (let x = 0; x < gw; x++) {
              const X = x + dx;
              if (X >= 0 && X < was.gw) grid[(gh - y) * gw + x] = was.grid[(was.gh - y) * was.gw + X];
            }
          }
        }
      }
    }

    /** Opens the floor into a sieve, or closes it. @param {boolean} open @returns {void} */
    function holes(open) {
      sink.fill(open ? 1 : 0);
    }

    /** One step: pour, run the gates and floor, then the grains. @param {number} dt @returns {void} */
    function step(dt) {
      clock += dt;
      if (layout === 2) {
        for (const q of glasses) {
          q.tm += dt;
          if (q.run) {
            if (count(q, q.t0, q.mid - 1) < 3 && q.tm > 3) { q.run = false; q.tm = 0; gates(q); }
          } else if (q.tm < 30 && count(q, q.t0, q.mid - 1) < q.full * 0.55) {
            // Refill from the spout, a new colour every few seconds for strata.
            if (frame % 70 === 0) q.k++;
            pour(q.cx - 1, q.k); pour(q.cx - 1, q.k);
          } else if (count(q, q.mid, q.b0) === 0 && !falling(q)) { q.run = true; q.tm = 0; gates(q); }
        }
      } else if (!draining) {
        for (const sp of spouts) {
          if (layout === 0) sp.x = gw * (0.5 + 0.46 * Math.sin(s.t * sp.w + sp.ph));
          // A new colour now and then, so the piles grow in strata.
          if (frame % 240 === 0) sp.k++;
          pour(sp.x - 1, sp.k);
        }
        if (grains > gw * gh * 0.3 || clock > 110) { draining = true; clock = 0; holes(true); quietFor = 0; }
      } else {
        quietFor = grains < lastGrains - 1 ? 0 : quietFor + dt;
        if (quietFor > 2 || clock > 45) { draining = false; clock = 0; holes(false); }
      }
      lastGrains = grains;
      update();
      if (cs <= 4) update();
    }

    return {
      lay() {
        build();
        // A few seconds of flow, so the first frame has streams in the air.
        for (let i = 0; i < gh + 20; i++) step(1 / 30);
      },
      step,
      draw() {
        if (!img) return;
        const { ctx } = s;
        for (let p = 0; p < grid.length; p++) px[p] = lut[grid[p]];
        g.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, ox, oy, gw * cs, gh * cs);
        ctx.imageSmoothingEnabled = true;
        // The spouts: small funnels at the top.
        ctx.globalAlpha = s.dark ? 0.4 : 0.42;
        ctx.fillStyle = s.ink;
        const at = layout === 2 ? glasses.map((q) => q.cx) : spouts.map((sp) => Math.round(sp.x));
        ctx.beginPath();
        for (const x of at) {
          const X = ox + x * cs;
          ctx.moveTo(X - cs * 3, 0); ctx.lineTo(X + cs * 3, 0); ctx.lineTo(X + cs, cs * 3); ctx.lineTo(X - cs, cs * 3);
        }
        ctx.fill();
      },
    };
  });
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
