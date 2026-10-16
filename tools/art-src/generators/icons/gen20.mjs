// Generates part20.json (round 4, drawer 20).
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
const wedge = (cx, cy, a, w, r1, r2) => {
  const p = (ang, r) => `${f(cx + r * Math.cos(ang * Math.PI / 180))} ${f(cy + r * Math.sin(ang * Math.PI / 180))}`;
  return `M${p(a - w * .35, r1)}L${p(a - w, r2)}L${p(a + w, r2)}L${p(a + w * .35, r1)}Z`;
};
// chevron "<" (dir 1) or ">" (dir -1): tip x,y, reach w, half-height h, thickness t
const chev = (tx, ty, w, h, t, dir = 1) => {
  const l = Math.hypot(w, h), d = t * l / h;
  const P1 = [tx + dir * w, ty - h], P2 = [tx + dir * w, ty + h];
  const Q1 = [P1[0] + dir * t * h / l, P1[1] + t * w / l], Q2 = [P2[0] + dir * t * h / l, P2[1] - t * w / l];
  return rpoly([P1, [tx, ty], P2, Q2, [tx + dir * d, ty], Q1], [.8, 1.2, .8, .8, .6, .8]);
};

// ---------- directors-chair
{
  let s = '';
  const fx0 = 8, fx1 = 40, dx = 14, dy = -8, seat = 37, arm = 26, floor = 59;
  // back X legs and side runners
  s += P('t-b', cap(fx0 + dx, seat + dy + 2, fx1 + dx, floor + dy, 2.8) + cap(fx1 + dx, seat + dy + 2, fx0 + dx, floor + dy, 2.8)
    + cap(fx0, floor, fx0 + dx, floor + dy, 2.6) + cap(fx1, floor, fx1 + dx, floor + dy, 2.6));
  // back posts
  s += P('t-b', cap(fx0 + dx, 5, fx0 + dx, seat + dy + 1, 3.4) + cap(fx1 + dx, 5, fx1 + dx, seat + dy + 1, 3.4));
  // back canvas with name label hole
  const label = 'M28.5 9.6H47.5V13H28.5Z';
  s += P('t-a', rpoly([[21, 6.5], [55, 6.5], [55, 17], [21, 17]], 1) + label, ' fill-rule="evenodd"');
  s += P('t-c', label);
  s += P('t-b', 'M21 14.8H55V17H21Z');
  // arms
  s += P('t-b', cap(fx0 + dx, arm + dy, fx0, arm, 3.6) + cap(fx1 + dx, arm + dy, fx1, arm, 3.6));
  // seat canvas (top) and wrapped front band
  s += P('t-a', `M${fx0} ${seat}L${fx0 + dx} ${seat + dy}L${fx1 + dx} ${seat + dy}L${fx1} ${seat}Q${(fx0 + fx1) / 2} ${seat + 2.5} ${fx0} ${seat}Z`);
  s += P('t-a', `M${fx0 - 1} ${seat - .5}Q${(fx0 + fx1) / 2} ${seat + 2} ${fx1 + 1} ${seat - .5}V${seat + 3}Q${(fx0 + fx1) / 2} ${seat + 5.5} ${fx0 - 1} ${seat + 3}Z`);
  s += P('t-b', `M${fx0 - 1} ${seat + 2}Q${(fx0 + fx1) / 2} ${seat + 4.5} ${fx1 + 1} ${seat + 2}V${seat + 3}Q${(fx0 + fx1) / 2} ${seat + 5.5} ${fx0 - 1} ${seat + 3}Z`);
  // seat side shade
  s += P('t-b', `M${fx1} ${seat}L${fx1 + dx} ${seat + dy}L${fx1 + dx} ${seat + dy + 2.4}L${fx1 + 1} ${seat + 2.5}Z`);
  // front posts and front X legs
  s += P('t-b', cap(fx0, arm, fx0, seat + 2, 3.4) + cap(fx1, arm, fx1, seat + 2, 3.4)
    + cap(fx0 + 1, seat + 4, fx1, floor, 3.4) + cap(fx1 - 1, seat + 4, fx0, floor, 3.4));
  s += P('t-a', circ((fx0 + fx1) / 2, (seat + 4 + floor) / 2, 1.6));
  s += P('t-c', spark(9, 9.5, 3.8) + spark(57, 42, 3));
  add('directors-chair', 'folding director\'s chair with canvas seat and X legs', s);
}

