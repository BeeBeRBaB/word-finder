// Kites: kites of different shapes fly over a low hill on long sagging strings, bobbing and
// rocking in a gusty wind, their tails rippling out downwind. Layout 0: a kite festival, diamonds,
// deltas, hexagons and box kites at many heights and distances, each on its own flyer's string.
// 1: kite trains, a line of matching kites stacked along one string, a ripple running up it.
// 2: stunt kites on two lines each, tracing slow loops and figure eights, long tails trailing.

import { stage, TAU, clamp, mix } from './stage.js';

/** @typedef {{x:number, y:number, px:number, py:number}} Pt */
/** @typedef {{shape:number, hx:number, hy:number, x:number, y:number, a:number, sx:number, z:number,
 *   c:number, ph:number, f:number, ax:number, ay:number, tail:Pt[], u:number}} Kite
 * hx, hy its home in units of the host; x, y, a (roll), sx (foreshortening) now; z its size in
 * CSS px; ax, ay its flyer; u its place along a train's string (layout 1). */

const SHAPES = 4;
const SUB = 1 / 60;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const nc = s.colors.length;
    // The wind blows toward wd: tails stream that way and kites stand downwind of their flyers.
    const wd = rng.random() < 0.5 ? -1 : 1;
    /** @type {Kite[]} */
    let kites = [];
    let acc = 0, S = 60, ground = 0, warm = false;
    /** @type {{x:number, y:number}[]} */
    let flyers = [];

    /** The ground's height at x. @param {number} x */
    const hill = (x) => ground - s.H * 0.025 * (Math.sin((x / s.W) * 5.3 + 0.7) + 0.5 * Math.sin((x / s.W) * 11.7));
    /** The wind's strength now, swelling and easing. */
    const gust = () => 1 + 0.25 * Math.sin(s.t * 0.21) + 0.15 * Math.sin(s.t * 0.53 + 1);

    /** @param {number} shape @param {number} z @param {number} c @returns {Kite} */
    function kite(shape, z, c) {
      const n = shape === 3 ? 0 : L === 2 ? 22 : 14;
      return { shape, hx: 0, hy: 0, x: 0, y: 0, a: 0, sx: 1, z, c, ph: rng.random() * TAU, f: 0.7 + rng.random() * 0.6,
        ax: 0, ay: 0, u: 0, tail: Array.from({ length: n }, () => ({ x: 0, y: 0, px: 0, py: 0 })) };
    }

    /** Where layout 1's string from flyer k runs, at u from the hand (0) to the top kite (1).
     * @param {number} k @param {number} u @returns {[number, number]} */
    function trainAt(k, u) {
      const f = flyers[k];
      const tx = f.x + wd * s.W * (s.W > s.H ? 0.5 : 0.62), ty = s.H * (0.1 + 0.08 * k);
      const sag = 0.18 / gust();
      const mx = mix(f.x, tx, 0.5) + wd * s.W * 0.05, my = mix(f.y, ty, 0.5) + Math.hypot(tx - f.x, ty - f.y) * sag;
      const v = 1 - u;
      return [v * v * f.x + 2 * v * u * mx + u * u * tx, v * v * f.y + 2 * v * u * my + u * u * ty];
    }

    /** Moves every kite to where it is at time t. */
    function place() {
      const g = gust();
      for (const k of kites) {
        const b = s.t * k.f + k.ph;
        if (L === 2) {
          // A slow figure eight or loop over its flyer, the nose leading round it.
          const w = TAU / (22 + k.ph * 2), tt = s.t * w + k.ph;
          const loop = k.u === 1;
          const Ax = s.W * (flyers.length > 2 ? 0.14 : 0.2), Ay = s.H * 0.2;
          const x = k.hx * s.W + Ax * Math.sin(tt), y = k.hy * s.H + Ay * (loop ? Math.cos(tt) : Math.sin(2 * tt) * 0.8);
          const vx = Ax * Math.cos(tt), vy = Ay * (loop ? -Math.sin(tt) : 1.6 * Math.cos(2 * tt));
          k.x = x; k.y = y; k.a = Math.atan2(vy, vx) + TAU / 4; k.sx = 1;
        } else if (L === 1) {
          const [x, y] = trainAt(Math.round(k.hx), k.u);
          // A ripple running up the string.
          const r = Math.sin(s.t * 1.1 - k.u * 6);
          k.x = x + r * S * 0.12; k.y = y - S * 0.25 + Math.cos(s.t * 0.9 - k.u * 5) * S * 0.06;
          k.a = wd * 0.12 + r * 0.08; k.sx = 1 - 0.08 * Math.abs(r);
        } else {
          k.x = k.hx * s.W + Math.sin(b * 0.37) * S * 0.6 + wd * (g - 1) * S * 0.8;
          k.y = k.hy * s.H + Math.sin(b * 0.29 + 1) * S * 0.35 - (g - 1) * S * 0.4;
          k.a = wd * 0.1 + 0.16 * Math.sin(b * 0.37 + 1.2);
          k.sx = 1 - 0.18 * Math.abs(Math.sin(b * 0.23));
        }
      }
    }

    /** Advances the tails by one fixed sub-step: each point coasts, the wind pushes it downwind
     * and a travelling flutter sideways, gravity pulls it down, then each follows its leader at
     * a fixed spacing. @param {number} h */
    function simTails(h) {
      const g = gust();
      for (const k of kites) {
        const n = k.tail.length;
        if (!n) continue;
        const ca = Math.cos(k.a), sa = Math.sin(k.a);
        const hx = k.x - sa * k.z * 0.55, hy = k.y + ca * k.z * 0.55;
        const t0 = k.tail[0];
        t0.px = t0.x = hx; t0.py = t0.y = hy;
        const seg = k.z * 0.16, F = k.z * 9;
        for (let i = 1; i < n; i++) {
          const p = k.tail[i];
          const vx = (p.x - p.px) * 0.94, vy = (p.y - p.py) * 0.94;
          p.px = p.x; p.py = p.y;
          const fl = Math.sin(s.t * 3.4 - i * 0.55 + k.ph) * F * 1.3 * (i / n);
          p.x += vx + (wd * F * 1.2 * g + fl) * h * h;
          p.y += vy + (F * 1.4 + fl * 0.4) * h * h;
        }
        for (let i = 1; i < n; i++) {
          const a = k.tail[i - 1], p = k.tail[i];
          const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 1;
          p.x = a.x + (dx / d) * seg; p.y = a.y + (dy / d) * seg;
        }
        // A little stiffness: each point eases toward the line through its neighbours.
        for (let i = 1; i < n - 1; i++) {
          const a = k.tail[i - 1], p = k.tail[i], b = k.tail[i + 1];
          p.x += ((a.x + b.x) / 2 - p.x) * 0.2; p.y += ((a.y + b.y) / 2 - p.y) * 0.2;
        }
      }
    }

    /** Puts each tail hanging straight from its kite, to start from rest. */
    function hangTails() {
      for (const k of kites) {
        k.tail.forEach((p, i) => { p.x = p.px = k.x + wd * i * k.z * 0.08; p.y = p.py = k.y + k.z * (0.55 + i * 0.2); });
      }
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        S = clamp(m * 0.11, 40, 120);
        ground = s.H * 0.93;
        const fresh = !kites.length;
        if (L === 0) {
          const n = clamp(Math.round(s.W * s.H / 80000), 4, 11);
          if (kites.length !== n) {
            kites = [];
            // Homes spread over the sky on a jittered grid, so they never bunch.
            const cols = Math.max(2, Math.round(Math.sqrt(n * s.W / s.H))), rows = Math.ceil(n / cols);
            const cells = rng.shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, n);
            cells.forEach((cell, i) => {
              const z = S * (0.55 + 0.45 * rng.random());
              const k = kite(i % SHAPES, z, (i * 2) % nc);
              k.hx = ((cell % cols) + 0.2 + rng.random() * 0.6) / cols;
              k.hy = 0.1 + 0.55 * ((Math.floor(cell / cols) + 0.2 + rng.random() * 0.6) / rows);
              kites.push(k);
            });
            kites.sort((a, b) => a.z - b.z);
          }
          for (const k of kites) {
            k.ax = clamp(k.hx * s.W - wd * s.W * (0.06 + k.hy * 0.14), s.W * 0.04, s.W * 0.96);
            k.ay = hill(k.ax);
          }
          flyers = kites.map((k) => ({ x: k.ax, y: k.ay }));
        } else if (L === 1) {
          const nt = s.W > s.H * 1.2 ? 2 : 1;
          flyers = Array.from({ length: nt }, (_, i) => {
            const x = s.W * (wd > 0 ? 0.08 + i * 0.22 : 0.92 - i * 0.22);
            return { x, y: hill(x) };
          });
          if (fresh) {
            const shape = rng.int(2);
            for (let i = 0; i < nt; i++) {
              const per = clamp(Math.round(s.H / (S * 1.3)), 5, 9);
              for (let j = 0; j < per; j++) {
                const k = kite((shape + i) % 2, S * (0.5 + 0.35 * (j / per)) * (i ? 0.8 : 1), (i * 3 + j) % nc);
                k.hx = i; k.u = 0.32 + 0.68 * (j / (per - 1));
                if (k.tail.length > 7) k.tail.length = 7;
                kites.push(k);
              }
            }
          }
          for (const k of kites) if (k.hx >= flyers.length) k.hx = flyers.length - 1;
        } else {
          const n = s.W > 1100 ? 3 : 2;
          if (kites.length !== n) {
            kites = [];
            for (let i = 0; i < n; i++) {
              const k = kite(1, S * 1.05, (i * 2 + 1) % nc);
              k.ph = i * 2.1 + rng.random();
              k.hx = (i + 0.5) / n; k.hy = 0.36 + 0.06 * (i % 2);
              // The first flies loops, the rest figure eights.
              k.u = i === 0 ? 1 : 0;
              kites.push(k);
            }
          }
          flyers = kites.map((k) => { const x = k.hx * s.W; return { x, y: hill(x) }; });
          kites.forEach((k, i) => { k.ax = flyers[i].x; k.ay = flyers[i].y; });
        }
        place();
        if (fresh || !warm) {
          hangTails();
          // Run the wind a while so a still frame shows the tails streaming.
          for (let i = 0; i < 150; i++) simTails(SUB);
          warm = true;
        }
      },
      step(dt) {
        place();
        acc = Math.min(acc + dt, SUB * 6);
        while (acc >= SUB) { simTails(SUB); acc -= SUB; }
      },
      draw() {
        const { ctx } = s;
        // The hill, and each flyer standing on it.
        ctx.globalAlpha = s.dark ? 0.14 : 0.16;
        ctx.fillStyle = s.colors[nc > 2 ? 2 : 0];
        ctx.beginPath();
        ctx.moveTo(0, s.H);
        for (let x = 0; x <= s.W + 16; x += 16) ctx.lineTo(x, hill(x));
        ctx.lineTo(s.W, s.H);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = s.ink;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.globalAlpha = s.dark ? 0.3 : 0.34;
        // Strings first, behind the kites.
        ctx.beginPath();
        if (L === 1) {
          flyers.forEach((_, i) => {
            for (let u = 0; u <= 1.0001; u += 0.05) {
              const [x, y] = trainAt(i, u);
              if (u === 0) ctx.moveTo(x, y - S * 0.25); else ctx.lineTo(x, y - S * 0.25);
            }
          });
        } else {
          const g = gust();
          for (const k of kites) {
            if (L === 2) {
              // Two lines from the wingtips to the flyer's hands.
              const ca = Math.cos(k.a), sa = Math.sin(k.a);
              for (const side of [-1, 1]) {
                const wx = k.x + ca * side * k.z * 0.62 - sa * k.z * 0.3, wy = k.y + sa * side * k.z * 0.62 + ca * k.z * 0.3;
                const hx = k.ax + side * 5, hy = k.ay - S * 0.3;
                ctx.moveTo(wx, wy);
                ctx.quadraticCurveTo(mix(wx, hx, 0.5), mix(wy, hy, 0.5) + Math.hypot(hx - wx, hy - wy) * 0.05, hx, hy);
              }
            } else {
              const hx = k.ax, hy = k.ay - S * 0.3;
              const d = Math.hypot(k.x - hx, k.y - hy);
              ctx.moveTo(k.x, k.y);
              ctx.quadraticCurveTo(mix(k.x, hx, 0.45) + wd * d * 0.06, mix(k.y, hy, 0.45) + d * 0.16 / g, hx, hy);
            }
          }
        }
        ctx.stroke();
        flyerFigures();
        for (const k of kites) { tail(k); body(k); }
      },
    };

    /** Little standing figures holding the strings. */
    function flyerFigures() {
      const { ctx } = s;
      const h = S * 0.42;
      ctx.globalAlpha = s.dark ? 0.4 : 0.45;
      ctx.fillStyle = s.ink;
      ctx.strokeStyle = s.ink;
      ctx.lineWidth = Math.max(1.5, h * 0.12);
      ctx.beginPath();
      for (const f of flyers) {
        ctx.moveTo(f.x, f.y); ctx.lineTo(f.x, f.y - h * 0.55);
        ctx.moveTo(f.x, f.y - h * 0.5); ctx.lineTo(f.x + wd * h * 0.3, f.y - h * 0.72);
      }
      ctx.stroke();
      ctx.beginPath();
      for (const f of flyers) { ctx.moveTo(f.x + h * 0.14, f.y - h * 0.75); ctx.arc(f.x, f.y - h * 0.75, h * 0.14, 0, TAU); }
      ctx.fill();
    }

    /** A kite's tail: a rippling line with small bows along it. @param {Kite} k */
    function tail(k) {
      const { ctx } = s;
      const n = k.tail.length;
      if (!n) return;
      ctx.strokeStyle = s.colors[k.c];
      ctx.lineWidth = Math.max(1.2, k.z * 0.03);
      ctx.globalAlpha = s.dark ? 0.45 : 0.5;
      ctx.beginPath();
      // Smoothed through the midpoints.
      ctx.moveTo(k.tail[0].x, k.tail[0].y);
      for (let i = 1; i < n - 1; i++) {
        const p = k.tail[i], q = k.tail[i + 1];
        ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
      }
      ctx.lineTo(k.tail[n - 1].x, k.tail[n - 1].y);
      ctx.stroke();
      ctx.fillStyle = s.colors[(k.c + 1) % nc];
      ctx.globalAlpha = s.dark ? 0.5 : 0.55;
      const b = k.z * 0.09;
      ctx.beginPath();
      for (let i = 2; i < n; i += 3) {
        const p = k.tail[i], q = k.tail[i - 1];
        const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d * b, ny = dx / d * b;
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + nx + dx / d * b * 0.5, p.y + ny + dy / d * b * 0.5); ctx.lineTo(p.x + nx - dx / d * b * 0.5, p.y + ny - dy / d * b * 0.5); ctx.closePath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - nx + dx / d * b * 0.5, p.y - ny + dy / d * b * 0.5); ctx.lineTo(p.x - nx - dx / d * b * 0.5, p.y - ny - dy / d * b * 0.5); ctx.closePath();
      }
      ctx.fill();
    }

    /** A kite's sail in two colours, with its spars. @param {Kite} k */
    function body(k) {
      const { ctx } = s;
      const c1 = s.colors[k.c], c2 = s.colors[(k.c + 1) % nc];
      const fa = s.dark ? 0.5 : 0.55;
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.a);
      ctx.scale(k.z * k.sx, k.z);
      /** @param {number[]} pts flat x, y list @param {string} c */
      const poly = (pts, c) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.closePath();
        ctx.fill();
      };
      ctx.globalAlpha = fa;
      ctx.lineWidth = 1.2 / k.z;
      ctx.strokeStyle = s.ink;
      ctx.beginPath();
      if (k.shape === 0) {
        // Diamond: halves either side of the spine, a cross spar a third of the way down.
        poly([0, -0.45, -0.36, -0.1, 0, 0.55], c1);
        poly([0, -0.45, 0.36, -0.1, 0, 0.55], c2);
        ctx.moveTo(0, -0.45); ctx.lineTo(0, 0.55); ctx.moveTo(-0.36, -0.1); ctx.lineTo(0.36, -0.1);
      } else if (k.shape === 1) {
        // Delta: swept wings and a keel.
        poly([0, -0.5, -0.66, 0.3, 0, 0.16], c1);
        poly([0, -0.5, 0.66, 0.3, 0, 0.16], c2);
        ctx.moveTo(0, -0.5); ctx.lineTo(0, 0.16); ctx.moveTo(-0.4, 0.06); ctx.lineTo(0.4, 0.06);
      } else if (k.shape === 2) {
        // Hexagon (rokkaku), striped.
        poly([0, -0.5, 0.4, -0.3, 0.4, 0.3, 0, 0.5, -0.4, 0.3, -0.4, -0.3], c1);
        poly([-0.13, -0.43, 0.13, -0.43, 0.13, 0.43, -0.13, 0.43], c2);
        ctx.moveTo(0, -0.5); ctx.lineTo(0, 0.5); ctx.moveTo(-0.4, -0.3); ctx.lineTo(0.4, -0.3); ctx.moveTo(-0.4, 0.3); ctx.lineTo(0.4, 0.3);
      } else {
        // Box kite: two cells on four long sticks.
        poly([-0.3, -0.55, 0.3, -0.55, 0.3, -0.2, -0.3, -0.2], c1);
        poly([-0.3, 0.2, 0.3, 0.2, 0.3, 0.55, -0.3, 0.55], c1);
        ctx.globalAlpha = fa * 0.6;
        poly([0.3, -0.55, 0.42, -0.48, 0.42, -0.13, 0.3, -0.2], c2);
        poly([0.3, 0.2, 0.42, 0.27, 0.42, 0.62, 0.3, 0.55], c2);
        ctx.globalAlpha = fa;
        ctx.moveTo(-0.3, -0.55); ctx.lineTo(-0.3, 0.55); ctx.moveTo(0.3, -0.55); ctx.lineTo(0.3, 0.55);
        ctx.moveTo(0.42, -0.48); ctx.lineTo(0.42, 0.62);
      }
      ctx.globalAlpha = s.dark ? 0.35 : 0.4;
      ctx.stroke();
      ctx.restore();
    }
  });
}
