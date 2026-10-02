// Generates part13.json: round-2 batch 13 icons.
import fs from 'node:fs';
const OUT = process.argv[2] || new URL('../../icons/part13.json', import.meta.url);
const items = [];
const add = (id, motif, parts) => items.push({ id, motif, svg: parts.join('') });
const r1 = (n) => Math.round(n * 100) / 100;
// 4-point sparkle centred at (x,y), radius s
const spark = (x, y, s, cls = 't-c') => `<path class="${cls}" d="M${x} ${y - s}Q${r1(x + s * .16)} ${r1(y - s * .16)} ${x + s} ${y}Q${r1(x + s * .16)} ${r1(y + s * .16)} ${x} ${y + s}Q${r1(x - s * .16)} ${r1(y + s * .16)} ${x - s} ${y}Q${r1(x - s * .16)} ${r1(y - s * .16)} ${x} ${y - s}Z"/>`;
const ring = (cx, cy, R, r) => `M${r1(cx - R)} ${cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z` + (r ? `M${r1(cx - r)} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z` : '');

// ---------- anchor ----------
add('anchor', "ship's anchor with rope", [
  '<path class="t-a" fill-rule="evenodd" d="' + ring(32, 9.5, 6.5, 3.3) + '"/>',
  '<path class="t-b" d="M38.3 11.2A6.5 6.5 0 0 1 26.4 13A7.5 7.5 0 0 0 38.3 11.2Z"/>',
  '<rect class="t-a" x="28.5" y="14" width="7" height="42" rx="2"/>',
  '<rect class="t-b" x="32.8" y="14" width="2.7" height="42"/>',
  '<path class="t-a" d="M7 37Q8 58.5 32 59Q56 58.5 57 37L50 40.5Q48.5 51.5 32 52Q15.5 51.5 14 40.5Z"/>',
  '<path class="t-b" d="M8.6 45Q13 58.5 32 59Q51 58.5 55.4 45Q49 55 32 55.3Q15 55 8.6 45Z"/>',
  '<polygon class="t-a" points="2.5,43 9.5,27.5 19,41.5 11.5,38.5"/><polygon class="t-b" points="9.5,27.5 19,41.5 11.5,38.5"/>',
  '<polygon class="t-a" points="61.5,43 54.5,27.5 45,41.5 52.5,38.5"/><polygon class="t-b" points="54.5,27.5 61.5,43 52.5,38.5"/>',
  '<polygon class="t-b" points="27,57 32,63 37,57"/>',
  '<rect class="t-a" x="16" y="17.5" width="32" height="6" rx="3"/>',
  '<rect class="t-b" x="16" y="21" width="32" height="2.5" rx="1.25"/>',
  '<circle class="t-a" cx="16.5" cy="20.5" r="4"/><circle class="t-a" cx="47.5" cy="20.5" r="4"/>',
  '<path class="t-b" d="M20.5 20.5A4 4 0 0 1 12.5 20.5ZM51.5 20.5A4 4 0 0 1 43.5 20.5Z"/>',
  '<rect class="t-c" x="29.6" y="26" width="1.8" height="22" rx=".9"/>',
  '<circle class="t-c" cx="15.3" cy="19.3" r="1.2"/><circle class="t-c" cx="46.3" cy="19.3" r="1.2"/>',
  '<path class="t-c" d="M11 44.5Q15.5 50.5 22 52.2L21.4 53.6Q14.5 52 11 44.5Z"/>',
  '<path class="ln" stroke-width="3" d="M29 6.5C22 5 18.5 11 24 13.8C29 16.3 38 24 40 29C42 35 25 34 25 40C25 45 38 42 39 47.5C40 52 34 54 30 53.5"/>',
  '<path class="ln" stroke-width="3" d="M30 53.5C24 53 20 56 19 61"/>',
  spark(53, 8, 4.5), spark(9, 12, 3),
]);

