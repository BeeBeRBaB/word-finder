// Generator for group4.json (clothing, celebrations, myth, history, places, feelings, garden).
import fs from 'node:fs';
const r = n => +n.toFixed(2);
const q = s => s.replace(/\s+/g, ' ').replace(/> </g, '><').trim();

// ---------- clothing ----------
const clothing = q(`
<path class="ln" d="M32 19V13A5 5 0 0 0 27 8A5 5 0 0 0 22 13" stroke-width="2.4"/>
<path class="t-a" d="M23 16Q32 25 41 16L50 19Q54 20.5 56 24L59.5 30Q60 32 58 33L50 37Q48 37.8 47 36L46 35V55Q46 58 43 58H21Q18 58 18 55V35L17 36Q16 37.8 14 37L6 33Q4 32 4.5 30L8 24Q10 20.5 14 19Z"/>
<path class="t-b" d="M23 16Q32 25 41 16Q32 19.5 23 16Z"/>
<path class="t-c" d="M23 16Q32 25 41 16L43 16.7Q32 28 21 16.7Z"/>
<path class="t-b" d="M59.5 30Q60 32 58 33L50 37L48.3 34.4L57.7 27.4Z"/>
<path class="t-b" d="M4.5 30Q4 32 6 33L14 37L15.7 34.4L6.3 27.4Z"/>
<path class="t-b" d="M18 52.5H46V55Q46 58 43 58H21Q18 58 18 55Z"/>
<path class="t-b" d="M46 35V52.5H42.5V37.5Q44.5 37 46 35Z"/>
<rect class="t-c" x="21" y="24" width="3" height="25" rx="1.5"/>
<rect class="t-b" x="34.5" y="29" width="7" height="7" rx="1.5"/>
<rect class="t-c" x="34.5" y="29" width="7" height="2" rx="1"/>
`);

// ---------- celebrations ----------
function balloon(cx, cy, rx, ry) {
  const p = (cx, cy, rx, ry) => `M${r(cx)} ${r(cy - ry)}C${r(cx + rx * .6)} ${r(cy - ry)} ${r(cx + rx)} ${r(cy - ry * .5)} ${r(cx + rx)} ${r(cy - ry * .05)}C${r(cx + rx)} ${r(cy + ry * .55)} ${r(cx + rx * .4)} ${r(cy + ry * .95)} ${r(cx)} ${r(cy + ry)}C${r(cx - rx * .4)} ${r(cy + ry * .95)} ${r(cx - rx)} ${r(cy + ry * .55)} ${r(cx - rx)} ${r(cy - ry * .05)}C${r(cx - rx)} ${r(cy - ry * .5)} ${r(cx - rx * .6)} ${r(cy - ry)} ${r(cx)} ${r(cy - ry)}Z`;
  return `<path class="t-b" fill-rule="evenodd" d="${p(cx, cy, rx, ry)}${p(cx - 1, cy - 1.3, rx - 1.6, ry - 1.6)}"/>
<path class="t-a" d="${p(cx - 1, cy - 1.3, rx - 1.6, ry - 1.6)}"/>
<ellipse class="t-c" cx="${r(cx - rx * .45)}" cy="${r(cy - ry * .42)}" rx="1.8" ry="3.4" transform="rotate(28 ${r(cx - rx * .45)} ${r(cy - ry * .42)})"/>
<polygon class="t-b" points="${r(cx)},${r(cy + ry - .6)} ${r(cx + 2.3)},${r(cy + ry + 2.8)} ${r(cx - 2.3)},${r(cy + ry + 2.8)}"/>`;
}
const celebrations = q(`
<path class="ln" d="M38 30.3C35 36 41 40 38 46S36 55 39 62" stroke-width="1.4"/>
<path class="ln" d="M55 39.3C58 45 52 49 55 55S54 60 52 63" stroke-width="1.4"/>
${balloon(55, 27, 8, 9.5)}
${balloon(38, 15, 10.5, 12.5)}
<path class="t-a" d="M17 29L29 55Q17 59.5 5 55Z"/>
<path class="t-b" d="M14.2 35Q17 36.3 19.8 35L21.6 39Q17 41 12.4 39Z"/>
<path class="t-b" d="M10.1 44Q17 46.5 23.9 44L25.8 48Q17 51 8.2 48Z"/>
<ellipse class="t-b" cx="17" cy="56" rx="13" ry="3.8"/>
<circle class="t-b" cx="17" cy="28" r="4.2"/>
<circle class="t-c" cx="15.6" cy="26.6" r="1.3"/>
<path class="ln" d="M4 9q3-4 6 0t6 0" stroke-width="1.8"/>
<rect class="t-b" x="20" y="5" width="3" height="5.5" rx=".8" transform="rotate(30 21.5 7.75)"/>
<circle class="t-a" cx="7" cy="19" r="2"/>
<rect class="t-a" x="24" y="19" width="3" height="5" rx=".8" transform="rotate(-25 25.5 21.5)"/>
<path class="ln" d="M5 30v5M2.5 32.5h5" stroke-width="1.6"/>
<circle class="t-b" cx="47" cy="50" r="1.6"/>
<rect class="t-a" x="58" y="46" width="3" height="5" rx=".8" transform="rotate(35 59.5 48.5)"/>
<path class="ln" d="M44 58v4M42 60h4" stroke-width="1.5"/>
`);

