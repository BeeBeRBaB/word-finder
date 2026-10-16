// Rainy window: rain beads on a pane in front of out-of-focus lights. Small drops land and merge
// until one grows heavy enough to run, sliding in fits and starts, sweeping up the drops in its
// way and leaving a damp trail of tiny beads that slowly dries. The seed picks the variant: a
// pane in drizzle, drops running straight down; a car's side window at speed, drops driven back
// in slanting jerks past passing street lights; or a sash window whose bars catch the runners
// until they grow and spill over.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, r:number, held:boolean}} Bead */
/** @typedef {{x:number, y:number, r:number, v:number, go:number, rest:number, ph:number, gap:number, trail:Trail}} Runner
 * go: px left in this slide, rest: s left in this pause, gap: px until it drops a bead. */
/** @typedef {{pts:number[], w:number, dry:number}} Trail dry counts up once its runner has gone */
/** @typedef {{x:number, y:number, r:number, c:number, ph:number}} Light */

const DRY = 7;         // s for a trail to dry

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    // Water is clear: beads in one pale tone, the colour left to the lights behind.
    const water = bead(s.dark ? '#dfe8f0' : '#6a7480', s.dark);
    const lightSprites = s.colors.map((c) => disc(c));
    // Which way runners go: down, or driven back and down on the car window.
    const dx = layout === 1 ? -0.93 : 0, dy = layout === 1 ? 0.37 : 1;
    /** @type {Bead[]} */
    let beads = [];
    /** @type {Runner[]} */
    let runners = [];
    /** @type {Trail[]} */
    let trails = [];
    /** @type {Light[]} */
    let lights = [];
    let R0 = 2, cap = 300, rate = 20, owed = 0, bar = 0, warm = false, oldW = 0, oldH = 0, most = 6;

    /** The sash bars as [x, y, w, h] rects (variant 2 only). @returns {[number, number, number, number][]} */
    const bars = () => layout === 2 ? [[s.W / 2 - bar / 2, 0, bar, s.H], [0, s.H * 0.5 - bar / 2, s.W, bar]] : [];
    /** @param {number} x @param {number} y @param {number} m */
    const onBar = (x, y, m) => bars().some(([bx, by, bw, bh]) => x > bx - m && x < bx + bw + m && y > by - m && y < by + bh + m);

    /** @param {Bead} b */
    function toRunner(b) {
      /** @type {Trail} */
      const trail = { pts: [b.x, b.y], w: b.r, dry: -1 };
      trails.push(trail);
      runners.push({ x: b.x, y: b.y, r: b.r, v: 0, go: 10 + rng.random() * 40, rest: 0, ph: rng.random() * TAU, gap: b.r, trail });
    }

    /** A new drop lands, merging with any it touches. @param {number} x @param {number} y @param {number} r */
    function land(x, y, r) {
      if (onBar(x, y, r)) return;
      for (let i = 0; i < beads.length; i++) {
        const b = beads[i], d = Math.hypot(b.x - x, b.y - y);
        if (d > b.r + r) continue;
        const a = b.r * b.r, A = a + r * r;
        if (!b.held) { b.x = (b.x * a + x * r * r) / A; b.y = (b.y * a + y * r * r) / A; }
        b.r = Math.sqrt(A);
        if (b.r > R0 * (b.held ? 4 : 2.6)) {
          beads.splice(i, 1);
          // A full drop on a bar spills over its lower edge.
          if (b.held) { b.y += bar + b.r * 2; b.held = false; }
          toRunner(b);
        }
        return;
      }
      if (beads.length < cap) beads.push({ x, y, r, held: false });
    }

    /** @param {number} dt */
    function step(dt) {
      owed += rate * dt;
      for (; owed >= 1; owed--) land(rng.random() * s.W, rng.random() * s.H, R0 * (0.4 + Math.pow(rng.random(), 3) * 1.5));
      // Now and then a bead gathers enough to let go.
      if (runners.length < most && rng.random() < dt * 2.5) {
        const i = rng.int(beads.length), b = beads[i];
        if (b && !b.held && b.r > R0 * 0.9) { beads.splice(i, 1); b.r = Math.max(b.r, R0 * 2.4); toRunner(b); }
      }
      for (let i = runners.length - 1; i >= 0; i--) {
        const p = runners[i];
        if (p.rest > 0) { p.rest -= dt; p.v = 0; continue; }
        // Slide: speed up toward a pace set by size, then stick again.
        const top = (layout === 1 ? 50 : 34) + p.r * 9;
        p.v = Math.min(top, p.v + top * 3 * dt);
        const d = p.v * dt, wob = Math.sin(s.t * 2.1 + p.ph) * 0.35;
        p.x += (dx + wob * dy * 0.5) * d; p.y += (dy - wob * dx * 0.5) * d;
        p.go -= d; p.gap -= d;
        if (p.go <= 0) { p.go = 8 + rng.random() * (layout === 1 ? 70 : 50) * p.r / R0 / 3; p.rest = rng.random() < 0.25 ? 0 : 0.15 + rng.random() * (layout === 1 ? 0.5 : 1.1); }
        const t = p.trail.pts;
        if (Math.hypot(p.x - t[t.length - 2], p.y - t[t.length - 1]) > 4) t.push(p.x, p.y);
        if (t.length > 400) t.splice(0, 2);
        // Leave a bead behind now and then, a little smaller each time.
        if (p.gap <= 0) {
          p.gap = p.r * (1.5 + rng.random() * 2.5);
          const r = p.r * (0.22 + rng.random() * 0.18);
          if (beads.length < cap * 1.2) beads.push({ x: p.x - dx * p.r * 1.4, y: p.y - dy * p.r * 1.4, r, held: false });
          p.r = Math.sqrt(Math.max(p.r * p.r - r * r * 0.6, R0 * R0 * 2));
        }
        // Sweep up beads in the way.
        for (let j = beads.length - 1; j >= 0; j--) {
          const b = beads[j];
          if (Math.abs(b.x - p.x) > p.r + b.r || Math.abs(b.y - p.y) > p.r + b.r) continue;
          if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + b.r * 0.6 && !b.held) {
            p.r = Math.min(R0 * 5, Math.sqrt(p.r * p.r + b.r * b.r));
            beads.splice(j, 1);
          }
        }
        const sill = s.H * 0.5 - bar / 2;
        const caught = layout === 2 && p.y + p.r * 0.8 > sill && p.y < sill + bar / 2;
        const gone = p.y > s.H + p.r * 3 || p.x < -p.r * 3 || (layout === 2 && Math.abs(p.x - s.W / 2) < bar / 2);
        if (gone || caught) {
          runners.splice(i, 1);
          p.trail.dry = 0;
          // Caught on the cross bar: it rests on the bar's top edge.
          if (caught && !gone) beads.push({ x: p.x, y: sill - p.r * 0.8, r: p.r, held: true });
        }
      }
      for (let i = trails.length - 1; i >= 0; i--) {
        const t = trails[i];
        if (t.dry >= 0) t.dry += dt;
        if (t.dry > DRY) trails.splice(i, 1);
      }
      if (layout === 1) {
        for (const l of lights) { l.x -= dt * (14 + l.r * 0.25); if (l.x < -l.r) { l.x = s.W + l.r; l.y = s.H * (0.15 + rng.random() * 0.7); } }
      }
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H), area = s.W * s.H;
        R0 = clamp(m * 0.0065, 1.8, 4.2);
        cap = clamp(Math.round(area / 1700), 150, 650);
        rate = clamp(area / (layout === 1 ? 26000 : 36000), 8, 60);
        most = clamp(Math.round(area / (layout === 1 ? 70000 : 90000)), 4, 22);
        bar = clamp(m * 0.03, 10, 26);
        if (oldW) {
          const fx = s.W / oldW, fy = s.H / oldH;
          for (const b of beads) { b.x *= fx; b.y *= fy; b.held = false; }
          for (const p of runners) { p.x *= fx; p.y *= fy; }
          for (const t of trails) for (let i = 0; i < t.pts.length; i += 2) { t.pts[i] *= fx; t.pts[i + 1] *= fy; }
        }
        oldW = s.W; oldH = s.H;
        const n = clamp(Math.round(area / 70000), 7, 20);
        while (lights.length < n) {
          lights.push({ x: rng.random() * s.W, y: s.H * (0.1 + rng.random() * 0.8), r: 0, c: rng.int(C), ph: rng.random() * TAU });
        }
        lights.length = n;
        for (const l of lights) { l.r = m * (0.05 + ((l.ph * 7) % 1) * 0.06); l.x = Math.min(l.x, s.W); l.y = Math.min(l.y, s.H); }
        // Warm up once, so the first (and, with reduced motion, only) frame shows a wet pane.
        if (!warm) { warm = true; for (let i = 0; i < 300; i++) step(1 / 15); }
      },
      step,
      draw() {
        const { ctx } = s;
        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        for (const l of lights) {
          ctx.globalAlpha = (s.dark ? 0.13 : 0.2) * (0.75 + 0.25 * Math.sin(s.t * 0.4 + l.ph));
          ctx.drawImage(lightSprites[l.c], l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const t of trails) {
          const p = t.pts;
          if (p.length < 4) continue;
          ctx.globalAlpha = (s.dark ? 0.13 : 0.16) * (t.dry < 0 ? 1 : 1 - t.dry / DRY);
          ctx.strokeStyle = s.dark ? '#dfe8f0' : '#6a7480';
          ctx.lineWidth = t.w * 1.1;
          ctx.beginPath();
          ctx.moveTo(p[0], p[1]);
          for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
          ctx.stroke();
        }
        ctx.globalAlpha = s.dark ? 0.62 : 0.72;
        for (const b of beads) ctx.drawImage(water, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        ctx.globalAlpha = s.dark ? 0.7 : 0.8;
        for (const p of runners) {
          // A running drop draws out a little along its way.
          const st = p.rest > 0 ? 1 : 1.25;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
          ctx.drawImage(water, -p.r, -p.r * st * 1.1, p.r * 2, p.r * 2 * st);
          ctx.restore();
        }
        if (layout === 2) {
          ctx.globalAlpha = s.dark ? 0.2 : 0.16;
          ctx.fillStyle = s.ink;
          ctx.beginPath();
          for (const [x, y, w, h] of bars()) ctx.rect(x, y, w, h);
          ctx.fill();
        }
      },
    };
  });
}

/** A water bead: clear middle, a coloured rim, a highlight up-left and a shade down-right.
 * @param {string} color @param {boolean} dark @returns {HTMLCanvasElement} */
function bead(color, dark) {
  const c = document.createElement('canvas');
  c.width = c.height = 40;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 40, 40);
  const grad = g.createRadialGradient(20, 20, 0, 20, 20, 20);
  grad.addColorStop(0, 'rgba(0,0,0,.3)');
  grad.addColorStop(0.65, 'rgba(0,0,0,.45)');
  grad.addColorStop(0.88, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 40, 40);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = dark ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.22)';
  g.beginPath(); g.arc(20, 20, 17, 0.1 * Math.PI, 0.9 * Math.PI); g.arc(20, 17, 15, 0.85 * Math.PI, 0.15 * Math.PI, true); g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.beginPath(); g.ellipse(13, 12, 5, 3.4, -0.6, 0, TAU); g.fill();
  return c;
}

/** An out-of-focus light: a flat disc with a soft edge. @param {string} color @returns {HTMLCanvasElement} */
function disc(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,.8)');
  grad.addColorStop(0.75, 'rgba(0,0,0,1)');
  grad.addColorStop(0.9, 'rgba(0,0,0,.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
