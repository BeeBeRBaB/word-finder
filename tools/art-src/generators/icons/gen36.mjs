// Generates part17.json (round 3, batches 23-34).
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
// arc band centred on (cx,cy), radius r, width w, from angle a0 to a1 (degrees), round ends
const band = (cx, cy, r, w, a0, a1) => {
  const ro = r + w / 2, ri = r - w / 2, h = w / 2, pt = (rr, a) => { const t = a * Math.PI / 180; return `${f(cx + rr * Math.cos(t))} ${f(cy + rr * Math.sin(t))}`; };
  const lg = a1 - a0 > 180 ? 1 : 0;
  return `M${pt(ro, a0)}A${f(ro)} ${f(ro)} 0 ${lg} 1 ${pt(ro, a1)}A${f(h)} ${f(h)} 0 0 1 ${pt(ri, a1)}A${f(ri)} ${f(ri)} 0 ${lg} 0 ${pt(ri, a0)}A${f(h)} ${f(h)} 0 0 1 ${pt(ro, a0)}Z`;
};
const rr = (x, y, w, h, r) => rpoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
const sq = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- desktop-computer
{
  let s = '';
  // screen glow, under the bezel
  s += R('t-c', 7.7, 8.7, 34.6, 23.6);
  // monitor bezel with screen cut out
  s += P('t-a', rr(5, 6, 40, 31, 3) + sq(8, 9, 34, 23), ' fill-rule="evenodd"');
  s += P('t-b', 'M5.2 34.5H44.8V35Q44.8 37 42 37H8Q5.2 37 5.2 35Z');
  // windows with content lines cut out
  const win = (x, y, w, h) => { let d = rr(x, y, w, h, 1); for (let k = 0; k < 3; k++) d += sq(x + 2, y + 4.6 + k * 2.4, (k === 2 ? .5 : .75) * (w - 4), 1.1); return d; };
  s += P('t-a', win(10.5, 11, 14, 11.5) + win(25.5, 14.5, 14.5, 12), ' fill-rule="evenodd"');
  s += P('t-b', 'M11.5 11H23.5Q24.5 11 24.5 12V13.4H10.5V12Q10.5 11 11.5 11Z' + 'M26.5 14.5H39Q40 14.5 40 15.5V16.9H25.5V15.5Q25.5 14.5 26.5 14.5Z');
  s += R('t-b', 8, 29.4, 34, 2.6);
  // stand
  s += R('t-b', 22.5, 37, 5, 5);
  s += P('t-a', rpoly([[19, 41.5], [31, 41.5], [34.5, 45.5], [15.5, 45.5]], 1));
  // tower with power light and drive bays cut out
  s += P('t-a', rr(47, 10, 12, 37, 2) + circ(53, 15.5, 2) + rr(49.3, 20.5, 7.4, 2.4, .6) + rr(49.3, 25, 7.4, 2.4, .6), ' fill-rule="evenodd"');
  s += P('t-c', circ(53, 15.5, 1));
  s += L('M50 33H56M50 35.5H56M50 38H56', 1.1);
  s += P('t-b', 'M47.2 43.5H58.8V45Q58.8 47 57 47H49Q47.2 47 47.2 45Z');
  // keyboard with keys cut out
  let keys = '';
  for (let r = 0; r < 2; r++) for (let k = 0; k < 8; k++) keys += sq(10.6 + r * .4 + k * 4.05, 50.4 + r * 2.3, 3, 1.5);
  keys += sq(17, 55, 18, 1.4);
  s += P('t-a', rpoly([[8.5, 48.8], [43.5, 48.8], [45.5, 57], [6.5, 57]], 1.2) + keys, ' fill-rule="evenodd"');
  s += P('t-b', 'M6.7 56.3H45.3L45.5 57.2Q45.6 58.8 44 58.8H8Q6.4 58.8 6.5 57.2Z');
  // mouse with cable to tower
  s += L('M53 49.5Q53 48 53 47', 1.2);
  s += E('t-a', 53, 54, 4.2, 5.2);
  s += L('M53 49V52.5', 1.1);
  s += P('t-b', 'M48.9 55.2A4.2 5.2 0 0 0 57.1 55.2A5 5 0 0 1 48.9 55.2Z');
  s += P('t-c', spark(9, 42, 3) + spark(55.5, 5, 2.6));
  add('desktop-computer', 'desktop monitor with windows, tower, keyboard and mouse', s);
}

