// Tangram: the seven tangram pieces slide and turn from one figure to the next (a cat, a boat, an
// arrow, a fish, a hexagon, a mountain, the square), hold it, and rearrange. The seed picks the
// variant: a grid of sets, each gliding all seven pieces into its next figure at once; a grid of
// puzzle cards, where the next figure's silhouette appears beside the last and the pieces are
// carried over one by one, biggest first; or a few large sets whose pieces drift loose across the
// screen, slowly turning, then gather into a figure somewhere, hold, and drift apart again.

import { stage, TAU, clamp, mix } from './stage.js';

const Q4 = Math.PI / 2;

// The pieces in units where the whole square is 4 by 4: two large triangles, the medium one, two
// small ones, the square and the parallelogram. per: the turn that maps a piece onto itself.
/** @type {{v:number[][], per:number}[]} */
const RAW = [
  { v: [[0, 0], [4, 0], [2, 2]], per: TAU }, { v: [[0, 0], [4, 0], [2, 2]], per: TAU },
  { v: [[0, 0], [2, 0], [0, 2]], per: TAU },
  { v: [[0, 0], [2, 0], [1, 1]], per: TAU }, { v: [[0, 0], [2, 0], [1, 1]], per: TAU },
  { v: [[1, 0], [2, 1], [1, 2], [0, 1]], per: Q4 },
  { v: [[0, 0], [2, 0], [3, 1], [1, 1]], per: Math.PI },
];

/** @typedef {{v:number[][], c:number[], per:number, eq:number}} Shape
 * v: corners about the centroid c; eq: the quarter turns a mirrored piece equals (-1: none). */