// ---------- padlock ----------
add('padlock', 'closed padlock with a key', [
  '<path class="t-b" d="M11.5 30V20A13.5 13.5 0 0 1 38.5 20V30H32V20.3A7 7 0 0 0 18 20.3V30Z"/>',
  '<path class="t-c" d="M13.6 28V20.5A11.5 11.5 0 0 1 19 10.8L20 12.4A9.6 9.6 0 0 0 15.5 20.5V28Z"/>',
  '<rect class="t-a" x="5" y="27" width="40" height="32" rx="6"/>',
  '<path class="t-b" d="M37 27H39Q45 27 45 33V53Q45 59 39 59H37Z"/>',
  '<rect class="t-b" x="5" y="53.5" width="40" height="5.5" rx="2.75"/>',
  '<rect class="t-b" x="5" y="33" width="40" height="2.5"/>',
  '<circle class="t-b" cx="25" cy="41.5" r="4.6"/><path class="t-b" d="M22.3 43H27.7L28.8 50.5H21.2Z"/>',
  '<circle class="t-c" cx="24" cy="40.5" r="1.3"/>',
  '<rect class="t-c" x="9" y="38" width="2.6" height="12" rx="1.3"/>',
  '<g transform="translate(54 38) rotate(-18)">',
  '<path class="t-a" fill-rule="evenodd" d="' + ring(0, -12, 7) + ring(0, -12, 3) + '"/>',
  '<rect class="t-a" x="-2" y="-6" width="4" height="26" rx="1.2"/>',
  '<path class="t-a" d="M-2 11H-6.5V14H-4.5V16H-2ZM-2 16.5H-7V20H-2Z"/>',
  '<rect class="t-b" x=".5" y="-5.5" width="1.5" height="25"/>',
  '<path class="t-b" d="M6.3 -9.2A7 7 0 0 1 -3.5 -6A7.8 7.8 0 0 0 6.3 -9.2Z"/>',
  '<path class="t-c" d="M-5.2 -14A5.6 5.6 0 0 1 -2 -17.6L-1.3 -16.5A4.3 4.3 0 0 0 -3.8 -13.8Z"/>',
  '</g>',
  spark(55, 8, 4.5), spark(46, 16, 2.4),
]);

// ---------- campfire ----------
const FL_OUT = 'M32 5C35 13 46 19 46 34C46 44 40 51 32 51C24 51 17 45 17 36C17 29 21 25 23 19C25 23 26 26 28 27.5C29 20 28 13 32 5Z';
const FL_MID = 'M32 22C35 29 41 33 40 41C39.5 47 36 50 32 50C27 50 24 47 24 42C24 37 27 35 28 30C29.5 33 30.5 34 31 35C32 30 30.5 27 32 22Z';
const FL_IN = 'M32.5 35C34 39 36.5 41 36 44.5C35.7 47.3 34 49 32 49C29.5 49 28 47.5 28 45C28 42.5 30 41 30.5 38.5C31.2 40 31.6 40.4 32 41C33 39 32 37.5 32.5 35Z';
add('campfire', 'crackling campfire with logs', [
  '<ellipse class="t-b" cx="32" cy="59.5" rx="26" ry="3"/>',
  `<path class="t-a" fill-rule="evenodd" d="${FL_OUT}${FL_MID}"/>`,
  '<path class="t-a" d="M46.2 26C49.5 29 50.5 33 50 38C49.5 42 47.5 45 44.5 47C46.5 41 46.8 34 46.2 26Z"/>',
  '<path class="t-b" d="M40 13.5C44 19 46.5 25 46 34C46 44 40 51 32 51C38 48 42.5 42 42.5 33C42.5 25 41.5 19 40 13.5Z"/>',
  `<path class="t-c" fill-rule="evenodd" d="${FL_MID}${FL_IN}"/>`,
  `<path class="t-a" d="${FL_IN}"/>`,
  '<g transform="translate(32 52) rotate(-16)"><rect class="t-b" x="-24" y="-4.5" width="48" height="9" rx="4.5"/><ellipse class="t-a" cx="-20" cy="0" rx="3.2" ry="4.5"/><ellipse class="t-c" cx="-20" cy="0" rx="1.4" ry="2.2"/><path class="ln" stroke-width="1.3" d="M-10 -1.5H6M0 1.8H14"/></g>',
  '<g transform="translate(32 52) rotate(16)"><rect class="t-b" x="-24" y="-4.5" width="48" height="9" rx="4.5"/><ellipse class="t-a" cx="20" cy="0" rx="3.2" ry="4.5"/><ellipse class="t-c" cx="20" cy="0" rx="1.4" ry="2.2"/><path class="t-c" d="M-16 -3H2V-1.6H-16Z"/></g>',
  '<path class="t-c" d="M21.5 30.5C20.5 34 20 37 21 40.5L19.4 40.8C18.5 37 19 33.5 20.2 30Z"/>',
  '<circle class="t-c" cx="15" cy="17" r="1.6"/><circle class="t-a" cx="49" cy="12" r="1.8"/><circle class="t-c" cx="45" cy="5" r="1.2"/><circle class="t-a" cx="12" cy="8" r="1.2"/>',
  '<path class="ln" stroke-width="1.8" d="M9 26L5 23.5M55 22L59 19M8 38H3.5M56 36.5H60.5"/>',
]);

