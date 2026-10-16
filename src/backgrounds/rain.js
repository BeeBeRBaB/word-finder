// Rain: slanted streaks fall in three depths, near ones longer, faster and stronger, and each
// lands with a splash ring that widens and fades. The seed picks the variant: a steady shower
// onto a ground band at the foot, rain on a pond seen in perspective (rings over the lower half,
// smaller toward the horizon), or gusty rain whose slant swings slowly in drifting sheets.

import { stage, clamp, mix } from './stage.js';

/** @typedef {{x:number, y:number, z:number, j:number, land:number, c:number}} Drop
 * A streak: its foot at x, y, depth z (0 far .. 1 near), j a fixed jitter for where it lands. */
/** @typedef {{x:number, y:number, z:number, age:number, c:number}} Ring */

const RING_LIFE = 1.1;   // seconds a splash ring takes to widen and fade
const MAX_RINGS = 90;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Drop[]} */
    const drops = [];
    /** @type {Ring[]} */
    let rings = [];
    let unit = 1, horizon = 0, warm = true, lastW = 0;
    // One list per colour and stroke bucket (3 depths x 3 sheet levels), refilled each frame.
    /** @type {Drop[][]} */
    const lists = Array.from({ length: nc * 9 }, () => []);

    /** Slant: horizontal travel per unit fall. @returns {number} */
    const lean = () => layout === 1 ? 0.07
      : layout === 2 ? 0.12 + 0.2 * Math.sin(s.t * 0.11) + 0.08 * Math.sin(s.t * 0.27 + 1) : 0.18;
    /** Fall speed in px/s. @param {number} z @returns {number} */
    const speed = (z) => mix(230, 520, z) * unit;
    /** @param {Drop} d @returns {void} */
    function setLand(d) {
      d.land = layout === 1
        ? horizon + (s.H - horizon) * clamp(0.04 + 0.92 * d.z + d.j * 0.08, 0, 1)
        : s.H - (1 - d.z) * s.H * 0.09 - 4 - d.j * 6 * unit;
    }
    /** @param {Drop} d @param {boolean} anywhere @returns {Drop} */
    function launch(d, anywhere) {
      d.z = rng.random() ** 1.3;
      d.j = rng.random() - 0.5;
      d.c = rng.int(nc);
      setLand(d);
      d.y = anywhere ? rng.random() * d.land : -rng.random() * 60 * unit;
      d.x = rng.random() * (s.W + 80 * unit) - 40 * unit - lean() * (d.land - d.y) * 0.5;
      return d;
    }
    /** Sheet strength 0..1 at x, for the gusty variant's drifting bands. @param {number} x @returns {number} */
    const sheet = (x) => layout === 2 ? 0.5 + 0.5 * Math.sin(x / (s.W * 0.22) - s.t * 0.35) : 1;

    return {
      lay() {
        unit = clamp(Math.min(s.W, s.H) / 800, 0.6, 1.3);
        horizon = s.H * 0.42;
        const n = clamp(Math.round(s.W * s.H / 3000), 80, 420);
        // Keep the drops, stretched across the new width and landing on the new ground.
        for (const d of drops) {
          if (lastW) d.x *= s.W / lastW;
          setLand(d);
          if (d.y > d.land) d.y = rng.random() * d.land;
        }
        while (drops.length < n) drops.push(launch({ x: 0, y: 0, z: 0, j: 0, land: 0, c: 0 }, true));
        drops.length = n;
        rings = rings.filter((r) => r.x < s.W && r.y < s.H);
        lastW = s.W;
        // Warm up once so the first (and, under reduced motion, only) frame has rings in it.
        if (warm) { warm = false; for (let i = 0; i < 30; i++) this.step(0.05); }
      },
      step(dt) {
        const k = lean();
        for (const d of drops) {
          const fall = speed(d.z) * dt;
          d.y += fall;
          d.x += fall * k;
          if (d.y >= d.land) {
            if (d.z > 0.25 && rings.length < MAX_RINGS) rings.push({ x: d.x, y: d.land, z: d.z, age: 0, c: d.c });
            launch(d, false);
          }
          if (d.x > s.W + 60 * unit) d.x -= s.W + 120 * unit;
          else if (d.x < -60 * unit) d.x += s.W + 120 * unit;
        }
        for (const r of rings) r.age += dt;
        rings = rings.filter((r) => r.age < RING_LIFE);
      },
      draw() {
        const { ctx } = s;
        const k = lean();
        for (const l of lists) l.length = 0;
        for (const d of drops) {
          const b = d.z < 0.4 ? 0 : d.z < 0.75 ? 1 : 2;
          const sh = sheet(d.x), sb = sh < 0.33 ? 0 : sh < 0.66 ? 1 : 2;
          lists[d.c * 9 + b * 3 + sb].push(d);
        }
        ctx.lineCap = 'round';
        const base = s.dark ? [0.24, 0.36, 0.5] : [0.3, 0.42, 0.58];
        for (let c = 0; c < nc; c++) {
          ctx.strokeStyle = s.colors[c];
          for (let b = 0; b < 3; b++) {
            ctx.lineWidth = (1 + b * 0.5) * unit;
            for (let sb = 0; sb < 3; sb++) {
              const list = lists[c * 9 + b * 3 + sb];
              if (!list.length) continue;
              ctx.globalAlpha = base[b] * (layout === 2 ? 0.4 + sb * 0.3 : 1);
              ctx.beginPath();
              for (const d of list) {
                const len = speed(d.z) * 0.075;
                const top = Math.max(-len, d.y - len);
                ctx.moveTo(d.x - (d.y - top) * k, top);
                ctx.lineTo(d.x, d.y);
              }
              ctx.stroke();
            }
          }
        }
        // Splash rings: flat ellipses that widen and fade; near ones have a second, later ring.
        const flat = layout === 1 ? 0.3 : 0.26;
        const reach = layout === 1 ? 30 : 20;
        for (const r of rings) {
          ctx.strokeStyle = s.colors[r.c];
          ctx.lineWidth = mix(1, 1.8, r.z) * unit;
          for (let i = 0; i < (r.z > 0.6 ? 2 : 1); i++) {
            const u = (r.age - i * 0.25) / (RING_LIFE - i * 0.25);
            if (u <= 0) continue;
            const rx = Math.max(0.5, mix(3, reach, r.z) * unit * Math.sqrt(u) * (1 - i * 0.35));
            ctx.globalAlpha = (s.dark ? 0.55 : 0.62) * (1 - u) ** 1.2 * mix(0.6, 1, r.z);
            ctx.beginPath();
            ctx.ellipse(r.x, r.y, rx, rx * flat, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      },
    };
  });
}
