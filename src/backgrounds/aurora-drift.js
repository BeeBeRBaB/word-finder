// Aurora Drift: large soft colour blobs on slow Lissajous paths, stretched and turning.
// Drawn at 1/6 resolution so the browser's upscale does the blurring.

/** @typedef {{colors:string[], dark:boolean, reducedMotion:boolean}} BackgroundOptions */

/** @type {{name:string, style:'pixel'|'modern', animated:boolean}} */
export const meta = { name: 'Aurora Drift', style: 'modern', animated: true };

const DARK = ['#14b8a6', '#8b5cf6', '#ec4899', '#0ea5e9', '#f59e0b', '#6366f1'];
const LIGHT = ['#5eead4', '#c4b5fd', '#f9a8d4', '#7dd3fc', '#fcd34d', '#a5b4fc'];
const SCALE = 6; // CSS px per canvas px
const FRAME = 1000 / 30;
const SPEED = 0.0001; // radians per ms at frequency 1 (~60s loop)
const TAU = Math.PI * 2;

/** Seeded [0, 1) generator, so the blob layout is the same every visit.
 * @param {number} seed @returns {() => number} */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {string} hex '#rrggbb' @returns {string} 'r,g,b' */
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
}

/** One pre-rendered blob per colour: a gaussian-ish falloff with no visible rim.
 * @param {string} hex @returns {HTMLCanvasElement} */
function sprite(hex) {
  const s = 128, r = s / 2, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  if (!g) return c;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  const col = rgb(hex);
  for (let i = 0; i <= 10; i++) {
    const x = i / 10;
    grad.addColorStop(x, `rgba(${col},${(Math.exp(-4 * x * x) * (1 - x * x)).toFixed(3)})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

/** @param {HTMLElement} host @param {Partial<BackgroundOptions>} [opts] @returns {() => void} */
export function start(host, opts = {}) {
  const dark = opts.dark !== false;
  const reduced = !!opts.reducedMotion;
  const rand = rng(20240926);
  /** @param {number} a @param {number} b @returns {number} */
  const span = (a, b) => a + (b - a) * rand();

  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  const st = cv.style;
  st.position = 'absolute';
  st.inset = '0';
  st.width = '100%';
  st.height = '100%';
  st.display = 'block';
  st.pointerEvents = 'none';
  host.appendChild(cv);
  const c2d = cv.getContext('2d');
  if (!c2d) return () => cv.remove();
  // Aliased: narrowing does not reach the hoisted functions below.
  const ctx = c2d;

  const blobs = (dark ? DARK : LIGHT).map((c, i) => ({
    img: sprite(c),
    // Anchors spread round the edges so colour pools around the board, not just under it.
    ax: 0.5 + 0.34 * Math.cos((i / 6) * TAU + 0.4),
    ay: 0.5 + 0.34 * Math.sin((i / 6) * TAU + 0.4),
    rx: span(0.12, 0.24), ry: span(0.1, 0.22),
    fx: span(0.55, 1.1), fy: span(0.5, 1.0),
    px: span(0, TAU), py: span(0, TAU),
    size: span(0.6, 0.9), aspect: span(1.3, 2.1),
    rot: span(0, TAU), spin: span(-0.35, 0.35),
    alpha: dark ? span(0.38, 0.52) : span(0.45, 0.6),
  }));

  let w = 1, h = 1, raf = 0, last = 0, t = span(0, 60000);

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    const m = Math.max(w, h), s = t * SPEED;
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const x = w * (b.ax + b.rx * Math.sin(s * b.fx + b.px));
      const y = h * (b.ay + b.ry * Math.sin(s * b.fy + b.py));
      const d = m * b.size * (1 + 0.15 * Math.sin(s * 1.6 * b.fy + b.px));
      const a = b.rot + s * b.spin;
      const cs = Math.cos(a), sn = Math.sin(a);
      // rotate(a) * scaleX(aspect): an ellipse that slowly turns as it drifts
      ctx.setTransform(cs * b.aspect, sn * b.aspect, -sn, cs, x, y);
      ctx.globalAlpha = b.alpha;
      ctx.drawImage(b.img, -d / 2, -d / 2, d, d);
    }
  }

  /** @returns {void} */
  function size() {
    const W = host.clientWidth || window.innerWidth, H = host.clientHeight || window.innerHeight;
    const nw = Math.max(1, Math.ceil(W / SCALE)), nh = Math.max(1, Math.ceil(H / SCALE));
    if (nw !== w || nh !== h || cv.width !== nw) {
      w = cv.width = nw;
      h = cv.height = nh;
      draw();
    }
  }

  /** @param {number} now @returns {void} */
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = now - last;
    if (dt < FRAME - 3) return;
    last = now;
    t += Math.min(dt, 100);
    draw();
  }

  /** @returns {void} */
  function play() {
    if (reduced || raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  /** @returns {void} */
  function pause() {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  const onVis = () => (document.hidden ? pause() : play());

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null;
  if (ro) ro.observe(host);
  window.addEventListener('resize', size);
  document.addEventListener('visibilitychange', onVis);
  size();
  draw();
  play();

  return function stop() {
    pause();
    if (ro) ro.disconnect();
    window.removeEventListener('resize', size);
    document.removeEventListener('visibilitychange', onVis);
    cv.remove();
  };
}