// ---------- myth (friendly dragon) ----------
const myth = q(`
<path class="t-b" d="M22 34C18 22 12 14 3 12C5.5 17 5 21 2.5 24.5C8 23.5 10 26.5 9 30.5C13.5 28.5 16.5 31.5 16 36Z"/>
<path class="t-a" d="M18.5 54C11 58.5 3.5 55.5 3.5 48C3.5 44.5 5 42 7.5 40.5C7.5 45 8 50.5 13 51C15 51.2 17 50.5 18.5 49.5Z"/>
<path class="t-b" d="M7.5 42C4 40 3.2 36.6 6.8 32.6C10.4 36.2 10.8 39.5 7.5 42Z"/>
<path class="t-a" d="M26 30C36 30 42 40 42 48C42 56 36 60 28 60C19 60 14 55 14 47C14 38 18 30 26 30Z"/>
<path class="t-b" d="M40.5 41C42.2 46 42.2 50.5 41 53.5C39 57.5 35 60 28 60C34.5 57 39.5 51.5 40.5 41Z"/>
<ellipse class="t-a" cx="33" cy="30" rx="7" ry="8"/>
<path class="t-b" d="M31.5 12Q29 7 25.5 5Q32 4.2 35.5 10Z"/>
<path class="t-b" d="M39.5 9.5Q41 4.5 45 2.5Q46.5 7.5 44 11Z"/>
<polygon class="t-b" points="28.6,16 23.5,16.5 28,20.5"/>
<polygon class="t-b" points="27,23 22,24.5 26.6,27.5"/>
<circle class="t-a" cx="38" cy="19" r="10"/>
<ellipse class="t-a" cx="48" cy="23" rx="9" ry="6.5"/>
<path class="t-b" d="M39.5 28Q48 31.5 56.5 25.5Q54 30 46.5 30.8Q42 31 39.5 28Z"/>
<ellipse class="t-c" cx="33.5" cy="14" rx="2.6" ry="1.5" transform="rotate(-40 33.5 14)"/>
<ellipse class="t-c" cx="31.5" cy="47" rx="7.5" ry="10" transform="rotate(-8 31.5 47)"/>
<path class="ln" d="M26 41.5q5.5 2 11 0M24.8 46.5q6.5 2 13 0M25.5 51.5q5.5 2 11 0" stroke-width="1.3"/>
<ellipse class="t-a" cx="38.5" cy="41" rx="2.8" ry="5.2" transform="rotate(32 38.5 41)"/><circle class="t-c" cx="35.8" cy="45" r=".9"/>
<ellipse class="t-b" cx="30" cy="61.6" rx="19" ry="2.2"/>
<ellipse class="t-a" cx="22" cy="58.6" rx="6" ry="3.4"/>
<ellipse class="t-a" cx="37" cy="58.8" rx="6.5" ry="3.4"/>
<circle class="t-c" cx="18.5" cy="59.2" r="1"/><circle class="t-c" cx="21.5" cy="60" r="1"/>
<circle class="t-c" cx="40.5" cy="59.4" r="1"/><circle class="t-c" cx="43.3" cy="58.4" r="1"/>
<ellipse class="t-b" cx="41.5" cy="18" rx="2.7" ry="3.3"/>
<circle class="t-c" cx="42.6" cy="16.6" r="1.1"/>
<ellipse class="t-b" cx="53.5" cy="20.2" rx="1.3" ry="1" transform="rotate(-20 53.5 20.2)"/>
<path class="ln" d="M45 26Q50 28.5 55 25.5" stroke-width="1.6"/>
<circle class="ln" cx="58.5" cy="13" r="1.6" stroke-width="1.4"/>
<circle class="ln" cx="61" cy="7" r="2.2" stroke-width="1.4"/>
`);

