// Pixel starfield: dithered nebula, a ringed planet, parallax twinkling and shooting stars.
import { pixelStage } from './pixel-stage.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean}} BackgroundOptions
 * @typedef {{x:number, y:number, l:number, c:string, ph:number, sp:number}} Star
 */

const { floor, max, min, random, round, sin } = Math;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const CROSS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
/** @param {string} h @returns {number[]} */
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

const THEMES = {
  dark: {
    sky: ['#07061a', '#110b2c', '#1e0f33', '#2a1230'],
    neb: ['#6a2c8c', '#1f6f8b', '#a8325e'],
    stars: ['#ffffff', '#fff3b0', '#9be7ff', '#ff9ecf', '#c9a8ff', '#ffc27a'],
    planet: ['#5a2230', '#b8513a', '#ff9a5a', '#ffd08a'],
    ring: ['#8e7cc3', '#d9ccff'],
    moon: ['#1d4a5a', '#3c8a9a', '#8fe0e0'],
    alpha: [0.3, 0.65, 1],
  },
  light: {
    sky: ['#efe6fb', '#f6e6f2', '#fbe8e2', '#fdeedd'],
    neb: ['#c8a4f0', '#9fd8e6', '#f7b0c8'],
    stars: ['#e0508a', '#2f9fc4', '#e2941a', '#8455d8', '#f06a3c', '#3aa878'],
    planet: ['#c0503a', '#ec7d4e', '#f9a870', '#ffd2a6'],
    ring: ['#9c86d8', '#cbbcf4'],
    moon: ['#3b8a9c', '#68b8c4', '#b4e6e8'],
    alpha: [0.35, 0.65, 0.95],
  },
};