// ---------- backpack ----------
add('backpack', 'school backpack with pockets', [
  '<path class="ln" stroke-width="3.5" d="M25.5 12V9Q25.5 4.5 32 4.5Q38.5 4.5 38.5 9V12"/>',
  '<rect class="t-b" x="7" y="27" width="9" height="27" rx="3.5"/><rect class="t-b" x="48" y="27" width="9" height="27" rx="3.5"/>',
  '<path class="t-a" d="M12 26Q12 10 32 10Q52 10 52 26V55Q52 60 47 60H17Q12 60 12 55Z"/>',
  '<path class="t-b" d="M45 13.5Q52 18 52 26V55Q52 60 47 60H45Q48 58 48 54V27Q48 18 45 13.5Z"/>',
  '<path class="t-b" d="M12 26Q12 10 32 10Q52 10 52 26V29Q52 32 49 32H15Q12 32 12 29Z"/>',
  '<path class="t-a" d="M12 25.5Q12 12.5 32 12.5Q52 12.5 52 25.5V26.5Q52 29.5 49 29.5H15Q12 29.5 12 26.5Z"/>',
  '<path class="t-c" d="M16 21Q18 14.5 27 13.5L27.4 15.3Q20 16.4 18 21.6Z"/>',
  '<rect class="t-b" x="21" y="26" width="4" height="14" rx="1"/><rect class="t-b" x="39" y="26" width="4" height="14" rx="1"/>',
  '<rect class="t-c" x="20.2" y="34" width="5.6" height="4.5" rx="1"/><rect class="t-c" x="38.2" y="34" width="5.6" height="4.5" rx="1"/>',
  '<rect class="t-b" x="18" y="40.5" width="28" height="16.5" rx="5"/>',
  '<rect class="t-c" x="18" y="39" width="28" height="16" rx="5"/>',
  '<path class="ln" stroke-width="1.6" d="M21.5 44.5H42.5"/>',
  '<rect class="t-a" x="34" y="43.5" width="3" height="6.5" rx="1.2"/>',
  '<rect class="t-c" x="14.5" y="34" width="2" height="18" rx="1"/>',
]);

// ---------- lightning-bolt ----------
add('lightning-bolt', 'zigzag lightning bolt', [
  '<path class="t-b" d="M38.5 3H53L40.5 25.5H55L24 63L32 35.5H16.5Z"/>',
  '<path class="t-a" d="M35.5 2H50L37.5 24.5H52L21 62L29 34.5H13.5Z"/>',
  '<path class="t-b" d="M50 2L37.5 24.5H40.5L52 3.8ZM52 24.5L21 62L24.5 61Z"/>',
  '<path class="t-c" d="M36.4 4.5H40.3L23.4 32.3H19.4Z"/>',
  '<path class="t-c" d="M30.6 36.8H33.4L28.2 51.5Z"/>',
  '<path class="ln" stroke-width="2.2" d="M8 12L12.5 15.5M4.5 24H10M9 45L13.5 42M56 42.5L60.5 45M54 53L58 56.5M58.5 12L62 9"/>',
  spark(10, 55, 4), spark(57, 30, 3),
]);

// ---------- coins ----------
{
  const P = [];
  const ering = (x, y, a, b) => `M${r1(x - a)} ${y}a${a} ${b} 0 1 0 ${r1(2 * a)} 0a${a} ${b} 0 1 0 ${r1(-2 * a)} 0Z`;
  const stack = (cx, bottom, n, rx, ry, jit) => {
    let A = '', B = '';
    const sx = r1(rx * .45), sy = r1(ry * .835);
    for (let k = 0; k < n; k++) {
      const x = cx + (jit[k] || 0); const y = bottom - k * 5;
      A += `M${x - rx} ${y}v5a${rx} ${ry} 0 0 0 ${2 * rx} 0v-5a${rx} ${ry} 0 0 1 ${-2 * rx} 0Z`;
      B += `M${x - rx} ${r1(y + 3.6)}a${rx} ${ry} 0 0 0 ${2 * rx} 0v1.4a${rx} ${ry} 0 0 1 ${-2 * rx} 0Z`;
    }
    // one shade strip per run of aligned coins
    let k = 0;
    while (k < n) {
      let j = k; while (j + 1 < n && (jit[j + 1] || 0) === (jit[k] || 0)) j++;
      const x = cx + (jit[k] || 0), yTop = bottom - j * 5, yBot = bottom - k * 5;
      B += `M${r1(x + rx - sx)} ${r1(yTop + sy)}a${rx} ${ry} 0 0 0 ${sx} ${-sy}V${yBot + 5}a${rx} ${ry} 0 0 1 ${-sx} ${sy}Z`;
      k = j + 1;
    }
    P.push(`<path class="t-a" d="${A}"/>`, `<path class="t-b" d="${B}"/>`);
    const x = cx + (jit[n - 1] || 0); const y = bottom - (n - 1) * 5;
    P.push(`<ellipse class="t-a" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`);
    P.push(`<path class="t-c" fill-rule="evenodd" d="${ering(x, y, r1(rx * .74), r1(ry * .7))}${ering(x + .5, y + .3, r1(rx * .6), r1(ry * .52))}"/>`);
  };
  stack(22, 53, 7, 15, 5, [0, 0, 0, 0, 1.5, 1.5, 1.5]);
  stack(47, 53, 3, 12, 4, [0, 0, -1]);
  P.push('<rect class="t-c" x="8.8" y="30" width="1.8" height="23" rx=".9"/>');
  P.push('<g transform="translate(47 19) rotate(20)">');
  P.push(`<path class="t-b" fill-rule="evenodd" d="${ring(1, 1.2, 11)}${ring(0, 0, 11)}"/>`);
  P.push(`<circle class="t-a" cx="0" cy="0" r="11"/>`);
  P.push(`<path class="t-b" fill-rule="evenodd" d="${ring(0, 0, 8)}${ring(0, 0, 6.8)}"/>`);
  P.push('<polygon class="t-b" points="0,-4.8 1.4,-1.6 4.7,-1.5 2.1,0.7 3,4 0,2.1 -3,4 -2.1,0.7 -4.7,-1.5 -1.4,-1.6"/>');
  P.push('<path class="t-c" d="M-9.2 -3.5A9.8 9.8 0 0 1 -3.5 -9.2L-3 -8A8.5 8.5 0 0 0 -8 -3Z"/>');
  P.push('</g>');
  P.push(spark(29, 8, 4.5), spark(60, 37, 3));
  add('coins', 'stack of gold coins', P);
}

