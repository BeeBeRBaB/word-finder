// Generates part54.json (round 4: hopscotch, trip-backpack, kid-computer, ramp-car, plant-cell, circuit-bulb).
import fs from 'node:fs';
const f = n => { const s = (Math.round(n * 10) / 10).toString(); return s === '-0' ? '0' : s; };
const P = (c, d, extra = '') => `<path class="${c}"${extra} d="${d}"/>`;
const C = (c, x, y, r) => `<circle class="${c}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
const E = (c, x, y, rx, ry, rot) => `<ellipse class="${c}" cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}"${rot ? ` transform="rotate(${rot} ${f(x)} ${f(y)})"` : ''}/>`;
const R = (c, x, y, w, h, r = 0, extra = '') => `<rect class="${c}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${r ? ` rx="${f(r)}"` : ''}${extra}/>`;
const L = (d, w) => `<path class="ln"${w ? ` stroke-width="${w}"` : ''} d="${d}"/>`;
// stadium between two points
const cap = (x1, y1, x2, y2, w) => {
  const r = w / 2, dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * r, ny = dx / l * r;
  return `M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}A${f(r)} ${f(r)} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)}L${f(x1 - nx)} ${f(y1 - ny)}A${f(r)} ${f(r)} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)}Z`;
};
const limb = (pts, w) => pts.slice(1).map((p, i) => cap(pts[i][0], pts[i][1], p[0], p[1], w)).join('');
// polygon with quadratic-rounded corners; rad number or array
const rpoly = (pts, rad) => {
  const n = pts.length; let d = '';
  for (let i = 0; i < n; i++) {
    const v = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], r = Array.isArray(rad) ? rad[i] : rad;
    const la = Math.hypot(a[0] - v[0], a[1] - v[1]), lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const ta = Math.min(r / la, .5), tb = Math.min(r / lb, .5);
    const p1 = [v[0] + (a[0] - v[0]) * ta, v[1] + (a[1] - v[1]) * ta], p2 = [v[0] + (b[0] - v[0]) * tb, v[1] + (b[1] - v[1]) * tb];
    d += `${i ? 'L' : 'M'}${f(p1[0])} ${f(p1[1])}Q${f(v[0])} ${f(v[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
};
const star = (cx, cy, R1, R2, n = 5, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? R2 : R1; return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
const spark = (x, y, s) => `M${f(x)} ${f(y - s)}Q${f(x)} ${f(y)} ${f(x + s)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y + s)}Q${f(x)} ${f(y)} ${f(x - s)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y - s)}Z`;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });
const pts = a => a.map(p => `${f(p[0])} ${f(p[1])}`);
const bar = (x, y, w, h = 2.4) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
const poly = a => 'M' + pts(a).join('L') + 'Z';
// rounded rect path (clockwise)
const rr = (x, y, w, h, r) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
// rotated ellipse path
const ell = (cx, cy, rx, ry, rot = 0) => {
  const a = rot * Math.PI / 180, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
  return `M${f(cx - dx)} ${f(cy - dy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx + dx)} ${f(cy + dy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx - dx)} ${f(cy - dy)}Z`;
};

// ---------- hopscotch
{
  let s = '';
  const yh = -98, K = 156, Kx = 25, cx = 32;
  const pr = (X, z) => [cx + X * Kx / z, yh + K / z];
  const D = {
    1: [[[.2, 1.3], [1.1, 0], [2.2, 0], [2.2, 5], [1.1, 5], [1.1, 1.8], [.7, 2.2]]],
    2: [[[0, 0], [3, 0], [3, 3], [1.1, 3], [1.1, 3.9], [3, 3.9], [3, 5], [0, 5], [0, 2], [1.9, 2], [1.9, 1.1], [0, 1.1]]],
    3: [[[0, 0], [3, 0], [3, 5], [0, 5], [0, 3.9], [1.9, 3.9], [1.9, 3], [.5, 3], [.5, 2], [1.9, 2], [1.9, 1.1], [0, 1.1]]],
    4: [[[0, 0], [1.1, 0], [1.1, 2], [1.9, 2], [1.9, 0], [3, 0], [3, 5], [1.9, 5], [1.9, 3.1], [0, 3.1]]],
    5: [[[3, 0], [0, 0], [0, 3], [1.9, 3], [1.9, 3.9], [0, 3.9], [0, 5], [3, 5], [3, 2], [1.1, 2], [1.1, 1.1], [3, 1.1]]],
    6: [[[0, 0], [3, 0], [3, 1.1], [1.1, 1.1], [1.1, 2], [3, 2], [3, 5], [0, 5]], [[1.1, 3], [1.9, 3], [1.9, 3.9], [1.1, 3.9]]],
  };
  const rows = [[[-.5, .5, 1]], [[-1, 0, 2], [0, 1, 3]], [[-.5, .5, 4]], [[-1, 0, 5], [0, 1, 6]]];
  const dz = .125, g = .055;
  let tiles = '', stone = [];
  rows.forEach((row, i) => {
    const z0 = 1 + i * dz, z1 = z0 + dz, za = z0 + .007 * z0 * z0, zb = z1 - .007 * z1 * z1;
    row.forEach(([x0, x1, n]) => {
      const a = x0 + g, b = x1 - g;
      tiles += poly([pr(a, za), pr(b, za), pr(b, zb), pr(a, zb)]);
      const zc = (za + zb) / 2, dw = .36, dh = .085;
      let xc = (a + b) / 2;
      if (n === 3) { xc -= .17; stone = pr(.74, zc); }
      for (const ring of D[n]) tiles += poly(ring.map(([gx, gy]) => pr(xc + (gx - 1.5) / 3 * dw, zc + (2.5 - gy) / 5 * dh)));
    });
  });
  s += P('t-a', tiles, ' fill-rule="evenodd"');
  // stone with a cut-out glint
  const [sx, sy] = stone;
  const gl = ell(sx - 1, sy - .9, 1.1, .6, -15);
  s += P('t-b', ell(sx, sy, 3.4, 2.4, -8) + gl, ' fill-rule="evenodd"');
  // chalk stick lying beside the grid
  s += P('t-a', cap(47, 56.5, 57.5, 51, 4.6));
  s += P('t-b', ell(57.5, 51, 1.6, 2.3, -28));
  s += P('t-c', ell(49.5, 53.6, 2.2, .7, -28));
  // chalk dust
  s += P('t-a', circ(43, 58.2, .9) + circ(45.5, 59.4, .7) + circ(40.8, 59, .6));
  s += P('t-c', spark(8, 10, 3.6) + spark(56.5, 9, 3) + spark(8.5, 52, 2.4));
  add('hopscotch', 'chalk hopscotch grid with numbered squares, a stone and chalk', s);
}

// ---------- trip-backpack
{
  let s = '';
  // folded map poking out (zig-zag panels)
  const mp = [[15.5, 9.5], [21.5, 6.5], [27, 9], [33, 6]];
  const yb = 23;
  let ml = '', md = '';
  for (let i = 0; i < 3; i++) {
    const q = poly([mp[i], mp[i + 1], [mp[i + 1][0] + .6, yb], [mp[i][0] + .6, yb]]);
    if (i % 2) md += q; else ml += q;
  }
  s += P('t-c', ml);
  s += P('t-b', md);
  s += L('M17.5 13.5L19.5 15.5M19.5 13.5L17.5 15.5M28.5 12Q30 15.5 29 18', 1.2);
  // lunch box poking out with handle
  s += L('M37.5 10.5V7.5Q41.5 4.5 45.5 7.5V10.5', 2.2);
  s += P('t-a', rr(34.5, 10, 14, 13, 2) + rr(39.5, 15, 4, 2.6, .8), ' fill-rule="evenodd"');
  s += P('t-b', 'M34.5 13.3H48.5V12Q48.5 10 46.5 10H36.5Q34.5 10 34.5 12Z');
  // water bottle
  s += P('t-a', rpoly([[9.5, 17.5], [12, 17.5], [13.5, 21], [13.5, 50], [7.5, 50], [7.5, 21]], [.6, .6, 1.5, 1, 1, 1.5]) + 'M9 25H10.5V36H9Z', ' fill-rule="evenodd"');
  s += P('t-b', rr(8.6, 13, 4.3, 5, 1.2));
  // bag body with front-pocket seam cut out
  const body = rpoly([[15.5, 21], [48.5, 21], [51, 59], [13, 59]], [10, 10, 3, 3]);
  const po = rpoly([[18.5, 35.5], [45.5, 35.5], [46.5, 56], [17.5, 56]], 4.5);
  const pi = rpoly([[19.8, 36.8], [44.2, 36.8], [45.1, 54.7], [18.9, 54.7]], 3.5);
  const badge = rpoly([[27, 26.5], [37, 26.5], [37, 31], [27, 31]], 1.2);
  s += P('t-a', body + po + pi + badge, ' fill-rule="evenodd"');
  // zip along the top, pocket zip and tab, base shade
  s += P('t-b', 'M17 24.5Q32 20.5 47 24.5L47.3 27Q32 23 16.7 27Z');
  s += P('t-b', rr(19.8, 36.8, 24.4, 3, 1.2) + rr(37.5, 38.5, 3, 6, 1.2));
  s += P('t-b', 'M19 51.5Q32 53 45 51.5L45.1 53Q45 54.7 43.5 54.7H20.5Q19 54.7 18.9 53Z');
  s += P('t-b', 'M13.3 55Q32 57.5 50.7 55L51 57Q51 59 49 59H15Q13 59 13 57Z');
  // side mesh pockets
  s += P('t-b', rpoly([[7, 36], [14.5, 34.5], [14, 56], [8, 55.5]], 2) + rpoly([[57, 36], [49.5, 34.5], [50, 56], [56, 55.5]], 2));
  s += P('t-c', spark(57, 9, 3.4) + spark(7, 6.5, 2.4));
  add('trip-backpack', 'school backpack with bottle, lunch box and map', s);
}

// ---------- kid-computer
{
  let s = '';
  // monitor with screen cut out and code inside
  s += P('t-a', rr(31, 7, 28.5, 27, 2.6) + rr(34, 10, 22.5, 21, 1), ' fill-rule="evenodd"');
  s += P('t-b', bar(36, 12.3, 9) + bar(39, 16.3, 11) + bar(39, 20.3, 6) + bar(46.5, 20.3, 6) + bar(42, 24.3, 8) + bar(36, 28.1, 6));
  s += P('t-c', bar(46.5, 12.3, 6) + bar(51.5, 16.3, 3) + bar(51.5, 24.3, 3));
  // stand, desk, keyboard
  s += P('t-b', 'M43 34H47.5L48.5 38.5H42Z' + rr(39, 37.8, 12.5, 2.2, 1) + rr(25, 40, 35, 3.5, 1.2) + rr(27, 43, 3, 16, 1));
  s += P('t-a', 'M28.5 38.2H38.3L38.8 40H28Z');
  // tower under the desk
  s += P('t-a', rr(46, 45.5, 11, 13.5, 1.6) + bar(48.3, 48, 6.4, 1.6) + bar(48.3, 51, 6.4, 1.6) + circ(51.5, 55.3, 1.3), ' fill-rule="evenodd"');
  // child: torso, head
  s += P('t-a', rpoly([[13, 31.5], [27, 31.5], [31, 52], [9, 52]], [6, 6, 2, 2]));
  s += P('t-a', circ(19.5, 20.5, 8.5));
  s += P('t-b', 'M14.5 13.5Q17 11 21 11.5Q18 14 18.5 17Q16 15 14.5 13.5Z');
  // headphones
  s += L('M12.5 22Q11 10 21 11.2Q28.5 12 28 20', 3);
  s += P('t-b', rr(9, 18, 6, 9, 2.6) + rr(26.4, 17.5, 3, 7, 1.4));
  // arm to keyboard
  s += P('t-b', limb([[25, 35.5], [28.5, 41], [33, 39.2]], 5));
  // chair
  s += P('t-b', rpoly([[8, 40], [26, 40], [27, 51], [7, 51]], 3) + rr(6.5, 51.5, 23, 3, 1.2) + 'M16.5 54.5H20V57.5H16.5Z');
  s += L('M10 58.3H27', 2.4);
  s += P('t-b', circ(9.7, 59.2, 1.6) + circ(27.3, 59.2, 1.6));
  s += P('t-c', spark(6.5, 7, 3.4));
  add('kid-computer', 'child with headphones coding at a desktop computer', s);
}

// ---------- ramp-car
{
  let s = '';
  const A = [5, 24], B = [53, 57], th = Math.atan2(B[1] - A[1], B[0] - A[0]), ux = Math.cos(th), uy = Math.sin(th), deg = th * 180 / Math.PI;
  const lx = 5, ly = A[1] + 3.6 / ux, bx = B[0] - 3.6 / uy;
  // plank with grain slits
  const gr = (s0, s1, o) => { const p = t => [A[0] + ux * t - uy * -o, A[1] + uy * t + ux * o]; const a = p(s0), b = p(s1), c = [b[0], b[1] + .8], d = [a[0], a[1] + .8]; return poly([a, b, c, d]); };
  s += P('t-a', poly([A, B, [bx, 57], [lx, ly]]) + gr(6, 18, 1.4) + gr(30, 44, 1.4), ' fill-rule="evenodd"');
  // wedge frame and floor
  const inr = [[9, ly + 9], [bx - 13, 53], [9, 53]];
  s += P('t-b', poly([[lx, ly + .6], [bx - .6, 57], [lx, 57]]) + poly(inr), ' fill-rule="evenodd"');
  s += P('t-b', rr(4, 56.6, 56, 3, 1.2));
  // car
  const sc = 1.12, s0 = 19.5, Q = [A[0] + ux * s0, A[1] + uy * s0];
  let c = '';
  const win = poly([[-6, -13.6], [-1.6, -13.6], [-1.6, -9.8], [-7.6, -9.8]]) + poly([[0, -13.6], [2.4, -13.6], [5, -9.8], [0, -9.8]]);
  c += P('t-a', rpoly([[-10.5, -3.2], [11, -3.2], [11.5, -8.6], [6, -9.6], [3, -15.6], [-6.5, -15.6], [-9.5, -9.8], [-11, -9]], [1.5, 1.5, 2, 1.5, 1.5, 1.5, 1, 1.2]) + win, ' fill-rule="evenodd"');
  c += P('t-b', 'M-10.6 -6H11.2L11 -4.4Q10.8 -3.2 9.5 -3.2H-9.4Q-10.6 -3.2 -10.6 -4.4Z');
  c += P('t-b', circ(-6, -3.6, 3.6) + circ(-6, -3.6, 1.3) + circ(6.5, -3.6, 3.6) + circ(6.5, -3.6, 1.3), ' fill-rule="evenodd"');
  c += P('t-c', rr(8, -8.4, 2.6, 1.6, .7));
  c += L('M-14 -7H-20M-15 -11H-24M-13 -15H-19', 1.8);
  s += `<g transform="translate(${f(Q[0])} ${f(Q[1])}) rotate(${f(deg)}) scale(${sc})">${c}</g>`;
  // dashed path arrow ahead of the car
  const loc = (x, y) => [Q[0] + (x * ux - y * uy) * sc, Q[1] + (x * uy + y * ux) * sc];
  const P0 = loc(14, -8.5), P1 = [P0[0] + ux * 12, P0[1] + uy * 12], P3 = [58.5, 50], P2 = [P3[0] - 9, P3[1]];
  const bz = t => [0, 1].map(k => (1 - t) ** 3 * P0[k] + 3 * (1 - t) ** 2 * t * P1[k] + 3 * (1 - t) * t * t * P2[k] + t ** 3 * P3[k]);
  const smp = Array.from({ length: 201 }, (_, i) => bz(i / 200)); let acc = 0; const al = [0];
  for (let i = 1; i < smp.length; i++) al.push(acc += Math.hypot(smp[i][0] - smp[i - 1][0], smp[i][1] - smp[i - 1][1]));
  const at = d => { let i = al.findIndex(v => v >= d); if (i < 0) i = smp.length - 1; return smp[i]; };
  let dd = '';
  for (let d = 0; d < acc - 1.5; d += 5.4) { const a = at(d), b = at(Math.min(d + 3, acc)); dd += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`; }
  s += L(dd + `M${f(P3[0] - 3.2)} ${f(P3[1] - 3.2)}L${f(P3[0] + .4)} ${f(P3[1])}L${f(P3[0] - 3.2)} ${f(P3[1] + 3.2)}`, 1.9);
  s += P('t-c', spark(55, 10, 3.6) + spark(44, 20, 2.4));
  add('ramp-car', 'toy car rolling down a wooden ramp with a path arrow', s);
}

