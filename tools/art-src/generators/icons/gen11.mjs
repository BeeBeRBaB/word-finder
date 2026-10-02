// Generates part11.json (round 2, batch 11).
import fs from 'node:fs';
const OUT = process.argv[2] || new URL('../../icons/part11.json', import.meta.url);
const items = [];
const add = (id, motif, parts) => items.push({ id, motif, svg: parts.join('') });

const f = n => { let r = Math.round(n * 10) / 10; if (Object.is(r, -0)) r = 0; return String(r); };
// translate an absolute-command path (M L H V C S Q T A Z)
const T = (d, dx, dy) => {
  const toks = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g); let out = '', cmd = '', k = 0;
  for (const t of toks) {
    if (/[A-Za-z]/.test(t)) { cmd = t; k = 0; out += t; continue; }
    const n = parseFloat(t); let v = n;
    if (cmd === 'H') v = n + dx; else if (cmd === 'V') v = n + dy;
    else if (cmd === 'A') { const p = k % 7; if (p === 5) v = n + dx; if (p === 6) v = n + dy; }
    else v = n + (k % 2 === 0 ? dx : dy);
    out += (/[A-Za-z]$/.test(out) ? '' : ' ') + f(v); k++;
  }
  return out.replace(/ -/g, '-');
};
const rr = (x, y, w, h, r) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;
const P = (cls, d, extra = '') => `<path class="${cls}"${extra} d="${d}"/>`;
const C = (cls, cx, cy, r) => `<circle class="${cls}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`;
const E = (cls, cx, cy, rx, ry) => `<ellipse class="${cls}" cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"/>`;
const ring = (d, dx = 2.5, dy = 3) => `<path class="t-b" fill-rule="evenodd" d="${T(d, dx, dy)}${d}"/>`;
// screen-space shadow offset expressed in a group rotated by deg
const loc = (deg, dx = 2.5, dy = 3) => { const a = -deg * Math.PI / 180; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; };
const spark = (x, y, s, cls = 't-c') => P(cls, `M${f(x)} ${f(y - s)}Q${f(x + s * .16)} ${f(y - s * .16)} ${f(x + s)} ${f(y)}Q${f(x + s * .16)} ${f(y + s * .16)} ${f(x)} ${f(y + s)}Q${f(x - s * .16)} ${f(y + s * .16)} ${f(x - s)} ${f(y)}Q${f(x - s * .16)} ${f(y - s * .16)} ${f(x)} ${f(y - s)}Z`);
const HEART = 'M0 .9C-.35 .62-1 .2-1-.3C-1-.72-.68-.98-.42-.98C-.18-.98 0-.8 0-.58C0-.8 .18-.98 .42-.98C.68-.98 1-.72 1-.3C1 .2 .35 .62 0 .9Z';
const heart = (x, y, s, cls) => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})">${P(cls, HEART)}</g>`;
const drop = (x, y, s, cls = 't-c') => P(cls, `M${f(x)} ${f(y - 4 * s)}Q${f(x + 3 * s)} ${f(y)} ${f(x + 3 * s)} ${f(y + 1.2 * s)}A${f(3 * s)} ${f(3 * s)} 0 0 1 ${f(x - 3 * s)} ${f(y + 1.2 * s)}Q${f(x - 3 * s)} ${f(y)} ${f(x)} ${f(y - 4 * s)}Z`);

// ---------- wrench ----------
{
  const W = 'M-23-5H7.5A12.5 12.5 0 0 1 30.7-4.5H15V4.5H30.7A12.5 12.5 0 0 1 7.5 5H-23A5 5 0 0 1-23-5Z';
  const [sx, sy] = loc(-45);
  add('wrench', 'adjustable wrench', [
    '<g transform="translate(32 32) rotate(-45) translate(-3 0)">',
    ring(W, sx, sy), P('t-a', W),
    P('t-c', 'M15 4.5H30.7A12.5 12.5 0 0 1 15 11.8Z'),
    P('t-b', rr(-17, -1.8, 18, 3.6, 1.8)), C('t-b', -22.5, 0, 2.4),
    P('t-b', rr(5, 3, 9, 6.5, 2)),
    P('t-c', 'M7 4h1.3v4.5h-1.3zM9.7 4h1.3v4.5h-1.3zM12.4 4h1.1v4.5h-1.1z'),
    P('t-c', rr(13, -10.5, 11, 2.4, 1.2)), P('t-c', rr(-20, -3.8, 12, 1.6, .8)),
    '</g>',
    spark(12, 14, 3.5), spark(53, 49, 3),
  ]);
}

