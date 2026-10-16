// Generates part49.json (round 4: home furnishing and trades heroes).
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
const spark = (x, y, s) => `M${f(x)} ${f(y - s)}Q${f(x)} ${f(y)} ${f(x + s)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y + s)}Q${f(x)} ${f(y)} ${f(x - s)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y - s)}Z`;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const rect = (x, y, w, h) => `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
// water drop: pointed top at (cx, top), round bottom of radius r
const drop = (cx, top, r) => `M${f(cx)} ${f(top)}Q${f(cx + r * 1.05)} ${f(top + r * 1.3)} ${f(cx + r)} ${f(top + r * 2)}A${f(r)} ${f(r)} 0 1 1 ${f(cx - r)} ${f(top + r * 2)}Q${f(cx - r * 1.05)} ${f(top + r * 1.3)} ${f(cx)} ${f(top)}Z`;
const qb = (a, c, b, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });
// catmull-rom through control points
const crs = (pts, n = 8) => { const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  out.push(pts[pts.length - 1]); return out; };
// thick band along a polyline
const tube = (pts, w) => { const l = [], r = [];
  pts.forEach((p, i) => { const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, nx = -dy / m * w / 2, ny = dx / m * w / 2;
    l.push([p[0] + nx, p[1] + ny]); r.push([p[0] - nx, p[1] - ny]); });
  return poly(l.concat(r.reverse())); };

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- chest-of-drawers
{
  let s = '';
  // lamp
  s += P('t-a', rpoly([[15.5, 5.5], [24.5, 5.5], [28.5, 15], [11.5, 15]], 1.2));
  s += R('t-b', 11, 13.6, 18, 2, 1);
  s += R('t-b', 19, 15.6, 2.2, 5.6);
  s += P('t-b', 'M14.5 23Q14.5 20.6 20.1 20.6Q25.7 20.6 25.7 23Z');
  // picture frame with a little landscape
  const pic = rect(40, 9.5, 9, 9.5);
  s += P('t-a', rpoly([[37, 6.5], [52, 6.5], [52, 23], [37, 23]], 1.4) + pic, ' fill-rule="evenodd"');
  s += P('t-c', pic);
  s += P('t-b', 'M40 19L43.3 14L45.6 16.8L46.9 15.3L49 18V19Z' + circ(46.6, 12.2, 1.2));
  // top slab with a highlight groove
  const gl = rect(12, 24.2, 30, 1);
  s += P('t-a', rpoly([[9, 23], [55, 23], [55, 27.5], [9, 27.5]], 1) + gl, ' fill-rule="evenodd"');
  s += P('t-c', gl);
  // carcass
  s += R('t-a', 11, 27, 42, 28);
  // sock hanging out of the open top drawer
  const sock = rpoly([[17.5, 28.4], [23.6, 28.4], [23.6, 35.3], [21.6, 38.8], [15, 38.8], [13.2, 36.8], [14.6, 34.8], [17.5, 34.2]], [.6, .6, 1.5, 1.5, 1.8, 1.5, 1, 1]);
  // drawer interior (dark) and the pulled-out front
  s += P('t-b', rect(11, 27.5, 42, 3) + sock, ' fill-rule="evenodd"');
  s += P('t-a', rpoly([[9.5, 30.5], [54.5, 30.5], [54.5, 40], [9.5, 40]], 1) + sock, ' fill-rule="evenodd"');
  s += P('t-c', sock);
  s += P('t-b', rect(17.5, 31.4, 6.1, 1.3) + 'M13.4 36.6L14.6 34.9L16.4 34.7V38.8H15Z');
  s += L(sock, 1);
  // shadow under the open drawer, gap between the lower drawers, plinth and feet
  s += P('t-b', rect(11, 40, 42, 1.6) + rect(11, 47.6, 42, 1.2));
  s += P('t-b', rpoly([[10, 54.5], [54, 54.5], [54, 57], [10, 57]], .8) + poly([[12, 56.5], [16.5, 56.5], [15.6, 59.5], [12.8, 59.5]]) + poly([[47.5, 56.5], [52, 56.5], [51.2, 59.5], [48.4, 59.5]]));
  // grain and knobs
  s += L('M37 44.2Q41 43.6 46 44.4M16 51.6Q20 51 25 51.8M39 36.8Q43 36.2 48 37', 1);
  s += P('t-b', circ(32, 35.2, 2.3) + circ(32, 44.6, 2) + circ(32, 51.6, 2));
  s += P('t-c', spark(6, 9, 3) + spark(58, 11, 2.5));
  add('chest-of-drawers', 'chest of drawers, open drawer with a sock, lamp and picture on top', s);
}

// ---------- wallpaper-roll
{
  let s = '';
  const dia = (x, y, h) => poly([[x, y - h], [x + h * .8, y], [x, y + h], [x - h * .8, y]]);
  // roll body with diamond pattern
  let rh = '';
  for (const x of [12, 19.5, 27, 34]) rh += dia(x, 10.5, 2.4);
  const core = ell(41, 10.5, 1.1, 2.1);
  s += P('t-a', 'M7.5 5H41A3.3 5.5 0 0 1 41 16H7.5A3.3 5.5 0 0 1 7.5 5Z' + rh + core, ' fill-rule="evenodd"');
  s += P('t-c', rh);
  s += P('t-b', ell(41, 10.5, 3.3, 5.5) + core, ' fill-rule="evenodd"');
  s += P('t-c', core);
  // hanging strip
  let sh = '', dots = '';
  for (const [y, xs] of [[23, [14, 22, 30]], [31, [18, 26]], [39, [14, 22, 30]], [47, [18, 26]]]) for (const x of xs) sh += dia(x, y, 2.8);
  for (const [y, xs] of [[23, [18, 26]], [31, [14, 22, 30]], [39, [18, 26]], [47, [14, 22, 30]]]) for (const x of xs) dots += circ(x, y, .9);
  s += P('t-a', rect(9.5, 16, 25, 35.5) + sh, ' fill-rule="evenodd"');
  s += P('t-c', sh);
  s += P('t-b', rect(9.5, 16, 25, 2));
  // curled-up bottom showing the back of the paper
  s += P('t-b', rpoly([[9.5, 50], [34.5, 50], [34.5, 56], [9.5, 56]], [0, 0, 3, 3]));
  s += L('M12 53.2H32', 1);
  // pasting brush, bristles down-left as if mid-stroke
  {
    let b = '';
    b += P('t-a', cap(0, -16, 0, -7, 4));
    b += P('t-b', rpoly([[-7.5, -7.5], [7.5, -7.5], [7.5, -3], [-7.5, -3]], 1));
    b += P('t-a', rpoly([[-7.5, -3], [7.5, -3], [7.5, 5.5], [-7.5, 5.5]], [0, 0, 1.2, 1.2]));
    b += P('t-b', rect(-3.6, -2.2, 1.1, 6.6) + rect(-.55, -2.2, 1.1, 6.6) + rect(2.5, -2.2, 1.1, 6.6));
    s += `<g transform="translate(48 25) rotate(38)">${b}</g>`;
  }
  // paste bucket
  s += L('M39.5 45Q40 34 49 34Q58 34 58.5 45', 1.6);
  s += P('t-a', 'M39 45L41.2 57.6Q41.5 59.3 43.2 59.3H54.8Q56.5 59.3 56.8 57.6L59 45A10 3 0 0 1 39 45Z');
  s += P('t-b', ell(49, 45, 10, 3) + ell(49, 45, 8.2, 1.9), ' fill-rule="evenodd"');
  s += P('t-c', ell(49, 45, 8.2, 1.9));
  s += P('t-b', rect(40.6, 53, 16.8, 1.6));
  s += P('t-c', spark(55, 7, 3));
  add('wallpaper-roll', 'roll of patterned wallpaper unrolled down a wall, pasting brush and paste bucket', s);
}

// ---------- curtains
{
  let s = '';
  const mx = pts => pts.map(([x, y]) => [64 - x, y]);
  const seg1 = qb([26, 14], [24, 29], [15, 36.5], 7), seg2 = qb([15, 36.5], [17, 44], [22, 54], 6);
  const inner = seg1.concat(seg2.slice(1));
  const xIn = y => { let best = inner[0]; for (const p of inner) if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p; return best[0]; };
  // scallops: Q bumps 8 wide between x0 and x0+8, dir +1 left-to-right
  const scal = (from, to, y, dy) => { let d = ''; const st = to > from ? 8 : -8; for (let x = from; x !== to; x += st) d += `Q${f(x + st / 2)} ${f(y + dy)} ${f(x + st)} ${f(y)}`; return d; };
  // glass between the drapes, top following the pelmet scallops
  const sideTB = inner.filter(p => p[1] > 17.5 && p[1] < 54);
  const glass = 'M24 15.5' + scal(24, 40, 15.5, 6.4) + poly(mx(sideTB).concat([[42, 54], [22, 54]], sideTB.slice().reverse())).replace(/^M/, 'L');
  const glint = poly([[36.5, 22], [39, 22], [35.5, 30], [33, 30]]) + poly([[25.4, 40], [26.6, 40], [24, 46], [22.8, 46]]);
  s += P('t-c', glass + glint, ' fill-rule="evenodd"');
  // glazing bars and bottom rail
  s += P('t-b', rect(31, 17, 2, 35) + rect(xIn(34.5) + .5, 33.5, 64 - 2 * xIn(34.5) - 1, 2) + rect(21.8, 50.6, 20.4, 3.4));
  // drapes
  const drape = 'M7 14L26 14Q24 29 15 36.5Q17 44 22 54L6.5 54Q8.5 41 9.5 37Q8 24 7 14Z';
  const drapeR = 'M57 14L38 14Q40 29 49 36.5Q47 44 42 54L57.5 54Q55.5 41 54.5 37Q56 24 57 14Z';
  s += P('t-a', drape) + P('t-a', drapeR);
  const folds = [[[11.6, 15], [13.6, 15], [13.3, 26], [12.2, 35]], [[17.5, 15], [19.8, 15], [17.5, 27], [13.6, 35]], [[11.2, 39], [12.2, 39], [12.6, 47], [12.8, 53.6]], [[13.8, 39], [14.6, 39], [16.2, 47], [18.4, 53.6]]];
  let fd = '';
  for (const k of [0, 1]) for (const [a, b, c, d] of folds) {
    const m = k ? (p => [64 - p[0], p[1]]) : (p => p);
    const [A, B, Cc, D] = [a, b, c, d].map(m);
    fd += `M${f(A[0])} ${f(A[1])}L${f(B[0])} ${f(B[1])}Q${f(Cc[0])} ${f(Cc[1])} ${f(D[0])} ${f(D[1])}Q${f((A[0] + D[0]) / 2 - (B[0] - A[0]) * .3)} ${f((A[1] + D[1]) / 2)} ${f(A[0])} ${f(A[1])}Z`;
  }
  s += P('t-b', fd);
  // tiebacks with tassels
  s += P('t-b', cap(6.5, 36.8, 16.2, 36.8, 3.4) + cap(57.5, 36.8, 47.8, 36.8, 3.4));
  s += P('t-b', poly([[7.2, 38], [9.2, 38], [10, 44], [6.4, 44]]) + poly([[56.8, 38], [54.8, 38], [54, 44], [57.6, 44]]));
  // shadow under the pelmet, then the pelmet with its scalloped edge
  s += P('t-b', 'M8 15.5' + scal(8, 56, 15.5, 6.4) + 'V17.2' + scal(56, 8, 17.2, 6.4) + 'Z');
  s += P('t-a', 'M8 9.5H56V15.5' + scal(56, 8, 15.5, 6.4) + 'Z');
  s += P('t-b', rect(8, 11.6, 48, 1.2));
  // rod and finials
  s += P('t-b', cap(10, 6.8, 54, 6.8, 2.2));
  s += P('t-a', circ(6.4, 6.8, 2.4) + circ(57.6, 6.8, 2.4));
  // sill
  s += P('t-b', rpoly([[5.5, 54], [58.5, 54], [58.5, 57.6], [5.5, 57.6]], 1));
  add('curtains', 'window with drapes held by tiebacks, curtain rod with finials, scalloped pelmet', s);
}

// ---------- plumber
{
  let s = '';
  // dripping pipe elbow, top left
  const hl = rect(5.5, 8.2, 2, 1.1);
  s += P('t-a', 'M4.5 7H6A6.5 6.5 0 0 1 12.5 13.5V18H6.5V13.5A.5 .5 0 0 0 6 13H4.5Z' + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += R('t-b', 5.8, 17.5, 7.4, 2.7, .6);
  const dh = 'M8.4 27.6Q8.2 26.3 9 25.6';
  s += P('t-a', drop(9.5, 22.5, 2.7));
  s += L(dh, 1);
  // shirt with the overall bib cut out of it
  const bib = poly([[16.5, 59.5], [16.5, 43], [17.6, 43], [16.4, 32.6], [20.4, 32.4], [21.6, 43], [30.4, 43], [31.6, 32.4], [35.6, 32.6], [34.4, 43], [35.5, 43], [35.5, 59.5]]);
  const shirt = rpoly([[7.5, 59.5], [8, 42], [10.5, 35], [16, 31.6], [36, 31.6], [40.5, 34.5], [42, 40], [42, 59.5]], [.5, 3, 4, 2, 2, 4, 3, .5]);
  s += P('t-b', shirt + bib, ' fill-rule="evenodd"');
  s += P('t-b', cap(38.5, 35.5, 43.3, 42, 7.4));
  const btn = circ(18.9, 45.2, 1.1) + circ(33.1, 45.2, 1.1);
  s += P('t-a', bib + btn, ' fill-rule="evenodd"');
  s += P('t-c', btn);
  s += R('t-b', 21, 47.5, 10, 5.5, 1);
  s += L('M14 43V59.5M26 55V59.5', 1.2);
  // head, cap, face
  const badge = drop(26, 13.7, 1.4);
  s += P('t-a', circ(26, 22, 8.5) + badge, ' fill-rule="evenodd"') + P('t-a', circ(17.6, 23.5, 2) + circ(34.4, 23.5, 2));
  s += P('t-b', 'M17.2 19.4Q17 11 26 10.8Q35 11 34.8 19.4Z' + badge, ' fill-rule="evenodd"');
  s += P('t-c', badge);
  s += P('t-b', 'M15 18.6Q26 16.4 37 18.6Q38.6 20.8 36.4 21.1Q26 19.4 15.6 21.1Q13.4 20.8 15 18.6Z');
  s += P('t-b', circ(22.6, 24.4, 1.2) + circ(29.4, 24.4, 1.2) + 'M20.4 27.8Q23 25.8 26 27.2Q29 25.8 31.6 27.8Q30 29.8 26 28.6Q22 29.8 20.4 27.8Z');
  // hand and pipe wrench
  s += P('t-a', circ(48.4, 47, 3.7));
  s += P('t-b', cap(49, 57, 49, 28.9, 5));
  s += P('t-a', rpoly([[45.2, 20.8], [52.8, 20.8], [52.8, 26.4], [45.2, 26.4]], 1.4));
  s += L('M47.2 21.6V25.6M49 21.6V25.6M50.8 21.6V25.6', 1);
  s += P('t-b', 'M46.6 5L57.4 5Q59 5 59 6.6V9.6L57.8 10.6L56.6 9.6L55.4 10.6L54.2 9.6L53 10.6L51.8 9.6L51 10.2V15.6L51.8 15L53 16L54.2 15L55.4 16L56.6 15L57.8 16L59 15V20.2H46.6Z');
  s += L('M42.6 44.5Q44.6 47 45 49.5', 1);
  s += P('t-c', spark(58, 55, 3) + spark(40, 7, 2.4));
  add('plumber', 'plumber in cap and overalls with a pipe wrench, dripping pipe', s);
}

// ---------- multimeter
{
  let s = '';
  // seven-segment digits
  const segs = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const dig = (x, y, n, w = 4, h = 7.2, t = 1.1) => [...segs[n]].map(k => ({
    a: rect(x + t * .6, y, w - t * 1.2, t), g: rect(x + t * .6, y + h / 2 - t / 2, w - t * 1.2, t), d: rect(x + t * .6, y + h - t, w - t * 1.2, t),
    f: rect(x, y + t * .6, t, h / 2 - t * .9), b: rect(x + w - t, y + t * .6, t, h / 2 - t * .9),
    e: rect(x, y + h / 2 + t * .3, t, h / 2 - t * .9), c: rect(x + w - t, y + h / 2 + t * .3, t, h / 2 - t * .9) }[k])).join('');
  // body: rubber bumper ring and face
  const inner = rpoly([[9, 7.5], [33, 7.5], [33, 44], [9, 44]], 3);
  s += P('t-b', rpoly([[6, 4.5], [36, 4.5], [36, 47], [6, 47]], 5) + inner, ' fill-rule="evenodd"');
  const scr = rect(11.5, 10, 19, 10.5);
  s += P('t-a', inner + scr, ' fill-rule="evenodd"');
  s += P('t-c', scr);
  s += P('t-b', dig(13.3, 11.7, 1) + dig(18.7, 11.7, 2) + dig(25, 11.7, 5) + rect(23.2, 17.8, 1.1, 1.1));
  s += R('t-b', 12, 22.2, 5, 1.6, .8) + R('t-b', 25, 22.2, 5, 1.6, .8);
  // dial with a pointer slot and ticks
  const cx = 21, cy = 31.8, a = -55 * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
  const slot = poly([[cx - ux * 2 + px, cy - uy * 2 + py], [cx + ux * 5.6 + px, cy + uy * 5.6 + py], [cx + ux * 5.6 - px, cy + uy * 5.6 - py], [cx - ux * 2 - px, cy - uy * 2 - py]]);
  s += P('t-b', circ(cx, cy, 6.8) + slot, ' fill-rule="evenodd"');
  let ticks = '';
  for (const d of [180, -135, -90, -45, 0]) { const r = d * Math.PI / 180, c = Math.cos(r), n = Math.sin(r); ticks += `M${f(cx + c * 8)} ${f(cy + n * 8)}L${f(cx + c * 9.6)} ${f(cy + n * 9.6)}`; }
  s += L(ticks, 1.2);
  s += P('t-b', circ(14, 41, 1.5) + circ(21, 41, 1.5) + circ(28, 41, 1.5));
  // plugs under the body
  s += P('t-a', poly([[11.8, 47.6], [16.2, 47.6], [15.6, 52.5], [12.4, 52.5]]));
  s += P('t-b', poly([[25.8, 47.6], [30.2, 47.6], [29.6, 52.5], [26.4, 52.5]]));
  // leads
  const leadA = crs([[14, 52], [13.4, 56], [17.5, 59], [24, 58.6], [28, 56.6], [31.6, 58.8], [40, 59.2], [50, 58.6], [54.6, 55], [54.6, 50]], 2);
  const leadB = crs([[28, 52], [28.6, 54], [32.4, 54.6], [36.6, 52.6], [40.6, 54.4], [44.6, 53.2], [45.4, 50], [45.4, 46]], 2);
  s += P('t-a', tube(leadA, 2.3));
  s += P('t-b', tube(leadB, 2.3));
  // probes: black (left) and red (right)
  const probe = (c, x, y0) => P(c, poly([[x - 2.1, y0 + 8], [x + 2.1, y0 + 8], [x + 1.8, y0 + 24], [x - 1.8, y0 + 24]]) + rect(x - 3.6, y0 + 6, 7.2, 2) + poly([[x - 1.2, y0 + 1.5], [x + 1.2, y0 + 1.5], [x + 1.4, y0 + 6], [x - 1.4, y0 + 6]])) + L(`M${f(x)} ${f(y0 + 1.5)}V${f(y0 - 2.5)}`, 1.4);
  s += probe('t-b', 45.4, 24);
  s += probe('t-a', 54.6, 28);
  s += P('t-b', rect(53.2, 40, 2.8, 1.2) + rect(53.3, 43, 2.6, 1.2));
  // lightning bolt
  s += P('t-a', poly([[52.5, 3.5], [44.5, 13.5], [49.8, 13.5], [47, 21.5], [57.5, 9.5], [52, 9.5], [56, 3.5]]));
  s += P('t-c', spark(5.5, 55, 2.6) + spark(40.5, 6, 2.2));
  add('multimeter', 'handheld multimeter with digital screen, dial and red and black probe leads', s);
}

// ---------- office-worker
{
  let s = '';
  // coffee mug with steam
  s += L('M6.8 37.5Q5.2 35 7 33Q8.6 31 7.2 28.6M10 37.5Q8.6 35.4 10.2 33.6', 1.3);
  s += L('M6 42.4H4.8Q3.2 42.4 3.2 44.8Q3.2 47.2 4.8 47.2H6', 1.9);
  s += P('t-a', rpoly([[5.5, 39.6], [12.5, 39.6], [12, 49.2], [6, 49.2]], [.6, .6, 1.4, 1.4]));
  s += P('t-b', poly([[5.7, 42.6], [12.3, 42.6], [12.15, 45.6], [5.85, 45.6]]));
  // torso with badge window, arms
  const badge = rpoly([[28.8, 29.6], [35.2, 29.6], [35.2, 36.6], [28.8, 36.6]], .8), logo = circ(32, 42, 1.9);
  s += P('t-a', rpoly([[20.5, 49.2], [20, 30], [23, 24.4], [41, 24.4], [44, 30], [43.5, 49.2]], [0, 4, 3, 3, 4, 0]) + badge + logo, ' fill-rule="evenodd"');
  s += P('t-a', limb([[22.6, 28.6], [17, 40.6], [21, 46.6]], 6.2));
  s += P('t-a', limb([[41.4, 28.6], [47, 40.6], [43, 46.6]], 6.2));
  s += P('t-a', rect(29, 19, 6, 6));
  s += P('t-c', badge);
  s += P('t-b', rect(30, 31.2, 2.6, 2.8) + rect(33.2, 31.4, 1.2, .9) + rect(30, 34.8, 4.2, .9));
  s += L('M28.6 24.8L31 30M35.4 24.8L33 30', 1.3) + R('t-b', 30.6, 28.6, 2.8, 1.8, .5);
  s += P('t-b', poly([[26.8, 24.4], [29, 24.4], [30.6, 27.2]]) + poly([[37.2, 24.4], [35, 24.4], [33.4, 27.2]]));
  s += L('M17 40.6L20 38M47 40.6L44 38', 1.1);
  // head
  s += C('t-a', 32, 14, 7.5);
  s += P('t-b', 'M24.4 14.2Q23.4 5.8 32 5.6Q40.6 5.8 39.6 14.2Q37.6 9.2 31 10.2Q27 10.4 24.4 14.2Z');
  s += P('t-b', circ(29.2, 15.2, 1.1) + circ(34.8, 15.2, 1.1));
  s += L('M29.6 18.3Q32 20.1 34.4 18.3', 1.2);
  // laptop seen from behind, hands on the keys either side
  s += P('t-a', circ(21.4, 47.4, 2.6) + circ(42.6, 47.4, 2.6));
  s += P('t-b', rpoly([[22, 35.4], [42, 35.4], [42.8, 49], [21.2, 49]], 1.4) + logo + rect(19.6, 48.6, 24.8, 1.2), ' fill-rule="evenodd"');
  s += P('t-c', logo);
  // desk
  s += R('t-a', 2.5, 50, 59, 3, .8);
  s += P('t-b', rect(4, 53, 56, 2.6) + poly([[6, 55.6], [9.6, 55.6], [9, 60], [6.6, 60]]) + poly([[54.4, 55.6], [58, 55.6], [57.4, 60], [55, 60]]));
  // stack of papers
  let pp = '';
  [[52, 47.2, -.4], [51.6, 45.4, .5], [52.2, 43.6, -.2], [51.8, 41.8, .3]].forEach(([x, y, o]) => { pp += rect(x + o, y, 8, 1.8); });
  s += P('t-c', pp);
  s += L('M51.8 47.1H60M52.3 45.3H60.4M52.2 43.5H60.2', .7);
  s += P('t-c', spark(8, 8, 3) + spark(56, 9, 2.6));
  add('office-worker', 'person typing on a laptop at a desk with lanyard badge, coffee and papers', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part49.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
