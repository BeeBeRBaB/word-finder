// Anagrams: letter tiles spell a word, slide out of order, and slide back as another word of the
// same letters (LISTEN, SILENT, TINSEL), a bar underlining each real word; after a few, the set
// fades and a new one appears. The seed picks the variant: racks of words down the host whose
// tiles hop past each other in their row, loose piles that gather into a word and fall apart, or
// letter wheels whose tiles turn round a ring and then leap in to cross it as a word.

import { stage, TAU, clamp, mix } from './stage.js';
import { roundRect } from './shapes.js';

/**
 * @typedef {{k:number, slot:number}} Place  k 0 a row slot, 1 its scatter spot, 2 a ring slot
 * @typedef {{ch:number, from:Place, to:Place, u:number, lift:number, sx:number, sy:number, sr:number}} Tile
 * u runs 0..1 from `from` to `to`; lift bows the path up or down; sx, sy, sr its scatter spot.
 * @typedef {{cx:number, cy:number, fam:string[], wi:number, shown:number, tiles:Tile[], c:number,
 *   stage:number, wait:number, dur:number, lit:number, spin:number, clock:number}} Group
 * stage 0 a word showing, 1 mixed up, 2 fading out, 3 a new set fading in; wait counts down to
 * the next stage; lit 0..1 the underline.
 */

const SETS = ['LISTEN SILENT ENLIST TINSEL INLETS', 'STONE NOTES ONSET TONES', 'HEART EARTH HATER',
  'ANGEL GLEAN ANGLE', 'STARE TEARS RATES ASTER', 'PLATE PETAL LEAPT PLEAT', 'SPARE PEARS SPEAR PARSE',
  'LEMON MELON', 'NIGHT THING', 'DUSTY STUDY', 'ALERT ALTER LATER', 'TEAM MEAT MATE TAME',
  'STOP POTS SPOT TOPS', 'RACE CARE ACRE', 'EVIL LIVE VILE VEIL', 'DIARY DAIRY', 'PART TRAP RAPT',
  'SMILE SLIME LIMES MILES', 'SHORE HORSE', 'MASTER STREAM TAMERS', 'GARDEN DANGER GANDER RANGED',
  'STAPLE PASTEL PLATES PETALS', 'CRATE TRACE REACT CATER', 'LEAST STEAL SLATE TALES STALE',
  'FRIES FIRES SERIF', 'ARC CAR', 'TEN NET', 'OWL LOW', 'DOG GOD', 'BELOW ELBOW BOWEL', 'NAMES MEANS MANES',
  'RESCUE SECURE', 'THORN NORTH', 'WOLF FLOW FOWL', 'CINEMA ICEMAN ANEMIC', 'SAUCE CAUSE'].map((t) => t.split(' '));
const HOLD = 2.4;   // a word stays this long
const MIXED = 1.5;  // and the mixed-up tiles this long
const FADE = 1.3;   // a set fades out, and the next in, over this long

