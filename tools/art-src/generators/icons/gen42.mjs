// Generates part42.json (round 4).
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
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- nature-camera
{
  let s = '';
  // boom pole and furry mic
  s += P('t-b', cap(5, 6, 40, 9.5, 2.2));
  s += P('t-a', cap(39, 9.5, 52.5, 15.5, 7.5));
  s += L('M42.2 8.2L40.6 12.4M45.6 9.8L44 14M49 11.3L47.4 15.5', 1.3);
  // tripod
  s += P('t-a', cap(18, 39, 8.5, 58.5, 3.2) + cap(18, 39, 28, 58.5, 3.2));
  s += P('t-b', cap(18, 39, 18, 56, 2.6));
  s += R('t-b', 12.5, 35.5, 11, 4, 1.2);
  // reels
  const holes = (x, y) => circ(x, y, 1.3) + [0, 120, 240].map(a => circ(x + 3.1 * Math.cos((a - 90) * Math.PI / 180), y + 3.1 * Math.sin((a - 90) * Math.PI / 180), 1.2)).join('');
  s += P('t-a', circ(12.5, 15.5, 5.8) + holes(12.5, 15.5) + circ(24.5, 15.5, 5.8) + holes(24.5, 15.5), ' fill-rule="evenodd"');
  // body
  s += P('t-a', rpoly([[6, 21], [31, 21], [31, 36], [6, 36]], 2.5));
  s += P('t-b', 'M6 32H31V33.5Q31 36 28.5 36H8.5Q6 36 6 33.5Z');
  s += R('t-b', 9.5, 24, 10.5, 5.5, 1);
  s += R('t-b', 3.5, 24.5, 3, 5, .8);
  // lens + matte box
  s += R('t-b', 31, 25, 3, 7.5);
  s += P('t-a', rpoly([[33.5, 25], [40, 21.5], [40, 35.5], [33.5, 32]], .8));
  s += P('t-b', poly([[36.5, 25.2], [40, 23.3], [40, 33.7], [36.5, 31.8]]));
  // rock
  s += P('t-a', 'M38.5 58.5V53.5Q39 51 43 49.8L56 49.2Q60.5 49.5 61.5 53.5V58.5Z');
  s += P('t-b', 'M38.5 53.5H61.5V58.5H38.5Z');
  // penguin, front-on, belly and eyes cut out
  const peng = 'M44.4 27A5.6 5.6 0 0 1 55.6 27Q55.6 30 54.8 32Q58.5 37 58 44Q57.5 51.5 50 51.5Q42.5 51.5 42 44Q41.5 37 45.2 32Q44.4 30 44.4 27Z';
  const belly = ell(50, 42.5, 5, 7.5), eyes = circ(47.7, 26.3, 1.5) + circ(52.3, 26.3, 1.5);
  s += P('t-a', peng + belly + eyes, ' fill-rule="evenodd"');
  s += P('t-c', belly + eyes);
  s += P('t-b', circ(48, 26.6, .8) + circ(52.6, 26.6, .8) + poly([[48.2, 29.2], [51.8, 29.2], [50, 31.8]]));
  s += P('t-b', 'M43.5 34Q40 39 40 46Q42 44.5 43.5 41.5ZM56.5 34Q60 39 60 46Q58 44.5 56.5 41.5Z');
  s += P('t-b', ell(46.5, 51.3, 2.7, 1.3) + ell(53.5, 51.3, 2.7, 1.3));
  s += P('t-c', spark(59.5, 5.5, 3) + spark(33.5, 46, 2.6));
  add('nature-camera', 'film camera on a tripod filming a penguin on a rock, boom mic overhead', s);
}

