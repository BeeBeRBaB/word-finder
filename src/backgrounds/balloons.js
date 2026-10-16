// Hot air balloons: striped balloons drift on the wind over a landscape, each burner firing now
// and then, its glow rising over a second and lighting the envelope from inside while the balloon
// climbs, then fading as it settles. Layout 0: a festival over rolling hills, balloons near and
// far drifting across at their own heights. 1: a mass ascent, balloons inflating on a field and
// lifting off in turn, rising out of the top. 2: a lake below mountains, each balloon mirrored in
// the still water, slow ripples crossing its reflection.

import { stage, TAU, clamp, mix } from './stage.js';

/** @typedef {[number, number, number]} RGB */
/** @typedef {{x:number, y:number, z:number, d:number, vy:number, burn:number, next:number, fire:number,
 *   sp:HTMLCanvasElement|null, c:number, inf:number, wait:number, ph:number}} Balloon
 * z its envelope height in CSS px, d its nearness 0..1; burn the burner's glow 0..1, fire how long
 * it still burns, next the seconds until it fires again; inf how inflated (layout 1), wait the
 * seconds before it lays out on the field again. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const cols = s.colors.map(rgbOf);
    const nc = cols.length;
    const wd = rng.random() < 0.5 ? -1 : 1;
    // The burner's flame in the warmest colour.
    const warm = cols.reduce((b, c, i) => (c[0] - c[2] > cols[b][0] - cols[b][2] ? i : b), 0);
    const flame = glow(cols[warm]);
    /** @type {Balloon[]} */
    let balloons = [];
    let S = 80, hz = 0;
    /** @type {{pts:number[], c:number, a:number}[]} */
    let land = [];
    /** @type {{x:number, y:number, w:number, v:number}[]} */
    let ripples = [];

    /** @param {number} d @param {number} c @returns {Balloon} */
    function balloon(d, c) {
      return { x: 0, y: 0, z: 0, d, vy: 0, burn: 0, next: 2 + rng.random() * 8, fire: 0, sp: null, c, inf: 1, wait: 0, ph: rng.random() * TAU };
    }

    /** Puts a layout 1 balloon back on the field, flat, to inflate again. @param {Balloon} b */
    function relaunch(b) {
      b.x = s.W * (0.1 + 0.8 * rng.random()); b.y = s.H * (0.83 + 0.06 * b.d); b.inf = 0; b.vy = 0;
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        S = clamp(m * 0.17, 50, 150);
        const n = L === 0 ? clamp(Math.round(s.W * s.H / 70000), 5, 14) : L === 1 ? clamp(Math.round(s.W * s.H / 85000), 5, 12) : clamp(Math.round(s.W * s.H / 110000), 3, 8);
        const fresh = balloons.length !== n;
        if (fresh) {
          balloons = [];
          for (let i = 0; i < n; i++) balloons.push(balloon(0.3 + 0.7 * ((i + rng.random()) / n), (i * 2) % nc));
          balloons.sort((a, b) => a.d - b.d);
          balloons.forEach((b, i) => {
            b.x = s.W * ((i * 0.618 + rng.random() * 0.2) % 1);
            if (L === 0) b.y = s.H * (0.12 + 0.55 * rng.random());
            else if (L === 1) { b.y = s.H * (0.85 - 0.8 * rng.random()); if (i % 3 === 0) { relaunch(b); b.inf = rng.random(); } }
            else b.y = s.H * (0.1 + 0.32 * rng.random());
          });
        }
        hz = s.H * (L === 2 ? 0.66 : 0.8);
        for (const b of balloons) {
          const z = Math.round(S * (0.35 + 0.65 * b.d) * (L === 2 ? 0.85 : 1));
          if (z !== b.z || !b.sp) { b.z = z; b.sp = envelope(cols, b.c, z, s.dpr, s.ink); }
          b.x = Math.min(b.x, s.W + b.z);
          b.y = Math.min(b.y, s.H);
        }
        landscape();
      },
      step(dt) {
        for (const b of balloons) {
          // The burner: fire for a couple of seconds now and then, the glow easing up and down.
          b.next -= dt;
          if (b.next <= 0 && b.fire <= 0) { b.fire = 1.5 + rng.random() * 1.5; b.next = 6 + rng.random() * 9; }
          if (b.fire > 0) { b.fire -= dt; b.burn = Math.min(1, b.burn + dt); } else b.burn = Math.max(0, b.burn - dt / 1.5);
          const spd = 0.5 + 0.5 * b.d;
          if (L === 1) {
            if (b.inf < 1) {
              b.inf = Math.min(1, b.inf + dt / 7);
              b.burn = Math.max(b.burn, 0.6);
              continue;
            }
            b.vy = mix(b.vy, -(8 + 10 * b.d) - 10 * b.burn, dt * 0.5);
            b.x += wd * 4 * spd * dt;
            b.y += b.vy * dt;
            if (b.y < -b.z * 1.4) relaunch(b);
            continue;
          }
          b.x += wd * (6 + 14 * b.d) * dt;
          if (wd > 0 && b.x > s.W + b.z) b.x = -b.z; else if (wd < 0 && b.x < -b.z) b.x = s.W + b.z;
          // Climbs while the burner heats it, sinks slowly as it cools; burns sooner when low.
          const lo = s.H * (L === 2 ? 0.44 : 0.68), hi = s.H * 0.1;
          b.vy = mix(b.vy, b.burn > 0.2 ? -9 * spd : 3 * spd, dt * 0.4);
          b.y = clamp(b.y + b.vy * dt, hi, lo + 10);
          if (b.y > lo && b.next > 1.5) b.next = 1.5;
        }
        for (const r of ripples) { r.x += r.v * dt; if (r.x > s.W + r.w) r.x = -r.w; else if (r.x < -r.w) r.x = s.W + r.w; }
      },
      draw() {
        const { ctx } = s;
        for (const l of land) {
          ctx.globalAlpha = l.a;
          ctx.fillStyle = s.colors[l.c];
          ctx.beginPath();
          ctx.moveTo(l.pts[0], l.pts[1]);
          for (let i = 2; i < l.pts.length; i += 2) ctx.lineTo(l.pts[i], l.pts[i + 1]);
          ctx.closePath();
          ctx.fill();
        }
        if (L === 2) {
          // Ripples on the lake, and the balloons mirrored in it.
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = 1;
          ctx.globalAlpha = s.dark ? 0.16 : 0.2;
          ctx.beginPath();
          for (const r of ripples) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.w, r.y); }
          ctx.stroke();
          for (const b of balloons) {
            const ry = 2 * hz - b.y;
            if (ry - b.z * 0.7 > s.H) continue;
            ctx.save();
            ctx.beginPath(); ctx.rect(0, hz, s.W, s.H - hz); ctx.clip();
            ctx.translate(0, 2 * hz);
            ctx.scale(1, -1);
            one(b, 0.3);
            ctx.restore();
          }
        }
        for (const b of balloons) one(b, 1);
      },
    };

    /** One balloon: its sprite, the light inside the envelope and the burner's flame.
     * @param {Balloon} b @param {number} k alpha scale (a reflection is fainter) */
    function one(b, k) {
      const { ctx } = s;
      if (!b.sp) return;
      const sway = Math.sin(s.t * 0.5 + b.ph) * b.z * 0.03;
      const x = b.x + sway, y = b.y;
      const w = b.sp.width / s.dpr, h = b.sp.height / s.dpr;
      const fa = (s.dark ? 0.52 : 0.58) * (0.6 + 0.4 * b.d) * k;
      ctx.globalAlpha = fa;
      if (L === 1 && b.inf < 1) {
        // Lying on the field and swelling upright as it fills.
        const f = 0.25 + 0.75 * b.inf;
        const ground = y + h * 0.5;
        ctx.drawImage(b.sp, x - w / 2 * (1.1 - 0.1 * f), ground - h * f, w * (1.1 - 0.1 * f), h * f);
        if (b.burn > 0) {
          ctx.globalAlpha = (s.dark ? 0.45 : 0.4) * b.burn * k;
          const g = b.z * 0.35;
          ctx.drawImage(flame, x - g, ground - h * f * 0.15 - g, g * 2, g * 2);
        }
        return;
      }
      ctx.drawImage(b.sp, x - w / 2, y - h / 2, w, h);
      if (b.burn > 0.01) {
        // Light through the fabric low in the envelope, and the flame at its mouth.
        const mouthY = y - h / 2 + b.z * 0.92;
        ctx.globalAlpha = (s.dark ? 0.32 : 0.26) * b.burn * k;
        const gi = b.z * 0.42;
        ctx.drawImage(flame, x - gi, mouthY - b.z * 0.25 - gi, gi * 2, gi * 2);
        ctx.globalAlpha = (s.dark ? 0.55 : 0.45) * b.burn * k;
        const gf = b.z * 0.14;
        ctx.drawImage(flame, x - gf, mouthY - gf * 0.6, gf * 2, gf * 2);
      }
    }

    /** The ground for each layout, as filled bands that do not overlap, and the lake's ripples. */
    function landscape() {
      land = [];
      const W = s.W, H = s.H;
      const green = nearestHue(cols, 110), blue = nearestHue(cols, 205), far = (green + 1) % nc;
      /** The band between outline f and, below it, outline g (or the bottom).
       * @param {(x:number) => number} f @param {((x:number) => number)|null} g @param {number} c @param {number} a */
      const band = (f, g, c, a) => {
        const pts = [];
        for (let x = 0; x <= W + 16; x += 16) pts.push(Math.min(x, W), f(Math.min(x, W)));
        if (g) for (let x = Math.ceil(W / 16) * 16; x >= 0; x -= 16) pts.push(Math.min(x, W), g(Math.min(x, W)));
        else pts.push(W, H, 0, H);
        land.push({ pts, c, a });
      };
      const a0 = s.dark ? 0.12 : 0.14, a1 = s.dark ? 0.16 : 0.19;
      if (L === 0) {
        const back = (/** @type {number} */ x) => H * 0.78 - H * 0.05 * Math.sin(x / W * 4.1 + 1.3) - H * 0.02 * Math.sin(x / W * 9.7);
        const front = (/** @type {number} */ x) => Math.max(back(x), H * 0.88 - H * 0.04 * Math.sin(x / W * 3.1 + 4) - H * 0.015 * Math.sin(x / W * 13));
        band(back, front, far, a0);
        band(front, null, green, a1);
      } else if (L === 1) {
        // A far tree line, then the flat field.
        const trees = (/** @type {number} */ x) => H * 0.8 - H * 0.025 * Math.abs(Math.sin(x / W * 31)) - H * 0.01 * Math.sin(x / W * 7);
        band(trees, () => H * 0.86, far, a0);
        band(() => H * 0.86, null, green, a1);
      } else {
        const peaks = (/** @type {number} */ x) => {
          const u = x / W;
          return hz - H * (0.16 * Math.abs(Math.sin(u * 4.3 + 0.5)) + 0.06 * Math.abs(Math.sin(u * 11.3 + 2)));
        };
        const shore = (/** @type {number} */ x) => hz - H * 0.03 * (1 + Math.sin(x / W * 6.7 + 1));
        band(peaks, (x) => Math.max(peaks(x), shore(x)), far, a0);
        band((x) => Math.max(peaks(x), shore(x)), () => hz, green, a1);
        // The lake: a faint wash below the shore.
        land.push({ pts: [0, hz, W, hz, W, H, 0, H], c: blue, a: s.dark ? 0.08 : 0.1 });
        if (!ripples.length) for (let i = 0; i < 24; i++) ripples.push({ x: rng.random(), y: rng.random(), w: 20 + rng.random() * 60, v: (4 + rng.random() * 6) * wd });
        for (const r of ripples) { if (r.x <= 1) r.x *= W; if (r.y <= 1) r.y = hz + 6 + r.y * (H - hz - 8); r.y = clamp(r.y, hz + 4, H - 2); }
      }
    }
  });
}

