// Generates part14.json (round 2, batch 14).
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

// ---------- car
{
  let s = '';
  s += L('M1 36H6M0 41H4', 2.4);
  const body = 'M9 46Q5 46 5 42V37Q5 32 10 31.3L17 30.5L22.5 19.5Q24 16.5 27.5 16.5H41Q44.5 16.5 46.5 19.5L52.5 29.8L56.5 30.8Q60 31.8 60 36V42Q60 46 56 46Z';
  s += P('t-a', body);
  s += P('t-b', 'M5 40H60V42Q60 46 56 46H9Q5 46 5 42Z');
  s += P('t-c', 'M25.5 20.5Q26 19.5 27.3 19.5H32.5V29.5H21.3Z');
  s += P('t-c', 'M35 19.5H40.6Q42.2 19.5 43.2 21L48.6 29.5H35Z');
  s += P('t-c', 'M12 33.5H20Q21 33.5 21 34.5V34.5Q21 35.5 20 35.5H12Q11 35.5 11 34.5V34.5Q11 33.5 12 33.5Z');
  s += R('t-c', 55.5, 33, 4.5, 3.5, 1.5);
  s += R('t-b', 5, 33, 2.8, 4, 1);
  s += L('M33.8 30.5V40M38 34H41', 1.8);
  for (const x of [18, 47]) { s += C('t-b', x, 45, 8.5); s += C('t-c', x, 45, 4); s += C('t-b', x, 45, 1.6); }
  s += P('t-c', 'M28 17.8H40Q41.5 17.8 41.5 18.6H28Z');
  add('car', 'family car', s);
}

// ---------- seashell
{
  let s = '';
  let g = '';
  const wh = [[0, 7, 16.5, 15.5], [-1, -8.5, 11.5, 7.5], [-1.8, -18.5, 7.5, 5], [-2.4, -25, 4.2, 3.2]];
  g += E('t-b', 1.5, 9, 16.5, 15.5);
  for (const [x, y, rx, ry] of wh) { g += E('t-b', x + .6, y + 2, rx, ry, -12); g += E('t-a', x, y, rx, ry, -12); }
  g += C('t-a', -2.8, -29, 1.8);
  g += P('t-b', 'M12 -3A16.5 15.5 0 0 1 6 21.8A15 20 0 0 0 12 -3Z');
  g += P('t-c', 'M-10.5 -8.5Q-10 -12 -6 -13.5Q-8.5 -11 -8.8 -8Z' + 'M-7 -18Q-6 -21 -3.5 -21.8Q-5 -20 -5.3 -17.6Z' + 'M-13.5 4Q-13 -1 -8 -3.5Q-11 0 -11.5 4Z');
  g += E('t-b', 6.5, 11.5, 7.6, 10, 18);
  g += E('t-c', 7, 12, 5.6, 8, 18);
  g += E('t-b', 7.8, 13, 3, 5, 18);
  s += `<g transform="translate(24 30) rotate(-24)">${g}</g>`;
  // starfish
  const st = star(49.5, 50, 13.5, 6, 5, -100);
  s += P('t-b', rpoly(st.map(([x, y]) => [x + 1.3, y + 1.5]), st.map((_, i) => i % 2 ? 2.2 : 2.8)));
  s += P('t-a', rpoly(st, st.map((_, i) => i % 2 ? 2.2 : 2.8)));
  let dots = '';
  for (let i = 0; i < 5; i++) {
    const a = (-100 + i * 72) * Math.PI / 180;
    dots += circ(49.5 + 6 * Math.cos(a), 50 + 6 * Math.sin(a), 1.3);
  }
  s += P('t-c', dots + circ(49.5, 50, 1.6));
  s += P('t-c', spark(56, 10, 4.5) + spark(8, 54, 3.5));
  add('seashell', 'spiral hermit-crab shell and a starfish', s);
}

