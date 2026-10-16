// Life: Conway's Game of Life on a coarse grid, a generation every half second or so, each cell
// easing in as it is born and out as it dies. The seed picks the variant: a soup of square
// cells coloured by age that leaves fading ghost trails, re-seeded when it settles; a sparse
// field of round cells where gliders and spaceships sail in from the edges past blinking
// oscillators, each keeping its colour; or colour territories, where a newborn cell takes the
// colour most of its parents had, so rival colonies grow and swallow one another.

import { stage, clamp } from './stage.js';

const LV = 6;   // alpha levels a cell is drawn at

// Patterns as rows, 'O' alive. A glider heads down-right, a spaceship left; mirrors turn them.
const GLIDER = ['.O.', '..O', 'OOO'];
const SHIP = ['.O..O', 'O....', 'O...O', 'OOOO.'];
const OSCILLATORS = [
  ['OOO'],
  ['.OOO', 'OOO.'],
  ['OO..', 'OO..', '..OO', '..OO'],
  ['OOOOOOOOOO'],
  ['..OOO...OOO..', '.............', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '..OOO...OOO..',
    '.............', '..OOO...OOO..', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '.............', '..OOO...OOO..'],
];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const wrap = layout !== 1;
    const period = layout === 1 ? 0.45 : 0.7;
    let c = 20, gw = 0, gh = 0, ox = 0, oy = 0, clock = 0, gen = 0, quiet = 0;
    let live = new Uint8Array(0), next = new Uint8Array(0), col = new Uint8Array(0), ncol = new Uint8Array(0);
    let age = new Uint16Array(0), shown = new Float32Array(0), ghost = new Float32Array(0);
    let order = new Int32Array(0), spot = new Uint16Array(0);
    const counts = new Int32Array(nc * LV + 1);

    /** Puts `rows` with its top-left at x, y, mirrored as asked, in colour k.
     * @param {string[]} rows @param {number} x @param {number} y @param {boolean} fx @param {boolean} fy
     * @param {number} k @returns {void} */
    function put(rows, x, y, fx, fy, k) {
      const h = rows.length, w = rows[0].length;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          if (rows[fy ? h - 1 - j : j][fx ? w - 1 - i : i] !== 'O') continue;
          const X = x + i, Y = y + j;
          if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue;
          live[Y * gw + X] = 1; col[Y * gw + X] = k; age[Y * gw + X] = 0;
        }
      }
    }

    /** A disc of random soup, in one colour or all. @param {number} k colour, or -1 for any @returns {void} */
    function blob(k) {
      const r = 4 + rng.int(6), x0 = rng.int(gw), y0 = rng.int(gh);
      for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
          if (i * i + j * j > r * r || rng.random() > 0.42) continue;
          const X = x0 + i, Y = y0 + j;
          if (!wrap && (X < 0 || Y < 0 || X >= gw || Y >= gh)) continue;
          const p = ((Y + gh) % gh) * gw + (X + gw) % gw;
          live[p] = 1; age[p] = 0; col[p] = k < 0 ? rng.int(nc) : k;
        }
      }
    }

    /** A glider or spaceship entering from just outside an edge. @returns {void} */
    function launch() {
      const k = rng.int(nc);
      if (rng.random() < 0.65) {
        // Gliders run diagonally: start at a corner side and cross.
        const fx = rng.random() < 0.5, fy = rng.random() < 0.5;
        if (rng.random() < 0.5) put(GLIDER, fx ? gw - 1 : -2, rng.int(gh), fx, fy, k);
        else put(GLIDER, rng.int(gw), fy ? gh - 1 : -2, fx, fy, k);
      } else {
        const right = rng.random() < 0.5;
        put(SHIP, right ? -4 : gw - 1, 2 + rng.int(Math.max(1, gh - 6)), right, rng.random() < 0.5, k);
      }
    }

    /** An oscillator somewhere it fits. @returns {void} */
    function oscillator() {
      const rows = OSCILLATORS[rng.int(OSCILLATORS.length)];
      const w = rows[0].length, h = rows.length;
      if (w + 4 > gw || h + 4 > gh) return;
      put(rows, 2 + rng.int(gw - w - 3), 2 + rng.int(gh - h - 3), false, false, rng.int(nc));
    }

    /** One generation. @returns {void} */
    function tick() {
      let pop = 0, changed = 0;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          let n = 0, k1 = -1, k2 = -1, k3 = -1;
          for (let j = -1; j <= 1; j++) {
            let Y = y + j;
            if (Y < 0 || Y >= gh) { if (!wrap) continue; Y = (Y + gh) % gh; }
            for (let i = -1; i <= 1; i++) {
              if (!i && !j) continue;
              let X = x + i;
              if (X < 0 || X >= gw) { if (!wrap) continue; X = (X + gw) % gw; }
              const q = Y * gw + X;
              if (!live[q]) continue;
              n++;
              if (k1 < 0) k1 = col[q]; else if (k2 < 0) k2 = col[q]; else k3 = col[q];
            }
          }
          const p = y * gw + x, was = live[p];
          const now = n === 3 || (was && n === 2) ? 1 : 0;
          next[p] = now;
          // A newborn takes the colour two of its three parents share, else the first's.
          ncol[p] = was ? col[p] : (k1 === k2 || k1 === k3 ? k1 : k2 === k3 ? k2 : k1) & 255;
          if (now) pop++;
          if (now !== was) changed++;
        }
      }
      [live, next] = [next, live];
      [col, ncol] = [ncol, col];
      for (let p = 0; p < live.length; p++) age[p] = live[p] ? Math.min(age[p] + 1, 999) : 0;
      gen++;
      const area = gw * gh;
      if (layout === 1) {
        if (gen % 5 === 0) launch();
        if (gen % 30 === 0 && pop < area * 0.06) oscillator();
      } else {
        quiet = changed < area * 0.006 ? quiet + 1 : 0;
        // Fresh soup when it settles into still life, thins out, or now and then anyway.
        if (quiet > 5 || pop < area * 0.05 || gen % 28 === 0) {
          blob(layout === 2 ? rng.int(nc) : -1);
          quiet = 0;
        }
      }
    }

    /** Builds the grid for this size, keeping what overlaps the old one, centred. @returns {void} */
    function grid() {
      const was = { gw, gh, live, col, age, shown, ghost };
      c = clamp(Math.round(Math.min(s.W, s.H) / (layout === 2 ? 26 : 32)), 12, 30);
      gw = Math.ceil(s.W / c) + 1; gh = Math.ceil(s.H / c) + 1;
      ox = (s.W - gw * c) / 2; oy = (s.H - gh * c) / 2;
      const n = gw * gh;
      live = new Uint8Array(n); next = new Uint8Array(n); col = new Uint8Array(n); ncol = new Uint8Array(n);
      age = new Uint16Array(n); shown = new Float32Array(n); ghost = new Float32Array(n);
      order = new Int32Array(n); spot = new Uint16Array(n);
      const dx = (was.gw - gw) >> 1, dy = (was.gh - gh) >> 1;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= was.gw || Y >= was.gh) continue;
          const p = y * gw + x, q = Y * was.gw + X;
          live[p] = was.live[q]; col[p] = was.col[q]; age[p] = was.age[q]; shown[p] = was.shown[q]; ghost[p] = was.ghost[q];
        }
      }
    }

    return {
      lay() {
        const first = gw === 0;
        grid();
        if (!first) return;
        // Seed, then run some generations and show them settled, so the first frame is a
        // world in progress.
        if (layout === 1) {
          const n = clamp(Math.round(gw * gh / 300), 3, 10);
          for (let i = 0; i < n; i++) oscillator();
          for (let i = 0; i < n + 2; i++) launch();
        } else {
          for (let p = 0; p < live.length; p++) {
            if (rng.random() < 0.3) { live[p] = 1; col[p] = rng.int(nc); }
          }
        }
        for (let i = 0; i < (layout === 1 ? 24 : 14); i++) tick();
        for (let p = 0; p < live.length; p++) { shown[p] = live[p]; ghost[p] = live[p]; }
      },
      step(dt) {
        clock += dt;
        if (clock >= period) { clock -= period; tick(); }
        // About half a second to ease in or out; ghosts fade over several seconds.
        const e = Math.min(1, dt * 5), g = Math.exp(-dt / 3.5);
        for (let p = 0; p < live.length; p++) {
          shown[p] += (live[p] - shown[p]) * e;
          ghost[p] = Math.max(ghost[p] * g, shown[p]);
        }
      },
      draw() {
        const { ctx } = s;
        const A = s.dark ? 0.46 : 0.4;
        // Counting sort of the cells into (colour, level) buckets, one fill each.
        counts.fill(0);
        for (let p = 0; p < live.length; p++) {
          let d = shown[p];
          if (layout === 0) d = Math.max(d, ghost[p] * 0.3);
          const l = Math.ceil(d * LV - 0.25);
          if (l <= 0) { spot[p] = 0; continue; }
          const k = layout === 0 ? Math.min(nc - 1, age[p] < 2 ? 0 : age[p] < 6 ? 1 : age[p] < 18 ? 2 : 3) : col[p] % nc;
          const b = 1 + k * LV + Math.min(LV, l) - 1;
          spot[p] = b;
          counts[b]++;
        }
        let sum = 0;
        for (let b = 0; b < counts.length; b++) { const n = counts[b]; counts[b] = sum; sum += n; }
        for (let p = 0; p < live.length; p++) if (spot[p]) order[counts[spot[p]]++] = p;
        let at = counts[0];
        for (let b = 1; b < counts.length; b++) {
          const end = counts[b];
          if (end === at) continue;
          const k = Math.floor((b - 1) / LV), l = (b - 1) % LV + 1, u = l / LV;
          ctx.globalAlpha = A * u;
          ctx.fillStyle = s.colors[k];
          ctx.beginPath();
          if (layout === 1) {
            const r = c * 0.36 * (0.55 + 0.45 * u);
            for (let i = at; i < end; i++) {
              const p = order[i], x = ox + (p % gw + 0.5) * c, y = oy + (Math.floor(p / gw) + 0.5) * c;
              ctx.moveTo(x + r, y);
              ctx.arc(x, y, r, 0, 6.2832);
            }
          } else {
            const inset = layout === 2 ? c * 0.06 : c * (0.1 + 0.18 * (1 - u)), w = c - inset * 2;
            for (let i = at; i < end; i++) {
              const p = order[i];
              ctx.rect(ox + (p % gw) * c + inset, oy + Math.floor(p / gw) * c + inset, w, w);
            }
          }
          ctx.fill();
          at = end;
        }
      },
    };
  });
}