// ---------- confetti-popper ----------
{
  const hw = x => 1.6 + (12 - 1.6) * x / 30;
  const cone = `M0-1.6L30-12A4 12 0 0 1 30 12L0 1.6Q-2 0 0-1.6Z`;
  const band = (a, b, s) => `M${f(a)} ${f(-hw(a))}L${f(b)} ${f(-hw(b))}L${f(b - s)} ${f(hw(b - s))}L${f(a - s)} ${f(hw(a - s))}Z`;
  const [sx, sy] = loc(-45);
  const bit = (x, y, w, h, rot, cls) => `<rect class="${cls}" x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" rx=".8" transform="rotate(${rot} ${f(x)} ${f(y)})"/>`;
  add('confetti-popper', 'party popper bursting with confetti and streamers', [
    '<path class="ln" stroke-width="2.6" d="M33 29C34 21 28 18 32 12C35 8 40 10 40 5"/>',
    '<path class="ln" stroke-width="2.6" d="M37 34C44 32 45 38 51 37C56 36 55 30 60 30"/>',
    '<g transform="translate(7 57) rotate(-45)">',
    ring(cone, sx, sy), P('t-a', cone),
    P('t-c', band(9, 13, 4)), P('t-c', band(18, 22, 4)),
    E('t-b', 30, 0, 4, 12), E('t-c', 30.6, 0, 2, 9.5),
    '</g>',
    bit(44, 22, 5, 3, 30, 't-a'), bit(26, 10, 5, 3, -20, 't-c'), bit(52, 12, 5, 3, 60, 't-c'),
    bit(47, 46, 5, 3, -35, 't-a'), bit(57, 22, 4.5, 2.6, 15, 't-b'), bit(18, 20, 4.5, 2.6, 50, 't-b'),
    C('t-c', 40, 16, 2), C('t-a', 55, 40, 2), C('t-c', 50, 28, 1.6), C('t-a', 22, 4, 1.6), C('t-b', 38, 42, 1.6),
    spark(47, 7, 3.5), spark(11, 30, 2.8, 't-a'), spark(59, 51, 2.8, 't-a'),
  ]);
}

// ---------- carrot ----------
{
  const B = 'M2-10C-10-10-32-5-44-1.2Q-47 0-44 1.2C-32 5-10 10 2 10Q7 10 7 0Q7-10 2-10Z';
  const leaf = 'M0 0C5-5 13-7 21-5C15-1 7 2 0 0Z';
  const [sx, sy] = loc(-45);
  add('carrot', 'carrot with leafy top', [
    '<g transform="translate(32 32) rotate(-45) translate(9 0)">',
    `<g transform="translate(5 0)">`,
    `<path class="t-b" transform="rotate(-38)" d="${leaf}"/>`,
    `<path class="t-b" transform="rotate(38) scale(1 -1)" d="${leaf}"/>`,
    `<path class="t-a" transform="rotate(-12) scale(1.1)" d="${leaf}"/>`,
    `<path class="t-a" transform="rotate(14) scale(1.05 -1.05)" d="${leaf}"/>`,
    '</g>',
    ring(B, sx, sy), P('t-a', B),
    P('t-b', 'M7 0Q7 10 2 10Q5 5 5 0Q5-5 2-10Q7-10 7 0Z'),
    '<path class="ln" d="M-8-9.4V-5.2M-18 7.6V4M-27-5.8V-2.8M-35 3.4V1M-13 9V6.4"/>',
    P('t-c', 'M-3-8C-12-8-24-5.2-34-2.4C-24-3.6-12-5.8-3-6Q-1.5-7-3-8Z'),
    '</g>',
  ]);
}

