// Dunes: sand dunes with sharp brinks, gentle windward slopes and shaded slip faces, sand
// streaming off them downwind, in the look's colours. The seed picks the variant: an erg seen from
// the side, ridge behind ridge to a far horizon, panning slowly, plumes blowing off the near
// crests; barchans seen from above, crescent dunes creeping downwind over a rippled floor, small
// ones faster, sand whipping off their horns; or great dune, one tall dune close up, ripples
// climbing its windward face and a long plume of sand streaming off its brink.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, vx:number, vy:number, life:number, age:number, layer:number}} Grain */
/** @typedef {{base:number, h:number, L:number, pan:number, u:number, c:number, grad:CanvasGradient|string, depth:number, acc:number}} Ridge */
/** @typedef {{x:number, y:number, R:number, c:number}} Barchan */

const MAX_GRAINS = 420;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    const rgb = s.colors.map(rgbOf);
    const dir = rng.random() < 0.5 ? 1 : -1;
    const salt = rng.int(1000);
    let m = 1, warmed = false, acc = 0;
    /** @type {Grain[]} */
    let grains = [];
    /** @type {Ridge[]} */
    let ridges = [];
    /** @type {Barchan[]} */
    let barchans = [];
    const shade = s.dark ? 'rgba(0,0,0,.32)' : 'rgba(0,0,0,.1)';

    // ---- Side view (layout 0) ----

    /** Crest k of ridge r, in wind-frame x (wind toward +x): [x, y].
     * @param {Ridge} r @param {number} k @param {number} i the ridge's index @returns {number[]} */
    function crest(r, k, i) {
      return [k * r.L + (hash(k * 31 + i * 7 + salt) - 0.5) * 0.4 * r.L, r.base - r.h * (0.55 + 0.55 * hash(k * 17 + i * 3 + salt))];
    }

    /** The ridge's surface height at wind-frame x: a steep slip face falls from each brink to a
     * trough, then a long windward slope climbs to the next brink.
     * @param {Ridge} r @param {number} i @param {number} wx @returns {number} */
    function profile(r, i, wx) {
      let k = Math.floor(wx / r.L);
      let a = crest(r, k, i), b = crest(r, k + 1, i);
      if (wx < a[0]) { k--; b = a; a = crest(r, k, i); } else if (wx >= b[0]) { k++; a = b; b = crest(r, k + 1, i); }
      const xt = a[0] + (b[0] - a[0]) * 0.26, yt = r.base + r.h * 0.12 * hash(k * 5 + i + salt);
      if (wx < xt) return a[1] + (yt - a[1]) * Math.sin((wx - a[0]) / (xt - a[0]) * Math.PI / 2);
      const v = (wx - xt) / (b[0] - xt);
      return yt + (b[1] - yt) * v * v * (3 - 2 * v);
    }

    /** Screen x of a wind-frame x on ridge r. @param {Ridge} r @param {number} wx */
    const sx = (r, wx) => dir * wx - r.pan * s.t;
    /** Wind-frame x of a screen x on ridge r. @param {Ridge} r @param {number} x */
    const wxOf = (r, x) => dir * (x + r.pan * s.t);

    function layRidges() {
      const n = clamp(Math.round(s.H / 120), 4, 7);
      const horizon = s.H * 0.2;
      ridges = [];
      for (let i = 0; i < n; i++) {
        const u = n > 1 ? i / (n - 1) : 1;
        ridges.push({ base: horizon + (s.H * 0.98 - horizon) * Math.pow((i + 0.7) / n, 1.15), h: m * (0.05 + 0.13 * u),
          L: m * (0.38 + 0.7 * u), pan: dir * (1.5 + 9 * u), u, c: i % C, grad: '', depth: 0, acc: 0 });
      }
      for (let i = 0; i < n; i++) {
        const r = ridges[i];
        const next = i + 1 < n ? ridges[i + 1].base : s.H + 60;
        r.depth = (next - r.base) * 1.4 + r.h * 1.2;
        const g = s.ctx.createLinearGradient(0, r.base - r.h * 1.2, 0, r.base + r.depth);
        const a = (s.dark ? 0.22 : 0.26) + 0.12 * r.u;
        g.addColorStop(0, rgba(rgb[r.c], a));
        g.addColorStop(0.4, rgba(rgb[r.c], a * 0.75));
        g.addColorStop(1, rgba(rgb[r.c], 0));
        r.grad = g;
      }
    }

    /** @param {Ridge} r @param {number} i */
    function drawRidge(r, i) {
      const { ctx } = s, step = 6;
      ctx.beginPath();
      for (let x = -step; x <= s.W + step; x += step) {
        const y = profile(r, i, wxOf(r, x));
        if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(s.W + step, r.base + r.depth); ctx.lineTo(-step, r.base + r.depth); ctx.closePath();
      ctx.globalAlpha = 1; ctx.fillStyle = r.grad; ctx.fill();
      // Slip faces in shadow: from each brink down its face, back under it to the brink.
      ctx.beginPath();
      const w0 = Math.min(wxOf(r, -r.L), wxOf(r, s.W + r.L)), w1 = Math.max(wxOf(r, -r.L), wxOf(r, s.W + r.L));
      for (let k = Math.floor(w0 / r.L) - 1; k <= Math.ceil(w1 / r.L) + 1; k++) {
        const a = crest(r, k, i), b = crest(r, k + 1, i);
        const xt = a[0] + (b[0] - a[0]) * 0.26;
        ctx.moveTo(sx(r, a[0]), a[1]);
        for (let q = 1; q <= 8; q++) { const wx = a[0] + (xt - a[0]) * q / 8; ctx.lineTo(sx(r, wx), profile(r, i, wx)); }
        const yt = profile(r, i, xt);
        ctx.quadraticCurveTo(sx(r, a[0] + (xt - a[0]) * 0.5), yt + (yt - a[1]) * 0.5, sx(r, a[0] - (xt - a[0]) * 0.15), a[1] + (yt - a[1]) * 0.9);
        ctx.closePath();
      }
      ctx.fillStyle = shade; ctx.fill();
      // The ridge line.
      ctx.beginPath();
      for (let x = -step; x <= s.W + step; x += step) {
        const y = profile(r, i, wxOf(r, x));
        if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = s.dark ? 0.5 : 0.55; ctx.strokeStyle = s.colors[r.c]; ctx.lineWidth = 1 + r.u * 1.2;
      ctx.stroke();
    }

    // ---- Barchans from above (layout 1) ----

    /** @param {boolean} edge enter from the upwind edge @returns {Barchan} */
    function barchan(edge) {
      const R = m * (0.04 + 0.05 * rng.random());
      return { x: edge ? (dir > 0 ? -R * 1.3 : s.W + R * 1.3) : rng.random() * s.W, y: rng.random() * s.H, R, c: rng.int(C) };
    }

    /** One crescent: the windward back, the shaded slip face inside the horns, the brink.
     * @param {Barchan} b */
    function drawBarchan(b) {
      const { ctx } = s, R = b.R;
      ctx.save();
      ctx.translate(b.x, b.y); ctx.scale(dir * R, R);
      ctx.beginPath();
      ctx.moveTo(1.5, -0.8);
      ctx.bezierCurveTo(0.6, -1.05, -0.9, -1, -1, 0);
      ctx.bezierCurveTo(-0.9, 1, 0.6, 1.05, 1.5, 0.8);
      ctx.bezierCurveTo(0.8, 0.6, 0.35, 0.45, 0.3, 0);
      ctx.bezierCurveTo(0.35, -0.45, 0.8, -0.6, 1.5, -0.8);
      // The windward back, lit toward its brink.
      const lit = ctx.createLinearGradient(-1, 0, 0.3, 0);
      lit.addColorStop(0, rgba(rgb[b.c], s.dark ? 0.2 : 0.24));
      lit.addColorStop(1, rgba(rgb[b.c], s.dark ? 0.42 : 0.46));
      ctx.fillStyle = lit; ctx.fill();
      ctx.globalAlpha = s.dark ? 0.4 : 0.45; ctx.lineWidth = 1 / R; ctx.strokeStyle = s.colors[b.c]; ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(0.95, -0.68);
      ctx.bezierCurveTo(0.2, -0.55, -0.1, -0.3, -0.1, 0);
      ctx.bezierCurveTo(-0.1, 0.3, 0.2, 0.55, 0.95, 0.68);
      ctx.bezierCurveTo(0.6, 0.5, 0.33, 0.35, 0.3, 0);
      ctx.bezierCurveTo(0.33, -0.35, 0.6, -0.5, 0.95, -0.68);
      ctx.fillStyle = shade; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0.95, -0.68);
      ctx.bezierCurveTo(0.2, -0.55, -0.1, -0.3, -0.1, 0);
      ctx.bezierCurveTo(-0.1, 0.3, 0.2, 0.55, 0.95, 0.68);
      ctx.globalAlpha = s.dark ? 0.65 : 0.7; ctx.lineWidth = 1.6 / R; ctx.stroke();
      ctx.restore();
    }

    // ---- Wind ripples (the floor of layout 1) ----

    /** Ripple crests across the wind, migrating downwind; about one in three runs only part way
     * and ends against its neighbours, as real ripples fork. @param {number} lam spacing @param {number} alpha */
    function drawRipples(lam, alpha) {
      const { ctx } = s, step = 10;
      const n = Math.ceil(s.W / lam) + 3, run = s.t * 2.5 * dir, laps = Math.floor(run / lam), drift = run - laps * lam;
      ctx.lineWidth = 1;
      for (let j = -2; j < n; j++) {
        const g = j - laps;   // the ripple's own index, so its wobble stays its own
        const ph = hash(g * 13 + salt) * TAU, ph2 = hash(g * 29 + salt) * TAU;
        const x0 = j * lam + drift;
        let y0 = -step, y1 = s.H + step;
        if (hash(g * 41 + salt) < 0.35) {
          y0 = s.H * (hash(g * 43 + salt) * 1.2 - 0.3);
          y1 = y0 + s.H * (0.25 + 0.45 * hash(g * 47 + salt));
        }
        ctx.beginPath();
        for (let y = y0; y <= y1; y += step) {
          const x = x0 + lam * 0.3 * Math.sin(y / (lam * 4.3) + ph) + lam * 0.14 * Math.sin(y / (lam * 1.7) + ph2);
          if (y === y0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.globalAlpha = alpha; ctx.strokeStyle = s.colors[(((Math.floor(g / 6)) % C) + C) % C];
        ctx.stroke();
      }
    }

    // ---- One great dune (layout 2), laid out with the wind toward +x and mirrored by dir ----

    let x0 = 0, foot = 0, cx = 0, cy = 0, slip = 0;
    /** Screen x of a wind-frame x. @param {number} X */
    const mx = (X) => dir > 0 ? X : s.W - X;
    /** The windward surface: steep low down, rounding over toward the brink. @param {number} X */
    const face = (X) => { const v = clamp((X - x0) / (cx - x0), 0, 1); return foot + (cy - foot) * (1 - Math.pow(1 - v, 1.7)); };

    function layGreat() {
      x0 = -0.05 * s.W; foot = s.H * 0.95;
      cx = s.W * 0.6; cy = clamp(s.H * 0.3, s.H * 0.18, s.H - m * 0.5);
      slip = Math.min(s.W * 0.34, (s.H - cy) * 0.6);
    }

    /** A dune's outline, windward face then slip face, closed below the bottom edge.
     * @param {(X:number) => number} f @param {number} a @param {number} c @param {number} y @param {number} sl */
    function outline(f, a, c, y, sl) {
      const { ctx } = s;
      ctx.beginPath();
      ctx.moveTo(mx(a), s.H + 10);
      for (let X = a; X < c; X += 8) ctx.lineTo(mx(X), f(X));
      ctx.lineTo(mx(c), y);
      ctx.lineTo(mx(c + sl), s.H + 10);
      ctx.closePath();
    }

    function drawGreat() {
      const { ctx } = s;
      // A paler dune behind, its brink up and to the upwind side.
      const fx0 = -0.3 * s.W, fcx = s.W * 0.24, fcy = cy + (s.H - cy) * 0.22, ffoot = s.H * 1.1;
      /** @param {number} X */
      const far = (X) => { const v = clamp((X - fx0) / (fcx - fx0), 0, 1); return ffoot + (fcy - ffoot) * (1 - Math.pow(1 - v, 1.7)); };
      outline(far, fx0, fcx, fcy, s.W * 0.4);
      ctx.globalAlpha = s.dark ? 0.16 : 0.2; ctx.fillStyle = s.colors[1 % C]; ctx.fill();
      ctx.globalAlpha = s.dark ? 0.35 : 0.4; ctx.strokeStyle = s.colors[1 % C]; ctx.lineWidth = 1.2; ctx.stroke();
      // The great dune, its slip face in shadow.
      outline(face, x0, cx, cy, slip);
      ctx.globalAlpha = s.dark ? 0.28 : 0.3; ctx.fillStyle = s.colors[0]; ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(mx(cx), cy); ctx.lineTo(mx(cx + slip), s.H + 10); ctx.lineTo(mx(cx - slip * 0.15), s.H + 10); ctx.closePath();
      ctx.globalAlpha = 1; ctx.fillStyle = shade; ctx.fill();
      // Ripples climbing the windward face toward the brink, each fading in low and out at the top.
      const K = clamp(Math.round((foot - cy) / (m * 0.028)), 8, 26);
      ctx.strokeStyle = s.colors[0]; ctx.lineWidth = 1.3;
      for (let j = 0; j < K; j++) {
        const d = (j / K + s.t * 0.008) % 1, depth = Math.pow(1 - d, 1.6);
        ctx.beginPath();
        for (let X = x0; X <= cx; X += 10) {
          // Parallel to the brink, lower by the ripple's depth down the face.
          const y = face(X) + depth * (foot - cy) * 1.15 + m * 0.006 * Math.sin(X / (m * 0.06) + j * 1.7);
          if (X === x0) ctx.moveTo(mx(X), y); else ctx.lineTo(mx(X), y);
        }
        ctx.globalAlpha = (s.dark ? 0.32 : 0.36) * Math.sin(Math.PI * d);
        ctx.stroke();
      }
      ctx.restore();
      // The brink.
      ctx.beginPath();
      for (let X = x0; X < cx; X += 8) { if (X === x0) ctx.moveTo(mx(X), face(X)); else ctx.lineTo(mx(X), face(X)); }
      ctx.lineTo(mx(cx), cy); ctx.lineTo(mx(cx + slip), s.H + 10);
      ctx.globalAlpha = s.dark ? 0.6 : 0.62; ctx.strokeStyle = s.colors[0]; ctx.lineWidth = 2; ctx.stroke();
    }

    // ---- Blowing sand ----

    /** @param {number} x @param {number} y @param {number} layer @param {number} speed */
    function spawn(x, y, layer, speed) {
      if (grains.length >= MAX_GRAINS) return;
      // The side view keeps grains in its wind frame, where the wind is always +x.
      grains.push({ x, y, vx: (layout === 0 ? 1 : dir) * speed * (0.6 + rng.random() * 0.8), vy: (rng.random() - 0.65) * speed * 0.18,
        life: 1.2 + rng.random() * 2, age: 0, layer });
    }

    /** @param {number} dt */
    function blow(dt) {
      if (layout === 0) {
        // Plumes off the brinks of the nearer ridges, in each ridge's own (wind-frame) x.
        ridges.forEach((r, i) => {
          if (r.u < 0.3) return;
          const vis = Math.ceil((s.W + r.L) / r.L);
          r.acc += dt * vis * (8 + 20 * r.u);
          const w0 = Math.min(wxOf(r, 0), wxOf(r, s.W));
          while (r.acc >= 1) {
            r.acc--;
            const a = crest(r, Math.floor(w0 / r.L) + rng.int(vis + 1), i);
            spawn(a[0], a[1] - 1, i, m * 0.07 * (0.5 + r.u));
          }
        });
      } else if (layout === 1) {
        acc += dt * barchans.length * 4;
        while (acc >= 1) {
          acc--;
          const b = barchans[rng.int(barchans.length)];
          const side = rng.random() < 0.5 ? -1 : 1, onHorn = rng.random() < 0.6;
          spawn(b.x + dir * b.R * (onHorn ? 1.45 : -0.1), b.y + side * b.R * (onHorn ? 0.8 : rng.random() * 0.5), 0, m * 0.11);
        }
      } else {
        // Off the top of the windward face, thickest at the brink.
        acc += dt * 80;
        while (acc >= 1) {
          acc--;
          const X = cx - (cx - x0) * 0.3 * Math.pow(rng.random(), 2);
          spawn(mx(X), face(X) - 1, 0, m * 0.12);
        }
      }
      for (const p of grains) {
        p.age += dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += (layout === 1 ? 0 : m * 0.012) * dt;
      }
      grains = grains.filter((p) => p.age < p.life);
    }

    /** The grains of one layer as short streaks, fading in and out. @param {number} layer @param {string} color */
    function drawGrains(layer, color) {
      const { ctx } = s;
      ctx.strokeStyle = color; ctx.lineCap = 'round';
      const r = layout === 0 ? ridges[layer] : null;
      for (let band = 0; band < 3; band++) {
        ctx.beginPath();
        for (const p of grains) {
          if (p.layer !== layer) continue;
          const f = Math.sin(Math.PI * p.age / p.life);
          if (Math.min(2, Math.floor(f * 3)) !== band) continue;
          const x = r ? sx(r, p.x) : p.x, vx = r ? dir * p.vx : p.vx;
          ctx.moveTo(x, p.y); ctx.lineTo(x - vx * 0.14, p.y - p.vy * 0.14);
        }
        ctx.globalAlpha = (s.dark ? 0.2 : 0.24) * (band + 1);
        ctx.lineWidth = layout === 0 ? 1 + (r ? r.u : 0) : 1.3;
        ctx.stroke();
      }
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        if (layout === 0) layRidges();
        if (layout === 2) layGreat();
        if (layout === 1) {
          const n = clamp(Math.round(s.W * s.H / 70000), 6, 20);
          while (barchans.length < n) barchans.push(barchan(false));
          barchans.length = n;
          for (const b of barchans) { b.x = Math.min(b.x, s.W); b.y = Math.min(b.y, s.H); }
        }
        if (!warmed) {
          // Run the wind a while, so plumes are already streaming on the first frame.
          warmed = true;
          for (let k = 0; k < 90; k++) blow(1 / 30);
        }
      },
      step(dt) {
        if (layout === 1) {
          for (const b of barchans) {
            // A small barchan outruns a big one, as real ones do.
            b.x += dir * m * 0.016 * (m * 0.06 / b.R) * dt;
            if ((dir > 0 && b.x > s.W + b.R * 1.3) || (dir < 0 && b.x < -b.R * 1.3)) Object.assign(b, barchan(true));
          }
        }
        blow(dt);
      },
      draw() {
        const { ctx } = s;
        if (layout === 0) {
          ridges.forEach((r, i) => { drawRidge(r, i); drawGrains(i, s.dark ? tint(rgb[r.c], 0.5) : s.colors[r.c]); });
        } else if (layout === 1) {
          drawRipples(clamp(m * 0.035, 12, 28), s.dark ? 0.12 : 0.15);
          for (const b of barchans) drawBarchan(b);
          drawGrains(0, s.dark ? tint(rgb[0], 0.5) : s.colors[0]);
        } else {
          drawGreat();
          drawGrains(0, s.dark ? tint(rgb[0], 0.6) : s.colors[0]);
        }
        ctx.globalAlpha = 1;
      },
    };
  });
}

/** A stable pseudo-random 0..1 from an integer. @param {number} i @returns {number} */
function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The colour taken `u` of the way to white. @param {number[]} c @param {number} u @returns {string} */
function tint(c, u) { return `rgb(${c.map((v) => Math.round(v + (255 - v) * u)).join(',')})`; }

/** @param {number[]} c @param {number} a @returns {string} */
function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`; }

/** Any CSS colour as [r, g, b], via a canvas's own parser. @param {string} color @returns {number[]} */
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
