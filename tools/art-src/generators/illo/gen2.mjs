// Generates group2.json (science, space, music, art, books, movies).
import fs from 'node:fs';
const r = (n) => Math.round(n * 10) / 10;
const star = (cx, cy, s, cls = 't-c') =>
  `<path class="${cls}" d="M${cx} ${r(cy - s)}Q${cx} ${cy} ${r(cx + s)} ${cy}Q${cx} ${cy} ${cx} ${r(cy + s)}Q${cx} ${cy} ${r(cx - s)} ${cy}Q${cx} ${cy} ${cx} ${r(cy - s)}Z"/>`;
// translate an absolute path (M L H V C Q T S A Z) by dx,dy
function shift(d, dx, dy) {
  return d.replace(/([MLHVCQTSAZ])([^MLHVCQTSAZ]*)/g, (m, c, args) => {
    const n = (args.match(/-?\d*\.?\d+/g) || []).map(Number);
    let out;
    if (c === 'Z') return 'Z';
    if (c === 'H') out = n.map(v => r(v + dx));
    else if (c === 'V') out = n.map(v => r(v + dy));
    else if (c === 'A') out = n.map((v, i) => (i % 7 === 5 ? r(v + dx) : i % 7 === 6 ? r(v + dy) : v));
    else out = n.map((v, i) => r(v + (i % 2 ? dy : dx)));
    return c + out.join(' ');
  });
}
const ring = (cx, cy, rr) => `M${cx - rr} ${cy}A${rr} ${rr} 0 1 0 ${cx + rr} ${cy}A${rr} ${rr} 0 1 0 ${cx - rr} ${cy}Z`;

// ---------- science: bubbling flask ----------
const science = [
  `<circle class="t-a" cx="36.5" cy="9" r="3.4"/>`,
  `<circle class="t-a" cx="27.5" cy="5.5" r="2.4"/>`,
  `<circle class="t-a" cx="40.5" cy="2.4" r="1.6"/>`,
  `<path class="t-a" d="M27 19L27 30L10.3 54Q6.1 60 13 60L51 60Q57.9 60 53.7 54L37 30L37 19Z"/>`,
  // right-side glass shade above the liquid
  `<path class="t-b" d="M37 30L45.3 42L41.3 42L34 31.4L34 19L37 19Z"/>`,
  `<path class="t-b" d="M18.7 42Q25 38.5 32 42Q39 45.5 45.3 42L53.7 54Q57.9 60 51 60L13 60Q6.1 60 10.3 54Z"/>`,
  `<circle class="t-c" cx="24" cy="52" r="2.6"/>`,
  `<circle class="t-c" cx="34" cy="48.5" r="1.8"/>`,
  `<circle class="t-c" cx="41" cy="54.5" r="2.2"/>`,
  `<circle class="t-c" cx="30" cy="56" r="1.2"/>`,
  `<rect class="t-b" x="22.5" y="14" width="19" height="6" rx="3"/>`,
  `<rect class="t-c" x="29" y="22" width="2.4" height="8" rx="1.2"/>`,
  `<ellipse class="t-c" cx="21" cy="36.5" rx="1.8" ry="4.6" transform="rotate(35 21 36.5)"/>`,
].join('');

