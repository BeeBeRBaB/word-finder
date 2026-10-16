// Equalizer: the bars of an audio spectrum display rise and fall to a slow beat, each with a peak
// cap that holds at its highest and then drops back. The seed picks the variant: LED columns
// standing on the bottom edge, lit block by block in colour bands up their height; smooth bars
// mirrored up and down from a centre line; or bars radiating round a ring, mirrored side to side.

import { stage, TAU, clamp } from './stage.js';
import { roundRect } from './shapes.js';

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const bpm = 80 + rng.random() * 24;
    // Per band: level shown, peak cap, its hold time and fall speed, and two wobble rates.
    let n = 0;
    let lv = new Float32Array(0), pk = new Float32Array(0), hold = new Float32Array(0), fall = new Float32Array(0);
    let f1 = new Float32Array(0), f2 = new Float32Array(0), ph = new Float32Array(0);
    // Geometry: bar width and pitch, the first bar's offset, and the LED block pitch.
    let bw = 0, pitch = 0, x0 = 0, block = 0, blocks = 0, maxH = 0, r0 = 0;

    /** Where band i wants to be at time t, 0..1. @param {number} i @param {number} t @returns {number} */
    function target(i, t) {
      const u = n > 1 ? i / (n - 1) : 0;
      const beat = (t * bpm / 60) % 1, half = (t * bpm / 30 + 0.5) % 1;
      // Lows thump on the beat, highs tick on the off-beats, the middle drifts.
      const kick = Math.exp(-beat * 4) * clamp(1.4 - u * 2.2, 0, 1);
      const tick = Math.exp(-half * 6) * clamp(u * 2 - 0.9, 0, 1);
      const wob = 0.5 + 0.25 * Math.sin(t * f1[i] * TAU + ph[i]) + 0.25 * Math.sin(t * f2[i] * TAU + ph[i] * 2);
      const shape = 0.9 - 0.35 * u + 0.15 * Math.sin(u * 7 + ph[0]);
      return clamp(shape * (0.2 + 0.5 * wob) + 0.3 * kick + 0.22 * tick, 0.04, 1);
    }

    /** @param {number} dt @returns {void} */
    function advance(dt) {
      for (let i = 0; i < n; i++) {
        const want = target(i, s.t);
        lv[i] += (want - lv[i]) * Math.min(1, dt * (want > lv[i] ? 6 : 2.5));
        if (lv[i] >= pk[i]) { pk[i] = lv[i]; hold[i] = 0.9; fall[i] = 0; }
        else if (hold[i] > 0) hold[i] -= dt;
        else { fall[i] += 0.7 * dt; pk[i] = Math.max(lv[i], pk[i] - fall[i] * dt); }
      }
    }

    return {
      lay() {
        const m0 = Math.min(s.W, s.H);
        let count;
        if (layout === 2) {
          r0 = clamp(m0 * 0.4, 130, 420);
          maxH = clamp(m0 * 0.22, 60, 230);
          // Half the ring's bands; the other half mirrors them.
          count = clamp(Math.round(TAU * r0 / 22 / 2), 18, 48);
          bw = clamp(TAU * r0 / (count * 2) * 0.55, 4, 16);
        } else {
          bw = clamp(m0 * 0.03, 10, 26);
          pitch = bw * 1.4;
          count = clamp(Math.floor((s.W - bw) / pitch), 8, 72);
          x0 = (s.W - (count - 1) * pitch - bw) / 2;
          maxH = layout === 0 ? s.H * 0.62 : s.H * 0.4;
          block = clamp(m0 * 0.022, 8, 16);
          blocks = Math.floor(maxH / block);
        }
        if (count !== n) {
          const old = n;
          n = count;
          lv = new Float32Array(n); pk = new Float32Array(n); hold = new Float32Array(n); fall = new Float32Array(n);
          f1 = new Float32Array(n); f2 = new Float32Array(n); ph = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            f1[i] = 0.15 + rng.random() * 0.25; f2[i] = 0.35 + rng.random() * 0.4; ph[i] = rng.random() * TAU;
          }
          // A full spectrum straight away, caps a little above, as if it had been playing.
          for (let i = 0; i < n; i++) { lv[i] = target(i, s.t); pk[i] = Math.min(1, lv[i] + 0.04 + rng.random() * 0.12); }
          if (!old) for (let i = 0; i < n; i++) hold[i] = rng.random() * 0.9;
        }
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        const a = s.dark ? 0.36 : 0.4, cap = s.dark ? 0.6 : 0.62;
        if (layout === 0) {
          // Unlit blocks faintly, so the columns read as LED meters.
          const bh = block * 0.68;
          ctx.globalAlpha = s.dark ? 0.06 : 0.07;
          ctx.fillStyle = s.ink;
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const lit = Math.round(lv[i] * blocks);
            for (let b = lit; b < blocks; b++) ctx.rect(x0 + i * pitch, s.H - (b + 1) * block, bw, bh);
          }
          ctx.fill();
          // Lit blocks, one fill per colour band up the column.
          ctx.globalAlpha = a;
          for (let c = 0; c < nc; c++) {
            const lo = Math.floor(c * blocks / nc), hi = Math.floor((c + 1) * blocks / nc);
            ctx.fillStyle = s.colors[c];
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
              const lit = Math.min(hi, Math.round(lv[i] * blocks));
              for (let b = lo; b < lit; b++) ctx.rect(x0 + i * pitch, s.H - (b + 1) * block, bw, bh);
            }
            ctx.fill();
          }
          ctx.globalAlpha = cap;
          ctx.fillStyle = s.ink;
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const b = Math.max(Math.round(lv[i] * blocks), Math.min(blocks - 1, Math.round(pk[i] * blocks)));
            ctx.rect(x0 + i * pitch, s.H - (b + 1) * block + bh * 0.3, bw, bh * 0.4);
          }
          ctx.fill();
        } else if (layout === 1) {
          const mid = s.H / 2, gap = clamp(bw * 0.25, 3, 6);
          ctx.globalAlpha = a;
          for (let c = 0; c < nc; c++) {
            ctx.fillStyle = s.colors[c];
            ctx.beginPath();
            for (let i = c; i < n; i += nc) {
              const h = Math.max(bw, lv[i] * maxH);
              roundRect(ctx, x0 + i * pitch, mid - gap - h, bw, h, bw / 2);
              roundRect(ctx, x0 + i * pitch, mid + gap, bw, h, bw / 2);
            }
            ctx.fill();
          }
          ctx.globalAlpha = cap;
          ctx.fillStyle = s.ink;
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const h = Math.max(bw, pk[i] * maxH) + 5;
            ctx.rect(x0 + i * pitch, mid - gap - h - 3, bw, 3);
            ctx.rect(x0 + i * pitch, mid + gap + h, bw, 3);
          }
          ctx.fill();
        } else {
          // Bands run from the top of the ring down each side, mirrored.
          const cx = s.W / 2, cy = s.H / 2, k = n * 2;
          ctx.lineWidth = bw;
          ctx.lineCap = 'butt';
          ctx.globalAlpha = a;
          for (let c = 0; c < nc; c++) {
            ctx.strokeStyle = s.colors[c];
            ctx.beginPath();
            for (let j = 0; j < k; j++) {
              const i = j < n ? j : k - 1 - j;
              if (Math.floor(i * nc / n) !== c) continue;
              const ang = -Math.PI / 2 + (j + 0.5) * TAU / k, cs = Math.cos(ang), sn = Math.sin(ang);
              const h = Math.max(4, lv[i] * maxH);
              ctx.moveTo(cx + cs * r0, cy + sn * r0);
              ctx.lineTo(cx + cs * (r0 + h), cy + sn * (r0 + h));
            }
            ctx.stroke();
          }
          ctx.globalAlpha = cap;
          ctx.strokeStyle = s.ink;
          ctx.beginPath();
          for (let j = 0; j < k; j++) {
            const i = j < n ? j : k - 1 - j;
            const ang = -Math.PI / 2 + (j + 0.5) * TAU / k, cs = Math.cos(ang), sn = Math.sin(ang);
            const h = Math.max(4, pk[i] * maxH) + 4;
            ctx.moveTo(cx + cs * (r0 + h), cy + sn * (r0 + h));
            ctx.lineTo(cx + cs * (r0 + h + 3), cy + sn * (r0 + h + 3));
          }
          ctx.stroke();
          ctx.globalAlpha = s.dark ? 0.2 : 0.25;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r0 - 6, 0, TAU);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      },
    };
  });
}
