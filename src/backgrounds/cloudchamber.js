// Cloud chamber: particle tracks condense out of the vapour as thin trails, then sink a little
// and slowly fade. Fast particles leave long straight tracks with now and then a tiny curl knocked off
// them; slow ones curl into tightening spirals in the field; some tracks fork in two.
// The seed picks the variant: a chamber of mixed tracks crossing every way; a small source in
// one corner shooting short thick tracks all the same length, like a starburst; or showers
// raining from the top edge, each track splitting into more as it falls.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{at:number, make:(x:number, y:number, a:number) => Track}} Spawn */
/** @typedef {{p:Float32Array, n:number, head:number, v:number, age:number, life:number, w:number,
 *   c:number, kids:Spawn[]}} Track
 * Points p as x, y pairs (n of them, STEP px apart), drawn up to head, which runs v points/s;
 * age and life s; w its width; c its colour; kids tracks it starts on reaching their point. */

const STEP = 6;        // px between track points
const DRIFT = 3;       // px/s the condensed trails sink

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Track[]} */
    let tracks = [];
    let m0 = 400, due = 0, laid = false;
    let sx = 0, sy = 0;                    // the source (corner variant)
    let fall = (rng.random() - 0.5) * 0.5; // the showers' way, off straight down
    const corner = rng.int(4);

    /** @returns {number} */
    const gauss = () => (rng.random() + rng.random() + rng.random() - 1.5) * 0.8;
    /** Is a point far enough outside to stop a track? @param {number} x @param {number} y */
    const out = (x, y) => x < -40 || y < -40 || x > s.W + 40 || y > s.H + 40;

    /**
     * Builds a track from x, y heading a. Each step it may turn by curl (rad/px, signed), which
     * grows by tighten per px as the particle slows, and wobbles by scatter.
     * @param {number} x @param {number} y @param {number} a @param {number} len px
     * @param {{curl?:number, tighten?:number, scatter?:number, w:number, c:number, v:number, life:number}} o
     * @returns {Track}
     */
    function track(x, y, a, len, o) {
      const max = Math.max(2, Math.ceil(len / STEP) + 1), p = new Float32Array(max * 2);
      let k = o.curl ?? 0, n = 0;
      for (; n < max; n++) {
        p[2 * n] = x; p[2 * n + 1] = y;
        if (n > 4 && out(x, y)) { n++; break; }
        a += k * STEP + gauss() * (o.scatter ?? 0.01);
        k *= 1 + (o.tighten ?? 0) * STEP;
        // A spiral ends once it is wound too tight to read.
        if (Math.abs(k) > 0.11) { n++; break; }
        x += Math.cos(a) * STEP; y += Math.sin(a) * STEP;
      }
      return { p, n: Math.min(n, max), head: 0, v: o.v / STEP, age: 0, life: o.life, w: o.w, c: o.c % nc, kids: [] };
    }

    /** Heading at point i of a track. @param {Track} t @param {number} i @returns {number} */
    const heading = (t, i) => {
      const j = Math.max(0, Math.min(t.n - 2, i));
      return Math.atan2(t.p[2 * j + 3] - t.p[2 * j + 1], t.p[2 * j + 2] - t.p[2 * j]);
    };

    /** A slow electron's spiral. @param {number} x @param {number} y @param {number} a
     * @param {number} sign @param {number} r0 starting radius, px @returns {Track} */
    const curl = (x, y, a, sign, r0) => track(x, y, a, r0 * 14, { curl: sign / r0, tighten: 0.9 / (r0 * 6),
      scatter: 0.03, w: 1.2, c: 1, v: 260, life: 5 + rng.random() * 2 });

    /** A fast particle's long straight track, with knock-on curls. @param {number} x
     * @param {number} y @param {number} a @param {number} len @returns {Track} */
    function straight(x, y, a, len) {
      const t = track(x, y, a, len, { curl: (rng.random() - 0.5) * 0.0006, scatter: 0.006, w: 1.3, c: 0,
        v: 700, life: 6 + rng.random() * 2 });
      const knocks = rng.random() < 0.6 ? 1 + rng.int(2) : 0;
      for (let i = 0; i < knocks; i++) {
        const sign = rng.random() < 0.5 ? -1 : 1;
        t.kids.push({ at: 4 + rng.int(Math.max(1, t.n - 8)),
          make: (px, py, h) => curl(px, py, h + sign * (0.8 + rng.random() * 0.6), sign, m0 * (0.012 + rng.random() * 0.012)) });
      }
      return t;
    }

    /** A neutral particle's decay: a gap, then a V of two tracks, often curling apart.
     * @param {number} x @param {number} y @param {number} a @returns {Track} */
    function vee(x, y, a) {
      const len = m0 * (0.12 + rng.random() * 0.2);
      // The parent is unseen (neutral): an empty track that only carries the fork.
      const t = track(x, y, a, len, { scatter: 0, w: 0, c: 0, v: 600, life: 0.1 });
      const open = 0.25 + rng.random() * 0.35, pair = rng.random() < 0.5;
      for (const sign of [-1, 1]) {
        t.kids.push({ at: t.n - 1, make: (px, py, h) => pair
          ? curl(px, py, h + sign * open, sign, m0 * (0.05 + rng.random() * 0.05))
          : track(px, py, h + sign * open, m0 * (0.25 + rng.random() * 0.3),
            { curl: sign * 0.0012, scatter: 0.01, w: 1.4, c: 3, v: 500, life: 6 + rng.random() * 2 }) });
      }
      return t;
    }

    /** One shower branch, which may split again further down. @param {number} x @param {number} y
     * @param {number} a @param {number} depth @returns {Track} */
    function shower(x, y, a, depth) {
      const len = depth === 0 ? m0 * (0.2 + rng.random() * 0.3) : m0 * (0.15 + rng.random() * 0.3);
      const t = track(x, y, a, len, { curl: (rng.random() - 0.5) * 0.002, scatter: 0.012, w: depth === 0 ? 1.6 : 1.2,
        c: depth % 2 ? 1 : 0, v: 600, life: 6 + rng.random() * 2 });
      if (depth < 2 && t.n > 6 && !out(t.p[2 * t.n - 2], t.p[2 * t.n - 1])) {
        const k = depth === 0 ? 3 : 2;
        for (let i = 0; i < k; i++) {
          const da = (i - (k - 1) / 2) * (0.25 + rng.random() * 0.2) + gauss() * 0.08;
          t.kids.push({ at: t.n - 1, make: (px, py, h) => shower(px, py, h + da, depth + 1) });
        }
      } else if (rng.random() < 0.5) {
        const sign = rng.random() < 0.5 ? -1 : 1;
        t.kids.push({ at: t.n - 1, make: (px, py, h) => curl(px, py, h + sign * 0.5, sign, m0 * 0.02) });
      }
      return t;
    }

    /** A point just outside the edge, and a heading into the page. @returns {number[]} */
    function edge() {
      const side = rng.int(4), u = rng.random();
      const x = side === 0 ? -20 : side === 1 ? s.W + 20 : u * s.W;
      const y = side === 2 ? -20 : side === 3 ? s.H + 20 : u * s.H;
      const tx = s.W * (0.2 + rng.random() * 0.6), ty = s.H * (0.2 + rng.random() * 0.6);
      return [x, y, Math.atan2(ty - y, tx - x)];
    }

    /** Starts one new event. @returns {void} */
    function emit() {
      const diag = Math.hypot(s.W, s.H), u = rng.random();
      if (layout === 1) {
        if (u < 0.82) {
          // Alpha particles: thick, straight, all about one length.
          const a = rng.random() * TAU;
          tracks.push(track(sx + Math.cos(a) * 6, sy + Math.sin(a) * 6, a, m0 * 0.3 * (0.94 + rng.random() * 0.1),
            { scatter: 0.004, w: 3, c: 2, v: 320, life: 5 + rng.random() * 2 }));
        } else if (u < 0.94) {
          const sign = rng.random() < 0.5 ? -1 : 1;
          tracks.push(curl(sx, sy, rng.random() * TAU, sign, m0 * (0.06 + rng.random() * 0.08)));
        } else { const [x, y, a] = edge(); tracks.push(straight(x, y, a, diag)); }
        return;
      }
      if (layout === 2) {
        if (u < 0.75) {
          const x = s.W * (-0.1 + rng.random() * 1.2), a = Math.PI / 2 + fall + gauss() * 0.12;
          tracks.push(shower(x - Math.cos(a) * 30, -30, a, rng.random() < 0.3 ? 1 : 0));
        } else {
          const x = rng.random() * s.W, a = Math.PI / 2 + fall + gauss() * 0.2;
          tracks.push(straight(x, -20, a, diag));
        }
        return;
      }
      if (u < 0.45) { const [x, y, a] = edge(); tracks.push(straight(x, y, a, diag)); }
      else if (u < 0.8) {
        const sign = rng.random() < 0.5 ? -1 : 1;
        tracks.push(curl(rng.random() * s.W, rng.random() * s.H, rng.random() * TAU, sign, m0 * (0.05 + rng.random() * 0.1)));
      } else tracks.push(vee(s.W * (0.1 + rng.random() * 0.8), s.H * (0.1 + rng.random() * 0.8), rng.random() * TAU));
    }

    /** @param {number} dt @returns {void} */
    function advance(dt) {
      // Events per second by area, so a big chamber is as busy as a small one.
      const rate = clamp(s.W * s.H / 800000, 0.4, 2.6) * (layout === 1 ? 1.6 : layout === 2 ? 0.75 : 1.1);
      due -= dt;
      while (due <= 0) { emit(); due += -Math.log(1 - rng.random() * 0.95) / rate; }
      if (layout === 2) fall = clamp(fall + gauss() * 0.02 * dt, -0.35, 0.35);
      /** @type {Track[]} */
      const born = [];
      for (const t of tracks) {
        t.head = Math.min(t.n, t.head + t.v * dt);
        t.age += dt;
        for (let i = 0; i < t.n * 2; i += 2) t.p[i + 1] += DRIFT * dt;
        t.kids = t.kids.filter((k) => {
          if (t.head < k.at) return true;
          const i = Math.min(k.at, t.n - 1);
          born.push(k.make(t.p[2 * i], t.p[2 * i + 1], heading(t, i)));
          return false;
        });
      }
      // A track lives from when it has fully formed.
      tracks = tracks.filter((t) => t.kids.length > 0 || t.head < t.n || t.age < t.n / t.v + t.life).concat(born);
    }

    return {
      lay() {
        m0 = Math.min(s.W, s.H);
        const spots = [[0.2, 0.25], [0.8, 0.25], [0.22, 0.75], [0.78, 0.75]];
        sx = s.W * spots[corner][0]; sy = s.H * spots[corner][1];
        if (!laid) {
          laid = true;
          // Run the chamber a while, so the first frame already holds tracks of every age.
          for (let i = 0; i < 80; i++) advance(0.1);
        }
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'round';
        for (const t of tracks) {
          const end = Math.floor(t.head);
          if (t.w === 0 || end < 2) continue;
          // Fades over its life once formed.
          const u = clamp((t.age - t.n / t.v) / t.life, 0, 1), fade = 1 - u * u * (3 - 2 * u);
          if (fade <= 0) continue;
          ctx.beginPath();
          ctx.moveTo(t.p[0], t.p[1]);
          for (let i = 1; i < end; i++) ctx.lineTo(t.p[2 * i], t.p[2 * i + 1]);
          if (end < t.n) ctx.lineTo(t.p[2 * end], t.p[2 * end + 1]);
          ctx.strokeStyle = s.colors[t.c];
          ctx.globalAlpha = (t.w > 2 ? 0.6 : s.dark ? 0.8 : 0.75) * fade;
          // Hairlines are far cheaper to draw; only the short alpha tracks are thick, and spread.
          ctx.lineWidth = t.w > 2 ? t.w * (1 + u * 0.8) : 1;
          ctx.stroke();
        }
        if (layout === 1) {
          // The source: a small capsule on its stand.
          ctx.globalAlpha = s.dark ? 0.45 : 0.5;
          ctx.fillStyle = s.ink;
          ctx.beginPath(); ctx.arc(sx, sy, clamp(m0 * 0.008, 3, 6), 0, TAU); ctx.fill();
        }
      },
    };
  });
}
