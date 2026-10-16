// Planet: a ringed gas giant lit from one side, its cloud bands and storms turning slowly round
// the sphere, the rings passing behind it and across its face, and moons crossing in front with
// their shadows sliding over the bands. Layout 0: three-quarter view, rings open, one moon on a
// tilted orbit passing in front and then behind. 1: a giant rising from a lower corner, its rings
// a broad arc across the sky, a large cratered moon gliding over it. 2: rings edge-on, a string of
// small moons shuttling along the ring plane, their shadow dots crossing the bands.

import { stage, TAU, clamp, mix } from './stage.js';

/** @typedef {[number, number, number]} RGB */
/** @typedef {{x:number, y:number, w:number, h:number}} Box */
/** @typedef {{cv:HTMLCanvasElement, x:number, y:number}} Tile */
/** @typedef {{A:number, B:number, g:number, w:number, a:number, r:number, c:number, line:boolean, sp?:HTMLCanvasElement}} Moon
 * An orbit's half axes A, B (CSS px) turned by g, angular speed w, angle a; r the moon's radius.
 * A line moon ignores the orbit and glides across in front, a from 0 to 1 and round again. */

const TW = 640, TH = 320;
/** Texture rows run over sin(latitude) from SPAN down to -SPAN, the caps beyond +-1. */
const SPAN = 1.3;
/** Pixels in the sphere's low-res layer, at most: each is looked up in the texture per frame. */
const BUDGET = 46000;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const cols = s.colors.map(rgbOf);
    const nc = cols.length;
    const pA = rng.int(nc), pB = (pA + 1 + rng.int(Math.max(1, nc - 1))) % nc;
    const tex = bands(rng, cols[pA], cols[pB]);
    const TX = tex.getContext('2d')?.getImageData(0, 0, TW, TH).data ?? new Uint8ClampedArray(TW * TH * 4);
    const qx = rng.random() < 0.5 ? -1 : 1;
    // The light's direction, toward the viewer and to one side.
    const lv = norm(L === 2 ? [-0.75 * qx, -0.15, 0.65] : [-0.55 * qx, -0.42, 0.72]);
    const layer = document.createElement('canvas');
    const lg = layer.getContext('2d');
    /** @type {ImageData|null} */
    let img = null;
    // Per layer pixel inside the disc: its index, texture longitude (px), row start, the blend
    // toward the next row (/256) and alpha.
    let pix = new Int32Array(0), lon = new Float32Array(0), rowAt = new Int32Array(0), frac = new Uint8Array(0), alp = new Uint8Array(0);
    let cx = 0, cy = 0, R = 100, sinE = 0.3, cosE = 1, Ri = 1.3, Ro = 2.25, sc = 1, rot = rng.random() * TAU;
    /** @type {Box} */
    let V = { x: 0, y: 0, w: 1, h: 1 };
    /** @type {Tile[]} */
    let back = [];
    /** @type {Tile[]} */
    let front = [];
    /** @type {Moon[]} */
    let moons = [];
    /** @type {{x:number, y:number, r:number, f:number, p:number}[]} */
    let stars = [];

    /** @param {number} n */
    function makeMoons(n) {
      if (moons.length === n) return;
      moons = [];
      for (let i = 0; i < n; i++) {
        moons.push({ A: 0, B: 0, g: 0, w: 0, a: rng.random() * TAU, r: 0, c: (pB + 1 + i) % nc, line: false });
      }
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        if (L === 0) {
          R = clamp(Math.min(s.W * (s.W < s.H ? 0.27 : 0.19), s.H * 0.3), 50, 320);
          cx = s.W * (0.5 + 0.04 * qx); cy = s.H * 0.47; sinE = 0.36; Ri = 1.3; Ro = 2.25;
          makeMoons(1);
          const mo = moons[0];
          mo.A = R * 2.7; mo.B = R * 0.5; mo.g = 0.1 * qx; mo.w = TAU / 46; mo.r = clamp(R * 0.12, 6, 30);
        } else if (L === 1) {
          R = Math.max(s.W, s.H) * 0.55;
          cx = qx > 0 ? s.W * 0.97 : s.W * 0.03; cy = s.H * 0.47 + R; sinE = 0.55; Ri = 1.25; Ro = 2.3;
          makeMoons(2);
          const [big, far] = moons;
          big.line = true; big.r = clamp(m * 0.075, 18, 70); big.w = 1 / 75;
          far.A = R * 1.6; far.B = R * 0.5; far.g = -0.25 * qx; far.w = TAU / 140; far.r = clamp(m * 0.02, 5, 16);
        } else {
          R = clamp(Math.min(s.W * (s.W < s.H ? 0.3 : 0.2), s.H * 0.3), 50, 300);
          cx = s.W / 2; cy = s.H / 2; sinE = 0.05; Ri = 1.3; Ro = 2.3;
          const n = clamp(Math.round(s.W / 300), 3, 5);
          makeMoons(n);
          moons.forEach((mo, i) => {
            mo.A = mix(R * 1.5, Math.max(R * 2, s.W * 0.47), i / (n - 1));
            mo.B = mo.A * sinE + R * 0.12 * (i % 2 ? -1 : 1);
            mo.g = 0; mo.w = (TAU / 22) * Math.pow(R * 1.5 / mo.A, 1.5);
            mo.r = clamp(R * (0.05 + 0.03 * ((i * 7) % 3)), 3, 16);
          });
        }
        cosE = Math.sqrt(1 - sinE * sinE);
        for (const mo of moons) mo.sp = moonSprite(cols[mo.c], mo.r, s.dpr, lv, rng);
        // The planet's layer covers only its visible part, at most 800px a side.
        const x0 = Math.max(0, cx - R), y0 = Math.max(0, cy - R);
        V = { x: x0, y: y0, w: Math.max(1, Math.min(s.W, cx + R) - x0), h: Math.max(1, Math.min(s.H, cy + R) - y0) };
        sc = Math.min(s.dpr, Math.sqrt(BUDGET / (V.w * V.h)));
        layer.width = Math.max(1, Math.ceil(V.w * sc)); layer.height = Math.max(1, Math.ceil(V.h * sc));
        mapSphere();
        bakeRing();
        const n = clamp(Math.round(s.W * s.H / 9000), 30, 180);
        if (stars.length !== n) {
          stars = [];
          for (let i = 0; i < n; i++) {
            stars.push({ x: rng.random(), y: rng.random(), r: 0.6 + rng.random() * 0.9, f: 0.08 + rng.random() * 0.12, p: rng.random() * TAU });
          }
        }
      },
      step(dt) {
        rot += dt * TAU / (L === 1 ? 240 : 150);
        for (const mo of moons) {
          if (mo.line) mo.a = (mo.a + mo.w * dt) % 1;
          else mo.a += mo.w * dt;
        }
      },
      draw() {
        const { ctx } = s;
        // Stars, off the planet's disc, each breathing on a slow beat.
        ctx.fillStyle = s.ink;
        for (const st of stars) {
          const x = st.x * s.W, y = st.y * s.H;
          if ((x - cx) ** 2 + (y - cy) ** 2 < R * R * 1.05) continue;
          ctx.globalAlpha = (s.dark ? 0.2 : 0.22) + 0.2 * Math.sin(s.t * st.f * TAU + st.p);
          ctx.fillRect(x, y, st.r * 1.6, st.r * 1.6);
        }
        const pos = moons.map(place);
        for (const p of pos) if (p.z < 0) moon(p, true);
        ctx.globalAlpha = 1;
        tiles(back);
        globe(pos);
        ctx.globalAlpha = s.dark ? 0.46 : 0.52;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
        ctx.drawImage(layer, V.x, V.y, layer.width / sc, layer.height / sc);
        ctx.restore();
        ctx.globalAlpha = 1;
        tiles(front);
        for (const p of pos) if (p.z >= 0) moon(p, false);
      },
    };

    /** Where a moon is now: x, y, depth z (>0 in front), its scale k. @param {Moon} mo */
    function place(mo) {
      if (mo.line) {
        // Across the screen in front, from off one edge to off the other.
        const u = mo.a * 1.4 - 0.2;
        const x = qx > 0 ? mix(-mo.r * 2, s.W + mo.r * 2, u) : mix(s.W + mo.r * 2, -mo.r * 2, u);
        return { mo, x, y: mix(s.H * 0.55, s.H * 0.72, u), z: 1, k: 1 };
      }
      const ca = Math.cos(mo.a), sa = Math.sin(mo.a);
      const ox = mo.A * ca, oy = mo.B * sa;
      return { mo, x: cx + ox * Math.cos(mo.g) - oy * Math.sin(mo.g), y: cy + ox * Math.sin(mo.g) + oy * Math.cos(mo.g), z: sa, k: 1 + 0.08 * sa };
    }

    /** @param {{mo:Moon, x:number, y:number, z:number, k:number}} p @param {boolean} behind */
    function moon(p, behind) {
      const { ctx } = s;
      const sp = p.mo.sp;
      if (!sp) return;
      const d = p.mo.r * p.k * 1.1;
      if (p.x < -d || p.x > s.W + d || p.y < -d || p.y > s.H + d) return;
      ctx.globalAlpha = s.dark ? 0.62 : 0.66;
      if (behind && Math.hypot(p.x - cx, p.y - cy) < R + d) {
        // Hidden where the planet stands in front.
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x - d, p.y - d, d * 2, d * 2);
        ctx.arc(cx, cy, R, 0, TAU);
        ctx.clip('evenodd');
        ctx.drawImage(sp, p.x - d, p.y - d, d * 2, d * 2);
        ctx.restore();
      } else {
        ctx.drawImage(sp, p.x - d, p.y - d, d * 2, d * 2);
      }
    }

    /** Maps each layer pixel on the disc to the texture: latitude row and longitude seen from a
     * little above the equator, with its lit alpha. Once per size. */
    function mapSphere() {
      if (!lg) return;
      const w = layer.width, h = layer.height;
      img = lg.createImageData(w, h);
      const P = [], Lo = [], Ro2 = [], Fr = [], Al = [];
      // One px of margin past the rim; the clip in draw() makes the edge.
      const lim = 1 + 1.5 / (R * sc);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const nx = ((V.x + (i + 0.5) / sc) - cx) / R, ny = ((V.y + (j + 0.5) / sc) - cy) / R;
          const d2 = nx * nx + ny * ny;
          if (d2 > lim * lim) continue;
          const nz = Math.sqrt(Math.max(0, 1 - d2));
          // Undo the view's tilt: body north and body depth from screen up and depth.
          const up = -ny, Y = up * cosE + nz * sinE, Z = -up * sinE + nz * cosE;
          let lo = (Math.atan2(nx, Z) / TAU) * TW;
          if (lo < 0) lo += TW;
          const rv = clamp(((SPAN - Y) / (2 * SPAN)) * TH - 0.5, 0, TH - 1.001);
          const row = Math.floor(rv);
          const lam = nx * lv[0] + ny * lv[1] + nz * lv[2];
          const a = clamp(lam * 1.3 + 0.2, 0.16, 1) * (0.72 + 0.28 * nz);
          P.push((j * w + i) * 4); Lo.push(lo); Ro2.push(row * TW); Fr.push(Math.round((rv - row) * 256)); Al.push(Math.round(a * 255));
        }
      }
      pix = Int32Array.from(P); lon = Float32Array.from(Lo); rowAt = Int32Array.from(Ro2); frac = Uint8Array.from(Fr); alp = Uint8Array.from(Al);
    }

    /** Paints the turning sphere into its layer from the texture, then takes out moons' discs
     * and their shadows. @param {{mo:Moon, x:number, y:number, z:number, k:number}[]} pos */
    function globe(pos) {
      if (!lg || !img) return;
      const D = img.data;
      const off = ((rot / TAU) % 1) * TW;
      for (let k = 0; k < pix.length; k++) {
        let x = (lon[k] + off) | 0;
        if (x >= TW) x -= TW;
        // Blended down the rows, so band edges stay smooth when the layer is scaled up.
        const a = (rowAt[k] + x) * 4, b = a + TW * 4, f = frac[k], o = pix[k];
        D[o] = TX[a] + (((TX[b] - TX[a]) * f) >> 8);
        D[o + 1] = TX[a + 1] + (((TX[b + 1] - TX[a + 1]) * f) >> 8);
        D[o + 2] = TX[a + 2] + (((TX[b + 2] - TX[a + 2]) * f) >> 8);
        D[o + 3] = alp[k];
      }
      lg.putImageData(img, 0, 0);
      // A moon in front hides the bands behind it and throws a small shadow down-light of it.
      lg.setTransform(sc, 0, 0, sc, -V.x * sc, -V.y * sc);
      for (const p of pos) {
        if (p.z < 0) continue;
        const r = p.mo.r * p.k;
        const sh = Math.min(R * 0.2, r * 1.2) * (0.6 + 0.4 * p.z);
        const sxp = p.x - lv[0] * sh, syp = p.y - lv[1] * sh;
        if (Math.hypot(sxp - cx, syp - cy) < R + r) {
          lg.globalCompositeOperation = 'source-atop';
          lg.globalAlpha = 0.6;
          lg.fillStyle = '#000';
          lg.beginPath(); lg.arc(sxp, syp, r * 0.95, 0, TAU); lg.fill();
        }
        if (Math.hypot(p.x - cx, p.y - cy) < R + r) {
          lg.globalCompositeOperation = 'destination-out';
          lg.globalAlpha = 1;
          lg.beginPath(); lg.arc(p.x, p.y, r * 0.98, 0, TAU); lg.fill();
        }
      }
      lg.setTransform(1, 0, 0, 1, 0, 0);
      lg.globalAlpha = 1;
      lg.globalCompositeOperation = 'source-over';
    }

    /** Draws baked tiles 1:1 at device pixels. @param {Tile[]} ts */
    function tiles(ts) {
      const { ctx } = s;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const t of ts) ctx.drawImage(t.cv, t.x, t.y);
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    }

    /** Bakes the rings at device pixels, split into a far half (with the planet's disc cut out)
     * and a near half, kept as tiles only where the ring actually is. */
    function bakeRing() {
      const d = s.dpr;
      const ry = Ro * R * sinE;
      const bx0 = Math.max(0, Math.floor((cx - Ro * R - 2) * d)), bx1 = Math.min(s.cv.width, Math.ceil((cx + Ro * R + 2) * d));
      const by0 = Math.max(0, Math.floor((cy - ry - 3) * d)), by1 = Math.min(s.cv.height, Math.ceil((cy + ry + 3) * d));
      back = []; front = [];
      if (bx1 <= bx0 || by1 <= by0) return;
      const tmp = document.createElement('canvas');
      tmp.width = bx1 - bx0; tmp.height = by1 - by0;
      const g = tmp.getContext('2d');
      if (!g) return;
      g.setTransform(d, 0, 0, d, -bx0, -by0);
      ringBands(g);
      // Split at the centre line: the far half loses the disc, the near half keeps it.
      const midY = Math.round(cy * d);
      const far = cut(tmp, by0, by0, Math.min(by1, midY));
      const fg = far.cv?.getContext('2d');
      if (fg && far.cv) {
        fg.setTransform(d, 0, 0, d, -bx0, -far.y0);
        fg.globalCompositeOperation = 'destination-out';
        fg.beginPath(); fg.arc(cx, cy, R * 0.998, 0, TAU); fg.fill();
        back = split(far.cv, bx0, far.y0);
      }
      const near = cut(tmp, by0, Math.max(by0, midY), by1);
      if (near.cv) front = split(near.cv, bx0, near.y0);
    }

    /** Rows y0..y1 (device px) of a canvas whose top is at by0. @param {HTMLCanvasElement} src
     * @param {number} by0 @param {number} y0 @param {number} y1 */
    function cut(src, by0, y0, y1) {
      if (y1 <= y0) return { cv: null, y0 };
      const c = document.createElement('canvas');
      c.width = src.width; c.height = y1 - y0;
      c.getContext('2d')?.drawImage(src, 0, by0 - y0);
      return { cv: c, y0 };
    }

    /** Splits a baked half into 256px tiles, keeping those the ring's band crosses.
     * @param {HTMLCanvasElement} src @param {number} ox @param {number} oy device px @returns {Tile[]} */
    function split(src, ox, oy) {
      const T = 256, d = s.dpr, out = [];
      const rx = R * d, ryy = R * d * sinE, ccx = cx * d, ccy = cy * d;
      for (let ty = 0; ty < src.height; ty += T) {
        for (let tx = 0; tx < src.width; tx += T) {
          const w = Math.min(T, src.width - tx), h = Math.min(T, src.height - ty);
          // Nearest and farthest points of the tile, in units where the ring is round.
          const X0 = (ox + tx - ccx) / rx, X1 = (ox + tx + w - ccx) / rx;
          const Y0 = (oy + ty - ccy) / ryy, Y1 = (oy + ty + h - ccy) / ryy;
          const nx = clamp(0, X0, X1), ny = clamp(0, Y0, Y1);
          const lo = Math.hypot(nx, ny);
          const hi = Math.hypot(Math.max(Math.abs(X0), Math.abs(X1)), Math.max(Math.abs(Y0), Math.abs(Y1)));
          if (hi < Ri - 0.05 || lo > Ro + 0.05) continue;
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d')?.drawImage(src, -tx, -ty);
          out.push({ cv: c, x: ox + tx, y: oy + ty });
        }
      }
      return out;
    }

    /** The rings as many thin ellipses, their density rising and falling with a gap or two.
     * @param {CanvasRenderingContext2D} g */
    function ringBands(g) {
      const n = 46, lw = ((Ro - Ri) * R) / n;
      const gap = Ri + (Ro - Ri) * (0.6 + rng.random() * 0.12);
      const ca = cols[pA], cb = cols[(pB + 1) % nc];
      g.lineWidth = lw * 1.6;
      // Edge-on, the near and far sides overlap: fainter so the line does not burn.
      const k = (L === 2 ? 0.55 : L === 1 ? 0.62 : 1) * (s.dark ? 0.42 : 0.5);
      for (let i = 0; i < n; i++) {
        const r = Ri + (Ro - Ri) * (i + 0.5) / n;
        if (Math.abs(r - gap) < 0.06) continue;
        const f = (r - Ri) / (Ro - Ri);
        const dens = (0.35 + 0.65 * Math.sin(Math.PI * Math.pow(f, 0.7))) * (0.82 + 0.18 * rng.random());
        g.globalAlpha = k * dens;
        g.strokeStyle = css(mixc(ca, cb, f));
        g.beginPath(); g.ellipse(cx, cy, r * R, r * R * sinE, 0, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
    }
  });
}

