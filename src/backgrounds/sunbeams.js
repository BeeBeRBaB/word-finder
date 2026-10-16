// Sunbeams: soft shafts of light slant down through haze, each widening, narrowing and brightening
// on its own slow beat, while dust motes drift through and glint where a shaft catches them. The
// seed picks the variant: forest, parallel shafts falling between trunks through gaps in a swaying
// canopy; window, a high window whose panes throw a block of shafts that land as patches on the
// floor; or cloud break, rays fanning from a sun hidden behind a cloud bank as it drifts slowly.

import { stage, TAU, clamp, mix } from './stage.js';

/** @typedef {{x:number, y:number, a:number, w:number, len:number, ph:number, f:number, c:number, k:number}} Beam */
/** @typedef {{x:number, y:number, vx:number, vy:number, r:number, ph:number, c:number}} Mote */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    // Shafts widen a little with distance; the fan's rays start narrow and widen a lot.
    const shafts = s.colors.map((c) => beamSprite(c, [0.7, 0.95, 0.12][layout], layout === 1 ? 0.45 : 0));
    const glints = s.colors.map((c) => glint(c));
    const lean = (rng.random() < 0.5 ? -1 : 1) * (0.32 + rng.random() * 0.12);
    const first = rng.int(C);
    // Fixed per-seed shapes, in host fractions, so a resize keeps the same scene.
    const gaps = Array.from({ length: 7 }, (_, i) => ({ u: (i + 0.2 + rng.random() * 0.6) / 7, w: 0.5 + rng.random() * 0.9,
      ph: rng.random() * TAU, f: 0.03 + rng.random() * 0.05 }));
    const trunks = Array.from({ length: 7 }, (_, i) => ({ u: (i + 0.15 + rng.random() * 0.7) / 7, w: 0.5 + rng.random() * 0.8, d: rng.random() }));
    // Leaf clumps thin out downward and leave a gap where each shaft comes through.
    /** @type {{u:number, v:number, r:number}[]} */
    const leaves = [];
    while (leaves.length < 110) {
      const u = rng.random(), v = rng.random() * rng.random();
      if (gaps.some((g) => Math.abs(g.u - u) < 0.012 * g.w) && v < 0.4) continue;
      leaves.push({ u, v, r: 0.35 + rng.random() * 0.65 });
    }
    const puffs = Array.from({ length: 14 }, (_, i) => ({ u: (i + rng.random()) / 14, v: rng.random(), r: 0.6 + rng.random() * 0.6 }));
    /** @type {Beam[]} */
    let beams = [];
    /** @type {Mote[]} */
    const motes = [];
    let m = 1, sway = 0, shift = 0;
    // The cloud break's rays, prerendered small: rotated sprites are costly to draw full size
    // every frame, and the fan only drifts and breathes as a whole.
    /** @type {HTMLCanvasElement|null} */
    let fan = null;
    const FQ = 0.25;
    // The window: its top-left corner, pane size and grid.
    const win = { x: 0, y: 0, pw: 0, ph: 0, cols: 2, rows: 3 };
    const floorY = () => s.H * 0.9;

    /** Lays out the shafts for the current size. @returns {void} */
    function build() {
      beams = [];
      if (layout === 0) {
        for (const g of gaps) {
          beams.push({ x: g.u * s.W - lean * s.H * 0.15, y: -s.H * 0.04, a: lean, w: m * 0.11 * g.w, len: s.H * 1.25,
            ph: g.ph, f: g.f, c: (first + beams.length) % C, k: 0 });
        }
      } else if (layout === 1) {
        win.pw = clamp(m * 0.11, 36, 90); win.ph = win.pw * 1.3;
        win.x = lean > 0 ? s.W * 0.06 : s.W * 0.94 - win.pw * win.cols;
        win.y = s.H * 0.04;
        const a = lean * 1.25;
        for (let r = 0; r < win.rows; r++) for (let c = 0; c < win.cols; c++) {
          const x = win.x + (c + 0.5) * win.pw, y = win.y + (r + 0.5) * win.ph;
          beams.push({ x, y, a, w: win.pw * 0.92, len: (floorY() - y) / Math.cos(a), ph: rng.random() * TAU,
            f: 0.04 + rng.random() * 0.04, c: (first + c) % C, k: r });
        }
      } else {
        const n = clamp(Math.round(s.W / 200), 6, 9);
        for (let i = 0; i < n; i++) {
          const a = mix(-1, 1, (i + 0.5) / n) + (rng.random() - 0.5) * 0.12;
          beams.push({ x: s.W * 0.5, y: -s.H * 0.06, a, w: m * (0.14 + rng.random() * 0.1), len: Math.hypot(s.W, s.H) * 0.8,
            ph: rng.random() * TAU, f: 0.03 + rng.random() * 0.05, c: (first + i) % C, k: i % 2 });
        }
        renderFan();
      }
    }

    /** How lit (0..1) the point is by any shaft right now. @param {number} x @param {number} y @returns {number} */
    function lit(x, y) {
      let best = 0;
      for (const b of beams) {
        const a = b.a, dx = x - b.x - shift, dy = y - b.y;
        const along = dx * Math.sin(a) + dy * Math.cos(a);
        if (along <= 0 || along >= b.len) continue;
        const across = dx * Math.cos(a) - dy * Math.sin(a);
        const u = along / b.len, hw = b.w * 0.5 * width(b) * (layout === 2 ? 0.12 + 0.88 * u : 0.7 + 0.3 * u);
        const e = 1 - (across / hw) * (across / hw);
        if (e > 0) best = Math.max(best, e * Math.min(1, u * 8, (1 - u) * 3));
      }
      return best;
    }

    /** A shaft's slow width beat. @param {Beam} b @returns {number} */
    const width = (b) => (layout === 2 ? 1 : 0.8 + 0.2 * Math.sin(s.t * b.f * TAU * 0.7 + b.ph * 1.7));
    /** A shaft's slow brightness beat (the whole fan's, in the cloud break). @param {Beam} b @returns {number} */
    const bright = (b) => (layout === 2 ? 0.75 + 0.25 * Math.sin(s.t * TAU / 23) : 0.6 + 0.4 * Math.sin(s.t * b.f * TAU + b.ph));

    /** Renders the fan at low resolution, a little wider than the host so it can drift. @returns {void} */
    function renderFan() {
      const c = fan = document.createElement('canvas');
      c.width = Math.ceil(s.W * 1.2 * FQ); c.height = Math.ceil(s.H * FQ);
      const g = c.getContext('2d');
      if (!g) return;
      for (const b of beams) {
        const cs = Math.cos(b.a), sn = Math.sin(b.a);
        g.globalAlpha = 0.65 + 0.35 * Math.sin(b.ph);
        g.setTransform(cs * FQ, -sn * FQ, sn * FQ, cs * FQ, (b.x + s.W * 0.1) * FQ, b.y * FQ);
        g.drawImage(shafts[b.c], -b.w / 2, 0, b.w, b.len);
      }
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        build();
        const n = clamp(Math.round(s.W * s.H / 9000), 30, 170);
        while (motes.length < n) {
          motes.push({ x: rng.random() * s.W, y: rng.random() * s.H, vx: (rng.random() - 0.5) * 8, vy: (rng.random() - 0.3) * 6,
            r: 0.8 + rng.random() * 1.6, ph: rng.random() * TAU, c: rng.int(C) });
        }
        motes.length = n;
        for (const p of motes) { p.x = Math.min(p.x, s.W); p.y = Math.min(p.y, s.H); }
      },
      step(dt) {
        sway = Math.sin(s.t * 0.21) * 0.6 + Math.sin(s.t * 0.13 + 1) * 0.4;
        shift = layout === 2 ? Math.sin(s.t * TAU / 46) * s.W * 0.04 : 0;
        for (const p of motes) {
          // Drift with a slow wander, as air moves dust.
          p.vx = clamp(p.vx + (rng.random() - 0.5) * 6 * dt, -6, 6);
          p.vy = clamp(p.vy + (rng.random() - 0.48) * 6 * dt, -4, 5);
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < -4) p.x += s.W + 8; else if (p.x > s.W + 4) p.x -= s.W + 8;
          if (p.y < -4) p.y += s.H + 8; else if (p.y > s.H + 4) p.y -= s.H + 8;
        }
      },
      draw() {
        const { ctx, dpr } = s;
        const col = s.colors;
        if (layout === 0) {
          // Trunks first, faint, so the shafts fall between and over them.
          ctx.globalAlpha = s.dark ? 0.1 : 0.12;
          ctx.fillStyle = col[(first + 2) % C];
          ctx.beginPath();
          for (const t of trunks) {
            const w = m * 0.03 * t.w, x = t.u * s.W;
            ctx.moveTo(x - w * 0.4, 0); ctx.lineTo(x + w * 0.4, 0); ctx.lineTo(x + w * 0.6, s.H); ctx.lineTo(x - w * 0.6, s.H);
          }
          ctx.fill();
        }
        if (layout === 1) {
          // Floor patches: each pane's shadow-shape where its shaft lands.
          const tn = Math.tan(beams[0].a);
          for (const b of beams) {
            const fy = floorY(), x = b.x + (fy - b.y) * tn, hw = win.pw * 0.46, d = win.ph * 0.46 * (1 + Math.abs(tn));
            ctx.globalAlpha = (s.dark ? 0.12 : 0.16) * bright(b);
            ctx.fillStyle = col[b.c];
            ctx.beginPath();
            ctx.moveTo(x - hw, fy - d * 0.12); ctx.lineTo(x + hw, fy - d * 0.12);
            ctx.lineTo(x + hw + d * tn * 0.4, fy + d * 0.2); ctx.lineTo(x - hw + d * tn * 0.4, fy + d * 0.2);
            ctx.fill();
          }
        }
        // The shafts: one stretched, rotated sprite each, or the fan's two prerendered sets.
        const base = (s.dark ? 0.2 : 0.26) * (layout === 2 ? 1 : 1.3);
        if (fan) {
          ctx.globalAlpha = base * 1.2 * bright(beams[0]);
          ctx.drawImage(fan, (s.W * 0.1 - shift) * FQ, 0, s.W * FQ, s.H * FQ, 0, 0, s.W, s.H);
        }
        for (const b of layout === 2 ? [] : beams) {
          const a = b.a, w = b.w * width(b), cs = Math.cos(a), sn = Math.sin(a);
          ctx.globalAlpha = base * bright(b);
          ctx.setTransform(cs * dpr, -sn * dpr, sn * dpr, cs * dpr, b.x * dpr, b.y * dpr);
          ctx.drawImage(shafts[b.c], -w / 2, 0, w, b.len);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (layout === 0) {
          // The canopy: one mass of leaf clusters along the top, swaying.
          ctx.globalAlpha = s.dark ? 0.24 : 0.28;
          ctx.fillStyle = col[(first + 2) % C];
          ctx.beginPath();
          for (const l of leaves) {
            const r = m * 0.04 * l.r, x = l.u * s.W + sway * m * 0.012 * (0.4 + l.v), y = l.v * s.H * 0.2;
            ctx.moveTo(x + r * 1.3, y); ctx.ellipse(x, y, r * 1.3, r * 0.75, 0, 0, TAU);
          }
          ctx.fill();
        } else if (layout === 1) {
          // The window frame.
          ctx.globalAlpha = s.dark ? 0.4 : 0.45;
          ctx.strokeStyle = col[(first + 1) % C];
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let r = 0; r <= win.rows; r++) { ctx.moveTo(win.x, win.y + r * win.ph); ctx.lineTo(win.x + win.cols * win.pw, win.y + r * win.ph); }
          for (let c = 0; c <= win.cols; c++) { ctx.moveTo(win.x + c * win.pw, win.y); ctx.lineTo(win.x + c * win.pw, win.y + win.rows * win.ph); }
          ctx.stroke();
        } else {
          // A cloud bank over the hidden sun, its glow showing round the edges.
          const cx = s.W * 0.5 + shift, cy = -s.H * 0.06;
          ctx.globalAlpha = s.dark ? 0.5 : 0.6;
          const g = m * 0.32;
          ctx.drawImage(glints[first], cx - g, cy - g, g * 2, g * 2);
          ctx.fillStyle = col[(first + 1) % C];
          ctx.globalAlpha = s.dark ? 0.22 : 0.3;
          ctx.beginPath();
          for (const p of puffs) {
            const r = m * 0.07 * p.r, x = cx + (p.u - 0.5) * m * 1.1 + Math.sin(s.t * 0.05 + p.v * 6) * m * 0.01;
            const y = cy + m * 0.05 + p.v * m * 0.06 - Math.abs(p.u - 0.5) * m * 0.12;
            ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
          }
          ctx.fill();
        }
        // Dust motes: faint in the shade, glinting in a shaft.
        for (const p of motes) {
          const l = lit(p.x, p.y), tw = 0.75 + 0.25 * Math.sin(s.t * 0.9 + p.ph);
          ctx.globalAlpha = (s.dark ? 0.12 : 0.16) + l * tw * (s.dark ? 0.6 : 0.55);
          const d = p.r * (2.2 + l * 1.6);
          ctx.drawImage(glints[p.c], p.x - d, p.y - d, d * 2, d * 2);
        }
      },
    };
  });
}

