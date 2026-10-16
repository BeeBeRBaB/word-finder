// Fireworks: rockets climb from the bottom on short trails and burst into sparks that slow under
// drag, droop and fade over a few seconds, each trailing a tail that thins with age. Calm: a burst
// grows from a point and a spark's alpha only falls, so nothing flashes. The seed picks the
// variant: peonies and chrysanthemums launched one at a time across the sky; willows and palms
// fired in salvos from a row of mortars; tilted rings round a core of another colour.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x0:number, y0:number, x1:number, y1:number, age:number, T:number, kind:number, c:number}} Rocket
 * Climbs from (x0, y0) to (x1, y1) in T seconds, then bursts as `kind` in colour c. */
/** @typedef {{p:Float32Array, n:number, age:number, life:number, k:number, g:number, tail:number,
 *   segs:number, w:number, c:number, head:boolean}} Burst
 * Sparks as [x, y, vx, vy]; drag k (1/s), gravity g (px/s²), tail length in seconds of flight cut
 * into `segs` strokes of falling alpha, line width w. */

/** Per kind: sparks per px of radius (or a count), drag, gravity, life, tail, tail strokes, width.
 * 0 peony, 1 chrysanthemum, 2 willow, 3 palm, 4 ring, 5 core. */
const KIND = [
  { n: 0.55, k: 1.7, g: 26, life: 2.8, tail: 0.16, segs: 1, w: 1.6, head: true },
  { n: 0.5, k: 1.4, g: 22, life: 3.2, tail: 0.5, segs: 2, w: 1.3, head: true },
  { n: 0.42, k: 0.95, g: 22, life: 5, tail: 0.95, segs: 3, w: 1.5, head: true },
  { n: -11, k: 1.05, g: 26, life: 3.6, tail: 0.7, segs: 3, w: 2.6, head: true },
  { n: 0.36, k: 1.9, g: 16, life: 2.7, tail: 0.14, segs: 1, w: 1.7, head: true },
  { n: -22, k: 2.2, g: 18, life: 2.2, tail: 0.12, segs: 1, w: 1.4, head: true },
];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const dots = s.colors.map((c) => dot(c));
    /** @type {Rocket[]} */
    const rockets = [];
    /** @type {Burst[]} */
    const bursts = [];
    let wait = 0, warm = false;

    /** Burst radius for this screen. @returns {number} */
    const size = () => clamp(Math.min(s.W, s.H) * 0.17, 55, 150);
    /** Seconds between launches: more sky, more fireworks. @returns {number} */
    const gap = () => 1 / clamp(s.W * s.H / 520000, 0.6, 1.6);

    /** @param {number} x0 @param {number} x1 @param {number} kind @param {number} c @returns {void} */
    function fire(x0, x1, kind, c) {
      const y1 = s.H * (0.14 + rng.random() * 0.36);
      rockets.push({ x0, y0: s.H + 8, x1, y1, age: 0, T: clamp(s.H / 620, 1.1, 1.9) * (0.9 + rng.random() * 0.2), kind, c });
    }

    /** @returns {void} */
    function launch() {
      const c = rng.int(nc);
      if (layout === 1) {
        // A salvo from the row of mortars: two or three shells of one kind, fanning out.
        const k = 2 + rng.int(2), kind = rng.random() < 0.6 ? 2 : 3;
        const m = 5, first = rng.int(m - k + 1);
        for (let i = 0; i < k; i++) {
          const x0 = s.W * (0.1 + 0.8 * (first + i) / (m - 1));
          fire(x0, x0 + (x0 - s.W / 2) * 0.25 + (rng.random() - 0.5) * 40, kind, (c + i) % nc);
        }
        wait = gap() * k * (0.8 + rng.random() * 0.6);
        return;
      }
      const x0 = s.W * (0.12 + rng.random() * 0.76);
      fire(x0, x0 + (rng.random() - 0.5) * s.W * 0.12, layout === 2 ? 4 : rng.int(2), c);
      wait = gap() * (0.6 + rng.random() * 0.8);
    }

    /** @param {number} kind @param {number} x @param {number} y @param {number} c @param {number} R @returns {void} */
    function burst(kind, x, y, c, R) {
      const K = KIND[kind];
      const n = K.n < 0 ? -K.n + rng.int(5) : Math.round(clamp(R * K.n, 24, 90));
      const p = new Float32Array(n * 4);
      // Rings are a circle tilted away from the viewer, turned to a random angle.
      const tilt = rng.random() * TAU, flat = 0.22 + rng.random() * 0.5;
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const a0 = rng.random() * TAU;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i + (kind === 4 ? 0 : (rng.random() - 0.5) * 0.7)) / n * TAU;
        // Drag k stops a spark after v/k px, so speed = reach × k.
        const v = R * K.k * (kind === 4 || kind === 3 ? 0.95 + rng.random() * 0.05 : 0.72 + rng.random() * 0.28);
        let dx = Math.cos(a), dy = Math.sin(a);
        if (kind === 4) { dy *= flat; const ex = dx * ct - dy * st; dy = dx * st + dy * ct; dx = ex; }
        p[i * 4] = x; p[i * 4 + 1] = y; p[i * 4 + 2] = dx * v; p[i * 4 + 3] = dy * v - (kind === 3 ? R * 0.25 : 0);
      }
      const g = K.g * R / 110;
      bursts.push({ p, n, age: 0, life: K.life * (0.9 + rng.random() * 0.2), k: K.k, g, tail: K.tail, segs: K.segs, w: K.w, c, head: K.head });
    }

    /** @param {Rocket} r @returns {void} */
    function explode(r) {
      const R = size() * (0.75 + rng.random() * 0.5);
      burst(r.kind, r.x1, r.y1, r.c, R);
      // Half the peonies and every ring get a small core in another colour.
      if (nc > 1 && (r.kind === 4 || (r.kind === 0 && rng.random() < 0.5))) burst(5, r.x1, r.y1, (r.c + 1 + rng.int(nc - 1)) % nc, R * 0.38);
    }

    /** Where a spark was `tau` seconds ago, under drag k and gravity g. @param {number} x @param {number} y
     * @param {number} vx @param {number} vy @param {number} E (e^(k·tau) - 1) / k @param {number} G g(E - tau) / k
     * @param {number[]} out @returns {void} */
    function past(x, y, vx, vy, E, G, out) {
      out[0] = x - vx * E;
      out[1] = y - vy * E + G;
    }

    /** @param {number} dt @returns {void} */
    function step(dt) {
      wait -= dt;
      if (wait <= 0) launch();
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.age += dt;
        if (r.age >= r.T) { explode(r); rockets.splice(i, 1); }
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.age += dt;
        if (b.age >= b.life) { bursts.splice(i, 1); continue; }
        const f = Math.exp(-b.k * dt), p = b.p, gv = b.g * dt;
        for (let j = 0; j < b.n * 4; j += 4) {
          p[j + 2] *= f;
          p[j + 3] = p[j + 3] * f + gv;
          p[j] += p[j + 2] * dt;
          p[j + 1] += p[j + 3] * dt;
        }
      }
    }

    /** @type {number[]} */
    const q = [0, 0], q2 = [0, 0];

    return {
      lay() {
        // Run a few seconds on the first paint, so a still frame (reduced motion) has bursts in it.
        if (warm) return;
        warm = true;
        for (let i = 0; i < 150; i++) step(1 / 30);
      },
      step,
      draw() {
        const { ctx } = s;
        const base = s.dark ? 0.72 : 0.78;
        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const r of rockets) {
          // Eased climb: fast off the ground, slowing to the burst.
          const u = r.age / r.T, e = 1 - (1 - u) ** 2, eb = 1 - (1 - Math.max(0, u - 0.12)) ** 2;
          const x = r.x0 + (r.x1 - r.x0) * e, y = r.y0 + (r.y1 - r.y0) * e;
          ctx.strokeStyle = s.colors[r.c];
          ctx.globalAlpha = base * 0.45;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(r.x0 + (r.x1 - r.x0) * eb, r.y0 + (r.y1 - r.y0) * eb);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.globalAlpha = base * 0.8;
          ctx.drawImage(dots[r.c], x - 4, y - 4, 8, 8);
        }
        for (const b of bursts) {
          const A = base * Math.min(1, b.age / 0.15) * (1 - (b.age / b.life) ** 2);
          if (A < 0.01) continue;
          const p = b.p, tau = Math.min(b.tail, b.age);
          ctx.strokeStyle = s.colors[b.c];
          ctx.lineWidth = b.w;
          // The tail in strokes from newest to oldest, each fainter than the one before.
          for (let k = 0; k < b.segs; k++) {
            const t0 = tau * k / b.segs, t1 = tau * (k + 1) / b.segs;
            const E0 = (Math.exp(b.k * t0) - 1) / b.k, G0 = b.g * (E0 - t0) / b.k;
            const E1 = (Math.exp(b.k * t1) - 1) / b.k, G1 = b.g * (E1 - t1) / b.k;
            ctx.globalAlpha = A * 0.8 * (1 - k / b.segs);
            ctx.beginPath();
            for (let j = 0; j < b.n * 4; j += 4) {
              past(p[j], p[j + 1], p[j + 2], p[j + 3], E0, G0, q);
              past(p[j], p[j + 1], p[j + 2], p[j + 3], E1, G1, q2);
              ctx.moveTo(q[0], q[1]);
              ctx.lineTo(q2[0], q2[1]);
            }
            ctx.stroke();
          }
          if (!b.head) continue;
          ctx.globalAlpha = A;
          const img = dots[b.c], d = b.w + 2;
          for (let j = 0; j < b.n * 4; j += 4) ctx.drawImage(img, p[j] - d, p[j + 1] - d, d * 2, d * 2);
        }
      },
    };
  });
}

/** A small round spark with a soft rim, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function dot(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 16, 16);
  const grad = g.createRadialGradient(8, 8, 0, 8, 8, 8);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.45, 'rgba(0,0,0,.8)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 16);
  return c;
}
