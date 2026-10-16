// Koi pond: drawn koi glide in slow curves under drifting lily pads, their bodies bending as they
// turn, and rings spread on the water where one comes up. The seed picks the variant: koi roam
// the whole pond at will, koi circle the pond round a cluster of pads in the middle, or feeding,
// where crumbs land with a ring now and then and the nearest koi turn and rise to take them.

import { stage, TAU, clamp, mix } from './stage.js';

const SEGS = 10;   // spine points per fish

/** @typedef {{xs:Float32Array, ys:Float32Array, a:number, want:number, v:number, len:number,
 *   z:number, rise:number, c:number, spot:number, ph:number, dir:number}} Koi
 * xs, ys the spine head first; z depth 0 deep .. 1 at the surface; rise > 0 while coming up. */
/** @typedef {{x:number, y:number, r:number, a:number, spin:number, notch:number, bloom:boolean}} Pad */
/** @typedef {{x:number, y:number, age:number, size:number}} Ring */
/** @typedef {{x:number, y:number, age:number}} Crumb */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout, colors } = s;
    /** @type {Koi[]} */
    const fish = [];
    /** @type {Pad[]} */
    const pads = [];
    /** @type {Ring[]} */
    const rings = [];
    /** @type {Crumb[]} */
    const crumbs = [];
    const padColor = colors[colors.length - 1];
    let m = 0, oldW = 0, oldH = 0, nextCrumb = 3, warm = true;

    /** @param {number} x @param {number} y @returns {Koi} */
    function koi(x, y) {
      const len = clamp(m * 0.16, 46, 120) * (0.75 + rng.random() * 0.45);
      const a = rng.random() * TAU;
      const xs = new Float32Array(SEGS), ys = new Float32Array(SEGS);
      for (let i = 0; i < SEGS; i++) { xs[i] = x - Math.cos(a) * i * len / SEGS; ys[i] = y - Math.sin(a) * i * len / SEGS; }
      const c = rng.int(colors.length);
      return { xs, ys, a, want: a, v: len * (0.35 + rng.random() * 0.2), len, z: rng.random() * 0.6,
        rise: 0, c, spot: (c + 1 + rng.int(Math.max(1, colors.length - 1))) % colors.length,
        ph: rng.random() * TAU, dir: rng.random() < 0.5 ? -1 : 1 };
    }

    /** @param {number} x @param {number} y @param {number} size */
    function ring(x, y, size) { rings.push({ x, y, age: 0, size }); }

    /** Turns `f` toward heading `to` at most `rate` rad/s. @param {Koi} f @param {number} to @param {number} rate @param {number} dt */
    function steer(f, to, rate, dt) {
      let d = to - f.a;
      d -= Math.round(d / TAU) * TAU;
      f.a += clamp(d, -rate * dt, rate * dt);
    }

    /** @param {number} dt */
    function advance(dt) {
      const cx = s.W / 2, cy = s.H / 2, edge = m * 0.12;
      for (const f of fish) {
        // Where it wants to go: wander, circle the middle, or head for a crumb.
        f.want += (rng.random() - 0.5) * 1.6 * dt;
        let to = f.want;
        if (layout === 1) {
          const ang = Math.atan2(f.ys[0] - cy, (f.xs[0] - cx) * s.H / s.W);
          const rad = Math.hypot((f.xs[0] - cx) / (s.W / 2), (f.ys[0] - cy) / (s.H / 2));
          // Tangent, nudged in or out toward a band 55-80% of the way to the edge.
          to = ang + f.dir * (Math.PI / 2 + clamp((rad - 0.68) * 2.2, -0.6, 0.6)) + Math.sin(s.t * 0.3 + f.ph) * 0.25;
        } else if (layout === 2 && crumbs.length) {
          let best = null, bd = m * 0.6;
          for (const c of crumbs) { const d = Math.hypot(c.x - f.xs[0], c.y - f.ys[0]); if (d < bd) { bd = d; best = c; } }
          if (best) {
            to = Math.atan2(best.y - f.ys[0], best.x - f.xs[0]);
            if (bd < f.len * 0.6) f.rise = Math.max(f.rise, 0.01);
            if (bd < f.len * 0.15) { crumbs.splice(crumbs.indexOf(best), 1); ring(best.x, best.y, 1); }
          }
        }
        const x = f.xs[0], y = f.ys[0];
        if (x < edge || x > s.W - edge || y < edge || y > s.H - edge) {
          to = Math.atan2(cy - y, cx - x);
          f.want = to;
        }
        steer(f, to, 1.1, dt);
        // A gentle side to side in the head drives the swimming curve down the body.
        const sway = Math.sin(s.t * 2.2 + f.ph) * 0.35;
        f.xs[0] += Math.cos(f.a + sway) * f.v * dt;
        f.ys[0] += Math.sin(f.a + sway) * f.v * dt;
        const seg = f.len / SEGS;
        for (let i = 1; i < SEGS; i++) {
          const dx = f.xs[i] - f.xs[i - 1], dy = f.ys[i] - f.ys[i - 1], d = Math.hypot(dx, dy) || 1;
          f.xs[i] = f.xs[i - 1] + dx / d * seg; f.ys[i] = f.ys[i - 1] + dy / d * seg;
        }
        // Coming up: rise to the surface, ring at the head, then sink back.
        if (f.rise > 0) {
          f.rise += dt / 5;
          f.z = Math.sin(Math.min(1, f.rise) * Math.PI);
          if (f.rise >= 0.5 && f.rise - dt / 5 < 0.5) ring(f.xs[0], f.ys[0], f.len / 90);
          if (f.rise >= 1) { f.rise = 0; f.z = 0; }
        } else if (layout !== 2 && rng.random() < dt / 14) f.rise = 0.01;
        else f.z = mix(f.z, 0.25 + 0.2 * Math.sin(s.t * 0.2 + f.ph), dt * 0.5);
      }
      for (const p of pads) {
        p.a += p.spin * dt;
        p.x += Math.sin(s.t * 0.05 + p.spin * 40) * 2 * dt;
        p.y += Math.cos(s.t * 0.04 + p.spin * 30) * 2 * dt;
      }
      for (const r of rings) r.age += dt;
      while (rings.length && rings[0].age > 4) rings.shift();
      if (layout === 2) {
        for (const c of crumbs) c.age += dt;
        while (crumbs.length && crumbs[0].age > 14) crumbs.shift();
        nextCrumb -= dt;
        if (nextCrumb <= 0) {
          nextCrumb = 4 + rng.random() * 4;
          const c = { x: mix(0.15, 0.85, rng.random()) * s.W, y: mix(0.15, 0.85, rng.random()) * s.H, age: 0 };
          crumbs.push(c);
          ring(c.x, c.y, 0.6);
        }
      }
    }

    /** @param {Koi} f */
    function drawKoi(f) {
      const { ctx } = s;
      const { xs, ys, len } = f;
      const k = 0.85 + f.z * 0.25, wMax = len * 0.13 * k;
      ctx.globalAlpha = (s.dark ? 0.26 : 0.3) + f.z * (s.dark ? 0.28 : 0.3);
      ctx.fillStyle = colors[f.c];
      // Pectoral fins at the third spine point, flapping slowly.
      const nx = -(ys[1] - ys[3]) / (len * 2 / SEGS), ny = (xs[1] - xs[3]) / (len * 2 / SEGS);
      const ba = Math.atan2(ys[2] - ys[3], xs[2] - xs[3]);
      const flap = Math.sin(s.t * 1.6 + f.ph) * 0.25;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(xs[2] + nx * side * wMax * 1.2, ys[2] + ny * side * wMax * 1.2, wMax * 0.9, wMax * 0.38,
          ba + side * (2.4 + flap), 0, TAU);
        ctx.fill();
      }
      // Body: outline either side of the spine, widest behind the head.
      ctx.beginPath();
      /** @type {number[]} */
      const L = [], R = [];
      for (let i = 0; i < SEGS; i++) {
        const j = Math.min(i + 1, SEGS - 1), h = Math.max(i - 1, 0);
        const dx = xs[h] - xs[j], dy = ys[h] - ys[j], d = Math.hypot(dx, dy) || 1;
        const u = i / (SEGS - 1);
        const w = wMax * (u < 0.22 ? 0.55 + 0.45 * Math.sin(u / 0.22 * Math.PI / 2) : 1 - 0.85 * Math.pow((u - 0.22) / 0.78, 1.3));
        L.push(xs[i] - dy / d * w, ys[i] + dx / d * w);
        R.push(xs[i] + dy / d * w, ys[i] - dx / d * w);
      }
      const hx = xs[0] + (xs[0] - xs[1]) * 0.9, hy = ys[0] + (ys[0] - ys[1]) * 0.9;
      ctx.moveTo(L[0], L[1]);
      for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
      for (let i = R.length - 2; i >= 0; i -= 2) ctx.lineTo(R[i], R[i + 1]);
      ctx.quadraticCurveTo(hx, hy, L[0], L[1]);
      ctx.fill();
      // Tail: two soft lobes splayed out behind the last point.
      const e = SEGS - 1, ta = Math.atan2(ys[e] - ys[e - 2], xs[e] - xs[e - 2]);
      const tl = len * 0.24 * k, tw = Math.sin(s.t * 2.2 + f.ph - 1.8) * 0.3;
      ctx.beginPath();
      ctx.moveTo(xs[e - 1], ys[e - 1]);
      ctx.quadraticCurveTo(xs[e] + Math.cos(ta + 0.9 + tw) * tl * 0.5, ys[e] + Math.sin(ta + 0.9 + tw) * tl * 0.5,
        xs[e] + Math.cos(ta + 0.45 + tw) * tl, ys[e] + Math.sin(ta + 0.45 + tw) * tl);
      ctx.lineTo(xs[e] + Math.cos(ta + tw) * tl * 0.45, ys[e] + Math.sin(ta + tw) * tl * 0.45);
      ctx.lineTo(xs[e] + Math.cos(ta - 0.45 + tw) * tl, ys[e] + Math.sin(ta - 0.45 + tw) * tl);
      ctx.quadraticCurveTo(xs[e] + Math.cos(ta - 0.9 + tw) * tl * 0.5, ys[e] + Math.sin(ta - 0.9 + tw) * tl * 0.5,
        xs[e - 1], ys[e - 1]);
      ctx.fill();
      // Koi markings: two patches of a second colour along the back.
      ctx.fillStyle = colors[f.spot];
      ctx.globalAlpha *= 0.9;
      for (const [i, r] of [[1.4, 0.62], [4.2, 0.5]]) {
        const a = Math.floor(i), u = i - a;
        const px = mix(xs[a], xs[a + 1], u), py = mix(ys[a], ys[a + 1], u);
        ctx.beginPath();
        ctx.ellipse(px, py, wMax * r * 1.5, wMax * r, Math.atan2(ys[a] - ys[a + 1], xs[a] - xs[a + 1]), 0, TAU);
        ctx.fill();
      }
    }

    /** @param {Pad} p */
    function drawPad(p) {
      const { ctx } = s;
      ctx.globalAlpha = s.dark ? 0.26 : 0.32;
      ctx.fillStyle = padColor;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, p.r, p.a + p.notch, p.a + TAU - p.notch);
      ctx.closePath();
      ctx.fill();
      // Veins from the notch.
      ctx.globalAlpha = s.dark ? 0.3 : 0.38;
      ctx.strokeStyle = padColor;
      ctx.lineWidth = Math.max(1, p.r * 0.035);
      ctx.beginPath();
      for (let v = 1; v < 7; v++) {
        const a = p.a + p.notch + (TAU - 2 * p.notch) * v / 7;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * p.r * 0.82, p.y + Math.sin(a) * p.r * 0.82);
      }
      ctx.stroke();
      if (p.bloom) {
        // A lotus flower: two rings of petals.
        ctx.globalAlpha = s.dark ? 0.45 : 0.5;
        for (const [n, rr, col] of /** @type {[number, number, string][]} */ ([[8, 0.42, colors[3 % colors.length]], [6, 0.26, colors[1 % colors.length]]])) {
          ctx.fillStyle = col;
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const a = p.a * 2 + i * TAU / n;
            ctx.ellipse(p.x + Math.cos(a) * p.r * rr * 0.55, p.y + Math.sin(a) * p.r * rr * 0.55, p.r * rr * 0.6, p.r * rr * 0.24, a, 0, TAU);
          }
          ctx.fill();
        }
      }
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        // Keep the pond's contents where they were, scaled to the new size.
        if (oldW) {
          const fx = s.W / oldW, fy = s.H / oldH;
          for (const f of fish) for (let i = 0; i < SEGS; i++) { f.xs[i] *= fx; f.ys[i] *= fy; }
          for (const p of pads) { p.x *= fx; p.y *= fy; }
        }
        oldW = s.W; oldH = s.H;
        const nf = clamp(Math.round(s.W * s.H / 70000), 6, 12);
        while (fish.length < nf) fish.push(koi(mix(0.15, 0.85, rng.random()) * s.W, mix(0.15, 0.85, rng.random()) * s.H));
        fish.length = nf;
        const np = clamp(Math.round(s.W * s.H / 100000), 4, 10);
        const pr = clamp(m * 0.075, 22, 70);
        pads.length = 0;
        // Free pads on a jittered grid, so none of the pond is left bare.
        const cols = Math.max(1, Math.round(Math.sqrt(np * s.W / s.H))), rows = Math.ceil(np / cols);
        for (let i = 0; i < np; i++) {
          let x, y;
          if (layout === 1 && i < Math.ceil(np / 2)) {
            // A cluster in the middle for the koi to circle.
            const a = i * TAU / Math.ceil(np / 2) + rng.random() * 0.6;
            x = s.W / 2 + Math.cos(a) * m * 0.12 * (i ? 1 : 0); y = s.H / 2 + Math.sin(a) * m * 0.12 * (i ? 1 : 0);
          } else {
            const c = i;
            x = mix(0.05, 0.95, (c % cols + 0.2 + rng.random() * 0.6) / cols) * s.W;
            y = mix(0.05, 0.95, (Math.floor(c / cols) + 0.2 + rng.random() * 0.6) / rows) * s.H;
          }
          pads.push({ x, y, r: pr * (0.6 + rng.random() * 0.7), a: rng.random() * TAU, spin: (rng.random() - 0.5) * 0.04,
            notch: 0.16 + rng.random() * 0.1, bloom: i % 4 === 1 });
        }
        if (warm) {
          // Give a still frame bodies already bent mid-swim, and a ring or two on the water.
          warm = false;
          for (let i = 0; i < 90; i++) { advance(1 / 30); s.t += 1 / 30; }
          for (let i = 0; i < 2; i++) rings.push({ x: mix(0.2, 0.8, rng.random()) * s.W, y: mix(0.2, 0.8, rng.random()) * s.H, age: 0.6 + i * 1.3, size: 0.8 });
          if (layout === 2 && !crumbs.length) crumbs.push({ x: s.W * 0.4, y: s.H * 0.6, age: 0 });
        }
      },
      step: advance,
      draw() {
        const { ctx } = s;
        const order = fish.slice().sort((a, b) => a.z - b.z);
        for (const f of order) drawKoi(f);
        for (const p of pads) drawPad(p);
        // Crumbs: small floating dots.
        ctx.fillStyle = colors[1 % colors.length];
        ctx.globalAlpha = s.dark ? 0.55 : 0.6;
        for (const c of crumbs) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, Math.max(2, m * 0.006), 0, TAU);
          ctx.fill();
        }
        // Rings: two circles spreading and thinning out over four seconds.
        ctx.strokeStyle = s.dark ? colors[2 % colors.length] : s.ink;
        for (const r of rings) {
          const u = r.age / 4;
          for (const lag of [0, 0.18]) {
            const v = u - lag;
            if (v <= 0) continue;
            ctx.globalAlpha = (1 - v) * (s.dark ? 0.4 : 0.42);
            ctx.lineWidth = Math.max(1, 2.2 * (1 - v));
            ctx.beginPath();
            ctx.arc(r.x, r.y, (6 + v * m * 0.14) * r.size, 0, TAU);
            ctx.stroke();
          }
        }
      },
    };
  });
}
