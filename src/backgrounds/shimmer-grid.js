// Shimmer Grid: a pixel-font letter grid swept by colour waves, where real words light up.
import { frameLoop } from './frame-loop.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean}} BackgroundOptions
 * @typedef {{c0:number, r0:number, dx:number, dy:number, L:number, ci:number, age:number}} Found
 */

// 3x5 glyphs A-Z, one octal digit per row, high bit = left column.
const FONT = '25755 65656 34443 65556 74647 74644 34553 55755 72227 11152 55655 44447 57755 65555 25552 65644 25573 65655 34216 72222 55557 55552 55775 55255 55222 71247'.split(' ');
const WORDS = 'FIND SEEK WORD GRID CLUE LOOK SPOT PLAY QUEST SEARCH PUZZLE LETTER SPELL FOUND HIDDEN MATCH SOLVE BINGO'.split(' ');
const DARK = ['#ff6f91', '#ffb347', '#ffe66d', '#5ee6a8', '#5cc8ff', '#a98bff'];
const LIGHT = ['#c8335f', '#c7650f', '#9c7a00', '#138a5c', '#1473b5', '#6a44c9'];
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]]; // forwards only, so the words read
const U = 3; // CSS px per art pixel
const P = 9; // art pixels per grid cell: 3x5 glyph at (3,2), 7x7 tile at (1,1)
const PER = 64; // art pixels per wave pulse

/** @param {number} n @returns {number} */
const ri = (n) => (Math.random() * n) | 0;
/** Alpha by age: reveal, hold, fade over ~5s. @param {Found} f @returns {number} */
const life = (f) => (f.age < 3.4 ? 1 : Math.max(0, 1 - (f.age - 3.4) / 1.4));
/** @param {Found} f @returns {number} */
const shown = (f) => Math.min(f.L, Math.floor(f.age / 0.11) + 1);

