// Smoke: soft wisps rise from their sources, straight at first, then curling and widening as
// the air takes them, and dissolve. Each wisp is a strand of points carried by a slowly moving
// flow, drawn as a faint wide halo round a thinner thread. The seed picks the variant:
// incense sticks along the bottom each trailing braided threads, broad bands of smoke streaming
// from the edges on a shifting wind, or smoke rings rising, widening and wobbling as they thin.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, c:number}} Source  where smoke starts, as fractions of the host */
/** @typedef {{src:number, ph:number, xs:Float32Array, ys:Float32Array, ages:Float32Array,
 *   head:number, n:number, emit:number}} Strand
 * One wisp: a ring buffer of its points, newest at head-1, n of them alive; emit counts down to
 * the next point. ph sets its own turn of the flow, so strands from one source braid apart. */
/** @typedef {{x:number, y:number, r:number, c:number, age:number, life:number, ph:number}} Ring */

const EVERY = 0.05;   // seconds between a strand's points

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const g = s.ctx;
    /** @type {Source[]} */
    let sources = [];
    /** @type {CanvasGradient[]} */
    let grads = [];
    const rgb = s.colors.map(rgbOf);
    /** @type {Strand[]} */
    let strands = [];
    /** @type {Ring[]} */
    const rings = [];
    /** @type {number[]} seconds to each source's next ring */
    let ringDue = [];
    let sc = 1, clock = 0, W0 = 0, H0 = 0;
    let rise = 40;   // px/s a wisp leaves its source at: the smoke gets most of the way up the host
    const life = layout === 1 ? 16 : layout === 2 ? 7 : 12;
    const cap = Math.ceil(life / EVERY) + 2;
    const A = s.dark ? 0.32 : 0.38;
    const ph = Array.from({ length: 4 }, () => rng.random() * TAU);
    const tip = glow(s.colors[0], 0.2);
    const puffs = layout === 1 ? s.colors.map((c) => glow(c, 0)) : [];

    /** @param {number} src @param {number} k @returns {Strand} */
    const strand = (src, k) => ({ src, ph: k * (layout === 1 ? 2.1 : 0.9) + rng.random() * 0.5, xs: new Float32Array(cap),
      ys: new Float32Array(cap), ages: new Float32Array(cap), head: 0, n: 0, emit: rng.random() * EVERY });

    /** Places the sources and their strands for this variant. @returns {void} */
    function place() {
      sources = []; strands = [];
      if (layout === 1) {
        // Along the left edge and the bottom, so the wind carries smoke across the whole host.
        const n = clamp(Math.round((s.W + s.H) / 420), 3, 7);
        for (let i = 0; i < n; i++) {
          const u = (i + 0.3 + rng.random() * 0.4) / n;
          const onLeft = u < s.H / (s.W + s.H);
          sources.push(onLeft ? { x: -0.02, y: 1 - u * (s.W + s.H) / s.H * 0.9, c: i % s.colors.length }
            : { x: (u * (s.W + s.H) - s.H) / s.W * 0.75, y: 1.02, c: i % s.colors.length });
          strands.push(strand(i, 0));
        }
        return;
      }
      const n = layout === 2 ? clamp(Math.round(s.W / 450), 2, 4) : clamp(Math.round(s.W / 330), 2, 5);
      for (let i = 0; i < n; i++) {
        sources.push({ x: (i + 0.5 + (rng.random() - 0.5) * 0.4) / n, y: layout === 2 ? 1.01 : 0.86 + rng.random() * 0.08,
          c: i % s.colors.length });
        strands.push(strand(i, 0));
        if (layout === 0) strands.push(strand(i, 1));
      }
      ringDue = sources.map(() => rng.random() * 3);
    }

    let vx = 0, vy = 0;
    /** The air's push at a point, px/s, into vx, vy: a wind plus a turn that grows as the
     * point ages, so a wisp leaves its source straight and curls higher up.
     * @param {number} x @param {number} y @param {number} age @param {number} p @returns {void} */
    function flow(x, y, age, p) {
      const t = clock, k = Math.min(1, age / (layout === 1 ? 3 : 2));
      const turb = k * k * (layout === 1 ? 30 : 22) * sc;
      if (layout === 1) {
        const gust = 0.75 + 0.25 * Math.sin(t * 0.07 + ph[0]);
        vx = 52 * sc * gust;
        vy = -20 * sc + turb * (Math.sin(x * 0.009 / sc - t * 0.5 + p) + 0.6 * Math.sin(x * 0.023 / sc + y * 0.006 / sc + t * 0.7 + p * 1.7));
        return;
      }
      vx = 6 * sc * Math.sin(t * 0.05 + ph[1])
        + turb * (Math.sin(y * 0.011 / sc + t * 0.55 + p) + 0.7 * Math.sin(y * 0.029 / sc - t * 0.8 + x * 0.013 / sc + p * 2.3));
      vy = -rise * (1 - 0.35 * Math.min(1, age / life));
    }

    /** @param {number} dt @returns {void} */
    function advance(dt) {
      clock += dt;
      for (const st of strands) {
        const { xs, ys, ages } = st;
        for (let j = 0; j < st.n; j++) {
          const i = (st.head - 1 - j + cap) % cap;
          ages[i] += dt;
          flow(xs[i], ys[i], ages[i], st.ph);
          xs[i] += vx * dt; ys[i] += vy * dt;
        }
        // Points past their life drop off the old end.
        while (st.n && ages[(st.head - st.n + cap) % cap] > life) st.n--;
        st.emit -= dt;
        while (st.emit <= 0) {
          st.emit += EVERY;
          const src = sources[st.src];
          xs[st.head] = src.x * s.W; ys[st.head] = src.y * s.H; ages[st.head] = 0;
          st.head = (st.head + 1) % cap; st.n = Math.min(cap, st.n + 1);
        }
      }
      if (layout !== 2) return;
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.age += dt;
        r.y -= s.H * 0.055 * (1 - 0.5 * r.age / r.life) * dt;
        r.x += 5 * sc * Math.sin(clock * 0.4 + r.ph) * dt;
        if (r.age > r.life) rings.splice(i, 1);
      }
      for (let k = 0; k < sources.length; k++) {
        ringDue[k] -= dt;
        if (ringDue[k] > 0) continue;
        ringDue[k] = 2.6 + rng.random() * 2;
        const src = sources[k];
        rings.push({ x: src.x * s.W, y: src.y * s.H - 10 * sc, r: (18 + rng.random() * 10) * sc, c: src.c,
          age: 0, life: 13 + rng.random() * 3, ph: rng.random() * TAU });
      }
    }

    /** Each source's stroke: its colour fading out along the way its smoke goes, as far as the
     * smoke gets in its life, which stands in for the age of each point. @returns {void} */
    function shade() {
      grads = sources.map((src) => {
        const x = src.x * s.W, y = src.y * s.H;
        const dx = layout === 1 ? 52 * 0.75 * life * sc : 0;
        const dy = -(layout === 1 ? 20 * sc : rise) * life * 0.82;
        const gr = g.createLinearGradient(x, y, x + dx, y + dy);
        const [r, gg, b] = rgb[src.c];
        for (let k = 0; k <= 8; k++) {
          const u = k / 8, a = Math.min(1, u / 0.06) * Math.pow(1 - u, 1.4);
          gr.addColorStop(u, `rgba(${r},${gg},${b},${a.toFixed(3)})`);
        }
        return gr;
      });
    }

    /** A band of wind-blown smoke: soft puffs along the strand, growing and thinning with age.
     * @param {Strand} st @returns {void} */
    function drawPuffs(st) {
      const { xs, ys, ages } = st, spr = puffs[sources[st.src].c];
      for (let q = 2; q < st.n; q += 9) {
        const i = (st.head - 1 - q + cap) % cap, age = ages[i], u = age / life;
        g.globalAlpha = A * (s.dark ? 0.28 : 0.4) * Math.pow(1 - u, 1.4) * Math.min(1, age / 1.2);
        const d = (6 + age * 4.2) * sc;
        g.drawImage(spr, xs[i] - d, ys[i] - d, d * 2, d * 2);
      }
    }

    /** A strand in runs, each wider than the last: a wide faint halo, then the thread.
     * @param {Strand} st @returns {void} */
    function drawStrand(st) {
      const { xs, ys } = st, RUNS = 8, per = Math.ceil(st.n / RUNS);
      g.strokeStyle = grads[st.src];
      const thick = layout === 1 ? 2.4 : 1, core = layout === 1 ? 0.45 : 1;
      for (let pass = 0; pass < 2; pass++) {
        for (let r = 0; r < RUNS; r++) {
          const j0 = r * per, j1 = Math.min(st.n - 1, j0 + per);
          if (j1 <= j0) break;
          const w = (1.2 + (j0 + j1) / 2 * EVERY * (layout === 1 ? 1.6 : 1.1)) * sc * thick;
          g.globalAlpha = A * (layout === 1 ? 0.7 : 1) * (pass ? core : 0.25);
          g.lineWidth = pass ? w : w * 3;
          // Every fourth point: these lie close together, and each vertex costs.
          g.beginPath();
          for (let q = j0; q <= j1; q = q === j1 ? j1 + 1 : Math.min(j1, q + 4)) {
            const i = (st.head - 1 - q + cap) % cap;
            if (q === j0) g.moveTo(xs[i], ys[i]); else g.lineTo(xs[i], ys[i]);
          }
          g.stroke();
        }
      }
    }

    return {
      lay() {
        sc = clamp(Math.min(s.W, s.H) / 700, 0.6, 1.5);
        rise = s.H * (layout === 2 ? 0.04 : 0.064);
        if (W0) {
          // A new size: the smoke stays where it was, in proportion.
          const fx = s.W / W0, fy = s.H / H0;
          for (const st of strands) for (let i = 0; i < cap; i++) { st.xs[i] *= fx; st.ys[i] *= fy; }
          for (const r of rings) { r.x *= fx; r.y *= fy; }
        } else {
          place();
          // Let the smoke rise a while first, so the page starts full of it.
          for (let i = 0; i < life * 15; i++) advance(1 / 15);
        }
        W0 = s.W; H0 = s.H;
        shade();
      },
      step(dt) { advance(dt); },
      draw() {
        g.globalCompositeOperation = s.dark ? 'lighter' : 'source-over';
        // Butt ends: runs of a strand meet without beading where they overlap.
        g.lineCap = 'butt'; g.lineJoin = 'round';
        for (const st of strands) if (layout === 1) drawPuffs(st); else drawStrand(st);
        for (const r of rings) {
          // A ring widens and thickens as it rises, its width wobbling, its lower front brighter.
          const u = r.age / r.life;
          const a = A * 1.1 * Math.pow(1 - u, 1.3) * Math.min(1, r.age / 0.8);
          const rx = r.r * (1 + r.age * 0.32) * (1 + 0.06 * Math.sin(r.age * 1.7 + r.ph));
          const ry = rx * (0.3 + 0.04 * Math.sin(r.age * 1.3 + r.ph * 2));
          const w = (3 + r.age * 1.1) * sc, tilt = 0.12 * Math.sin(r.age * 0.6 + r.ph);
          g.strokeStyle = s.colors[r.c];
          g.beginPath(); g.ellipse(r.x, r.y, rx, ry, tilt, 0, TAU);
          g.globalAlpha = a * 0.22; g.lineWidth = w * 3.5; g.stroke();
          g.globalAlpha = a * 0.7; g.lineWidth = w; g.stroke();
          g.beginPath(); g.ellipse(r.x, r.y, rx, ry, tilt, 0.25, Math.PI - 0.25);
          g.globalAlpha = a * 0.5; g.lineWidth = w * 0.6; g.stroke();
        }
        const { ctx } = s;
        ctx.globalCompositeOperation = 'source-over';
        if (layout !== 0) return;
        // The incense sticks, each with its tip glowing on a slow breath.
        ctx.lineCap = 'round';
        for (let i = 0; i < sources.length; i++) {
          const src = sources[i], x = src.x * s.W, y = src.y * s.H;
          ctx.strokeStyle = s.ink; ctx.globalAlpha = s.dark ? 0.3 : 0.38; ctx.lineWidth = 2.2 * sc;
          ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x + (s.H - y) * 0.08 * (i % 2 ? 1 : -1), s.H + 4); ctx.stroke();
          const beat = 0.5 + 0.5 * Math.sin(clock * 0.8 + i * 1.9);
          ctx.globalAlpha = (s.dark ? 0.35 : 0.3) + 0.25 * beat;
          const d = (9 + 3 * beat) * sc;
          ctx.drawImage(tip, x - d, y - d, d * 2, d * 2);
        }
      },
    };
  });
}

/** A round glow as a sprite: a bright core out to `core` of the radius (an ember), or none (a
 * puff of smoke). @param {string} color @param {number} core @returns {HTMLCanvasElement} */
function glow(color, core) {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 48, 48);
  const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  if (core) grad.addColorStop(core, 'rgba(0,0,0,.9)');
  grad.addColorStop(0.55, core ? 'rgba(0,0,0,.2)' : 'rgba(0,0,0,.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 48, 48);
  return c;
}

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
