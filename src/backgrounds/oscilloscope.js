// Oscilloscope: glowing traces on a faint scope graticule, a brighter beam running along each
// trace and fading behind it like phosphor. The seed picks the variant: one large Lissajous
// figure whose phase drifts so it seems to turn, changing ratio now and then with a slow
// crossfade; a time-base view where two or three channel waveforms are swept left to right; or
// a bank of small scope screens, each on its own Lissajous ratio and pace.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, w:number, h:number, div:number}} Screen a graticule, in CSS px, and its division size */
/** @typedef {{scr:Screen, a:number, b:number, pa:number, pb:number, fade:number, d:number, dv:number, run:number, c:number}} Scope
 * A Lissajous on screen scr: ratio a:b (pa:pb the one fading out, over fade 1 .. 0), phase d
 * drifting at dv rad/s, beam speed run (loops per second), colour c. */

const RATIOS = [[1, 2], [2, 3], [3, 4], [1, 3], [3, 5], [2, 5], [4, 5], [5, 6]];
const SEGS = 10;      // fade steps along the beam's tail
const HOLD = 22;      // seconds a ratio is held before the next fades in

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Scope[]} */
    let scopes = [];
    /** @type {Screen[]} */
    let screens = [];
    let swap = HOLD * (0.3 + 0.5 * rng.random());
    const c0 = rng.int(nc);
    const wav = [rng.random() * TAU, rng.random() * TAU, rng.random() * TAU];

    /** A graticule filling x, y, w, h with square divisions near `div`. @param {number} x @param {number} y
     * @param {number} w @param {number} h @param {number} div @returns {Screen} */
    function screen(x, y, w, h, div) {
      const nx = Math.max(2, Math.round(w / div / 2) * 2), ny = Math.max(2, Math.round(h / div / 2) * 2);
      const d = Math.min(w / nx, h / ny);
      return { x: x + (w - nx * d) / 2, y: y + (h - ny * d) / 2, w: nx * d, h: ny * d, div: d };
    }

    /** @param {Screen} scr @param {number} c @returns {Scope} */
    function scope(scr, c) {
      const [a, b] = RATIOS[rng.int(RATIOS.length)];
      return { scr, a, b, pa: a, pb: b, fade: 1, d: rng.random() * TAU, dv: (0.12 + rng.random() * 0.12) * (rng.random() < 0.5 ? -1 : 1),
        run: 0.22 + rng.random() * 0.12, c };
    }

    /** Strokes polyline pts (x, y pairs) as a phosphor trace: a soft wide glow under a thin core,
     * bright toward index `head` and dimmer behind it, the tail wrapping round past index 0; a
     * curve that is not `closed` is broken at that seam. @param {number[]} pts
     * @param {number} head @param {boolean} closed @param {string} color @param {number} alpha @returns {void} */
    function trace(pts, head, closed, color, alpha) {
      const { ctx } = s, n = pts.length / 2, m = Math.min(s.W, s.H);
      ctx.strokeStyle = color;
      const glowW = clamp(m / 140, 3, 8), coreW = clamp(m / 500, 1.2, 2.2);
      for (let k = 0; k < SEGS; k++) {
        // Segment k covers the k-th tenth behind the head (k = 0 freshest).
        const i1 = head - Math.floor(k * n / SEGS), i0 = head - Math.floor((k + 1) * n / SEGS);
        const lvl = (1 - k / SEGS) ** 2;
        ctx.beginPath();
        for (let i = i0; i <= i1; i++) {
          const j = ((i % n) + n) % n;
          if (i === i0 || (!closed && j === 0)) ctx.moveTo(pts[j * 2], pts[j * 2 + 1]); else ctx.lineTo(pts[j * 2], pts[j * 2 + 1]);
        }
        ctx.lineWidth = glowW;
        ctx.globalAlpha = alpha * (s.dark ? 0.07 + 0.12 * lvl : 0.05 + 0.08 * lvl);
        ctx.stroke();
        ctx.lineWidth = coreW;
        ctx.globalAlpha = alpha * (s.dark ? 0.2 + 0.55 * lvl : 0.25 + 0.5 * lvl);
        ctx.stroke();
      }
    }

    /** Points of the a:b figure at phase d over screen scr. @param {Screen} scr @param {number} a
     * @param {number} b @param {number} d @returns {number[]} */
    function lissajous(scr, a, b, d) {
      const n = clamp(Math.round(60 * Math.max(a, b)), 120, 400), pts = new Array(n * 2);
      const cx = scr.x + scr.w / 2, cy = scr.y + scr.h / 2, rx = scr.w * 0.4, ry = scr.h * 0.4;
      const r = Math.min(rx, ry) * 1.6;
      for (let i = 0; i < n; i++) {
        const th = i / n * TAU;
        pts[i * 2] = cx + Math.min(rx, r) * Math.sin(a * th + d);
        pts[i * 2 + 1] = cy + Math.min(ry, r) * Math.sin(b * th);
      }
      return pts;
    }

    return {
      lay() {
        const { W, H } = s, m = Math.min(W, H);
        const div = clamp(m / 7, 48, 120);
        const old = scopes;
        scopes = [];
        if (layout === 2) {
          const n = clamp(Math.round(W * H / 220000), 2, 6);
          const cols = clamp(Math.round(Math.sqrt(n * W / H)), 1, n), rows = Math.ceil(n / cols);
          const cw = W / cols, ch = H / rows, pad = Math.min(cw, ch) * 0.1;
          screens = [];
          for (let k = 0; k < cols * rows; k++) {
            const scr = screen((k % cols) * cw + pad, Math.floor(k / cols) * ch + pad, cw - pad * 2, ch - pad * 2, div * 0.6);
            screens.push(scr);
            const o = old[k];
            scopes.push(o ? { ...o, scr } : scope(scr, (c0 + k) % nc));
          }
        } else {
          const e = clamp(m * 0.05, 12, 48);
          screens = [screen(e, e, W - e * 2, H - e * 2, div)];
          if (layout === 0) scopes = [old[0] ? { ...old[0], scr: screens[0] } : scope(screens[0], c0)];
        }
      },
      step(dt) {
        swap -= dt;
        for (const sc of scopes) {
          sc.d += sc.dv * dt;
          sc.fade = Math.min(1, sc.fade + dt / 3);
        }
        if (swap <= 0 && scopes.length) {
          // One scope at a time moves to a new ratio, the old figure fading out over 3s.
          swap = HOLD / Math.sqrt(scopes.length);
          const sc = scopes[rng.int(scopes.length)];
          let r = RATIOS[rng.int(RATIOS.length)];
          if (r[0] === sc.a && r[1] === sc.b) r = RATIOS[(RATIOS.indexOf(r) + 1) % RATIOS.length];
          sc.pa = sc.a; sc.pb = sc.b; sc.a = r[0]; sc.b = r[1]; sc.fade = 0;
        }
      },
      draw() {
        const { ctx } = s;
        // Graticules: divisions, then centre axes with small ticks, then a bezel round each.
        ctx.strokeStyle = s.ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const g of screens) {
          for (let x = g.x; x <= g.x + g.w + 0.5; x += g.div) { ctx.moveTo(x, g.y); ctx.lineTo(x, g.y + g.h); }
          for (let y = g.y; y <= g.y + g.h + 0.5; y += g.div) { ctx.moveTo(g.x, y); ctx.lineTo(g.x + g.w, y); }
        }
        ctx.globalAlpha = s.dark ? 0.09 : 0.11;
        ctx.stroke();
        ctx.beginPath();
        for (const g of screens) {
          const cx = g.x + g.w / 2, cy = g.y + g.h / 2, t = g.div / 10;
          for (let x = g.x; x <= g.x + g.w + 0.5; x += g.div / 5) { ctx.moveTo(x, cy - t); ctx.lineTo(x, cy + t); }
          for (let y = g.y; y <= g.y + g.h + 0.5; y += g.div / 5) { ctx.moveTo(cx - t, y); ctx.lineTo(cx + t, y); }
          ctx.rect(g.x, g.y, g.w, g.h);
        }
        ctx.globalAlpha = s.dark ? 0.16 : 0.2;
        ctx.stroke();

        ctx.lineJoin = 'round';
        if (layout === 1) {
          // Time base: each channel's waveform, the beam sweeping left to right.
          const g = screens[0], n = clamp(Math.round(g.w / 4), 120, 480), ch = s.W * s.H > 500000 ? 3 : 2;
          const head = Math.floor(((s.t * 0.16) % 1) * n);
          for (let k = 0; k < ch; k++) {
            const pts = new Array(n * 2), mid = g.y + g.h * (k + 0.5) / ch, amp = g.h / ch * 0.32, t = s.t, p = wav[k];
            for (let i = 0; i < n; i++) {
              const u = i / (n - 1), x = u * TAU;
              let v;
              if (k === 0) v = Math.sin(x * (3 + 0.8 * Math.sin(t * 0.05 + p)) + t * 0.4 + p);
              else if (k === 1) v = Math.sin(x * 9 + t * 0.9) * (0.55 + 0.45 * Math.sin(x * 1.5 - t * 0.3 + p));
              else v = (Math.sin(x * 4 + t * 0.5 + p) + Math.sin(x * 12 + t * 1.5 + p * 3) / 3 + Math.sin(x * 20 + t * 2.5) / 5) * 0.8;
              pts[i * 2] = g.x + u * g.w; pts[i * 2 + 1] = mid - v * amp;
            }
            trace(pts, head, false, s.colors[(c0 + k) % nc], 1);
          }
        } else {
          for (const sc of scopes) {
            const color = s.colors[sc.c];
            const run = (s.t * sc.run) % 1;
            if (sc.fade < 1) {
              const p = lissajous(sc.scr, sc.pa, sc.pb, sc.d);
              trace(p, Math.floor(run * p.length / 2), true, color, 1 - sc.fade);
            }
            const p = lissajous(sc.scr, sc.a, sc.b, sc.d);
            trace(p, Math.floor(run * p.length / 2), true, color, sc.fade);
          }
        }
      },
    };
  });
}