/** A shaft as a sprite: soft-edged across, fading in at its top and out along its length to
 * `tail`, its width at the top `taper` of its width at the bottom.
 * @param {string} color @param {number} taper @param {number} tail @returns {HTMLCanvasElement} */
function beamSprite(color, taper, tail) {
  const W = 64, H = 256;
  const strip = document.createElement('canvas');
  strip.width = W; strip.height = 1;
  const sg = strip.getContext('2d');
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g || !sg) return c;
  sg.fillStyle = color;
  sg.fillRect(0, 0, W, 1);
  const across = sg.createLinearGradient(0, 0, W, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)');
  across.addColorStop(0.3, 'rgba(0,0,0,.65)');
  across.addColorStop(0.5, 'rgba(0,0,0,1)');
  across.addColorStop(0.7, 'rgba(0,0,0,.65)');
  across.addColorStop(1, 'rgba(0,0,0,0)');
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = across;
  sg.fillRect(0, 0, W, 1);
  for (let y = 0; y < H; y++) {
    const w = W * (taper + (1 - taper) * y / (H - 1));
    g.drawImage(strip, (W - w) / 2, y, w, 1);
  }
  const along = g.createLinearGradient(0, 0, 0, H);
  along.addColorStop(0, 'rgba(0,0,0,0)');
  along.addColorStop(0.12, 'rgba(0,0,0,1)');
  along.addColorStop(0.55, 'rgba(0,0,0,.8)');
  along.addColorStop(1, `rgba(0,0,0,${tail})`);
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = along;
  g.fillRect(0, 0, W, H);
  return c;
}

/** A small round glow, for a mote or the hidden sun. @param {string} color @returns {HTMLCanvasElement} */
function glint(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 32, 32);
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.3, 'rgba(0,0,0,.7)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return c;
}
