// Molecules: ball-and-stick molecules (water, carbon dioxide, methane, ammonia, ethanol, a ring)
// tumble slowly in 3D as they drift; two that meet hold together by a dotted bond for a while,
// then part. The seed picks the variant: an assortment wandering every way; a slow current
// across the page in three depths, near ones bigger and quicker; or loose atoms that wander,
// snap together into small molecules and later break apart again.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, z:number, e:number}} Atom local position and element */
/** @typedef {{atoms:Atom[], bonds:number[][]}} Shape */
/** @typedef {{x:number, y:number, vx:number, vy:number, sc:number, shape:Shape, ra:number, rb:number,
 *   rc:number, wa:number, wb:number, wc:number, depth:number, mate:Mol|null, hold:number, bond:number,
 *   cool:number, px:Float32Array, py:Float32Array, pz:Float32Array}} Mol
 * Centre x, y and drift vx, vy (CSS px, px/s), scale sc px per unit; three turn angles and
 * rates; depth 0..1 (current layers); mate held by a dotted bond for hold s, bond its 0..1 grip;
 * cool s until it may bond again; px, py, pz the projected atoms. */
/** @typedef {{x:number, y:number, vx:number, vy:number, e:number, n:number, cool:number}} Free
 * A loose atom: position, velocity, element and bond count. */
/** @typedef {{a:Free, b:Free, life:number, grip:number}} Link */

// Elements: radius in bond lengths, colour slot (-1 is the ink), how many bonds a free one takes.
const EL = [
  { r: 0.26, c: -1, v: 1 },    // H
  { r: 0.42, c: 0, v: 4 },     // C
  { r: 0.4, c: 1, v: 2 },      // O
  { r: 0.4, c: 2, v: 3 },      // N
];

/** @param {number[][]} pts [x, y, z, element] @param {number[][]} bonds @returns {Shape} */
const shape = (pts, bonds) => ({ atoms: pts.map(([x, y, z, e]) => ({ x, y, z, e })), bonds });

const T = 0.58;    // tetrahedral arm, in bond lengths per axis
/** @type {Shape[]} */
const SHAPES = [
  shape([[0, 0, 0, 2], [0.8, 0.6, 0, 0], [-0.8, 0.6, 0, 0]], [[0, 1], [0, 2]]),                   // water
  shape([[0, 0, 0, 1], [1.1, 0, 0, 2], [-1.1, 0, 0, 2]], [[0, 1], [0, 2]]),                       // CO2
  shape([[0, 0, 0, 1], [T, T, T, 0], [-T, -T, T, 0], [-T, T, -T, 0], [T, -T, -T, 0]],
    [[0, 1], [0, 2], [0, 3], [0, 4]]),                                                         // methane
  shape([[0, 0, 0.3, 3], [0.94, 0, -0.1, 0], [-0.47, 0.82, -0.1, 0], [-0.47, -0.82, -0.1, 0]],
    [[0, 1], [0, 2], [0, 3]]),                                                                 // ammonia
  shape([[-0.75, 0, 0, 1], [0.75, 0, 0, 1], [1.4, 0.9, 0, 2], [2.3, 0.75, 0, 0],
    [-1.3, 0.9, 0.3, 0], [-1.3, -0.6, 0.6, 0], [-1.1, -0.4, -0.9, 0], [1.2, -0.6, 0.7, 0], [1.2, -0.5, -0.8, 0]],
  [[0, 1], [1, 2], [2, 3], [0, 4], [0, 5], [0, 6], [1, 7], [1, 8]]),                            // ethanol
  ring(),
];

