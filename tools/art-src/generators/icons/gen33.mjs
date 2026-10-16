// Generates part33.json (round 4).
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
const sh = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';

// ---------- alleyway
{
  let s = '';
  const VX = 32, VY = 33;
  const ly = (x0, y0, x) => y0 + (VY - y0) * (x - x0) / (VX - x0);
  const IL = 24, IR = 40, FY = ly(4, 60, IL), TY = ly(4, 4, IL);
  // window on a wall between outer heights a,b and x range
  const win = (ox, a, b, x1, x2) => poly([[x1, ly(ox, a, x1)], [x2, ly(ox, a, x2)], [x2, ly(ox, b, x2)], [x1, ly(ox, b, x1)]]);
  const wl = win(4, 9, 21, 7, 12) + win(4, 9, 21, 15, 18.4) + win(4, 9, 21, 20.4, 22.4);
  const wr = win(60, 9, 21, 57, 52) + win(60, 9, 21, 49, 45.6) + win(60, 9, 21, 43.6, 41.6);
  // rooflines: stepped, so the sky is a ragged gap rather than a ceiling
  const lr = [[4, 4], [15, 4], [IL, ly(15, 4, IL)]];
  const rr = [[60, 4], [49, 4], [45, ly(49, 4, 45)], [45, 14], [IR, ly(45, 14, IR)]];
  // narrow ragged gap of sky down to the far end, with two star holes
  s += P('t-c', poly([[15, 4], lr[2], [IL, FY], [IR, FY], rr[4], rr[3], rr[2], [49, 4]]) + spark(31, 12, 3) + spark(37.5, 7.5, 1.8), ' fill-rule="evenodd"');
  // far rooftops and a street lamp at the end of the path
  s += P('t-b', poly([[25.5, FY], [25.5, 35.5], [29, 35.5], [29, 33.5], [33, 33.5], [33, 36.5], [38.5, 36.5], [38.5, FY]]));
  s += P('t-b', cap(35, FY, 35, 26.5, 1.5) + cap(35, 26.6, 32, 26.6, 1.3));
  s += P('t-a', poly([[30.6, 27.6], [33.4, 27.6], [34, 30.6], [30, 30.6]]) + 'M31 26.6H33L33.4 27.6H30.6Z');
  // left wall t-a with chimney, right wall t-b, both with window holes
  s += R('t-a', 18.6, 7.4, 3.2, 7, .4);
  s += P('t-a', poly([...lr, [IL, FY], [4, 60]]) + wl, ' fill-rule="evenodd"');
  s += P('t-b', poly([...rr, [IR, FY], [60, 60]]) + wr, ' fill-rule="evenodd"');
  s += P('t-c', wr);
  // path narrowing to the door
  s += P('t-a', poly([[13, 60], [30.6, FY], [33.4, FY], [51, 60]]));
  // hanging sign off the left wall
  s += L('M5.5 27.5H18.5', 1.6) + L('M9.5 27.5V30M16 27.5V30', 1);
  s += P('t-b', rpoly([[7.5, 30], [18, 30], [18, 38.5], [7.5, 38.5]], 1.2));
  s += P('t-a', 'M10 35.6H15.5L15 32.8H10.5Z');
  s += P('t-a', 'M15.3 33.4Q17 33.4 16.6 35.2');
  // bin in the foreground
  s += P('t-b', rpoly([[8.5, 44.5], [24, 44.5], [23.5, 59.5], [9, 59.5]], 2));
  s += P('t-a', rpoly([[10.5, 47.5], [22, 47.5], [21.4, 58], [11.1, 58]], 1.5));
  s += R('t-a', 9.3, 45.1, 13.9, 2.4, 1);
  s += L('M14.3 49.5V56M18.3 49.5V56', 1.2);
  add('alleyway', 'narrow alley between two walls with windows, sign, bin and a lamp at the far end', s);
}