// ---------- history (temple) ----------
const cols = [10, 22.33, 34.67, 47].map(x => `
<rect class="t-a" x="${r(x - 1.5)}" y="28" width="10" height="3" rx="1"/>
<rect class="t-a" x="${r(x)}" y="31" width="7" height="20"/>
<rect class="t-b" x="${r(x + 4.6)}" y="31" width="2.4" height="20"/>
<rect class="t-c" x="${r(x + 1.2)}" y="32" width="1.4" height="19"/>
<rect class="t-b" x="${r(x)}" y="31" width="7" height="1"/>
<rect class="t-a" x="${r(x - 1.5)}" y="51" width="10" height="2.5" rx=".8"/>`).join('');
const dent = [13.5, 25.83, 38.17, 50.5].map(x => `<rect class="t-b" x="${r(x - 1)}" y="21.5" width="2" height="3" rx=".5"/>`).join('');
const history = q(`
<polygon class="t-a" points="32,4 61,19 3,19"/>
<polygon class="t-c" points="32,4 3,19 7.2,19 32,6.4"/>
<polygon class="t-b" points="32,8.6 51.5,17.3 12.5,17.3"/>
<circle class="t-c" cx="32" cy="13.6" r="2"/>
<rect class="t-a" x="5" y="19" width="54" height="7"/>
<rect class="t-c" x="3" y="19" width="58" height="1.6" rx=".8"/>
${dent}
<rect class="t-b" x="6" y="26" width="52" height="2"/>
${cols}
<rect class="t-a" x="4" y="53.5" width="56" height="3.8"/>
<rect class="t-c" x="4" y="53.5" width="56" height="1"/>
<rect class="t-a" x="1.5" y="57.3" width="61" height="4.5"/>
<rect class="t-c" x="1.5" y="57.3" width="61" height="1"/>
<rect class="t-b" x="1.5" y="60.8" width="61" height="1.2"/>
`);

// ---------- places (skyline + bridge) ----------
const blds = [[13, 26, 8], [21, 10, 9], [30, 22, 8], [38, 14, 9], [47, 30, 5]];
const bldRects = blds.map(([x, y, w]) => `<rect class="t-a" x="${x}" y="${y}" width="${w}" height="${44 - y}"/>`).join('');
const shade = blds.map(([x, y, w]) => `M${x + w - 2} ${y}h2v${44 - y}h-2z`).join('');
let win = '';
for (const [x, y, w] of blds) {
  const cols = w >= 8 ? [x + 1.6, x + 4.4] : [x + 1.4];
  for (let yy = y + 3; yy < 41; yy += 4.2) for (const cx of cols) win += `M${r(cx)} ${r(yy)}h1.8v2.2h-1.8z`;
}
const tower = x => `<rect class="t-b" x="${x - 2.6}" y="16.5" width="1.9" height="38" rx=".6"/><rect class="t-b" x="${x + .7}" y="16.5" width="1.9" height="38" rx=".6"/><rect class="t-b" x="${x - 3.2}" y="15.5" width="6.4" height="2.6" rx=".8"/><rect class="t-b" x="${x - 2.6}" y="27" width="5.2" height="2"/><rect class="t-b" x="${x - 2.6}" y="37" width="5.2" height="2"/>`;
const places = q(`
<polygon class="t-a" points="25.5,2 28.2,10 22.8,10"/>
<path class="t-a" d="M30 22.5A4 4 0 0 1 38 22.5Z"/>
<path class="ln" d="M42.5 14V8" stroke-width="1.6"/>
${bldRects}
<path class="t-b" d="${shade}"/>
<path class="t-c" d="${win}"/>
<path class="ln" d="M14 27.1V44M20 34.3V44M26 38.6V44M38 38.6V44M44 34.3V44M50 27.1V44" stroke-width="1.2"/>
<path class="ln" d="M0 40Q5 33 8 17Q32 63 56 17Q59 33 64 40" stroke-width="1.8"/>
${tower(8)}${tower(56)}
<rect class="t-b" x="0" y="44" width="64" height="3.4"/>
<rect class="t-c" x="0" y="44" width="64" height="1"/>
<path class="ln" d="M1 57q3.5-2.4 7 0t7 0t7 0t7 0t7 0t7 0t7 0t7 0t7 0" stroke-width="1.6"/>
<path class="ln" d="M12 62q3-2 6 0t6 0M36 62q3-2 6 0t6 0" stroke-width="1.4"/>
`);