// ---------- astronaut ----------
add('astronaut', 'astronaut in a suit and visored helmet, floating on a tether', [
  '<path class="ln" stroke-width="2.4" d="M25.5 44C13 47 4 40 8 31C11.5 23 20 22 16 13C14 8.5 8 6 3 6.5"/>',
  '<g transform="translate(35 33) rotate(-16)">',
  '<rect class="t-b" x="-14" y="-7" width="28" height="23" rx="4"/>',
  '<rect class="t-a" x="-10" y="11" width="8.5" height="15" rx="3.5" transform="rotate(10 -6 11)"/>',
  '<rect class="t-a" x="1.5" y="11" width="8.5" height="15" rx="3.5" transform="rotate(-14 6 11)"/>',
  '<rect class="t-b" x="-11.2" y="21" width="10" height="6" rx="2.5" transform="rotate(10 -6 11)"/>',
  '<rect class="t-b" x="0.8" y="21" width="10" height="6" rx="2.5" transform="rotate(-14 6 11)"/>',
  '<rect class="t-a" x="-23" y="-4" width="14" height="8" rx="4" transform="rotate(38 -10 0)"/>',
  '<rect class="t-a" x="9" y="-4" width="14" height="8" rx="4" transform="rotate(24 10 0)"/>',
  '<circle class="t-b" cx="-20.7" cy="-8.4" r="4.4"/><circle class="t-b" cx="20.7" cy="5.5" r="4.4"/>',
  '<rect class="t-a" x="-11" y="-4" width="22" height="20" rx="7"/>',
  '<path class="t-b" d="M5 -3.2Q11 -2 11 4V9Q11 16 4 16H2Q7 13 7 8V3Q7 -1 5 -3.2Z"/>',
  '<rect class="t-c" x="-6" y="2" width="11" height="7" rx="1.6"/>',
  '<circle class="t-b" cx="-3" cy="5.5" r="1.3"/><circle class="t-a" cx="1" cy="5.5" r="1.3"/>',
  '<circle class="t-a" cx="0" cy="-16" r="13.5"/>',
  '<path class="t-b" d="M11.6 -22.8A13.5 13.5 0 0 1 -6.8 -4.3A15.5 15.5 0 0 0 11.6 -22.8Z"/>',
  '<rect class="t-b" x="-8" y="-4.8" width="16" height="4" rx="2"/>',
  '<ellipse class="t-b" cx="1" cy="-16" rx="9.5" ry="7.8"/>',
  '<path class="t-c" d="M-5.8 -18.5Q-4.5 -22 -0.5 -22.6L0 -20.8Q-3 -20.3 -4 -18Z"/>',
  '<circle class="t-c" cx="5" cy="-12" r="1.3"/>',
  '<path class="t-c" d="M-11.6 -18A12 12 0 0 1 -4 -27.4L-3.3 -26A10.5 10.5 0 0 0 -10 -17.8Z"/>',
  '</g>',
  spark(56, 8, 4.5), spark(8, 52, 3.5), spark(58, 50, 2.5),
  '<circle class="t-c" cx="44" cy="4" r="1.3"/><circle class="t-c" cx="61" cy="26" r="1.2"/><circle class="t-c" cx="22" cy="60" r="1.2"/>',
]);

