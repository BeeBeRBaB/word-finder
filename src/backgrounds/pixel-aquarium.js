// Pixel aquarium: light rays, sand, coral, swaying weed, fish and bubbles.
import { pixelStage } from './pixel-stage.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean}} BackgroundOptions
 * @typedef {{x:number, y:number, v:number, s:boolean, p:number}} Bubble
 */

const { ceil, floor, max, min, round, sin } = Math;
// a body, b stripe, t fins, e eye; facing right
const FISH = [
  ['...aaa....', 't.abaaa...', 'ttabaaaae.', 'ttabaaaaaa', 't.abaaaa..', '...aaa....'],
  ['....tt.....', '..aaaaaa...', 't.abaaaaa..', 'ttabbaaaaea', 'ttabbaaaaaa', 't.abaaaaa..', '..aaaaaa...', '....tt.....'],
  ['..ttt..', 't.aaaa.', 'tabaaea', 't.aaaa.', '..ttt..'],
];
/** @type {[number, string, string, string][]} shape, a, b, t */
const KINDS = [
  [0, '#ff8a2a', '#fff', '#ff6a1a'],
  [1, '#3f7fff', '#1c3fa8', '#ffd23f'],
  [2, '#ffd84a', '#ffab2a', '#fff0a0'],
  [0, '#ff7fb8', '#c8509a', '#ffc0dc'],
  [2, '#5fe0b0', '#2fa888', '#b8ffe6'],
  [1, '#b58cff', '#7a52d6', '#ff9ad0'],
];
const THEMES = {
  dark: {
    water: ['#10426a', '#0d375e', '#0b2d52', '#092446', '#071c3a'], ray: '#8fdcff',
    sand: ['#5e4c56', '#75606a', '#4a3b46'], rock: ['#2c3552', '#3e4a6c', '#57658c'],
    weed: ['#2f9e6a', '#49c27a', '#1f7a5a'], coral: ['#ff6f91', '#ff9a4d', '#b78cff'], bub: '#bfefff',
  },
  light: {
    water: ['#a3e6f0', '#86d9ea', '#6acce2', '#55bdd9', '#44abcf'], ray: '#fff',
    sand: ['#efd49c', '#f7e3b8', '#d6b47c'], rock: ['#7d8aa8', '#96a3c0', '#b3bfd8'],
    weed: ['#2f9e5a', '#4fbf6e', '#237a4a'], coral: ['#ff5f86', '#ff8a3d', '#9a6cf0'], bub: '#fff',
  },
};