// ---------- router
{
  let s = '';
  // antennas
  s += P('t-a', cap(13, 31, 10, 8.5, 4.2) + cap(51, 31, 54, 8.5, 4.2));
  // wifi waves
  s += P('t-a', circ(32, 26, 2.6) + band(32, 26, 7.5, 3.6, 225, 315) + band(32, 26, 13.5, 3.6, 225, 315) + band(32, 26, 19.3, 3.6, 228, 312));
  // body with status lights and vents cut out
  let holes = '';
  for (let k = 0; k < 5; k++) holes += circ(11.5 + k * 5, 43.5, 1.7);
  for (let k = 0; k < 4; k++) holes += rr(40 + k * 3.6, 41, 1.6, 5, .8);
  s += P('t-a', rpoly([[10.5, 30.5], [53.5, 30.5], [59, 37.5], [59, 51], [5, 51], [5, 37.5]], [2, 2, 1, 2.5, 2.5, 1]) + holes, ' fill-rule="evenodd"');
  s += P('t-b', 'M5 37H59V38.6H5Z' + 'M5.1 48.6H58.9V48.7Q58.9 51 56.5 51H7.5Q5.1 51 5.1 48.7Z');
  s += P('t-b', circ(13, 31, 2.8) + circ(51, 31, 2.8));
  s += P('t-b', rr(9, 50, 6, 3.5, 1) + rr(49, 50, 6, 3.5, 1));
  s += P('t-c', spark(5, 21, 3) + spark(59, 21, 2.5));
  add('router', 'home wifi router with antennas, status lights and waves', s);
}

// ---------- smart-house
{
  let s = '';
  // house with big wifi symbol cut out
  const hy = x => 7 + (x - 23) * 20 / 19.5;
  const house = rpoly([[23, 6.5], [31, hy(31) + .4], [31, 9.5], [35.5, 9.5], [35.5, hy(35.5) + .4], [43, 27.5], [39, 27.5], [39, 57], [7, 57], [7, 27.5], [3, 27.5]], [1.5, .3, .8, .8, .3, 1, .3, 1.5, 1.5, .3, 1]);
  const wifi = circ(23, 49.5, 2.9) + band(23, 49.5, 7, 3.6, 225, 315) + band(23, 49.5, 12.6, 3.6, 225, 315);
  s += P('t-a', house + wifi, ' fill-rule="evenodd"');
  s += P('t-b', 'M7 27.5H39V29.6H7Z' + 'M7 54.6H39V55.5Q39 57 37.5 57H8.5Q7 57 7 55.5Z');
  s += R('t-b', 30.4, 8.7, 5.9, 2.4, .8);
  // phone showing a house
  s += R('t-c', 45.3, 34.3, 11.4, 18.9);
  s += P('t-a', rr(43.5, 31, 15, 27, 3) + sq(45.5, 34.5, 11, 18.5) + circ(51, 55.4, 1.2), ' fill-rule="evenodd"');
  s += P('t-a', rpoly([[51, 37.5], [55.6, 42], [54.2, 42], [54.2, 49.5], [47.8, 49.5], [47.8, 42], [46.4, 42]], .6));
  s += R('t-b', 50, 45.5, 2, 4);
  // thermostat dial
  s += P('t-a', circ(51, 16, 9) + band(51, 16, 6.6, 1.5, 135, 405), ' fill-rule="evenodd"');
  s += P('t-b', circ(51, 16, 4.1));
  s += P('t-a', cap(51, 16, 53.4, 13.6, 1.8));
  s += P('t-c', spark(6, 9, 3.2) + spark(40.5, 5, 2.2));
  add('smart-house', 'house with wifi symbol, phone app and thermostat dial', s);
}

