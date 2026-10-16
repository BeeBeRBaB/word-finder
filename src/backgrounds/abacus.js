// Abacus: beads slide along their rods counting up, and each time a rod passes nine its beads
// fall back and one on the next rod moves, the carry rippling along. The seed picks the variant:
// sorobans (one bead above the beam, four below) down the page, counting in ones at their own
// pace; a school counting frame of ten beads a wire; or a grid of small two-and-five suanpans,
// each counting in its own steps.

import { roundRect } from './shapes.js';
import { stage, clamp, mix } from './stage.js';

const RIPPLE = 0.17;   // s for a carry to reach the next rod
const GLIDE = 9;       // bead easing rate, 1/s

/** @typedef {{kind:number, n:number, x:number, y:number, p:number, bh:number, digits:Int8Array,
 *   shown:Int8Array, pend:Int8Array, at:Float32Array, pos:Float32Array, step:number, every:number,
 *   clock:number, c:number, moving:Uint8Array, cv:HTMLCanvasElement, lg:CanvasRenderingContext2D}} Frame
 * kind 0 soroban, 1 counting frame, 2 suanpan; n rods (wires), the ones rod first; x, y its top
 * left, p the rod spacing, bh a bead's length along the rod; digits the count, shown what the
 * beads show (a carry arrives late), pend/at a digit on its way and when; pos each bead's place,
 * 0 at rest to 1 counted; it adds step every `every` s. Rods at rest are painted into cv (the frame
 * with a 4px margin, its own canvas so a change uploads only it), and only moving ones each frame. */

/** Beads a rod holds above and below the beam (counting frame: ten on one wire), and the room
 * each side has, in bead lengths. */
