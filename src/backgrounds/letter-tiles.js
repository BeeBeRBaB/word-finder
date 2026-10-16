// Letter tiles: wooden letter tiles, each with its point value, drift and turn, and now and then
// one flips over to its plain back or back to a new letter. The seed picks the variant: tiles
// loose on the table drifting every way, rows of tiles riding racks with a flip rippling along
// each row in turn, or tiles at three depths sliding down a slope and tumbling end over end.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, a:number, va:number, vx:number, vy:number, ch:string, c:number,
 *   face:boolean, fl:number, next:number, z:number, row:number}} Tile
 * fl is flip progress 0..1, or -1 at rest; next counts down to the next flip; z is depth 0.55..1. */
/** @typedef {{y:number, v:number, tilt:number, wait:number, lead:number}} Rack */

const LETTERS = 'AAAAABBCCDDEEEEEEFFGGHHIIIIIJKLLLMMNNNNOOOOOPPQRRRRSSSSTTTTTUUUVVWWXYYZ';
const VALUES = /** @type {Record<string,number>} */ ({ A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4,
  I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10 });
const FLIP = 1.3;   // seconds a flip takes

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Tile[]} */
    let tiles = [];
    /** @type {Rack[]} */
    let racks = [];
    /** Sprites by colour and letter ('' is the back), drawn at the largest tile size. */
    /** @type {Map<string, HTMLCanvasElement>} */
    const sprites = new Map();
    let size = 40, spriteSize = 0;
    s.onDpr = () => sprites.clear();

    const letter = () => LETTERS[rng.int(LETTERS.length)];
    /** @param {number} x @param {number} y @param {number} row @returns {Tile} */
    const tile = (x, y, row) => ({ x, y, a: (rng.random() - 0.5) * 0.5, va: (rng.random() - 0.5) * 0.3,
      vx: 0, vy: 0, ch: letter(), c: rng.int(s.colors.length), face: rng.random() < 0.85,
      fl: -1, next: 3 + rng.random() * 12, z: 1, row });

    /** @param {Tile} p @returns {HTMLCanvasElement} */
    function sprite(p) {
      const ch = p.face ? p.ch : '';
      const key = p.c + ch;
      let c = sprites.get(key);
      if (!c) { c = paintTile(s.colors[p.c], ch, VALUES[ch] ?? 0, spriteSize * s.dpr, s.dark); sprites.set(key, c); }
      return c;
    }

    /** Lays racks of tile groups (words) with gaps, spaced down the host. @returns {void} */
    function layRacks() {
      const rows = Math.max(2, Math.round(s.H / (size * 2.9)));
      const gap = s.H / rows, top = gap * 0.45;
      racks = []; tiles = [];
      for (let r = 0; r < rows; r++) {
        racks.push({ y: top + r * gap, v: (r % 2 ? -1 : 1) * (9 + rng.random() * 8),
          tilt: (rng.random() - 0.5) * 0.08, wait: 1 + rng.random() * 6, lead: -1 });
        const span = s.W + size * 4;
        let x = -size * 2 + rng.random() * size;
        while (x < span - size * 2) {
          const word = 3 + rng.int(5);
          for (let i = 0; i < word && x < span - size * 2; i++, x += size * 1.12) {
            const p = tile(x, racks[r].y, r);
            p.a = 0; p.va = 0; p.face = true; p.next = Infinity;
            tiles.push(p);
          }
          x += size * (1.6 + rng.random() * 3);
        }
      }
    }

    /** @param {Tile} p @param {number} dt @returns {void} */
    function flipStep(p, dt) {
      if (p.fl < 0) {
        p.next -= dt;
        if (p.next <= 0) { p.fl = 0; p.next = 6 + rng.random() * 14; }
        return;
      }
      const was = p.fl;
      p.fl += dt / FLIP;
      // Edge-on halfway: the other side shows from here; a letter coming up is a new one.
      if (was < 0.5 && p.fl >= 0.5) { p.face = !p.face; if (p.face) p.ch = letter(); }
      if (p.fl >= 1) p.fl = -1;
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        size = clamp(m * 0.075, 30, 64);
        const want = Math.ceil(size * (layout === 2 ? 1.25 : 1.1));
        if (want !== spriteSize) { spriteSize = want; sprites.clear(); }
        if (layout === 1) { layRacks(); return; }
        const n = clamp(Math.round(s.W * s.H / (layout === 2 ? 17000 : 24000)), 15, 60);
        while (tiles.length < n) tiles.push(tile(rng.random() * s.W, rng.random() * s.H, 0));
        tiles.length = n;
        for (const p of tiles) {
          if (layout === 2) {
            if (p.vx === 0) {
              p.z = 0.55 + 0.45 * rng.random();
              p.vx = 6 * p.z; p.vy = 16 * p.z;
              p.va = (rng.random() - 0.5) * 0.25;
            }
          } else if (p.vx === 0) {
            const a = rng.random() * TAU, v = 7 + rng.random() * 10;
            p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
          }
          p.x = ((p.x % s.W) + s.W) % s.W; p.y = ((p.y % s.H) + s.H) % s.H;
        }
        if (layout === 2) tiles.sort((a, b) => a.z - b.z);
        // A few mid-flip already, so the still frame shows what the tiles do.
        for (let i = 0; i < tiles.length; i += 5) if (tiles[i].fl < 0) tiles[i].fl = 0.2 + rng.random() * 0.25;
      },
      step(dt) {
        const pad = size;
        if (layout === 1) {
          const span = s.W + size * 4;
          for (const r of racks) {
            r.wait -= dt;
            if (r.wait <= 0) { r.wait = 7 + rng.random() * 7; r.lead = 0; }
            if (r.lead >= 0) r.lead += dt;
          }
          for (const p of tiles) {
            const r = racks[p.row];
            p.x += r.v * dt;
            if (p.x > span - size * 2) p.x -= span; else if (p.x < -size * 2) p.x += span;
            // The ripple runs along the rack from its leading end, about seven tiles a second.
            if (r.lead >= 0 && p.fl < 0) {
              const along = r.v > 0 ? (s.W + size * 2 - p.x) : (p.x + size * 2);
              const at = along / (size * 1.12) / 7;
              if (r.lead >= at && r.lead - dt < at) p.fl = 0;
            }
            if (p.fl >= 0) flipStep(p, dt);
          }
          return;
        }
        for (const p of tiles) {
          const sway = layout === 2 ? Math.sin(s.t * 0.3 + p.y * 0.01) * 6 * p.z : 0;
          p.x += (p.vx + sway) * dt; p.y += p.vy * dt;
          p.a += p.va * dt;
          if (p.x < -pad) p.x += s.W + pad * 2; else if (p.x > s.W + pad) p.x -= s.W + pad * 2;
          if (p.y < -pad) p.y += s.H + pad * 2; else if (p.y > s.H + pad) p.y -= s.H + pad * 2;
          flipStep(p, dt);
        }
      },
      draw() {
        const { ctx } = s;
        if (layout === 1) {
          // The racks: a ledge under each row of tiles.
          ctx.lineCap = 'round';
          for (let i = 0; i < racks.length; i++) {
            const r = racks[i], y = r.y + size * 0.62;
            ctx.strokeStyle = s.colors[i % s.colors.length];
            ctx.globalAlpha = s.dark ? 0.22 : 0.28;
            ctx.lineWidth = size * 0.16;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s.W, y); ctx.stroke();
          }
        }
        const base = (s.dark ? 0.55 : 0.6) * (layout === 1 ? 0.8 : 1);
        for (const p of tiles) {
          const k = p.fl < 0 ? 1 : Math.abs(Math.cos(p.fl * Math.PI));
          const lift = p.fl < 0 ? 1 : 1 + 0.1 * Math.sin(p.fl * Math.PI);
          const d = size * (layout === 2 ? 0.7 + 0.55 * (p.z - 0.55) / 0.45 : 1) * lift;
          ctx.globalAlpha = base * (layout === 2 ? 0.55 + 0.45 * p.z : 1);
          ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.a + (layout === 1 ? racks[p.row].tilt : 0));
          // Rack and loose tiles turn about their upright axis; sliding ones tumble end over end.
          if (layout === 2) ctx.scale(1, Math.max(0.03, k)); else ctx.scale(Math.max(0.03, k), 1);
          const h = d * spriteSize / size / 2;
          ctx.drawImage(sprite(p), -h, -h, h * 2, h * 2);
        }
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      },
    };
  });
}