// ---------- lab-coat
{
  let s = '';
  const mx = pts => pts.map(([x, y]) => [64 - x, y]);
  // hanger hook
  s += L('M32 13V9.5C32 6.5 34 4.6 36.5 4.6S41 6.4 41 8.8', 2.2);
  // sleeves
  const sl = [[15, 14.5], [8, 18.5], [5, 54], [13, 55], [14.5, 26]];
  s += P('t-a', rpoly(sl, 2.5) + rpoly(mx(sl), 2.5));
  s += P('t-b', 'M5.2 49.5L12.8 50.3L13 53.5Q13 55 11.5 54.9L5 54Z' + 'M58.8 49.5L51.2 50.3L51 53.5Q51 55 52.5 54.9L59 54Z');
  // inside of the coat back, seen through the V
  s += P('t-b', rpoly([[23, 10], [41, 10], [32, 34]], 1));
  // body
  const body = [[24, 11], [14, 14.5], [12, 21], [11, 60], [53, 60], [52, 21], [50, 14.5], [40, 11], [32, 33]];
  const badge = rr(14.5, 26.5, 9.5, 6.5, .8);
  s += P('t-a', rpoly(body, [1, 4, 3, 2, 2, 3, 4, 1, .6]) + badge, ' fill-rule="evenodd"');
  s += R('t-b', 11, 57.5, 42, 2.5, 1);
  s += P('t-b', 'M9.8 18H11.6L12.2 58L10.2 55.5ZM54.2 18H52.4L51.8 58L53.8 55.5Z');
  // lapels
  const lap = [[24, 11], [32.6, 33.4], [20, 20.5], [18, 15.5], [21.8, 14.6], [20.6, 11.6]];
  const lr = mx(lap);
  s += P('t-a', rpoly(lap, .8) + rpoly(lr, .8));
  s += L('M20.8 11.8L21.8 14.6L18.1 15.5L20 20.5L32.6 33.4L44 20.5L45.9 15.5L42.2 14.6L43.2 11.8', 1.2);
  // placket and buttons
  s += L('M32 34V59', 1.3);
  s += P('t-b', circ(32, 39.5, 1.8) + circ(32, 46.5, 1.8) + circ(32, 53.5, 1.8));
  // name badge
  s += R('t-c', 14.3, 26.3, 9.9, 6.9, .8);
  s += P('t-b', rr(16, 29, 6.5, 1.2, .5) + rr(16, 31, 4, .9, .4) + rr(17.8, 25.2, 2.9, 2.6, .6));
  // breast pocket with pens
  s += P('t-b', rr(42.2, 22.8, 2.3, 7, 1.1) + rr(45.6, 24.4, 2.3, 5.4, 1.1) + rr(40, 28.5, 10, 8.5, 1));
  s += P('t-a', sq(43, 24.3, .7, 4.3) + sq(46.4, 25.8, .7, 3) + sq(40, 28.5, 10, 1.2));
  // hip pockets
  s += R('t-b', 14.5, 44.5, 10.5, 3, .8) + R('t-b', 39, 44.5, 10.5, 3, .8);
  s += P('t-c', spark(6.5, 7.5, 3.4) + spark(57.5, 7, 2.6));
  add('lab-coat', 'white lab coat on a hanger with pens and name badge', s);
}

