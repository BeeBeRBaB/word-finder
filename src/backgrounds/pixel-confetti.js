// Pixel Confetti: pixel-art strips, squares, rings and squiggles falling and tumbling.
// Rasterised by hand into one reused buffer, so edges stay crisp.
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';

/** @typedef {{colors:string[], dark:boolean, reducedMotion:boolean}} BackgroundOptions */

const DARK = [[255, 107, 139], [255, 200, 87], [94, 230, 168], [76, 201, 240], [167, 139, 250], [255, 159, 90]];
const LIGHT = [[214, 58, 100], [201, 138, 0], [15, 153, 96], [27, 130, 196], [109, 79, 214], [217, 102, 31]];
const MAX = 56;
const KINDS = 6;
const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/** One RGBA pixel in the platform's byte order.
 * @param {number} r @param {number} g @param {number} b @param {number} a @returns {number} */
function pack(r, g, b, a) {
  return (LE ? ((a << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | a)) >>> 0;
}

/** Is (u, v), in the piece's own frame, inside a shape of radius s?
 * @param {number} kind @param {number} u @param {number} v @param {number} s @returns {boolean} */
function inside(kind, u, v, s) {
  const au = u < 0 ? -u : u, av = v < 0 ? -v : v;
  switch (kind) {
    case 0: return au <= s * 0.5 && av <= s; // strip
    case 1: return v <= s * 0.5 && v >= -s + 1.732 * au; // triangle
    case 2: return au <= s * 0.7 && av <= s * 0.7; // square
    case 3: { const d = u * u + v * v; return d <= s * s && d >= s * s * 0.3; } // ring
    case 4: return (au <= s * 0.34 && av <= s) || (av <= s * 0.34 && au <= s); // plus
    default: { const d = v - s * 0.38 * Math.sin((u / s) * 4.7); return au <= s && d <= s * 0.24 && d >= -s * 0.24; } // squiggle
  }
}

/** @param {HTMLElement} host @param {Partial<BackgroundOptions>} [opts] @returns {() => void} */
export function start(host, opts = {}) {
  const light = opts.dark === false;
  const pal = light ? LIGHT : DARK;
  const still = !!opts.reducedMotion;

  const layer = hostCanvas(host, true);
  if (!layer) return () => {};
  const { cv, ctx } = layer;

  // Colour table: [layer near/far][face front/back][palette index].
  const col = new Uint32Array(4 * pal.length);
  const aNear = light ? 150 : 165, aFar = light ? 80 : 90;
  pal.forEach(([r, g, b], i) => {
    const d = 0.78; // the back face is a darker shade
    col[i] = pack(r, g, b, aNear);
    col[pal.length + i] = pack(r * d | 0, g * d | 0, b * d | 0, aNear);
    col[2 * pal.length + i] = pack(r, g, b, aFar);
    col[3 * pal.length + i] = pack(r * d | 0, g * d | 0, b * d | 0, aFar);
  });

  const BX = new Float32Array(MAX), Y = new Float32Array(MAX), VY = new Float32Array(MAX);
  const SW = new Float32Array(MAX), SF = new Float32Array(MAX), PH = new Float32Array(MAX);
  const ROT = new Float32Array(MAX), VR = new Float32Array(MAX);
  const FL = new Float32Array(MAX), VF = new Float32Array(MAX), SZ = new Float32Array(MAX);
  const K = new Uint8Array(MAX), C = new Uint8Array(MAX), FAR = new Uint8Array(MAX);

  let S = 4, gw = 0, gh = 0, w = 0, h = 0, n = 0, seeded = 0;
  // Placeholders; resize() sizes them to the grid.
  let img = ctx.createImageData(1, 1), buf = new Uint32Array(img.data.buffer);
  let t = 0;

  /** @param {number} i @param {boolean} top @returns {void} */
  function seed(i, top) {
    const far = i % 3 === 0;
    FAR[i] = far ? 1 : 0;
    SZ[i] = far ? 1.6 + Math.random() * 0.8 : 2.8 + Math.random() * 2.4;
    BX[i] = Math.random() * gw;
    Y[i] = top ? -SZ[i] * 2 : Math.random() * gh;
    VY[i] = (far ? 1 : 1.8) + Math.random() * 1.6; // grid px per second
    SW[i] = 1 + Math.random() * 3;
    SF[i] = 0.25 + Math.random() * 0.5;
    PH[i] = Math.random() * 6.283;
    ROT[i] = Math.random() * 6.283;
    VR[i] = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.7);
    FL[i] = Math.random() * 6.283;
    VF[i] = 0.35 + Math.random() * 0.8;
    K[i] = far ? 4 : (Math.random() * KINDS) | 0; // far pieces are pixel sparkles
    C[i] = (Math.random() * pal.length) | 0;
  }

  /** @returns {void} */
  function resize() {
    const [nw, nh] = hostSize(host);
    if (nw === w && nh === h) return;
    w = nw; h = nh;
    S = w < 700 ? 3 : 4;
    const ngw = Math.max(1, Math.floor(w / S)), ngh = Math.max(1, Math.floor(h / S));
    if (gw && gh) for (let i = 0; i < seeded; i++) { BX[i] *= ngw / gw; Y[i] *= ngh / gh; }
    gw = ngw; gh = ngh;
    cv.width = gw; cv.height = gh;
    cv.style.width = gw * S + 'px';
    cv.style.height = gh * S + 'px';
    img = ctx.createImageData(gw, gh);
    buf = new Uint32Array(img.data.buffer);
    n = Math.max(18, Math.min(MAX, Math.round((w * h) / 22000)));
    while (seeded < n) seed(seeded++, false);
    draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    for (let i = 0; i < n; i++) {
      Y[i] += VY[i] * dt;
      ROT[i] += VR[i] * dt;
      FL[i] += VF[i] * dt;
      if (Y[i] > gh + SZ[i] * 2) seed(i, true);
    }
  }

  /** @returns {void} */
  function draw() {
    buf.fill(0);
    const np = pal.length;
    // Far layer first so the near pieces overwrite it where they overlap.
    for (let pass = 1; pass >= 0; pass--) {
      for (let i = 0; i < n; i++) {
        if (FAR[i] !== pass) continue;
        const s = SZ[i], k = K[i];
        // Snap to pixel centres so a piece steps across the grid rather than smearing.
        const cx = Math.floor(BX[i] + Math.sin(t * SF[i] + PH[i]) * SW[i]) + 0.5, cy = Math.floor(Y[i]) + 0.5;
        const a = pass ? 0 : ROT[i], co = Math.cos(a), si = Math.sin(a);
        const f = pass ? 1 : Math.cos(FL[i]);
        const fx = k === 4 ? 1 : Math.max(0.4, f < 0 ? -f : f); // tumbling squashes one axis
        const c = col[pass * 2 * np + (f < 0 ? np : 0) + C[i]];
        const r = Math.ceil(s * 1.15) + 1;
        const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(gw - 1, Math.ceil(cx + r));
        const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(gh - 1, Math.ceil(cy + r));
        for (let py = y0; py <= y1; py++) {
          const dy = py + 0.5 - cy, row = py * gw;
          for (let px = x0; px <= x1; px++) {
            const dx = px + 0.5 - cx;
            if (inside(k, (dx * co + dy * si) / fx, dy * co - dx * si, s)) buf[row + px] = c;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  resize();
  const stop = frameLoop(host, resize, (dt) => {
    t += dt;
    step(dt);
    draw();
  }, still);
  return () => { stop(); cv.remove(); };
}
