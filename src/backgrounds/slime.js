// Slime mould: a physarum simulation. Thousands of unseen agents each sniff a trail map ahead,
// left and right, turn toward the strongest scent and lay their own, while the map spreads and
// fades; veins branch, thicken and reconnect. Low-res map, scaled up smooth. The seed picks the
// variant: an open network that keeps re-wiring, wrapping round the edges; a colony that grows
// out from a seed point in branching veins, thins away and re-roots elsewhere; or oat flakes the
// mould links up with the shortest veins it can find, a flake now and then eaten and replaced.

import { stage, TAU, clamp } from './stage.js';

const LUT = 256;
const SA = 0.5;      // sensor angle either side, radians
const SD = 7;        // sensor reach, cells
const RA = 0.35;     // turn per step, radians
const SPEED = 0.6;   // cells per step
const DECAY = 0.9;   // trail kept per step
const WARM = 140;    // steps before the first paint
const MAX_CELLS = 26000;
const SHARE = 0.07;  // agents per cell

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { layout, rng } = s;
    const off = document.createElement('canvas');
    const g = /** @type {CanvasRenderingContext2D} */ (off.getContext('2d'));
    /** @type {ImageData|null} */
    let img = null;
    let cell = 6, gw = 0, gh = 0, n = 0;
    let T = new Float32Array(0), T2 = T, D = T;
    let ax = T, ay = T, ah = T;
    /** Agents per cell. One at most may move into a cell: without that crowding rule the veins
     * coarsen over a minute or two into a few thick loops. */
    let occ = new Uint8Array(0);
    let acc = 0, warmed = false, live = 0;
    // Growth variant: the seed point (cells), the colony's reach and its age in steps. Agents past
    // `live` are idle; the colony grows by waking them at the seed, and dies back by idling them.
    let cx = 0, cy = 0, reach = 0, age = 0;
    /** Oat flakes: position as a fraction of the host, life 0..1 rising in and falling out. @type {{x:number, y:number, life:number, dying:boolean}[]} */
    const flakes = [];
    let flakeClock = 0;

    const rgb = s.colors.map(rgbOf);
    const c0 = rgb[0], c1 = rgb[1 % rgb.length];
    const A = s.dark ? 0.6 : 0.5;
    const pr = new Uint8ClampedArray(LUT), pg = new Uint8ClampedArray(LUT), pb = new Uint8ClampedArray(LUT), pa = new Uint8ClampedArray(LUT);
    for (let j = 0; j < LUT; j++) {
      // Faint scent stays clear, so the veins read thin rather than as a spread of colour.
      const e = clamp((j - 24) / 104, 0, 1), a = e * e * (3 - 2 * e), u = clamp((j - 60) / 120, 0, 1);
      pr[j] = c0[0] + (c1[0] - c0[0]) * u; pg[j] = c0[1] + (c1[1] - c0[1]) * u; pb[j] = c0[2] + (c1[2] - c0[2]) * u;
      pa[j] = 255 * A * a;
    }
    const flakeColor = s.colors[2 % s.colors.length];

    /** Puts agent i in the colony's inner third, heading roughly outward. @param {number} i @returns {void} */
    function sow(i) {
      const a = rng.random() * TAU, r = Math.sqrt(rng.random()) * Math.max(4, reach * 0.35);
      ax[i] = cx + Math.cos(a) * r; ay[i] = cy + Math.sin(a) * r; ah[i] = a + (rng.random() - 0.5) * 1.2;
    }

    /** The cell agent i stands in. @param {number} i @returns {number} */
    const cellOf = (i) => clamp(ay[i] | 0, 0, gh - 1) * gw + clamp(ax[i] | 0, 0, gw - 1);

    /** A new seed point for the growth variant. @returns {void} */
    function reroot() {
      cx = gw * (0.25 + 0.5 * rng.random()); cy = gh * (0.25 + 0.5 * rng.random());
      reach = 4; age = 0; live = 0;
    }

    /** Trail at a point, 0 outside. @param {number} x @param {number} y @returns {number} */
    function sense(x, y) {
      let X = x | 0, Y = y | 0;
      if (layout === 0) { X = (X % gw + gw) % gw; Y = (Y % gh + gh) % gh; } else if (X < 0 || Y < 0 || X >= gw || Y >= gh) return 0;
      return T[Y * gw + X];
    }

    /** One simulation step. @returns {void} */
    function tick() {
      const count = ax.length;
      if (layout !== 1) live = count;
      else {
        // Grow (reach for 50s, numbers for 20s), hold, then thin out over 5s and start again elsewhere.
        age++;
        if (age < 2100) {
          reach = Math.min(Math.hypot(gw, gh), reach + Math.hypot(gw, gh) / 1500);
          const to = Math.min(count, live + count / 600);
          for (let i = Math.floor(live); i < Math.floor(to); i++) { sow(i); occ[cellOf(i)]++; }
          live = to;
        } else {
          const to = Math.max(0, live - count / 150);
          for (let i = Math.floor(to); i < Math.floor(live); i++) occ[cellOf(i)]--;
          live = to;
          if (live <= 0) reroot();
        }
      }
      for (let i = 0, e = Math.floor(live); i < e; i++) {
        let h = ah[i];
        const x = ax[i], y = ay[i];
        const f = sense(x + Math.cos(h) * SD, y + Math.sin(h) * SD);
        const l = sense(x + Math.cos(h - SA) * SD, y + Math.sin(h - SA) * SD);
        const r = sense(x + Math.cos(h + SA) * SD, y + Math.sin(h + SA) * SD);
        if (f < l || f < r) {
          if (f < l && f < r) h += rng.random() < 0.5 ? RA : -RA;
          else h += l > r ? -RA : RA;
        }
        h += (rng.random() - 0.5) * 0.12;
        let nx = x + Math.cos(h) * SPEED, ny = y + Math.sin(h) * SPEED;
        if (layout === 0) {
          nx = (nx + gw) % gw; ny = (ny + gh) % gh;
        } else if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) {
          // Off the map: turn round at random and stay put this step.
          h += Math.PI + (rng.random() - 0.5); nx = x; ny = y;
        }
        if (layout === 1) {
          // A slight pull outward, so tendrils reach out; the colony's edge turns them back.
          const dx = nx - cx, dy = ny - cy;
          if (dx * dx + dy * dy > reach * reach) { h = Math.atan2(-dy, -dx) + (rng.random() - 0.5) * 1.2; nx = x; ny = y; }
          else h += 0.03 * Math.sin(Math.atan2(dy, dx) - h);
        }
        const from = (y | 0) * gw + (x | 0), k = (ny | 0) * gw + (nx | 0);
        if (k !== from) {
          // Crowded: stay, and try a new heading next step.
          if (occ[k]) { ah[i] = rng.random() * TAU; continue; }
          occ[from]--; occ[k]++;
        }
        ax[i] = nx; ay[i] = ny; ah[i] = h;
        T[k] = Math.min(40, T[k] + 1);
      }
      if (layout === 2) {
        // Each flake leaks scent into the cells round it.
        for (const fl of flakes) {
          const X = Math.round(fl.x * (gw - 1)), Y = Math.round(fl.y * (gh - 1));
          for (let y = -2; y <= 2; y++) {
            for (let x = -2; x <= 2; x++) {
              const px = X + x, py = Y + y;
              if (x * x + y * y <= 5 && px >= 0 && py >= 0 && px < gw && py < gh) T[py * gw + px] += 2 * fl.life;
            }
          }
        }
      }
      blur();
    }

    /** Spreads and fades the trail: half a 3x3 box blur, in two passes, then decay. @returns {void} */
    function blur() {
      for (let y = 0; y < gh; y++) {
        const row = y * gw;
        for (let x = 0; x < gw; x++) {
          const l = x ? row + x - 1 : row + gw - 1, r = x < gw - 1 ? row + x + 1 : row;
          T2[row + x] = T[l] + T[row + x] + T[r];
        }
      }
      const k = DECAY / 9;
      for (let y = 0; y < gh; y++) {
        const row = y * gw, up = ((y + gh - 1) % gh) * gw, dn = ((y + 1) % gh) * gw;
        // Half spread, half kept in place: thinner veins than a full blur.
        for (let x = 0; x < gw; x++) T[row + x] = (T2[up + x] + T2[row + x] + T2[dn + x]) * k * 0.5 + T[row + x] * DECAY * 0.5;
      }
    }

    /** Adds a flake away from the others. @returns {void} */
    function addFlake() {
      let best = { x: 0.5, y: 0.5 }, bestD = -1;
      for (let t = 0; t < 12; t++) {
        const p = { x: 0.08 + 0.84 * rng.random(), y: 0.08 + 0.84 * rng.random() };
        const d = Math.min(1e9, ...flakes.filter((f) => !f.dying).map((f) => Math.hypot((f.x - p.x) * s.W, (f.y - p.y) * s.H)));
        if (d > bestD) { bestD = d; best = p; }
      }
      flakes.push({ ...best, life: 0, dying: false });
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        cell = clamp(m / 160, 2.5, 6);
        while ((s.W / cell + 1) * (s.H / cell + 1) > MAX_CELLS) cell += 0.25;
        const ow = gw, oh = gh, oT = T;
        gw = Math.ceil(s.W / cell) + 1; gh = Math.ceil(s.H / cell) + 1; n = gw * gh;
        T = new Float32Array(n); T2 = new Float32Array(n); D = new Float32Array(n);
        if (ow) {
          for (let y = 0; y < gh; y++) {
            for (let x = 0; x < gw; x++) T[y * gw + x] = oT[Math.min(oh - 1, Math.floor(y * oh / gh)) * ow + Math.min(ow - 1, Math.floor(x * ow / gw))];
          }
          // Agents keep their place as a fraction of the map.
          for (let i = 0; i < ax.length; i++) { ax[i] *= gw / ow; ay[i] *= gh / oh; }
          cx *= gw / ow; cy *= gh / oh;
        }
        const want = Math.round(n * SHARE);
        if (want !== ax.length) {
          const old = ax.length, px = ax, py = ay, ph = ah;
          ax = new Float32Array(want); ay = new Float32Array(want); ah = new Float32Array(want);
          ax.set(px.subarray(0, Math.min(old, want))); ay.set(py.subarray(0, Math.min(old, want))); ah.set(ph.subarray(0, Math.min(old, want)));
          if (!ow) reroot();
          else if (layout === 1) live = Math.min(live, want);
          for (let i = old; i < want; i++) {
            if (layout === 1) sow(i);
            else { ax[i] = rng.random() * gw; ay[i] = rng.random() * gh; ah[i] = rng.random() * TAU; }
          }
        }
        occ = new Uint8Array(n);
        for (let i = 0, e = layout === 1 ? Math.floor(live) : ax.length; i < e; i++) occ[cellOf(i)] = Math.min(255, occ[cellOf(i)] + 1);
        if (layout === 2 && !flakes.length) {
          const k = clamp(Math.round(s.W * s.H / 110000), 4, 9);
          for (let i = 0; i < k; i++) { addFlake(); flakes[i].life = 1; }
        }
        off.width = gw; off.height = gh;
        img = g.createImageData(gw, gh);
        if (!warmed) {
          warmed = true;
          // The colony opens part grown.
          for (let i = 0; i < (layout === 1 ? 6 * WARM : WARM); i++) tick();
        }
        D.set(T);
      },
      step(dt) {
        if (layout === 2) {
          // Every ~20s a flake is used up (fading over 5s) and a fresh one appears.
          flakeClock += dt;
          if (flakeClock > 20) {
            flakeClock = 0;
            const live = flakes.filter((f) => !f.dying);
            live[rng.int(live.length)].dying = true;
            addFlake();
          }
          for (const f of flakes) f.life = clamp(f.life + (f.dying ? -dt : dt) / 5, 0, 1);
          for (let i = flakes.length - 1; i >= 0; i--) if (flakes[i].dying && flakes[i].life <= 0) flakes.splice(i, 1);
        }
        acc += dt * 30;
        let k = 0;
        while (acc >= 1 && k < 2) { tick(); acc -= 1; k++; }
        if (acc > 1) acc = 0;
      },
      draw() {
        if (!img) return;
        const d = img.data, gain = 40;
        for (let i = 0, o = 0; i < n; i++, o += 4) {
          // Shown eased toward the trail, which calms the cell-to-cell flicker of the agents.
          const v = D[i] += (T[i] - D[i]) * 0.3;
          const j = Math.min(LUT - 1, (v * gain) | 0);
          d[o] = pr[j]; d[o + 1] = pg[j]; d[o + 2] = pb[j]; d[o + 3] = pa[j];
        }
        g.putImageData(img, 0, 0);
        const { ctx } = s;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'low';
        ctx.drawImage(off, 0, 0, gw * cell, gh * cell);
        if (layout === 2) {
          // Flakes: small rounded oval chips.
          ctx.fillStyle = flakeColor;
          const r = clamp(Math.min(s.W, s.H) / 70, 5, 11);
          for (const f of flakes) {
            ctx.globalAlpha = 0.55 * f.life;
            ctx.beginPath();
            ctx.ellipse(f.x * (gw - 1) * cell, f.y * (gh - 1) * cell, r, r * 0.7, f.x * 7, 0, TAU);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      },
    };
  });
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
