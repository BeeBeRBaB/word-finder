// Word hunt: a faint grid of letters with words hidden in it every way, and one at a time a word
// is found and a pill draws itself along it in the look's colours, as in the game. The seed picks
// the variant: one grid over the host ringed in random order until a fresh puzzle fades in, a
// grid scrolling slowly up with words ringed as they pass, or a magnifying glass gliding from word
// to word, the letters under it clearer, ringing each as it gets there.

import { stage, clamp } from './stage.js';
import { roundRect } from './shapes.js';

/**
 * @typedef {{x:number, y:number, dx:number, dy:number, text:string, c:number, at:number}} Hidden
 * x, y the first letter's cell (y counts global rows when scrolling); at is when its pill
 * started, -1 while unfound.
 * @typedef {{row:number, cv:HTMLCanvasElement, words:Hidden[]}} Block  rows of the scrolling grid
 */

const WORDS = ('FIND SEEK WORD GRID LETTER SEARCH PUZZLE CLUE SPELL HIDDEN CIRCLE QUEST HUNT TRACE SPOT '
  + 'LOOK SCAN READ PAGE BOOK INK PEN LIGHT STAR MOON SUN RIVER STONE CLOUD MAPLE OCEAN GARDEN FOREST '
  + 'MEADOW CANDLE LANTERN PEBBLE HARBOR ORCHID TIGER OTTER RAVEN FALCON COMET PLANET VALLEY ISLAND '
  + 'BRIDGE CASTLE MARBLE SPARROW THUNDER WILLOW AMBER CORAL FROST EMBER').split(' ');
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]];
const GROW = 0.9;   // a pill takes this long to draw
const FADE = 1.6;   // a finished puzzle fades out, and the next in, over this long
const BAND = 6;     // rows per block of the scrolling grid