/** @param {HTMLElement} host @param {Partial<BackgroundOptions>} [opts] @returns {() => void} stop */
export function start(host, opts = {}) {
  const T = THEMES[opts.dark === false ? 'light' : 'dark'];
  const bg = document.createElement('canvas');
  const bx = /** @type {CanvasRenderingContext2D} */ (bg.getContext('2d'));
  const stage = bx && pixelStage(host);
  if (!stage) return () => {};
  const ctx = stage.ctx;

  let W = 0, H = 0, nextShot = 3, t = 0;
  /** @type {Star[]} */ let stars = [];
  /** @type {{x:number, y:number, life:number} | null} */ let shot = null;

  /** @returns {void} */
  function paintBg() {
    const img = bx.createImageData(W, H), d = img.data;
    const sky = T.sky.map(rgb), n = sky.length - 1, neb = T.neb.map(rgb);
    const blobs = [[W * 0.2, H * 0.3, W * 0.28, H * 0.2, 0], [W * 0.75, H * 0.7, W * 0.3, H * 0.22, 1],
      [W * 0.5, H * 0.12, W * 0.22, H * 0.12, 2]];
    const pr = max(7, round(min(W, H) * 0.09)), pcx = round(min(W * 0.84, W - pr * 2.3)), pcy = round(H * 0.2);
    const mr = max(3, round(pr * 0.38)), mcx = round(W * 0.12), mcy = round(H * 0.8);
    const pal = T.planet.map(rgb), ring = T.ring.map(rgb), moon = T.moon.map(rgb);
    const ca = Math.cos(0.35), sa = sin(0.35);
    for (let y = 0; y < H; y++) {
      const f = y / H * n, i = min(n - 1, f | 0), fr = max(0, min(1, (f - i - 0.5) * 2.5 + 0.5));
      for (let x = 0; x < W; x++) {
        const b = BAYER[(y & 3) * 4 + (x & 3)], c = fr > b ? sky[i + 1] : sky[i];
        let r = c[0], g = c[1], bl = c[2];
        for (const [cx, cy, rx, ry, k] of blobs) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          const q = Math.exp(-(dx * dx + dy * dy) * 2.2) * (0.75 + 0.25 * sin(x * 0.3 + y * 0.5));
          const a = q > 0.55 + b * 0.4 ? 0.4 : q > b ? 0.2 : 0;
          if (a) { const m = neb[k]; r += (m[0] - r) * a; g += (m[1] - g) * a; bl += (m[2] - bl) * a; }
        }
        // ringed planet
        const dx = x - pcx, dy = y - pcy;
        const rx = dx * ca + dy * sa, ry = -dx * sa + dy * ca;
        const rq = (rx / (pr * 2.1)) ** 2 + (ry / (pr * 0.55)) ** 2;
        const onRing = rq > 0.55 && rq < 1 && (rq < 0.74 || rq > 0.8);
        const inP = dx * dx + dy * dy <= pr * pr;
        /** @type {number[] | null} */ let p = null;
        if (inP && !(onRing && ry > 0)) {
          const lit = (-dx - dy) / (pr * 1.5) + 0.35 + 0.12 * sin(ry * 1.4);
          p = pal[max(0, min(3, floor(lit * 2.2 + b + 1)))];
        } else if (onRing) p = ring[rq > 0.8 ? 0 : 1];
        // small moon
        const ex = x - mcx, ey = y - mcy;
        if (ex * ex + ey * ey <= mr * mr) {
          const lit = (-ex - ey) / (mr * 1.4) + 0.3;
          p = moon[max(0, min(2, floor(lit * 1.6 + b + 0.8)))];
        }
        if (p) { r = p[0]; g = p[1]; bl = p[2]; }
        const o = (y * W + x) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = bl; d[o + 3] = 255;
      }
    }
    bx.putImageData(img, 0, 0);
  }

  /** @returns {void} */
  function seed() {
    const count = min(170, round(W * H / 260));
    stars = [];
    for (let i = 0; i < count; i++) {
      const l = i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0;
      stars.push({
        x: random() * W, y: random() * H, l,
        c: T.stars[(random() * T.stars.length) | 0],
        ph: random() * 6.28, sp: 0.6 + random() * 2.2,
      });
    }
  }

  /** @param {number} x @param {number} y @param {number} a @param {string} c @returns {void} */
  function dot(x, y, a, c) { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }

  /** @returns {void} */
  function draw() {
    ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0);
    const A = T.alpha;
    for (const s of stars) {
      const x = s.x | 0, y = s.y | 0, v = sin(t * s.sp + s.ph);
      const lv = v > 0.55 ? 2 : v > -0.3 ? 1 : 0;
      if (s.l === 0) { dot(x, y, A[lv] * 0.7, s.c); continue; }
      dot(x, y, A[min(2, lv + 1)], s.c);
      if (s.l === 2 && lv > 0) {
        for (const [ox, oy] of CROSS) dot(x + ox, y + oy, A[lv - 1], s.c);
        if (lv === 2) for (const [ox, oy] of CROSS) dot(x + 2 * ox, y + 2 * oy, A[0], s.c);
      }
    }
    if (shot) for (let i = 0; i < 9; i++) {
      const a = shot.life * (1 - i / 9);
      dot(round(shot.x + i * 2), round(shot.y - i), a, i < 2 ? T.stars[0] : T.stars[2]);
    }
    ctx.globalAlpha = 1;
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    for (const s of stars) {
      const v = 0.5 + s.l * 1.3;
      s.x -= v * dt; s.y += v * 0.3 * dt;
      if (s.x < -2) s.x += W + 4;
      if (s.y > H + 2) s.y -= H + 4;
    }
    if (shot) {
      shot.x -= 60 * dt; shot.y += 30 * dt; shot.life -= dt * 0.9;
      if (shot.life <= 0 || shot.x < -20 || shot.y > H + 10) shot = null;
    } else if ((nextShot -= dt) <= 0) {
      shot = { x: W * (0.4 + random() * 0.6), y: H * random() * 0.4, life: 1 };
      nextShot = 7 + random() * 9;
    }
  }

  /** @param {number} w @param {number} h @returns {void} */
  function resize(w, h) {
    W = bg.width = w; H = bg.height = h;
    paintBg(); seed();
  }

  return stage.run({ resize, step, draw }, !!opts.reducedMotion);
}