// ---------- toolbox ----------
{
  const BOX = rr(4, 30, 56, 27, 4);
  add('toolbox', 'open toolbox with tools', [
    // screwdriver
    '<g transform="rotate(-16 19 38)">',
    P('t-b', rr(17.5, 24, 3, 14, 1)), P('t-a', rr(13.5, 5, 11, 21, 5)),
    '<path class="ln" stroke-width="1.6" d="M17 11V21M21 11V21"/>', P('t-c', rr(15.2, 8, 2, 7, 1)),
    '</g>',
    // open-end wrench
    '<g transform="rotate(8 33 36)">',
    P('t-b', rr(30.5, 10, 5, 28, 2.5)),
    P('t-b', 'M30.3 3.5V8.5H35.7V3.5A7.5 7.5 0 1 1 30.3 3.5Z'),
    P('t-a', 'M30.8 3.5V7.8H35.2V3.5A6.6 6.6 0 1 1 30.8 3.5Z'),
    '</g>',
    // hammer
    '<g transform="rotate(16 46 36)">',
    P('t-c', rr(44, 12, 5, 26, 2)), P('t-b', rr(37, 6, 19, 8, 2)), P('t-a', rr(37, 6, 11.5, 8, 2)),
    '</g>',
    ring(BOX), P('t-a', BOX),
    P('t-b', 'M4 34Q4 30 8 30H56Q60 30 60 34V37H4Z'),
    P('t-c', rr(4, 35.5, 56, 2, 0)),
    P('t-b', rr(26, 41, 12, 8, 2)), P('t-c', rr(29.5, 43.5, 5, 3, 1.5)),
    P('t-c', rr(8, 41, 2.4, 11, 1.2)),
    P('t-b', rr(1, 41, 4, 8, 1.5)), P('t-b', rr(59, 41, 4, 8, 1.5)),
  ]);
}

// ---------- hug ----------
{
  const LB = 'M8 63C8 46 13 35 24 34C31 34 35 40 35 48V63Z';
  const RB = 'M56 63C56 46 51 35 40 34C33 34 29 40 29 48V63Z';
  add('hug', 'two figures in a warm hug', [
    P('t-b', T(RB, 2, 1)), P('t-c', RB),
    P('t-b', T(LB, 1.5, 1)), P('t-a', LB),
    // right figure's arm around left's back
    P('t-c', 'M36 47C28 44 19 45 12 50Q9 53 12 55.5C19 51 28 50.5 36 52Z'), C('t-c', 11.5, 52.5, 3.4),
    // left figure's arm over right's shoulder
    P('t-a', 'M26 39C34 35 45 35 52 40Q55 43 52 46C45 41.5 34 41.5 27 45Z'), C('t-a', 52.5, 43, 3.4),
    '<path class="ln" stroke-width="1.5" d="M50.5 41.5Q51.5 43 50.5 44.5M13.5 51Q12.5 52.5 13.5 54"/>',
    // heads
    C('t-a', 48.5, 12.8, 3.6),
    C('t-b', 43.5, 24, 9.5), C('t-c', 42, 22, 9.5),
    P('t-a', 'M32.6 21A9.5 9.5 0 0 1 51.4 20.5Q46 17 40 17.5Q35 18 32.6 21Z'),
    C('t-b', 24, 24, 9.5), C('t-a', 22.5, 22.5, 9.5),
    P('t-b', 'M13.1 21A9.5 9.5 0 0 1 31.9 21.5Q29 17 24 17Q19 17 16 22Q15 21 13.1 21Z'),
    '<path class="ln" d="M17 23Q19 20.8 21 23M40 22.5Q42 20.3 44 22.5"/>',
    C('t-c', 17, 27, 2), C('t-a', 46.5, 26.5, 2),
    heart(32, 8.5, 5.5, 't-b'), spark(9, 8, 3), spark(56, 30, 2.5),
  ]);
}

// ---------- faucet ----------
{
  const PIPE = 'M8 17H37C46 17 51 22 51 30V33H41V30C41 28 40 27 38 27H8Z';
  add('faucet', 'tap with water running', [
    P('t-b', rr(3, 11, 9, 25, 3)), P('t-c', rr(5, 14, 2, 8, 1)),
    ring(PIPE), P('t-a', PIPE),
    P('t-b', rr(20, 10, 8, 8, 1)),
    P('t-a', rr(11, 6, 26, 5.5, 2.75)), C('t-b', 24, 8.75, 4), C('t-c', 24, 8.75, 1.8),
    P('t-c', rr(13, 19.5, 18, 2.4, 1.2)),
    P('t-b', rr(39.5, 32, 13, 4.5, 1.5)),
    P('t-c', 'M42 36.5H50C50 44 51 48 51 55H41C41 48 42 44 42 36.5Z'),
    P('t-a', rr(44, 39, 1.8, 11, .9)),
    E('t-c', 46, 57, 13, 3.2), E('t-a', 46, 57, 6, 1.2),
    drop(33, 50, .9), drop(59, 46, .8), drop(36, 42, .6),
  ]);
}

