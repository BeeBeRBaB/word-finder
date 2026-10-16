// Invaders: rows of little pixel aliens march side to side in steps, flexing their legs, and drop
// a row at each edge; a wave that is cleared or lands gives way to a new one. The seed picks the
// variant: one big formation picked off by a cannon below, several small squadrons marching in
// bands down the whole screen, or a full battle with bunkers worn away by bombs and shots and a
// saucer gliding over the top now and then.

import { stage, clamp } from './stage.js';

// Bitmaps, one string per row, '#' lit. Two frames per alien.
const ART = {
  squid0: ['...##...', '..####..', '.######.', '##.##.##', '########', '..#..#..', '.#.##.#.', '#.#..#.#'],
  squid1: ['...##...', '..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#', '.#....#.'],
  crab0: ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'],
  crab1: ['..#.....#..', '#..#...#..#', '#.#######.#', '###.###.###', '###########', '.#########.', '..#.....#..', '.#.......#.'],
  octo0: ['....####....', '.##########.', '############', '###..##..###', '############', '...##..##...', '..##.##.##..', '##........##'],
  octo1: ['....####....', '.##########.', '############', '###..##..###', '############', '..###..###..', '.##..##..##.', '..##....##..'],
  boom: ['#...#..#...#', '.#..#..#..#.', '..#......#..', '##........##', '..#......#..', '.#..#..#..#.', '#...#..#...#'],
  cannon: ['......#......', '.....###.....', '.....###.....', '.###########.', '#############', '#############'],
  saucer: ['.....######.....', '...##########...', '..############..', '.##.##.##.##.##.', '################', '..###..##..###..', '...#........#...'],
};
/** @typedef {keyof typeof ART} Art */
const KINDS = /** @type {const} */ (['squid', 'crab', 'octo']);
const CW = 16, RH = 14; // a formation cell, in alien pixels
const BW = 22, BH = 15; // a bunker

/** @typedef {{x:number, y:number, dir:number, cols:number, rows:number, alive:Uint8Array,
 *   kinds:number[], hues:number[], timer:number, every:number, frame:number, fade:number, out:boolean}} Formation
 * Position and sizes are in alien pixels; fade 0..1 eases in, and out while `out`. */
