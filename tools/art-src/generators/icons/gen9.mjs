// Generates part9.json (round 2, batch 9).
import fs from 'node:fs';
const n = v => +(+v).toFixed(2);
const P = (cls, d, extra = '') => `<path class="${cls}"${extra} d="${d}"/>`;
// circle subpath; cw=true clockwise on screen (sweep 1), false = counter-clockwise (hole under nonzero)
const circ = (cx, cy, r, cw = true) => { const s = cw ? 1 : 0;
  return `M${n(cx - r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 ${s} ${n(cx + r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 ${s} ${n(cx - r)} ${n(cy)}Z`; };
// rotated ellipse subpath (rot degrees)
const ell = (cx, cy, rx, ry, rot = 0, cw = true) => { const a = rot * Math.PI / 180, s = cw ? 1 : 0;
  const x1 = cx - rx * Math.cos(a), y1 = cy - rx * Math.sin(a), x2 = cx + rx * Math.cos(a), y2 = cy + rx * Math.sin(a);
  return `M${n(x1)} ${n(y1)}A${n(rx)} ${n(ry)} ${n(rot)} 1 ${s} ${n(x2)} ${n(y2)}A${n(rx)} ${n(ry)} ${n(rot)} 1 ${s} ${n(x1)} ${n(y1)}Z`; };
const spark = (x, y, r) => { const k = n(r * 0.16);
  return `M${n(x)} ${n(y - r)}Q${n(x + k)} ${n(y - k)} ${n(x + r)} ${n(y)}Q${n(x + k)} ${n(y + k)} ${n(x)} ${n(y + r)}Q${n(x - k)} ${n(y + k)} ${n(x - r)} ${n(y)}Q${n(x - k)} ${n(y - k)} ${n(x)} ${n(y - r)}Z`; };
const pt = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
const star = (cx, cy, R, r, rot = -90, k = 5) => { const pts = [];
  for (let i = 0; i < 2 * k; i++) pts.push(pt(cx, cy, i % 2 ? r : R, rot + i * 180 / k));
  return pts; };
const poly = pts => 'M' + pts.map(p => `${n(p[0])} ${n(p[1])}`).join('L') + 'Z';

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------------------------------------------------------------- scissors
{
  const blade = 'M-2 -4C8 -4.6 19 -3.2 29.5 0C19 1.3 8 2 -2 2.6Z';
  const bev = 'M-1 .6C8 .6 19 .4 29.5 0C19 1.3 8 2 -1 2.6Z';
  const arm = 'M-1.5 -3.4L-13 -3.4Q-14.5 -3.4 -14.5 -1.9V1.9Q-14.5 3.4 -13 3.4H-1.5Z';
  const ring = `${ell(-21.5, 0, 8.2, 6.8, 0, true)}${ell(-21.5, 0, 4.6, 3.4, 0, false)}`;
  const ringSh = 'M-13.5 2.4A8.2 6.8 0 0 1 -29.2 3.6A5.5 3.5 0 0 0 -16.8 2.4Z';
  const piece = t => `<g transform="${t}">${P('t-c', blade)}${P('t-b', bev)}${P('t-a', arm)}${P('t-a', ring)}${P('t-b', ringSh)}</g>`;
  const sc = `<g transform="translate(30 32) rotate(-45) scale(1.08)">${piece('rotate(19) scale(1 -1)')}${piece('rotate(-19)')}<circle class="t-b" cx="0" cy="0" r="3"/><circle class="t-c" cx="-.6" cy="-.6" r="1.1"/></g>`;
  // paper scraps
  const scrap1 = P('t-a', 'M4 9.5L18.5 4.5L22.5 15L20.2 14.4L18.8 17.2L16.6 15.8L14.8 18.8L12.8 17L10.6 19.8L9 17.6Z');
  const scrap1b = P('t-b', 'M4 9.5L6.2 8.7L11.5 18.6L10.6 19.8L9 17.6Z');
  const scrap2 = P('t-c', 'M17 25.5L26.5 21L25.5 30.5Z');
  const scrap3 = P('t-c', 'M35.5 49L43.5 46.5L45.5 54.5L37 57Z');
  const scrap3b = P('t-b', 'M37 57L45.5 54.5L46 56.4L37.6 59.2Z');
  // glue stick
  const glue = [
    P('t-c', 'M48 34.5V31.5Q53 27 58 31.5V34.5Z'),
    `<rect class="t-b" x="46" y="33.5" width="14" height="4.5" rx="1.5"/>`,
    P('t-a', 'M47 38H59V58.5Q59 61 56.5 61H49.5Q47 61 47 58.5ZM48.8 41V52.5H50.8V41Z'),
    `<rect class="t-c" x="48.8" y="41" width="2" height="11.5" rx="1"/>`,
    `<rect class="t-b" x="55.5" y="38" width="3.5" height="23"/>`,
    `<rect class="t-b" x="47" y="54" width="12" height="2.2"/>`,
  ].join('');
  add('scissors', 'craft scissors with a glue stick and paper scraps', scrap1 + scrap1b + scrap2 + scrap3 + scrap3b + glue + sc);
}

