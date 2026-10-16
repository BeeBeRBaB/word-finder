// Roll: the subject's icons roll along floors like wheels, turning as they go. The seed picks
// the variant: level shelves, each rolling its own way at its own pace; a marble run of
// zigzag ramps, each icon picking up speed down a ramp and dropping onto the next; or rolling
// hills, icons slowing as they climb a rise and speeding down the far side.

import { iconStage } from './icon-stage.js';
import { clamp } from './stage.js';

/** @typedef {{y0:number, dir:number, scale:number, v:number, waves:number[]}} Track
 * A floor: base height y0, the way its icons roll (dir), their size scale and speed at the top of
 * a rise (v, px/s); waves holds amplitude, angular frequency, phase triples summed on top of y0.
 * @typedef {{k:number, f:number, x:number, y:number, u:number, w:number, rot:number, fall:number, on:boolean}} Roller
 * An icon: on floor or ramp f at x; layout 1 also moves u px/s down its ramp, or falls at fall
 * px/s while off it, spinning w rad/s; on is false while it waits to be dropped in again. */

const CAP = 44;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Track[]} */
    let tracks = [];
    /** @type {Roller[]} */
    let rollers = [];
    let size = 30, r = 13, span = 1, top = 0, run = 1, drop = 1, gap = 1, wait = 0, uT = 1, gfall = 1;
    let k = rng.int(s.n);

    /** Floor height at x. @param {Track} t @param {number} x @returns {number} */
    const ground = (t, x) => {
      let y = t.y0;
      for (let i = 0; i < t.waves.length; i += 3) y += t.waves[i] * Math.sin(t.waves[i + 1] * x + t.waves[i + 2]);
      return y;
    };
    /** Floor slope dy/dx at x. @param {Track} t @param {number} x @returns {number} */
    const slope = (t, x) => {
      let d = 0;
      for (let i = 0; i < t.waves.length; i += 3) d += t.waves[i] * t.waves[i + 1] * Math.cos(t.waves[i + 1] * x + t.waves[i + 2]);
      return d;
    };
    /** Ramp f's height at x (layout 1): down from its high end over the width. @param {number} f
     * @param {number} x @returns {number} */
    const ramp = (f, x) => {
      const u = f % 2 ? (s.W - x) / s.W : x / s.W;
      return top + f * run + u * (run - drop);
    };

    /** Layout 1: drop an icon in above the top ramp's high end. @param {Roller} p @returns {Roller} */
    const launch = (p) => Object.assign(p, {
      k: k++, f: 0, x: size * 0.6 + r, y: -size, u: 0, w: 0, rot: rng.random() * 6, fall: 0, on: true,
    });

    /** @param {number} dt @returns {void} */
    function stepRun(dt) {
      wait -= dt;
      if (wait <= 0) {
        const p = rollers.find(q => !q.on);
        if (p) launch(p);
        wait = gap * (0.7 + 0.6 * rng.random()) / uT;
      }
      for (const p of rollers) {
        if (!p.on) continue;
        const dir = p.f % 2 ? -1 : 1;
        if (p.fall >= 0 && p.f < tracks.length) {
          // Falling onto ramp f: land when it reaches the surface.
          p.fall += gfall * dt;
          p.y += p.fall * dt;
          p.w *= 1 - dt;
          const floor = ramp(p.f, p.x) - r;
          if (p.y >= floor) { p.y = floor; p.fall = -1; p.u = uT * 0.15; }
        } else if (p.fall >= 0) {
          p.fall += gfall * dt;
          p.y += p.fall * dt;
          if (p.y > s.H + size) p.on = false;
        } else {
          p.u += (uT - p.u) * Math.min(1, 0.7 * dt);
          p.x += dir * p.u * dt;
          p.w = dir * p.u / r;
          const end = dir > 0 ? s.W - size * 0.6 - r : size * 0.6 + r;
          if ((p.x - end) * dir >= 0) { p.x = end; p.f++; p.fall = 0; }
          p.y = ramp(p.f, p.x) - r;
        }
        p.rot += p.w * dt;
      }
    }

    return {
      lay() {
        const { W, H } = s;
        size = clamp(Math.min(W, H) * 0.08, 30, 54);
        r = size * 0.45;
        span = W + size * 2;
        if (layout === 1) {
          const R = clamp(Math.round(H / (size * 2.6)), 3, 8);
          top = H * 0.05 + size * 0.6;
          drop = size * 1.4;
          run = (H * 0.97 - top) / R;
          tracks = Array.from({ length: R }, (_, f) => ({ y0: 0, dir: f % 2 ? -1 : 1, scale: 1, v: 0, waves: [] }));
          uT = size * 1.6;
          gfall = size * 16;
          gap = Math.max(size * 2.6, R * W / 40);
          rollers = Array.from({ length: CAP }, () => ({ k: 0, f: 0, x: 0, y: 0, u: 0, w: 0, rot: 0, fall: 0, on: false }));
          // Warm up so the run is full on the first paint.
          wait = 0;
          const fill = R * W / uT + R;
          for (let t = 0; t < fill; t += 1 / 15) stepRun(1 / 15);
          return;
        }
        const F = clamp(Math.round(H / (size * (layout === 0 ? 3 : 4.2))), 2, layout === 0 ? 6 : 5);
        const old = tracks;
        tracks = [];
        for (let f = 0; f < F; f++) {
          const prev = old[f];
          const scale = prev?.scale ?? (layout === 2 ? 0.8 + 0.35 * f / Math.max(1, F - 1) : 0.85 + 0.3 * rng.random());
          const band = H / F;
          /** @type {number[]} */
          const waves = [];
          if (layout === 2) {
            // Whole waves across the span, so an icon wrapping round meets the same ground.
            const n1 = Math.max(1, Math.round(span / (Math.max(W, 500) * 0.55)) + (f % 2));
            const a = Math.min(band * 0.2, span / n1 * 0.07);   // kept gentle enough to roll up
            waves.push(a, n1 * 2 * Math.PI / span, rng.random() * 6, a * 0.3, (n1 * 2 + 1) * 2 * Math.PI / span, rng.random() * 6);
          }
          tracks.push({
            y0: layout === 2 ? (f + 0.62) * band + size * 0.2 : (f + 0.78) * band + size * 0.3,
            dir: prev?.dir ?? (f % 2 ? -1 : 1) * (rng.random() < 0.5 ? -1 : 1),
            scale, v: prev?.v ?? size * (layout === 2 ? 0.55 : 0.6 + 0.6 * rng.random()) * scale, waves,
          });
        }
        if (old.length !== F || !rollers.length) {
          rollers = [];
          const per = Math.max(2, Math.floor(CAP / F));
          for (let f = 0; f < F; f++) {
            let x = rng.random() * size * 2;
            for (let i = 0; i < per && x < span; i++) {
              rollers.push({ k: k++, f, x, y: 0, u: 0, w: 0, rot: rng.random() * 6, fall: -1, on: true });
              x += size * tracks[f].scale * (1.8 + 2.6 * rng.random());
            }
          }
        }
        for (const p of rollers) p.x = ((p.x % span) + span) % span;
      },
      step(dt) {
        if (layout === 1) { stepRun(dt); return; }
        for (const p of rollers) {
          const t = tracks[p.f];
          let v = t.v;
          if (layout === 2) {
            // Kept energy: slow at a crest, quicker the lower it is.
            const crest = t.y0 - t.waves[0] - t.waves[3];
            v = Math.sqrt(t.v * t.v + size * 1.5 * Math.max(0, ground(t, p.x) - crest));
          }
          const g = slope(t, p.x);
          const dx = t.dir * v * dt / Math.sqrt(1 + g * g);
          p.x = (((p.x + dx) % span) + span) % span;
          p.rot += t.dir * v * dt / (r * t.scale);
        }
      },
      draw() {
        const { ctx, W } = s;
        ctx.lineCap = 'round';
        ctx.strokeStyle = s.ink;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (layout === 1) {
          for (let f = 0; f < tracks.length; f++) {
            const x0 = size * 0.6, x1 = W - size * 0.6;
            ctx.moveTo(x0, ramp(f, x0)); ctx.lineTo(x1, ramp(f, x1));
            // A stop at the high end, so nothing rolls back off it.
            const hx = f % 2 ? x1 : x0;
            ctx.moveTo(hx, ramp(f, hx)); ctx.lineTo(hx, ramp(f, hx) - size * 0.5);
          }
        } else {
          for (const t of tracks) {
            ctx.moveTo(0, ground(t, size));
            for (let x = 8; x < W + 8; x += 8) ctx.lineTo(x, ground(t, x + size));
          }
        }
        ctx.stroke();
        for (const p of rollers) {
          if (!p.on) continue;
          if (layout === 1) {
            s.icon(p.k, p.x, p.y, size, p.rot, 0.5, p.f % 2 ? -1 : 1);
            continue;
          }
          const t = tracks[p.f];
          const x = p.x - size, rr = r * t.scale;
          // Sit on the floor: out from the contact point along the floor's normal.
          const g = slope(t, p.x), n = Math.sqrt(1 + g * g);
          s.icon(p.k, x + rr * g / n, ground(t, p.x) - rr / n, size * t.scale, p.rot, 0.38 + 0.16 * t.scale, t.dir);
        }
      },
    };
  });
}
