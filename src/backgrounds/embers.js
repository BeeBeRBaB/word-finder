// Embers: glowing sparks rise from the bottom on warm air, flickering slowly and cooling as they
// climb, each shrinking and dimming until it winks out. The seed picks the variant: a campfire,
// one to three fires whose sparks fan out above a soft glow; a wide bed of coals whose sparks a
// gusting wind streams sideways; or an updraft whose rising eddies curl the sparks into loops.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, vx:number, vy:number, mx:number, my:number, up:number, age:number, dur:number, r:number,
 *   c:number, ph:number, f:number}} Ember */
/** @typedef {{x:number, y:number, s:number, k:number}} Eddy  s is its spin (signed), k its radius */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const glows = s.colors.map((c) => glow(c));
    const sparks = s.colors.map((c) => spark(c));
    /** @type {Ember[]} */
    const embers = [];
    /** @type {number[]} */
    let fires = [];
    /** @type {Eddy[]} */
    let eddies = [];
    let R = 1, warm = false;
    // The wind's side for the coal bed.
    const side = rng.random() < 0.5 ? -1 : 1;

    /** A random value that clusters round 0, in -1..1. @returns {number} */
    const bell = () => rng.random() + rng.random() - 1;

    /** (Re)launches `e` from the bottom. @param {Ember} e @returns {void} */
    function launch(e) {
      if (layout === 0) {
        const fx = fires[rng.int(fires.length)];
        e.x = fx + bell() * 60 * R;
        e.vx = bell() * 26 * R;
      } else if (layout === 1) {
        // Upwind of the screen too, so the stream fills it.
        e.x = rng.random() * (s.W + s.H * 0.8) - (side > 0 ? s.H * 0.8 : 0);
        e.vx = 0;
      } else {
        e.x = rng.random() * s.W;
        e.vx = 0;
      }
      e.y = s.H + 6 + rng.random() * 10;
      e.up = (layout === 0 ? 46 : 34) * R * (0.7 + rng.random() * 0.7);
      e.vy = -e.up;
      e.age = 0;
      e.dur = clamp((0.6 + rng.random() * 0.65) * s.H / e.up, 3, 22);
      e.r = (1.5 + rng.random() * 1.8) * R;
      e.c = rng.int(glows.length);
      e.ph = rng.random() * TAU;
      // Under one beat a second: a slow shimmer, never a flicker.
      e.f = 0.35 + rng.random() * 0.5;
    }

    /** @param {number} dt @returns {void} */
    function step(dt) {
      for (const k of eddies) {
        k.y -= 22 * R * dt;
        if (k.y < -k.k) { k.y = s.H + k.k; k.x = rng.random() * s.W; k.s = -k.s; }
      }
      for (const e of embers) {
        e.age += dt;
        if (e.age < 0) continue;
        const u = e.age / e.dur;
        let tx = 0, ty = 0;
        if (layout === 0) {
          tx = e.vx + Math.sin(s.t * 0.7 + e.ph) * 10 * R;
          e.vx *= 1 - 0.15 * dt;
        } else if (layout === 1) {
          // Gusts: the wind swells and eases over several seconds, a little stronger higher up.
          const gust = 0.6 + 0.4 * Math.sin(s.t * 0.21 + e.y * 0.003) * Math.sin(s.t * 0.13 + 1.3);
          tx = side * (28 + 42 * gust) * R * (1.2 - 0.5 * e.y / s.H);
          e.vx += (tx - e.vx) * Math.min(1, dt * 1.2);
          tx = e.vx;
        } else {
          for (const k of eddies) {
            const dx = e.x - k.x, dy = e.y - k.y, d2 = (dx * dx + dy * dy) / (k.k * k.k);
            if (d2 > 6) continue;
            const f = k.s * Math.exp(-d2) / k.k;
            tx -= dy * f;
            ty += dx * f;
          }
        }
        // Buoyancy fades as the spark cools; drag pulls its climb towards that.
        const lift = -e.up * (1 - 0.55 * u);
        e.vy += (lift - e.vy) * Math.min(1, dt * 1.5);
        e.mx = tx; e.my = e.vy + ty;
        e.x += e.mx * dt;
        e.y += e.my * dt;
        if (e.age > e.dur || e.y < -20 || e.x < -s.H || e.x > s.W + s.H) launch(e);
      }
    }

    return {
      lay() {
        R = clamp(Math.min(s.W, s.H) / 700, 0.8, 1.4);
        const nf = clamp(Math.round(s.W / 650), 1, 3);
        fires = Array.from({ length: nf }, (_, i) => s.W * (i + 0.5 + bell() * 0.15) / nf);
        const ne = clamp(Math.round(s.W * s.H / 220000), 3, 10);
        while (eddies.length < ne) {
          eddies.push({ x: rng.random() * s.W, y: rng.random() * s.H, s: (rng.random() < 0.5 ? -1 : 1) * (170 + rng.random() * 90) * R,
            k: (100 + rng.random() * 90) * R });
        }
        eddies.length = ne;
        const n = clamp(Math.round(s.W * s.H / (layout === 0 ? 8000 : 6500)), 60, 230);
        while (embers.length < n) {
          /** @type {Ember} */
          const e = { x: 0, y: 0, vx: 0, vy: 0, mx: 0, my: -1, up: 0, age: 0, dur: 1, r: 1, c: 0, ph: 0, f: 0 };
          launch(e);
          // Staggered starts, so they don't rise as one front.
          e.age = -rng.random() * e.dur;
          embers.push(e);
        }
        embers.length = n;
        if (!warm) {
          // Run the air for a while so the first frame (all of reduced motion) is mid-flow.
          warm = true;
          for (let i = 0; i < 240; i++) step(1 / 15);
        }
      },
      step,
      draw() {
        const { ctx } = s;
        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        // The source's warmth along the bottom, breathing over several seconds.
        const breathe = 0.5 + 0.5 * Math.sin(s.t * 0.45);
        if (layout === 0) {
          fires.forEach((fx, i) => {
            ctx.globalAlpha = (s.dark ? 0.22 : 0.18) + 0.06 * breathe;
            const w = 220 * R, h = 120 * R;
            ctx.drawImage(glows[i % glows.length], fx - w, s.H - h * 0.8, w * 2, h * 2);
          });
        } else {
          ctx.globalAlpha = (s.dark ? 0.12 : 0.1) + 0.03 * breathe;
          const w = 220 * R, n = Math.ceil(s.W / w) + 1;
          for (let i = 0; i < n; i++) {
            ctx.drawImage(glows[i % glows.length], i * w - w, s.H - 50 * R, w * 2, 110 * R);
          }
        }
        for (const e of embers) {
          if (e.age <= 0) continue;
          const u = e.age / e.dur, heat = 1 - u * u;
          ctx.globalAlpha = Math.min(1, e.age / 0.6) * heat * (s.dark ? 0.9 : 0.75)
            * (0.75 + 0.25 * Math.sin(s.t * e.f * TAU + e.ph));
          // The spark sprite turned to face along its path, its tail behind it.
          const vx = e.mx, vy = e.my, sp = Math.hypot(vx, vy) || 1;
          const k = e.r * (0.5 + 0.5 * heat) / 3 * s.dpr, ux = vx / sp * k, uy = vy / sp * k;
          ctx.setTransform(-uy, ux, -ux, -uy, e.x * s.dpr, e.y * s.dpr);
          ctx.drawImage(sparks[e.c], -16, -16);
        }
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      },
    };
  });
}

/** A spark heading up its sprite: a hot head at (16, 16) with a halo and a tail tapering down
 * behind it, drawn at a head radius of 3. @param {string} color @returns {HTMLCanvasElement} */
function spark(color) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  const halo = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  halo.addColorStop(0, 'rgba(0,0,0,.55)');
  halo.addColorStop(0.4, 'rgba(0,0,0,.18)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, 32, 32);
  const tail = g.createLinearGradient(0, 16, 0, 36);
  tail.addColorStop(0, 'rgba(0,0,0,.9)');
  tail.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = tail;
  g.beginPath();
  g.moveTo(13.2, 16); g.lineTo(16, 36); g.lineTo(18.8, 16);
  g.fill();
  g.fillStyle = '#000';
  g.beginPath();
  g.arc(16, 16, 3, 0, TAU);
  g.fill();
  // Tint what was drawn, keeping its alpha.
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, 32, 64);
  return c;
}

/** A round glow with a bright core, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function glow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  // Alpha alone falls off, so any colour string works and the rim never darkens.
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.2, 'rgba(0,0,0,.7)');
  grad.addColorStop(0.55, 'rgba(0,0,0,.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