// ---------------------------------------------------------------- open-book
{
  const out = [];
  out.push(P('t-b', 'M32 30Q18 24 2 28V58Q17 55 32 61Q47 55 62 58V28Q46 24 32 30Z'));
  out.push(P('t-c', 'M32 28Q19 22 5 25.5V55Q18 52 32 58.5Q46 52 59 55V25.5Q45 22 32 28Z'));
  // flat pages
  out.push(P('t-a', 'M32 28Q19 22 5 25.5V52.5Q18 49.5 32 56Z'));
  out.push(P('t-a', 'M32 28Q45 22 59 25.5V52.5Q46 49.5 32 56Z'));
  out.push(P('ln', 'M9.5 33Q15 31.8 21 32.6M9.5 38.5Q15 37.3 21 38.1M9.5 44Q15 42.8 23 44', ' stroke-width="1.5"'));
  out.push(P('t-b', 'M32 28Q30 26.8 28 26V54.2Q30 55 32 56Z'));
  // fanning pages, lowest first: [outer top x,y, outer bottom x,y, curvature]
  const pages = [[55, 22, 53, 48], [47, 14, 45, 42], [24, 12, 25, 40]];
  for (const [tx, ty, bx, by] of pages) {
    const dx = tx - 32, sg = Math.sign(dx);
    const top = `M32 28C${n(32 + dx * .25)} ${n(28 - (28 - ty) * .75)} ${n(32 + dx * .65)} ${n(ty)} ${n(tx)} ${n(ty)}`;
    const bot = `C${n(32 + (bx - 32) * .6)} ${n(by + 1)} ${n(32 + (bx - 32) * .2)} ${n(by + (56 - by) * .5)} 32 56Z`;
    out.push(P('t-b', `${top}L${n(tx + 2.2 * sg)} ${n(ty + 1.5)}L${n(bx + 2.2 * sg)} ${n(by + 1.5)}L${n(bx)} ${n(by)}${bot}`));
    out.push(P('t-c', `${top}L${n(bx)} ${n(by)}${bot}`));
  }
  out.push(`<path class="t-c" d="${spark(56, 9, 4.5)}${spark(8, 12, 3.2)}"/>`);
  add('open-book', 'open book with pages fanning up', out.join(''));
}

// ---------------------------------------------------------------- flask
{
  const out = [];
  out.push(`<path class="t-a" d="${circ(29.5, 6.5, 3.2)}${circ(37.5, 3.2, 2)}${circ(24, 1.8, 1.4)}"/>`);
  out.push(P('t-b', 'M23 12H41Q43 12 43 14V16Q43 18 41 18H39.5V30L56.5 52Q61 61 51 61H13Q3 61 7.5 52L24.5 30V18H23Q21 18 21 16V14Q21 12 23 12Z'));
  out.push(P('t-c', 'M27 18H37V31L53.8 52.8Q56.5 58.5 50.5 58.5H13.5Q7.5 58.5 10.2 52.8L27 31Z'));
  const bub = [[21.5, 50.5, 2.6], [31, 53.5, 1.6], [37.5, 47, 2.1], [27, 45.5, 1.2]];
  out.push(`<path class="t-a" fill-rule="evenodd" d="M20.06 40Q26 37 32 40Q38 43 43.94 40L53.8 52.8Q56.5 58.5 50.5 58.5H13.5Q7.5 58.5 10.2 52.8Z${bub.map(b => circ(...b)).join('')}"/>`);
  out.push(`<path class="t-c" d="${bub.map(b => circ(...b)).join('')}"/>`);
  out.push(P('t-b', 'M43.94 40L53.8 52.8Q56.5 58.5 50.5 58.5H45.5Q50.8 57.2 49 52.6L41.6 41.3Q42.8 40.9 43.94 40Z'));
  out.push(P('ln', 'M33.5 22.5H37M33.5 27H37M17.5 36.2H22', ' stroke-width="1.6"'));
  out.push(`<circle class="t-c" cx="28" cy="5.6" r="1"/>`);
  out.push(`<path class="t-c" d="${spark(53, 14, 4)}${spark(9, 28, 3)}"/>`);
  add('flask', 'bubbling conical lab flask', out.join(''));
}

