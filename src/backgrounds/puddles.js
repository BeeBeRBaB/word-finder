// Puddles: raindrops strike still water and their rings spread, cross and interfere, worked out
// as a height field on a coarse grid (a damped wave equation) and lit by its slopes, crests in
// one look colour and troughs in another. The seed picks the variant: a light shower over one
// wide pool, rain on a few scattered puddles whose shores throw the rings back, or a handful of
// drips falling on their own steady beats so their ring trains weave a standing pattern.

import { stage, TAU, clamp } from './stage.js';

const STEP = 1 / 30;    // seconds per sim step
const DAMP = 0.962;     // height kept per step, so a ring fades in about two seconds

/** @typedef {{x:number, y:number, rx:number, ry:number, a:number, b:number, p:number, q:number}} Puddle
 * A puddle in grid cells: centre, radii, and two shoreline wobbles (amplitude a, b; phase p, q). */
/** @typedef {{x:number, y:number, per:number, next:number}} Drip a fixed drip point, in cells */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const off = document.createElement('canvas');
    const g = /** @type {CanvasRenderingContext2D} */ (off.getContext('2d'));
    /** @type {ImageData|null} */
    let img = null;
    let cell = 8, gw = 0, gh = 0, acc = 0, rate = 1;
    let cur = new Float32Array(0), old = new Float32Array(0), wet = new Float32Array(0);
    /** @type {Puddle[]} */
    let puddles = [];
    /** @type {Drip[]} */
    let drips = [];

    const rgb = s.colors.map(rgbOf);
    const hi = rgb[0], lo = rgb[1 % rgb.length], tint = rgb[2 % rgb.length];
    const base = s.dark ? 0.07 : 0.09;     // the water's own tint
    const gain = s.dark ? 1.5 : 2.2;       // slope to alpha

    /** Shore radius scale of puddle p at angle th: 1 on an ellipse, wobbled. @param {Puddle} p @param {number} th @returns {number} */
    const shore = (p, th) => 1 + p.a * Math.sin(2 * th + p.p) + p.b * Math.sin(3 * th + p.q);

    /** Pushes the water down in a small round dent at cell x, y. @param {number} x @param {number} y @param {number} amp @returns {void} */
    function drop(x, y, amp) {
      const r = 3;
      const cx = Math.round(x), cy = Math.round(y);
      for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
          const X = cx + i, Y = cy + j;
          if (X < 1 || Y < 1 || X >= gw - 1 || Y >= gh - 1) continue;
          const d = (i * i + j * j) / (r * r + 1);
          if (d < 1) cur[Y * gw + X] -= amp * (1 - d) * (1 - d);
        }
      }
    }

    /** A drop somewhere on the water. @returns {void} */
    function rainDrop() {
      for (let k = 0; k < 8; k++) {
        const x = 2 + rng.random() * (gw - 4), y = 2 + rng.random() * (gh - 4);
        if (wet[Math.round(y) * gw + Math.round(x)] > 0.9) { drop(x, y, 0.7 + rng.random() * 0.6); return; }
      }
    }

    /** One step of the damped wave equation; dry cells stay flat, so shores reflect. @returns {void} */
    function sim() {
      for (let y = 1; y < gh - 1; y++) {
        for (let x = 1, o = y * gw + 1; x < gw - 1; x++, o++) {
          if (wet[o] < 0.5) { old[o] = 0; continue; }
          // Wet below 1 is the open water's edge, damped harder.
          old[o] = ((cur[o - 1] + cur[o + 1] + cur[o - gw] + cur[o + gw]) * 0.5 - old[o]) * (wet[o] < 1 ? DAMP * wet[o] : DAMP);
        }
      }
      const t = cur; cur = old; old = t;
    }

    /** Advances the drops and the water by one sim step. @returns {void} */
    function tick() {
      if (layout === 2) {
        for (const d of drips) {
          d.next -= STEP;
          if (d.next <= 0) { d.next += d.per; drop(d.x, d.y, 1.1); }
        }
        if (rng.random() < 0.15 * STEP) rainDrop();
      } else if (rng.random() < rate * STEP) rainDrop();
      sim();
    }

    /** Lays the puddles (variant 1) or the drip points (variant 2) and the wet mask. @returns {void} */
    function build() {
      wet = new Float32Array(gw * gh);
      puddles = [];
      if (layout === 1) {
        const n = clamp(Math.round(gw * gh / 1800), 3, 7);
        const m = Math.min(gw, gh);
        for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
          const rx = m * (0.16 + rng.random() * 0.12) * (tries > 120 ? 0.7 : 1);
          const p = { x: rx + rng.random() * (gw - 2 * rx), y: 0, rx, ry: rx * (0.5 + rng.random() * 0.2),
            a: 0.06 + rng.random() * 0.08, b: 0.04 + rng.random() * 0.06, p: rng.random() * TAU, q: rng.random() * TAU };
          p.y = p.ry + 2 + rng.random() * (gh - 2 * p.ry - 4);
          if (puddles.some((o) => Math.hypot((o.x - p.x) / (o.rx + p.rx), (o.y - p.y) / (o.ry + p.ry)) < 1.05)) continue;
          puddles.push(p); k++;
        }
        for (let y = 0; y < gh; y++) {
          for (let x = 0; x < gw; x++) {
            let v = 0;
            for (const p of puddles) {
              const dx = (x - p.x) / p.rx, dy = (y - p.y) / p.ry;
              const e = Math.hypot(dx, dy) / shore(p, Math.atan2(dy, dx));
              v = Math.max(v, clamp((1 - e) * p.rx / 2, 0, 1));
            }
            wet[y * gw + x] = v;
          }
        }
      } else {
        // Open water fades out over the last few cells, so rings leave instead of bouncing back.
        for (let y = 0; y < gh; y++) {
          for (let x = 0; x < gw; x++) wet[y * gw + x] = 0.6 + 0.4 * clamp(Math.min(x, y, gw - 1 - x, gh - 1 - y) / 6, 0, 1);
        }
      }
      if (layout === 2) {
        const n = clamp(Math.round(gw * gh / 3500), 2, 4);
        drips = [];
        for (let k = 0; k < n; k++) {
          drips.push({ x: gw * (0.15 + 0.7 * (k + 0.2 + rng.random() * 0.6) / n),
            y: gh * (0.2 + rng.random() * 0.6), per: 1.3 + rng.random() * 1.3, next: rng.random() * 1.5 });
        }
      }
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        cell = clamp(m / 115, 4, 8);
        gw = Math.ceil(s.W / cell) + 1; gh = Math.ceil(s.H / cell) + 1;
        rate = clamp(0.5 + s.W * s.H / 450000, 0.6, 5);
        cur = new Float32Array(gw * gh); old = new Float32Array(gw * gh);
        off.width = gw; off.height = gh;
        img = g.createImageData(gw, gh);
        build();
        // Start mid-shower: a few drops already spreading, so a still frame is never flat water.
        const n = clamp(Math.round(rate * 2.5), 3, 10);
        for (let k = 0; k < 75; k++) {
          if (k % Math.ceil(75 / n) === 0) rainDrop();
          tick();
        }
      },
      step(dt) {
        acc = Math.min(acc + dt, STEP * 3);
        while (acc >= STEP) { acc -= STEP; tick(); }
      },
      draw() {
        if (!img) return;
        const d = img.data;
        for (let y = 0, o = 0; y < gh; y++) {
          for (let x = 0; x < gw; x++, o++) {
            const w = wet[o], p = o * 4;
            if (w <= 0 || x === 0 || y === 0 || x === gw - 1 || y === gh - 1) { d[p + 3] = 0; continue; }
            // Light from the upper left: a slope facing it is a crest's lit side.
            const v = (cur[o - 1] - cur[o + 1]) + (cur[o - gw] - cur[o + gw]) * 0.7;
            const c = v > 0 ? hi : lo, a = Math.min(0.55, Math.abs(v) * gain);
            const u = a / (a + base);
            d[p] = tint[0] + (c[0] - tint[0]) * u; d[p + 1] = tint[1] + (c[1] - tint[1]) * u; d[p + 2] = tint[2] + (c[2] - tint[2]) * u;
            d[p + 3] = 255 * w * (base + a);
          }
        }
        g.putImageData(img, 0, 0);
        const { ctx } = s;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'low';
        // Cell centres sit on grid points, so shift by half a cell.
        ctx.drawImage(off, -cell / 2, -cell / 2, gw * cell, gh * cell);
        if (layout === 1) {
          // The shorelines, faint.
          ctx.strokeStyle = s.colors[0];
          ctx.globalAlpha = s.dark ? 0.22 : 0.28;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (const p of puddles) {
            for (let k = 0; k <= 48; k++) {
              const th = k / 48 * TAU, r = shore(p, th) * (1 - 1.2 / p.rx);
              const x = (p.x + Math.cos(th) * p.rx * r) * cell - cell / 2, y = (p.y + Math.sin(th) * p.ry * r) * cell - cell / 2;
              if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            }
          }
          ctx.stroke();
        }
      },
    };
  });
}

/** Any CSS colour as [r, g, b], via a canvas's own parser. @param {string} color @returns {number[]} */
function rgbOf(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = '#888';
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = v.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
