// Generates part46.json (round 4).
import fs from 'node:fs';
const f = n => { const s = (Math.round(n * 10) / 10).toString(); return s === '-0' ? '0' : s; };
const P = (c, d, extra = '') => `<path class="${c}"${extra} d="${d}"/>`;
const C = (c, x, y, r) => `<circle class="${c}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
const E = (c, x, y, rx, ry, rot) => `<ellipse class="${c}" cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}"${rot ? ` transform="rotate(${rot} ${f(x)} ${f(y)})"` : ''}/>`;
const R = (c, x, y, w, h, r = 0, extra = '') => `<rect class="${c}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${r ? ` rx="${f(r)}"` : ''}${extra}/>`;
const L = (d, w) => `<path class="ln"${w ? ` stroke-width="${w}"` : ''} d="${d}"/>`;
const EO = ' fill-rule="evenodd"';
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
// rotated ellipse as a path
const ell = (cx, cy, rx, ry, rot = 0) => {
  const a = rot * Math.PI / 180, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
  return `M${f(cx - dx)} ${f(cy - dy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx + dx)} ${f(cy + dy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx - dx)} ${f(cy - dy)}Z`;
};
// ---- polygon geometry (for cut-outs)
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join(' ') + 'Z';
const area = pts => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
// keep the side of line a->b where sign*cross >= 0
const clipHalf = (pts, a, b, sign) => {
  const side = p => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], sp = side(p), sq = side(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
};
// subject ∩ convex clip
const clip = (subj, cl) => { const s = Math.sign(area(cl)); let o = subj; for (let i = 0; i < cl.length && o.length; i++) o = clipHalf(o, cl[i], cl[(i + 1) % cl.length], s); return o; };
// convex A minus convex B -> convex pieces
const diff = (A, B) => {
  const s = Math.sign(area(B)), out = []; let rest = A;
  for (let i = 0; i < B.length && rest.length > 2; i++) {
    const a = B[i], b = B[(i + 1) % B.length];
    const outside = clipHalf(rest, a, b, -s); if (outside.length > 2 && Math.abs(area(outside)) > .4) out.push(outside);
    rest = clipHalf(rest, a, b, s);
  }
  return out;
};
// convex A minus convex B as one polygon when B crosses A's boundary twice; else convex pieces
const inConvex = (p, B) => { const s = Math.sign(area(B)); return B.every((a, i) => { const b = B[(i + 1) % B.length]; return s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) > 0; }); };
const segX = (p, q, a, b) => {
  const r = [q[0] - p[0], q[1] - p[1]], s2 = [b[0] - a[0], b[1] - a[1]], d = r[0] * s2[1] - r[1] * s2[0]; if (Math.abs(d) < 1e-9) return null;
  const t = ((a[0] - p[0]) * s2[1] - (a[1] - p[1]) * s2[0]) / d, u = ((a[0] - p[0]) * r[1] - (a[1] - p[1]) * r[0]) / d;
  return t > 0 && t <= 1 && u >= 0 && u < 1 ? t : null;
};
const sub = (A, B) => {
  const seq = [];
  A.forEach((p, i) => {
    const q = A[(i + 1) % A.length]; seq.push({ p, x: false });
    const xs = [];
    B.forEach((a, j) => { const t = segX(p, q, a, B[(j + 1) % B.length]); if (t !== null) xs.push({ t, j }); });
    xs.sort((m, n) => m.t - n.t).forEach(({ t, j }) => seq.push({ p: [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], x: true, j }));
  });
  const X = seq.map((e, k) => e.x ? k : -1).filter(k => k >= 0);
  if (!X.length) return inConvex(A[0], B) ? [] : B.some(b => inConvex(b, A)) ? diff(A, B) : [A];
  if (X.length !== 2) return diff(A, B);
  const n = seq.length;
  // find the crossing after which A runs outside B
  let k0 = X[0], k1 = X[1];
  const mid = seq[(k0 + 1) % n];
  const outAfter0 = !(mid.x ? false : inConvex(mid.p, B));
  if (!outAfter0) [k0, k1] = [k1, k0];
  const out = [];
  for (let k = k0; ; k = (k + 1) % n) { out.push(seq[k].p); if (k === k1) break; }
  // walk B from edge of k1 to edge of k0 via vertices inside A
  const j1 = seq[k1].j, j0 = seq[k0].j, m = B.length;
  const fwd = [], bwd = [];
  for (let j = (j1 + 1) % m; j !== (j0 + 1) % m; j = (j + 1) % m) fwd.push(B[j]);
  for (let j = j1; j !== j0; j = (j - 1 + m) % m) bwd.push(B[j]);
  const chain = fwd.every(b => inConvex(b, A)) && (fwd.length <= bwd.length || !bwd.every(b => inConvex(b, A))) ? fwd : bwd;
  return [out.concat(chain)];
};
const hull = pts => {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
};
const grow = (pts, m) => hull(pts.flatMap(([x, y]) => Array.from({ length: 6 }, (_, k) => [x + m * Math.cos(k * Math.PI / 3), y + m * Math.sin(k * Math.PI / 3)])));
// rounded polygon sampled to points
const rpts = (pts, r, seg = 3) => {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const v = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], rr = Array.isArray(r) ? r[i] : r;
    const la = Math.hypot(a[0] - v[0], a[1] - v[1]), lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const ta = Math.min(rr / la, .5), tb = Math.min(rr / lb, .5);
    const p1 = [v[0] + (a[0] - v[0]) * ta, v[1] + (a[1] - v[1]) * ta], p2 = [v[0] + (b[0] - v[0]) * tb, v[1] + (b[1] - v[1]) * tb];
    for (let k = 0; k <= seg; k++) { const t = k / seg; out.push([(1 - t) ** 2 * p1[0] + 2 * t * (1 - t) * v[0] + t * t * p2[0], (1 - t) ** 2 * p1[1] + 2 * t * (1 - t) * v[1] + t * t * p2[1]]); }
  }
  return out;
};
const rot = (pts, cx, cy, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); };
const arcPts = (cx, cy, r, a0, a1, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- picnic-blanket
{
  let s = '';
  const BL = [12.5, 23], BR = [51.5, 23], FR = [60, 50], FL = [4, 50];
  const sv = v => .6 * v / (1 - .4 * v);
  const at = (u, v) => { const t = sv(v), l = [BL[0] + (FL[0] - BL[0]) * t, BL[1] + (FL[1] - BL[1]) * t], r = [BR[0] + (FR[0] - BR[0]) * t, BR[1] + (FR[1] - BR[1]) * t]; return [l[0] + (r[0] - l[0]) * u, l[1] + (r[1] - l[1]) * u]; };
  const blanket = [BL, BR, FR, FL];
  // objects
  // sandwich: back slice, lettuce, front slice
  const front = rpts([[5.5, 48.5], [22, 46.5], [9.5, 32]], 2.2, 1);
  const lettuce = front.map(([x, y]) => [x + 2.4, y - 2.2]);
  const back = front.map(([x, y]) => [x + 4.6, y - 4.2]);
  // watermelon slice
  const wc = [34.5, 37.5], wr = -9;
  const wm = r => rot(arcPts(wc[0], wc[1], r, 0, 180, 6), wc[0], wc[1], wr);
  // bottle
  const bx = 46.5;
  const bottleOut = [[bx - 5, 17.5], [bx + 5, 17.5], [bx + 5, 34.5], [bx - 5, 34.5]];
  const holes = [grow(back.concat(front), 1.1), grow(wm(11.2), 1.1), grow(bottleOut, 1.1)];
  // blanket body with cut-outs, checks minus cut-outs
  s += P('t-a', poly(blanket) + holes.map(h => poly(clip(h, blanket))).join(''), EO);
  let ch = '';
  const NU = 6, NV = 4;
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) if ((i + j) % 2 === 0) {
    let pieces = [[at(i / NU, j / NV), at((i + 1) / NU, j / NV), at((i + 1) / NU, (j + 1) / NV), at(i / NU, (j + 1) / NV)]];
    for (const h of holes) pieces = pieces.flatMap(pc => pc.length > 2 && Math.abs(area(pc)) > .3 ? sub(pc, h) : []);
    ch += pieces.map(poly).join('');
  }
  s += P('t-b', ch);
  // front edge thickness and fringe
  s += P('t-b', 'M4 50.8H60L59.6 53.4Q59.5 54 58.9 54H5.1Q4.5 54 4.4 53.4Z');
  // grass: back tufts and front tufts
  const tuft = (x, y, h) => poly([[x - 3.2, y], [x - 2.4, y - h * .7], [x - 1, y - h * .3], [x, y - h], [x + 1, y - h * .3], [x + 2.4, y - h * .7], [x + 3.2, y]]);
  s += P('t-b', tuft(7.5, 23, 6) + tuft(15.5, 22.5, 3.5) + tuft(57.5, 23, 6) + tuft(10, 60, 4.5) + tuft(32, 60, 4.5) + tuft(54, 60, 4.5));
  // sandwich
  const bk = diff(back, front), lt = diff(lettuce, front);
  s += P('t-a', bk.map(poly).join(''));
  s += P('t-b', lt.map(poly).join(''));
  const inner = front.map(([x, y]) => [x + (12.3 - x) * .3, y + (42.3 - y) * .3]);
  s += P('t-a', poly(front) + poly(inner), EO);
  s += P('t-c', poly(inner));
  // watermelon: green rind, pale rind, flesh with seeds
  const half = r => `M${f(wc[0] - r)} ${wc[1]}A${r} ${r} 0 0 0 ${f(wc[0] + r)} ${wc[1]}Z`;
  let w = P('t-b', half(11) + half(9), EO) + P('t-c', half(8.9) + half(7.4), EO) + P('t-a', half(7.3));
  w += P('t-b', [[30, 40], [34.5, 41.5], [39, 40], [32, 44], [37, 44]].map(([x, y]) => `M${x} ${y - 1.6}l1 1.6-1 1.6-1-1.6Z`).join(''));
  s += `<g transform="rotate(${wr} ${wc[0]} ${wc[1]})">${w}</g>`;
  // bottle with label hole
  const label = `M${bx - 5} 23H${bx + 5}V28.5H${bx - 5}Z`;
  s += P('t-a', `M${f(bx - 2.2)} 7.5H${f(bx + 2.2)}V11L${f(bx + 4.2)} 15Q${bx + 5} 16.5 ${bx + 5} 18.5V32Q${bx + 5} 34.5 ${f(bx + 2.5)} 34.5H${f(bx - 2.5)}Q${bx - 5} 34.5 ${bx - 5} 32V18.5Q${bx - 5} 16.5 ${f(bx - 4.2)} 15L${f(bx - 2.2)} 11Z` + label, EO);
  s += P('t-c', label);
  s += P('t-b', `M${f(bx - 2.8)} 6H${f(bx + 2.8)}V9.4H${f(bx - 2.8)}Z` + `M${bx + 2.4} 18V23H${bx + 4.9}V18.5Q${bx + 4.9} 17 ${f(bx + 4.2)} 16Z` + `M${bx + 2.4} 28.5V34.4Q${bx + 4.9} 34 ${bx + 4.9} 31.5V28.5Z`);
  s += P('t-c', spark(9, 9, 3.5) + spark(24, 6, 2.4));
  add('picnic-blanket', 'checked picnic blanket on grass with sandwich, watermelon and bottle', s);
}

