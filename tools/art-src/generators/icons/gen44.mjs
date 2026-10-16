// Generates part44.json (round 4): workbench, dentist-chair, lotion-hand, duvet-bed, speaking-head, laughing-face.
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
// miter-offset a simple polygon outward by d
const offs = (pts, d) => {
  const n = pts.length, area = pts.reduce((s, p, i) => { const q = pts[(i + 1) % n]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const sg = area > 0 ? -1 : 1;
  return pts.map((v, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const nrm = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy); return [dy / l * sg, -dx / l * sg]; };
    const n1 = nrm(a, v), n2 = nrm(v, b), k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [v[0] + (n1[0] + n2[0]) * k, v[1] + (n1[1] + n2[1]) * k];
  });
};
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const rad = a => a * Math.PI / 180;
const pt = (cx, cy, r, a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
// arc band with round ends, a1<a2 in degrees (svg angles, clockwise)
const band = (cx, cy, r1, r2, a1, a2) => {
  const o1 = pt(cx, cy, r2, a1), o2 = pt(cx, cy, r2, a2), i1 = pt(cx, cy, r1, a1), i2 = pt(cx, cy, r1, a2), rc = (r2 - r1) / 2, lg = a2 - a1 > 180 ? 1 : 0;
  return `M${f(o1[0])} ${f(o1[1])}A${f(r2)} ${f(r2)} 0 ${lg} 1 ${f(o2[0])} ${f(o2[1])}A${f(rc)} ${f(rc)} 0 0 1 ${f(i2[0])} ${f(i2[1])}A${f(r1)} ${f(r1)} 0 ${lg} 0 ${f(i1[0])} ${f(i1[1])}A${f(rc)} ${f(rc)} 0 0 1 ${f(o1[0])} ${f(o1[1])}Z`;
};
// teardrop: round body at (x,y) radius r, tip at distance h toward angle ang
const drop = (x, y, r, ang, h) => {
  const T = pt(x, y, h, ang), a = Math.acos(r / h) * 180 / Math.PI, p1 = pt(x, y, r, ang + a), p2 = pt(x, y, r, ang - a);
  return `M${f(T[0])} ${f(T[1])}L${f(p1[0])} ${f(p1[1])}A${f(r)} ${f(r)} 0 1 1 ${f(p2[0])} ${f(p2[1])}Z`;
};

// ---------- workbench
{
  let s = '';
  // pegboard with tool-shaped holes; tools hang inside with a gap
  const ham = [[29, 8], [37.5, 8], [37.5, 11.2], [34.4, 11.2], [34.4, 17.5], [32.1, 17.5], [32.1, 11.2], [29, 11.2]];
  const drv = [[40.2, 8], [44.2, 8], [44.2, 12.8], [42.8, 12.8], [42.8, 17.5], [41.6, 17.5], [41.6, 12.8], [40.2, 12.8]];
  const wr = [[47, 8], [49.4, 8], [49.4, 10], [52.6, 10], [52.6, 8], [55, 8], [55, 11.2], [52.8, 12.6], [52.8, 17.5], [49.2, 17.5], [49.2, 12.6], [47, 11.2]];
  let pegs = '';
  for (const x of [28, 35, 42, 49, 56]) pegs += circ(x, 19.7, .75);
  for (const x of [39, 46]) pegs += circ(x, 5.9, .75);
  s += P('t-b', 'M26 4H58.5V21.6H26Z' + poly(offs(ham, 1)) + poly(offs(drv, 1)) + poly(offs(wr, 1)) + pegs, ' fill-rule="evenodd"');
  s += P('t-a', poly(ham) + poly(drv) + poly(wr));
  // plank clamped upright in the vice
  s += P('t-a', 'M10.5 30V14.5L12 13H20L21.5 14.5V30Z');
  s += E('t-b', 16.6, 22, 1.5, 2.6);
  s += L('M13.2 16V28M16.6 15.5Q16.4 18 14.6 20.5Q13.8 23 15.4 26V29M19 16Q19.6 19 18.8 21Q19 24 19.4 28', 1.1);
  // legs, stretcher
  s += P('t-a', 'M7.5 35.5H13V59.5H7.5ZM51 35.5H56.5V59.5H51Z' + 'M13 48.5H51V52H13Z');
  s += P('t-b', 'M11 38H13V59.3H11ZM54.5 38H56.5V59.3H54.5ZM13 50.6H51V52H13Z');
  // bench top
  s += P('t-a', rpoly([[4, 30], [60, 30], [60, 36], [4, 36]], 1));
  s += P('t-b', 'M25 34.5H59.9V35.4Q59.9 36 59.3 36H25Z');
  s += L('M28 33H40M45 33.2H56', 1);
  // vice: wooden jaws split around the screw bar
  s += P('t-b', rpoly([[6.5, 27], [25, 27], [25, 36.6], [6.5, 36.6]], [1, 1, 0, 0]) + rpoly([[6.5, 39.4], [25, 39.4], [25, 44.5], [6.5, 44.5]], [0, 0, 1.5, 1.5]));
  s += P('t-a', cap(5.5, 38, 26, 38, 2.2) + circ(5.2, 38, 1.9) + circ(26.3, 38, 1.9));
  // mallet and chisel lying on the top
  s += P('t-a', rpoly([[28.5, 30], [36.5, 30], [36.5, 22.6], [28.5, 22.6]], 1.5) + cap(36, 27, 47.5, 27, 2.8));
  s += P('t-b', 'M30.6 22.6H32.2V30H30.6ZM32.8 22.6H34.4V30H32.8Z');
  s += P('t-a', cap(49.5, 27.8, 55, 27.8, 3.4));
  s += P('t-b', 'M55 26.6H56.4V29H55ZM56.4 27H59.4L59.6 28.7H56.4Z');
  s += P('t-c', spark(5.5, 6, 3.2) + spark(14, 4.8, 1.8));
  add('workbench', 'wooden workbench with a vice, mallet, chisel and pegboard', s);
}

// ---------- dentist-chair (side-on, facing right)
{
  let s = '';
  // base and pole with lamp arm
  s += P('t-a', rpoly([[4, 53], [49, 53], [49, 58.5], [4, 58.5]], 2.2)) + P('t-a', cap(6.5, 54, 6.5, 8.5, 3.2) + cap(6.5, 8.5, 25.5, 8.5, 3) + cap(25.5, 8.5, 25.5, 12.5, 2.4));
  // lamp head with lens slot cut out
  const lens = 'M21.4 15.6H30.6V17.2H21.4Z';
  s += P('t-a', rpoly([[18.5, 18.5], [32.5, 18.5], [29.5, 11.5], [21.5, 11.5]], 1.6) + lens, ' fill-rule="evenodd"');
  s += P('t-c', lens);
  s += L('M21 21.5L19.6 24M25.5 21.8V24.5M30 21.5L31.4 24', 1.3);
  // column
  s += R('t-b', 32, 41, 5.5, 12.5);
  // chair: headrest, backrest, seat, leg rest
  s += P('t-a', cap(12.5, 25, 15.5, 29, 6.2)) + P('t-a', cap(19.5, 31, 28.5, 40, 8.6)) + P('t-a', rpoly([[25, 36], [45.5, 36], [46.5, 42.5], [27, 43]], 2.4)) + P('t-a', cap(44, 39.2, 54.5, 46, 6.4)) + P('t-a', cap(57.5, 43.5, 55, 50, 2.6));
  s += P('t-b', 'M23.6 41.8L27 43L44 42.6L46.4 41.2L46.5 42.5Q46.6 43 46 43L27 43.4Q24.8 43.2 23.6 41.8Z' + 'M46 43.2L54.4 49.2L52.6 49.4Z');
  // armrest
  s += P('t-b', cap(30.5, 31.6, 41.5, 31.6, 3) + cap(36, 32, 36, 36, 2));
  // instrument tray on an arm
  s += P('t-b', cap(51, 25, 46.3, 35.5, 2));
  s += P('t-a', rpoly([[46.5, 25.6], [59, 25.6], [60, 22.4], [45.5, 22.4]], .8) + cap(49, 22.4, 48.2, 17.6, 1.3) + circ(48, 15.8, 2) + cap(52.5, 22.4, 53.4, 16.4, 1.2));
  s += P('t-b', rpoly([[55.3, 17.5], [58.7, 17.5], [58.3, 22.4], [55.7, 22.4]], .5));
  s += P('t-c', spark(57.5, 7, 3.2) + spark(42, 4.8, 1.8));
  add('dentist-chair', 'reclining dentist chair with overhead lamp and tool tray', s);
}

// ---------- lotion-hand
{
  let s = '';
  // pump bottle
  const label = rpoly([[44.5, 20.5], [52.5, 20.5], [52.5, 29.5], [44.5, 29.5]], 1);
  s += P('t-a', rpoly([[41.5, 14], [55.5, 14], [55.5, 34.5], [41.5, 34.5]], [3, 3, 2, 2]) + label, ' fill-rule="evenodd"');
  s += P('t-c', label);
  s += P('t-b', drop(48.5, 26.2, 2.2, -90, 4.4));
  s += P('t-b', rpoly([[44.5, 10.5], [52.5, 10.5], [52.5, 14.2], [44.5, 14.2]], .6) + 'M54 15.5H55.5V33Q55.5 34.5 54 34.5Z');
  s += P('t-a', 'M47.4 7.8V10.6H49.6V7.8Z' + rpoly([[43, 8.2], [52.5, 8.2], [52.5, 4.8], [43, 4.8]], 1.2) + cap(44, 6.4, 33.5, 6.4, 2.8) + cap(33.2, 6.2, 32.4, 9.6, 2.6));
  // lotion drop falling with highlight cut out
  const hl = 'M27.2 21.4A2.6 2.6 0 0 0 26 24.6L26.9 24.3A1.7 1.7 0 0 1 27.8 22.2Z';
  s += P('t-a', drop(29.5, 23.5, 4.5, -98, 10) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-a', drop(31.6, 13.4, 1.3, -100, 2.8));
  // hand: palm-up, fingers to the left, wrist at right
  s += P('t-a', rpoly([[20, 53], [32, 57], [48.5, 55.5], [47.5, 39.2], [36, 40.2], [20, 39.8]], [3, 4, 1, 1, 2, 2]) +
    limb([[28, 42.2], [9.5, 41.6], [6.4, 39.4]], 4.8) + limb([[28, 46.2], [8, 46], [5.2, 44]], 4.8) +
    limb([[28, 50.2], [9.5, 50.2], [6.8, 48.4]], 4.6) + limb([[28, 53.8], [13.5, 54.2], [10.6, 52.6]], 4.2) +
    limb([[41, 42.5], [36.5, 36.2], [32.6, 33.4]], 5.6));
  s += L('M24 44.2L9.5 43.9M24 48.2L9 48.2M24 52L12 52.2M39.6 44.2Q36.6 42.4 34 41', 1);
  // lotion puddle on the palm
  s += P('t-c', 'M16 39.6Q17 37.8 22 37.8Q27 37.8 28 40Z' + drop(15.2, 34.6, 1.2, 60, 2.6) + drop(28.6, 34.4, 1.2, 120, 2.6) + drop(22.2, 33.6, 1, 90, 2.2));
  s += L('M16 39.6Q17 37.8 22 37.8Q27 37.8 28 40', 1.1);
  // sleeve cuff
  s += P('t-b', rpoly([[46.5, 37.6], [59.5, 37.6], [59.5, 57.5], [46.5, 57.5]], [2, 0, 0, 2]));
  s += P('t-c', spark(9, 26, 3.6) + spark(17, 16.5, 2.4) + spark(5.5, 57, 2.2));
  add('lotion-hand', 'open palm catching a drop of lotion from a pump bottle', s);
}

// ---------- duvet-bed
{
  let s = '';
  const p = (u, t, dy = 0) => [5 + 36 * u + 17 * t, 37 - 13 * t + dy];
  // pillows (puffy quads)
  const pil = (u0, u1) => [p(u0, .62, 1), p(u1, .62, 1), p(u1, .95, -4.5), p(u0, .95, -4.5)];
  const pl = rpoly(pil(.06, .47), 3), pr = rpoly(pil(.53, .94), 3);
  // headboard extends down behind the pillows so they cut cleanly
  s += P('t-a', 'M21.5 31V12.5Q21.5 7 27 7H53Q58.5 7 58.5 12.5V31Z' + pl + pr, ' fill-rule="evenodd"');
  s += P('t-c', pl + pr);
  s += L('M25.5 11.5H54.5', 1.2);
  // mattress side face and frame (shade)
  s += P('t-b', poly([p(1, 0, -.5), p(1, 1, -.5), p(1, 1, 12), p(1, 0, 12)]) + poly([[4, 46], [41.5, 46], [41.5, 51], [4, 51]]));
  s += P('t-b', 'M5 50H9V57Q9 58 8 58H6Q5 58 5 57ZM37 50H41V57Q41 58 40 58H38Q37 58 37 57ZM54.6 37H57.6V43Q57.6 44 56.6 44H55.6Q54.6 44 54.6 43Z');
  // duvet top and front drape, plump edges
  const tb = .55;
  const A = p(-.03, tb), B = p(1.03, tb), Cc = p(1.03, 0), D = p(-.03, 0);
  let duv = `M${f(A[0])} ${f(A[1])}Q${f((A[0] + B[0]) / 2)} ${f(A[1] - 1.6)} ${f(B[0])} ${f(B[1])}Q${f(B[0] + 1.4)} ${f(B[1] + 1)} ${f(Cc[0] + 1)} ${f(Cc[1])}`;
  duv += `L${f(Cc[0] + 1)} 47`;
  for (let i = 0; i < 4; i++) { const x = Cc[0] + 1 - (i + 1) * (Cc[0] - D[0] + 2) / 4; duv += `Q${f(x + (Cc[0] - D[0] + 2) / 8)} 49.6 ${f(x)} 47.2`; }
  duv += `L${f(D[0] - 1)} ${f(D[1] + 1)}Q${f(D[0] - 1)} ${f(D[1] - 1)} ${f(D[0] + .5)} ${f(D[1] - 1.5)}Z`;
  s += P('t-a', duv);
  // side drape (shaded)
  s += P('t-b', `M${f(Cc[0] + 1)} ${f(Cc[1])}Q${f(B[0] + 1.4)} ${f(B[1] + 1)} ${f(B[0])} ${f(B[1])}L${f(B[0])} ${f(B[1] + 9)}Q${f((B[0] + Cc[0]) / 2 + 1)} ${f((B[1] + Cc[1]) / 2 + 12)} ${f(Cc[0] + 1)} 47Z`);
  // turned-down hem band and front fold line
  const h0 = p(-.02, tb - .02, .2), h1 = p(1.02, tb - .02, .2), h2 = p(1.02, tb - .1, .2), h3 = p(-.02, tb - .1, .2);
  s += P('t-b', `M${f(h0[0])} ${f(h0[1])}Q${f((h0[0] + h1[0]) / 2)} ${f(h0[1] - 1.4)} ${f(h1[0])} ${f(h1[1])}L${f(h2[0])} ${f(h2[1])}Q${f((h2[0] + h3[0]) / 2)} ${f(h2[1] - 1.4)} ${f(h3[0])} ${f(h3[1])}Z`);
  // pattern: diamonds on top and front
  let pat = '';
  const dia = (x, y, r) => `M${f(x)} ${f(y - r)}L${f(x + r)} ${f(y)}L${f(x)} ${f(y + r)}L${f(x - r)} ${f(y)}Z`;
  for (const t of [.32]) for (let u = .08; u < 1; u += .14) { const q = p(u + (t > .3 ? .07 : 0), t); pat += dia(q[0], q[1], 1.3); }
  for (let x = 8; x < 41; x += 6.5) pat += dia(x, 41, 1.4) + dia(x + 3.25, 44.6, 1.2);
  s += P('t-b', pat);
  // folded throw across the foot end, with stripes cut out
  const t0 = .05, t1 = .22;
  const T0 = p(-.04, t1), T1 = p(1.04, t1), T2 = p(1.04, t0, 1.2), T3 = p(-.04, t0, 1.2);
  const strp = (ta, tb2) => { const a = p(.0, ta), b = p(1, ta), c = p(1, tb2), d = p(0, tb2); return poly([a, b, c, d]); };
  s += P('t-b', rpoly([T0, T1, T2, T3], 1.2) + strp(.155, .175) + strp(.105, .125), ' fill-rule="evenodd"');
  s += L(`M${f(D[0])} ${f(D[1] + .6)}H${f(Cc[0])}`, 1.1);
  s += P('t-c', spark(8, 11, 3.6) + spark(14.5, 21.5, 2.2));
  add('duvet-bed', 'bed with a plump patterned duvet, two pillows and a folded throw', s);
}

// ---------- speaking-head (side-on, facing right)
{
  let s = '';
  const eye = 'M27.2 19.8Q29.6 17.6 31.8 19.8Q29.6 21.6 27.2 19.8Z';
  const head = 'M6 59.5C6 52.5 9.5 48.5 15.5 46.5L15.5 42.5C9 38.5 6 31.5 6 24.5C6 13 14 5.5 24 5.5C32 5.5 37 11 37.6 18L37.8 20.4L41.8 27Q42.4 28.6 40.4 29L38 29.5L38.6 31L33 33.2L38.2 36.6Q38.8 38.2 37.8 39.6Q36.2 43.2 31.2 43.6L28.2 44L28.2 47.2C34.5 48.2 42 52.5 42 59.5Z';
  s += P('t-a', head + eye, ' fill-rule="evenodd"');
  // mouth interior
  s += P('t-b', 'M38.6 31L33 33.2L38.2 36.6Q36 33.6 38.6 31Z');
  // hair and ear
  s += P('t-b', 'M6.4 28C5.2 15 12.5 5.5 24 5.5C30 5.5 34.5 8.5 36.4 13Q29 10 22 12Q14.5 14 12.5 22Q11 26 11.6 30Z');
  s += P('t-b', 'M15.5 23.5Q20.5 22.5 21 27.5Q21 32 16.5 32Q19 29.5 18.6 27.4Q18.2 25 15.5 23.5Z');
  // sound arcs from the mouth
  s += P('t-a', band(37, 33.5, 8.6, 11.6, -38, 38) + band(37, 33.5, 14.2, 17.2, -40, 40) + band(37, 33.5, 19.8, 22.6, -40, 40));
  // music note above the arcs
  s += E('t-a', 49.4, 13.6, 3, 2.2, -20);
  s += P('t-a', 'M51.4 12.8H53V4.4H51.4Z' + 'M53 4.4Q57.6 5.6 57.2 10.6Q56 7.8 53 7.6Z');
  s += P('t-c', spark(56, 56, 3.2) + spark(48.5, 59, 1.6));
  add('speaking-head', 'head in profile speaking with sound waves and a music note', s);
}

// ---------- laughing-face
{
  let s = '';
  const teeth = 'M18.8 38.6Q32 42 45.2 38.6L44.8 41.6Q32 44.6 19.2 41.6Z';
  const hlf = 'M15.4 27.6A17.5 17.5 0 0 1 26.8 16.2L27.4 18A15.8 15.8 0 0 0 17.2 28.2Z';
  s += P('t-a', circ(32, 34, 21.5) + teeth + hlf, ' fill-rule="evenodd"');
  s += P('t-c', hlf);
  // squeezed happy eyes and raised brows
  s += P('t-b', band(23.5, 30.5, 3.6, 6.4, 205, 335) + band(40.5, 30.5, 3.6, 6.4, 205, 335));
  // laughing mouth with teeth and tongue
  const tongue = 'M24.6 49.4Q32 43.4 39.4 49.4Q36 52 32 52Q28 52 24.6 49.4Z';
  s += P('t-b', 'M17 37Q32 40.6 47 37Q46.4 52.6 32 52.6Q17.6 52.6 17 37Z' + teeth + tongue, ' fill-rule="evenodd"');
  s += P('t-c', teeth);
  s += L('M32 47.2V50.2', 1.1);
  // tears of joy flying off both sides
  const th = (x, y, r, a, h, mirror) => drop(mirror ? 64 - x : x, y, r, mirror ? 180 - a : a, h);
  const tl = th(7.6, 40.5, 3.5, -74, 7.6), tr = th(7.6, 40.5, 3.5, -74, 7.6, 1);
  const sl = th(6.4, 28, 2.3, -40, 5), sr = th(6.4, 28, 2.3, -40, 5, 1);
  const hi = (x, y) => circ(x, y, .9);
  s += P('t-a', tl + tr + sl + sr + hi(6.4, 41.2) + hi(57.6, 41.2), ' fill-rule="evenodd"');
  s += P('t-c', hi(6.4, 41.2) + hi(57.6, 41.2));
  s += P('t-c', spark(9, 8.5, 3.6) + spark(55, 8.5, 3.6));
  add('laughing-face', 'face laughing with eyes shut and tears of joy', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part44.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
