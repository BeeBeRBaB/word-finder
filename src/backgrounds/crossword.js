// Crossword: a crossword grid of real words, across and down, fills in letter by letter, a
// highlight on the word being entered, then fades and a new one is built. The seed picks the
// variant: a free criss-cross whose boxes appear word by word as it grows out from the middle,
// a classic ruled grid with shaded blocks and clue numbers solved in random order, or several
// mini puzzles scattered over the host, each filling and clearing on its own clock.

import { stage, clamp } from './stage.js';

/** @typedef {{x:number, y:number, across:boolean, text:string, num:number, c:number}} Word */
/** @typedef {{i:number, w:number, at:number}} Fill  a letter: its cell, its word, when it lands */
/** @typedef {{x:number, y:number, w:number, h:number, cell:number, ox:number, oy:number, gw:number,
 *   gh:number, grid:Uint8Array, words:Word[], order:number[], seq:Fill[], starts:number[], clock:number,
 *   end:number, done:number, boxed:number, layer:HTMLCanvasElement,
 *   lg:CanvasRenderingContext2D}} Puzzle
 * A puzzle over the region x, y, w, h of the host; its grid gw x gh of `cell` px sits at ox, oy
 * inside it. grid holds char codes, 0 empty. order lists the words as they fill, and starts[k]
 * is when the k-th of them begins.
 * Letters before `done` and boxes of the first `boxed` words are already painted on `layer`. */

const POOL = ('APPLE RIVER STONE CLOUD LIGHT MUSIC OCEAN PAPER GARDEN PLANET ORANGE PUZZLE LETTER '
  + 'WORD GRID CLUE ACROSS DOWN ANSWER PENCIL ERASER SEARCH FIND HIDDEN QUIET BRIGHT SUMMER WINTER '
  + 'AUTUMN SPRING FOREST MEADOW ISLAND CASTLE DRAGON KNIGHT WIZARD COFFEE BREAD HONEY LEMON MANGO '
  + 'PEACH CHERRY OLIVE TOMATO CARROT ONION PEPPER SALT SUGAR CANDLE LANTERN WINDOW DOOR HOUSE '
  + 'TOWER BRIDGE ROAD TRAIN ROCKET COMET STAR MOON ORBIT GALAXY NEBULA ATOM ENERGY MAGNET METAL '
  + 'SILVER GOLD COPPER IRON CRYSTAL PEARL AMBER CORAL SHELL WAVE TIDE BEACH SAND DUNE DESERT '
  + 'CACTUS CAMEL TIGER ZEBRA LION EAGLE RAVEN OTTER BEAVER WHALE SHARK SQUID TURTLE FROG LIZARD '
  + 'PANDA KOALA MONKEY HORSE PONY SHEEP GOAT LLAMA RABBIT MOUSE KITTEN PUPPY PARROT ROBIN SWAN '
  + 'GOOSE DUCK HERON MAPLE CEDAR BIRCH WILLOW TULIP DAISY LILY ROSE ORCHID VIOLET FERN MOSS SEED '
  + 'ROOT LEAF BLOOM PETAL THORN BERRY ACORN PIANO GUITAR VIOLIN DRUM FLUTE HARP SONG DANCE POEM '
  + 'STORY NOVEL CHAPTER INK QUILL BOOK PAGE ATLAS MAP COMPASS JOURNEY VOYAGE ANCHOR SAIL HARBOR '
  + 'CANAL VALLEY CANYON GLACIER VOLCANO THUNDER STORM RAIN SNOW FROST BREEZE SUNSET DAWN NOON '
  + 'NIGHT DREAM SMILE LAUGH JOY HOPE KIND BRAVE CALM WARM GENTLE CLEVER SWIFT ZIGZAG JIGSAW QUIZ '
  + 'JAZZ BOX FOX WAX JUMP KAYAK YACHT YOGA ZERO ZONE VELVET WOOL QUILT KNOT LOOM THREAD NEEDLE '
  + 'BUTTON ZIPPER TEAPOT BASKET LADDER MIRROR PILLOW BLANKET SPOON FORK PLATE TABLE CHAIR ').trim().split(' ');