// ---------- picnic-basket
{
  let s = '';
  // gingham blanket
  const TL = [9, 44], TR = [55, 44], BR = [63, 61], BL = [1, 61];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const pt = (u, v) => lerp(lerp(TL, TR, u), lerp(BL, BR, u), v);
  const cols = 8, rows = 3; const cls = { 'a': '', 'b': '', 'c': '' };
  s += P('t-c', `M${TL}L${TR}L${BR}L${BL}Z`.replace(/,/g, ' '));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const k = (i % 2) + (j % 2); if (k === 0) continue;
    const q = [pt(i / cols, j / rows), pt((i + 1) / cols, j / rows), pt((i + 1) / cols, (j + 1) / rows), pt(i / cols, (j + 1) / rows)];
    cls[k === 2 ? 'b' : 'a'] += 'M' + q.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
  }
  s += P('t-a', cls.a) + P('t-b', cls.b);
  s += E('t-b', 32, 55.5, 20, 3.2);
  // handle
  s += L('M17.5 27C17.5 8 46.5 8 46.5 27', 4.2);
  s += L('M20.5 24C21.5 12.5 42.5 12.5 43.5 24', 1.4);
  // body
  s += P('t-a', 'M12 29H52L48.3 51.5Q48 54 45.5 54H18.5Q16 54 15.7 51.5Z');
  s += P('t-b', 'M44 29H52L48.3 51.5Q48 54 45.5 54H41.5Q43.8 53.5 44.2 51Z');
  let w = '';
  for (let r = 0; r < 3; r++) {
    const y = 33 + r * 6.8, off = r % 2 ? 3.3 : 0;
    for (let x = 17 + off; x < 46; x += 6.6) w += `M${f(x)} ${f(y)}h4.6v2.8h-4.6Z`;
  }
  s += P('t-c', w);
  s += L('M14.5 37H50.3M15.6 43.8H49.2', 1.3);
  // lid
  s += P('t-a', 'M12 24H52Q55 24 55 27V28Q55 31 52 31H12Q9 31 9 28V27Q9 24 12 24Z');
  s += P('t-b', 'M9 28.5H55V28Q55 31 52 31H12Q9 31 9 28Z');
  s += P('t-c', 'M13 25.8H26Q27 25.8 27 26.8H13Q12 26.8 13 25.8Z');
  s += R('t-b', 29, 29, 6, 6, 1.5);
  s += R('t-c', 30.6, 30.6, 2.8, 2.8, .8);
  add('picnic-basket', 'wicker basket on a gingham blanket', s);
}

// ---------- horse
{
  let s = '';
  // far legs
  s += P('t-b', limb([[40, 37], [46, 46], [42.5, 53]], 4.4) + limb([[21, 38], [18.5, 47], [25, 53]], 4.4));
  // tail
  s += P('t-b', 'M17 24C12 20 6 23 2 20C3 26 7 29 11 28C8 31 4 31 1.5 30C4.5 35 11 35 16 30Z');
  // near legs
  s += P('t-a', limb([[43, 34], [51.5, 40], [59.5, 36.5]], 4.6) + limb([[19, 34], [11.5, 42], [4, 47]], 5));
  // body + neck + head
  s += P('t-a', 'M42 20C35 23 26 22 20 23C14 24 12 31 14.5 36C17 40.5 23 41 30 40.5C35 40 39 40 42.5 37.5C45.5 35 46.5 31 47 27.5C48.5 24 51 22 53.5 20.5L58.5 23.5Q62 25 63 22Q63.5 19.5 61 17L55 9L55.5 4L52 6.5L50 3.5L48 8C45 11 43.5 15 42 20Z');
  s += P('t-b', 'M16 36.5C19 41 24 41.5 30 40.5C35 40 39 40 42.5 37.5C44 36.3 45 34.8 45.7 33C43 36.5 37 37 30 37.5C23 38 18.5 38 16 36.5Z');
  // mane
  s += P('t-b', 'M50.5 5C45 7 41 12 39 19C37 22 33 22.5 30.5 21.5C34 25.5 39 24.5 42 22.5C41 26 38 28 35 28.5C40 30.5 44.5 27 46 22C47.5 16 49 11 52.5 8Z');
  s += C('t-b', 53.5, 13.5, 1.9);
  s += C('t-c', 53, 13, .7);
  s += C('t-b', 60, 20.8, 1.1);
  s += P('t-c', 'M23 25.5C28 24.5 34 24.8 37.5 24.2Q35 26.5 23 27Q21 26.8 23 25.5Z');
  // hooves
  s += P('t-b', cap(58.5, 34.3, 61.5, 38, 4.2) + cap(2.2, 45.8, 3.5, 49.8, 4.4));
  // dust
  s += P('t-c', circ(6, 57, 3) + circ(12, 59.5, 2.2) + circ(32, 58.5, 2) + circ(37, 60.5, 1.4));
  s += L('M52 48H60M48 53H57', 2);
  add('horse', 'galloping horse with a flowing mane', s);
}