// ---------------------------------------------------------------- house
{
  const out = [];
  out.push(`<path class="t-c" d="${circ(47, 11, 2.3)}${circ(51, 6.8, 2.9)}${circ(57, 4.6, 3.3)}"/>`);
  out.push(`<rect class="t-a" x="42" y="14" width="7.5" height="16"/>`);
  out.push(`<rect class="t-b" x="40.8" y="11.8" width="10" height="3.6" rx="1"/>`);
  // walls with window + door holes
  const win = 'M34 38.5H49V51.5H34Z';
  out.push(`<path class="t-a" fill-rule="evenodd" d="M10 30H54V59H10Z${win}"/>`);
  out.push(`<rect class="t-b" x="50" y="30" width="4" height="29"/>`);
  out.push(`<path class="t-c" d="${win}"/>`);
  out.push(P('t-b', 'M34 44.2H49V45.8H34ZM40.7 38.5H42.3V51.5H40.7Z'));
  out.push(P('t-b', 'M32.5 36.8H50.5V38.5H32.5ZM32 51.5H51Q52 51.5 52 52.5V53.2Q52 54.2 51 54.2H32Q31 54.2 31 53.2V52.5Q31 51.5 32 51.5Z'));
  // roof
  out.push(`<path class="t-b" fill-rule="evenodd" d="M3.8 32.2L30 8.2Q32 6.4 34 8.2L60.2 32.2Q62.3 34.8 59 34.8H5Q1.7 34.8 3.8 32.2ZM26.8 23.8a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0 -10.4 0Z"/>`);
  out.push(`<path class="t-c" d="M26.8 23.8a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0 -10.4 0Z"/>`);
  out.push(P('ln', 'M26.8 23.8H37.2M32 18.6V29', ' stroke-width="1.5"'));
  out.push(P('t-c', 'M8.5 30.2L29 11.4L30.4 12.9L10.3 31.3Z'));
  // door
  out.push(P('t-b', 'M15.5 59V46.5A5.5 5.5 0 0 1 26.5 46.5V59Z'));
  out.push(`<circle class="t-c" cx="23.6" cy="52.5" r="1.1"/>`);
  // ground + bush
  out.push(`<rect class="t-b" x="2" y="58" width="60" height="4" rx="2"/>`);
  out.push(`<path class="t-a" d="${circ(56.5, 55, 4.4)}${circ(60.5, 56.5, 3.2)}"/>`);
  // glow rays
  add('house', 'little house with a glowing window', out.join(''));
}

// ---------------------------------------------------------------- alphabet-blocks
{
  const out = [];
  const glyph = {
    A: 'M-7 7L-2 -7H2L7 7H3.4L2.4 3.8H-2.4L-3.4 7ZM-1.5 .8H1.5L0 -3.8Z',
    B: 'M-5.5 -7H1.2C6.4 -7 6.6 -.9 3 -.3C7.4 .2 7.3 7 1.6 7H-5.5ZM-2 -4.2V-1.6H.8C2.6 -1.6 2.6 -4.2 .8 -4.2ZM-2 1.3V4.2H1.2C3.3 4.2 3.3 1.3 1.2 1.3Z',
    C: 'M5.4 -4.6A7.1 7.1 0 1 0 5.4 4.6L2.7 2.5A3.7 3.7 0 1 1 2.7 -2.5Z',
  };
  const block = (x, y, s, L) => {
    const d = 7, h = 6;
    const face = `M${x} ${y}H${x + s}V${y + s}H${x}Z`;
    const g = glyph[L];
    const top = `M${x} ${y}L${x + d} ${y - h}H${x + s + d}L${x + s} ${y}Z`;
    const side = `M${x + s} ${y}L${x + s + d} ${y - h}V${y + s - h}L${x + s} ${y + s}Z`;
    const inset = `M${x + 2.5} ${y + 2.5}H${x + s - 2.5}V${y + s - 2.5}H${x + 2.5}Z`;
    const hl = `M${x + 1.3} ${y + 1.3}H${x + 8}V${y + 2.3}H${x + 2.3}V${y + 8}H${x + 1.3}Z`;
    return P('t-c', top) + P('t-b', side) + `<path class="t-a" fill-rule="evenodd" d="${face}${hl}"/>` + P('t-c', hl) +
      P('ln', inset, ' stroke-width="1.3"') +
      `<path class="t-b" fill-rule="evenodd" transform="translate(${x + s / 2} ${y + s / 2})" d="${g}"/>`;
  };
  out.push(block(3, 37, 22, 'B'));
  out.push(block(32, 37, 22, 'C'));
  out.push(block(18, 11.5, 22, 'A'));
  add('alphabet-blocks', 'stacked wooden ABC letter blocks', out.join(''));
}

