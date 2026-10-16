// Maze: a maze carves itself out as wide corridors, then a solver finds its way from the entrance
// to the goal, the route glows a while, and it all fades for the next maze. The seed picks the
// variant: a square maze dug by one wandering backtracker, then walked by a solver that tries
// the turn nearest the goal and backs out of dead ends; a square maze that grows outward from
// the middle like a crystal, then is flooded from the entrance in coloured waves until the
// flood reaches the goal and the route lights back along it; or a round maze of rings and
// spokes dug from the centre, solved from the rim inward.

import { stage, TAU, clamp } from './stage.js';

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const C = (/** @type {number} */ k) => s.colors[k % nc];
    let sz = 30, cx = 0, cy = 0;
    /** Cell centres, neighbours, and for the round maze each cell's ring and angle. */
    let X = new Float32Array(0), Y = new Float32Array(0), ring = new Int32Array(0), ang = new Float32Array(0);
    /** @type {number[][]} */
    let nb = [];
    /** @type {number[][]} */
    let open = [];
    let n = 0, entry = 0, goal = 0;
    /** @type {'carve'|'solve'|'trace'|'hold'|'fade'} */
    let phase = 'carve';
    let clock = 0, budget = 0;
    let seen = new Uint8Array(0);
    /** @type {number[]} */
    let stack = [];
    /** @type {number[]} */
    let frontier = [];
    /** @type {number[]} */
    let route = [];
    let head = -1, traced = 0;
    // The dug corridors, and the solver's dead ends or flood, are inked once each into these
    // layers, opaque so joints don't double up, and drawn translucent.
    const dug = document.createElement('canvas'), trail = document.createElement('canvas');
    const gd = /** @type {CanvasRenderingContext2D} */ (dug.getContext('2d'));
    const gt = /** @type {CanvasRenderingContext2D} */ (trail.getContext('2d'));
    let parent = new Int32Array(0), dist = new Int32Array(0), queue = new Int32Array(0), qh = 0, qt = 0, layer = 0;

    /** Adds the corridor between cells a and b to `p`: round the rings in the round maze, else
     * straight. @param {Path2D|CanvasRenderingContext2D} p @param {number} a @param {number} b @returns {void} */
    function link(p, a, b) {
      if (layout === 2 && ring[a] > 0 && ring[b] > 0) {
        // Round the inner cell's ring to the outer cell's angle, then out along the spoke.
        if (ring[b] < ring[a]) [a, b] = [b, a];
        let d = ang[b] - ang[a];
        if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
        p.moveTo(X[a], Y[a]);
        p.arc(cx, cy, ring[a] * sz, ang[a], ang[a] + d, d < 0);
        p.lineTo(X[b], Y[b]);
      } else {
        p.moveTo(X[a], Y[a]);
        p.lineTo(X[b], Y[b]);
      }
    }

    /** Builds the cells and their neighbours for this size. @returns {void} */
    function build() {
      sz = clamp(Math.round(Math.min(s.W, s.H) / 19), 20, 40);
      cx = s.W / 2; cy = s.H / 2;
      /** @type {number[]} */ const xs = [];
      /** @type {number[]} */ const ys = [];
      /** @type {number[]} */ const rs = [];
      /** @type {number[]} */ const as = [];
      nb = [];
      if (layout === 2) {
        // Ring i sits at radius i*sz; a ring doubles its cells when they would grow too long.
        const rings = Math.ceil(Math.hypot(cx, cy) / sz) + 1, turn = rng.random() * TAU;
        /** @type {number[]} */ const first = [];
        /** @type {number[]} */ const count = [];
        xs.push(cx); ys.push(cy); rs.push(0); as.push(0); nb.push([]); first.push(0); count.push(1);
        for (let i = 1; i < rings; i++) {
          const prev = count[i - 1], m = i === 1 ? 6 : TAU * i / prev > 1.6 ? prev * 2 : prev;
          first.push(xs.length); count.push(m);
          for (let j = 0; j < m; j++) {
            const a = turn + (j + 0.5) / m * TAU;
            xs.push(cx + Math.cos(a) * i * sz); ys.push(cy + Math.sin(a) * i * sz); rs.push(i); as.push(a); nb.push([]);
          }
          for (let j = 0; j < m; j++) {
            const p = first[i] + j;
            nb[p].push(first[i] + (j + 1) % m, first[i] + (j + m - 1) % m);
            const q = i === 1 ? 0 : first[i - 1] + (m === prev ? j : j >> 1);
            nb[p].push(q); nb[q].push(p);
          }
        }
        n = xs.length;
        goal = 0;
        // The entrance on the outermost ring that is wholly on screen.
        const r = Math.max(2, Math.floor(Math.min(cx, cy) / sz) - 1);
        entry = first[r] + rng.int(count[r]);
      } else {
        const cols = Math.max(4, Math.floor(s.W / sz)), rows = Math.max(4, Math.floor(s.H / sz));
        const x0 = (s.W - cols * sz) / 2 + sz / 2, y0 = (s.H - rows * sz) / 2 + sz / 2;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            xs.push(x0 + c * sz); ys.push(y0 + r * sz); rs.push(0); as.push(0);
            /** @type {number[]} */ const v = [];
            if (c > 0) v.push(r * cols + c - 1);
            if (c < cols - 1) v.push(r * cols + c + 1);
            if (r > 0) v.push((r - 1) * cols + c);
            if (r < rows - 1) v.push((r + 1) * cols + c);
            nb.push(v);
          }
        }
        n = xs.length;
        // Entrance and goal on opposite sides of the longer axis.
        if (cols >= rows) { entry = rng.int(rows) * cols; goal = rng.int(rows) * cols + cols - 1; }
        else { entry = rng.int(cols); goal = (rows - 1) * cols + rng.int(cols); }
      }
      X = Float32Array.from(xs); Y = Float32Array.from(ys); ring = Int32Array.from(rs); ang = Float32Array.from(as);
    }

    /** Starts a fresh maze. @returns {void} */
    function reset() {
      build();
      open = Array.from({ length: n }, () => []);
      seen = new Uint8Array(n);
      for (const [cv, g] of /** @type {[HTMLCanvasElement, CanvasRenderingContext2D][]} */ ([[dug, gd], [trail, gt]])) {
        cv.width = Math.ceil(s.W); cv.height = Math.ceil(s.H);
        g.lineCap = 'round'; g.lineJoin = 'round';
      }
      gd.strokeStyle = C(0); gd.lineWidth = sz * 0.58;
      gt.strokeStyle = C(2); gt.lineWidth = sz * (layout === 1 ? 0.3 : 0.14);
      route = []; traced = 0; frontier = []; stack = [];
      phase = 'carve'; clock = 0; budget = 0;
      let s0 = layout === 2 ? 0 : entry;
      if (layout === 1) {
        // The crystal grows from the cell nearest the middle.
        for (let p = 0, bd = Infinity; p < n; p++) {
          const d = Math.hypot(X[p] - cx, Y[p] - cy);
          if (d < bd) { bd = d; s0 = p; }
        }
      }
      seen[s0] = 1; head = s0;
      if (layout === 1) frontier.push(...nb[s0]); else stack.push(s0);
      for (const q of frontier) seen[q] = 2;
    }

    /** Strokes the corridor from a to b on a layer. @param {CanvasRenderingContext2D} g
     * @param {number} a @param {number} b @returns {void} */
    function ink(g, a, b) {
      g.beginPath();
      link(g, a, b);
      g.stroke();
    }

    /** Joins a and b in the maze. @param {number} a @param {number} b @returns {void} */
    function join(a, b) {
      open[a].push(b); open[b].push(a);
      ink(gd, a, b);
    }

    /** One carving step; false once the maze is done. @returns {boolean} */
    function carve() {
      if (layout === 1) {
        // Grow from a random frontier cell into a random dug neighbour.
        if (!frontier.length) return false;
        const i = rng.int(frontier.length), p = frontier[i];
        frontier[i] = frontier[frontier.length - 1]; frontier.pop();
        const dug = nb[p].filter((q) => seen[q] === 1);
        join(p, dug[rng.int(dug.length)]);
        seen[p] = 1; head = p;
        for (const q of nb[p]) if (!seen[q]) { seen[q] = 2; frontier.push(q); }
        return true;
      }
      while (stack.length) {
        const p = stack[stack.length - 1];
        const free = nb[p].filter((q) => !seen[q]);
        if (!free.length) { stack.pop(); continue; }
        const q = free[rng.int(free.length)];
        join(p, q);
        seen[q] = 1; stack.push(q); head = q;
        return true;
      }
      return false;
    }

    /** Sets up the solver once the maze is dug. @returns {void} */
    function startSolve() {
      phase = 'solve';
      seen = new Uint8Array(n);
      seen[entry] = 1; head = entry;
      if (layout === 1) {
        parent = new Int32Array(n).fill(-1); dist = new Int32Array(n); queue = new Int32Array(n);
        queue[0] = entry; qh = 0; qt = 1; layer = 0;
      } else stack = [entry];
    }

    /** One solving step; false once the goal is found. @returns {boolean} */
    function solve() {
      if (layout === 1) {
        // The flood spreads one corridor-length a step, all of a wave at once.
        layer++;
        while (qh < qt && dist[queue[qh]] < layer) {
          const p = queue[qh++];
          for (const q of open[p]) {
            if (seen[q]) continue;
            seen[q] = 1; parent[q] = p; dist[q] = dist[p] + 1; queue[qt++] = q;
            gt.strokeStyle = C(Math.floor(dist[q] / 6) % nc + 1);
            ink(gt, p, q);
            if (q === goal) {
              route = [];
              for (let r = q; r >= 0; r = parent[r]) route.push(r);
              route.reverse();
              return false;
            }
          }
        }
        return qh < qt;
      }
      const p = stack[stack.length - 1];
      if (p === goal) { route = stack.slice(); return false; }
      // The unexplored turn that ends nearest the goal.
      let best = -1, bd = Infinity;
      for (const q of open[p]) {
        if (seen[q]) continue;
        const d = Math.hypot(X[q] - X[goal], Y[q] - Y[goal]) + rng.random() * sz * 0.5;
        if (d < bd) { bd = d; best = q; }
      }
      if (best < 0) {
        stack.pop();
        if (stack.length) ink(gt, p, stack[stack.length - 1]);
        else return false;
      } else { seen[best] = 1; stack.push(best); }
      head = stack[stack.length - 1];
      return true;
    }

    /** Advances `dt` seconds. @param {number} dt @returns {void} */
    function step(dt) {
      clock += dt;
      if (phase === 'carve') {
        // A maze takes about 25 seconds to dig, whatever its size.
        budget += dt * clamp((layout === 1 ? 1 : 2) * n / 25, 12, 90);
        while (budget >= 1) {
          budget--;
          if (!carve()) { startSolve(); budget = 0; clock = 0; break; }
        }
      } else if (phase === 'solve') {
        budget += dt * (layout === 1 ? 7 : 9);
        while (budget >= 1) {
          budget--;
          if (!solve()) { phase = 'trace'; clock = 0; break; }
        }
      } else if (phase === 'trace') {
        traced = Math.min(route.length, traced + dt * 30);
        if (traced >= route.length) { phase = 'hold'; clock = 0; }
      } else if (phase === 'hold') {
        if (clock > 5) { phase = 'fade'; clock = 0; }
      } else if (clock > 2.5) reset();
    }

    /** The path through `cells` (first `upto` of them) as one stroke. @param {number[]} cells
     * @param {number} upto @returns {Path2D} */
    function path(cells, upto) {
      const p = new Path2D();
      for (let i = 1; i < upto; i++) link(p, cells[i - 1], cells[i]);
      return p;
    }

    return {
      lay() {
        reset();
        // Start partly dug (fully solved under reduced motion), so the first frame shows a maze.
        if (s.reduced) {
          while (carve());
          startSolve();
          while (solve());
          phase = 'hold'; traced = route.length;
        } else {
          for (let i = Math.floor(n * (layout === 1 ? 0.35 : 0.7)); i > 0; i--) carve();
        }
      },
      step,
      draw() {
        const { ctx } = s;
        const m = phase === 'fade' ? Math.max(0, 1 - clock / 2.5) : 1;
        const A = s.dark ? 1 : 0.85;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.17 * m;
        ctx.drawImage(dug, 0, 0, dug.width, dug.height);
        if (phase !== 'carve') {
          ctx.globalAlpha = (layout === 1 ? 0.26 : 0.24) * A * m;
          ctx.drawImage(trail, 0, 0, trail.width, trail.height);
          // The route so far: the solver's trail while it searches, then the answer.
          const cells = phase === 'solve' ? (layout === 1 ? [] : stack) : route;
          const upto = phase === 'solve' ? cells.length : Math.ceil(traced);
          if (upto > 1) {
            ctx.globalAlpha = 0.55 * A * m;
            ctx.strokeStyle = C(1);
            ctx.lineWidth = sz * 0.22;
            ctx.stroke(path(cells, upto));
          }
          ctx.globalAlpha = 0.6 * A * m;
          ctx.fillStyle = C(1);
          for (const p of [entry, goal]) {
            ctx.beginPath();
            ctx.arc(X[p], Y[p], sz * 0.2, 0, TAU);
            ctx.fill();
          }
        }
        if ((phase === 'carve' || phase === 'solve') && head >= 0) {
          ctx.globalAlpha = 0.62 * A;
          ctx.fillStyle = C(phase === 'carve' ? 1 : 3);
          ctx.beginPath();
          ctx.arc(X[head], Y[head], sz * 0.2, 0, TAU);
          ctx.fill();
        }
      },
    };
  });
}