// ---------- cheering-figure
{
  let s = '';
  // streamers (curly ribbons)
  s += L('M10 46Q4 42 7.5 37.5T7 29Q5 25 9 22', 2.4);
  s += L('M54 46Q60 42 56.5 37.5T57 29Q59 25 55 22', 2.4);
  s += L('M23 5Q20 1.5 17 4', 2);
  // figure silhouette
  const arms = limb([[28, 25], [21.5, 16.5], [15.5, 9]], 5.2) + limb([[36, 25], [42.5, 16.5], [48.5, 9]], 5.2);
  const legs = limb([[29, 39], [21.5, 46], [24, 54]], 5.6) + limb([[35, 39], [42.5, 46], [40, 54]], 5.6);
  s += P('t-a', arms + legs + circ(15, 8.3, 3.4) + circ(49, 8.3, 3.4));
  const smile = 'M28.8 15.6Q32 15 35.2 15.6Q34.8 19.4 32 19.4Q29.2 19.4 28.8 15.6Z';
  s += P('t-a', circ(32, 14, 6) + smile, EO);
  s += P('t-c', smile);
  s += P('t-a', rpoly([[25.5, 22.5], [38.5, 22.5], [37.2, 40], [26.8, 40]], [3, 3, 2, 2]));
  // hair, eyes
  s += P('t-b', 'M26 13.5Q25.8 7.8 32 7.8Q38.2 7.8 38 13.5Q35.5 10.8 32 11.6Q28.5 10.8 26 13.5Z');
  s += P('t-b', circ(29.6, 13.3, .9) + circ(34.4, 13.3, .9));
  // shorts, belt shade, shoes
  s += P('t-b', rpoly([[26.6, 35], [37.4, 35], [38.6, 41.5], [32.8, 42.5], [32, 40.5], [31.2, 42.5], [25.4, 41.5]], 1));
  s += P('t-b', 'M26 22.5H38L38.1 25Q32 27 25.9 25Z');
  s += P('t-b', ell(22.5, 55.2, 3.6, 2.2, 8) + ell(41.5, 55.2, 3.6, 2.2, -8));
  // ground shadow
  s += P('t-b', ell(32, 60.2, 8, 1.4));
  // stars and confetti
  s += P('t-a', poly(star(8.5, 14, 4.6, 2)) + poly(star(56, 14, 4.3, 1.9)) + poly(star(53, 54, 3.5, 1.5)) + poly(star(11.5, 55, 3.1, 1.4)));
  s += P('t-b', rpoly([[44, 30], [47.5, 29], [48, 31], [44.5, 32]], .4) + rpoly([[16, 30], [19.5, 31], [19, 33], [15.5, 32]], .4) + circ(46, 39, 1.2) + circ(18, 40, 1.2) + circ(32, 4, 1.2) + circ(40, 4.5, 1));
  add('cheering-figure', 'person jumping with arms up amid streamers and stars', s);
}