// ---------- maracas
{
  let s = '';
  const one = (x, y, rot) => {
    let g = '';
    g += P('t-b', cap(0, 10, 0, 38, 5.6) + circ(0, 38.5, 3.6));
    g += P('t-a', cap(-.8, 13, -.8, 35, 1.4));
    const zig = (y0) => { const pts = []; for (let i = 0; i <= 6; i++) pts.push([-9.6 + i * 3.2, y0 + (i % 2 ? -2 : 1.2)]); return pts; };
    const top = zig(-1.5), bot = zig(2.3).reverse();
    const band = 'M' + top.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'L' + bot.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
    const hl = 'M-6.5 -6Q-5.5 -10.5 -1.5 -11.5Q-4.5 -9 -4.6 -5.2Q-5.6 -4.6 -6.5 -6Z';
    // head clipped band: keep band inside ellipse by limiting width
    g += P('t-a', `M-10 0A10 12.5 0 1 1 10 0A10 12.5 0 1 1 -10 0Z` + band + hl, ' fill-rule="evenodd"');
    g += P('t-c', band + hl);
    g += P('t-b', 'M8.6 -6.4A10 12.5 0 0 1 -6 10A11 13 0 0 0 8.6 -6.4Z');
    g += P('t-b', circ(-3.5, 7.5, 1.3) + circ(1, 8.6, 1.3) + circ(4.6, 6.4, 1.1) + circ(1.5, -6.5, 1.3) + circ(5, -4, 1.1));
    g += P('t-b', rpoly([[-4, 10.8], [4, 10.8], [3, 14], [-3, 14]], .8));
    return `<g transform="translate(${x} ${y}) rotate(${rot})">${g}</g>`;
  };
  s += one(20, 20, -35) + one(44, 20, 35);
  s += L('M4.5 13Q5 7 9.5 4M8 16Q8 11.5 11.5 8.5' + 'M59.5 13Q59 7 54.5 4M56 16Q56 11.5 52.5 8.5', 1.8);
  s += P('t-c', spark(32, 7, 3.5) + spark(8, 50, 3) + spark(56, 50, 3));
  add('maracas', 'crossed pair of patterned maracas shaking', s);
}

// ---------- sword-in-stone
{
  let s = '';
  const cx = 32, gy = 21;
  let rays = '';
  for (let k = 0; k < 8; k++) rays += wedge(cx, gy, -90 + k * 45 + 22.5, 5.5, 11, 19.5);
  s += P('t-c', rays + circ(cx, gy, 9));
  // blade with fuller cut
  s += P('t-a', `M${cx - 4} 23H${cx + 4}V47H${cx - 4}Z`);
  s += P('t-b', `M${cx} 23H${cx + 4}V47H${cx}Z`);
  // crossguard, grip, pommel
  s += P('t-b', rpoly([[17, 18.5], [47, 18.5], [44.5, 23.5], [19.5, 23.5]], 1.6));
  s += P('t-b', `M${cx - 2.6} 8H${cx + 2.6}V19H${cx - 2.6}Z`);
  s += P('t-a', `M${cx - 2.6} 10.6L${cx + 2.6} 12.2V13.6L${cx - 2.6} 12ZM${cx - 2.6} 14.4L${cx + 2.6} 16V17.4L${cx - 2.6} 15.8Z`);
  s += P('t-b', circ(cx, 7, 3.8));
  s += P('t-a', circ(cx - 1, 6, 1.3));
  // rock
  const rockHl = 'M15 44.5Q19 41 24.5 41.3Q20 43.5 17.5 46.5Q15.8 46.6 15 44.5Z' + 'M39.5 40.8Q44 40 47 42.5Q43.5 42.6 40.5 43Z';
  const rock = rpoly([[4.5, 58], [6.5, 48], [12, 42], [20, 39.5], [27, 41], [33, 39.5], [40, 38], [48, 40], [55, 45], [59.5, 58]], [2, 3, 3, 3, 2, 2, 3, 3, 3, 2]);
  s += P('t-a', rock + rockHl, ' fill-rule="evenodd"');
  s += P('t-c', rockHl);
  s += P('t-b', 'M5 54Q20 51 33 52.5Q46 51 59.4 54.5L59.5 58H4.5Z' + 'M48 40Q55 45 59.5 58L54 57Q53 49 47 42Z');
  s += P('t-b', `M${cx - 4.5} 41.2Q${cx} 39 ${cx + 4.5} 40.8Q${cx} 43 ${cx - 4.5} 41.2Z`);
  s += L('M24 48L27.5 50.5L26 53M40 47L42.5 45M10.5 50L13 52', 1.4);
  s += P('t-c', spark(8, 9, 3.8) + spark(56, 10, 3.2) + spark(51, 30, 2.4) + spark(12, 32, 2.2));
  add('sword-in-stone', 'sword standing in a rock, glowing', s);
}

