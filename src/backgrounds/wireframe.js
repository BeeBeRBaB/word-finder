// Wireframe: 3D wireframe solids (cube, octahedron, icosahedron, dodecahedron, torus) turning
// slowly in perspective, each edge fainter the further back it lies, so the depth reads without
// shading. The seed picks the variant: a few solids of different kinds spread over the host, each
// on its own axis; two nested sets (icosahedron, cube, octahedron), one toward each end, each
// shell turning its own way; or a drift of many small solids floating slowly upward at different
// depths, the far ones smaller and fainter.

import { stage, TAU, clamp, mix } from './stage.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const BANDS = 4;   // depth steps of line alpha

/** @typedef {{v:number[][], e:number[][], dots:boolean}} Mesh unit-radius vertices, edges as vertex pairs */
/** @typedef {{mesh:Mesh, fx:number, fy:number, z:number, r:number, ax:number, ay:number, az:number,
 *   wx:number, wy:number, wz:number, c:number, rise:number}} Solid
 * fx, fy its centre as fractions of the host; z depth 0 near .. 1 far; a* its angles, w* their rates */

/** Vertices joined wherever two lie the shortest distance apart, as in every Platonic solid.
 * @param {number[][]} v @returns {Mesh} */
function platonic(v) {
  const r = Math.hypot(...v[0]);
  const u = v.map((p) => p.map((q) => q / r));
  let min = Infinity;
  for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) min = Math.min(min, dist(u[i], u[j]));
  /** @type {number[][]} */
  const e = [];
  for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) if (dist(u[i], u[j]) < min * 1.01) e.push([i, j]);
  return { v: u, e, dots: true };
}

/** @param {number[]} a @param {number[]} b @returns {number} */
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

/** All sign choices of a point's non-zero coordinates. @param {number[]} p @returns {number[][]} */
function signs(p) {
  /** @type {number[][]} */
  let out = [[]];
  for (const q of p) out = out.flatMap((o) => (q ? [[...o, q], [...o, -q]] : [[...o, 0]]));
  return out;
}

/** The three cyclic orders of a point's coordinates, with every sign. @param {number[]} p @returns {number[][]} */
function cyclic(p) {
  return [[p[0], p[1], p[2]], [p[1], p[2], p[0]], [p[2], p[0], p[1]]].flatMap(signs);
}

const CUBE = platonic(signs([1, 1, 1]));
const OCTA = platonic(cyclic([1, 0, 0]));
const ICOSA = platonic(cyclic([0, 1, PHI]));
const DODECA = platonic([...signs([1, 1, 1]), ...cyclic([0, 1 / PHI, PHI])]);
const TORUS = torus(16, 8, 0.32);

/** A torus of radius 1 to the tube's outer edge, as rings round and along the tube.
 * @param {number} nu @param {number} nv @param {number} tube @returns {Mesh} */
function torus(nu, nv, tube) {
  const R = 1 - tube;
  /** @type {number[][]} */
  const v = [], e = [];
  for (let i = 0; i < nu; i++) {
    const a = i / nu * TAU;
    for (let j = 0; j < nv; j++) {
      const b = j / nv * TAU, rr = R + tube * Math.cos(b);
      v.push([Math.cos(a) * rr, Math.sin(a) * rr, tube * Math.sin(b)]);
      e.push([i * nv + j, i * nv + (j + 1) % nv], [i * nv + j, ((i + 1) % nu) * nv + j]);
    }
  }
  return { v, e, dots: false };
}