// ---------- footprints ----------
{
  const sole = 'M0 -14C7 -14 9.5 -7 8.5 -1C7.7 4 5.5 7 5.5 11.5C5.5 16 3 18.5 -.5 18.5C-4.5 18.5 -7.2 15.5 -6.5 10.5C-5.8 5.5 -8.5 1.5 -8.5 -4.5C-8.5 -10.5 -5 -14 0 -14Z';
  const shade = 'M7 -10C9.5 -5 8.5 -1 8.5 -1C7.7 4 5.5 7 5.5 11.5C5.5 16 3 18.5 -.5 18.5C2 16.5 3 14 3 11C3 6 6 2.5 6.5 -2C6.9 -5.5 7 -8 7 -10Z';
  const toes = [[-4.5, -19.5, 3.7], [1.5, -21, 2.8], [5.8, -19.4, 2.3], [9, -16.6, 2], [11, -12.8, 1.7]];
  const foot = (tr) => [`<g transform="${tr}">`, `<path class="t-a" d="${sole}"/>`, `<path class="t-b" d="${shade}"/>`,
    ...toes.map(([x, y, r]) => `<circle class="t-a" cx="${x}" cy="${y}" r="${r}"/>`),
    ...toes.slice(0, 2).map(([x, y, r]) => `<circle class="t-c" cx="${r1(x - r * .3)}" cy="${r1(y - r * .3)}" r="${r1(r * .35)}"/>`),
    '<ellipse class="t-c" cx="-3.5" cy="-7" rx="1.8" ry="4" transform="rotate(12 -3.5 -7)"/>',
    '<ellipse class="t-b" cx="-.6" cy="3.5" rx="1.7" ry="3.2"/>',
    '</g>'];
  add('footprints', 'pair of bare footprints', [
    ...foot('translate(44 25) rotate(14) scale(.95)'),
    ...foot('translate(20 42) rotate(-6) scale(-.95 .95)'),
    spark(9, 11, 3.5), spark(57, 55, 3),
    '<circle class="t-c" cx="34" cy="58" r="1.2"/><circle class="t-c" cx="30" cy="8" r="1.2"/>',
  ]);
}

// ---------- button ----------
{
  const holes = (cx, cy, d, r) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ring(cx + a * d, cy + b * d, r)).join('');
  add('button', 'large four-hole button', [
    `<path class="t-b" fill-rule="evenodd" d="${ring(29.2, 31.3, 24)}${ring(28, 29.5, 24)}"/>`,
    `<path class="t-a" fill-rule="evenodd" d="${ring(28, 29.5, 24)}${holes(28, 29.5, 5.6, 3.3)}"/>`,
    `<path class="t-b" fill-rule="evenodd" d="${ring(28, 29.5, 18)}${ring(28, 29.5, 16.2)}"/>`,
    '<path class="t-b" d="M45 46.5A24 24 0 0 1 8 43.5A26 26 0 0 0 45 46.5Z"/>',
    '<g transform="rotate(45 28 29.5)"><rect class="t-c" x="20" y="28.2" width="16" height="2.6" rx="1.3"/><rect class="t-c" x="26.7" y="21.5" width="2.6" height="16" rx="1.3"/></g>',
    '<path class="t-c" d="M8.3 22A21 21 0 0 1 21.5 8.3L22.2 10.2A19 19 0 0 0 10.2 22.6Z"/>',
    `<path class="t-b" fill-rule="evenodd" d="${ring(52.9, 52.9, 9)}${ring(52, 52, 9)}"/>`,
    `<path class="t-a" fill-rule="evenodd" d="${ring(52, 52, 9)}${ring(49.6, 52, 1.7)}${ring(54.4, 52, 1.7)}"/>`,
    `<path class="t-b" fill-rule="evenodd" d="${ring(52, 52, 6.2)}${ring(52, 52, 5.1)}"/>`,
    '<path class="t-c" d="M44.8 49A7.6 7.6 0 0 1 49 44.8L49.5 46A6.4 6.4 0 0 0 46 49.5Z"/>',
    spark(56, 10, 4.5), spark(9, 57, 3),
  ]);
}

