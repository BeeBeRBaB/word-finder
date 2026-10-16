// Snowfall: flakes of several sizes drift down in three depths, near ones bigger and quicker, each
// swaying on its own beat; the biggest are six-armed crystals that turn slowly. The seed picks
// the variant: a gentle fall on a wandering breeze, gusts that sweep across and drive the flakes
// sideways in a travelling wave, or a calm fall that settles into a soft drift along the foot.

import { stage, TAU, clamp, mix } from './stage.js';

/** @typedef {{x:number, y:number, z:number, ph:number, f:number, c:number, star:boolean, a:number, spin:number}} Flake
 * A flake at x, y with depth z (0 far .. 1 near), a sway phase and rate, its colour, whether it is
 * a crystal, and the crystal's angle and turn rate. */

const SPR = 48;      // sprite size in px
const COL = 8;       // drift column width in CSS px

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const dots = s.colors.map((c) => dot(c));
    const stars = s.colors.map((c) => crystal(c));
    /** @type {Flake[]} */
    const flakes = [];
    /** Drift height per column (variant 2). @type {Float32Array} */
    let drift = new Float32Array(0);
    let unit = 1, maxDrift = 0, lastW = 0, lastH = 0;
    /** @type {CanvasGradient|string} */
    let driftFill = s.ink;

    /** @param {Flake} p @param {boolean} anywhere @returns {Flake} */
    function launch(p, anywhere) {
      p.z = rng.random() ** 1.2;
      p.x = rng.random() * s.W;
      p.y = anywhere ? rng.random() * s.H : -20 * unit - rng.random() * 40 * unit;
      p.ph = rng.random() * TAU;
      p.f = 0.15 + rng.random() * 0.25;
      p.c = rng.int(dots.length);
      p.star = p.z > 0.5 && rng.random() < 0.45;
      p.a = rng.random() * TAU;
      p.spin = (rng.random() - 0.5) * 0.6;
      return p;
    }
    /** Size in px: a dot's radius, or a crystal's arm. @param {Flake} p @returns {number} */
    const size = (p) => (p.star ? mix(6, 13, p.z) : mix(3.4, 7.5, p.z)) * unit;
    /** Wind in px/s at x for a flake of depth z. @param {number} x @param {number} z @returns {number} */
    function wind(x, z) {
      let w = (layout === 2 ? 6 : 14) * Math.sin(s.t * 0.06 + s.seed) + 6 * Math.sin(s.t * 0.17);
      if (layout === 1) {
        // A gust front crosses left to right every 14s, strongest where it is now.
        const u = (s.t % 14) / 14, gx = mix(-0.4, 1.4, u) * s.W;
        const g = Math.exp(-(((x - gx) / (s.W * 0.22)) ** 2));
        w += g * 110;
      }
      return w * unit * mix(0.5, 1, z);
    }
    /** Drift height at x (variant 2). @param {number} x @returns {number} */
    const driftAt = (x) => drift.length ? drift[clamp(Math.floor(x / COL), 0, drift.length - 1)] : 0;

    return {
      lay() {
        unit = clamp(Math.min(s.W, s.H) / 700, 0.75, 1.3);
        const n = clamp(Math.round(s.W * s.H / 4500), 90, 320);
        // Stretch the flakes to the new size so none pile up at an edge.
        if (lastW) for (const p of flakes) { p.x *= s.W / lastW; p.y *= s.H / lastH; }
        while (flakes.length < n) flakes.push(launch({ x: 0, y: 0, z: 0, ph: 0, f: 0, c: 0, star: false, a: 0, spin: 0 }, true));
        flakes.length = n;
        lastW = s.W; lastH = s.H;
        if (layout === 2) {
          maxDrift = Math.min(s.H * 0.1, 80 * unit);
          const cols = Math.ceil(s.W / COL) + 1, old = drift;
          drift = new Float32Array(cols);
          // Keep the old drift where it was; a first lay starts half grown, in soft mounds.
          for (let i = 0; i < cols; i++) {
            drift[i] = old.length ? old[Math.floor(i * old.length / cols)]
              : maxDrift * (0.45 + 0.2 * Math.sin(i * COL / s.W * 7 + s.seed) + 0.1 * Math.sin(i * COL / s.W * 17));
          }
          const g = s.ctx.createLinearGradient(0, 0, s.W, 0);
          s.colors.forEach((c, i) => g.addColorStop(s.colors.length > 1 ? i / (s.colors.length - 1) : 0, c));
          driftFill = g;
        }
      },
      step(dt) {
        for (const p of flakes) {
          const sway = Math.cos(s.t * p.f * TAU + p.ph) * mix(8, 22, p.z) * unit;
          p.x += (wind(p.x, p.z) + sway) * dt;
          p.y += mix(16, 55, p.z) * unit * dt;
          p.a += p.spin * dt;
          if (p.x < -30) p.x += s.W + 60; else if (p.x > s.W + 30) p.x -= s.W + 60;
          if (layout === 2 && p.z > 0.3 && p.y > s.H - driftAt(p.x)) {
            // Settle: heap the column it landed in and its neighbours a little.
            const i = Math.floor(p.x / COL);
            for (let k = -2; k <= 2; k++) {
              const j = i + k;
              if (j >= 0 && j < drift.length) drift[j] = Math.min(maxDrift, drift[j] + size(p) * 0.35 * (1 - Math.abs(k) / 3));
            }
            launch(p, false);
          } else if (p.y > s.H + 20) launch(p, false);
        }
        if (drift.length) {
          // Slump toward neighbours and melt slowly, so the drift stays soft and never fills up.
          const melt = maxDrift * 0.02 * dt;
          for (let i = 1; i < drift.length - 1; i++) {
            drift[i] += ((drift[i - 1] + drift[i + 1]) / 2 - drift[i]) * Math.min(1, dt * 2);
            drift[i] = Math.max(0, drift[i] - melt);
          }
        }
      },
      draw() {
        const { ctx } = s;
        if (drift.length) {
          ctx.fillStyle = driftFill;
          ctx.globalAlpha = s.dark ? 0.2 : 0.26;
          ctx.beginPath();
          ctx.moveTo(0, s.H);
          for (let i = 0; i < drift.length; i++) ctx.lineTo(i * COL, s.H - drift[i]);
          ctx.lineTo(s.W, s.H);
          ctx.fill();
        }
        const d = s.dpr;
        for (const p of flakes) {
          const r = size(p);
          ctx.globalAlpha = mix(0.46, s.dark ? 0.62 : 0.66, p.z);
          if (p.star) {
            const c = Math.cos(p.a) * d, sn = Math.sin(p.a) * d;
            ctx.setTransform(c, sn, -sn, c, p.x * d, p.y * d);
            ctx.drawImage(stars[p.c], -r, -r, r * 2, r * 2);
            ctx.setTransform(d, 0, 0, d, 0, 0);
          } else {
            ctx.drawImage(dots[p.c], p.x - r * 1.4, p.y - r * 1.4, r * 2.8, r * 2.8);
          }
        }
      },
    };
  });
}