// ---------------------------------------------------------------- plant-pot
{
  const out = [];
  out.push(P('ln', 'M32 30C32 24 31.5 19 32.5 13', ' stroke-width="3"'));
  out.push(`<path class="t-a" fill-rule="evenodd" d="M31.5 25Q17 26 9 14Q24 9 31.5 25Z${ell(18.5, 15.8, 3.4, 1.1, 22)}"/>`);
  out.push(`<path class="t-c" d="${ell(18.5, 15.8, 3.4, 1.1, 22)}"/>`);
  out.push(P('t-b', 'M31.5 25Q17 26 9 14Q20 22 31.5 25Z'));
  out.push(`<path class="t-a" fill-rule="evenodd" d="M32.8 20Q40 5 56 6Q51 21 32.8 20Z${ell(46.5, 9.8, 3.8, 1.1, -18)}"/>`);
  out.push(`<path class="t-c" d="${ell(46.5, 9.8, 3.8, 1.1, -18)}"/>`);
  out.push(P('t-b', 'M32.8 20Q44 15 56 6Q51 21 32.8 20Z'));
  out.push(P('t-a', 'M32.4 14Q28 8 30.5 2.5Q36.5 7.5 32.4 14Z'));
  out.push(P('t-b', 'M32.4 14Q33 7.5 30.5 2.5Q36.5 7.5 32.4 14Z'));
  // soil
  out.push(P('t-b', 'M15 31Q32 25 49 31Z'));
  // pot body with highlight hole
  out.push(`<path class="t-a" fill-rule="evenodd" d="M14.5 37H49.5L45.5 56H18.5ZM20 40.5L21.6 40.5L23.6 52.5L22 52.5Z"/>`);
  out.push(P('t-c', 'M20 40.5L21.6 40.5L23.6 52.5L22 52.5Z'));
  out.push(P('t-b', 'M42.5 37H49.5L45.5 56H39.5Z'));
  // rim
  out.push(`<path class="t-a" fill-rule="evenodd" d="M13 29.5H51Q53 29.5 53 31.5V36.5Q53 38.5 51 38.5H13Q11 38.5 11 36.5V31.5Q11 29.5 13 29.5ZM14.5 32H25V33.8H14.5Z"/>`);
  out.push(P('t-c', 'M14.5 32H25V33.8H14.5Z'));
  out.push(P('t-b', 'M46 29.5H51Q53 29.5 53 31.5V36.5Q53 38.5 51 38.5H46Z'));
  out.push(`<rect class="t-b" x="14" y="38.5" width="36" height="2.2"/>`);
  // saucer
  out.push(P('t-b', 'M8 55H56Q58 55 57 57.5Q55.8 61 51 61H13Q8.2 61 7 57.5Q6 55 8 55Z'));
  out.push(P('t-c', 'M12 57.4H24V58.8H12Z'));
  add('plant-pot', 'terracotta pot with a seedling and a saucer', out.join(''));
}


// ---------------------------------------------------------------- movie-camera
{
  const out = [];
  // tripod
  out.push(P('t-b', 'M22.5 48H26L15.5 62H11.5ZM28 48H31.5L32 62H28ZM33.5 48H37L47.5 62H43.5Z'));
  out.push(`<rect class="t-b" x="19" y="44" width="21" height="5" rx="1.5"/>`);
  // reels
  const reel = (cx, cy, r) => {
    const holes = [0, 72, 144, 216, 288].map(a => circ(...pt(cx, cy, r * .52, a - 90), r * .22, true)).join('');
    return `<path class="t-a" fill-rule="evenodd" d="${circ(cx, cy, r)}${holes}${circ(cx, cy, r * .13)}"/>` +
      P('t-b', `M${n(pt(cx, cy, r, -20)[0])} ${n(pt(cx, cy, r, -20)[1])}A${r} ${r} 0 0 1 ${n(pt(cx, cy, r, 110)[0])} ${n(pt(cx, cy, r, 110)[1])}A${n(r * 1.2)} ${n(r * 1.2)} 0 0 0 ${n(pt(cx, cy, r, -20)[0])} ${n(pt(cx, cy, r, -20)[1])}Z`) +
      `<circle class="t-b" cx="${cx}" cy="${cy}" r="${n(r * .13)}"/>`;
  };
  out.push(reel(17, 14.5, 10.5));
  out.push(reel(37, 15.5, 9.5));
  // film loop
  out.push(P('ln', 'M8.5 21Q9.5 27 13 27M44.5 21.5Q46 26 43 27.5', ' stroke-width="1.8"'));
  // body
  out.push(`<path class="t-a" fill-rule="evenodd" d="M11 26H41Q44 26 44 29V42Q44 45 41 45H11Q8 45 8 42V29Q8 26 11 26ZM11.5 29H24V31H11.5Z"/>`);
  out.push(P('t-c', 'M11.5 29H24V31H11.5Z'));
  out.push(P('t-b', 'M8 39.5H44V42Q44 45 41 45H11Q8 45 8 42Z'));
  out.push(P('t-b', 'M40 26H41Q44 26 44 29V42Q44 45 41 45H40Z'));
  out.push(`<circle class="t-b" cx="20" cy="36" r="4"/><circle class="t-c" cx="20" cy="36" r="1.6"/>`);
  out.push(`<rect class="t-b" x="29" y="32" width="9" height="3" rx="1.5"/>`);
  // eyepiece
  out.push(`<rect class="t-b" x="2.5" y="30" width="6.5" height="7" rx="1.5"/>`);
  // lens
  out.push(`<rect class="t-b" x="43.5" y="30" width="5" height="11" rx="1"/>`);
  out.push(`<path class="t-a" fill-rule="evenodd" d="M48 32L58.5 26.5Q60.5 25.8 60.5 28V43Q60.5 45.2 58.5 44.5L48 39Z"/>`);
  out.push(P('t-b', 'M48 36.5L60.5 40.5V43Q60.5 45.2 58.5 44.5L48 39Z'));
  out.push(`<path class="t-c" d="${ell(59.3, 35.5, 1.6, 7.6)}"/>`);
  add('movie-camera', 'vintage cine camera on a tripod with two reels on top', out.join(''));
}