// ---------- plant-cell
{
  let s = '';
  s += P('t-b', rr(4.5, 7.5, 55, 49, 11) + rr(9, 12, 46, 40, 7), ' fill-rule="evenodd"');
  const nuc = circ(40, 28, 9.2);
  const vac = rpoly([[14.5, 33], [23, 29.5], [30.5, 33.5], [31, 44.5], [23, 48], [15, 46]], 6);
  const ch = [[19.5, 20.5, -25], [29.5, 17.5, 12], [38, 44.5, 18], [48.5, 41.5, -32]];
  let holes = nuc + vac, gran = '';
  for (const [x, y, r] of ch) {
    holes += ell(x, y, 5, 2.9, r);
    const a = r * Math.PI / 180;
    for (const k of [-2.3, 0, 2.3]) gran += circ(x + k * Math.cos(a), y + k * Math.sin(a), 1);
  }
  s += P('t-a', rr(10.3, 13.3, 43.4, 37.4, 6) + holes, ' fill-rule="evenodd"');
  s += P('t-b', gran + circ(42.5, 30, 3.4) + circ(36, 24.5, 1.1) + circ(37, 32, .9));
  s += P('t-b', circ(15, 27, .9) + circ(33.5, 39, .9) + circ(47, 18, .9) + circ(27, 25, .8) + circ(49.5, 34, .8));
  s += P('t-c', spark(58.5, 4.5, 2.6) + spark(5, 59, 2.2));
  add('plant-cell', 'plant cell with wall, nucleus, chloroplasts and vacuole', s);
}

