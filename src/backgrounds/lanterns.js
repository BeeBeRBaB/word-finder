// Lanterns: paper sky lanterns rise slowly, swaying, each lit from its flame and breathing a soft
// glow, nearer ones larger and quicker, in the look's colours. The seed picks the variant: a sky,
// lanterns rising all over at many depths; a release, a stream of them lifting off from one spot
// low down and fanning out as they climb and recede; or a lake, lanterns rising off a far shore,
// their light laid on the water below as wavering streaks.

import { stage, TAU, clamp } from './stage.js';

const SW = 120, SH = 150;  // lantern sprite size

/** @typedef {{x:number, y:number, z:number, ph:number, f:number, c:number, vx:number}} Lantern */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    const bodies = s.colors.map((c) => lantern(c, s.dark));
    const halos = s.colors.map((c) => halo(c));
    /** @type {Lantern[]} */
    let lanterns = [];
    let m = 1, size = 40, lastW = 0, lastH = 0;
    // Release: where they lift off, across; off to one side of the middle, where the board sits.
    const spot = rng.random() < 0.5 ? 0.14 + rng.random() * 0.2 : 0.66 + rng.random() * 0.2;
    /** @returns {number} the lake's shoreline, from the top */
    const shore = () => s.H * 0.74;

    /** Puts p back at the bottom of its run. @param {Lantern} p @param {boolean} anywhere spread up the sky too */
    function launch(p, anywhere) {
      const r = rng.random();
      if (layout === 1) {
        p.x = s.W * spot + (rng.random() - 0.5) * m * 0.12;
        p.y = anywhere ? s.H * (0.1 + 0.95 * r) : s.H + size * (0.5 + rng.random());
        // Spread grows with height, as though they had drifted apart from the start.
        if (anywhere) p.x += (1 - p.y / s.H) * s.W * 0.45 * (p.vx / 6);
      } else if (layout === 2) {
        p.x = rng.random() * s.W;
        p.y = anywhere ? shore() * (0.05 + 0.95 * r) : shore() - 2;
      } else {
        p.x = rng.random() * s.W;
        p.y = anywhere ? s.H * (1.1 * r) : s.H + size * (1 + rng.random());
      }
    }

    /** Scale at p's height: in the release and the lake, lanterns shrink as they climb away.
     * @param {Lantern} p @returns {number} */
    function scaleOf(p) {
      if (layout === 1) return p.z * (0.5 + 0.5 * clamp(p.y / s.H, 0, 1.1));
      if (layout === 2) return p.z * (0.4 + 0.6 * clamp(p.y / shore(), 0, 1));
      return p.z;
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        size = clamp(m / 13, 24, 64);
        if (lastW && (lastW !== s.W || lastH !== s.H)) {
          for (const p of lanterns) { p.x *= s.W / lastW; p.y *= s.H / lastH; }
        }
        lastW = s.W; lastH = s.H;
        const n = clamp(Math.round(s.W * s.H / 26000), 14, 42);
        while (lanterns.length < n) {
          const p = { x: 0, y: 0, z: 0.35 + 0.65 * rng.random() ** 1.5, ph: rng.random() * TAU,
            f: 0.08 + rng.random() * 0.08, c: rng.int(C), vx: (rng.random() - 0.5) * 12 };
          launch(p, true);
          lanterns.push(p);
        }
        lanterns.length = n;
        lanterns.sort((a, b) => a.z - b.z);
      },
      step(dt) {
        const k = size / 40;
        for (const p of lanterns) {
          const sc = scaleOf(p);
          p.y -= (6 + 16 * sc) * k * dt;
          p.x += (layout === 1 ? p.vx * 1.4 : p.vx * 0.3 + 3) * k * dt * sc;
          const gone = p.y < -size * 1.5 || p.x < -size * 2 || p.x > s.W + size * 2;
          if (gone) launch(p, false);
        }
      },
      draw() {
        const { ctx } = s;
        const t = s.t;
        if (layout === 2) {
          // The far shore: one faint line, and the water's shimmer lines below it.
          const y0 = shore();
          ctx.globalAlpha = s.dark ? 0.22 : 0.26;
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, y0); ctx.lineTo(s.W, y0);
          for (let i = 1; i < 7; i++) {
            const y = y0 + (s.H - y0) * (i / 7) ** 1.2, len = s.W * 0.06 * (1 + i * 0.3);
            for (let x = ((t * 6 * (i % 2 ? 1 : -1) + i * 97) % (len * 3)) - len * 3; x < s.W; x += len * 3) {
              ctx.moveTo(x, y); ctx.lineTo(x + len, y);
            }
          }
          ctx.globalAlpha = s.dark ? 0.12 : 0.16;
          ctx.stroke();
          // Reflections: a tall wavering streak under each lantern.
          if (s.dark) ctx.globalCompositeOperation = 'lighter';
          for (const p of lanterns) {
            const sc = scaleOf(p), d = size * sc;
            const ry = y0 + (y0 - p.y) * 0.3 + d * 0.6;
            if (ry > s.H + d) continue;
            const w = d * (0.7 + 0.15 * Math.sin(t * 0.9 + p.ph)), h = d * (1.6 + (y0 - p.y) / s.H * 2);
            ctx.globalAlpha = (s.dark ? 0.42 : 0.3) * (0.8 + 0.2 * Math.sin(t * 0.5 + p.ph * 2));
            ctx.drawImage(halos[p.c], p.x + Math.sin(t * 0.7 + p.ph) * d * 0.15 - w / 2, ry - h / 2, w, h);
          }
          ctx.globalCompositeOperation = 'source-over';
        }
        for (const p of lanterns) {
          const sc = scaleOf(p), d = size * sc;
          const sway = Math.sin(t * p.f * TAU + p.ph);
          const x = p.x + sway * d * 0.35, y = p.y;
          const breath = 0.8 + 0.2 * Math.sin(t * 0.55 + p.ph * 3);
          const fade = 0.55 + 0.45 * clamp(sc / p.z * 1.2, 0, 1);
          // Halo first, then the lantern on it, tilted with its sway.
          if (s.dark) ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (s.dark ? 0.34 : 0.2) * breath * fade;
          const hd = d * 2.6;
          ctx.drawImage(halos[p.c], x - hd / 2, y + d * 0.1 - hd / 2, hd, hd);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = (s.dark ? 0.5 : 0.6) * (0.85 + 0.15 * breath) * fade;
          const w = d, h = d * SH / SW;
          ctx.setTransform(s.dpr, 0, 0, s.dpr, x * s.dpr, y * s.dpr);
          ctx.rotate(Math.cos(t * p.f * TAU + p.ph) * 0.07);
          ctx.drawImage(bodies[p.c], -w / 2, -h * 0.55, w, h);
          ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
        }
      },
    };
  });
}

