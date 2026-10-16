// Generates part17.json (round 3, batches 23-34).
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
const G = (t, inner) => `<g transform="${t}">${inner}</g>`;
const nh = (x, y, s = 1) => `M${f(x - 3.1 * s)} ${f(y + 1.1 * s)}A${f(3.3 * s)} ${f(2.5 * s)} -20 1 1 ${f(x + 3.1 * s)} ${f(y - 1.1 * s)}A${f(3.3 * s)} ${f(2.5 * s)} -20 1 1 ${f(x - 3.1 * s)} ${f(y + 1.1 * s)}Z`;
const stm = (x, y, t, s = 1) => `M${f(x + 1.7 * s)} ${f(y)}V${f(t)}H${f(x + 3.3 * s)}V${f(y)}Z`;
const fl = (x, t, s = 1) => `M${f(x + 3.3 * s)} ${f(t)}Q${f(x + 4 * s)} ${f(t + 2.5 * s)} ${f(x + 6.8 * s)} ${f(t + 4.2 * s)}Q${f(x + 8.6 * s)} ${f(t + 5.6 * s)} ${f(x + 7.2 * s)} ${f(t + 8.2 * s)}Q${f(x + 7 * s)} ${f(t + 5.6 * s)} ${f(x + 3.3 * s)} ${f(t + 4.6 * s)}Z`;

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- conductor-baton
{
  let s = '';
  // stand desk: plate with the open score set into it, ledge, pole, legs
  const pg = 'M9 31.5Q19.5 28.5 31 33V46.5Q19.5 43 9 45ZM33 33Q44.5 28.5 55 31.5V45Q44.5 43 33 46.5Z';
  s += P('t-a', rpoly([[7, 27], [57, 27], [58.5, 47], [5.5, 47]], 2) + pg, ' fill-rule="evenodd"');
  s += P('t-c', pg);
  let sl = '';
  for (let k = 0; k < 5; k++) { const d = 2.6 + k * 1.9; sl += `M11 ${f(31.1 + d)}Q19.5 ${f(28.5 + d)} 29.5 ${f(32.4 + d)}M34.5 ${f(32.4 + d)}Q44.5 ${f(28.5 + d)} 53 ${f(31.1 + d)}`; }
  s += L(sl, .8);
  s += P('t-b', nh(15, 37.3, .55) + stm(15, 37.3, 32, .55) + nh(20, 35.6, .55) + stm(20, 35.6, 30.6, .55) + nh(25, 39.4, .55) + stm(25, 39.4, 33.6, .55)
    + nh(39, 37.4, .55) + stm(39, 37.4, 32, .55) + nh(44, 34.6, .55) + stm(44, 34.6, 29.6, .55) + nh(49, 36.8, .55) + stm(49, 36.8, 31.4, .55));
  s += P('t-b', 'M4.5 45.5Q19 43 32 48.5Q45 43 59.5 45.5V49.5Q45 47 32 52.5Q19 47 4.5 49.5Z');
  s += R('t-b', 30.5, 51, 3, 8, .8);
  s += P('t-b', limb([[32, 55.5], [23, 59.3]], 2.4) + limb([[32, 55.5], [41, 59.3]], 2.4));
  // baton
  s += P('t-a', cap(11, 10, 46, 19.5, 2.2));
  // hand: curled fingers wrapping the grip, thumb along the baton, white cuff, dark sleeve
  s += P('t-b', rpoly([[53.5, 26.5], [58.5, 22.5], [59.5, 23.5], [59.5, 34], [56, 34.5]], 1.2));
  s += P('t-c', rpoly([[50.5, 26], [56.5, 21.5], [58.8, 24.5], [53, 29.5]], .8));
  s += P('t-a', rpoly([[45.5, 17], [52, 15], [56.5, 19], [56, 24.5], [51, 28.5], [46.5, 27.5]], [2, 3, 3, 3, 3, 2]));
  s += P('t-a', limb([[43.5, 21.5], [47.8, 22.3]], 3.2) + limb([[44, 24.6], [48.2, 25.4]], 3.2) + limb([[44.8, 27.4], [48.5, 28]], 2.8));
  s += L('M45 23Q47 23.6 48.5 23.4M45.5 26Q47.5 26.6 49 26.4', 1);
  s += P('t-a', cap(41.5, 16.8, 50, 17.4, 3.6));
  s += L('M44 18.8Q47.5 19.6 51 18.8', 1);
  // motion arcs at the tip
  s += L('M4.5 16.5Q6 11.5 10.5 8.5M6 21.5Q9 17 14 15', 1.5);
  s += P('t-c', spark(25, 6.5, 3.2) + spark(57, 7, 2.4));
  add('conductor-baton', 'conductor baton held over a music stand with an open score', s);
}
// ---------- choir-singers
{
  let s = '';
  const fig = (cx, hy) => {
    let o = '';
    const collar = `M${f(cx - 4.6)} ${f(hy + 7.6)}H${f(cx + 4.6)}L${f(cx)} ${f(hy + 13)}Z`;
    o += P('t-a', rpoly([[cx - 6, hy + 7.6], [cx + 6, hy + 7.6], [cx + 8.6, 59], [cx - 8.6, 59]], [4, 4, 1, 1]) + collar, ' fill-rule="evenodd"');
    o += P('t-c', collar);
    o += L(`M${f(cx - 3.5)} ${f(hy + 28)}L${f(cx - 4.4)} 57M${f(cx + 3.5)} ${f(hy + 28)}L${f(cx + 4.4)} 57`, 1);
    // head with open mouth
    o += C('t-a', cx, hy, 6);
    o += P('t-b', `M${f(cx - 6)} ${f(hy)}A6 6 0 0 1 ${f(cx + 6)} ${f(hy)}Q${f(cx + 4)} ${f(hy - 3.5)} ${f(cx)} ${f(hy - 3.2)}Q${f(cx - 4)} ${f(hy - 3)} ${f(cx - 6)} ${f(hy)}Z`);
    o += E('t-b', cx, hy + 3, 1.6, 2);
    o += L(`M${f(cx - 3.6)} ${f(hy - .4)}Q${f(cx - 2.4)} ${f(hy + .8)} ${f(cx - 1.2)} ${f(hy - .4)}M${f(cx + 1.2)} ${f(hy - .4)}Q${f(cx + 2.4)} ${f(hy + .8)} ${f(cx + 3.6)} ${f(hy - .4)}`, 1.1);
    // open folder held at the chest, hands
    o += P('t-b', rpoly([[cx - 7.4, hy + 15.5], [cx - .5, hy + 17], [cx - .5, hy + 25.5], [cx - 7.4, hy + 24]], .8) + rpoly([[cx + 7.4, hy + 15.5], [cx + .5, hy + 17], [cx + .5, hy + 25.5], [cx + 7.4, hy + 24]], .8));
    o += C('t-a', cx - 7.4, hy + 21.5, 2) + C('t-a', cx + 7.4, hy + 21.5, 2);
    return o;
  };
  s += fig(13, 13) + fig(51, 13) + fig(32, 11.5);
  s += P('t-a', nh(56, 7.5, .6) + stm(56, 7.5, 1.8, .6) + fl(56, 1.8, .6));
  s += P('t-c', spark(6, 6, 3));
  add('choir-singers', 'three choir singers in robes singing from folders', s);
}
// ---------- sheet-music
{
  let s = '', g = '';
  g += P('t-b', 'M44 14H46.4V59.4Q46.4 60.6 45.2 60.6H9.5Q8.2 60.6 8.2 59.4V59H44Z');
  g += P('t-c', rpoly([[7, 6], [36, 6], [43, 13], [43, 58], [7, 58]], [1.5, .5, .5, 1.5, 1.5]));
  g += P('t-b', 'M36 6L36 11.5Q36 13 37.5 13L43 13Z');
  let sl = '';
  for (const y0 of [15, 30, 45]) for (let k = 0; k < 5; k++) sl += `M10 ${y0 + 2 * k}H40`;
  g += L(sl, .9);
  // treble clef
  g += L('M15.8 9.5Q19.5 11.5 16.5 15Q11 20 11.4 22.8Q12 26 15.6 25.4Q18 24.8 17.7 22.4Q17.3 20.3 15 20.6Q13.4 21 13.8 22.6M15.8 9.5Q14.2 10.5 14.6 14L15.6 28Q15.8 31 13 30.6', 1.7);
  g += C('t-b', 12.6, 29.4, 1.5);
  // notes
  g += P('t-b', nh(24, 22, .7) + stm(24, 22, 13, .7) + fl(24, 13, .7) + nh(31, 19, .7) + stm(31, 19, 11, .7) + nh(37, 21, .7) + stm(37, 21, 12, .7)
    + nh(13, 36, .7) + stm(13, 36, 27, .7) + nh(19, 34, .7) + stm(19, 34, 26, .7) + `M${f(13 + 1.2)} 27L${f(19 + 2.3)} 26V28.2L${f(13 + 1.2)} 29.2Z`
    + nh(27, 37, .7) + stm(27, 37, 29, .7) + nh(34, 33, .7) + stm(34, 33, 25, .7) + `M${f(27 + 1.2)} 29L${f(34 + 2.3)} 25V27.2L${f(27 + 1.2)} 31.2Z`
    + nh(14, 50, .7) + stm(14, 50, 41, .7) + nh(22, 47, .7) + stm(22, 47, 39, .7) + fl(22, 39, .7));
  g += P('t-b', nh(31, 51, .75) + `M${f(31 - 1.4)} ${f(51 + .9)}A1.5 .8 -20 1 1 ${f(31 + 1.4)} ${f(51 - .9)}A1.5 .8 -20 1 1 ${f(31 - 1.4)} ${f(51 + .9)}Z` + stm(31, 51, 42, .75), ' fill-rule="evenodd"');
  g += R('t-b', 39.2, 45, 1, 8);
  s += G('rotate(-4 26 32)', g);
  // pencil
  let pc = '';
  pc += R('t-a', -3, 0, 6, 4.5, 1.8);
  pc += R('t-b', -3.2, 4, 6.4, 4.2, .4);
  pc += P('t-a', 'M-3 8.2H3V38H-3Z');
  pc += R('t-b', 1, 8.2, 2, 29.8);
  pc += P('t-c', 'M-3 38H3L1 44.4H-1Z');
  pc += P('t-b', 'M-1.2 44H1.2L0 48Z');
  pc += L('M-3.2 5.4H3.2M-3.2 6.9H3.2', .6);
  s += G('translate(53 7) rotate(9)', pc);
  s += P('t-c', spark(52.5, 58.5, 2.6) + spark(57.5, 51, 1.6));
  add('sheet-music', 'sheet of music with a treble clef and notes, pencil beside', s);
}
// ---------- opera-glasses
{
  let s = '';
  const cs = [19, 45], cy = 25, R1 = 11.5, R0 = 7.6, ey = 10, er = 7.4;
  // barrels seen from above-front (behind the rings)
  s += P('t-b', cs.map(cx => rpoly([[cx - er, ey], [cx + er, ey], [cx + er + 1.4, cy - 7.9], [cx - er - 1.4, cy - 7.9]], 1)).join(''));
  s += P('t-a', cs.map(cx => `M${f(cx - er)} ${ey}A${er} 2.8 0 1 0 ${f(cx + er)} ${ey}A${er} 2.8 0 1 0 ${f(cx - er)} ${ey}Z`).join(''));
  s += P('t-b', cs.map(cx => `M${f(cx - er + 2.6)} ${ey}A${er - 2.6} 1.5 0 1 0 ${f(cx + er - 2.6)} ${ey}A${er - 2.6} 1.5 0 1 0 ${f(cx - er + 2.6)} ${ey}Z`).join(''));
  // bridge + focus wheel
  s += R('t-a', 28, 15, 8, 14, 1.5);
  s += R('t-a', 29.5, 7.5, 5, 8, 1.4);
  s += L('M31 8.5V14.5M33 8.5V14.5', .9);
  s += R('t-b', 28, 15, 8, 2.2);
  // front rings with lens holes
  let ring = '';
  for (const cx of cs) ring += circ(cx, cy, R1) + circ(cx, cy, R0);
  s += P('t-a', ring, ' fill-rule="evenodd"');
  s += P('t-c', cs.map(cx => `M${f(cx - 5.6)} ${f(cy + .5)}A5.6 5.6 0 0 1 ${f(cx + .5)} ${f(cy - 5.6)}A6.6 6.6 0 0 0 ${f(cx - 5.6)} ${f(cy + .5)}Z`).join(''));
  // beads round the rims
  let bd = '';
  for (const cx of cs) for (let i = 0; i < 10; i++) { const a = (i * 36 + 18) * Math.PI / 180; bd += circ(cx + 9.55 * Math.cos(a), cy + 9.55 * Math.sin(a), 1); }
  s += P('t-b', bd);
  // ornate handle
  s += P('t-a', cap(32, 30, 38.5, 54, 4.2));
  s += P('t-b', cap(32.2, 30, 33.2, 34, 5.6));
  s += P('t-b', cap(35, 41, 35.6, 43.2, 5.4) + cap(37.4, 49.8, 37.9, 51.6, 5.2));
  s += C('t-a', 39.2, 57, 2.8);
  s += L('M39 37Q44 35.5 43 40.5Q42.4 43 40.2 42M33.8 46Q29 46.5 30 50.5Q30.8 53 33.6 52', 1.2);
  s += P('t-c', spark(6, 46, 3.4) + spark(56, 48, 2.4) + spark(57, 6, 2.2));
  add('opera-glasses', 'ornate opera glasses on a handle', s);
}
// ---------- amplifier
{
  let s = '';
  // head
  const panel = 'M17 12H53V19H17Z';
  s += P('t-b', rpoly([[25, 8], [27, 4.5], [43, 4.5], [45, 8], [42, 8], [41, 6.8], [29, 6.8], [28, 8]], .8));
  s += P('t-a', rpoly([[14, 8], [56, 8], [56, 22.5], [14, 22.5]], 2) + panel, ' fill-rule="evenodd"');
  s += P('t-c', panel);
  s += P('t-b', [27, 32, 37, 42, 47].map(x => circ(x, 15.5, 1.8)).join(''));
  s += L([27, 32, 37, 42, 47].map(x => `M${x} 15.5V13.9`).join(''), .8);
  s += P('t-b', circ(51, 15.5, .9));
  // cabinet
  const gr = 'M16 27.5H55V54H16Z';
  s += P('t-a', rpoly([[13, 24], [58, 24], [58, 57], [13, 57]], 2) + gr, ' fill-rule="evenodd"');
  let sp = '', ho = '';
  for (const x of [26, 45]) for (const y of [34.4, 47.1]) { ho += circ(x, y, 5.6); sp += circ(x, y, 5.6) + circ(x, y, 3.5) + circ(x, y, 1.6); }
  s += P('t-b', gr + ho, ' fill-rule="evenodd"');
  s += P('t-a', sp, ' fill-rule="evenodd"');
  s += R('t-b', 15, 56.5, 5, 3, .8) + R('t-b', 51, 56.5, 5, 3, .8);
  s += R('t-b', 13, 22.5, 45, 1.5);
  // jack, plug and cable
  s += P('t-b', circ(21, 15.5, 2.1));
  s += P('t-b', cap(21, 15.5, 17.6, 19.4, 2.8));
  s += L('M17.6 19.4Q10 25 7.5 32Q5 40 7 48Q8.5 54 5.5 57.5', 2.4);
  s += P('t-c', spark(7, 9, 3.4) + spark(58, 4.5, 2));
  add('amplifier', 'guitar amp stack with grille, knobs and a cable plugged in', s);
}
// ---------- mixing-desk
{
  let s = '';
  // meter bridge with two VU windows
  const w1 = 'M13 8.5H30V16.5H13Z', w2 = 'M34 8.5H51V16.5H34Z';
  s += P('t-a', rpoly([[9, 5], [55, 5], [55, 19.5], [9, 19.5]], 2) + w1 + w2, ' fill-rule="evenodd"');
  s += P('t-c', w1 + w2);
  s += L('M15.5 15A6.5 6.5 0 0 1 27.5 15M36.5 15A6.5 6.5 0 0 1 48.5 15', .8);
  s += L('M21.5 16L24.8 10.6M42.5 16L46 11.2', 1.1);
  s += R('t-b', 9, 19.5, 46, 2.5);
  // tilted control surface
  const Lx = y => 8 - 4 * (y - 22) / 26, Rx = y => 56 + 4 * (y - 22) / 26, X = (u, y) => Lx(y) + u * (Rx(y) - Lx(y));
  s += P('t-a', rpoly([[8, 22], [56, 22], [60, 48], [4, 48]], 1));
  s += P('t-b', rpoly([[4, 48], [60, 48], [59, 53], [5, 53]], 1));
  s += R('t-b', 9, 53, 3, 6, .8) + R('t-b', 52, 53, 3, 6, .8);
  let kn = '', fs2 = '', cp = '';
  const caps = [.55, .35, .7, .45, .25, .6, .4];
  for (let i = 0; i < 7; i++) {
    const u = (i + .5) / 7;
    kn += circ(X(u, 25.5), 25.5, 1.55) + circ(X(u, 30), 30, 1.55);
    fs2 += `M${f(X(u, 34))} 34L${f(X(u, 46))} 46`;
    const yc = 34 + caps[i] * 12; cp += rpoly([[X(u, yc) - 2.3, yc - 1.2], [X(u, yc) + 2.3, yc - 1.2], [X(u, yc) + 2.3, yc + 1.2], [X(u, yc) - 2.3, yc + 1.2]], .5);
  }
  s += P('t-b', kn);
  s += L(fs2, 1);
  s += P('t-b', cp);
  s += P('t-c', spark(5, 9, 3) + spark(59.5, 13, 2.2));
  add('mixing-desk', 'recording studio mixing desk with faders, knobs and level meters', s);
}
fs.writeFileSync(process.argv[2] || new URL('../../icons/part25.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