// ---------- pickaxe ----------
add('pickaxe', "miner's pickaxe", [
  '<path class="t-b" d="M36 62L40.5 51.5L47 48L53.5 50.5L58 47L63 52V62Z"/>',
  '<path class="t-a" d="M41 62L43.5 54.5L49 52L54 55.5L56 62Z"/>',
  '<polygon class="t-c" points="48,56 51,55 52,58 49,59.5"/>',
  '<g transform="translate(38 24) rotate(45)">',
  '<rect class="t-b" x="-3.8" y="-4" width="7.6" height="44" rx="3.2"/>',
  '<rect class="t-a" x="-3.8" y="-4" width="4.4" height="44" rx="2"/>',
  '<rect class="t-c" x="-2.6" y="4" width="1.4" height="20" rx=".7"/>',
  '<rect class="t-b" x="-4.6" y="30" width="9.2" height="3" rx="1.2"/><rect class="t-b" x="-4.6" y="35" width="9.2" height="3" rx="1.2"/>',
  '<path class="t-a" d="M-30 7Q-16 -12 0 -12Q16 -12 30 7Q15 -3.5 0 -3.5Q-15 -3.5 -30 7Z"/>',
  '<path class="t-b" d="M-30 7Q-15 -3.5 0 -3.5Q15 -3.5 30 7Q14 -1 0 -1Q-14 -1 -30 7Z"/>',
  '<path class="t-c" d="M-22 -1.5Q-12 -10 0 -10.3L0 -8.6Q-12 -8.3 -22 -1.5Z"/>',
  '<rect class="t-b" x="-5.5" y="-14" width="11" height="14" rx="2.5"/>',
  '<rect class="t-a" x="-5.5" y="-14" width="6" height="14" rx="2"/>',
  '<circle class="t-c" cx="-2.5" cy="-10.5" r="1.2"/>',
  '</g>',
  spark(26, 57, 3.5), spark(58, 10, 3.5), '<circle class="t-c" cx="6" cy="61" r="1.3"/>',
]);

// ---------- fishing-rod ----------
add('fishing-rod', 'fishing rod with a bobber and a line', [
  '<path class="ln" stroke-width="1.3" d="M55.5 6.5Q59 24 50 39"/>',
  '<path class="t-a" d="M4.5 55L9 59.5C30 38 45 22 56.6 7.5L55 6C42.5 19 27 33.5 4.5 55Z"/>',
  '<path class="t-b" d="M9 59.5C30 38 45 22 56.6 7.5L55.8 6.8C43 21 28 36.5 7.6 58.2Z"/>',
  '<rect class="t-b" x="0" y="-3.6" width="15" height="7.2" rx="3.6" transform="translate(4 60) rotate(-45)"/>',
  '<path class="ln" stroke-width="1.2" d="M8.5 52.5L11.5 55.5M11.5 49.5L14.5 52.5"/>',
  '<circle class="t-b" cx="23.5" cy="47.5" r="6.4"/><circle class="t-a" cx="22.8" cy="46.8" r="5.6"/>',
  '<circle class="t-c" cx="22.8" cy="46.8" r="2"/><path class="ln" stroke-width="2" d="M22.8 46.8L28 52"/>',
  '<circle class="t-b" cx="28.5" cy="52.5" r="1.8"/>',
  '<path class="ln" stroke-width="1.8" d="M36 51Q42.5 48.5 49 51M53 51Q58.5 48.5 63 51M40.5 56.5Q47 54.5 52 56.5"/>',
  '<rect class="t-b" x="49" y="36.5" width="2" height="5" rx="1"/>',
  '<path class="t-a" d="M43.5 45A6.5 6.5 0 0 1 56.5 45Z"/>',
  '<path class="t-c" d="M43.5 45A6.5 6.5 0 0 0 56.5 45Z"/>',
  '<path class="t-b" d="M43.5 44.5H56.5V46.5H43.5Z"/>',
  '<path class="t-c" d="M45.5 42.5A4.5 4.5 0 0 1 48.5 39.6L48.9 40.8A3.3 3.3 0 0 0 46.7 43Z"/>',
  '<path class="t-b" d="M52 48.5A6.5 6.5 0 0 1 45 50Q50 50.5 52 48.5Z"/>',
  spark(16, 30, 3.5), spark(35, 8, 2.5),
]);

// ---------- acacia-tree ----------
add('acacia-tree', 'flat-topped savanna acacia', [
  '<circle class="t-c" cx="48" cy="42" r="10"/>',
  '<path class="t-b" d="M2 54Q32 49 62 54V58H2Z"/>',
  '<path class="t-b" d="M28 56Q30.5 46 28.5 38Q23 31 14 26L18 24.5Q25.5 28.5 30.5 33Q31.5 28 31 23.5L35.5 23.5Q35.5 29 34.5 35Q39.5 29 47 24.5L50.5 26Q42 32.5 37 40Q35 48 37 56Z"/>',
  '<path class="t-a" d="M4 23Q4 17 11 16Q15 10 24 11Q30 6.5 38 9Q45 7.5 50 12Q59 12 60.5 19Q63 23 58.5 25.5Q55 27.5 49 27H15Q6.5 27.5 4 23Z"/>',
  '<path class="t-b" d="M4.5 22.5Q7 27 15 26.8H49Q55 27.3 58.5 25.5Q61.5 23.8 61 20.5Q57 24 49 23.7H15Q7.5 24 4.5 22.5Z"/>',
  '<path class="t-c" d="M12 17.5Q16 12.8 23.5 13.5L23.8 15.2Q17.5 14.5 14 18.2Z"/><path class="t-c" d="M33 11.5Q38 10.3 42 11.8L41.4 13.3Q38 12 33.7 12.9Z"/>',
  '<path class="ln" stroke-width="1.6" d="M8 54.5L7 50.5M10 54.5L11 50M50 53.5L49 49.5M53 53.5L54.5 49.5M20 54L20.5 51"/>',
]);

