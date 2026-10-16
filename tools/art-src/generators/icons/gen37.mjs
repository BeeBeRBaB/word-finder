// Generates part37.json (round 4: library and lab subjects).
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
const mx = pts => pts.map(([x, y]) => [64 - x, y]);
const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;

// ---------- safety-goggles
{
  let s = '';
  // strap ends behind the frame
  s += P('t-b', rpoly([[4.5, 19], [10, 18], [10, 32], [4.5, 31]], 1.5) + rpoly(mx([[4.5, 19], [10, 18], [10, 32], [4.5, 31]]), 1.5));
  const frame = [[9, 13], [32, 9.5], [55, 13], [58.5, 24], [55, 37], [40, 38.5], [35.5, 33], [32, 32], [28.5, 33], [24, 38.5], [9, 37], [5.5, 24]];
  const lens = [[13, 19.5], [28.5, 17.5], [29.5, 27], [24.5, 33.5], [13.5, 33], [10.5, 26]];
  s += P('t-a', rpoly(frame, [4, 3, 4, 5, 4, 3, 2, 2, 2, 3, 4, 5]) + rpoly(lens, 3) + rpoly(mx(lens), 3), ' fill-rule="evenodd"');
  // vents on the top band
  let v = '';
  for (const x of [14, 18.5, 23]) v += cap(x, 13.4 - (x - 14) * .1, x + 2, 13.2 - (x - 14) * .1, 1.8) + cap(64 - x, 13.4 - (x - 14) * .1, 62 - x, 13.2 - (x - 14) * .1, 1.8);
  s += P('t-b', v);
  // lower rim shade
  s += P('t-b', 'M7 31Q8 36 11 37L24 38.5L26.5 35.5L13 35Q9 34.5 7 31Z' + 'M57 31Q56 36 53 37L40 38.5L37.5 35.5L51 35Q55 34.5 57 31Z');
  // lens shine
  s += P('t-c', cap(15, 28, 21, 21, 2.4) + cap(43, 28, 49, 21, 2.4) + circ(24.5, 21.5, 1.2) + circ(52.5, 21.5, 1.2));
  // flask
  const fl = [[45, 40], [51, 40], [51, 46], [59, 58], [57.5, 60], [38.5, 60], [37, 58], [45, 46]];
  s += P('t-a', rpoly(fl, [.5, .5, 1, 2, 1, 1, 2, 1]));
  s += P('t-b', 'M41.1 52H54.9L58.6 57.6Q59.2 59.5 57.4 59.6H38.6Q36.8 59.5 37.4 57.6Z');
  s += R('t-b', 43.5, 39, 9, 2.6, 1);
  s += P('t-c', circ(52, 35.5, 1.3) + circ(49.5, 32.8, .9));
  s += P('t-c', spark(9, 50, 4) + spark(19, 57, 2.4));
  add('safety-goggles', 'vented lab safety goggles with strap beside a small flask', s);
}

