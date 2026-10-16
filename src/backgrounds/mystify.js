// Mystify: polygons whose corners drift in straight lines and bounce off the edges, each leaving
// a row of fading echoes behind it, their colour easing slowly round the look's colours. The
// seed picks the variant: two quadrilaterals over the whole host with a few wide-spaced echoes;
// one pentagon with a long run of close echoes that sweep out folded ribbons; or a grid of small
// framed panes, each bouncing its own quadrilateral in its own colour.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, vx:number, vy:number}} Corner x, y 0..1 across its box; v in px/s */
/** @typedef {{xs:Float32Array, ys:Float32Array, u:number}} Echo a snapshot of the corners and colour mix */
/** @typedef {{box:number, corners:Corner[], echoes:Echo[], c:number, ph:number, since:number}} Poly */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const rgb = s.colors.map(rgbOf);
    const nc = rgb.length;
    // Corners per polygon, echoes kept and seconds between them.
    const [SIDES, KEEP, GAP] = layout === 1 ? [5, 26, 0.07] : layout === 2 ? [4, 5, 0.2] : [4, 6, 0.22];
    const CYCLE = 14; // seconds for a colour to ease into the next
    /** Boxes the polygons bounce in, CSS px: [x, y, w, h]. @type {number[][]} */
    let boxes = [];
    /** @type {Poly[]} */
    let polys = [];
    let speed = 80, warm = true;
    const base = rng.int(nc);

    /** @returns {Poly} @param {number} box @param {number} c */
    function poly(box, c) {
      /** @type {Corner[]} */
      const corners = [];
      for (let i = 0; i < SIDES; i++) {
        const a = rng.random() * TAU;
        // Keep both components well off zero so no corner slides along an edge.
        const vx = Math.cos(a), vy = Math.sin(a);
        const k = 0.75 + rng.random() * 0.5;
        corners.push({ x: rng.random(), y: rng.random(),
          vx: Math.sign(vx || 1) * Math.max(0.35, Math.abs(vx)) * k,
          vy: Math.sign(vy || 1) * Math.max(0.35, Math.abs(vy)) * k });
      }
      return { box, corners, echoes: [], c, ph: rng.random(), since: 0 };
    }

    /** The colour of `p` at mix `u` (0..1 through one palette step), with alpha. @param {Poly} p @param {number} u @param {number} a */
    function tint(p, u, a) {
      const i = Math.floor(u * nc) % nc, f = u * nc - Math.floor(u * nc);
      const A = rgb[(p.c + i) % nc], B = rgb[(p.c + i + 1) % nc];
      // An eased hold-then-blend, so each colour stays a while before it turns.
      const e = clamp((f - 0.6) / 0.4, 0, 1), w = e * e * (3 - 2 * e);
      const r = A[0] + (B[0] - A[0]) * w, g = A[1] + (B[1] - A[1]) * w, b = A[2] + (B[2] - A[2]) * w;
      return `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`;
    }

    /** @param {number} dt */
    function advance(dt) {
      for (const p of polys) {
        const [, , bw, bh] = boxes[p.box];
        for (const k of p.corners) {
          k.x += k.vx * speed * dt / bw;
          k.y += k.vy * speed * dt / bh;
          if (k.x < 0) { k.x = -k.x; k.vx = Math.abs(k.vx); } else if (k.x > 1) { k.x = 2 - k.x; k.vx = -Math.abs(k.vx); }
          if (k.y < 0) { k.y = -k.y; k.vy = Math.abs(k.vy); } else if (k.y > 1) { k.y = 2 - k.y; k.vy = -Math.abs(k.vy); }
        }
        p.ph = (p.ph + dt / (CYCLE * nc)) % 1;
        p.since += dt;
        if (p.since >= GAP) {
          p.since -= GAP;
          const e = p.echoes.length >= KEEP ? /** @type {Echo} */ (p.echoes.pop())
            : { xs: new Float32Array(SIDES), ys: new Float32Array(SIDES), u: 0 };
          p.corners.forEach((k, i) => { e.xs[i] = k.x; e.ys[i] = k.y; });
          e.u = p.ph;
          p.echoes.unshift(e);
        }
      }
    }

    /** Adds one closed outline to the path. @param {number[]} b @param {ArrayLike<number>} xs @param {ArrayLike<number>} ys */
    function outline(b, xs, ys) {
      const { ctx } = s;
      ctx.moveTo(b[0] + xs[0] * b[2], b[1] + ys[0] * b[3]);
      for (let i = 1; i < SIDES; i++) ctx.lineTo(b[0] + xs[i] * b[2], b[1] + ys[i] * b[3]);
      ctx.closePath();
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        speed = clamp(m * 0.16, 55, 125);
        if (layout === 2) {
          // Panes: the grid follows the host's shape; a pane is never far off square.
          const cols = clamp(Math.round(s.W / Math.max(240, m * 0.42)), 1, 4);
          const rows = clamp(Math.round(s.H / Math.max(240, m * 0.42)), 1, 4);
          const gap = clamp(m * 0.035, 10, 28), pad = clamp(m * 0.02, 8, 18);
          const pw = (s.W - gap * (cols + 1)) / cols, ph = (s.H - gap * (rows + 1)) / rows;
          boxes = [];
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            boxes.push([gap + c * (pw + gap) + pad, gap + r * (ph + gap) + pad, pw - pad * 2, ph - pad * 2]);
          }
          speed *= 0.6;
        } else {
          const pad = 2;
          boxes = [[pad, pad, s.W - pad * 2, s.H - pad * 2]];
        }
        const want = layout === 2 ? boxes.length : layout === 1 ? 1 : 2;
        while (polys.length < want) {
          polys.push(poly(layout === 2 ? polys.length : 0, (base + polys.length * (layout === 2 ? 1 : 2)) % nc));
        }
        polys.length = want;
        polys.forEach((p, i) => { p.box = layout === 2 ? i : 0; });
        // First lay: run a few seconds so a still frame already has its echoes.
        if (warm) { warm = false; for (let i = 0; i < 120; i++) advance(1 / 30); }
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        ctx.lineJoin = 'round';
        if (layout === 2) {
          // Faint pane frames, a little outside each box.
          ctx.strokeStyle = s.ink;
          ctx.globalAlpha = s.dark ? 0.16 : 0.2;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (const b of boxes) {
            const pad = 6;
            ctx.rect(b[0] - pad, b[1] - pad, b[2] + pad * 2, b[3] + pad * 2);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        const top = s.dark ? 0.62 : 0.58, low = 0.08;
        for (const p of polys) {
          const b = boxes[p.box];
          const n = p.echoes.length;
          ctx.lineWidth = layout === 1 ? 1.3 : 1.7;
          // Oldest first, so the newest outline lies on top.
          for (let i = n - 1; i >= 0; i--) {
            const e = p.echoes[i];
            const f = 1 - (i + 1) / (KEEP + 1);
            ctx.strokeStyle = tint(p, e.u, low + (top - low) * 0.8 * f * f);
            ctx.beginPath();
            outline(b, e.xs, e.ys);
            ctx.stroke();
          }
          ctx.lineWidth = 2;
          ctx.strokeStyle = tint(p, p.ph, top);
          ctx.beginPath();
          outline(b, p.corners.map((k) => k.x), p.corners.map((k) => k.y));
          ctx.stroke();
        }
      },
    };
  });
}

/** A CSS colour as [r, g, b]. @param {string} color @returns {number[]} */
function rgbOf(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = '#888';
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = v.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
