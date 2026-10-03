// Silk Bokeh: three ribbons of fine flowing strands that pinch and fan as they wave,
// with a few soft out-of-focus circles rising slowly past them.
import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas } from './frame-loop.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean}} BackgroundOptions
 * @typedef {{y:number, tilt:number, amp:number, len:number, sp:number, ph:number, twist:number, spread:number}} Ribbon
 * @typedef {{img:HTMLCanvasElement, x:number, y:number, r:number, vy:number, sway:number, ph:number, tw:number}} Dot
 */

const TAU = Math.PI * 2;
const STRANDS = 9;
const STEP = 14; // CSS px between path points

const PAL = {
  dark: {
    rib: [['#22d3ee', '#a78bfa'], ['#f472b6', '#fbbf24'], ['#34d399', '#60a5fa']],
    dot: ['#67e8f9', '#c4b5fd', '#f9a8d4', '#fde68a', '#86efac'],
    line: 0.46, sheen: 0.07, dotA: 0.42,
  },
  light: {
    rib: [['#0891b2', '#7c3aed'], ['#db2777', '#d97706'], ['#059669', '#2563eb']],
    dot: ['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399'],
    line: 0.4, sheen: 0.06, dotA: 0.34,
  },
};

// y, tilt, amplitude as fractions of height; len = wavelength in widths; sp = rad/ms
/** @type {Ribbon[]} */
const RIBBONS = [
  { y: 0.16, tilt: 0.12, amp: 0.06, len: 1.25, sp: 0.0002, ph: 0.3, twist: 0.8, spread: 0.07 },
  { y: 0.54, tilt: -0.18, amp: 0.08, len: 0.95, sp: -0.00016, ph: 2.2, twist: 1.3, spread: 0.09 },
  { y: 0.86, tilt: 0.1, amp: 0.05, len: 1.5, sp: 0.00018, ph: 4.1, twist: 0.65, spread: 0.06 },
];

/** @param {string} hex '#rrggbb' @returns {string} 'r,g,b' */
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** A bokeh disc: flat soft body, slightly brighter rim, feathered edge.
 * @param {string} hex @returns {HTMLCanvasElement} */
function sprite(hex) {
  const s = 96, r = s / 2, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d'), col = rgb(hex);
  if (!g) return c;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `rgba(${col},0.55)`);
  grad.addColorStop(0.62, `rgba(${col},0.62)`);
  grad.addColorStop(0.8, `rgba(${col},0.85)`);
  grad.addColorStop(0.9, `rgba(${col},0.35)`);
  grad.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

/**
 * @param {HTMLElement} host positioned element the canvas fills
 * @param {BackgroundOptions} opts
 * @returns {() => void} stop: undoes everything start did
 */
export function start(host, opts) {
  const dark = opts.dark !== false;
  const reduced = !!opts.reducedMotion;
  const P = dark ? PAL.dark : PAL.light;
  // Seeded, so the dot field is the same every time.
  const rand = makeRng(7331).random;

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;

  const sprites = P.dot.map(sprite);
  /** @type {Dot[]} */
  const dots = [];
  for (let i = 0; i < 24; i++) {
    dots.push({
      img: sprites[i % sprites.length],
      x: rand(), y: rand(),
      r: 6 + 36 * rand() * rand(),     // mostly small, a few large
      vy: 0.000012 + 0.00002 * rand(), // heights per ms
      sway: 0.01 + 0.02 * rand(), ph: rand() * TAU, tw: 0.3 + 0.7 * rand(),
    });
  }

  let W = 1, H = 1, dpr = 1, n = 0, count = 10, t = 0;
  /** @type {CanvasGradient[]} */
  let grads = [];
  let ys = new Float32Array(0), top = new Float32Array(0);

  /** @param {Ribbon} r @param {number} s ms @param {number} u share of width
   * @param {number} off -0.5..0.5 across the ribbon @returns {number} */
  function strandY(r, s, u, off) {
    return H * (r.y + r.tilt * (u - 0.5))
      + H * r.amp * Math.sin((TAU * u) / r.len + s * r.sp + r.ph)
      + H * r.amp * 0.4 * Math.sin((TAU * u * 1.7) / r.len - s * r.sp * 1.4 + r.ph * 2)
      + off * H * r.spread * Math.sin(TAU * u * r.twist + s * r.sp * 0.7 + r.ph);
  }

  /** @returns {void} */
  function draw() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    const step = STEP * dpr;

    for (let k = 0; k < RIBBONS.length; k++) {
      const r = RIBBONS[k];
      ctx.strokeStyle = ctx.fillStyle = grads[k];
      // Sheen: fill between the outermost strands for a faint silk body.
      for (let i = 0; i < n; i++) {
        const x = i * step, u = x / W;
        top[i] = strandY(r, t, u, -0.5);
        ys[i] = strandY(r, t, u, 0.5);
      }
      ctx.globalAlpha = P.sheen;
      ctx.beginPath();
      ctx.moveTo(0, top[0]);
      for (let i = 1; i < n; i++) ctx.lineTo(i * step, top[i]);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(i * step, ys[i]);
      ctx.closePath();
      ctx.fill();

      ctx.lineWidth = dpr;
      for (let j = 0; j < STRANDS; j++) {
        const off = j / (STRANDS - 1) - 0.5;
        ctx.globalAlpha = P.line * (1 - Math.abs(off) * 1.1);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = i * step, y = strandY(r, t, x / W, off);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }

    if (dark) ctx.globalCompositeOperation = 'lighter';
    const span = H + 80 * dpr;
    for (let i = 0; i < count; i++) {
      const d = dots[i], rad = d.r * dpr;
      let y = (d.y * span - t * d.vy * span) % span;
      if (y < 0) y += span;
      const x = W * (d.x + d.sway * Math.sin(t * 0.0003 * d.tw + d.ph));
      ctx.globalAlpha = P.dotA * (0.55 + 0.45 * Math.sin(t * 0.0007 * d.tw + d.ph));
      ctx.drawImage(d.img, x - rad, y - rad - 40 * dpr, rad * 2, rad * 2);
    }
  }

  /** @returns {void} */
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    const cw = host.clientWidth || innerWidth, ch = host.clientHeight || innerHeight;
    const nw = Math.max(1, Math.round(cw * dpr)), nh = Math.max(1, Math.round(ch * dpr));
    if (nw === W && nh === H && cv.width === nw) return;
    W = cv.width = nw;
    H = cv.height = nh;
    n = Math.ceil(W / (STEP * dpr)) + 2;
    if (ys.length < n) {
      ys = new Float32Array(n);
      top = new Float32Array(n);
    }
    count = Math.max(10, Math.min(dots.length, Math.round((cw * ch) / 70000)));
    grads = P.rib.map(([a, b]) => {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      return g;
    });
    draw();
  }

  size();
  const stop = frameLoop(host, size, (dt) => { t += dt * 1000; draw(); }, reduced);
  return () => { stop(); cv.remove(); };
}
