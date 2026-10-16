// Day and night: a slow sky cycle over a landscape, two minutes a turn. The sun rises, arcs over
// and sets in a warm dusk; stars come out and the moon crosses; a warm dawn follows. The sky is a
// translucent wash, so the page shows through and it only ever fades over several seconds. The
// seed picks the variant: rolling hills dotted with round trees under drifting clouds; a mountain
// lake that mirrors the sun and moon in glinting streaks; or a village on the hills under a low
// winter arc, its windows lighting one by one at dusk and going out at dawn.

import { stage, TAU, clamp, mix } from './stage.js';

const DAY = 120;  // seconds a full cycle takes
const NL = 3;     // land layers

/** @typedef {[number, number, number]} RGB */
/** @typedef {{u:number, v:number, r:number, f:number, ph:number}} Star */
/** @typedef {{u:number, s:number, k:number}} Tree */
/** @typedef {{u:number, w:number, thr:number[]}} House */

/** @param {number} a @param {number} b @param {number} x @returns {number} */
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const rgb = s.colors.map(rgbOf);
    const C = rgb.length;
    // The look's warmest colour lights the sun and dusk, its coolest the sky, the greenest the land.
    const warm = rgb[nearestHue(rgb, 30)], cool = rgb[nearestHue(rgb, 215)], land0 = nearestHue(rgb, 120);
    const night = /** @type {RGB} */ (s.dark ? [8, 10, 26] : [18, 22, 52]);
    const phase0 = [0.43, 0.47, 0.55][layout];
    // Shapes from the seed, in host fractions, so a resize keeps the same land.
    const waves = Array.from({ length: NL }, () => [1, 2, 3, 5].map((n) => ({ n, a: 0.5 + rng.random(), ph: rng.random() * TAU })));
    const ridges = Array.from({ length: NL }, () => Array.from({ length: 24 }, () => rng.random()));
    /** @type {Star[]} */
    const stars = Array.from({ length: 220 }, () => ({ u: rng.random(), v: rng.random() * rng.random() * 0.7, r: 0.9 + rng.random() * 1.3,
      f: 0.1 + rng.random() * 0.25, ph: rng.random() * TAU }));
    /** @type {Tree[]} */
    const trees = Array.from({ length: 26 }, () => ({ u: rng.random(), s: 0.6 + rng.random() * 0.6, k: 1 + rng.int(2) }));
    /** @type {House[]} */
    const houses = Array.from({ length: 12 }, (_, i) => ({ u: (i + 0.2 + rng.random() * 0.6) / 12, w: 0.8 + rng.random() * 0.5,
      thr: [0.25 + rng.random() * 0.5, 0.25 + rng.random() * 0.5] }));
    const clouds = Array.from({ length: 4 }, (_, i) => ({ u: rng.random(), v: 0.1 + i * 0.06 + rng.random() * 0.04, r: 0.7 + rng.random() * 0.5,
      v0: 0.6 + rng.random() * 0.6, bumps: Array.from({ length: 5 }, () => rng.random()) }));
    /** @type {Path2D[]} */
    let hills = [];
    /** @type {Float32Array[]} */
    let tops = [];
    const sunCv = disc(s.colors[nearestHue(rgb, 30)], 0);
    const moonCv = disc(s.dark ? '#e6e8f2' : '#f4f4f8', 0.62);
    const glowCv = glow(warm);
    let m = 1, hy = 1, lakeY = 1, cols = 48;

    /** Layer i's top at column j. @param {number} i @param {number} j @returns {number} */
    function top(i, j) {
      const u = j / cols;
      const base = s.H * (layout === 1 ? 0.6 + 0.06 * i : 0.62 + 0.1 * i);
      if (layout === 1) {
        // Ridges: straight slopes between alternate peaks and saddles.
        const K = 10 + i * 4, x = u * K, k = Math.floor(x), f = x - k;
        const at = (/** @type {number} */ q) => (q % 2 ? 0.2 + 0.3 * ridges[i][q % 24] : 0.6 + 0.4 * ridges[i][q % 24]);
        return base - m * (0.26 - i * 0.06) * mix(at(k), at(k + 1), f);
      }
      let h = 0;
      for (const w of waves[i]) h += Math.sin(u * TAU * w.n * 0.8 + w.ph) * (0.5 / w.n) * w.a;
      return base - m * (0.07 - i * 0.012) * (1.2 + h);
    }

    /** Builds each layer's outline for the current size. @returns {void} */
    function build() {
      cols = clamp(Math.round(s.W / 24), 24, 96);
      tops = []; hills = [];
      for (let i = 0; i < NL; i++) {
        if (layout === 1 && i === 2) break;
        const t = new Float32Array(cols + 1), p = new Path2D(), foot = layout === 1 ? s.H * 0.68 : s.H + 2;
        p.moveTo(-2, foot);
        for (let j = 0; j <= cols; j++) { t[j] = top(i, j); p.lineTo(j / cols * (s.W + 4) - 2, t[j]); }
        p.lineTo(s.W + 2, foot);
        p.closePath();
        tops.push(t); hills.push(p);
      }
      hy = s.H * (layout === 1 ? 0.62 : 0.7);
      lakeY = s.H * 0.68;
    }

    /** The ground's height at x on layer i. @param {number} i @param {number} x @returns {number} */
    function groundAt(i, x) {
      const t = tops[i], j = clamp(x / s.W * cols, 0, cols - 1e-6), k = Math.floor(j);
      return mix(t[k], t[k + 1], j - k);
    }

    /** @param {RGB} c @param {number} a @returns {string} */
    const css = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;
    /** @param {RGB} a @param {RGB} b @param {number} u @returns {RGB} */
    const mixc = (a, b, u) => [mix(a[0], b[0], u), mix(a[1], b[1], u), mix(a[2], b[2], u)];

    /** Glinting streaks on the lake below a body at x, each slowly widening and narrowing.
     * @param {number} x @param {number} r @param {RGB} c @param {number} a @returns {void} */
    function streaks(x, r, c, a) {
      const { ctx } = s;
      const n = 16, gap = (s.H - lakeY) / (n + 1);
      ctx.fillStyle = css(c, 1);
      for (let k = 0; k < n; k++) {
        // Wider and fainter with depth, each wavering on its own slow beat.
        const w = r * (1.2 + k * 0.12) * (0.55 + 0.45 * Math.sin(s.t * 0.7 + k * 2.3));
        const dx = Math.sin(s.t * 0.4 + k * 1.7) * r * 0.35;
        ctx.globalAlpha = a * (0.6 - k * 0.025);
        ctx.fillRect(x + dx - w / 2, lakeY + gap * (k + 0.5), w, Math.max(1.5, gap * 0.16));
      }
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        build();
      },
      step() {},
      draw() {
        const { ctx } = s;
        const ph = (phase0 + s.t / DAY) % 1, th = ph * TAU, e = Math.sin(th);
        const day = smooth(-0.22, 0.12, e), dark = 1 - day;
        const dusk = Math.exp(-(((e + 0.04) / 0.16) ** 2));
        // The sky wash: cool by day, deep by night, warm low down at dusk and dawn.
        const skyTop = mixc(night, cool, day), skyLow = mixc(skyTop, warm, dusk * 0.85);
        const aTop = s.dark ? 0.05 + 0.12 * day : mix(0.4, 0.12, day), aLow = aTop + 0.14 * dusk;
        const g = ctx.createLinearGradient(0, 0, 0, hy);
        g.addColorStop(0, css(skyTop, aTop));
        g.addColorStop(1, css(skyLow, aLow));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s.W, s.H);
        // Stars, fading in as the sky darkens, each on a slow twinkle.
        if (dark > 0.02) {
          ctx.fillStyle = s.dark ? '#e8eaf4' : '#ffffff';
          for (const st of stars) {
            const tw = 0.6 + 0.4 * Math.sin(s.t * st.f * TAU + st.ph);
            ctx.globalAlpha = dark * tw * (s.dark ? 0.75 : 0.9);
            ctx.fillRect(st.u * s.W, st.v * s.H, st.r, st.r);
          }
        }
        // The sun and moon on opposite sides of one arc.
        const rx = s.W * 0.44, ry = (hy - s.H * (layout === 2 ? 0.3 : 0.1));
        const sx = s.W / 2 - rx * Math.cos(th), sy = hy - ry * e;
        const mx = s.W / 2 + rx * Math.cos(th), my = hy + ry * e;
        const rs = clamp(m * 0.045, 14, 40);
        const moonA = (s.dark ? 0.85 : 0.95) * smooth(0.3, 0, e);
        if (layout === 1) {
          // The lake, then the bodies kept above its shore, then their glints on it.
          ctx.fillStyle = css(mixc(cool, night, dark * 0.5), s.dark ? 0.14 : 0.18);
          ctx.fillRect(0, lakeY, s.W, s.H - lakeY);
          ctx.fillStyle = css(rgb[land0], 0.4);
          ctx.fillRect(0, lakeY - 1, s.W, 2);
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, s.W, lakeY); ctx.clip();
        }
        if (e > -0.3) {
          ctx.globalAlpha = (s.dark ? 0.45 : 0.55) * (0.5 + dusk * 0.5);
          const gr = rs * (5 + dusk * 2);
          ctx.drawImage(glowCv, sx - gr, sy - gr, gr * 2, gr * 2);
          ctx.globalAlpha = s.dark ? 0.85 : 0.8;
          ctx.drawImage(sunCv, sx - rs, sy - rs, rs * 2, rs * 2);
        }
        if (moonA > 0.01) {
          ctx.globalAlpha = moonA;
          ctx.drawImage(moonCv, mx - rs * 0.8, my - rs * 0.8, rs * 1.6, rs * 1.6);
        }
        if (layout === 1) {
          ctx.restore();
          if (e > 0) streaks(sx, rs, warm, smooth(0, 0.1, e) * 0.8);
          if (e < 0) streaks(mx, rs * 0.7, [235, 236, 245], moonA * smooth(0, -0.1, e) * (s.dark ? 0.6 : 1));
        }
        if (layout === 0) {
          for (const c of clouds) {
            const x = ((c.u + s.t * c.v0 * 0.004) % 1.3 - 0.15) * s.W, y = c.v * s.H, r = m * 0.04 * c.r;
            ctx.globalAlpha = (s.dark ? 0.16 : 0.3) * (0.45 + 0.55 * day) + 0.1 * dusk;
            ctx.fillStyle = css(mixc(s.dark ? [235, 238, 248] : cool, warm, dusk * 0.7), 1);
            ctx.beginPath();
            c.bumps.forEach((b, k) => {
              const bx = x + (k - 2) * r * 0.9, by = y - Math.sin((k / 4) * Math.PI) * r * (0.5 + b * 0.5), br = r * (0.6 + b * 0.5);
              ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, TAU);
            });
            ctx.fill();
          }
        }
        // The land, darkening and cooling toward night, nearer layers stronger.
        const lit = 0.35 + 0.65 * day;
        for (let i = 0; i < hills.length; i++) {
          const c = mixc(rgb[(land0 + i) % C], night, 0.55 * (1 - lit));
          // Clear what lies behind the layer first, so no sky, sun or farther hill shows through.
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fill(hills[i]);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = css(c, (s.dark ? 0.17 : 0.2) + i * 0.07);
          ctx.fill(hills[i]);
          if (layout === 0 && i > 0) {
            // Round trees on the two nearer layers.
            ctx.fillStyle = css(mixc(c, warm, 0.15), 0.32 + i * 0.06);
            ctx.beginPath();
            for (const t of trees) {
              if (t.k !== i) continue;
              const x = t.u * s.W, y = groundAt(i, x), r = m * 0.022 * t.s * (0.8 + i * 0.25);
              ctx.rect(x - r * 0.12, y - r * 1.4, r * 0.24, r * 1.5);
              ctx.moveTo(x + r, y - r * 1.9); ctx.arc(x, y - r * 1.9, r, 0, TAU);
            }
            ctx.fill();
          }
        }
        if (layout === 2) {
          // Houses on the near hill, windows lit through the night.
          const n = clamp(Math.round(s.W / 140), 4, 12), c = mixc(rgb[(land0 + 2) % C], night, 0.55 * (1 - lit));
          const hw = clamp(m * 0.05, 20, 46);
          for (let k = 0; k < n; k++) {
            const hs = houses[Math.floor(k * 12 / n)], x = (k + 0.5) / n * s.W, w = hw * hs.w, h = w * 0.7;
            const y = groundAt(2, x) + h * 0.15;
            ctx.globalAlpha = 1;
            ctx.fillStyle = css(c, 0.55);
            ctx.beginPath();
            ctx.rect(x - w / 2, y - h, w, h);
            ctx.moveTo(x - w * 0.62, y - h + 0.5); ctx.lineTo(x, y - h - w * 0.45); ctx.lineTo(x + w * 0.62, y - h + 0.5);
            ctx.fill();
            ctx.fillStyle = css(warm, 1);
            hs.thr.forEach((thr, q) => {
              ctx.globalAlpha = 0.9 * smooth(thr, thr + 0.2, dark);
              if (ctx.globalAlpha > 0.01) ctx.fillRect(x - w * 0.3 + q * w * 0.38, y - h * 0.68, w * 0.22, h * 0.3);
            });
          }
        }
      },
    };
  });
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

/** A body as a sprite: a soft-rimmed disc, with a bite taken out for a crescent moon.
 * @param {string} color @param {number} bite 0 for none, else the bite's offset in radii
 * @returns {HTMLCanvasElement} */
function disc(color, bite) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill();
  if (bite) {
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(32 + bite * 30, 32 - bite * 12, 27, 0, TAU); g.fill();
  }
  return c;
}

/** A wide soft glow. @param {RGB} c @returns {HTMLCanvasElement} */
function glow(c) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  if (!g) return cv;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const rgb = `${c[0]},${c[1]},${c[2]}`;
  grad.addColorStop(0, `rgba(${rgb},.7)`);
  grad.addColorStop(0.35, `rgba(${rgb},.22)`);
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