// ---------- tree-lined-avenue
{
  let s = '';
  const VX = 32, VY = 27;
  let dash = '';
  const pt = t => VY + (60 - VY) * t;
  for (const [a, b] of [[1, .8], [.62, .48], [.37, .29]]) dash += poly([[VX - 1.6 * a, pt(a)], [VX + 1.6 * a, pt(a)], [VX + 1.6 * b, pt(b)], [VX - 1.6 * b, pt(b)]]);
  s += P('t-b', poly([[13, 60], [VX - .8, VY], [VX + .8, VY], [51, 60]]) + dash, ' fill-rule="evenodd"');
  s += P('t-a', poly([[6, 60], [13, 60], [VX - .8, VY], [VX - 1.3, VY]]) + poly([[58, 60], [51, 60], [VX + .8, VY], [VX + 1.3, VY]]));
  const tr = [[11.5, 55, 7.4], [19.6, 44, 5], [24.8, 37.4, 3.3], [28.2, 32.8, 2.1]];
  let trunk = '', can = '', shade = '', hi = '';
  for (const [x0, gy, r] of [...tr].reverse()) for (const x of [x0, 64 - x0]) {
    const cy = gy - r * 3.4;
    trunk += cap(x, gy, x, cy + r * .5, Math.max(r * .36, .9));
    can += circ(x, cy, r);
    if (r > 3) shade += `M${f(x - r)} ${f(cy)}A${f(r)} ${f(r)} 0 0 0 ${f(x + r)} ${f(cy)}A${f(r)} ${f(r * .55)} 0 0 1 ${f(x - r)} ${f(cy)}Z`;
    if (r > 4) hi += E('t-c', x - r * .35, cy - r * .4, r * .32, r * .2, -30);
  }
  s += P('t-b', trunk) + P('t-a', can) + P('t-b', shade) + hi;
  // lamp posts on the pavement between the first two trees
  for (const x of [15.6, 48.4]) {
    const d = x < 32 ? 1 : -1;
    s += P('t-b', cap(x, 51, x, 34, 1.7) + cap(x, 34.2, x + 3 * d, 34.2, 1.4)) + P('t-b', poly([[x + 1.6 * d, 34.4], [x + 4.4 * d, 34.4], [x + 5 * d, 36.4], [x + d, 36.4]]));
    s += P('t-c', circ(x + 3 * d, 38, 1.1));
  }
  s += P('t-c', spark(32, 10, 3.6) + spark(23, 6.5, 2) + spark(42, 15, 2));
  add('tree-lined-avenue', 'boulevard in perspective lined with round trees and lamps', s);
}

// ---------- shopping-bag
{
  let s = '';
  // back bag with tissue
  s += P('t-c', 'M9 19L11 8L15.5 15L19 5L22.5 14.5L27.5 7.5L28 19Z');
  s += L('M11 8L13 19M19 5L19 19M27.5 7.5L24.5 19', 1);
  s += P('t-b', rpoly([[6.5, 18], [30.5, 18], [31, 52], [5.5, 52]], 1.5));
  // front bag
  const bag = [[19, 25], [47, 25], [48, 59.5], [18, 59.5]];
  const logo = circ(33, 43, 5.5);
  s += P('t-a', rpoly(bag, 1.5) + logo, ' fill-rule="evenodd"');
  s += P('t-b', poly([[47, 25], [54, 28], [55.5, 57.5], [48, 59.5]]));
  s += P('t-b', 'M47.2 31L51 28.8L51.7 56.7L47.8 58Z');
  s += R('t-b', 19, 25, 28, 3.4) ;
  // logo: heart in the hole
  s += P('t-b', 'M33 47.2L29.4 43.4Q28 41.8 29.2 40.5Q30.8 39.1 33 41.2Q35.2 39.1 36.8 40.5Q38 41.8 36.6 43.4Z');
  // rope handles
  s += L('M26 27.2Q24.5 10 33 10Q41.5 10 40 27.2', 2.6);
  s += P('t-b', circ(26, 28, 1.6) + circ(40, 28, 1.6));
  // tag on string
  s += L('M40.6 18Q46 18 48.5 21', 1);
  const tag = [[47, 19.5], [54, 16.5], [58, 25], [51, 28]];
  s += P('t-a', rpoly(tag, 1.2) + circ(49.8, 21, 1.1), ' fill-rule="evenodd"');
  s += L('M51.5 24.8L55.4 23.1', 1.1);
  s += P('t-c', spark(57, 7, 3.4) + spark(8, 58, 2.6) + spark(44, 7, 2));
  add('shopping-bag', 'paper shopping bag with rope handles and tag, second bag with tissue', s);
}

