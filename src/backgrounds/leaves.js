// Autumn leaves: maple, beech and oak leaves tumble down, swaying and flipping, and settle; every
// so often the wind gets up and lifts some of them again. The seed picks the variant: a calm fall
// heaping into drifts along the ground, with a gust sweeping across that tosses a run of the drift
// back into the air; a breezy day, leaves slanting across and banking up against the downwind side
// until a little whirlwind spins a column of them up; or a lawn seen from above, leaves spiralling
// down on to it over their shadows until a gust sweeps a band of them skittering along.

import { stage, TAU, clamp } from './stage.js';

const STRIP = 256;   // CSS px wide, each cached strip of settled leaves
const SHAPES = 3;    // maple, beech, oak

/** @typedef {{x:number, y:number, vx:number, vy:number, r:number, spin:number, ph:number, swf:number,
 *   fp:number, fr:number, z:number, zt:number, k:number, free:number, whirl:boolean, wa:number}} Leaf
 * @typedef {{x:number, y:number, r:number, f:number, k:number, b:number}} Rest
 * Leaf: one in the air (z, height above the lawn, only from above); Rest: one lying still, y up
 * from the bottom edge on the ground variants and down from the top on the lawn; b its drift bin. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const lawn = layout === 2;
    const sprites = s.colors.flatMap((c) => [0, 1, 2].map((k) => leafSprite(c, k)));
    const shades = lawn ? [0, 1, 2].map((k) => leafSprite('#000', k)) : [];
    const nk = sprites.length;
    /** @type {Leaf[]} */
    let air = [];
    /** @type {Rest[]} */
    let rest = [];
    let m = 1, sz = 20, fallV = 40, bw = 10, bins = new Float32Array(1), maxH = 1, top = 0, bandH = 1;
    let nAir = 10, cap = 100, spawnT = 0, frame = 0, warmed = false;
    /** @type {HTMLCanvasElement[]} */
    let strips = [];
    /** @type {boolean[]} */
    let dirty = [];
    // Wind: dir is downwind; a gust is a front crossing the screen, a whirl a spinning column.
    const dir = rng.random() < 0.5 ? -1 : 1;
    let nextGust = 9 + rng.random() * 5, gx = 0, gv = 0, gOn = false, gDir = 1;
    let wx = 0, wv = 0, wOn = false;
    const alpha = s.dark ? 0.5 : 0.62, restA = s.dark ? 0.4 : 0.5;

    /** A new leaf in the air. @param {number} x @param {number} y @returns {Leaf} */
    function leaf(x, y) {
      return { x, y, vx: 0, vy: fallV, r: rng.random() * TAU, spin: (rng.random() - 0.5) * 0.8,
        ph: rng.random() * TAU, swf: 1 + rng.random() * 0.9, fp: rng.random() * TAU, fr: 0.6 + rng.random() * 1.6,
        z: 1, zt: 6 + rng.random() * 4, k: rng.int(nk), free: 0, whirl: false, wa: 0 };
    }

    /** Ground height at bin b, in px up from the bottom. @param {number} b @returns {number} */
    const hAt = (b) => (b < 0 || b >= bins.length ? Infinity : bins[b]);

    /** Raises (or with -1 lowers) the drift round bin b by one leaf. @param {number} b @param {number} sign */
    function heap(b, sign) {
      const w = [0.04, 0.11, 0.22, 0.11, 0.04];
      for (let i = -2; i <= 2; i++) {
        const j = b + i;
        if (j >= 0 && j < bins.length) bins[j] = Math.max(0, bins[j] + sign * w[i + 2] * sz);
      }
    }

    /** Lays a leaf down at x (and on the lawn, y). @param {number} x @param {number} y @param {number} k
     * @param {boolean} quiet skip drawing it into the strips @returns {void} */
    function settle(x, y, k, quiet) {
      /** @type {Rest} */
      let r;
      if (lawn) {
        r = { x, y, r: rng.random() * TAU, f: (rng.random() < 0.5 ? -1 : 1) * (0.55 + rng.random() * 0.45), k, b: 0 };
      } else {
        // Roll downhill (and on the breezy day, downwind) until the drift holds it.
        let b = clamp(Math.floor(x / bw), 0, bins.length - 1);
        for (let i = 0; i < bins.length; i++) {
          if (layout === 1 && hAt(b + dir) < bins[b] + sz * 0.2) { b += dir; continue; }
          const l = hAt(b - 1), rr = hAt(b + 1);
          if (Math.min(l, rr) < bins[b] - sz * 0.35) b += l < rr ? -1 : 1; else break;
        }
        // A full drift spills upwind to the nearest place with room.
        for (let j = 1; bins[b] > maxH * 0.92 && j < bins.length; j++) {
          if (hAt(b - dir * j) < maxH * 0.92) b -= dir * j; else if (hAt(b + dir * j) < maxH * 0.92) b += dir * j;
        }
        r = { x: (b + 0.5 + (rng.random() - 0.5) * 1.4) * bw, y: bins[b] + sz * (0.05 + rng.random() * 0.2),
          r: rng.random() * TAU, f: (rng.random() < 0.5 ? -1 : 1) * (0.5 + rng.random() * 0.5), k, b };
        heap(b, 1);
      }
      rest.push(r);
      if (!quiet) for (let i = stripOf(r.x - sz); i <= stripOf(r.x + sz); i++) if (!dirty[i]) paintRest(i, r);
    }

    /** @param {number} x @returns {number} */
    const stripOf = (x) => clamp(Math.floor(x / STRIP), 0, strips.length - 1);

    /** Sets g to draw sprite-space (centred, sz across) at x, y, turned r, flipped by f.
     * @param {CanvasRenderingContext2D} g @param {number} x @param {number} y @param {number} r
     * @param {number} f @param {number} sc @param {number} ox @param {number} oy */
    function place(g, x, y, r, f, sc, ox, oy) {
      const c = Math.cos(r) * s.dpr * sc, sn = Math.sin(r) * s.dpr * sc;
      g.setTransform(c * f, sn * f, -sn, c, (x - ox) * s.dpr, (y - oy) * s.dpr);
    }

    /** Draws one resting leaf into strip i. @param {number} i @param {Rest} r */
    function paintRest(i, r) {
      const g = strips[i].getContext('2d');
      if (!g) return;
      g.globalAlpha = restA * (r.f < 0 ? 0.8 : 1);
      place(g, r.x, lawn ? r.y : s.H - r.y, r.r, r.f, 1, i * STRIP, top);
      g.drawImage(sprites[r.k], -sz / 2, -sz / 2, sz, sz);
    }

    /** Repaints strip i from scratch. @param {number} i */
    function repaint(i) {
      const g = strips[i].getContext('2d');
      if (!g) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, strips[i].width, strips[i].height);
      const x0 = i * STRIP - sz, x1 = (i + 1) * STRIP + sz;
      for (const r of rest) if (r.x > x0 && r.x < x1) paintRest(i, r);
      dirty[i] = false;
    }

    /** Takes rest[j] off the ground and back into the air. @param {number} j @returns {Leaf} */
    function lift(j) {
      const r = rest[j];
      rest.splice(j, 1);
      if (!lawn) heap(r.b, -1);
      for (let i = stripOf(r.x - sz); i <= stripOf(r.x + sz); i++) dirty[i] = true;
      const p = leaf(r.x, lawn ? r.y : s.H - r.y);
      p.k = r.k; p.r = r.r; p.z = 0;
      air.push(p);
      return p;
    }

    /** Starts the next gust, front or whirl. @returns {void} */
    function gust() {
      if (layout === 1) {
        wOn = true; wv = -dir * clamp(s.W / 14, 30, 110);
        wx = dir > 0 ? s.W - bw * 3 : bw * 3;
      } else {
        gOn = true; gDir = lawn ? (rng.random() < 0.5 ? -1 : 1) : -dir;
        gv = clamp(s.W / 4.5, 90, 420);
        gx = gDir > 0 ? -sz * 4 : s.W + sz * 4;
      }
    }

    /** Advances everything by dt. @param {number} dt */
    function tick(dt) {
      const wind = layout === 1 ? dir * fallV * 0.9 : dir * fallV * 0.15;
      // Spawn from the top (from above, anywhere) to keep the air stocked.
      spawnT += dt * nAir * (lawn ? 1 / 7.5 : fallV / (s.H * 1.15)) * (air.length < nAir * 0.7 ? 2 : 1);
      while (spawnT >= 1) {
        spawnT -= 1;
        if (air.length >= nAir * 1.3) continue;
        const span = layout === 1 ? s.W * 1.4 : s.W;
        const x = layout === 1 ? (dir > 0 ? s.W - span : 0) + rng.random() * span : rng.random() * s.W;
        air.push(leaf(x, lawn ? rng.random() * s.H : -sz));
      }

      // The gust front lifts what it passes, and shoves what is already up.
      if (gOn) {
        gx += gv * gDir * dt;
        const zone = sz * 3;
        for (let j = rest.length - 1; j >= 0; j--) {
          if (Math.abs(rest[j].x - gx) < zone && rng.random() < dt * 2) {
            const p = lift(j);
            p.free = lawn ? 0.6 + rng.random() * 0.8 : 1.2;
            p.vx = gDir * fallV * (lawn ? 3 + rng.random() * 3 : 1.5 + rng.random() * 2);
            p.vy = lawn ? (rng.random() - 0.5) * fallV : -fallV * (2.2 + rng.random() * 3);
            p.spin = (rng.random() - 0.5) * 6;
            if (lawn) { p.z = 0.12; p.zt = p.free / 0.12; }
          }
        }
        if (gx < -sz * 6 || gx > s.W + sz * 6) gOn = false;
      }
      if (wOn) {
        wx += wv * dt;
        for (let j = rest.length - 1; j >= 0; j--) {
          if (Math.abs(rest[j].x - wx) < sz * 2.2 && rng.random() < dt * 1.6) {
            const p = lift(j);
            p.whirl = true; p.wa = rng.random() * TAU; p.spin = (rng.random() - 0.5) * 4;
          }
        }
        if (wx < -sz * 4 || wx > s.W + sz * 4) wOn = false;
      }
      nextGust -= dt;
      if (nextGust <= 0) {
        gust();
        nextGust = (rest.length > cap * 0.8 ? 10 : 18) + rng.random() * 8;
      }

      for (let i = air.length - 1; i >= 0; i--) {
        const p = air[i];
        p.ph += p.swf * dt; p.fp += p.fr * dt;
        p.free = Math.max(0, p.free - dt);
        p.r += p.spin * dt;
        p.spin *= Math.exp(-dt * (p.free > 0 ? 0.4 : 1.2));
        const sway = Math.cos(p.ph);
        if (p.whirl) {
          // Round the whirl's axis, climbing, wider the higher, then thrown out.
          p.wa += 2.2 * dt;
          p.y -= fallV * 1.6 * dt;
          const rad = sz * 0.8 + (s.H - p.y) * 0.22;
          p.x = wx + rad * Math.sin(p.wa);
          // Each lets go at its own height (zt is spare off the lawn), flung off sideways.
          if (p.y < s.H * (0.2 + (p.zt - 6) * 0.08) || !wOn) {
            p.whirl = false; p.free = 0.8;
            p.vx = Math.cos(p.wa) * rad * 1.5 + wv; p.vy = 0;
          }
          continue;
        }
        const k = p.free > 0 ? 0.7 : 2.2;
        let tx = wind + sway * fallV * 0.9, ty = fallV * (0.45 + 0.75 * sway * sway);
        if (lawn) ty = Math.sin(p.ph * 0.6) * fallV * 0.6 + fallV * 0.2;
        if (gOn && Math.abs(p.x - gx) < sz * 10 && !lawn) tx += gDir * fallV * 3;
        p.vx += (tx - p.vx) * Math.min(1, dt * k);
        p.vy += (ty - p.vy) * Math.min(1, dt * k);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (lawn) {
          p.z -= dt / p.zt;
          if (p.z <= 0) {
            air.splice(i, 1);
            if (p.x > -sz && p.x < s.W + sz && p.y > -sz && p.y < s.H + sz && rest.length < cap) settle(p.x, p.y, p.k, false);
            continue;
          }
        } else if (p.free <= 0 && p.vy > 0) {
          const b = Math.floor(p.x / bw);
          if (b >= 0 && b < bins.length && p.y >= s.H - bins[b] - sz * 0.1) {
            air.splice(i, 1);
            settle(p.x, p.y, p.k, false);
            continue;
          }
        }
        if (p.x < -sz * 3 || p.x > s.W + sz * 3 || p.y > s.H + sz * 2 || p.y < -s.H) air.splice(i, 1);
      }
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        sz = clamp(m * 0.07, 22, 48);
        fallV = clamp(m * 0.07, 28, 58);
        bw = sz * 0.6;
        maxH = clamp(m * 0.13, 40, 120);
        nAir = Math.round(clamp(s.W * s.H / (lawn ? 45000 : 27000), lawn ? 9 : 14, lawn ? 28 : 42));
        cap = Math.round(lawn ? clamp(s.W * s.H / 2600, 60, 520) : clamp(s.W / bw * 5, 60, 520));
        top = lawn ? 0 : s.H - maxH - sz * 1.3;
        bandH = s.H - top;
        // Rest on the ground keeps its height off the bottom edge, so the drifts survive a resize.
        rest = rest.filter((r) => r.x < s.W + sz && (!lawn || r.y < s.H + sz));
        air = air.filter((p) => p.x < s.W + sz * 2);
        bins = new Float32Array(Math.ceil(s.W / bw) + 1);
        if (!lawn) for (const r of rest) { r.b = clamp(Math.floor(r.x / bw), 0, bins.length - 1); heap(r.b, 1); }
        const n = Math.ceil(s.W / STRIP);
        strips = [];
        for (let i = 0; i < n; i++) {
          const c = document.createElement('canvas');
          c.width = Math.ceil(Math.min(STRIP, s.W - i * STRIP) * s.dpr);
          c.height = Math.ceil(bandH * s.dpr);
          strips.push(c);
        }
        dirty = strips.map(() => true);
        if (!warmed) {
          warmed = true;
          // Start part-way through: a drift already down and leaves all the way through the air.
          const pre = Math.round(cap * (lawn ? 0.3 : 0.35));
          for (let i = 0; i < pre; i++) settle(rng.random() * s.W, rng.random() * s.H, rng.int(nk), true);
          for (let i = 0; i < nAir; i++) {
            const p = leaf(rng.random() * s.W, rng.random() * s.H * (lawn ? 1 : 0.85));
            p.z = 0.15 + rng.random() * 0.8;
            air.push(p);
          }
          for (let i = 0; i < 20; i++) tick(1 / 30);
        }
        strips.forEach((_, i) => repaint(i));
      },
      step(dt) {
        tick(dt);
        // Lifting leaves dirties strips; repaint them a few times a second rather than every frame.
        if (++frame % 4 === 0) dirty.forEach((d, i) => { if (d) repaint(i); });
      },
      draw() {
        const { ctx } = s;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const oy = Math.round(top * s.dpr);
        strips.forEach((c, i) => ctx.drawImage(c, Math.round(i * STRIP * s.dpr), oy));
        if (lawn) {
          // Shadows first: the higher a leaf, the further its shadow lies from it.
          for (const p of air) {
            if (p.free > 0) continue;
            ctx.globalAlpha = (s.dark ? 0.3 : 0.14) * clamp((1 - p.z) * 3, 0, 1);
            place(ctx, p.x + p.z * sz * 2.4, p.y + p.z * sz * 3, p.r, Math.cos(p.fp), 1, 0, 0);
            ctx.drawImage(shades[p.k % SHAPES], -sz / 2, -sz / 2, sz, sz);
          }
        }
        for (const p of air) {
          let f = Math.cos(p.fp);
          f = (f < 0 ? -1 : 1) * Math.max(0.2, Math.abs(f));
          let a = alpha * (f < 0 ? 0.8 : 1);
          if (p.whirl) a *= 0.75 + 0.25 * Math.cos(p.wa);
          if (lawn && p.free <= 0) a *= clamp((1 - p.z) * 3, 0, 1);
          ctx.globalAlpha = a;
          const sc = lawn ? 1 + p.z * 0.7 : 1;
          place(ctx, p.x, p.y, p.r + 0.5 * Math.sin(p.ph), f, sc, 0, 0);
          ctx.drawImage(sprites[p.k], -sz / 2, -sz / 2, sz, sz);
        }
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      },
    };
  });
}