// ---------- bunsen-burner
{
  let s = '';
  // gas hose
  s += P('t-b', limb([[40, 56.8], [49, 57.6], [58.5, 57.6]], 2.6));
  // flame with inner cone
  const cone = 'M30.3 43.2C29.5 40 30.4 37.4 32 34.6C33.6 37.4 34.5 40 33.7 43.2Z';
  s += P('t-a', 'M28.2 43.2C25.3 38.6 27.6 33.6 32 28.4C36.4 33.6 38.7 38.6 35.8 43.2Z' + cone, ' fill-rule="evenodd"');
  s += P('t-c', cone);
  // burner barrel, collar with air hole, base
  s += P('t-a', rr(29, 42.5, 6, 11, .6));
  s += P('t-b', rr(28, 46.8, 8, 3.4, .8) + circ(32, 48.5, 1.1), ' fill-rule="evenodd"');
  s += R('t-b', 28.6, 42, 6.8, 1.6, .6);
  s += P('t-a', rpoly([[25, 52.5], [39, 52.5], [42.5, 58], [21.5, 58]], 1.2));
  s += P('t-b', 'M22.6 56.2H41.4L42.2 57.5Q42.5 58.5 41.4 58.5H22.6Q21.5 58.5 21.8 57.5Z');
  // tripod legs and ring
  s += P('t-b', cap(15.5, 29.5, 9, 57.5, 3.4) + cap(48.5, 29.5, 55, 57.5, 3.4) + rr(12, 28.4, 40, 2.6, 1.2));
  // gauze with mesh cut out
  let mesh = '';
  for (let x = 12.6; x < 51; x += 3.1) mesh += sq(x, 26.3, 1.6, 1.4);
  s += P('t-a', rr(10, 25, 44, 4, 1) + mesh, ' fill-rule="evenodd"');
  // round flask: neck, lip, bulb with highlight cut out
  s += R('t-a', 29, 5, 6, 8);
  s += R('t-a', 27.5, 3.6, 9, 2.6, 1.2);
  const hl = 'M26.4 14.6A6 6 0 0 1 29.6 10.8L30.2 12.2A4.6 4.6 0 0 0 27.8 15.2Z';
  s += P('t-a', circ(32, 16.6, 8.4) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  // boiling liquid with bubbles cut out
  const bub = circ(29, 21.5, 1.4) + circ(34.5, 20.4, 1.1) + circ(32.5, 23, .9) + circ(36.2, 22.6, .8);
  s += P('t-b', 'M25.2 18.6A7 7 0 0 0 38.8 18.6Q35.5 17.4 32 18.6T25.2 18.6Z' + bub, ' fill-rule="evenodd"');
  s += R('t-b', 29, 11.6, 6, 1.4);
  // bubbles rising out of the neck
  s += P('t-a', circ(38.8, 7.3, 1.4) + circ(41.6, 3.6, 1));
  s += P('t-c', spark(8, 9, 3.5) + spark(55, 11, 2.6) + spark(10, 41, 2.2));
  add('bunsen-burner', 'Bunsen burner flame heating a flask on a tripod and gauze', s);
}

// ---------- test-tube-rack
{
  let s = '';
  const cx = [14, 22.5, 31, 39.5], lv = [22, 37, 27.5, 42], w = 6.5, top = 10, bot = 49.8;
  let glass = '', inner = '', liq = '', lip = '';
  for (let k = 0; k < 4; k++) {
    const x0 = cx[k] - w / 2, x1 = cx[k] + w / 2, r = w / 2, a = x0 + 1.2, b = x1 - 1.2, ri = r - 1.2;
    const tube = `M${f(x0)} ${top}V${f(bot - r)}A${f(r)} ${f(r)} 0 0 0 ${f(x1)} ${f(bot - r)}V${top}Z`;
    const hole = `M${f(a)} ${top + 1}V${f(bot - r)}A${f(ri)} ${f(ri)} 0 0 0 ${f(b)} ${f(bot - r)}V${top + 1}Z`;
    glass += tube + hole; inner += hole;
    liq += `M${f(a)} ${lv[k]}V${f(bot - r)}A${f(ri)} ${f(ri)} 0 0 0 ${f(b)} ${f(bot - r)}V${lv[k]}Z`;
    lip += rr(x0 - .9, top - 1.6, w + 1.8, 2.6, 1);
  }
  s += P('t-c', inner);
  s += P('t-b', liq);
  s += P('t-a', glass, ' fill-rule="evenodd"');
  s += P('t-a', lip);
  // wooden rack: posts, top bar, base
  s += P('t-a', rr(4, 25, 4.6, 32, 2) + rr(45.4, 25, 4.6, 32, 2));
  s += P('t-a', rr(3.5, 29, 47, 6.5, 1.5));
  s += P('t-a', rr(3, 50.5, 48, 7, 1.5));
  s += P('t-b', 'M3.6 33.6H50.4V34Q50.4 35.5 49 35.5H5Q3.6 35.5 3.6 34Z' + 'M3.1 55.3H50.9V56Q50.9 57.5 49.4 57.5H4.6Q3.1 57.5 3.1 56Z');
  s += P('t-b', 'M8.6 35.5H11V37Z' + 'M45.4 35.5H43V37Z');
  s += L('M8 31.3Q16 30.3 24 31.5T42 31.2M7 53.3Q18 52.3 27 53.4T47 53', 1);
  // dropper
  s += P('t-b', rpoly([[56.5, 6.5], [59.6, 10], [59.4, 17.5], [53.6, 17.5], [53.4, 10]], [2.6, 2.5, 1, 1, 2.5]));
  s += R('t-b', 53.6, 17, 5.8, 3, .8);
  s += P('t-a', rpoly([[54.6, 20], [58.4, 20], [58.4, 37.5], [57.1, 45], [55.9, 45], [54.6, 37.5]], .6));
  s += P('t-b', 'M55.6 31H57.4V37.5L56.7 42.5H56.3L55.6 37.5Z');
  s += P('t-a', 'M56.5 47C58.3 49.4 59 50.6 59 51.6A2.5 2.5 0 0 1 54 51.6C54 50.6 54.7 49.4 56.5 47Z');
  s += P('t-c', spark(5.5, 14, 3) + spark(48.5, 8.5, 2.3));
  add('test-tube-rack', 'wooden rack of test tubes with a dropper', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part36.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