const MESHES = [CUBE, ICOSA, TORUS, OCTA, DODECA];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout, colors } = s;
    /** @type {Solid[]} */
    let solids = [];
    let m = 0, built = false;
    // Scratch for one solid's projected vertices.
    const PX = new Float32Array(256), PY = new Float32Array(256), PZ = new Float32Array(256);

    /** @param {Mesh} mesh @param {number} fx @param {number} fy @param {number} z @param {number} r @returns {Solid} */
    function solid(mesh, fx, fy, z, r) {
      const rate = () => (0.08 + rng.random() * 0.16) * (rng.random() < 0.5 ? -1 : 1);
      return { mesh, fx, fy, z, r, ax: rng.random() * TAU, ay: rng.random() * TAU, az: rng.random() * TAU,
        wx: rate(), wy: rate(), wz: rate() * 0.5, c: rng.int(colors.length), rise: 0 };
    }

    function build() {
      solids = [];
      const area = s.W * s.H;
      if (layout === 1) {
        // Nested shells, largest outside, each turning its own way.
        // Two nested sets, one toward each end of the long side, clear of the board in the middle.
        const wide = s.W >= s.H;
        for (const [a, b] of [[0.17, 0.36], [0.83, 0.64]]) {
          const c0 = rng.int(colors.length);
          [ICOSA, CUBE, OCTA].forEach((mesh, i) => {
            const sd = solid(mesh, wide ? a : b, wide ? b : a, 0, [1, 0.66, 0.4][i]);
            sd.c = (c0 + i) % colors.length;
            solids.push(sd);
          });
        }
      } else if (layout === 2) {
        const n = clamp(Math.round(area / 70000), 10, 18);
        for (let i = 0; i < n; i++) {
          const sd = solid(MESHES[i % MESHES.length], rng.random(), rng.random(), rng.random(), 1);
          sd.rise = 0.012 + rng.random() * 0.01;
          solids.push(sd);
        }
      } else {
        // A few solids of different kinds on a jittered grid, so none sit on top of one another.
        const n = clamp(Math.round(area / 200000), 4, 6);
        const cols = Math.max(1, Math.round(Math.sqrt(n * s.W / s.H))), rows = Math.ceil(n / cols);
        const start = rng.int(MESHES.length);
        for (let i = 0; i < n; i++) {
          const fx = (i % cols + 0.25 + rng.random() * 0.5) / cols, fy = (Math.floor(i / cols) + 0.25 + rng.random() * 0.5) / rows;
          solids.push(solid(MESHES[(start + i) % MESHES.length], fx, fy, 0, 0.8 + rng.random() * 0.4));
        }
      }
    }

    /** Projects and strokes one solid, its edges banded by depth. @param {Solid} sd */
    function drawSolid(sd) {
      const { ctx } = s;
      const { mesh } = sd;
      // Size: by variant; in the drift, far ones smaller.
      const base = layout === 1 ? clamp(Math.min(Math.max(s.W, s.H) * 0.17, m * 0.42), 70, 320) : layout === 2 ? clamp(m * 0.09, 28, 70) : clamp(m * 0.17, 55, 150);
      const R = base * sd.r * (layout === 2 ? mix(1.15, 0.5, sd.z) : 1);
      const cx = sd.fx * s.W, cy = layout === 2 ? mix(-0.1, 1.1, sd.fy) * s.H : sd.fy * s.H;
      const cX = Math.cos(sd.ax), sX = Math.sin(sd.ax), cY = Math.cos(sd.ay), sY = Math.sin(sd.ay), cZ = Math.cos(sd.az), sZ = Math.sin(sd.az);
      const cam = 3.2;
      for (let i = 0; i < mesh.v.length; i++) {
        let [x, y, z] = mesh.v[i];
        let t = y * cX - z * sX; z = y * sX + z * cX; y = t;
        t = x * cY + z * sY; z = -x * sY + z * cY; x = t;
        t = x * cZ - y * sZ; y = x * sZ + y * cZ; x = t;
        const k = cam / (cam + z);
        PX[i] = cx + x * R * k; PY[i] = cy + y * R * k; PZ[i] = z;
      }
      const far = layout === 2 ? mix(1, 0.45, sd.z) : layout === 1 ? 0.8 : 1;
      const A = (s.dark ? 0.55 : 0.6) * far;
      ctx.strokeStyle = colors[sd.c];
      ctx.lineWidth = clamp(R * 0.012, 1, 1.8) * (layout === 1 ? 1 : 1.15);
      for (let b = 0; b < BANDS; b++) {
        ctx.beginPath();
        for (const [i, j] of mesh.e) {
          // z runs -1 (near) .. 1 (far); band 0 is the back.
          const zz = (PZ[i] + PZ[j]) / 2, band = Math.min(BANDS - 1, Math.floor((1 - zz) / 2 * BANDS));
          if (band !== b) continue;
          ctx.moveTo(PX[i], PY[i]); ctx.lineTo(PX[j], PY[j]);
        }
        ctx.globalAlpha = A * (0.18 + 0.82 * b / (BANDS - 1));
        ctx.stroke();
      }
      if (mesh.dots) {
        // Vertices as small beads, the front ones brighter.
        ctx.fillStyle = colors[sd.c];
        const d = clamp(R * 0.035, 1.5, 3.2);
        for (let i = 0; i < mesh.v.length; i++) {
          ctx.globalAlpha = A * (0.3 + 0.7 * (1 - PZ[i]) / 2);
          ctx.fillRect(PX[i] - d / 2, PY[i] - d / 2, d, d);
        }
      }
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        // Solids sit at fractions of the host, so a resize keeps them where they were.
        if (!built) { build(); built = true; }
      },
      step(dt) {
        for (const sd of solids) {
          sd.ax += sd.wx * dt; sd.ay += sd.wy * dt; sd.az += sd.wz * dt;
          if (sd.rise) {
            // Far ones rise slower, as they would seen from here.
            sd.fy -= sd.rise * mix(1, 0.5, sd.z) * dt;
            if (sd.fy < 0) { sd.fy += 1; sd.fx = rng.random(); }
          } else if (layout === 0) {
            sd.fy += Math.sin(s.t * 0.4 + sd.ax * 0.1) * 0.0015 * dt;
          }
        }
      },
      draw() {
        s.ctx.lineCap = 'round';
        if (layout === 2) solids.sort((a, b) => b.z - a.z);
        for (const sd of solids) drawSolid(sd);
      },
    };
  });
}
