// River: a meandering river seen from above. Short flow lines stream down it, fastest mid-channel
// and round the outside of each bend, slow by the banks, and leaves float along, turning as they
// go and idling where the bank catches them. The seed picks the variant: a lowland river winding
// across the host between wooded banks; a river looping along the host in tight bends, sandbars
// on their inner sides and a cut-off oxbow lake beside it; or two streams that meet and flow on
// as one, their leaves keeping to their own side of the join.

import { stage, clamp, TAU } from './stage.js';
import { makeRng } from '../rng.js';

/**
 * @typedef {{x:Float32Array, y:Float32Array, tx:Float32Array, ty:Float32Array, k:Float32Array, n:number,
 *   len:number, w:number, next:number, side:number}} Channel
 * @typedef {{ch:number, s:number, v:number, age:number, life:number, l:number}} Streak
 * @typedef {{ch:number, s:number, v:number, dv:number, rot:number, spin:number, c:number, sz:number}} Leaf
 */

const DS = 4; // px between samples along a channel

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    /** @type {Channel[]} */
    let chans = [];
    /** @type {Streak[]} */
    let streaks = [];
    /** @type {Leaf[]} */
    let leaves = [];
    let W0 = 80, speed = 60;
    /** @type {number[]|null} oxbow lake: centre x, y, radius, start angle */
    let bow = null;
    const cache = document.createElement('canvas');
    let stale = true;
    s.onDpr = () => { stale = true; };
    const water = s.colors[2 % s.colors.length];
    const leafCols = s.colors.filter((_, k) => s.colors.length < 2 || k !== 2 % s.colors.length);
    /** @type {HTMLCanvasElement[]} */
    let sprites = [];

    /**
     * A sine-generated meander from A to B: heading swings as omega sin(2 pi s / lambda).
     * @param {number[]} A @param {number[]} B @param {number} lambda @param {number} omega
     * @param {number} phase @param {number} w channel width
     * @param {boolean} [centre] shift sideways so the bends swing evenly about the chord
     * @returns {Channel}
     */
    function meander(A, B, lambda, omega, phase, w, centre = false) {
      const span = Math.hypot(B[0] - A[0], B[1] - A[1]);
      // Long enough waves that the tightest bend's radius stays over the channel's width.
      const lam = Math.max(lambda, 6.4 * omega * w);
      const head = (/** @type {number} */ sv) => {
        const ph = TAU * sv / lam + phase;
        return omega * (Math.sin(ph) - 0.1 * Math.sin(3 * ph));
      };
      let cx = 0, cy = 0;
      for (let sv = 0; sv < lam; sv += DS) { cx += Math.cos(head(sv)) * DS; cy += Math.sin(head(sv)) * DS; }
      // Whole waves, so the mean heading is along the chord.
      const waves = Math.max(1, Math.round(span / Math.hypot(cx, cy)));
      const total = waves * lam;
      /** @type {number[]} */
      const xs = [0], ys = [0];
      let x = 0, y = 0;
      for (let sv = 0; sv < total; sv += DS) {
        x += Math.cos(head(sv)) * DS; y += Math.sin(head(sv)) * DS;
        xs.push(x); ys.push(y);
      }
      // Similarity transform: first sample to A, last to B.
      const n = xs.length;
      const ex = xs[n - 1], ey = ys[n - 1];
      const sc = span / Math.hypot(ex, ey), rot = Math.atan2(B[1] - A[1], B[0] - A[0]) - Math.atan2(ey, ex);
      const ca = Math.cos(rot) * sc, sa = Math.sin(rot) * sc;
      // Resample at even spacing after the scale.
      /** @type {number[]} */
      const px = [], py = [];
      let carry = 0;
      px.push(A[0]); py.push(A[1]);
      for (let k = 1; k < n; k++) {
        const ax = A[0] + xs[k - 1] * ca - ys[k - 1] * sa, ay = A[1] + xs[k - 1] * sa + ys[k - 1] * ca;
        const bx = A[0] + xs[k] * ca - ys[k] * sa, by = A[1] + xs[k] * sa + ys[k] * ca;
        const sl = Math.hypot(bx - ax, by - ay);
        let u = DS - carry;
        while (u <= sl) { px.push(ax + (bx - ax) * u / sl); py.push(ay + (by - ay) * u / sl); u += DS; }
        carry = sl - (u - DS);
      }
      const m = px.length;
      if (centre) {
        const ux = (B[0] - A[0]) / span, uy = (B[1] - A[1]) / span;
        let lo = Infinity, hi = -Infinity;
        for (let k = 0; k < m; k++) { const d = -(px[k] - A[0]) * uy + (py[k] - A[1]) * ux; lo = Math.min(lo, d); hi = Math.max(hi, d); }
        const sh = (lo + hi) / 2;
        for (let k = 0; k < m; k++) { px[k] += uy * sh; py[k] -= ux * sh; }
      }
      const ch = { x: new Float32Array(px), y: new Float32Array(py), tx: new Float32Array(m), ty: new Float32Array(m),
        k: new Float32Array(m), n: m, len: (m - 1) * DS, w, next: -1, side: 0 };
      for (let k = 0; k < m; k++) {
        const a = Math.max(0, k - 2), b = Math.min(m - 1, k + 2);
        const dx = px[b] - px[a], dy = py[b] - py[a], l = Math.hypot(dx, dy) || 1;
        ch.tx[k] = dx / l; ch.ty[k] = dy / l;
      }
      for (let k = 0; k < m; k++) {
        const a = Math.max(0, k - 4), b = Math.min(m - 1, k + 4);
        const d = Math.atan2(ch.ty[a] * ch.tx[b] - ch.tx[a] * ch.ty[b], ch.tx[a] * ch.tx[b] + ch.ty[a] * ch.ty[b]);
        ch.k[k] = -d / ((b - a) * DS || 1);
      }
      return ch;
    }

    /** Point at distance sv along a channel, v across (-1 left bank .. 1 right bank).
     * @param {Channel} c @param {number} sv @param {number} v @param {number[]} out @returns {number} sample index */
    function at(c, sv, v, out) {
      const f = clamp(sv / DS, 0, c.n - 1.001), i = Math.floor(f), u = f - i;
      const x = c.x[i] + (c.x[i + 1] - c.x[i]) * u, y = c.y[i] + (c.y[i + 1] - c.y[i]) * u;
      const o = v * c.w / 2;
      out[0] = x - c.ty[i] * o; out[1] = y + c.tx[i] * o;
      return i;
    }

    /** Flow speed at a point: fastest mid-channel and on the outside of a bend. @param {Channel} c @param {number} sv @param {number} v */
    function flow(c, sv, v) {
      const i = clamp(Math.floor(sv / DS), 0, c.n - 1);
      const bend = clamp(c.k[i] * c.w / 2, -1, 1);
      return speed * (c.w / W0) ** 0.3 * (1 - 0.72 * v * v) * (1 - 0.45 * bend * v);
    }

    function build() {
      const r = makeRng(s.seed * 2731 + 3);
      const mn = Math.min(s.W, s.H);
      const wide = s.W >= s.H;
      W0 = clamp(mn * 0.13, 46, 140);
      speed = clamp(W0 * 0.75, 34, 80);
      const mg = W0 * 2;
      chans = [];
      if (s.layout === 0) {
        const lam = clamp(mn * 0.95, 320, 1000);
        const a = wide ? [-mg, s.H * (0.3 + r.random() * 0.4)] : [s.W * (0.3 + r.random() * 0.4), -mg];
        const b = wide ? [s.W + mg, s.H * (0.3 + r.random() * 0.4)] : [s.W * (0.3 + r.random() * 0.4), s.H + mg];
        chans.push(meander(a, b, lam, 1.25, r.random() * TAU, W0, true));
      } else if (s.layout === 1) {
        const lam = clamp(mn * 1.25, 380, 1200);
        const a = wide ? [-mg, s.H * (0.42 + r.random() * 0.08)] : [s.W * (0.42 + r.random() * 0.08), -mg];
        const b = wide ? [s.W + mg, s.H * (0.5 + r.random() * 0.08)] : [s.W * (0.5 + r.random() * 0.08), s.H + mg];
        chans.push(meander(a, b, lam, 1.85, r.random() * TAU, W0 * 1.1, true));
      } else {
        const lam = clamp(mn * 0.8, 280, 860);
        const J = wide ? [s.W * (0.36 + r.random() * 0.1), s.H * (0.4 + r.random() * 0.2)] : [s.W * (0.4 + r.random() * 0.2), s.H * (0.36 + r.random() * 0.1)];
        const end = wide ? [s.W + mg, s.H * (0.3 + r.random() * 0.4)] : [s.W * (0.3 + r.random() * 0.4), s.H + mg];
        // One stream from each side of the river's line, so they never cross before they meet.
        const t1 = wide ? [s.W * (0.02 + r.random() * 0.12), -mg] : [-mg, s.H * (0.02 + r.random() * 0.12)];
        const t2 = wide ? [s.W * (0.02 + r.random() * 0.12), s.H + mg] : [s.W + mg, s.H * (0.02 + r.random() * 0.12)];
        const main = meander(J, end, lam * 1.2, 1.2, r.random() * TAU, W0 * 1.15);
        chans.push(main);
        for (const t of [t1, t2]) {
          const c = meander(t, J, lam * 0.7, 0.9, r.random() * TAU, W0 * 0.7);
          c.next = 0;
          // Which half of the main channel this stream joins.
          const q = c.n - 1 - Math.round(W0 * 2 / DS);
          const dx = c.x[Math.max(0, q)] - main.x[0], dy = c.y[Math.max(0, q)] - main.y[0];
          c.side = Math.sign(-main.ty[0] * dx + main.tx[0] * dy) || 1;
          chans.push(c);
        }
      }
      const total = chans.reduce((a, c) => a + c.len * c.w, 0);
      const ns = clamp(Math.round(total / 520), 60, 320);
      streaks = [];
      for (let k = 0; k < ns; k++) streaks.push(newStreak(r, true));
      const nl = clamp(Math.round(total / 9000), 6, 22);
      if (leaves.length > nl) leaves.length = nl;
      for (const lf of leaves) { lf.ch = Math.min(lf.ch, chans.length - 1); lf.s = Math.min(lf.s, chans[lf.ch].len); }
      while (leaves.length < nl) {
        const ch = pick(r);
        leaves.push({ ch, s: r.random() * chans[ch].len, v: (r.random() - 0.5) * 1.4, dv: 0, rot: r.random() * TAU,
          spin: (r.random() - 0.5) * 0.8, c: r.int(leafCols.length), sz: 0 });
      }
      for (const lf of leaves) lf.sz = clamp(W0 * 0.17, 8, 18) * (0.8 + (lf.rot % 1) * 0.4);
      stale = true;
    }

    /** A channel, weighted by its area. @param {import('../rng.js').Rng} r */
    function pick(r) {
      const total = chans.reduce((a, c) => a + c.len * c.w, 0);
      let u = r.random() * total;
      for (let k = 0; k < chans.length; k++) { u -= chans[k].len * chans[k].w; if (u <= 0) return k; }
      return 0;
    }

    /** @param {import('../rng.js').Rng} r @param {boolean} anyAge @returns {Streak} */
    function newStreak(r, anyAge) {
      const ch = pick(r);
      const life = 2 + r.random() * 2.5;
      return { ch, s: r.random() * chans[ch].len, v: (r.random() * 2 - 1) * 0.88, age: anyAge ? r.random() * life : 0, life,
        l: clamp(W0 * (0.25 + r.random() * 0.35), 10, 60) };
    }

    /** Leaf sprites, one per colour: an almond blade with a midrib, at device pixels. */
    function makeSprites() {
      const sz = clamp(W0 * 0.17, 8, 18) * 1.2;
      sprites = leafCols.map((col) => {
        const c = document.createElement('canvas');
        const d = s.dpr;
        c.width = Math.ceil(sz * 2 * d) + 2; c.height = Math.ceil(sz * d) + 2;
        const g = c.getContext('2d');
        if (!g) return c;
        g.setTransform(d, 0, 0, d, c.width / 2, c.height / 2);
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(-sz, 0);
        g.quadraticCurveTo(-sz * 0.2, -sz * 0.62, sz * 0.8, 0);
        g.quadraticCurveTo(-sz * 0.2, sz * 0.62, -sz, 0);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,.3)';
        g.lineWidth = Math.max(0.8, sz * 0.08);
        g.beginPath(); g.moveTo(-sz * 0.85, 0); g.lineTo(sz * 0.95, 0); g.stroke();
        return c;
      });
    }

    /** Channel centre-line as a path on c. @param {CanvasRenderingContext2D} c @param {Channel} ch */
    function trace(c, ch) {
      c.moveTo(ch.x[0], ch.y[0]);
      for (let k = 2; k < ch.n; k += 2) c.lineTo(ch.x[k], ch.y[k]);
      c.lineTo(ch.x[ch.n - 1], ch.y[ch.n - 1]);
    }

    /** Banks, water, sandbars and trees, settled, into the cache at device pixels. */
    function paintCache() {
      stale = false;
      makeSprites();
      cache.width = s.cv.width; cache.height = s.cv.height;
      const c = cache.getContext('2d');
      if (!c) return;
      const r = makeRng(s.seed * 97 + 1);
      bow = null;
      const tmp = document.createElement('canvas');
      tmp.width = cache.width; tmp.height = cache.height;
      const t = tmp.getContext('2d');
      if (!t) return;
      t.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      t.lineCap = 'round'; t.lineJoin = 'round';
      // Flood plain, then water, each drawn solid and laid down at one alpha so joins don't stack.
      const layer = (/** @type {string} */ col, /** @type {number} */ grow, /** @type {number} */ alpha) => {
        t.clearRect(0, 0, s.W, s.H);
        t.strokeStyle = col;
        for (const ch of chans) { t.lineWidth = ch.w + grow; t.beginPath(); trace(t, ch); t.stroke(); }
        if (s.layout === 1 && grow === 0) oxbow(t, r);
        c.globalAlpha = alpha;
        c.drawImage(tmp, 0, 0);
      };
      layer(s.ink, W0 * 0.5, s.dark ? 0.045 : 0.05);
      layer(water, 0, s.dark ? 0.2 : 0.22);
      c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      // Bank lines.
      c.globalAlpha = s.dark ? 0.42 : 0.45;
      c.strokeStyle = water;
      c.lineWidth = Math.max(1.2, W0 * 0.025);
      for (const ch of chans) {
        for (const side of [-1, 1]) {
          c.beginPath();
          for (let k = 0; k < ch.n; k += 2) {
            const o = side * ch.w / 2;
            const x = ch.x[k] - ch.ty[k] * o, y = ch.y[k] + ch.tx[k] * o;
            if (k) c.lineTo(x, y); else c.moveTo(x, y);
          }
          c.stroke();
        }
      }
      // Set by oxbow() inside layer() above, which the checker cannot see.
      const ob = /** @type {number[]|null} */ (bow);
      if (ob) {
        const [x, y, rr, a] = ob, hw = W0 * 0.35;
        c.beginPath();
        c.arc(x, y, rr + hw, a, a + 4.2);
        c.arc(x + Math.cos(a + 4.2) * rr, y + Math.sin(a + 4.2) * rr, hw, a + 4.2, a + 4.2 + Math.PI);
        c.arc(x, y, rr - hw, a + 4.2, a, true);
        c.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, hw, a + Math.PI, a);
        c.stroke();
      }
      // Sandbars on the inside of the tightest bends.
      if (s.layout !== 2) {
        c.globalAlpha = s.dark ? 0.2 : 0.24;
        c.fillStyle = s.colors[1 % s.colors.length];
        for (const ch of chans) {
          let last = -1e9;
          for (let k = 8; k < ch.n - 8; k++) {
            const kk = ch.k[k];
            if (Math.abs(kk) * ch.w < (s.layout === 1 ? 0.55 : 0.75) || Math.abs(kk) < Math.abs(ch.k[k - 1]) || Math.abs(kk) < Math.abs(ch.k[k + 1])) continue;
            if (k - last < 20) continue;
            last = k;
            const sd = Math.sign(kk) * ch.w * 0.3;
            const x = ch.x[k] - ch.ty[k] * sd, y = ch.y[k] + ch.tx[k] * sd;
            c.save();
            c.translate(x, y);
            c.rotate(Math.atan2(ch.ty[k], ch.tx[k]));
            c.beginPath();
            c.ellipse(0, 0, ch.w * 0.62, ch.w * 0.16, 0, 0, TAU);
            c.fill();
            c.restore();
          }
        }
      }
      // Trees on the banks, in clumps, kept off the water: crowns as soft discs with a rim.
      const clumps = clamp(Math.round(s.W * s.H / 40000), 8, 50);
      /** @type {number[][]} */
      const trees = [];
      for (let k = 0; k < clumps; k++) {
        const ch = chans[r.int(chans.length)];
        const i = r.int(ch.n);
        const sd = (r.random() < 0.5 ? -1 : 1) * (ch.w / 2 + W0 * (0.5 + r.random() * 1.8));
        const x0 = ch.x[i] - ch.ty[i] * sd, y0 = ch.y[i] + ch.tx[i] * sd;
        const nt = 3 + r.int(6);
        for (let q = 0; q < nt; q++) {
          const tr = W0 * (0.08 + r.random() * 0.08);
          const a = r.random() * TAU, dd = r.random() * W0 * 0.45;
          const x = x0 + Math.cos(a) * dd, y = y0 + Math.sin(a) * dd;
          if (!wet(x, y, tr + 3)) trees.push([x, y, tr]);
        }
      }
      c.beginPath();
      for (const [x, y, tr] of trees) { c.moveTo(x + tr, y); c.arc(x, y, tr, 0, TAU); }
      c.globalAlpha = s.dark ? 0.14 : 0.16;
      c.fillStyle = s.colors[0];
      c.fill();
      c.globalAlpha = s.dark ? 0.32 : 0.36;
      c.strokeStyle = s.colors[0];
      c.lineWidth = 1.2;
      c.stroke();
    }

    /** True where a disc of radius rad at (x, y) touches any channel. @param {number} x @param {number} y @param {number} rad */
    function wet(x, y, rad) {
      for (const ch of chans) {
        const lim = (ch.w / 2 + rad) ** 2;
        for (let k = 0; k < ch.n; k += 3) if ((ch.x[k] - x) ** 2 + (ch.y[k] - y) ** 2 < lim) return true;
      }
      return false;
    }

    /** An oxbow lake: a crescent left by a cut-off bend, on clear ground. @param {CanvasRenderingContext2D} t @param {import('../rng.js').Rng} r */
    function oxbow(t, r) {
      const R0 = W0 * 1.6;
      for (let k = 0; k < 40; k++) {
        const x = R0 + r.random() * (s.W - 2 * R0), y = R0 + r.random() * (s.H - 2 * R0);
        if (wet(x, y, R0 + W0 * 0.8)) continue;
        const a = r.random() * TAU;
        bow = [x, y, R0 - W0 * 0.35, a];
        t.lineWidth = W0 * 0.7;
        t.beginPath();
        t.arc(x, y, R0 - W0 * 0.35, a, a + 4.2);
        t.stroke();
        return;
      }
    }

    /** @param {number} dt */
    function advance(dt) {
      for (const st of streaks) {
        const c = chans[st.ch];
        st.age += dt;
        st.s += flow(c, st.s, st.v) * dt;
        if (st.s > c.len) {
          if (c.next >= 0) { st.ch = c.next; st.s -= c.len; st.v = c.side * 0.48 + st.v * 0.45; }
          else st.age = st.life;
        }
        if (st.age >= st.life) Object.assign(st, newStreak(rng, false));
      }
      for (const lf of leaves) {
        const c = chans[lf.ch];
        // A slow random sideways drift; near a bank the leaf lingers and turns.
        lf.dv = clamp(lf.dv + (rng.random() - 0.5) * 0.6 * dt, -0.12, 0.12);
        lf.v = clamp(lf.v + lf.dv * dt, -0.86, 0.86);
        if (Math.abs(lf.v) >= 0.86) lf.dv = -lf.dv;
        const f = flow(c, lf.s, lf.v) * 0.85;
        lf.s += f * dt;
        lf.rot += (lf.spin + (1 - f / speed) * 0.4 * Math.sign(lf.spin)) * dt;
        if (lf.s > c.len) {
          if (c.next >= 0) { lf.ch = c.next; lf.s -= c.len; lf.v = c.side * 0.48 + lf.v * 0.45; }
          else {
            // Back in at a source: a stream's head where streams join.
            lf.ch = chans.length > 1 ? 1 + rng.int(chans.length - 1) : 0;
            lf.s = 0;
            lf.v = (rng.random() - 0.5) * 1.4;
          }
        }
      }
    }

    const p = [0, 0], q = [0, 0], o = [0, 0];
    let laid = false;
    return {
      lay() {
        build();
        if (!laid) { laid = true; for (let k = 0; k < 10; k++) advance(0.1); }
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        if (stale) paintCache();
        ctx.drawImage(cache, 0, 0, s.W, s.H);
        // Flow lines in three fade buckets, each one path.
        ctx.strokeStyle = s.dark ? '#fff' : s.ink;
        ctx.lineWidth = Math.max(1, W0 * 0.018);
        ctx.lineCap = 'round';
        for (let b = 0; b < 3; b++) {
          ctx.globalAlpha = (s.dark ? 0.12 : 0.16) * (b + 1);
          ctx.beginPath();
          for (const st of streaks) {
            const f = Math.sin(Math.PI * st.age / st.life);
            if (Math.min(2, Math.floor(f * 3)) !== b) continue;
            const c = chans[st.ch];
            at(c, st.s, st.v, p);
            at(c, st.s - st.l / 2, st.v, o);
            at(c, st.s - st.l, st.v, q);
            ctx.moveTo(q[0], q[1]); ctx.quadraticCurveTo(o[0], o[1], p[0], p[1]);
          }
          ctx.stroke();
        }
        const d = s.dpr;
        ctx.globalAlpha = s.dark ? 0.62 : 0.6;
        for (const lf of leaves) {
          const c = chans[lf.ch];
          at(c, lf.s, lf.v, p);
          const sp = sprites[lf.c % sprites.length];
          const sc = lf.sz / clamp(W0 * 0.17, 8, 18) / 1.2;
          const co = Math.cos(lf.rot) * sc, si = Math.sin(lf.rot) * sc;
          ctx.setTransform(co, si, -si, co, p[0] * d, p[1] * d);
          ctx.drawImage(sp, -sp.width / 2, -sp.height / 2);
        }
        ctx.setTransform(d, 0, 0, d, 0, 0);
      },
    };
  });
}
