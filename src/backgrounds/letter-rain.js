// Letter rain: columns of A-Z stream down a row at a time, each led by a bright head letter, with a
// trail fading out behind it whose letters now and then change. The seed picks the variant: an
// even grid of columns, three depths of columns at different sizes and speeds (far ones small,
// faint and slow), or sparse, larger columns whose fixed letters spell words down the trail.

import { stage, clamp, mix } from './stage.js';

/** @typedef {{x:number, fs:number, head:number, v:number, L:number, c:number, a:number, letters:Uint8Array}} Column
 * A column at x with letter size fs (CSS px); the head's row (fractional), speed in rows/s, trail
 * length in rows, colour, alpha scale for its depth, and the letter (0..25) held in each row. */

const S = 64;   // atlas cell in px
const WORDS = ['FIND', 'SEEK', 'WORD', 'GRID', 'LETTER', 'SEARCH', 'PUZZLE', 'CLUE', 'SPELL', 'HIDDEN',
  'FOUND', 'QUEST', 'RIDDLE', 'ACROSS', 'DOWN', 'LOOK', 'SPOT', 'TRACE', 'MATCH', 'CIRCLE', 'SCAN', 'READ'];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const atlas = s.colors.map((c) => letters(c));
    /** @type {Column[]} */
    let cols = [];

    /** Fills a column's rows with letters: random, or words with a gap after each. @param {Column} c @returns {void} */
    function fill(c) {
      const n = Math.ceil(s.H / c.fs) + 2;
      c.letters = new Uint8Array(n);
      if (layout === 2) {
        // Words with a gap of one to three rows after each; a gap row holds 255, drawn as nothing.
        c.letters.fill(255);
        let i = rng.int(4);
        while (i < n) {
          for (const ch of WORDS[rng.int(WORDS.length)]) if (i < n) c.letters[i++] = ch.charCodeAt(0) - 65;
          i += 1 + rng.int(3);
        }
      } else for (let i = 0; i < n; i++) c.letters[i] = rng.int(26);
    }

    /** Sends a column back above the top. @param {Column} c @param {boolean} anywhere @returns {void} */
    function launch(c, anywhere) {
      const n = c.letters.length;
      c.L = Math.round(mix(7, 18, rng.random()) * (layout === 2 ? 1.2 : 1));
      c.head = anywhere ? rng.random() * (n + c.L) : -rng.random() * n * 0.6;
      c.c = rng.int(atlas.length);
    }

    /** The column layout for this size: x, size, speed and depth alpha of each. @returns {{x:number, fs:number, v:number, a:number}[]} */
    function plan() {
      const m = Math.min(s.W, s.H);
      const base = clamp(m / 38, 13, 24);
      /** @type {{x:number, fs:number, v:number, a:number}[]} */
      const out = [];
      if (layout === 1) {
        // Three depths, each its own scatter of columns, drawn far to near.
        for (const [k, sc, v, a] of [[0, 0.62, 3.2, 0.5], [1, 0.85, 4.5, 0.72], [2, 1.15, 6, 1]]) {
          const fs = base * sc, n = Math.round(s.W / fs * (k === 2 ? 0.24 : 0.34));
          for (let i = 0; i < n; i++) out.push({ x: rng.random() * (s.W - fs), fs, v: v * mix(0.8, 1.2, rng.random()), a });
        }
      } else if (layout === 2) {
        const fs = base * 1.25, n = Math.floor(s.W / fs);
        for (let i = 0; i < n; i++) if (rng.random() < 0.7) out.push({ x: i * fs, fs, v: mix(2.5, 4, rng.random()), a: 1 });
      } else {
        const gap = base * 1.2, n = Math.floor(s.W / gap);
        for (let i = 0; i < n; i++) out.push({ x: i * gap + (s.W - n * gap + gap - base) / 2, fs: base, v: mix(3.5, 7, rng.random()), a: 1 });
      }
      return out;
    }

    return {
      lay() {
        const spec = plan();
        // Keep each existing column's motion and colour; only its place, size and letters follow the new size.
        const next = spec.map((p, i) => {
          const c = cols[i] ?? { x: 0, fs: 0, head: 0, v: 0, L: 0, c: 0, a: 1, letters: new Uint8Array(0) };
          const fresh = !cols[i];
          Object.assign(c, p);
          fill(c);
          if (fresh) launch(c, true);
          return c;
        });
        cols = next;
      },
      step(dt) {
        for (const c of cols) {
          c.head += c.v * dt;
          if (c.head - c.L > c.letters.length) launch(c, false);
          // Now and then a trail letter changes (never in the word variant).
          if (layout !== 2 && rng.random() < dt * 1.2) {
            const r = Math.floor(c.head) - 1 - rng.int(c.L);
            if (r >= 0 && r < c.letters.length) c.letters[r] = rng.int(26);
          }
        }
      },
      draw() {
        const { ctx } = s;
        const headA = s.dark ? 0.62 : 0.66, trailA = s.dark ? 0.4 : 0.44;
        for (const c of cols) {
          const img = atlas[c.c], top = Math.floor(c.head), fs = c.fs;
          // The trail, snapped to rows, fading with distance from the head.
          for (let k = 1; k <= c.L; k++) {
            const r = top - k;
            if (r < 0) break;
            if (r >= c.letters.length) continue;
            const ch = c.letters[r];
            if (ch > 25) continue;
            ctx.globalAlpha = trailA * c.a * (1 - k / (c.L + 1)) ** 1.4;
            ctx.drawImage(img, ch * S, 0, S, S, c.x, r * fs, fs, fs);
          }
          // The head, brightest, easing up over its moment in a row so it never pops on at full.
          if (top >= 0 && top < c.letters.length && c.letters[top] <= 25) {
            ctx.globalAlpha = headA * c.a * (0.7 + 0.3 * (c.head - top));
            ctx.drawImage(img, c.letters[top] * S, 0, S, S, c.x, top * fs, fs, fs);
          }
        }
      },
    };
  });
}

/** The 26 capitals in one colour, side by side in S px cells. @param {string} color @returns {HTMLCanvasElement} */
function letters(color) {
  const c = document.createElement('canvas');
  c.width = S * 26; c.height = S;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.font = `700 ${Math.round(S * 0.8)}px ui-monospace, Menlo, Consolas, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < 26; i++) g.fillText(String.fromCharCode(65 + i), i * S + S / 2, S / 2 + S * 0.04);
  return c;
}