/** A soft round flake: solid centre, edge fading out. @param {string} color @returns {HTMLCanvasElement} */
function dot(color) {
  const c = document.createElement('canvas');
  c.width = c.height = SPR;
  const g = c.getContext('2d');
  if (!g) return c;
  const h = SPR / 2;
  g.fillStyle = color;
  g.fillRect(0, 0, SPR, SPR);
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.45, 'rgba(0,0,0,.9)');
  grad.addColorStop(0.7, 'rgba(0,0,0,.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, SPR, SPR);
  return c;
}

/** A six-armed crystal with a pair of side branches on each arm. @param {string} color @returns {HTMLCanvasElement} */
function crystal(color) {
  const c = document.createElement('canvas');
  c.width = c.height = SPR;
  const g = c.getContext('2d');
  if (!g) return c;
  const h = SPR / 2, R = h - 3;
  g.translate(h, h);
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const ca = Math.cos(i * TAU / 6), sa = Math.sin(i * TAU / 6);
    /** @param {number} x @param {number} y @returns {[number, number]} */
    const at = (x, y) => [x * ca - y * sa, x * sa + y * ca];
    g.moveTo(0, 0); g.lineTo(...at(R, 0));
    g.moveTo(...at(R * 0.55, 0)); g.lineTo(...at(R * 0.8, R * 0.22));
    g.moveTo(...at(R * 0.55, 0)); g.lineTo(...at(R * 0.8, -R * 0.22));
  }
  g.stroke();
  return c;
}