/** @type {Shape[]} */
const SHAPES = RAW.map(({ v, per }) => {
  const c = [v.reduce((t, p) => t + p[0], 0) / v.length, v.reduce((t, p) => t + p[1], 0) / v.length];
  const w = v.map((p) => [p[0] - c[0], p[1] - c[1]]);
  let eq = -1;
  for (let e = 0; e < 4 && eq < 0; e++) {
    const r = w.map((p) => turn(p, e));
    if (w.every((p) => r.some((q) => Math.abs(q[0] + p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6))) eq = e;
  }
  return { v: w, c, per, eq };
});

/** @param {number[]} p @param {number} k quarter turns @returns {number[]} */
function turn(p, k) {
  let [x, y] = p;
  for (let r = 0; r < ((k % 4) + 4) % 4; r++) [x, y] = [-y, x];
  return [x, y];
}

// Solved on the quarter-triangle lattice, so the pieces meet exactly. Per piece, in SHAPES order:
// quarter turns, mirrored or not, and the offset (piece = turn(mirror(shape)) + offset).
/** @type {Record<string, number[]>} */
const FIGS = {
  square: [0, 0, 0, 0, 3, 0, 0, 4, 2, 0, 4, 4, 2, 0, 2, 4, 1, 0, 3, 1, 0, 0, 1, 2, 1, 0, 4, 0],
  mountain: [2, 0, 4, 4, 1, 0, 4, 0, 3, 0, 4, 4, 3, 0, 4, 2, 2, 0, 7, 3, 0, 0, 4, 1, 0, 0, 5, 3],
  arrow: [0, 0, -1, 1, 2, 0, 5, 3, 0, 0, 3, 3, 2, 0, 1, 3, 3, 0, 4, 2, 0, 0, 4, 1, 1, 1, 4, 2],
  cat: [1, 0, 2, 3, 3, 0, 2, 7, 3, 0, 0, 7, 3, 0, 1, 2, 1, 0, 3, 0, 0, 0, 1, 1, 0, 1, 6, 5],
  boat: [0, 0, 0, 3, 2, 0, 6, 5, 2, 0, 4, 3, 3, 0, 4, 3, 0, 0, 5, 4, 0, 0, 4, 2, 0, 1, 8, 3],
  hexagon: [1, 0, 1, 0, 3, 0, 1, 4, 1, 0, 3, 0, 2, 0, 3, 4, 3, 0, 4, 3, 0, 0, 2, 2, 1, 1, 4, 3],
  fish: [1, 0, 4, 0, 1, 0, 6, 0, 3, 0, 1, 3, 1, 0, 1, 1, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 1, 3],
};
const NAMES = Object.keys(FIGS);
// The figures that still read when turned a quarter (the rest only mirror).
const TURNS = { square: 4, hexagon: 2, arrow: 4 };
// The order a puzzle card is solved in: big pieces first.
const BIG_FIRST = [0, 1, 2, 5, 6, 3, 4];

/** @typedef {{x:number, y:number, a:number, f:number}[]} Fig piece centres in units about the
 * figure's middle, turn in radians, f 1 when mirrored */
/** @typedef {{x:number, y:number, a:number, sc:number, fx:number, fy:number, fa:number, fs:number,
 *   tx:number, ty:number, ta:number, ts:number, t0:number, d:number, bend:number, vx:number,
 *   vy:number, w:number}} Piece
 * x, y in CSS px, a its turn, sc the x scale (-1 mirrored; between while it turns over); f* where
 * a move began, t* where it ends, from t0 for d s (d 0: still), bend how far it arcs; v*, w drift. */
/** @typedef {{cx:number, cy:number, ox:number, oy:number, side:number, pcs:Piece[], fig:Fig, prev:Fig,
 *   gx:number, gy:number, phase:number, at:number, k:number, sil:number, c0:number}} Set
 * cx, cy its middle; ox, oy the offset to each side of a card; fig the figure it is making, at
 * gx, gy; prev the one before (on a card's other side); phase 0 holding, 1 moving, 2 drifting
 * (layout 2); at when the phase ends; k pieces placed so far on a card; sil the silhouette's
 * strength. */

/** @param {string} id @param {number} kk quarter turns of the whole @param {number} gm mirrored @returns {Fig} */
function figure(id, kk, gm) {
  const raw = FIGS[id];
  /** @type {Fig} */
  const out = [];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 7; i++) {
    const [k, f, dx, dy] = raw.slice(i * 4, i * 4 + 4), sh = SHAPES[i];
    let [x, y] = turn([f ? -sh.c[0] : sh.c[0], sh.c[1]], k);
    x += dx; y += dy;
    let q = k, fl = f;
    if (gm) { x = -x; q = -q; fl ^= 1; }
    [x, y] = turn([x, y], kk);
    q += kk;
    if (fl && sh.eq >= 0) { q += sh.eq; fl = 0; }
    const p = { x, y, a: q * Q4, f: fl };
    for (const [vx, vy] of sh.v) {
      const [rx, ry] = turn([fl ? -vx : vx, vy], q);
      x0 = Math.min(x0, x + rx); x1 = Math.max(x1, x + rx); y0 = Math.min(y0, y + ry); y1 = Math.max(y1, y + ry);
    }
    out.push(p);
  }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  for (const p of out) { p.x -= mx; p.y -= my; }
  return out;
}