// ---------- space: ringed planet, stars, rocket ----------
const frontD = 'M-27 0A27 8 0 0 0 27 0L21 0A21 4.5 0 0 1 -21 0Z';
const space = [
  star(53, 12, 6),
  star(57, 56, 4.5),
  `<circle class="t-c" cx="36" cy="6" r="1.3"/>`,
  `<circle class="t-c" cx="6" cy="57" r="1.3"/>`,
  `<circle class="t-c" cx="60" cy="37" r="1.1"/>`,
  `<g transform="translate(28 38) rotate(-20)">`,
  `<path class="t-b" d="M-27 0A27 8 0 0 1 27 0L21 0A21 4.5 0 0 0 -21 0Z"/>`,
  `<circle class="t-a" cx="0" cy="0" r="15"/>`,
  `<path class="t-b" d="M14.1 -5.1A15 15 0 0 1 -5.1 14.1A18 18 0 0 0 14.1 -5.1Z"/>`,
  `<ellipse class="t-c" cx="-6" cy="-8" rx="3.6" ry="2.2" transform="rotate(-35 -6 -8)"/>`,
  `<path class="t-b" d="${shift(frontD, 0, 2)}"/>`,
  `<path class="t-c" d="${frontD}"/>`,
  `</g>`,
  // rocket
  `<g transform="translate(14 15) rotate(40)">`,
  `<path class="t-c" d="M-3 5.5Q0 16 3 5.5Z"/>`,
  `<path class="t-b" d="M-4.4 -1L-8.4 6.5L-3.8 5.5ZM4.4 -1L8.4 6.5L3.8 5.5Z"/>`,
  `<path class="t-a" d="M0 -12.5Q6.8 -5.5 4.4 5.5L-4.4 5.5Q-6.8 -5.5 0 -12.5Z"/>`,
  `<path class="t-b" d="M0 -12.5Q6.8 -5.5 4.4 5.5L1.6 5.5Q3.4 -4.5 0 -12.5Z"/>`,
  `<circle class="t-c" cx="0" cy="-2.5" r="2.2"/>`,
  `</g>`,
].join('');

// ---------- music: beamed notes ----------
const music = [
  `<path class="t-a" d="M22 14L54 5Q57 4.2 57 7.3L57 14Q57 16 55 16.6L25 25Z"/>`,
  `<rect class="t-a" x="22" y="15" width="5" height="36" rx="1"/>`,
  `<rect class="t-a" x="52" y="7" width="5" height="36" rx="1"/>`,
  `<ellipse class="t-a" cx="17" cy="51" rx="10" ry="7.5" transform="rotate(-22 17 51)"/>`,
  `<ellipse class="t-a" cx="47" cy="43" rx="10" ry="7.5" transform="rotate(-22 47 43)"/>`,
  `<path class="t-b" d="M8.2 55.6Q12 60.6 20 58.4Q27.7 56 27 49Q25 55 18 56.5Q12 57.6 8.2 55.6Z"/>`,
  `<path class="t-b" d="M38.2 47.6Q42 52.6 50 50.4Q57.7 48 57 41Q55 47 48 48.5Q42 49.6 38.2 47.6Z"/>`,
  `<ellipse class="t-c" cx="13" cy="48" rx="3.5" ry="2" transform="rotate(-22 13 48)"/>`,
  `<ellipse class="t-c" cx="43" cy="40" rx="3.5" ry="2" transform="rotate(-22 43 40)"/>`,
  `<rect class="t-c" x="53.4" y="19" width="1.8" height="16" rx=".9"/>`,
  `<path class="t-b" d="M25 25L57 16.6L57 12L25 20.4Z"/>`,
  `<path class="ln" d="M6 22Q3 28 6 34M11 24Q9 28 11 32"/>`,
  star(9, 8, 4),
  star(58, 57, 3.5),
].join('');

// ---------- art: palette + brush ----------
const pal = 'M30 12C47 11 61 21 60 35C59 48 49 57 36 57C30 57 28 53 30 49C32 45 29 41 24 43C19 45 16 50 11 49C5.5 48 3.5 42 4.5 35C6 21 16 12.6 30 12Z';
const hole = ring(17, 31, 4.2);
const brush = (cls1, cls2, cls3, cls4) => [
  `<path class="${cls1}" d="M-3 -17L-2.2 -44Q0 -46.5 2.2 -44L3 -17Z"/>`,
  `<rect class="${cls2}" x="-3.4" y="-18" width="6.8" height="7" rx="1.2"/>`,
  `<path class="${cls3}" d="M0 1C-4 -3 -4.2 -8 -3.4 -11.5L3.4 -11.5C4.2 -8 4 -3 0 1Z"/>`,
  cls4 ? `<path class="${cls4}" d="M0 1C-2.8 -1.8 -3.6 -4.5 -3.8 -6.5L3.8 -6.5C3.6 -4.5 2.8 -1.8 0 1Z"/>` : '',
].join('');
const art = [
  // shadow = shifted palette XOR palette, so it never sits under the face
  `<path class="t-b" fill-rule="evenodd" d="${shift(pal, 1.5, 3)}${shift(hole, 1.5, 3)}${pal}${hole}"/>`,
  `<path class="t-a" fill-rule="evenodd" d="${pal}${hole}"/>`,
  `<circle class="t-b" cx="21" cy="20" r="4.6"/>`,
  `<circle class="t-c" cx="33" cy="18" r="4.4"/>`,
  `<circle class="t-b" cx="51" cy="36" r="4.4"/>`,
  `<circle class="t-c" cx="40" cy="48" r="4.2"/>`,
  `<g transform="translate(32 37) rotate(40)">`,
  `<path class="t-b" d="M-3 -17L-2.2 -41Q0 -43.5 2.2 -41L3 -17Z"/>`,
  `<rect class="t-c" x="-3.5" y="-18" width="7" height="7" rx="1.2"/>`,
  `<path class="t-b" d="M0 1C-4.2 -3 -4.4 -8 -3.5 -11.5L3.5 -11.5C4.4 -8 4.2 -3 0 1Z"/>`,
  `<path class="t-c" d="M-1.8 -10.5L-.6 -10.5L-.8 -4Z"/>`,
  `</g>`,
].join('');

