// Spider web: a small drawn spider spins an orb web in the order a real one does: the frame and
// mooring lines, then radial threads out from the hub, then the sticky spiral from the rim inward.
// Dew beads gather and glint slowly; then the web fades and is spun again. The seed picks the
// variant: one large web moored to the edges of the host; a few small webs about the host, spun
// at staggered times; or a web hung from a branch along the top that sways in a breeze, the
// spider first dropping to the hub on its dragline.

import { stage, TAU, clamp } from './stage.js';
import { makeRng } from '../rng.js';

// Phase lengths, seconds: frame, per radial, per spiral step, dew gathering, hold, fade, gap.
const T_FRAME = 4, T_SPOKE = 1, T_STEP = 0.22, T_DEW = 5, T_HOLD = 12, T_FADE = 4, T_GAP = 2;

/** @typedef {{hx:number, hy:number, rf:number, seed:number, clock:number}} Web */
/**
 * Geometry in px, rebuilt from a web's seed for each size.
 * @typedef {{x:number, y:number, R:number, frame:number[], moor:number[], spokes:number[], spiral:number[],
 *   hub:number[], beads:{x:number, y:number, r:number, u:number, c:number}[], times:number[]}} Geo
 */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { layout, rng } = s;
    /** @type {Web[]} */
    const webs = [];
    /** @type {Geo[]} */
    let geos = [];
    const thread = s.colors[0], body = s.dark ? s.colors[1 % s.colors.length] : s.ink;
    const branchColor = s.colors[2 % s.colors.length];
    const dews = s.colors.map((c) => glow(c));
    const branchY = () => Math.max(18, s.H * 0.05);

    /** Builds a web's geometry for the current size. @param {Web} w @returns {Geo} */
    function build(w) {
      const r = makeRng(w.seed), m = Math.min(s.W, s.H);
      const R = w.rf * m, x = w.hx * s.W, y = layout === 2 ? branchY() + R * 1.25 : w.hy * s.H;
      // Frame: an irregular polygon round the hub.
      const k = 5 + r.int(3), frame = [];
      const turn = r.random() * TAU;
      for (let i = 0; i < k; i++) {
        const a = turn + (i + (r.random() - 0.5) * 0.5) * TAU / k, d = R * (0.92 + r.random() * 0.22);
        frame.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
      }
      // Mooring lines from each frame corner, away from the hub.
      const moor = [];
      for (let i = 0; i < k; i++) {
        const fx = frame[i * 2], fy = frame[i * 2 + 1], dx = fx - x, dy = fy - y, d = Math.hypot(dx, dy);
        let tx, ty;
        if (layout === 2 && dy < 0) { tx = fx + dx * 0.2; ty = branchY(); }
        else if (layout === 0) {
          // Out to the edge of the host.
          const ux = dx / d, uy = dy / d;
          const t = Math.min(ux > 0 ? (s.W - fx) / ux : ux < 0 ? -fx / ux : 1e9, uy > 0 ? (s.H - fy) / uy : uy < 0 ? -fy / uy : 1e9);
          tx = fx + ux * t; ty = fy + uy * t;
        } else { tx = fx + dx / d * R * 0.45; ty = fy + dy / d * R * 0.45; }
        moor.push(fx, fy, tx, ty);
      }
      // Radials: evenly round with a little jitter, each out to where it meets the frame.
      const n = clamp(Math.round(R / 14), 14, 24), spokes = [];
      for (let i = 0; i < n; i++) {
        const a = turn + (i + (r.random() - 0.5) * 0.3) * TAU / n, ux = Math.cos(a), uy = Math.sin(a);
        let best = R;
        for (let j = 0; j < k; j++) {
          const ax = frame[j * 2], ay = frame[j * 2 + 1], bx = frame[(j + 1) % k * 2], by = frame[(j + 1) % k * 2 + 1];
          const ex = bx - ax, ey = by - ay, den = ux * ey - uy * ex;
          if (Math.abs(den) < 1e-9) continue;
          const t = ((ax - x) * ey - (ay - y) * ex) / den, u = ((ax - x) * uy - (ay - y) * ux) / den;
          if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
        }
        spokes.push(ux, uy, best);
      }
      // Capture spiral: from near the rim inward, one point per radial crossed.
      const spacing = clamp(R / 11, 8, 26), f0 = 0.93, f1 = 0.2;
      const steps = Math.round((f0 - f1) * R / spacing * n), spiral = [];
      for (let i = 0; i <= steps; i++) {
        const sp = i % n, f = f0 - (f0 - f1) * i / steps;
        spiral.push(x + spokes[sp * 3] * spokes[sp * 3 + 2] * f, y + spokes[sp * 3 + 1] * spokes[sp * 3 + 2] * f);
      }
      // Hub: a few tight turns.
      const hub = [];
      for (let i = 0; i <= n * 3; i++) {
        const sp = i % n, f = 0.04 + 0.1 * i / (n * 3);
        hub.push(x + spokes[sp * 3] * R * f, y + spokes[sp * 3 + 1] * R * f);
      }
      // Dew on about a third of the spiral's crossings.
      const beads = [];
      for (let i = 0; i < spiral.length / 2; i++) {
        if (r.random() < 0.34) beads.push({ x: spiral[i * 2], y: spiral[i * 2 + 1] + 1, r: 1.7 + r.random() * 2, u: r.random(), c: r.int(dews.length) });
      }
      const times = [T_FRAME, n * T_SPOKE, steps * T_STEP, T_DEW, T_HOLD, T_FADE, T_GAP];
      return { x, y, R, frame, moor, spokes, spiral, hub, beads, times };
    }

    /** A new web's spec, in a free spot. @param {number} i slot @param {number} count @returns {Web} */
    function spec(i, count) {
      if (layout === 0) {
        // Off to one side, so most of it shows past a board in the middle.
        const side = rng.random() < 0.5 ? -1 : 1;
        return { hx: 0.5 + side * (0.17 + rng.random() * 0.1), hy: 0.36 + rng.random() * 0.2, rf: 0.52 + rng.random() * 0.08, seed: rng.int(1e9), clock: 0 };
      }
      if (layout === 2) return { hx: 0.5 + (rng.random() < 0.5 ? -1 : 1) * (0.2 + rng.random() * 0.08), hy: 0, rf: 0.34 + rng.random() * 0.06, seed: rng.int(1e9), clock: 0 };
      // Small webs in a loose grid, one per cell.
      const cols = s.W > s.H ? count : 1, rows = s.W > s.H ? 1 : count;
      const cx = (i % cols + 0.25 + rng.random() * 0.5) / cols, cy = (Math.floor(i / cols) % rows + 0.3 + rng.random() * 0.4) / rows;
      return { hx: cx, hy: cy, rf: 0.17 + rng.random() * 0.06, seed: rng.int(1e9), clock: 0 };
    }

    /** Total cycle length. @param {Geo} g @returns {number} */
    const cycle = (g) => g.times.reduce((a, b) => a + b, 0);

    /** Which phase a clock is in. @param {Geo} g @param {number} c @returns {[number, number]} phase index and its 0..1 */
    function phase(g, c) {
      for (let i = 0; i < g.times.length; i++) {
        if (c < g.times[i]) return [i, c / g.times[i]];
        c -= g.times[i];
      }
      return [g.times.length - 1, 1];
    }

    /** Draws one web at its clock. @param {Geo} g @param {number} c @returns {void} */
    function drawWeb(g, c) {
      const { ctx } = s;
      const [ph, u] = phase(g, c);
      if (ph === 6) return;
      const fade = ph === 5 ? 1 - u : 1;
      const base = (s.dark ? 0.42 : 0.5) * fade;
      ctx.strokeStyle = thread;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = base;
      /** @type {[number, number, number]} spider x, y, heading */
      let spider = [g.x, g.y, Math.PI / 2];
      const moving = ph < 3;
      const k = g.frame.length / 2, n = g.spokes.length / 3;

      // Frame and moorings; in the branch variant the spider first drops on its dragline.
      ctx.beginPath();
      let fu = ph === 0 ? u : 1;
      if (layout === 2) {
        const dropX = g.x, top = branchY(), du = ph === 0 ? Math.min(1, u / 0.4) : 1;
        ctx.moveTo(dropX, top); ctx.lineTo(dropX, top + (g.y - top) * du);
        if (ph === 0 && du < 1) spider = [dropX, top + (g.y - top) * du, Math.PI / 2];
        fu = ph === 0 ? Math.max(0, (u - 0.4) / 0.6) : 1;
      }
      if (fu > 0) {
        const edges = fu * k;
        for (let i = 0; i < Math.ceil(edges); i++) {
          const e = Math.min(1, edges - i), ax = g.frame[i * 2], ay = g.frame[i * 2 + 1];
          const bx = g.frame[(i + 1) % k * 2], by = g.frame[(i + 1) % k * 2 + 1];
          ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * e, ay + (by - ay) * e);
          const m = g.moor;
          ctx.moveTo(m[i * 4], m[i * 4 + 1]); ctx.lineTo(m[i * 4] + (m[i * 4 + 2] - m[i * 4]) * e, m[i * 4 + 1] + (m[i * 4 + 3] - m[i * 4 + 1]) * e);
          if (ph === 0 && e < 1) spider = [ax + (bx - ax) * e, ay + (by - ay) * e, Math.atan2(by - ay, bx - ax)];
        }
      }
      ctx.stroke();

      // Radials: out on even ones, back in on odd ones, so the spider never jumps.
      if (ph >= 1) {
        const done = ph === 1 ? u * n : n;
        ctx.beginPath();
        for (let i = 0; i < Math.ceil(done); i++) {
          const e = Math.min(1, done - i), ux = g.spokes[i * 3], uy = g.spokes[i * 3 + 1], L = g.spokes[i * 3 + 2];
          const out = i % 2 === 0, a = out ? 0 : 1 - e, b = out ? e : 1;
          ctx.moveTo(g.x + ux * L * a, g.y + uy * L * a); ctx.lineTo(g.x + ux * L * b, g.y + uy * L * b);
          if (ph === 1 && e < 1) {
            const f = out ? e : 1 - e;
            spider = [g.x + ux * L * f, g.y + uy * L * f, Math.atan2(uy, ux) + (out ? 0 : Math.PI)];
          }
        }
        ctx.stroke();
      }

      // Hub mesh, then the spiral from the rim inward.
      if (ph >= 2) {
        ctx.beginPath();
        ctx.moveTo(g.hub[0], g.hub[1]);
        for (let i = 2; i < g.hub.length; i += 2) ctx.lineTo(g.hub[i], g.hub[i + 1]);
        const pts = g.spiral.length / 2, done = ph === 2 ? u * (pts - 1) : pts - 1;
        ctx.moveTo(g.spiral[0], g.spiral[1]);
        for (let i = 1; i <= Math.ceil(done); i++) {
          const e = Math.min(1, done - (i - 1)), ax = g.spiral[i * 2 - 2], ay = g.spiral[i * 2 - 1];
          const x = ax + (g.spiral[i * 2] - ax) * e, y = ay + (g.spiral[i * 2 + 1] - ay) * e;
          ctx.lineTo(x, y);
          if (ph === 2 && e < 1) spider = [x, y, Math.atan2(g.spiral[i * 2 + 1] - ay, g.spiral[i * 2] - ax)];
        }
        ctx.stroke();
      }

      // Dew, each bead rising in at its own moment and glinting slowly.
      if (ph >= 3) {
        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        const du = ph === 3 ? u : 1;
        for (let i = 0; i < g.beads.length; i++) {
          const b = g.beads[i], show = clamp((du - b.u * 0.8) / 0.2, 0, 1);
          if (!show) continue;
          ctx.globalAlpha = fade * show * (0.55 + 0.2 * Math.sin(s.t * 0.7 + i * 1.3));
          const d = b.r * 2.6;
          ctx.drawImage(dews[b.c], b.x - d, b.y - d, d * 2, d * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (ph >= 2 && ph <= 5 && !(ph === 2 && u < 1)) spider = [g.x, g.y, Math.PI / 2];
      drawSpider(spider, g.R, fade, moving);
    }

    /** A spider: abdomen, head and eight bent legs. @param {[number, number, number]} p x, y, heading
     * @param {number} R web radius @param {number} fade @param {boolean} moving @returns {void} */
    function drawSpider(p, R, fade, moving) {
      const { ctx } = s;
      const [x, y, a] = p, z = clamp(R / 22, 6, 14), ux = Math.cos(a), uy = Math.sin(a);
      ctx.globalAlpha = 0.7 * fade;
      ctx.fillStyle = body; ctx.strokeStyle = body;
      ctx.beginPath();
      ctx.ellipse(x - ux * z * 0.5, y - uy * z * 0.5, z * 0.62, z * 0.48, a, 0, TAU);
      ctx.moveTo(x + ux * z * 0.25 + z * 0.32, y + uy * z * 0.25);
      ctx.arc(x + ux * z * 0.25, y + uy * z * 0.25, z * 0.32, 0, TAU);
      ctx.fill();
      ctx.lineWidth = Math.max(1, z * 0.12);
      ctx.beginPath();
      const step = moving ? Math.sin(s.t * 12) * 0.18 : 0;
      for (const side of [-1, 1]) {
        for (let j = 0; j < 4; j++) {
          const spread = (j - 1.5) * 0.5 + (j % 2 ? step : -step) * side;
          const la = a + side * (Math.PI / 2 - spread * 1.1);
          const bx = x + ux * z * 0.2, by = y + uy * z * 0.2;
          const kx = bx + Math.cos(la) * z * 0.75 + ux * (1.5 - j) * z * 0.25, ky = by + Math.sin(la) * z * 0.75 + uy * (1.5 - j) * z * 0.25;
          const fx = kx + Math.cos(la - side * 0.2) * z * 0.6 + ux * (1.5 - j) * z * 0.35, fy = ky + Math.sin(la - side * 0.2) * z * 0.6 + uy * (1.5 - j) * z * 0.35;
          ctx.moveTo(bx, by); ctx.lineTo(kx, ky - z * 0.15); ctx.lineTo(fx, fy);
        }
      }
      ctx.stroke();
    }

    /** The branch along the top, with a few leaves. @returns {void} */
    function drawBranch() {
      const { ctx } = s, y = branchY(), m = Math.min(s.W, s.H);
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = branchColor; ctx.fillStyle = branchColor;
      ctx.lineWidth = clamp(m / 120, 3, 7);
      ctx.beginPath();
      ctx.moveTo(-10, y + 6);
      ctx.bezierCurveTo(s.W * 0.3, y - 10, s.W * 0.6, y + 12, s.W + 10, y - 4);
      ctx.stroke();
      ctx.beginPath();
      const L = clamp(m / 22, 14, 34);
      for (let i = 1; i < 6; i++) {
        const x = s.W * i / 6 + 13, a = Math.PI / 2 + (i % 2 ? 0.7 : -0.7) + 0.08 * Math.sin(s.t * 0.6 + i);
        const ux = Math.cos(a), uy = Math.sin(a), tx = x + ux * L, ty = y + uy * L;
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + ux * L * 0.5 - uy * L * 0.3, y + uy * L * 0.5 + ux * L * 0.3, tx, ty);
        ctx.quadraticCurveTo(x + ux * L * 0.5 + uy * L * 0.3, y + uy * L * 0.5 - ux * L * 0.3, x, y);
      }
      ctx.fill();
    }

    return {
      lay() {
        if (!webs.length) {
          const count = layout === 1 ? clamp(Math.round(s.W * s.H / 260000), 2, 4) : 1;
          for (let i = 0; i < count; i++) webs.push(spec(i, count));
          geos = webs.map(build);
          // Open part way through spinning, or finished and dewy for reduced motion; small webs staggered.
          webs.forEach((w, i) => {
            const g = geos[i], t = g.times;
            w.clock = s.reduced ? t[0] + t[1] + t[2] + t[3] + 1
              : layout === 1 ? (t[0] + t[1] * 0.5 + i * cycle(g) / webs.length) % (cycle(g) - t[5] - t[6])
                : t[0] + t[1] * 0.6;
          });
        }
        geos = webs.map(build);
      },
      step(dt) {
        webs.forEach((w, i) => {
          w.clock += dt;
          if (w.clock >= cycle(geos[i])) {
            // Spun again: a new web, in the same region.
            webs[i] = { ...spec(i, webs.length), clock: 0 };
            geos[i] = build(webs[i]);
          }
        });
      },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (layout === 2) {
          drawBranch();
          // The web sways a little about where it hangs.
          const g = geos[0], sway = 0.025 * Math.sin(s.t * 0.45) + 0.01 * Math.sin(s.t * 1.1);
          ctx.save();
          ctx.translate(g.x, branchY());
          ctx.rotate(sway);
          ctx.translate(-g.x, -branchY());
          drawWeb(g, webs[0].clock);
          ctx.restore();
        } else {
          webs.forEach((w, i) => drawWeb(geos[i], w.clock));
        }
        ctx.globalAlpha = 1;
      },
    };
  });
}

/** A round glow with a bright core, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function glow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 32, 32);
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.35, 'rgba(0,0,0,.85)');
  grad.addColorStop(0.45, 'rgba(0,0,0,.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return c;
}