/** @param {number} t 0..1 @returns {number} */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const FILL = s.dark ? 0.3 : 0.34, EDGE = s.dark ? 0.62 : 0.66, SIL = s.dark ? 0.1 : 0.12;
    /** @type {Set[]} */
    let sets = [];
    let u = 20, lw = 1.5, last = '';

    /** A figure unlike `not`, turned and mirrored at random. @param {string} [not] @returns {Fig} */
    function pick(not) {
      let id = NAMES[rng.int(NAMES.length)];
      if (id === not) id = NAMES[(NAMES.indexOf(id) + 1 + rng.int(NAMES.length - 1)) % NAMES.length];
      last = id;
      const fig = figure(id, rng.int(/** @type {Record<string, number>} */ (TURNS)[id] ?? 1), rng.int(2));
      /** @type {any} */ (fig).id = id;
      return fig;
    }

    /** @returns {Piece} */
    const piece = () => ({ x: 0, y: 0, a: 0, sc: 1, fx: 0, fy: 0, fa: 0, fs: 1, tx: 0, ty: 0, ta: 0,
      ts: 1, t0: 0, d: 0, bend: 0, vx: 0, vy: 0, w: 0 });

    /** Puts every piece of `set` where `fig` has it, centred on gx, gy. @param {Set} set */
    function settle(set) {
      set.pcs.forEach((p, i) => {
        const q = set.fig[i];
        p.x = set.gx + q.x * u; p.y = set.gy + q.y * u; p.a = q.a; p.sc = q.f ? -1 : 1; p.d = 0;
      });
    }

    /** Starts piece i of `set` towards its place in the set's figure. @param {Set} set
     * @param {number} i @param {number} t0 @param {number} d */
    function send(set, i, t0, d) {
      const p = set.pcs[i], q = set.fig[i], per = SHAPES[i].per;
      p.fx = p.x; p.fy = p.y; p.fa = p.a; p.fs = p.sc;
      p.tx = set.gx + q.x * u; p.ty = set.gy + q.y * u;
      // The nearest turn that lands the same, and never more than half a turn more.
      p.ta = q.a + per * Math.round((p.a - q.a) / per);
      if (p.ta - p.a > Math.PI) p.ta -= per; else if (p.a - p.ta > Math.PI) p.ta += per;
      p.ts = q.f ? -1 : 1; p.t0 = t0; p.d = d; p.bend = (rng.random() - 0.5) * 0.5;
    }

    /** Swaps the twin pieces' places in the new figure when that shortens their trip. @param {Set} set */
    function pair(set) {
      for (const [i, j] of [[0, 1], [3, 4]]) {
        const a = set.pcs[i], b = set.pcs[j], fi = set.fig[i], fj = set.fig[j];
        const d = (/** @type {Piece} */ p, /** @type {{x:number, y:number}} */ q) =>
          Math.hypot(p.x - set.gx - q.x * u, p.y - set.gy - q.y * u);
        if (d(a, fj) + d(b, fi) < d(a, fi) + d(b, fj)) { set.fig[i] = fj; set.fig[j] = fi; }
      }
    }

    /** Where a set's next figure goes (layout 2): away from the other sets and, where it can be,
     * out from under the board in the middle. @param {Set} set */
    function spot(set) {
      let best = -Infinity;
      for (let k = 0; k < 10; k++) {
        const x = mix(5 * u, s.W - 5 * u, rng.random()), y = mix(4.5 * u, s.H - 4.5 * u, rng.random());
        let far = s.W + s.H;
        for (const o of sets) if (o !== set) far = Math.min(far, Math.hypot(o.gx - x, o.gy - y));
        const score = Math.min(far, 14 * u) + 0.8 * Math.hypot(x - s.W / 2, y - s.H / 2);
        if (score > best) { best = score; set.gx = x; set.gy = y; }
      }
    }

    /** Sets loose pieces drifting off in new directions. @param {Set} set */
    function scatter(set) {
      for (const p of set.pcs) {
        const a = rng.random() * TAU, v = u * (0.7 + rng.random() * 0.7);
        p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
        p.w = (rng.random() < 0.5 ? -1 : 1) * (0.15 + rng.random() * 0.25); p.d = 0;
      }
    }

    /** The grid of sets (or cards) for this size. @returns {{cx:number, cy:number, ox:number, oy:number}[]} */
    function slots() {
      const m = Math.min(s.W, s.H);
      if (layout === 2) {
        const n = clamp(Math.round(s.W * s.H / 300000), 1, 5);
        u = clamp(m * 0.046, 14, 42);
        return Array.from({ length: n }, () => ({ cx: 0, cy: 0, ox: 0, oy: 0 }));
      }
      const slot = clamp(m * 0.42, 170, 330), wide = s.W >= s.H;
      const pw = layout === 1 && wide ? 2 : 1, ph = layout === 1 && !wide ? 2 : 1;
      const cols = Math.max(1, Math.round(s.W / (slot * pw))), rows = Math.max(1, Math.round(s.H / (slot * ph)));
      const cw = s.W / cols, ch = s.H / rows;
      u = Math.min(cw / pw / 9.5, ch / ph / 8.5);
      /** @type {{cx:number, cy:number, ox:number, oy:number}[]} */
      const out = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          out.push({ cx: (c + 0.5) * cw, cy: (r + 0.5) * ch, ox: pw > 1 ? cw / 4 : 0, oy: ph > 1 ? ch / 4 : 0 });
        }
      }
      return out.slice(0, 18);
    }

    /** A new set at `sl`, mid-way through its cycle so a still frame shows its idea.
     * @param {{cx:number, cy:number, ox:number, oy:number}} sl @returns {Set} */
    function make(sl) {
      const fig = pick(last);
      /** @type {Set} */
      const set = { ...sl, side: -1, pcs: Array.from({ length: 7 }, piece), fig, prev: fig, gx: 0, gy: 0,
        phase: 0, at: s.t + 0.5 + rng.random() * 5, k: 0, sil: 0, c0: rng.int(7) };
      if (layout === 2) {
        spot(set); settle(set); set.at = s.t + 2 + rng.random() * 4;
      } else {
        set.gx = set.cx - set.ox; set.gy = set.cy - set.oy;
        settle(set);
        if (layout === 1) {
          // Part-way through carrying the pieces over to the next figure's silhouette.
          set.fig = pick(/** @type {any} */ (fig).id); set.side = 1;
          set.gx = set.cx + set.ox; set.gy = set.cy + set.oy;
          pair(set);
          set.k = rng.int(4); set.sil = 1; set.phase = 1; set.at = s.t + 0.6;
          for (let j = 0; j < set.k; j++) { const i = BIG_FIRST[j]; send(set, i, 0, 1); finish(set.pcs[i]); }
        }
      }
      return set;
    }

    /** @param {Piece} p */
    function finish(p) { p.x = p.tx; p.y = p.ty; p.a = p.ta; p.sc = p.ts; p.d = 0; }

    /** @param {Set} set @param {number} dt */
    function tick(set, dt) {
      if (layout === 0) {
        if (s.t < set.at) return;
        if (set.phase === 0) {
          set.fig = pick(/** @type {any} */ (set.fig).id); pair(set);
          rng.shuffle([0, 1, 2, 3, 4, 5, 6]).forEach((i, o) => send(set, i, s.t + o * 0.16, 1.8));
          set.phase = 1; set.at = s.t + 6 * 0.16 + 1.9;
        } else { set.phase = 0; set.at = s.t + 4.5 + rng.random() * 3; }
      } else if (layout === 1) {
        set.sil = clamp(set.sil + (set.phase === 1 ? 1 : -0.7) * dt, 0, 1);
        if (s.t < set.at) return;
        if (set.phase === 0) {
          // Next figure on the other side: its silhouette first, then the pieces one by one.
          set.side = -set.side; set.gx = set.cx + set.side * set.ox; set.gy = set.cy + set.side * set.oy;
          set.prev = set.fig; set.fig = pick(/** @type {any} */ (set.fig).id); pair(set);
          set.phase = 1; set.k = 0; set.at = s.t + 1.4;
        } else if (set.k < 7) {
          send(set, BIG_FIRST[set.k], s.t, 1.35); set.k++; set.at = s.t + 1.6;
        } else { set.phase = 0; set.at = s.t + 4 + rng.random() * 2.5; }
      } else if (s.t >= set.at) {
        if (set.phase === 0) { scatter(set); set.phase = 2; set.at = s.t + 7 + rng.random() * 4; }
        else if (set.phase === 2) {
          spot(set); set.fig = pick(/** @type {any} */ (set.fig).id); pair(set);
          set.pcs.forEach((_, i) => send(set, i, s.t + rng.random() * 0.8, 3.2));
          set.phase = 1; set.at = s.t + 4.2;
        } else { set.phase = 0; set.at = s.t + 5 + rng.random() * 3; }
      }
    }

    /** @param {Piece} p @param {number} dt */
    function move(p, dt) {
      if (p.d > 0) {
        if (s.t < p.t0) return;
        const e = ease(clamp((s.t - p.t0) / p.d, 0, 1));
        const dx = p.tx - p.fx, dy = p.ty - p.fy, b = p.bend * Math.sin(Math.PI * e);
        p.x = mix(p.fx, p.tx, e) - dy * b; p.y = mix(p.fy, p.ty, e) + dx * b;
        p.a = mix(p.fa, p.ta, e);
        // Turning over: the x scale passes through edge-on and out the other side.
        p.sc = p.fs === p.ts ? p.ts : p.fs * Math.cos(Math.PI * e);
        if (e >= 1) finish(p);
      } else if (p.vx || p.vy) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.w * dt;
        const m = 1.5 * u;
        if (p.x < m && p.vx < 0 || p.x > s.W - m && p.vx > 0) p.vx = -p.vx;
        if (p.y < m && p.vy < 0 || p.y > s.H - m && p.vy > 0) p.vy = -p.vy;
      }
    }

    /** Adds a piece's outline to the path. @param {number} i @param {number} x @param {number} y
     * @param {number} a @param {number} sc */
    function outline(i, x, y, a, sc) {
      const { ctx } = s, cs = Math.cos(a) * u, sn = Math.sin(a) * u, v = SHAPES[i].v;
      for (let j = 0; j < v.length; j++) {
        const qx = v[j][0] * sc, qy = v[j][1];
        if (j) ctx.lineTo(x + qx * cs - qy * sn, y + qx * sn + qy * cs);
        else ctx.moveTo(x + qx * cs - qy * sn, y + qx * sn + qy * cs);
      }
      ctx.closePath();
    }

    return {
      lay() {
        const sl = slots();
        lw = clamp(u * 0.07, 1.2, 2.4);
        if (layout === 2) {
          const sx = sets.length ? s.W / (sets[0].cx || s.W) : 1, sy = sets.length ? s.H / (sets[0].cy || s.H) : 1;
          for (const set of sets) {
            set.gx = clamp(set.gx * sx, 5 * u, s.W - 5 * u); set.gy = clamp(set.gy * sy, 4.5 * u, s.H - 4.5 * u);
            for (const p of set.pcs) { p.x = clamp(p.x * sx, 0, s.W); p.y = clamp(p.y * sy, 0, s.H); }
            if (set.phase !== 2) settle(set);
          }
          while (sets.length < sl.length) sets.push(make(sl[sets.length]));
          sets.length = sl.length;
          for (const set of sets) { set.cx = s.W; set.cy = s.H; }
          return;
        }
        // A new grid: keep each set's figure, settled into its new slot.
        const old = sets;
        sets = sl.map((q, n) => {
          const o = old[n];
          if (!o) return make(q);
          Object.assign(o, q);
          o.gx = o.cx + (layout === 1 ? o.side : -1) * o.ox; o.gy = o.cy + (layout === 1 ? o.side : -1) * o.oy;
          if (layout === 1 && o.phase === 1) {
            o.pcs.forEach((p, i) => {
              if (BIG_FIRST.indexOf(i) < o.k) { send(o, i, 0, 1); finish(p); }
              else { const q2 = o.prev[i]; p.x = o.cx - o.side * o.ox + q2.x * u; p.y = o.cy - o.side * o.oy + q2.y * u; }
            });
          } else settle(o);
          if (layout === 0 && o.phase === 1) { o.phase = 0; o.at = s.t + 2; }
          return o;
        });
      },
      step(dt) {
        for (const set of sets) { tick(set, dt); for (const p of set.pcs) move(p, dt); }
      },
      draw() {
        const { ctx } = s, nc = s.colors.length;
        ctx.lineJoin = 'round';
        ctx.lineWidth = lw;
        if (layout === 1) {
          // The silhouette to fill: all seven places, as one shape.
          for (const set of sets) {
            if (set.sil <= 0.01) continue;
            ctx.beginPath();
            set.fig.forEach((q, i) => outline(i, set.gx + q.x * u, set.gy + q.y * u, q.a, q.f ? -1 : 1));
            ctx.globalAlpha = SIL * set.sil;
            ctx.fillStyle = s.ink;
            ctx.fill();
          }
        }
        for (const set of sets) {
          set.pcs.forEach((p, i) => {
            const lifted = p.d > 0 && s.t >= p.t0 || layout === 2 && set.phase === 2;
            if (lifted) {
              // A soft shadow under a piece in the air.
              ctx.beginPath();
              outline(i, p.x + u * 0.12, p.y + u * 0.18, p.a, p.sc);
              ctx.globalAlpha = s.dark ? 0.22 : 0.08;
              ctx.fillStyle = s.dark ? '#000' : s.ink;
              ctx.fill();
            }
            ctx.beginPath();
            outline(i, p.x, p.y, p.a, p.sc);
            ctx.fillStyle = ctx.strokeStyle = s.colors[(i + set.c0) % nc];
            ctx.globalAlpha = FILL;
            ctx.fill();
            ctx.globalAlpha = EDGE;
            ctx.stroke();
          });
        }
      },
    };
  });
}
