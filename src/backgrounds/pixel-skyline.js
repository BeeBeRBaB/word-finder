// Pixel skyline: banded sky, moon or sun, clouds drifting behind a flickering city.
import { pixelStage } from './pixel-stage.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean}} BackgroundOptions
 * @typedef {{near:boolean, s:HTMLCanvasElement, x:number, y:number, v:number}} Cloud
 */

const { ceil, floor, max, min, round } = Math;
const THEMES = {
  dark: {
    sky: ['#0b0a22', '#141236', '#1f1847', '#2d1e55', '#44265c', '#62305e'],
    orb: ['#fff1cf', '#e3cf9c', '#2a2152'], star: '#fff6d8',
    cloud: ['#65569a', '#382c64', '#281f4c'],
    far: '#2a2150', fe: '#3a2f68', near: ['#160f2e', '#1b1336'], ne: '#2b2150',
    win: ['#ffd36b', '#ffb04a', '#ff8a5c', '#8fe3ff', '#ffe9a8'], glass: null, lit: 0.32,
  },
  light: {
    sky: ['#6fc3ec', '#8fd1f0', '#b1def2', '#d3eaf0', '#f4e6d8', '#ffd9bd'],
    orb: ['#fff6c4', '#ffe38a', '#d9eef3'], star: null,
    cloud: ['#ffffff', '#f4f8ff', '#d3def0'],
    far: '#a9b8dc', fe: '#bfcbe8', near: ['#6b76a8', '#7480b2'], ne: '#8d98c6',
    win: ['#ffffff', '#fff4c2'], glass: '#9fb4e0', lit: 0.08,
  },
};

