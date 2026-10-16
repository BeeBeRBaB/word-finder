// Marbling: drops of colour fall on a bath and spread, pushing the ink already there outward into
// rings, then a comb or stylus drags it all into feathered, swirling patterns, as in paper
// marbling (the drop and tine moves are Jaffer's exact, area-keeping maps). The seed picks the
// variant: scattered stone drops combed one way and back into feathered chevrons; bullseyes of
// concentric drops twisted into spirals; or rows of drops waved across and then down.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{c:number, p:number[]}} Poly a drop's outline, x, y pairs in CSS px; colour c (nc: bare paper) */
/** @typedef {{dur:number, run:(a:number, b:number) => void}} Move one stage of the work, applied from progress a to b */

const PIXELS = 500000;  // most backing pixels: the fills overlap, so it is drawn soft and scaled up
const EDGE = 10;        // longest outline edge on the page, CSS px, before it is split
const FAR = 40;         // the same off the page
const NEAR = 3;         // shortest edge kept

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Poly[]} */
    let polys = [];
    /** @type {Move[]} */
    const queue = [];
    let bg = -1, last = 0, prog = 0, lastW = 0, lastH = 0;
    // The ink is laid opaque in order, so later drops cover earlier ones cleanly, and the
    // canvas as a whole is see-through.
    s.cv.style.opacity = s.dark ? '0.3' : '0.34';

    /** A colour unlike the last drop's; bare paper is one of them. @returns {number} */
    const pick = () => (last = (last + 1 + rng.int(nc)) % (nc + 1));

    /** @param {number} u @returns {number} */
    const ease = (u) => u * u * (3 - 2 * u);

    /** @param {number} dur @returns {Move} */
    const rest = (dur) => ({ dur, run() {} });

    /** A drop of radius R spreading at x, y. @param {number} x @param {number} y @param {number} R @param {number} dur @returns {Move} */
    function drop(x, y, R, dur) {
      /** @type {Poly} */
      const own = { c: pick(), p: [] };
      return { dur, run(a, b) {
        if (!polys.includes(own)) polys.push(own);
        const d = R * R * (ease(b) - ease(a));
        for (const q of polys) {
          if (q === own) continue;
          const p = q.p;
          for (let i = 0; i < p.length; i += 2) {
            const dx = p[i] - x, dy = p[i + 1] - y, r2 = dx * dx + dy * dy || 1e-6;
            const f = Math.sqrt(1 + d / r2);
            p[i] = x + dx * f; p[i + 1] = y + dy * f;
          }
        }
        const r = R * Math.sqrt(ease(b)), k = Math.max(24, Math.ceil(TAU * r / EDGE));
        own.p = [];
        for (let i = 0; i < k; i++) own.p.push(x + Math.cos(i * TAU / k) * r, y + Math.sin(i * TAU / k) * r);
      } };
    }

    /** A comb of tines S apart drawn along (mx, my), dragging ink z px near each tine.
     * @param {number} mx @param {number} my @param {number} S @param {number} off @param {number} z
     * @param {number} dur @returns {Move} */
    function comb(mx, my, S, off, z, dur) {
      const lam = S * 0.35;
      return { dur, run(a, b) {
        const dz = z * (ease(b) - ease(a));
        for (const q of polys) {
          const p = q.p;
          for (let i = 0; i < p.length; i += 2) {
            const d = p[i + 1] * mx - p[i] * my - off, m = ((d % S) + S) % S;
            const g = dz * lam / (Math.min(m, S - m) + lam);
            p[i] += g * mx; p[i + 1] += g * my;
          }
        }
      } };
    }

    /** A wavy stylus: ink moves along (mx, my) by a sine of its place across. @param {number} mx
     * @param {number} my @param {number} A @param {number} L @param {number} ph @param {number} dur @returns {Move} */
    function wave(mx, my, A, L, ph, dur) {
      return { dur, run(a, b) {
        const dA = A * (ease(b) - ease(a));
        for (const q of polys) {
          const p = q.p;
          for (let i = 0; i < p.length; i += 2) {
            const g = dA * Math.sin(TAU * (p[i + 1] * mx - p[i] * my) / L + ph);
            p[i] += g * mx; p[i + 1] += g * my;
          }
        }
      } };
    }

    /** A stylus turned at x, y: ink turns by up to ang, less with distance. @param {number} x
     * @param {number} y @param {number} ang @param {number} lam @param {number} dur @returns {Move} */
    function swirl(x, y, ang, lam, dur) {
      return { dur, run(a, b) {
        const da = ang * (ease(b) - ease(a)), l2 = lam * lam;
        for (const q of polys) {
          const p = q.p;
          for (let i = 0; i < p.length; i += 2) {
            const dx = p[i] - x, dy = p[i + 1] - y, t = da * l2 / (dx * dx + dy * dy + l2);
            const c = Math.cos(t), sn = Math.sin(t);
            p[i] = x + dx * c - dy * sn; p[i + 1] = y + dx * sn + dy * c;
          }
        }
      } };
    }

    /** Queues the variant's next round of drops and combing. @returns {void} */
    function plan() {
      const m0 = Math.min(s.W, s.H);
      if (layout === 0) {
        const k = clamp(Math.round(s.W * s.H / (m0 * m0 * 0.1)), 9, 16);
        for (let i = 0; i < k; i++) {
          queue.push(drop(s.W * (0.05 + rng.random() * 0.9), s.H * (0.05 + rng.random() * 0.9),
            m0 * (0.1 + rng.random() * 0.1), 1.3), rest(0.2));
        }
        const S = clamp(m0 * 0.09, 32, 100), off = rng.random() * S, z = m0 * 0.16;
        const [mx, my] = rng.random() < 0.5 ? [1, 0] : [0, 1];
        queue.push(rest(1), comb(mx, my, S, off, z, 6), rest(1), comb(-mx, -my, S, off + S / 2, z, 6), rest(2));
      } else if (layout === 1) {
        const x = s.W * (0.12 + rng.random() * 0.76), y = s.H * (0.12 + rng.random() * 0.76);
        const k = 6 + rng.int(4);
        for (let i = 0; i < k; i++) queue.push(drop(x, y, m0 * (0.06 + rng.random() * 0.05), 1.1), rest(0.15));
        queue.push(rest(0.8), swirl(x, y, (rng.random() < 0.5 ? -1 : 1) * (2.2 + rng.random() * 1.5), m0 * 0.22, 8), rest(2));
      } else {
        const rows = 2 + rng.int(2);
        for (let r = 0; r < rows; r++) {
          const y = s.H * (r + 0.2 + rng.random() * 0.6) / rows, k = clamp(Math.round(s.W / (m0 * 0.24)), 3, 9);
          for (let i = 0; i < k; i++) queue.push(drop(s.W * (i + 0.5) / k, y, m0 * (0.08 + rng.random() * 0.05), 0.9), rest(0.1));
        }
        queue.push(rest(1), wave(1, 0, m0 * 0.08, m0 * 0.35, rng.random() * TAU, 5), rest(1),
          wave(0, 1, m0 * 0.06, m0 * 0.3, rng.random() * TAU, 5), rest(2));
      }
    }

    /** Splits stretched edges and merges crowded points, drops outlines that left the page, and
     * turns one that now holds the whole page into the background. @returns {void} */
    function tidy() {
      const m = FAR, x0 = -m, y0 = -m, x1 = s.W + m, y1 = s.H + m;
      for (let j = polys.length - 1; j >= 0; j--) {
        const q = polys[j], p = q.p, n = p.length;
        let need = false, inside = 0, lx = Infinity, ly = Infinity, hx = -Infinity, hy = -Infinity;
        for (let i = 0; i < n; i += 2) {
          const x = p[i], y = p[i + 1], nx = p[(i + 2) % n], ny = p[(i + 3) % n];
          const on = x > 0 && y > 0 && x < s.W && y < s.H;
          if (x > x0 && y > y0 && x < x1 && y < y1) inside++;
          if (x < lx) lx = x; if (x > hx) hx = x; if (y < ly) ly = y; if (y > hy) hy = y;
          const e2 = (nx - x) ** 2 + (ny - y) ** 2, lim = on ? EDGE : FAR;
          if (e2 > lim * lim || e2 < NEAR * NEAR) need = true;
        }
        if (!inside) {
          if (hx < x0 || lx > x1 || hy < y0 || ly > y1) { polys.splice(j, 1); continue; }
          if (lx < x0 && hx > x1 && ly < y0 && hy > y1 && contains(p, s.W / 2, s.H / 2)) {
            bg = q.c; polys.splice(0, j + 1); break;
          }
        }
        if (!need) continue;
        /** @type {number[]} */
        const out = [];
        for (let i = 0; i < n; i += 2) {
          const x = p[i], y = p[i + 1], nx = p[(i + 2) % n], ny = p[(i + 3) % n];
          const k = out.length;
          if (k && (out[k - 2] - x) ** 2 + (out[k - 1] - y) ** 2 < NEAR * NEAR) continue;
          out.push(x, y);
          const on = x > 0 && y > 0 && x < s.W && y < s.H, len = Math.hypot(nx - x, ny - y);
          const parts = Math.ceil(len / (on ? EDGE : FAR));
          for (let t = 1; t < parts; t++) out.push(x + (nx - x) * t / parts, y + (ny - y) * t / parts);
        }
        if (out.length < 6) polys.splice(j, 1); else q.p = out;
      }
    }

    /** @param {number} dt @returns {void} */
    function advance(dt) {
      if (!queue.length) plan();
      const mv = queue[0], to = Math.min(1, prog + dt / mv.dur);
      mv.run(prog, to);
      prog = to;
      if (prog >= 1) { queue.shift(); prog = 0; }
      tidy();
    }

    return {
      lay() {
        // Soft on purpose: at most PIXELS backing pixels, the browser scales the canvas up.
        const k = Math.min(s.dpr, Math.sqrt(PIXELS / (s.W * s.H)));
        s.dpr = k;
        s.cv.width = Math.round(s.W * k); s.cv.height = Math.round(s.H * k);
        if (!lastW) {
          lastW = s.W; lastH = s.H;
          // A bath already worked for a while, so the first picture is a finished pattern.
          for (let i = 0; i < 500; i++) advance(0.15);
          return;
        }
        const dx = (s.W - lastW) / 2, dy = (s.H - lastH) / 2;
        lastW = s.W; lastH = s.H;
        for (const q of polys) for (let i = 0; i < q.p.length; i += 2) { q.p[i] += dx; q.p[i + 1] += dy; }
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        if (bg >= 0 && bg < nc) {
          ctx.fillStyle = s.colors[bg];
          ctx.fillRect(0, 0, s.W, s.H);
        }
        for (const q of polys) {
          const p = q.p;
          // Bare paper is cut out of what lies beneath.
          ctx.globalCompositeOperation = q.c < nc ? 'source-over' : 'destination-out';
          ctx.fillStyle = q.c < nc ? s.colors[q.c] : '#000';
          ctx.beginPath();
          ctx.moveTo(p[0], p[1]);
          for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      },
      stop() { s.cv.style.opacity = ''; },
    };
  });
}

/** Whether x, y is inside the outline (even-odd). @param {number[]} p @param {number} x @param {number} y
 * @returns {boolean} */
function contains(p, x, y) {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    if ((p[i + 1] > y) !== (p[j + 1] > y) && x < (p[j] - p[i]) * (y - p[i + 1]) / (p[j + 1] - p[i + 1]) + p[i]) inside = !inside;
  }
  return inside;
}
