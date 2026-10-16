// Weather map: a synoptic chart. Isobars ring the highs and lows (marked H and L with their
// pressure) as they drift east, wind arrows turn to blow round them, and fronts sweep across with
// their marks: triangles for cold, half-circles for warm, both for occluded. The seed picks the
// variant: one deep low whose warm and cold fronts swing round it as it occludes, crossing the
// host; a parade of long fronts of every kind sweeping across one after another; or a chart of
// wind barbs on a station grid, feathers growing as the wind strengthens, a cold front trailing.

import { stage, clamp, TAU } from './stage.js';

/**
 * @typedef {{x:number, y:number, a:number, sg:number, vx:number, vy:number, ph:number}} Centre
 * @typedef {{x0:number, k:number, amp:number, ph:number, tilt:number, type:number}} Band
 */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const n = s.colors.length;
    const COLD = s.colors[2 % n], WARM = s.colors[0], OCC = s.colors[4 % n];
    /** @type {Centre[]} */
    let centres = [];
    /** @type {Band[]} */
    let bands = [];
    let mn = 600, cell = 30, ga = 80, S = 300, sp = 24, drift = 8;
    /** The low that carries fronts, in variants 0 and 2, with its occlusion 0..1. */
    let occl = 0;
    /** @type {Float32Array} */
    let field = new Float32Array(0);
    let nx = 0, ny = 0;

    /** Pressure in hPa at a point. @param {number} x @param {number} y */
    function press(x, y) {
      let p = 1013;
      for (const c of centres) {
        const dx = x - c.x, dy = y - c.y;
        p += c.a * Math.exp(-(dx * dx + dy * dy) / (2 * c.sg * c.sg));
      }
      return p;
    }

    /** A new pressure centre at x, y. @param {number} x @param {number} y @param {boolean} low */
    function centre(x, y, low) {
      return { x, y, a: (low ? -1 : 1) * (12 + rng.random() * 14), sg: mn * (0.22 + rng.random() * 0.14),
        vx: drift * (0.7 + rng.random() * 0.6), vy: (rng.random() - 0.5) * drift * 0.4, ph: rng.random() * TAU };
    }

    function size() {
      mn = Math.min(s.W, s.H);
      cell = clamp(mn / 26, 18, 60);
      ga = clamp(mn / (s.layout === 2 ? 8 : 7), s.layout === 2 ? 48 : 60, 120);
      S = clamp(mn * 0.68, 220, 720);
      sp = clamp(mn * 0.045, 16, 32);
      drift = clamp(s.W / 90, 5, 16);
      nx = Math.ceil(s.W / cell) + 2; ny = Math.ceil(s.H / cell) + 2;
      field = new Float32Array(nx * ny);
    }

    /** The fronting low: centre 0, kept for the fronts. @returns {Centre} */
    const low = () => centres[0];

    /** Respawns a centre that has drifted off the east edge back in from the west. @param {Centre} c @param {number} k */
    function wrap(c, k) {
      const pad = c.sg * 2.2;
      if (c.x - pad > s.W) {
        const fresh = centre(-pad, s.H * (0.2 + rng.random() * 0.6), k === 0 ? true : rng.random() < 0.5);
        Object.assign(c, fresh);
        if (k === 0) occl = 0;
      }
      if (c.y < -c.sg) c.vy = Math.abs(c.vy); else if (c.y > s.H + c.sg) c.vy = -Math.abs(c.vy);
    }

    /** Quadratic curve samples. @param {number[]} a @param {number[]} b @param {number[]} c @param {number[][]} out */
    function quad(a, b, c, out) {
      for (let k = out.length ? 1 : 0; k <= 24; k++) {
        const u = k / 24, w = 1 - u;
        out.push([w * w * a[0] + 2 * w * u * b[0] + u * u * c[0], w * w * a[1] + 2 * w * u * b[1] + u * u * c[1]]);
      }
      return out;
    }

    /**
     * Strokes a front and its marks on its forward side: type 0 cold, 1 warm, 2 occluded, 3 stationary.
     * @param {number[][]} pts @param {number} type @param {number} fade 0..1
     */
    function front(pts, type, fade) {
      const { ctx } = s;
      if (pts.length < 2 || fade <= 0) return;
      /** @type {number[]} */
      const acc = [0];
      for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      const len = acc[acc.length - 1];
      const lineCol = type === 0 ? COLD : type === 1 ? WARM : type === 2 ? OCC : COLD;
      ctx.lineWidth = clamp(mn * 0.005, 2, 3.2);
      ctx.globalAlpha = (s.dark ? 0.55 : 0.6) * fade;
      ctx.strokeStyle = lineCol;
      ctx.beginPath();
      pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
      const sz = sp * 0.5;
      /** @type {Path2D[]} cold marks, warm marks */
      const paths = [new Path2D(), new Path2D()];
      let seg = 0;
      for (let d = sp * 0.6, i = 0; d < len - sz; d += sp, i++) {
        while (seg < acc.length - 2 && acc[seg + 1] < d) seg++;
        const u = (d - acc[seg]) / (acc[seg + 1] - acc[seg] || 1);
        const a = pts[seg], b = pts[seg + 1];
        const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
        // Forward side, the way the front moves: (ty, -tx); a stationary front's warm marks face back.
        const kind = type === 0 ? 0 : type === 1 ? 1 : i % 2;
        const back = type === 3 && kind === 1;
        const nxv = back ? -ty : ty, nyv = back ? tx : -tx;
        const p = paths[type === 2 ? 0 : kind];
        if (kind === 0) {
          p.moveTo(x - tx * sz * 0.6, y - ty * sz * 0.6);
          p.lineTo(x + nxv * sz, y + nyv * sz);
          p.lineTo(x + tx * sz * 0.6, y + ty * sz * 0.6);
          p.closePath();
        } else {
          const ang = Math.atan2(ty, tx);
          p.moveTo(x + tx * sz * 0.55, y + ty * sz * 0.55);
          // Half-circle bulging towards the normal.
          const ccw = nxv * ty - nyv * tx > 0;
          p.arc(x, y, sz * 0.55, ang, ang + Math.PI, ccw);
          p.closePath();
        }
      }
      ctx.globalAlpha = (s.dark ? 0.55 : 0.6) * fade;
      if (type === 2) { ctx.fillStyle = OCC; ctx.fill(paths[0]); return; }
      ctx.fillStyle = type === 1 ? WARM : COLD;
      ctx.fill(paths[type === 1 ? 1 : 0]);
      if (type === 3) { ctx.fillStyle = WARM; ctx.fill(paths[1]); }
    }

    /** The low's fronts: occluded from the centre to the triple point, warm and cold from there. */
    function lowFronts() {
      const c = low();
      const rot = 0.12 * Math.sin(s.t * 0.04 + c.ph);
      const sc = S * (0.8 + 0.2 * clamp(c.a / -24, 0, 1));
      const co = Math.cos(rot) * sc, si = Math.sin(rot) * sc;
      const P = (/** @type {number} */ x, /** @type {number} */ y) => [c.x + x * co - y * si, c.y + x * si + y * co];
      const o = 0.12 + occl * 0.45;
      const T = [o * 0.55, o * 0.5];
      const fade = clamp((c.x + c.sg * 2) / (c.sg * 1.5), 0, 1);
      if (o > 0.14) front(quad(P(0, 0), P(T[0] * 0.3, T[1] * 0.8), P(T[0], T[1]), []), 2, fade);
      front(quad(P(T[0], T[1]), P(T[0] + 0.5, T[1] - 0.06 + o * 0.2), P(T[0] + 0.95, T[1] + 0.32), []), 1, fade);
      front(quad(P(T[0], T[1]), P(T[0] + 0.42 - o * 0.2, T[1] + 0.55), P(T[0] - 0.3, T[1] + 1.15), []), 0, fade);
    }

    /** Isobars by marching squares over the coarse field, every 4 hPa. */
    function isobars() {
      const { ctx } = s;
      let lo = Infinity, hi = -Infinity;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const v = press((i - 0.5) * cell, (j - 0.5) * cell);
          field[j * nx + i] = v;
          if (v < lo) lo = v; if (v > hi) hi = v;
        }
      }
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = s.ink;
      ctx.globalAlpha = s.dark ? 0.3 : 0.34;
      ctx.beginPath();
      for (let L = Math.ceil(lo / 4) * 4; L <= hi; L += 4) {
        if (L === 1012 && hi - lo < 6) continue;
        for (let j = 0; j + 1 < ny; j++) {
          for (let i = 0; i + 1 < nx; i++) {
            const a = field[j * nx + i], b = field[j * nx + i + 1], c = field[(j + 1) * nx + i + 1], d = field[(j + 1) * nx + i];
            const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const x0 = (i - 0.5) * cell, y0 = (j - 0.5) * cell;
            // Edge crossings: top, right, bottom, left.
            const tX = x0 + cell * (L - a) / (b - a), rY = y0 + cell * (L - b) / (c - b);
            const bX = x0 + cell * (L - d) / (c - d), lY = y0 + cell * (L - a) / (d - a);
            const seg = (/** @type {number[]} */ p, /** @type {number[]} */ q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
            const top = [tX, y0], rt = [x0 + cell, rY], bot = [bX, y0 + cell], lf = [x0, lY];
            switch (idx) {
              case 1: case 14: seg(lf, bot); break;
              case 2: case 13: seg(bot, rt); break;
              case 3: case 12: seg(lf, rt); break;
              case 4: case 11: seg(top, rt); break;
              case 5: seg(lf, top); seg(bot, rt); break;
              case 6: case 9: seg(top, bot); break;
              case 7: case 8: seg(lf, top); break;
              case 10: seg(top, rt); seg(lf, bot); break;
            }
          }
        }
      }
      ctx.stroke();
    }

    /** Wind at a point, round the centres (anticlockwise round lows) and a little inward.
     * @param {number} x @param {number} y @param {number[]} out @returns {number} speed 0..1 */
    function wind(x, y, out) {
      const e = 6;
      const gx = (press(x + e, y) - press(x - e, y)) / (2 * e), gy = (press(x, y + e) - press(x, y - e)) / (2 * e);
      let wx = gy - 0.35 * gx, wy = -gx - 0.35 * gy;
      const m = Math.hypot(wx, wy) || 1e-6;
      wx /= m; wy /= m;
      out[0] = wx; out[1] = wy;
      return clamp(m * mn / 60, 0.15, 1);
    }

    const wv = [0, 0];
    /** Wind arrows on a staggered grid. */
    function arrows() {
      const { ctx } = s;
      ctx.lineWidth = clamp(mn * 0.0025, 1.2, 2);
      ctx.strokeStyle = s.ink;
      ctx.globalAlpha = s.dark ? 0.42 : 0.46;
      ctx.beginPath();
      for (let j = 0, y = ga * 0.5; y < s.H + ga * 0.5; y += ga * 0.87, j++) {
        for (let x = ga * (j % 2 ? 0.5 : 0) + ga * 0.25; x < s.W + ga * 0.5; x += ga) {
          const v = wind(x, y, wv);
          const L = ga * (0.22 + 0.3 * v);
          const hx = x + wv[0] * L / 2, hy = y + wv[1] * L / 2;
          ctx.moveTo(x - wv[0] * L / 2, y - wv[1] * L / 2);
          ctx.lineTo(hx, hy);
          const hl = ga * 0.1;
          ctx.moveTo(hx - wv[0] * hl - wv[1] * hl * 0.6, hy - wv[1] * hl + wv[0] * hl * 0.6);
          ctx.lineTo(hx, hy);
          ctx.lineTo(hx - wv[0] * hl + wv[1] * hl * 0.6, hy - wv[1] * hl - wv[0] * hl * 0.6);
        }
      }
      ctx.stroke();
    }

    /** Wind barbs: a station circle, a shaft into the wind and a feather per 10 knots, half for 5. */
    function barbs() {
      const { ctx } = s;
      ctx.lineWidth = clamp(mn * 0.0025, 1.2, 2);
      ctx.strokeStyle = s.ink;
      ctx.globalAlpha = s.dark ? 0.44 : 0.48;
      const L = ga * 0.5, f = L * 0.42, r = Math.max(2, ga * 0.045);
      ctx.beginPath();
      /** @type {number[][]} */
      const flags = [];
      for (let y = ga * 0.6; y < s.H + ga * 0.3; y += ga) {
        for (let x = ga * 0.5; x < s.W + ga * 0.3; x += ga) {
          const v = wind(x, y, wv);
          // Shaft points the way the wind comes from.
          const ux = -wv[0], uy = -wv[1];
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
          ctx.moveTo(x + ux * r, y + uy * r);
          ctx.lineTo(x + ux * (r + L), y + uy * (r + L));
          let knots = Math.round(v * 40 / 5) * 5;
          let d = r + L;
          // Feathers on the clockwise side of the shaft.
          const px = -uy, py = ux;
          if (knots >= 50) { flags.push([x + ux * d, y + uy * d, ux, uy, px, py]); knots -= 50; d -= f * 0.6; }
          while (knots >= 10) {
            ctx.moveTo(x + ux * d, y + uy * d);
            ctx.lineTo(x + ux * (d + f * 0.35) + px * f, y + uy * (d + f * 0.35) + py * f);
            knots -= 10; d -= f * 0.38;
          }
          if (knots >= 5) {
            if (d === r + L) d -= f * 0.38;
            ctx.moveTo(x + ux * d, y + uy * d);
            ctx.lineTo(x + ux * (d + f * 0.18) + px * f * 0.5, y + uy * (d + f * 0.18) + py * f * 0.5);
          }
        }
      }
      ctx.stroke();
      ctx.fillStyle = s.ink;
      ctx.beginPath();
      for (const [x, y, ux, uy, px, py] of flags) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + px * f, y + py * f);
        ctx.lineTo(x - ux * f * 0.55, y - uy * f * 0.55);
        ctx.closePath();
      }
      ctx.fill();
    }

    /** H and L at the centres, the pressure beneath. */
    function labels() {
      const { ctx } = s;
      const fs = Math.round(clamp(mn * 0.06, 20, 46));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const c of centres) {
        if (c.x < -fs || c.x > s.W + fs || c.y < -fs || c.y > s.H + fs) continue;
        const isLow = c.a < 0;
        ctx.globalAlpha = s.dark ? 0.62 : 0.66;
        ctx.fillStyle = isLow ? WARM : COLD;
        ctx.font = `700 ${fs}px system-ui, sans-serif`;
        ctx.fillText(isLow ? 'L' : 'H', c.x, c.y);
        ctx.globalAlpha = s.dark ? 0.45 : 0.5;
        ctx.fillStyle = s.ink;
        ctx.font = `600 ${Math.round(fs * 0.38)}px system-ui, sans-serif`;
        ctx.fillText(String(Math.round(1013 + c.a)), c.x, c.y + fs * 0.75);
      }
    }

    /** Long fronts across the host, in a parade from west to east. */
    function parade() {
      const span = s.W + S * 0.8;
      for (const b of bands) {
        const x0 = ((b.x0 + S * 0.4) % span + span) % span - S * 0.4;
        /** @type {number[][]} */
        const pts = [];
        for (let y = -40; y <= s.H + 40; y += 10) {
          const yy = y / s.H;
          pts.push([x0 + b.amp * Math.sin(yy * b.k + b.ph + s.t * 0.05) + b.tilt * (yy - 0.5) * s.H, y]);
        }
        const fade = clamp(Math.min(x0 + S * 0.4, span - S * 0.4 - x0) / (S * 0.3), 0, 1);
        front(pts, b.type, fade);
      }
    }

    let laid = false;
    return {
      lay() {
        const first = !laid;
        size();
        if (first) {
          laid = true;
          centres = [];
          // Centre 0 is the fronting low (in variants 0 and 2).
          centres.push(centre(s.W * (s.layout === 1 ? 0.3 : 0.2), s.H * (0.22 + rng.random() * 0.2), true));
          const nc = clamp(Math.round(s.W * s.H / 260000), 3, 6);
          for (let k = 1; k < nc; k++) {
            centres.push(centre(s.W * (k / nc + (rng.random() - 0.5) * 0.2), s.H * (0.2 + rng.random() * 0.6), k % 2 === 0));
          }
          occl = s.layout === 1 ? 0 : 0.3 + rng.random() * 0.4;
          if (s.layout === 1) {
            const nb = clamp(Math.round(s.W / 420), 2, 5);
            const types = rng.shuffle([0, 1, 2, 3]);
            bands = [];
            for (let k = 0; k < nb; k++) {
              bands.push({ x0: (k / nb) * (s.W + S * 0.8), k: 2 + rng.random() * 3, amp: S * (0.08 + rng.random() * 0.1),
                ph: rng.random() * TAU, tilt: (rng.random() - 0.5) * 0.5, type: types[k % 4] });
            }
          }
        } else {
          for (const c of centres) c.sg = clamp(c.sg, mn * 0.2, mn * 0.4);
        }
      },
      step(dt) {
        centres.forEach((c, k) => {
          c.x += c.vx * dt; c.y += c.vy * dt;
          wrap(c, k);
        });
        // The fronting low occludes as it goes, its fronts swinging round it.
        occl = Math.min(1, occl + dt / 140);
        for (const b of bands) b.x0 += drift * 2.2 * dt;
      },
      draw() {
        isobars();
        if (s.layout === 2) barbs(); else arrows();
        if (s.layout === 1) parade(); else lowFronts();
        labels();
      },
    };
  });
}