/** @typedef {{x:number, y:number, t:number, c:number}} Boom */
/** @typedef {{x:number, y:number, bits:Uint8Array}} Bunker */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    const battle = s.layout !== 1;
    // Everything is measured in alien pixels of p CSS px; Wu x Hu is the host in them.
    let p = 4, Wu = 0, Hu = 0, ground = 0, wait = 0;
    /** @type {Formation[]} */
    let forms = [];
    /** @type {Boom[]} */
    let booms = [];
    /** @type {Bunker[]} */
    let bunkers = [];
    const gun = { x: 0, goal: 0, cool: 1 };
    /** @type {{x:number, y:number}|null} */
    let shot = null;
    /** @type {{x:number, y:number}[]} */
    let bombs = [];
    let bombCool = 2;
    const ufo = { x: -99, dir: 1, on: false, next: 8 };
    /** Sprites by art and colour, at the current pixel size. @type {Map<string, HTMLCanvasElement>} */
    const sprites = new Map();
    s.onDpr = () => sprites.clear();

    /** @param {Art} name @param {number} c @returns {HTMLCanvasElement} */
    function sprite(name, c) {
      const key = name + c;
      let cv = sprites.get(key);
      if (cv) return cv;
      const art = ART[name];
      const d = p * s.dpr;
      cv = document.createElement('canvas');
      cv.width = Math.ceil(art[0].length * d); cv.height = Math.ceil(art.length * d);
      const g = cv.getContext('2d');
      if (g) {
        g.fillStyle = s.colors[c];
        // Whole device pixels per bitmap pixel, so edges stay crisp.
        art.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            if (row[i] !== '#') continue;
            const x0 = Math.round(i * d), y0 = Math.round(j * d);
            g.fillRect(x0, y0, Math.round((i + 1) * d) - x0, Math.round((j + 1) * d) - y0);
          }
        });
      }
      sprites.set(key, cv);
      return cv;
    }

    /** @param {number} k @returns {number} the width of alien kind k */
    const width = (k) => ART[`${KINDS[k]}0`][0].length;

    /** @param {number} cols @param {number} rows @param {number} x @param {number} y @returns {Formation} */
    function formation(cols, rows, x, y) {
      const one = rng.int(3);
      return {
        x, y, dir: rng.random() < 0.5 ? -1 : 1, cols, rows, alive: new Uint8Array(cols * rows).fill(1),
        kinds: Array.from({ length: rows }, (_, r) => battle ? (r === 0 ? 0 : r < 3 ? 1 : 2) : one),
        hues: Array.from({ length: rows }, (_, r) => battle ? r % nc : (one + forms.length) % nc),
        timer: rng.random(), every: battle ? 0.6 : 0.45 + rng.random() * 0.25, frame: 0, fade: 0, out: false,
      };
    }

    /** Columns and rows of alive aliens: [minCol, maxCol, maxRow], or null when none.
     * @param {Formation} f @returns {[number, number, number]|null} */
    function extent(f) {
      let c0 = 99, c1 = -1, r1 = -1;
      for (let i = 0; i < f.alive.length; i++) {
        if (!f.alive[i]) continue;
        const c = i % f.cols, r = Math.floor(i / f.cols);
        if (c < c0) c0 = c; if (c > c1) c1 = c; if (r > r1) r1 = r;
      }
      return c1 < 0 ? null : [c0, c1, r1];
    }

    /** A new wave for the battle variants, coming in at the top. */
    function wave() {
      const cols = clamp(Math.floor(Wu * 0.68 / CW), 5, 11);
      const f = formation(cols, 5, (Wu - cols * CW) / 2, Hu * 0.07);
      forms = [f];
      if (s.layout === 2) {
        const n = clamp(Math.floor(Wu / 70), 2, 4);
        bunkers = [];
        for (let i = 0; i < n; i++) {
          const bits = new Uint8Array(BW * BH);
          for (let y = 0; y < BH; y++) {
            for (let x = 0; x < BW; x++) {
              const corner = y < 4 && (x < 4 - y || x > BW - 5 + y);
              const arch = y > 9 && x > 5 && x < BW - 6 && (y > 12 || (x > 6 && x < BW - 7));
              bits[y * BW + x] = corner || arch ? 0 : 1;
            }
          }
          bunkers.push({ x: (Wu / n) * (i + 0.5) - BW / 2, y: ground - 30, bits });
        }
      }
    }

    /** Lays the squadrons in bands down the host. */
    function squadrons() {
      const n = clamp(Math.round(Hu / 45), 3, 6);
      forms = [];
      for (let i = 0; i < n; i++) {
        const cols = clamp(Math.floor(Wu * (0.22 + rng.random() * 0.14) / CW), 3, 7);
        const rows = 2 + rng.int(2);
        // Spread across the width by the golden ratio, so bands don't line up.
        const f = formation(cols, rows, ((i * 0.618 + rng.random() * 0.25) % 1) * (Wu - cols * CW), (i / n) * Hu + rng.random() * 8);
        f.fade = 1;
        forms.push(f);
      }
    }

    /** Clears bunker pixels round a hit. @param {Bunker} b @param {number} x @param {number} y */
    function chip(b, x, y) {
      for (let j = -3; j <= 3; j++) {
        for (let i = -2; i <= 2; i++) {
          const bx = Math.round(x - b.x + i), by = Math.round(y - b.y + j);
          if (bx < 0 || by < 0 || bx >= BW || by >= BH) continue;
          if (i * i + j * j * 0.5 < 3 + rng.random() * 3) b.bits[by * BW + bx] = 0;
        }
      }
    }

    /** The bunker pixel under (x, y), if lit. @param {number} x @param {number} y @returns {Bunker|null} */
    function bunkerAt(x, y) {
      for (const b of bunkers) {
        const bx = Math.floor(x - b.x), by = Math.floor(y - b.y);
        if (bx >= 0 && by >= 0 && bx < BW && by < BH && b.bits[by * BW + bx]) return b;
      }
      return null;
    }

    /** @param {Formation} f @param {number} dt */
    function march(f, dt) {
      f.fade = f.out ? Math.max(0, f.fade - dt) : Math.min(1, f.fade + dt);
      const e = extent(f);
      if (!e) return;
      const left = f.alive.reduce((n, v) => n + v, 0) / f.alive.length;
      f.timer += dt;
      // Fewer aliens, quicker steps, as in the arcade.
      const every = f.every * (battle ? 0.25 + 0.75 * left : 1);
      if (f.timer < every) return;
      f.timer = 0;
      f.frame ^= 1;
      const lo = f.x + e[0] * CW + 2, hi = f.x + (e[1] + 1) * CW - 2;
      if ((f.dir > 0 && hi + 2 > Wu - 6) || (f.dir < 0 && lo - 2 < 6)) {
        f.dir = -f.dir;
        f.y += 6;
        if (!battle && f.y > Hu + 4) f.y = -f.rows * RH - 6;
      } else f.x += 2 * f.dir;
      // Landing ends the wave; aliens marching through a bunker wear it away.
      if (battle && !f.out) {
        const bottom = f.y + e[2] * RH + 8;
        if (bottom > ground - 12) f.out = true;
        for (const b of bunkers) {
          if (bottom < b.y || f.y > b.y + BH) continue;
          for (let i = 0; i < f.alive.length; i++) {
            if (!f.alive[i]) continue;
            const ax = f.x + (i % f.cols) * CW, ay = f.y + Math.floor(i / f.cols) * RH;
            for (let y = 0; y < 8; y++) for (let x = 2; x < 14; x++) {
              const bx = Math.floor(ax + x - b.x), by = Math.floor(ay + y - b.y);
              if (bx >= 0 && by >= 0 && bx < BW && by < BH) b.bits[by * BW + bx] = 0;
            }
          }
        }
      }
    }

    /** @param {number} dt */
    function battleStep(dt) {
      const f = forms[0];
      if (!f) return;
      if (f.out && f.fade <= 0) { wave(); return; }
      if (!extent(f)) {
        wait += dt;
        if (wait > 1.6) { wait = 0; wave(); }
      }
      // The cannon moves under a target and fires when lined up and its last shot is spent.
      gun.cool -= dt;
      if (gun.cool <= 0 && !f.out) {
        const e = extent(f);
        if (ufo.on && rng.random() < 0.4) gun.goal = ufo.x + 8 + ufo.dir * 14;
        else if (e) {
          const c = e[0] + rng.int(e[1] - e[0] + 1);
          gun.goal = f.x + c * CW + CW / 2 + f.dir * 4;
        }
        gun.cool = 1.2 + rng.random() * 1.6;
      }
      const v = 50 * dt;
      gun.x += clamp(gun.goal - gun.x, -v, v);
      gun.x = clamp(gun.x, 8, Wu - 8);
      if (!shot && Math.abs(gun.goal - gun.x) < 1 && gun.cool < 0.9 && f.fade >= 1 && extent(f)) shot = { x: gun.x, y: ground - 8 };
      if (shot) {
        shot.y -= 70 * dt;
        const hitB = bunkerAt(shot.x, shot.y);
        if (hitB) { chip(hitB, shot.x, shot.y); shot = null; }
      }
      if (shot) {
        for (let i = 0; i < f.alive.length; i++) {
          if (!f.alive[i]) continue;
          const k = f.kinds[Math.floor(i / f.cols)];
          const w = width(k);
          const ax = f.x + (i % f.cols) * CW + (CW - w) / 2, ay = f.y + Math.floor(i / f.cols) * RH;
          if (shot.x >= ax && shot.x <= ax + w && shot.y >= ay && shot.y <= ay + 8) {
            f.alive[i] = 0;
            booms.push({ x: ax + w / 2, y: ay + 4, t: 0, c: f.hues[Math.floor(i / f.cols)] });
            shot = null;
            break;
          }
        }
      }
      if (shot && ufo.on && shot.y < 16 && shot.y > 6 && Math.abs(shot.x - ufo.x - 8) < 8) {
        booms.push({ x: ufo.x + 8, y: 11, t: 0, c: 0 });
        ufo.on = false; shot = null;
      }
      if (shot && shot.y < -6) shot = null;
      if (s.layout !== 2) return;
      // Bombs from the lowest alien of a random column; they wear the bunkers.
      bombCool -= dt;
      const e = extent(f);
      if (bombCool <= 0 && e && !f.out && f.fade >= 1) {
        bombCool = 1 + rng.random() * 1.5;
        const c = e[0] + rng.int(e[1] - e[0] + 1);
        for (let r = f.rows - 1; r >= 0; r--) {
          if (f.alive[r * f.cols + c]) { bombs.push({ x: f.x + c * CW + CW / 2, y: f.y + r * RH + 9 }); break; }
        }
      }
      bombs = bombs.filter((b) => {
        b.y += 32 * dt;
        const hb = bunkerAt(b.x, b.y + 3);
        if (hb) { chip(hb, b.x, b.y + 3); return false; }
        return b.y < ground;
      });
      // The saucer crosses now and then.
      if (ufo.on) {
        ufo.x += ufo.dir * 26 * dt;
        if (ufo.x < -20 || ufo.x > Wu + 4) ufo.on = false;
      } else if ((ufo.next -= dt) <= 0) {
        ufo.on = true; ufo.dir = rng.random() < 0.5 ? -1 : 1;
        ufo.x = ufo.dir > 0 ? -16 : Wu; ufo.next = 14 + rng.random() * 10;
      }
    }

    /** @param {number} dt */
    function advance(dt) {
      for (const f of forms) march(f, dt);
      if (battle) battleStep(dt);
      for (const b of booms) b.t += dt;
      booms = booms.filter((b) => b.t < 0.5);
    }

    return {
      lay() {
        const np = clamp(Math.min(s.W, s.H) * 0.0062, 2.4, 6.5);
        if (np !== p) sprites.clear();
        const oldW = Wu;
        p = np; Wu = s.W / p; Hu = s.H / p;
        ground = Hu - Math.max(8, Hu * 0.05);
        if (!oldW) {
          if (battle) {
            wave();
            gun.x = gun.goal = Wu / 2;
            // A game in progress: the wave part way down with some aliens gone.
            const f = forms[0];
            f.fade = 1;
            f.y += Hu * 0.08;
            for (let i = f.cols; i < f.alive.length; i++) if (rng.random() < 0.18) f.alive[i] = 0;
          } else squadrons();
          for (let k = 0; k < 45; k++) advance(1 / 30);
          return;
        }
        // A new size: keep the game, nudged back inside, and redo the parts tied to the edges.
        for (const f of forms) f.x = clamp(f.x, 6, Math.max(6, Wu - 6 - f.cols * CW));
        if (battle) {
          const n = bunkers.length;
          bunkers.forEach((b, i) => { b.x = (Wu / n) * (i + 0.5) - BW / 2; b.y = ground - 30; });
          gun.x = clamp(gun.x, 8, Wu - 8);
          if (forms[0] && forms[0].cols * CW > Wu * 0.9) wave();
        } else if (Math.abs(oldW - Wu) > 1) squadrons();
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        const A = s.dark ? 0.5 : 0.55;
        for (const f of forms) {
          if (f.fade <= 0) continue;
          ctx.globalAlpha = A * f.fade;
          for (let i = 0; i < f.alive.length; i++) {
            if (!f.alive[i]) continue;
            const r = Math.floor(i / f.cols), k = f.kinds[r];
            const w = width(k);
            const x = f.x + (i % f.cols) * CW + (CW - w) / 2, y = f.y + r * RH;
            if (y > Hu || y < -10) continue;
            ctx.drawImage(sprite(/** @type {Art} */ (`${KINDS[k]}${f.frame}`), f.hues[r]), x * p, y * p, w * p, 8 * p);
          }
        }
        for (const b of booms) {
          ctx.globalAlpha = A * (1 - b.t / 0.5);
          ctx.drawImage(sprite('boom', b.c), (b.x - 6) * p, (b.y - 3.5) * p, 12 * p, 7 * p);
        }
        if (!battle) return;
        const ink = s.ink;
        ctx.fillStyle = ink;
        ctx.globalAlpha = s.dark ? 0.25 : 0.3;
        ctx.fillRect(0, ground * p, s.W, Math.max(1.5, p * 0.5));
        ctx.globalAlpha = A;
        ctx.drawImage(sprite('cannon', 1 % nc), (gun.x - 6.5) * p, (ground - 7) * p, 13 * p, 6 * p);
        if (ufo.on) {
          ctx.globalAlpha = A;
          ctx.drawImage(sprite('saucer', (2) % nc), ufo.x * p, 8 * p, 16 * p, 7 * p);
        }
        ctx.fillStyle = ink;
        ctx.globalAlpha = s.dark ? 0.6 : 0.65;
        if (shot) ctx.fillRect((shot.x - 0.5) * p, shot.y * p, p, 4 * p);
        // Bombs zigzag: three offset blocks that swap sides as they fall.
        for (const b of bombs) {
          const z = Math.floor(b.y / 3) % 2 ? 1 : -1;
          ctx.fillRect((b.x - 0.5 + z * 0.5) * p, b.y * p, p, p * 2);
          ctx.fillRect((b.x - 0.5 - z * 0.5) * p, (b.y + 2) * p, p, p * 2);
        }
        // Bunkers, one path of their standing pixels.
        if (bunkers.length) {
          ctx.globalAlpha = s.dark ? 0.32 : 0.38;
          ctx.fillStyle = s.colors[3 % nc];
          ctx.beginPath();
          for (const b of bunkers) {
            for (let i = 0; i < b.bits.length; i++) {
              if (b.bits[i]) ctx.rect((b.x + (i % BW)) * p, (b.y + Math.floor(i / BW)) * p, p + 0.3, p + 0.3);
            }
          }
          ctx.fill();
        }
      },
    };
  });
}