/** @param {number} u @returns {number} */
const ease = (u) => u * u * (3 - 2 * u);

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    let T = 0, P = 0;
    /** @type {Group[]} */
    let groups = [];
    /** @type {Map<number, HTMLCanvasElement>} a colour's 26 tiles side by side, P px each */
    const atlases = new Map();
    s.onDpr = () => atlases.clear();
    // The letters are cached as images, so paint them again once the app's font has arrived.
    document.fonts?.load("700 20px 'Space Grotesk'").then(() => {
      if (s.cv.isConnected) { atlases.clear(); s.paint(); }
    }, () => {});
    const pos = [0, 0, 0], pos2 = [0, 0, 0];

    /** The colour's tile atlas, painted on first use. @param {number} c @returns {HTMLCanvasElement} */
    function atlas(c) {
      let cv = atlases.get(c);
      if (cv) return cv;
      cv = document.createElement('canvas');
      cv.width = P * 26; cv.height = P;
      const g = cv.getContext('2d');
      if (g) {
        const col = s.colors[c], m = P * 0.06, w = P - 2 * m;
        g.font = `700 ${Math.round(P * 0.5)}px 'Space Grotesk',system-ui,sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = Math.max(1.5, P * 0.05);
        for (let i = 0; i < 26; i++) {
          g.beginPath(); roundRect(g, i * P + m, m, w, w, P * 0.18);
          g.globalAlpha = s.dark ? 0.2 : 0.24; g.fillStyle = col; g.fill();
          g.globalAlpha = s.dark ? 0.6 : 0.7; g.strokeStyle = col; g.stroke();
          g.globalAlpha = s.dark ? 0.85 : 0.9;
          g.fillText(String.fromCharCode(65 + i), i * P + P / 2, P * 0.54);
        }
      }
      atlases.set(c, cv);
      return cv;
    }

    /** Where a tile sits in a place, into out: x, y, turn. @param {Group} g @param {Tile} t @param {Place} p @param {number[]} out */
    function at(g, t, p, out) {
      const n = g.tiles.length;
      if (p.k === 0) {
        out[0] = g.cx + (p.slot - (n - 1) / 2) * T * 1.12; out[1] = g.cy; out[2] = 0;
      } else if (p.k === 1) {
        const w = g.clock * 0.4 + p.slot * 1.7;
        out[0] = g.cx + t.sx + Math.sin(w) * T * 0.12; out[1] = g.cy + t.sy + Math.cos(w * 0.8) * T * 0.1;
        out[2] = t.sr + Math.sin(w * 0.6) * 0.08;
      } else {
        const a = g.clock * g.spin + p.slot * TAU / n - Math.PI / 2, R = T * (0.62 + n * 0.16);
        out[0] = g.cx + Math.cos(a) * R; out[1] = g.cy + Math.sin(a) * R; out[2] = 0;
      }
    }

    /** Sends every tile to a new place over the group's duration. @param {Group} g @param {(t:Tile, i:number) => Place} to */
    function send(g, to) {
      g.tiles.forEach((t, i) => {
        const p = to(t, i);
        t.from = t.to; t.to = p; t.u = 0;
        // In a row, tiles bound right pass over and tiles bound left under.
        t.lift = t.from.k === 0 && p.k === 0 ? -Math.sign(p.slot - t.from.slot) * T * Math.min(0.9, 0.35 * Math.abs(p.slot - t.from.slot)) : 0;
      });
    }

    /** Lines the tiles up as word wi, each to the slot of its letter. @param {Group} g @returns {void} */
    function solve(g) {
      const word = g.fam[g.wi % g.fam.length], free = g.tiles.slice();
      /** @type {Map<Tile, number>} */
      const slot = new Map();
      for (let j = 0; j < word.length; j++) {
        const ch = word.charCodeAt(j) - 65;
        // Prefer a tile that need not move, then the nearest one.
        let best = 0, bd = Infinity;
        free.forEach((t, k) => {
          if (t.ch !== ch) return;
          const d = t.to.k === 0 ? Math.abs(t.to.slot - j) : k;
          if (d < bd) { bd = d; best = k; }
        });
        slot.set(free[best], j);
        free.splice(best, 1);
      }
      send(g, (t) => ({ k: 0, slot: slot.get(t) ?? 0 }));
    }

    /** Mixes the tiles: a shuffled row, a loose pile, or round the ring. @param {Group} g @returns {void} */
    function scramble(g) {
      const n = g.tiles.length;
      let order = rng.shuffle([...Array(n).keys()]);
      if (order.every((v, i) => v === g.tiles[i].to.slot)) order = order.reverse();
      if (layout === 1) {
        const rx = T * (1.1 + n * 0.36), ry = T * 1.5;
        g.tiles.forEach((t, i) => {
          const a = (order[i] + rng.random() * 0.6) / n * TAU;
          t.sx = Math.cos(a) * rx * (0.65 + rng.random() * 0.35); t.sy = Math.sin(a) * ry * (0.6 + rng.random() * 0.4);
          t.sr = (rng.random() - 0.5) * 1.1;
        });
      }
      send(g, (t, i) => ({ k: layout, slot: order[i] }));
    }

    /** Gives a group a new set of anagrams, other than the ones in use, spelt out. @param {Group} g @returns {void} */
    function newSet(g) {
      const used = new Set(groups.map((o) => o.fam));
      let fam = SETS[rng.int(SETS.length)];
      for (let k = 0; k < 8 && used.has(fam); k++) fam = SETS[rng.int(SETS.length)];
      g.fam = fam; g.wi = rng.int(fam.length); g.shown = 0; g.c = rng.int(nc);
      g.tiles = [...fam[g.wi]].map((ch, i) => ({ ch: ch.charCodeAt(0) - 65, from: { k: 0, slot: i }, to: { k: 0, slot: i },
        u: 1, lift: 0, sx: 0, sy: 0, sr: 0 }));
    }

    /** Runs a group's clock on. @param {Group} g @param {number} dt @returns {void} */
    function tick(g, dt) {
      g.clock += dt;
      for (const t of g.tiles) t.u = Math.min(1, t.u + dt / g.dur);
      const settled = g.tiles.every((t) => t.u >= 1 && t.to.k === 0);
      g.lit = clamp(g.lit + (g.stage === 0 && settled ? dt : -dt) / 0.8, 0, 1);
      g.wait -= dt;
      if (g.wait > 0) return;
      if (g.stage === 0) {
        if (g.shown >= Math.min(3, g.fam.length - 1)) { g.stage = 2; g.wait = FADE; }
        else { scramble(g); g.stage = 1; g.wait = g.dur + MIXED + (layout === 2 ? 1 : 0); }
      } else if (g.stage === 1) {
        g.wi++; g.shown++; solve(g); g.stage = 0; g.wait = g.dur + HOLD;
      } else if (g.stage === 2) {
        newSet(g); g.stage = 3; g.wait = FADE;
      } else {
        g.stage = 0; g.wait = HOLD;
      }
    }

    /** Lays groups out for the size: centres from a jittered grid of cells. @returns {void} */
    function place() {
      const m = Math.min(s.W, s.H);
      T = layout === 0 ? clamp(Math.round(m / 11), 26, 56) : clamp(Math.round(m / 16), 24, 48);
      P = Math.ceil(T * s.dpr);
      atlases.clear();
      const cw = T * (layout === 0 ? 8.6 : 7.6), ch = T * (layout === 0 ? 2.1 : layout === 1 ? 4.4 : 5.2);
      const nx = Math.max(1, Math.floor(s.W / cw)), ny = Math.max(1, Math.floor(s.H / ch));
      const gw = s.W / nx, gh = s.H / ny;
      /** @type {Group[]} */
      const out = [];
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          // Racks step in and out row by row; piles and wheels wobble about their cells.
          const jx = layout === 0 ? ((j % 2) - 0.5) * Math.max(0, gw - T * 7.2) * 0.8 : (rng.random() - 0.5) * Math.max(0, gw - cw) * 0.8;
          const jy = layout === 0 ? 0 : (rng.random() - 0.5) * Math.max(0, gh - ch) * 0.8;
          const old = groups[out.length];
          /** @type {Group} */
          const g = old ?? { cx: 0, cy: 0, fam: [], wi: 0, shown: 0, tiles: [], c: 0, stage: 0, wait: 0,
            dur: 1.1 + rng.random() * 0.4, lit: 0, spin: (rng.random() < 0.5 ? -1 : 1) * (0.2 + rng.random() * 0.12), clock: 0 };
          g.cx = gw * (i + 0.5) + jx; g.cy = gh * (j + 0.5) + jy;
          if (!old) {
            newSet(g);
            g.wait = 0.3 + rng.random() * 2;
            out.push(g);
            // Warm up so each starts at its own point of the cycle, some mid-move.
            for (let k = rng.int(60); k > 0; k--) tick(g, 0.1);
          } else out.push(g);
        }
      }
      groups = out;
    }

    return {
      lay: place,
      step(dt) { for (const g of groups) tick(g, dt); },
      draw() {
        const { ctx, dpr } = s;
        for (const g of groups) {
          const a = g.stage === 2 ? g.wait / FADE : g.stage === 3 ? 1 - g.wait / FADE : 1;
          if (a <= 0) continue;
          const n = g.tiles.length, col = s.colors[g.c % nc];
          if (layout === 2) {
            // The wheel the letters ride.
            const R = T * (0.62 + n * 0.16) + T * 0.72;
            ctx.beginPath(); ctx.arc(g.cx, g.cy, R, 0, TAU);
            ctx.globalAlpha = a * 0.07; ctx.fillStyle = col; ctx.fill();
            ctx.globalAlpha = a * 0.22; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, T * 0.05); ctx.stroke();
          }
          if (g.lit > 0) {
            const w = n * T * 1.12 * ease(g.lit);
            ctx.globalAlpha = a * 0.55; ctx.fillStyle = col;
            ctx.beginPath(); roundRect(ctx, g.cx - w / 2, g.cy + T * 0.66, w, Math.max(2, T * 0.08), T * 0.04); ctx.fill();
          }
          ctx.globalAlpha = a;
          const sheet = atlas(g.c % nc);
          for (const t of g.tiles) {
            at(g, t, t.from, pos); at(g, t, t.to, pos2);
            const u = ease(t.u), b = Math.sin(Math.PI * t.u);
            const x = mix(pos[0], pos2[0], u), y = mix(pos[1], pos2[1], u) + t.lift * b, r = mix(pos[2], pos2[2], u);
            const co = Math.cos(r) * dpr, si = Math.sin(r) * dpr;
            ctx.setTransform(co, si, -si, co, x * dpr, y * dpr);
            ctx.drawImage(sheet, t.ch * P, 0, P, P, -T / 2, -T / 2, T, T);
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      },
    };
  });
}