// ---------- library-building
{
  let s = '';
  // pediment with open-book emblem cut out
  const book = 'M24.5 11.6Q28.5 10.4 31.3 12.4V17.6Q28.5 15.8 24.5 16.8Z' + 'M39.5 11.6Q35.5 10.4 32.7 12.4V17.6Q35.5 15.8 39.5 16.8Z';
  s += P('t-a', rpoly([[32, 4.5], [59.5, 19], [4.5, 19]], [2, 1.5, 1.5]) + book, ' fill-rule="evenodd"');
  // sign band with lettering cut out
  let letters = '';
  for (let i = 0; i < 7; i++) letters += rect(17.6 + i * 4.3, 21.6, 2.4, 3.2);
  s += P('t-a', rpoly([[6, 20.2], [58, 20.2], [58, 26.6], [6, 26.6]], 1) + letters, ' fill-rule="evenodd"');
  s += R('t-b', 7.5, 26.6, 49, 2, .5);
  // shadow under the cornice, between columns
  s += R('t-b', 10, 28.6, 44, 2.4);
  // columns
  for (const x of [10.5, 19.5, 39.5, 48.5]) {
    s += P('t-a', `M${f(x - .8)} 28.6h${f(6.6)}v2.4h-1v15h1v3.6h${f(-6.6)}v-3.6h1v-15h-1Z`);
    s += R('t-b', x + 3.1, 31, 1.3, 15);
  }
  // centre wall with big arched doorway, double doors inside
  s += P('t-a', rect(26.6, 28.6, 10.8, 21) + 'M28 49.6V36.6Q28 32 32 32Q36 32 36 36.6V49.6Z', ' fill-rule="evenodd"');
  s += P('t-b', 'M28.9 49.6V36.8Q28.9 33.2 31.5 32.9V49.6ZM35.1 49.6V36.8Q35.1 33.2 32.5 32.9V49.6Z');
  s += R('t-a', 30, 41, .9, 2.4) + R('t-a', 33.1, 41, .9, 2.4);
  // steps
  s += R('t-a', 7, 49.6, 50, 3.5, .8) + R('t-a', 5.5, 53.6, 53, 3.5, .8) + R('t-a', 4.5, 57.6, 55, 3.5, .8);
  s += R('t-b', 7, 52.3, 50, .9) + R('t-b', 5.5, 56.3, 53, .9) + R('t-b', 4.5, 60.3, 55, .8);
  s += P('t-c', spark(8, 7.5, 3.4) + spark(57, 7, 2.6));
  add('library-building', 'library front with book emblem pediment, sign band, columns, doors and steps', s);
}

// ---------- date-stamp
{
  let s = '';
  // card with stamped date box and lines cut out
  const box = rect(8, 43.5, 15, 10) + rect(9.8, 45.3, 11.4, 6.4) + rect(11.2, 47, 2.4, 3) + rect(14.4, 47, 2.4, 3) + rect(17.6, 47, 2.4, 3);
  let lines = '';
  for (const y of [45, 49.5, 54]) lines += cap(27, y, 41, y, 1.6);
  s += `<g transform="rotate(-4 25 49)">` + P('t-a', rpoly([[5, 39.5], [45, 39.5], [45, 58], [5, 58]], 1.5) + box + lines, ' fill-rule="evenodd"') + '</g>';
  // ink pad
  s += P('t-a', rpoly([[47, 47], [59.5, 47], [59.5, 59.5], [47, 59.5]], 2));
  s += R('t-b', 49, 49, 8.5, 5, 1);
  s += R('t-b', 47, 56.5, 12.5, 3, 1.4);
  // stamp: wooden handle
  s += C('t-a', 33, 9.5, 5.5);
  s += P('t-a', 'M30.4 13.5Q31.4 18 29.5 22.5L28.5 25H37.5L36.5 22.5Q34.6 18 35.6 13.5Z');
  s += P('t-b', 'M34.4 14Q33.6 18.5 35.2 23L36.2 25H37.5L36.5 22.5Q34.6 18 35.6 13.5Z' + 'M35.6 6.4Q38.5 8.6 37.6 12.6Q36.4 14.6 34.2 15Q37.2 11.6 35.6 6.4Z');
  s += P('t-c', circ(31, 7.6, 1.5));
  // mount block with date band window cut out
  s += P('t-a', rpoly([[23.5, 25], [42.5, 25], [42.5, 35], [23.5, 35]], 1.6) + rect(26.5, 27.6, 13, 4.8), ' fill-rule="evenodd"');
  s += R('t-a', 27.8, 29, 2.6, 2) + R('t-a', 31.7, 29, 2.6, 2) + R('t-a', 35.6, 29, 2.6, 2);
  // rubber
  s += R('t-b', 24.5, 35, 17, 4, .8);
  // press marks
  s += L('M20.5 33.5L18 31M20 37.5H16.5M45.5 33.5L48 31M46 37.5H48.5', 1.4);
  s += P('t-c', spark(9, 9, 4) + spark(54, 14, 3));
  add('date-stamp', 'rubber date stamp pressing onto a card beside an ink pad', s);
}