const KINDS = [{ hk: 1, ek: 4, hz: 2.2, ez: 5.4 }, { hk: 0, ek: 10, hz: 0, ez: 15 }, { hk: 2, ek: 5, hz: 3.3, ez: 6.6 }];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const FILL = s.dark ? 0.36 : 0.42, EDGE = s.dark ? 0.62 : 0.7, WOOD = s.dark ? 0.3 : 0.34;
    /** @type {Frame[]} */
    let frames = [];
    /** @type {Map<string, HTMLCanvasElement>} */
    const sprites = new Map();
    let now = 0;

    /** @param {number} kind @param {number} n @param {number} step @param {number} every @returns {Frame} */
    function frame(kind, n, step, every) {
      const per = KINDS[kind].hk + KINDS[kind].ek;
      const digits = new Int8Array(n);
      // A count with a few high digits and the low rods near a carry.
      for (let r = 0; r < n; r++) digits[r] = r < 2 ? 6 + rng.int(4) : r < n - 2 && rng.random() < 0.6 ? rng.int(10) : 0;
      const f = { kind, n, x: 0, y: 0, p: 0, bh: 0, digits, shown: Int8Array.from(digits), pend: new Int8Array(n).fill(-1),
        at: new Float32Array(n), pos: new Float32Array(n * per), step, every, clock: rng.random() * every, c: rng.int(nc),
        moving: new Uint8Array(n), cv: document.createElement('canvas'), lg: /** @type {any} */ (null) };
      f.lg = /** @type {CanvasRenderingContext2D} */ (f.cv.getContext('2d'));
      for (let r = 0; r < n; r++) for (let b = 0; b < per; b++) f.pos[r * per + b] = target(f, r, b);
      return f;
    }

    /** Whether bead b of rod r counts at the digit shown. @param {Frame} f @param {number} r @param {number} b */
    function target(f, r, b) {
      const { hk } = KINDS[f.kind], d = f.shown[r];
      return b < hk ? (b < Math.floor(d / 5) ? 1 : 0) : (b - hk < (f.kind === 1 ? d : d % 5) ? 1 : 0);
    }

    /** @param {Frame} f @param {number} dt */
    function advance(f, dt) {
      f.clock += dt;
      if (f.clock >= f.every) {
        f.clock -= f.every;
        // Add, then let each changed rod follow the one below it a beat later.
        let carry = f.step, k = 0;
        for (let r = 0; r < f.n && carry; r++) {
          const v = f.digits[r] + carry;
          carry = Math.floor(v / 10);
          if (f.digits[r] !== v % 10) {
            f.digits[r] = v % 10;
            if (f.pend[r] >= 0) wake(f, r, f.pend[r]);
            f.pend[r] = v % 10; f.at[r] = now + RIPPLE * k++;
          }
        }
      }
      const per = KINDS[f.kind].hk + KINDS[f.kind].ek, e = 1 - Math.exp(-dt * GLIDE);
      for (let r = 0; r < f.n; r++) {
        if (f.pend[r] >= 0 && now >= f.at[r]) { wake(f, r, f.pend[r]); f.pend[r] = -1; }
        if (!f.moving[r]) continue;
        let most = 0;
        for (let b = 0; b < per; b++) {
          const i = r * per + b, g = target(f, r, b) - f.pos[i];
          f.pos[i] += g * e;
          most = Math.max(most, Math.abs(g));
        }
        if (most < 0.004) {
          for (let b = 0; b < per; b++) f.pos[r * per + b] = target(f, r, b);
          f.moving[r] = 0;
          paintRod(f, r);
        }
      }
    }

    /** Shows digit d on rod r, which starts moving: its canvas keeps only the rod. @param {Frame} f @param {number} r @param {number} d */
    function wake(f, r, d) {
      f.shown[r] = d;
      if (!f.moving[r]) { f.moving[r] = 1; paintRod(f, r); }
    }

    /** Repaints rod r's strip of f's canvas, with its beads while it rests. @param {Frame} f @param {number} r */
    function paintRod(f, r) {
      const [w, h] = size(f), t = f.p * 0.2, d = s.dpr, lg = f.lg;
      const across = f.kind === 1 ? f.y + h - f.p * (r + 0.75) : f.x + w - f.p * (r + 0.75);
      const a0 = Math.round((across - f.p / 2) * d) / d, a1 = Math.round((across + f.p / 2) * d) / d;
      const along0 = (f.kind === 1 ? f.x : f.y) + t * 0.75, along1 = (f.kind === 1 ? f.x + w : f.y + h) - t * 0.75;
      const b0 = Math.round(along0 * d) / d, b1 = Math.round(along1 * d) / d;
      const [x, y, rw, rh] = f.kind === 1 ? [b0, a0, b1 - b0, a1 - a0] : [a0, b0, a1 - a0, b1 - b0];
      lg.save();
      lg.beginPath(); lg.rect(x, y, rw, rh); lg.clip();
      lg.clearRect(x, y, rw, rh);
      lg.fillStyle = lg.strokeStyle = s.ink;
      lg.globalAlpha = 0.05; lg.fillRect(x, y, rw, rh);
      lg.globalAlpha = WOOD * 0.9; lg.lineWidth = Math.max(1.5, f.p * 0.05);
      lg.beginPath();
      if (f.kind === 1) { lg.moveTo(f.x, across); lg.lineTo(f.x + w, across); } else { lg.moveTo(across, f.y); lg.lineTo(across, f.y + h); }
      lg.stroke();
      if (f.kind !== 1) {
        const by = f.y + t + KINDS[f.kind].hz * f.bh;
        lg.globalAlpha = WOOD * 0.8; lg.fillRect(f.x, by, w, t);
        if (r % 3 === 0) { lg.globalAlpha = WOOD * 1.2; lg.beginPath(); lg.arc(across, by + t / 2, t * 0.28, 0, Math.PI * 2); lg.fill(); }
      }
      lg.globalAlpha = 1;
      if (!f.moving[r]) drawRod(lg, f, r);
      lg.restore();
    }

    /** Draws rod r's beads. @param {CanvasRenderingContext2D} ctx @param {Frame} f @param {number} r */
    function drawRod(ctx, f, r) {
      const K = KINDS[f.kind], per = K.hk + K.ek, [w, h] = size(f), t = f.p * 0.2, [bw, bhh] = bead(f);
      for (let b = 0; b < per; b++) {
        const u = f.pos[r * per + b];
        let col, x, y;
        if (f.kind === 1) {
          // Wire r from the bottom; counted beads gather at the left.
          col = s.colors[(f.c + r * 2 + (b < 5 ? 0 : 1)) % nc];
          const on = f.x + f.p * 0.45 + (b + 0.5) * f.bh, off = f.x + f.p * 0.45 + (K.ez - (10 - b) + 0.5) * f.bh;
          x = mix(off, on, u); y = f.y + h - f.p * (r + 0.75);
        } else {
          const up = b < K.hk, j = up ? b : b - K.hk, k = up ? K.hk : K.ek, z = up ? K.hz : K.ez;
          const beamTop = f.y + t + K.hz * f.bh, d = mix(z - (k - j - 0.5), j + 0.5, u) * f.bh;
          col = s.colors[(f.c + (f.kind === 0 ? r : up ? 0 : 1)) % nc];
          x = f.x + w - f.p * (r + 0.75); y = up ? beamTop - d : beamTop + t + d;
        }
        const sp = sprite(f.kind, col, bw, bhh);
        ctx.drawImage(sp, x - bw / 2 - 2, y - bhh / 2 - 2, sp.width / s.dpr, sp.height / s.dpr);
      }
    }

    /** Frame size in CSS px. @param {Frame} f @returns {[number, number]} */
    function size(f) {
      const K = KINDS[f.kind], t = f.p * 0.2;
      if (f.kind === 1) return [K.ez * f.bh + f.p * 0.9, f.n * f.p + f.p * 0.5];
      return [f.n * f.p + f.p * 0.5, (K.hz + K.ez) * f.bh + t * 3];
    }

    /** A bead's sprite: a double cone (soroban), a rounded bead (suanpan) or a ball. @param {number}
     * kind @param {string} col @param {number} w @param {number} h @returns {HTMLCanvasElement} */
    function sprite(kind, col, w, h) {
      const key = `${kind}|${col}|${w.toFixed(1)}|${h.toFixed(1)}`;
      let c = sprites.get(key);
      if (c) return c;
      c = document.createElement('canvas');
      const d = s.dpr, pad = 2;
      c.width = Math.ceil((w + pad * 2) * d); c.height = Math.ceil((h + pad * 2) * d);
      const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      g.setTransform(d, 0, 0, d, pad * d, pad * d);
      g.beginPath();
      if (kind === 0) {
        const k = Math.min(h * 0.55, w * 0.3);
        g.moveTo(0, h / 2); g.lineTo(k, 0); g.lineTo(w - k, 0); g.lineTo(w, h / 2); g.lineTo(w - k, h); g.lineTo(k, h);
        g.closePath();
      } else if (kind === 2) roundRect(g, 0, 0, w, h, h * 0.48);
      else g.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
      g.fillStyle = g.strokeStyle = col;
      g.globalAlpha = FILL; g.fill();
      g.globalAlpha = EDGE; g.lineWidth = 1.5; g.stroke();
      // A soft highlight across the top.
      g.globalAlpha = s.dark ? 0.16 : 0.28; g.fillStyle = '#fff';
      g.beginPath();
      if (kind === 1) g.arc(w * 0.4, h * 0.36, Math.min(w, h) * 0.18, 0, Math.PI * 2);
      else roundRect(g, w * 0.22, h * 0.16, w * 0.56, h * 0.16, h * 0.08);
      g.fill();
      sprites.set(key, c);
      return c;
    }

    /** The bead sprite size of f. @param {Frame} f @returns {[number, number]} */
    const bead = (f) => (f.kind === 1 ? [f.bh * 0.94, f.p * 0.74] : [f.p * 0.86, f.bh * 0.94]);

    /** Paints each frame, its rods, beam and resting beads into its canvas, in page px. */
    function paintFrames() {
      for (const f of frames) {
        const [w, h] = size(f), K = KINDS[f.kind], t = f.p * 0.2, d = s.dpr, lg = f.lg;
        f.cv.width = Math.ceil((w + 8) * d); f.cv.height = Math.ceil((h + 8) * d);
        lg.setTransform(d, 0, 0, d, (4 - f.x) * d, (4 - f.y) * d);
        lg.strokeStyle = lg.fillStyle = s.ink;
        lg.beginPath();
        roundRect(lg, f.x, f.y, w, h, t * 1.2);
        lg.globalAlpha = 0.05; lg.fill();
        lg.globalAlpha = WOOD; lg.lineWidth = Math.max(2, t * 0.7); lg.stroke();
        lg.lineWidth = Math.max(1.5, f.p * 0.05);
        lg.beginPath();
        if (f.kind === 1) {
          for (let r = 0; r < f.n; r++) { const y = f.y + h - f.p * (r + 0.75); lg.moveTo(f.x, y); lg.lineTo(f.x + w, y); }
        } else {
          for (let r = 0; r < f.n; r++) { const x = f.x + w - f.p * (r + 0.75); lg.moveTo(x, f.y); lg.lineTo(x, f.y + h); }
        }
        lg.globalAlpha = WOOD * 0.9; lg.stroke();
        if (f.kind !== 1) {
          // The beam, with a dot every third rod.
          const by = f.y + t + K.hz * f.bh;
          lg.globalAlpha = WOOD * 0.8;
          lg.fillRect(f.x, by, w, t);
          lg.globalAlpha = WOOD * 1.2;
          for (let r = 0; r < f.n; r += 3) { lg.beginPath(); lg.arc(f.x + w - f.p * (r + 0.75), by + t / 2, t * 0.28, 0, Math.PI * 2); lg.fill(); }
        }
        lg.globalAlpha = 1;
        for (let r = 0; r < f.n; r++) if (!f.moving[r]) drawRod(lg, f, r);
      }
    }

    return {
      lay() {
        const { W, H } = s;
        const m = Math.min(W, H);
        sprites.clear();
        /** @type {{kind:number, n:number, p:number, bh:number, x:number, y:number, step:number, every:number}[]} */
        const plan = [];
        if (layout === 0) {
          // Sorobans down the page, as many as fit.
          const p0 = clamp(m * 0.085, 30, 76);
          const n = clamp(Math.round(W * 0.9 / p0), 7, 17), p = Math.min(p0, W * 0.92 / (n + 0.5)), bh = p * 0.42;
          const fh = 7.6 * bh + p * 0.6, k = clamp(Math.floor(H / (fh * 1.45)), 1, 4);
          for (let i = 0; i < k; i++) {
            plan.push({ kind: 0, n, p, bh, x: (W - (n + 0.5) * p) / 2, y: H * (i + 0.5) / k - fh / 2, step: 1, every: 0.8 + i * 0.35 });
          }
        } else if (layout === 1) {
          // One counting frame, or two on a tall page.
          const k = H > W * 1.5 ? 2 : 1;
          const n = 10, p = Math.min(H * 0.84 / k / (n + 0.5), W * 0.92 / 13.5, 72);
          const bh = p * 0.8, fw = 15 * bh + p * 0.9, fh = (n + 0.5) * p;
          for (let i = 0; i < k; i++) {
            plan.push({ kind: 1, n, p, bh, x: (W - fw) / 2, y: H * (i + 0.5) / k - fh / 2, step: 1, every: 0.75 + i * 0.4 });
          }
        } else {
          // A grid of small suanpans, each counting in its own steps.
          // At most about 16, however big the page.
          const box = Math.max(clamp(m * 0.42, 160, 300), Math.sqrt(W * H / 16));
          const cols = Math.max(1, Math.floor(W / (box * 1.15))), rows = Math.max(1, Math.floor(H / (box * 0.9)));
          const steps = [1, 3, 7, 12, 25, 9, 2, 50, 5, 11, 4, 101];
          for (let i = 0; i < cols * rows; i++) {
            const n = 5 + (i * 7) % 3, p = box / (n + 0.5) * 0.9, bh = p * 0.4;
            const fw = (n + 0.5) * p, fh = 9.9 * bh + p * 0.6;
            const c = i % cols, r = Math.floor(i / cols);
            plan.push({ kind: 2, n, p, bh, step: steps[i % steps.length], every: 0.9 + (i % 4) * 0.3,
              x: W * (c + 0.5) / cols - fw / 2 + (r % 2 ? 0.06 : -0.06) * W / cols, y: H * (r + 0.5) / rows - fh / 2 });
          }
        }
        const old = frames;
        frames = plan.map((q, i) => {
          const f = old[i] && old[i].n === q.n && old[i].kind === q.kind ? old[i] : frame(q.kind, q.n, q.step, q.every);
          f.p = q.p; f.bh = q.bh; f.x = Math.round(q.x); f.y = Math.round(q.y);
          return f;
        });
        paintFrames();
      },
      step(dt) {
        now += dt;
        for (const f of frames) advance(f, dt);
      },
      draw() {
        const { ctx } = s;
        for (const f of frames) {
          ctx.drawImage(f.cv, f.x - 4, f.y - 4, f.cv.width / s.dpr, f.cv.height / s.dpr);
          for (let r = 0; r < f.n; r++) if (f.moving[r]) drawRod(ctx, f, r);
        }
      },
    };
  });
}
