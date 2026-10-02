// Generator for part5.json (history, myth & fantasy, travel, cities & places).
import fs from 'node:fs';
const r = n => +n.toFixed(2);
const q = s => s.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
// 5-point star polygon points
const star = (cx, cy, R, ri = R * 0.42) => {
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? ri : R;
    pts.push(`${r(cx + rr * Math.cos(a))},${r(cy + rr * Math.sin(a))}`);
  }
  return pts.join(' ');
};
// 4-point sparkle path
const spark = (cx, cy, s) => `M${r(cx)} ${r(cy - s)}Q${r(cx + s * .18)} ${r(cy - s * .18)} ${r(cx + s)} ${r(cy)}Q${r(cx + s * .18)} ${r(cy + s * .18)} ${r(cx)} ${r(cy + s)}Q${r(cx - s * .18)} ${r(cy + s * .18)} ${r(cx - s)} ${r(cy)}Q${r(cx - s * .18)} ${r(cy - s * .18)} ${r(cx)} ${r(cy - s)}Z`;

// sub-path helpers (for evenodd holes: the app stacks fill-opacity, so lighter
// features must sit in holes rather than on top of a fill to stay visible faint)
const circ = (cx, cy, R) => `M${r(cx - R)} ${r(cy)}a${R} ${R} 0 1 0 ${r(2 * R)} 0a${R} ${R} 0 1 0 ${r(-2 * R)} 0Z`;
const starP = (cx, cy, R, ri) => 'M' + star(cx, cy, R, ri).split(' ').join('L') + 'Z';
const rectP = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}Z`;
const ang = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
const flags = (c, P, M, Q) => {
  const T = 2 * Math.PI, m = a => ((a % T) + T) % T;
  const d1 = m(ang(c, M) - ang(c, P)), d2 = m(ang(c, Q) - ang(c, P));
  const sweep = d1 < d2 ? 1 : 0, span = sweep ? d2 : T - d2;
  return `${span > Math.PI ? 1 : 0} ${sweep}`;
};
// crescent = circle (cx,cy,R) minus circle (cx+ox, cy+oy, R2)
const crescent = (cx, cy, R, ox, oy, R2) => {
  const d = Math.hypot(ox, oy), ux = ox / d, uy = oy / d;
  const a = (R * R - R2 * R2 + d * d) / (2 * d), h = Math.sqrt(R * R - a * a);
  const P = [cx + a * ux - h * uy, cy + a * uy + h * ux], Q = [cx + a * ux + h * uy, cy + a * uy - h * ux];
  const c1 = [cx, cy], c2 = [cx + ox, cy + oy];
  const M1 = [cx - R * ux, cy - R * uy], M2 = [c2[0] - R2 * ux, c2[1] - R2 * uy];
  return `M${r(P[0])} ${r(P[1])}A${R} ${R} 0 ${flags(c1, P, M1, Q)} ${r(Q[0])} ${r(Q[1])}A${R2} ${R2} 0 ${flags(c2, Q, M2, P)} ${r(P[0])} ${r(P[1])}Z`;
};

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg: q(svg) });

// ---------- castle ----------
const merlons = (x0, y, n, w, gap) => Array.from({ length: n }, (_, k) => `<rect class="t-a" x="${r(x0 + k * (w + gap))}" y="${y}" width="${w}" height="5" rx=".6"/>`).join('');
add('castle', 'fairy-tale castle with towers and a flag', `
<rect class="t-a" x="5" y="22" width="13" height="36"/>
<rect class="t-a" x="3.5" y="18" width="16" height="5" rx=".8"/>
${merlons(3.5, 14, 3, 4, 2)}
<rect class="t-b" x="15" y="23" width="3" height="35"/>
<rect class="t-b" x="5" y="23" width="13" height="1.6"/>
<rect class="t-a" x="46" y="22" width="13" height="36"/>
<rect class="t-a" x="44.5" y="18" width="16" height="5" rx=".8"/>
${merlons(44.5, 14, 3, 4, 2)}
<rect class="t-b" x="56" y="23" width="3" height="35"/>
<rect class="t-b" x="46" y="23" width="13" height="1.6"/>
<rect class="t-a" x="18" y="33" width="28" height="25"/>
<rect class="t-a" x="18" y="29.5" width="3.2" height="4"/>
<rect class="t-a" x="42.8" y="29.5" width="3.2" height="4"/>
<rect class="t-a" x="23" y="19" width="18" height="39"/>
<rect class="t-b" x="37.5" y="19" width="3.5" height="39"/>
<path class="ln" d="M32 7V1.2" stroke-width="1.6"/>
<polygon class="t-b" points="32.8,.8 40.5,2.8 32.8,4.8"/>
<polygon class="t-a" points="32,5.5 44.5,19.5 19.5,19.5"/>
<polygon class="t-b" points="32,5.5 44.5,19.5 35.5,19.5"/>
<polygon class="t-c" points="32,5.5 21.8,17.8 24.6,17.8"/>
<rect class="t-b" x="19.5" y="19" width="25" height="2" rx="1"/>
<path class="t-b" d="M26.5 58V49.5a5.5 5.5 0 0 1 11 0V58Z"/>
<path class="t-a" d="M29.2 45.2h1.2V58h-1.2zM33.6 45.2h1.2V58h-1.2zM27 51h10v1.2H27z"/>
<path class="t-b" d="M9 37v-5a2.5 2.5 0 0 1 5 0v5z"/>
<path class="t-b" d="M50 37v-5a2.5 2.5 0 0 1 5 0v5z"/>
<path class="t-b" d="M29.5 35v-5.5a2.5 2.5 0 0 1 5 0V35z"/>
<rect class="t-c" x="6.5" y="26" width="1.4" height="29" rx=".7"/>
<rect class="t-c" x="47.5" y="26" width="1.4" height="29" rx=".7"/>
<rect class="t-c" x="24.5" y="23" width="1.4" height="19" rx=".7"/>
<path class="ln" d="M7.5 44h4M9.5 50h4M48.5 44h4M50.5 50h4M19.5 39h2.5M42.5 42h2" stroke-width="1.2"/>
<rect class="t-b" x="1.5" y="57.5" width="61" height="4" rx="2"/>
`);

// ---------- sailing-ship ----------
const sail = (x1, x2, y1, y2, b = 2) => {
  const m = (x1 + x2) / 2, ym = (y1 + y2) / 2;
  return `M${x1} ${y1}Q${m} ${y1 - b} ${x2} ${y1}Q${x2 + 1.6} ${ym} ${x2} ${y2}Q${m} ${y2 - b} ${x1} ${y2}Q${x1 - 1.6} ${ym} ${x1} ${y1}Z`;
};
const sailHi = (x1, y1, y2) => `M${x1} ${y1}Q${x1 - 1.6} ${(y1 + y2) / 2} ${x1} ${y2}L${x1 + 2.6} ${y2 - .3}Q${x1 + 1.2} ${(y1 + y2) / 2} ${x1 + 2.6} ${y1 - .3}Z`;
add('sailing-ship', 'tall ship with billowing sails', `
<path class="ln" d="M14 36V15M30 41V3.5M47 41V9.5" stroke-width="2.2"/>
<path class="ln" d="M57 38.5L63 31" stroke-width="2"/>
<path class="ln" d="M47 11L62.5 31.5" stroke-width="1.2"/>
<polygon class="t-b" points="30.8,2.4 38.8,4.4 30.8,6.4"/>
<path class="t-a" d="${sail(23, 37, 7.5, 18.5)}"/>
<path class="t-a" d="${sail(21, 39, 21.5, 35.5)}"/>
<path class="t-a" d="${sail(42, 52, 12.5, 21.5)}"/>
<path class="t-a" d="${sail(41, 53, 24.5, 35)}"/>
<path class="t-a" d="${sail(8.5, 19.5, 17.5, 29)}"/>
<path class="t-c" d="${sailHi(23, 7.5, 18.5)}"/>
<path class="t-c" d="${sailHi(21, 21.5, 35.5)}"/>
<path class="t-c" d="${sailHi(42, 12.5, 21.5)}"/>
<path class="t-c" d="${sailHi(41, 24.5, 35)}"/>
<path class="t-c" d="${sailHi(8.5, 17.5, 29)}"/>
<path class="ln" d="M22 7.5H38M20 21.5H40M41 12.5H53M40 24.5H54M7.5 17.5H20.5" stroke-width="1.8"/>
<path class="t-a" d="M4 34H18V40H57L61 37L55 52Q53.5 55.5 49.5 55.5H14.5Q11 55.5 9.5 52Z"/>
<rect class="t-c" x="4.3" y="34" width="13.7" height="1.4"/>
<rect class="t-c" x="18" y="40" width="38.5" height="1.4"/>
<path class="t-b" d="M6.9 43.5H58.4L57 47H8Z"/>
${[15, 23, 31, 39, 47].map(x => `<circle class="t-c" cx="${x}" cy="45.25" r="1.1"/>`).join('')}
<path class="t-b" d="M9.3 51.5H55.2L55 52Q53.5 55.5 49.5 55.5H14.5Q11 55.5 9.5 52Z"/>
<rect class="t-b" x="7" y="36.5" width="3" height="2.6" rx=".6"/>
<rect class="t-b" x="12" y="36.5" width="3" height="2.6" rx=".6"/>
<path class="ln" d="M1 57.5q3.5-2.5 7 0t7 0t7 0t7 0t7 0t7 0t7 0t7 0t7 0" stroke-width="1.8"/>
<path class="ln" d="M8 62.5q3-2 6 0t6 0M38 62.5q3-2 6 0t6 0" stroke-width="1.5"/>
`);

// ---------- treasure-chest ----------
const coin = (x, y) => `<circle class="t-a" cx="${x}" cy="${y}" r="3.4"/><circle class="ln" cx="${x}" cy="${y}" r="1.9" stroke-width="1"/>`;
const mound = 'M14.5 33.5Q14.5 27.5 19 27Q21.5 21.5 27 22Q32 16.5 37.5 21Q43 19 45.5 24.5Q49.8 25.5 49.8 33.5Z';
add('treasure-chest', 'open chest overflowing with gold coins', `
<path class="t-a" fill-rule="evenodd" d="M8 33L10.5 11Q32 4 53.5 11L56 33ZM13.5 33L15.3 15Q32 10 48.7 15L50.5 33Z"/>
<path class="t-b" fill-rule="evenodd" d="M13.5 33L15.3 15Q32 10 48.7 15L50.5 33Z${mound}"/>
<path class="t-c" d="M10 11.2Q32 4 54 11.2L53.8 9.6Q32 2.2 10.2 9.6Z"/>
<path class="t-c" d="${mound}"/>
${coin(19.5, 29.5)}${coin(27, 25.5)}${coin(33.5, 23)}${coin(41.5, 26.5)}${coin(45.8, 30.8)}${coin(27.5, 31.5)}
<polygon class="t-b" points="36.5,26.5 39.8,29.3 36.5,33.5 33.2,29.3"/>
<polygon class="t-c" points="36.5,26.5 36.5,29.3 33.2,29.3"/>
<path class="t-a" fill-rule="evenodd" d="M8.5 33H55.5Q58 33 58 35.5V56.5Q58 59 55.5 59H8.5Q6 59 6 56.5V35.5Q6 33 8.5 33ZM29 38H35Q37 38 37 40V46Q37 48 35 48H29Q27 48 27 46V40Q27 38 29 38Z"/>
<rect class="t-b" x="6" y="33" width="52" height="5" rx="1.5"/>
<rect class="t-b" x="14" y="33" width="5" height="26"/>
<rect class="t-b" x="45" y="33" width="5" height="26"/>
<rect class="t-b" x="6" y="55" width="52" height="4" rx="1.5"/>
<path class="ln" d="M20.5 51.5H43.5M8 51.5h4.5M51.5 51.5h4.5" stroke-width="1.3"/>
<path class="t-c" d="M29 36H35Q37 36 37 38V46Q37 48 35 48H29Q27 48 27 46V38Q27 36 29 36Z"/>
<circle class="t-b" cx="32" cy="41" r="1.8"/>
<path class="t-b" d="M31.2 42h1.6l.6 3.3h-2.8z"/>
<rect class="t-c" x="8.2" y="40" width="1.6" height="13" rx=".8"/>
<path class="t-c" d="${spark(5, 18, 4)}"/>
<path class="t-c" d="${spark(59.5, 5, 3.5)}"/>
<path class="t-c" d="${spark(60, 20, 2.5)}"/>
`);

// ---------- compass ----------
add('compass', 'explorer\'s compass with a needle', `
<rect class="t-a" x="27.5" y="5.5" width="9" height="6" rx="2"/>
<circle class="ln" cx="32" cy="4.3" r="3" stroke-width="2.2"/>
<path class="t-a" fill-rule="evenodd" d="${circ(32, 36, 26)}${circ(32, 36, 20)}"/>
<path class="t-b" fill-rule="evenodd" d="${circ(32, 36, 26)}${circ(30.6, 34.6, 24)}"/>
<path class="t-c" d="M8.88 27.59A24.6 24.6 0 0 1 23.59 12.88L24.27 14.76A22.6 22.6 0 0 0 10.76 28.27Z"/>
<circle class="t-c" cx="32" cy="36" r="20"/>
<path class="ln" d="M52 36h-3.5M32 56v-3.5M12 36h3.5M46.1 21.9l-2.2 2.2M17.9 21.9l2.2 2.2M46.1 50.1l-2.2-2.2M17.9 50.1l2.2-2.2" stroke-width="1.8"/>
<path class="ln" d="M29.8 23.5V17.5l4.4 6V17.5" stroke-width="1.6"/>
<g transform="rotate(35 32 36)">
<polygon class="t-b" points="32,20 36,36 28,36"/>
<polygon class="t-a" points="28,36 36,36 32,52"/>
</g>
<circle class="t-b" cx="32" cy="36" r="3.2"/>
<circle class="t-c" cx="32" cy="36" r="1.3"/>
`);

// ---------- map ----------
add('map', 'folded map with a dotted route to an X', `
<path class="t-b" d="M4 57L22 52V54.5L4 59.5Z"/>
<path class="t-b" d="M22 52L42 57V59.5L22 54.5Z"/>
<path class="t-b" d="M42 57L60 52V54.5L42 59.5Z"/>
<path class="t-a" d="M4 15L22 10V52L4 57Z"/>
<path class="t-c" d="M22 10L42 15V57L22 52Z"/>
<path class="t-a" d="M42 15L60 10V52L42 57Z"/>
<path class="t-b" d="M42 15L45 14.2V56.2L42 57Z"/>
<path class="t-b" d="M19.5 10.7L22 10V52L19.5 52.7Z"/>
<path class="ln" d="M7 22q2-1.6 4 0t4 0M8 29q2-1.6 4 0t4 0" stroke-width="1.5"/>
<path class="t-a" d="M26 22Q30 17 35 20Q40 21 38.5 27Q34.5 31 29.5 28.5Q24 27.5 26 22Z"/>
<path class="t-b" d="M47 32L51 24.5L55 32Z"/>
<path class="t-b" d="M51.5 32L55 26.5L58.5 32Z"/>
<path class="ln" d="M13 47.5l2.6-1.3M19 45l2.6-.5M25.5 43.6l2.6-.9M31.5 41.4l2.6-.2M37.5 41.6l2.6.2M43.5 41.8l2.5-.2" stroke-width="1.8"/>
<path class="ln" d="M49.5 37.5l5.5 5.5M55 37.5l-5.5 5.5" stroke-width="2.6"/>
<path class="t-b" d="M10 48.5Q4.5 42 5.5 38.5A4.6 4.6 0 0 1 14.5 38.5Q15.5 42 10 48.5Z"/>
<circle class="t-c" cx="10" cy="38.8" r="1.8"/>
`);

// ---------- suitcase ----------
add('suitcase', 'vintage suitcase with straps, stickers and a tag', `
<path class="t-b" d="M23 20V14Q23 9.5 27.5 9.5H36.5Q41 9.5 41 14V20H37V14.5Q37 13.5 36 13.5H28Q27 13.5 27 14.5V20Z"/>
<rect class="t-b" x="20.5" y="17.5" width="7.5" height="4" rx="1"/>
<rect class="t-b" x="36" y="17.5" width="7.5" height="4" rx="1"/>
<path class="ln" d="M42 18.5Q46 12 50.5 10.5" stroke-width="1.3"/>
<g transform="rotate(18 54.5 9.5)"><rect class="t-c" x="49" y="6" width="11" height="7" rx="1.4"/><circle class="t-b" cx="51" cy="9.5" r="1"/><path class="ln" d="M53.5 8h4.5M53.5 11h3" stroke-width="1"/></g>
<rect class="t-a" x="4" y="20" width="56" height="37" rx="5"/>
<path class="t-b" d="M4 50.5H60V52Q60 57 55 57H9Q4 57 4 52Z"/>
<rect class="t-b" x="15" y="20" width="4.5" height="37"/>
<rect class="t-b" x="44.5" y="20" width="4.5" height="37"/>
<rect class="t-c" x="13.7" y="28.5" width="7.1" height="5.5" rx="1.2"/>
<rect class="t-b" x="15.8" y="30.2" width="2.9" height="2.1" rx=".5"/>
<rect class="t-c" x="43.2" y="28.5" width="7.1" height="5.5" rx="1.2"/>
<rect class="t-b" x="45.3" y="30.2" width="2.9" height="2.1" rx=".5"/>
<circle class="t-c" cx="31" cy="32.5" r="6.5"/>
<polygon class="t-b" points="${star(31, 32.8, 4.2)}"/>
<g transform="rotate(-10 33.5 45)"><rect class="t-c" x="25.5" y="41" width="16" height="8" rx="1.8"/><path class="ln" d="M28.5 45h10" stroke-width="1.6"/></g>
<rect class="t-c" x="6.8" y="24" width="2" height="21" rx="1"/>
<rect class="t-b" x="9" y="56" width="6" height="4" rx="1"/>
<rect class="t-b" x="49" y="56" width="6" height="4" rx="1"/>
`);

// ---------- street-lamp ----------
add('street-lamp', 'old-fashioned glowing street lamp', `
<path class="ln" d="M15 11l-4.5-1.8M14 17H8.5M15 23l-4.5 1.8M49 11l4.5-1.8M50 17h5.5M49 23l4.5 1.8" stroke-width="2"/>
<rect class="t-a" x="29.5" y="24" width="5" height="28"/>
<rect class="t-b" x="32.7" y="24" width="1.8" height="28"/>
<path class="ln" d="M29.5 30H22.5Q19.5 30 19.5 33Q19.5 35.5 22 35.5M34.5 30H41.5Q44.5 30 44.5 33Q44.5 35.5 42 35.5" stroke-width="2"/>
<rect class="t-a" x="27.5" y="44" width="9" height="3" rx="1"/>
<path class="t-a" d="M25 59L27.5 50H36.5L39 59Z"/>
<polygon class="t-b" points="34,50 36.5,50 39,59 35.8,59"/>
<rect class="t-a" x="21" y="58" width="22" height="4" rx="1"/>
<rect class="t-b" x="21" y="60.5" width="22" height="1.5" rx=".75"/>
<path class="t-c" d="M23.5 9H40.5L38 21.5H26Z"/>
<path class="t-a" d="M32 11.5Q35.5 15 34.5 18Q32 20 29.5 18Q28.5 15 32 11.5Z"/>
<path class="ln" d="M29 10V20.5M35 10V20.5" stroke-width="1.3"/>
<rect class="t-a" x="23" y="21" width="18" height="3" rx="1"/>
<rect class="t-a" x="27" y="23.5" width="10" height="2.5" rx="1"/>
<polygon class="t-a" points="32,2 43.5,9.5 20.5,9.5"/>
<polygon class="t-b" points="32,2 43.5,9.5 35,9.5"/>
<rect class="t-a" x="20.5" y="8.5" width="23" height="2.2" rx="1"/>
<circle class="t-a" cx="32" cy="2" r="1.8"/>
<rect class="t-c" x="30.4" y="26" width="1.1" height="17" rx=".55"/>
`);

// ---------- park-bench ----------
add('park-bench', 'wooden park bench with iron ends', `
<ellipse class="t-b" cx="32" cy="60.5" rx="29" ry="2"/>
<path class="t-b" d="M9.5 11H13V36L12.5 59H9L9.5 36Z"/>
<path class="t-b" d="M54.5 11H51V36L51.5 59H55L54.5 36Z"/>
<rect class="t-a" x="5" y="13" width="54" height="6.5" rx="1.6"/>
<rect class="t-a" x="5" y="22.5" width="54" height="6.5" rx="1.6"/>
<rect class="t-c" x="7" y="13.8" width="50" height="1.4" rx=".7"/>
<rect class="t-c" x="7" y="23.3" width="50" height="1.4" rx=".7"/>
<rect class="t-b" x="6" y="18" width="52" height="1.5" rx=".75"/>
<rect class="t-b" x="6" y="27.5" width="52" height="1.5" rx=".75"/>
<circle class="t-b" cx="11.2" cy="16" r="1.2"/><circle class="t-b" cx="52.8" cy="16" r="1.2"/>
<circle class="t-b" cx="11.2" cy="25.5" r="1.2"/><circle class="t-b" cx="52.8" cy="25.5" r="1.2"/>
<path class="t-c" d="M7.5 33H56.5L60.5 38H3.5Z"/>
<path class="ln" d="M5.5 35.5H58.5" stroke-width="1.1"/>
<rect class="t-a" x="3" y="38" width="58" height="4.5" rx="1.2"/>
<rect class="t-b" x="5" y="42.5" width="54" height="1.5"/>
<path class="ln" d="M11.3 28.5Q4 28.5 4.5 34M52.7 28.5Q60 28.5 59.5 34" stroke-width="2.6"/>
`);

// ---------- fountain ----------
add('fountain', 'tiered stone fountain with splashing water', `
<path class="t-c" d="M32 1Q34.8 5 33.6 12H30.4Q29.2 5 32 1Z"/>
<path class="t-c" d="M30.5 6.5Q20 6.5 17 24.5H19.8Q22 9.5 31 9Z"/>
<path class="t-c" d="M33.5 6.5Q44 6.5 47 24.5H44.2Q42 9.5 33 9Z"/>
<rect class="t-a" x="30" y="14" width="4" height="11"/>
<rect class="t-b" x="32.6" y="14" width="1.4" height="11"/>
<path class="t-a" d="M26 13H38Q37 17.5 32 17.5Q27 17.5 26 13Z"/>
<path class="t-a" d="M28 43V34H36V43Z"/>
<rect class="t-b" x="34" y="34" width="2" height="9"/>
<path class="t-c" d="M13.5 27.5Q7.5 30 7 43H10.2Q10.8 32 15.5 29.5Z"/>
<path class="t-c" d="M50.5 27.5Q56.5 30 57 43H53.8Q53.2 32 48.5 29.5Z"/>
<path class="t-a" d="M14 27H50Q48 36 32 36Q16 36 14 27Z"/>
<path class="t-b" d="M44 28.5H49.7Q48 36 32 36Q42 34.5 44 28.5Z"/>
<rect class="t-a" x="13" y="25" width="38" height="3" rx="1.5"/>
<rect class="t-c" x="15" y="25.5" width="34" height="1.1" rx=".55"/>
<rect class="t-a" x="4" y="46" width="56" height="12" rx="2"/>
<path class="t-b" d="M4 53.5H60V56Q60 58 58 58H6Q4 58 4 56Z"/>
<path class="ln" d="M14 47.5V52.5M25 47.5V52.5M39 47.5V52.5M50 47.5V52.5" stroke-width="1.3"/>
<rect class="t-a" x="2" y="43" width="60" height="4.5" rx="2.25"/>
<rect class="t-c" x="4" y="43.5" width="56" height="1.3" rx=".65"/>
<rect class="t-b" x="2.5" y="46.5" width="59" height="1" rx=".5"/>
<circle class="t-c" cx="4" cy="38.5" r="1.2"/><circle class="t-c" cx="60" cy="38.5" r="1.2"/>
<circle class="t-c" cx="13" cy="39" r=".9"/><circle class="t-c" cx="51" cy="39" r=".9"/>
<circle class="t-c" cx="24" cy="4" r="1"/><circle class="t-c" cx="40" cy="4" r="1"/>
`);

// ---------- storefront ----------
const scallops = (x0, n, w, y) => { let d = ''; for (let k = n - 1; k >= 0; k--) d += `A${w / 2} ${w / 2} 0 0 1 ${r(x0 + k * w)} ${y}`; return d; };
const stripe = (x, w, y0, y1) => `M${x} ${y0}H${x + w}V${y1}A${w / 2} ${w / 2} 0 0 1 ${x} ${y1}Z`;
add('storefront', 'little shop with a striped awning', `
<path class="t-a" fill-rule="evenodd" d="M6 13H58V25H6Z${rectP(16, 15.5, 32, 8)}M6 32H58V60H6Z${rectP(10, 39, 24, 15)}"/>
<rect class="t-b" x="54.5" y="13" width="3.5" height="12"/>
<rect class="t-b" x="54.5" y="32" width="3.5" height="28"/>
<rect class="t-b" x="4" y="9" width="56" height="5" rx="1.2"/>
<rect class="t-c" x="16" y="15.5" width="32" height="8"/>
<path class="ln" d="M20.5 19.5h9M33 19.5h10.5" stroke-width="1.8"/>
<path class="t-c" d="M4 25H60V32${scallops(4, 8, 7, 32)}Z"/>
${[0, 2, 4, 6].map(k => `<path class="t-b" d="${stripe(4 + k * 7, 7, 25, 32)}"/>`).join('')}
<rect class="t-b" x="6" y="36" width="52" height="1.5"/>
<rect class="t-c" x="10" y="39" width="24" height="15"/>
<path class="ln" d="M22 39.5V53.5M10.5 46.5H33.5" stroke-width="1.6"/>
<rect class="t-b" x="8.5" y="54" width="27" height="2.2" rx="1"/>
<path class="t-b" d="M40 60V41.5Q40 38.5 43 38.5H50Q53 38.5 53 41.5V60Z"/>
<rect class="t-c" x="43" y="41.5" width="7" height="6" rx="1"/>
<circle class="t-c" cx="50.3" cy="51" r="1.1"/>
<rect class="t-b" x="2" y="59" width="60" height="3" rx="1.5"/>
`);

// ---------- signpost ----------
const arrowR = (x1, x2, y1, y2) => { const ym = (y1 + y2) / 2, t = 5.5; return `M${x1 + 1.5} ${y1}H${x2 - t}L${x2} ${ym}L${x2 - t} ${y2}H${x1 + 1.5}Q${x1} ${y2} ${x1} ${y2 - 1.5}V${y1 + 1.5}Q${x1} ${y1} ${x1 + 1.5} ${y1}Z`; };
const arrowL = (x1, x2, y1, y2) => { const ym = (y1 + y2) / 2, t = 5.5; return `M${x2 - 1.5} ${y1}H${x1 + t}L${x1} ${ym}L${x1 + t} ${y2}H${x2 - 1.5}Q${x2} ${y2} ${x2} ${y2 - 1.5}V${y1 + 1.5}Q${x2} ${y1} ${x2 - 1.5} ${y1}Z`; };
add('signpost', 'wooden signpost with arrows pointing different ways', `
<ellipse class="t-b" cx="32" cy="60.5" rx="17" ry="3"/>
<path class="t-b" d="M16 60l1.4-5.5 1.4 4 1.4-6.5 1.6 8Z"/>
<path class="t-b" d="M42 60l1.6-7 1.4 5 1.4-4 1.4 6Z"/>
<path class="t-a" d="M29 10.2V6Q29 5 30 5H34Q35 5 35 6V10.2ZM29 20.8H35V25.2H29ZM29 35.8H35V40.2H29ZM29 49.3H35V61H29Z"/>
<path class="t-b" d="M33 5.1H34Q35 5.1 35 6V10.2H33ZM33 20.8H35V25.2H33ZM33 35.8H35V40.2H33ZM33 49.3H35V61H33Z"/>
<path class="t-c" d="M30 6.5H31.1V10.2H30ZM30 20.8H31.1V25.2H30ZM30 35.8H31.1V40.2H30ZM30 49.3H31.1V58H30Z"/>
<path class="t-a" d="${arrowR(10, 57, 10, 21)}"/>
<rect class="t-b" x="10.4" y="19" width="42.5" height="2" rx="1"/>
<path class="t-b" d="M52.8 19H55.3L51.5 21Z"/>
<path class="ln" d="M15 15.5h11M29.5 15.5h15" stroke-width="1.8"/>
<path class="t-a" d="${arrowL(6, 53, 25, 36)}"/>
<rect class="t-b" x="11" y="34" width="41.6" height="2" rx="1"/>
<path class="t-b" d="M11.2 34H8.6L11.5 36Z"/>
<path class="ln" d="M19.5 30.5h13M36 30.5h11.5" stroke-width="1.8"/>
<g transform="rotate(-7 32 44.5)">
<path class="t-a" d="${arrowR(14, 55, 40, 49.5)}"/>
<rect class="t-b" x="14.4" y="47.6" width="36.6" height="1.9" rx=".95"/>
<path class="ln" d="M19 44.75h9M31.5 44.75h12" stroke-width="1.8"/>
</g>
<circle class="t-b" cx="32" cy="12.8" r="1"/><circle class="t-b" cx="32" cy="27.8" r="1"/><circle class="t-b" cx="32" cy="42.2" r="1"/>
`);

// ---------- ticket ----------
const tk = 'M9 19H55Q58 19 58 22V28A4 4 0 0 0 58 36V42Q58 45 55 45H9Q6 45 6 42V36A4 4 0 0 0 6 28V22Q6 19 9 19Z';
add('ticket', 'pair of admission tickets with a star', `
<g transform="rotate(12 32 32) translate(2 -8)"><path class="t-c" d="${tk}"/></g>
<g transform="rotate(-12 32 32) translate(0 7)">
<path class="t-a" d="${tk}"/>
<path class="t-b" d="M6 40.5H58V42Q58 45 55 45H9Q6 45 6 42Z"/>
<polygon class="t-b" points="${star(25, 30.5, 6.8)}"/>
<path class="ln" d="M11 23.5H39M11 37H39" stroke-width="1.2"/>
<path class="ln" d="M44 21v2.2M44 25.3v2.2M44 29.6v2.2M44 33.9v2.2M44 38.2v2.2" stroke-width="1.6"/>
<path class="ln" d="M49 25v11M52 25v11" stroke-width="1.4"/>
</g>
`);

// ---------- shield ----------
const swordTip = `<polygon class="t-c" points="32,-3 32,12.5 29.8,12.5 29.8,2"/><polygon class="t-a" points="32,-3 34.2,2 34.2,12.5 32,12.5"/>`;
const swordHilt = `<rect class="t-c" x="29.8" y="49" width="2.2" height="6.5"/><rect class="t-a" x="32" y="49" width="2.2" height="6.5"/><rect class="t-b" x="23" y="55" width="18" height="4" rx="2"/><rect class="t-a" x="30.2" y="59" width="3.6" height="4.2"/><circle class="t-b" cx="32" cy="65.5" r="2.8"/>`;
const shOut = 'M32 12Q40 15.5 48 14V31Q48 47 32 57Q16 47 16 31V14Q24 15.5 32 12Z';
const shIn = 'M32 15.4Q39 18.4 44.8 17.4V31Q44.8 45 32 53.3Q19.2 45 19.2 31V17.4Q25 18.4 32 15.4Z';
const cross = 'M29.6 15H34.4V28H45.5V32.8H34.4V54H29.6V32.8H18.5V28H29.6Z';
add('shield', 'knight\'s shield over crossed swords', `
<g transform="rotate(35 32 35)">${swordTip}${swordHilt}</g>
<g transform="rotate(-35 32 35)">${swordTip}${swordHilt}</g>
<path class="t-a" fill-rule="evenodd" d="${shIn}${cross}"/>
<path class="t-c" d="${cross}"/>
<path class="t-b" d="M44.8 17.4V31Q44.8 45 32 53.3Q41.5 44 41.8 31V17.8Z"/>
<path class="t-b" fill-rule="evenodd" d="${shOut}${shIn}"/>
<circle class="t-b" cx="32" cy="30.4" r="4"/>
<circle class="t-c" cx="30.9" cy="29.3" r="1.2"/>
`);

// ---------- wizard-hat ----------
const cone = 'M13 52C19 40 24 24 30 13C34 5.5 43 2 51 9C45 8 40 11 39 17C39 30 44 42 51 52Q32 57 13 52Z';
const moon = crescent(27.5, 31, 5.5, 2.6, -2.2, 4.6);
add('wizard-hat', 'pointy wizard hat with stars and a moon', `
<path class="t-b" d="M2.5 54.5A29.5 7.5 0 0 0 61.5 54.5L61 53A29 6.5 0 0 1 3 53Z"/>
<ellipse class="t-a" cx="32" cy="53" rx="29" ry="6.5"/>
<path class="t-a" fill-rule="evenodd" d="${cone}${moon}${starP(33, 41.5, 3.3)}${starP(32, 21, 2.1)}"/>
<path class="t-c" d="${moon}"/>
<polygon class="t-c" points="${star(33, 41.5, 3.3)}"/>
<polygon class="t-c" points="${star(32, 21, 2.1)}"/>
<path class="t-b" d="M39 17C39 30 44 42 51 52L46.5 53C41 43 35.5 31 35.8 18Z"/>
<path class="t-b" d="M51 9C45 8 40 11 39 17L36.2 16C38 9 44.5 5.5 51 9Z"/>
<path class="t-c" d="M17.5 45.5C18.8 42.5 20 40 21 37.5L22.8 38.3C21.8 41 20.6 43.5 19.4 46Z"/>
<path class="t-b" d="M15.5 45.5Q32 51 48.8 45.5L51.2 51.5Q32 57.5 12.8 51.5Z"/>
<rect class="t-c" x="28" y="47.3" width="8" height="7" rx="1.2"/>
<rect class="t-b" x="30.3" y="49.4" width="3.4" height="2.8" rx=".5"/>
<polygon class="t-c" points="${star(53, 11.5, 3.2)}"/>
<path class="t-c" d="${spark(8, 19, 4)}"/>
<path class="t-c" d="${spark(57, 29, 3.2)}"/>
<circle class="t-c" cx="15" cy="30" r="1.1"/><circle class="t-c" cx="58" cy="40" r="1"/>
`);

// ---------- crown ----------
const gems = `${circ(32, 47.8, 3.4)}M18 44.6L21.2 47.8L18 51L14.8 47.8ZM46 44.6L49.2 47.8L46 51L42.8 47.8Z${circ(9.8, 47.8, 1.3)}${circ(25, 47.8, 1.1)}${circ(39, 47.8, 1.1)}${circ(54.2, 47.8, 1.3)}`;
add('crown', 'jewelled royal crown', `
<path class="t-a" d="M7.25 43L5 19L19.5 32L32 11L44.5 32L59 19L56.75 43Z"/>
<path class="t-b" d="M32 11L44.5 32L40 36Z"/>
<path class="t-b" d="M59 19L56.75 43H52.5L55 25Z"/>
<path class="t-c" d="M5 19L7.25 43H9.6L7.5 22.5Z"/>
<path class="t-c" d="M32 11L19.5 32L22.3 33.3Z"/>
<circle class="t-c" cx="5" cy="15.8" r="3.3"/>
<circle class="t-c" cx="32" cy="7.6" r="3.8"/>
<circle class="t-c" cx="59" cy="15.8" r="3.3"/>
<path class="t-b" d="M32 24.5Q36 29 32 34Q28 29 32 24.5Z"/>
<circle class="t-b" cx="13" cy="36" r="2.4"/>
<circle class="t-b" cx="51" cy="36" r="2.4"/>
<path class="t-b" fill-rule="evenodd" d="M7.5 42H56.5Q59 42 59 44.5V50.5Q59 53 56.5 53H7.5Q5 53 5 50.5V44.5Q5 42 7.5 42Z${gems}"/>
<path class="t-c" d="${gems}"/>
<rect class="t-c" x="6" y="42" width="52" height="1.5" rx=".75"/>
<path class="t-c" d="${spark(18, 9, 3.5)}"/>
<path class="t-c" d="${spark(47, 7, 2.8)}"/>
<ellipse class="t-b" cx="32" cy="59" rx="24" ry="2.2"/>
`);

// ---------- amphora ----------
add('amphora', 'ancient two-handled vase with bands', `
<path class="ln" d="M25.5 11.5Q13.5 9.5 13.5 16Q13.5 20 18.5 22.5M38.5 11.5Q50.5 9.5 50.5 16Q50.5 20 45.5 22.5" stroke-width="3.2"/>
<path class="t-a" d="M25.5 8H38.5V14Q38.5 18.5 45 20.5Q55.5 24 55.5 35Q55.5 46.5 41 53H23Q8.5 46.5 8.5 35Q8.5 24 19 20.5Q25.5 18.5 25.5 14Z"/>
<path class="t-b" d="M45 20.5Q55.5 24 55.5 35Q55.5 46.5 41 53H37Q50 46 50.5 35Q51 25.5 43 20.8Z"/>
<path class="t-b" d="M12.8 24.5Q32 29 51.2 24.5L53.6 28Q32 33 10.4 28Z"/>
<path class="ln" d="M11.5 38l3.5-4 3.5 4 3.5-4 3.5 4 3.5-4 3.5 4 3.5-4 3.5 4 3.5-4 3.5 4 3.5-4" stroke-width="1.6"/>
<path class="t-b" d="M9.4 41.5Q32 46 54.6 41.5L53 45Q32 50 11 45Z"/>
<rect class="t-a" x="22" y="4" width="20" height="5" rx="2.5"/>
<rect class="t-b" x="24" y="8.5" width="16" height="1.6"/>
<rect class="t-c" x="24" y="4.8" width="8" height="1.2" rx=".6"/>
<rect class="t-c" x="27.3" y="10.5" width="1.4" height="7" rx=".7"/>
<ellipse class="t-c" cx="15.5" cy="34.5" rx="1.8" ry="4.5" transform="rotate(12 15.5 34.5)"/>
<path class="t-a" d="M24 52.5H40L43.5 58.5H20.5Z"/>
<path class="t-b" d="M36 52.5H40L43.5 58.5H39Z"/>
<rect class="t-a" x="18.5" y="58" width="27" height="3.8" rx="1.2"/>
<rect class="t-b" x="18.5" y="60.5" width="27" height="1.3" rx=".6"/>
`);

// ---------- lighthouse ----------
add('lighthouse', 'striped lighthouse beaming on the rocks', `
<polygon class="t-c" points="26.5,12 3,5.5 3,20.5 26.5,17.5"/>
<polygon class="t-c" points="37.5,12 61,5.5 61,20.5 37.5,17.5"/>
<polygon class="t-a" points="25,22 39,22 44,54 20,54"/>
<polygon class="t-b" points="24.53,25 39.47,25 40.41,31 23.59,31"/>
<polygon class="t-b" points="22.81,36 41.19,36 42.13,42 21.88,42"/>
<polygon class="t-b" points="36,22 39,22 44,54 40,54"/>
<polygon class="t-c" points="26.3,23 27.7,23 23.9,53 22.5,53"/>
<rect class="t-b" x="30.5" y="32.2" width="3" height="3" rx="1.5"/>
<path class="t-b" d="M29 51.5V47a3 3 0 0 1 6 0V51.5Z"/>
<rect class="t-c" x="26.5" y="10" width="11" height="10"/>
<path class="t-a" d="M32 11.5Q35 14 34.2 16.8Q32 18.5 29.8 16.8Q29 14 32 11.5Z"/>
<rect class="t-b" x="21" y="19.5" width="22" height="3" rx="1"/>
<path class="ln" d="M22.5 15.5H41.5M23.5 15.5V19.5M28 15.5V19.5M32 15.5V19.5M36 15.5V19.5M40.5 15.5V19.5" stroke-width="1.4"/>
<path class="t-a" d="M24.5 10.5Q24.5 3.5 32 3.5Q39.5 3.5 39.5 10.5Z"/>
<path class="t-b" d="M35 3.9Q39.5 5 39.5 10.5H36.2Q36.2 6 35 3.9Z"/>
<rect class="t-a" x="23.5" y="9.5" width="17" height="2" rx="1"/>
<circle class="t-a" cx="32" cy="2.4" r="1.6"/>
<path class="t-b" d="M5 59Q6 52.5 12.5 52.5Q15.5 49.5 21 51L43 51Q48.5 49.5 52 52.5Q58 52.5 59 59Z"/>
<path class="t-a" d="M12.5 52.5Q15.5 49.5 21 51L23 53.5Q18 52 14.5 54Z"/>
<path class="t-a" d="M43 51Q48.5 49.5 52 52.5L50 54Q46.5 52.5 42 53.5Z"/>
<path class="ln" d="M1 61.5q3.5-2.4 7 0t7 0t7 0t7 0t7 0t7 0t7 0t7 0t7 0" stroke-width="1.6"/>
<path class="ln" d="M7 32q2-2.2 4 0q2-2.2 4 0M50 38q1.6-1.8 3.2 0q1.6-1.8 3.2 0" stroke-width="1.4"/>
`);

// ---------- pyramid ----------
add('pyramid', 'pyramids in the desert under the sun', `
<circle class="t-c" cx="51" cy="12" r="7"/>
<polygon class="t-a" points="51,25 40,51 53,54"/>
<polygon class="t-b" points="51,25 53,54 63.5,50"/>
<path class="ln" d="M45.5 38L52 39.5M48.5 38.6V45" stroke-width="1.2"/>
<polygon class="t-a" points="25,7 1.5,52 33,56.5"/>
<polygon class="t-b" points="25,7 33,56.5 55,51"/>
<polygon class="t-c" points="25,7 1.5,52 4.5,52.4 25,10.5"/>
<path class="ln" d="M19.1 18.2L27 19.4M13.25 29.5L29 31.8M7.4 40.7L31 44.2" stroke-width="1.3"/>
<path class="ln" d="M23.1 18.8V30.9M17.5 30.1V42.2M26.5 31.4V43.5M11.5 41.3V52.5M20.5 42.6V53.5M28.5 43.8V54.5" stroke-width="1.2"/>
<path class="t-b" d="M0 55Q12 52 26 55Q40 58.5 52 54Q58 52 64 53V62.5H0Z"/>
<path class="t-a" d="M0 57.5Q14 54.5 28 58Q42 61 64 56V62.5H0Z"/>
<path class="ln" d="M8 60.5q5-1.5 10 0M40 60q5-1.5 10 0" stroke-width="1.3"/>
`);

// ---------- airplane ----------
const fus = 'M9 27.5H48Q57.5 27.5 60.5 32.5Q57.5 37.5 48 37.5H12Q6.5 37.5 5.5 33Z';
const wins = [16, 21, 26, 31, 36, 41].map(x => circ(x, 31.2, 1.5)).join('');
const cockpit = 'M51 29.6H54.8Q57.2 30 58.4 31.8H51Z';
add('airplane', 'passenger plane climbing past clouds', `
<path class="t-c" d="M3 62C-.5 62 -.5 56.5 3.5 56.3C4 52.2 9.5 51 12 54C14 50.5 20 51.5 20.5 55.8C24 56.2 24 62 20 62Z"/>
<path class="t-c" d="M45 18C42 18 42 13.5 45.3 13.2C45.8 10 50 9.2 52 11.5C53.5 8.8 58.2 9.6 58.5 13C61.3 13.3 61.2 18 58 18Z"/>
<g transform="rotate(-14 32 34) translate(0 3)">
<path class="t-b" d="M40.5 28L30.5 14.5H25.5L30.5 28Z"/>
<path class="t-a" d="M6 30L2.5 15H8.5L18 28Z"/>
<path class="t-b" d="M4.8 24.5L3.9 20.5H10.5L13.8 24.5Z"/>
<path class="t-b" d="M11 33.5L3.5 39.5H8.5L17 34.5Z"/>
<path class="t-a" fill-rule="evenodd" d="${fus}${wins}${cockpit}"/>
<path class="t-c" d="${wins}${cockpit}"/>
<path class="t-b" d="M7.3 35.5H56.9Q54 37.5 48 37.5H12Q8.5 37.5 7.3 35.5Z"/>
<rect class="t-c" x="12" y="28.3" width="34" height="1.2" rx=".6"/>
<path class="t-a" d="M41 34L28.5 52H23L29 34Z"/>
<path class="t-b" d="M29 34H41L39.6 36H28.4Z"/>
<rect class="t-b" x="29" y="40" width="9" height="4.6" rx="2.3" transform="rotate(-8 33.5 42.3)"/>
</g>
`);

// ---------- palm-island ----------
const leaf = (tx, ty, c1x, c1y, c2x, c2y) => `M39 16.5Q${c1x} ${c1y} ${tx} ${ty}Q${c2x} ${c2y} 39.5 19.5Z`;
add('palm-island', 'palm tree on a little sandy island', `
<path class="ln" d="M1 58.5q3.5-2.4 7 0t7 0t7 0t7 0t7 0t7 0t7 0t7 0t7 0M9 63q3-2 6 0t6 0M41 63q3-2 6 0t6 0" stroke-width="1.7"/>
<path class="t-c" d="M5 55.5Q13 45 32 45Q51 45 59 55.5Z"/>
<path class="t-b" d="M5 55.5Q7 53 9.5 51.5Q30 55 57 52.5Q58 54 59 55.5Z"/>
<path class="t-a" d="M27 48Q29 31 36.5 17.5L41.5 19.5Q34 32 32.5 48Z"/>
<path class="t-b" d="M38.8 18.4L41.5 19.5Q34 32 32.5 48H30.5Q31.5 32 38.8 18.4Z"/>
<path class="ln" d="M28.5 42.5l4 .8M29.5 36l4.3 1M31.3 29.8l4.3 1.2M33.6 24.2l4 1.4" stroke-width="1.3"/>
<path class="t-a" d="${leaf(12, 26, 23, 5, 27, 20.5)}"/>
<path class="t-a" d="${leaf(20, 3.5, 29.5, 1.5, 32, 12.5)}"/>
<path class="t-a" d="${leaf(62, 27, 57, 7, 49.5, 19.5)}"/>
<path class="t-a" d="${leaf(55, 2.5, 45, 0, 47.5, 12)}"/>
<path class="t-a" d="${leaf(49.5, 36, 54, 20, 42, 25)}"/>
<path class="ln" d="M38 17.5Q25 11 13.5 24.5M38 17Q30 6 21.5 4.5M40.5 17.5Q54 12 60.5 25.5M40.5 17Q46 5 54 3.5M40.5 18.5Q49 22 49 34" stroke-width="1.1"/>
<circle class="t-b" cx="36.5" cy="20.8" r="2.4"/>
<circle class="t-b" cx="41" cy="21.5" r="2.4"/>
<circle class="t-b" cx="38.6" cy="24.4" r="2.2"/>
<circle class="t-c" cx="35.8" cy="20" r=".8"/>
`);

fs.writeFileSync(process.argv[2] || new URL('../../icons/part5.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
