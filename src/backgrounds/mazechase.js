// Maze chase: a round chomper works its way along the corridors of a maze eating the rows of
// dots, keeping clear of the wandering ghosts, and when the board is clear a new maze is drawn.
// The seed picks the variant: a random maze with loops over the whole host; a mirrored arcade
// board with tunnels off both sides and four big pellets that turn the ghosts pale so they flee
// (one caught runs home as a pair of eyes); or an endless maze scrolling slowly sideways, the
// chomper grazing along it while ghosts drift in from the right.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{r:Uint8Array, d:Uint8Array, n:Uint8Array, rd:Uint8Array, dd:Uint8Array}} Col
 * One column of nodes: links right and down, the node's dot (1 dot, 2 pellet) and the dots
 * halfway along its right and down links. */
/** @typedef {{x:number, y:number, d:number, ph:number, c:number, pale:number, tint:number, eyes:boolean, dead:number}} Actor
 * On node (x, y), heading d (-1 still) and ph 0..1 of the way to the next node; pale: seconds
 * left fleeing; tint 0..1 eased toward pale; dead: seconds since the chomper was caught (-1). */

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const arcade = layout === 1, scroll = layout === 2;
    const base = rng.int(nc);
    const SPEED = 2.6, GHOST = 1.9, SCROLL = 0.32; // nodes per second
    let p = 50, NC = 0, NR = 0, ox = 0, oy = 0, view = 0, NV = 0;
    /** Columns by index; a fixed maze holds 0..NC-1, a scrolling one what is in view. @type {Map<number, Col>} */
    let cols = new Map();
    let hi = 0; // next column a scrolling maze makes
    /** Eller's sets for the last column made. @type {Int32Array} */
    let sets = new Int32Array(0);
    let nextSet = 1;
    /** @type {Actor} */
    let chomp = actor(0, 0, base);
    /** @type {Actor[]} */
    let ghosts = [];
    let home = [0, 0], left = 0, phase = 'play', since = 0, mouth = 0, fadeA = 1;
    // Wall cache: walls of columns [cacheAt, cacheAt + cacheN) at device pixels.
    const walls = document.createElement('canvas');
    let cacheAt = 0, cacheN = 0;

    /** @param {number} x @param {number} y @param {number} c @returns {Actor} */
    function actor(x, y, c) { return { x, y, d: -1, ph: 0, c, pale: 0, tint: 0, eyes: false, dead: -1 }; }

    /** @returns {Col} */
    const col = () => ({ r: new Uint8Array(NR), d: new Uint8Array(NR), n: new Uint8Array(NR), rd: new Uint8Array(NR), dd: new Uint8Array(NR) });

    /** Column x, wrapped on a tunnel board. @param {number} x @returns {Col|undefined} */
    const at = (x) => cols.get(arcade ? ((x % NC) + NC) % NC : x);

    /** The link out of (x, y) heading d: [column, row, right?], or null when there is none.
     * @param {number} x @param {number} y @param {number} d @returns {[Col, number, boolean]|null} */
    function link(x, y, d) {
      if (d === 1 || d === 3) {
        const yy = d === 1 ? y : y - 1;
        const c = at(x);
        return c && yy >= 0 && yy < NR - 1 && c.d[yy] ? [c, yy, false] : null;
      }
      const xx = d === 0 ? x : x - 1;
      if (!arcade && !scroll && (xx < 0 || xx >= NC)) return null;
      const c = at(xx);
      return c && c.r[y] ? [c, y, true] : null;
    }

    /** Node x across a tunnel. @param {number} x */
    const wrapX = (x) => (arcade ? ((x % NC) + NC) % NC : x);

    /** @param {number} x @param {number} y @returns {boolean} the node or a link beside it still has a dot */
    function dotNear(x, y) {
      const c = at(x);
      if (!c) return false;
      if (c.n[y]) return true;
      for (let d = 0; d < 4; d++) {
        const l = link(x, y, d);
        if (l && (l[2] ? l[0].rd[l[1]] : l[0].dd[l[1]])) return true;
      }
      return false;
    }

    // ---- making mazes ----

    /** A fixed maze: a random spanning tree with most dead ends opened into loops, mirrored on
     * the arcade board, with a dot on every node and link. */
    function makeFixed() {
      cols = new Map();
      for (let x = 0; x < NC; x++) cols.set(x, col());
      const half = arcade ? Math.ceil(NC / 2) : NC;
      const seen = new Uint8Array(NC * NR);
      /** @param {number} x @param {number} y @param {number} d */
      const open = (x, y, d) => {
        if (d === 0) /** @type {Col} */ (cols.get(x)).r[y] = 1;
        else if (d === 2) /** @type {Col} */ (cols.get(x - 1)).r[y] = 1;
        else if (d === 1) /** @type {Col} */ (cols.get(x)).d[y] = 1;
        else /** @type {Col} */ (cols.get(x)).d[y - 1] = 1;
      };
      /** @param {number} x @param {number} y */
      const inside = (x, y) => x >= 0 && y >= 0 && x < half && y < NR;
      // Depth-first backtracker over the (left) half.
      const stack = [[rng.int(half), rng.int(NR)]];
      seen[stack[0][1] * NC + stack[0][0]] = 1;
      while (stack.length) {
        const [x, y] = stack[stack.length - 1];
        const ds = rng.shuffle([0, 1, 2, 3]).filter((d) => inside(x + DX[d], y + DY[d]) && !seen[(y + DY[d]) * NC + x + DX[d]]);
        if (!ds.length) { stack.pop(); continue; }
        const d = ds[0], nx = x + DX[d], ny = y + DY[d];
        open(x, y, d);
        seen[ny * NC + nx] = 1;
        stack.push([nx, ny]);
      }
      // Open most dead ends into loops.
      for (let y = 0; y < NR; y++) for (let x = 0; x < half; x++) {
        const ways = [0, 1, 2, 3].filter((d) => link(x, y, d));
        if (ways.length !== 1 || rng.random() < 0.12) continue;
        const ds = rng.shuffle([0, 1, 2, 3]).filter((d) => !link(x, y, d) && inside(x + DX[d], y + DY[d]));
        if (ds.length) open(x, y, ds[0]);
      }
      if (arcade) {
        // Mirror the left half (the middle column included; the board is odd) onto the right.
        for (let x = 0; x < half; x++) {
          const a = /** @type {Col} */ (cols.get(x)), b = /** @type {Col} */ (cols.get(NC - 1 - x));
          b.d.set(a.d);
          if (NC - 2 - x >= half - 1 && x < NC - 1) /** @type {Col} */ (cols.get(NC - 2 - x)).r.set(a.r);
        }
        // Tunnels off both sides, a third and two thirds of the way down.
        const last = /** @type {Col} */ (cols.get(NC - 1));
        last.r.fill(0);
        for (const y of [Math.floor(NR / 3), Math.floor(NR * 2 / 3)]) last.r[y] = 1;
      }
      for (const c of cols.values()) {
        c.n.fill(1);
        c.rd.set(c.r);
        c.dd.set(c.d);
      }
      if (arcade) {
        for (const [x, y] of [[1, 1], [NC - 2, 1], [1, NR - 2], [NC - 2, NR - 2]]) /** @type {Col} */ (cols.get(x)).n[y] = 2;
      }
      home = [Math.floor(NC / 2), Math.floor(NR / 2)];
      // The ghosts' start is bare.
      /** @type {Col} */ (cols.get(home[0])).n[home[1]] = 0;
      left = 0;
      for (const c of cols.values()) for (let y = 0; y < NR; y++) left += (c.n[y] ? 1 : 0) + c.rd[y] + c.dd[y];
    }

    /** The next column of an endless maze, by Eller's method run sideways, with a few extra
     * links so it has loops. */
    function makeColumn() {
      const c = col();
      const prev = cols.get(hi - 1);
      for (let y = 0; y < NR; y++) if (!prev || !prev.r[y]) sets[y] = nextSet++;
      for (let y = 0; y < NR - 1; y++) {
        if (sets[y] !== sets[y + 1] ? rng.random() < 0.55 : rng.random() < 0.14) {
          c.d[y] = 1;
          const from = sets[y + 1], to = sets[y];
          for (let k = 0; k < NR; k++) if (sets[k] === from) sets[k] = to;
        }
      }
      // Every set carries on into the next column at least once.
      /** @type {Map<number, number[]>} */
      const groups = new Map();
      for (let y = 0; y < NR; y++) {
        const g = groups.get(sets[y]);
        if (g) g.push(y); else groups.set(sets[y], [y]);
      }
      for (const g of groups.values()) {
        for (const y of g) if (rng.random() < 0.32) c.r[y] = 1;
        if (!g.some((y) => c.r[y])) c.r[g[rng.int(g.length)]] = 1;
      }
      c.n.fill(1); c.rd.set(c.r); c.dd.set(c.d);
      cols.set(hi++, c);
    }

    /** Draws the walls of columns from `x0` into the cache: the corridors stroked wide in the
     * wall colour, then their middles cut out, leaving a double line round every corridor.
     * @param {number} x0 */
    function paintWalls(x0) {
      const n = scroll ? NV + 10 : NC;
      cacheAt = scroll ? x0 : 0; cacheN = n;
      walls.width = Math.ceil((scroll ? n * p : s.W) * s.dpr);
      walls.height = s.cv.height;
      const g = walls.getContext('2d');
      if (!g) return;
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      const ox0 = scroll ? p / 2 : ox;
      g.beginPath();
      for (let x = cacheAt - 1; x < cacheAt + n; x++) {
        const c = cols.get(x);
        if (!c) continue;
        const sx = ox0 + (x - cacheAt) * p;
        for (let y = 0; y < NR; y++) {
          const sy = oy + y * p;
          if (c.r[y]) {
            g.moveTo(sx, sy);
            // A tunnel runs off the edge of the host.
            g.lineTo(arcade && x === NC - 1 ? s.W + p : sx + p, sy);
            if (arcade && x === NC - 1) { g.moveTo(-p, sy); g.lineTo(ox0, sy); }
          }
          if (c.d[y]) { g.moveTo(sx, sy); g.lineTo(sx, sy + p); }
        }
      }
      const w = p * 0.6;
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = s.colors[(base + 4) % nc];
      g.lineWidth = w + 4;
      g.stroke();
      g.globalCompositeOperation = 'destination-out';
      g.lineWidth = w;
      g.stroke();
      g.globalCompositeOperation = 'source-over';
    }

    // ---- moving ----

    /** Breadth-first from (x, y) to the nearest node `want` accepts, with `bad` nodes avoided;
     * the first heading on the way, or -1. Only nodes within columns [lo, hi2] count.
     * @param {Actor} a @param {(x:number, y:number) => boolean} want @param {(x:number, y:number) => boolean} bad
     * @param {number} lo @param {number} hi2 @returns {number} */
    function route(a, want, bad, lo, hi2) {
      lo = Math.min(lo, a.x); hi2 = Math.max(hi2, a.x);
      const w = hi2 - lo + 1;
      const first = new Int8Array(w * NR).fill(-1);
      const q = [a.x, a.y];
      first[(a.x - lo) * NR + a.y] = 4;
      for (let h = 0; h < q.length; h += 2) {
        const x = q[h], y = q[h + 1], f = first[(x - lo) * NR + y];
        if (h && want(x, y)) return f;
        for (let d = 0; d < 4; d++) {
          if (!link(x, y, d)) continue;
          const nx = wrapX(x + DX[d]), ny = y + DY[d];
          if (nx < lo || nx > hi2) continue;
          const k = (nx - lo) * NR + ny;
          if (first[k] >= 0 || bad(nx, ny)) continue;
          first[k] = h ? f : d;
          q.push(nx, ny);
        }
      }
      return -1;
    }

    /** @param {Actor} a @returns {number[]} the ways out of a's node */
    const ways = (a) => [0, 1, 2, 3].filter((d) => link(a.x, a.y, d));

    /** Where the chomper goes next. @returns {number} */
    function chompWay() {
      const lo = scroll ? Math.ceil(view) + 1 : 0, hi2 = scroll ? Math.floor(view) + NV - 2 : NC - 1;
      const near = ghosts.filter((g) => !g.eyes && g.pale <= 0);
      /** @param {number} x @param {number} y */
      const bad = (x, y) => near.some((g) => {
        // A ghost's node, the one it is heading to, and the ways on from there.
        const gx = g.d >= 0 ? wrapX(g.x + DX[g.d]) : g.x, gy = g.d >= 0 ? g.y + DY[g.d] : g.y;
        let dx = Math.abs(gx - x);
        if (arcade) dx = Math.min(dx, NC - dx);
        return (g.x === x && g.y === y) || dx + Math.abs(gy - y) <= 1;
      });
      const pale = ghosts.filter((g) => !g.eyes && g.pale > 1);
      const lo2 = scroll && chomp.x < view + 3 ? Math.ceil(view) + 3 : lo;
      /** @param {number} x @param {number} y */
      const want = (x, y) => x >= lo2 && (dotNear(x, y) || pale.some((g) => g.x === x && g.y === y));
      let d = route(chomp, want, bad, lo, hi2);
      if (d >= 0) return d;
      // No safe way to a dot: any way that is not toward a ghost, else the way to the dots.
      const safe = ways(chomp).filter((e) => !bad(wrapX(chomp.x + DX[e]), chomp.y + DY[e]));
      if (safe.length && near.length) return safe[rng.int(safe.length)];
      d = route(chomp, want, () => false, lo, hi2);
      if (d >= 0) return d;
      const ws = ways(chomp).filter((e) => !scroll || chomp.x + DX[e] >= lo);
      const on = ws.filter((e) => e !== (chomp.d + 2) % 4);
      const pick = on.length ? on : ws;
      return pick.length ? pick[rng.int(pick.length)] : -1;
    }

    /** Where a ghost goes next: mostly on at random, sometimes toward (or, pale, away from)
     * the chomper; eyes head straight home. @param {Actor} g @returns {number} */
    function ghostWay(g) {
      if (g.eyes) return route(g, (x, y) => x === home[0] && y === home[1], () => false, 0, NC - 1);
      const ws = ways(g);
      const on = ws.filter((e) => e !== (g.d + 2) % 4);
      const pick = on.length ? on : ws;
      if (!pick.length) return -1;
      if (rng.random() < (g.pale > 0 ? 0.7 : 0.3)) {
        const dist = (/** @type {number} */ e) => Math.abs(g.x + DX[e] - chomp.x) + Math.abs(g.y + DY[e] - chomp.y);
        const sorted = pick.slice().sort((a, b) => dist(a) - dist(b));
        return g.pale > 0 ? sorted[sorted.length - 1] : sorted[0];
      }
      return pick[rng.int(pick.length)];
    }

    /** Eats the dot on the link `a` is crossing, or on the node it reached. @param {Actor} a @param {boolean} node */
    function eat(a, node) {
      if (node) {
        const c = at(a.x);
        if (c && c.n[a.y]) {
          if (c.n[a.y] === 2) for (const g of ghosts) if (!g.eyes) g.pale = 7;
          c.n[a.y] = 0; left--;
        }
        return;
      }
      const l = link(a.x, a.y, a.d);
      if (!l) return;
      const arr = l[2] ? l[0].rd : l[0].dd;
      if (arr[l[1]]) { arr[l[1]] = 0; left--; }
    }

    /** Moves `a` on by `dist` nodes, choosing at each node. @param {Actor} a @param {number} dist @param {(a:Actor) => number} way @param {boolean} eats */
    function move(a, dist, way, eats) {
      while (dist > 0) {
        if (a.d < 0) { a.d = way(a); if (a.d < 0) return; }
        const was = a.ph;
        a.ph = Math.min(1, a.ph + dist);
        dist -= a.ph - was;
        if (eats && was < 0.5 && a.ph >= 0.5) eat(a, false);
        if (a.ph < 1) return;
        a.x = wrapX(a.x + DX[a.d]); a.y += DY[a.d]; a.ph = 0;
        if (eats) eat(a, true);
        a.d = way(a);
        if (a.d < 0) return;
      }
    }

    /** Puts the chomper and ghosts at their starts. */
    function places() {
      if (scroll) {
        const x = Math.floor(view) + Math.floor(NV * 0.3);
        chomp = actor(x, Math.floor(NR / 2), base);
        ghosts = [1, 2, 3].map((k) => actor(Math.floor(view) + NV - 2 - k, rng.int(NR), (base + k) % nc));
      } else {
        chomp = actor(home[0], Math.min(NR - 1, home[1] + Math.max(1, Math.floor(NR / 4))), base);
        const n = clamp(Math.round(NC * NR / 70), 2, 4);
        ghosts = Array.from({ length: n }, (_, k) => actor(home[0], home[1], (base + 1 + k) % nc));
      }
      eat(chomp, true);
    }

    /** @param {number} dt */
    function advance(dt) {
      since += dt;
      mouth += dt;
      if (scroll) {
        view += SCROLL * dt;
        // Made well ahead, so the wall cache always has the columns it spans.
        while (hi < Math.floor(view) + NV + 12) makeColumn();
        for (const k of cols.keys()) if (k < Math.floor(view) - 2) cols.delete(k);
        if (view - cacheAt > 8) paintWalls(Math.floor(view) - 1);
        // Ghosts left behind come back in from the right.
        for (const g of ghosts) {
          if (g.x < view - 1) Object.assign(g, actor(Math.floor(view) + NV, rng.int(NR), g.c));
        }
        if (chomp.x < view - 0.5) Object.assign(chomp, actor(Math.floor(view) + Math.floor(NV * 0.3), Math.floor(NR / 2), base));
      } else if (phase === 'clear') {
        // Hold, fade out, then a new maze.
        if (since > 2.6) { makeFixed(); paintWalls(0); places(); phase = 'in'; since = 0; }
        return;
      } else if (phase === 'in' && since > 1) phase = 'play';
      if (chomp.dead >= 0) {
        chomp.dead += dt;
        if (chomp.dead > 2) { const { c } = chomp; places(); chomp.c = c; }
      } else {
        dodge();
        move(chomp, SPEED * dt, chompWay, true);
      }
      for (const g of ghosts) {
        g.pale = Math.max(0, g.pale - dt);
        g.tint += clamp((g.pale > 0 ? 1 : 0) - g.tint, -dt, dt);
        move(g, (g.eyes ? 4 : g.pale > 0 ? 0.65 : 1) * GHOST * dt, ghostWay, false);
        if (g.eyes && g.x === home[0] && g.y === home[1] && g.ph === 0) { g.eyes = false; g.pale = 0; }
        if (chomp.dead >= 0 || g.eyes) continue;
        const [ax, ay] = spot(chomp), [bx, by] = spot(g);
        if (Math.hypot(ax - bx, ay - by) < 0.42) {
          if (g.pale > 0) { g.eyes = true; g.pale = 0; g.d = -1; g.ph = 0; }
          else chomp.dead = 0;
        }
      }
      if (!scroll && phase === 'play' && left <= 0) { phase = 'clear'; since = 0; }
    }

    /** Turns the chomper back along its link when a ghost comes at it. */
    function dodge() {
      const a = chomp;
      if (a.d < 0) return;
      const [cx, cy] = spot(a);
      for (const g of ghosts) {
        if (g.eyes || g.pale > 0) continue;
        const [gx, gy] = spot(g);
        const ahead = (gx - cx) * DX[a.d] + (gy - cy) * DY[a.d];
        // Ahead of it and close, coming the other way or across: not one it is following.
        const toward = g.d < 0 || DX[g.d] * DX[a.d] + DY[g.d] * DY[a.d] <= 0;
        if (ahead > 0.1 && Math.hypot(gx - cx, gy - cy) < 1.3 && toward) {
          a.x = wrapX(a.x + DX[a.d]); a.y += DY[a.d]; a.d = (a.d + 2) % 4; a.ph = 1 - a.ph;
          return;
        }
      }
    }

    /** Where `a` is, in nodes (unwrapped across a tunnel). @param {Actor} a @returns {number[]} */
    function spot(a) {
      const d = a.d < 0 ? 0 : a.d;
      let x = a.x + DX[d] * a.ph;
      if (arcade && x > NC - 0.5) x -= NC;
      return [x, a.y + DY[d] * a.ph];
    }

    /** @param {number} x @param {number} y @returns {number[]} screen px of node coordinates */
    const scr = (x, y) => [ox + (x - view) * p, oy + y * p];

    function build() {
      const m = Math.min(s.W, s.H);
      p = clamp(Math.round(m / (scroll ? 10 : 11)), 30, 66);
      NR = Math.max(5, Math.floor(s.H / p));
      oy = (s.H - (NR - 1) * p) / 2;
      sets = new Int32Array(NR);
      since = 0; phase = 'play';
      if (scroll) {
        NV = Math.ceil(s.W / p) + 1;
        ox = p / 2;
        view = 0; hi = -2; cols = new Map(); nextSet = 1;
        while (hi < NV + 12) makeColumn();
        paintWalls(-1);
        home = [0, 0];
      } else {
        NC = Math.max(5, Math.floor(s.W / p));
        if (arcade && NC % 2 === 0) NC--;
        ox = (s.W - (NC - 1) * p) / 2;
        view = 0;
        makeFixed();
        paintWalls(0);
      }
      places();
      // Run a little so a still frame shows a trail already eaten.
      for (let i = 0; i < 120; i++) advance(1 / 30);
    }

    /** The chomper: a disc with a wedge mouth opening and closing toward its heading. */
    function drawChomp() {
      const { ctx } = s;
      const a = chomp;
      const fade = a.dead >= 0 ? clamp(1 - a.dead, 0, 1) : 1;
      if (fade <= 0) return;
      const [nx, ny] = spot(a);
      const [x, y] = scr(nx, ny);
      const r = p * 0.27 * (a.dead >= 0 ? 0.6 + 0.4 * fade : 1);
      const open = 0.08 + 0.55 * (0.5 + 0.5 * Math.sin(mouth * TAU * 2.6));
      const ang = [0, Math.PI / 2, Math.PI, -Math.PI / 2][a.d < 0 ? 0 : a.d];
      ctx.globalAlpha = 0.62 * fade * fadeA;
      ctx.fillStyle = s.colors[a.c];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, ang + open, ang + TAU - open);
      ctx.closePath();
      ctx.fill();
    }

    /** A ghost: a domed body with a flat, rounded base, eyes looking where it goes. @param {Actor} g */
    function drawGhost(g) {
      const { ctx } = s;
      const [nx, ny] = spot(g);
      const [x, y] = scr(nx, ny);
      const r = p * 0.26;
      if (!g.eyes) {
        ctx.fillStyle = s.colors[g.c];
        ctx.globalAlpha = 0.55 * (1 - g.tint * 0.6) * fadeA;
        body(x, y, r);
        if (g.tint > 0) {
          ctx.fillStyle = s.ink;
          ctx.globalAlpha = 0.35 * g.tint * fadeA;
          body(x, y, r);
        }
      }
      const d = g.d < 0 ? 0 : g.d;
      ctx.globalAlpha = (g.eyes ? 0.62 : 0.7 * (1 - g.tint * 0.5)) * fadeA;
      ctx.fillStyle = s.dark ? '#fff' : '#fdfdfd';
      ctx.beginPath();
      for (const e of [-1, 1]) ctx.ellipse(x + e * r * 0.38, y - r * 0.18, r * 0.24, r * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = s.dark ? '#222' : '#333';
      ctx.beginPath();
      for (const e of [-1, 1]) ctx.arc(x + e * r * 0.38 + DX[d] * r * 0.11, y - r * 0.18 + DY[d] * r * 0.13, r * 0.12, 0, TAU);
      ctx.fill();
    }

    /** @param {number} x @param {number} y @param {number} r */
    function body(x, y, r) {
      const { ctx } = s;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.1, r, Math.PI, 0);
      ctx.lineTo(x + r, y + r * 0.62);
      ctx.quadraticCurveTo(x + r, y + r * 0.9, x + r * 0.7, y + r * 0.9);
      ctx.lineTo(x - r * 0.7, y + r * 0.9);
      ctx.quadraticCurveTo(x - r, y + r * 0.9, x - r, y + r * 0.62);
      ctx.closePath();
      ctx.fill();
    }

    return {
      lay: build,
      step: advance,
      draw() {
        const { ctx } = s;
        let a = 1;
        if (phase === 'clear') a = clamp(1 - (since - 1.2) / 1.4, 0, 1);
        else if (phase === 'in') a = clamp(since, 0, 1);
        // Walls.
        ctx.globalAlpha = (s.dark ? 0.42 : 0.4) * a;
        if (scroll) {
          ctx.drawImage(walls, ox - p / 2 + (cacheAt - view) * p, 0, walls.width / s.dpr, walls.height / s.dpr);
        } else {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(walls, 0, 0);
          ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
        }
        // Dots, in one path; pellets breathe slowly.
        const lo = Math.floor(view) - 1, hi2 = Math.ceil(view) + (scroll ? NV + 1 : NC);
        const k = Math.max(1.5, p * 0.06);
        ctx.fillStyle = s.ink;
        ctx.globalAlpha = (s.dark ? 0.5 : 0.48) * a;
        ctx.beginPath();
        /** @type {number[]} */
        const pellets = [];
        for (let x = lo; x <= hi2; x++) {
          const c = cols.get(x);
          if (!c) continue;
          for (let y = 0; y < NR; y++) {
            const [sx, sy] = scr(x, y);
            if (c.n[y] === 1) ctx.rect(sx - k, sy - k, k * 2, k * 2);
            else if (c.n[y] === 2) pellets.push(sx, sy);
            if (c.rd[y] && !(arcade && x === NC - 1)) ctx.rect(sx + p / 2 - k, sy - k, k * 2, k * 2);
            if (c.dd[y]) ctx.rect(sx - k, sy + p / 2 - k, k * 2, k * 2);
          }
        }
        ctx.fill();
        if (pellets.length) {
          ctx.globalAlpha = (0.38 + 0.2 * Math.sin(s.t * TAU / 2.4)) * a;
          ctx.beginPath();
          for (let i = 0; i < pellets.length; i += 2) {
            ctx.moveTo(pellets[i] + p * 0.17, pellets[i + 1]);
            ctx.arc(pellets[i], pellets[i + 1], p * 0.17, 0, TAU);
          }
          ctx.fill();
        }
        fadeA = a;
        drawChomp();
        for (const g of ghosts) drawGhost(g);
        ctx.globalAlpha = 1;
      },
    };
  });
}
