// Cracks: a crack network spreads over the screen, each crack running until it meets another, so
// the surface breaks up into cells; then it fades and a fresh one starts. The seed picks the
// variant: drying mud, a few wide cracks first and ever finer ones splitting the plates between
// them at right angles; old glaze, fine curved crazing spreading out from one spot in a growing
// patch of small cells; or a split wall, a few long jagged fractures running in from the edges and
// forking as they go.

import { stage, TAU, clamp } from './stage.js';

const GROW = 38;   // seconds the network takes to grow
const HOLD = 10;   // seconds it stays whole
const FADE = 6;    // seconds it takes to fade
const REST = 1.5;  // seconds of bare surface before the next

/** @typedef {{x:number, y:number, a:number, base:number, curv:number, gen:number, id:number, ign:number,
 *   age:number, left:number, kink:number}} Crack
 * a, the heading; base, the heading a jagged crack keeps returning to; curv, turn per step; ign, the
 * parent crack it may cross while leaving it; left, steps until it gives out by itself. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const color = s.colors[rng.int(s.colors.length)];
    let cap = 1, segs = new Float32Array(4), gens = new Uint8Array(1), ids = new Int32Array(1), n = 0, drawn = 0;
    /** @type {Crack[]} */
    let cracks = [];
    let m = 1, sp = 4, cell = 6, gw = 1, gh = 1, grid = new Int32Array(1), target = 1, nextId = 1;
    let speed = 100, acc = 0, lanes = 3, mode = 0, clock = 0, warmed = false, mains = 0;
    // The network so far at device pixels, added to as it grows; cleared only when it starts again.
    // It is painted opaque and shown translucent, so where one frame's strokes meet the next's no
    // joint shows darker.
    const pane = document.createElement('canvas');

    /** @param {number} x @param {number} y @returns {number} */
    const cellAt = (x, y) => clamp(Math.floor(y / cell), 0, gh - 1) * gw + clamp(Math.floor(x / cell), 0, gw - 1);

    /** Sizes everything for the current screen. @returns {void} */
    function measure() {
      m = Math.min(s.W, s.H);
      sp = clamp(m * 0.006, 2.5, 6);
      cell = sp * 1.5;
      gw = Math.ceil(s.W / cell) + 1; gh = Math.ceil(s.H / cell) + 1;
      // Total crack length: about two cell sides per cell of the pattern.
      const size = layout === 0 ? m * 0.12 : layout === 1 ? m * 0.07 : m * 0.5;
      target = Math.round(2 * s.W * s.H / size / sp);
      speed = clamp(m * (layout === 1 ? 0.12 : 0.2), 40, 190);
      lanes = clamp(Math.round(target * sp / (speed * GROW)), 2, layout === 1 ? 26 : 12);
      if (layout === 2) lanes = clamp(lanes, 2, 6);
    }

    /** Starts the surface over, unbroken. @returns {void} */
    function reset() {
      cap = target + 64;
      segs = new Float32Array(cap * 4); gens = new Uint8Array(cap); ids = new Int32Array(cap);
      grid = new Int32Array(gw * gh);
      n = 0; drawn = 0; cracks = []; nextId = 1; mode = 0; clock = 0; acc = 0;
      const g = pane.getContext('2d');
      g?.setTransform(1, 0, 0, 1, 0, 0);
      g?.clearRect(0, 0, pane.width, pane.height);
      if (layout === 1) {
        // Crazing radiates from one spot.
        const x = s.W * (0.3 + rng.random() * 0.4), y = s.H * (0.3 + rng.random() * 0.4);
        for (let k = 0; k < 4; k++) begin(x, y, k * TAU / 4 + rng.random() * 0.8, 0, 0);
      } else if (layout === 0) {
        // Mud splits at scattered spots first, each crack running both ways from where it opened.
        const seeds = clamp(Math.round(s.W * s.H / (m * m * 0.12)), 4, 14);
        for (let k = 0; k < seeds; k++) {
          const x = rng.random() * s.W, y = rng.random() * s.H, a = rng.random() * TAU;
          const c = begin(x, y, a, 0, 0);
          begin(x, y, a + Math.PI, 0, c.id);
        }
      } else {
        fracture(); fracture(); mains = 2;
      }
    }

    /** A new crack. @param {number} x @param {number} y @param {number} a @param {number} gen
     * @param {number} ign @returns {Crack} */
    function begin(x, y, a, gen, ign) {
      /** @type {Crack} */
      const c = { x, y, a, base: a, gen, id: nextId++, ign, age: 0, left: Infinity, kink: 0,
        curv: layout === 1 ? (rng.random() < 0.5 ? -1 : 1) * (0.004 + rng.random() * 0.018) : 0 };
      if (layout === 1) c.left = (m * (0.06 + rng.random() * 0.12)) / sp;
      else if (layout === 0) c.left = (m * (gen ? 0.08 + rng.random() * 0.25 : 0.3 + rng.random() * 0.3)) / sp;
      cracks.push(c);
      return c;
    }

    /** A long fracture running in from a random edge across the screen. @returns {void} */
    function fracture() {
      const e = rng.int(4), u = 0.15 + rng.random() * 0.7;
      const [x, y, a] = e === 0 ? [u * s.W, 0, Math.PI / 2] : e === 1 ? [u * s.W, s.H, -Math.PI / 2]
        : e === 2 ? [0, u * s.H, 0] : [s.W, u * s.H, Math.PI];
      begin(x, y, a + (rng.random() - 0.5) * 0.8, 0, 0);
    }

    /** A crack off a point of the network so far, square to it. @returns {void} */
    function branch() {
      if (!n) return;
      // Glaze grows outward: it branches mostly off its newest cracks.
      const i = layout === 1 ? n - 1 - Math.floor(rng.random() ** 2.5 * Math.min(n, 900)) : rng.int(n);
      const x0 = segs[i * 4], y0 = segs[i * 4 + 1], x1 = segs[i * 4 + 2], y1 = segs[i * 4 + 3];
      const a = Math.atan2(y1 - y0, x1 - x0) + (rng.random() < 0.5 ? -1 : 1) * (Math.PI / 2 + (rng.random() - 0.5) * 0.5);
      begin((x0 + x1) / 2, (y0 + y1) / 2, a, Math.min(3, gens[i] + 1), ids[i]);
    }

    /** Advances crack c one step. @param {Crack} c @returns {boolean} still running */
    function stepCrack(c) {
      if (layout === 2 && --c.kink <= 0) {
        // Jagged: it zigzags about its course in short straight runs, and sometimes forks.
        c.kink = 3 + rng.int(5);
        c.a = c.base + (rng.random() - 0.5) * 1.1;
        if (c.gen < 3 && rng.random() < (c.gen ? 0.12 : 0.2)) {
          const f = begin(c.x, c.y, c.a + (rng.random() < 0.5 ? -1 : 1) * (0.5 + rng.random() * 0.5), c.gen + 1, c.id);
          f.left = (m * (0.1 + rng.random() * 0.25)) / sp / (c.gen + 1);
        }
      } else if (layout === 0) {
        // Mud: a ragged edge about a course that itself bends only slowly.
        c.base += (rng.random() - 0.5) * 0.08;
        c.a = c.base + (rng.random() - 0.5) * 0.45;
      } else {
        c.a += c.curv + (rng.random() - 0.5) * 0.1;
      }
      const x = c.x + Math.cos(c.a) * sp, y = c.y + Math.sin(c.a) * sp;
      c.age++; c.left--;
      const out = x < 0 || y < 0 || x > s.W || y > s.H;
      const k = cellAt(x, y), v = grid[k];
      const hit = !out && v !== 0 && v !== c.id && !(v === c.ign && c.age < 4);
      add(c.x, c.y, x, y, c.gen, c.id);
      grid[k] = grid[k] || c.id;
      grid[cellAt((c.x + x) / 2, (c.y + y) / 2)] ||= c.id;
      c.x = x; c.y = y;
      return !out && !hit && c.left > 0 && n < cap;
    }

    /** Records one segment. @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
     * @param {number} gen @param {number} id */
    function add(x0, y0, x1, y1, gen, id) {
      if (n >= cap) return;
      segs.set([x0, y0, x1, y1], n * 4); gens[n] = gen; ids[n] = id;
      n++;
    }

    /** Grows the network by up to k steps. @param {number} k @returns {void} */
    function grow(k) {
      for (let done = 0; done < k && n < target; done++) {
        if (layout === 2) {
          if (!cracks.length && mains < 2 + Math.round(s.W * s.H / 6e5)) { fracture(); mains++; }
        } else {
          for (let t = 0; cracks.length < lanes && t < lanes; t++) branch();
        }
        if (!cracks.length) return;
        const i = done % cracks.length;
        if (!stepCrack(cracks[i])) cracks.splice(i, 1);
      }
    }

    /** Paints segments a..b into the pane. @param {number} a @param {number} b @returns {void} */
    function paint(a, b) {
      const g = pane.getContext('2d');
      drawn = b;
      if (!g || b <= a) return;
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      g.lineCap = 'round';
      g.strokeStyle = color;
      const w = clamp(m / 600, 0.9, 1.6);
      const widths = layout === 1 ? [1.5, 1.2, 1.1, 1] : layout === 0 ? [3, 2.2, 1.6, 1.1] : [3.2, 2, 1.4, 1.1];
      for (let k = 0; k < 4; k++) {
        const p = new Path2D();
        let any = false;
        for (let i = a; i < b; i++) {
          if (gens[i] !== k) continue;
          p.moveTo(segs[i * 4], segs[i * 4 + 1]); p.lineTo(segs[i * 4 + 2], segs[i * 4 + 3]);
          any = true;
        }
        if (!any) continue;
        g.lineWidth = widths[k] * w;
        g.stroke(p);
      }
    }

    return {
      lay() {
        measure();
        pane.width = s.cv.width; pane.height = s.cv.height;
        if (!warmed) {
          warmed = true;
          reset();
          // Start part-grown so the first frame (and reduced motion) shows a network forming.
          grow(Math.round(target * 0.6));
        } else {
          // Keep the network: re-mark the grid for the new size, drop cracks now off-screen.
          grid = new Int32Array(gw * gh);
          for (let i = 0; i < n; i++) grid[cellAt(segs[i * 4 + 2], segs[i * 4 + 3])] ||= ids[i];
          cracks = cracks.filter((c) => c.x < s.W && c.y < s.H);
          if (n > cap - 64) target = n;
        }
        paint(0, n);
      },
      step(dt) {
        clock += dt;
        if (mode === 0) {
          acc += dt * speed / sp * lanes;
          const k = Math.floor(acc);
          acc -= k;
          grow(k);
          if (n >= target || !cracks.length) { mode = 1; clock = 0; }
        } else if (mode === 1 && clock > HOLD) { mode = 2; clock = 0; }
        else if (mode === 2 && clock > FADE) { mode = 3; clock = 0; }
        else if (mode === 3 && clock > REST) { measure(); reset(); }
      },
      draw() {
        const { ctx } = s;
        if (n > drawn) paint(drawn, n);
        if (mode === 3) return;
        const u = mode === 2 ? clamp(clock / FADE, 0, 1) : 0;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = (s.dark ? 0.55 : 0.6) * (1 - u * u * (3 - 2 * u));
        ctx.drawImage(pane, 0, 0);
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      },
    };
  });
}