// ---------- potion-bottle ----------
{
  const BOT = 'M25.5 14H38.5V27.3A17 17 0 1 1 25.5 27.3Z';
  add('potion-bottle', 'round-bottomed corked flask with glowing liquid', [
    ring(BOT), P('t-a', BOT),
    P('t-c', 'M18.4 38Q22 35 26 38Q32 41 38 38Q42 35 45.6 38A14.5 14.5 0 1 1 18.4 38Z'),
    C('t-a', 27, 48, 2.6), C('t-a', 36, 45, 1.8), C('t-a', 33, 52.5, 1.4),
    C('t-c', 34, 32, 1.5), C('t-c', 30.5, 26, 1.1),
    P('t-c', rr(28, 16, 2.4, 9, 1.2)),
    '<path class="ln" stroke-width="2.4" d="M21 34.5Q19 37.5 18.8 41"/>',
    P('t-a', rr(23, 11.5, 18, 5, 2.5)), P('t-c', rr(25, 12.7, 6, 1.6, .8)),
    P('t-b', rr(26.5, 2, 11, 11, 3)), C('t-c', 29.5, 5.5, .9), C('t-c', 34, 8, .9), C('t-c', 30.5, 9.5, .7),
    spark(11, 17, 4), spark(54, 24, 3.2), spark(52, 9, 2.2, 't-a'), C('t-c', 8, 32, 1.3), C('t-c', 57, 38, 1.2),
  ]);
}

// ---------- pumpkin ----------
add('pumpkin', 'round pumpkin with a curly stem', [
  E('t-b', 34.5, 44, 27, 16.5),
  E('t-b', 18.5, 41, 13.5, 15.5), E('t-b', 45.5, 41, 13.5, 15.5),
  E('t-a', 25, 41, 12, 17), E('t-a', 39, 41, 12, 17),
  E('t-a', 32, 41, 9.5, 18),
  '<path class="ln" d="M28.5 25Q20.5 41 28.5 57M35.5 25Q43.5 41 35.5 57"/>',
  '<path class="ln" stroke-width="1.6" d="M16 29Q9 41 16 53"/>',
  E('t-c', 28.5, 33, 1.8, 5), E('t-c', 12.5, 38, 1.4, 3.5),
  P('t-b', 'M29 25L29.5 15Q30 9 36 7.5Q37.8 10.2 35 11.5Q33.5 12.5 33.8 16L35 25Q32 26.5 29 25Z'),
  P('t-a', 'M36 18C40 10 48 8 53 11.5C49 18 42 20.5 36 18Z'),
  '<path class="ln" stroke-width="1.5" d="M38 17Q45 14.5 50.5 11.8"/>',
  '<path class="ln" d="M29.5 19C24 18 20 14 22.5 10.5C24.5 8 28 9.5 26.5 12"/>',
]);

// ---------- lawnmower ----------
{
  const DECK = 'M18 46C18 39 23 36 31 36H48C54 36 58 40 58 46V49H18Z';
  const [hx0, hy0, hx1, hy1] = [23, 42, 9, 12];
  const ang = Math.atan2(hy1 - hy0, hx1 - hx0) * 180 / Math.PI;
  const band = (x, cls) => P(cls, `M${x} 55H${x + 9}L${x + 6} 62H${x - 3}Z`);
  add('lawnmower', 'push lawnmower on striped grass', [
    band(3, 't-a'), band(12, 't-c'), band(21, 't-a'), band(30, 't-c'), band(39, 't-a'), band(48, 't-c'),
    P('t-b', 'M57 55H62V62H54Z'),
    P('t-a', 'M55.5 56Q56 50 54 46Q58 50 58.5 56ZM58 56Q59 48 62 44Q60.5 50 61 56Z'),
    `<path class="ln" stroke-width="3.6" d="M${hx0} ${hy0}L${hx1} ${hy1}"/>`,
    `<g transform="translate(${hx1} ${hy1}) rotate(${f(ang)})">${P('t-a', rr(-2, -3, 12, 6, 3))}</g>`,
    '<path class="ln" stroke-width="1.6" d="M17 28L30 30"/>',
    ring(DECK), P('t-a', DECK),
    P('t-b', rr(18, 45, 40, 4, 0)),
    P('t-b', rr(31, 26, 14, 11, 3)), P('t-a', rr(29, 23, 18, 5, 2.5)), P('t-c', rr(32, 24.2, 7, 1.8, .9)),
    P('t-c', rr(22, 39, 10, 2.2, 1.1)),
    C('t-b', 25, 50, 7.5), C('t-c', 25, 50, 3.2), C('t-b', 25, 50, 1.3),
    C('t-b', 51.5, 51.5, 5.5), C('t-c', 51.5, 51.5, 2.4),
    P('t-c', 'M60 36L62 34L62.5 37Z'), P('t-a', 'M58 30L61 29.5L60 32Z'), P('t-c', 'M62 26L63.5 28L61 29Z'),
  ]);
}

