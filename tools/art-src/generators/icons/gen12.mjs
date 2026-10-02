// Generator for part12.json (round 2, batch 12).
import fs from 'node:fs';

const N = n => { const s = String(Math.round(n * 10) / 10); return s === '-0' ? '0' : s.replace(/^(-?)0\./, '$1.'); };
const P = (cls, d, eo) => `<path class="${cls}"${eo ? ' fill-rule="evenodd"' : ''} d="${d}"/>`;
const L = (d, w) => `<path class="ln"${w ? ` stroke-width="${w}"` : ''} d="${d}"/>`;
const circ = (cls, cx, cy, r) => `<circle class="${cls}" cx="${N(cx)}" cy="${N(cy)}" r="${N(r)}"/>`;
// clockwise subpaths
const C = (cx, cy, r) => `M${N(cx - r)} ${N(cy)}a${N(r)} ${N(r)} 0 1 1 ${N(2 * r)} 0a${N(r)} ${N(r)} 0 1 1 ${N(-2 * r)} 0Z`;
const E = (cx, cy, rx, ry, deg = 0) => {
  const a = deg * Math.PI / 180, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
  return `M${N(cx - dx)} ${N(cy - dy)}a${N(rx)} ${N(ry)} ${N(deg)} 1 1 ${N(2 * dx)} ${N(2 * dy)}a${N(rx)} ${N(ry)} ${N(deg)} 1 1 ${N(-2 * dx)} ${N(-2 * dy)}Z`;
};
const RR = (x, y, w, h, r) => r ? `M${N(x + r)} ${N(y)}H${N(x + w - r)}Q${N(x + w)} ${N(y)} ${N(x + w)} ${N(y + r)}V${N(y + h - r)}Q${N(x + w)} ${N(y + h)} ${N(x + w - r)} ${N(y + h)}H${N(x + r)}Q${N(x)} ${N(y + h)} ${N(x)} ${N(y + h - r)}V${N(y + r)}Q${N(x)} ${N(y)} ${N(x + r)} ${N(y)}Z` : `M${N(x)} ${N(y)}h${N(w)}v${N(h)}h${N(-w)}Z`;
const BAR = (x1, y1, x2, y2, w) => {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = dy / l * w / 2, ny = -dx / l * w / 2;
  return `M${N(x1 + nx)} ${N(y1 + ny)}L${N(x2 + nx)} ${N(y2 + ny)}L${N(x2 - nx)} ${N(y2 - ny)}L${N(x1 - nx)} ${N(y1 - ny)}Z`;
};
const SP = (x, y, s) => `M${N(x)} ${N(y - s)}Q${N(x)} ${N(y)} ${N(x + s)} ${N(y)}Q${N(x)} ${N(y)} ${N(x)} ${N(y + s)}Q${N(x)} ${N(y)} ${N(x - s)} ${N(y)}Q${N(x)} ${N(y)} ${N(x)} ${N(y - s)}Z`;
// disk (cx,cy,r) minus disk (cx+ox, cy+oy, r2): a crescent
const CRES = (cx, cy, r, ox, oy, r2 = r) => {
  const d = Math.hypot(ox, oy), ux = ox / d, uy = oy / d;
  const a = (r * r - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(r * r - a * a);
  const px = cx + a * ux, py = cy + a * uy;
  const A = [px - h * uy, py + h * ux], B = [px + h * uy, py - h * ux];
  const arc = (c, rr, from, to, away) => {
    const t0 = Math.atan2(from[1] - c[1], from[0] - c[0]), t1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
    const TAU = Math.PI * 2, m = x => ((x % TAU) + TAU) % TAU;
    const delta = m(t1 - t0), inside = m(away - t0) < delta;
    const len = inside ? delta : TAU - delta;
    return `A${N(rr)} ${N(rr)} 0 ${len > Math.PI ? 1 : 0} ${inside ? 1 : 0} ${N(to[0])} ${N(to[1])}`;
  };
  const awayAng = Math.atan2(-oy, -ox);
  return `M${N(A[0])} ${N(A[1])}` + arc([cx, cy], r, A, B, awayAng) + arc([cx + ox, cy + oy], r2, B, A, awayAng) + 'Z';
};
const G = (t, s) => `<g transform="${t}">${s}</g>`;

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- magnifying-glass
{
  const cx = 25, cy = 25;
  let s = G(`translate(${cx} ${cy}) rotate(45)`,
    `<rect class="t-a" x="22" y="-5.5" width="23" height="11" rx="5.5"/>` +
    P('t-b', 'M22.2 1.5H44.8A5.5 5.5 0 0 1 39.5 5.5H27.5A5.5 5.5 0 0 1 22.2 1.5Z') +
    `<rect class="t-c" x="26" y="-3.6" width="12" height="2" rx="1"/>` +
    `<rect class="t-b" x="17" y="-4.5" width="7" height="9" rx="1.5"/>`);
  s += P('t-a', C(cx, cy, 19) + C(cx, cy, 14.5), true);
  s += P('t-b', CRES(cx, cy, 19, -2.6, -2.6));
  s += P('t-c', C(cx, cy, 14.5));
  s += P('t-a', CRES(cx, cy, 11, 2, 2) + C(cx + 6.5, cy - 7.5, 1.5));
  s += P('t-c', SP(54, 11, 5) + SP(9, 54, 3.5));
  s += circ('t-c', 44, 4, 1.3) + circ('t-c', 4, 42, 1.2);
  add('magnifying-glass', 'round magnifying glass with a handle', s);
}

// ---------- wheat-sheaf
{
  const head = () => {
    let d = 'M32 7Q34.8 7.5 34.8 10.5';
    for (let i = 0; i < 4; i++) d += 'q3.4 -.6 0 3.6';
    d += 'Q34.8 26.5 32 28Q29.2 27.4 29.2 26.3';
    for (let i = 0; i < 4; i++) d += 'q-3.4 -4.2 0 -3.6';
    d += 'Q29.2 7.5 32 7ZM31.1 27h1.8v19h-1.8Z';
    return P('t-a', d) + L('M32 7V1M30.6 8.5L28 3M33.4 8.5L36 3', 1);
  };
  let s = '';
  for (const a of [-36, 36, -18, 18, 0]) s += G(`rotate(${a} 32 50)`, head());
  s += P('t-a', 'M27 47L21 60Q21 61 22 61H42Q43 61 43 60L37 47Z');
  s += L('M29.5 48.5L25.5 60M32 48.5V60M34.5 48.5L38.5 60', 1.4);
  s += P('t-b', RR(24.5, 42, 15, 5.5, 2) + E(27.6, 42, 3.4, 1.9, -25) + E(36.4, 42, 3.4, 1.9, 25));
  s += circ('t-c', 32, 44.7, 1.6);
  add('wheat-sheaf', 'tied sheaf of wheat', s);
}

// ---------- hard-hat
{
  let s = '';
  s += P('t-b', 'M3 46.5C3 42 6.5 40.5 9.3 40.3L9.4 45H54.6L54.7 40.3C57.5 40.5 61 42 61 46.5C61 50.5 48 53 32 53C16 53 3 50.5 3 46.5Z');
  s += P('t-a', 'M9.4 45C9 24 19 12 32 12C45 12 55 24 54.6 45Z');
  s += P('t-b', 'M44 15C51 20 55.2 30 54.6 45H48.5C48.5 31 47 22 44 15Z');
  s += P('t-c', 'M27.8 45V15.5Q28 12.4 32 12.2Q36 12.4 36.2 15.5V45Z');
  s += P('t-c', 'M14 36Q14.5 24 22.5 17.5Q18 25 17.5 36Z');
  s += L('M27.8 45V16M36.2 45V16', 1.4);
  add('hard-hat', 'yellow construction hard hat', s);
}

// ---------- rainbow
{
  const band = (R, r) => `M${32 - R} 47A${R} ${R} 0 0 1 ${32 + R} 47H${32 + r}A${r} ${r} 0 0 0 ${32 - r} 47Z`;
  const cloud = (cx, cy) => `M${cx - 11} ${cy + 6}a5 5 0 0 1 1 -9.5a7 7 0 0 1 13 -2a5.5 5.5 0 0 1 7 7a4 4 0 0 1 -2 4.5Z`;
  const under = (cx, cy) => `M${cx - 10.8} ${cy + 3}Q${cx} ${cy + 5} ${cx + 9.6} ${cy + 3}Q${cx + 9.4} ${cy + 5.2} ${cx + 8} ${cy + 6}H${cx - 11}Z`;
  let s = '';
  s += P('t-b', band(28, 23.5));
  s += P('t-a', band(23.5, 19));
  s += P('t-c', band(19, 14.5));
  s += P('t-a', band(14.5, 11));
  s += P('t-c', cloud(13, 49) + cloud(51, 49));
  s += P('t-a', under(13, 49) + under(51, 49));
  s += P('t-c', SP(10, 12, 4.5) + SP(55, 8, 3.5));
  s += circ('t-c', 20, 5, 1.2) + circ('t-c', 59, 22, 1.2);
  add('rainbow', 'arched rainbow between two clouds', s);
}

// ---------- bicycle
{
  const wheel = (x, y) => P('t-b', C(x, y, 12.5) + C(x, y, 10), true) + P('t-a', C(x, y, 10) + C(x, y, 8.8), true) +
    L(`M${x - 8.8} ${y}H${x + 8.8}M${x} ${y - 8.8}V${y + 8.8}M${x - 6.2} ${y - 6.2}L${x + 6.2} ${y + 6.2}M${x - 6.2} ${y + 6.2}L${x + 6.2} ${y - 6.2}`, 1) +
    circ('t-c', x, y, 2.2);
  let s = wheel(14, 46) + wheel(50, 46);
  s += P('t-a', BAR(29, 46, 23.5, 25, 3) + BAR(23.5, 28, 45, 27, 3) + BAR(29, 46, 45.5, 30, 3.2) + BAR(14, 46, 29, 46, 2.6) + BAR(14, 46, 24, 28.5, 2.6) + BAR(44.5, 24, 50, 46, 2.8));
  s += P('t-c', BAR(26, 26.8, 42.5, 26.1, 1));
  s += P('t-b', BAR(23.5, 25, 22.8, 21.5, 2.2) + 'M17 20.5Q17 18.6 20 18.6H28Q29.8 19 28.6 21Q26 22.6 22 22.6Q17 22.6 17 20.5Z');
  s += P('t-b', BAR(44.5, 24, 43.5, 18.5, 2.4) + RR(38, 16.3, 11, 3, 1.5));
  s += P('t-b', C(29, 46, 4.6) + BAR(29, 46, 32.5, 52, 2.2) + RR(30, 51, 6, 2.4, 1.2));
  s += circ('t-c', 29, 46, 1.6);
  add('bicycle', 'bicycle side view', s);
}

// ---------- volcano
{
  const lava = 'M25.5 22H38.5Q39.5 25.5 37.6 27Q36 28.5 36.4 32Q36.8 35.6 34.6 35.6Q32.4 35.6 32.8 32Q33.2 29 31 29.4Q28.9 29.8 29.3 35.5Q29.7 40.5 27.1 40.5Q24.5 40.5 25 35Q25.5 28 25.5 22Z';
  const jet = a => G(`rotate(${a} 32 22)`, P('t-c', 'M30.8 20L30 11.5A2.6 2.6 0 0 1 34 11.5L33.2 20Z'));
  let s = '';
  s += P('t-b', C(20, 9, 4.5) + C(27.5, 5.5, 5) + C(36.5, 5.5, 5) + C(44, 9, 4.5) + RR(20, 6, 24, 7.5, 3.7));
  s += P('t-a', 'M3 60L20 26Q22 22 26 22H38Q42 22 44 26L61 60Z' + lava, true);
  s += P('t-b', 'M39 22.4Q42.4 23.3 44 26L61 60H47C45 46 43 33 39 22.4Z');
  s += P('t-c', lava);
  s += jet(-32) + jet(0) + jet(32);
  s += P('t-c', C(15, 20.5, 1.8) + C(49, 20.5, 1.8) + C(10.5, 29, 1.3) + C(53.5, 29, 1.3));
  s += P('t-b', 'M8 21l3 -1.5 1 3 -3 1ZM53 15l2.5 -2 1.5 2.6 -2.6 1.5Z');
  add('volcano', 'erupting volcano with lava', s);
}

// ---------- mouth
{
  const outer = 'M5 25C10 24 16 20.5 22.5 20.5C27 20.5 30 22.5 32 24C34 22.5 37 20.5 41.5 20.5C48 20.5 54 24 59 25C56 42 45 53 32 53C19 53 8 42 5 25Z';
  const open = 'M10.5 27.5C18 31.5 46 31.5 53.5 27.5C50 40 42 46.5 32 46.5C22 46.5 14 40 10.5 27.5Z';
  const teeth = 'M12.8 29.2C21 32.6 43 32.6 51.2 29.2L50 32.6C42 36 22 36 14 32.6Z';
  const tongue = 'M21.5 42.3C23 37.3 28 36.8 32 38.8C36 36.8 41 37.3 42.5 42.3C39.5 45 36 46.4 32 46.4C28 46.4 24.5 45 21.5 42.3Z';
  const glint = E(39, 48.6, 4, 1.2, -10) + E(19.5, 23.3, 3, 1, -12);
  let s = P('t-a', outer + open + glint, true);
  s += P('t-b', open + teeth + tongue, true);
  s += P('t-c', teeth + glint);
  s += P('t-a', tongue);
  s += P('t-c', E(27, 40.5, 2.2, 1.1, -15));
  s += L('M32 39.8V43.5', 1.4) + L('M3.5 22.5Q2.5 24.8 4 27M60.5 22.5Q61.5 24.8 60 27', 1.8);
  s += P('t-b', 'M59 25C57.5 34 53.5 42 47.5 47.5C52 43 55 36 56.5 26.2Z');
  add('mouth', 'smiling lips with a tongue', s);
}

// ---------- chandelier
{
  let s = '';
  s += P('t-b', 'M25 1H39Q39 4.5 32 4.5Q25 4.5 25 1Z');
  s += L('M32 4V11', 1.6);
  s += L('M23 38C13 45 6.5 42 7.5 31M41 38C51 45 57.5 42 56.5 31M26 41C20 46 17 41 18.5 33M38 41C44 46 47 41 45.5 33', 2.6);
  s += P('t-a', C(32, 13.5, 2.8) + RR(30.4, 15, 3.2, 20, 1) + C(32, 24, 3) + 'M20 35.5Q20 33.5 22 33.5H42Q44 33.5 44 35.5Q43 43.5 32 46Q21 43.5 20 35.5Z' + 'M29.5 45.5H34.5L32 52Z');
  s += P('t-b', 'M43.6 35.8Q43 43.5 32 46Q39.5 42 40.8 35.8Z');
  s += P('t-c', RR(22.5, 34.8, 19, 2, 1));
  const cand = (x, y) => RR(x - 1.7, y - 8, 3.4, 8, .8);
  const cup = (x, y) => `M${x - 4} ${y}H${x + 4}Q${x + 3} ${y + 3} ${x} ${y + 3}Q${x - 3} ${y + 3} ${x - 4} ${y}Z`;
  const flame = (x, y) => `M${x} ${y - 6.5}Q${x + 3} ${y - 2.5} ${x + 2} ${y - .8}Q${x} ${y + 1} ${x - 2} ${y - .8}Q${x - 3} ${y - 2.5} ${x} ${y - 6.5}Z`;
  const cs = [[7.5, 30], [18.5, 32], [45.5, 32], [56.5, 30]];
  s += P('t-c', cs.map(([x, y]) => cand(x, y)).join(''));
  s += P('t-a', cs.map(([x, y]) => cup(x, y)).join(''));
  s += P('t-a', cs.map(([x, y]) => flame(x, y - 10)).join(''));
  s += L('M11 42V47M21.5 44.5V49M42.5 44.5V49M53 42V47', 1);
  const gem = (x, y) => `M${x} ${y}l2 3.5l-2 3.5l-2 -3.5Z`;
  s += P('t-c', gem(11, 46) + gem(21.5, 48) + gem(42.5, 48) + gem(53, 46) + gem(32, 53));
  add('chandelier', 'crystal chandelier', s);
}

// ---------- knight-helmet
{
  let s = '';
  s += P('t-c', 'M31 11C27 5 30 1 36 1.5C44 2 51 6 57 14C52 11 47 10.5 43.5 12C48 13.5 52 17 54 22C49 18 43.5 16 37 16Z');
  s += L('M34 12C38 6 45 5 51 8M37 14.5C42 11 48 12 51.5 15', 1.3);
  s += P('t-a', 'M14 55V33C14 18 22 10.5 32 10.5C42 10.5 50 18 50 33V55Z' + RR(18, 26, 12, 4.5, 2.2) + RR(34, 26, 12, 4.5, 2.2), true);
  s += P('t-b', 'M43 14.2C47.8 18.5 50 25 50 33V55H46.8V33C46.8 25 45.5 19 43 14.2Z');
  s += P('t-b', RR(18, 26, 12, 4.5, 2.2) + RR(34, 26, 12, 4.5, 2.2));
  s += P('t-c', 'M30.8 11.2Q32 10.6 33.2 11.2V56H30.8Z');
  s += P('t-c', 'M17.8 23.5Q18.5 16.5 24.5 13Q20.8 17.5 20.4 23.5Z');
  const holes = []; for (const y of [37, 41.5, 46]) for (const x of [23.5, 27, 37, 40.5]) holes.push(C(x, y, 1.1));
  s += P('t-b', holes.join('') + C(17, 20.5, 1.2) + C(47, 20.5, 1.2));
  s += P('t-b', 'M10 61Q10 55 16 54H48Q54 55 54 61Q54 62 53 62H11Q10 62 10 61Z');
  s += P('t-a', RR(12, 56.5, 40, 2.2, 1.1));
  s += P('t-b', RR(29.5, 8, 5, 4, 1));
  add('knight-helmet', "plumed knight's helmet with visor", s);
}

// ---------- drum-kit
{
  let s = '';
  // stands
  s += L('M8 17V52M4 60L8 52L12 60M55 16.5L55 38M52 60L55 54L58 60', 1.4);
  // cymbals
  s += P('t-a', E(8, 16.2, 7, 1.5) + E(8, 19.3, 7, 1.5) + E(54, 15, 9, 2, -12));
  s += P('t-b', E(8, 15.5, 2, 1) + E(54, 14.5, 2.4, 1.1, -12));
  // rack toms
  const tom = (x, y, a) => G(`rotate(${a} ${x} ${y})`, P('t-a', RR(x - 6, y, 12, 9, 1.5)) + P('t-b', RR(x - 6, y + 6.5, 12, 2.5, 1)) + P('t-c', E(x, y, 6, 2)));
  s += tom(22.5, 21, -10) + tom(41.5, 21, 10);
  // snare
  s += P('t-a', RR(2, 39, 14, 7, 1.5)) + P('t-b', RR(2, 43.5, 14, 2.5, 1)) + P('t-c', E(9, 39, 7, 2));
  s += L('M5 46.5L3 60M13 46.5L15 60', 1.4);
  // floor tom
  s += P('t-a', RR(48, 38, 14, 13, 1.5)) + P('t-b', RR(48, 48, 14, 3, 1)) + P('t-c', E(55, 38, 7, 2));
  s += L('M50 51L49 60M60 51L61 60', 1.4);
  // bass drum
  s += P('t-b', C(32, 46, 15) + C(32, 46, 12.5), true);
  s += P('t-c', C(32, 46, 12.5) + C(32, 46, 6.5) + C(32, 46, 4.5), true);
  s += P('t-a', C(32, 46, 6.5) + C(32, 46, 4.5), true);
  s += L('M22 58L19 61.5M42 58L45 61.5', 2);
  s += P('t-b', C(17.6, 46, 1.2) + C(46.4, 46, 1.2) + C(32, 31.6, 1.2));
  add('drum-kit', 'full drum kit with cymbals and hi-hat', s);
}

// ---------- lion
{
  const mane = (cx, cy, R, n, r) => {
    let d = '';
    for (let i = 0; i <= n; i++) {
      const t = -Math.PI / 2 + i * 2 * Math.PI / n, x = cx + R * Math.cos(t), y = cy + R * Math.sin(t);
      d += i ? `A${r} ${r} 0 0 1 ${N(x)} ${N(y)}` : `M${N(x)} ${N(y)}`;
    }
    return d + 'Z';
  };
  const face = E(32, 35, 15.5, 14.5);
  const muz = 'M32 38.7A5.2 5.2 0 1 1 33.8 46.7Q32 48.8 30.2 46.7A5.2 5.2 0 1 1 32 38.7Z';
  const muzCCW = 'M32 38.7A5.2 5.2 0 1 0 30.2 46.7Q32 48.8 33.8 46.7A5.2 5.2 0 1 0 32 38.7Z';
  let s = '';
  s += P('t-b', mane(32, 33, 23.5, 14, 6) + face, true);
  s += P('t-a', face + C(20.5, 21, 5) + C(43.5, 21, 5) + muzCCW);
  s += P('t-b', C(20.5, 21, 2.4) + C(43.5, 21, 2.4));
  s += P('t-c', muz);
  s += P('t-b', E(25.5, 31, 2.2, 2.8) + E(38.5, 31, 2.2, 2.8));
  s += P('t-c', C(26.2, 30, .8) + C(39.2, 30, .8));
  s += P('t-b', 'M27.5 36.5Q32 34.8 36.5 36.5Q35 40.3 32 40.8Q29 40.3 27.5 36.5Z');
  s += L('M32 40.5V43M28 45Q30.5 46.2 32 43Q33.5 46.2 36 45', 1.5);
  s += L('M22.5 26Q25.5 24.5 28.5 26M35.5 26Q38.5 24.5 41.5 26', 1.5);
  s += P('t-b', C(26, 42.2, .7) + C(24.8, 44.4, .7) + C(38, 42.2, .7) + C(39.2, 44.4, .7));
  add('lion', 'lion with a full mane', s);
}

// ---------- saw
{
  const y = x => 1 + (x + 30) / 36 * 6;
  let teeth = `M6 ${N(y(6))}`;
  for (let x = 6; x > -30; x -= 3) teeth += `L${N(x - 1.5)} ${N(y(x - 1.5) + 2)}L${N(x - 3)} ${N(y(x - 3))}`;
  teeth += 'Z';
  let saw = '';
  saw += P('t-b', teeth);
  saw += P('t-c', `M-30 -5H6V${N(y(6))}L-30 ${N(y(-30))}Z` + C(-25.5, -1.8, 1.4), true);
  saw += P('t-b', 'M-30 -5H6V-3.4H-30Z');
  saw += P('t-a', 'M2.5 -8H12C18.5 -8 22 -3 22 3C22 9 18 13.5 13 13.5H2.5Z' + E(12.8, 3, 3.2, 5.3, 20), true);
  saw += P('t-b', 'M22 3C22 9 18 13.5 13 13.5H10C15 13 18.5 9 19 3Z');
  saw += P('t-c', C(5.5, -3.5, 1.1) + C(5.5, 4.5, 1.1));
  let s = G('translate(36 20) rotate(-30)', saw);
  // plane
  s += P('t-a', 'M27 55V50.5Q27 47.5 30 47.5H57Q60 47.5 60 50.5V55Z');
  s += P('t-b', RR(26, 54, 35, 4.5, 1.5));
  s += P('t-c', BAR(38.5, 51, 43.5, 38.5, 3.4));
  s += P('t-b', BAR(40.5, 48, 44, 41, 3.6));
  s += P('t-b', 'M47.5 48C46.5 41 48.5 36.5 53 35.8C57.5 35.3 60 38.8 58.3 43L56.5 48Z' + E(53, 41.2, 1.6, 2.8, 25), true);
  s += P('t-c', RR(29, 49.5, 8, 1.4, .7));
  // shavings
  s += L('M37 47.5C35.5 41 30 38.5 27.5 41.5C25.5 44 28.5 46.5 30.5 44.5', 1.8);
  s += L('M5 59C5 55 11 54.5 11 58C11 60 8 60 8 58M13 61C14 58 19 58 19 60.5', 1.6);
  add('saw', 'hand saw and a hand plane with wood shavings', s);
}

// ---------- teddy-bear
{
  const Cc = (cx, cy, r) => `M${N(cx - r)} ${N(cy)}a${N(r)} ${N(r)} 0 1 0 ${N(2 * r)} 0a${N(r)} ${N(r)} 0 1 0 ${N(-2 * r)} 0Z`;
  const Ec = (cx, cy, rx, ry) => `M${N(cx - rx)} ${N(cy)}a${N(rx)} ${N(ry)} 0 1 0 ${N(2 * rx)} 0a${N(rx)} ${N(ry)} 0 1 0 ${N(-2 * rx)} 0Z`;
  const pads = [[18, 12.5, 3.2, 3.2], [46, 12.5, 3.2, 3.2], [32, 27.5, 7, 5.2], [32, 47, 7, 7.2], [17.5, 56.5, 3.4, 3.8], [46.5, 56.5, 3.4, 3.8]];
  let s = '';
  s += P('t-a', C(18, 12.5, 6.5) + C(46, 12.5, 6.5) + C(32, 23, 14) + E(32, 45.5, 13, 13) + E(16, 40.5, 5, 9, 35) + E(48, 40.5, 5, 9, -35) + E(19, 56, 7.5, 6.5) + E(45, 56, 7.5, 6.5) +
    pads.map(p => Ec(...p)).join(''));
  s += P('t-c', pads.map(p => E(...p)).join(''));
  s += P('t-b', CRES(32, 23, 14, -2.2, -1.6) + CRES(32, 45.5, 13, -2.2, -1.2));
  s += P('t-b', E(32, 24.8, 3.2, 2.2) + C(26, 19, 2.1) + C(38, 19, 2.1));
  s += P('t-c', C(26.7, 18.3, .7) + C(38.7, 18.3, .7));
  s += L('M32 26.8V29.5M28.8 29.5Q32 32 35.2 29.5', 1.5);
  s += P('t-b', 'M32 37L25 33.5Q24 33.3 24 34.3V39.7Q24 40.7 25 40.5L32 37L39 40.5Q40 40.7 40 39.7V34.3Q40 33.3 39 33.5Z' + C(32, 37, 2));
  add('teddy-bear', 'cuddly teddy bear', s);
}

// ---------- fireplace
{
  const arch = 'M17 58V39Q17 30 26 30H38Q47 30 47 39V58Z';
  const outer = 'M21 53C19 47 22 43 25 39C25 43 27 45 28.5 44C27.5 39 30 35 33 31.5C33.5 36 36 38 37.5 41C38.5 39.5 39.5 38.5 40.5 36.5C43.5 41 45 47 43 53Z';
  const inner = 'M25.5 53C25 49 27 46 29 44C29 47 31 48 32 46C32 43 33.5 41 34.5 39C36.5 43 38.5 47 37.5 53Z';
  let s = '';
  s += P('t-a', RR(7, 18, 50, 40, 0) + arch, true);
  s += L('M7 24.5H57M7 31.5H17M47 31.5H57M7 38.5H17M47 38.5H57M7 45.5H17M47 45.5H57M7 52H17M47 52H57M12 18V24.5M22 18V24.5M32 18V24.5M42 18V24.5M52 18V24.5M17 24.5V29M27 24.5V30M37 24.5V30M47 24.5V29M12 31.5V38.5M52 31.5V38.5M12 45.5V52M52 45.5V52M14.5 38.5V45.5M49.5 38.5V45.5M14.5 24.5V31.5M49.5 24.5V31.5', 1.3);
  s += P('t-b', arch + outer, true);
  s += P('t-a', outer + inner, true);
  s += P('t-c', inner);
  s += P('t-a', BAR(19, 57, 40, 52, 4.2) + BAR(24, 52, 45, 57, 4.2));
  s += P('t-c', C(19.3, 57, 1.5) + C(44.7, 57, 1.5));
  s += P('t-b', RR(3, 13, 58, 5.5, 1.5) + RR(2, 57.5, 60, 5, 1.5));
  s += P('t-c', RR(9, 7, 3, 6, .6) + RR(52, 7, 3, 6, .6));
  s += P('t-a', 'M10.5 2Q12.5 4.5 10.5 6Q8.5 4.5 10.5 2ZM53.5 2Q55.5 4.5 53.5 6Q51.5 4.5 53.5 2Z');
  s += P('t-c', RR(5, 14.2, 20, 1.4, .7));
  add('fireplace', 'hearth with a crackling fire', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part12.json', import.meta.url), JSON.stringify(icons, null, 1));
for (const i of icons) if (i.svg.length > 2500) console.log('LONG', i.id, i.svg.length);
