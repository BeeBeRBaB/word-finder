// Ferris wheel: the subject's icons ride in gondolas round a slowly turning wheel, the gondolas
// hanging upright from the rim and swinging as pendulums in the breeze and as the wheel speeds up
// or slows. The seed picks the variant: one big wheel, two or three wheels of different sizes at
// a fair, or a close-up of a huge wheel's top that moves one car along at a time and stops.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';

/** @typedef {{k:number, th:number, om:number}} Car
 * A gondola: the icon in it and its swing, th radians from hanging straight down and om rad/s.
 * @typedef {{cx:number, cy:number, R:number, size:number, ground:number, rel:number, w:number,
 *   ang0:number, ang:number, om:number, al:number, cars:Car[]}} Wheel
 * A wheel round hub cx, cy of radius R standing on `ground`; rel its size among the fair's
 * wheels, w its turning speed (rad/s), ang0 its angle at the start, and ang, om, al its angle,
 * speed and acceleration now. */

const ALPHA = 0.58;
const G = 480;        // px/s², for the swing
const DAMP = 0.45;    // of the swing, per second
const MOVE = 3.2;     // seconds the close-up wheel moves for, between stops
const STOP = 2.8;     // seconds it stands still

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Wheel[]} */
    let wheels = [];
    const spin = rng.random() < 0.5 ? -1 : 1;

    /** @param {number} rel @param {number} w @returns {Wheel} */
    const wheel = (rel, w) => ({ cx: 0, cy: 0, R: 1, size: 30, ground: 0, rel, w, ang0: rng.random() * TAU, ang: 0, om: 0, al: 0, cars: [] });

    /** Gives w n cars, keeping those it has. @param {Wheel} w @param {number} n @returns {void} */
    function fill(w, n) {
      while (w.cars.length < n) {
        const i = w.cars.length;
        w.cars.push({ k: i % 7 === 3 ? 0 : i, th: (rng.random() * 2 - 1) * 0.09, om: 0 });
      }
      w.cars.length = n;
    }

    /** Hang from a car's pivot to its icon's centre. @param {Wheel} w @returns {number} */
    const hang = (w) => w.size * 0.8;

    /** Where the wheel is turned to at time t, and its speed and acceleration.
     * @param {Wheel} w @param {number} t @returns {void} */
    function turn(w, t) {
      if (layout !== 2) { w.ang = w.ang0 + spin * w.w * t; w.om = spin * w.w; w.al = 0; return; }
      const d = spin * TAU / w.cars.length, c = Math.floor(t / (MOVE + STOP));
      const u = Math.min(1, (t - c * (MOVE + STOP)) / MOVE);
      w.ang = w.ang0 + d * (c + u * u * (3 - 2 * u));
      w.om = u < 1 ? d * 6 * u * (1 - u) / MOVE : 0;
      w.al = u < 1 ? d * (6 - 12 * u) / (MOVE * MOVE) : 0;
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H), pad = clamp(m * 0.035, 10, 30);
        const ground = s.H - pad;
        if (layout === 0) {
          if (!wheels.length) wheels = [wheel(1, 0.1)];
          // A tall host crops the sides a little sooner than leave its top half bare.
          const R = Math.min(s.W * (s.H > s.W * 1.25 ? 0.56 : 0.44), (ground - pad) / 2.3);
          Object.assign(wheels[0], { R, cx: s.W / 2, ground });
        } else if (layout === 1) {
          const three = s.W > s.H * 1.5;
          const rels = three ? [1, 0.72, 0.55] : [1, 0.72], xs = three ? [0.28, 0.63, 0.88] : [0.36, 0.76];
          if (wheels.length !== rels.length) wheels = rels.map((rel, i) => wheel(rel, 0.085 + 0.025 * i));
          // On a tall host the smaller wheel stands further off, on higher ground.
          const tall = s.H > s.W * 1.25;
          const R0 = Math.min((ground - pad) / 2.3, s.W * (three ? 0.24 : tall ? 0.48 : 0.3));
          wheels.forEach((w, i) => Object.assign(w, { R: R0 * w.rel, cx: s.W * (tall ? [0.42, 0.68][i] : xs[i]),
            ground: tall && i ? s.H * 0.47 : ground }));
        } else {
          if (!wheels.length) wheels = [wheel(1, 0)];
          const R = Math.max(s.W, s.H) * 0.6;
          Object.assign(wheels[0], { R, cx: s.W / 2, cy: s.H * 0.12 + R, ground: s.H * 0.12 + 2.4 * R });
        }
        for (const w of wheels) {
          w.size = layout === 2 ? clamp(m * 0.09, 32, 60) : clamp(w.R * 0.2, 26, 60);
          if (layout !== 2) w.cy = w.ground - w.R - hang(w) - w.size * 0.65 - 4;
          // A lone wheel on a tall host stands on longer legs, nearer the middle.
          if (layout === 0 && s.H > s.W * 1.25) w.cy = Math.min(w.cy, Math.max(s.H * 0.46, w.R + pad * 2));
          fill(w, clamp(Math.round(TAU * w.R / (w.size * (layout === 2 ? 2.6 : 2.3))), 8, layout === 2 ? 48 : 18));
          turn(w, s.t);
        }
      },
      step(dt) {
        const h = Math.min(dt, 0.05) / 2;
        for (const w of wheels) {
          turn(w, s.t);
          const L = hang(w), n = w.cars.length;
          w.cars.forEach((c, i) => {
            const a = w.ang + i * TAU / n, sn = Math.sin(a), cs = Math.cos(a);
            // The pivot's acceleration round the wheel, which the gondola feels as a push.
            const ax = -w.R * (w.al * sn + w.om * w.om * cs), ay = w.R * (w.al * cs - w.om * w.om * sn);
            const breeze = layout === 2 ? 0 : 0.7 * Math.sin(s.t * 0.6 + i * 1.7 + w.rel * 5);
            for (let k = 0; k < 2; k++) {
              const acc = (-(G + ay) * Math.sin(c.th) - ax * Math.cos(c.th)) / L - DAMP * c.om + breeze;
              c.om += acc * h;
              c.th = clamp(c.th + c.om * h, -0.6, 0.6);
            }
          });
        }
      },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        wheels.forEach((w, wi) => {
          const n = w.cars.length, { cx, cy, R } = w;
          // The frame: legs, rim, inner ring, spokes and bracing, and the hub.
          ctx.strokeStyle = s.colors[wi % s.colors.length];
          ctx.globalAlpha = s.dark ? 0.28 : 0.38;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - R * 0.6, w.ground); ctx.lineTo(cx, cy); ctx.lineTo(cx + R * 0.6, w.ground);
          if (layout !== 2) { ctx.moveTo(cx - R * 0.8, w.ground); ctx.lineTo(cx + R * 0.8, w.ground); }
          ctx.moveTo(cx + R, cy); ctx.arc(cx, cy, R, 0, TAU);
          ctx.moveTo(cx + R * 0.86, cy); ctx.arc(cx, cy, R * 0.86, 0, TAU);
          for (let i = 0; i < n; i++) {
            const a = w.ang + i * TAU / n, b = a + Math.PI / n;
            ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
            ctx.lineTo(cx + Math.cos(b) * R * 0.86, cy + Math.sin(b) * R * 0.86);
          }
          ctx.moveTo(cx + R * 0.07, cy); ctx.arc(cx, cy, R * 0.07, 0, TAU);
          ctx.stroke();
          const L = hang(w), z = w.size;
          w.cars.forEach((c, i) => {
            const a = w.ang + i * TAU / n;
            const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
            if (px < -2 * z || px > s.W + 2 * z || py < -2 * z || py > s.H + 2 * z) return;
            const dx = Math.sin(c.th), dy = Math.cos(c.th);
            const x = px + dx * L, y = py + dy * L;
            // The gondola: a hanger to its roof, and a tub under the icon, all tilted with the swing.
            ctx.strokeStyle = s.hue(c.k);
            ctx.fillStyle = s.hue(c.k);
            ctx.globalAlpha = s.dark ? 0.4 : 0.5;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, py); ctx.lineTo(px + dx * (L - z * 0.62), py + dy * (L - z * 0.62));
            ctx.moveTo(x - dy * z * 0.5 + dx * (-z * 0.62), y + dx * z * 0.5 + dy * (-z * 0.62));
            ctx.lineTo(x + dy * z * 0.5 + dx * (-z * 0.62), y - dx * z * 0.5 + dy * (-z * 0.62));
            ctx.moveTo(x + dy * z * 0.6, y - dx * z * 0.6);
            ctx.ellipse(x, y, z * 0.6, z * 0.58, -c.th, 0, Math.PI);
            ctx.stroke();
            ctx.globalAlpha = s.dark ? 0.1 : 0.14;
            ctx.beginPath();
            ctx.ellipse(x, y, z * 0.6, z * 0.58, -c.th, 0, Math.PI);
            ctx.fill();
            s.icon(c.k, x, y, z * 0.92, -c.th, ALPHA);
          });
        });
      },
    };
  });
}