const STEP = 0.2;   // seconds between letters
const GAP = 0.6;    // pause before each word
const POP = 0.35;   // a letter's landing
const HOLD = 3.5;   // the finished puzzle stays this long
const FADE = 2.2;   // then fades over this long

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Puzzle[]} */
    let puzzles = [];
    const LETTER = s.dark ? 0.52 : 0.6;
    const font = (/** @type {number} */ px) => `600 ${Math.round(px)}px 'Space Grotesk',system-ui,sans-serif`;

    /**
     * Places words on a gw x gh grid, each new one crossing what is there, never touching it
     * side on. Growth leans outward from the middle (free and mini) or toward more crossings.
     * @param {number} gw @param {number} gh @param {number} most @returns {{grid:Uint8Array, words:Word[]}}
     */
    function generate(gw, gh, most) {
      const grid = new Uint8Array(gw * gh), useA = new Uint8Array(gw * gh), useD = new Uint8Array(gw * gh);
      /** @type {number[][]} cells holding each letter */
      const at = Array.from({ length: 26 }, () => []);
      /** @type {Word[]} */
      const words = [];
      const used = new Set();
      const cx = gw / 2, cy = gh / 2;

      /** @param {string} w @param {number} x @param {number} y @param {boolean} a @returns {number} crossings, or -1 */
      function fits(w, x, y, a) {
        const dx = a ? 1 : 0, dy = a ? 0 : 1, n = w.length;
        if (x < 0 || y < 0 || x + dx * (n - 1) >= gw || y + dy * (n - 1) >= gh) return -1;
        const bx = x - dx, by = y - dy, ex = x + dx * n, ey = y + dy * n;
        if (bx >= 0 && by >= 0 && grid[by * gw + bx]) return -1;
        if (ex < gw && ey < gh && grid[ey * gw + ex]) return -1;
        let cross = 0;
        for (let k = 0; k < n; k++) {
          const cx2 = x + dx * k, cy2 = y + dy * k, i = cy2 * gw + cx2, c = grid[i];
          if (c) {
            if (c !== w.charCodeAt(k) || (a ? useA[i] : useD[i])) return -1;
            cross++;
          } else {
            // An empty cell may not sit beside a letter across the word's direction.
            if (a) { if ((cy2 > 0 && grid[i - gw]) || (cy2 < gh - 1 && grid[i + gw])) return -1; }
            else if ((cx2 > 0 && grid[i - 1]) || (cx2 < gw - 1 && grid[i + 1])) return -1;
          }
        }
        return cross === n ? -1 : cross;
      }
      /** @param {string} w @param {number} x @param {number} y @param {boolean} a @returns {void} */
      function place(w, x, y, a) {
        for (let k = 0; k < w.length; k++) {
          const i = (y + (a ? 0 : k)) * gw + x + (a ? k : 0);
          if (!grid[i]) at[w.charCodeAt(k) - 65].push(i);
          grid[i] = w.charCodeAt(k);
          if (a) useA[i] = 1; else useD[i] = 1;
        }
        words.push({ x, y, across: a, text: w, num: 0, c: words.length % s.colors.length });
        used.add(w);
      }

      // The first word, across, through the middle.
      for (let tries = 0; tries < 50 && !words.length; tries++) {
        const w = POOL[rng.int(POOL.length)];
        if (w.length > gw) continue;
        place(w, Math.floor((gw - w.length) / 2), Math.floor(gh / 2), true);
      }
      let misses = 0;
      while (words.length < most && misses < 40) {
        const w = POOL[rng.int(POOL.length)];
        if (used.has(w)) { misses++; continue; }
        let best = -1, bx = 0, by = 0, ba = true;
        for (let k = 0; k < w.length; k++) {
          for (const i of at[w.charCodeAt(k) - 65]) {
            const gx = i % gw, gy = (i - gx) / gw;
            for (const a of [true, false]) {
              const x = a ? gx - k : gx, y = a ? gy : gy - k;
              const cross = fits(w, x, y, a);
              if (cross < 0) continue;
              const mx = x + (a ? w.length / 2 : 0), my = y + (a ? 0 : w.length / 2);
              const out = Math.hypot((mx - cx) / gw, (my - cy) / gh);
              const score = rng.random() + (layout === 1 ? cross * 0.6 : out * 2.5);
              if (score > best) { best = score; bx = x; by = y; ba = a; }
            }
          }
        }
        if (best < 0) { misses++; continue; }
        misses = 0;
        place(w, bx, by, ba);
      }
      // Clue numbers in reading order, as a printed crossword has them.
      let num = 0;
      /** @type {Map<number, number>} */
      const nums = new Map();
      const starts = new Set(words.map((w) => w.y * gw + w.x));
      for (let i = 0; i < gw * gh; i++) if (starts.has(i)) nums.set(i, ++num);
      for (const w of words) w.num = nums.get(w.y * gw + w.x) ?? 0;
      return { grid, words };
    }

    /** @param {Word} w @param {number} gw @returns {number[]} its cells */
    const cellsOf = (w, gw) => Array.from(w.text, (_, k) => (w.y + (w.across ? 0 : k)) * gw + w.x + (w.across ? k : 0));

    /**
     * A new puzzle over a region, its clock at `frac` of the way through filling.
     * @param {number} x @param {number} y @param {number} w @param {number} h @param {number} cell
     * @param {number} most @param {number} frac @param {Puzzle} [old] reuses its layer
     * @returns {Puzzle}
     */
    function puzzle(x, y, w, h, cell, most, frac, old) {
      const gw = Math.max(5, Math.floor(w / cell)), gh = Math.max(5, Math.floor(h / cell));
      const { grid, words } = generate(gw, gh, most);
      const order = words.map((_, k) => k);
      if (layout === 1) rng.shuffle(order);
      /** @type {Fill[]} */
      const seq = [];
      const starts = [];
      const filled = new Set();
      let t = 0.8;
      for (const k of order) {
        starts.push(t);
        t += GAP;
        for (const i of cellsOf(words[k], gw)) {
          if (filled.has(i)) continue;
          filled.add(i);
          seq.push({ i, w: k, at: t });
          t += STEP;
        }
      }
      const layer = old?.layer ?? document.createElement('canvas');
      layer.width = Math.max(1, Math.round(w * s.dpr)); layer.height = Math.max(1, Math.round(h * s.dpr));
      const lg = /** @type {CanvasRenderingContext2D} */ (layer.getContext('2d'));
      /** @type {Puzzle} */
      const p = { x, y, w, h, cell, ox: (w - gw * cell) / 2, oy: (h - gh * cell) / 2, gw, gh, grid, words,
        order, seq, starts, clock: frac * t, end: t, done: 0, boxed: 0, layer, lg };
      repaint(p);
      return p;
    }

    /** The cell's top-left in the puzzle's layer. @param {Puzzle} p @param {number} i @returns {[number, number]} */
    const cellAt = (p, i) => [p.ox + (i % p.gw) * p.cell, p.oy + Math.floor(i / p.gw) * p.cell];

    /** @param {Puzzle} p @param {Word} w @returns {void} */
    function paintBoxes(p, w) {
      const { lg, cell } = p;
      lg.strokeStyle = s.ink; lg.lineWidth = 1.2;
      for (const i of cellsOf(w, p.gw)) {
        const [x, y] = cellAt(p, i);
        lg.globalAlpha = s.dark ? 0.06 : 0.08; lg.fillStyle = s.colors[w.c];
        lg.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        lg.globalAlpha = s.dark ? 0.32 : 0.38;
        lg.strokeRect(x + 0.6, y + 0.6, cell - 1.2, cell - 1.2);
      }
      paintNum(p, w);
    }

    /** @param {Puzzle} p @param {Word} w @returns {void} */
    function paintNum(p, w) {
      const { lg, cell } = p;
      const [x, y] = cellAt(p, w.y * p.gw + w.x);
      lg.globalAlpha = s.dark ? 0.45 : 0.55; lg.fillStyle = s.ink;
      lg.font = font(cell * 0.24); lg.textAlign = 'left'; lg.textBaseline = 'top';
      lg.fillText(String(w.num), x + cell * 0.1, y + cell * 0.07);
    }

    /** @param {Puzzle} p @param {Fill} f @returns {void} */
    function paintLetter(p, f) {
      const { lg, cell } = p;
      const [x, y] = cellAt(p, f.i);
      lg.globalAlpha = LETTER; lg.fillStyle = s.colors[p.words[f.w].c];
      lg.font = font(cell * 0.58); lg.textAlign = 'center'; lg.textBaseline = 'middle';
      lg.fillText(String.fromCharCode(p.grid[f.i]), x + cell / 2, y + cell * 0.56);
    }

    /** Paints the layer afresh to where the clock is. @param {Puzzle} p @returns {void} */
    function repaint(p) {
      const { lg, cell, gw, gh } = p;
      lg.setTransform(1, 0, 0, 1, 0, 0);
      lg.clearRect(0, 0, p.layer.width, p.layer.height);
      lg.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      p.done = 0; p.boxed = 0;
      if (layout === 1) {
        // The ruled sheet: blocks darker than the open cells (on dark, the open cells lit
        // instead), then the lines over all of it.
        lg.fillStyle = s.ink; lg.globalAlpha = 0.06;
        for (let i = 0; i < gw * gh; i++) {
          if (!p.grid[i] === s.dark) continue;
          const [x, y] = cellAt(p, i);
          lg.fillRect(x + 2, y + 2, cell - 4, cell - 4);
        }
        lg.strokeStyle = s.ink; lg.lineWidth = 1; lg.globalAlpha = s.dark ? 0.17 : 0.18;
        lg.beginPath();
        for (let x = 0; x <= gw; x++) { lg.moveTo(p.ox + x * cell, p.oy); lg.lineTo(p.ox + x * cell, p.oy + gh * cell); }
        for (let y = 0; y <= gh; y++) { lg.moveTo(p.ox, p.oy + y * cell); lg.lineTo(p.ox + gw * cell, p.oy + y * cell); }
        lg.stroke();
        for (const w of p.words) paintNum(p, w);
        p.boxed = p.words.length;
      } else if (layout === 2) {
        for (const w of p.words) paintBoxes(p, w);
        p.boxed = p.words.length;
      }
      advance(p);
    }

    /** Paints onto the layer whatever the clock has passed. @param {Puzzle} p @returns {void} */
    function advance(p) {
      while (p.boxed < p.words.length && p.starts[p.boxed] <= p.clock) {
        paintBoxes(p, p.words[p.order[p.boxed]]);
        p.boxed++;
      }
      while (p.done < p.seq.length && p.seq[p.done].at <= p.clock - POP) paintLetter(p, p.seq[p.done++]);
    }

    /** Lays the minis: one per slot of a loose grid, some slots left empty. @param {boolean} warm @returns {void} */
    function layMinis(warm) {
      const m = Math.min(s.W, s.H), cell = clamp(m / 17, 20, 34);
      const side = cell * 7;
      const cols = Math.max(1, Math.floor(s.W / (side * 1.25))), rows = Math.max(1, Math.floor(s.H / (side * 1.2)));
      const sw = s.W / cols, sh = s.H / rows;
      const keep = puzzles;
      puzzles = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cols * rows > 3 && rng.random() < 0.25) continue;
          const x = c * sw + rng.random() * Math.max(0, sw - side), y = r * sh + rng.random() * Math.max(0, sh - side);
          puzzles.push(puzzle(x, y, side, side, cell, 7, warm ? 0.2 + rng.random() * 0.7 : 0, keep.pop()));
        }
      }
    }

    return {
      lay() {
        if (layout === 2) { layMinis(true); return; }
        const m = Math.min(s.W, s.H), cell = clamp(m / 15, 24, 44);
        const frac = puzzles.length ? clamp(puzzles[0].clock / puzzles[0].end, 0, 1) : 0.45 + rng.random() * 0.2;
        const most = clamp(Math.round(s.W * s.H / (cell * cell * (layout === 1 ? 7 : 9))), 8, 70);
        puzzles = [puzzle(0, 0, s.W, s.H, cell, most, frac, puzzles[0])];
      },
      step(dt) {
        for (let k = 0; k < puzzles.length; k++) {
          const p = puzzles[k];
          p.clock += dt;
          if (p.clock > p.end + HOLD + FADE) {
            // Built anew where it was.
            if (layout === 2) puzzles[k] = puzzle(p.x, p.y, p.w, p.h, p.cell, 7, 0, p);
            else puzzles[k] = puzzle(0, 0, s.W, s.H, p.cell, p.words.length || 8, 0, p);
            continue;
          }
          advance(p);
        }
      },
      draw() {
        const { ctx } = s;
        for (const p of puzzles) {
          const fade = clamp(1 - (p.clock - p.end - HOLD) / FADE, 0, 1)
            * (layout === 0 ? 1 : clamp(p.clock / 0.8, 0, 1));
          ctx.globalAlpha = fade;
          ctx.drawImage(p.layer, p.x, p.y, p.w, p.h);
          // The word being entered, highlighted, and the cursor on the cell that comes next.
          let j = p.done;
          while (j < p.seq.length && p.seq[j].at <= p.clock) j++;
          const next = p.seq[Math.min(j, p.seq.length - 1)];
          if (next && j < p.seq.length && p.clock > 0) {
            const w = p.words[next.w];
            ctx.fillStyle = s.colors[w.c];
            ctx.globalAlpha = fade * (s.dark ? 0.16 : 0.2);
            for (const i of cellsOf(w, p.gw)) {
              const [x, y] = cellAt(p, i);
              ctx.fillRect(p.x + x + 1, p.y + y + 1, p.cell - 2, p.cell - 2);
            }
            const [x, y] = cellAt(p, next.i);
            ctx.strokeStyle = s.colors[w.c]; ctx.lineWidth = 2;
            ctx.globalAlpha = fade * 0.6;
            ctx.strokeRect(p.x + x + 2, p.y + y + 2, p.cell - 4, p.cell - 4);
          }
          // Letters landing: they settle from a little larger.
          ctx.font = font(p.cell * 0.58); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (let k = p.done; k < j; k++) {
            const f = p.seq[k], u = clamp((p.clock - f.at) / POP, 0, 1), e = 1 - (1 - u) * (1 - u);
            const [x, y] = cellAt(p, f.i);
            ctx.globalAlpha = fade * e * LETTER;
            ctx.fillStyle = s.colors[p.words[f.w].c];
            const z = 1.5 - 0.5 * e, cx = p.x + x + p.cell / 2, cy = p.y + y + p.cell * 0.56;
            ctx.setTransform(s.dpr * z, 0, 0, s.dpr * z, cx * s.dpr, cy * s.dpr);
            ctx.fillText(String.fromCharCode(p.grid[f.i]), 0, 0);
            ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
          }
        }
      },
    };
  });
}
