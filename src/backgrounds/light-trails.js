// Light trails: a long exposure of traffic at night. Cars are streaks of light running along
// curving roads, tail lights in the first look colour one way and headlights in the second the
// other, each streak fading back along the lane, over the faint glow the lanes have built up and
// a line of street lamps. The seed picks the roads: two sweeping highways, an interchange where a
// road crosses the highway and a loop ramp turns under it, or a mountain road of hairpin bends.

import { stage, TAU, clamp, mix } from './stage.js';

const STEP = 6;    // px between a road's samples
const CHUNKS = 8;  // a streak's fade, in steps of alpha

/** @typedef {{xs:Float32Array, ys:Float32Array, nx:Float32Array, ny:Float32Array, n:number, len:number, loop:boolean}} Road
 * a centre line sampled every STEP px, with unit normals; n samples; loop when it closes on itself */
/** @typedef {{road:Road, off:number, dir:number, cars:{at:number, v:number, len:number}[]}} Lane */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout, colors } = s;
    /** @type {Lane[]} */
    let lanes = [];
    let m = 0, w = 2;
    const seedPh = rng.random() * TAU, seedPh2 = rng.random() * TAU;
    const tail = colors[0], head = colors[1 % colors.length], lamp = colors[2 % colors.length];
    const base = document.createElement('canvas');
    const bg = /** @type {CanvasRenderingContext2D} */ (base.getContext('2d'));
    const halo = glow(lamp);

    /** Samples a curve given as a function of 0..1 into a road. @param {(u:number) => number[]} f @param {boolean} [loop] @returns {Road} */
    function road(f, loop = false) {
      // Fine pass for the length, then resample at even arc steps.
      /** @type {number[]} */
      const fx = [], fy = [], fl = [0];
      for (let i = 0; i <= 800; i++) {
        const [x, y] = f(i / 800);
        fx.push(x); fy.push(y);
        if (i) fl.push(fl[i - 1] + Math.hypot(x - fx[i - 1], y - fy[i - 1]));
      }
      const len = fl[800], n = Math.max(2, Math.floor(len / STEP) + 1);
      const xs = new Float32Array(n), ys = new Float32Array(n), nx = new Float32Array(n), ny = new Float32Array(n);
      let j = 0;
      for (let i = 0; i < n; i++) {
        const d = i * STEP;
        while (j < 799 && fl[j + 1] < d) j++;
        const u = (d - fl[j]) / ((fl[j + 1] - fl[j]) || 1);
        xs[i] = mix(fx[j], fx[j + 1], u); ys[i] = mix(fy[j], fy[j + 1], u);
      }
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
        const dx = xs[b] - xs[a], dy = ys[b] - ys[a], d = Math.hypot(dx, dy) || 1;
        nx[i] = -dy / d; ny[i] = dx / d;
      }
      return { xs, ys, nx, ny, n, len: (n - 1) * STEP, loop };
    }

    /** The roads for this variant, in px, built along the host's long side. @returns {{r:Road, lanes:number}[]} */
    function roads() {
      const long = Math.max(s.W, s.H), short = Math.min(s.W, s.H), wide = s.W >= s.H;
      /** @param {number} a @param {number} b @returns {number[]} along the long side, across it */
      const P = (a, b) => (wide ? [a, b] : [b, a]);
      if (layout === 2) {
        // Hairpins: runs across the short side, stacked along the long side, joined by half turns.
        const runs = clamp(Math.round(long / 180), 4, 7), sp = long / runs, r = sp / 2;
        /** @type {number[][]} */
        const pts = [];
        for (let k = 0; k < runs; k++) {
          const a = sp * (k + 0.5), down = k % 2 === 0;
          // The road comes in and leaves past the edges; the inner ends turn short of them.
          const last = k === runs - 1;
          const b0 = k === 0 || (last && !down) ? -0.15 * short : short * 0.12, b1 = last && down ? short * 1.15 : short * 0.88;
          for (let i = 0; i <= 24; i++) {
            const u = i / 24, b = down ? mix(b0, b1, u) : mix(b1, b0, u);
            // A sway that is zero at both ends, so the run meets its half turns square.
            pts.push(P(a + Math.sin(u * Math.PI * 2) * Math.sin(seedPh + k * 2.1) * sp * 0.1, b));
          }
          if (k < runs - 1) {
            const bt = down ? b1 : b0, sg = down ? 1 : -1;
            for (let i = 1; i < 16; i++) {
              const th = Math.PI * i / 16;
              pts.push(P(a + r - Math.cos(th) * r, bt + Math.sin(th) * r * 0.7 * sg));
            }
          }
        }
        const f = (/** @type {number} */ u) => {
          const x = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x)), v = x - i;
          return [mix(pts[i][0], pts[i + 1][0], v), mix(pts[i][1], pts[i + 1][1], v)];
        };
        return [{ r: road(f), lanes: 1 }];
      }
      /** A road along the long side, wandering across it. @param {number} b0 @param {number} amp @param {number} ph */
      const along = (b0, amp, ph) => road((u) => P(mix(-0.12, 1.12, u) * long,
        short * (b0 + amp * Math.sin(u * TAU * 0.85 + ph) + amp * 0.35 * Math.sin(u * TAU * 1.9 + ph * 2))));
      if (layout === 1) {
        const ac = long * mix(0.28, 0.4, rng.random());
        const cross = road((u) => P(ac + Math.sin(u * TAU * 0.6 + seedPh2) * long * 0.05, mix(-0.12, 1.12, u) * short));
        const R = short * 0.17, cx = ac + R * 1.35, cy = short * 0.5 - R * 1.1;
        const ramp = road((u) => P(cx + Math.cos(u * TAU) * R, cy + Math.sin(u * TAU) * R), true);
        return [{ r: along(0.55, 0.12, seedPh), lanes: 3 }, { r: cross, lanes: 2 }, { r: ramp, lanes: 1 }];
      }
      return [{ r: along(0.27, 0.12, seedPh), lanes: 2 }, { r: along(0.73, 0.1, seedPh2), lanes: 3 }];
    }

    /** Paints the lanes' built-up glow and the lamps into the base layer. */
    function paintBase() {
      base.width = Math.round(s.W * s.dpr); base.height = Math.round(s.H * s.dpr);
      bg.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      bg.lineCap = 'round'; bg.lineJoin = 'round';
      for (const ln of lanes) {
        const { road: r, off } = ln;
        bg.strokeStyle = ln.dir > 0 ? tail : head;
        bg.globalAlpha = s.dark ? 0.09 : 0.12;
        bg.lineWidth = w * 1.4;
        bg.beginPath();
        for (let i = 0; i < r.n; i++) {
          const x = r.xs[i] + r.nx[i] * off, y = r.ys[i] + r.ny[i] * off;
          if (i) bg.lineTo(x, y); else bg.moveTo(x, y);
        }
        bg.stroke();
      }
      // Street lamps along the first lane's outer edge of each road.
      const seen = new Set();
      for (const ln of lanes) {
        if (seen.has(ln.road)) continue;
        seen.add(ln.road);
        const r = ln.road, edge = Math.max(...lanes.filter((l) => l.road === r).map((l) => Math.abs(l.off))) + w * 3;
        const gap = Math.round(clamp(m * 0.2, 80, 170) / STEP);
        for (let i = gap >> 1; i < r.n; i += gap) {
          const x = r.xs[i] + r.nx[i] * edge, y = r.ys[i] + r.ny[i] * edge, d = w * 7;
          bg.globalAlpha = s.dark ? 0.35 : 0.4;
          bg.drawImage(halo, x - d, y - d, d * 2, d * 2);
        }
      }
    }

    s.onDpr = paintBase;

    return {
      lay() {
        m = Math.min(s.W, s.H);
        w = clamp(m * 0.004, 1.6, 3);
        const gap = clamp(m * 0.016, 6, 13);
        // Keep each lane's cars by their place along it, as a fraction.
        const old = lanes;
        lanes = [];
        for (const { r, lanes: k } of roads()) {
          for (const dir of [1, -1]) {
            if (r.loop && dir < 0) continue;
            for (let i = 0; i < k; i++) {
              const off = r.loop ? 0 : dir * (0.75 + i) * gap;
              lanes.push({ road: r, off, dir, cars: [] });
            }
          }
        }
        let li = 0;
        for (const ln of lanes) {
          const was = old[li++];
          const L = clamp(m * 0.4, 120, 380);
          const count = Math.max(1, Math.round(ln.road.len / (L * 1.25)));
          const lv = clamp(m * 0.15, 55, 120) * (0.8 + rng.random() * 0.4);
          for (let c = 0; c < count; c++) {
            const prev = was?.cars[c];
            const at = prev ? prev.at / was.road.len * ln.road.len : (c + rng.random() * 0.7) / count * ln.road.len;
            ln.cars.push({ at, v: lv * (0.92 + rng.random() * 0.16), len: L * (0.7 + rng.random() * 0.6) });
          }
        }
        paintBase();
      },
      step(dt) {
        for (const ln of lanes) {
          const span = ln.road.len + (ln.road.loop ? 0 : 300);
          for (const c of ln.cars) c.at = ((c.at + ln.dir * c.v * dt) % span + span) % span;
        }
      },
      draw() {
        const { ctx } = s;
        ctx.globalAlpha = 1;
        ctx.drawImage(base, 0, 0, s.W, s.H);
        // Butt ends, so the fade steps meet without a brighter dot where they overlap.
        ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        // One path per colour per fade step, holding that step of every streak.
        for (const dir of [1, -1]) {
          for (let k = 0; k < CHUNKS; k++) {
            ctx.beginPath();
            for (const ln of lanes) {
              if (ln.dir !== dir) continue;
              const { road: r, off } = ln;
              for (const c of ln.cars) {
                // The streak runs from its head back along the lane; chunk 0 is the faint far end.
                const h = c.at, tl = h - dir * c.len;
                const a = mix(tl, h, k / CHUNKS), b = mix(tl, h, (k + 1) / CHUNKS);
                let i0 = Math.round(Math.min(a, b) / STEP), i1 = Math.round(Math.max(a, b) / STEP);
                if (r.loop) {
                  for (let i = i0; i <= i1; i++) {
                    const j = ((i % r.n) + r.n) % r.n, x = r.xs[j], y = r.ys[j];
                    if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                  }
                  continue;
                }
                i0 = Math.max(0, i0); i1 = Math.min(r.n - 1, i1);
                for (let i = i0; i <= i1; i++) {
                  const x = r.xs[i] + r.nx[i] * off, y = r.ys[i] + r.ny[i] * off;
                  if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
              }
            }
            const u = (k + 1) / CHUNKS;
            ctx.strokeStyle = dir > 0 ? tail : head;
            ctx.globalAlpha = (s.dark ? 0.1 : 0.08) * u;
            ctx.lineWidth = w * 4;
            ctx.stroke();
            ctx.globalAlpha = (s.dark ? 0.62 : 0.6) * (0.12 + 0.88 * u * u);
            ctx.lineWidth = w;
            ctx.stroke();
          }
        }
      },
    };
  });
}

/** A soft round glow, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function glow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 48, 48);
  const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.12, 'rgba(0,0,0,.85)');
  grad.addColorStop(0.4, 'rgba(0,0,0,.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 48, 48);
  return c;
}
