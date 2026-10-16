// DNA: double helices turn slowly, base pairs as rungs in the look's colours. Now and then a fork
// runs along one helix, unzipping it; each old strand keeps its half of every rung, new bases
// pair up behind the fork and a new strand closes over them, so one helix becomes two.
// The seed picks the variant: helices lying in rows across the page, copied one at a time; one
// large helix on a slant between two faint small ones, copying itself over and over; or upright
// helices sliding slowly up the page, any of them copying.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, a:number, L:number, r:number, ph:number, w:number,
 *   scroll:number, sv:number, seq:Uint8Array, mode:number, fork:number, fs:number, wait:number,
 *   fade:number, dim:number, apart:number}} Helix
 * Axis origin x, y and angle a, length L (CSS px), radius r; ph, w its turn and turn rate; scroll
 * and sv how far and how fast its material has slid along the axis; seq its bases. mode is
 * 0 resting, 1 copying (fork at material position fork, moving fs px/s), 2 parted and fading,
 * 3 fading back in; wait counts down to the next copy; fade 0..1; dim its alpha scale. */

const TWIST = 2.4;     // angle between the two strands, which makes the major and minor grooves
const STEP = 5;        // px between strand samples
const SEQ = 64;        // bases per helix before its sequence repeats

/** @param {number} u @returns {number} */
const smooth = (u) => u * u * (3 - 2 * u);

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Helix[]} */
    let hx = [];
    let laid = false;
    let turn = 0;    // rows: which helix copies next
    // Per sample scratch: axis point, then the four strands' offsets and depths.
    let ax = new Float32Array(0), ay = new Float32Array(0);
    /** @type {Float32Array[]} */
    let off = [];
    /** @type {Float32Array[]} */
    let dep = [];
    /** @type {Uint8Array} */
    let has = new Uint8Array(0);

    /** @returns {Helix} */
    const helix = () => {
      const seq = new Uint8Array(SEQ);
      for (let i = 0; i < SEQ; i++) seq[i] = rng.int(4);
      return { x: 0, y: 0, a: 0, L: 0, r: 0, ph: rng.random() * TAU,
        w: (rng.random() < 0.5 ? -1 : 1) * (0.3 + rng.random() * 0.25), scroll: rng.random() * 400,
        sv: 0, seq, mode: 0, fork: 0, fs: 0, wait: 3 + rng.random() * 8, fade: 1, dim: 1, apart: 0 };
    };

    /** Sets each helix's axis for the current size. @returns {void} */
    function place() {
      const { W, H } = s, m0 = Math.min(W, H);
      if (layout === 0) {
        const n = clamp(Math.round(H / clamp(m0 * 0.42, 150, 300)), 2, 6), sp = H / n;
        while (hx.length < n) { const h = helix(); h.a = (rng.random() - 0.5) * 0.12; hx.push(h); }
        hx.length = n;
        hx.forEach((h, i) => {
          h.r = clamp(sp * 0.16, 14, 48);
          h.L = (W + 4 * h.r) / Math.cos(h.a);
          h.x = W / 2 - Math.cos(h.a) * h.L / 2; h.y = sp * (i + 0.5) - Math.sin(h.a) * h.L / 2;
        });
      } else if (layout === 1) {
        while (hx.length < 3) hx.push(helix());
        const a = Math.atan2(H, W) * 0.55 * (s.seed & 8 ? -1 : 1), diag = Math.hypot(W, H);
        const nx = -Math.sin(a), ny = Math.cos(a);
        hx.forEach((h, i) => {
          const big = i === 0;
          h.r = big ? clamp(m0 * 0.11, 30, 110) : clamp(m0 * 0.045, 12, 44);
          h.dim = big ? 1 : 0.5;
          h.a = a; h.L = diag + 4 * h.r;
          const o = big ? 0 : (i === 1 ? -1 : 1) * m0 * 0.36;
          h.x = W / 2 - Math.cos(a) * h.L / 2 + nx * o; h.y = H / 2 - Math.sin(a) * h.L / 2 + ny * o;
        });
      } else {
        const n = clamp(Math.round(W / clamp(m0 * 0.32, 110, 240)), 2, 8), sp = W / n;
        while (hx.length < n) { const h = helix(); h.sv = 6 + rng.random() * 5; hx.push(h); }
        hx.length = n;
        hx.forEach((h, i) => {
          h.r = clamp(sp * 0.16, 12, 40);
          h.a = Math.PI / 2; h.L = H + 4 * h.r;
          h.x = sp * (i + 0.5); h.y = -2 * h.r;
        });
      }
      for (const h of hx) h.fs = h.sv + clamp(h.L / 16, 24, 70);
      const n = Math.ceil((Math.max(...hx.map((h) => h.L)) + 8) / STEP) + 1;
      if (ax.length < n) {
        ax = new Float32Array(n); ay = new Float32Array(n); has = new Uint8Array(n);
        off = [0, 1, 2, 3].map(() => new Float32Array(n)); dep = [0, 1, 2, 3].map(() => new Float32Array(n));
      }
    }

    /** May this helix start copying now? @param {Helix} h @returns {boolean} */
    function mayCopy(h) {
      if (layout === 1) return h === hx[0];
      if (layout === 0) return h === hx[turn % hx.length] && hx.every((o) => o.mode === 0);
      return hx.filter((o) => o.mode === 1).length < Math.max(1, Math.floor(hx.length / 3));
    }

    /** Starts the fork just before the helix's near end. @param {Helix} h @returns {void} */
    function begin(h) {
      h.mode = 1; h.fork = h.scroll - 2 * h.r; h.apart = 0;
    }

    /** @param {Helix} h @param {number} dt @returns {void} */
    function advance(h, dt) {
      h.ph += h.w * dt;
      h.scroll += h.sv * dt;
      if (h.mode === 0) {
        h.wait -= dt;
        if (h.wait <= 0) { if (mayCopy(h)) begin(h); else h.wait = 1 + rng.random() * 3; }
      } else if (h.mode === 1) {
        h.fork += h.fs * dt;
        if (h.fork - h.scroll > h.L + 4 * h.r) h.mode = 2;
      } else if (h.mode === 2) {
        // The two copies drift apart a little while they fade.
        h.apart += dt;
        h.fade = Math.max(0, h.fade - dt / 3);
        if (h.fade === 0) {
          for (let i = 0; i < SEQ; i++) h.seq[i] = rng.int(4);
          h.mode = 3; h.apart = 0;
        }
      } else {
        h.fade = Math.min(1, h.fade + dt / 2.5);
        if (h.fade === 1) { h.mode = 0; h.wait = layout === 1 ? 2 : 4 + rng.random() * 8; turn++; }
      }
    }

    /** How far apart the two copies sit at material position m. @param {Helix} h @param {number} m */
    function sep(h, m) {
      if (h.mode !== 1 && h.mode !== 2) return 0;
      const D = h.r * (1.5 + h.apart * 0.25);
      return D * smooth(clamp((h.fork - m) / (h.r * 3.2), 0, 1));
    }

    /** How far the new base at material position m has grown, 0..1. @param {Helix} h @param {number} m */
    function copied(h, m) {
      if (h.mode !== 1 && h.mode !== 2) return 0;
      return clamp((h.fork - m - h.r * 0.8) / (h.r * 0.9), 0, 1);
    }

    /** Fills the sample scratch for one helix. @param {Helix} h @param {number} k @returns {number} samples */
    function sample(h, k) {
      const n = Math.ceil(h.L / STEP) + 1, c = Math.cos(h.a), sn = Math.sin(h.a);
      for (let i = 0; i < n; i++) {
        const u = i * STEP, m = u + h.scroll, f = k * m + h.ph, d = sep(h, m);
        ax[i] = h.x + c * u; ay[i] = h.y + sn * u;
        const sa = Math.sin(f), sb = Math.sin(f + TWIST);
        off[0][i] = -d + h.r * sa; dep[0][i] = Math.cos(f);              // old strand A
        off[1][i] = d + h.r * sb; dep[1][i] = Math.cos(f + TWIST);       // old strand B
        off[2][i] = -d + h.r * sb; dep[2][i] = dep[1][i];                // A's new partner
        off[3][i] = d + h.r * sa; dep[3][i] = dep[0][i];                 // B's new partner
        has[i] = copied(h, m) >= 1 ? 1 : 0;
      }
      return n;
    }

    /** Strokes the parts of strand j on one side. @param {Helix} h @param {number} n @param {number} j
     * @param {boolean} front @returns {void} */
    function strand(h, n, j, front) {
      const { ctx } = s, nx = -Math.sin(h.a), ny = Math.cos(h.a), o = off[j], z = dep[j];
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < n; i++) {
        const on = (z[i] >= 0) === front && (j < 2 || has[i] === 1);
        if (!on) { pen = false; continue; }
        const x = ax[i] + nx * o[i], y = ay[i] + ny * o[i];
        if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();
    }

    /** Strokes the rungs of base colour t. @param {Helix} h @param {number} k @param {number} t @returns {void} */
    function rungs(h, k, t) {
      const { ctx } = s, c = Math.cos(h.a), sn = Math.sin(h.a), nx = -sn, ny = c;
      const bp = TAU / k / 8;
      const j0 = Math.floor(h.scroll / bp), j1 = Math.ceil((h.scroll + h.L) / bp);
      ctx.beginPath();
      for (let j = j0; j <= j1; j++) {
        const m = j * bp, u = m - h.scroll, f = k * m + h.ph, d = sep(h, m);
        const b = h.seq[((j % SEQ) + SEQ) % SEQ], q = b ^ 1;
        if (b !== t && q !== t) continue;
        const px = h.x + c * u, py = h.y + sn * u;
        const sa = Math.sin(f) * h.r, sb = Math.sin(f + TWIST) * h.r;
        // Each strand's own base runs halfway to its partner; the partner's base the rest.
        // Zipped (d 0), the partners are the old strands; parted, they are the new ones.
        const g = d > 0 ? copied(h, m) : 1;
        /** @param {number} o1 @param {number} o2 @param {number} mine @param {number} theirs */
        const half = (o1, o2, mine, theirs) => {
          const mo = (o1 + o2) / 2;
          if (mine === t) { ctx.moveTo(px + nx * o1, py + ny * o1); ctx.lineTo(px + nx * mo, py + ny * mo); }
          if (theirs === t && g > 0) {
            ctx.moveTo(px + nx * mo, py + ny * mo);
            const e = mo + (o2 - mo) * g;
            ctx.lineTo(px + nx * e, py + ny * e);
          }
        };
        if (d === 0) half(sa, sb, b, q);
        else { half(-d + sa, -d + sb, b, q); half(d + sb, d + sa, q, b); }
      }
      ctx.stroke();
    }

    return {
      lay() {
        place();
        if (!laid) {
          laid = true;
          // Open on a copy under way, so a still frame shows the fork.
          const h = layout === 0 ? hx[Math.min(1, hx.length - 1)] : hx[0];
          turn = hx.indexOf(h);
          begin(h); h.fork = h.scroll + h.L * 0.55;
          if (layout === 2 && hx.length > 3) { const o = hx[hx.length - 2]; begin(o); o.fork = o.scroll + o.L * 0.3; }
        }
      },
      step(dt) { for (const h of hx) advance(h, dt); },
      draw() {
        const { ctx } = s;
        const old = s.colors[0], neu = s.colors[1 % nc];
        ctx.lineCap = 'round';
        for (const h of hx) {
          const al = h.fade * h.dim;
          if (al <= 0.01) continue;
          const k = TAU / (h.r * 4.2), n = sample(h, k), lw = clamp(h.r * 0.11, 1.6, 4);
          // The far side thinner, as it would look.
          ctx.lineWidth = 1;
          ctx.globalAlpha = al * (s.dark ? 0.4 : 0.42);
          for (let j = 0; j < 4; j++) { ctx.strokeStyle = j < 2 ? old : neu; strand(h, n, j, false); }
          ctx.lineWidth = lw * 0.7;
          ctx.lineCap = 'butt';
          ctx.globalAlpha = al * (s.dark ? 0.42 : 0.48);
          for (let t = 0; t < 4; t++) { ctx.strokeStyle = s.colors[(t + 2) % nc]; rungs(h, k, t); }
          ctx.lineWidth = lw;
          ctx.lineCap = 'round';
          ctx.globalAlpha = al * (s.dark ? 0.58 : 0.6);
          for (let j = 0; j < 4; j++) { ctx.strokeStyle = j < 2 ? old : neu; strand(h, n, j, true); }
        }
      },
    };
  });
}