// ---------- exam-desk
{
  let s = '';
  const O = [4, 42], U = [40, 4], V = [14, -20];
  const pt = (u, v) => [O[0] + U[0] * u + V[0] * v, O[1] + U[1] * u + V[1] * v];
  const q = (u0, v0, u1, v1) => poly([pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)]);
  const T = 3.5, LG = 13;
  // legs
  const leg = (u, v, l) => { const [x, y] = pt(u, v); return cap(x, y, x, y + T + l, 2.6); };
  s += P('t-b', leg(.04, .1, LG) + leg(.96, .1, LG - 1) + leg(.96, .92, LG - .5) + leg(.04, .92, LG));
  // front and side faces
  const [a, b, c] = [pt(0, 0), pt(1, 0), pt(1, 1)];
  s += P('t-b', poly([a, b, [b[0], b[1] + T], [a[0], a[1] + T]]) + poly([b, c, [c[0], c[1] + T], [b[0], b[1] + T]]));
  // top with paper, eraser and pencil-tip cut out
  const paper = q(.08, .1, .62, .92), eraser = q(.74, .66, .9, .8);
  const p0 = pt(.7, .2), p1 = pt(.8, .52), p2 = pt(.84, .66), pn = [p1[1] - p0[1], p0[0] - p1[0]], pl = Math.hypot(...pn) / 1.45;
  const tip = poly([[p1[0] + pn[0] / pl, p1[1] + pn[1] / pl], p2, [p1[0] - pn[0] / pl, p1[1] - pn[1] / pl]]);
  s += P('t-a', q(0, 0, 1, 1) + paper + eraser + tip, ' fill-rule="evenodd"');
  s += P('t-c', paper + eraser + tip);
  s += P('t-b', cap(p0[0], p0[1], p1[0], p1[1], 2.9) + poly([[p1[0] + .55 * (p2[0] - p1[0]) + pn[0] / pl * .4, p1[1] + .55 * (p2[1] - p1[1]) + pn[1] / pl * .4], p2, [p1[0] + .55 * (p2[0] - p1[0]) - pn[0] / pl * .4, p1[1] + .55 * (p2[1] - p1[1]) - pn[1] / pl * .4]]));
  s += P('t-b', q(.74, .66, .81, .8));
  // exam rows: header then three ticked boxes
  s += P('t-b', q(.14, .8, .45, .86));
  let ln = '';
  for (const v of [.6, .4, .2]) {
    const bx = q(.125, v - .075, .245, v + .075);
    s += L(bx, .9);
    const p0 = pt(.15, v + .01), p1 = pt(.18, v - .045), p2 = pt(.24, v + .095);
    ln += `M${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}`;
    const l0 = pt(.3, v), l1 = pt(.56, v);
    s += L(`M${f(l0[0])} ${f(l0[1])}L${f(l1[0])} ${f(l1[1])}`, 1.4);
  }
  s += L(ln, 1.2);
  // clock
  s += P('t-a', circ(11.5, 11.5, 7.5) + circ(11.5, 11.5, 5.6), ' fill-rule="evenodd"');
  s += P('t-c', circ(11.5, 11.5, 5.6));
  s += L('M11.5 11.5V7.6M11.5 11.5L14.3 13', 1.5);
  s += P('t-b', circ(11.5, 11.5, 1));
  s += P('t-c', spark(57, 8, 3.6) + spark(30, 6, 2.4));
  add('exam-desk', 'school desk with a ticked exam paper, pencil, eraser and a wall clock', s);
}