// ---------- sewing-machine
{
  let s = '';
  // spool on top
  s += P('t-b', 'M29 4.8H39V6.8H29ZM29 10.2H39V12.2H29Z');
  s += P('t-a', 'M30.4 6.8H37.6V10.2H30.4Z');
  s += L('M31.5 8.5H36.5', 1);
  // body: arm, pillar, head; logo slot
  const body = [[9, 12], [53, 12], [53, 44], [39, 44], [39, 27], [23, 27], [23, 37], [9, 37]];
  const slot = 'M26.5 16.8H36.5Q37.8 16.8 37.8 18.1Q37.8 19.4 36.5 19.4H26.5Q25.2 19.4 25.2 18.1Q25.2 16.8 26.5 16.8Z';
  s += P('t-a', rpoly(body, [4.5, 4.5, 1, 1, 3, 3, 2, 2]) + slot, EO);
  s += P('t-c', slot);
  // undersides and shading
  s += P('t-b', 'M23.5 24H38.5V27H23.5ZM9.2 33H22.8V35.5Q22.8 37 21.3 37H10.7Q9.2 37 9.2 35.5Z');
  s += P('t-b', 'M49.5 30H53V44H49.5Z');
  // thread from spool down to needle
  s += L('M30.5 8.5Q24 8.5 21 12.5', 1.2);
  s += L('M18.5 15V28', 1.2);
  // needle bar, needle, presser foot
  s += P('t-b', 'M14.6 37H18.4V41.6H14.6Z');
  s += L('M16.5 41.6V46.4', 1.4);
  s += P('t-b', 'M12 42.2H15.5V44.6H11.2Q10.6 44.6 11 44Z');
  // dial on pillar
  s += P('t-b', circ(45, 35.5, 3.2) + 'M44.4 31.4H45.6V35H44.4Z', EO);
  // hand wheel (in front of the arm)
  s += P('t-b', circ(51.5, 20, 7.8) + circ(51.5, 20, 5.2), EO);
  s += P('t-b', circ(51.5, 20, 2) + cap(51.5, 20, 51.5, 15.6, 1.6) + cap(51.5, 20, 55.3, 22.2, 1.6) + cap(51.5, 20, 47.7, 22.2, 1.6));
  // the ring: outer minus inner via separate path
  // bed: top face and front, right of the fabric
  s += P('t-a', 'M33 44.5H57Q58.5 44.5 58.8 46L59 47.5H33Z');
  s += P('t-b', 'M33 47.5H59V51.5Q59 53 57.5 53H33Z');
  s += P('t-b', 'M39 53H44V55.5H39ZM51 53H56V55.5H51Z');
  // fabric on the bed draping over the front-left
  s += P('t-c', 'M5 44.5H33V53H21Q20.5 56 18.5 57.5Q15 56 12 57.6Q8.5 56.2 5.2 57Q6 52 5 47.5Z');
  s += L('M5.6 47.6H33M21 53Q19.5 50.5 21 47.6', 1);
  s += L('M6.5 46H8M9.5 46H11M12.5 46H14', 1.2);
  s += P('t-c', spark(57, 6, 3.2) + spark(8, 6.5, 2.4));
  add('sewing-machine', 'classic sewing machine side-on with spool, hand wheel and stitched fabric', s);
}

