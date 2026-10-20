// Shoreline: waves wash up a beach seen from above. Each crest rolls in, breaks, and runs up the
// sand as a foaming edge, then slides back, leaving a darker wet band and a lace of foam that
// drains away with it while the next one comes in. The seed picks the variant: a straight beach
// with the sea along the top; a diagonal beach with the sea in a corner; or a cove, its sand
// curving round a bay so the waves arrive as arcs.

import { stage, TAU, clamp, mix } from './stage.js';

const NV = 120;        // columns along the shore
const BRK = 0.12;      // where waves break, seaward of the mean shoreline, in host-minimum units
const FAR = 0.95;      // where an incoming crest first shows
const CREST = 0.11;    // incoming crest speed, units a second
const SWASH = 5.5;     // seconds a wave runs up and drains back
const UP = 0.3;        // share of that spent running up

/** @typedef {{tb:number, r:number, k1:number, p1:number, k2:number, p2:number}} Wave */
/** @typedef {{v:number, u:number, age:number, life:number, r:number, q:number}} Foam */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const rgb = s.colors.map(rgbOf);
    const sea = rgb[nearestHue(rgb, 195)], sand = rgb[nearestHue(rgb, 40)];
    const foamCol = s.dark ? '#e9f1f5' : '#ffffff';
    const ring = ringSprite(foamCol);
    const F = new Float32Array(NV + 1), F0 = new Float32Array(NV + 1), wet = new Float32Array(NV + 1).fill(-BRK);
    F.fill(-BRK);
    /** @type {Wave[]} */
    let waves = [];
    /** @type {Foam[]} */
    let foam = [];
    const pebbles = Array.from({ length: 40 }, () => ({ v: rng.random(), u: 0.25 + rng.random() * 1.2, r: 0.5 + rng.random(), a: rng.random() * TAU }));
    // Glints on the swell, riding in toward the beach and twinkling.
    const glints = Array.from({ length: 70 }, () => ({ v: rng.random(), u: -FAR + rng.random() * (FAR - BRK), ph: rng.random() * TAU, sp: 2 + rng.random() * 3 }));
    let T = 0, next = 2, m = 1, warmed = false;
    // Geometry: an origin and axes for a straight beach, or a centre and radius for the cove.
    let ox = 0, oy = 0, tx = 1, ty = 0, v0 = 0, v1 = 1, R0 = 1;
    /** @type {CanvasGradient|string} */
    let water = '';

    /** The point at v (0..1 along the shore) and u (units landward of the mean shoreline).
     * @param {number} v @param {number} u @returns {[number, number]} */
    function pt(v, u) {
      const a = mix(v0, v1, v), d = u * m;
      if (layout === 2) return [ox + (R0 + d) * Math.sin(a), oy + (R0 + d) * Math.cos(a)];
      return [ox + a * tx - d * ty, oy + a * ty + d * tx];
    }

    /** Sets up the shore for the current size. @returns {void} */
    function build() {
      m = Math.min(s.W, s.H);
      const corners = [[0, 0], [s.W, 0], [0, s.H], [s.W, s.H]];
      const deep = FAR + 0.1, dry = 0.5;
      const stops = [[0, s.dark ? 0.36 : 0.42], [deep / (deep + dry) - 0.05, s.dark ? 0.24 : 0.3], [1, 0.1]];
      /** @type {CanvasGradient} */
      let g;
      if (layout === 2) {
        R0 = Math.max(s.W, s.H) * 0.78;
        ox = s.W / 2; oy = s.H * 0.56 - R0;
        const as = corners.map(([x, y]) => Math.atan2(x - ox, y - oy));
        v0 = Math.min(...as) - 0.05; v1 = Math.max(...as) + 0.05;
        g = s.ctx.createRadialGradient(ox, oy, Math.max(0, R0 - deep * m), ox, oy, R0 + dry * m);
      } else {
        const b = layout === 0 ? 0 : 0.5;
        tx = Math.cos(b); ty = Math.sin(b);
        ox = s.W * (layout === 0 ? 0.5 : 0.55); oy = s.H * (layout === 0 ? 0.42 : 0.45);
        const as = corners.map(([x, y]) => (x - ox) * tx + (y - oy) * ty);
        v0 = Math.min(...as) - 20; v1 = Math.max(...as) + 20;
        g = s.ctx.createLinearGradient(ox + ty * deep * m, oy - tx * deep * m, ox - ty * dry * m, oy + tx * dry * m);
      }
      for (const [at, a] of stops) g.addColorStop(at, `rgba(${sea[0]},${sea[1]},${sea[2]},${a})`);
      water = g;
    }

    /** Wave w's edge at column j and time T, or -Infinity before it breaks.
     * @param {Wave} w @param {number} j @returns {number} */
    function edge(w, j) {
      const p = (T - w.tb) / SWASH;
      if (p < 0) return -Infinity;
      const v = j / NV, r = w.r * (0.75 + 0.18 * Math.sin(v * w.k1 + w.p1) + 0.1 * Math.sin(v * w.k2 + w.p2));
      if (p < UP) { const x = p / UP; return -BRK + (r + BRK) * (1 - (1 - x) * (1 - x)); }
      const x = (p - UP) / (1 - UP);
      return r - (r + BRK + 0.04) * (1 - Math.cos(Math.PI * x)) / 2;
    }

    /** Advances the sea by dt. @param {number} dt @returns {void} */
    function advance(dt) {
      T += dt;
      if (T >= next - (FAR - BRK) / CREST) {
        waves.push({ tb: next, r: 0.1 + rng.random() * 0.12, k1: 2 + rng.random() * 5, p1: rng.random() * TAU,
          k2: 7 + rng.random() * 9, p2: rng.random() * TAU });
        next += 2.4 + rng.random() * 1.8;
      }
      waves = waves.filter((w) => T - w.tb < SWASH);
      F0.set(F);
      for (let j = 0; j <= NV; j++) {
        let f = -BRK;
        for (const w of waves) f = Math.max(f, edge(w, j));
        F[j] = f;
        wet[j] = Math.max(f, wet[j] - 0.03 * dt);
        // Foam spawns where the edge surges up the sand.
        const d = f - F0[j];
        for (let n = d * 30 + rng.random(); n >= 1 && foam.length < 800; n--) {
          foam.push({ v: (j + rng.random() - 0.5) / NV, u: f - rng.random() * rng.random() * 0.07, age: 0, life: 3 + rng.random() * 4,
            r: 0.3 + rng.random() * rng.random(), q: 0.6 + rng.random() * 0.4 });
        }
      }
      for (const p of foam) {
        const x = clamp(p.v * NV, 0, NV), j = Math.min(NV - 1, Math.floor(x)), f = mix(F[j], F[j + 1], x - j);
        const d = mix(F[j] - F0[j], F[j + 1] - F0[j + 1], x - j);
        // Riding the edge up, draining back a little slower than it.
        if (d > 0 && p.u > f - 0.03) p.u = Math.min(f, p.u + d);
        else if (d < 0) p.u += d * p.q;
        p.u = Math.min(p.u, f);
        p.age += dt;
      }
      foam = foam.filter((p) => p.age < p.life);
      for (const g of glints) {
        g.u += CREST * 0.8 * dt;
        if (g.u > -BRK - 0.02) { g.u = -FAR - 0.05; g.v = rng.random(); }
      }
    }

    return {
      lay() {
        build();
        // Run the sea on a while first, so the opening frame is mid-wash.
        if (!warmed) { warmed = true; for (let i = 0; i < 420; i++) advance(1 / 30); }
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        // Pebbles on the dry sand.
        ctx.fillStyle = `rgb(${sand[0]},${sand[1]},${sand[2]})`;
        ctx.globalAlpha = s.dark ? 0.22 : 0.3;
        ctx.beginPath();
        for (const p of pebbles) {
          const [x, y] = pt(p.v, p.u), r = clamp(m * 0.006, 2.5, 6) * p.r;
          ctx.moveTo(x + r * 1.4, y); ctx.ellipse(x, y, r * 1.4, r, p.a, 0, TAU);
        }
        ctx.fill();
        // The wet band the last wash left, drying back.
        ctx.globalAlpha = s.dark ? 0.09 : 0.12;
        ctx.beginPath();
        for (let j = 0; j <= NV; j++) { const [x, y] = pt(j / NV, wet[j] + 0.012); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        for (let j = NV; j >= 0; j--) { const [x, y] = pt(j / NV, F[j]); ctx.lineTo(x, y); }
        ctx.fill();
        // The water, out to the far side.
        ctx.globalAlpha = 1;
        ctx.fillStyle = water;
        ctx.beginPath();
        for (let j = 0; j <= NV; j++) { const [x, y] = pt(j / NV, F[j]); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        if (layout === 2) ctx.lineTo(ox, oy);
        else { const [ax, ay] = pt(1, -40), [bx, by] = pt(0, -40); ctx.lineTo(ax, ay); ctx.lineTo(bx, by); }
        ctx.fill();
        // Glints, short dashes along the swell.
        ctx.strokeStyle = foamCol;
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        for (const g of glints) {
          const [x, y] = pt(g.v, g.u), [x2, y2] = pt(g.v + 0.015, g.u), tw = Math.sin(T * g.sp + g.ph);
          if (tw <= 0) continue;
          ctx.globalAlpha = tw * tw * (s.dark ? 0.45 : 0.7);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (x2 - x) * 0.6, y + (y2 - y) * 0.6); ctx.stroke();
        }
        // Incoming crests, firming up as they near the break.
        ctx.strokeStyle = foamCol;
        ctx.lineCap = 'round';
        for (const w of waves) {
          const u = -BRK - CREST * (w.tb - T);
          if (u >= -BRK) continue;
          const k = clamp(1 - (-BRK - u) / (FAR - BRK), 0, 1);
          ctx.globalAlpha = (0.25 + 0.75 * k) * (s.dark ? 0.6 : 0.8);
          ctx.lineWidth = 1.5 + k * 2.5;
          ctx.beginPath();
          for (let j = 0; j <= NV; j += 2) {
            const [x, y] = pt(j / NV, u + 0.012 * Math.sin(j * 0.21 + w.p1));
            if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        // Lace: rings of foam draining with the water and fading.
        for (const p of foam) {
          const [x, y] = pt(p.v, p.u), r = clamp(m * 0.016, 7, 15) * p.r, f = 1 - p.age / p.life;
          ctx.globalAlpha = f * (s.dark ? 0.4 : 0.75);
          ctx.drawImage(ring, x - r, y - r, r * 2, r * 2);
        }
        // The running edge.
        ctx.globalAlpha = s.dark ? 0.55 : 0.9;
        ctx.lineWidth = clamp(m * 0.004, 2, 3.5);
        ctx.beginPath();
        for (let j = 0; j <= NV; j++) { const [x, y] = pt(j / NV, F[j]); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      },
    };
  });
}

/** A ring of foam, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function ringSprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (!g) return c;
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.beginPath(); g.arc(16, 16, 12, 0, TAU); g.stroke();
  return c;
}

/** Which colour's hue is nearest `deg`. @param {number[][]} cs @param {number} deg @returns {number} */
function nearestHue(cs, deg) {
  let best = 0, bd = Infinity;
  cs.forEach((c, i) => {
    const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.05) return;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    const dist = Math.min(Math.abs(h - deg), 360 - Math.abs(h - deg));
    if (dist < bd) { bd = dist; best = i; }
  });
  return best;
}

/** A colour string's channels. @param {string} color @returns {number[]} */
function rgbOf(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = '#888';
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = v.match(/[\d.]+/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
}