// ---------- report-card
{
  let s = '';
  // shadow
  s += P('t-b', ell(33, 58.5, 24, 2.2));
  // cover (left panel, receding) in t-b, crest and title cut out
  const cv = (x, t) => { const top = 12 - (x - 8) * .25, bot = 52 + (x - 8) * .25; return [x, top + t * (bot - top)]; };
  const cvp = pts => poly(pts.map(([x, t]) => cv(x, t)));
  const shield = 'M13.5 20.5L22.5 18.5V24Q22.5 29 18 31.5Q13.5 30 13.5 25.5Z';
  const bars = cvp([[11.5, .55], [25, .55], [25, .61], [11.5, .61]]) + cvp([[13, .68], [23.5, .68], [23.5, .73], [13, .73]]);
  s += P('t-b', cvp([[8, 0], [28, 0], [28, 1], [8, 1]]) + shield + bars, ' fill-rule="evenodd"');
  s += P('t-c', shield + bars);
  s += P('t-b', 'M15.5 23.5L18 26L20.5 23V25.5L18 28.5L15.5 26Z');
  // inside page
  const pg = (x, t) => { const top = 7 + (x - 28) * 3 / 29, bot = 57 - (x - 28) * 3 / 29; return [x, top + t * (bot - top)]; };
  const pgp = pts => poly(pts.map(([x, t]) => pg(x, t)));
  // letters
  const A = (x, y, w, h) => poly([[x, y + h], [x + w * .36, y], [x + w * .64, y], [x + w, y + h], [x + w * .7, y + h], [x + w * .62, y + h * .76], [x + w * .38, y + h * .76], [x + w * .3, y + h]])
    + poly([[x + w * .42, y + h * .54], [x + w * .5, y + h * .22], [x + w * .58, y + h * .54]]);
  const B = (x, y, w, h) => `M${f(x)} ${f(y)}H${f(x + w * .6)}Q${f(x + w * .95)} ${f(y)} ${f(x + w * .95)} ${f(y + h * .26)}Q${f(x + w * .95)} ${f(y + h * .44)} ${f(x + w * .78)} ${f(y + h * .5)}Q${f(x + w)} ${f(y + h * .56)} ${f(x + w)} ${f(y + h * .76)}Q${f(x + w)} ${f(y + h)} ${f(x + w * .6)} ${f(y + h)}H${f(x)}Z`
    + poly([[x + w * .32, y + h * .17], [x + w * .55, y + h * .17], [x + w * .62, y + h * .27], [x + w * .55, y + h * .38], [x + w * .32, y + h * .38]])
    + poly([[x + w * .32, y + h * .6], [x + w * .6, y + h * .6], [x + w * .68, y + h * .71], [x + w * .6, y + h * .83], [x + w * .32, y + h * .83]]);
  const plus = (x, y, s2, t) => poly([[x + s2 / 2 - t / 2, y], [x + s2 / 2 + t / 2, y], [x + s2 / 2 + t / 2, y + s2 / 2 - t / 2], [x + s2, y + s2 / 2 - t / 2], [x + s2, y + s2 / 2 + t / 2], [x + s2 / 2 + t / 2, y + s2 / 2 + t / 2], [x + s2 / 2 + t / 2, y + s2], [x + s2 / 2 - t / 2, y + s2], [x + s2 / 2 - t / 2, y + s2 / 2 + t / 2], [x, y + s2 / 2 + t / 2], [x, y + s2 / 2 - t / 2], [x + s2 / 2 - t / 2, y + s2 / 2 - t / 2]]);
  const letters = A(46.5, 18, 6.5, 7.5) + B(47, 28.5, 5.8, 7.5) + A(44.6, 39, 6.3, 7.5) + plus(51.6, 40, 4.6, 1.6);
  const st = poly(star(37, 48.5, 5.6, 2.5));
  s += P('t-a', pgp([[28, 0], [57, 0], [57, 1], [28, 1]]) + letters + st, ' fill-rule="evenodd"');
  s += P('t-c', letters + st);
  s += P('t-a', poly(star(37, 48.5, 3.2, 1.4)));
  // spine shade, header, subject bars, column rule
  s += P('t-b', pgp([[28, 0], [30.5, .01], [30.5, .99], [28, 1]]));
  s += P('t-b', pgp([[33, .1], [54, .1], [54, .16], [33, .16]]));
  s += P('t-b', poly([[33.5, 20.5], [42, 20.5], [42, 23], [33.5, 23]]) + poly([[33.5, 31], [41, 31], [41, 33.5], [33.5, 33.5]]) + poly([[33.5, 41.5], [42, 41.5], [42, 44], [33.5, 44]]));
  s += L('M44 18V47', 1.2);
  s += P('t-c', spark(5, 5.5, 3) + spark(60, 5, 2.6));
  add('report-card', 'open report card with crest cover, grades A B A+ and a gold star', s);
}