// ---------- laundry-basket
{
  let s = '';
  // folded shirts behind the rim
  const shirt = (x0, x1, y0, y1) => rpoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [2, 2, 0, 0]);
  const collar = (cx, y0) => `M${f(cx - 4)} ${f(y0)}L${f(cx)} ${f(y0 + 4)}L${f(cx + 4)} ${f(y0)}Z`;
  s += P('t-c', shirt(10.5, 32.5, 19.5, 31) + shirt(16.5, 37, 11, 19.3));
  s += L('M18 19.6L21.5 23.6L25 19.6M21.5 23.6V30M14.5 21.5V30M28.5 21.5V30', 1.1);
  s += L('M23 11.2L26.8 15L30.6 11.2M26.8 15V19M20 13V19M33.5 13V19', 1.1);
  const cB = collar(40, 21.5);
  s += P('t-a', shirt(29, 51, 21.5, 31) + cB, EO);
  s += P('t-c', cB);
  s += P('t-b', 'M32.4 23.5H34V31H32.4ZM46 23.5H47.6V31H46Z');
  s += P('t-b', circ(40, 27.5, .9));
  // basket
  const rim = rpts([[6.5, 29], [57.5, 29], [57.5, 34], [6.5, 34]], 2.2, 2);
  const body = rpts([[8.5, 33], [55.5, 33], [51.5, 58], [12.5, 58]], [0, 0, 3, 3], 2);
  const sock = rpts([[37.5, 28.4], [44.8, 28.4], [44.8, 42], [50.5, 43], [52.5, 46.2], [50.5, 49.4], [42, 49.4], [37.5, 46]], [1, 1, 2, 2.5, 2.5, 2.5, 3, 3], 2);
  const inSock = (x, y) => clip([[x, y], [x + .01, y], [x, y + .01]], sock).length > 0;
  let slots = '';
  const handles = [[11, 36.5, 7.5], [45.5, 36.5, 7.5]];
  const rows = [41, 45.5, 50];
  rows.forEach((y, k) => {
    const xl = 8.5 + (y - 33) * .16 + 2.5, xr = 55.5 - (y - 33) * .16 - 2.5;
    for (let x = xl + (k % 2 ? 3 : 0); x + 4 <= xr; x += 6) {
      const pts = [[x, y], [x + 4, y], [x + 4, y + 1.8], [x, y + 1.8]];
      if (pts.some(p => inSock(...p)) || clip(pts, sock).length) continue;
      slots += `M${f(x)} ${y}h4v1.8h-4Z`;
    }
  });
  const hs = handles.map(([x, y, w]) => rpoly([[x, y], [x + w, y], [x + w, y + 3], [x, y + 3]], 1.5)).join('');
  s += P('t-a', poly(body) + poly(clip(sock, body)) + hs + slots, EO);
  // bottom band (cut around nothing: sock stops above it)
  s += P('t-b', 'M12.9 53.5H51.1L50.4 56Q50 58 48 58H16Q14 58 13.6 56Z');
  s += P('t-b', poly(rim) + poly(clip(sock, rim)), EO);
  s += L('M10 31.5H36M46.5 31.5H54', 1);
  // sock hanging over the rim
  s += P('t-c', poly(sock));
  s += P('t-b', 'M37.6 32H44.7V34H37.6ZM37.6 35.6H44.7V36.8H37.6ZM48 43.4Q51.3 43.6 52.4 46.2Q51.6 48.8 48.6 49.4Q50 46.4 48 43.4Z');
  // bubbles
  const bub = (x, y, r) => L(circ(x, y, r), 1.4) + L(`M${f(x - r * .55)} ${f(y - r * .1)}Q${f(x - r * .5)} ${f(y - r * .5)} ${f(x - r * .1)} ${f(y - r * .55)}`, 1.1);
  s += P('t-c', circ(7.5, 15, 3.6) + circ(55, 12, 4) + circ(13.5, 6.5, 2.2) + circ(58.5, 22.5, 2));
  s += bub(7.5, 15, 3.6) + bub(55, 12, 4) + L(circ(13.5, 6.5, 2.2), 1.2) + L(circ(58.5, 22.5, 2), 1.2);
  add('laundry-basket', 'woven laundry basket overflowing with folded shirts and a sock', s);
}

