// Frost: ice crystals grow across a window pane, branch by branch, until the glass is laced over;
// after a while they melt back, newest twigs first, and the pane frosts over again. The seed picks
// the variant: ferns, feathery fronds creeping in from all four edges of the pane; stars, six-armed
// crystals nucleating one by one across the glass and branching until they meet; or rime,
// aggregation, drifting specks sticking where they touch, building a coral-like crust up from the sill.

import { stage, TAU, clamp, mix } from './stage.js';

const CHUNK = 1024;  // segments per cached path
const GROW = 45;     // seconds the frost takes to grow
const HOLD = 9;      // seconds it stays grown
const MELT = 16;     // seconds it takes to melt
const REST = 3;      // seconds of clear glass before it frosts again
// A rime speck's neighbours, those below first.
const NB = [[0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1]];

/** @typedef {{x:number, y:number, a:number, gen:number, left:number, k:number, side:number, root:number}} Tip */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const rgb = s.colors.map(rgbOf);
    const ice = s.colors[nearestHue(rgb, 200)];
    const rime = s.dark ? '#dde8f0' : s.colors[nearestHue(rgb, 260)];
    let cap = 1, segs = new Float32Array(4), gens = new Uint8Array(1), n = 0, shown = 0;
    /** @type {Path2D[][]} per chunk, one path per generation */
    let chunks = [];
    /** @type {Tip[]} */
    let tips = [];
    let head = 0, nextId = 1, target = 1, budget = 1, m = 1, sp = 4, cell = 6, gw = 1, gh = 1;
    let grid = new Int32Array(1);
    let mode = 0, clock = 0, top = 0, cycles = 0;   // mode: 0 growing, 1 holding, 2 melting, 3 resting
    // The frost so far, painted at device pixels: stroking it all every frame is too slow on a big screen.
    const pane = document.createElement('canvas');
    let drawn = 0, since = 0;

    /** Starts the pane over, clear, for the current size. @returns {void} */
    function reset() {
      m = Math.min(s.W, s.H);
      sp = clamp(m * 0.008, 3.5, 9);
      cell = layout === 2 ? clamp(m * 0.009, 4, 8) : sp * 1.6;
      gw = Math.ceil(s.W / cell) + 1; gh = Math.ceil(s.H / cell) + 1;
      grid = new Int32Array(gw * gh);
      target = Math.round(s.W * s.H / (sp * sp * (layout === 0 ? 2.2 : 6)));
      if (layout === 2) target = Math.round(gw * gh * 0.2);
      cap = target + 2000;
      segs = new Float32Array(cap * 4); gens = new Uint8Array(cap);
      n = 0; shown = 0; chunks = []; tips = []; head = 0; nextId = 1; mode = 0; clock = 0;
      budget = Math.max(1, Math.ceil(target / (GROW * 30)));
      top = gh - 1;
      if (layout === 0) {
        // Seeds along every edge, pointing in.
        const per = Math.max(3, Math.round((s.W + s.H) * 2 / (m * 0.12)));
        for (let i = 0; i < per; i++) {
          const u = rng.random(), e = rng.int(4);
          const [x, y, a] = e === 0 ? [u * s.W, 0, Math.PI / 2] : e === 1 ? [u * s.W, s.H, -Math.PI / 2] : e === 2 ? [0, u * s.H, 0] : [s.W, u * s.H, Math.PI];
          tips.push({ x, y, a: a + (rng.random() - 0.5) * 0.9, gen: 0, left: m * (0.25 + rng.random() * 0.35) / sp, k: 0, side: 1, root: nextId++ });
        }
      } else if (layout === 1) {
        nucleate(); nucleate();
      } else {
        // The sill: the bottom row is ice already.
        for (let x = 0; x < gw; x++) grid[(gh - 1) * gw + x] = 1;
      }
    }

    /** Starts a six-armed crystal somewhere clear. @returns {void} */
    function nucleate() {
      for (let tries = 0; tries < 20; tries++) {
        const x = rng.random() * s.W, y = rng.random() * s.H;
        if (grid[cellAt(x, y)]) continue;
        const r0 = rng.random() * TAU, len = m * (0.07 + rng.random() * 0.1) / sp, id = nextId++;
        for (let k = 0; k < 6; k++) tips.push({ x, y, a: r0 + k * TAU / 6, gen: 0, left: len, k: 0, side: 1, root: id });
        grid[cellAt(x, y)] = id * 4;
        return;
      }
    }

    /** @param {number} x @param {number} y @returns {number} */
    const cellAt = (x, y) => clamp(Math.floor(y / cell), 0, gh - 1) * gw + clamp(Math.floor(x / cell), 0, gw - 1);

    /** Records one segment. @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
     * @param {number} gen @returns {void} */
    function add(x0, y0, x1, y1, gen) {
      if (n >= cap) return;
      segs[n * 4] = x0; segs[n * 4 + 1] = y0; segs[n * 4 + 2] = x1; segs[n * 4 + 3] = y1; gens[n] = gen;
      n++;
      if (n % CHUNK === 0) chunks.push(paths(n - CHUNK, n));
    }

    /** Paths of segments a..b, one per generation. @param {number} a @param {number} b @returns {Path2D[]} */
    function paths(a, b) {
      const ps = [new Path2D(), new Path2D(), new Path2D()];
      for (let i = a; i < b; i++) {
        const p = ps[gens[i]];
        p.moveTo(segs[i * 4], segs[i * 4 + 1]); p.lineTo(segs[i * 4 + 2], segs[i * 4 + 3]);
      }
      return ps;
    }

    /** Paints segments a..b into the pane, whole chunks from their cached paths.
     * @param {number} a @param {number} b @returns {void} */
    function paint(a, b) {
      const g = pane.getContext('2d');
      drawn = b;
      if (!g || b <= a) return;
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      const w = clamp(m / 700, 0.8, 1.6);
      const c0 = Math.ceil(a / CHUNK), c1 = Math.max(c0, Math.min(Math.floor(b / CHUNK), chunks.length));
      const bits = c1 > c0 ? [paths(a, c0 * CHUNK), ...chunks.slice(c0, c1), paths(c1 * CHUNK, b)] : [paths(a, b)];
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = k === 2 ? rime : ice;
        g.lineWidth = [2.2, 1.5, 1.1][k] * w;
        g.globalAlpha = s.dark ? [0.55, 0.5, 0.42][k] : [0.6, 0.55, 0.5][k];
        for (const p of bits) g.stroke(p[k]);
      }
    }

    /** Grows the branching crystals by up to k steps. @param {number} k @returns {boolean} still growing */
    function growTips(k) {
      for (let done = 0; done < k; done++) {
        if (head >= tips.length) {
          if (layout === 1 && n < target) { nucleate(); if (head >= tips.length) return false; continue; }
          return false;
        }
        if (n >= target) return false;
        const t = tips[head++];
        if (layout === 1 && t.gen === 0 && t.k === 0 && rng.random() < 0.06) nucleate();
        const wob = layout === 1 ? 0 : t.gen === 0 ? 0.22 : 0.12;
        t.a += (rng.random() - 0.5) * wob;
        const x = t.x + Math.cos(t.a) * sp, y = t.y + Math.sin(t.a) * sp;
        if (x < -2 || y < -2 || x > s.W + 2 || y > s.H + 2) continue;
        // Cells hold root * 4 + generation. A branch stops where it meets another crystal; a
        // trunk runs on over another's branches but stops at its trunk.
        const c = cellAt(x, y), o = grid[c];
        if (o && o >> 2 !== t.root && (t.gen > 0 || (o & 3) === 0)) continue;
        if (!o || t.gen < (o & 3)) grid[c] = t.root * 4 + t.gen;
        add(t.x, t.y, x, y, t.gen);
        t.x = x; t.y = y; t.left--; t.k++;
        // Side branches at sixty degrees, alternating sides (both, on a star), shorter each time.
        if (t.gen < 2 && t.k % (layout === 1 || t.gen === 0 ? 3 : 2) === 0 && t.left > 1.5) {
          const sides = layout === 1 ? [1, -1] : [t.side];
          for (const sd of sides) {
            const left = t.left * (layout === 1 ? 0.32 : t.gen === 0 ? 0.5 : 0.4);
            if (left >= 1 && !(layout === 1 && t.gen === 1)) {
              tips.push({ x, y, a: t.a + sd * (0.95 + rng.random() * 0.2), gen: t.gen + 1, left, k: 0, side: sd, root: t.root });
            }
          }
          t.side = -t.side;
        }
        if (t.left > 0) tips.push(t);
      }
      if (head > 4096) { tips = tips.slice(head); head = 0; }
      return true;
    }

    /** Sticks up to k drifting specks onto the crust. @param {number} k @returns {boolean} still growing */
    function growRime(k) {
      const limit = Math.floor(gh * 0.3);
      if (n >= target || top <= limit) return false;
      for (let done = 0; done < k; done++) {
        let x = rng.int(gw), y = Math.max(0, top - 4);
        for (let walk = 0; walk < 600; walk++) {
          const r = rng.random();
          // A random walk drifting slightly down, toward the sill.
          if (r < 0.25) x--; else if (r < 0.5) x++; else if (r < 0.78) y++; else y--;
          x = (x + gw) % gw;
          if (y < top - 8) y = top - 8;
          if (y >= gh - 1) break;
          // Stick to the first of the eight neighbours that is ice, those below first.
          let nx = -1, ny = -1;
          for (const [dx, dy] of NB) {
            const a = x + dx, b = y + dy;
            if (a >= 0 && a < gw && b >= 0 && grid[b * gw + a]) { nx = a; ny = b; break; }
          }
          if (nx < 0) continue;
          grid[y * gw + x] = 1;
          top = Math.min(top, y);
          const gen = y > gh * 0.85 ? 0 : y > gh * 0.6 ? 1 : 2;
          add(...jit(nx, ny), ...jit(x, y), gen);
          break;
        }
      }
      return true;
    }

    /** A grid cell's centre, nudged by a fixed hash of the cell so the crust is not on a grid.
     * @param {number} x @param {number} y @returns {[number, number]} */
    function jit(x, y) {
      const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453, u = h - Math.floor(h), v = (h * 7.13) - Math.floor(h * 7.13);
      return [(x + 0.15 + u * 0.7) * cell, (y + 0.15 + v * 0.7) * cell];
    }

    /** @param {number} k @returns {boolean} */
    const grow = (k) => (layout === 2 ? growRime(k) : growTips(k));

    return {
      lay() {
        // Regrow from the start at the new size, as far as it had got (most of the way, the first time).
        const frac = cycles || n ? (mode === 0 ? shown / Math.max(1, target) : mode === 1 ? 1 : 0.6) : 0.7;
        reset();
        grow(Math.round(target * frac));
        shown = n;
        cycles++;
        pane.width = s.cv.width; pane.height = s.cv.height;
        drawn = 0;
      },
      step(dt) {
        clock += dt;
        if (mode === 0) {
          if (!grow(budget) || clock > GROW * 1.6) { mode = 1; clock = 0; }
          shown = n;
        } else if (mode === 1 && clock > HOLD) { mode = 2; clock = 0; }
        else if (mode === 2) {
          // Newest first, so the twigs retract toward where the frost began.
          const u = clamp(clock / MELT, 0, 1);
          shown = Math.round(n * (1 - u * u * (3 - 2 * u)));
          if (u >= 1) { mode = 3; clock = 0; }
        } else if (mode === 3 && clock > REST) { reset(); }
      },
      draw() {
        const { ctx } = s;
        // Growing adds the new segments to the pane; melting repaints it a few times a second.
        if (shown > drawn) paint(drawn, shown);
        else if (shown < drawn && (shown === 0 || ++since >= 6)) {
          const g = pane.getContext('2d');
          g?.setTransform(1, 0, 0, 1, 0, 0);
          g?.clearRect(0, 0, pane.width, pane.height);
          paint(0, shown);
          since = 0;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = mode === 2 ? mix(1, 0.65, clamp(clock / MELT, 0, 1)) : 1;
        ctx.drawImage(pane, 0, 0);
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      },
    };
  });
}

/** Which colour's hue is nearest `deg`. @param {number[][]} cs @param {number} deg @returns {number} */
function nearestHue(cs, deg) {
  let best = 0, bd = Infinity;
  cs.forEach((c, i) => {
    const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.05) return;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    const dist = Math.min(Math.abs(h - deg), 360 - Math.abs(h - deg));
    if (dist < bd) { bd = dist; best = i; }
  });
  return best;
}

/** A colour string's channels. @param {string} color @returns {number[]} */
function rgbOf(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = '#888';
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = v.match(/[\d.]+/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
}