// ---------- library-card
{
  let s = '';
  // cover behind pages
  s += P('t-b', rpoly([[4.5, 22], [32, 25], [59.5, 22], [59.5, 58], [32, 60.5], [4.5, 58]], 2) + 'M8 26L32 29L56 26V54L32 56.5L8 54Z', ' fill-rule="evenodd"');
  // right page with text lines cut out
  let tl = '';
  for (const [y, w] of [[31, 15.5], [36, 15.5], [41, 15.5], [46, 11], [51, 15.5]]) tl += cap(38, y + .6, 38 + w, y - .9, 1.6);
  s += P('t-a', rpoly([[33, 26.5], [58, 23.5], [58, 55], [33, 57.5]], [1, 1.5, 1.5, 1]) + tl, ' fill-rule="evenodd"');
  // left page (inside cover)
  s += P('t-a', rpoly([[6, 23.5], [31, 26.5], [31, 57.5], [6, 55]], [1.5, 1, 1, 1.5]) + rpoly([[7.4, 31], [29.6, 31], [29.6, 54.1], [7.4, 54.1]], 2.6), ' fill-rule="evenodd"');
  s += P('t-b', 'M31 26.5L33 26.5L33 57.5L31 57.5Z');
  // card standing up out of the pocket, with book icon and lines cut out
  const icon = 'M13.5 10Q16 9.2 18.2 10.6V15Q16 13.9 13.5 14.6Z' + 'M23 10Q20.5 9.2 18.8 10.6V15Q20.5 13.9 23 14.6Z';
  let cl = '';
  for (const y of [19, 23, 27]) cl += cap(12.5, y, 24, y, 1.5);
  s += P('t-b', R('t-b', 0, 0, 0, 0) && 'M27.5 9H29V44H27.5Z');
  s += P('t-a', rpoly([[9, 5], [27.5, 5], [27.5, 44], [9, 44]], 1.5) + icon + cl, ' fill-rule="evenodd"');
  // pocket
  s += P('t-b', 'M8.5 32H14.5Q18.25 37 22 32H28.5V51Q28.5 53 26.5 53H10.5Q8.5 53 8.5 51Z');
  s += P('t-c', spark(46, 9, 4) + spark(55, 15.5, 2.4));
  add('library-card', 'library card in a pocket inside the cover of an open book', s);
}

// ---------- bookshop-front
{
  let s = '';
  // building with window cut out
  const win = rect(9, 28, 24, 23);
  s += P('t-a', rpoly([[5, 8], [50, 8], [50, 58], [5, 58]], 1) + win, ' fill-rule="evenodd"');
  s += R('t-b', 4.5, 6, 46, 3.6, 1);
  // fascia sign lettering
  let lt = '';
  for (let i = 0; i < 6; i++) lt += rect(11 + i * 5.6, 11.5, 3.4, 2.6);
  s += P('t-b', lt);
  // awning: scalloped stripes
  let aw = '';
  const ax0 = 4.5, aw0 = 46.5 / 6;
  for (let i = 0; i < 6; i++) {
    const x = ax0 + i * aw0;
    aw += `M${f(x + 1.2)} 16.5H${f(x + aw0 - 1.2)}L${f(x + aw0)} 23Q${f(x + aw0 * .5)} 27.5 ${f(x)} 23Z`;
  }
  s += P('t-b', rpoly([[6, 16.5], [49, 16.5], [51, 23], [4, 23]], .8));
  s += P('t-a', aw.split('Z').filter((_, i) => i % 2 === 0 && _).join('Z') + 'Z');
  s += P('t-b', aw.split('Z').filter((_, i) => i % 2 === 1 && _).join('Z') + 'Z');
  // book spines in the window, two shelves
  const spines = [[10.5, 2.4, 9, 'a'], [13.3, 2, 7.5, 'b'], [15.7, 2.6, 8.5, 'a'], [18.7, 1.8, 6.5, 'b'], [21, 2.6, 9, 'a'], [24, 2.2, 8, 'b'], [26.6, 2.6, 7, 'a'], [29.5, 2.2, 8.5, 'b']];
  for (const row of [0, 1]) {
    const base = row ? 49.5 : 38.4;
    for (const [x, w, h, c] of spines) {
      const hh = row ? h - ((x * 7) % 2.5) : h, cc = row ? (c === 'a' ? 'b' : 'a') : c;
      s += R('t-' + cc, x + (row ? .3 : 0), base - hh, w, hh, .5);
    }
    s += R('t-a', 9, base, 24, 1.4);
  }
  // door
  s += P('t-b', 'M37 58V33.5Q37 29.5 41.5 29.5Q46 29.5 46 33.5V58Z');
  s += C('t-a', 43.8, 45, 1.1);
  s += R('t-a', 39, 33.5, 5, 6, 1);
  // step
  s += R('t-b', 3.5, 57.5, 48, 3, 1);
  // hanging book sign
  s += L('M50 25.5H59', 1.6);
  s += L('M52.5 25.5V29.5M58 25.5V29.5', 1);
  s += P('t-a', 'M50.5 31Q53 29.3 55.25 30.6Q57.5 29.3 60 31V40.5Q57.5 39 55.25 40.3Q53 39 50.5 40.5Z');
  s += P('t-b', 'M54.7 30.6H55.8V40.3H54.7Z');
  s += P('t-c', spark(57.5, 6.5, 3.4) + spark(58, 50, 2.4));
  add('bookshop-front', 'small bookshop with striped awning, window full of books and a hanging book sign', s);
}