// ---------- balloon-bunch
{
  let s = '';
  const knot = [32, 51];
  const balloons = [[32, 13, 7.6, 9, 0], [16, 21, 7.2, 8.6, -14], [48, 21, 7.2, 8.6, 14], [22.5, 35.5, 6.4, 7.8, -8], [41.5, 35.5, 6.4, 7.8, 8]];
  // strings
  let st = '';
  for (const [cx, cy, rx, ry, r] of balloons) {
    const a = r * Math.PI / 180, bx = cx - Math.sin(a) * (ry + 2), by = cy + Math.cos(a) * (ry + 2);
    const mx = (bx + knot[0]) / 2, my = (by + knot[1]) / 2;
    st += `M${f(bx)} ${f(by)}Q${f(mx + 3)} ${f(my - 2)} ${f(mx)} ${f(my)}T${f(knot[0])} ${f(knot[1])}`;
  }
  s += L(st, 1.3);
  for (const [cx, cy, rx, ry, r] of balloons) {
    const a = r * Math.PI / 180, sn = Math.sin(a), cs = Math.cos(a);
    const P2 = (u, v) => [cx + u * cs - v * sn, cy + u * sn + v * cs];
    const [k1, k2, k3] = [P2(0, ry - .5), P2(-2, ry + 2.2), P2(2, ry + 2.2)];
    const shine = ell(...P2(-rx * .45, -ry * .4), 1.6, 3.2, r + 25);
    s += P('t-a', ell(cx, cy, rx, ry, r) + shine, EO);
    s += P('t-c', shine);
    s += P('t-a', poly([k1, k3, k2]));
    // shade crescent lower right
    const p0 = P2(rx * .95, -ry * .2), p1 = P2(-rx * .35, ry * .92), pc = P2(rx * .55, ry * .65);
    s += P('t-b', `M${f(p0[0])} ${f(p0[1])}A${f(rx)} ${f(ry)} ${f(r)} 0 1 ${f(p1[0])} ${f(p1[1])}Q${f(pc[0])} ${f(pc[1])} ${f(p0[0])} ${f(p0[1])}Z`);
  }
  // bow and ribbon tails
  const loopL = 'M32 52Q24 45 22.5 50.5Q22 55.5 32 52Z', loopR = 'M32 52Q40 45 41.5 50.5Q42 55.5 32 52Z';
  s += P('t-a', loopL + loopR + 'M32 52L27 60.5L29.8 59.4L31.5 61.3L32.2 53.5Z' + 'M32 52L37 60.5L34.2 59.4L32.5 61.3L31.8 53.5Z' + 'M26 50.2Q28.5 50.6 30.2 52Q27.6 53.2 25.4 52.4Q24.8 51 26 50.2Z' + 'M38 50.2Q35.5 50.6 33.8 52Q36.4 53.2 38.6 52.4Q39.2 51 38 50.2Z', EO);
  s += P('t-b', circ(32, 52, 2.3));
  s += P('t-c', spark(6, 6, 3.4) + spark(57, 6.5, 2.6) + spark(9, 47, 2.6));
  add('balloon-bunch', 'bunch of five balloons on curly strings tied with a bow', s);
}