// ---------- chef-hat
{
  let s = '';
  s += P('t-a', 'M17 28H47L45.5 47H18.5Z');
  s += P('t-a', circ(15, 26, 9.5) + circ(24, 15.5, 11) + circ(40, 15.5, 11) + circ(49, 26, 9.5) + circ(32, 20, 12));
  s += P('t-b', 'M54.5 18.5A9.5 9.5 0 0 1 48.5 35.5L45.5 47H40.5L44 33.5A9.5 9.5 0 0 0 54.5 18.5Z');
  s += P('t-b', 'M47.5 7.5A11 11 0 0 1 44.5 25.5A11 11 0 0 0 47.5 7.5Z');
  s += L('M25 45V33Q25 29 21.5 26.5M32 45V29M39 45V33Q39 29 42.5 26.5', 2);
  s += P('t-c', circ(20, 11.5, 3) + circ(9.5, 23, 2.2));
  s += P('t-c', 'M15 12.5Q17.5 7 23 5.5Q19 8.5 17.8 12.8Z');
  s += P('t-a', 'M17 44H47Q50 44 50 47V54Q50 57 47 57H17Q14 57 14 54V47Q14 44 17 44Z');
  s += P('t-b', 'M42 44H47Q50 44 50 47V54Q50 57 47 57H42Q45 57 45 54V47Q45 44 42 44Z');
  s += P('t-b', 'M14 49H50V52H14Z');
  s += P('t-c', 'M18 46.5H30Q31 46.5 31 47.2H17Q17 46.5 18 46.5Z');
  s += P('t-c', spark(7, 50, 4) + spark(57.5, 50, 3));
  add('chef-hat', "tall chef's toque", s);
}

// ---------- robot
{
  let s = '';
  s += L('M32 10V4', 2.4);
  s += C('t-c', 32, 4, 3);
  // arms
  s += P('t-b', limb([[15, 38], [9, 31], [7, 24]], 5) + limb([[49, 38], [55, 44], [56, 50]], 5));
  s += P('t-a', circ(7, 22, 3.6) + circ(56.5, 51.5, 3.6));
  s += P('t-b', 'M5.5 18.8L7 21.6L8.5 18.8Z');
  // legs
  s += R('t-b', 21, 52, 7, 8, 1.5) + R('t-b', 36, 52, 7, 8, 1.5);
  s += R('t-a', 18.5, 57.5, 11, 5, 2.5) + R('t-a', 34.5, 57.5, 11, 5, 2.5);
  // body
  s += R('t-a', 15, 33, 34, 22, 5);
  s += P('t-b', 'M42 33H44Q49 33 49 38V50Q49 55 44 55H42Q46 55 46 50V38Q46 33 42 33Z');
  s += R('t-c', 21, 37, 22, 13, 3);
  s += P('t-a', 'M32 47.5C26 43.5 24.5 41.5 26.5 39.5C28 38 30.5 38.5 32 40.5C33.5 38.5 36 38 37.5 39.5C39.5 41.5 38 43.5 32 47.5Z');
  // neck
  s += R('t-b', 27, 28, 10, 6, 1.5);
  // head
  s += R('t-b', 11, 16, 5, 9, 2) + R('t-b', 48, 16, 5, 9, 2);
  s += R('t-a', 14, 9, 36, 22, 6);
  s += P('t-b', 'M43 9H44Q50 9 50 15V25Q50 31 44 31H43Q47 31 47 25V15Q47 9 43 9Z');
  s += R('t-c', 18, 13, 28, 14, 4);
  s += C('t-b', 25.5, 19.5, 3.4) + C('t-b', 38.5, 19.5, 3.4);
  s += C('t-c', 26.5, 18.5, 1.2) + C('t-c', 39.5, 18.5, 1.2);
  s += L('M28.5 23.5Q32 26 35.5 23.5', 1.8);
  s += P('t-c', 'M17 11.5Q15.8 12.5 15.8 15.5V17Q17.3 12.5 20 11.5Z');
  s += P('t-c', spark(58, 9, 4) + spark(5, 42, 3));
  add('robot', 'friendly boxy robot', s);
}