/** @param {HTMLElement} host @param {Partial<BackgroundOptions>} [opts] @returns {() => void} stop */
export function start(host, opts = {}) {
  const T = THEMES[opts.dark === false ? 'light' : 'dark'];
  const mk = () => document.createElement('canvas'), bg = mk(), rays = mk();
  const [g, r] = [bg, rays].map(c => /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')));
  const stage = g && r && pixelStage(host);
  if (!stage) return () => {};
  const ctx = stage.ctx;

  let W = 0, H = 0, t = 0, sd = 1;
  /** @type {{k:number, x:number, y:number, v:number, p:number}[]} */ const fish = [];
  /** @type {Bubble[]} */ const bubbles = [];
  /** @type {[number, number, number, string, number][]} x, base, height, colour, phase */ let weeds = [];
  /** @type {number[]} */ let sandY = [];
  /** @returns {number} */
  const rand = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  /** @param {number} n @returns {number} */
  const ri = n => rand() * n | 0;
  /** @returns {number} */
  const fy = () => H * (0.1 + rand() * 0.65);

  // [kind][flip][frame]: frame 1 flicks the tail up a row
  const sprites = KINDS.map(([s, a, b, t]) => [0, 1].map(flip => [0, 1].map(fr => {
    const rows = FISH[s], w = rows[0].length, c = mk(), sg = c.getContext('2d');
    /** @type {Record<string, string>} */
    const pal = { a, b, t, e: '#10101c' };
    c.width = w; c.height = rows.length;
    if (sg) rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      sg.fillStyle = pal[ch];
      sg.fillRect(flip ? w - 1 - x : x, fr && !x ? y - 1 : y, 1, 1);
    }));
    return c;
  })));

  /** The tank for this size. Each part of the scenery draws from its own seed, so it keeps its
   * look; fish and bubbles carry on across a resize, moved with it: starting them over made every
   * rotation or window drag jump. @param {number} w @param {number} h @returns {void} */
  function paint(w, h) {
    for (const o of [...fish, ...bubbles]) { o.x *= w / W; o.y *= h / H; }
    W = w; H = h;
    sd = 4242; bg.width = rays.width = W; bg.height = rays.height = H;
    const n = T.water.length, bh = H / n;
    for (let i = 0; i < n; i++) {
      const y = floor(i * bh);
      g.fillStyle = T.water[i];
      g.fillRect(0, y, W, ceil(bh) + 1);
      if (i) for (let x = 0; x < W; x += 2) {
        g.fillStyle = T.water[x % 4 ? i : i - 1];
        g.fillRect(x, x % 4 ? y - 1 : y, 1, 1);
      }
    }
    // rays: dithered slanted strips thinning with depth
    r.fillStyle = T.ray;
    for (let k = 0; k < 5; k++) {
      const x0 = W * (k * 0.22 - 0.05 + rand() * 0.08), rw = 3 + ri(6), len = H * (0.5 + rand() * 0.3);
      for (let y = 0; y < len; y++) for (let x = 0; x < rw; x++)
        if ((x + y) % 2 === 0 && rand() > y / len) r.fillRect(round(x0 + x + y * 0.35), y, 1, 1);
    }
    sandY = [];
    sd = 4243;
    for (let x = 0; x < W; x++) {
      const y = round(H * 0.88 + sin(x * 0.07) * 2 + sin(x * 0.19));
      sandY.push(y);
      g.fillStyle = T.sand[0]; g.fillRect(x, y, 1, H - y);
      g.fillStyle = T.sand[1]; g.fillRect(x, y, 1, 1);
      for (let yy = y + 2; yy < H; yy += 2) if (rand() < 0.18) {
        g.fillStyle = T.sand[1 + ri(2)]; g.fillRect(x, yy, 1, 1);
      }
    }
    /** @param {number} x @returns {number} */
    const at = x => sandY[min(W - 1, max(0, x))];
    sd = 4244;
    for (let k = 0; k < 3; k++) {
      const cx = round(W * (0.1 + k * 0.38 + rand() * 0.1)), rw = 5 + ri(5), rh = 3 + ri(3), by = at(cx) + 1;
      for (let y = -rh; y <= 0; y++) for (let x = -rw; x <= rw; x++) {
        if ((x / rw) ** 2 + (y / rh) ** 2 > 1) continue;
        g.fillStyle = T.rock[x + y < -rw * 0.6 ? 2 : x + y < rw * 0.2 ? 1 : 0];
        g.fillRect(cx + x, by + y, 1, 1);
      }
    }
    // coral stalks with side buds
    for (let k = 0, nc = max(3, W / 40 | 0); k < nc; k++) {
      const x0 = round(W * (k + 0.3 + rand() * 0.4) / nc), h = 7 + ri(9), base = at(x0);
      g.fillStyle = T.coral[k % 3];
      for (let s = -1; s <= 1; s++) {
        let x = x0 + s * 3;
        for (let i = 0, hh = h - (s ? 3 + ri(3) : 0); i < hh; i++) {
          if (i > 1 && rand() < 0.3) x += rand() < 0.5 ? -1 : 1;
          g.fillRect(x, base - i, i < hh - 2 ? 2 : 1, 1);
          if (i > 2 && i % 3 === 0) g.fillRect(i % 2 ? x + 2 : x - 1, base - i - 1, 1, 1);
        }
      }
    }
    weeds = [];
    sd = 4245;
    for (let x = 3; x < W; x += 5 + ri(9)) weeds.push([x, at(x) + 1, 8 + ri(H * 0.18), T.weed[ri(3)], rand() * 6]);
    const nf = min(9, 4 + (W * H / 6000 | 0));
    fish.length = min(fish.length, nf);
    for (let i = fish.length; i < nf; i++) {
      fish.push({
        k: i % KINDS.length, x: rand() * W, y: fy(), v: (rand() < 0.5 ? -1 : 1) * (3 + rand() * 4), p: rand() * 6,
      });
    }
    while (bubbles.length < 14) bubbles.push(bubble(/** @type {Bubble} */ ({}), true));
  }

  /** @param {Bubble} b @param {boolean} any at a random height, not the weed base @returns {Bubble} */
  function bubble(b, any) {
    const src = weeds[ri(weeds.length)] || [W / 2, H];
    b.x = src[0] + ri(3); b.y = any ? rand() * H : src[1] - 2;
    b.v = 6 + rand() * 7; b.s = rand() < 0.35; b.p = rand() * 6;
    return b;
  }

  /** @returns {void} */
  function draw() {
    ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0);
    ctx.globalAlpha = 0.16 + 0.06 * sin(t * 0.6);
    ctx.drawImage(rays, 0, 0);
    ctx.globalAlpha = 1;
    for (const [x, base, h, c, p] of weeds) {
      ctx.fillStyle = c;
      for (let j = 0; j < h; j++) {
        const ox = x + round(sin(t * 1.1 + p + j * 0.22) * j / h * 2.5);
        ctx.fillRect(ox, base - j, 1, 1);
        if (j % 4 === 2) ctx.fillRect(ox + (j % 8 < 4 ? 1 : -1), base - j, 1, 1);
      }
    }
    for (const f of fish) {
      const sprite = sprites[f.k][f.v < 0 ? 1 : 0][(t * 3 + f.p) % 2 | 0];
      ctx.drawImage(sprite, round(f.x), round(f.y + sin(t * 0.8 + f.p) * 1.5));
    }
    ctx.fillStyle = T.bub;
    ctx.globalAlpha = 0.7;
    for (const b of bubbles) {
      const x = round(b.x + sin(t * 2.5 + b.p) * 0.8), y = round(b.y);
      if (!b.s) { ctx.fillRect(x, y, 1, 1); continue; }
      ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x - 1, y, 1, 1);
      ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
    }
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    for (const f of fish) if ((f.x += f.v * dt) > W + 14 || f.x < -14) {
      f.x = f.v > 0 ? -12 : W + 2;
      f.y = fy();
    }
    for (const b of bubbles) if ((b.y -= b.v * dt) < -2) bubble(b, false);
  }

  return stage.run({ resize: paint, step, draw }, !!opts.reducedMotion);
}