// ---------- helping-hand
{
  let s = '';
  // mitten in local coords: fingertip at 0,0, wrist at y=19, cuff below after a 1.5 gap
  const mitten = c => P(c, 'M6.5 19L7.5 8Q8 0 0 0Q-8 0 -7.5 8L-6.5 19Z' + cap(-3.5, 15.5, -12, 11, 5.5));
  const cuff = rpoly([[-8.2, 20.5], [8.2, 20.5], [8.2, 25.5], [-8.2, 25.5]], 1.5);
  // helper's hand comes down from the top right, the other reaches up from the bottom left
  s += `<g transform="translate(32.8 31.1) rotate(220) scale(1.1)">${mitten('t-a')}${P('t-b', cuff)}</g>`;
  s += `<g transform="translate(31.2 32.9) rotate(40) scale(1.1)">${mitten('t-b')}${P('t-a', cuff)}</g>`;
  // heart above, sparkles
  s += P('t-a', 'M14 25Q4.5 18.5 4.5 12.2Q4.5 6.5 9.5 6.5Q12.5 6.5 14 9.6Q15.5 6.5 18.5 6.5Q23.5 6.5 23.5 12.2Q23.5 18.5 14 25Z');
  s += P('t-b', 'M8 11.5Q8.4 9.4 10.4 9.2Q9.3 10.5 9.6 12.4Z');
  s += P('t-c', spark(54, 50, 3.4) + spark(46, 58, 2.2) + spark(27, 7, 2.2));
  add('helping-hand', 'hand reaching down to a hand reaching up, with a heart above', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part46.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