// ---------- microchip
{
  let s = '';
  let pins = '';
  for (const c of [20, 26, 32, 38, 44]) {
    pins += `M${c - 1.6} 6h3.2v10h-3.2Z` + `M${c - 1.6} 48h3.2v10h-3.2Z` + `M6 ${c - 1.6}h10v3.2h-10Z` + `M48 ${c - 1.6}h10v3.2h-10Z`;
  }
  s += P('t-b', pins);
  s += P('t-c', [20, 26, 32, 38, 44].map(c => circ(c, 6.5, 1.8) + circ(c, 57.5, 1.8) + circ(6.5, c, 1.8) + circ(57.5, c, 1.8)).join(''));
  s += R('t-b', 15, 15, 36, 36, 5);
  s += R('t-a', 13, 13, 36, 36, 5);
  s += P('t-b', 'M42 13H44Q49 13 49 18V44Q49 49 44 49H18Q13 49 13 44V43H40Q42 43 42 41Z');
  s += R('t-b', 21, 21, 20, 20, 3);
  s += R('t-c', 24, 24, 14, 14, 2);
  s += L('M28 31H34M31 28V34', 1.6);
  s += C('t-c', 18.5, 18.5, 2);
  s += P('t-c', 'M17 16Q15.7 16.5 15.7 18V30Q16.6 29 16.8 27Z');
  add('microchip', 'square chip with pins on every side', s);
}

// ---------- printing-press
{
  let s = '';
  // posts & beam
  s += R('t-b', 8, 58, 48, 4, 1.5);
  s += R('t-a', 10, 8, 7, 51, 1.5) + R('t-a', 47, 8, 7, 51, 1.5);
  s += R('t-b', 14, 8, 3, 51) + R('t-b', 51, 8, 3, 51);
  s += R('t-a', 5, 5, 54, 9, 2.5);
  s += P('t-b', 'M5 11H59V11.5Q59 14 56.5 14H7.5Q5 14 5 11.5Z');
  s += P('t-c', 'M8 7H30Q31 7 31 8H8Q7 8 8 7Z');
  // lever bar through the screw
  s += P('t-b', cap(21, 18.5, 59, 13, 3.4));
  s += C('t-a', 59, 13, 3.8);
  s += C('t-c', 58, 12, 1.3);
  s += R('t-a', 27, 14, 10, 14.5, 1.5);
  s += P('t-b', 'M27 17L37 19.5V22L27 19.5ZM27 22.5L37 25V27.5L27 25Z');
  s += R('t-b', 34.5, 14, 2.5, 14.5);
  s += R('t-c', 28.5, 14.5, 1.5, 2.2);
  s += C('t-b', 23, 18.2, 2.2);
  // platen
  s += R('t-a', 20, 28, 24, 6, 1.5);
  s += P('t-b', 'M20 31.8H44V32.5Q44 34 42.5 34H21.5Q20 34 20 32.5Z');
  // bed with sheet
  s += R('t-b', 17, 36, 30, 3);
  s += R('t-a', 3, 39, 58, 6, 2);
  s += P('t-b', 'M3 43H61V43Q61 45 59 45H5Q3 45 3 43Z');
  s += R('t-b', 11, 45, 6, 9) + R('t-b', 47, 45, 6, 9);
  // sheet
  s += P('t-c', 'M20 38.5H46L50 49Q50.5 51 48.5 51H24.5Q22.5 51 22 49.5Z');
  s += L('M26 42.5H40M27 45.5H44M28 48.5H37', 1.3);
  s += P('t-c', spark(58, 32, 3.2) + spark(6, 29, 2.8));
  add('printing-press', 'old hand-cranked printing press with a sheet', s);
}