/** @param {HTMLElement} host @param {Partial<BackgroundOptions>} [opts] @returns {() => void} stop */
export function start(host, opts = {}) {
  const T = THEMES[opts.dark === false ? 'light' : 'dark'];
  const mk = () => document.createElement('canvas'), bg = mk(), city = mk();
  const [b, g] = [bg, city].map(c => /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')));
  const stage = b && g && pixelStage(host);
  if (!stage) return () => {};
  const ctx = stage.ctx;

  let W = 0, H = 0, t = 0, sd = 1;
  /** @type {Cloud[]} */ let clouds = [];
  /** @type {{x:number, y:number, c:string, on:boolean, n:number}[]} */ let wins = [];
  /** @type {number[][]} */ let blink = [];
  /** @type {number[][]} */ let stars = [];
  /** @returns {number} */
  const rand = () => (sd = sd * 16807 % 2147483647) / 2147483647;

  /** @param {number} w @returns {HTMLCanvasElement} */
  function sprite(w) {
    const h = ceil(w * 0.42), c = mk(), s = c.getContext('2d');
    c.width = w; c.height = h;
    /** @type {number[][]} */
    const puffs = [];
    for (let i = 0, n = 3 + (w / 9 | 0); i < n; i++) {
      const r = w * (0.13 + rand() * 0.13);
      puffs.push([r + rand() * (w - 2 * r), h - 1 - r * (0.55 + rand() * 0.35), r]);
    }
    if (!s) return c;
    /** @param {number} x @param {number} y @returns {boolean} */
    const inside = (x, y) => y < h - 1 && puffs.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      s.fillStyle = T.cloud[!inside(x, y - 1) ? 0 : y >= h - 3 || !inside(x, y + 2) ? 2 : 1];
      s.fillRect(x, y, 1, 1);
    }
    return c;
  }

  /** @param {Cloud} c @param {boolean} any @returns {void} */
  function newCloud(c, any) {
    const n = c.near;
    c.x = any ? rand() * W : W + rand() * 30;
    c.y = round(H * (n ? 0.12 + rand() * 0.4 : 0.05 + rand() * 0.35));
    c.v = n ? 2.2 + rand() * 1.6 : 0.9 + rand() * 0.8;
  }

  /** @returns {void} */
  function sky() {
    const n = T.sky.length, bh = H * 0.78 / n;
    for (let i = 0; i < n; i++) {
      b.fillStyle = T.sky[i];
      b.fillRect(0, i ? floor(i * bh) : 0, W, i === n - 1 ? H : ceil(bh) + 1);
    }
    for (let i = 1; i < n; i++) {
      const y = floor(i * bh);
      for (let x = 0; x < W; x++) {
        const m = x % 4;
        b.fillStyle = T.sky[m > 2 ? i - 1 : i];
        b.fillRect(x, y - (m & 1 ? m > 2 ? 0 : 2 : 1), 1, 1);
      }
    }
    // moon / sun with a dithered halo
    const r = max(4, round(min(W, H) * 0.07)), ox = round(W * 0.16), oy = round(H * 0.17);
    for (let y = -r - 4; y <= r + 4; y++) for (let x = -r - 4; x <= r + 4; x++) {
      const d = Math.sqrt(x * x + y * y);
      let c = null;
      if (d <= r) c = T.orb[d > r - 1.2 || T.star && (x + r / 3) ** 2 + (y + r / 4) ** 2 < r * r / 11 ? 1 : 0];
      else if (d <= r + 4 && (x + y) % 2 === 0 && (d <= r + 2 || (x % 4 === 0))) c = T.orb[2];
      if (c) { b.fillStyle = c; b.fillRect(ox + x, oy + y, 1, 1); }
    }
  }

  /** @param {boolean} near @returns {void} */
  function layer(near) {
    let x = -(rand() * 6 | 0), i = 0;
    const lo = near ? 0.1 : 0.2, hi = near ? 0.3 : 0.42;
    while (x < W) {
      const w = 7 + (rand() * (near ? 13 : 10) | 0);
      const top = H - round(H * (lo + rand() * (hi - lo)));
      g.fillStyle = near ? T.near[i++ % 2] : T.far;
      g.fillRect(x, top, w, H - top);
      const k = rand();
      if (k < 0.3 && w > 9) { const s = 2 + (rand() * 2 | 0); g.fillRect(x + s, top - 3, w - 2 * s, 3); }
      else if (k < 0.55) {
        const ax = x + (w / 2 | 0), ah = 3 + (rand() * 4 | 0);
        g.fillRect(ax, top - ah, 1, ah);
        blink.push([ax, top - ah - 1, rand() * 2]);
      }
      g.fillStyle = near ? T.ne : T.fe;
      g.fillRect(x, top, 1, H - top);
      for (let wy = top + 2; wy < H - 1; wy += 3) for (let wx = x + 2; wx < x + w - 1; wx += 2) {
        const r = rand();
        if (r < T.lit) {
          const c = T.win[rand() * T.win.length | 0];
          if (near && r < T.lit * 0.18 && wins.length < 48) {
            wins.push({ x: wx, y: wy, c, on: rand() < 0.6, n: rand() * 8 });
            continue;
          }
          g.globalAlpha = near ? 0.85 : 0.45;
          g.fillStyle = c;
        } else if (T.glass) { g.globalAlpha = near ? 0.5 : 0.3; g.fillStyle = T.glass; }
        else continue;
        g.fillRect(wx, wy, 1, 1);
        g.globalAlpha = 1;
      }
      x += w + (rand() < 0.3 ? 1 + (rand() * 3 | 0) : 0);
    }
  }

  /** @returns {void} */
  function paint() {
    sd = 20240926; wins = []; blink = []; stars = [];
    bg.width = city.width = W; bg.height = city.height = H;
    sky();
    if (T.star) {
      for (let i = 0, n = W * H / 220 | 0; i < n; i++) {
        const s = [rand() * W | 0, rand() * H * 0.6 | 0, rand() * 6.3, 0.8 + rand() * 2];
        if (i % 4) { b.globalAlpha = 0.35 + rand() * 0.35; b.fillStyle = T.star; b.fillRect(s[0], s[1], 1, 1); }
        else stars.push(s);
      }
      b.globalAlpha = 1;
    }
    layer(false); layer(true);
    clouds = [];
    for (let i = 0; i < 7; i++) {
      const near = i % 2 === 0;
      const c = { near, s: sprite(near ? 22 + (rand() * 16 | 0) : 12 + (rand() * 10 | 0)), x: 0, y: 0, v: 0 };
      newCloud(c, true);
      clouds.push(c);
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0);
    if (T.star) ctx.fillStyle = T.star;
    for (const [x, y, p, s] of stars) {
      const v = Math.sin(t * s + p);
      if (v < -0.2) continue;
      ctx.globalAlpha = v > 0.6 ? 1 : 0.5;
      ctx.fillRect(x, y, 1, 1);
    }
    for (const c of clouds) {
      ctx.globalAlpha = c.near ? 0.9 : 0.6;
      ctx.drawImage(c.s, round(c.x), c.y);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(city, 0, 0);
    for (const w of wins) if (w.on) { ctx.fillStyle = w.c; ctx.fillRect(w.x, w.y, 1, 1); }
    ctx.fillStyle = '#ff4a5a';
    for (const [x, y, p] of blink) if ((t + p) % 2 < 0.5) ctx.fillRect(x, y, 1, 1);
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    for (const c of clouds) if ((c.x -= c.v * dt) < -c.s.width) newCloud(c, false);
    for (const w of wins) if ((w.n -= dt) <= 0) { w.on = !w.on; w.n = 2 + rand() * 12; }
  }

  return stage.run({ resize(w, h) { W = w; H = h; paint(); }, step, draw }, !!opts.reducedMotion);
}
