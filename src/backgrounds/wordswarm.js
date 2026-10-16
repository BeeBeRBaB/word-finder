// Word swarm: a cloud of specks in the look's colours streams together to spell a word, holds it
// with a faint shimmer, then breaks up and drifts until it gathers into the next. The seed picks
// the variant: specks wandering a slow current over the whole host between words in the middle,
// a wind carrying them across and round again, or a buzzing swarm that roams the host as a ball
// and settles into each word wherever it happens to be.

import { stage, TAU, clamp } from './stage.js';

const WORDS = ['HELLO', 'SEEK', 'FIND', 'WORDS', 'PLAY', 'SOLVE', 'SPELL', 'HUNT', 'CLUE', 'LOOK', 'QUEST',
  'GRID', 'FOUND', 'BRAVO', 'SWARM', 'DREAM', 'SHINE', 'FLOCK', 'BUZZ', 'HAPPY', 'LUCKY', 'FOCUS', 'WONDER',
  'SPARK', 'BLOOM', 'DRIFT', 'GATHER', 'LETTERS', 'PUZZLE', 'SEARCH', 'GLOW', 'CALM', 'BREEZE', 'MAGIC'];
const SW = 360, SH = 120;  // the canvas a word is sampled from
const FORM = 3.2;  // specks take about this long to arrive
const HOLD = 3;    // then hold the word this long
const FREE = 5;    // and roam this long before the next

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    let n = 0, sz = 2;
    let px = new Float32Array(0), py = px, vx = px, vy = px, tx = px, ty = px, wait = px, orb = px;
    let clock = 0, phase = 0, until = 0, word = '';
    // Where the word sits and the swarm's centre (layout 2).
    let wx = 0, wy = 0, ww = 0, cx = 0, cy = 0, wu = 0.5;
    const sample = document.createElement('canvas');
    sample.width = SW; sample.height = SH;
    const sg = sample.getContext('2d', { willReadFrequently: true });
    /** @type {Float32Array} sampled ink points, x then y, in sample px */
    let ink = new Float32Array(0);
    let inkN = 0, inkW = 0;

    /** Samples a word's letters into `ink`. @param {string} w @returns {void} */
    function sampleWord(w) {
      if (!sg) return;
      sg.clearRect(0, 0, SW, SH);
      const font = (/** @type {number} */ f) => `700 ${f}px 'Space Grotesk',system-ui,sans-serif`;
      sg.font = font(100);
      const f = Math.min(100, Math.floor(100 * (SW - 16) / sg.measureText(w).width));
      sg.font = font(f); sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillStyle = '#000';
      sg.fillText(w, SW / 2, SH / 2);
      inkW = sg.measureText(w).width;
      const data = sg.getImageData(0, 0, SW, SH).data;
      const pts = [];
      for (let y = 1; y < SH; y += 2) for (let x = 1; x < SW; x += 2) if (data[(y * SW + x) * 4 + 3] > 140) pts.push(x, y);
      ink = new Float32Array(pts); inkN = pts.length / 2;
    }

    /** Places the word for the size and gives every speck a point of it. @param {boolean} fresh a new word, not a resize @returns {void} */
    function aim(fresh) {
      if (!inkN) return;
      const m = Math.min(s.W, s.H);
      const k = Math.min((layout === 2 ? Math.min(s.W * 0.6, m * 0.95) : s.W * 0.84) / inkW, s.H * (layout === 2 ? 0.26 : 0.34) / (SH * 0.6));
      ww = inkW * k;
      if (layout === 2) {
        // Wherever the swarm is, kept on the host.
        wx = clamp(cx, ww / 2 + 10, s.W - ww / 2 - 10); wy = clamp(cy, SH * k * 0.4, s.H - SH * k * 0.4);
      } else {
        // Centred across, at a fresh height each word, so a tall host shows it above or below the board.
        const hh = SH * k * 0.35 + s.H * 0.06;
        if (fresh) wu = rng.random();
        wx = s.W / 2; wy = hh + Math.max(0, s.H - 2 * hh) * wu;
      }
      for (let i = 0; i < n; i++) {
        const j = (i * 7919) % inkN;
        tx[i] = wx + (ink[j * 2] - SW / 2 + (rng.random() - 0.5) * 2) * k;
        ty[i] = wy + (ink[j * 2 + 1] - SH / 2 + (rng.random() - 0.5) * 2) * k;
      }
    }

    /** Picks the next word and starts the specks toward it. @returns {void} */
    function nextWord() {
      let w = WORDS[rng.int(WORDS.length)];
      while (w === word) w = WORDS[rng.int(WORDS.length)];
      word = w;
      sampleWord(w);
      aim(true);
      for (let i = 0; i < n; i++) wait[i] = rng.random() * 1.2;
      phase = 0; until = clock + FORM + HOLD;
    }

    /** Sizes the speck arrays for the area, keeping the specks there were. @returns {void} */
    function count() {
      const m = clamp(Math.round(s.W * s.H / 900), 500, 1400);
      sz = clamp(Math.min(s.W, s.H) / 260, 2, 3.2);
      if (m === n) return;
      /** @param {Float32Array} a */
      const grow = (a) => { const b = new Float32Array(m); b.set(a.subarray(0, Math.min(n, m))); return b; };
      px = grow(px); py = grow(py); vx = grow(vx); vy = grow(vy); tx = grow(tx); ty = grow(ty); wait = grow(wait); orb = grow(orb);
      for (let i = n; i < m; i++) {
        px[i] = rng.random() * s.W; py[i] = rng.random() * s.H;
        orb[i] = 0.25 + 0.75 * Math.sqrt(rng.random());
      }
      n = m;
    }

    /** Advances everything by dt. @param {number} dt @returns {void} */
    function step(dt) {
      clock += dt;
      const t = clock, m = Math.min(s.W, s.H);
      if (layout === 2) {
        // The swarm's centre roams the host on a slow figure.
        cx = s.W * (0.5 + 0.34 * Math.sin(t * 0.11 + 1)); cy = s.H * (0.5 + 0.3 * Math.sin(t * 0.17));
      }
      if (phase === 0 && clock > until) {
        phase = 1; until = clock + FREE;
        // Breaking up: a gentle push out from the word.
        for (let i = 0; i < n; i++) {
          const a = rng.random() * TAU, v = (12 + rng.random() * 30) * m / 600;
          vx[i] += Math.cos(a) * v + (px[i] - wx) * 0.15; vy[i] += Math.sin(a) * v + (py[i] - wy) * 0.15;
          wait[i] = rng.random() * 0.8;
        }
      } else if (phase === 1 && clock > until) nextWord();
      const e = Math.exp(-dt * 1.4);
      if (phase === 0) {
        // A spring to each point, a little short of critical so specks settle with a small sway.
        const K = 5, D = 3.6;
        for (let i = 0; i < n; i++) {
          if (wait[i] > 0) { wait[i] -= dt; px[i] += vx[i] * dt; py[i] += vy[i] * dt; vx[i] *= e; vy[i] *= e; continue; }
          const jx = Math.sin(t * 1.3 + i) * 0.5, jy = Math.cos(t * 1.1 + i * 1.7) * 0.5;
          vx[i] += ((tx[i] + jx - px[i]) * K - vx[i] * D) * dt;
          vy[i] += ((ty[i] + jy - py[i]) * K - vy[i] * D) * dt;
          px[i] += vx[i] * dt; py[i] += vy[i] * dt;
        }
        return;
      }
      const v0 = m * (layout === 1 ? 0.11 : 0.06), f = 1 - Math.exp(-dt * 0.9);
      for (let i = 0; i < n; i++) {
        let dx, dy;
        if (layout === 2) {
          // Round the centre at the speck's own radius, a little in and out.
          const ox = px[i] - cx, oy = py[i] - cy, d = Math.hypot(ox, oy) + 1e-3;
          const r = orb[i] * m * 0.2, dir = i % 2 ? 1 : -1, sp = m * 0.25;
          dx = (-oy / d) * sp * dir + (ox / d) * (r - d) * 1.6;
          dy = (ox / d) * sp * dir + (oy / d) * (r - d) * 1.6;
        } else {
          // A slow current that turns across the host.
          const a = Math.sin(px[i] * 0.0042 + t * 0.13) * 2.2 + Math.cos(py[i] * 0.0051 - t * 0.1) * 2.2;
          dx = Math.cos(a) * v0 + (layout === 1 ? v0 * 1.4 : 0); dy = Math.sin(a) * v0;
        }
        if (wait[i] > 0) wait[i] -= dt;
        else { vx[i] += (dx - vx[i]) * f; vy[i] += (dy - vy[i]) * f; }
        px[i] += vx[i] * dt; py[i] += vy[i] * dt;
        if (layout !== 2) {
          if (px[i] < -10) px[i] += s.W + 20; else if (px[i] > s.W + 10) px[i] -= s.W + 20;
          if (py[i] < -10) py[i] += s.H + 20; else if (py[i] > s.H + 10) py[i] -= s.H + 20;
        }
      }
    }

    return {
      lay() {
        const was = n, ow = s.W, oh = s.H;
        count();
        if (!word) {
          if (layout === 2) step(0);
          for (let i = 0; i < n; i++) {
            if (layout === 2) { const a = rng.random() * TAU, r = orb[i] * Math.min(ow, oh) * 0.2; px[i] = cx + Math.cos(a) * r; py[i] = cy + Math.sin(a) * r; }
          }
          nextWord();
          // Warm up: the specks most of the way into the first word.
          for (let k = 0; k < 40; k++) step(1 / 15);
          return;
        }
        if (was) aim(false);
      },
      step,
      draw() {
        const { ctx } = s;
        ctx.globalAlpha = s.dark ? 0.62 : 0.68;
        const h = sz / 2;
        for (let c = 0; c < nc; c++) {
          ctx.fillStyle = s.colors[c];
          for (let i = c; i < n; i += nc) ctx.fillRect(px[i] - h, py[i] - h, sz, sz);
        }
      },
    };
  });
}