// ---------- zipper
{
  let s = '';
  const sx = 32, sy = 24;
  s += P('t-a', 'M26.5 26H37.5V64H26.5Z');
  s += P('t-b', 'M35.5 26H37.5V64H35.5Z');
  s += P('t-a', cap(sx, sy, 12, -4, 10) + cap(sx, sy, 52, -4, 10));
  s += P('t-b', cap(sx + 3.2, sy + 1.2, 53.5, -3, 3));
  let teeth = '';
  for (const [x2, side] of [[12, 1], [52, -1]]) {
    const dx = x2 - sx, dy = -4 - sy, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    const nx = -uy * side, ny = ux * side, ang = Math.atan2(ny, nx) * 180 / Math.PI;
    for (let t = 8.5; t < l; t += 4) {
      const cx = sx + ux * t + nx * 4.6, cy = sy + uy * t + ny * 4.6;
      teeth += 'M' + [[-2.6, -1.3], [2.6, -1.3], [2.6, 1.3], [-2.6, 1.3]].map(([a, b]) => f(cx + a * nx - b * ny) + ' ' + f(cy + a * ny + b * nx)).join('L') + 'Z';
    }
  }
  s += P('t-c', teeth);
  let ct = '';
  for (let y = 29.5, k = 0; y < 64; y += 2.9, k++) ct += `M${k % 2 ? 27.2 : 31.3} ${f(y)}h5.5v2.1h-5.5Z`;
  s += P('t-c', ct);
  s += P('t-b', 'M24.5 18H39.5Q41 18 40.6 19.5L37.8 29Q37.4 30.5 36 30.5H28Q26.6 30.5 26.2 29L23.4 19.5Q23 18 24.5 18Z');
  s += P('t-c', 'M26.3 20H37.7L37 22.2H27Z');
  let t = '';
  t += P('t-a', 'M-3.5 0H3.5L5 17Q5.2 20 2.5 20H-2.5Q-5.2 20 -5 17Z');
  t += P('t-b', 'M2 0H3.5L5 17Q5.2 20 2.5 20H1Q3.4 19.6 3.3 17Z');
  t += R('t-b', -2.2, 9.5, 4.4, 7, 2.2);
  t += C('t-c', 0, 3, 1.7);
  s += `<g transform="translate(32 27.5) rotate(-24)">${t}</g>`;
  s += P('t-c', spark(55, 44, 4) + spark(12, 48, 3));
  s += C('t-c', 50, 56, 1.3);
  add('zipper', 'half-open zip with a pull tab', s);
}