// ---------- lectern
{
  let s = '';
  // microphone on gooseneck
  s += L('M43 22Q45 14 40 11.5', 1.8);
  s += P('t-a', rpoly([[36, 5.5], [40.5, 8], [38.3, 12.3], [33.8, 9.8]], 2));
  s += L('M36.6 7.6L39.6 9.3M35.8 9.4L38.6 11', 1);
  s += P('t-b', cap(42.5, 21, 44, 22.5, 3));
  // slanted top with open book cut out
  const top = [[11, 26], [16, 17], [48, 17], [53, 26]];
  const book = 'M22 25L24.5 17.5Q28.5 16.5 32 18.5Q35.5 16.5 39.5 17.5L42 25Q37 23.5 32 25.5Q27 23.5 22 25Z';
  s += P('t-a', rpoly(top, 1.2) + book, ' fill-rule="evenodd"');
  s += P('t-c', book);
  s += L('M32 18.8V25.2M26 20H29.5M25.4 22H29.5M34.5 20H38M34.5 22H38.6', .8);
  // front lip
  s += R('t-b', 9.5, 25.5, 45, 4.2, 1.5);
  // body with crest hole
  const body = [[14, 29.5], [50, 29.5], [47.5, 54], [16.5, 54]];
  const crest = 'M26 35H38V42Q38 47.5 32 50.5Q26 47.5 26 42Z';
  s += P('t-a', poly(body) + crest, ' fill-rule="evenodd"');
  // side panels shade
  s += P('t-b', poly([[14, 29.5], [19, 29.5], [20.5, 54], [16.5, 54]]) + poly([[50, 29.5], [45, 29.5], [43.5, 54], [47.5, 54]]));
  // crest: inner chevron and star
  s += P('t-b', 'M28 40.5L32 44.5L36 40.5V43L32 47L28 43Z' + poly(star(32, 38.4, 2.2, 1, 5)));
  // grain
  s += L('M22.5 33Q23.5 43 23 52M41.5 33Q40.5 43 41 52', .8);
  // plinth
  s += P('t-b', rpoly([[12, 53.5], [52, 53.5], [54, 59.5], [10, 59.5]], 1.2));
  s += P('t-c', spark(8, 9, 3.4) + spark(56, 8, 2.6) + spark(57, 42, 2));
  add('lectern', 'wooden lectern with microphone, open page and carved crest', s);
}

// ---------- finish-line
{
  let s = '';
  // posts
  s += P('t-b', cap(8, 6, 8, 58, 3.6) + cap(56, 6, 56, 58, 3.6)) + P('t-b', rpoly([[4, 57], [12, 57], [12, 60], [4, 60]], 1) + rpoly([[52, 57], [60, 57], [60, 60], [52, 60]], 1));
  // checkered banner: t-a with alternating holes
  let holes = '';
  const bx = 10, by = 8.5, cw = 4, ch = 4;
  for (let i = 0; i < 11; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) holes += `M${f(bx + i * cw)} ${f(by + j * ch + 1.2)}h${cw}v${ch}h${-cw}Z`;
  s += P('t-a', `M${bx} ${by}H${bx + 44}V${by + 10.4}H${bx}Z` + holes, ' fill-rule="evenodd"');
  s += R('t-b', bx, by, 44, 1.4) + R('t-b', bx, by + 9.2, 44, 1.4);
  // runner, front view, arms up
  const hx = 32, hy = 26;
  s += P('t-a', circ(hx, hy, 3.8));
  const torso = [[27.5, 31.2], [36.5, 31.2], [35.5, 44.5], [28.5, 44.5]];
  s += P('t-a', rpoly(torso, 1.2)) + P('t-a', 
    limb([[29.4, 33.4], [24, 27], [21.5, 21]], 3.4) + limb([[34.6, 33.4], [40, 27], [42.5, 21]], 3.4) +
    limb([[30, 43], [28.5, 51], [27.5, 58.5]], 4) + limb([[34, 43], [38.5, 49.5], [36.5, 55.5]], 4));
  s += P('t-a', 'M24 59.5H30.5V57.5Q30.5 56.5 29.5 56.5H25.5Q24 56.5 24 58Z');
  s += P('t-b', 'M35.5 44.5L34.8 41L29.2 41L28.5 44.5Z');
  // tape: taut to the chest on the left, snapped and fluttering on the right
  s += P('t-b', 'M9.5 32.5L28 35.2V38L9.5 35.3Z' + 'M27.6 35.2Q32 36.4 36.5 35.2L36.4 38Q32 39.2 27.6 38Z' +
    'M36.4 35.2Q40 35 42 37.2Q43.5 39 45.5 38.4L44.8 41.2Q42 41.8 40.3 39.6Q38.8 37.8 36.4 38Z' +
    'M54.5 32.5Q52 35 53 38Q54 41 51.5 44L49.2 42.6Q51 40.4 50.2 38Q49.4 35 52 32.5Z');
  s += P('t-c', spark(20, 51, 3) + spark(45, 52, 2.4) + spark(15, 28, 2));
  add('finish-line', 'checkered finish banner on posts, runner breaking the tape', s);
}

