// Orrery: a clockwork model of a solar system. Planets ride arms from a central hub round drawn
// orbit rings, the inner ones faster, each lit on its sunward side; some carry moons on small
// rings of their own, one wears a ring. A brighter arc of each orbit trails its planet.
// Layout 0: seen from above, the sun in the middle. 1: tilted, orbits as ellipses, planets
// growing as they swing near and passing behind the sun. 2: the sun at a corner, its great
// orbits sweeping across the screen as arcs.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{r:number, w:number, a:number, pr:number, c:number, ring:boolean, moons:{r:number, w:number, a:number, mr:number}[]}} Planet
 * r is the orbit radius in units of the largest; w its angular speed; pr the planet's radius in units. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const nc = s.colors.length;
    const sunC = rng.int(nc);
    const glow = sprite(s.colors[sunC]);
    // Corner of layout 2's sun: x and y as -1 or 1.
    const qx = rng.random() < 0.5 ? -1 : 1, qy = rng.random() < 0.5 ? -1 : 1;
    // Layout 2's orbits are seen only over the quarter facing the screen, so a planet leaving
    // it (off screen at both ends) comes round again at its start.
    const a0 = Math.atan2(-qy, -qx) - TAU / 8 - 0.08, span = TAU / 4 + 0.16;
    /** @type {Planet[]} */
    let planets = [];
    let u = 8, cx = 0, cy = 0, R = 100, ky = 1, sunR = 10;

    /** @param {number} n */
    function build(n) {
      const old = planets;
      planets = [];
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / n;
        const r = 0.12 + 0.88 * Math.pow(f, 1.1) - (rng.random() * 0.4) / n;
        const p = old[i] ?? {
          r, w: 0, a: L === 2 ? a0 + rng.random() * span : rng.random() * TAU, pr: 0.7 + rng.random() * 0.9, c: (sunC + 1 + i) % nc, ring: false,
          moons: Array.from({ length: rng.random() < 0.45 ? 1 + rng.int(2) : 0 }, (_, k) => ({
            r: 2.4 + k * 1.3, w: (1 + rng.random() * 0.6) * (rng.random() < 0.2 ? -1 : 1), a: rng.random() * TAU, mr: 0.32 + rng.random() * 0.15 })),
        };
        p.r = r;
        // Inner planets faster, as in a real orrery's gear train, but outer ones still visibly move.
        p.w = 0.5 * Math.pow(0.12 / r, 1.1);
        planets.push(p);
      }
      if (!old.length && n > 2) {
        const p = planets[1 + rng.int(n - 2)];
        p.ring = true; p.pr = Math.max(p.pr, 1.2); p.moons = [];
      }
    }

    return {
      lay() {
        u = clamp(Math.min(s.W, s.H) / 60, 5, 12);
        let n;
        if (L === 0) {
          cx = s.W / 2; cy = s.H / 2; ky = 1;
          R = (s.W + s.H) / 4; sunR = 2.6 * u;
          n = clamp(Math.round(R / (10 * u)), 4, 8);
        } else if (L === 1) {
          cx = s.W / 2; cy = s.H / 2;
          ky = clamp(s.H / s.W * 0.5, 0.32, 0.8);
          R = Math.min(s.W * 0.49, s.H * 0.47 / ky); sunR = 2.8 * u;
          n = clamp(Math.round(R / (9 * u)), 4, 8);
        } else {
          cx = qx < 0 ? -0.1 * s.W : 1.1 * s.W; cy = qy < 0 ? -0.1 * s.H : 1.1 * s.H; ky = 1;
          R = Math.hypot(s.W * 1.1, s.H * 1.1) * 0.97; sunR = clamp(Math.min(s.W, s.H) * 0.13, 30, 110);
          n = clamp(Math.round(R / (11 * u)), 5, 10);
        }
        build(n);
      },
      step(dt) {
        for (const p of planets) {
          p.a += p.w * dt;
          if (L === 2 && p.a > a0 + span) p.a -= span;
          for (const m of p.moons) m.a += m.w * dt;
        }
      },
      draw() {
        const { ctx } = s;
        const ringA = s.dark ? 0.17 : 0.22;
        // Orbit rings, and a brighter arc trailing each planet.
        ctx.lineWidth = 1;
        ctx.strokeStyle = s.ink;
        ctx.globalAlpha = ringA;
        ctx.beginPath();
        for (const p of planets) { ctx.moveTo(cx + p.r * R, cy); ctx.ellipse(cx, cy, p.r * R, p.r * R * ky, 0, 0, TAU); }
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (const p of planets) {
          ctx.strokeStyle = s.colors[p.c];
          ctx.globalAlpha = s.dark ? 0.38 : 0.45;
          ctx.beginPath();
          ctx.ellipse(cx, cy, p.r * R, p.r * R * ky, 0, p.a - Math.min(0.9, 45 * u / (p.r * R)), p.a);
          ctx.stroke();
        }
        // Planets back to front, so in layout 1 the far ones pass behind the sun.
        const order = planets.map((p) => ({ p, z: Math.sin(p.a) })).sort((a, b) => a.z - b.z);
        let sunDone = false;
        for (const { p, z } of order) {
          if (!sunDone && z > 0) { sun(); sunDone = true; }
          planet(p, z);
        }
        if (!sunDone) sun();
      },
    };

    /** The sun: a soft glow (dark flavour adds it as light), a disc, and the hub's spokes ring. */
    function sun() {
      const { ctx } = s;
      const g = sunR * (L === 2 ? 2.3 : 3.4);
      ctx.globalAlpha = s.dark ? 0.5 : 0.35;
      if (s.dark) ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glow, cx - g, cy - g, g * 2, g * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = s.colors[sunC];
      ctx.globalAlpha = s.dark ? 0.45 : 0.5;
      ctx.beginPath(); ctx.arc(cx, cy, sunR, 0, TAU); ctx.fill();
      ctx.globalAlpha = s.dark ? 0.35 : 0.4;
      ctx.strokeStyle = s.colors[sunC];
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, sunR * 1.35, 0, TAU); ctx.stroke();
    }

    /** One planet on its arm, lit on the sunward half, with ring or moons. @param {Planet} p @param {number} z depth, -1 far to 1 near */
    function planet(p, z) {
      const { ctx } = s;
      const x = cx + Math.cos(p.a) * p.r * R, y = cy + Math.sin(p.a) * p.r * R * ky;
      const depth = L === 1 ? 1 + 0.22 * z : 1;
      const pr = p.pr * u * depth;
      const col = s.colors[p.c];
      // The arm from the hub, with a pivot where it meets the planet.
      ctx.strokeStyle = s.ink;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = (s.dark ? 0.22 : 0.26) * (L === 1 ? 0.8 + 0.2 * z : 1);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
      if (p.ring) {
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1.5, pr * 0.25);
        ctx.globalAlpha = s.dark ? 0.4 : 0.45;
        ctx.beginPath(); ctx.ellipse(x, y, pr * 2, pr * 0.65, -0.35, 0, TAU); ctx.stroke();
      }
      const toSun = Math.atan2(cy - y, cx - x);
      ctx.fillStyle = col;
      ctx.globalAlpha = s.dark ? 0.24 : 0.28;
      ctx.beginPath(); ctx.arc(x, y, pr, 0, TAU); ctx.fill();
      ctx.globalAlpha = s.dark ? 0.5 : 0.55;
      ctx.beginPath(); ctx.arc(x, y, pr, toSun - TAU / 4, toSun + TAU / 4); ctx.fill();
      for (const m of p.moons) {
        const mr = m.r * pr;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.globalAlpha = s.dark ? 0.2 : 0.24;
        ctx.beginPath(); ctx.ellipse(x, y, mr, mr * ky, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = s.colors[(p.c + 2) % nc];
        ctx.globalAlpha = s.dark ? 0.5 : 0.55;
        ctx.beginPath();
        ctx.arc(x + Math.cos(m.a) * mr, y + Math.sin(m.a) * mr * ky, Math.max(1.5, m.mr * u * depth), 0, TAU);
        ctx.fill();
      }
    }
  });
}

/** A round glow fading from the middle, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function sprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,.7)');
  grad.addColorStop(0.3, 'rgba(0,0,0,.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}