// ---------- hammer
{
  let s = '';
  let g = '';
  g += R('t-a', -3.4, 3, 6.8, 38, 3.4);
  g += R('t-b', .8, 3, 2.6, 38, 1.3);
  g += R('t-b', -3.9, 26, 7.8, 15, 3.6);
  g += L('M-3.5 30.5H3.5M-3.5 35H3.5', 1.4);
  g += R('t-c', -2.3, 9, 1.6, 15, .8);
  g += P('t-a', 'M-6 -6C-11 -6 -15.5 -3 -18.5 4.5C-16 2.5 -12 1 -6 2Z');
  g += L('M-7.5 -2L-15 1.5', 1.5);
  g += R('t-a', -7, -6.5, 16, 12, 2);
  g += R('t-b', -7, 1.5, 16, 4, 1.5);
  g += R('t-b', -4.8, 3.5, 9.6, 5, 1.5);
  g += R('t-a', 8, -8, 7, 16, 2.2);
  g += R('t-b', 8, 3, 7, 5, 2);
  g += R('t-c', -4.5, -4.5, 11, 1.8, .9);
  g += R('t-c', 9.8, -6, 1.6, 7, .8);
  s += `<g transform="translate(33 23) rotate(35)">${g}</g>`;
  const nail = (x, y, a) => `<g transform="translate(${x} ${y}) rotate(${a})">${P('t-a', 'M-1.3 0H1.3V12.5L0 16L-1.3 12.5Z')}${R('t-b', -4.2, -1.8, 8.4, 3, 1.2)}${P('t-c', 'M-.6 1.5H.2V11H-.6Z')}</g>`;
  s += nail(47, 44.5, 10) + nail(57, 42, -8);
  s += L('M40 61H62', 2.6);
  s += L('M51 36.5L53 33.5M45.5 38L42.5 35.5M58 37L61 34.5', 2);
  s += P('t-c', spark(8, 50, 3.5) + spark(55, 9, 4));
  add('hammer', 'claw hammer and nails', s);
}

// ---------- ruler + protractor
{
  let s = '';
  s += P('t-c', 'M5 38A27 27 0 0 1 59 38ZM20 38A12 12 0 0 0 44 38Z', ' fill-rule="evenodd"');
  s += P('t-b', 'M20 38A12 12 0 0 1 44 38H41.5A9.5 9.5 0 0 0 22.5 38Z');
  let tk = '';
  for (let i = 1; i < 18; i++) {
    const a = Math.PI + i * Math.PI / 18, r1 = 27, r2 = i % 3 === 0 ? 21.5 : 24;
    tk += `M${f(32 + r1 * Math.cos(a) * .96)} ${f(38 + r1 * Math.sin(a) * .96)}L${f(32 + r2 * Math.cos(a))} ${f(38 + r2 * Math.sin(a))}`;
  }
  s += L(tk, 1.6);
  s += C('t-b', 32, 38, 2);
  s += L('M32 38L47 17', 1.6);
  // ruler
  let g = '';
  g += R('t-b', -29, -4.5, 58, 13, 2);
  g += R('t-a', -30, -6, 58, 12, 2);
  g += P('t-c', 'M-28 -4.3H25Q26 -4.3 26 -3.3H-28Z');
  let rt = '';
  for (let i = 0; i <= 20; i++) { const x = -26 + i * 2.6; rt += `M${f(x)} 6V${i % 5 === 0 ? -1 : i % 1 === 0 && i % 5 !== 0 && i % 2 === 0 ? 2 : 3}`; }
  g += L(rt, 1.3);
  s += `<g transform="translate(33 49) rotate(-9)">${g}</g>`;
  s += P('t-c', spark(8, 12, 4) + spark(56, 8, 3));
  add('ruler', 'wooden ruler with a protractor', s);
}

