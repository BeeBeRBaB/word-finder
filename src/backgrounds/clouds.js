// Clouds: puffy clouds built from circles, lit from above, drifting across in the look's colours.
// The seed picks the variant: a parallax sky, small far clouds drifting slowly above and behind
// big near ones; a sea of clouds, rows of billowing tops filling the lower host below high wisps,
// as from a mountain; or storybook, outlined cartoon clouds bobbing along lanes both ways.

import { stage, TAU, clamp, mix } from './stage.js';

/** @typedef {{cv:HTMLCanvasElement, w:number, h:number}} Sprite */
/** @typedef {{x:number, y:number, v:number, sp:number, layer:number, ph:number, slot:number}} Cloud */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    const rgb = s.colors.map(rgbOf);
    const dir = rng.random() < 0.5 ? 1 : -1;
    /** @type {Sprite[][]} sprites by layer */
    let sprites = [];
    /** @type {Cloud[]} */
    let clouds = [];
    let builtFor = 0, m = 1;
    // Cloud sea: rows of puffs; the sky's wisps.
    /** @type {{y:number, r:number, v:number, c:number, grad:CanvasGradient|string, depth:number, u:number}[]} */
    let rows = [];
    /** @type {{x:number, y:number, len:number, v:number, bend:number}[]} */
    let wisps = [];

    const LAYERS = layout === 0 ? 3 : layout === 2 ? 3 : 0;

    /** Builds each layer's sprites for the current size. */
    function build() {
      sprites = [];
      for (let L = 0; L < LAYERS; L++) {
        const list = [];
        const base = layout === 2 ? m * (0.16 + 0.05 * L) : m * (0.13 + 0.17 * L);
        for (let i = 0; i < 4; i++) {
          const w = clamp(base * (0.8 + rng.random() * 0.5), 50, 520);
          list.push(cloudSprite(w, rgb[(L * 2 + i) % C], layout === 2, s.dark, s.dpr, rng.random));
        }
        sprites.push(list);
      }
    }

    /** A new cloud of layer L, its height from its slot so a layer spreads down the host.
     * @param {number} L @param {number} slot @param {number} of @returns {Cloud} */
    function cloud(L, slot, of) {
      const v = layout === 2 ? (L % 2 ? -1 : 1) * (6 + L * 2) : dir * (3 + L * L * 3);
      return { x: rng.random() * s.W, y: 0, v, sp: rng.int(4), layer: L, ph: rng.random() * TAU, slot: (slot + 0.5) / of };
    }

    /** Puts a cloud at its slot's height. @param {Cloud} c */
    function settle(c) {
      const sp = sprites[c.layer][c.sp];
      if (layout === 2) {
        // Lanes: each layer is one band of the host, its clouds spread along it.
        const lane = (c.layer + 0.5) / LAYERS;
        c.y = lane * s.H - sp.h * 0.55 + (c.slot - 0.5) * s.H / LAYERS * 0.5;
      } else {
        c.y = c.slot * (s.H + sp.h * 0.3) - sp.h * 0.7 + (rng.random() - 0.5) * sp.h * 0.4;
      }
    }

    /** Lays out the cloud sea's rows and the wisps above them. */
    function laySea() {
      const R = clamp(Math.round(s.H / 110), 4, 8);
      const top = s.H * 0.42;
      rows = [];
      for (let j = 0; j < R; j++) {
        const u = R > 1 ? j / (R - 1) : 1;
        rows.push({ y: top + (s.H - top) * Math.pow(j / R, 1.1), r: m * (0.03 + 0.06 * u), v: dir * (2 + 7 * u),
          c: j % C, grad: '', depth: 0, u });
      }
      for (let j = 0; j < R; j++) {
        const w = rows[j];
        const next = j + 1 < R ? rows[j + 1].y : s.H + 60;
        w.depth = (next - w.y) * 1.8 + w.r;
        const g = s.ctx.createLinearGradient(0, w.y - w.r * 1.4, 0, w.y + w.depth);
        const a = (s.dark ? 0.17 : 0.22) + 0.08 * w.u;
        g.addColorStop(0, rgba(rgb[w.c], a));
        g.addColorStop(0.3, rgba(rgb[w.c], a * 0.7));
        g.addColorStop(1, rgba(rgb[w.c], 0));
        w.grad = g;
      }
      const nw = clamp(Math.round(s.W / 300), 3, 7);
      while (wisps.length < nw) {
        wisps.push({ x: rng.random(), y: 0.06 + rng.random() * 0.28, len: 0.25 + rng.random() * 0.3, v: dir * (2 + rng.random() * 3),
          bend: (rng.random() - 0.5) * 0.08 });
      }
      wisps.length = nw;
    }

    /** One cloud-sea row: puffs riding the row line, their tops billowing slowly.
     * @param {typeof rows[number]} w */
    function seaRow(w) {
      const { ctx } = s;
      const gap = w.r * 1.15, off = s.t * w.v;
      const first = Math.floor((-off - w.r * 2) / gap), last = Math.ceil((s.W - off + w.r * 2) / gap);
      /** @param {number} grow @param {number} lift */
      const puffs = (grow, lift) => {
        ctx.beginPath();
        for (let g = first; g <= last; g++) {
          const h1 = hash(g * 3 + w.c * 17), h2 = hash(g * 7 + 1);
          const r = w.r * (0.7 + 0.55 * h1) * (1 + 0.07 * Math.sin(s.t * 0.25 + g * 1.7)) * grow;
          const x = g * gap + off + (h2 - 0.5) * gap * 0.6;
          const y = w.y - w.r * (0.15 + 0.6 * h2) - lift * r;
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
        }
      };
      puffs(1, 0);
      ctx.rect(-10, w.y, s.W + 20, w.depth);
      ctx.globalAlpha = 1;
      ctx.fillStyle = w.grad;
      ctx.fill('nonzero');
      // Sunlit tops: smaller puffs raised inside the first.
      puffs(0.86, 0.12);
      ctx.globalAlpha = s.dark ? 0.1 : 0.3;
      ctx.fillStyle = s.dark ? tint(rgb[w.c], 0.6) : '#fff';
      ctx.fill();
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        if (layout === 1) { laySea(); return; }
        if (Math.abs(m - builtFor) > builtFor * 0.15 || !sprites.length) { build(); builtFor = m; }
        const per = [clamp(Math.round(s.W * s.H / 90000), 5, 14), clamp(Math.round(s.W * s.H / 160000), 3, 9), clamp(Math.round(s.W * s.H / 260000), 2, 6)];
        if (layout === 2) per.fill(clamp(Math.round(s.W / 260), 2, 6));
        const kept = clouds;
        clouds = [];
        for (let L = 0; L < LAYERS; L++) {
          const old = kept.filter((c) => c.layer === L);
          // New clouds take shuffled columns, so a layer's heights and places are not in step.
          const order = rng.shuffle([...Array(per[L]).keys()]);
          for (let i = 0; i < per[L]; i++) {
            const c = old[i] ?? cloud(L, i, per[L]);
            if (!old[i]) c.x = (order[i] + rng.random() * 0.8) / per[L] * (s.W + 200) - 100;
            c.slot = (i + 0.5) / per[L];
            c.sp = c.sp % sprites[L].length;
            settle(c);
            c.x = Math.min(c.x, s.W);
            clouds.push(c);
          }
        }
      },
      step(dt) {
        if (layout === 1) {
          for (const w of wisps) {
            w.x += w.v * dt / s.W;
            if (w.v > 0 && w.x > 1.05) w.x = -w.len - 0.05;
            else if (w.v < 0 && w.x < -w.len - 0.05) w.x = 1.05;
          }
          return;
        }
        for (const c of clouds) {
          c.x += c.v * dt;
          const sp = sprites[c.layer][c.sp];
          if (c.v > 0 && c.x > s.W + 20) { c.x = -sp.w - 20; c.sp = rng.int(4); settle(c); }
          else if (c.v < 0 && c.x < -sp.w - 20) { c.x = s.W + 20; c.sp = rng.int(4); settle(c); }
        }
      },
      draw() {
        const { ctx } = s;
        if (layout === 1) {
          ctx.lineCap = 'round';
          for (const w of wisps) {
            const x = w.x * s.W, y = w.y * s.H, len = w.len * s.W;
            ctx.strokeStyle = s.colors[0];
            for (let k = 0; k < 3; k++) {
              ctx.globalAlpha = (s.dark ? 0.16 : 0.22) * (1 - k * 0.25);
              ctx.lineWidth = 2.5 - k * 0.6;
              ctx.beginPath();
              ctx.moveTo(x + k * 14, y + k * 7);
              ctx.quadraticCurveTo(x + len * 0.5, y + w.bend * s.H + k * 6, x + len - k * 20, y + k * 9);
              ctx.stroke();
            }
          }
          for (const w of rows) seaRow(w);
          ctx.globalAlpha = 1;
          return;
        }
        for (let L = 0; L < LAYERS; L++) {
          ctx.globalAlpha = layout === 2 ? (s.dark ? 0.5 : 0.6) : (s.dark ? 0.24 : 0.32) + L * 0.07;
          for (const c of clouds) {
            if (c.layer !== L) continue;
            const sp = sprites[L][c.sp];
            const bob = layout === 2 ? Math.sin(s.t * 0.5 + c.ph) * m * 0.008 : 0;
            ctx.drawImage(sp.cv, c.x, c.y + bob, sp.w, sp.h);
          }
        }
        ctx.globalAlpha = 1;
      },
    };
  });
}