/** A sky lantern in `color`, lit from the flame at its open foot; paler light on a dark page.
 * @param {string} color @param {boolean} dark @returns {HTMLCanvasElement} */
function lantern(color, dark) {
  const c = document.createElement('canvas');
  c.width = SW; c.height = SH;
  const g = c.getContext('2d');
  if (!g) return c;
  g.beginPath();
  g.moveTo(20, 24);
  g.quadraticCurveTo(60, -6, 100, 24);
  g.quadraticCurveTo(96, 80, 82, 122);
  g.quadraticCurveTo(60, 127, 38, 122);
  g.quadraticCurveTo(24, 80, 20, 24);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  // The light from below, warm and pale near the foot.
  g.globalCompositeOperation = 'source-atop';
  const lit = g.createRadialGradient(60, 128, 4, 60, 110, 110);
  lit.addColorStop(0, dark ? 'rgba(255,250,225,.85)' : 'rgba(255,240,200,.45)');
  lit.addColorStop(0.45, dark ? 'rgba(255,245,215,.3)' : 'rgba(255,240,200,.12)');
  lit.addColorStop(1, 'rgba(255,245,215,0)');
  g.fillStyle = lit;
  g.fillRect(0, 0, SW, SH);
  // Paper seams.
  g.strokeStyle = 'rgba(0,0,0,.22)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(60, 9); g.lineTo(60, 125);
  g.moveTo(40, 14); g.quadraticCurveTo(44, 70, 49, 124);
  g.moveTo(80, 14); g.quadraticCurveTo(76, 70, 71, 124);
  g.stroke();
  g.globalCompositeOperation = 'source-over';
  // Wire ring and flame at the foot.
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.ellipse(60, 123, 22, 4, 0, 0, TAU);
  g.stroke();
  g.fillStyle = 'rgba(255,190,90,.95)';
  g.beginPath();
  g.ellipse(60, 132, 6, 11, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,250,220,1)';
  g.beginPath();
  g.ellipse(60, 134, 3, 6, 0, 0, TAU);
  g.fill();
  return c;
}

/** A soft round glow in `color`, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function halo(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.3, 'rgba(0,0,0,.55)');
  grad.addColorStop(0.65, 'rgba(0,0,0,.15)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
