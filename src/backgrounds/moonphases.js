// Moon phases: moons, each lit to its phase over a faint earthshine disc with its seas and
// craters, the phases rolling on slowly as the moons move. Layout 0: a ring of moons orbiting a
// small Earth with sunlight from one side, each showing the phase seen from Earth at its place.
// 1: a calendar grid, a moon a day, the month's phases running along the rows and rolling on.
// 2: a time-lapse arc across the sky over a low horizon, moons stepping along it waxing to full.

import { stage, TAU, clamp, mix } from './stage.js';

/** @typedef {[number, number, number]} RGB */

/** Phase steps a moon is drawn at: each moon is repainted only when it moves on one. */
const Q = 120;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const cols = s.colors.map(rgbOf);
    const nc = cols.length;
    const c0 = rng.int(nc);
    // The seas and craters, the same on every moon, as the real one always shows one face.
    const face = Array.from({ length: 9 }, (_, i) => {
      const a = rng.random() * TAU, d = Math.sqrt(rng.random()) * (i < 4 ? 0.45 : 0.75);
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: i < 4 ? 0.22 + rng.random() * 0.14 : 0.06 + rng.random() * 0.07, sea: i < 4 };
    });
    /** @type {HTMLCanvasElement[]} */
    let sprites = [];
    let spriteR = 0;
    const halo = glow();
    const sunLeft = rng.random() < 0.5;
    let cx = 0, cy = 0, rx = 100, ry = 100, mr = 20, n = 8, cell = 60, gx = 0, gy = 0, ncol = 7, nrow = 4;
    /** @type {{x:number, y:number}[]} */
    let arc = [];
    /** @type {{x:number, y:number, r:number, f:number, p:number}[]} */
    let stars = [];

    /** Sprites of the moon's face in each colour, at device pixels for radius r. @param {number} r */
    function makeSprites(r) {
      const k = Math.ceil(r * s.dpr);
      if (k === spriteR) return;
      spriteR = k;
      caches = [];
      sprites = cols.map((c) => moonFace(c, k, face));
    }

    /** Each place's moon as drawn, kept until its phase moves on a step or its colour changes.
     * @type {{cv:HTMLCanvasElement, q:number, k:number}[]} */
    let caches = [];

    /** Paints a moon of phase step q (of Q) in colour k into a cache. @param {{cv:HTMLCanvasElement, q:number, k:number}} c
     * @param {number} q @param {number} k */
    function paintMoon(c, q, k) {
      const g = c.cv.getContext('2d');
      if (!g) return;
      const r = spriteR / s.dpr, o = r + 2, sp = sprites[k], p = q / Q;
      c.q = q; c.k = k;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.cv.width, c.cv.height);
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      // Earthshine: the whole face, faint, and its rim.
      g.globalAlpha = s.dark ? 0.13 : 0.14;
      g.drawImage(sp, o - r, o - r, r * 2, r * 2);
      g.globalAlpha = s.dark ? 0.22 : 0.26;
      g.strokeStyle = s.colors[k];
      g.lineWidth = 1;
      g.beginPath(); g.arc(o, o, r, 0, TAU); g.stroke();
      if (q === 0) return;
      // The lit part: a half disc on the sunward limb, closed by the terminator's half ellipse.
      const tx = r * Math.abs(Math.cos(p * TAU));
      g.save();
      g.beginPath();
      if (p < 0.5) {
        g.arc(o, o, r, -TAU / 4, TAU / 4);
        if (p < 0.25) g.ellipse(o, o, tx, r, 0, TAU / 4, -TAU / 4, true);
        else g.ellipse(o, o, tx, r, 0, TAU / 4, TAU * 0.75, false);
      } else {
        g.arc(o, o, r, TAU / 4, TAU * 0.75);
        if (p < 0.75) g.ellipse(o, o, tx, r, 0, -TAU / 4, TAU / 4, false);
        else g.ellipse(o, o, tx, r, 0, TAU * 0.75, TAU / 4, true);
      }
      g.clip();
      g.globalAlpha = s.dark ? 0.6 : 0.62;
      g.drawImage(sp, o - r, o - r, r * 2, r * 2);
      g.restore();
    }

    /** Moon number `slot` at x, y, phase p (0 new, 0.5 full), in colour k, drawn from its cache.
     * @param {number} slot @param {number} x @param {number} y @param {number} p @param {number} k @param {number} fade 0..1 */
    function moon(slot, x, y, p, k, fade) {
      const { ctx } = s;
      p = ((p % 1) + 1) % 1;
      const q = Math.round(p * Q) % Q;
      let c = caches[slot];
      if (!c) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = Math.ceil((spriteR / s.dpr + 2) * 2 * s.dpr);
        c = caches[slot] = { cv, q: -1, k: -1 };
      }
      if (c.q !== q || c.k !== k) paintMoon(c, q, k);
      const r = mr;
      const lit = 0.5 - 0.5 * Math.cos(p * TAU);
      if (s.dark && L !== 1 && lit > 0.3) {
        ctx.globalAlpha = 0.1 * fade * (lit - 0.3) / 0.7;
        ctx.drawImage(halo, x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      }
      ctx.globalAlpha = fade;
      const h = c.cv.width / s.dpr / 2;
      ctx.drawImage(c.cv, x - h, y - h, h * 2, h * 2);
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        if (L === 0) {
          cx = s.W / 2; cy = s.H / 2;
          rx = s.W * 0.4; ry = s.H * 0.38;
          const per = Math.PI * Math.sqrt((rx * rx + ry * ry) / 2) * 2;
          n = clamp(Math.round(per / clamp(m * 0.2, 70, 170)), 8, 16);
          mr = clamp(Math.min(per / n * 0.23, m * 0.062), 12, 54);
        } else if (L === 1) {
          cell = Math.max(clamp(m * 0.16, 52, 130), Math.sqrt(s.W * s.H / 72));
          ncol = Math.max(3, Math.floor(s.W / cell)); nrow = Math.max(3, Math.floor(s.H / cell));
          cell = Math.min(s.W / ncol, s.H / nrow);
          gx = (s.W - ncol * cell) / 2; gy = (s.H - nrow * cell) / 2;
          mr = cell * 0.33;
        } else {
          mr = clamp(m * 0.045, 12, 46);
          // A tall arch from low on one side to low on the other, its peak near the top.
          arc = [];
          const N = 200;
          for (let i = 0; i <= N; i++) {
            const u = i / N;
            arc.push({ x: mix(-mr * 2, s.W + mr * 2, u), y: s.H * 0.86 - Math.sin(Math.PI * u) * s.H * 0.68 });
          }
          // Re-spaced evenly along its length, so the moons keep an even gap over the top.
          const acc = [0];
          for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + Math.hypot(arc[i].x - arc[i - 1].x, arc[i].y - arc[i - 1].y));
          const len = acc[N];
          const even = [];
          for (let i = 0, k = 0; i <= N; i++) {
            const want = (i / N) * len;
            while (k < N - 1 && acc[k + 1] < want) k++;
            const f = clamp((want - acc[k]) / (acc[k + 1] - acc[k] || 1), 0, 1);
            even.push({ x: mix(arc[k].x, arc[k + 1].x, f), y: mix(arc[k].y, arc[k + 1].y, f) });
          }
          arc = even;
          n = clamp(Math.round(len / (mr * 3.2)), 7, 24);
        }
        makeSprites(mr);
        const ns = clamp(Math.round(s.W * s.H / 9000), 30, 170);
        if (stars.length !== ns) {
          stars = [];
          for (let i = 0; i < ns; i++) stars.push({ x: rng.random(), y: rng.random(), r: 0.6 + rng.random() * 0.9, f: 0.08 + rng.random() * 0.1, p: rng.random() * TAU });
        }
      },
      step() {},
      draw() {
        const { ctx } = s;
        if (L !== 1) {
          ctx.fillStyle = s.ink;
          for (const st of stars) {
            const y = st.y * s.H;
            if (L === 2 && y > s.H * 0.86) continue;
            ctx.globalAlpha = (s.dark ? 0.2 : 0.22) + 0.16 * Math.sin(s.t * st.f * TAU + st.p);
            ctx.fillRect(st.x * s.W, y, st.r * 1.6, st.r * 1.6);
          }
        }
        if (L === 0) drawRing();
        else if (L === 1) drawGrid();
        else drawArc();
      },
    };

    /** Layout 0: the orbit, Earth with its day side toward the Sun, faint rays, the moons. */
    function drawRing() {
      const { ctx } = s;
      const sd = sunLeft ? -1 : 1;
      ctx.strokeStyle = s.ink;
      ctx.lineWidth = 1;
      ctx.globalAlpha = s.dark ? 0.16 : 0.2;
      ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      // Sunlight arriving from one side.
      ctx.globalAlpha = s.dark ? 0.1 : 0.14;
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        const y = cy + (i / 3.5) * Math.min(ry * 0.9, s.H * 0.4);
        const x0 = sd < 0 ? 0 : s.W, x1 = sd < 0 ? s.W * 0.12 : s.W * 0.88;
        ctx.moveTo(x0, y); ctx.lineTo(x1, y);
        ctx.moveTo(x1, y); ctx.lineTo(x1 + sd * 6, y - 4); ctx.moveTo(x1, y); ctx.lineTo(x1 + sd * 6, y + 4);
      }
      ctx.stroke();
      // Earth: day side toward the Sun.
      const er = mr * 1.25;
      ctx.fillStyle = s.colors[(c0 + 1) % nc];
      ctx.globalAlpha = s.dark ? 0.16 : 0.18;
      ctx.beginPath(); ctx.arc(cx, cy, er, 0, TAU); ctx.fill();
      ctx.globalAlpha = s.dark ? 0.45 : 0.5;
      ctx.beginPath(); ctx.arc(cx, cy, er, sd < 0 ? TAU / 4 : -TAU / 4, sd < 0 ? TAU * 0.75 : TAU / 4); ctx.fill();
      // The moons round the orbit, slowly; new where the Sun is behind them, full opposite.
      const spin = s.t * TAU / 120;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + spin;
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        const sunA = sd < 0 ? Math.PI : 0;
        const p = (a - sunA) / TAU;
        moon(i, x, y, p, (c0 + i) % nc, 1);
      }
    }

    /** Layout 1: a calendar of moons, a day a cell, the month rolling on a day each two seconds. */
    function drawGrid() {
      const { ctx } = s;
      ctx.strokeStyle = s.ink;
      ctx.lineWidth = 1;
      ctx.globalAlpha = s.dark ? 0.1 : 0.13;
      ctx.beginPath();
      for (let i = 0; i <= ncol; i++) { ctx.moveTo(gx + i * cell, gy); ctx.lineTo(gx + i * cell, gy + nrow * cell); }
      for (let j = 0; j <= nrow; j++) { ctx.moveTo(gx, gy + j * cell); ctx.lineTo(gx + ncol * cell, gy + j * cell); }
      ctx.stroke();
      const day = s.t / 2;
      for (let j = 0; j < nrow; j++) {
        for (let i = 0; i < ncol; i++) {
          const d = j * ncol + i;
          moon(d, gx + (i + 0.5) * cell, gy + (j + 0.5) * cell, (d + day) / 29.53, (c0 + j) % nc, 0.85);
        }
      }
    }

    /** Layout 2: a horizon, and moons stepping along the arc over it, new at one end, full at the
     * peak, new again at the other. */
    function drawArc() {
      const { ctx } = s;
      ctx.fillStyle = s.colors[(c0 + 2) % nc];
      ctx.globalAlpha = s.dark ? 0.13 : 0.16;
      ctx.beginPath();
      ctx.moveTo(0, s.H);
      for (let x = 0; x <= s.W + 20; x += 20) {
        const u = x / s.W;
        ctx.lineTo(x, s.H * 0.88 - s.H * 0.03 * (Math.sin(u * 7.1 + 1) + 0.6 * Math.sin(u * 17.3)));
      }
      ctx.lineTo(s.W, s.H);
      ctx.closePath();
      ctx.fill();
      // Each moon moves to the next place in eight seconds.
      const shift = (s.t / 8) % 1;
      for (let i = -1; i < n; i++) {
        const u = (i + shift + 0.5) / n;
        if (u < 0 || u > 1) continue;
        const q = u * (arc.length - 1), k = Math.floor(q), f = q - k;
        const a = arc[Math.min(k, arc.length - 1)], b = arc[Math.min(k + 1, arc.length - 1)];
        const fade = clamp(Math.min(u, 1 - u) * n * 0.8, 0, 1);
        moon(i + 1, mix(a.x, b.x, f), mix(a.y, b.y, f), u, (c0 + ((i + n) % 3)) % nc, fade);
      }
    }
  });
}