/** @param {number[]} v @returns {[number, number, number]} */
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

/** @param {RGB} a @param {RGB} b @param {number} u @returns {RGB} */
const mixc = (a, b, u) => [mix(a[0], b[0], u), mix(a[1], b[1], u), mix(a[2], b[2], u)];
/** @param {RGB} c @returns {string} */
const css = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

/**
 * An alpha mask of a lit sphere: full on the day side, faint on the night side, darker toward
 * the limb, antialiased at the rim. Made once per size.
 * @param {number} w @param {number} h px @param {(i:number, j:number) => [number, number]} at the
 *   sphere's unit coordinates of pixel i, j @param {number} rpx the radius in px
 * @param {[number, number, number]} lv light direction @returns {HTMLCanvasElement}
 */
function shade(w, h, at, rpx, lv) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) return c;
  const img = g.createImageData(w, h);
  const D = img.data;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const [nx, ny] = at(i, j);
      const d2 = nx * nx + ny * ny;
      if (d2 >= 1.01) continue;
      const nz = Math.sqrt(Math.max(0, 1 - d2));
      const lam = nx * lv[0] + ny * lv[1] + nz * lv[2];
      let a = clamp(lam * 1.3 + 0.2, 0.16, 1) * (0.72 + 0.28 * nz);
      a *= clamp((1 - Math.sqrt(d2)) * rpx + 0.5, 0, 1);
      D[(j * w + i) * 4 + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * The cloud bands as a texture two turns wide (so a slice never wraps): belts and zones with
 * wavy edges, streaks along them, and a few storm ovals.
 * @param {import('../rng.js').Rng} rng @param {RGB} A @param {RGB} B @returns {HTMLCanvasElement}
 */
function bands(rng, A, B) {
  const one = document.createElement('canvas');
  one.width = TW; one.height = TH;
  const g = one.getContext('2d');
  const out = document.createElement('canvas');
  out.width = TW * 2; out.height = TH;
  if (!g) return out;
  /** @type {RGB} */
  const W1 = [255, 255, 255];
  /** @type {RGB} */
  const K1 = [40, 40, 50];
  /** @type {RGB} */
  const cap = mixc(mixc(A, B, 0.6), K1, 0.25);
  g.fillStyle = css(cap);
  g.fillRect(0, 0, TW, TH);
  const row = (/** @type {number} */ sv) => ((SPAN - sv) / (2 * SPAN)) * TH;
  let sv = 0.9, zone = true;
  /** @type {{y:number, c:RGB}[]} */
  const edges = [];
  while (sv > -0.9) {
    const near = 1 - Math.abs(sv);
    const wdt = (0.05 + rng.random() * 0.12) * (0.7 + near * 0.8);
    /** @type {RGB} */
    const c = zone ? mixc(A, W1, 0.25 + rng.random() * 0.25) : mixc(mixc(A, B, 0.45 + rng.random() * 0.55), K1, rng.random() * 0.2);
    edges.push({ y: row(sv), c });
    sv -= wdt; zone = !zone;
  }
  edges.push({ y: row(-0.9), c: cap });
  for (const e of edges) {
    const k1 = 2 + rng.int(6), k2 = 7 + rng.int(9), a1 = 0.6 + rng.random() * 2.2, a2 = rng.random() * 1.2, p1 = rng.random() * TAU, p2 = rng.random() * TAU;
    g.fillStyle = css(e.c);
    g.beginPath();
    g.moveTo(0, TH);
    for (let x = 0; x <= TW; x += 8) {
      const u = (x / TW) * TAU;
      g.lineTo(x, e.y + a1 * Math.sin(k1 * u + p1) + a2 * Math.sin(k2 * u + p2));
    }
    g.lineTo(TW, TH);
    g.closePath();
    g.fill();
  }
  // Streaks along the bands.
  g.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const y = row(0.85 - rng.random() * 1.7), k = 1 + rng.int(5), a = 0.5 + rng.random() * 1.5, p = rng.random() * TAU;
    const x0 = rng.random() * TW, len = 80 + rng.random() * 260;
    g.strokeStyle = css(rng.random() < 0.5 ? W1 : B);
    g.globalAlpha = 0.18;
    for (const off of [0, -TW]) {
      g.beginPath();
      for (let x = x0; x <= x0 + len; x += 8) g.lineTo(x + off, y + a * Math.sin((x / TW) * TAU * k + p));
      g.stroke();
    }
  }
  // Storms: one great oval with a pale rim, and a few small white ones.
  const ovals = [{ x: rng.random() * TW, y: row(-0.25 - rng.random() * 0.2), rx: 34, ry: 13, c: mixc(B, W1, 0.15), rim: true }];
  for (let i = 0; i < 6; i++) ovals.push({ x: rng.random() * TW, y: row(rng.random() * 1.4 - 0.7), rx: 5 + rng.random() * 6, ry: 2.5 + rng.random() * 2, c: mixc(A, W1, 0.6), rim: false });
  for (const o of ovals) {
    for (const off of [0, -TW, TW]) {
      if (o.rim) {
        g.globalAlpha = 0.5; g.fillStyle = css(mixc(A, W1, 0.55));
        g.beginPath(); g.ellipse(o.x + off, o.y, o.rx * 1.3, o.ry * 1.45, 0, 0, TAU); g.fill();
      }
      g.globalAlpha = 0.9; g.fillStyle = css(o.c);
      g.beginPath(); g.ellipse(o.x + off, o.y, o.rx, o.ry, 0, 0, TAU); g.fill();
    }
  }
  g.globalAlpha = 1;
  // Softened by a trip through half size, so band edges never stair-step or shimmer as it turns.
  const half = document.createElement('canvas');
  half.width = TW / 2; half.height = TH / 2;
  half.getContext('2d')?.drawImage(one, 0, 0, TW / 2, TH / 2);
  g.clearRect(0, 0, TW, TH);
  g.drawImage(half, 0, 0, TW, TH);
  const og = out.getContext('2d');
  og?.drawImage(one, 0, 0);
  og?.drawImage(one, TW, 0);
  return out;
}

