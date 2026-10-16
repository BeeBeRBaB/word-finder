// Drips: paint runs down in drips that slow as they go, their heads swelling into beads; the
// glossy ones are wet, and the shine goes as they dry; a drip that reaches the floor pools there.
// Old paint fades and fresh paint takes its place. The seed picks the variant: paint poured
// along the top edge in bands of colour, dripping down the wall; stripes brushed across the
// screen one by one, each dripping below itself; or splats thrown at the wall, dripping from
// their lower edges.

import { stage, TAU, clamp, mix } from './stage.js';

const DRY = 6;     // s from a drip stopping to its shine gone
const FADE = 3;    // s old paint takes to fade

/** @typedef {{x:number, y0:number, w:number, len:number, v:number, tau:number, at:number,
 *   stop:number, r:number, pool:number}} Drip
 * x, y0 where it leaves its paint; w its width; len how far it has run; v its speed, slowing
 * with time constant tau; at when it starts; stop when it stopped (-1 running); r its bead;
 * pool the width of its puddle on the floor (0 none). */
/** @typedef {{x0:number, x1:number, y:number, h:number, dir:number, cx:number, cy:number, R:number,
 *   edge:number[], blobs:number[], c:number, t0:number, pour:number, end:number, drips:Drip[], k:number}} Source
 * A band (layout 0: x0..x1 hanging from the top, h deep) or a stripe (layout 1: centred on y,
 * h thick, brushed in direction dir) or a splat (layout 2: at cx, cy, about R across, its
 * outline radii in edge and its spatters in blobs); edge holds a band or stripe's wavy edge
 * offsets; c its colour; from t0, pour s to lay down; end when it began to fade (-1 not); k its slot. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const FILL = s.dark ? 0.42 : 0.46, SHINE = s.dark ? 0.32 : 0.55;
    const nc = s.colors.length;
    /** @type {Source[]} */
    let srcs = [];
    let m = 400, dw = 8, sp = 60, lastW = 0, lastH = 0, ci = rng.int(nc);
    const N = 24;   // points along a band or stripe's edge

    /** Drips along a span, spaced a little irregularly. @param {Source} src @param {number} a
     * @param {number} b @param {(x:number) => number} y0 where paint leaves at x @param {number} t0 */
    function along(src, a, b, y0, t0) {
      for (let x = a + rng.random() * dw * 3; x < b - dw; x += dw * (1.6 + rng.random() * 5)) {
        if (rng.random() < 0.25) continue;
        src.drips.push(drip(x, y0(x), t0 + rng.random() * 2.5));
      }
    }
    /** @param {number} x @param {number} y0 @param {number} at @returns {Drip} */
    function drip(x, y0, at) {
      const long = rng.random() < (layout === 0 ? 0.3 : 0.16), w = dw * (0.55 + rng.random() * 0.9);
      return { x, y0, w, len: 0, v: sp * (0.6 + rng.random() * 0.8) * (long ? 1.3 : 1), tau: long ? 9 + rng.random() * 6 : 0.8 + rng.random() * 2.6,
        at, stop: -1, r: w * 0.5, pool: 0 };
    }
    /** A new source in slot k (layouts 0, 1) or anywhere clear (layout 2). @param {number} k @param {number} t0 @returns {Source} */
    function source(k, t0) {
      ci = (ci + 1 + rng.int(Math.max(1, nc - 1))) % nc;
      /** @type {Source} */
      const src = { x0: 0, x1: s.W, y: 0, h: 0, dir: 1, cx: 0, cy: 0, R: 0, edge: [], blobs: [], c: ci, t0, pour: 1.2, end: -1, drips: [], k };
      for (let i = 0; i <= N; i++) src.edge.push((rng.random() - 0.5) * 0.5);
      if (layout === 0) {
        const n = slots(), w = s.W / n;
        src.x0 = Math.max(0, w * k - w * (0.15 + rng.random() * 0.2)); src.x1 = Math.min(s.W, w * (k + 1) + w * (0.15 + rng.random() * 0.2));
        src.h = clamp(s.H * 0.07, 24, 70) * (0.7 + rng.random() * 0.6);
        along(src, src.x0, src.x1, (x) => bandY(src, x) - dw * 0.3, t0 + src.pour);
      } else if (layout === 1) {
        const n = slots(), gap = s.H / n;
        src.y = gap * (k + 0.5) + (rng.random() - 0.5) * gap * 0.35 - gap * 0.15;
        src.h = clamp(m * 0.05, 16, 46) * (0.7 + rng.random() * 0.5);
        src.dir = rng.random() < 0.5 ? 1 : -1;
        src.x0 = -dw; src.x1 = s.W + dw;
        src.pour = s.W / clamp(s.W * 0.25, 140, 420);
        // Drips start once the brush has passed.
        for (let x = rng.random() * dw * 3; x < s.W; x += dw * (1.6 + rng.random() * 5)) {
          if (rng.random() < 0.3) continue;
          const u = src.dir > 0 ? x / s.W : 1 - x / s.W;
          src.drips.push(drip(x, stripeY(src, x) - dw * 0.3, t0 + u * src.pour + 0.4 + rng.random() * 2));
        }
      } else {
        src.R = clamp(m * 0.05, 18, 60) * (0.6 + rng.random() * 0.9);
        let best = -1;
        for (let t = 0; t < 12; t++) {
          const x = mix(src.R, s.W - src.R, rng.random()), y = mix(src.R, s.H * 0.8, rng.random());
          let far = s.W + s.H;
          for (const o of srcs) if (o.end < 0) far = Math.min(far, Math.hypot(o.cx - x, o.cy - y) - o.R);
          if (far > best) { best = far; src.cx = x; src.cy = y; }
        }
        src.pour = 0.8;
        src.edge = [];
        const lobes = 9 + rng.int(6);
        for (let i = 0; i < lobes; i++) src.edge.push(0.72 + rng.random() * 0.45);
        for (let i = 3 + rng.int(5); i > 0; i--) {
          const a = rng.random() * TAU, d = src.R * (1.25 + rng.random() * 0.7);
          src.blobs.push(src.cx + Math.cos(a) * d, src.cy + Math.sin(a) * d, src.R * (0.07 + rng.random() * 0.13));
        }
        for (let i = 1 + rng.int(4); i > 0; i--) {
          const a = Math.PI * (0.15 + rng.random() * 0.7), rr = splatR(src, a) * 0.85;
          src.drips.push(drip(src.cx + Math.cos(a) * rr, src.cy + Math.sin(a) * rr, t0 + 0.5 + rng.random() * 1.5));
        }
      }
      return src;
    }
    /** How many bands, stripes or splats this size takes. @returns {number} */
    function slots() {
      return layout === 0 ? clamp(Math.round(s.W / 340), 2, 6) : layout === 1 ? clamp(Math.round(s.H / 210), 2, 5)
        : clamp(Math.round(s.W * s.H / 140000), 4, 12);
    }
    /** A smooth wobble through the edge offsets, u 0..1. @param {number[]} e @param {number} u */
    function wob(e, u) {
      const f = clamp(u, 0, 1) * N, i = Math.min(N - 1, Math.floor(f)), t = f - i, k = t * t * (3 - 2 * t);
      return mix(e[i], e[i + 1], k);
    }
    /** @param {Source} src @param {number} x @returns {number} the band's lower edge at x */
    const bandY = (src, x) => src.h * (1 + wob(src.edge, (x - src.x0) / (src.x1 - src.x0)));
    /** @param {Source} src @param {number} x @returns {number} the stripe's lower edge at x */
    const stripeY = (src, x) => src.y + src.h * (0.5 + 0.35 * wob(src.edge, x / s.W));
    /** @param {Source} src @param {number} a @returns {number} the splat's radius at angle a */
    function splatR(src, a) {
      const n = src.edge.length, f = ((a / TAU) % 1 + 1) % 1 * n, i = Math.floor(f) % n, t = f - Math.floor(f);
      return src.R * mix(src.edge[i], src.edge[(i + 1) % n], t * t * (3 - 2 * t));
    }

    /** Moves a source's drips on by dt. @param {Source} src @param {number} t @param {number} dt */
    function run(src, t, dt) {
      for (const d of src.drips) {
        if (t < d.at) continue;
        if (d.stop < 0) {
          d.v *= Math.exp(-dt / d.tau);
          d.len += d.v * dt;
          d.r = d.w * (0.5 + 0.22 * clamp(d.len / (d.w * 8), 0, 1));
          const floor = s.H - d.r * 0.6;
          if (d.y0 + d.len >= floor) { d.len = floor - d.y0; d.stop = t; d.pool = 0.01; }
          else if (d.v < 1.5) d.stop = t;
        }
        // A pool spreads for a few seconds after a drip lands.
        if (d.pool > 0) d.pool = Math.min(1, d.pool + dt / 3);
      }
    }
    /** When a source has dried and held long enough to fade. @param {Source} src @returns {number} */
    function due(src) {
      let last = src.t0 + src.pour;
      for (const d of src.drips) last = Math.max(last, d.stop < 0 ? Infinity : d.stop);
      return last + DRY + 4;
    }

    /** Lays out fresh paint, each source some way through its life. */
    function build() {
      m = Math.min(s.W, s.H);
      dw = clamp(m * 0.02, 6, 16);
      sp = clamp(s.H * 0.1, 30, 110);
      srcs = [];
      const n = slots();
      for (let k = 0; k < n; k++) {
        // Ages spread out, so some paint is fresh and some has dried.
        const age = rng.random() * 16, src = source(k, s.t - age);
        for (let t = src.t0; t < s.t; t += 0.1) run(src, t, 0.1);
        srcs.push(src);
      }
    }

    return {
      lay() {
        if (s.W === lastW && s.H === lastH) return;
        lastW = s.W; lastH = s.H;
        build();
      },
      step(dt) {
        for (let i = 0; i < srcs.length; i++) {
          const src = srcs[i];
          run(src, s.t, dt);
          if (src.end < 0 && s.t > due(src)) {
            src.end = s.t;
            // Fresh paint goes on as the old fades.
            srcs.push(source(src.k, s.t + FADE * 0.5));
          }
        }
        srcs = srcs.filter((q) => q.end < 0 || s.t - q.end < FADE);
      },
      draw() {
        const { ctx } = s;
        for (const src of srcs) {
          const age = s.t - src.t0;
          if (age < 0) continue;
          const pour = clamp(age / src.pour, 0, 1);
          const a = src.end < 0 ? 1 : clamp(1 - (s.t - src.end) / FADE, 0, 1);
          ctx.beginPath();
          // All of a source's paint in one path, so where its parts meet there is no seam.
          if (layout === 0) {
            const k = pour * pour * (3 - 2 * pour);
            ctx.moveTo(src.x0, -2); ctx.lineTo(src.x1, -2);
            for (let i = N; i >= 0; i--) { const x = mix(src.x0, src.x1, i / N); ctx.lineTo(x, bandY(src, x) * k); }
            ctx.closePath();
          } else if (layout === 1) {
            // The brush lays the stripe from one side, its end rounded.
            const reach = pour * (s.W + src.h * 2) - src.h, a0 = src.dir > 0 ? -dw : s.W - reach, a1 = src.dir > 0 ? reach : s.W + dw;
            if (a1 > a0) {
              const top = (/** @type {number} */ x) => src.y - src.h * (0.5 + 0.3 * wob(src.edge, 1 - x / s.W));
              ctx.moveTo(a0, top(a0));
              for (let i = 1; i <= N; i++) { const x = mix(a0, a1, i / N); ctx.lineTo(x, top(x)); }
              for (let i = N; i >= 0; i--) { const x = mix(a0, a1, i / N); ctx.lineTo(x, stripeY(src, x)); }
              ctx.closePath();
            }
          } else {
            const k = 1 - (1 - pour) ** 3;
            for (let i = 0; i <= 48; i++) {
              const t = i / 48 * TAU, r = splatR(src, t) * k;
              if (i) ctx.lineTo(src.cx + Math.cos(t) * r, src.cy + Math.sin(t) * r); else ctx.moveTo(src.cx + r, src.cy);
            }
            ctx.closePath();
            for (let i = 0; i < src.blobs.length; i += 3) {
              const r = src.blobs[i + 2] * clamp(age / src.pour * 1.5 - 0.3, 0, 1);
              if (r > 0.3) { ctx.moveTo(src.blobs[i] + r, src.blobs[i + 1]); ctx.arc(src.blobs[i], src.blobs[i + 1], r, 0, TAU); }
            }
          }
          for (const d of src.drips) if (s.t >= d.at && d.len > 0.5) body(d);
          ctx.globalAlpha = FILL * a;
          ctx.fillStyle = s.colors[src.c];
          ctx.fill();
          // The shine on wet paint: a streak down each drip and a glint on its bead.
          ctx.fillStyle = ctx.strokeStyle = '#fff';
          ctx.lineWidth = Math.max(1, dw * 0.14);
          ctx.lineCap = 'round';
          for (const d of src.drips) {
            if (s.t < d.at || d.len < d.w) continue;
            const wet = d.stop < 0 ? 1 : clamp(1 - (s.t - d.stop) / DRY, 0, 1);
            if (wet <= 0.02) continue;
            const yh = d.y0 + d.len;
            ctx.globalAlpha = SHINE * wet * a;
            ctx.beginPath();
            ctx.moveTo(d.x - d.w * 0.16, d.y0 + d.w * 1.2);
            ctx.lineTo(d.x - d.w * 0.16, Math.max(d.y0 + d.w * 1.2, yh - d.r * 1.2));
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(d.x - d.r * 0.35, yh - d.r * 0.15, d.r * 0.2, 0, TAU);
            ctx.fill();
          }
        }
      },
    };

    /** Adds a drip's outline, clockwise like its paint: down the right side, round under its
     * bead, up the left. @param {Drip} d */
    function body(d) {
      const { ctx } = s, yh = d.y0 + d.len, w = d.w, r = d.r, top = d.y0 - w * 0.4;
      const neck = Math.min(d.len * 0.5, w * 1.4);
      ctx.moveTo(d.x + w * 0.75, top);
      ctx.quadraticCurveTo(d.x + w * 0.36, d.y0 + neck * 0.3, d.x + w * 0.34, d.y0 + neck);
      ctx.lineTo(d.x + w * 0.3, Math.max(d.y0 + neck, yh - r * 0.6));
      ctx.arc(d.x, yh, r, -0.35, Math.PI + 0.35);
      ctx.lineTo(d.x - w * 0.34, d.y0 + neck);
      ctx.quadraticCurveTo(d.x - w * 0.36, d.y0 + neck * 0.3, d.x - w * 0.75, top);
      ctx.closePath();
      if (d.pool > 0) {
        // A puddle where it met the floor.
        const pw = w * (1 + d.pool * 3.5), ph = w * (0.45 + d.pool * 0.3);
        ctx.moveTo(d.x - pw, s.H + 1);
        ctx.quadraticCurveTo(d.x - pw * 0.9, s.H - ph, d.x, s.H - ph);
        ctx.quadraticCurveTo(d.x + pw * 0.9, s.H - ph, d.x + pw, s.H + 1);
        ctx.closePath();
      }
    }
  });
}
