// Letter bubbles: soap bubbles with a letter inside drift up, wobble, and pop.
// Each bubble owns one small sprite canvas, repainted only when it respawns.
import { frameLoop, hostCanvas } from './frame-loop.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean}} BackgroundOptions
 * @typedef {{
 *   spr:HTMLCanvasElement, r:number, vy:number, depth:number, x0:number, wa:number, wf:number,
 *   ph:number, y0:number, y:number, popY:number, pop:number, ch:string, ci:number, half:number,
 * }} Bubble
 */

const DARK = ['#ff7aa2', '#ffb35c', '#ffe46b', '#6ee7b7', '#67c8ff', '#b79cff'];
const LIGHT = ['#d63f73', '#d8701a', '#b08a00', '#169a68', '#1a82c8', '#7250d6'];
const LETTERS = 'AAABCDEEEEFGHIIIJKLMNNOOOPQRRSSSTTTUUVWXYZ';

/** Every field is overwritten by spawn() before the first draw.
 * @returns {Bubble} */
function bubble() {
  return {
    spr: document.createElement('canvas'), r: 0, vy: 0, depth: 0, x0: 0, wa: 0, wf: 0,
    ph: 0, y0: 0, y: 0, popY: 0, pop: 0, ch: 'A', ci: 0, half: 0,
  };
}

/**
 * @param {HTMLElement} host positioned element the canvas fills
 * @param {BackgroundOptions} opts
 * @returns {() => void} stop: undoes everything start did
 */
export function start(host, opts) {
  const dark = opts.dark !== false;
  const pal = dark ? DARK : LIGHT;
  const reduced = !!opts.reducedMotion;
  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {Bubble[]} */
  const parts = [];
  let W = 0, H = 0, dpr = 1, n = 0, t = 0;
  /** @param {number} a @param {number} b @returns {number} */
  const rnd = (a, b) => a + Math.random() * (b - a);

  /** @param {Bubble} p @returns {void} */
  function paint(p) {
    const R = p.r * dpr, size = Math.ceil(R * 2 + 6 * dpr), m = size / 2;
    const s = p.spr, c = s.getContext('2d'), col = pal[p.ci];
    p.half = m / dpr;
    if (!c) return;
    if (s.width !== size) s.width = s.height = size; else c.clearRect(0, 0, size, size);
    // Soap film: clear in the middle, tinted towards the rim.
    const g = c.createRadialGradient(m, m, R * 0.35, m, m, R);
    g.addColorStop(0, col + '00');
    g.addColorStop(1, col + (dark ? '38' : '30'));
    c.fillStyle = g;
    c.beginPath(); c.arc(m, m, R, 0, 7); c.fill();
    c.lineWidth = 1.4 * dpr;
    c.strokeStyle = col + (dark ? 'b0' : '99');
    c.stroke();
    // Iridescence: a second hue swept along the lower-right rim.
    c.strokeStyle = pal[(p.ci + 2) % pal.length] + (dark ? '90' : '80');
    c.lineWidth = 2 * dpr; c.lineCap = 'round';
    c.beginPath(); c.arc(m, m, R - 1.6 * dpr, 0.1, 1.5); c.stroke();
    // Highlight glint hugging the upper-left rim.
    c.strokeStyle = dark ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.95)';
    c.lineWidth = 1.6 * dpr;
    c.beginPath(); c.arc(m, m, R * 0.8, 3.7, 4.25); c.stroke();
    c.fillStyle = col + (dark ? 'cc' : 'bb');
    c.font = `700 ${Math.round(R * 1.05)}px 'Space Grotesk',system-ui,sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(p.ch, m, m + R * 0.06);
  }

  /** @param {Bubble} p @param {boolean} seed true on (re)size: place anywhere, already visible
   * @returns {void} */
  function spawn(p, seed) {
    const d = Math.random();               // depth: small bubbles are far, slow, faint
    p.r = 11 + d * 22;
    p.vy = 10 + d * 22;
    p.depth = 0.45 + d * 0.55;
    p.x0 = rnd(0, W);
    p.wa = rnd(6, 18); p.wf = rnd(0.5, 1.2); p.ph = rnd(0, 6.3);
    p.y0 = seed ? rnd(0, H + p.r) : H + p.r + rnd(0, 60);
    p.y = p.y0;
    if (seed) p.y0 += 200;                  // already faded in
    p.popY = Math.min(rnd(-p.r * 2, H * 0.55), p.y - 60);
    p.pop = 0;
    p.ch = LETTERS[(Math.random() * LETTERS.length) | 0];
    p.ci = (Math.random() * pal.length) | 0;
    paint(p);
  }

  /** @returns {void} */
  function resize() {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    const d = Math.min(3, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr && n) return;
    const sx = w / W, sy = h / H, repaint = d !== dpr, was = n;
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    n = Math.max(12, Math.min(46, Math.round(W * H / 32000)));
    while (parts.length < n) parts.push(bubble());
    // The field carries on across a resize, stretched to the new box: re-rolling it made every
    // rotation or window drag jump. Only bubbles it gains are new.
    for (let i = 0; i < n; i++) {
      const p = parts[i];
      if (i >= was) { spawn(p, true); continue; }
      const dy = p.y * (sy - 1);
      p.x0 *= sx; p.y += dy; p.y0 += dy; p.popY *= sy;
      if (repaint) paint(p);
    }
    draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    for (let i = 0; i < n; i++) {
      const p = parts[i];
      p.y -= p.vy * dt;
      if (p.pop > 0 || p.y < p.popY) {
        p.pop += dt / 0.5;
        if (p.pop >= 1) spawn(p, false);
      }
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const base = dark ? 0.7 : 0.75;
    for (let i = 0; i < n; i++) {
      const p = parts[i];
      const x = p.x0 + Math.sin(t * p.wf + p.ph) * p.wa;
      let a = Math.min(1, (p.y0 - p.y) / 120) * p.depth * base;
      let k = 1;
      if (p.pop > 0) { k = 1 + p.pop * 0.35; a *= 1 - p.pop; }
      if (a <= 0.01) continue;
      const h = p.half * k;
      ctx.globalAlpha = a;
      ctx.drawImage(p.spr, (x - h) * dpr, (p.y - h) * dpr, 2 * h * dpr, 2 * h * dpr);
    }
    ctx.globalAlpha = 1;
  }

  if (!reduced) t = rnd(0, 20);
  resize();   // which paints the first frame
  const stop = frameLoop(host, resize, (dt) => {
    step(dt);
    draw();
  }, reduced);
  return () => { stop(); cv.remove(); parts.length = 0; };
}
