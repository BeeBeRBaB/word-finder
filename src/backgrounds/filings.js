// Iron filings: a field of short filings, scattered at random, turns to line up along the field
// of a few bar magnets that move slowly through them; far from a magnet they lie as they fell.
// The seed picks the variant: two magnets drifting and turning on their own slow paths; three
// magnets set round a ring that slowly rotates as one; or a few small magnets wandering the
// whole page, each pointing the way it travels like a compass needle.

import { stage, TAU, clamp } from './stage.js';
import { roundRect } from './shapes.js';

/** @typedef {{x:number, y:number, a:number, h:number, c:number, fx:number, fy:number, px:number, py:number, f:number, sp:number}} Magnet
 * Centre x, y and angle a (CSS px, radians), half-length h, colour c; fx, fy, px, py, f, sp are
 * its own path's frequencies, phases and turn rate. */

const BUCKETS = 3;     // alpha steps, by how strongly a filing is held

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Magnet[]} */
    let mags = [];
    let n = 0;
    // Per filing: position, length, rest direction and current direction, the last two as
    // doubled-angle unit vectors so a filing (which has no head) never turns more than 90deg.
    let fx = new Float32Array(0), fy = new Float32Array(0), fl = new Float32Array(0);
    let rc = new Float32Array(0), rs = new Float32Array(0), cc = new Float32Array(0), cs = new Float32Array(0);
    let hold = new Float32Array(0), owner = new Uint8Array(0);
    let laid = false;

    /** @param {number} i @returns {Magnet} */
    const magnet = (i) => ({ x: 0, y: 0, a: rng.random() * TAU, h: 0, c: i % nc,
      fx: 0.018 + rng.random() * 0.02, fy: 0.014 + rng.random() * 0.02,
      px: rng.random() * TAU, py: rng.random() * TAU, f: 0.03 + rng.random() * 0.04,
      sp: (rng.random() < 0.5 ? -1 : 1) * (0.06 + rng.random() * 0.06) });

    /** Places the magnets for time t. @returns {void} */
    function move() {
      const m0 = Math.min(s.W, s.H), t = s.t;
      if (layout === 1) {
        const R = m0 * 0.3, turn = t * 0.07;
        mags.forEach((m, i) => {
          const b = turn + i * TAU / mags.length;
          m.x = s.W / 2 + Math.cos(b) * R * (s.W > s.H ? 1.35 : 1);
          m.y = s.H / 2 + Math.sin(b) * R * (s.W > s.H ? 1 : 1.35);
          m.a = b + Math.PI / 2 + 0.5 * Math.sin(t * 0.05 + i);
        });
        return;
      }
      for (const m of mags) {
        const u = TAU * m.fx * t + m.px, v = TAU * m.fy * t + m.py;
        const ax = layout === 0 ? 0.3 : 0.42, ay = layout === 0 ? 0.3 : 0.42;
        m.x = s.W * (0.5 + ax * Math.sin(u));
        m.y = s.H * (0.5 + ay * Math.sin(v));
        if (layout === 0) m.a = m.px + t * m.sp;
        // Wanderers point along their path: the velocity's direction.
        else m.a = Math.atan2(ay * s.H * m.fy * Math.cos(v), ax * s.W * m.fx * Math.cos(u));
      }
    }

    /** Turns every filing toward the field, by k of the way (1 snaps). @param {number} k @returns {void} */
    function align(k) {
      const poles = [];
      for (const m of mags) {
        const dx = Math.cos(m.a) * m.h, dy = Math.sin(m.a) * m.h;
        poles.push(m.x + dx, m.y + dy, 1, m.x - dx, m.y - dy, -1);
      }
      const np = poles.length / 3;
      const soft = mags[0].h * mags[0].h * 0.08, scale = mags[0].h;
      for (let i = 0; i < n; i++) {
        let ex = 0, ey = 0, best = 0, who = 0;
        for (let j = 0; j < np; j++) {
          const rx = fx[i] - poles[j * 3], ry = fy[i] - poles[j * 3 + 1];
          const q = poles[j * 3 + 2] / (rx * rx + ry * ry + soft);
          ex += q * rx; ey += q * ry;
          const w = Math.abs(q);
          if (w > best) { best = w; who = j >> 1; }
        }
        const e2 = ex * ex + ey * ey;
        const w = clamp(Math.sqrt(Math.sqrt(e2) * scale) * 2.8 - 0.12, 0, 1);
        hold[i] = w; owner[i] = mags[who].c;
        let tc = rc[i] * (1 - w), ts = rs[i] * (1 - w);
        if (e2 > 0) { tc += w * (ex * ex - ey * ey) / e2; ts += w * 2 * ex * ey / e2; }
        const c = cc[i] + (tc - cc[i]) * k, sn = cs[i] + (ts - cs[i]) * k;
        const l = Math.hypot(c, sn) || 1;
        cc[i] = c / l; cs[i] = sn / l;
      }
    }

    return {
      lay() {
        const area = s.W * s.H;
        const sp = Math.max(clamp(Math.min(s.W, s.H) * 0.028, 11, 18), Math.sqrt(area / 2400));
        const cols = Math.ceil(s.W / sp) + 1, rows = Math.ceil(s.H / sp) + 1;
        n = cols * rows;
        fx = new Float32Array(n); fy = new Float32Array(n); fl = new Float32Array(n);
        rc = new Float32Array(n); rs = new Float32Array(n); cc = new Float32Array(n); cs = new Float32Array(n);
        hold = new Float32Array(n); owner = new Uint8Array(n);
        for (let r = 0, i = 0; r < rows; r++) {
          for (let q = 0; q < cols; q++, i++) {
            fx[i] = (q + (rng.random() - 0.5) * 0.9) * sp;
            fy[i] = (r + (rng.random() - 0.5) * 0.9) * sp;
            fl[i] = sp * (0.4 + rng.random() * 0.4);
            const b = rng.random() * TAU;
            rc[i] = cc[i] = Math.cos(b); rs[i] = cs[i] = Math.sin(b);
          }
        }
        const m0 = Math.min(s.W, s.H);
        const count = layout === 0 ? 2 : layout === 1 ? 3 : clamp(Math.round(area / 260000), 3, 5);
        while (mags.length < count) mags.push(magnet(mags.length));
        mags.length = count;
        for (const m of mags) m.h = clamp(m0 * (layout === 2 ? 0.06 : 0.085), layout === 2 ? 20 : 26, layout === 2 ? 52 : 76);
        move();
        // Settled at once on a fresh field, so the first picture already shows the pattern.
        align(1);
        if (!laid) { laid = true; for (let i = 0; i < 4; i++) align(1); }
      },
      step(dt) {
        move();
        align(Math.min(1, dt * 3));
      },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'butt';
        ctx.lineWidth = 1.8;
        const alpha = s.dark ? [0.2, 0.34, 0.52] : [0.22, 0.36, 0.55];
        for (let c = 0; c < nc; c++) {
          for (let b = 0; b < BUCKETS; b++) {
            ctx.beginPath();
            let any = false;
            for (let i = 0; i < n; i++) {
              if (owner[i] !== c || Math.min(BUCKETS - 1, Math.floor(hold[i] * BUCKETS)) !== b) continue;
              // Half of the doubled angle: the filing's own direction.
              const hx = Math.sqrt((1 + cc[i]) / 2) * fl[i] / 2;
              const hy = (cs[i] < 0 ? -1 : 1) * Math.sqrt(Math.max(0, 1 - cc[i]) / 2) * fl[i] / 2;
              ctx.moveTo(fx[i] - hx, fy[i] - hy);
              ctx.lineTo(fx[i] + hx, fy[i] + hy);
              any = true;
            }
            if (!any) continue;
            ctx.globalAlpha = alpha[b];
            ctx.strokeStyle = s.colors[c];
            ctx.stroke();
          }
        }
        // The magnets: a coloured north half and an ink south half.
        for (const m of mags) {
          const w = m.h * 0.6, L = m.h * 1.25;
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.rotate(m.a);
          ctx.globalAlpha = s.dark ? 0.5 : 0.55;
          ctx.fillStyle = s.colors[m.c];
          ctx.beginPath();
          roundRect(ctx, 0, -w / 2, L, w, w * 0.3);
          ctx.fill();
          ctx.globalAlpha = s.dark ? 0.3 : 0.35;
          ctx.fillStyle = s.ink;
          ctx.beginPath();
          roundRect(ctx, -L, -w / 2, L, w, w * 0.3);
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      },
    };
  });
}
