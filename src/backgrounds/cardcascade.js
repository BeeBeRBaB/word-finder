// Card cascade: the old solitaire win. Cards leap one by one off the four foundation piles, fall,
// bounce along the bottom of the page and leave it, stamping a copy of themselves at every frame
// so each flight draws a ribbon of cards; every few cards the ribbons fade and the next begin.
// The seed picks the variant: piles at the top right and one card at a time in solid ribbons;
// piles in both top corners, two cards crossing, a copy every few frames so each arc is a string
// of separate cards; or piles spread along the top, cards from each in turn, ribbons fading as they go.

import { roundRect } from './shapes.js';
import { stage, clamp } from './stage.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const WIPE = 2.5;      // s for finished ribbons to fade

/** @typedef {{x:number, y:number, vx:number, vy:number, suit:number, rank:number, n:number}} Card
 * x, y its top left; n frames since it left its pile. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    const L = s.layout;
    // The ribbons so far, and the last lot fading; at device pixels.
    let cur = document.createElement('canvas'), old = document.createElement('canvas');
    let wipe = WIPE, since = 0, decay = 0, launch = 0, next = 0;  // decay: frames of fading so far
    let cw = 40, ch = 56, g = 400, V = 150;
    /** Cards left on each pile, and where the piles stand. */
    const left = [13, 13, 13, 13];
    /** @type {[number, number][]} */
    let piles = [];
    /** @type {Card[]} */
    const flying = [];
    /** One face per suit, at device pixels. @type {HTMLCanvasElement[]} */
    let faces = [];
    const every = L === 1 ? 3 : L === 2 ? 2 : 1;   // frames between copies
    const most = L === 1 ? 2 : L === 2 ? 4 : 1;    // cards in flight at once
    const batch = L === 1 ? 8 : 6;                 // cards before the ribbons fade

    /** @param {CanvasRenderingContext2D} c @param {number} suit */
    function pip(c, suit) {
      c.beginPath();
      if (suit === 0) {
        c.moveTo(0, 0.9);
        c.bezierCurveTo(-1.25, 0, -0.85, -1.05, 0, -0.45);
        c.bezierCurveTo(0.85, -1.05, 1.25, 0, 0, 0.9);
      } else if (suit === 1) {
        c.moveTo(0, -1); c.lineTo(0.72, 0); c.lineTo(0, 1); c.lineTo(-0.72, 0);
      } else if (suit === 2) {
        c.moveTo(0, -1);
        c.bezierCurveTo(-1.25, -0.05, -0.75, 0.8, 0, 0.35);
        c.bezierCurveTo(0.75, 0.8, 1.25, -0.05, 0, -1);
        c.moveTo(0, 0.25); c.lineTo(-0.35, 1); c.lineTo(0.35, 1);
      } else {
        for (const [x, y] of [[0, -0.48], [-0.5, 0.18], [0.5, 0.18]]) { c.moveTo(x + 0.44, y); c.arc(x, y, 0.44, 0, Math.PI * 2); }
        c.moveTo(0, 0.1); c.lineTo(-0.32, 1); c.lineTo(0.32, 1);
      }
      c.closePath();
      c.fill();
    }

    /** @param {number} suit @returns {HTMLCanvasElement} */
    function face(suit) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(cw * s.dpr); c.height = Math.ceil(ch * s.dpr);
      const k = c.getContext('2d');
      if (!k) return c;
      const col = s.colors[suit % nc], lw = Math.max(1.5, cw * 0.035);
      k.scale(s.dpr, s.dpr);
      k.fillStyle = col; k.strokeStyle = col;
      k.beginPath(); roundRect(k, lw / 2, lw / 2, cw - lw, ch - lw, cw * 0.09);
      k.globalAlpha = 0.24; k.fill();
      k.globalAlpha = 1; k.lineWidth = lw; k.stroke();
      k.save(); k.translate(cw / 2, ch * 0.56); k.scale(cw * 0.22, cw * 0.22); pip(k, suit); k.restore();
      k.save(); k.translate(cw * 0.2, ch * 0.36); k.scale(cw * 0.08, cw * 0.08); pip(k, suit); k.restore();
      return c;
    }

    /** One card's picture at x, y. @param {CanvasRenderingContext2D} k @param {Card} c */
    function paint(k, c) {
      k.drawImage(faces[c.suit], c.x, c.y, cw, ch);
      k.fillStyle = s.colors[c.suit % nc];
      k.fillText(RANKS[c.rank], c.x + cw * 0.2, c.y + ch * 0.17);
    }

    /** Stamps a copy, cut out of the ribbon under it so the newest lies on top.
     * @param {CanvasRenderingContext2D} k @param {Card} c */
    function stamp(k, c) {
      k.globalCompositeOperation = 'destination-out';
      k.beginPath(); roundRect(k, c.x, c.y, cw, ch, cw * 0.09); k.fill();
      k.globalCompositeOperation = 'source-over';
      paint(k, c);
    }

    /** @param {HTMLCanvasElement} cv @returns {CanvasRenderingContext2D|null} */
    function pen(cv) {
      const k = cv.getContext('2d');
      if (!k) return null;
      k.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      k.font = `600 ${Math.round(cw * 0.27)}px system-ui, sans-serif`;
      k.textAlign = 'center'; k.textBaseline = 'middle';
      return k;
    }

    /** The next card off a pile, or null when they are all gone. @returns {Card|null} */
    function leap() {
      const order = L === 2 ? [next % 4] : rng.shuffle([0, 1, 2, 3]);
      next++;
      for (const p of order) {
        if (!left[p]) continue;
        left[p]--;
        const [x, y] = piles[p];
        const dir = L === 2 ? (rng.random() < 0.5 ? -1 : 1) : x + cw / 2 > s.W / 2 ? -1 : 1;
        return { x, y, suit: p, rank: left[p], n: 0, vx: dir * V * (0.45 + rng.random() * 0.8),
          vy: -V * rng.random() * (L === 1 ? 1.4 : 0.8) };
      }
      return null;
    }

    /** @param {Card} c @param {number} dt @returns {boolean} false once it has left the page */
    function fly(c, dt) {
      c.vy += g * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.y > s.H - ch && c.vy > 0) { c.y = s.H - ch; c.vy *= -0.8; }
      c.n++;
      return c.x > -cw && c.x < s.W;
    }

    /** Moves the cards on, stamping ribbons, and keeps cards leaving the piles. @param {number} dt */
    function advance(dt) {
      const k = pen(cur);
      for (let i = flying.length - 1; i >= 0; i--) {
        const c = flying[i];
        if (!fly(c, dt)) { flying.splice(i, 1); continue; }
        if (k && c.n % every === 0) stamp(k, c);
      }
      launch -= dt;
      const empty = !left.some(Boolean);
      if (launch <= 0 && flying.length < most && !empty && (L === 2 || since < batch)) {
        const c = leap();
        if (c) { flying.push(c); since++; if (k) stamp(k, c); }
        launch = L === 2 ? 1.3 : L === 1 ? 1.6 : 0.3;
      }
      // A batch done: its ribbons fade while the next begins; empty piles fill again.
      if (!flying.length && L !== 2 && (since >= batch || (empty && since > 0))) fade();
      if (empty && !flying.length && launch <= -1) { left.fill(13); launch = 0.8; }
      // Ribbons fading as they go: each frame dims one of eight bands a step, so every part of
      // the page dims once in eight frames and no frame pays for all of it.
      if (L === 2 && k) {
        const band = decay++ % 8, y0 = Math.round(band * cur.height / 8), y1 = Math.round((band + 1) * cur.height / 8);
        k.setTransform(1, 0, 0, 1, 0, 0);
        k.globalCompositeOperation = 'destination-out';
        k.globalAlpha = 0.07; k.fillRect(0, y0, cur.width, y1 - y0);
        k.globalAlpha = 1; k.globalCompositeOperation = 'source-over';
      }
      wipe += dt;
    }

    function fade() {
      [old, cur] = [cur, old];
      const k = cur.getContext('2d');
      k?.clearRect(0, 0, cur.width, cur.height);
      wipe = 0; since = 0; launch = 0.6;
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        cw = clamp(m * (L === 2 ? 0.07 : 0.085), 30, L === 2 ? 64 : 78); ch = cw * 1.4;
        g = s.H * 0.5; V = clamp(m * 0.28, 90, 240);
        const gap = cw * 0.18, y = clamp(m * 0.035, 10, 40);
        piles = [0, 1, 2, 3].map((i) => {
          if (L === 0) return [s.W - y - (4 - i) * (cw + gap) + gap, y];
          if (L === 1) return [i < 2 ? y + i * (cw + gap) : s.W - y - (4 - i) * (cw + gap) + gap, y];
          return [(s.W - cw) * (i + 0.5) / 4, y];
        });
        faces = [0, 1, 2, 3].map(face);
        for (const cv of [cur, old]) { cv.width = Math.round(s.W * s.dpr); cv.height = Math.round(s.H * s.dpr); }
        for (const c of flying) { c.x = Math.min(c.x, s.W - cw); c.y = Math.min(c.y, s.H - ch); }
        // Ribbons already on the page, and a card in the air.
        const keep = left.slice(), was = since;
        flying.length = 0;
        const runs = L === 2 ? 3 : 2;
        const k = pen(cur);
        for (let r = 0; r < runs; r++) {
          left.fill(1 + rng.int(13));
          const c = leap();
          for (let t = 0; c && t < 600; t++) {
            const ok = fly(c, 1 / 30);
            if (!ok) break;
            if (k && c.n % every === 0) stamp(k, c);
          }
        }
        left.splice(0, 4, ...keep); since = was;
        const c = leap();
        if (c) {
          flying.push(c); since++;
          for (let i = 0; i < 24; i++) { fly(c, 1 / 30); if (k && c.n % every === 0) stamp(k, c); }
        }
        launch = 0.5;
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        const A = s.dark ? 0.44 : 0.5;
        if (wipe < WIPE) {
          ctx.globalAlpha = A * (1 - wipe / WIPE);
          ctx.drawImage(old, 0, 0, s.W, s.H);
        }
        ctx.globalAlpha = A;
        ctx.drawImage(cur, 0, 0, s.W, s.H);
        // The piles: their top cards, or an empty place.
        ctx.font = `600 ${Math.round(cw * 0.27)}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let p = 0; p < 4; p++) {
          const [x, y] = piles[p];
          if (left[p]) { paint(ctx, { x, y, vx: 0, vy: 0, suit: p, rank: left[p] - 1, n: 0 }); continue; }
          ctx.strokeStyle = s.ink; ctx.lineWidth = 1.5;
          ctx.globalAlpha = A * 0.6;
          ctx.beginPath(); roundRect(ctx, x + 1, y + 1, cw - 2, ch - 2, cw * 0.09); ctx.stroke();
          ctx.globalAlpha = A;
        }
      },
    };
  });
}
