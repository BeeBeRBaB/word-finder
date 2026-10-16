// Automaton: one-dimensional cellular automata, each new row worked out from the row above by a
// fixed rule on every cell and its two neighbours, so triangles, chaos and gliders grow row by row
// down the page. The seed picks the variant: elementary rules (90, 30, 150, 110...) from a single
// cell filling the page, coloured by the neighbourhood that made each cell, then fading for the
// next; a random row run on and on, the page scrolling up, the rule changing now and then and each
// rule its own colour; or three-colour rules, a cell's next colour set by its neighbours' sum.

import { stage, clamp } from './stage.js';

const RATE = 6, HOLD = 3, FADE = 2;
// Elementary rules that grow well from one cell, and ones that stay lively from a random row.
const SEEDED = [90, 30, 150, 110, 18, 105, 45, 126, 22, 73, 60, 129];
const RANDOM = [110, 54, 30, 62, 18, 106, 41, 73, 137, 146, 193, 45];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    const scroll = s.layout === 1;
    let cd = 8, gap = 1, cols = 0, Rv = 0, S = 0;
    // Rows live in slots on small strip canvases, K rows each, so drawing a new row touches one
    // small canvas, not a page-sized one; the last page's strips are kept while it fades.
    const K = 8;
    /** @type {HTMLCanvasElement[]} */
    let strips = [];
    /** @type {HTMLCanvasElement[]} */
    let old = [];
    let oldA = 0;
    let cur = new Uint8Array(0);
    let n = 0, p = 0, hold = 0, era = 0, runLeft = 0;
    let rule = 0;
    /** The three-colour rule: next colour by the neighbourhood's sum. @type {number[]} */
    let table = [];
    let order = rng.shuffle((s.layout === 0 ? SEEDED : RANDOM).slice());

    /** Next row, and each cell's colour index (-1 empty), from `cur`. @param {Uint8Array} nx @param {Int8Array} ci */
    function next(nx, ci) {
      const w = cols;
      for (let i = 0; i < w; i++) {
        const l = cur[(i + w - 1) % w], c = cur[i], r = cur[(i + 1) % w];
        if (s.layout === 2) {
          nx[i] = table[l + c + r];
          ci[i] = nx[i] ? (era + (nx[i] - 1) * 2) % nc : -1;
        } else {
          const k = (l << 2) | (c << 1) | r;
          nx[i] = (rule >> k) & 1;
          ci[i] = !nx[i] ? -1 : s.layout === 0 ? k % nc : era % nc;
        }
      }
    }

    /** A three-colour rule that grows from one cell into a lively pattern, tried on a small strip. @returns {number[]} */
    function pickTable() {
      for (let tries = 0; tries < 300; tries++) {
        const t = [0, 1 + rng.int(2), rng.int(3), rng.int(3), rng.int(3), rng.int(3), rng.int(3)];
        const w = 161;
        let a = new Uint8Array(w);
        a[80] = 1;
        /** @type {string[]} */
        const last = [];
        for (let r = 0; r < 70; r++) {
          const b = new Uint8Array(w);
          for (let i = 1; i < w - 1; i++) b[i] = t[a[i - 1] + a[i] + a[i + 1]];
          a = b;
          if (r >= 66) last.push(a.join(''));
        }
        let on = 0, two = 0;
        for (let i = 0; i < w; i++) { if (a[i]) on++; if (a[i] === 2) two++; }
        // Wide, neither solid nor sparse, using both colours, and not repeating row after row.
        if (on > 40 && on < 120 && two > 8 && two < on - 8 && new Set(last).size === last.length) return t;
      }
      return [0, 1, 2, 0, 2, 1, 0];
    }

    /** Starts a page (or, scrolling, a new rule on the running row). */
    function begin() {
      era++;
      if (s.layout === 2) table = pickTable();
      else { rule = order[era % order.length]; if (era % order.length === 0) order = rng.shuffle(order); }
      runLeft = Math.round(Rv * (0.8 + rng.random() * 0.6));
      if (scroll && n > 0) return;
      n = 0; p = 0; hold = 0;
      cur = new Uint8Array(cols);
      if (scroll) for (let i = 0; i < cols; i++) cur[i] = rng.random() < 0.5 ? 1 : 0;
      else cur[cols >> 1] = 1;
    }

    /** @type {number[][]} */
    const bucket = [];
    /** Works out a row (the first is `cur` itself) and draws it into its slot. */
    function emit() {
      const ci = new Int8Array(cols);
      if (n > 0 || scroll) {
        const nx = new Uint8Array(cols);
        next(nx, ci);
        cur = nx;
      } else {
        for (let i = 0; i < cols; i++) ci[i] = cur[i] ? era % nc : -1;
      }
      const slot = n % S;
      const g = strips[Math.floor(slot / K)].getContext('2d');
      if (!g) return;
      const y = (slot % K) * cd;
      g.clearRect(0, y, cols * cd, cd);
      for (let k = 0; k < nc; k++) (bucket[k] ??= []).length = 0;
      for (let i = 0; i < cols; i++) if (ci[i] >= 0) bucket[ci[i] % nc].push(i);
      const sz = cd - gap;
      for (let k = 0; k < nc; k++) {
        if (!bucket[k].length) continue;
        g.fillStyle = s.colors[k];
        for (const i of bucket[k]) g.fillRect(i * cd, y, sz, sz);
      }
      n++;
      runLeft--;
    }

    /** Sizes (and so clears) a set of strips for the page. @param {HTMLCanvasElement[]} list */
    function fit(list) {
      while (list.length < S / K) list.push(document.createElement('canvas'));
      list.length = S / K;
      for (const c of list) { c.width = cols * cd; c.height = K * cd; }
    }

    /**
     * Draws rows a..b from their strips at their place on screen, alpha already set.
     * @param {HTMLCanvasElement[]} list @param {number} a @param {number} b @param {number} off
     */
    function blit(list, a, b, off) {
      const { ctx } = s;
      const w = cols * cd;
      while (a <= b) {
        const slot = a % S, k = slot % K, len = Math.min(b - a + 1, K - k);
        ctx.drawImage(list[Math.floor(slot / K)], 0, k * cd, w, len * cd, 0, a * cd - off, w, len * cd);
        a += len;
      }
    }

    return {
      lay() {
        const Wd = Math.round(s.W * s.dpr), Hd = Math.round(s.H * s.dpr);
        cd = Math.max(3, Math.round(clamp(Math.min(s.W, s.H) / 75, 5, 10) * s.dpr));
        gap = Math.max(1, Math.round(cd * 0.16));
        cols = Math.ceil(Wd / cd);
        Rv = Math.floor(Hd / cd);
        S = Math.ceil((Rv + 3) / K) * K;
        fit(strips);
        oldA = 0;
        // A new size starts afresh, already part way down the page (all the way for reduced motion).
        era = rng.int(order.length) - 1;
        n = 0;
        begin();
        const warm = scroll || s.reduced ? Rv + 1 : Math.round(Rv * 0.45);
        for (let i = 0; i < warm; i++) emit();
      },
      step(dt) {
        if (oldA > 0) oldA = Math.max(0, oldA - dt / FADE);
        if (!scroll && n >= Rv + 1) {
          // The page is full: hold, then fade it out while the next one starts at the top.
          hold += dt;
          if (hold > HOLD) {
            [old, strips] = [strips, old];
            fit(strips);
            oldA = 1;
            begin();
            emit();
          }
          return;
        }
        p += dt * RATE;
        while (p >= 1) {
          p -= 1;
          if (scroll && runLeft <= 0) begin();
          emit();
        }
      },
      draw() {
        const { ctx } = s;
        // A scrolling random row covers the whole page, so it is inked lighter.
        const A = scroll ? (s.dark ? 0.3 : 0.34) : s.dark ? 0.42 : 0.46;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (oldA > 0 && old.length) { ctx.globalAlpha = A * oldA; blit(old, 0, Rv, 0); }
        if (n > 0) {
          // The newest row eases in over its interval; scrolling keeps it at the bottom.
          const fade = scroll || n < Rv + 1 ? p : 1;
          const off = scroll ? Math.max(0, (n - 1 + fade - Rv) * cd) : 0;
          ctx.globalAlpha = A;
          blit(strips, Math.max(0, n - S + 1), n - 2, Math.round(off));
          ctx.globalAlpha = A * Math.max(0.05, fade);
          blit(strips, n - 1, n - 1, Math.round(off));
        }
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      },
    };
  });
}