/** A leaf as a sprite, stem down, its veins cut out. @param {string} color @param {number} shape
 * 0 maple, 1 beech, 2 oak @returns {HTMLCanvasElement} */
function leafSprite(color, shape) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  /** @type {number[][]} */
  let veins = [];
  if (shape === 0) {
    // Five pointed lobes round a centre, notched between.
    const pts = [[0, 28], [22, 12], [44, 25], [72, 11], [100, 21], [130, 8], [180, 5], [230, 8], [260, 21], [288, 11], [316, 25], [338, 12]];
    pts.forEach(([a, r], i) => {
      const t = a * Math.PI / 180, x = 32 + r * Math.sin(t), y = 36 - r * Math.cos(t);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    veins = [0, 44, 100, 260, 316].map((a) => { const t = a * Math.PI / 180; return [32, 36, 32 + 20 * Math.sin(t), 36 - 20 * Math.cos(t)]; });
  } else if (shape === 1) {
    g.moveTo(32, 50);
    g.bezierCurveTo(56, 42, 50, 14, 32, 5);
    g.bezierCurveTo(14, 14, 8, 42, 32, 50);
    veins = [[32, 50, 32, 9]];
    for (let i = 0; i < 4; i++) { const y = 42 - i * 8; veins.push([32, y, 44 - i * 2, y - 7], [32, y, 20 + i * 2, y - 7]); }
  } else {
    // Rounded lobes along a long blade.
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const t = i / N, w = 13 * Math.pow(Math.sin(Math.PI * t), 0.7) * (0.68 + 0.32 * Math.cos(TAU * 3.5 * t + 0.3));
      const x = 32 + w, y = 52 - t * 46;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N, w = 13 * Math.pow(Math.sin(Math.PI * t), 0.7) * (0.68 + 0.32 * Math.cos(TAU * 3.5 * t + 0.3));
      g.lineTo(32 - w, 52 - t * 46);
    }
    veins = [[32, 52, 32, 10]];
  }
  g.closePath();
  g.fill();
  g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(32, shape === 0 ? 38 : 49); g.lineTo(32, 60); g.stroke();
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = 0.55;
  g.lineWidth = 1.6;
  g.beginPath();
  for (const [x0, y0, x1, y1] of veins) { g.moveTo(x0, y0); g.lineTo(x1, y1); }
  g.stroke();
  return c;
}