/** @param {HTMLElement} host @param {Partial<BackgroundOptions>} [opts] @returns {() => void} */
export function start(host, opts = {}) {
  const dark = opts.dark !== false, pal = dark ? DARK : LIGHT, reduced = !!opts.reducedMotion;
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;left:0;top:0;display:block;pointer-events:none;image-rendering:pixelated';
  host.appendChild(cv);
  const mask = document.createElement('canvas'); // the letters, drawn once
  // Soft waves, so painted at 1/4 resolution and scaled up.
  const field = document.createElement('canvas');
  // Wave strip: one soft pulse per palette colour, tiled as a pattern.
  const strip = document.createElement('canvas');
  strip.width = PER * pal.length; strip.height = 1;
  const c2d = cv.getContext('2d'), m2d = mask.getContext('2d');
  const f2d = field.getContext('2d'), sctx = strip.getContext('2d');
  if (!c2d || !m2d || !f2d || !sctx) return () => cv.remove();
  // Aliased: narrowing does not reach the hoisted functions below.
  const ctx = c2d, mctx = m2d, fctx = f2d;

  for (let x = 0; x < strip.width; x++) {
    sctx.globalAlpha = Math.pow(0.5 - 0.5 * Math.cos((x % PER) / PER * 6.2832), 5);
    sctx.fillStyle = pal[(x / PER) | 0];
    sctx.fillRect(x, 0, 1, 1);
  }
  const wave = fctx.createPattern(strip, 'repeat') || '#0000';

  /** @type {Found[]} */
  const found = [];
  let cw = 0, ch = 0, cols = 0, rows = 0, ox = 0, oy = 0;
  let t = ri(60), next = 1;

  /** @param {number} c @param {number} r @param {number} g glyph index @returns {void} */
  function setCell(c, r, g) {
    const x = ox + c * P + 3, y = oy + r * P + 2, f = FONT[g];
    mctx.clearRect(x - 3, y - 2, P, P);
    for (let j = 0; j < 5; j++) {
      const bits = f.charCodeAt(j) - 48;
      for (let i = 0; i < 3; i++) if (bits & (4 >> i)) mctx.fillRect(x + i, y + j, 1, 1);
    }
  }

  /** @param {number} age seconds @returns {void} */
  function addWord(age) {
    const w = WORDS[ri(WORDS.length)], L = w.length;
    for (let k = 0; k < 24; k++) {
      const d = DIRS[ri(4)], c0 = ri(cols), r0 = ri(rows);
      const c1 = c0 + d[0] * (L - 1), r1 = r0 + d[1] * (L - 1);
      if (c1 >= cols || r1 < 0 || r1 >= rows) continue;
      for (let i = 0; i < L; i++) setCell(c0 + d[0] * i, r0 + d[1] * i, w.charCodeAt(i) - 65);
      found.push({ c0, r0, dx: d[0], dy: d[1], L, ci: ri(pal.length), age });
      return;
    }
  }

  /** @returns {void} */
  function resize() {
    const W = host.clientWidth || innerWidth, H = host.clientHeight || innerHeight;
    const w = Math.floor(W / U), h = Math.floor(H / U);
    if (w === cw && h === ch) return;
    cw = cv.width = mask.width = w; ch = cv.height = mask.height = h;
    field.width = Math.ceil(cw / 4) + 1; field.height = Math.ceil(ch / 4) + 1;
    cv.style.width = cw * U + 'px'; cv.style.height = ch * U + 'px';
    cols = Math.floor(cw / P); rows = Math.floor(ch / P);
    ox = (cw - cols * P) >> 1; oy = (ch - rows * P) >> 1;
    mctx.fillStyle = '#fff';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) setCell(c, r, ri(26));
    found.length = 0;
    if (reduced) { addWord(2); addWord(2); } else addWord(1.2);
    draw();
  }

  /** @param {number} ang @param {number} off @param {number} sx @returns {void} */
  function band(ang, off, sx) {
    const R = Math.hypot(cw, ch) / 2 + 2;
    fctx.setTransform(0.25, 0, 0, 0.25, cw / 8, ch / 8);
    fctx.rotate(ang); fctx.scale(sx, 1);
    fctx.translate(off % strip.width, 0);
    fctx.fillRect(-R / sx - strip.width, -R, 2 * R / sx + 2 * strip.width, 2 * R);
  }

  /** @param {Found} f @param {number} a @param {string} col @returns {void} */
  function tiles(f, a, col) {
    ctx.globalAlpha = a * life(f);
    ctx.fillStyle = col;
    for (let i = 0, n = shown(f); i < n; i++) {
      ctx.fillRect(ox + (f.c0 + f.dx * i) * P + 1, oy + (f.r0 + f.dy * i) * P + 1, 7, 7);
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, cw, ch);
    ctx.globalAlpha = dark ? 0.09 : 0.12;
    ctx.fillStyle = dark ? '#c4bdd6' : '#5d566e';
    ctx.fillRect(0, 0, cw, ch);
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, field.width, field.height);
    fctx.fillStyle = wave;
    fctx.globalAlpha = dark ? 0.34 : 0.4;
    band(0.6, t * 7, 1.4);
    fctx.globalAlpha = dark ? 0.2 : 0.25;
    band(-1.05, -t * 5, 2.2);
    ctx.globalAlpha = 1;
    ctx.drawImage(field, 0, 0, field.width * 4, field.height * 4);
    for (const f of found) tiles(f, dark ? 0.75 : 0.85, pal[f.ci]);
    // Keep only letter pixels, then put the found-word tiles underneath.
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    for (const f of found) tiles(f, dark ? 0.2 : 0.22, pal[f.ci]);
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    for (let i = found.length - 1; i >= 0; i--) {
      if ((found[i].age += dt) > 4.8) found.splice(i, 1);
    }
    if ((next -= dt) <= 0) {
      if (found.length < 3) addWord(0);
      next = 1.4 + Math.random() * 1.8;
    }
  }

  resize();
  const stop = frameLoop(host, resize, (ms, first) => {
    step(first ? 0 : Math.min(0.1, ms / 1000));
    draw();
  }, reduced);
  return () => { stop(); cv.remove(); found.length = 0; };
}