// ---------- sketchbook ----------
add('sketchbook', 'open sketchbook with a doodle and an eraser', [
  '<g transform="rotate(-6 32 32)">',
  '<path class="t-b" fill-rule="evenodd" d="M6 10H58Q61 10 61 13V49Q61 52 58 52H6Q3 52 3 49V13Q3 10 6 10ZM6 11V49.5H58V11Z"/>',
  '<path class="t-a" d="M6 47H31.5V49.5H7.5Q6 49.5 6 48ZM32.5 47H58V48Q58 49.5 56.5 49.5H32.5Z"/>',
  '<rect class="t-c" x="6" y="11" width="25.5" height="36" rx=".8"/><rect class="t-c" x="32.5" y="11" width="25.5" height="36" rx=".8"/>',
  '<circle class="ln" cx="18" cy="22" r="4.5" stroke-width="1.8"/>',
  '<path class="ln" stroke-width="1.8" d="M18 13.8V15.3M18 28.7V30.2M9.8 22H11.3M24.7 22H26.2M12.2 16.2L13.3 17.3M22.7 26.7L23.8 27.8M23.8 16.2L22.7 17.3M13.3 26.7L12.2 27.8"/>',
  '<path class="ln" stroke-width="1.8" d="M9 43L14.5 35.5L18 40L21.5 36.5L28.5 43"/>',
  '<path class="ln" stroke-width="1.8" d="M38 43V30.5L45 24L52 30.5V43ZM43 43V36.5H47V43M36 43H54"/>',
  '<path class="ln" stroke-width="1.6" d="M35.5 16.5Q37.5 14.5 39.5 16.5Q41.5 18.5 43.5 16.5"/>',
  ...[16, 21, 26, 31, 36, 41, 46].map((y) => `<rect class="t-b" x="29.8" y="${y - 1.8}" width="4.4" height="3.6" rx="1.8"/>`),
  '</g>',
  '<g transform="translate(49 56) rotate(-18)">',
  '<rect class="t-b" x="-11" y="-4.5" width="22" height="10" rx="2.5"/>',
  '<rect class="t-a" x="-11" y="-5.5" width="22" height="9.5" rx="2.5"/>',
  '<rect class="t-b" x="1" y="-5.5" width="6" height="11" rx=".8"/>',
  '<rect class="t-c" x="-9" y="-4" width="8" height="1.8" rx=".9"/>',
  '</g>',
  '<circle class="t-a" cx="33" cy="59" r="1.4"/><circle class="t-a" cx="29" cy="61" r="1"/><circle class="t-a" cx="36.5" cy="61.5" r="1"/>',
  spark(57, 5, 3.5),
]);

// ---------- striped-tent ----------
{
  const b = [5, 12.7, 20.4, 28.1, 35.9, 43.6, 51.3, 59];
  const P = ['<path class="ln" stroke-width="2" d="M32 15V3.5"/>', '<path class="t-a" d="M32 3.5L45 7.5L32 11.5Z"/>', '<path class="t-b" d="M32 7.5L45 7.5L32 11.5Z"/>',
    '<ellipse class="t-b" cx="32" cy="59" rx="28" ry="3"/>'];
  const wa = [[9, 12.7], [20.4, 28.1], [35.9, 43.6], [51.3, 55]], wc = [[12.7, 20.4], [28.1, 35.9], [43.6, 51.3]];
  const rects = (L) => L.map(([x1, x2]) => `M${x1} 33H${x2}V58H${x1}Z`).join('');
  P.push(`<path class="t-a" d="${rects(wa)}"/>`, `<path class="t-c" d="${rects(wc)}"/>`);
  P.push('<path class="t-b" d="M50 33H55V58H50Z"/>');
  P.push('<path class="t-b" d="M25 58V47Q25 40 32 38Q39 40 39 47V58Z"/>');
  P.push('<path class="t-c" d="M25 58V47Q25 40 32 38Q28 45 30 58Z"/><path class="t-a" d="M39 58V47Q39 40 32 38Q36 45 34 58Z"/>');
  const w = wc.map(([x1, x2]) => `M32 13L${x1} 33H${x2}Z`).join('');
  P.push(`<path class="t-a" fill-rule="evenodd" d="M32 13Q20 26 5 33H59Q44 26 32 13Z${w}"/>`);
  P.push(`<path class="t-c" d="${w}"/>`);
  P.push('<path class="t-b" d="M32 13Q44 26 59 33H52.5Q43 26 32 13Z"/>');
  let sa = '', sc = '';
  for (let i = 0; i < 7; i++) {
    const x1 = b[i], x2 = b[i + 1], r = r1((x2 - x1) / 2);
    const s = `M${x1} 32.5A${r} ${r} 0 0 0 ${x2} 32.5Z`;
    if (i % 2) sc += s; else sa += s;
  }
  P.push(`<path class="t-a" d="${sa}"/>`, `<path class="t-c" d="${sc}"/>`);
  P.push('<path class="t-b" d="M51.3 32.5A3.85 3.85 0 0 0 59 32.5Z"/>');
  P.push('<rect class="t-b" x="4" y="31.5" width="56" height="2" rx="1"/>');
  P.push('<circle class="t-c" cx="32" cy="13.5" r="2"/>');
  P.push(spark(10, 10, 4), spark(55, 18, 2.8), '<circle class="t-c" cx="20" cy="5" r="1.2"/>');
  add('striped-tent', 'striped fair tent with a pennant', P);
}