// ---------------------------------------------------------------- acorn
{
  const out = [];
  // oak leaf, local: stem (-5,0), tip (32,0); top edge as cubic segments, bottom mirrored
  const segT = [[[1, -1], [0, -8.5], [7, -10.5], [8, -5]], [[8, -5], [6.5, -13.5], [16.5, -14.5], [15.5, -6]],
    [[15.5, -6], [15, -14], [24.5, -13], [22.5, -4.8]], [[22.5, -4.8], [23, -11], [30, -9], [28, -3]], [[28, -3], [30, -2.6], [32, -1.2], [32, 0]]];
  const f = ([x, y]) => `${n(x)} ${n(y)}`;
  const top = 'M-5 0L1 -1' + segT.map(s => `C${f(s[1])} ${f(s[2])} ${f(s[3])}`).join('');
  const mir = ([x, y]) => [x, -y * .96];
  const bot = [...segT].reverse().map(s => `C${f(mir(s[2]))} ${f(mir(s[1]))} ${f(mir(s[0]))}`).join('');
  const leafD = `${top}${bot}L-5 0Z`;
  const leafSh = `M32 0${bot}L-5 0Z`;
  out.push(`<g transform="translate(14 55) rotate(-66) scale(1.36)"><path class="t-a" d="${leafD}"/><path class="t-b" d="${leafSh}"/>` +
    P('ln', 'M-4 0H30M8 0L10.5 -6.5M15.5 0L18.5 -8M22.5 0L25 -6.5', ' stroke-width="1.4"') + `</g>`);
  // acorn
  const g = [];
  g.push(`<path class="t-a" fill-rule="evenodd" d="M15.5 33C15.5 48 23.5 58 31 61.5C38.5 58 46.5 48 46.5 33Z${ell(21.5, 42, 1.8, 5, -12)}"/>`);
  g.push(`<path class="t-c" d="${ell(21.5, 42, 1.8, 5, -12)}"/>`);
  g.push(P('t-b', 'M46.5 33C46.5 48 38.5 58 31 61.5C36.5 56 41.5 47 41.5 33Z'));
  const dots = [[20, 27], [26, 23], [32, 22], [38, 23], [44, 27], [17, 31.5], [23, 29], [29, 27.5], [35, 27.5], [41, 29], [47, 31.5]];
  g.push(`<path class="t-b" fill-rule="evenodd" d="M12.5 34C11.5 23 19.5 16.5 31 16.5C42.5 16.5 50.5 23 49.5 34Q31 40 12.5 34Z${dots.map(([x, y]) => circ(x, y, 1.15)).join('')}"/>`);
  g.push(`<path class="t-c" d="${dots.map(([x, y]) => circ(x, y, 1.15)).join('')}"/>`);
  g.push(P('t-b', 'M29.3 17.5Q28.8 11 32.8 7L35.2 9Q32.2 12.5 32.8 17.5Z'));
  out.push(`<g transform="translate(42.5 36) rotate(12) scale(.78) translate(-31 -38)">${g.join('')}</g>`);
  add('acorn', 'acorn with an oak leaf', out.join(''));
}

// ---------------------------------------------------------------- magic-wand
{
  const out = [];
  out.push(`<g transform="translate(7 57) rotate(-45)"><rect class="t-b" x="0" y="-3.2" width="42" height="6.4" rx="3.2"/><path class="t-c" d="M3.2 -3.2H9.5V3.2H3.2A3.2 3.2 0 0 1 3.2 -3.2Z"/><rect class="t-c" x="14" y="-1.4" width="16" height="1.6" rx=".8"/></g>`);
  const S = star(43, 21, 16.5, 8, -90 + 12);
  const hl = ell(38.5, 15.5, 1.6, 3.6, 30);
  out.push(`<path class="t-a" fill-rule="evenodd" d="${poly(S)}${hl}"/>`);
  out.push(`<path class="t-c" d="${hl}"/>`);
  // shade: right half, from top tip clockwise to the bottom inner vertex
  const half = [[43, 21], ...S.slice(0, 6)];
  out.push(P('t-b', poly(half)));
  out.push(`<path class="t-c" d="${spark(12, 13, 5)}${spark(56, 46, 4.5)}${spark(22, 30, 2.6)}"/>`);
  out.push(`<path class="t-a" d="${spark(33, 47, 3.2)}"/>`);
  out.push(`<circle class="t-c" cx="59" cy="5" r="1.4"/><circle class="t-c" cx="47" cy="56" r="1.2"/><circle class="t-c" cx="6" cy="30" r="1.2"/>`);
  add('magic-wand', 'star-tipped magic wand with sparkles', out.join(''));
}