/**
 * The moon's face as a sprite at device pixels: a pale disc in the colour with darker seas and
 * small rimmed craters, a little darker toward the limb.
 * @param {RGB} c @param {number} r radius in px @param {{x:number, y:number, r:number, sea:boolean}[]} face
 * @returns {HTMLCanvasElement}
 */
function moonFace(c, r, face) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = r * 2;
  const g = cv.getContext('2d');
  if (!g) return cv;
  /** @param {number} u toward white (+) or dark (-) @returns {string} */
  const tone = (u) => {
    const t = u > 0 ? 255 : 30, k = Math.abs(u);
    return `rgb(${Math.round(mix(c[0], t, k))},${Math.round(mix(c[1], t, k))},${Math.round(mix(c[2], t, k))})`;
  };
  g.fillStyle = tone(0.35);
  g.beginPath(); g.arc(r, r, r, 0, TAU); g.fill();
  g.save();
  g.clip();
  for (const f of face) {
    const x = r + f.x * r, y = r + f.y * r, rr = f.r * r;
    if (f.sea) {
      g.fillStyle = tone(-0.15);
      g.globalAlpha = 0.75;
      g.beginPath(); g.ellipse(x, y, rr, rr * 0.8, f.x * 2, 0, TAU); g.fill();
    } else {
      g.globalAlpha = 0.8;
      g.fillStyle = tone(-0.1);
      g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
      g.strokeStyle = tone(0.6);
      g.lineWidth = Math.max(1, rr * 0.25);
      g.beginPath(); g.arc(x, y, rr, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
    }
  }
  g.restore();
  // Limb darkening.
  const grad = g.createRadialGradient(r, r, r * 0.55, r, r, r);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,.72)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, r * 2, r * 2);
  return cv;
}

/** A soft white glow, for a full moon's halo. @returns {HTMLCanvasElement} */
function glow() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  if (!g) return cv;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,.8)');
  grad.addColorStop(0.4, 'rgba(255,255,255,.3)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return cv;
}

/** A colour string's channels. @param {string} color @returns {RGB} */
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