/** @param {number} u @returns {number} */
const ease = (u) => u * u * (3 - 2 * u);

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const GRID = s.dark ? 0.2 : 0.24, FILL = s.dark ? 0.16 : 0.2, EDGE = s.dark ? 0.55 : 0.62;
    const font = (/** @type {number} */ px) => `600 ${Math.round(px)}px 'Space Grotesk',system-ui,sans-serif`;
    let cs = 0, cols = 0, rows = 0, ox = 0, oy = 0, A = 0;
    /** @type {HTMLCanvasElement[]} letter atlases, A px a cell: [0] in ink, then one a colour */
    let atlases = [];
    /** Puzzle grid painted once (layouts 0 and 2). */
    const layer = document.createElement('canvas');
    /** @type {Uint8Array} */
    let grid = new Uint8Array(0);
    /** @type {Hidden[]} */
    let words = [];
    let clock = 0, next = 0, fade = 1, phase = 0, done = 0;   // phase 0 hunting, 1 fading out, 2 in
    // Lens (layout 2): where it is, its speed, and the word it is heading for.
    let lx = 0, ly = 0, aim = -1;
    // Scrolling grid (layout 1).
    /** @type {Block[]} */
    let blocks = [];
    /** @type {HTMLCanvasElement[]} */
    const spare = [];
    let scroll = 0;

    /** Paints A-Z across one strip canvas in a colour. @param {HTMLCanvasElement} cv @param {string} col */
    function atlas(cv, col) {
      cv.width = A * 26; cv.height = A;
      const g = cv.getContext('2d');
      if (!g) return;
      g.font = font(A * 0.5); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col;
      for (let i = 0; i < 26; i++) g.fillText(String.fromCharCode(65 + i), A * (i + 0.5), A * 0.54);
    }
    // The letters are cached as images, so paint them again once the app's font has arrived.
    document.fonts?.load(font(20)).then(() => {
      if (!s.cv.isConnected || !A) return;
      atlases.forEach((cv, k) => atlas(cv, k ? s.colors[k - 1] : s.ink));
      s.paint();
    }, () => {});

    /**
     * Hides words in a w x h grid, any of eight ways, crossing only on a shared letter, and fills
     * the rest with random letters.
     * @param {number} w @param {number} h @param {number} most @returns {{grid:Uint8Array, words:Hidden[]}}
     */
    function hide(w, h, most) {
      const g = new Uint8Array(w * h);
      /** @type {Hidden[]} */
      const out = [];
      const pool = WORDS.filter((t) => t.length <= Math.max(w, h));
      for (let tries = 0; tries < most * 15 && out.length < most; tries++) {
        const text = pool[rng.int(pool.length)];
        if (out.some((o) => o.text === text)) continue;
        const [dx, dy] = DIRS[rng.int(DIRS.length)], n = text.length - 1;
        const x0 = dx < 0 ? n : 0, x1 = dx > 0 ? w - 1 - n : w - 1;
        const y0 = dy < 0 ? n : 0, y1 = dy > 0 ? h - 1 - n : h - 1;
        if (x1 < x0 || y1 < y0) continue;
        const x = x0 + rng.int(x1 - x0 + 1), y = y0 + rng.int(y1 - y0 + 1);
        let ok = true;
        for (let i = 0; i <= n && ok; i++) {
          const v = g[(y + dy * i) * w + x + dx * i];
          ok = !v || v === text.charCodeAt(i);
        }
        if (!ok) continue;
        for (let i = 0; i <= n; i++) g[(y + dy * i) * w + x + dx * i] = text.charCodeAt(i);
        out.push({ x, y, dx, dy, text, c: out.length % nc, at: -1 });
      }
      for (let i = 0; i < g.length; i++) if (!g[i]) g[i] = 65 + rng.int(26);
      return { grid: g, words: out };
    }

    /** Paints a grid's letters in ink onto a canvas. @param {HTMLCanvasElement} cv @param {Uint8Array} g @param {number} w @param {number} h @param {number} x @param {number} y */
    function paintGrid(cv, g, w, h, x, y) {
      const c = cv.getContext('2d');
      if (!c) return;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cv.width, cv.height);
      c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          c.drawImage(atlases[0], (g[j * w + i] - 65) * A, 0, A, A, x + i * cs, y + j * cs, cs, cs);
        }
      }
    }

    /** A new puzzle over the whole host (layouts 0 and 2). @returns {void} */
    function newPuzzle() {
      const p = hide(cols, rows, clamp(Math.round(cols * rows / 28), 5, 26));
      grid = p.grid; words = rng.shuffle(p.words);
      paintGrid(layer, grid, cols, rows, ox, oy);
      done = 0; aim = -1;
    }

    /** A block of BAND rows starting at global row `row` (layout 1). @param {number} row @returns {Block} */
    function newBlock(row) {
      const cv = spare.pop() ?? document.createElement('canvas');
      cv.width = Math.ceil(cols * cs * s.dpr); cv.height = Math.ceil(BAND * cs * s.dpr);
      const p = hide(cols, BAND, clamp(Math.round(cols * BAND / 26), 2, 9));
      paintGrid(cv, p.grid, cols, BAND, 0, 0);
      for (const w of p.words) { w.y += row; w.c = rng.int(nc); }
      return { row, cv, words: p.words };
    }

    /** Screen y of a global row's top (layout 1). @param {number} r @returns {number} */
    const rowY = (r) => oy + r * cs - scroll;

    /** Keeps blocks from just above the host to just below it (layout 1). @returns {void} */
    function fillBlocks() {
      while (blocks.length && rowY(blocks[0].row + BAND) < -cs) {
        const b = /** @type {Block} */ (blocks.shift());
        spare.push(b.cv);
      }
      let row = blocks.length ? blocks[blocks.length - 1].row + BAND : Math.floor((scroll - oy) / cs) - 1;
      while (rowY(row) < s.H + cs) { blocks.push(newBlock(row)); row += BAND; }
    }

    /** A word's middle on screen. @param {Hidden} w @returns {[number, number]} */
    function mid(w) {
      const n = (w.text.length - 1) / 2;
      const y = layout === 1 ? rowY(w.y + w.dy * n) : oy + (w.y + w.dy * n) * cs;
      return [ox + (w.x + w.dx * n + 0.5) * cs, y + cs / 2];
    }

    /** Draws a word's pill part drawn and the letters it has reached. @param {Hidden} w @param {number} a */
    function pill(w, a) {
      const { ctx, dpr } = s;
      const u = ease(clamp((clock - w.at) / GROW, 0, 1)), n = w.text.length - 1;
      const x = ox + (w.x + 0.5) * cs, y = (layout === 1 ? rowY(w.y) : oy + w.y * cs) + cs / 2;
      const r = cs * 0.42, len = n * cs * Math.hypot(w.dx, w.dy) * u;
      const ang = Math.atan2(w.dy, w.dx), co = Math.cos(ang), si = Math.sin(ang);
      const col = s.colors[w.c % nc];
      ctx.setTransform(dpr * co, dpr * si, -dpr * si, dpr * co, dpr * x, dpr * y);
      ctx.beginPath();
      roundRect(ctx, -r, -r, len + 2 * r, 2 * r, r);
      ctx.fillStyle = col; ctx.globalAlpha = a * FILL; ctx.fill();
      ctx.strokeStyle = col; ctx.globalAlpha = a * EDGE; ctx.stroke();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = a * 0.9;
      const at = atlases[1 + (w.c % nc)];
      for (let i = 0; i <= n && i <= u * n + 0.01; i++) {
        ctx.drawImage(at, (w.text.charCodeAt(i) - 65) * A, 0, A, A,
          x + w.dx * i * cs - cs / 2, y + w.dy * i * cs - cs / 2, cs, cs);
      }
    }

    /** Advances the hunt by dt. @param {number} dt @returns {void} */
    function step(dt) {
      clock += dt;
      if (layout === 1) {
        scroll += cs * 0.32 * dt;
        fillBlocks();
        if (clock < next) return;
        // Ring the lowest unfound word wholly inside the band, so rings start low and ride up.
        /** @type {Hidden|null} */
        let best = null, by = -Infinity;
        for (const b of blocks) {
          for (const w of b.words) {
            if (w.at >= 0) continue;
            const ya = rowY(w.y), yb = rowY(w.y + w.dy * (w.text.length - 1));
            const top = Math.min(ya, yb);
            if (top > s.H * 0.15 && Math.max(ya, yb) < s.H * 0.86 && top > by) { best = w; by = top; }
          }
        }
        if (best) { best.at = clock; next = clock + 1.1 + rng.random() * 1.2; }
        return;
      }
      if (phase === 1) {
        fade -= dt / FADE;
        if (fade <= 0) { fade = 0; phase = 2; newPuzzle(); }
        return;
      }
      if (phase === 2) {
        fade += dt / FADE;
        if (fade >= 1) { fade = 1; phase = 0; next = clock + 0.8; }
        return;
      }
      if (done >= words.length) {
        if (clock > next) phase = 1;
        return;
      }
      if (layout === 0) {
        if (clock >= next) { words[done++].at = clock; next = clock + (done < words.length ? 1.3 + rng.random() * 0.9 : 3.5); }
        return;
      }
      // The lens heads for the nearest unfound word, rings it once there, then moves on.
      if (aim < 0) {
        let best = -1, bd = Infinity;
        for (let k = done; k < words.length; k++) {
          const [x, y] = mid(words[k]);
          const d = Math.hypot(x - lx, y - ly);
          if (d < bd) { bd = d; best = k; }
        }
        [words[done], words[best]] = [words[best], words[done]];
        aim = done;
      }
      const [tx, ty] = mid(words[aim]);
      const d = Math.hypot(tx - lx, ty - ly), v = Math.min(d * 2.2, clamp(Math.min(s.W, s.H) * 0.3, 110, 260));
      if (d > 0.5) { lx += (tx - lx) / d * Math.min(d, v * dt); ly += (ty - ly) / d * Math.min(d, v * dt); }
      if (d < cs * 0.2 && words[aim].at < 0 && clock >= next) words[aim].at = clock;
      if (words[aim].at >= 0 && clock - words[aim].at > GROW + 0.7) {
        done++; aim = -1; next = clock + (done < words.length ? 0.3 : 3.5);
      }
    }

    /** Draws the lens: the grid inked in again under the glass, a rim and a handle. @param {number} a */
    function lens(a) {
      const { ctx } = s;
      const R = cs * 1.7;
      ctx.save();
      ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.clip();
      ctx.globalAlpha = a * (s.dark ? 0.08 : 0.1); ctx.fillStyle = s.colors[0]; ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
      ctx.globalAlpha = a * GRID * 1.8;
      ctx.drawImage(layer, 0, 0, s.W, s.H);
      ctx.restore();
      ctx.globalAlpha = a * (s.dark ? 0.5 : 0.55); ctx.strokeStyle = s.ink; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, cs * 0.1);
      ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = Math.max(4, cs * 0.26);
      ctx.beginPath(); ctx.moveTo(lx + R * 0.74, ly + R * 0.74); ctx.lineTo(lx + R * 1.5, ly + R * 1.5); ctx.stroke();
    }

    return {
      lay() {
        const was = cols;
        cs = clamp(Math.round(Math.min(s.W, s.H) / 15), 26, 46);
        cols = Math.floor(s.W / cs); rows = Math.floor(s.H / cs);
        ox = (s.W - cols * cs) / 2; oy = (s.H - rows * cs) / 2;
        A = Math.ceil(cs * s.dpr);
        atlases = [s.ink, ...s.colors].map((c, k) => {
          const cv = atlases[k] ?? document.createElement('canvas');
          atlas(cv, c);
          return cv;
        });
        if (layout === 1) {
          for (const b of blocks) spare.push(b.cv);
          blocks = [];
          fillBlocks();
          if (!was || s.reduced) {
            // Warm up: some words already ringed, one mid-draw.
            for (let k = 0; k < 40; k++) step(0.5);
            next = clock;
          }
          return;
        }
        layer.width = Math.round(s.W * s.dpr); layer.height = Math.round(s.H * s.dpr);
        newPuzzle();
        phase = 0; fade = 1; clock = 10;
        // A puzzle part solved: some pills drawn, the next one mid-way.
        const k = Math.min(words.length - 1, Math.ceil(words.length * 0.45));
        for (let i = 0; i < k; i++) words[i].at = 0;
        done = k;
        if (layout === 0) { words[done++].at = clock - GROW * 0.5; next = clock + 1; }
        else {
          const [x, y] = mid(words[done]);
          lx = x - cs * 1.2; ly = y + cs * 0.8; aim = done;
        }
      },
      step,
      draw() {
        const { ctx } = s;
        if (layout === 1) {
          ctx.globalAlpha = GRID;
          for (const b of blocks) ctx.drawImage(b.cv, ox, rowY(b.row), cols * cs, BAND * cs);
          ctx.lineWidth = Math.max(1.5, cs * 0.06);
          for (const b of blocks) for (const w of b.words) if (w.at >= 0) pill(w, 1);
          return;
        }
        const a = ease(fade);
        ctx.globalAlpha = GRID * a;
        ctx.drawImage(layer, 0, 0, s.W, s.H);
        if (layout === 2) lens(a);
        ctx.lineWidth = Math.max(1.5, cs * 0.06);
        for (const w of words) if (w.at >= 0) pill(w, a);
      },
    };
  });
}