/**
 * A moon as a sprite at device pixels: a disc with darker craters, lit from the light's side.
 * @param {RGB} c @param {number} r CSS px @param {number} dpr @param {[number, number, number]} lv
 * @param {import('../rng.js').Rng} rng @returns {HTMLCanvasElement}
 */
function moonSprite(c, r, dpr, lv, rng) {
  const n = Math.max(4, Math.ceil(r * 2.2 * dpr));
  const rp = n / 2.2;
  const lit = shade(n, n, (i, j) => [(i + 0.5 - n / 2) / rp, (j + 0.5 - n / 2) / rp], rp, lv);
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d');
  if (!g) return cv;
  g.fillStyle = css(mixc(c, [255, 255, 255], 0.3));
  g.fillRect(0, 0, n, n);
  g.fillStyle = css(mixc(c, [30, 30, 40], 0.35));
  for (let i = 0; i < 7; i++) {
    const a = rng.random() * TAU, d = Math.sqrt(rng.random()) * rp * 0.75;
    g.beginPath(); g.arc(n / 2 + Math.cos(a) * d, n / 2 + Math.sin(a) * d, rp * (0.08 + rng.random() * 0.16), 0, TAU); g.fill();
  }
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(lit, 0, 0);
  return cv;
}

/** A colour string's channels. @param {string} color @returns {RGB} */
function rgbOf(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = '#888';
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = v.match(/[\d.]+/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
}
