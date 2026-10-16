// Cells: soft round cells, each with its nucleus, drift and grow; a full-grown one stretches,
// pinches at the waist and divides in two, its nucleus splitting with it. Cells that press
// together flatten where they meet, so they squeeze past each other. The seed picks the variant:
// a sparse dish of cells wandering every way; a packed colony in the middle of the page where
// cells divide and others shrink away; or a current carrying cells across, quicker mid-stream.

import { stage, TAU, clamp, mix } from './stage.js';

/** @typedef {{x:number, y:number, vx:number, vy:number, r:number, g:number, c:number, p:number,
 *   ax:number, age:number, die:number, l:number[], nb:Cell[]}} Cell
 * Centre x, y and velocity (CSS px, px/s); radius r growing g px/s; colour c; p the division's
 * progress 0..1 (-1 when not dividing) along axis ax; die 0..1 how far it has shrunk away; l its
 * lobes [x0, y0, x1, y1, radius, count] and nb the cells near enough to press on it. */

const N = 32;           // membrane points
const DIVIDE = 6;       // s a division takes
const DIE = 5;          // s a cell takes to shrink away

/** @param {number} u @returns {number} */
const smooth = (u) => u * u * (3 - 2 * u);

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Cell[]} */
    let cells = [];
    let rmax = 40, cap = 20, laid = false;
    const dir = s.seed & 4 ? -1 : 1;     // the current's way
    const rho = new Float32Array(N), ux = new Float32Array(N), uy = new Float32Array(N);
    for (let k = 0; k < N; k++) { ux[k] = Math.cos(k * TAU / N); uy[k] = Math.sin(k * TAU / N); }

    /** @param {number} x @param {number} y @param {number} r @param {number} c @returns {Cell} */
    const cell = (x, y, r, c) => ({ x, y, vx: 0, vy: 0, r, g: rmax * (0.009 + rng.random() * 0.006), c,
      p: -1, ax: rng.random() * TAU, age: 0, die: 0, l: [x, y, x, y, r, 1], nb: [] });

    /** Sets a cell's lobes: one circle, or two while dividing. @param {Cell} c @returns {void} */
    function lobes(c) {
      const k = c.die > 0 ? 1 - smooth(c.die) * 0.55 : 1;
      if (c.p < 0) { c.l[0] = c.l[2] = c.x; c.l[1] = c.l[3] = c.y; c.l[4] = c.r * k; c.l[5] = 1; return; }
      const u = smooth(c.p), rc = c.r * mix(1, 0.74, u), d = rc * u;
      const cx = Math.cos(c.ax) * d, cy = Math.sin(c.ax) * d;
      c.l[0] = c.x + cx; c.l[1] = c.y + cy; c.l[2] = c.x - cx; c.l[3] = c.y - cy; c.l[4] = rc; c.l[5] = 2;
    }

    /** Where the current carries a cell at height y. @param {number} y @returns {number} */
    const flow = (y) => {
      const v = (y - s.H / 2) / (s.H / 2);
      return dir * clamp(Math.min(s.W, s.H) * 0.035, 10, 26) * (0.45 + 0.55 * Math.max(0, 1 - v * v));
    };

    /** Fills the dish for the current size. @returns {void} */
    function populate() {
      const { W, H } = s;
      while (cells.length < cap) {
        let x = rng.random() * W, y = rng.random() * H;
        if (layout === 1) {
          const a = rng.random() * TAU, q = Math.sqrt(rng.random()) * 0.4;
          x = W / 2 + Math.cos(a) * q * W; y = H / 2 + Math.sin(a) * q * H;
        }
        const c = cell(x, y, rmax * (0.74 + rng.random() * 0.26), rng.int(nc));
        c.age = rng.random() * 30;
        if (rng.random() < 0.2) c.p = rng.random() * 0.9;
        cells.push(c);
      }
    }

    /** @param {number} dt @returns {void} */
    function advance(dt) {
      const { W, H } = s, m0 = Math.min(W, H);
      for (const c of cells) lobes(c);
      // Near neighbours, from lobe extents.
      for (const c of cells) c.nb.length = 0;
      for (let i = 0; i < cells.length; i++) {
        const a = cells[i], ra = a.r * 1.8;
        for (let j = i + 1; j < cells.length; j++) {
          const b = cells[j], reach = ra + b.r * 1.8;
          if (Math.abs(a.x - b.x) > reach || Math.abs(a.y - b.y) > reach) continue;
          a.nb.push(b); b.nb.push(a);
          // Overlapping lobes push their cells apart.
          for (let p = 0; p < a.l[5]; p++) for (let q = 0; q < b.l[5]; q++) {
            const dx = b.l[q * 2] - a.l[p * 2], dy = b.l[q * 2 + 1] - a.l[p * 2 + 1];
            const d = Math.hypot(dx, dy) || 1, o = a.l[4] + b.l[4] - d;
            if (o <= 0) continue;
            const f = o * 2.2 * dt;
            a.vx -= dx / d * f; a.vy -= dy / d * f; b.vx += dx / d * f; b.vy += dy / d * f;
          }
        }
      }
      let dying = 0, busy = 0;
      for (const c of cells) { if (c.die > 0) dying++; if (c.p >= 0) busy++; }
      /** @type {Cell[]} */
      const born = [];
      for (const c of cells) {
        c.age += dt;
        // A slow wander, damped; the colony is held together; the stream carries.
        c.vx += (rng.random() - 0.5) * 18 * dt; c.vy += (rng.random() - 0.5) * 18 * dt;
        if (layout === 1) {
          c.vx -= (c.x - W / 2) / W * m0 * 0.09 * dt; c.vy -= (c.y - H / 2) / H * m0 * 0.09 * dt;
        }
        if (layout === 2) c.vx += (flow(c.y) - c.vx) * Math.min(1, dt * 0.6);
        const damp = Math.exp(-(layout === 2 ? 0.6 : 1.2) * dt);
        if (layout !== 2) c.vx *= damp;
        c.vy *= damp;
        const v = Math.hypot(c.vx, c.vy), top = rmax * 1.2;
        if (v > top) { c.vx *= top / v; c.vy *= top / v; }
        c.x += c.vx * dt; c.y += c.vy * dt;
        // Dish and stream wrap; the colony's cells stay on the page.
        const pad = c.r * 1.6;
        if (layout === 1) { c.x = clamp(c.x, -pad, W + pad); c.y = clamp(c.y, -pad, H + pad); }
        else {
          if (c.x < -pad) c.x += W + 2 * pad; else if (c.x > W + pad) c.x -= W + 2 * pad;
          if (c.y < -pad) c.y += H + 2 * pad; else if (c.y > H + pad) c.y -= H + 2 * pad;
        }
        if (c.die > 0) { c.die += dt / DIE; continue; }
        if (c.p >= 0) {
          c.p += dt / DIVIDE;
          if (c.p >= 1) {
            // Two daughters at the lobes' centres, the same colour, easing apart.
            c.p = 1; lobes(c);
            const ex = Math.cos(c.ax) * 5, ey = Math.sin(c.ax) * 5;
            const a = cell(c.l[0], c.l[1], c.l[4], c.c), b = cell(c.l[2], c.l[3], c.l[4], c.c);
            a.vx = c.vx + ex; a.vy = c.vy + ey; b.vx = c.vx - ex; b.vy = c.vy - ey;
            born.push(a, b);
            c.die = 2;    // removed below
          }
          continue;
        }
        if (c.r < rmax) { c.r = Math.min(rmax, c.r + c.g * dt); continue; }
        // Full grown: divide when there is room; else, now and then, a cell makes room.
        if (cells.length + busy < cap + 2) { c.p = 0; c.ax = layout === 2 ? (rng.random() - 0.5) * 1.2 : rng.random() * TAU; busy++; }
        else if (dying < (layout === 1 ? 1 : 2)) {
          const old = layout === 1 ? cells[rng.int(cells.length)]
            : cells.reduce((o, e) => (e.p < 0 && e.die === 0 && e.age > o.age ? e : o), c);
          if (old.p < 0 && old.die === 0) { old.die = 1e-6; dying++; }
        }
      }
      cells = cells.filter((c) => c.die < 1).concat(born);
    }

    /** Builds a cell's membrane points into rho. @param {Cell} c @returns {void} */
    function membrane(c) {
      const ca = Math.cos(c.ax), sa = Math.sin(c.ax);
      const rc = c.l[4], d = c.l[5] === 2 ? Math.hypot(c.l[0] - c.x, c.l[1] - c.y) : 0;
      for (let k = 0; k < N; k++) {
        // Along each ray, the far edge of whichever lobe reaches further.
        const cosp = ux[k] * ca + uy[k] * sa, sinp = uy[k] * ca - ux[k] * sa;
        const root = Math.sqrt(Math.max(0, rc * rc - d * d * sinp * sinp));
        rho[k] = Math.abs(d * cosp) + root;
      }
      // Each neighbour lobe that overlaps flattens the membrane on a plane between them.
      for (const o of c.nb) {
        for (let p = 0; p < c.l[5]; p++) for (let q = 0; q < o.l[5]; q++) {
          const axp = c.l[p * 2], ayp = c.l[p * 2 + 1], bx = o.l[q * 2], by = o.l[q * 2 + 1];
          const dx = bx - axp, dy = by - ayp, D = Math.hypot(dx, dy) || 1;
          if (D >= c.l[4] + o.l[4]) continue;
          const nx = dx / D, ny = dy / D, h = D * c.l[4] / (c.l[4] + o.l[4]);
          const lim = (axp - c.x) * nx + (ayp - c.y) * ny + h;
          for (let k = 0; k < N; k++) {
            const un = ux[k] * nx + uy[k] * ny;
            if (un > 0.05) rho[k] = Math.min(rho[k], Math.max(lim / un, rc * 0.35));
          }
        }
      }
    }

    return {
      lay() {
        const { W, H } = s, m0 = Math.min(W, H), was = rmax;
        rmax = clamp(m0 * 0.06, 20, 54);
        if (laid) for (const c of cells) { c.r *= rmax / was; c.g *= rmax / was; }
        const a = Math.PI * rmax * rmax;
        cap = layout === 1 ? clamp(Math.round(Math.PI * 0.4 * W * 0.4 * H * 0.85 / a), 10, 60)
          : clamp(Math.round(W * H / (a * (layout === 0 ? 4.6 : 2.6))), 8, 48);
        if (cells.length > cap * 1.3) cells.length = cap;
        populate();
        if (!laid) {
          laid = true;
          // Settle the dish, so a still frame shows cells packed, growing and dividing.
          for (let i = 0; i < 80; i++) advance(0.1);
          // and a few caught part way through dividing.
          for (const c of rng.shuffle(cells).slice(0, Math.max(2, Math.round(cells.length / 7)))) {
            if (c.die === 0 && c.p < 0) { c.r = rmax; c.p = 0.3 + rng.random() * 0.6; }
          }
        }
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        for (const c of cells) lobes(c);
        const lw = clamp(rmax * 0.065, 1.5, 3);
        for (const c of cells) {
          membrane(c);
          const fade = c.die > 0 ? 1 - c.die : 1, col = s.colors[c.c];
          ctx.beginPath();
          // A smooth closed curve through the midpoints of the membrane points.
          for (let k = 0; k <= N; k++) {
            const i = k % N, j = (k + 1) % N;
            const x0 = c.x + ux[i] * rho[i], y0 = c.y + uy[i] * rho[i];
            const x1 = c.x + ux[j] * rho[j], y1 = c.y + uy[j] * rho[j];
            if (k === 0) ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
            else ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
          }
          ctx.fillStyle = col; ctx.strokeStyle = col;
          ctx.globalAlpha = (s.dark ? 0.13 : 0.16) * fade;
          ctx.fill();
          ctx.lineWidth = lw;
          ctx.globalAlpha = (s.dark ? 0.5 : 0.52) * fade;
          ctx.stroke();
          // The nucleus, two while dividing, each with its nucleolus.
          const nr = c.l[4] * 0.36;
          ctx.globalAlpha = (s.dark ? 0.3 : 0.32) * fade;
          ctx.beginPath();
          for (let p = 0; p < c.l[5]; p++) {
            const x = mix(c.x, c.l[p * 2], 0.92), y = mix(c.y, c.l[p * 2 + 1], 0.92);
            ctx.moveTo(x + nr, y); ctx.arc(x, y, nr, 0, TAU);
          }
          ctx.fill();
          ctx.globalAlpha = (s.dark ? 0.45 : 0.5) * fade;
          ctx.beginPath();
          for (let p = 0; p < c.l[5]; p++) {
            const x = mix(c.x, c.l[p * 2], 0.92) + nr * 0.25, y = mix(c.y, c.l[p * 2 + 1], 0.92) - nr * 0.2;
            ctx.moveTo(x + nr * 0.3, y); ctx.arc(x, y, nr * 0.3, 0, TAU);
          }
          ctx.fill();
        }
      },
    };
  });
}