/** A cloud of width w as a sprite: puffs over a flat base, lit from above (soft), or outlined
 * (cartoon). @param {number} w @param {number[]} c @param {boolean} cartoon @param {boolean} dark
 * @param {number} dpr @param {() => number} rand @returns {{cv:HTMLCanvasElement, w:number, h:number}} */
function cloudSprite(w, c, cartoon, dark, dpr, rand) {
  const h = w * 0.55, d = Math.min(2, dpr);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * d); cv.height = Math.ceil(h * d);
  const g = cv.getContext('2d');
  if (!g) return { cv, w, h };
  g.scale(d, d);
  const pad = w * 0.06, base = h * 0.82;
  /** @type {number[][]} x, y, r */
  const puffs = [];
  const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const r = h * (0.17 + 0.15 * Math.sin(Math.PI * u)) * (0.85 + rand() * 0.3);
    puffs.push([mix(pad + r, w - pad - r, u), base - r * 0.55, r]);
  }
  const big = h * (0.26 + rand() * 0.06);
  puffs.push([w * (0.38 + rand() * 0.14), base - big * 1.05 - h * 0.08, big]);
  if (n > 4) puffs.push([w * (0.62 + rand() * 0.1), base - big * 0.85, big * 0.8]);
  const body = () => {
    g.beginPath();
    for (const [x, y, r] of puffs) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
    g.rect(puffs[0][0], base - h * 0.2, puffs[n - 1][0] - puffs[0][0], h * 0.2);
  };
  g.save();
  g.beginPath(); g.rect(0, 0, w, base); g.clip();
  const col = `rgb(${c.join(',')})`;
  if (cartoon) {
    // A thick outline of every puff, the insides then cut out and refilled faintly, which
    // leaves only the outer edge outlined.
    body(); g.strokeStyle = col; g.lineWidth = Math.max(4, w * 0.025); g.stroke();
    g.globalCompositeOperation = 'destination-out'; body(); g.fill();
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.35; g.fillStyle = col; body(); g.fill();
    g.globalAlpha = 0.6;
    g.lineWidth = Math.max(2, w * 0.012); g.lineCap = 'round';
    const [x, y, r] = puffs[n];
    g.beginPath(); g.arc(x, y, r * 0.62, Math.PI * 1.15, Math.PI * 1.45); g.stroke();
    g.restore();
    g.beginPath(); g.moveTo(puffs[0][0] - puffs[0][2] * 0.9, base - 1); g.lineTo(puffs[n - 1][0] + puffs[n - 1][2] * 0.9, base - 1);
    g.globalAlpha = 1; g.strokeStyle = col; g.lineWidth = Math.max(4, w * 0.025) / 2; g.stroke();
    return { cv, w, h };
  }
  g.fillStyle = col; body(); g.fill();
  // Light from above: raised, smaller puffs paler; the base a little darker.
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = dark ? tint(c, 0.55) : tint(c, 0.75);
  g.globalAlpha = 0.75;
  g.beginPath();
  for (const [x, y, r] of puffs) { g.moveTo(x + r * 0.78, y - r * 0.22); g.arc(x, y - r * 0.22, r * 0.78, 0, TAU); }
  g.fill();
  g.globalAlpha = 1;
  const shade = g.createLinearGradient(0, base - h * 0.35, 0, base);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, dark ? 'rgba(0,0,0,.3)' : 'rgba(0,0,0,.12)');
  g.fillStyle = shade; g.fillRect(0, 0, w, base);
  g.restore();
  return { cv, w, h };
}

/** A stable pseudo-random 0..1 from an integer. @param {number} i @returns {number} */
function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The colour taken `u` of the way to white. @param {number[]} c @param {number} u @returns {string} */
function tint(c, u) { return `rgb(${c.map((v) => Math.round(v + (255 - v) * u)).join(',')})`; }

/** @param {number[]} c @param {number} a @returns {string} */
function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`; }

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