// ---------------------------------------------------------------- croissant
{
  const out = [];
  const C = [32, 58];
  const base = [[0, 28, 10.5, 14.5], [22, 27, 9, 12.5], [42, 25.5, 7.4, 10.2], [60, 24, 5.6, 7.6], [76, 22.5, 3.8, 5]];
  const segs = base.flatMap(s => s[0] ? [[-s[0], ...s.slice(1)], s] : [s]);
  const pos = ([a, R]) => [C[0] + R * Math.sin(a * Math.PI / 180), C[1] - R * Math.cos(a * Math.PI / 180)];
  const E = (s, dy = 0, cw = true) => { const [x, y] = pos(s); return ell(x, y + dy, s[2], s[3], s[0] + 90, cw); };
  out.push(`<path class="t-b" d="${segs.map(s => E(s, 3)).join('')}"/>`);
  const hls = segs.filter(s => Math.abs(s[0]) < 80).map(s => { const [x, y] = pos([s[0], s[1] + s[3] * .45]); const a = s[0] * Math.PI / 180;
    const t = -s[2] * .3; return [x + t * Math.cos(a), y + t * Math.sin(a), s[2] * .38, s[3] * .14, s[0]]; });
  out.push(`<path class="t-a" d="${segs.map(s => E(s)).join('')}${hls.map(h => ell(...h, false)).join('')}"/>`);
  out.push(`<path class="t-c" d="${hls.map(h => ell(...h)).join('')}"/>`);
  const f2 = p => `${n(p[0])} ${n(p[1])}`;
  const fold = (a, R, len, bend) => { const p1 = pos([a, R - len]), p2 = pos([a, R + len]), c = pos([a + bend, R]); return `M${f2(p1)}Q${f2(c)} ${f2(p2)}`; };
  out.push(P('ln', [[11, 27.5, 9.5, 4], [32, 26.2, 7.8, 3.5], [51, 24.7, 5.8, 3], [68, 23.2, 3.8, 2.5]].map(([a, R, l, b]) => fold(-a, R, l, -b) + fold(a, R, l, b)).join(''), ' stroke-width="2"'));
  // crumbs
  out.push(`<path class="t-c" d="${circ(10, 16, 1.5)}${circ(54, 14, 1.2)}${circ(58, 20, .9)}${circ(6, 22, .9)}"/>`);
  add('croissant', 'flaky croissant', out.join(''));
}

// ---------------------------------------------------------------- stage-curtain
{
  const out = [];
  // floor + pool of light
  const pool = ell(32, 56.5, 13, 3.4);
  out.push(`<path class="t-b" fill-rule="evenodd" d="M7 51H57L63 62H1Z${pool}"/>`);
  out.push(`<path class="t-c" d="${pool}"/>`);
  out.push(`<rect class="t-a" x="1" y="60" width="62" height="3" rx="1"/>`);
  // light beam
  out.push(P('t-c', 'M27 12H37L45 54H19Z'));
  const curtain = [
    P('t-a', 'M1 7H27C27.5 22 21 33 14 39C18 46 20 52 21 58H1Z'),
    P('t-b', 'M1 7H7C7.5 22 7 32 5 39C5.5 46 6 52 6 58H1Z'),
    P('ln', 'M13 8C13.5 22 11.5 31 8.5 39M20.5 8C20.5 22 16.5 32 11 39.5M9 42C9.5 48 10 53 10.5 58M13.5 42.5C14.5 48 15.5 53 16 58', ' stroke-width="1.8"'),
    `<path class="t-b" d="${ell(11.5, 40.5, 5.2, 1.9, -30)}"/>`,
    `<circle class="t-b" cx="14.5" cy="38.8" r="1.8"/>`,
  ].join('');
  out.push(curtain);
  out.push(`<g transform="translate(64 0) scale(-1 1)">${curtain}</g>`);
  // valance with scalloped swags
  out.push(P('t-a', 'M0 3H64V11Q58 17.5 53.3 11Q48 17.5 42.7 11Q37.3 17.5 32 11Q26.7 17.5 21.3 11Q16 17.5 10.7 11Q5.3 17.5 0 11Z'));
  out.push(P('t-b', 'M0 11Q5.3 17.5 10.7 11Q16 17.5 21.3 11Q26.7 17.5 32 11Q37.3 17.5 42.7 11Q48 17.5 53.3 11Q58 17.5 64 11V13.5Q58 20 53.3 13.5Q48 20 42.7 13.5Q37.3 20 32 13.5Q26.7 20 21.3 13.5Q16 20 10.7 13.5Q5.3 20 0 13.5Z'));
  out.push(`<rect class="t-b" x="0" y="1" width="64" height="4" rx="1"/>`);
  out.push(`<path class="t-c" d="${circ(5.35, 12.5, 1.3)}${circ(16, 12.5, 1.3)}${circ(26.7, 12.5, 1.3)}${circ(37.3, 12.5, 1.3)}${circ(48, 12.5, 1.3)}${circ(58.7, 12.5, 1.3)}"/>`);
  out.push(`<path class="t-a" d="${star(32, 36, 4.2, 1.9).map((p, i) => (i ? 'L' : 'M') + n(p[0]) + ' ' + n(p[1])).join('')}Z"/>`);
  add('stage-curtain', 'red velvet stage curtains drawn open', out.join(''));
}