// ---------- newtons-cradle
{
  let s = '';
  const top = 13, rest = 39, br = 4.3, sp = 8.6, x0 = 18.5, ang = 30 * Math.PI / 180;
  // base
  s += P('t-a', rpoly([[4.5, 48.5], [59.5, 48.5], [59.5, 58], [4.5, 58]], 2.5));
  s += P('t-b', 'M4.5 54H59.5V55.5Q59.5 58 57 58H7Q4.5 58 4.5 55.5Z');
  // frame
  s += P('t-b', limb([[5.5, 49.5], [5.5, top], [59, top], [59, 49.5]], 3.4));
  s += P('t-a', cap(6.7, top - .6, 57.8, top - .6, 1));
  // strings
  const pivots = [0, 1, 2, 3, 4].map(i => x0 + i * sp);
  const sw = [pivots[0] - (rest - top) * Math.sin(ang), top + (rest - top) * Math.cos(ang)];
  let str = `M${f(pivots[0])} ${top + 1.5}L${f(sw[0])} ${f(sw[1])}`;
  for (let i = 1; i < 5; i++) str += `M${f(pivots[i])} ${top + 1.5}V${rest}`;
  s += L(str, 1.3);
  s += P('t-b', pivots.map(x => circ(x, top + 2, 1.3)).join(''));
  // balls
  const ball = (x, y) => {
    const hl = `M${f(x - 2.9)} ${f(y - .6)}A3 3 0 0 1 ${f(x - .6)} ${f(y - 2.9)}L${f(x - .4)} ${f(y - 1.9)}A2 2 0 0 0 ${f(x - 1.9)} ${f(y - .4)}Z`;
    return [circ(x, y, br) + hl, hl, `M${f(x + br * .82)} ${f(y - br * .57)}A${br} ${br} 0 0 1 ${f(x - br * .57)} ${f(y + br * .82)}A${br * 1.25} ${br * 1.25} 0 0 0 ${f(x + br * .82)} ${f(y - br * .57)}Z`];
  };
  const balls = [ball(sw[0], sw[1]), ...pivots.slice(1).map(x => ball(x, rest))];
  s += P('t-a', balls.map(b => b[0]).join(''), ' fill-rule="evenodd"');
  s += P('t-c', balls.map(b => b[1]).join(''));
  s += P('t-b', balls.map(b => b[2]).join(''));
  s += P('t-c', spark(6.5, 6, 3) + spark(32, 5.5, 2.4) + spark(58, 6, 2.6));
  add('newtons-cradle', 'Newton\'s cradle with the end ball swung out', s);
}

// ---------- code-window
{
  let s = '';
  const X0 = 4.5, X1 = 59.5, Y0 = 7, Y1 = 56, tb = 16.5;
  const dots = circ(11, 11.8, 2) + circ(17.5, 11.8, 2) + circ(24, 11.8, 2);
  s += P('t-c', dots);
  s += P('t-b', `M${X0} ${tb}V${Y0 + 4}Q${X0} ${Y0} ${X0 + 4} ${Y0}H${X1 - 4}Q${X1} ${Y0} ${X1} ${Y0 + 4}V${tb}Z` + dots, ' fill-rule="evenodd"');
  const brk = chev(12.5, 30, 9, 8.5, 4.2, 1) + chev(51.5, 30, 9, 8.5, 4.2, -1) + rpoly([[34.6, 20.5], [38.8, 20.5], [29.4, 39.5], [25.2, 39.5]], .9);
  s += P('t-c', brk);
  s += P('t-a', `M${X0} ${tb}H${X1}V${Y1 - 4}Q${X1} ${Y1} ${X1 - 4} ${Y1}H${X0 + 4}Q${X0} ${Y1} ${X0} ${Y1 - 4}Z` + brk, ' fill-rule="evenodd"');
  s += P('t-b', 'M10 44.5H30V47.5H10ZM33 44.5H42V47.5H33ZM15 50H37V53H15Z');
  s += P('t-b', `M${X0} ${tb}H${X1}V${tb + 1.6}H${X0}Z`);
  s += P('t-b', 'M45 44.5H48.5V53H45Z');
  add('code-window', 'editor window with </> brackets and code lines', s);
}

// ---------- computer-monitor
{
  let s = '';
  const scr = 'M9 11H55V40H9Z';
  // stand
  s += P('t-b', 'M27.5 44H36.5L38 54H26Z');
  s += P('t-a', rpoly([[17, 53], [47, 53], [49, 58.5], [15, 58.5]], 2));
  s += P('t-b', 'M15.4 57H48.6L49 58.5H15Z');
  // screen content: bright with hills and sun
  s += P('t-c', scr);
  s += P('t-a', 'M9 34Q17 27 25 31Q33 24 43 30Q49 27 55 30V40H9Z' + circ(44, 19, 3.6));
  s += P('t-b', 'M9 37.5Q20 33 30 36.5Q42 33 55 36V40H9Z');
  // bezel with screen hole
  s += P('t-a', rpoly([[4.5, 6], [59.5, 6], [59.5, 46], [4.5, 46]], 3.5) + scr, ' fill-rule="evenodd"');
  s += P('t-b', 'M4.5 42.5H59.5V43Q59.5 46 56.5 46H7.5Q4.5 46 4.5 43Z');
  s += P('t-b', 'M30 42.6H34V43.8H30Z');
  s += P('t-c', spark(8, 54, 3.2) + spark(56, 53, 2.6));
  add('computer-monitor', 'flat desktop monitor on a stand with a bright screen', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part20.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