// ---------- teacher
{
  let s = '';
  // board on the wall
  const bd = [[39, 7], [59, 7], [59, 31], [39, 31]];
  s += P('t-b', rpoly(bd, 1.5) + 'M41 9H57V29H41Z', ' fill-rule="evenodd"');
  s += P('t-c', rpoly([[41, 9], [57, 9], [57, 29], [41, 29]], 1));
  // ABC
  s += L('M42.4 18.5L44.2 12L46 18.5M43 16.4H45.4' + 'M47.6 12V18.5H49.4Q51 18.5 51 16.8Q51 15.2 49.3 15.2H47.6M47.6 12H49.1Q50.5 12 50.5 13.6Q50.5 15.2 49.1 15.2' + 'M56 13.2Q55.4 12 54.2 12Q52.4 12 52.4 15.2Q52.4 18.5 54.2 18.5Q55.4 18.5 56 17.3' + 'M43 23.5Q45 22 47 23.5T51 23.5T55 23.5', 1.2);
  // body
  const body = [[12, 27], [28, 27], [34, 35], [35, 53], [5, 53], [6, 35]];
  const collar = 'M16.5 27.5H23.5L20 34Z';
  s += P('t-a', rpoly(body, [3, 3, 4, 1, 1, 4]) + collar, ' fill-rule="evenodd"');
  s += P('t-c', collar);
  // cardigan front shade and buttons
  s += P('t-b', 'M6.4 36L11 31L13 53H5.4Z');
  s += P('t-b', circ(20, 39, 1.2) + circ(20, 45, 1.2));
  s += L('M16.5 27.5L20 35L23.5 27.5M20 35V52', 1.2);
  // raised arm with pointer
  s += P('t-a', limb([[30, 33], [37.5, 41], [40.5, 35]], 6));
  s += P('t-b', cap(34.5, 39, 37.8, 42.2, 3));
  s += L('M40 35.5L48.5 22', 1.6);
  s += P('t-a', circ(40.6, 34.6, 2.6));
  // head
  const hx = 20, hy = 17;
  s += P('t-a', circ(hx, hy, 7.2));
  s += P('t-b', `M${hx - 7.4} ${hy + 1}Q${hx - 8} ${hy - 9} ${hx} ${hy - 8.6}Q${hx + 8} ${hy - 9} ${hx + 7.4} ${hy + 1}Q${hx + 5.5} ${hy - 4} ${hx} ${hy - 5}Q${hx - 5.5} ${hy - 4} ${hx - 7.4} ${hy + 1}Z` + circ(hx, hy - 10, 3.4));
  // glasses
  s += L(`M${hx - 6} ${hy}A2.8 2.8 0 1 0 ${hx - .6} ${hy}A2.8 2.8 0 1 0 ${hx - 6} ${hy}ZM${hx + .6} ${hy}A2.8 2.8 0 1 0 ${hx + 6} ${hy}A2.8 2.8 0 1 0 ${hx + .6} ${hy}ZM${hx - .6} ${hy}H${hx + .6}`, 1.3);
  s += P('t-b', circ(hx - 3.3, hy, .9) + circ(hx + 3.3, hy, .9));
  s += L(`M${hx - 2} ${hy + 4.2}Q${hx} ${hy + 5.6} ${hx + 2} ${hy + 4.2}`, 1.1);
  // desk and apple
  s += P('t-b', rpoly([[4, 52], [60, 52], [60, 59.5], [4, 59.5]], 1.2));
  const ax = 50, ay = 46.5;
  const ahl = `M${ax - 3.4} ${ay - 1}Q${ax - 3} ${ay - 3.2} ${ax - 1.2} ${ay - 3.4}L${ax - 1.4} ${ay - 2.2}Q${ax - 2.6} ${ay - 1.9} ${ax - 2.4} ${ay - .6}Z`;
  s += P('t-a', `M${ax} ${ay - 3.4}Q${ax - 3} ${ay - 5.6} ${ax - 5} ${ay - 2.6}Q${ax - 6.6} ${ay + 1.5} ${ax - 2.4} ${ay + 5.4}Q${ax - 1} ${ay + 6.2} ${ax} ${ay + 5.2}Q${ax + 1} ${ay + 6.2} ${ax + 2.4} ${ay + 5.4}Q${ax + 6.6} ${ay + 1.5} ${ax + 5} ${ay - 2.6}Q${ax + 3} ${ay - 5.6} ${ax} ${ay - 3.4}Z` + ahl, ' fill-rule="evenodd"');
  s += P('t-c', ahl);
  s += L(`M${ax} ${ay - 3}Q${ax} ${ay - 5.5} ${ax + 1} ${ay - 7}`, 1.2);
  s += P('t-b', `M${ax + .6} ${ay - 5.4}Q${ax + 3} ${ay - 8} ${ax + 5} ${ay - 6.4}Q${ax + 3} ${ay - 4} ${ax + .6} ${ay - 5.4}Z`);
  s += P('t-c', spark(9, 7, 3) + spark(31, 6, 2));
  add('teacher', 'teacher with glasses pointing at an ABC board, apple on desk', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part33.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