// ---------- monkey
{
  let s = '';
  // branch
  s += L('M0 9Q28 3 64 9', 5);
  s += P('t-a', 'M12 6C8 1 3 1 1 3C3 7 8 8 12 6Z' + 'M52 7C55 1.5 60 1 63 2.5C62 7 57 9 52 7Z' + 'M22 5C21 10 17 13 13 13C13 9 16 5.5 22 5Z');
  s += L('M3 3.5L11 5.8M62 3L53 6.8M20.5 6L14 12', 1.2);
  // tail
  s += L('M36 50C46 54 55 48 53 39C51.5 32.5 44 33 44.5 38.5C45 42 49 42 49.5 39', 3.2);
  // raised arm (behind head)
  s += P('t-a', cap(34, 40, 40, 11, 6.2));
  // other arm outstretched
  s += P('t-a', limb([[21, 40], [12, 42], [5, 36]], 6));
  s += C('t-b', 4.8, 34.6, 3.6);
  // legs
  s += P('t-a', limb([[24, 50], [19, 55], [15, 58]], 6.2) + limb([[32, 51], [36, 56], [41, 58]], 6.2));
  s += E('t-b', 13.5, 59.5, 4.3, 2.8, -20) + E('t-b', 43, 59.5, 4.3, 2.8, 20);
  // body
  s += E('t-a', 28, 45, 10, 10.5);
  s += P('t-b', 'M34 36.5A10 10.5 0 0 1 30 55.3A13 13 0 0 0 34 36.5Z');
  s += E('t-c', 27, 46.5, 5.5, 6.5);
  // hand on branch
  s += C('t-a', 40.3, 8.8, 3.8);
  s += P('t-b', 'M37 10Q40.5 13.5 44 10Q43 12.8 40.5 13Q38 12.8 37 10Z');
  // head
  s += C('t-a', 14.5, 23, 4.8) + C('t-a', 36.5, 23, 4.8);
  s += C('t-c', 14.5, 23, 2.6) + C('t-c', 36.5, 23, 2.6);
  s += C('t-a', 25.5, 26, 11.5);
  s += P('t-b', 'M32.5 16.9A11.5 11.5 0 0 1 21 36.6A13 13 0 0 0 32.5 16.9Z');
  s += P('t-c', circ(22, 24.5, 4.8) + circ(29, 24.5, 4.8));
  s += E('t-c', 25.5, 31, 7.5, 5.2);
  s += C('t-b', 22.3, 24.6, 1.8) + C('t-b', 28.7, 24.6, 1.8);
  s += C('t-c', 21.8, 24, .6) + C('t-c', 28.2, 24, .6);
  s += C('t-b', 24.2, 29, .8) + C('t-b', 26.8, 29, .8);
  s += L('M21.5 31.5Q25.5 35.5 29.5 31.5', 1.6);
  s += P('t-b', 'M20 14Q23 11 26 14Q23 12.8 20 14ZM24 13.5Q27 10.5 30 13.8Q27 12.3 24 13.5Z');
  add('monkey', 'monkey swinging from a branch', s);
}

// ---------- set-square
{
  let s = '';
  // triangle set square with cut-out
  const outer = [[6, 6], [6, 56], [56, 56]], inner = [[14, 25], [14, 48], [37, 48]];
  s += P('t-b', rpoly(outer.map(([x, y]) => [x + 2, y + 2]), 3) + rpoly(inner.map(([x, y]) => [x + 2, y + 2]), 2), ' fill-rule="evenodd"');
  s += P('t-a', rpoly(outer, 3) + rpoly(inner, 2), ' fill-rule="evenodd"');
  let tk = '';
  for (let i = 0; i < 9; i++) { const y = 11 + i * 5; tk += `M6 ${y}H${i % 2 ? 9.5 : 11}`; }
  for (let i = 0; i < 9; i++) { const x = 11 + i * 5; tk += `M${x} 56V${i % 2 ? 52.5 : 51}`; }
  s += L(tk, 1.5);
  s += P('t-c', 'M8 12Q8 10.5 8.8 11.5L8.8 40Q8 41 8 39.5Z');
  // ruler across
  let g = '';
  g += R('t-b', -28, -3.8, 58, 11, 2);
  g += R('t-c', -29, -5, 58, 10, 2);
  let rt = '';
  for (let i = 0; i <= 20; i++) { const x = -26 + i * 2.6; rt += `M${f(x)} -5V${i % 5 === 0 ? 0 : -2.2}`; }
  g += L(rt, 1.3);
  s += `<g transform="translate(36 43) rotate(-35)">${g}</g>`;
  // pencil
  let p = '';
  p += R('t-a', -3, -16, 6, 24);
  p += R('t-b', 1, -16, 2, 24);
  p += R('t-b', -3, -21, 6, 5.5, 1.5);
  p += P('t-c', 'M-3 8H3L0 15Z');
  p += P('t-b', 'M-1.1 12.4H1.1L0 15Z');
  s += `<g transform="translate(52 20) rotate(30)">${p}</g>`;
  add('set-square', 'ruler and triangular set square', s);
}

