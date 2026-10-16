// Generates part29.json (round 4).
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
// ---------- family-group
{
  let s = '';
  // woman (left), child (middle), man (right)
  let a = circ(13, 10, 5.3) + circ(32, 29, 4.3) + circ(51, 10, 5.3);
  a += rpoly([[9, 17.5], [17, 17.5], [20.5, 43], [5.5, 43]], [3, 3, 1.5, 1.5]);
  a += cap(10.6, 42, 10.6, 58, 4.4) + cap(15.4, 42, 15.4, 58, 4.4);
  a += cap(8, 20, 4.3, 35, 4.2) + cap(18.5, 20, 25.4, 39.4, 4.2);
  a += rpoly([[45.5, 17.5], [56.5, 17.5], [56, 40], [46, 40]], [3, 3, 1, 1]);
  a += cap(48.3, 38, 48.3, 58, 4.4) + cap(53.7, 38, 53.7, 58, 4.4);
  a += cap(57.5, 20, 59.5, 37, 4.2) + cap(44.5, 20, 38.6, 39.4, 4.2);
  a += rpoly([[28.3, 34.5], [35.7, 34.5], [35.3, 47], [28.7, 47]], [2, 2, 1, 1]);
  a += cap(30, 46, 30, 58, 3.4) + cap(34, 46, 34, 58, 3.4);
  a += cap(29, 36.3, 26.4, 40, 3) + cap(35, 36.3, 37.6, 40, 3);
  s += P('t-a', a);
  s += P('t-a', circ(26, 40, 2.6) + circ(38, 40, 2.6));
  // shade
  s += P('t-b', 'M13 4.7A5.3 5.3 0 0 1 13 15.3A6 6 0 0 0 13 4.7Z' + 'M51 4.7A5.3 5.3 0 0 1 51 15.3A6 6 0 0 0 51 4.7Z');
  s += P('t-b', 'M16.6 18.5L19.9 41.4L13.5 41.4Z' + 'M53.6 18.5L55.6 18.5Q56.5 18.5 56.5 19.5L56 39Q56 40 55 40L53.6 40Z' + 'M34 35.5L35.6 35.5L35.3 46.5L34 46.5Z');
  s += P('t-b', cap(15.4, 50, 15.4, 58, 4.4) + cap(53.7, 50, 53.7, 58, 4.4) + cap(34, 52, 34, 58, 3.4));
  // bun
  s += P('t-a', circ(8.2, 6.4, 2.8));
  // heart
  const hx = 32, hy = 14;
  s += P('t-b', `M${hx} ${hy + 6}C${hx - 9} ${hy}${' '}${hx - 6} ${hy - 7} ${hx} ${hy - 3}C${hx + 6} ${hy - 7} ${hx + 9} ${hy} ${hx} ${hy + 6}Z`);
  s += P('t-c', spark(4.5, 50, 2.5) + spark(59.5, 49, 2.3) + spark(41.5, 25, 2));
  add('family-group', 'two adults and a child holding hands', s);
}
// ---------- hands-in (side view: hands stacked palm-down, alternating sides and tones)
{
  let s = '';
  // mitten hand pointing +x, wrist at 0, with a slit cut to mark the thumb
  const hand = 'M1 -4.6Q9 -5.4 17 -4.3Q23.5 -3.3 24.5 .6Q24.9 4.7 20.5 4.7H1A4.6 4.6 0 0 1 1 -4.6Z';
  // thumb outline: a cut from the wrist forward, curling down through the lower edge
  const slit = 'M5 -.6Q13 -1.2 17.3 1.3Q19.4 2.8 18.6 5H17.1Q17.7 3.2 16.4 2.4Q12.5 .4 5 .8Z';
  const hands = [ // [wrist x, y, dir, arm start, fill, sleeve]
    [44.5, 49.6, -1, [54.5, 55.5], 't-b', 't-a'],
    [19.5, 38.4, 1, [9.5, 45.5], 't-a', 't-b'],
    [44.5, 27.2, -1, [55, 22], 't-b', 't-a'],
    [19.5, 16, 1, [9.5, 9], 't-a', 't-b'],
  ];
  for (const [wx, wy, d, [sx, sy], c, sl] of hands) {
    const ex = wx + d * 2, l = Math.hypot(ex - sx, wy - sy), ux = (ex - sx) / l, uy = (wy - sy) / l, h = 5.6;
    s += P(c, cap(sx + 1.5 * ux, sy + 1.5 * uy, ex, wy, 8.4));
    s += `<g transform="translate(${wx} ${wy})${d < 0 ? ' scale(-1 1)' : ''}">${P(c, hand + slit, ' fill-rule="evenodd"')}</g>`;
    const a0 = [sx - 3 * ux, sy - 3 * uy], a1 = [sx + 3.5 * ux, sy + 3.5 * uy];
    s += P(sl, rpoly([[a0[0] - uy * h, a0[1] + ux * h], [a1[0] - uy * h, a1[1] + ux * h], [a1[0] + uy * h, a1[1] - ux * h], [a0[0] + uy * h, a0[1] - ux * h]], 1.8));
  }
  s += P('t-c', spark(55, 8, 3.2) + spark(8, 58, 2.6) + spark(30, 6, 2.2));
  add('hands-in', 'hands stacked palm-down in a team huddle', s);
}
// ---------- hammock
{
  let s = '';
  // sun
  s += P('t-c', circ(32, 12, 5));
  // sand
  s += P('t-b', 'M3.5 60Q32 52 60.5 60Z');
  // trunks
  const trunk = (x0, x1, lean) => `M${x0 - 3} 59Q${x0 - 3 + lean} 36 ${x1 - 2} 13H${x1 + 2}Q${x0 + 3 + lean} 36 ${x0 + 3} 59Z`;
  s += P('t-a', trunk(11, 13, -2) + trunk(53, 51, 2));
  let bands = '';
  for (const y of [22, 30, 38, 46, 54]) bands += `M8.5 ${y}h6v1.6h-6zM49.5 ${y}h6v1.6h-6z`;
  s += P('t-b', bands);
  // fronds
  const frond = (cx, cy, ang, len) => {
    const a = ang * Math.PI / 180, ex = cx + len * Math.cos(a), ey = cy + len * Math.sin(a);
    const mx = (cx + ex) / 2, my = (cy + ey) / 2 - len * .32, nx = -Math.sin(a) * 4.6, ny = Math.cos(a) * 4.6;
    return `M${f(cx)} ${f(cy)}Q${f(mx - nx)} ${f(my - ny)} ${f(ex)} ${f(ey)}Q${f(mx + nx * .4)} ${f(my + ny * .4 + 2)} ${f(cx)} ${f(cy)}Z`;
  };
  let fr = '', frb = '';
  for (const [cx, sg] of [[13, 1], [51, -1]]) {
    fr += frond(cx, 12, sg > 0 ? 196 : -16, 10.5) + frond(cx, 12, sg > 0 ? 14 : 166, 14) + frond(cx, 12, -90 - 25 * sg, 9.5);
    frb += frond(cx, 12.5, sg > 0 ? 150 : 30, 10) + frond(cx, 12.5, sg > 0 ? 45 : 135, 11);
  }
  s += P('t-b', frb) + P('t-a', fr);
  s += P('t-b', circ(13, 13, 2.2) + circ(51, 13, 2.2));
  // pillow (behind hammock front)
  s += P('t-c', rpoly([[16.5, 27], [25, 25], [27.5, 33], [19, 35]], 3));
  s += L(rpoly([[16.5, 27], [25, 25], [27.5, 33], [19, 35]], 3), 1.2);
  // ropes
  s += L('M14 28L19 33M14 28L20 35.5M50 28L45 33M50 28L44 35.5', 1.3);
  // hammock with stripes cut
  const top = 'M18 32.5Q32 46 46 32.5', bot = 'Q32 58 18 32.5Z';
  let st = '';
  for (const x of [25.5, 32, 38.5]) { const d = (x - 32) / 14; st += `M${f(x - 1.4)} ${f(39.2 - d * d * 6.7 * 0 + Math.abs(d) * -3)}L${f(x + 1.4)} ${f(39.2 + Math.abs(d) * -3)}L${f(x + 1.4)} ${f(45.5 - Math.abs(d) * 6)}L${f(x - 1.4)} ${f(45.5 - Math.abs(d) * 6)}Z`; }
  s += P('t-a', top + 'L46 33.5' + bot.replace('Z', 'Z'), ' fill-rule="evenodd"');
  s += P('t-b', 'M19 34Q32 48 45 34Q32 52 19 34Z');
  s += P('t-c', spark(5, 25, 2.4) + spark(59, 25, 2.4));
  add('hammock', 'hammock slung between two palm trunks with a pillow', s);
}
// ---------- lollipop
{
  let s = '';
  const cx = 27, cy = 23, R0 = 18.5;
  // stick
  s += R('t-c', 24.8, 38, 4.4, 22, 2.2);
  s += L('M24.8 40V57.8Q24.8 60 27 60Q29.2 60 29.2 57.8V40', 1.2);
  // candy disc
  s += P('t-a', circ(cx, cy, R0));
  // spiral band
  const b = 6.6 / (2 * Math.PI), w = 1.75; let o = [], i = [];
  for (let t = 0.6; t <= 2 * Math.PI * 2.7; t += .32) {
    const r = b * t + 1.6, ca = Math.cos(t), sa = Math.sin(t);
    o.push([cx + Math.min(r + w, R0) * ca, cy + Math.min(r + w, R0) * sa]); i.push([cx + (r - w) * ca, cy + (r - w) * sa]);
  }
  s += P('t-b', 'M' + o.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'L' + i.reverse().map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z');
  // gloss
  s += P('t-c', `M${f(cx - 14)} ${f(cy - 4)}A15 15 0 0 1 ${f(cx - 4)} ${f(cy - 14.5)}A2 2 0 0 1 ${f(cx - 3.5)} ${f(cy - 11.5)}A12 12 0 0 0 ${f(cx - 11)} ${f(cy - 3.5)}A2 2 0 0 1 ${f(cx - 14)} ${f(cy - 4)}Z`);
  // bow
  s += P('t-b', rpoly([[27, 43], [19, 39], [18.5, 47], [27, 44.5], [35.5, 47], [35, 39]], 1.5) + circ(27, 43.7, 2.4));
  // wrapped sweet
  let g = '';
  g += P('t-b', rpoly([[-5, 0], [-12, -6], [-12.5, 6]], 1.5) + rpoly([[5, 0], [12, -6], [12.5, 6]], 1.5));
  g += P('t-a', `M-7 0A7 5.4 0 1 0 7 0A7 5.4 0 1 0 -7 0ZM-4.5 -2.4Q-2 -4.2 1 -4L.6 -2.8Q-2 -2.8 -3.6 -1.4Z`, ' fill-rule="evenodd"');
  g += P('t-b', 'M-1.5 -5.3L1.5 -5.3L-1.5 5.3L-4.5 5Z' + 'M4 -4.4L6 -3L4 4L1.5 5.2Z');
  g += P('t-c', 'M-4.5 -2.4Q-2 -4.2 1 -4L.6 -2.8Q-2 -2.8 -3.6 -1.4Z');
  s += `<g transform="translate(47.5 52) rotate(-18)">${g}</g>`;
  s += P('t-c', spark(55, 9, 3.2) + spark(52, 30, 2.4) + spark(8, 54, 2.6));
  add('lollipop', 'swirl lollipop on a stick beside a wrapped sweet', s);
}
// ---------- fizzy-drink
{
  let s = '';
  // straw (behind glass top)
  s += P('t-a', cap(34, 44, 41, 7, 4) + cap(41, 7, 50, 4.5, 4));
  s += P('t-b', cap(36.8, 29.5, 37.6, 25.3, 4.2) + cap(38.2, 22, 39, 17.8, 4.2) + cap(39.6, 14.5, 40.4, 10.3, 4.2) + cap(44.5, 6, 47, 5.3, 4.1));
  // glass
  const glass = [[12, 15], [52, 15], [47.5, 60], [16.5, 60]];
  s += P('t-c', rpoly(glass, 2));
  s += L(rpoly(glass, 2), 1.4);
  // liquid with ice cubes and bubbles cut out
  const ice1 = rpoly([[20, 30], [28, 28], [30, 36], [22, 38]], 1.5), ice2 = rpoly([[33, 33], [40, 30.5], [42.5, 37.5], [35.5, 40]], 1.5);
  let holes = ice1 + ice2;
  for (const [x, y, r] of [[25, 45, 1.8], [31, 50, 1.4], [38, 46, 2], [22, 53, 1.3], [41, 54, 1.5], [33, 43.5, 1.1], [28, 56, 1]]) holes += circ(x, y, r);
  s += P('t-a', rpoly([[15.2, 26], [48.8, 26], [45.2, 56.5], [18.8, 56.5]], [.5, .5, 2, 2]) + holes, ' fill-rule="evenodd"');
  s += P('t-b', rpoly([[42, 26], [48.8, 26], [45.2, 56.5], [40, 56.5]], [.5, .5, 2, .5]));
  s += P('t-a', 'M23.5 30.5L27 29.7L27.8 32.3Z');
  s += R('t-b', 17, 57.2, 30, 1.6, .8);
  // rising bubbles
  s += L(circ(27, 20.5, 1.6) + circ(23, 11, 1.4) + circ(30, 8, 1.1) + circ(33, 17, 1.2), 1.1);
  s += L(circ(28, 5.5, 1) , 1);
  // lemon slice on rim
  const lx = 13.5, ly = 16, lr = 8.5; let seg = '';
  for (let k = 0; k < 6; k++) { const a0 = (k * 60 + 8) * Math.PI / 180, a1 = (k * 60 + 52) * Math.PI / 180, r = 6.2;
    seg += `M${f(lx + 1.1 * Math.cos((a0 + a1) / 2))} ${f(ly + 1.1 * Math.sin((a0 + a1) / 2))}L${f(lx + r * Math.cos(a0))} ${f(ly + r * Math.sin(a0))}A${r} ${r} 0 0 1 ${f(lx + r * Math.cos(a1))} ${f(ly + r * Math.sin(a1))}Z`; }
  s += P('t-a', circ(lx, ly, lr) + seg, ' fill-rule="evenodd"');
  s += P('t-c', seg);
  s += P('t-b', `M${lx + lr} ${ly}A${lr} ${lr} 0 0 1 ${lx - lr} ${ly}A${lr} ${lr * 1.15} 0 0 0 ${lx + lr} ${ly}Z`.replace(/(\d+\.\d{2,})/g, m => f(+m)));
  s += P('t-c', spark(58, 22, 2.8) + spark(5, 34, 2.4) + spark(57, 47, 2.2));
  add('fizzy-drink', 'fizzy drink with straw, ice, bubbles and a lemon slice', s);
}
// ---------- oven
{
  let s = '';
  // pots
  s += P('t-a', rpoly([[12, 7.5], [28, 7.5], [27.5, 18], [12.5, 18]], [1, 1, 1.5, 1.5]) + cap(9, 10.5, 12.5, 10.5, 2.6) + cap(27.5, 10.5, 31, 10.5, 2.6));
  s += P('t-b', 'M10.5 7.5Q20 2 29.5 7.5Z' + rpoly([[18, 2.5], [22, 2.5], [21.5, 5], [18.5, 5]], .8) + 'M23 7.5H28L27.6 18H23Z');
  s += P('t-a', rpoly([[37, 10], [50, 10], [49.5, 18], [37.5, 18]], [1, 1, 1.5, 1.5]) + cap(49, 11.5, 59, 9, 3));
  s += P('t-b', 'M45.5 10H50L49.6 18H45.5Z');
  s += R('t-b', 35.5, 8.4, 16, 2.4, 1.2);
  // steam
  s += L('M34 3Q32 5 34 7M41 2Q39 4 41 6', 1.3);
  // body with control panel knobs and door window cut
  const win = rpoly([[15, 33], [49, 33], [49, 49], [15, 49]], 3);
  s += P('t-a', rpoly([[7, 18], [57, 18], [57, 59], [7, 59]], [1, 1, 2.5, 2.5]) + win, ' fill-rule="evenodd"');
  s += P('t-c', win);
  // dish in the oven
  s += P('t-b', 'M21 45H43L41 48H23Z' + 'M23.5 45Q24 38.5 32 38.5Q40 38.5 40.5 45Z');
  s += P('t-c', 'M27 41.5Q29 39.8 32 39.8L31.6 41Q29.5 41 27.8 42.3Z');
  // hob slab, panel line, door handle, feet, shade
  s += R('t-b', 5, 16.5, 54, 3, 1.2);
  s += R('t-b', 7, 27.5, 50, 1.6);
  s += R('t-b', 18, 30, 28, 2, 1);
  s += P('t-b', circ(14, 23.5, 2.2) + circ(22, 23.5, 2.2) + circ(42, 23.5, 2.2) + circ(50, 23.5, 2.2));
  s += R('t-b', 28, 22.2, 8, 2.8, 1);
  s += R('t-b', 7, 53, 50, 1.6);
  s += P('t-b', 'M9 59H15V61.5H9ZM49 59H55V61.5H49Z');
  s += P('t-c', spark(4.5, 6, 2.6) + spark(4, 38, 2.2) + spark(60, 40, 2.2));
  add('oven', 'kitchen range with pots on the hob and a glowing oven window', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part29.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