/**
 * One tile as a sprite: a rounded square of wood tinted in `color`, its grain, and the letter with
 * its value; an empty `ch` is the back, grain only.
 * @param {string} color @param {string} ch @param {number} value @param {number} px sprite side
 * @param {boolean} dark @returns {HTMLCanvasElement}
 */
function paintTile(color, ch, value, px, dark) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(8, Math.round(px));
  const g = c.getContext('2d');
  if (!g) return c;
  const n = c.width, t = n / 1.1, o = (n - t) / 2, r = t * 0.15;
  g.beginPath(); g.roundRect(o, o, t, t, r);
  g.fillStyle = color;
  g.globalAlpha = ch ? (dark ? 0.26 : 0.22) : (dark ? 0.4 : 0.34);
  g.fill();
  g.save(); g.clip();
  // Grain: a few long shallow curves across the tile.
  g.strokeStyle = color; g.lineWidth = Math.max(1, t * 0.025);
  g.globalAlpha = ch ? 0.22 : 0.35;
  for (let i = 0; i < 5; i++) {
    const y = o + t * (0.12 + i * 0.2);
    g.beginPath(); g.moveTo(o, y); g.bezierCurveTo(o + t * 0.3, y - t * 0.08, o + t * 0.6, y + t * 0.1, o + t, y - t * 0.03); g.stroke();
  }
  g.restore();
  // Bevel: the edge, lit along the top and left.
  g.globalAlpha = 0.85; g.strokeStyle = color; g.lineWidth = Math.max(1.5, t * 0.05);
  g.beginPath(); g.roundRect(o, o, t, t, r); g.stroke();
  g.globalAlpha = dark ? 0.25 : 0.5; g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, t * 0.03);
  g.beginPath(); g.moveTo(o + r, o + t * 0.07); g.lineTo(o + t - r, o + t * 0.07); g.stroke();
  if (!ch) return c;
  g.globalAlpha = 1; g.fillStyle = color;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(t * 0.62)}px 'Space Grotesk',system-ui,sans-serif`;
  g.fillText(ch, o + t * 0.46, o + t * 0.5);
  g.font = `700 ${Math.round(t * 0.2)}px 'Space Grotesk',system-ui,sans-serif`;
  g.fillText(String(value), o + t * 0.82, o + t * 0.8);
  return c;
}