/** A six-carbon ring with a hydrogen on each. @returns {Shape} */
function ring() {
  /** @type {number[][]} */
  const pts = [], bonds = [];
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    pts.push([Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0, 1]);
    bonds.push([i, (i + 1) % 6]);
  }
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    pts.push([Math.cos(a) * 2, Math.sin(a) * 2, 0, 0]);
    bonds.push([i, i + 6]);
  }
  return shape(pts, bonds);
}

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {HTMLCanvasElement[]} */
    const balls = EL.map((e) => sphere(e.c < 0 ? s.ink : s.colors[e.c % nc], s.dark));
    /** @type {Mol[]} */
    let mols = [];
    /** @type {Free[]} */
    let free = [];
    /** @type {Link[]} */
    let links = [];
    let unit = 20;    // bond length, px
    let laid = false;

    /** @param {boolean} anywhere @returns {Mol} */
    function mol(anywhere) {
      const shp = SHAPES[layout === 1 ? rng.int(SHAPES.length) : rng.int(SHAPES.length - 1)];
      const n = shp.atoms.length;
      const depth = layout === 1 ? rng.int(3) / 2 : 1;
      const sp = layout === 1 ? 8 + depth * 18 : 6 + rng.random() * 10, a = rng.random() * TAU;
      const m = { x: rng.random() * s.W, y: rng.random() * s.H,
        vx: layout === 1 ? sp : Math.cos(a) * sp, vy: layout === 1 ? (rng.random() - 0.5) * 4 : Math.sin(a) * sp,
        sc: 0, shape: shp, ra: rng.random() * TAU, rb: rng.random() * TAU, rc: rng.random() * TAU,
        wa: (rng.random() - 0.5) * 0.5, wb: (rng.random() - 0.5) * 0.4, wc: (rng.random() - 0.5) * 0.3,
        depth, mate: null, hold: 0, bond: 0, cool: rng.random() * 6,
        px: new Float32Array(n), py: new Float32Array(n), pz: new Float32Array(n) };
      if (!anywhere) m.x = -60;
      return m;
    }

    /** @returns {Free} */
    const atom = () => {
      const a = rng.random() * TAU, sp = 8 + rng.random() * 10, u = rng.random();
      return { x: rng.random() * s.W, y: rng.random() * s.H, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        e: u < 0.45 ? 0 : u < 0.7 ? 2 : u < 0.88 ? 1 : 3, n: 0, cool: 0 };
    };

    /** Projects a molecule's atoms. @param {Mol} m @returns {void} */
    function project(m) {
      const ca = Math.cos(m.ra), sa = Math.sin(m.ra), cb = Math.cos(m.rb), sb = Math.sin(m.rb);
      const cc = Math.cos(m.rc), sc = Math.sin(m.rc);
      m.shape.atoms.forEach((p, i) => {
        // Turn about y, then x, then z.
        const x1 = p.x * ca + p.z * sa, z1 = -p.x * sa + p.z * ca;
        const y2 = p.y * cb - z1 * sb, z2 = p.y * sb + z1 * cb;
        const x3 = x1 * cc - y2 * sc, y3 = x1 * sc + y2 * cc;
        const f = 1 + z2 * 0.08;
        m.px[i] = m.x + x3 * m.sc * f; m.py[i] = m.y + y3 * m.sc * f; m.pz[i] = z2;
      });
    }

    /** Wraps a point round the edges, a margin beyond them. @param {{x:number, y:number}} p @param {number} pad */
    function wrap(p, pad) {
      if (p.x < -pad) p.x += s.W + 2 * pad; else if (p.x > s.W + pad) p.x -= s.W + 2 * pad;
      if (p.y < -pad) p.y += s.H + 2 * pad; else if (p.y > s.H + pad) p.y -= s.H + 2 * pad;
    }

    /** @param {number} dt @returns {void} */
    function stepMols(dt) {
      for (const m of mols) {
        m.ra += m.wa * dt; m.rb += m.wb * dt; m.rc += m.wc * dt;
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.cool -= dt;
        if (!m.mate) wrap(m, unit * 3);
      }
      // Pairs held by a dotted bond pull to a set distance; when the hold runs out they part.
      for (const m of mols) {
        const o = m.mate;
        if (!o || mols.indexOf(m) > mols.indexOf(o)) continue;
        m.hold -= dt;
        const dx = o.x - m.x, dy = o.y - m.y, d = Math.hypot(dx, dy) || 1;
        if (m.hold > 0) {
          m.bond = o.bond = Math.min(1, m.bond + dt);
          const want = (m.sc + o.sc) * 1.9, f = (d - want) * 0.6 * dt;
          m.vx += dx / d * f; m.vy += dy / d * f; o.vx -= dx / d * f; o.vy -= dy / d * f;
          // Held, they share one drift.
          const vx = (m.vx + o.vx) / 2, vy = (m.vy + o.vy) / 2, k = Math.min(1, dt * 0.8);
          m.vx += (vx - m.vx) * k; m.vy += (vy - m.vy) * k; o.vx += (vx - o.vx) * k; o.vy += (vy - o.vy) * k;
        } else {
          m.bond = o.bond = Math.max(0, m.bond - dt);
          if (m.bond === 0) {
            const push = 5;
            m.vx -= dx / d * push; m.vy -= dy / d * push; o.vx += dx / d * push; o.vy += dy / d * push;
            m.mate = o.mate = null; m.cool = o.cool = 8 + rng.random() * 8;
          }
        }
        // A held pair that drifts out wraps as one.
        const cx = (m.x + o.x) / 2, cy = (m.y + o.y) / 2, c = { x: cx, y: cy };
        wrap(c, unit * 5);
        if (c.x !== cx || c.y !== cy) { m.x += c.x - cx; m.y += c.y - cy; o.x += c.x - cx; o.y += c.y - cy; }
      }
      // Two free ones that meet take hold.
      for (let i = 0; i < mols.length; i++) {
        const a = mols[i];
        if (a.mate || a.cool > 0) continue;
        for (let j = i + 1; j < mols.length; j++) {
          const b = mols[j];
          if (b.mate || b.cool > 0 || a.depth !== b.depth) continue;
          const reach = (a.sc + b.sc) * 2.4;
          if (Math.abs(a.x - b.x) < reach && Math.abs(a.y - b.y) < reach && Math.hypot(a.x - b.x, a.y - b.y) < reach) {
            a.mate = b; b.mate = a; a.hold = b.hold = 7 + rng.random() * 7; a.bond = b.bond = 0;
            break;
          }
        }
      }
      // Current: drifters keep near their speed so the stream never stalls.
      if (layout === 1) for (const m of mols) {
        const sp = 8 + m.depth * 18;
        m.vx += (sp - m.vx) * Math.min(1, dt * 0.3); m.vy *= 1 - Math.min(1, dt * 0.2);
      }
    }

    /** @param {number} dt @returns {void} */
    function stepAtoms(dt) {
      const L = unit * 1.15;
      for (const p of free) {
        // A slow wander, damped toward a gentle speed.
        p.vx += (rng.random() - 0.5) * 16 * dt; p.vy += (rng.random() - 0.5) * 16 * dt;
        const v = Math.hypot(p.vx, p.vy) || 1, k = 1 + (12 / v - 1) * Math.min(1, dt * 0.5);
        p.vx *= k; p.vy *= k;
        p.cool -= dt;
      }
      for (const l of links) {
        l.life -= dt;
        l.grip = l.life > 0 ? Math.min(1, l.grip + dt) : Math.max(0, l.grip - dt * 0.7);
        const { a, b } = l, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const f = (d - L) * 2.2 * l.grip * dt;
        a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
        const rv = ((b.vx - a.vx) * dx + (b.vy - a.vy) * dy) / d * 0.5 * Math.min(1, dt * 3) * l.grip;
        a.vx += dx / d * rv; a.vy += dy / d * rv; b.vx -= dx / d * rv; b.vy -= dy / d * rv;
      }
      // Broken links let go, with a small push apart.
      links = links.filter((l) => {
        if (l.life > 0 || l.grip > 0) return true;
        l.a.n--; l.b.n--; l.a.cool = l.b.cool = 4 + rng.random() * 4;
        const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, d = Math.hypot(dx, dy) || 1;
        l.a.vx -= dx / d * 6; l.a.vy -= dy / d * 6; l.b.vx += dx / d * 6; l.b.vy += dy / d * 6;
        return false;
      });
      // Unbonded atoms keep apart, which opens a molecule out; ones with a bond to spare drift
      // together and take hold when they touch.
      for (let i = 0; i < free.length; i++) {
        const a = free[i];
        for (let j = i + 1; j < free.length; j++) {
          const b = free[j], dx = b.x - a.x, dy = b.y - a.y;
          if (Math.abs(dx) > L * 5 || Math.abs(dy) > L * 5) continue;
          const d = Math.hypot(dx, dy) || 1;
          if (d > L * 5 || links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) continue;
          const spare = a.n < EL[a.e].v && b.n < EL[b.e].v && a.cool <= 0 && b.cool <= 0 && !(a.e === 0 && b.e === 0);
          let f = 0;
          if (d < L * 1.5) f = -(L * 1.5 - d) * 1.2 * dt;
          if (spare) f += 10 * dt;
          a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
          if (spare && d < L * 1.8 && links.length < free.length * 0.75) {
            links.push({ a, b, life: 12 + rng.random() * 16, grip: 0 }); a.n++; b.n++;
          }
        }
      }
      for (const p of free) { p.x += p.vx * dt; p.y += p.vy * dt; }
      // Wrap whole molecules: an atom only wraps when it is free.
      for (const p of free) if (p.n === 0) wrap(p, unit * 2);
      for (const l of links) {
        const { a, b } = l;
        if (Math.abs(a.x - b.x) > s.W / 2 || Math.abs(a.y - b.y) > s.H / 2) l.life = l.grip = 0;
      }
      for (const p of free) {
        if (p.x < -unit * 6 || p.x > s.W + unit * 6 || p.y < -unit * 6 || p.y > s.H + unit * 6) {
          for (const l of links) if (l.a === p || l.b === p) l.life = 0;
          wrap(p, unit * 2);
        }
      }
    }

    /** @param {number} x @param {number} y @param {number} e @param {number} r @param {number} al */
    function ball(x, y, e, r, al) {
      const { ctx } = s;
      ctx.globalAlpha = al;
      ctx.drawImage(balls[e], x - r, y - r, r * 2, r * 2);
    }

    return {
      lay() {
        const { W, H } = s, m0 = Math.min(W, H);
        unit = clamp(m0 * 0.045, 16, 40);
        if (layout === 2) {
          const n = clamp(Math.round(W * H / (unit * unit * 15)), 24, 130);
          while (free.length < n) free.push(atom());
          if (free.length > n) { free.length = n; links = links.filter((l) => free.includes(l.a) && free.includes(l.b)); for (const p of free) p.n = links.filter((l) => l.a === p || l.b === p).length; }
          for (const p of free) { p.x = clamp(p.x, 0, W); p.y = clamp(p.y, 0, H); }
        } else {
          const n = clamp(Math.round(W * H / (unit * unit * (layout === 1 ? 40 : 46))), 8, 40);
          while (mols.length < n) mols.push(mol(true));
          if (mols.length > n) { for (const m of mols.slice(n)) if (m.mate) m.mate.mate = null; mols.length = n; }
          for (const m of mols) {
            m.sc = unit * (layout === 1 ? 0.6 + m.depth * 0.55 : 0.8 + (m.shape.atoms.length > 8 ? -0.15 : 0.1));
            m.x = clamp(m.x, 0, W); m.y = clamp(m.y, 0, H);
          }
          // Far layers first.
          if (layout === 1) mols.sort((a, b) => a.depth - b.depth);
        }
        if (!laid) {
          laid = true;
          // Warm up, so a still frame already holds bonded pairs or molecules.
          for (let i = 0; i < 300; i++) layout === 2 ? stepAtoms(0.1) : stepMols(0.1);
        }
      },
      step(dt) { if (layout === 2) stepAtoms(dt); else stepMols(dt); },
      draw() {
        const { ctx } = s;
        const stick = s.dark ? 0.32 : 0.36, ab = s.dark ? 0.56 : 0.55;
        ctx.lineCap = 'round';
        ctx.strokeStyle = s.ink;
        if (layout === 2) {
          ctx.lineWidth = clamp(unit * 0.16, 2, 4.5);
          ctx.globalAlpha = stick;
          ctx.beginPath();
          for (const l of links) {
            if (l.grip < 1) continue;
            ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y);
          }
          ctx.stroke();
          // A forming or breaking bond: a stick grown or shrunk to its grip, from both ends.
          ctx.beginPath();
          for (const l of links) {
            if (l.grip >= 1) continue;
            const g = l.grip / 2, dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
            ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.a.x + dx * g, l.a.y + dy * g);
            ctx.moveTo(l.b.x, l.b.y); ctx.lineTo(l.b.x - dx * g, l.b.y - dy * g);
          }
          ctx.stroke();
          for (const p of free) ball(p.x, p.y, p.e, EL[p.e].r * unit * 1.25, ab);
          return;
        }
        // Dotted bonds between held pairs, from the nearest atoms.
        for (const m of mols) project(m);
        ctx.lineWidth = clamp(unit * 0.12, 1.5, 3.5);
        ctx.setLineDash([2, clamp(unit * 0.3, 4, 8)]);
        for (const m of mols) {
          const o = m.mate;
          if (!o || mols.indexOf(m) > mols.indexOf(o) || m.bond <= 0) continue;
          let best = Infinity, bi = 0, bj = 0;
          for (let i = 0; i < m.px.length; i++) for (let j = 0; j < o.px.length; j++) {
            const d = (m.px[i] - o.px[j]) ** 2 + (m.py[i] - o.py[j]) ** 2;
            if (d < best) { best = d; bi = i; bj = j; }
          }
          ctx.globalAlpha = stick * 1.4 * m.bond;
          ctx.beginPath(); ctx.moveTo(m.px[bi], m.py[bi]); ctx.lineTo(o.px[bj], o.py[bj]); ctx.stroke();
        }
        ctx.setLineDash([]);
        for (const m of mols) {
          const dim = layout === 1 ? 0.55 + m.depth * 0.45 : 1;
          ctx.lineWidth = clamp(m.sc * 0.18, 2, 5);
          ctx.globalAlpha = stick * dim;
          ctx.beginPath();
          for (const [i, j] of m.shape.bonds) { ctx.moveTo(m.px[i], m.py[i]); ctx.lineTo(m.px[j], m.py[j]); }
          ctx.stroke();
          // Back to front, so near atoms sit over far ones.
          const order = m.shape.atoms.map((_, i) => i).sort((i, j) => m.pz[i] - m.pz[j]);
          for (const i of order) {
            const e = m.shape.atoms[i].e, f = 1 + m.pz[i] * 0.1;
            ball(m.px[i], m.py[i], e, EL[e].r * m.sc * 1.25 * f, ab * dim * (0.85 + 0.15 * clamp(m.pz[i] + 0.5, 0, 1)));
          }
        }
      },
    };
  });
}

/** A shaded ball with a soft highlight, as a sprite. @param {string} color @param {boolean} dark
 * @returns {HTMLCanvasElement} */
function sphere(color, dark) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.beginPath(); g.arc(32, 32, 31, 0, TAU); g.fill();
  const hi = g.createRadialGradient(22, 21, 2, 28, 28, 34);
  hi.addColorStop(0, dark ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.6)');
  hi.addColorStop(0.45, 'rgba(255,255,255,0)');
  hi.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = hi;
  g.beginPath(); g.arc(32, 32, 31, 0, TAU); g.fill();
  return c;
}
