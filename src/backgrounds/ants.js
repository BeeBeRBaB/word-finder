// Ant trails: drawn ants leave their nest to forage, wander until they smell food, carry a crumb
// home, and lay scent as they go, home scent going out and food scent coming back, so the others
// follow; trails form, thicken and fade when a pile runs out. The seed picks the variant: one nest
// with piles all around, a star of trails; two colonies in two colours from opposite sides
// foraging the same piles; or a nest across the host from its food, the trails winding round stones.

import { stage, TAU, clamp } from './stage.js';

const LUT = 64;
const SENSE_A = 0.6;    // sensor angle either side, radians

/** @typedef {{x:number, y:number, a:number, wan:number, carry:boolean, t:number, col:number, ph:number}} Ant */
/** @typedef {{fx:number, fy:number, left:number, full:number, crumbs:{dx:number, dy:number}[], gone:number, show:number}} Pile */
/** @typedef {{fx:number, fy:number, fr:number}} Stone */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { layout, rng } = s;
    const cols = layout === 1 ? 2 : 1;
    const off = document.createElement('canvas');
    const g = /** @type {CanvasRenderingContext2D} */ (off.getContext('2d'));
    /** @type {ImageData|null} */
    let img = null;
    let cell = 6, gw = 0, gh = 0, L = 7, warmed = false;
    /** Per colony: scent leading to food (laid by ants coming home) and to the nest (laid going out). */
    /** @type {Float32Array[]} */
    let food = [];
    /** @type {Float32Array[]} */
    let home = [];
    /** @type {Ant[]} */
    const ants = [];
    /** Nests as fractions of the host. */
    const nests = layout === 1
      ? [{ fx: 0.12 + rng.random() * 0.06, fy: 0.25 + rng.random() * 0.5 }, { fx: 0.82 + rng.random() * 0.06, fy: 0.25 + rng.random() * 0.5 }]
      : layout === 2 ? [{ fx: 0.14, fy: 0.3 + rng.random() * 0.4 }] : [{ fx: 0.42 + rng.random() * 0.16, fy: 0.42 + rng.random() * 0.16 }];
    /** @type {Pile[]} */
    const piles = [];
    /** @type {Stone[]} */
    const stones = [];

    // Scent colours per colony: food trail strong, home trail faint.
    const rgb = s.colors.map(rgbOf);
    const tc = [rgb[0], rgb[1 % rgb.length]];
    const antColor = [s.colors[0], s.colors[1 % s.colors.length]];
    const crumbColor = s.colors[2 % s.colors.length], nestColor = s.colors[3 % s.colors.length];
    const FA = s.dark ? 0.42 : 0.4, HA = s.dark ? 0.12 : 0.1;

    /** Where a new pile may go, as fractions. @returns {{fx:number, fy:number}} */
    function pileSpot() {
      for (let k = 0; k < 20; k++) {
        const p = layout === 2 ? { fx: 0.66 + rng.random() * 0.2, fy: 0.12 + rng.random() * 0.76 }
          : layout === 1 ? { fx: 0.3 + rng.random() * 0.4, fy: 0.1 + rng.random() * 0.8 }
            : { fx: 0.08 + rng.random() * 0.84, fy: 0.08 + rng.random() * 0.84 };
        const m = Math.min(s.W, s.H);
        const near = nests.some((n) => Math.hypot((n.fx - p.fx) * s.W, (n.fy - p.fy) * s.H) < m * 0.3)
          || piles.some((q) => Math.hypot((q.fx - p.fx) * s.W, (q.fy - p.fy) * s.H) < m * 0.25)
          || stones.some((q) => Math.hypot((q.fx - p.fx) * s.W, (q.fy - p.fy) * s.H) < q.fr * m + L * 3);
        if (!near) return p;
      }
      return { fx: 0.1 + rng.random() * 0.8, fy: 0.1 + rng.random() * 0.8 };
    }

    /** A fresh pile of crumbs. @param {Pile} [p] the empty pile to reuse @returns {Pile} */
    function newPile(p) {
      const spot = pileSpot(), full = 40 + rng.int(40);
      const crumbs = Array.from({ length: full }, () => {
        const a = rng.random() * TAU, r = Math.sqrt(rng.random());
        return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
      });
      return Object.assign(p ?? /** @type {Pile} */ ({}), { ...spot, left: full, full, crumbs, gone: 0, show: 0 });
    }

    /** The pile's radius in px. @param {Pile} p @returns {number} */
    const pileR = (p) => L * (1.1 + 1.6 * Math.sqrt(p.left / 80));

    /** Moves an ant and lays scent. @param {Ant} n @param {number} dt @returns {void} */
    function walk(n, dt) {
      const m = Math.min(s.W, s.H), v = L * 3.2;
      const nest = nests[n.col], nx = nest.fx * s.W, ny = nest.fy * s.H;
      const lost = !n.carry && n.t > 70;
      /** @type {number|null} */
      let goal = null;
      if (n.carry || lost) {
        const d = Math.hypot(nx - n.x, ny - n.y);
        if (d < L * 2) {
          n.carry = false; n.t = 0; n.a += Math.PI; return;
        }
        if (d < L * 9 || lost) goal = Math.atan2(ny - n.y, nx - n.x);
      } else {
        for (const p of piles) {
          if (p.left <= 0) continue;
          const px = p.fx * s.W, py = p.fy * s.H, d = Math.hypot(px - n.x, py - n.y);
          if (d < pileR(p)) {
            n.carry = true; n.t = 0; n.a += Math.PI; p.left--; return;
          }
          if (d < L * 9) goal = Math.atan2(py - n.y, px - n.x);
        }
      }
      if (goal !== null) {
        n.a += clamp(angleTo(n.a, goal), -3 * dt, 3 * dt);
      } else {
        // Follow the scent: three sensors ahead, turn toward the strongest.
        const grid = n.carry ? home[n.col] : food[n.col];
        const sd = Math.max(cell * 3, L * 2.5);
        const f = smell(grid, n.x + Math.cos(n.a) * sd, n.y + Math.sin(n.a) * sd);
        const l = smell(grid, n.x + Math.cos(n.a - SENSE_A) * sd, n.y + Math.sin(n.a - SENSE_A) * sd);
        const r = smell(grid, n.x + Math.cos(n.a + SENSE_A) * sd, n.y + Math.sin(n.a + SENSE_A) * sd);
        if (l > f * 1.05 && l >= r) n.a -= 2.4 * dt;
        else if (r > f * 1.05) n.a += 2.4 * dt;
        n.wan = clamp(n.wan + (rng.random() - 0.5) * 6 * dt, -1.1, 1.1);
        const scent = Math.max(f, l, r);
        n.a += n.wan * dt * (scent > 0.05 ? 0.35 : 1);
        // Carrying ants also keep a sense of where home lies.
        if (n.carry) n.a += angleTo(n.a, Math.atan2(ny - n.y, nx - n.x)) * 0.35 * dt;
      }
      let x = n.x + Math.cos(n.a) * v * dt, y = n.y + Math.sin(n.a) * v * dt;
      const pad = L;
      if (x < pad || y < pad || x > s.W - pad || y > s.H - pad) {
        n.a = Math.atan2(s.H / 2 - n.y, s.W / 2 - n.x) + (rng.random() - 0.5) * 1.5;
        x = clamp(x, pad, s.W - pad); y = clamp(y, pad, s.H - pad);
      }
      for (const st of stones) {
        const sx = st.fx * s.W, sy = st.fy * s.H, r = st.fr * m + L * 0.6, dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy);
        if (d < r) {
          // Slide round the stone: out to its rim, heading along it.
          x = sx + dx / d * r; y = sy + dy / d * r;
          const tan = Math.atan2(dy, dx) + (angleTo(Math.atan2(dy, dx), n.a) > 0 ? 1 : -1) * Math.PI / 2;
          n.a += angleTo(n.a, tan) * 0.5;
        }
      }
      n.x = x; n.y = y; n.t += dt; n.ph += dt * 14;
      // Scent fades with time since the ant left its source, so trails point back to it.
      // Laid over the cell and, a little weaker, its neighbours, so a trail is smooth when scaled up.
      const str = Math.exp(-n.t / 24), grid = n.carry ? food[n.col] : home[n.col];
      if (str > 0.02 && !lost) {
        const X = clamp(x / cell | 0, 1, gw - 2), Y = clamp(y / cell | 0, 1, gh - 2);
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const k = (Y + j) * gw + X + i, v = i || j ? str * 0.6 : str;
            if (grid[k] < v) grid[k] = v;
          }
        }
      }
    }

    /** Scent at a point, 0 off the map. @param {Float32Array} grid @param {number} x @param {number} y @returns {number} */
    function smell(grid, x, y) {
      const X = x / cell | 0, Y = y / cell | 0;
      return X < 0 || Y < 0 || X >= gw || Y >= gh ? 0 : grid[Y * gw + X];
    }

    /** Fades grid a by k and mixes share sp of each cell with its four neighbours.
     * @param {Float32Array} a @param {number} k @param {number} sp @returns {void} */
    function spread(a, k, sp) {
      for (let y = 1; y < gh - 1; y++) {
        for (let x = 1, i = y * gw + 1; x < gw - 1; x++, i++) {
          a[i] = (a[i] * (1 - sp) + (a[i - 1] + a[i + 1] + a[i - gw] + a[i + gw]) * 0.25 * sp) * k;
        }
      }
    }
    let odd = false;

    /** One step of the colony. @param {number} dt @returns {void} */
    function tick(dt) {
      for (const n of ants) walk(n, dt);
      // Scent fades, and spreads a little to the four neighbours, which also softens the trails;
      // food and home scent take turns, a double step each.
      odd = !odd;
      for (let c = 0; c < cols; c++) spread(odd ? food[c] : home[c], Math.exp(-2 * dt / (odd ? 22 : 26)), Math.min(0.1, dt));
      for (const p of piles) {
        p.show = Math.min(1, p.show + dt / 2);
        if (p.left <= 0 && (p.gone += dt) > 5) newPile(p);
      }
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H), ow = gw, oh = gh;
        L = clamp(m / 75, 6, 11);
        cell = clamp(m / 110, 4, 9);
        while ((s.W / cell + 1) * (s.H / cell + 1) > 20000) cell += 0.5;
        gw = Math.ceil(s.W / cell) + 1; gh = Math.ceil(s.H / cell) + 1;
        /** @param {Float32Array} a @returns {Float32Array} */
        const resample = (a) => {
          const b = new Float32Array(gw * gh);
          if (ow) for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) b[y * gw + x] = a[Math.min(oh - 1, Math.floor(y * oh / gh)) * ow + Math.min(ow - 1, Math.floor(x * ow / gw))];
          return b;
        };
        food = Array.from({ length: cols }, (_, c) => resample(food[c] ?? new Float32Array(0)));
        home = Array.from({ length: cols }, (_, c) => resample(home[c] ?? new Float32Array(0)));
        off.width = gw; off.height = gh;
        img = g.createImageData(gw, gh);
        if (!warmed) {
          if (layout === 2) {
            const k = clamp(Math.round(s.W * s.H / 160000), 3, 7);
            for (let i = 0; i < k; i++) stones.push({ fx: 0.3 + 0.3 * (i + rng.random()) / k, fy: 0.15 + rng.random() * 0.7, fr: 0.04 + rng.random() * 0.05 });
          }
          const np = layout === 2 ? 2 : layout === 1 ? 3 : clamp(Math.round(s.W * s.H / 200000), 3, 5);
          for (let i = 0; i < np; i++) piles.push(newPile());
        }
        const want = clamp(Math.round(s.W * s.H / 5000), 50, 220);
        while (ants.length < want) {
          const col = ants.length % cols, nest = nests[col];
          ants.push({ x: nest.fx * s.W, y: nest.fy * s.H, a: rng.random() * TAU, wan: 0, carry: false,
            t: rng.random() * 10, col, ph: rng.random() * TAU });
        }
        ants.length = want;
        if (!warmed) {
          warmed = true;
          // A minute of foraging, so the trails are already laid; piles show at once.
          for (let i = 0; i < 600; i++) tick(0.1);
          for (const p of piles) p.show = 1;
        }
      },
      step(dt) { tick(Math.min(dt, 0.1)); },
      draw() {
        if (!img) return;
        const { ctx } = s;
        const d = img.data, n = gw * gh;
        // Scent: per colony, the food trail over the faint home trail, colonies blended by weight.
        for (let i = 0, o = 0; i < n; i++, o += 4) {
          let r = 0, gg = 0, b = 0, w = 0, keep = 1;
          for (let c = 0; c < cols; c++) {
            const a = Math.min(1, food[c][i] * 2) * FA + Math.min(1, home[c][i] * 1.5) * HA;
            if (a < 0.004) continue;
            const col = tc[c];
            r += col[0] * a; gg += col[1] * a; b += col[2] * a; w += a; keep *= 1 - a;
          }
          if (!w) { d[o + 3] = 0; continue; }
          d[o] = r / w; d[o + 1] = gg / w; d[o + 2] = b / w; d[o + 3] = 255 * (1 - keep);
        }
        g.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'low';
        ctx.drawImage(off, 0, 0, gw * cell, gh * cell);

        const m = Math.min(s.W, s.H);
        // Stones: flat grey pebbles with a rim.
        ctx.fillStyle = s.ink;
        ctx.strokeStyle = s.ink;
        ctx.lineWidth = 1.5;
        for (const st of stones) {
          ctx.beginPath();
          ctx.ellipse(st.fx * s.W, st.fy * s.H, st.fr * m, st.fr * m * 0.86, st.fx * 9, 0, TAU);
          ctx.globalAlpha = 0.13;
          ctx.fill();
          ctx.globalAlpha = 0.3;
          ctx.stroke();
        }
        // Nests: a mound with a dark entrance.
        for (const ne of nests) {
          const x = ne.fx * s.W, y = ne.fy * s.H, r = L * 3;
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = nestColor;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = s.dark ? '#000' : s.ink;
          ctx.beginPath(); ctx.arc(x, y, L * 0.8, 0, TAU); ctx.fill();
        }
        // Piles: the crumbs still left.
        ctx.fillStyle = crumbColor;
        for (const p of piles) {
          if (p.left <= 0) continue;
          const x = p.fx * s.W, y = p.fy * s.H, R = L * 2.4, cr = L * 0.22;
          ctx.globalAlpha = 0.6 * p.show;
          ctx.beginPath();
          for (let i = 0; i < p.left; i++) {
            const c = p.crumbs[i];
            ctx.moveTo(x + c.dx * R + cr, y + c.dy * R);
            ctx.arc(x + c.dx * R, y + c.dy * R, cr, 0, TAU);
          }
          ctx.fill();
        }
        // Ants: abdomen, thorax and head, three pairs of legs in a tripod gait, a crumb if carrying.
        for (let c = 0; c < cols; c++) {
          ctx.globalAlpha = s.dark ? 0.62 : 0.66;
          ctx.fillStyle = antColor[c];
          ctx.strokeStyle = antColor[c];
          ctx.lineWidth = Math.max(0.7, L * 0.07);
          ctx.beginPath();
          for (const n of ants) {
            if (n.col !== c) continue;
            const ux = Math.cos(n.a), uy = Math.sin(n.a);
            for (const [o, r] of [[-0.3, 0.26], [0.04, 0.14], [0.33, 0.17]]) {
              const x = n.x + ux * o * L, y = n.y + uy * o * L;
              ctx.moveTo(x + r * L, y);
              ctx.arc(x, y, r * L, 0, TAU);
            }
          }
          ctx.fill();
          ctx.beginPath();
          for (const n of ants) {
            if (n.col !== c) continue;
            const ux = Math.cos(n.a), uy = Math.sin(n.a), tx = n.x + ux * 0.04 * L, ty = n.y + uy * 0.04 * L;
            const sw = Math.sin(n.ph) * 0.12;
            for (let j = -1; j <= 1; j++) {
              const e = (j === 0 ? -sw : sw) * L, o = j * 0.22 * L;
              ctx.moveTo(tx + ux * (o + e) - uy * 0.36 * L, ty + uy * (o + e) + ux * 0.36 * L);
              ctx.lineTo(tx + ux * (o - e) + uy * 0.36 * L, ty + uy * (o - e) - ux * 0.36 * L);
            }
          }
          ctx.stroke();
        }
        ctx.fillStyle = crumbColor;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        for (const n of ants) {
          if (!n.carry) continue;
          const x = n.x + Math.cos(n.a) * 0.55 * L, y = n.y + Math.sin(n.a) * 0.55 * L;
          ctx.moveTo(x + L * 0.2, y);
          ctx.arc(x, y, L * 0.2, 0, TAU);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      },
    };
  });
}

/** Signed turn from heading a to heading b, -PI..PI. @param {number} a @param {number} b @returns {number} */
function angleTo(a, b) {
  const d = (b - a) % TAU;
  return d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d;
}

/** Any CSS colour as [r, g, b], via a canvas's own parser. @param {string} color @returns {number[]} */
function rgbOf(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = '#888';
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = v.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