// ---------- sparkler
{
  let s = '';
  // rays
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6 + .15, r1 = i % 2 ? 12 : 11, r2 = i % 2 ? 17 : 21;
    rays += `M${f(40 + r1 * Math.cos(a))} ${f(21 + r1 * Math.sin(a))}L${f(40 + r2 * Math.cos(a))} ${f(21 + r2 * Math.sin(a))}`;
  }
  s += L(rays, 2);
  s += P('t-a', rpoly(star(40, 21, 11.5, 6, 8, -90), 1.2));
  s += P('t-c', rpoly(star(40, 21, 7, 3.6, 6, -60), .8));
  s += P('t-c', spark(58, 6, 3.5) + spark(62, 32, 2.5) + spark(22, 5, 3) + spark(46, 45, 3));
  s += C('t-c', 56, 17, 1.4) + C('t-c', 28, 12, 1.2);
  let h = '';
  h += L('M0 12V-22', 1.8);
  h += P('t-b', cap(0, -21, 0, -34, 3.4));
  h += R('t-b', -5, 6, 11, 16, 2);
  h += R('t-a', -3, -8, 10.5, 16, 4.5);
  h += P('t-b', 'M4 -8H3Q7.5 -8 7.5 -3.5V3.5Q7.5 8 3 8H2Q5 7 5 3.5V-3.5Q5 -7 3.5 -8Z');
  for (let k = 0; k < 4; k++) h += R('t-a', -8.2, -7.4 + k * 3.7, 9.6, 3.7, 1.85);
  h += L('M-7.2 -3.7H-1M-7.2 0H-1M-7.2 3.7H-1', 1.1);
  h += P('t-a', cap(5, -6.8, -4, -9.5, 4.4));
  h += P('t-b', 'M-5.5 -7.6Q0 -6.5 5.5 -4.8Q3 -5 -1 -6.2Q-4 -6.8 -5.5 -7.6Z');
  h += R('t-c', -7, -6.5, 1.4, 12, .7);
  s += `<g transform="translate(15 50) rotate(41)">${h}</g>`;
  add('sparkler', 'hand-held sparkler throwing stars', s);
}

// ---------- frying-pan
{
  let s = '';
  s += L('M18 14C15 11 21 8.5 18 4.5M27 12C24 9 30 6.5 27 2.5M36 14C33 11 39 8.5 36 4.5', 2.2);
  // handle
  s += P('t-b', cap(46, 38, 62, 29, 7.4));
  s += P('t-a', cap(46, 36.5, 61.5, 27.5, 6.4));
  s += C('t-b', 58.5, 29.3, 1.6);
  // pan
  s += E('t-b', 26, 41.5, 24.5, 17.5);
  s += E('t-a', 26, 39, 24.5, 17);
  s += E('t-b', 26, 39.5, 20.5, 13.5);
  s += P('t-c', 'M9 32A20 13.5 0 0 1 20 26.5Q13 30 10.5 34.5Z');
  // egg
  s += P('t-c', 'M17 36C16 31 21 28.5 26 30C30 27.5 37 29 38 34C41 37 39 43 34 44C30 48 21 47.5 19 43C14.5 42 14 38 17 36Z');
  s += C('t-a', 27, 37.5, 5.8);
  s += P('t-b', 'M31.6 34A5.8 5.8 0 0 1 23 41.8A7 7 0 0 0 31.6 34Z');
  s += E('t-c', 25, 35.5, 1.8, 1.2, -30);
  s += P('t-c', circ(11, 42, 1.2) + circ(41, 30, 1) + circ(42, 44, 1.1));
  s += P('t-c', spark(52, 12, 4) + spark(8, 18, 3));
  add('frying-pan', 'frying pan with a sizzling egg', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part14.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
