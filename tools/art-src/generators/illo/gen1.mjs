// Builds group1.json (nature, food, sports, animals, home, travel) from geometry helpers.
import fs from 'node:fs';
const DIR = new URL('.', import.meta.url).pathname;
const n = v => String(Math.round(v * 10) / 10);
const P = p => `${n(p[0])} ${n(p[1])}`;

// ---- circle-union outline (circles arranged around a centre, each contributes one arc)
function inter(a, b) {
  const [x1, y1, r1] = a, [x2, y2, r2] = b;
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  const l = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - l * l));
  const mx = x1 + dx * l / d, my = y1 + dy * l / d;
  return [[mx + h * dy / d, my - h * dx / d], [mx - h * dy / d, my + h * dx / d]];
}
const ang = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
function arcTo(c, from, to, sweep = 1) {
  let a0 = ang(c, from), a1 = ang(c, to);
  let span = sweep ? a1 - a0 : a0 - a1;
  while (span < 0) span += 2 * Math.PI;
  return `A${n(c[2])} ${n(c[2])} 0 ${span > Math.PI ? 1 : 0} ${sweep} ${P(to)}`;
}
/** circles in clockwise order (y-down); returns {d, pts} where pts[i] = junction between i and i+1 */
function union(circles, centre) {
  const k = circles.length, pts = [];
  for (let i = 0; i < k; i++) {
    const [p, q] = inter(circles[i], circles[(i + 1) % k]);
    const dp = Math.hypot(p[0] - centre[0], p[1] - centre[1]), dq = Math.hypot(q[0] - centre[0], q[1] - centre[1]);
    pts.push(dp > dq ? p : q);
  }
  let d = `M${P(pts[k - 1])}`;
  for (let i = 0; i < k; i++) d += arcTo(circles[i], pts[(i - 1 + k) % k], pts[i]);
  return { d: d + 'Z', pts };
}
const circ = (cx, cy, r) => `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;
const ell = (cx, cy, rx, ry) => `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0Z`;
const onC = (c, deg) => [c[0] + c[2] * Math.cos(deg * Math.PI / 180), c[1] + c[2] * Math.sin(deg * Math.PI / 180)];
/** a shine crescent hugging circle c: outer arc at radius ro from a0 to a1 (deg, clockwise), flatter inner arc radius ri */
const crescent = (c, ro, a0, a1, ri) => { const cc = [c[0], c[1], ro]; const p = onC(cc, a0), q = onC(cc, a1);
  return `M${P(p)}${arcTo(cc, p, q, 1)}A${n(ri)} ${n(ri)} 0 0 0 ${P(p)}Z`; };
const bean = (cx, cy, rx, ry, deg) => { const t = deg * Math.PI / 180, dx = rx * Math.cos(t), dy = rx * Math.sin(t);
  return `M${P([cx - dx, cy - dy])}A${n(rx)} ${n(ry)} ${deg} 1 0 ${P([cx + dx, cy + dy])}A${n(rx)} ${n(ry)} ${deg} 1 0 ${P([cx - dx, cy - dy])}Z`; };
const el = (cls, d, extra = '') => `<path class="${cls}"${extra} d="${d}"/>`;
const hole = (cls, d) => `<path class="${cls}" fill-rule="evenodd" d="${d}"/>`;
const circleOnLine = (c, x) => [x, c[1] - Math.sqrt(c[2] ** 2 - (x - c[0]) ** 2)]; // top point at x

const items = [];

// ================= nature: tree on a hill, with the sun
{
  const front = [22, 104, 60], back = [52, 92, 48];
  const fl = circleOnLine(front, 0), fr = circleOnLine(front, 64);
  const [i1, i2] = inter(front, back); const I = i1[0] < i2[0] ? i1 : i2; // left crossing
  const br = circleOnLine(back, 64);
  const backHill = `M${P(I)}${arcTo(back, I, br, 1)}L${P(fr)}${arcTo(front, fr, I, 0)}Z`;
  const frontHill = `M${P(fl)}${arcTo(front, fl, fr, 1)}L64 64H0Z`;
  const C = [[35, 26.5, 7.5], [24, 31, 8.5], [12.5, 25, 8], [15, 14.5, 8.5], [25.5, 9.5, 8.5], [35, 16, 8]];
  const crown = union(C, [24, 21]);
  // shade: follow outline from junction of right-bottom circles round to the left-bottom, close with an inward arc
  const S = onC(C[5], -5), E = onC(C[2], 115), pt = crown.pts;
  const shade = `M${P(S)}${arcTo(C[5], S, pt[5])}${arcTo(C[0], pt[5], pt[0])}${arcTo(C[1], pt[0], pt[1])}${arcTo(C[2], pt[1], E)}A21 21 0 0 0 ${P(S)}Z`;
  const hi = { d: bean(13.2, 14.6, 4.2, 2.3, -48) + circ(18.6, 9.6, 1.5) };
  // trunk: from inside the crown's bottom to the hill, with a little branch
  const trunk = 'M20.5 49 C21.5 44 22 39 21.5 34 L19 30.5 C18.6 29.8 19.4 29.2 20 29.8 L23 33 L25.5 29 C26 28.3 27 28.8 26.6 29.6 L25.4 33.5 C25.3 39 26 44.5 27.5 49 Z';
  const sun = [51, 13, 7];
  let rays = '';
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + Math.PI / 8, r1 = 10, r2 = 13.2;
    rays += `M${P([sun[0] + r1 * Math.cos(a), sun[1] + r1 * Math.sin(a)])}L${P([sun[0] + r2 * Math.cos(a), sun[1] + r2 * Math.sin(a)])}`;
  }
  const svg = [
    el('t-b', backHill),
    el('t-a', frontHill),
    el('t-b', trunk),
    hole('t-a', crown.d + hi.d),
    el('t-c', hi.d),
    el('t-b', shade),
    hole('t-a', circ(...sun) + circ(48.5, 10.5, 2.4)),
    el('t-c', circ(48.5, 10.5, 2.4)),
    el('ln', rays),
    el('ln', 'M42.5 34q2.6-2.8 5.2 0q2.6-2.8 5.2 0'),
  ].join('');
  items.push({ id: 'nature', motif: 'tree on a hill with the sun', svg });
}

// ================= food: cupcake with a cherry
{
  const F = [[48, 26, 7], [51, 35, 5.6], [42.2, 38.2, 5.6], [32, 39.2, 5.6], [21.8, 38.2, 5.6], [13, 35, 5.6], [16, 26, 7], [23, 18, 7.2], [32, 12.5, 6.4], [41, 18, 7.2]];
  const fr = union(F, [32, 28]);
  // wrapper: sides are lines; the top follows the frosting's bottom scallops exactly
  const L0 = [9, 37], L1 = [16, 60], R0 = [55, 37], R1 = [48, 60];
  const onCircle = (c, a, b) => { // first intersection of segment a->b with circle c, going from a
    const dx = b[0] - a[0], dy = b[1] - a[1], fx = a[0] - c[0], fy = a[1] - c[1];
    const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), Cc = fx * fx + fy * fy - c[2] * c[2];
    const t = (-B + Math.sqrt(B * B - 4 * A * Cc)) / (2 * A); // exit point
    return [a[0] + t * dx, a[1] + t * dy];
  };
  const A = onCircle(F[5], L0, L1), B = onCircle(F[1], R0, R1);
  let top = `M${P(B)}${arcTo(F[1], B, fr.pts[1])}${arcTo(F[2], fr.pts[1], fr.pts[2])}${arcTo(F[3], fr.pts[2], fr.pts[3])}${arcTo(F[4], fr.pts[3], fr.pts[4])}${arcTo(F[5], fr.pts[4], A)}`;
  const wrapper = `${top}L15.5 58Q16 61 19 61H45Q48 61 48.5 58Z`;
  // pleats: dark strips on the wrapper, below the scallops
  const xs = [[18, 16.9, 21.4, 20.9], [27.3, 26.9, 30.9, 30.8], [36.2, 36.1, 40.2, 40.1], [45.5, 44.6, 49, 47.2]];
  let pleats = '';
  for (const [a, b, c, d] of xs) pleats += `M${a} 47.5L${b} 60.9H${d}L${c} 47.5Z`;
  // top band of the wrapper sits in shadow under the frosting
  const hi = { d: bean(19.6, 17.5, 3.6, 2, -52) + bean(11.5, 26.5, 2.8, 1.7, -80) };
  const fp = fr.pts, S = onC(F[9], -20), E = onC(F[2], 100);
  const shade = `M${P(S)}${arcTo(F[9], S, fp[9])}${arcTo(F[0], fp[9], fp[0])}${arcTo(F[1], fp[0], fp[1])}${arcTo(F[2], fp[1], E)}A26 26 0 0 0 ${P(S)}Z`;
  const svg = [
    hole('t-a', wrapper),
    el('t-b', pleats),
    hole('t-a', fr.d + hi.d),
    el('t-c', hi.d),
    el('t-b', shade),
    el('ln', 'M14.5 31.5C22 35.5 42 35.5 49.5 31.5M20 22.5C27 25.5 37 25.5 44 22.5'),
    el('t-b', circ(32, 7.6, 5.4)),
    el('t-c', circ(30.2, 5.8, 1.6)),
    el('ln', 'M33.5 2.6C34.5 1.2 36.5 0.8 38.5 1.4'),
  ].join('');
  items.push({ id: 'food', motif: 'cupcake with a cherry', svg });
}

// ================= sports: trophy
{
  const cup = 'M15 9H49V17C49 29.5 42 37.5 34 39H30C22 37.5 15 29.5 15 17Z';
  const shine = 'M20 13H23.5V20C23.5 25 25 29 27.5 32.5C23 30.5 20 25.5 20 19Z';
  // star on the cup
  let st = ''; for (let k = 0; k < 10; k++) { const r = k % 2 ? 3.1 : 7, a = -Math.PI / 2 + k * Math.PI / 5; st += (k ? 'L' : 'M') + P([32 + r * Math.cos(a), 22 + r * Math.sin(a)]); }
  st += 'Z';
  const handleL = 'M16.5 12.5H10.5C6.5 12.5 4 15.5 4 19.5C4 26.5 10 31 17.5 32.5L19 28.3C13.5 27 8.8 24 8.8 19.5C8.8 17.8 9.8 17 11.2 17H16.5Z';
  const handleR = 'M47.5 12.5H53.5C57.5 12.5 60 15.5 60 19.5C60 26.5 54 31 46.5 32.5L45 28.3C50.5 27 55.2 24 55.2 19.5C55.2 17.8 54.2 17 52.8 17H47.5Z';
  const svg = [
    hole('t-a', cup + shine),
    el('t-c', shine),
    el('t-b', 'M44.5 13H49V17C49 28 43 36.5 35 38.8C41 34 44.5 26 44.5 17Z'),
    el('t-b', st),
    el('t-b', handleL + handleR),
    el('t-b', 'M12.5 6.5H51.5Q53.5 6.5 53.5 8.5V9.5Q53.5 11.5 51.5 11.5H12.5Q10.5 11.5 10.5 9.5V8.5Q10.5 6.5 12.5 6.5Z'),
    el('t-a', 'M29.5 39H34.5V43.5C34.5 45.5 36 47 38.5 48H25.5C28 47 29.5 45.5 29.5 43.5Z'),
    el('t-b', 'M27.5 41.5H36.5V44H27.5Z'),
    el('t-a', 'M22.5 48H41.5L44 53.5H20Z'),
    el('t-b', 'M17.5 53.5H46.5Q48.5 53.5 48.5 55.5V59Q48.5 61 46.5 61H17.5Q15.5 61 15.5 59V55.5Q15.5 53.5 17.5 53.5Z'),
    el('t-c', 'M26 55.8H38Q39 55.8 39 56.8V57.8Q39 58.8 38 58.8H26Q25 58.8 25 57.8V56.8Q25 55.8 26 55.8Z'),
    el('ln', 'M6 3.5V8.5M3.5 6H8.5M58 36V40M56 38H60M7 38.5V41.5M5.5 40H8.5'),
  ].join('');
  items.push({ id: 'sports', motif: 'trophy with a star', svg });
}

// ================= animals: friendly cat face
{
  const head = 'M32 59C17 59 6 50.5 6 38.5C6 31.5 8 26 11.5 21.5L10.5 8.5Q10.3 4.8 13.6 6.4L24.5 14.2Q28 13.3 32 13.3Q36 13.3 39.5 14.2L50.4 6.4Q53.7 4.8 53.5 8.5L52.5 21.5C56 26 58 31.5 58 38.5C58 50.5 47 59 32 59Z';
  const earL = 'M14.2 11.2L21.8 16.6Q17.5 18.3 15 20.8Z';
  const earR = 'M49.8 11.2L42.2 16.6Q46.5 18.3 49 20.8Z';
  const muzzle = 'M32 40.4A6.4 6.4 0 1 0 32 50.6A6.4 6.4 0 1 0 32 40.4Z';
  const svg = [
    hole('t-a', head + earL + earR + muzzle),
    el('t-c', earL + earR + muzzle),
    el('t-b', 'M58 38.5C58 50.5 47 59 32 59C43.5 56 53 49 56.6 33.2C57.5 35 58 36.5 58 38.5Z'),
    el('t-b', ell(21.5, 33.5, 3.6, 4.4) + ell(42.5, 33.5, 3.6, 4.4)),
    el('t-c', circ(20.3, 31.8, 1.4) + circ(41.3, 31.8, 1.4)),
    el('t-b', 'M28.3 40.2H35.7Q37.2 40.2 36.2 41.5L33.1 44.8Q32 45.9 30.9 44.8L27.8 41.5Q26.8 40.2 28.3 40.2Z'),
    el('ln', 'M32 45.5V47.2M27.8 47.8Q30.2 50.2 32 47.4Q33.8 50.2 36.2 47.8'),
    el('ln', 'M17.5 42.5L3.5 40.5M18 46.5L4.5 49M46.5 42.5L60.5 40.5M46 46.5L59.5 49'),
    el('ln', 'M32 16.5V21.5M27 17.3L28 21.2M37 17.3L36 21.2'),
  ].join('');
  items.push({ id: 'animals', motif: 'friendly cat face', svg });
}

// ================= home: cosy house with chimney and smoke
{
  const body = 'M13 34H51V58H13Z';
  const win = (x, y) => `M${x} ${y}h3.4v3.4h-3.4ZM${x + 4.6} ${y}h3.4v3.4h-3.4ZM${x} ${y + 4.6}h3.4v3.4h-3.4ZM${x + 4.6} ${y + 4.6}h3.4v3.4h-3.4Z`;
  const wins = win(16.5, 39.5) + win(39.5, 39.5);
  const roof = 'M6.5 36.5Q3.5 36.5 5.5 34.2L30 11.5Q32 9.8 34 11.5L58.5 34.2Q60.5 36.5 57.5 36.5Z';
  const attic = circ(32, 25.5, 3.6);
  const svg = [
    el('t-a', 'M41 13.5H48.5V28H41Z'),
    el('t-b', 'M39.8 10.5H49.7Q50.7 10.5 50.7 11.5V13.3Q50.7 14.3 49.7 14.3H39.8Q38.8 14.3 38.8 13.3V11.5Q38.8 10.5 39.8 10.5Z'),
    hole('t-a', body + wins),
    el('t-c', wins),
    hole('t-b', roof + attic),
    el('t-c', attic),
    el('ln', 'M28.4 25.5H35.6M32 21.9V29.1'),
    el('t-b', 'M27.5 58V47.5A4.5 4.5 0 0 1 36.5 47.5V58Z'),
    el('t-c', circ(34.2, 52, 0.9)),
    el('t-b', 'M15.5 48.4H26V50.2H15.5ZM38 48.4H48.5V50.2H38Z'),
    el('t-b', 'M3 59.5Q3 57.5 5 57.5H59Q61 57.5 61 59.5V60Q61 62 59 62H5Q3 62 3 60Z'),
    el('t-b', 'M48.6 36.5H51V58H48.6Z'),
    el('t-c', circ(46, 7.3, 2.3) + circ(50.5, 4.2, 2.8) + circ(56.6, 3.3, 3.1)),
  ].join('');
  items.push({ id: 'home', motif: 'cosy house with smoking chimney', svg });
}

// ================= travel: hot-air balloon with clouds
{
  const env = 'M32 3C44.5 3 53 12 53 23C53 32.5 45.5 38.5 39.5 44H24.5C18.5 38.5 11 32.5 11 23C11 12 19.5 3 32 3Z';
  const gL = 'M32 3C25 7 21 16 21.5 25C22 33 25 39.5 28 44H24.5C18.5 38.5 11 32.5 11 23C11 12 19.5 3 32 3Z';
  const gR = 'M32 3C39 7 43 16 42.5 25C42 33 39 39.5 36 44H39.5C45.5 38.5 53 32.5 53 23C53 12 44.5 3 32 3Z';
  const hi = 'M16.5 18.5C17.5 13.5 20.5 10 24.5 8C22 12 20.7 16.5 20.3 21C19.5 22.5 16.2 21.5 16.5 18.5Z';
  const cloud = (d) => d;
  const c1 = 'M42.8 60.5C39 60.5 38.4 55 42 54.2C42 49.4 47.6 47.5 50.5 50.6C52.5 45.5 60 45.7 61 51.2C64.3 51.8 64 60.5 60 60.5Z';
  const c2 = 'M3.5 50.5C0.5 50.5 0.5 45.5 3.8 45.2C4.2 41.5 8.8 40.5 11 43C13 39.8 18.5 40.8 18.8 44.8C22 45.2 22 50.5 18.5 50.5Z';
  const svg = [
    hole('t-a', env + gL),
    el('t-c', gL),
    el('t-b', gR),
    el('t-b', 'M24 43H40Q41 43 41 44V45.5Q41 46.5 40 46.5H24Q23 46.5 23 45.5V44Q23 43 24 43Z'),
    el('ln', 'M25.5 46.5L28 52M38.5 46.5L36 52M32 46.5V52'),
    el('t-a', 'M26.5 52H37.5L36.5 59.5Q36.3 61 34.8 61H29.2Q27.7 61 27.5 59.5Z'),
    el('t-b', 'M26 51.5H38Q39 51.5 39 52.5V53.5Q39 54.5 38 54.5H26Q25 54.5 25 53.5V52.5Q25 51.5 26 51.5Z'),
    el('t-c', c1 + c2),
  ].join('');
  items.push({ id: 'travel', motif: 'hot-air balloon among clouds', svg });
}

fs.writeFileSync(DIR + 'group1.json', JSON.stringify(items, null, 1));
console.log('wrote', items.length);
