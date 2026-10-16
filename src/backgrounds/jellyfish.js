// Jellyfish: translucent drawn jellyfish pulse their bells, each beat a push upward that the
// water slows, tentacles trailing on chains that follow the rim. They rise out of the top and
// come back in from below.
// Layout 0: a mixed bloom at several depths, small faint ones far behind. 1: a few large moon
// jellies, flat bells with four rings inside and a short fringe. 2: sea nettles, tall bells with
// long trailing tentacles and frilled arms, carried sideways on a current.

import { stage, TAU, clamp } from './stage.js';

/**
 * @typedef {{x:Float32Array, y:Float32Array, ax:number, arm:boolean}} Chain
 * @typedef {{x:number, y:number, vx:number, vy:number, w:number, h:number, z:number, p:number, f:number,
 *   ph:number, tilt:number, c:number, seg:number, ch:Chain[]}} Jelly
 * A chain's ax is where it hangs on the rim, -1..1 across; seg its link length. p is the pulse,
 * 0..1 through a beat; z depth, 0 far to 1 near.
 */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const nc = s.colors.length;
    const glows = s.colors.map((c) => sprite(c));
    const drift = L === 2 ? (rng.random() < 0.5 ? -1 : 1) : 0;
    /** @type {Jelly[]} */
    let jellies = [];
    let u = 8, oW = 0, oH = 0;

    const count = () => L === 0 ? clamp(Math.round(s.W * s.H / 55000), 7, 16)
      : L === 1 ? clamp(Math.round(s.W * s.H / 90000), 7, 10) : clamp(Math.round(s.W * s.H / 130000), 3, 8);

    /** A jelly below the bottom edge, or for a first frame the i-th of n spread over the screen.
     * @param {number} [i] @param {number} [n] @returns {Jelly} */
    function jelly(i, n) {
      const anywhere = i !== undefined && n !== undefined;
      const z = L === 0 ? rng.random() : 1;
      const w = L === 0 ? u * (1.3 + 2.6 * z) : L === 1 ? u * (3.6 + rng.random() * 2) : u * (2 + rng.random() * 1.1);
      const h = w * (L === 1 ? 0.55 : L === 2 ? 1.05 : 0.8);
      // Spread a first frame's jellies: columns in order, rows by a golden-ratio stride.
      const x = anywhere ? (i + 0.15 + rng.random() * 0.7) / n * s.W : rng.random() * s.W;
      const y = anywhere ? ((i * 0.618 + rng.random() * 0.3) % 1) * (s.H + w) + w * 0.5 : s.H + w * 1.5;
      /** @type {Chain[]} */
      const ch = [];
      const k = L === 1 ? 16 : L === 2 ? 8 : 7;
      const m = L === 1 ? 6 : L === 2 ? 26 : 14;
      const seg = L === 1 ? w * 0.1 : L === 2 ? w * 0.3 : w * 0.26;
      for (let i = 0; i < k; i++) ch.push(chain(x, y, -0.9 + 1.8 * i / (k - 1), m, seg, false));
      if (L === 2) for (let i = 0; i < 4; i++) ch.push(chain(x, y, -0.3 + 0.2 * i, 14, w * 0.26, true));
      return { x, y, vx: 0, vy: 0, w, h, z, p: rng.random(), f: 0.3 + rng.random() * 0.15, ph: rng.random() * TAU,
        tilt: 0, c: rng.int(nc), seg, ch };
    }

    /** @param {number} x @param {number} y @param {number} ax @param {number} m @param {number} seg @param {boolean} arm @returns {Chain} */
    function chain(x, y, ax, m, seg, arm) {
      const c = { x: new Float32Array(m), y: new Float32Array(m), ax, arm };
      for (let i = 0; i < m; i++) { c.x[i] = x; c.y[i] = y + i * seg; }
      return c;
    }

    /** How contracted the bell is, 0 relaxed to 1 squeezed: quick to close, slow to open. @param {number} p */
    const squeeze = (p) => { const c = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75; return c * c * (3 - 2 * c); };

    /** @param {number} dt */
    function advance(dt) {
      const t = s.t;
      for (let j = 0; j < jellies.length; j++) {
        const b = jellies[j];
        b.p = (b.p + b.f * dt) % 1;
        b.tilt = 0.3 * Math.sin(t * 0.08 + b.ph) + 0.12 * Math.sin(t * 0.21 + b.ph * 3) + drift * 0.25;
        // Each beat pushes along the bell's axis; the water's drag slows it between beats.
        const push = b.p < 0.25 ? Math.sin(b.p / 0.25 * Math.PI) * b.w * (L === 1 ? 1.1 : 1.6) : 0;
        b.vx += Math.sin(b.tilt) * push * dt;
        b.vy -= Math.cos(b.tilt) * push * dt;
        const drag = Math.exp(-dt * 1.3);
        b.vx = b.vx * drag + drift * u * 1.4 * (1 - drag);
        b.vy *= drag;
        b.x += b.vx * dt; b.y += b.vy * dt;
        const tail = b.seg * (b.ch[0].x.length + 2);
        if (b.y < -tail - b.h) { jellies[j] = jelly(); continue; }
        if (b.x < -b.w * 3) moveBy(b, s.W + b.w * 6, 0);
        else if (b.x > s.W + b.w * 3) moveBy(b, -s.W - b.w * 6, 0);
        // Chains: the first link sits on the rim, the rest follow it at link length, sway a little
        // and settle downward when the jelly stops.
        const cs = Math.cos(b.tilt), sn = Math.sin(b.tilt);
        const bw = b.w * (1 - 0.22 * squeeze(b.p));
        for (let k = 0; k < b.ch.length; k++) {
          const c = b.ch[k];
          const lx = c.ax * bw * (c.arm ? 1 : 0.92);
          c.x[0] = b.x + lx * cs; c.y[0] = b.y + lx * sn;
          const seg = c.arm ? b.w * 0.26 : b.seg;
          for (let i = 1; i < c.x.length; i++) {
            c.x[i] += Math.sin(t * 1.1 + i * 0.4 + k + b.ph) * u * 0.9 * dt + drift * u * 0.3 * dt;
            c.y[i] += u * 1.2 * dt;
            const dx = c.x[i] - c.x[i - 1], dy = c.y[i] - c.y[i - 1];
            const d = Math.hypot(dx, dy) || 1;
            c.x[i] = c.x[i - 1] + dx / d * seg; c.y[i] = c.y[i - 1] + dy / d * seg;
          }
        }
      }
    }

    /** @param {Jelly} b @param {number} dx @param {number} dy */
    function moveBy(b, dx, dy) {
      b.x += dx; b.y += dy;
      for (const c of b.ch) for (let i = 0; i < c.x.length; i++) { c.x[i] += dx; c.y[i] += dy; }
    }

    return {
      lay() {
        u = clamp(Math.min(s.W, s.H) / 60, 7, 13);
        if (oW) for (const b of jellies) {
          const sx = s.W / oW, sy = s.H / oH;
          moveBy(b, b.x * (sx - 1), b.y * (sy - 1));
        }
        const n = count();
        const first = !jellies.length;
        jellies.length = Math.min(jellies.length, n);
        while (jellies.length < n) jellies.push(jelly(jellies.length, n));
        oW = s.W; oH = s.H;
        // A first frame needs tentacles already trailing.
        if (first) for (let k = 0; k < 40; k++) advance(0.1);
      },
      step: advance,
      draw() {
        const { ctx } = s;
        const order = jellies.slice().sort((a, b) => a.z - b.z);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const b of order) {
          const fade = L === 0 ? 0.45 + 0.55 * b.z : 1;
          const col = s.colors[b.c];
          // Tentacles and arms, in page space.
          ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
          ctx.strokeStyle = col;
          for (const arm of [false, true]) {
            ctx.beginPath();
            for (const c of b.ch) {
              if (c.arm !== arm) continue;
              ctx.moveTo(c.x[0], c.y[0]);
              for (let i = 1; i < c.x.length; i++) {
                if (!arm) ctx.lineTo(c.x[i], c.y[i]);
                else {
                  // Frills: the arm wavers either side of its chain.
                  const o = Math.sin(i * 1.7 + s.t * 1.5) * b.w * 0.07;
                  ctx.lineTo(c.x[i] + o, c.y[i]);
                }
              }
            }
            ctx.lineWidth = arm ? Math.max(2, b.w * 0.13) : Math.max(1, b.w * 0.03);
            ctx.globalAlpha = fade * (arm ? (s.dark ? 0.2 : 0.24) : (s.dark ? 0.32 : 0.38));
            ctx.stroke();
          }
          // The bell, in its own tilted frame at the rim's centre.
          const q = squeeze(b.p);
          const bw = b.w * (1 - 0.22 * q), bh = b.h * (1 + 0.14 * q);
          const cs = Math.cos(b.tilt), sn = Math.sin(b.tilt);
          ctx.setTransform(s.dpr * cs, s.dpr * sn, -s.dpr * sn, s.dpr * cs, s.dpr * b.x, s.dpr * b.y);
          if (s.dark) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.22 * fade;
            const g = bw * (L === 1 ? 1.2 : 1.6);
            ctx.drawImage(glows[b.c], -g, -bh * 0.45 - g, g * 2, g * 2);
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.beginPath();
          ctx.moveTo(-bw, 0);
          ctx.bezierCurveTo(-bw * 1.04, -bh * 1.32, bw * 1.04, -bh * 1.32, bw, 0);
          // A scalloped rim back to the start.
          const sc = 8;
          for (let i = sc - 1; i >= 0; i--) {
            const x0 = bw * (-1 + 2 * (i + 0.5) / sc), x1 = bw * (-1 + 2 * i / sc);
            ctx.quadraticCurveTo(x0, bh * 0.1, x1, 0);
          }
          ctx.fillStyle = col;
          ctx.globalAlpha = fade * (L === 1 ? 0.17 : 0.22);
          ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = fade * (s.dark ? 0.48 : 0.55);
          ctx.stroke();
          // The inner bell, and a moon jelly's four rings.
          ctx.beginPath();
          ctx.moveTo(-bw * 0.62, 0);
          ctx.bezierCurveTo(-bw * 0.62, -bh * 0.85, bw * 0.62, -bh * 0.85, bw * 0.62, 0);
          if (L === 1) {
            for (let i = 0; i < 4; i++) {
              const a = TAU * (i + 0.5) / 4;
              const rx = bw * 0.15;
              const gx = Math.cos(a) * bw * 0.3, gy = -bh * 0.42 + Math.sin(a) * bh * 0.2;
              ctx.moveTo(gx + rx, gy);
              ctx.ellipse(gx, gy, rx, rx * 0.6, 0, 0, TAU);
            }
          }
          ctx.lineWidth = L === 1 ? 2 : 1.2;
          ctx.globalAlpha = fade * (s.dark ? 0.26 : 0.3);
          ctx.stroke();
        }
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      },
    };
  });
}

/** A soft round glow, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function sprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,.8)');
  grad.addColorStop(0.45, 'rgba(0,0,0,.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
