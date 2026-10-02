// Generates part3.json: food & drink, home, clothing, celebrations icons.
import fs from 'node:fs';
const f = n => String(+(+n).toFixed(1));
const C = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const E = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
// rotated ellipse (deg clockwise), as a path
const RE = (cx, cy, rx, ry, deg) => {
  const a = deg * Math.PI / 180, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
  return `M${f(cx - dx)} ${f(cy - dy)}A${f(rx)} ${f(ry)} ${deg} 1 0 ${f(cx + dx)} ${f(cy + dy)}A${f(rx)} ${f(ry)} ${deg} 1 0 ${f(cx - dx)} ${f(cy - dy)}Z`;
};
const R = (x, y, w, h, r = 0) => r
  ? `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`
  : `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
const P = (cls, d, extra = '') => `<path class="${cls}"${extra} d="${d}"/>`;
// main shape with highlight holes punched out (evenodd), then the highlight itself
const A = (d, holes = [], cls = 't-a') => holes.length
  ? P(cls, d + holes.join(''), ' fill-rule="evenodd"') + P('t-c', holes.join(''))
  : P(cls, d);
const L = (d, w) => `<path class="ln"${w ? ` stroke-width="${w}"` : ''} d="${d}"/>`;
const G = (t, s) => `<g transform="${t}">${s}</g>`;
const poly = (cls, pts) => `<polygon class="${cls}" points="${pts.map(p => p.map(f).join(',')).join(' ')}"/>`;

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- celebrations ----------
{ // gift
  const lidHi = R(10.5, 23.5, 10, 2.6, 1.3), bodyHi = R(13.5, 37, 2.8, 15, 1.4);
  const ribL = R(28, 21, 8, 10), ribB = R(28, 31, 8, 27);
  add('gift', 'wrapped present with a bow',
    P('t-a', R(10, 31, 44, 27, 2) + ribB + bodyHi, ' fill-rule="evenodd"') +
    P('t-a', R(7, 21, 50, 10, 2) + ribL + lidHi, ' fill-rule="evenodd"') +
    P('t-c', ribL + ribB + lidHi + bodyHi) +
    P('t-b', 'M10 31H54V34.5H10ZM47 34.5H54V56Q54 58 52 58H47ZM50 21H55Q57 21 57 23V29Q57 31 55 31H50Z') +
    P('t-a', 'M32 21C26 11 12 5.5 11 13.5C10.3 19.5 20 22 32 21ZM32 21C38 11 52 5.5 53 13.5C53.7 19.5 44 22 32 21Z') +
    P('t-b', 'M29 19.3C24 13.5 15.5 10.5 15 14C14.6 17.3 20.5 19.5 29 19.3ZM35 19.3C40 13.5 48.5 10.5 49 14C49.4 17.3 43.5 19.5 35 19.3Z') +
    P('t-b', R(28, 15.5, 8, 7.5, 2.8)) +
    L('M5 3.5V8.5M2.5 6H7.5M59 4.5V8.5M57 6.5H61', 1.8));
}
{ // cake
  let bot = 'M8 38H56V43'; for (let i = 0; i < 8; i++) bot += 'a3 3 0 0 1 -6 0'; bot += 'Z';
  let top = 'M17 23H47V27'; for (let i = 0; i < 6; i++) top += 'a2.5 2.5 0 0 1 -5 0'; top += 'Z';
  const flame = (cx) => `M${cx} 1.5C${cx + 2.2} 4.2 ${cx + 3} 6 ${cx + 3} 7.8A3 3 0 0 1 ${cx - 3} 7.8C${cx - 3} 6 ${cx - 2.2} 4.2 ${cx} 1.5Z`;
  const inner = (cx) => `M${cx} 5.2C${cx + 1} 6.4 ${cx + 1.3} 7.3 ${cx + 1.3} 8.2A1.3 1.3 0 0 1 ${cx - 1.3} 8.2C${cx - 1.3} 7.3 ${cx - 1} 6.4 ${cx} 5.2Z`;
  const xs = [22, 32, 42];
  add('cake', 'two-tier birthday cake with candles',
    P('t-b', R(3, 54.5, 58, 5, 2.5)) +
    A('M8 38H56V55H8Z', [bot]) + A('M17 23H47V38H17Z', [top]) +
    P('t-b', 'M50.5 46.2H56V55H50.5ZM42.5 29.8H47V38H42.5Z') +
    P('t-b', [14, 22, 30, 38, 46].map(x => C(x, 50.5, 1.7)).join('')) +
    P('t-b', xs.map(x => R(x - 2, 12, 4, 11, 1)).join('')) +
    P('t-c', xs.map(x => `M${x - 2} 15.6L${x + 2} 13.4V15L${x - 2} 17.2ZM${x - 2} 20.2L${x + 2} 18V19.6L${x - 2} 21.8Z`).join('')) +
    A(xs.map(flame).join(''), xs.map(inner)));
}
{ // balloons
  const bp = (cx, t, rx, H) => `M${f(cx)} ${f(t)}C${f(cx + .6 * rx)} ${f(t)} ${f(cx + rx)} ${f(t + .25 * H)} ${f(cx + rx)} ${f(t + .47 * H)}C${f(cx + rx)} ${f(t + .77 * H)} ${f(cx + .4 * rx)} ${f(t + .97 * H)} ${f(cx)} ${f(t + H)}C${f(cx - .4 * rx)} ${f(t + .97 * H)} ${f(cx - rx)} ${f(t + .77 * H)} ${f(cx - rx)} ${f(t + .47 * H)}C${f(cx - rx)} ${f(t + .25 * H)} ${f(cx - .6 * rx)} ${f(t)} ${f(cx)} ${f(t)}Z`;
  const balloon = (cx, t, rx, H) => {
    const inner = bp(cx - .125 * rx, t + .3, .8 * rx, .83 * H);
    const hi = RE(cx - .5 * rx, t + .3 * H, .17 * rx, .3 * rx, 28);
    return P('t-b', bp(cx, t, rx, H) + inner, ' fill-rule="evenodd"') + A(inner, [hi]) +
      poly('t-b', [[cx, t + H - .6], [cx + 2.4, t + H + 2.8], [cx - 2.4, t + H + 2.8]]);
  };
  add('balloons', 'bunch of three balloons',
    L('M13 30C11 38 20 44 25 50S30 56 32 60M51 30C53 38 44 44 39 50S34 56 32 60M32 45C30 49 34 53 32 60', 1.6) +
    balloon(13, 3, 10.5, 25) + balloon(51, 3, 10.5, 25) + balloon(32, 16, 11.5, 27) +
    P('t-b', 'M32 59L27.5 56.5V62.5ZM32 59L36.5 56.5V62.5Z'));
}
{ // champagne flutes
  const glass = () =>
    P('t-c', 'M-7 0H7L6.7 6H-6.7Z') +
    P('t-a', 'M-6.7 6H6.7L6.2 17Q5.5 24 0 25Q-5.5 24 -6.2 17Z' + [[-2.5, 12], [1.2, 16.5], [-1, 20.5], [2.8, 9.5]].map(([x, y]) => C(x, y, .95)).join(''), ' fill-rule="evenodd"') +
    P('t-c', [[-2.5, 12], [1.2, 16.5], [-1, 20.5], [2.8, 9.5]].map(([x, y]) => C(x, y, .95)).join('')) +
    P('t-b', 'M3.8 6H6.7L6.2 17Q5.5 24 0 25Q3.8 21.5 3.8 17Z') +
    P('t-b', R(-1.3, 24.5, 2.6, 15) + E(0, 40, 7.5, 2.2));
  add('champagne-flutes', 'two champagne glasses clinking',
    G('translate(24 14.5) rotate(14) scale(1.12)', glass()) +
    G('translate(40 14.5) rotate(-14) scale(1.12)', glass()) +
    L('M32 3V8.5M25.5 5L28.5 9.5M38.5 5L35.5 9.5', 2) +
    P('t-c', C(22, 6, 1.4) + C(43, 4, 1.1) + C(19, 11, 1)));
}
{ // firework
  const cx = 32, cy = 27; let petA = '', petB = '', dots = '';
  for (let i = 0; i < 16; i++) {
    const a = (i * 22.5 - 90) * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], n = [-u[1], u[0]];
    const long = i % 2 === 0, r1 = long ? 6.5 : 7.5, r2 = long ? 22 : 15, w = long ? 2.4 : 1.7, rm = r1 + .6 * (r2 - r1);
    const pt = (r, s) => [cx + r * u[0] + s * w * n[0], cy + r * u[1] + s * w * n[1]];
    const d = 'M' + [pt(r1, 0), pt(rm, 1), pt(r2, 0), pt(rm, -1)].map(p => p.map(f).join(' ')).join('L') + 'Z';
    if (long) { petA += d; dots += C(cx + 25.5 * u[0], cy + 25.5 * u[1], 1.7); } else petB += d;
  }
  let small = ''; for (let i = 0; i < 8; i++) { const a = i * 45 * Math.PI / 180; small += `M${f(52 + 3 * Math.cos(a))} ${f(53 + 3 * Math.sin(a))}L${f(52 + 8 * Math.cos(a))} ${f(53 + 8 * Math.sin(a))}`; }
  let small2 = ''; for (let i = 0; i < 6; i++) { const a = (i * 60 + 30) * Math.PI / 180; small2 += `M${f(11 + 2.5 * Math.cos(a))} ${f(54 + 2.5 * Math.sin(a))}L${f(11 + 6 * Math.cos(a))} ${f(54 + 6 * Math.sin(a))}`; }
  add('firework', 'bursting firework with sparks',
    P('t-a', petA) + P('t-b', petB) + P('t-b', dots) + P('t-c', C(cx, cy, 4)) +
    L(small, 2.2) + L(small2, 2) + P('t-b', C(52, 53, 1.8) + C(11, 54, 1.4)) +
    L('M4 34V38M2 36H6M60 14V18M58 16H62', 1.6));
}
{ // bunting
  const q = (p0, p1, p2, t) => [0, 1].map(k => (1 - t) ** 2 * p0[k] + 2 * (1 - t) * t * p1[k] + t * t * p2[k]);
  const row = (p0, p1, p2, ts, off) => {
    let a = '', b = '', hi = '';
    ts.forEach((t, i) => {
      const l = q(p0, p1, p2, t - .055), r = q(p0, p1, p2, t + .055), m = q(p0, p1, p2, t);
      const tip = [m[0], m[1] + 13];
      const d = `M${f(l[0])} ${f(l[1])}L${f(r[0])} ${f(r[1])}L${f(tip[0])} ${f(tip[1])}Z`;
      if ((i + off) % 2 === 0) { a += d; hi += C(m[0], m[1] + 4.2, 1.5); } else b += d;
    });
    return { a, b, hi };
  };
  const r1 = row([1, 5], [32, 25], [63, 5], [.09, .235, .38, .525, .67, .815, .96].map(t => t - .025), 0);
  const r2 = row([1, 33], [32, 53], [63, 33], [.16, .305, .45, .595, .74, .885], 1);
  add('bunting', 'strings of party flag bunting',
    L('M1 5Q32 25 63 5M1 33Q32 53 63 33', 1.8) +
    P('t-a', r1.a + r2.a + r1.hi + r2.hi, ' fill-rule="evenodd"') + P('t-c', r1.hi + r2.hi) + P('t-b', r1.b + r2.b));
}
{ // candle
  const pool = 'M21 24A11 2.3 0 0 1 43 24V27Q43 28 42 28H40.5V31A1.5 1.5 0 0 1 37.5 31V28H34.5V35A1.7 1.7 0 0 1 31.1 35V28H26.5V30A1.5 1.5 0 0 1 23.5 30V28H22Q21 28 21 27Z';
  const hi = R(23.5, 37, 2.6, 13, 1.3);
  add('candle', 'lit pillar candle with dripping wax',
    P('t-b', C(58, 49.5, 4.8) + C(58, 49.5, 2.4) + E(32, 56, 25, 5), ' fill-rule="evenodd"') +
    A('M20 24A12 3 0 0 1 44 24V55Q44 56 43 56H21Q20 56 20 55Z', [pool, hi]) +
    P('t-b', 'M40.5 32.3H44V55Q44 56 43 56H40.5Z') +
    A('M32 1C35.5 6.5 39.5 9.5 39.5 13.5A7.5 7.5 0 0 1 24.5 13.5C24.5 9.5 28.5 6.5 32 1Z', ['M32 8C34 10.8 35.6 12.8 35.6 14.8A3.6 3.6 0 0 1 28.4 14.8C28.4 12.8 30 10.8 32 8Z']) +
    L('M32 21.5V17.5', 2) + L('M17 7L20.5 9.5M47 7L43.5 9.5M15 16H19M49 16H45', 2));
}
// ---------- food & drink ----------
{ // coffee cup
  add('coffee-cup', 'steaming cup on a saucer',
    P('t-b', E(31, 55.5, 28, 5.2)) +
    P('t-a', E(50, 38, 9, 8.5) + E(50, 38, 4.8, 4.3), ' fill-rule="evenodd"') +
    A('M8 26A22 4.5 0 0 1 52 26C52 40 47 51 38 53.5H22C13 51 8 40 8 26Z', [R(12.5, 32, 3, 11, 1.5)]) +
    P('t-b', 'M45.5 30.2Q49.5 29 52 26C52 40 47 51 38 53.5C43.5 47 45.5 39 45.5 30.2Z') +
    P('t-b', E(30, 26.3, 19, 3.3)) +
    P('t-c', 'M30 28.3L27.2 25.9A1.5 1.5 0 0 1 30 24.2A1.5 1.5 0 0 1 32.8 25.9Z') +
    L('M21 18C18 15 24 12 21 7M30 17C27 14 33 11 30 4.5M39 18C36 15 42 12 39 7', 2.6));
}
{ // cooking pot
  add('cooking-pot', 'lidded pot with steam',
    P('t-b', R(2, 33, 10, 6, 3) + R(52, 33, 10, 6, 3)) +
    A('M9 31H55V51Q55 57 49 57H15Q9 57 9 51Z', [R(13, 36, 3, 14, 1.5)]) +
    P('t-b', 'M48 33H55V51Q55 57 49 57H45.5Q48 55 48 51Z') +
    P('t-b', R(6.5, 28, 51, 5, 2.5)) +
    A('M9 28Q9 16 32 16Q55 16 55 28Z', [RE(19.5, 21.8, 5, 1.6, -22)]) +
    P('t-b', 'M44 17.6Q55 20 55 28H47Q47 22 44 17.6Z') +
    P('t-b', R(27, 10, 10, 7, 3)) +
    L('M16 13C13 10 19 7 16 2.5M48 13C45 10 51 7 48 2.5', 2.6));
}
{ // plate with fork and knife
  add('dinner-plate', 'plate with a fork and knife',
    P('t-a', C(32, 33, 19.5) + C(32, 33, 12.5), ' fill-rule="evenodd"') + P('t-c', C(32, 33, 12.5)) +
    P('t-b', C(32, 33, 19.5) + C(30.8, 31.8, 17.8), ' fill-rule="evenodd"') +
    L('M24 26A10 10 0 0 1 30 23', 2) +
    P('t-b', 'M3 8V18Q3 23.5 7 24.5Q11 23.5 11 18V8Z' + R(4.9, 7, 1.4, 11) + R(8.1, 7, 1.4, 11), ' fill-rule="evenodd"') +
    P('t-b', R(5.3, 23, 3.4, 36, 1.7)) +
    P('t-b', 'M53 8Q61 9.5 61 22V33H53Z' + R(53, 32, 8, 27, 4)) +
    P('t-c', C(57, 40, 1) + C(57, 46, 1)));
}
{ // apple
  add('apple', 'shiny apple with a leaf',
    A('M32 17C24 11 7 13 7 32C7 47 17 60 26 58C29 57.3 35 57.3 38 58C47 60 57 47 57 32C57 13 40 11 32 17Z', [RE(16.5, 29, 2.8, 6.5, 22), C(21, 20.3, 1.6)]) +
    P('t-b', 'M57 30C57 47 47 60 38 58C47 53 52.5 44 53 31C53.2 24 51.5 20 48 16.8C54 18.5 57 24 57 30Z') +
    P('t-b', 'M30.8 18Q30.5 10 35 4.5L37.6 6.2Q33.8 11 34 18Z') +
    P('t-a', 'M35 9.5C39 2 49 0.5 55.5 3.5C51 10 43 12.8 35 9.5Z') + L('M37.5 8.8C43 6.8 48 5 53 4', 1.6));
}
{ // bread loaf and a slice
  const s = [RE(31, 30, 2, 7, 35), RE(41.5, 27, 2.1, 8, 35), RE(52, 30, 2, 7, 35)];
  const crumb = 'M8.8 35C5 29.5 7.8 23.8 13 23.8H20C25.2 23.8 28 29.5 24.2 35V55Q24.2 56.5 22.7 56.5H10.3Q8.8 56.5 8.8 55Z';
  add('bread', 'loaf of bread with a slice',
    A('M20 42C20 27 30 17 42 17C54 17 62 27 62 42V47Q62 52 57 52H25Q20 52 20 47Z', s) +
    P('t-b', 'M20 44.5H62V47Q62 52 57 52H25Q20 52 20 47Z') +
    P('t-b', 'M53.5 20.5C59 24.5 62 32 62 42V44.5H58C58 35 56.5 26 53.5 20.5Z') +
    P('t-c', C(25, 32, 1) + C(36, 20.5, 1) + C(47, 20, 1)) +
    P('t-b', 'M6 34.5C1.5 28.5 5 21 12.5 21H20.5C28 21 31.5 28.5 27 34.5V56Q27 59 24 59H9Q6 59 6 56Z' + crumb, ' fill-rule="evenodd"') +
    P('t-c', crumb) + P('t-a', C(13.5, 31, 1) + C(19.5, 38, .9) + C(13, 46, .9) + C(20, 50, .8)));
}
// ---------- home ----------
{ // lamp
  add('lamp', 'table lamp glowing',
    A('M22 5H42Q44 5 44.8 7L53 27Q54 30 51 30H13Q10 30 11 27L19.2 7Q20 5 22 5Z', ['M20.8 25L25.4 9.5H28.2L23.8 25Z']) +
    P('t-b', 'M39.5 5H42Q44 5 44.8 7L53 27Q54 30 51 30H45.5Z') +
    P('t-b', R(10.6, 27, 43, 3.5, 1.7)) +
    P('t-b', R(30.5, 30.5, 3, 8)) +
    A('M25 56C18.5 50 19.5 41.5 27 38H37C44.5 41.5 45.5 50 39 56Z', [RE(25.5, 46.5, 1.5, 4, 15)]) +
    P('t-b', 'M39.5 39.5C44.5 43.5 44.5 51 39 56H35C39.5 51 40.5 44 39.5 39.5Z') +
    P('t-b', R(19, 55, 26, 4.5, 2.2)) +
    L('M13 35L8.5 39.5M51 35L55.5 39.5M8.5 30.5H4M55.5 30.5H60', 2.2));
}
{ // armchair
  add('armchair', 'cosy channel-tufted armchair',
    A(R(13, 4, 38, 46, 9), [R(17.5, 36, 29, 9, 3.5), R(17, 9, 3, 15, 1.5)]) +
    L('M25 10Q24 21 25 32M32 9V33M39 10Q40 21 39 32', 1.8) +
    A('M3.5 30Q3.5 23.5 10.5 23.5Q17.5 23.5 17.5 30V50H3.5Z', [RE(8, 27.5, 2.5, 1.2, -20)]) +
    A('M46.5 30Q46.5 23.5 53.5 23.5Q60.5 23.5 60.5 30V50H46.5Z', [RE(51, 27.5, 2.5, 1.2, -20)]) +
    P('t-b', 'M15 31.5H17.5V50H15ZM46.5 31.5H49V50H46.5ZM58 31H60.5V50H58Z') +
    P('t-b', R(3, 46, 58, 6.5, 2.5)) +
    P('t-b', 'M8 52H14L13 59.5H9ZM50 52H56L55 59.5H51Z'));
}
// ---------- clothing ----------
{ // thread spool, needle and button
  const holes = [[48.5, 48.5], [54.5, 48.5], [48.5, 54.5], [54.5, 54.5]].map(([x, y]) => C(x, y, 1.6)).join('');
  add('thread-spool', 'spool of thread with needle and button',
    A(R(10, 11, 24, 40), [R(12.8, 14, 2.6, 34, 1.3)]) +
    L([17.5, 23.5, 29.5, 35.5, 41.5, 47].map(y => `M17.5 ${y}Q25 ${y + 1.6} 33 ${y - .6}`).join(''), 1.6) +
    P('t-b', R(5, 5, 34, 7, 3) + R(5, 50, 34, 7, 3)) +
    L('M33.5 28.5C44 30 45 20 49.5 12.5C51.5 9 55 8.5 56.5 11.5', 2) +
    G('translate(51.5 3) rotate(24)', P('t-b', 'M-2 2.2Q-2 0 0 0Q2 0 2 2.2V30L0 40L-2 30Z' + R(-.75, 2.5, 1.5, 6.5, .75), ' fill-rule="evenodd"')) +
    P('t-a', C(51.5, 51.5, 11) + holes, ' fill-rule="evenodd"') +
    P('t-b', C(51.5, 51.5, 11) + C(50.6, 50.6, 9.7), ' fill-rule="evenodd"') +
    L('M44.5 51.5A7 7 0 0 1 51.5 44.5', 1.4));
}
{ // yarn ball with knitting needles
  const c1 = [31, 38], rIn = 19.6, dist = (p, c) => Math.hypot(p[0] - c[0], p[1] - c[1]);
  const clipArc = (c, Rr, pred) => {
    const N = 720, ok = []; for (let i = 0; i < N; i++) { const a = i / N * 2 * Math.PI; ok.push(pred([c[0] + Rr * Math.cos(a), c[1] + Rr * Math.sin(a)])); }
    let best = null; for (let i = 0; i < N; i++) if (ok[i] && !ok[(i - 1 + N) % N]) { let j = i; while (ok[(j + 1) % N] && j - i < N) j++; if (!best || j - i > best[1] - best[0]) best = [i, j]; }
    if (!best) return '';
    const pt = k => { const a = k / N * 2 * Math.PI; return [c[0] + Rr * Math.cos(a), c[1] + Rr * Math.sin(a)]; };
    const p1 = pt(best[0]), p2 = pt(best[1]), span = (best[1] - best[0]) / N * 360;
    return `M${f(p1[0])} ${f(p1[1])}A${Rr} ${Rr} 0 ${span > 180 ? 1 : 0} 1 ${f(p2[0])} ${f(p2[1])}`;
  };
  const cA = [64, 68], cB = [66, 14];
  const arcsA = [47, 52.5, 58].map(Rr => clipArc(cA, Rr, p => dist(p, c1) < rIn)).join('');
  const arcsB = [30, 35.5, 41, 46.5].map(Rr => clipArc(cB, Rr, p => dist(p, c1) < rIn && dist(p, cA) < 44)).join('');
  add('yarn-ball', 'ball of yarn with knitting needles',
    L('M24 30L45 5M40 30L19 5', 3.2) + P('t-b', C(46, 4, 2.8) + C(18, 4, 2.8)) +
    P('t-a', C(31, 38, 21)) +
    P('t-b', C(31, 38, 21) + C(29.5, 36.5, 18.9), ' fill-rule="evenodd"') +
    L(arcsA + arcsB + clipArc(cA, 44.8, p => dist(p, c1) < rIn), 2) +
    P('t-c', RE(18, 27.5, 1.6, 3.4, 40)) +
    L('M12.5 48.5C6.5 51 10 57.5 3.5 60.5', 2.2));
}
{ // dress
  add('dress', 'party dress with a flared skirt',
    A('M22 7L26.5 4Q32 13 37.5 4L42 7Q39.5 15.5 43 26H21Q24.5 15.5 22 7Z', ['M24.8 9.5L26.2 8.7Q27.3 16 25.7 23H24.3Q25.7 16 24.8 9.5Z']) +
    P('t-b', 'M37.3 5.5L42 7Q39.5 15.5 43 26H38.5Q37 16 37.3 5.5Z') +
    A('M21 30H43L57 55Q58 58 55 58.5Q32 62 9 58.5Q6 58 7 55Z', ['M19.5 34.5H21.8L15.8 53.5H13.2Z']) +
    P('t-b', 'M39.5 30H43L57 55Q58 58 55 58.5L48.5 59.4Q49 44 39.5 30Z') +
    L('M28 32L24.5 58M32 32V59.5M36 32L40 58.5', 1.8) +
    P('t-b', R(19.5, 25, 25, 5.5, 2)) +
    P('t-b', 'M32 27.8L26 24.2V31.4ZM32 27.8L38 24.2V31.4Z') + P('t-a', C(32, 27.8, 1.9)));
}
{ // top hat
  add('top-hat', 'top hat with a band',
    A('M15.5 8.5A16.5 3.5 0 0 1 48.5 8.5L46 47H18Z', [R(20, 14, 3, 16, 1.5)]) +
    P('t-b', 'M42 11.5H48.3L46.8 33H42Z') +
    P('t-b', E(32, 8.5, 16.5, 3.5)) +
    P('t-b', 'M17.2 33H46.8L46.1 44H17.9Z') +
    P('t-a', 'M2.5 45.5Q2.5 41 11 43.5Q32 48 53 43.5Q61.5 41 61.5 45.5Q61.5 54 32 54Q2.5 54 2.5 45.5Z') +
    P('t-b', 'M2.5 45.5Q2.5 54 32 54Q61.5 54 61.5 45.5Q58 51 32 51Q6 51 2.5 45.5Z') +
    L('M56 8V14M53 11H59M8 18V22M6 20H10', 1.8));
}
{ // washing machine
  const glass = 'M21.1 38Q23.8 35.5 26.5 38T32 38T37.5 38T42.9 38A11 11 0 1 0 21.1 38Z';
  const bub = C(27, 43, 1.3) + C(36, 45.5, 1.8) + C(31, 50, 1.1);
  add('washing-machine', 'front-loading washing machine',
    P('t-b', R(12, 55, 7, 6, 1.5) + R(45, 55, 7, 6, 1.5)) +
    A(R(9, 3, 46, 54, 5), [glass, bub, R(12.5, 19, 2.6, 30, 1.3)]) +
    P('t-b', 'M49.5 15H55V52Q55 57 50 57H49.5Z') +
    P('t-b', 'M14 3H50Q55 3 55 8V15H9V8Q9 3 14 3Z' + R(13, 6.8, 13, 4.6, 1.5) + C(42, 9, 2.6) + C(49.5, 9, 2.6), ' fill-rule="evenodd"') +
    P('t-b', C(32, 37, 15) + C(32, 37, 11), ' fill-rule="evenodd"') +
    L('M24.5 31A9 9 0 0 1 30 27.5', 1.8));
}
{ // high-top sneaker
  add('sneaker', 'high-top sneaker with laces',
    P('t-a', 'M20.5 10V5.5Q20.5 2.5 23.5 2.5H25.5Q28.8 2.5 28.5 5.5L27.5 12Z') +
    A('M7 50V14Q7 8 13 8H21.5Q27 8 27 13.5V26Q28 32.5 34.5 34.5L50.5 38.5Q61 41.5 60 50Z', [C(14.5, 27, 4.5), 'M46 37.5L50.5 38.5Q61 41.5 60 50H44Q43.5 41.5 46 37.5Z']) +
    P('t-b', 'M7 14Q7 8 13 8H21.5Q27 8 27 13.5V15H7Z') +
    P('t-b', 'M7 39H12Q16 39 16 43V50H7Z') +
    L('M21 18.5H28.5M21 23H28.5M22.5 27.5H29.5M26 31.5L31.5 34', 2.2) +
    P('t-b', 'M5 49H60.5Q63.5 49 62.8 53.5Q62 58.5 56.5 58.5H9Q5 58.5 5 54.5Z') +
    P('t-c', R(7, 51, 53, 2, 1)));
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part3.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
