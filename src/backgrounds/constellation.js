// Constellation: coloured stars drifting slowly, linked by fading lines when close,
// with the faintest low-poly fill wherever three of them form a triangle.
import { frameLoop, hostCanvas } from './frame-loop.js';

/** @typedef {{colors:string[], dark:boolean, reducedMotion:boolean}} BackgroundOptions */

const DARK = ['#ff6b8b', '#ffc857', '#5ee6a8', '#4cc9f0', '#a78bfa', '#ff9f5a'];
const LIGHT = ['#d63a64', '#c98a00', '#0f9960', '#1b82c4', '#6d4fd6', '#d9661f'];
const MAX = 80;

/**
 * @param {HTMLElement} host positioned element the canvas fills
 * @param {BackgroundOptions} opts
 * @returns {() => void} stop: undoes everything start did
 */
export function start(host, opts) {
  const pal = opts.dark === false ? LIGHT : DARK;
  const still = !!opts.reducedMotion;

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;

  // Flat typed arrays, allocated once: position, velocity, radius, colour, twinkle.
  const X = new Float32Array(MAX), Y = new Float32Array(MAX);
  const VX = new Float32Array(MAX), VY = new Float32Array(MAX);
  const R = new Float32Array(MAX), PH = new Float32Array(MAX), SP = new Float32Array(MAX);
  const C = new Uint8Array(MAX);
  const adj = new Float32Array(MAX * MAX); // link strength 0..1, upper triangle only

  let w = 0, h = 0, dpr = 1, n = 0, seeded = 0, link = 130, t = 0;

  /** @param {number} i @returns {void} */
  function seed(i) {
    X[i] = Math.random() * w;
    Y[i] = Math.random() * h;
    const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 9; // px per second
    VX[i] = Math.cos(a) * s;
    VY[i] = Math.sin(a) * s;
    R[i] = 1.3 + Math.random() * 1.7;
    PH[i] = Math.random() * 6.283;
    SP[i] = 0.6 + Math.random() * 1.4;
    C[i] = (Math.random() * pal.length) | 0;
  }

  /** @returns {void} */
  function resize() {
    const nw = host.clientWidth || window.innerWidth;
    const nh = host.clientHeight || window.innerHeight;
    if (nw === w && nh === h) return;
    if (w && h) for (let i = 0; i < seeded; i++) { X[i] *= nw / w; Y[i] *= nh / h; }
    w = nw; h = nh;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
    n = Math.max(26, Math.min(MAX, Math.round((w * h) / 16000) + 10)); // denser on small screens
    while (seeded < n) seed(seeded++);
    link = Math.max(110, Math.min(180, Math.min(w, h) * 0.22));
    draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    const m = 24;
    for (let i = 0; i < n; i++) {
      let x = X[i] + VX[i] * dt, y = Y[i] + VY[i] * dt;
      if (x < -m) x += w + 2 * m; else if (x > w + m) x -= w + 2 * m;
      if (y < -m) y += h + 2 * m; else if (y > h + m) y -= h + 2 * m;
      X[i] = x; Y[i] = y;
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const L2 = link * link;

    // Links: strength fades to zero at the link distance, so nothing pops in or out.
    for (let i = 0; i < n; i++) {
      const row = i * MAX;
      for (let j = i + 1; j < n; j++) {
        const dx = X[i] - X[j], dy = Y[i] - Y[j], d2 = dx * dx + dy * dy;
        adj[row + j] = d2 < L2 ? 1 - Math.sqrt(d2) / link : 0;
      }
    }

    // Low-poly fill: any mutually linked triple, capped so a dense cluster stays cheap.
    let tris = 0;
    for (let i = 0; i < n && tris < 80; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = adj[i * MAX + j];
        if (!a) continue;
        for (let q = j + 1; q < n; q++) {
          const b = adj[i * MAX + q], c = adj[j * MAX + q];
          if (!b || !c) continue;
          ctx.globalAlpha = Math.min(a, b, c) * 0.16;
          ctx.fillStyle = pal[C[q]];
          ctx.beginPath();
          ctx.moveTo(X[i], Y[i]); ctx.lineTo(X[j], Y[j]); ctx.lineTo(X[q], Y[q]);
          ctx.fill();
          if (++tris >= 80) break;
        }
        if (tris >= 80) break;
      }
    }

    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const row = i * MAX;
      for (let j = i + 1; j < n; j++) {
        const s = adj[row + j];
        if (!s) continue;
        ctx.globalAlpha = s * 0.42;
        ctx.strokeStyle = pal[C[i]];
        ctx.beginPath();
        ctx.moveTo(X[i], Y[i]);
        ctx.lineTo(X[j], Y[j]);
        ctx.stroke();
      }
    }

    // Stars: a soft halo plus a bright core, both twinkling gently.
    for (let i = 0; i < n; i++) {
      const tw = 0.65 + 0.35 * Math.sin(t * SP[i] + PH[i]);
      ctx.fillStyle = pal[C[i]];
      ctx.globalAlpha = 0.14 * tw;
      ctx.beginPath();
      ctx.arc(X[i], Y[i], R[i] * 3.2, 0, 6.283);
      ctx.fill();
      ctx.globalAlpha = (0.55 + 0.4 * tw);
      ctx.beginPath();
      ctx.arc(X[i], Y[i], R[i], 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize();
  const stop = frameLoop(host, resize, (dt) => {
    t += dt;
    step(dt);
    draw();
  }, still);
  return () => { stop(); cv.remove(); };
}