// ---------- piano ----------
{
  const CASE = rr(4, 26, 56, 12, 3);
  const whites = [], blacks = [];
  const kx0 = 7, kx1 = 57, n = 12, kw = (kx1 - kx0) / n;
  for (let i = 1; i < n; i++) whites.push(`M${f(kx0 + i * kw)} 38V45`);
  for (const i of [1, 2, 4, 5, 6, 8, 9, 11]) blacks.push(`M${f(kx0 + i * kw - 1.3)} 38h2.6v4.4h-2.6z`);
  add('piano', 'grand piano with the lid up', [
    P('t-b', 'M8 26L56 5.5L56 26Z'),
    P('t-a', rr(48.5, 9, 2.4, 18, 1.2)),
    P('t-a', 'M5 26L55 3Q58 2 58.5 5L58.8 7L9 28Z'),
    P('t-c', 'M16 21L28 16L28.5 24L16.5 29Z'),
    ring(CASE), P('t-a', CASE),
    P('t-c', rr(7, 29, 16, 2, 1)),
    P('t-b', rr(4, 37, 56, 9.5, 2)),
    P('t-c', rr(kx0, 38, kx1 - kx0, 7, 1)),
    `<path class="ln" stroke-width="1" d="${whites.join('')}"/>`,
    P('t-b', blacks.join('')),
    P('t-b', 'M8 46.5H14L13 57H9Z'), P('t-b', 'M50 46.5H56L55 57H51Z'),
    P('t-a', rr(7.5, 56, 7, 3, 1.5)), P('t-a', rr(49.5, 56, 7, 3, 1.5)),
    P('t-b', rr(30.5, 46.5, 3, 8, 1)), P('t-a', rr(26, 54, 12, 3, 1.5)),
  ]);
}

// ---------- keyboard-and-mouse ----------
{
  const KB = rr(2, 27, 43, 27, 3.5);
  const MS = 'M53.5 30C59 30 62 35 62 43C62 50 58.5 55 53.5 55C48.5 55 45.5 50 45.5 43C45.5 35 48 30 53.5 30Z';
  const keys = [];
  const kw = 4.2, g = 1.2, x0 = 5.2;
  for (const [row, y, off, cnt] of [[0, 30.5, 0, 7], [1, 36, 1.5, 7], [2, 41.5, 0, 7]]) {
    for (let i = 0; i < cnt; i++) { const x = x0 + off + i * (kw + g); if (x + kw > 42.5) continue; keys.push(`M${f(x)} ${f(y)}h${kw}v4.2h-${kw}z`); }
  }
  keys.push('M5.2 47h7v4.2h-7zM13.4 47h20v4.2h-20zM34.6 47h7.2v4.2h-7.2z');
  add('keyboard-and-mouse', 'computer keyboard with a mouse beside it', [
    '<path class="ln" stroke-width="2.2" d="M53.5 30C53.5 20 44 23 40 16C37 11 30 13 28 18Q27 22 28 27"/>',
    ring(KB), P('t-a', KB), P('t-c', keys.join('')),
    ring(MS, 2, 2.5), P('t-a', MS),
    '<path class="ln" stroke-width="1.6" d="M46 41.5Q53.5 43 61.5 41.5M53.5 30.5V42"/>',
    P('t-b', rr(52.3, 33, 2.4, 5.5, 1.2)), P('t-c', rr(48, 36, 2, 5, 1)),
  ]);
}