// ---------- circuit-bulb
{
  let s = '';
  // wires
  s += L('M27 31.5H9V52H17M37 31.5H42.5M52.5 31.5H55V52H48', 2.6);
  // rays
  let ry = '';
  for (const d of [-180, -150, -120, -90, -60, -30, 0]) { const a = d * Math.PI / 180; ry += `M${f(32 + 12 * Math.cos(a))} ${f(17.5 + 12 * Math.sin(a))}L${f(32 + 15 * Math.cos(a))} ${f(17.5 + 15 * Math.sin(a))}`; }
  s += L(ry, 2.4);
  // glow + glass with cut-out highlight
  s += P('t-c', circ(32, 17.5, 10.5));
  const hl = 'M26 15.5Q26.5 11.5 30.5 10.5Q28 13 28 16Q27 17 26 15.5Z';
  s += P('t-a', 'M27.5 28.5C27.5 24.5 23.2 22.5 23.2 17.5A8.8 8.8 0 1 1 40.8 17.5C40.8 22.5 36.5 24.5 36.5 28.5Z' + hl, ' fill-rule="evenodd"');
  s += L('M29.5 28V22L30.8 19.5L32 22L33.2 19.5L34.5 22V28', 1.4);
  // screw base with thread slits
  s += P('t-b', rr(27, 28, 10, 7.5, 1.4) + rr(27, 30.3, 10, .9, .4) + rr(27, 32.6, 10, .9, .4) + 'M30 35.5H34L33 37.5H31Z', ' fill-rule="evenodd"');
  // knife switch, closed
  s += P('t-b', rr(39.5, 34.2, 16, 3.2, 1.2));
  s += P('t-a', circ(42.5, 31.5, 2.3) + circ(52.5, 31.5, 2.3));
  s += P('t-a', cap(42.5, 30.6, 52.5, 30.6, 2.6));
  s += P('t-a', cap(51, 30.6, 51, 25.5, 3));
  // battery with + and - cut out
  const plus = poly([[37, 51], [38.7, 51], [38.7, 49.3], [40.3, 49.3], [40.3, 51], [42, 51], [42, 52.6], [40.3, 52.6], [40.3, 54.3], [38.7, 54.3], [38.7, 52.6], [37, 52.6]]);
  s += P('t-a', rr(17, 45.5, 28.5, 13, 2.4) + plus + rr(25.5, 51, 5, 1.6, .5), ' fill-rule="evenodd"');
  s += P('t-b', 'M19.4 45.5H22.5V58.5H19.4Q17 58.5 17 56.1V47.9Q17 45.5 19.4 45.5Z' + rr(45, 49, 3.3, 6, 1));
  s += P('t-c', spark(8, 9, 3.4) + spark(56, 10, 2.6));
  add('circuit-bulb', 'battery, switch and glowing bulb in a simple circuit', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part54.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