// ---------- ai-brain
{
  let s = '';
  const lobes = (cx, cy, rx, ry, a0, a1, n, sweep) => {
    const pts = Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i <= n; i++) { const c = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]), r = c * .62; d += `A${f(r)} ${f(r)} 0 0 ${sweep} ${f(pts[i][0])} ${f(pts[i][1])}`; }
    return d + 'Z';
  };
  const cx = 31.5, cy = 31.5, rx = 22.5, ry = 20.5;
  s += P('t-a', lobes(cx - 1.6, cy, rx, ry, -92, -268, 7, 0));
  s += P('t-a', lobes(cx + 1.6, cy, rx, ry, -88, 88, 7, 1));
  // shade at bottom of each half
  // folds
  s += L('M15 19Q19 16 21.5 20Q24 24 28 21.5M9.5 30Q14 27 16.5 31Q19 35 23.5 33M27.5 28Q23.5 36 28 41M12.5 41Q16.5 38.5 19.5 42.5Q21.5 46 18 49M22 12.5Q23 16 27.5 15.5M23 46.5Q25 50 28.5 49', 2.2);
  // circuit traces with pads
  s += L('M34 17H41L44.5 13.5M34 25H44L47.5 21.5M34 32.5H50.5M34 40H43L46.5 43.5M38 40V48M34 48H38', 2);
  const pad = (x, y) => circ(x, y, 2.3) + circ(x, y, 1);
  s += P('t-b', pad(45.8, 12.2) + pad(48.8, 20.2) + pad(52.3, 32.5) + pad(47.8, 44.8) + pad(39.5, 49.5) + pad(41, 25) , ' fill-rule="evenodd"');
  s += P('t-c', spark(56.5, 8, 4.5) + spark(7, 56.5, 2.6) + spark(60, 50, 2));
  add('ai-brain', 'brain half folds half circuit traces with a sparkle', s);
}

// ---------- robot-arm
{
  let s = '';
  const seg = (x1, y1, w1, x2, y2, w2) => { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
    return [[x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x2 + nx * w2 / 2, y2 + ny * w2 / 2], [x2 - nx * w2 / 2, y2 - ny * w2 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2]]; };
  const shade = (pts, k) => [pts[2], pts[3], [pts[3][0] + (pts[0][0] - pts[3][0]) * k, pts[3][1] + (pts[0][1] - pts[3][1]) * k], [pts[2][0] + (pts[1][0] - pts[2][0]) * k, pts[2][1] + (pts[1][1] - pts[2][1]) * k]];
  // base
  s += P('t-b', ell(18, 56.5, 13, 3.5));
  s += P('t-a', 'M8 50A10 3 0 0 1 28 50V55A10 3 0 0 1 8 55Z');
  s += P('t-b', 'M8 53A10 3 0 0 0 28 53V55A10 3 0 0 1 8 55Z');
  s += P('t-a', rpoly([[12, 50], [24, 50], [22.5, 41], [13.5, 41]], 1));
  s += P('t-b', poly([[20, 41.2], [22.5, 41.2], [24, 50], [21, 50]]));
  const J1 = [18, 41], J2 = [24, 19], J3 = [45, 14], J4 = [50, 28];
  const s1 = seg(...J1, 10, ...J2, 7), s2 = seg(...J2, 7, ...J3, 6), s3 = seg(...J3, 5.5, ...J4, 5);
  s += P('t-a', rpoly(s1, 1) + rpoly(s2, 1) + rpoly(s3, 1));
  s += P('t-b', poly(shade(s1, .3)) + poly(shade(s2, .3)) + poly(shade(s3, .3)));
  s += L(`M20.5 36Q25 28 25 22`, 1.2);
  const jt = (x, y, r) => circ(x, y, r) + circ(x, y, r * .38);
  s += P('t-b', jt(...J1, 6) + jt(...J2, 5) + jt(...J3, 4.2), ' fill-rule="evenodd"');
  // gripper mount and box
  s += P('t-b', rpoly([[44, 28], [56, 28], [56, 31.5], [44, 31.5]], .8));
  s += P('t-a', rpoly([[45.5, 36], [54.5, 36], [54.5, 45], [45.5, 45]], .8));
  s += P('t-b', poly([[49, 36], [51, 36], [51, 45], [49, 45]]));
  s += P('t-b', rpoly([[45.5, 31], [47, 31], [46.5, 37], [47, 44.5], [45.5, 46], [43.2, 44], [43.5, 36], [44.5, 31]], .6)
    + rpoly([[54.5, 31], [53, 31], [53.5, 37], [53, 44.5], [54.5, 46], [56.8, 44], [56.5, 36], [55.5, 31]], .6));
  s += P('t-c', spark(7, 7.5, 3.6) + spark(58, 55, 2.8));
  add('robot-arm', 'industrial robot arm on a round base gripping a box', s);
}