// ---------- framed-painting ----------
{
  const FR = rr(6, 15, 52, 44, 3);
  const knob = (x, y) => C('t-a', x, y, 4.2) + C('t-c', x, y, 1.7);
  add('framed-painting', 'ornate gilt-framed painting on a wall', [
    '<path class="ln" d="M15 18L32 5L49 18"/>', C('t-b', 32, 5, 2.4),
    ring(FR), P('t-a', FR),
    P('t-b', rr(11, 20, 42, 34, 1.5)),
    P('t-c', rr(13.5, 22.5, 37, 29, 0)),
    C('t-a', 42, 30, 3.8),
    P('t-b', 'M13.5 45L24 31L31 40L35 35L44 45Z'),
    P('t-a', 'M13.5 51.5V44Q22 39 30 44Q39 39 50.5 43V51.5Z'),
    knob(8, 17), knob(56, 17), knob(8, 57), knob(56, 57),
    E('t-a', 32, 15, 7, 4), E('t-c', 32, 15, 3, 1.6), E('t-a', 32, 59, 5, 3), C('t-c', 32, 59, 1.2),
    C('t-c', 8.5, 37, 1.2), C('t-c', 55.5, 37, 1.2), C('t-c', 20, 16.8, 1), C('t-c', 44, 16.8, 1),
  ]);
}

// ---------- hardcover-book ----------
{
  const FRONT = 'M8 6H47Q50 6 50 9V55Q50 58 47 58H8Z';
  add('hardcover-book', 'closed hardback with a decorated cover and gilt spine', [
    P('t-b', rr(9, 11, 45, 52, 3)),
    P('t-c', rr(9, 8.5, 43, 52, 2)),
    '<path class="ln" stroke-width="1" d="M51 12V56M11 59.3H48"/>',
    P('t-b', 'M38 57H43V64L40.5 61.5L38 64Z'),
    P('t-a', FRONT),
    P('t-b', 'M8 6H17V58H8Q5 58 5 55V9Q5 6 8 6Z'),
    P('t-c', rr(5, 11, 12, 2.2, 0)), P('t-c', rr(5, 15, 12, 1.2, 0)),
    P('t-c', rr(5, 49.8, 12, 1.2, 0)), P('t-c', rr(5, 52.8, 12, 2.2, 0)),
    P('t-a', rr(7, 22, 8, 20, 1.5)), '<path class="ln" stroke-width="1.2" d="M9.5 26H12.5M9.5 30H12.5M9.5 34H12.5M9.5 38H12.5"/>',
    '<path class="ln" stroke-width="1.5" d="M21.5 10.5H45.5V53.5H21.5Z"/>',
    P('t-c', 'M42 6H47Q50 6 50 9V14Z'), P('t-c', 'M42 58H47Q50 58 50 55V50Z'),
    P('t-c', 'M33.5 21L40 28.5L33.5 36L27 28.5Z'), P('t-b', 'M33.5 25L36.5 28.5L33.5 32L30.5 28.5Z'),
    P('t-c', rr(25, 42, 17, 3, 1.5)), P('t-c', rr(28, 47, 11, 2, 1)),
  ]);
}

// ---------- sock ----------
{
  const S = 'M14 6H36V32C40 34 46 36 52 38C60 40 62 50 56 55C52 58 46 58 40 57L24 55C12 54 8 44 13 36Z';
  add('sock', 'striped sock', [
    '<g transform="rotate(-8 34 32)">',
    ring(S), P('t-a', S),
    P('t-b', 'M13.8 16H36V21.5H13.5Z'), P('t-b', 'M13.4 26.5H36V32H13.1Z'),
    P('t-c', 'M13 36C9 44 13 53 24 55L25.5 50C20 49 17 44 18.5 37.5Z'),
    P('t-c', 'M51 38C60 40 62 50 56 55C53 57 49 58 46 57.8C50 52 50.5 44 51 38Z'),
    P('t-c', rr(12, 3, 26, 9, 2.5)),
    '<path class="ln" stroke-width="1.6" d="M17 5.5V9.5M21.5 5.5V9.5M26 5.5V9.5M30.5 5.5V9.5M35 5.5V9.5"/>',
    P('t-c', rr(17, 34, 2.2, 6, 1.1)),
    '</g>',
  ]);
}

fs.writeFileSync(OUT, JSON.stringify(items, null, 1));
for (const it of items) if (it.svg.length > 2500) console.log('LONG', it.id, it.svg.length);
console.log('wrote', items.length);