// ---------- chocolate-bar ----------
{
  const P = ['<g transform="translate(29 34) rotate(-18)">'];
  P.push('<path class="t-a" d="M-15 -24Q-15 -26 -13 -26H4.6L5.4 -23L4.2 -20.5L5.6 -18L8.5 -17L11 -18.2L13.2 -16.8L15 -17.6V2H-15Z"/>');
  P.push('<path class="t-b" d="M13.4 -17.1L15 -17.6V2H13.4ZM4.6 -26L5.4 -23L4.2 -20.5L5.6 -18L4 -20.5L4.8 -23Z"/>');
  P.push('<path class="ln" stroke-width="1.5" d="M-4.75 -25.2V0M4.75 -17.6V0M-14.2 -15.75H14.2M-14.2 -6.25H14.2"/>');
  const xs = [-13.5, -4, 5.5], ys = [-24.5, -15, -5.5];
  let c = '';
  for (const y of ys) for (const x of xs) {
    if (x === 5.5 && y === -24.5) continue;
    c += `M${x + 1.2} ${y + 6.5}V${y + 1.2}H${x + 6.5}L${x + 5.3} ${y + 2.4}H${x + 2.4}V${y + 5.3}Z`;
  }
  P.push(`<path class="t-c" d="${c}"/>`);
  P.push('<path class="t-c" d="M-16.5 -1L-14 -4.5L-11 -1.5L-8 -5L-5 -1.8L-2 -4.6L1 -1.6L4 -5L7 -1.8L10 -4.6L13 -1.5L16.5 -4.2V1.5H-16.5Z"/>');
  P.push('<path class="t-b" d="M-17 1.5H17V7H-17ZM-17 14H17V21Q17 23 15 23H-15Q-17 23 -17 21Z"/>');
  P.push('<rect class="t-a" x="-17" y="7" width="34" height="7"/>');
  P.push('<path class="t-c" d="M0 7.9L1 9.6L2.9 9.9L1.5 11.3L1.8 13.1L0 12.3L-1.8 13.1L-1.5 11.3L-2.9 9.9L-1 9.6Z"/>');
  P.push('<rect class="t-c" x="-14.5" y="15.5" width="2.2" height="5" rx="1.1"/><rect class="t-c" x="-14.5" y="3" width="2.2" height="2.5" rx="1.1"/>');
  P.push('</g>');
  P.push('<g transform="translate(51 12) rotate(28)"><path class="t-a" d="M-5 -5H5V1.5L3 3.5L1.5 2.2L-.5 5L-2.5 3.2L-5 5Z"/><path class="t-b" d="M3.6 -5H5V1.5L3.6 2.9Z"/><path class="t-c" d="M-3.8 2V-3.8H2.4L1.3 -2.6H-2.6V2Z"/></g>');
  P.push('<circle class="t-b" cx="47" cy="24" r="1.4"/><circle class="t-b" cx="52" cy="27" r="1"/><circle class="t-b" cx="58" cy="22" r="1.2"/>');
  P.push(spark(58, 48, 4), spark(8, 8, 3));
  add('chocolate-bar', 'chocolate bar with a corner snapped off', P);
}

fs.writeFileSync(OUT, JSON.stringify(items, null, 1));
for (const it of items) if (it.svg.length > 2500) console.log('LONG', it.id, it.svg.length);
console.log('wrote', items.length);