/**
 * A balloon as a sprite at device pixels: an envelope of alternating gores with a zigzag band,
 * shaded as a round body lit from the upper left, ropes and a basket below.
 * @param {RGB[]} cols @param {number} c first gore colour @param {number} z envelope height, CSS px
 * @param {number} dpr @param {string} ink @returns {HTMLCanvasElement}
 */
function envelope(cols, c, z, dpr, ink) {
  const nc = cols.length;
  const k = z * dpr;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(k * 0.84); cv.height = Math.ceil(k * 1.22);
  const g = cv.getContext('2d');
  if (!g) return cv;
  const css = (/** @type {RGB} */ q) => `rgb(${q[0]},${q[1]},${q[2]})`;
  g.translate(cv.width / 2, 0);
  g.scale(k, k);
  // Half width down the envelope: a round crown tapering to the mouth. y from 0 (top) to 0.92.
  /** @param {number} y */
  const hw = (y) => {
    const u = y / 0.92;
    if (u <= 0.45) return 0.4 * Math.sqrt(Math.max(0, 1 - ((0.45 - u) / 0.45) ** 2));
    const v = (u - 0.45) / 0.55;
    return 0.09 + 0.31 * (Math.cos(Math.PI * v) + 1) / 2;
  };
  const N = 28;
  const outline = () => {
    g.beginPath();
    for (let i = 0; i <= N; i++) { const y = 0.92 * i / N; g.lineTo(hw(y), y); }
    for (let i = N; i >= 0; i--) { const y = 0.92 * i / N; g.lineTo(-hw(y), y); }
    g.closePath();
  };
  // Gores between meridians, in two alternating colours.
  const G = 8;
  for (let q = 0; q < G; q++) {
    const p1 = -Math.PI / 2 + (q * Math.PI) / G, p2 = p1 + Math.PI / G;
    g.fillStyle = css(cols[(c + (q % 2)) % nc]);
    g.beginPath();
    for (let i = 0; i <= N; i++) { const y = 0.92 * i / N; g.lineTo(hw(y) * Math.sin(p1), y); }
    for (let i = N; i >= 0; i--) { const y = 0.92 * i / N; g.lineTo(hw(y) * Math.sin(p2) + 0.002, y); }
    g.closePath();
    g.fill();
  }
  // A zigzag band round the widest part.
  g.save();
  outline();
  g.clip();
  g.fillStyle = css(cols[(c + 2) % nc]);
  g.beginPath();
  const y0 = 0.42, y1 = 0.5, teeth = 9;
  g.moveTo(-0.5, y0);
  for (let i = 0; i <= teeth; i++) g.lineTo(-0.45 + (0.9 * i) / teeth, i % 2 ? y0 - 0.05 : y0);
  g.lineTo(0.5, y1);
  for (let i = teeth; i >= 0; i--) g.lineTo(-0.45 + (0.9 * i) / teeth, i % 2 ? y1 + 0.05 : y1);
  g.closePath();
  g.fill();
  // Round shading: a highlight high on the left, shadow on the right.
  const sh = g.createRadialGradient(-0.14, 0.22, 0.02, -0.05, 0.35, 0.6);
  sh.addColorStop(0, 'rgba(255,255,255,.35)');
  sh.addColorStop(0.45, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = sh;
  g.fillRect(-0.5, 0, 1, 1);
  g.restore();
  // Ropes down to the basket.
  g.strokeStyle = ink;
  g.lineWidth = 1.2 / k;
  g.beginPath();
  g.moveTo(-0.09, 0.92); g.lineTo(-0.06, 1.06); g.moveTo(0.09, 0.92); g.lineTo(0.06, 1.06);
  g.moveTo(-0.03, 0.92); g.lineTo(-0.02, 1.06); g.moveTo(0.03, 0.92); g.lineTo(0.02, 1.06);
  g.stroke();
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(-0.075, 1.06); g.lineTo(0.075, 1.06); g.lineTo(0.065, 1.18); g.lineTo(-0.065, 1.18);
  g.closePath();
  g.fill();
  return cv;
}

/** Which colour's hue is nearest `deg`. @param {RGB[]} cs @param {number} deg @returns {number} */
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

/** A warm round glow. @param {RGB} c @returns {HTMLCanvasElement} */
function glow(c) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  if (!g) return cv;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const rgb = `${c[0]},${c[1]},${c[2]}`;
  grad.addColorStop(0, 'rgba(255,250,235,.95)');
  grad.addColorStop(0.2, `rgba(${rgb},.7)`);
  grad.addColorStop(0.55, `rgba(${rgb},.2)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
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
