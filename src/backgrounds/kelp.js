// Kelp forest: tall drawn kelp fronds rise from the floor, each stalk swaying in a wave that runs
// up it, blades fluttering off both sides; small fish silhouettes weave between the front and back
// stalks. The seed picks the variant: a forest swaying back and forth in the swell, schools of fish
// crossing both ways; a steady current, fronds streaming downstream and fish holding against it in
// drifting specks; or a deep forest in three layers of depth, drifting past slowly in parallax.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{fx:number, h:number, n:number, c:number, ph:number, z:number, w:number}} Frond */
/** @typedef {{x:number, y:number, dir:number, v:number, size:number, ph:number, f:number, c:number, back:boolean}} Fish */
/** @typedef {{x:number, y:number, r:number, v:number}} Speck */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { layout, rng } = s;
    /** @type {Frond[]} */
    let fronds = [];
    /** @type {Fish[]} */
    const fish = [];
    /** @type {Speck[]} */
    const specks = [];
    let cam = 0;          // parallax: px the near layer has drifted
    const fishColor = s.colors[s.colors.length > 2 ? 2 : 0];
    const kelpColors = s.colors.slice(0, Math.min(2, s.colors.length));

    /** A frond. @param {number} fx root as a fraction of the width (or of the strip) @param {number} z depth 0..1, 1 near @returns {Frond} */
    function frond(fx, z) {
      return { fx, z, h: (0.5 + rng.random() * 0.48) * (layout === 2 ? 0.6 + 0.4 * z : 1), n: 14 + rng.int(5),
        c: rng.int(kelpColors.length), ph: rng.random() * TAU, w: 0.8 + rng.random() * 0.4 };
    }

    /** A fish, at x or off one side. @param {boolean} enter @returns {Fish} */
    function newFish(enter) {
      const m = Math.min(s.W, s.H);
      const dir = layout === 1 ? -1 : rng.random() < 0.5 ? -1 : 1;
      const size = clamp(m / 48, 7, 17) * (0.75 + rng.random() * 0.5);
      return { x: enter ? (dir > 0 ? -size * 2 : s.W + size * 2) : rng.random() * s.W, y: s.H * (0.12 + rng.random() * 0.7),
        dir, v: layout === 1 ? 4 + rng.random() * 8 : 16 + rng.random() * 14, size, ph: rng.random() * TAU,
        f: 0.15 + rng.random() * 0.2, c: 0, back: rng.random() < 0.45 };
    }

    /** Adds a school of k fish swimming together. @param {boolean} enter @returns {void} */
    function school(enter) {
      const lead = newFish(enter), k = layout === 0 ? 4 + rng.int(5) : 1;
      fish.push(lead);
      for (let i = 1; i < k; i++) {
        fish.push({ ...lead, x: lead.x - lead.dir * (i * lead.size * 2.2 + rng.random() * lead.size * 2),
          y: lead.y + (rng.random() - 0.5) * lead.size * 6, ph: rng.random() * TAU, size: lead.size * (0.8 + rng.random() * 0.35), back: rng.random() < 0.45 });
      }
    }

    /** Strip width for the parallax layers: wider than the host so wrapping is never seen. */
    const strip = () => s.W + 200;

    /**
     * Draws one frond: the stalk as a stroke, blades and floats as one fill.
     * @param {Frond} f @param {number} x0 root x @param {number} scale @param {number} alpha @returns {void}
     */
    function drawFrond(f, x0, scale, alpha) {
      const { ctx } = s, t = s.t, m = Math.min(s.W, s.H);
      const len = f.h * s.H * 1.02, seg = len / f.n;
      const lw = clamp(m / 260, 1.5, 3.6) * f.w * scale;
      let x = x0, y = s.H + 4, a = -Math.PI / 2;
      const color = kelpColors[f.c];
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.lineWidth = lw;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      // Floor: a small holdfast mound.
      ctx.ellipse(x0, s.H + 2, lw * 4, lw * 2.4, 0, Math.PI, TAU);
      ctx.fill();
      const pts = [];
      for (let j = 0; j <= f.n; j++) {
        pts.push(x, y);
        const u = (j + 1) / f.n;
        let bend;
        if (layout === 1) {
          // Streaming downstream, with a flutter running up the stalk and slow gusts.
          bend = 0.12 * u + 0.05 * Math.sin(t * 1.1 - j * 0.6 + f.ph) * u + 0.03 * Math.sin(t * 0.21 + f.ph);
        } else if (layout === 0) {
          // The swell: the whole forest leans one way then the other, the wave a little behind
          // further along, and a ripple running up each stalk.
          bend = (0.06 * Math.sin(t * 0.42 - x0 * 0.0016) + 0.035 * Math.sin(t * 0.9 - j * 0.45 + f.ph)) * (0.4 + u);
        } else {
          bend = (0.045 * Math.sin(t * 0.35 - x0 * 0.002 + f.ph * 0.3) + 0.03 * Math.sin(t * 0.8 - j * 0.4 + f.ph)) * (0.4 + u);
        }
        a = clamp(a + bend * 0.5, -Math.PI / 2 - 1.3, -Math.PI / 2 + 1.4);
        x += Math.cos(a) * seg; y += Math.sin(a) * seg;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke();
      // Blades alternate sides from the third joint up, each with a gas float at its base.
      ctx.beginPath();
      for (let j = 2; j <= f.n; j++) {
        const px = pts[j * 2], py = pts[j * 2 + 1], qx = pts[j * 2 - 2], qy = pts[j * 2 - 1];
        const stem = Math.atan2(py - qy, px - qx), side = j % 2 ? 1 : -1;
        const bl = Math.min(seg, m * 0.065 * scale) * (1.4 + 0.35 * Math.sin(j * 1.7 + f.ph)) * (j === f.n ? 1.3 : 1), bw = bl * 0.27;
        const flow = layout === 1 ? 0.35 : 0;
        const ang = stem + side * (0.55 + 0.12 * Math.sin(t * 1.3 + j + f.ph)) + flow * (side > 0 ? 0.6 : 1.4) * 0.5;
        const ux = Math.cos(ang), uy = Math.sin(ang), tx = px + ux * bl, ty = py + uy * bl;
        const mx = px + ux * bl * 0.45, my = py + uy * bl * 0.45;
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(mx - uy * bw, my + ux * bw, tx, ty);
        ctx.quadraticCurveTo(mx + uy * bw, my - ux * bw, px, py);
        const r = lw * 0.9;
        ctx.moveTo(px + ux * r * 1.2 + r, py + uy * r * 1.2);
        ctx.arc(px + ux * r * 1.2, py + uy * r * 1.2, r, 0, TAU);
      }
      ctx.fill();
    }

    /** Fish silhouettes, one fill. @param {boolean} back which pass @param {number} alpha @returns {void} */
    function drawFish(back, alpha) {
      const { ctx } = s;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fishColor;
      ctx.beginPath();
      for (const f of fish) {
        if (f.back !== back) continue;
        const d = f.dir, z = f.size, y = f.y + Math.sin(s.t * f.f * TAU + f.ph) * z * 1.6;
        const wag = Math.sin(s.t * 5 + f.ph) * z * 0.12, x = f.x;
        ctx.moveTo(x + d * z, y);
        ctx.quadraticCurveTo(x + d * z * 0.1, y - z * 0.48, x - d * z * 0.6, y + wag * 0.3);
        ctx.quadraticCurveTo(x + d * z * 0.1, y + z * 0.42, x + d * z, y);
        ctx.moveTo(x - d * z * 0.5, y + wag * 0.3);
        ctx.lineTo(x - d * z * 1.05, y - z * 0.36 + wag);
        ctx.lineTo(x - d * z * 0.95, y + wag);
        ctx.lineTo(x - d * z * 1.05, y + z * 0.36 + wag);
        ctx.closePath();
      }
      ctx.fill();
    }

    return {
      lay() {
        if (!fronds.length) {
          if (layout === 2) {
            // Three depths, spread over a strip wider than the host.
            for (const [z, per] of [[0, 75], [0.5, 105], [1, 150]]) {
              const k = clamp(Math.round(strip() / per), 5, 40);
              for (let i = 0; i < k; i++) fronds.push(frond((i + 0.2 + rng.random() * 0.6) / k, z));
            }
          } else {
            // Clumps: a few stalks rooted near each other, clumps spread evenly.
            const k = clamp(Math.round(s.W / 120), 4, 14);
            for (let i = 0; i < k; i++) {
              const cx = (i + 0.25 + rng.random() * 0.5) / k, per = 2 + rng.int(3);
              for (let j = 0; j < per; j++) fronds.push(frond(clamp(cx + (rng.random() - 0.5) * 0.5 / k, 0.01, 0.99), rng.random() < 0.5 ? 0 : 1));
            }
          }
        }
        const nf = clamp(Math.round(s.W * s.H / (layout === 0 ? 30000 : 70000)), layout === 0 ? 8 : 4, layout === 0 ? 36 : 14);
        while (fish.length < nf) school(false);
        fish.length = Math.max(nf, Math.min(fish.length, nf + 6));
        for (const f of fish) f.y = Math.min(f.y, s.H * 0.85);
        if (layout === 1) {
          const k = clamp(Math.round(s.W * s.H / 9000), 30, 140);
          while (specks.length < k) specks.push({ x: rng.random() * s.W, y: rng.random() * s.H, r: 0.8 + rng.random() * 1.4, v: 0.7 + rng.random() * 0.6 });
          specks.length = k;
        }
      },
      step(dt) {
        if (layout === 2) cam += dt * 7;
        for (let i = fish.length - 1; i >= 0; i--) {
          const f = fish[i];
          // In the current, fish hold station and now and then lose ground.
          const v = layout === 1 ? f.v * (0.6 + Math.sin(s.t * 0.3 + f.ph)) : f.v;
          f.x += f.dir * v * dt;
          const out = f.dir > 0 ? f.x > s.W + f.size * 3 : f.x < -f.size * 3;
          const behind = layout === 1 && f.x > s.W + f.size * 3;
          if (out || behind) fish.splice(i, 1);
        }
        const nf = clamp(Math.round(s.W * s.H / (layout === 0 ? 30000 : 70000)), layout === 0 ? 8 : 4, layout === 0 ? 36 : 14);
        if (fish.length < nf - (layout === 0 ? 4 : 0)) school(true);
        for (const p of specks) {
          p.x += p.v * 26 * dt; p.y += Math.sin(s.t * 0.7 + p.x * 0.01) * 4 * dt;
          if (p.x > s.W + 4) { p.x = -4; p.y = rng.random() * s.H; }
        }
      },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'round';
        if (layout === 2) {
          const st = strip();
          for (const z of [0, 0.5, 1]) {
            const scale = 0.55 + 0.45 * z, alpha = 0.14 + 0.26 * z, shift = cam * (0.3 + 0.7 * z);
            for (const f of fronds) {
              if (f.z !== z) continue;
              const x = ((f.fx * st - shift) % st + st) % st - 100;
              drawFrond(f, x, scale, alpha);
            }
            if (z === 0.5) drawFish(true, 0.3);
          }
          drawFish(false, 0.42);
        } else {
          for (const f of fronds) if (f.z === 0) drawFrond(f, f.fx * s.W, 0.85, 0.22);
          drawFish(true, 0.3);
          for (const f of fronds) if (f.z === 1) drawFrond(f, f.fx * s.W, 1, 0.42);
          drawFish(false, 0.48);
        }
        if (specks.length) {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = s.colors[s.colors.length - 1];
          ctx.beginPath();
          for (const p of specks) { ctx.moveTo(p.x + p.r, p.y); ctx.arc(p.x, p.y, p.r, 0, TAU); }
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    };
  });
}