// ---------- diploma
{
  let s = '';
  // sheet
  s += P('t-a', rpoly([[9, 15], [40, 15], [40, 45], [9, 45]], 1));
  s += P('t-b', poly([[15, 19.5], [34, 19.5], [34, 22.5], [15, 22.5]]));
  s += L('M14.5 28H35M14.5 33H35M14.5 38H27', 1.6);
  // left curl
  s += P('t-a', 'M5 14A3.5 1.6 0 0 1 12 14V46A3.5 1.6 0 0 1 5 46Z');
  s += P('t-b', 'M9.5 14.6Q11 14.3 12 14V46Q11 47.2 9.5 47.4Z');
  // big roll with end cut out
  s += P('t-a', 'M37 10.5A6.5 2.4 0 0 1 50 10.5V46A6.5 2.4 0 0 1 37 46Z' + ell(43.5, 10.5, 6.5, 2.4), ' fill-rule="evenodd"');
  s += P('t-c', ell(43.5, 10.5, 6.5, 2.4));
  s += L('M43.5 10.5m-1.2 0a1.2 .6 0 1 1 2.4 0a2.6 1.2 0 1 1 -5 0', 1.1);
  s += P('t-b', 'M46.5 12.6Q48.6 12 50 10.5V46Q49 47.6 46.5 48.2Z');
  // ribbon band, bow, tails
  s += P('t-b', 'M37 26.5Q43.5 28.5 50 26.5V30Q43.5 32 37 30Z');
  s += P('t-b', rpoly([[43.5, 29], [36, 23.5], [35, 30.5]], 1.2) + rpoly([[43.5, 29], [51, 23.5], [52, 30.5]], 1.2));
  s += P('t-b', poly([[42.5, 29.5], [44.5, 29.5], [42, 50], [40, 50]]) + poly([[42.5, 29.5], [44.5, 29.5], [47.5, 50], [45.5, 50]]));
  s += P('t-a', circ(43.5, 29.2, 1.6));
  // wax seal
  let sc = '';
  for (let k = 0; k < 12; k++) { const a = k * 30 * Math.PI / 180; sc += circ(43.5 + 4.5 * Math.cos(a), 54 + 4.5 * Math.sin(a), 1.6); }
  s += P('t-b', circ(43.5, 54, 4.8) + sc);
  s += P('t-a', poly(star(43.5, 54, 3.2, 1.4)));
  // tassel
  s += L('M56.5 4.5Q53.5 8 56.5 11.5', 1.6);
  s += P('t-b', circ(56.5, 13.3, 2.3) + rpoly([[53.5, 15.5], [59.5, 15.5], [59.5, 18.5], [53.5, 18.5]], .6));
  s += P('t-a', rpoly([[53.6, 18.3], [59.4, 18.3], [61, 38], [52, 38]], [.4, .4, .8, .8]));
  s += L('M55 21V36M56.5 21V37M58 21V36', 1.1);
  s += P('t-c', spark(6.5, 6.5, 3) + spark(26, 8, 2.4) + spark(9, 55, 2.6));
  add('diploma', 'rolled diploma scroll with ribbon, wax seal and a tassel', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part42.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