// ---------- books: open book + bookmark ----------
const books = [
  // cover: only the band that shows around the pages
  `<path class="t-b" d="M2 14L2 56Q18 52 32 59Q46 52 62 56L62 14L59 14L59 53Q45 48 32 56Q19 48 5 53L5 14Z"/>`,
  // page edges
  `<path class="t-c" d="M5 51Q19 46 32 54Q45 46 59 51L59 53Q45 48 32 56Q19 48 5 53Z"/>`,
  `<path class="t-a" d="M32 16Q19 7 5 11L5 51Q19 46 32 54Z"/>`,
  `<path class="t-a" d="M32 16Q45 7 59 11L59 51Q45 46 32 54Z"/>`,
  `<path class="t-b" d="M32 16Q29.2 13.9 26.5 12.7L26.5 49.9Q29.2 51.3 32 54Z"/>`,
  `<path class="ln" d="M10 19Q16 17 22 18.6M10 26Q16 24 22 25.6M10 33Q16 31 22 32.6M10 40Q16 38 22 39.6"/>`,
  `<path class="ln" d="M47 18.6Q50 17.5 54 17.5M47 25.6Q50 24.5 54 24.5M47 32.6Q50 31.5 54 31.5M47 39.6Q50 38.5 54 38.5"/>`,
  `<path class="t-c" d="M37 12.4L43 10.9L43 62L40 58.5L37 62Z"/>`,
].join('');

// ---------- movies: clapperboard ----------
const stripes = (y, h) => [0, 1, 2, 3].map(k => {
  const t0 = 13 + 12 * k, b0 = 8 + 12 * k;
  return `<polygon class="t-b" points="${t0},${y} ${t0 + 6},${y} ${b0 + 6},${y + h} ${b0},${y + h}"/>`;
}).join('');
const board = 'M10 30H54Q58 30 58 34V53Q58 57 54 57H10Q6 57 6 53V34Q6 30 10 30Z';
const movies = [
  `<g transform="translate(0 2)">`,
  `<path class="t-b" fill-rule="evenodd" d="${shift(board, 0, 3.5)}${board}"/>`,
  `<path class="t-a" d="${board}"/>`,
  `<rect class="t-c" x="6" y="22" width="52" height="9" rx="2"/>`,
  stripes(22, 9),
  `<g transform="rotate(-14 7 21)">`,
  `<rect class="t-c" x="6" y="11" width="52" height="9" rx="2"/>`,
  stripes(11, 9),
  `</g>`,
  `<circle class="t-a" cx="8.5" cy="21" r="2.6"/>`,
  `<path class="ln" d="M13 39H51M13 47H28M35 47H51"/>`,
  `</g>`,
].join('');

const items = [
  { id: 'science', motif: 'bubbling flask', svg: science },
  { id: 'space', motif: 'ringed planet, stars, rocket', svg: space },
  { id: 'music', motif: 'beamed notes', svg: music },
  { id: 'art', motif: 'palette with brush', svg: art },
  { id: 'books', motif: 'open book, bookmark', svg: books },
  { id: 'movies', motif: 'clapperboard', svg: movies },
];
fs.writeFileSync(new URL('./group2.json', import.meta.url), JSON.stringify(items, null, 1));