// ---------- picture-book
{
  let s = '';
  // cover rim behind (frame only, so cut-outs in the pages stay holes)
  s += P('t-b', rpoly([[4.5, 12], [32, 18], [59.5, 12], [59.5, 51], [32, 57], [4.5, 51]], 2) + 'M9 13.5L32 18.5L55 13.5V46L32 51L9 46Z', ' fill-rule="evenodd"');
  // left page: sun cut out
  const lp = [[6.5, 9], [31, 14.5], [31, 53], [6.5, 47.5]];
  let sun = circ(17.5, 24, 4.4);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .2, c = Math.cos(a), n = Math.sin(a); sun += cap(17.5 + 6.6 * c, 24 + 6.6 * n, 17.5 + 8.6 * c, 24 + 8.6 * n, 1.8); }
  s += P('t-a', rpoly(lp, [1.5, .6, .6, 1.5]) + sun, ' fill-rule="evenodd"');
  // right page: house cut out, door and window left as page
  const house = 'M40.6 37V28.6H39.4L47.2 20.4L55 28.6H53.8V35.4Q47.5 35 40.6 37Z';
  const isl = rect(43, 30.6, 3, 5.4) + rect(48.6, 30.2, 3, 2.8);
  s += P('t-a', rpoly(mx(lp), [.6, 1.5, 1.5, .6]) + house + isl, ' fill-rule="evenodd"');
  s += P('t-b', 'M31 14.5L33 14.5L33 53L31 53Z');
  // rolling hills across the spread
  s += P('t-b', 'M6.5 40Q20 33.5 31 39.5V53L6.5 47.5Z' + 'M33 41.5Q42 36.4 47 36Q53 35.4 57.5 33.5V47.5L33 53Z');
  // crayon in front
  const cA = [27, 60], cB = [52.5, 52.2];
  s += P('t-a', cap(cA[0], cA[1], cB[0], cB[1], 5));
  s += P('t-b', 'M52.2 49.7L59.4 49.9L53.6 54.6Z');
  const along = (t, o) => { const dx = cB[0] - cA[0], dy = cB[1] - cA[1], l = Math.hypot(dx, dy); return [cA[0] + dx * t - dy / l * o, cA[1] + dy * t + dx / l * o]; };
  let bands = '';
  for (const [t0, t1] of [[.12, .22], [.7, .8]]) { const p = [along(t0, -2.5), along(t1, -2.5), along(t1, 2.5), along(t0, 2.5)]; bands += 'M' + p.map(q => f(q[0]) + ' ' + f(q[1])).join('L') + 'Z'; }
  s += P('t-b', bands);
  s += P('t-c', spark(58, 5.5, 3.2) + spark(6.5, 57, 2.6));
  add('picture-book', 'open square picture book with sun, hill and house, and a crayon', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part37.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