// ---------------------------------------------------------------- molecule
{
  const out = [];
  const atoms = [[29, 34, 11], [10.5, 13.5, 7], [52, 12.5, 7.5], [52, 51, 7], [10, 54, 6]];
  const bond = (a, b, off = 0, w = 4.2) => { const [x1, y1] = a, [x2, y2] = b, L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, px = -uy, py = ux;
    const o = off, h = w / 2; const q = (x, y, s) => `${n(x + px * (o + s * h))} ${n(y + py * (o + s * h))}`;
    return `M${q(x1, y1, -1)}L${q(x2, y2, -1)}L${q(x2, y2, 1)}L${q(x1, y1, 1)}Z`; };
  const [A, B, Cc, D, E2] = atoms;
  out.push(P('t-b', bond(A, B) + bond(A, Cc, -2.8, 3.2) + bond(A, Cc, 2.8, 3.2) + bond(A, D) + bond(A, E2)));
  for (const [cx, cy, r] of atoms) {
    const h = ell(cx - r * .38, cy - r * .42, r * .32, r * .2, -40);
    out.push(`<path class="t-a" fill-rule="evenodd" d="${circ(cx, cy, r)}${h}"/>`);
    out.push(`<path class="t-c" d="${h}"/>`);
    const p1 = pt(cx, cy, r, -20), p2 = pt(cx, cy, r, 110);
    out.push(P('t-b', `M${n(p1[0])} ${n(p1[1])}A${r} ${r} 0 0 1 ${n(p2[0])} ${n(p2[1])}A${n(r * 1.22)} ${n(r * 1.22)} 0 0 0 ${n(p1[0])} ${n(p1[1])}Z`));
  }
  out.push(`<path class="t-c" d="${spark(56, 32, 3.4)}${spark(30, 7, 2.8)}"/>`);
  add('molecule', 'ball-and-stick molecule model', out.join(''));
}


// ---------------------------------------------------------------- dinosaur
{
  const out = [];
  // far legs
  out.push(P('t-b', 'M22 45H28V57.5Q28 59.5 26 59.5H24Q22 59.5 22 57.5ZM43 44H49V57.5Q49 59.5 47 59.5H45Q43 59.5 43 57.5Z'));
  const spots = [ell(27, 33.5, 3.2, 2.2, -10, false), ell(35.5, 31.5, 2.6, 1.8, 0, false), ell(21, 38, 2.2, 1.6, -20, false)];
  const body = 'M2 53C8 51.5 12 47 14.5 41.5C17 32.5 25 27.5 33 27.5C38.5 27.5 41.5 29.5 43.5 26C45.5 21 44.5 13 48.5 8.5C51.5 5 58.5 5 60.5 9C62 12.5 59.5 14.8 56 14.8C53.5 14.8 52.3 16.5 52 19.5C51.3 27 51.5 33 49.5 39C47.5 45.5 42.5 49.5 35 50H20C14 50 8.5 54.5 2 53Z';
  const legs = 'M15.5 45.5H22.5V58Q22.5 61 19.5 61H18.5Q15.5 61 15.5 58ZM37 46H44V58Q44 61 41 61H40Q37 61 37 58Z';
  out.push(`<path class="t-a" d="${body}${legs}${spots.join('')}"/>`);
  out.push(`<path class="t-c" d="${spots.map(x => x.replace(/ 1 0 /g, ' 1 1 ')).join('')}"/>`);
  // belly / under-neck shade
  out.push(P('t-b', 'M49.5 39C47.5 45.5 42.5 49.5 35 50H20C14 50 8.5 54.5 2 53C9 51.5 13 47.5 20 47H35C41.5 46.5 46 43.5 49.5 39Z'));
  out.push(P('t-b', 'M52 19.5C51.3 27 51.5 33 49.5 39C48.5 34 48.7 27 49.3 20.5Z'));
  // toes
  out.push(P('t-c', 'M16.5 59.2H18.3V61H16.5ZM19.7 59.2H21.5V61H19.7ZM38 59.2H39.8V61H38ZM41.2 59.2H43V61H41.2Z'));
  // face
  out.push(`<circle class="t-b" cx="54.5" cy="9.6" r="1.6"/><circle class="t-c" cx="55" cy="9.1" r=".55"/>`);
  out.push(P('ln', 'M56.5 12.6Q58.3 13.4 59.6 12', ' stroke-width="1.2"'));
  out.push(`<path class="t-c" d="${ell(51.5, 12.2, 1.4, .9)}"/>`);
  // highlight along the back
  out.push(P('t-c', 'M20 36C22.5 32 26.5 30 30 29.5C27 31.2 24.5 33.5 22.5 36.5Z'));
  // ground tufts
  out.push(P('ln', 'M5 61.5H12M50 61.5H60', ' stroke-width="1.8"'));
  add('dinosaur', 'long-necked dinosaur', out.join(''));
}