// ---------- feelings (smiling face with hearts) ----------
const HEART = 'M0 .9C-.35 .62-1 .2-1-.3C-1-.72-.68-.98-.42-.98C-.18-.98 0-.8 0-.58C0-.8 .18-.98 .42-.98C.68-.98 1-.72 1-.3C1 .2 .35 .62 0 .9Z';
const heart = (x, y, s, rot) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
<path class="t-b" d="${HEART}" transform="translate(.09 .09)"/>
<path class="t-a" d="${HEART}"/>
<ellipse class="t-c" cx="-.52" cy="-.45" rx=".17" ry=".3" transform="rotate(35 -.52 -.45)"/></g>`;
const feelings = q(`
<circle class="t-a" cx="29" cy="37" r="21.5"/>
<path class="t-b" fill-rule="evenodd" d="M7.5 37a21.5 21.5 0 1 0 43 0a21.5 21.5 0 1 0-43 0ZM8.1 35.9a20 20 0 1 0 40 0a20 20 0 1 0-40 0Z"/>
<ellipse class="t-c" cx="18" cy="23.5" rx="5" ry="2.6" transform="rotate(-38 18 23.5)"/>
<path class="ln" d="M15.5 33.5q4.5-6 9 0M32.5 33.5q4.5-6 9 0" stroke-width="2.6"/>
<ellipse class="t-c" cx="14" cy="41" rx="3.6" ry="2.3"/>
<ellipse class="t-c" cx="42.5" cy="41" rx="3.6" ry="2.3"/>
<path class="t-b" d="M18 42Q28.5 44 39 42Q37.5 53.5 28.5 53.5Q19.5 53.5 18 42Z"/>
<path class="t-c" d="M22.8 50.2Q28.5 45.8 34.2 50.2Q31.6 53.2 28.5 53.2Q25.4 53.2 22.8 50.2Z"/>
${heart(53, 13, 8.5, 15)}
${heart(9, 11, 5.5, -15)}
${heart(57.5, 38, 4.5, 20)}
`);

// ---------- garden (potted flower) ----------
// Rotate an absolute M/C/Z path about (cx,cy) and print it at one decimal.
const rot = (d, deg, cx, cy) => {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => {
    const dx = +x - cx, dy = +y - cy;
    return `${+(cx + dx * c - dy * s).toFixed(1)} ${+(cy + dx * s + dy * c).toFixed(1)}`;
  });
};
const PETAL = 'M32 10.5C28 9 27.6 5 28.6 3.2C29.6 1.4 34.4 1.4 35.4 3.2C36.4 5 36 9 32 10.5Z';
const BACK = 'M32 9C29.5 7.5 29.2 4 30 2.6C30.8 1.2 33.2 1.2 34 2.6C34.8 4 34.5 7.5 32 9Z';
let pb = '', pa = '';
for (let k = 0; k < 8; k++) { pb += rot(BACK, 22.5 + 45 * k, 32, 16); pa += rot(PETAL, 45 * k, 32, 16); }
const petalsB = `<path class="t-b" d="${pb}"/>`, petalsA = `<path class="t-a" d="${pa}"/>`;
const garden = q(`
<path class="ln" d="M32 24Q29.5 34 32 43" stroke-width="3"/>
<path class="t-b" d="M31 39Q22 33 13 31Q20 42 31 39Z"/>
<path class="t-a" d="M31 39Q24 27 13 31Q22 33 31 39Z"/>
<path class="t-b" d="M31.5 35Q41 29 51 27Q45 38 31.5 35Z"/>
<path class="t-a" d="M31.5 35Q40 24 51 27Q41 29 31.5 35Z"/>
${petalsB}${petalsA}
<circle class="t-b" cx="32" cy="16" r="6"/>
<circle class="t-c" cx="30.2" cy="14.2" r="1.3"/>
<circle class="t-c" cx="33.8" cy="15" r=".9"/><circle class="t-c" cx="31.5" cy="18" r=".9"/>
<path class="t-a" d="M17.5 49H46.5L43 60.5Q42.6 62 41 62H23Q21.4 62 21 60.5Z"/>
<path class="t-b" d="M40 51.2H45.9L43 60.5Q42.6 62 41 62H38.5Z"/>
<path class="t-b" d="M17.5 49H46.5L45.9 51.2H18.1Z"/>
<rect class="t-a" x="15" y="42" width="34" height="7.5" rx="2"/>
<rect class="t-b" x="43" y="42" width="6" height="7.5" rx="2"/>
<rect class="t-c" x="17.5" y="43.6" width="11" height="1.8" rx=".9"/>
<path class="t-c" d="M22.5 53H25L26.3 59H24Z"/>
`);

const items = [
  { id: 'clothing', motif: 't-shirt on a hanger', svg: clothing },
  { id: 'celebrations', motif: 'balloons and a party hat', svg: celebrations },
  { id: 'myth', motif: 'friendly dragon', svg: myth },
  { id: 'history', motif: 'greek temple front', svg: history },
  { id: 'places', motif: 'city skyline with a bridge', svg: places },
  { id: 'feelings', motif: 'smiling face with hearts', svg: feelings },
  { id: 'garden', motif: 'flower in a pot', svg: garden },
];
fs.writeFileSync(new URL('./group4.json', import.meta.url), JSON.stringify(items, null, 1));
console.log('wrote', items.length);
