// Radar: a beam sweeps over range rings and bearing ticks, leaving a fading wedge; contacts and
// land clutter light up as the beam crosses them and fade until the next pass, moving contacts
// leaving a trail of older, dimmer echoes. The seed picks the variant: one large scope round the
// screen centre, rings running off the edges; a weather radar at the bottom edge nodding across a
// sector over drifting rain cells; a wall of small scopes, each sweeping at its own pace.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, vx:number, vy:number, e:Float32Array, h:number}} Contact
 * Position and velocity in scope radii (per second); e is its last echoes as [x, y, time], h the newest. */
/** @typedef {{cx:number, cy:number, R:number, a:number, w:number, a0:number, a1:number,
 *   cons:Contact[], clut:Float32Array, nclut:number, wind:number[]|null, c:number}} Scope
 * Centre and radius in px; beam bearing a turning at w rad/s, nodding between a0 and a1 when they
 * differ; clutter as [x, y, last hit] in radii, drifting with `wind` (radii/s) when it has one. */

const ECHOES = 4;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const blips = s.colors.map((c) => dot(c));
    const rgb = s.colors.map((c) => channels(c));
    /** @type {Scope[]} */
    const scopes = [];
    let now = 0, warm = false;

    /** A contact at a random place inside the scope, or at its rim heading in. @param {boolean} rim @returns {Contact} */
    function contact(rim) {
      const a = rng.random() * TAU, r = rim ? 0.98 : 0.15 + 0.8 * Math.sqrt(rng.random());
      const h = rim ? a + Math.PI + (rng.random() - 0.5) * 1.4 : rng.random() * TAU;
      const v = 0.006 + rng.random() * 0.014;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: Math.cos(h) * v, vy: Math.sin(h) * v,
        e: new Float32Array(ECHOES * 3).fill(-1e9), h: 0 };
    }

    /** @param {number} n contacts @param {boolean} weather @param {number} sector half-width, 0 for a full circle
     * @returns {Scope} */
    function scope(n, weather, sector) {
      // Clutter in a few clumps: coastline for a surface radar, rain cells for weather.
      const clumps = weather ? 5 + rng.int(3) : 3 + rng.int(2), per = weather ? 40 : layout === 2 ? 14 : 30;
      const clut = new Float32Array(clumps * per * 3);
      let k = 0;
      for (let i = 0; i < clumps; i++) {
        const a = sector ? -Math.PI / 2 + (rng.random() - 0.5) * 2 * sector : rng.random() * TAU;
        const r = 0.3 + rng.random() * 0.6, sp = weather ? 0.07 + rng.random() * 0.06 : 0.05 + rng.random() * 0.05;
        const cx = Math.cos(a) * r, cy = Math.sin(a) * r, el = rng.random() * TAU;
        for (let j = 0; j < per; j++) {
          // A stretched clump: points denser near its middle.
          const u = rng.random() * TAU, d = sp * Math.sqrt(rng.random());
          const dx = Math.cos(u) * d * 1.8, dy = Math.sin(u) * d * 0.8;
          clut[k++] = cx + dx * Math.cos(el) - dy * Math.sin(el);
          clut[k++] = cy + dx * Math.sin(el) + dy * Math.cos(el);
          clut[k++] = -1e9;
        }
      }
      const cons = [];
      for (let i = 0; i < n; i++) cons.push(contact(false));
      const wa = rng.random() * TAU;
      return { cx: 0, cy: 0, R: 1, a: sector ? -Math.PI / 2 : rng.random() * TAU,
        w: (sector ? 0.32 : TAU / (7 + rng.random() * 4)) * (rng.random() < 0.3 && !sector ? -1 : 1),
        a0: sector ? -Math.PI / 2 - sector : 0, a1: sector ? -Math.PI / 2 + sector : 0,
        cons, clut, nclut: clumps * per, wind: weather ? [Math.cos(wa) * 0.008, Math.sin(wa) * 0.008] : null, c: rng.int(nc) };
    }

    if (layout === 0) scopes.push(scope(clamp(Math.round(s.W * s.H / 60000), 8, 22), false, 0));
    else if (layout === 1) scopes.push(scope(4, true, 1.15));
    else {
      // A full grid: as many scopes as the columns and rows that suit the screen's shape.
      const want = clamp(Math.round(s.W * s.H / 260000), 2, 6);
      const cols = Math.max(1, Math.round(Math.sqrt(want * s.W / s.H))), n = Math.min(6, cols * Math.ceil(want / cols));
      for (let i = 0; i < n; i++) scopes.push(scope(3 + rng.int(3), false, 0));
    }

    /** Is bearing t between a (exclusive) and b (inclusive), going the way the beam turned?
     * @param {number} t @param {number} a @param {number} b @returns {boolean} */
    function swept(t, a, b) {
      if (b >= a) return ((t - a) % TAU + TAU) % TAU <= b - a && ((t - a) % TAU + TAU) % TAU > 0;
      return ((a - t) % TAU + TAU) % TAU <= a - b && ((a - t) % TAU + TAU) % TAU > 0;
    }

    /** @param {number} dt @returns {void} */
    function step(dt) {
      now += dt;
      for (const sc of scopes) {
        const a = sc.a;
        let b = a + sc.w * dt;
        // A sector scan nods back at its ends.
        if (sc.a1 !== sc.a0 && (b > sc.a1 || b < sc.a0)) { sc.w = -sc.w; b = clamp(b, sc.a0, sc.a1); }
        sc.a = sc.a1 !== sc.a0 ? b : b % TAU;
        for (const c of sc.cons) {
          c.x += c.vx * dt; c.y += c.vy * dt;
          if (c.x * c.x + c.y * c.y > 1.02) Object.assign(c, contact(true));
          if (swept(Math.atan2(c.y, c.x), a, b)) {
            c.h = (c.h + 1) % ECHOES;
            c.e[c.h * 3] = c.x; c.e[c.h * 3 + 1] = c.y; c.e[c.h * 3 + 2] = now;
          }
        }
        const cl = sc.clut, wd = sc.wind;
        for (let i = 0; i < sc.nclut * 3; i += 3) {
          if (wd) {
            cl[i] += wd[0] * dt; cl[i + 1] += wd[1] * dt;
            // Rain blown off one side comes back on the other.
            if (cl[i] * cl[i] + cl[i + 1] * cl[i + 1] > 1) { cl[i] = -cl[i] * 0.98; cl[i + 1] = -cl[i + 1] * 0.98; }
          }
          if (swept(Math.atan2(cl[i + 1], cl[i]), a, b)) cl[i + 2] = now;
        }
      }
    }

    return {
      lay() {
        if (layout === 0) {
          Object.assign(scopes[0], { cx: s.W / 2, cy: s.H / 2, R: Math.max(s.W, s.H) * 0.5 });
        } else if (layout === 1) {
          Object.assign(scopes[0], { cx: s.W / 2, cy: s.H + 6, R: Math.min(s.H * 0.94, Math.max(s.W * 0.6, s.H * 0.85)) });
        } else {
          const n = scopes.length, cols = Math.max(1, Math.round(Math.sqrt(n * s.W / s.H))), rows = Math.ceil(n / cols);
          const cw = s.W / cols, ch = s.H / rows;
          scopes.forEach((sc, i) => {
            const r = Math.floor(i / cols), inRow = r === rows - 1 ? n - r * cols : cols;
            sc.cx = (cols - inRow) * cw / 2 + (i % cols + 0.5) * cw;
            sc.cy = (r + 0.5) * ch;
            sc.R = Math.min(cw, ch) * 0.44;
          });
        }
        // Sweep once round before the first paint, so a still frame has echoes in it.
        if (warm) return;
        warm = true;
        for (let i = 0; i < 330; i++) step(1 / 30);
      },
      step,
      draw() {
        const { ctx } = s;
        const A = s.dark ? 1 : 1.1;
        for (const sc of scopes) {
          const { cx, cy, R } = sc, col = s.colors[sc.c];
          const period = sc.a1 !== sc.a0 ? (sc.a1 - sc.a0) * 2 / Math.abs(sc.w) : TAU / Math.abs(sc.w);
          // Range rings, cross hairs and bearing ticks.
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.22 * A;
          const full = sc.a1 === sc.a0;
          const lo = full ? 0 : sc.a0, hi = full ? TAU : sc.a1;
          const rings = R > 260 ? 5 : 4;
          ctx.beginPath();
          for (let i = 1; i <= rings; i++) {
            const r = R * i / rings;
            ctx.moveTo(cx + Math.cos(lo) * r, cy + Math.sin(lo) * r);
            ctx.arc(cx, cy, r, lo, hi);
          }
          for (let k = 0; k < (full ? 4 : 3); k++) {
            const a = full ? k * Math.PI / 2 : sc.a0 + k * (sc.a1 - sc.a0) / 2;
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
          }
          ctx.stroke();
          ctx.globalAlpha = 0.34 * A;
          ctx.beginPath();
          const tick = clamp(R * 0.03, 4, 12);
          for (let d = 0; d < 360; d += 5) {
            const a = d * TAU / 360;
            if (!full && (a - TAU < sc.a0 - 1e-6 || a - TAU > sc.a1 + 1e-6)) continue;
            const t = d % 30 === 0 ? tick * 1.8 : tick;
            ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
            ctx.lineTo(cx + Math.cos(a) * (R - t), cy + Math.sin(a) * (R - t));
          }
          ctx.stroke();
          // The wedge behind the beam: one fill, a conic gradient fading toward its tail.
          const dir = Math.sign(sc.w);
          let span = 0.75;
          if (!full) span = Math.min(span, dir > 0 ? sc.a - sc.a0 : sc.a1 - sc.a);
          if (span > 0.01) {
            const from = dir > 0 ? sc.a - span : sc.a;
            const [r, gr, b] = rgb[sc.c], top = s.dark ? 0.22 : 0.19;
            // Without conic gradients (before Safari 16.1 and Chrome 99) the wedge is one faint tone.
            if (typeof ctx.createConicGradient === 'function') {
              const g = ctx.createConicGradient(from, cx, cy), f = span / TAU;
              for (let k = 0; k <= 6; k++) {
                const u = k / 6, al = (top * (1 - u) ** 2).toFixed(3);
                g.addColorStop(dir > 0 ? f * (1 - u) : f * u, `rgba(${r},${gr},${b},${al})`);
              }
              ctx.fillStyle = g;
            } else ctx.fillStyle = `rgba(${r},${gr},${b},${(top / 3).toFixed(3)})`;
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, R, from, from + span);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 0.6 * A;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(sc.a) * R, cy + Math.sin(sc.a) * R);
          ctx.stroke();
          // Echoes: bright as the beam passes, fading over most of a sweep.
          if (s.dark) ctx.globalCompositeOperation = 'lighter';
          const tau = period * 0.4, img = blips[sc.c], img2 = blips[(sc.c + 1) % nc];
          const cs = clamp(R * 0.008, 1.8, 3.4), bs = clamp(R * 0.016, 4.5, 8);
          const cl = sc.clut;
          for (let i = 0; i < sc.nclut * 3; i += 3) {
            const f = Math.exp((cl[i + 2] - now) / tau);
            if (f < 0.06) continue;
            ctx.globalAlpha = 0.55 * f;
            ctx.drawImage(img, cx + cl[i] * R - cs, cy + cl[i + 1] * R - cs, cs * 2, cs * 2);
          }
          for (const c of sc.cons) {
            for (let k = 0; k < ECHOES; k++) {
              const j = ((c.h - k + ECHOES) % ECHOES) * 3;
              const f = Math.exp((c.e[j + 2] - now) / (k ? period * 1.2 : tau));
              if (f < 0.03) continue;
              const d = bs * (k ? 0.6 : 1);
              ctx.globalAlpha = (k ? 0.4 : 0.9) * f;
              ctx.drawImage(img2, cx + c.e[j] * R - d, cy + c.e[j + 1] * R - d, d * 2, d * 2);
            }
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      },
    };
  });
}

/** A colour's r, g, b, read back from a canvas so any CSS colour works. @param {string} color @returns {number[]} */
function channels(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
  return (v.match(/[\d.]+/g) ?? ['128', '128', '128']).slice(0, 3).map(Number);
}

/** A round blip with a soft rim, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function dot(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 16, 16);
  const grad = g.createRadialGradient(8, 8, 0, 8, 8, 8);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.5, 'rgba(0,0,0,.75)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 16);
  return c;
}