// ---------------------------------------------------------------- toothbrush
{
  const out = [];
  const g = [];
  // handle
  g.push(`<path class="t-a" fill-rule="evenodd" d="M3 -1.5Q3 -5 7 -5L27 -3.2L40 -1.4V2.4L27 3.2L7 5Q3 5 3 1.5ZM8 -2.6L22 -1.6V-.2L8 -1.2Z"/>`);
  g.push(P('t-c', 'M8 -2.6L22 -1.6V-.2L8 -1.2Z'));
  g.push(P('t-b', 'M3 1.2H27L40 1V2.4L27 3.2L7 5Q3 5 3 1.5Z'));
  g.push(`<rect class="t-b" x="11" y="-4.4" width="9" height="9" rx="2"/>`);
  // head
  g.push(`<rect class="t-a" x="38" y="-3" width="20" height="7" rx="3.5"/>`);
  g.push(P('t-b', 'M38 1.5H58V.5Q58 4 54.5 4H41.5Q38 4 38 .5Z'));
  // bristles
  g.push(P('t-c', [0, 1, 2, 3, 4].map(i => `M${n(40 + i * 3.4)} -3.2V-11Q${n(41.3 + i * 3.4)} -12.4 ${n(42.6 + i * 3.4)} -11V-3.2Z`).join('')));
  // paste swirl
  g.push(P('t-a', 'M39 -11C38.5 -15 41.5 -16.8 44 -15.5C45 -19.5 50 -19.5 51 -16C53 -18.5 57.5 -17 57.2 -13.5C59 -12.5 58.6 -10.5 57 -10.5H40.5Q39 -10.5 39 -11Z'));
  g.push(P('t-c', 'M41.5 -13Q44 -14.8 46.5 -13Q49 -11.2 51.5 -13Q54 -14.8 56.5 -13', '').replace('<path class="t-c"', '<path class="ln" stroke-width="1.6"'));
  g.push(P('t-b', 'M40.5 -10.5H57Q58.6 -10.5 58.8 -12Q57 -11.8 55 -12.2H41Q39.5 -12.2 39 -11.2Q39.2 -10.5 40.5 -10.5Z'));
  out.push(`<g transform="translate(3 50) rotate(-32) scale(1.12)">${g.join('')}</g>`);
  out.push(`<path class="t-c" d="${circ(12, 20, 3.4)}${circ(20, 12, 2.2)}${circ(8, 31, 1.6)}"/>`);
  out.push(`<path class="t-c" d="${spark(56, 44, 4.5)}${spark(26, 6, 3)}"/>`);
  add('toothbrush', 'toothbrush with a swirl of paste', out.join(''));
}

// ---------------------------------------------------------------- scarf
{
  const out = [];
  // neck loop: back half dark, front half main
  out.push(`<path class="t-b" fill-rule="evenodd" d="${ell(32, 16, 23, 11)}${ell(32, 14, 15, 5.5)}"/>`);
  out.push(P('t-a', 'M9 16A23 11 0 0 0 55 16L47 14A15 5.5 0 0 1 17 14Z'));
  out.push(P('t-c', 'M14 20.5Q16.5 23 20 24.3L21.3 20.8Q18.5 19.7 16.6 18Z'));
  out.push(P('t-c', 'M42.7 24.3Q46.2 23 49.4 20.4L47 18Q45 19.7 42 20.8Z'));
  const tail = (tx, ty, rot, w, len, stripes, fringe) => {
    const h = w / 2;
    let g = `<rect class="t-a" x="${-h}" y="0" width="${w}" height="${len}" rx="1"/>`;
    for (const [y, hh, c] of stripes) g += `<rect class="${c}" x="${-h}" y="${y}" width="${w}" height="${hh}"/>`;
    g += `<rect class="t-b" x="${n(h - 2)}" y="0" width="2" height="${len}"/>`;
    g += P('ln', Array.from({ length: fringe }, (_, i) => { const x = -h + 1.2 + i * (w - 2.4) / (fringe - 1); return `M${n(x)} ${len + 1}V${len + 5.5}`; }).join(''), ' stroke-width="1.8"');
    return `<g transform="translate(${tx} ${ty}) rotate(${rot})">${g}</g>`;
  };
  out.push(tail(40, 22, -16, 11, 25, [[5, 3.5, 't-b'], [11.5, 1.6, 't-c'], [15.5, 3.5, 't-b']], 4));
  out.push(tail(26, 22, 9, 12, 31, [[6, 4, 't-b'], [13, 1.8, 't-c'], [17.8, 4, 't-b'], [24.8, 1.8, 't-c']], 5));
  // knot
  out.push(`<path class="t-a" d="M22 18.5Q32 15.5 42 18.5L41 27Q32 29.5 23 27Z"/>`);
  out.push(P('t-b', 'M22.6 22.8Q32 20.3 41.5 22.8L41.2 25.4Q32 23 22.8 25.4Z'));
  out.push(P('ln', 'M27 19.3L26.6 26.8M37 19.3L37.4 26.8', ' stroke-width="1.3"'));
  add('scarf', 'striped knitted scarf with fringe', out.join(''));
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part9.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => i.id + ' ' + i.svg.length).join('\n'));
