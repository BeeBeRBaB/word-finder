// Generates part16.json (round 3, batches 12-22).
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
// ---------- runner
{ let s = '';
  // dust puff behind the push-off foot
  s += P('t-a', circ(5.5, 56.5, 3.2) + circ(10.5, 54.5, 4.3) + circ(16.5, 57.5, 3.4) + 'M5.5 56.5V61H16.5V57.5Z');
  s += P('t-b', 'M2.4 58Q6 61 11 60.8Q16 61 19.9 58.2Q19.5 61 16.5 61H5.5Q2.8 61 2.4 58Z');
  // back limbs (shade), kept outside the torso
  s += P('t-b', limb([[33, 25], [24, 27], [19, 35]], 6) + limb([[29, 38], [25, 49], [14, 52]], 7.5));
  // body: torso + front arm + front leg as one union
  s += P('t-a', cap(38, 21, 31, 36, 10.5) + limb([[38, 24], [46, 31], [54, 24]], 6.5) + limb([[31, 36], [43, 40], [41, 52]], 8) + cap(41, 52, 46, 53, 6));
  s += P('t-a', circ(43, 10, 6.5) + 'M37.2 9.5A6 6 0 0 1 41.6 4L42 5.4A4.6 4.6 0 0 0 38.6 9.6Z', ' fill-rule="evenodd"');
  s += P('t-c', 'M37.2 9.5A6 6 0 0 1 41.6 4L42 5.4A4.6 4.6 0 0 0 38.6 9.6Z');
  s += P('t-b', 'M48.6 6.7A6.5 6.5 0 0 1 39.3 15.4A7.6 7.6 0 0 0 48.6 6.7Z');
  // speed lines
  s += L('M4 18H15M2.5 27H12M6 36H14', 3);
  s += P('t-c', spark(57, 9, 4.5) + spark(58, 44, 3));
  add('runner', 'figure sprinting right with speed lines', s); }
// ---------- stretching-figure
{ let s = '';
  const ax = 46, ay = 26; // arc the raised arm follows
  const on = (deg, r) => [ax + r * Math.cos(deg * Math.PI / 180), ay + r * Math.sin(deg * Math.PI / 180)];
  const arm = [[30.5, 26.2], ...[198, 214, 230, 246, 262, 278, 294, 306].map(d => on(d, 19))];
  // motion arc outside the reach, with arrow tip
  const mo = [182, 192, 202, 212, 222, 232, 240].map(d => on(d, 25));
  s += L('M' + mo.map(p => f(p[0]) + ' ' + f(p[1])).join('L'), 2.6);
  const [tx, ty] = on(244, 25);
  s += P('t-b', `M${f(tx + 3.6)} ${f(ty + 1.7)}L${f(tx - 3.4)} ${f(ty - 2.4)}L${f(tx - 1.6)} ${f(ty + 4.4)}Z`);
  // body: legs, torso, raised arm, hand-on-hip arm in one union
  s += P('t-a', cap(35, 29, 27, 43.5, 11.5) + limb([[24, 43], [14, 59.5]], 8) + limb([[30, 43], [41, 59.5]], 8) + cap(14, 59.5, 9, 60.5, 6) + cap(41, 59.5, 46, 60.5, 6) +
    limb(arm, 6.5) + limb([[39.6, 31.4], [49.5, 37.5], [32.5, 43.5]], 6.5));
  // head, tilted into the stretch, with cut-out highlight
  const hl = 'M38.4 17.8A5 5 0 0 1 41.4 13.5L42 14.7A3.8 3.8 0 0 0 39.6 18Z';
  s += P('t-a', circ(43, 18.8, 5.4) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', 'M48 16.3A5.4 5.4 0 0 1 40.3 23.5A6.3 6.3 0 0 0 48 16.3Z');
  s += P('t-c', spark(56, 50, 4) + spark(8, 44, 3) + spark(58, 28, 2.5));
  add('stretching-figure', 'figure in a wide-legged side stretch', s); }
// ---------- yoga-figure
{ let s = '';
  // mat: top face and front edge
  s += P('t-a', rpoly([[10, 54.5], [54, 54.5], [59, 59.5], [5, 59.5]], 1.5));
  s += R('t-b', 5, 58.5, 54, 4, 2);
  s += L('M13 56.8H51', 1.3);
  // body: standing leg, bent leg with foot at the knee, torso, arms meeting overhead
  s += P('t-a', limb([[29, 37], [29, 55.5]], 7.5) + cap(29, 55.5, 33.5, 56, 5.5) + limb([[35, 37], [50.5, 43.5], [34, 48.5]], 7) +
    rpoly([[26, 22], [26, 39], [38, 39], [38, 22]], 5) +
    limb([[28, 25], [19.5, 13.5], [30.5, 4.6]], 5.5) + limb([[36, 25], [44.5, 13.5], [33.5, 4.6]], 5.5) +
    'M32 1Q28.4 4.4 29.4 8.6H34.6Q35.6 4.4 32 1Z');
  // shade: far side of the torso
  s += P('t-b', 'M35 22H33Q38 22 38 27V34Q38 39 33 39H35Z');
  // head with cut-out highlight
  const hl = 'M27.8 14A4.6 4.6 0 0 1 30.4 10L31 11.1A3.4 3.4 0 0 0 29 14.2Z';
  s += P('t-a', circ(32, 14.6, 5) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', 'M36.7 12.5A5 5 0 0 1 29.9 19.1A5.9 5.9 0 0 0 36.7 12.5Z');
  s += P('t-c', spark(53, 12, 4.5) + spark(11, 34, 3.5) + spark(55, 30, 2.5));
  add('yoga-figure', 'figure in tree pose on a yoga mat', s); }
// ---------- bathtub
{ let s = '';
  // claw feet
  s += P('t-b', 'M12.5 50Q13 56 9.5 57.5Q7.5 58.5 8.5 60.5Q10.5 61.5 13 60Q17 57.5 17.5 51.5ZM51.5 50Q51 56 54.5 57.5Q56.5 58.5 55.5 60.5Q53.5 61.5 51 60Q47 57.5 46.5 51.5Z');
  // tub body notched where foam drips over, with cut-out shine and shaded underside
  const sh = 'M11 40Q11.8 45 16 47.6L15.4 48.8Q10 46 9.6 40Z';
  s += P('t-a', 'M6.5 36H19.5V38.4A2.4 2.4 0 1 0 22.5 38.4V36H41V40.9A2.4 2.4 0 1 0 44 40.9V36H57.5Q57 50.5 47 52.5H17Q7 50.5 6.5 36Z' + sh, ' fill-rule="evenodd"');
  s += P('t-c', sh);
  s += P('t-b', 'M8.3 45Q11 51.5 17 52.5H47Q53 51.5 55.7 45Q51.5 49.4 45 49.8H19Q12.5 49.4 8.3 45Z');
  // rolled rim, split by the drips
  s += P('t-b', 'M5.5 31.5H19.5V36.5H5.5A2.5 2.5 0 0 1 5.5 31.5ZM22.5 31.5H41V36.5H22.5ZM44 31.5H58.5A2.5 2.5 0 0 1 58.5 36.5H44Z');
  // foam heaped over the rim, dripping down the side
  s += P('t-c', circ(8.5, 29.5, 3.5) + circ(15, 26.5, 5.5) + circ(23.5, 23.5, 6.5) + circ(33, 23.5, 6.5) + circ(41.5, 25, 5.5) + circ(48, 28.5, 4) +
    'M8.5 28V33H48V28ZM19.5 31V38.4A2.4 2.4 0 1 0 22.5 38.4V31ZM41 31V40.9A2.4 2.4 0 1 0 44 40.9V31Z');
  s += L('M3.4 19a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0ZM8.1 9.5a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0ZM15.7 4.5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0Z', 1.5);
  // rubber duck facing right
  s += P('t-a', 'M20.5 18L26.5 13L18.5 9.5Z' + 'M19.5 18a10.5 7 0 1 0 21 0a10.5 7 0 1 0 -21 0Z' + circ(38.5, 9, 5.6));
  s += P('t-b', 'M43.4 8.4Q48.8 8 49.6 10.5Q47.2 13 43.2 11.6ZM25.5 17.5Q30.5 14.6 35 18Q32.2 23.4 25.5 21.4Z');
  s += C('t-b', 40.2, 7.4, 1.2);
  // candle on the rim
  s += R('t-a', 52.5, 22, 6.5, 9.5, 1.2);
  s += R('t-b', 56.5, 22, 2.5, 9.5, 1);
  s += L('M55.8 22V20', 1.2);
  const fl = 'M55.8 18.1Q57 16.5 55.8 14.8Q54.6 16.5 55.8 18.1Z';
  s += P('t-a', 'M55.8 11Q59.4 15 58.5 17.8Q57.8 19.9 55.8 19.9Q53.8 19.9 53.1 17.8Q52.2 15 55.8 11Z' + fl, ' fill-rule="evenodd"');
  s += P('t-c', fl);
  s += P('t-c', spark(56, 4.5, 3.5) + spark(27, 4, 2.5));
  add('bathtub', 'clawfoot tub with bubbles, duck and candle', s); }
// ---------- mammoth
{ let s = '';
  // tusks start at the trunk's right edge (x 46.5): far one in shade, near one light, nested with a gap
  s += P('t-b', 'M46.4 29C47 44 57 44 57 26C57 20 55 15 51 12.5C53.5 18 53.5 34 50 34C48 34 46.8 29.5 46.4 23Z');
  s += P('t-c', 'M46.5 38C47.5 52 63 54 63.2 31C63.3 22 61 16.5 57 13.5C60.5 20 60.5 42 53.5 42C49.5 42 47.3 37.5 46.5 31.5Z');
  // body squeezed a little so the tusks get room to sweep
  s += '<g transform="matrix(.85 0 0 1 .8 0)">';
  // tail, starting at the rump edge
  s += L('M4.6 28.6Q2.8 30.5 3.3 34.5', 2.2);
  s += P('t-b', 'M3 33.5Q5.3 37 3.6 40Q.8 38 1.8 34.5Z');
  // far legs
  s += P('t-b', rpoly([[19.5, 44], [26, 44], [26, 58.5], [19.5, 58.5]], [0, 0, 2.5, 2.5]) + rpoly([[28, 44], [34.5, 44], [34.5, 58.5], [28, 58.5]], [0, 0, 2.5, 2.5]));
  // coat, head, trunk and near legs as one outline; dome shine and toenails cut out (reverse winding)
  const sh = 'M42.9 9.6Q44.2 7 47.2 6.8L47 5.4Q43 5.6 41.5 9Z', nl = 'M16 59Q16 56 13.5 56Q11 56 11 59ZM42.5 59Q42.5 56 40 56Q37.5 56 37.5 59Z';
  s += P('t-a', 'M6 26Q10 17 20 13Q28 9.5 34 9Q37 9 38.5 10.5Q40 3.5 46 3.5Q53 3.8 54 11Q54.5 17 53.5 22L54 42Q54 48.5 49.5 48.5Q46 48.5 45.8 45.3Q45.8 43 47.8 43Q48.4 44.6 49.2 44.6Q49.9 44.6 49.9 42L49.5 30Q46.8 30.5 46.4 36L46 46L5 46Q3 36 6 26Z' +
    rpoly([[9, 40], [18.5, 40], [18.5, 59.5], [9, 59.5]], [0, 0, 3, 3]) + rpoly([[35.5, 40], [45, 40], [45, 59.5], [35.5, 59.5]], [0, 0, 3, 3]) + sh + nl);
  s += P('t-c', sh + nl);
  // shaggy skirt of hair hanging in locks over the legs
  let fr = 'M47.8 35Q44 39 38 37.5Q32 40 26 37Q20 40 14 37Q9 39.5 4.3 37.5L4.6 45.5';
  for (let x = 4.6; x < 46; x += 4.15) fr += `Q${f(x + 1.4)} ${f(53)} ${f(x + 2.4)} ${f(53)}Q${f(x + 3)} ${f(49)} ${f(x + 4.15)} ${f(46)}`;
  s += P('t-b', fr + 'Z');
  // fur strokes on the upper coat
  s += L('M14 21q2.5 4 1.5 9M22 16q2.5 4 1.5 9M30 14q2.5 4 1.5 9M18 29q2 3 1.5 6M26 27q2 3 1.5 6M34 25q2 3 1.5 6', 1.5);
  // small low ear flap at the back of the head, and the eye
  s += P('t-b', 'M43.5 17.5Q39.5 16 38 19Q36.8 22.5 39.3 24Q42.3 24.5 43.5 21Z');
  s += C('t-b', 48.8, 13.5, 1.3);
  s += '</g>';
  s += P('t-c', spark(58, 6, 3.5) + spark(26, 4.5, 2.5));
  add('mammoth', 'woolly mammoth with long curved tusks', s); }
// ---------- colosseum
{ let s = '';
  const cx = 32, cy = 19, rx = 29, ry = 9, H = 30;
  const yA = (x, o) => cy + o + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
  const yU = x => 2 * cy - yA(x, 0);
  const XC = 42;
  const el = (x, y, a, b) => x + a <= XC ? `M${f(x - a)} ${f(y)}a${f(a)} ${f(b)} 0 1 0 ${f(2 * a)} 0a${f(a)} ${f(b)} 0 1 0 ${f(-2 * a)} 0Z`
    : (h => `M${XC} ${f(y - h)}A${f(a)} ${f(b)} 0 1 0 ${XC} ${f(y + h)}Z`)(b * Math.sqrt(1 - ((XC - x) / a) ** 2));
  const arch = (x, yt, yb, w) => `M${f(x - w)} ${f(yb)}V${f(yt + w)}a${f(w)} ${f(w)} 0 0 1 ${f(2 * w)} 0V${f(yb)}Z`;
  const ax = cx - 3, ay = cy + 4, ar = [12, 3.4];
  const stp = [[XC, 14], [47, 15], [47, 21], [52, 22], [52, 28], [57, 29], [57, 33.5], [61, 34.5]];
  let ib = `M${XC} 16.2`, ih = '';
  for (let k = 0; k < 4; k++) { const x0 = stp[2 * k][0], x1 = stp[2 * k + 1][0], t = stp[2 * k][1] + 2.2;
    ib += `L${f(x1)} ${f(t + 1)}` + (k < 3 ? `V${f(stp[2 * k + 2][1] + 2.2)}` : 'V44');
    if (k < 3) ih += arch((x0 + x1) / 2, t + 2, t + 7.5, 1.4); }
  ib += `H${XC}Z`;
  s += P('t-a', `M3 ${cy}A${rx} ${ry} 0 0 1 ${XC} ${f(yU(XC))}` + stp.map(([x, y]) => `L${x} ${y}`).join('') + 'L61 46L3 46Z' + el(ax, ay, ...ar) + ih, ' fill-rule="evenodd"');
  s += P('t-b', el(ax, cy + 2.5, 21, 6.5) + el(ax, cy + 3.4, 17, 4.9) + el(ax, cy + 3.8, 15.8, 4.4) + el(ax, ay, ...ar), ' fill-rule="evenodd"');
  s += P('t-c', el(ax, ay, ...ar));
  s += P('t-b', ib + ih, ' fill-rule="evenodd"');
  const brk = [[36, 0], [39, 1.5], [41, 2], [44.5, 6], [47, 7], [50.5, 11.5], [53, 12.5], [57, 17.5], [59, 18], [61, 21]];
  const topOff = x => { if (x <= brk[0][0]) return 0; for (let i = 1; i < brk.length; i++) if (x <= brk[i][0]) return Math.max(brk[i - 1][1], brk[i][1]); return 21; };
  let d = `M3 ${f(yA(3, 0))}A${rx} ${ry} 0 0 0 36 ${f(yA(36, 0))}`;
  for (const [x, o] of brk.slice(1)) d += `L${x} ${f(yA(x, o))}`;
  d += `L61 ${f(yA(61, H))}A${rx} ${ry} 0 0 1 3 ${f(yA(3, H))}Z`;
  s += P('t-a', d);
  let a = '';
  for (const [t0, t1] of [[4, 12.5], [12.5, 21], [21, 30]]) for (let i = -4; i <= 4; i++) {
    const th = i * 19 * Math.PI / 180, x = cx + rx * Math.sin(th), w = 2.85 * Math.cos(th);
    if (w < 0.8 || topOff(x - w) > t0 + 1 || topOff(x + w) > t0 + 1) continue;
    a += arch(x, yA(x, t0) + 1.6, yA(x, t1) - (t1 === 30 ? 0 : 0.9), w);
  }
  s += P('t-b', a);
  let l = '';
  for (const [o, xe] of [[4, 40], [12.5, 49.5], [21, 58]]) l += `M4.2 ${f(yA(4.2, o))}A${rx} ${ry} 0 0 0 ${xe} ${f(yA(xe, o))}`;
  s += L(l, 1.2);
  s += P('t-c', spark(8, 6, 3.5) + spark(55, 11, 3));
  add('colosseum', 'Roman colosseum with tiers of arches', s); }

// ---------- longship
{ let s = '';
  const q = (x, a, c, b) => { const t = (x - 6) / 52; return (1 - t) ** 2 * a + 2 * t * (1 - t) * c + t * t * b; };
  const pt = p => `${f(p[0])} ${f(p[1])}`, poly = ps => 'M' + ps.map(pt).join('L') + 'Z';
  // hull bottom B: (58,31) -> (32,72) -> (6,33); bl(u,v) is its blossom, so bl(t,t) is a point and bl(a,b) the control of the a..b piece
  const B0 = [58, 31], B1 = [32, 72], B2 = [6, 33];
  const bl = (u, v) => [0, 1].map(k => (1 - u) * (1 - v) * B0[k] + ((1 - u) * v + u * (1 - v)) * B1[k] + u * v * B2[k]);
  const ta = 0.06, tr = 0.354, tl = 0.671, tb = 0.94, wc = [31.3, 51.6];
  const PR = bl(tr, tr), PL = bl(tl, tl), WL = `Q${pt(wc)} ${pt(PL)}`;
  s += L('M30 41V5', 2.4) + L('M16 8.5H44', 2.2);
  let sb = '', sc = '';
  for (let i = 0; i < 5; i++) {
    const x0 = 17 + i * 5.2, x1 = x0 + 5.2, b = x => f(30 + 2.5 * Math.sin(Math.PI * (x - 17) / 26));
    const d = `M${f(x0)} 9.5H${f(x1)}V${b(x1)}L${f(x0)} ${b(x0)}Z`;
    if (i % 2) sc += d; else sb += d;
  }
  s += P('t-b', sb) + P('t-c', sc);
  s += P('t-a', 'M6 33.5L3 21.5A6 6 0 1 1 12 26.7A1.8 1.8 0 0 1 10.2 23.6A2.4 2.4 0 1 0 6.6 21.5L9.5 35.5Z' + limb([[56, 34], [60.6, 25], [56.6, 16]], 4.4));
  s += P('t-a', poly([[54.2, 16.2], [52.4, 12.6], [48.2, 10.4], [52.6, 10.2], [50, 5.4], [54.8, 8], [60.4, 7.6], [63.4, 9.8], [61.6, 10.4], [61.2, 11.8], [60.4, 10.8], [58.2, 12], [62.6, 14], [58.8, 15.6], [57.8, 17.6]]) + circ(56.8, 10, 0.9), ' fill-rule="evenodd"');
  let h = `M6 33Q32 46 58 31Q${pt(bl(0, tr))} ${pt(PR)}${WL}Q${pt(bl(tl, 1))} 6 33Z`, c = '', b = '';
  for (let x = 14; x < 51; x += 7) { const y = f(q(x, 33, 46, 31) + 3.6); h += circ(x, y, 2.9); c += circ(x, y, 2.9); b += circ(x, y, 1); }
  s += P('t-a', h, ' fill-rule="evenodd"') + P('t-c', c) + P('t-b', b);
  s += P('t-b', `M${pt(bl(tb, tb))}Q32 57.5 ${pt(bl(ta, ta))}Q${pt(bl(ta, tr))} ${pt(PR)}${WL}Q${pt(bl(tl, tb))} ${pt(bl(tb, tb))}Z`);
  s += P('t-c', `M3 54Q7 49.5 12 51Q17.5 52.6 ${pt(PL)}Q${pt(wc)} ${pt(PR)}Q45 48.6 50 50.6Q55 52.6 61 50.4V60H3Z`);
  let o = '';
  for (let x = 17; x < 51; x += 7) o += `M${x} ${f(q(x, 38, 58, 36) + 1)}L${x - 3.5} 55.5`;
  s += L(o, 1.6) + L('M4.5 57.5q1.5-1.4 3 0t3 0M17 58.3q1.5-1.4 3 0t3 0t3 0M46 56.6q1.5-1.4 3 0t3 0t3 0', 1.2);
  add('longship', 'Viking longship with striped sail and shields', s); }

// ---------- dig-site
{ let s = '';
  const w1 = 'Q7 35 12 37Q20 40 30 37.5Q38 35 46 37Q54 39.5 61 37.5', w2 = 'Q52 55 44 52.5Q34 50 24 53Q12 55.5 3 52.5';
  const tr = (cx, cy, deg) => { const a = deg * Math.PI / 180; return (x, y) => `${f(cx + x * Math.cos(a) - y * Math.sin(a))} ${f(cy + x * Math.sin(a) + y * Math.cos(a))}`; };
  const T = tr(45, 45, -22), U = tr(18, 45, 10);
  const bone = `M${T(-5.5, -1.3)}L${T(5.5, -1.3)}A2.2 2.2 0 1 1 ${T(8.5, 0)}A2.2 2.2 0 1 1 ${T(5.5, 1.3)}L${T(-5.5, 1.3)}A2.2 2.2 0 1 1 ${T(-8.5, 0)}A2.2 2.2 0 1 1 ${T(-5.5, -1.3)}Z`;
  const pot = 'M-4 -7.4L4 -7.4Q4.8 -7.4 4.8 -6.6Q4.8 -5.8 4 -5.8L2.6 -5.8L2.6 -4.2Q7.2 -2.6 7.2 1.6Q7.2 6.6 0 6.6Q-7.2 6.6 -7.2 1.6Q-7.2 -2.6 -2.6 -4.2L-2.6 -5.8L-4 -5.8Q-4.8 -5.8 -4.8 -6.6Q-4.8 -7.4 -4 -7.4Z'.replace(/(-?[\d.]+) (-?[\d.]+)/g, (m, x, y) => U(+x, +y));
  s += P('t-a', 'M3 30H61V37.5Q54 39.5 46 37Q38 35 30 37.5Q20 40 12 37Q7 35 3 37Z');
  s += P('t-b', 'M3 37' + w1 + 'V52.5' + w2 + 'Z' + bone + pot, ' fill-rule="evenodd"');
  s += P('t-c', bone) + P('t-a', pot);
  s += L(`M${U(-6.6, 0)}L${U(-3.3, 2.4)}L${U(0, 0)}L${U(3.3, 2.4)}L${U(6.6, 0)}`, 1.2);
  s += P('t-c', 'M3 52.5Q12 55.5 24 53Q34 50 44 52.5Q52 55 61 52.5V58Q61 61 58 61H6Q3 61 3 58Z');
  s += P('t-b', circ(10, 57.5, 1.6) + circ(30, 57, 1.2) + circ(50, 57.8, 1.8) + circ(39, 58.8, 1) + circ(20, 33.5, 1) + circ(51, 33, 1.2));
  s += `<g transform="translate(14 24.2) rotate(18)">` + P('t-b', cap(-12, 0, -4, 0, 3.6)) + R('t-b', -4.5, -0.7, 3, 1.4) + P('t-a', 'M-2.5 -0.7L0.5 -5.5L15 0L0.5 5.5L-2.5 0.7Z') + L('M1 0H10', 1.2) + '</g>';
  s += `<g transform="translate(50 24.6) rotate(160)">` + P('t-a', cap(-11.5, 0, -5, 0, 3.4)) + R('t-b', -5, -3, 4, 6, 0.8) + P('t-c', 'M-1 -3.6H5Q6.5 -3.6 6.5 -2V2Q6.5 3.6 5 3.6H-1Z') + L('M1.5 -2.2V2.2M4 -2.2V2.2', 1) + '</g>';
  s += P('t-c', spark(32, 10, 3.5) + spark(56, 8, 2.5));
  add('dig-site', 'excavation layers with buried pot, bone and tools', s); }

// ---------- camel
{ let s = '';
  s += P('t-c', 'M1 61Q12 50 28 54Q44 58.5 63 51.5V61Z');
  s += P('t-b', limb([[38, 36], [40, 46], [39, 55]], 3) + limb([[18, 36], [21, 46], [24, 54.5]], 3));
  s += P('t-a', limb([[42, 36], [45, 46], [48, 55.5]], 3.2) + limb([[16, 36], [13.5, 46], [11, 53.5]], 3.2));
  s += P('t-a', 'M12 28Q14 19 23 14.5Q28.5 11 33 14.5Q37 18.5 42 23.5Q46 27.5 49 24.5Q50.5 22 51 15.5Q52 10.5 56 10L61 11Q63 12 62.5 14.5L58.5 16Q56 17 55.5 20Q55 28 50 33Q47 36 44 38L43 39.5Q30 42.5 18 40Q12 38 12 28Z' + circ(57.6, 12.6, 0.9), ' fill-rule="evenodd"');
  s += P('t-a', rpoly([[53.5, 11], [54.5, 7.5], [56.5, 10]], 0.6));
  s += L('M12.5 29Q9.5 33 10.5 38', 1.6);
  const band = (cx, cy, rx, ry, y0, y1) => { const w = y => rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)); return `M${f(cx - w(y0))} ${f(y0)}H${f(cx + w(y0))}A${rx} ${ry} 0 0 1 ${f(cx + w(y1))} ${f(y1)}H${f(cx - w(y1))}A${rx} ${ry} 0 0 1 ${f(cx - w(y0))} ${f(y0)}Z`; };
  let bb = '', bc = '';
  for (const [cx, cy] of [[21, 29], [34.5, 29.5]]) for (let i = 0; i < 5; i++) { const d = band(cx, cy, 6.6, 8, cy - 8 + i * 3.2, cy - 8 + (i + 1) * 3.2); if (i % 2) bc += d; else bb += d; }
  s += P('t-b', bb) + P('t-c', bc);
  s += L('M21 21.3Q27.5 15 34.5 21.8', 1.4);
  s += L('M40.6 28.5L42.6 32.6', 1.1);
  s += P('t-b', 'M40.6 32.4H44.6L45.6 34.2H39.6Z' + 'M40 34.2H45.2V41.4Q45.2 42 44.6 42H40.6Q40 42 40 41.4ZM41.3 35.4V40.6H43.9V35.4Z', ' fill-rule="evenodd"');
  s += P('t-c', spark(8, 9, 3.5) + spark(44, 5, 2.5));
  add('camel', 'laden camel with striped bundles and lantern', s); }

// ---------- factory
{ let s = '';
  s += P('t-c', circ(15.5, 7.5, 3.4) + circ(21, 5, 3.8) + circ(27, 5.5, 3) + circ(31, 12, 3.2) + circ(36.5, 9.5, 4) + circ(43, 9, 4.2) + circ(49.5, 10, 3.4) + circ(54.5, 12, 2.6));
  let t = '', g = '';
  for (let i = 0; i < 4; i++) { const x = 4 + i * 14; t += `M${x} 34V23.5L${x + 14} 34Z`; g += `M${x + 1} 34V25.6L${x + 4} 27.8V34Z`; }
  s += P('t-a', t + g, ' fill-rule="evenodd"') + P('t-c', g);
  let w = '', m = '';
  for (const x of [11, 25, 39, 53]) { w += `M${x - 3.5} 52V43.5A3.5 3.5 0 0 1 ${x + 3.5} 43.5V52Z`; m += `M${x} 40.5V52M${x - 3.5} 46H${x + 3.5}`; }
  s += P('t-a', 'M4 36H60V58H4Z' + w, ' fill-rule="evenodd"') + P('t-c', w) + L(m, 1.2);
  s += P('t-b', 'M3 33.5H61V36.5H3ZM3 57H61V60.5H3Z');
  s += P('t-b', 'M9.5 34L10.3 11H15.7L16.5 34ZM23.5 34L24.3 15H29.7L30.5 34Z' + 'M9.2 9.5H16.8V12.3H9.2ZM23.2 13.5H30.8V16.3H23.2Z');
  s += P('t-b', 'M19 39.5h3v1.6h-3zM45 54h3v1.6h-3zM31.5 53h3v1.6h-3zM5.5 38.5h3v1.6h-3zM57 41h2.5v1.6h-2.5z');
  s += P('t-c', spark(57, 4.5, 3));
  add('factory', 'brick factory with sawtooth roof and smoking chimneys', s); }
// ---------- steam-train
{
  let s = '';
  s += P('t-b', 'M1.5 55H62.5V57.5H1.5Z');
  let sl = ''; for (let x = 3; x < 60; x += 7) sl += `M${x} 57.5h4v3h-4Z`; s += P('t-a', sl);
  s += P('t-c', circ(46, 8.5, 5.5) + circ(37.5, 6.5, 4.8) + circ(30, 9, 3.6) + circ(24, 10.5, 2.4));
  const win = 'M9.5 23H18V31H9.5Z', stripe = 'M23.5 27.3H48.5V29.3H23.5Z';
  s += P('t-a', 'M6 19H22V41H6Z' + win, ' fill-rule="evenodd"') + P('t-c', win);
  s += P('t-b', rpoly([[3.5, 15.5], [24.5, 15.5], [24.5, 19.5], [3.5, 19.5]], 1.5) + 'M21.5 19H23.5V40H21.5Z');
  s += P('t-a', 'M23.5 25.5H50V40H23.5Z' + stripe, ' fill-rule="evenodd"') + P('t-c', stripe);
  s += P('t-b', 'M31 25.5H33.2V40H31ZM40.5 25.5H42.7V40H40.5Z');
  s += P('t-a', 'M32 25.5Q32 20.5 36.5 20.5Q41 20.5 41 25.5Z' + 'M41.5 11H52.5L50 17V25.5H44V17Z');
  s += P('t-b', 'M41.5 11H52.5L51.7 13.2H42.3Z' + rpoly([[49, 24], [54.5, 24], [54.5, 41], [49, 41]], 2) + 'M4.5 39.5H57V42.5H4.5Z' + 'M53 41.5H56V54.5H53Z');
  s += L('M55 42L61.3 54M55 42L58 54', 2.2);
  const wheel = (x, y, r, n) => {
    let sp = ''; for (let i = 0; i < n; i++) { const a = i * Math.PI / n; sp += `M${f(x + (r - 2) * Math.cos(a))} ${f(y + (r - 2) * Math.sin(a))}L${f(x - (r - 2) * Math.cos(a))} ${f(y - (r - 2) * Math.sin(a))}`; }
    return P('t-b', circ(x, y, r) + circ(x, y, r - 2), ' fill-rule="evenodd"') + C('t-c', x, y, r - 2) + L(sp, 1.3) + C('t-b', x, y, 2);
  };
  s += wheel(15.5, 46.5, 8.5, 4) + wheel(34, 46.5, 8.5, 4) + wheel(48, 50, 5, 2);
  s += P('t-a', cap(15.5, 50.5, 34, 50.5, 2.6));
  s += P('t-c', spark(9, 8, 4) + spark(58.5, 31, 3));
  add('steam-train', 'steam locomotive puffing on a track', s);
}

// ---------- windmill
{
  let s = '';
  s += P('t-b', 'M1 55.5Q16 54 32 57Q48 59.5 63 54V62.5H1Z');
  const win = 'M30.2 32.5a1.8 1.8 0 0 1 3.6 0V36H30.2Z';
  s += P('t-a', 'M24.5 26H39.5L45.5 58H18.5Z' + win, ' fill-rule="evenodd"') + P('t-c', win);
  s += P('t-b', 'M36.5 26H39.5L45.5 58H41.5Z' + 'M27.5 57V49a4.5 4.5 0 0 1 9 0V57Z');
  s += P('t-a', 'M21 27Q21 16 32 16Q43 16 43 27Z');
  s += P('t-b', 'M20 26.5H44V29H20Z');
  s += P('t-c', 'M24 25Q24.5 20 29.5 19.3Q26.3 21.5 26 25Z');
  let sail = 'M1 -8H10V-24.5H1Z';
  for (let r = 0; r < 4; r++) { const y = -9.2 - r * 3.85; for (const [x, w] of [[2.2, 3.1], [6.5, 2.3]]) sail += `M${f(x)} ${f(y)}h${f(w)}v-2.65h${f(-w)}Z`; }
  for (const a of [45, 135, 225, 315]) s += `<g transform="translate(32 26) rotate(${a})">` + P('t-b', sail + 'M-1 -1.5H1.2V-25.5H-1Z', ' fill-rule="evenodd"') + '</g>';
  s += P('t-b', circ(32, 26, 3.4) + circ(32, 26, 1.4), ' fill-rule="evenodd"');
  s += P('t-c', spark(55, 41, 3.5) + spark(9, 42, 3));
  add('windmill', 'tower windmill with lattice sails', s);
}

// ---------- covered-wagon
{
  let s = '';
  // dust trail
  s += P('t-c', circ(6.5, 54.5, 3.8) + circ(3.3, 49, 2.4) + circ(3.5, 59, 2.3) + circ(8.5, 47.5, 1.6) + circ(2.4, 54.2, 1.3));
  // canvas cover with hoops
  s += P('t-c', 'M12 35Q7 21 12.5 9.5Q22 13.5 32 13Q42 13.5 51.5 9.5Q57 21 52 35Z');
  s += P('t-b', 'M21 13.2Q19 24 21 35H23.5Q21.5 24 23.5 13.6Z' + 'M30.8 13V35H33.2V13Z' + 'M40.5 13.6Q42.5 24 40.5 35H43Q45 24 43 13.2Z');
  s += P('t-a', 'M10.3 31.3H53.7L52.6 35H11.4Z');
  // tongue
  s += L('M52 43L62 47.5', 2.2);
  // box with barrel gap cut
  const gap = 'M29 36Q33.5 34 38 36Q39.5 42 38 48Q33.5 50 29 48Q27.5 42 29 36Z';
  s += P('t-a', 'M11 34H54L52.5 46H12.5Z' + gap, ' fill-rule="evenodd"');
  s += P('t-b', 'M11.5 39H28V40.6H11.5ZM39 39H53.5V40.6H39ZM12 43.5H28V46H12.5ZM39 43.5H53V46H39Z');
  // barrel
  s += P('t-a', 'M30 37Q33.5 35.5 37 37Q38.2 42 37 47Q33.5 48.5 30 47Q28.8 42 30 37Z');
  s += P('t-b', 'M29.3 39.3H37.7V41H29.3ZM29.3 43.3H37.7V45H29.3Z');
  // wheels
  const wheel = (x, y, r, n) => {
    let sp = ''; for (let i = 0; i < n; i++) { const a = i * Math.PI / n; sp += `M${f(x + (r - 2) * Math.cos(a))} ${f(y + (r - 2) * Math.sin(a))}L${f(x - (r - 2) * Math.cos(a))} ${f(y - (r - 2) * Math.sin(a))}`; }
    return P('t-b', circ(x, y, r) + circ(x, y, r - 2.2), ' fill-rule="evenodd"') + L(sp, 1.4) + C('t-b', x, y, 2.4);
  };
  s += wheel(19.5, 48.5, 9.5, 4) + wheel(46.5, 50, 8, 4);
  s += P('t-c', spark(57, 18, 3.5));
  add('covered-wagon', 'pioneer covered wagon with canvas top', s);
}

// ---------- window
{
  let s = '';
  // frame and sill
  s += P('t-c', 'M14.5 10.5H49.5V49H14.5ZM11 48.5H53V53H11Z');
  s += P('t-b', 'M11.5 53H52.5L51 55H13Z');
  // panes (sky) with clouds cut
  const cl = 'M35.5 25Q34 25 34 23.5Q34 22 36 22Q36.5 19 39.5 19Q42.5 19 43 22Q45 22 45 23.5Q45 25 43.5 25ZM20 20.5Q19 20.5 19 19.3Q19 18 20.5 18Q21 16 23 16Q25 16 25.5 18Q27 18 27 19.3Q27 20.5 26 20.5Z';
  s += P('t-a', 'M18 14H31V29H18ZM33 14H46V29H33ZM18 31.5H31V46H18ZM33 31.5H46V46H33Z' + cl, ' fill-rule="evenodd"') + P('t-c', cl);
  // potted plant
  s += P('t-b', 'M31.3 45Q25 43.5 25 36Q30 37.5 31.3 43ZM32.7 45Q39 43.5 39 36Q34 37.5 32.7 43ZM32 44Q28.3 38 32 32.5Q35.7 38 32 44ZM27.5 43.5H36.5L35.3 50H28.7Z');
  s += R('t-a', 27, 43.5, 10, 2);
  // rod with finials
  s += P('t-b', 'M3.5 5.8H60.5V7.8H3.5Z' + circ(3.2, 6.8, 2.4) + circ(60.8, 6.8, 2.4));
  // curtain with rings, dots and tie-back, mirrored on the right
  const cur = P('t-a', 'M4.5 9.3H17.8Q16.5 24 10.5 33Q15 44 16.5 57.5H5Q7 45 6.5 33Q4 22 4.5 9.3Z') +
    P('t-b', circ(9, 15, 1.1) + circ(13.5, 19, 1.1) + circ(8.5, 24, 1.1) + circ(11, 43, 1.1) + circ(9, 51, 1.1) + circ(13.5, 51, 1.1) + cap(5.5, 32.3, 12, 33.5, 3)) +
    L('M5 7.6a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M9.7 7.6a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M14.4 7.6a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0', 1.1);
  s += cur + `<g transform="matrix(-1 0 0 1 64 0)">${cur}</g>`;
  s += P('t-c', spark(32, 59.3, 3));
  add('window', 'curtained window with sky and potted plant', s);
}

// ---------- door
{
  let s = '';
  // brick wall strip around the doorway
  let br = '';
  for (let r = 0; r < 11; r++) {
    const y = 4 + r * 4.6, off = r % 2 ? -4 : 0;
    for (let x = 3 + off; x < 61; x += 8.4) {
      const x0 = Math.max(x, 3), x1 = Math.min(x + 7.4, 61);
      if (x1 - x0 < 2) continue;
      const pts = [[x0, y], [x1, y], [x0, y + 3.6], [x1, y + 3.6], [(x0 + x1) / 2, y + 3.6], [(x0 + x1) / 2, y]];
      if (pts.some(([px, py]) => (px > 15.5 && px < 48.5 && py > 27) || Math.hypot(px - 32, py - 27) < 16.5)) continue;
      br += `M${f(x0)} ${f(y)}H${f(x1)}V${f(y + 3.6)}H${f(x0)}Z`;
    }
  }
  s += P('t-a', br);
  // surround, fan window and door leaf
  s += P('t-b', 'M17 54V27A15 15 0 0 1 47 27V54ZM20 54V27A12 12 0 0 1 44 27V54Z' + 'M20 27H44V29H20Z', ' fill-rule="evenodd"');
  s += P('t-c', 'M20 27A12 12 0 0 1 44 27Z');
  s += L('M32 27V16M32 27L23.5 18.5M32 27L40.5 18.5', 1.4);
  s += P('t-a', 'M20 29H44V54H20Z');
  s += L('M23 32H29.8V37.7H23ZM34.2 32H41V37.7H34.2ZM23 46.6H29.8V51.4H23ZM34.2 46.6H41V51.4H34.2Z', 1.3);
  // solid brass knob and a knocker hung on the middle rail
  s += P('t-b', circ(40.3, 42.6, 1.9));
  s += P('t-b', 'M30.9 39.5H33.1V40.8H30.9Z' + circ(32, 42.7, 2.2) + circ(32, 42.7, 1.1), ' fill-rule="evenodd"');
  // step and mat
  s += P('t-c', 'M12.5 54H51.5V58H12.5Z');
  s += P('t-b', 'M13 58H51L49.5 60H14.5Z' + 'M21.5 54.6H42.5L44 57.4H20Z');
  s += P('t-c', spark(57, 59, 3));
  add('door', 'arched front door in a brick wall', s);
}
// ---------- mop-bucket
{
  let s = '';
  // bucket bail behind
  s += L('M11.5 36Q12 17 30 17Q48 17 48.5 36', 2.2);
  // mop handle
  s += P('t-a', cap(33, 34, 49, 4.5, 4.2));
  s += P('t-b', 'M35.2 34.6L50.6 5.8Q51.4 7.6 50.6 9.2L36.8 34.6Z');
  s += P('t-c', cap(33.6, 27.6, 46.4, 4.2, 1.1));
  s += P('t-b', cap(46.4, 10, 49.4, 4.4, 5));
  // strings draped over the rim
  s += P('t-a', 'M40 31Q50 29 55 33Q60.5 37.5 59.5 44Q58.5 49 61 54Q61.5 57 60 57L58.4 54.6L56.6 58L54.8 54.8L52.8 58.4L51 54.8L49 57.6L47.4 54Q50 48 47.6 42Q46 37 41 35Z');
  s += P('t-b', 'M50 31.5Q57 33 58.5 39Q59.5 44 58 48Q57.5 52 61 54Q61.5 57 60 57L58.4 54.6L56.6 58L54.8 54.8Q53 50 55 45Q57 37 50 31.5Z');
  s += L('M44.5 33Q51.5 38 50 46Q49 51 51 54.8M47.5 32.5Q55 37 53.5 46Q52.5 51 54.8 54.8M51.5 32Q57.5 37 56.6 45Q56 50 58.4 54.6', 1.2);
  // bucket body with cut highlight and drip holes
  const hl = 'M15.2 41H18L19.8 56H17.4Z' + circ(24, 43, 1.8) + circ(25.5, 48.5, 1.1);
  s += P('t-a', 'M10.5 37H49.5L45.6 58.6Q45.2 61 42.8 61H17.2Q14.8 61 14.4 58.6Z' + hl, ' fill-rule="evenodd"');
  s += P('t-b', 'M41.5 37H49.5L45.6 58.6Q45.2 61 42.8 61H38.5Z');
  s += P('t-b', 'M12 47.5H48L47.4 51H12.6Z');
  s += P('t-c', hl);
  // rim
  s += R('t-b', 8, 33.5, 44, 5, 2.5);
  // foam
  s += P('t-c', circ(13, 32.5, 4.2) + circ(19.5, 29, 5.4) + circ(27, 27, 6) + circ(35, 27.8, 5.4) + circ(41.5, 30, 4.6) + circ(9.5, 37.5, 2.6) + circ(22, 34, 3) + circ(32, 33, 3));
  s += L('M17 31.5A3 3 0 0 1 20 28.5M25 28A3.4 3.4 0 0 1 28.5 24.6', 1.4);
  s += P('t-c', circ(9, 42.5, 1.6) + circ(5.5, 26, 2) + circ(10, 22.5, 1.3));
  s += P('t-c', spark(12, 9, 4.5) + spark(57, 22, 3.2));
  add('mop-bucket', 'string mop in a soapy bucket', s);
}

// ---------- paint-roller
{
  let s = '';
  // fresh horizontal stripe across the wall, streaks cut out
  const streak = 'M8 15.4H28V16.8H8ZM13 25H29V26.4H13Z';
  s += P('t-b', 'M5 11Q9 9.6 13 10.6T22 10T31 10.4L36 10V32L31 31.6Q26 32.6 21 31.8T12 32.2L7 31.4Q8.5 28 6 26Q8 22 4.6 20Q7 16 3.8 13.6Z' + streak, ' fill-rule="evenodd"');
  s += P('t-c', streak);
  const drip = (x, y, l) => `M${x - 1.3} ${y}V${y + l}A1.3 1.3 0 0 0 ${x + 1.3} ${y + l}V${y}Z`;
  s += P('t-b', drip(15, 31, 3.4) + drip(26.5, 31, 5) + circ(26.5, 39.6, 1.2) + circ(2.4, 22.5, 1.3));
  // fluffy sleeve, rolled sideways
  let lft = '', rgt = '';
  for (let y = 8.5; y < 33; y += 3.5) rgt += `Q47.6 ${f(y + 1.75)} 45.4 ${f(y + 3.5)}`;
  for (let y = 33.5; y > 9; y -= 3.5) lft += `Q31.4 ${f(y - 1.75)} 33.6 ${f(y - 3.5)}`;
  s += P('t-a', 'M33.6 8.5Q34 5.4 39.5 5.4Q45 5.4 45.4 8.5' + rgt + 'Q45 36.6 39.5 36.6Q34 36.6 33.6 33.5' + lft + 'Z');
  s += P('t-b', 'M42.6 6Q45 6.6 45.4 8.5' + rgt + 'Q45 36 42.6 36.4Z');
  s += P('t-c', cap(37, 9.5, 37, 29.5, 1.6));
  // frame and handle
  s += L('M39.5 36.6V39Q39.5 40.6 41.5 40.6H47.5Q49.5 40.6 50 42.6', 2.4);
  s += P('t-a', cap(49.4, 42, 51, 44.6, 4));
  s += P('t-b', cap(51, 44.6, 59.4, 58.6, 5.6));
  s += P('t-c', cap(52.2, 47.8, 56.4, 55, 1.2));
  // shallow open tray: raised lip round the opening, short front face
  s += P('t-a', 'M9.4 44H40.6Q42.2 44 42.8 45.5L46.4 53.5Q47 55.4 45 55.4H4.6Q2.6 55.4 3.2 53.5L7.2 45.5Q7.8 44 9.4 44ZM9.5 45.6H40.4L44 53.8H5.7Z', ' fill-rule="evenodd"');
  s += P('t-b', 'M5.4 55.4H44.2L43 57.9H6.8Z');
  // pool of the same colour in the deep left well, glint cut out
  const gl = 'M11.6 51.4l4.4-.6v1.1l-4.4.6Z';
  s += P('t-b', 'M9.8 49.2H22.6Q24.4 51 21.4 53.2H7.4Z' + gl, ' fill-rule="evenodd"');
  s += P('t-c', gl);
  // ramp rising to the back right, ridges cut out across the slope
  let rg = '';
  for (const x of [26.5, 30.5, 34.5, 38.5]) {
    const y0 = 50 - (x - 22.5) * .164, x1 = x + (x - 25.4) * .025 * (52.4 - y0);
    rg += `M${f(x)} ${f(y0)}L${f(x1)} 52.4h1.1L${f(x + 1.1)} ${f(y0)}Z`;
  }
  s += P('t-a', 'M23.2 49.2L40 46.4L43.1 53.2H22.4Q25.2 51 23.2 49.2Z' + rg, ' fill-rule="evenodd"');
  s += P('t-c', spark(55, 11, 4.5) + spark(57.5, 26, 3));
  add('paint-roller', 'paint roller, fresh stripe and paint tray', s);
}

// ---------- fire-helmet
{
  let s = '';
  // badge (frontispiece) geometry, shared by the dome hole and the badge itself
  const shield = (k) => {
    const cx = 43.5, cy = 27, p = (x, y) => `${f(cx + (x - cx) * k)} ${f(cy + (y - cy) * k)}`;
    return `M${p(43.5, 13)}Q${p(46, 13)} ${p(47, 15.6)}L${p(50, 16.6)}Q${p(51, 27)} ${p(49, 34)}Q${p(47.2, 39.4)} ${p(43.5, 42.6)}Q${p(39.8, 39.4)} ${p(38, 34)}Q${p(36, 27)} ${p(37, 16.6)}L${p(40, 15.6)}Q${p(41, 13)} ${p(43.5, 13)}Z`;
  };
  const I = shield(1), hl = 'M17.5 32Q17 16 27 11.6Q21.6 17.6 21 32Z';
  // long brim sloping down at the back
  s += P('t-a', 'M63 39.6Q55 40 46 43.2Q28 44 12.6 40.4Q5.6 43.4 2.2 53.4Q1.6 58 6.4 57.6Q34 55.4 60 45.4Q63.8 43 63 39.6Z');
  s += P('t-b', 'M2.2 53.4Q1.6 58 6.4 57.6Q34 55.4 60 45.4Q63.8 43 63 39.6Q62.4 42.6 58.8 43.8Q33 51.8 6 54.8Q3.6 55 2.2 53.4Z');
  s += P('t-b', 'M11.6 40.8Q6 44 4 50.6Q8 46 12.6 45Z');
  // high dome, badge and highlight cut out
  s += P('t-a', 'M12 44.5Q11 7.5 35 7Q59 7.5 57.5 42Q34 47.6 12 44.5Z' + I + hl, ' fill-rule="evenodd"');
  s += P('t-b', 'M57.5 36Q57.8 40 57.5 42Q34 47.6 12 44.5Q11.8 42 12 39.6Q34 43 57.5 36Z');
  s += P('t-c', hl);
  // comb ridge and ribs
  s += L('M42 15Q33 3.6 22 11Q13.5 18 13.6 40', 3.4);
  s += L('M39 24Q26 20 20.6 41.6M38.6 33Q30 32 27.6 43.6', 1.4);
  // gold shield badge with a cross
  s += P('t-b', shield(1.16) + I, ' fill-rule="evenodd"');
  s += P('t-c', I);
  const mx = (cx, cy, r) => `M${f(cx - 2)} ${f(cy - r)}H${f(cx + 2)}L${f(cx)} ${f(cy - 1)}ZM${f(cx - 2)} ${f(cy + r)}H${f(cx + 2)}L${f(cx)} ${f(cy + 1)}ZM${f(cx - r)} ${f(cy - 2)}V${f(cy + 2)}L${f(cx - 1)} ${f(cy)}ZM${f(cx + r)} ${f(cy - 2)}V${f(cy + 2)}L${f(cx + 1)} ${f(cy)}Z`;
  s += P('t-b', mx(43.5, 26.5, 5.2) + circ(43.5, 26.5, 1.6) + circ(43.5, 17.4, 1.2) + circ(43.5, 36.4, 1.2));
  s += P('t-c', spark(8, 14, 4.2) + spark(58, 13, 3.4));
  add('fire-helmet', "firefighter's helmet with a shield badge", s);
}

// ---------- police-badge
{
  let s = '';
  const sh = (k) => {
    const p = (x, y) => `${f(32 + (x - 32) * k)} ${f(33 + (y - 33) * k)}`;
    return `M${p(32, 9)}Q${p(36.4, 9)} ${p(37.4, 13.4)}L${p(46, 13)}Q${p(48.8, 12.8)} ${p(48.6, 15.6)}Q${p(46.8, 20)} ${p(48.6, 25)}Q${p(50.6, 33)} ${p(46.2, 41)}Q${p(41, 51)} ${p(32, 58.2)}Q${p(23, 51)} ${p(17.8, 41)}Q${p(13.4, 33)} ${p(15.4, 25)}Q${p(17.2, 20)} ${p(15.4, 15.6)}Q${p(15.2, 12.8)} ${p(18, 13)}L${p(26.6, 13.4)}Q${p(27.6, 9)} ${p(32, 9)}Z`;
  };
  const B = sh(1), Bi = sh(.87);
  // navy shirt pocket with flap, badge cut out
  s += P('t-a', rpoly([[9, 5], [55, 5], [55, 52], [48.5, 60.5], [15.5, 60.5], [9, 52]], 2.5) + B, ' fill-rule="evenodd"');
  s += P('t-b', 'M9 18.6L17 21.4V24.6L9 21.8ZM55 18.6L47 21.4V24.6L55 21.8Z');
  s += L('M12 25V50.6L16.8 56.8H27.5M36.5 56.8H47.2L52 50.6V25', 1.2);
  s += L('M12 8V16.6M52 8V16.6', 1.2);
  // silver shield with a star in a blue enamel centre
  s += P('t-c', B);
  s += P('t-b', B + Bi, ' fill-rule="evenodd"');
  const st = star(32, 31.5, 6.6, 2.8);
  s += P('t-b', circ(32, 31.5, 10) + 'M' + st.map(([x, y]) => f(x) + ' ' + f(y)).join('L') + 'Z', ' fill-rule="evenodd"');
  s += P('t-b', 'M22 44.4Q32 41 42 44.4L40.6 48.4Q32 45.6 23.4 48.4Z' + circ(32, 15.4, 1.6));
  s += P('t-c', spark(4.6, 56, 3) + spark(59.4, 59.4, 3.2));
  add('police-badge', 'star police badge on a shirt pocket', s);
}

// ---------- hair-dryer
{
  let s = '';
  // cord curling from the handle
  s += L('M20 52Q20.5 57 16 58.4Q11 59.6 10.4 55Q10 51.4 13.4 51.6Q16.4 52 15 56Q13 61 7 60.6Q3.6 60.2 3.6 56.6', 2.2);
  // handle
  s += P('t-a', cap(27, 25, 20.6, 50, 9.4));
  s += P('t-b', 'M31.6 26L25.2 51.2Q24.2 54.4 20.2 54.4Q23 53 22.6 50.4L28 26Z');
  s += P('t-b', cap(22.8, 34.4, 21.4, 40, 3.4));
  s += P('t-b', cap(20.2, 52, 19.8, 54.6, 4.4));
  // barrel with highlight cut out
  const hl = cap(22, 11.4, 38, 11.4, 2.4);
  s += P('t-a', 'M17 6.6H38Q42.4 6.6 44.4 11H48.8Q51.2 11 51.2 13.4V22.6Q51.2 25 48.8 25H44.4Q42.4 29.4 38 29.4H17A11.4 11.4 0 0 1 17 6.6Z' + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', 'M17 24.6H40.6Q39.8 29.4 36 29.4H17Q14.6 29.4 12.6 28.6Z');
  s += P('t-b', 'M44.4 11H48.8Q51.2 11 51.2 13.4V22.6Q51.2 25 48.8 25H44.4Q45.4 18 44.4 11Z');
  // round vent at the back
  let vh = circ(14.6, 18, 1.5);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; vh += circ(14.6 + 4.4 * Math.cos(a), 18 + 4.4 * Math.sin(a), 1.2); }
  s += P('t-b', circ(14.6, 18, 7.6) + vh, ' fill-rule="evenodd"');
  // warm air
  s += L('M54 10.4Q56 7.8 58 10.4T62 9.4M54 18Q56 15.4 58 18T62 18M54 25.6Q56 23 58 25.6T62 26.6', 2.2);
  // wide-tooth comb beside it
  let g = R('t-a', -14, -4, 28, 6, 3);
  let t = '';
  for (let i = 0; i < 6; i++) t += cap(-11 + i * 4.4, 1, -11 + i * 4.4, 11.5, 2.6);
  g += P('t-a', t);
  g += P('t-b', 'M-14 0H14V1.6Q14 2 13.6 2H-13.6Q-14 2 -14 1.6Z');
  g += R('t-c', -10, -2.6, 16, 1.4, .7);
  s += `<g transform="translate(46.5 47) rotate(-14)">${g}</g>`;
  s += P('t-c', spark(58.5, 34, 3.6) + spark(6, 38, 3));
  add('hair-dryer', 'hair dryer blowing warm air, with a comb', s);
}
// ---------- pet-cone
{
  let s = '';
  // tail
  s += P('t-a', limb([[16, 57], [9, 52], [7, 44]], 4.4));
  // body with bandage cut
  const band = cap(47.6, 46, 54.2, 42.4, 9);
  s += P('t-a', 'M25 30Q21 38 20 46Q14 50 13.5 56Q13.5 61 19 61H45Q50.5 61 50.5 56Q50 50 44 46Q43 38 39 30Z' + band, ' fill-rule="evenodd"');
  s += P('t-b', 'M20.5 49Q14.5 51 14.2 56Q14 60.5 19 60.5H22Q25 54 20.5 49ZM43.5 49Q49.5 51 49.8 56Q50 60.5 45 60.5H42Q39 54 43.5 49Z');
  // front legs
  s += P('t-a', cap(28, 38, 27.5, 57.5, 7.4));
  s += P('t-a', cap(36.5, 39, 45.5, 46.6, 7) + band, ' fill-rule="evenodd"');
  s += P('t-b', 'M31.6 41V55Q33 52 33 47Q33 43 31.6 41Z');
  // bandage
  s += P('t-c', band);
  s += L('M46.4 41.6L49.6 49.8M50 40L53.4 48.2', 1.2);
  s += P('t-b', 'M51.6 46.7Q48.4 44.6 48.8 43Q49.3 41.6 51 42.6Q51.7 40.8 53 41.5Q54.2 42.6 51.6 46.7Z');
  // translucent cone: rim opening plus funnel walls down to the collar
  const cx = 32, cy = 19, rx = 23, ry = 15, nx = 8, ny = 40;
  const pt = a => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  let ta = Math.PI / 2;
  for (let a = Math.PI / 2; a < Math.PI; a += .01) { const [x, y] = pt(a); if ((x - (cx - nx)) * (-ry * Math.cos(a)) - (y - ny) * (-rx * Math.sin(a)) < 0) { ta = a; } }
  const [tx, ty] = pt(ta);
  const rim = `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
  s += P('t-c', rim + `M${f(tx)} ${f(ty)}L${f(cx - nx)} ${ny}Q${cx} ${ny + 3.5} ${f(cx + nx)} ${ny}L${f(2 * cx - tx)} ${f(ty)}Z`);
  let pl = '';
  for (const k of [-.75, -.4, 0, .4, .75]) pl += `M${f(cx + k * 19)} ${f(cy + ry * Math.sqrt(1 - (k * 19 / rx) ** 2))}L${f(cx + k * 7)} ${f(ny + 1.4 - 1.2 * k * k)}`;
  for (let i = 0; i < 8; i++) { const a = (i * 45 - 112.5) * Math.PI / 180; pl += `M${f(cx + 12 * Math.cos(a))} ${f(cy + 1 + 11 * Math.sin(a))}L${f(cx + (rx - 1.3) * Math.cos(a))} ${f(cy + (ry - 1.3) * Math.sin(a))}`; }
  s += L(pl, 1.1);
  // head
  const muz = 'M26 25Q26 20.5 32 20.5Q38 20.5 38 25Q38 29.5 32 29.5Q26 29.5 26 25Z';
  s += P('t-a', circ(32, 19.5, 10.2) + muz, ' fill-rule="evenodd"');
  s += P('t-c', muz);
  s += P('t-b', 'M23.8 12Q19.5 12 19 17.5Q18.5 24 21 28Q23 30 24.8 27Q23.8 22.5 24.8 17.5ZM40.2 12Q44.5 12 45 17.5Q45.5 24 43 28Q41 30 39.2 27Q40.2 22.5 39.2 17.5Z');
  s += E('t-b', 32, 23, 2.8, 2);
  s += L('M32 25V26.6M29.6 27Q32 28 34.4 27', 1.2);
  s += C('t-b', 28, 17.6, 1.8) + C('t-b', 36, 17.6, 1.8);
  s += L('M26 14.2L29.6 13.2M38 14.2L34.4 13.2', 1.3);
  s += L(rim, 2.2);
  s += P('t-c', spark(58.5, 6, 3.6) );
  add('pet-cone', 'dog in a recovery cone with bandaged paw', s);
}

// ---------- tractor
{
  let s = '';
  // smoke puffs and exhaust
  s += P('t-c', circ(47.5, 11.5, 2.8) + circ(43.5, 7.5, 3.6) + circ(38, 5.5, 3.4) + circ(32.5, 6, 2.6));
  s += P('t-b', cap(47, 34, 47, 17, 3.2));
  s += R('t-b', 45, 15.5, 4, 2.4, 1);
  // cab: seat, steering wheel
  s += P('t-b', rpoly([[11, 11], [16, 10.5], [18, 25], [12, 25]], 2));
  s += P('t-b', rpoly([[13, 21], [27, 21], [27, 25.5], [13, 25.5]], 2));
  s += P('t-b', cap(33.5, 34, 28.5, 21, 2.4));
  s += P('t-b', cap(23.5, 22.8, 31, 17.4, 3));
  // bonnet and cowl
  const lamp = 'M55.5 36.5H58.5V40H55.5Z';
  s += P('t-a', rpoly([[29, 27], [36, 27], [37, 33], [60.5, 33], [60.5, 47], [29, 47]], [2, 1, 1, 2.5, 2, 1]) + lamp, ' fill-rule="evenodd"');
  s += P('t-c', lamp);
  s += P('t-b', 'M29 43H60.5V45Q60.5 47 58.5 47H29Z');
  s += L('M40 37H51M40 40H51', 1.4);
  // rear wheel with slanted lugs
  let lug = '';
  for (let i = 0; i < 14; i++) { const a = i * Math.PI / 7; lug += `M${f(19 + 14 * Math.cos(a))} ${f(45 + 14 * Math.sin(a))}L${f(19 + 16.4 * Math.cos(a + .04))} ${f(45 + 16.4 * Math.sin(a + .04))}`; }
  s += P('ln', lug, ' stroke-width="4.4" stroke-linecap="butt"');
  s += P('t-b', circ(19, 45, 14.6) + circ(19, 45, 9.5), ' fill-rule="evenodd"');
  s += P('t-a', circ(19, 45, 9.5) + circ(19, 45, 4), ' fill-rule="evenodd"');
  s += P('t-c', circ(19, 45, 4));
  s += C('t-b', 19, 45, 1.6);
  // fender over the rear wheel
  s += P('t-a', 'M.8 43A18.3 18.3 0 0 1 36.8 41L33.8 41.2A15.3 15.3 0 0 0 3.8 43Z');
  // front wheel
  s += P('t-b', circ(51.5, 53, 8.5) + circ(51.5, 53, 4.6), ' fill-rule="evenodd"');
  s += P('t-a', circ(51.5, 53, 4.6) + circ(51.5, 53, 2), ' fill-rule="evenodd"');
  s += P('t-c', circ(51.5, 53, 2));
  s += P('t-c', spark(58, 22, 3.6));
  add('tractor', 'red farm tractor with a big rear wheel', s);
}

// ---------- cowboy-hat
{
  let s = '';
  // brim: top surface, then the curled-up underside at each tip
  s += P('t-a', 'M2.5 24Q7 34 18 36Q32 34 46 36Q57 34 61.5 24Q62 38 52 45.5Q43 52 32 52Q21 52 12 45.5Q2 38 2.5 24Z');
  s += P('t-b', 'M2.5 24Q2 38 12 45.5Q21 52 32 52Q43 52 52 45.5Q62 38 61.5 24Q59.5 36 50.5 41.5Q42 47 32 47Q22 47 13.5 41.5Q4.5 36 2.5 24Z');
  s += L('M7 31Q11 37 17.5 39M57 31Q53 37 46.5 39', 1.3);
  // crown with star buckle cut through
  const st = rpoly(star(32, 41.6, 3.6, 1.6), .4);
  s += P('t-a', 'M18 40L19.6 16Q20.2 8.5 26 8.2Q29.5 8 32 12.5Q34.5 8 38 8.2Q43.8 8.5 44.4 16L46 40Q32 47 18 40Z' + st, ' fill-rule="evenodd"');
  // front pinch dents and side shade
  s += P('t-b', 'M22.6 13Q25.5 10.5 28.8 13.2Q28.2 20 30.4 27Q24.5 22 22.6 13Z');
  s += P('t-b', 'M41.4 13Q38.5 10.5 35.2 13.2Q35.8 20 33.6 27Q39.5 22 41.4 13Z');
  s += P('t-b', 'M42 12.6Q44.2 14 44.4 16L46 40Q44 41 42.5 41.4Z');
  s += P('t-c', 'M21.6 17.5Q21.7 14 23 13Q23.4 22 26.5 27Q22.2 25 21.6 17.5Z');
  // band
  s += P('t-b', 'M18.4 34Q32 40 45.6 34L46 40Q32 47 18 40Z' + st, ' fill-rule="evenodd"');
  s += P('t-c', st);
  s += P('t-c', spark(8, 9, 4) + spark(56.5, 8, 3));
  add('cowboy-hat', 'cowboy hat with a star buckle', s);
}

// ---------- red-carpet
{
  let s = '';
  const vx = 32, vy = 20, fy = 32, fh = 7, hw = y => fh * (y - vy) / (fy - vy);
  // carpet: a flat-ended trapezoid lying on the floor, darker border strips
  const nb = 62.5, nh = hw(nb);
  s += P('t-a', `M${f(vx - nh)} ${nb}L${vx - fh} ${fy}H${vx + fh}L${f(vx + nh)} ${nb}Z`);
  const ih = hw(33.4) * .8;
  s += P('t-b', `M${f(vx - nh)} ${nb}L${vx - fh} ${fy}H${vx + fh}L${f(vx + nh)} ${nb}H${f(vx + nh * .8)}L${f(vx + ih)} 33.4H${f(vx - ih)}L${f(vx - nh * .8)} ${nb}Z`);
  // gold posts linked by swagged ropes, spaced evenly in depth
  const ks = [1, .625, .455, .357];
  let posts = '', balls = '';
  const ropes = ['', '', ''];
  for (const sd of [-1, 1]) {
    const bx = vx + sd * 27, by = 60.5;
    const pts = ks.map(k => [vx + (bx - vx) * k, vy + (by - vy) * k, k]);
    pts.forEach(([x, y, k], i) => {
      const h = 32 * k, w = 3.8 * k;
      posts += rpoly([[x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y], [x - w / 2, y]], w / 3);
      posts += `M${f(x - 4 * k)} ${f(y + .5)}Q${f(x)} ${f(y - 3 * k)} ${f(x + 4 * k)} ${f(y + .5)}Z`;
      balls += circ(x, y - h - 1.6 * k, 2.8 * k);
      if (i) {
        const [px, py, pk] = pts[i - 1], y1 = py - 26 * pk, y2 = y - 26 * k;
        ropes[i - 1] += `M${f(px)} ${f(y1)}Q${f((px + x) / 2)} ${f(Math.max(y1, y2) + 6 * pk)} ${f(x)} ${f(y2)}`;
      }
    });
  }
  s += L(ropes[0], 2.8) + L(ropes[1], 2) + L(ropes[2], 1.5);
  s += P('t-b', posts);
  s += P('t-c', balls);
  // camera flashes
  s += P('t-c', spark(11, 11, 5.5) + spark(53, 9, 4.6) + spark(32, 16, 3.6) + spark(22, 6, 2.2) + spark(42, 4.5, 2.2));
  add('red-carpet', 'red carpet lined with velvet ropes', s);
}

// ---------- prize-wheel
{
  let s = '';
  const cx = 32, cy = 30, R1 = 21, R0 = 17.6, Rh = 4.6;
  const pt = (r, a) => `${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
  // short stand neck from just under the rim to the base
  s += P('t-b', 'M29.5 50.5H34.5L39 57H25Z');
  s += P('t-a', rpoly([[15, 56], [49, 56], [51, 61.5], [13, 61.5]], 2));
  // motion arcs
  const arc = (r, a0, a1) => `M${pt(r, a0)}A${r} ${r} 0 0 1 ${pt(r, a1)}`;
  const d2r = Math.PI / 180;
  s += L(arc(25, 200 * d2r, 245 * d2r) + arc(25, 20 * d2r, 65 * d2r), 2.2);
  s += L(arc(28.5, 212 * d2r, 236 * d2r) + arc(28.5, 32 * d2r, 56 * d2r), 1.6);
  // wedges in three alternating tones
  const wd = ['', '', ''];
  for (let i = 0; i < 12; i++) {
    const a0 = (i * 30 - 105) * d2r, a1 = a0 + 30 * d2r;
    wd[i % 3] += `M${pt(R0, a0)}A${R0} ${R0} 0 0 1 ${pt(R0, a1)}L${pt(Rh, a1)}A${Rh} ${Rh} 0 0 0 ${pt(Rh, a0)}Z`;
  }
  s += P('t-a', wd[0]) + P('t-c', wd[1]) + P('t-b', wd[2]);
  // rim with bulbs cut through
  let dots = '';
  for (let i = 0; i < 12; i++) dots += circ(cx + 19.3 * Math.cos((i * 30 - 90) * d2r), cy + 19.3 * Math.sin((i * 30 - 90) * d2r), 1);
  s += P('t-c', circ(cx, cy, 20.4) + circ(cx, cy, 18.2), ' fill-rule="evenodd"');
  s += P('t-b', circ(cx, cy, R1) + circ(cx, cy, R0) + dots, ' fill-rule="evenodd"');
  // hub
  s += P('t-b', circ(cx, cy, Rh) + circ(cx, cy, 2), ' fill-rule="evenodd"') + C('t-c', cx, cy, 2);
  // pointer flap
  s += P('t-a', 'M27.5 4.5Q27.5 1 32 1Q36.5 1 36.5 4.5Q36.5 7 32 15Q27.5 7 27.5 4.5Z');
  s += C('t-b', 32, 4.6, 1.6);
  s += P('t-c', spark(7, 8, 4) + spark(57.5, 9, 3));
  add('prize-wheel', 'spinning prize wheel with a pointer', s);
}
// ---------- marionette
{ let s = '';
  // strings (behind everything)
  s += L('M13 15.5L13.5 29M51 15.5L50.5 29M32 12V17', .9);
  // H control bar
  s += P('t-a', cap(13, 9.5, 51, 9.5, 4) + cap(13, 3, 13, 16, 4.6) + cap(51, 3, 51, 16, 4.6));
  s += P('t-b', 'M15.3 10.5H48.7V11.5H15.3Z');
  s += C('t-b', 32, 9.5, 2.8);
  // legs
  s += P('t-a', limb([[29.5, 45], [26, 52.5], [27, 58.5]], 4.2) + limb([[34.5, 45], [39.5, 51.5], [41.5, 57.5]], 4.2));
  s += P('t-b', 'M22.5 61.5Q22.5 58.2 26.5 58.2Q30 58.2 30.5 61.5ZM39 60.6Q39 57.4 43 57.4Q46.5 57.4 47 60.6Z');
  s += C('t-b', 26, 52.5, 1.5) + C('t-b', 39.5, 51.5, 1.5);
  // arms
  s += P('t-a', limb([[26.5, 34.5], [19.5, 39.5], [13.5, 31]], 3.6) + limb([[37.5, 34.5], [44.5, 39.5], [50.5, 31]], 3.6));
  s += C('t-a', 13.5, 30, 2.7) + C('t-a', 50.5, 30, 2.7);
  s += C('t-b', 19.5, 39.5, 1.4) + C('t-b', 44.5, 39.5, 1.4);
  // torso
  const btn = circ(32, 36.5, 1) + circ(32, 40, 1);
  s += P('t-a', rpoly([[25.5, 31.5], [38.5, 31.5], [37, 46.5], [27, 46.5]], 2.5) + btn, ' fill-rule="evenodd"');
  s += P('t-b', 'M26.2 42.5H37.6L37.4 44.5H26.4Z');
  s += P('t-c', btn);
  // head
  const ch = circ(27.2, 27, 1.5) + circ(36.8, 27, 1.5);
  s += P('t-a', circ(32, 23.5, 7.5) + ch, ' fill-rule="evenodd"');
  s += P('t-b', 'M24.6 22.5Q25 16 32 16T39.4 22.5Q36 18.5 32 19.5T24.6 22.5Z');
  s += P('t-c', ch);
  s += C('t-b', 29.2, 23.5, 1.2) + C('t-b', 34.8, 23.5, 1.2);
  s += L('M29.3 27Q32 29.6 34.7 27', 1.3);
  s += P('t-c', spark(6, 46, 3.5) + spark(58, 47, 3));
  add('marionette', 'wooden string puppet on a control bar', s); }

// ---------- stunt-jump
{ let s = '';
  // speed lines
  s += L('M3 28L15 22.6M2 36.5L16 30.3M5 44L16.5 39', 2.4);
  // dust puff at the lip
  s += P('t-c', circ(19.5, 45, 3) + circ(14.5, 47.8, 2.2) + circ(23.5, 46, 1.7) + circ(10.5, 45.5, 1));
  // wooden ramp: wedge with plank seams
  s += P('t-a', 'M1.5 62L25.5 46.5V62Z' + 'M9 62L25.5 51.3V52.3L10.5 62Z' + 'M16.5 62L25.5 56.2V57.2L18 62Z', ' fill-rule="evenodd"');
  s += P('t-b', 'M22 48.8V62H25.5V46.5Z');
  s += P('t-b', 'M1 61.5H30V63H1Z');
  // bike + rider
  let g = '';
  for (const x of [-13, 13]) { g += P('t-b', circ(x, 9, 7) + circ(x, 9, 3.8), ' fill-rule="evenodd"'); g += C('t-a', x, 9, 2); }
  g += P('t-b', cap(-13, 9, -2, 5, 2.6) + cap(13, 9, 8, -6, 2.6));
  g += P('t-a', 'M-21 -4L-8 -1.5L-3 -2.5L4 -5Q7 -6 8.5 -4L6 1L0 4L-8 3Z' + 'M8 0Q15 -1.5 20 3.5L18 4Q14 1.5 9 2.5Z');
  g += P('t-b', 'M-17 -3.6L-4 -1.6V0L-16 -1.9Z');
  g += R('t-b', -4, 0, 8, 6, 1.5);
  // rider
  g += P('t-b', limb([[-6, -5], [1.5, -2.5], [-1.5, 4]], 4.4));
  g += P('t-a', cap(-6, -6, 1, -13, 6.5));
  g += P('t-a', limb([[1, -12], [5, -9], [8.5, -7.5]], 3.2));
  g += P('t-b', cap(6.5, -7.5, 10.5, -8, 2));
  // helmet: highlight cut out, visor, peak
  const hi = 'M0.5 -18.5Q1 -21 3.5 -21.6L3 -20.2Q1.8 -19.8 1.6 -18.2Z';
  g += P('t-a', circ(4.5, -17, 5.2) + hi, ' fill-rule="evenodd"');
  g += P('t-c', hi);
  g += P('t-b', 'M5 -18.5H9.6Q10 -15 8 -14.6H5Z');
  g += P('t-a', 'M2.5 -21.6Q8 -22.6 11.5 -20L6.5 -19.6Z');
  s += `<g transform="translate(39 25.5) rotate(-24)">${g}</g>`;
  s += P('t-c', spark(55, 8, 3.5) + spark(52, 54, 3));
  add('stunt-jump', 'motorbike stunt rider leaping off a ramp', s); }

// ---------- ghost
{ let s = '';
  // trailing wisp
  s += P('t-c', 'M19 52C15 58 10.5 54.5 6.5 58.5C5 60 3 60 2.5 58C5 58.5 6 53.5 10.5 52.5C13.5 52 15.5 50.5 17.5 46Z');
  // sheet body with raised arms
  const body = 'M15.5 51C16 40 16.5 30 17 22C18 10 25.5 5 32 5C38.5 5 46 10 47 22C47.5 30 48 40 48.5 51' +
    'Q44.5 58.5 40.2 54Q36.2 59.5 32 54.5Q27.8 59.5 23.8 54Q19.5 58.5 15.5 51Z';
  const hl = 'M21 17Q21.8 18.5 22.8 17.5Q24 12 28 10.3Q29 9.5 28 8.5Q22.5 10.5 21 17Z';
  s += P('t-a', body + hl + 'M20 37L17.3 36Q8.5 30 5.8 19.5Q4.8 16 6.3 14.8Q8.5 13 10 16.5Q12.5 23 17.5 24L20 24.5ZM44 24.5L46.5 24Q51.5 23 54 16.5Q55.5 13 57.7 14.8Q59.2 16 58.2 19.5Q55.5 30 46.7 36L44 37Z');
  // shade: right flank, under-arm, folds
  s += P('t-b', 'M42 9.5C46 13 47 18 47 22C47.5 30 48 40 48.5 51Q46.8 55 44.5 55.5Q46 40 44 26Q43.5 15 42 9.5Z');
  s += P('t-b', 'M46.7 36Q55.5 30 58.2 19.5Q57.5 16.5 56.8 18.5Q53.5 28 46.8 32.5Z');
  s += P('t-b', 'M23.8 54Q25.8 48 24.3 42Q26.8 48 25.6 54.8ZM40.2 54Q38.7 48 40.2 43Q37.7 48 38.5 55Z');
  s += P('t-c', hl);
  // eyes with shine, oo mouth
  const sh = circ(25.4, 20.3, 1.1) + circ(36.4, 20.3, 1.1);
  s += P('t-b', 'M23.7 22a2.8 4 0 1 0 5.6 0a2.8 4 0 1 0-5.6 0ZM34.7 22a2.8 4 0 1 0 5.6 0a2.8 4 0 1 0-5.6 0Z' + sh, ' fill-rule="evenodd"');
  s += P('t-c', sh);
  s += E('t-b', 32, 32.5, 2.6, 3.4);
  s += P('t-c', spark(57, 45, 3.5) + spark(8, 40, 3));
  add('ghost', 'floating sheet ghost with raised arms', s); }

// ---------- saxophone
{ let s = '';
  let g = '';
  // crook + mouthpiece
  g += P('t-a', 'M25.5 13V8.5C25.5 5.8 23.5 5 20.8 5.3L15.2 7L14.5 4L21 2.2C25 1.8 28.5 4 28.5 8V13Z');
  g += P('t-b', 'M15.8 3.6L8.5 5.6Q6.8 6.4 7.8 7.6L16.4 7.4Z');
  g += R('t-b', 25.2, 8.5, 1.6, 3.5, .8);
  // body, bow and bell as one tube with key pads cut out
  const pads = [[26.7, 18, 1.7], [27.4, 23.5, 1.9], [28.1, 29, 2], [28.8, 34.5, 2.1], [29.4, 40, 2.2], [47.8, 41, 1.7], [47.3, 35.5, 1.8]];
  const ph = pads.map(([x, y, r]) => circ(x, y, r)).join('') + 'M42.6 24.2Q43.3 26 43.3 28.5L43.9 33.5H45.1L44.6 28.3Q44.5 25.5 43.7 23.8Z';
  g += P('t-a', 'M24.5 12L26 44A13 13 0 0 0 52 44L54 28Q55 24 60 21.5L37 17.5Q42.5 22 42 28L44 44A5 5 0 0 1 34 44L29.5 12Z' + ph, ' fill-rule="evenodd"');
  g += P('t-c', ph);
  // shading: body flank, bow underside, bell flank
  g += P('t-b', 'M29.5 12L34 44H32.2L28 12Z' + 'M26 44A13 13 0 0 0 52 44A13 10.5 0 0 1 26 44Z' + 'M52 44L54 28Q55 24 60 21.5L57.5 23Q52.8 25 52.3 29L50.3 44Z');
  // bell opening
  g += E('t-b', 48.5, 19.5, 11.8, 3.6, 10);
  s += `<g transform="rotate(-12 34 32)">${g}</g>`;
  s += P('t-c', spark(12, 33, 4) + spark(20, 54, 3) + spark(57, 46, 3));
  add('saxophone', 'gold saxophone with key pads', s); }

// ---------- turntable
{ let s = '';
  const el = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
  const band = (pts, w) => { const L = [], Rr = []; pts.forEach((p, i) => { const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l * w / 2, ny = (b[0] - a[0]) / l * w / 2; L.push([p[0] + nx, p[1] + ny]); Rr.unshift([p[0] - nx, p[1] - ny]); }); return 'M' + [...L, ...Rr].map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z'; };
  const cx = 26, cy = 34, rx = 17, ry = 12, inE = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  // tone arm path: pivot -> elbow -> across the record edge to the headshell
  const at = t => [48 - 14 * t, 34 + 4 * t];
  let tB = 0; while (inE(...at(tB)) > 1) tB += .01;
  const arm = band([[50, 21], [48, 34], at(tB - .05)], 2.2), head = band([at(tB + .06), at(1.02)], 3.2);
  // scratch motion marks
  const arc = (r1, r2, a1, a2) => { const p = a => [cx + r1 * Math.cos(a * Math.PI / 180), cy + r2 * Math.sin(a * Math.PI / 180)]; const [x1, y1] = p(a1), [x2, y2] = p(a2); return `M${f(x1)} ${f(y1)}A${r1} ${r2} 0 0 1 ${f(x2)} ${f(y2)}`; };
  s += L(arc(25, 20, 242, 282) + arc(29, 24.5, 236, 274), 2);
  // plinth: front face, then top face with the arm and label cut out
  s += P('t-b', 'M3 49H61V53.5Q61 56.5 58 56.5H6Q3 56.5 3 53.5Z');
  s += P('t-a', rpoly([[6, 18], [58, 18], [61, 50], [3, 50]], [4, 4, 1.5, 1.5]) + arm + el(cx, cy, 5.5, 3.9), ' fill-rule="evenodd"');
  // record with grooves, label and headshell cut out
  s += P('t-b', el(cx, cy, rx, ry) + el(cx, cy, 13.6, 9.6) + el(cx, cy, 13, 9.2) + el(cx, cy, 10.2, 7.2) + el(cx, cy, 9.6, 6.8) + el(cx, cy, 5.5, 3.9) + head, ' fill-rule="evenodd"');
  s += P('t-c', el(cx, cy, 5.5, 3.9) + arm + head);
  s += C('t-b', cx, cy, .9);
  // arm pivot, slider, knobs
  s += C('t-b', 50, 21.5, 3.6);
  s += R('t-b', 55, 27, 1.6, 12, .8) + R('t-b', 53.6, 30.5, 4.4, 2.6, .8);
  s += C('t-b', 47.5, 45.5, 2.1) + C('t-b', 54, 45.5, 2.1);
  s += P('t-c', spark(55, 9, 4) + spark(44, 7, 2.5));
  add('turntable', 'DJ turntable with a vinyl record', s); }
// ---------- dragon
{
  let s = '';
  // compact stadium (relative path) — same geometry as cap()
  const cq = (x1, y1, x2, y2, w) => {
    const r = f(w / 2), dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
    return `M${f(x1 + nx)} ${f(y1 + ny)}l${f(dx)} ${f(dy)}a${r} ${r} 0 0 0 ${f(-2 * nx)} ${f(-2 * ny)}l${f(-dx)} ${f(-dy)}a${r} ${r} 0 0 0 ${f(2 * nx)} ${f(2 * ny)}Z`.replace(/ -/g, '-');
  };
  // neck ridge: graduated spikes along the back edge of the neck, bases hidden in the body
  const bz = (p, t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]); };
  const nk = [[[33, 32.5], [36, 32.5], [38, 30.5], [39, 27]], [[39, 27], [40, 24], [40, 21.5], [40.5, 18]], [[40.5, 18], [41, 13], [44, 11], [48, 11]]];
  let rid = '';
  for (const [g, t, h] of [[2, .3, 2.4], [1, .95, 3], [1, .55, 3.4], [1, .12, 3.7], [0, .78, 3.7]]) {
    const a = bz(nk[g], t - .04), b = bz(nk[g], t + .04), m = bz(nk[g], t), l = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l, w = h * .48;
    rid += `M${f(m[0] + tx * w - ty * .8)} ${f(m[1] + ty * w + tx * .8)}L${f(m[0] + ty * h - tx * h * .3)} ${f(m[1] - tx * h - ty * h * .3)}L${f(m[0] - tx * w - ty * .8)} ${f(m[1] - ty * w + tx * .8)}Z`;
  }
  // far wing, far legs, ridge, horns, tail spade (shade, behind)
  s += P('t-b', 'M33.5 31Q34.5 14 37.5 1.5Q28 2 16 3Q20 9 8 10.5L20 22Z' + cq(28, 45, 28, 54, 5.5) + cq(26.5, 55.5, 32, 55.5, 3.6) + cq(44.5, 42, 46, 54, 5.5) + cq(44.5, 55.5, 50, 55.5, 3.6)
    + rid + 'M43.5 12.5L41 6L46.5 11.2ZM47.5 11.2L48.5 5L51 12ZM1 39.8L5 31.5L9.5 39Q5.3 37 1 39.8Z');
  // tail
  s += P('t-a', 'M16 46C11 52 4.5 53 2.5 48.5C1 45 2 41 4 38.5L7 40C5.5 42.5 5.5 45 7 46.5C9 48 12 45 14.5 40Z');
  // body + neck + head, eye hole
  s += P('t-a', 'M14 40C14 35 18 32.5 25 32.5L33 32.5C36 32.5 38 30.5 39 27C40 24 40 21.5 40.5 18C41 13 44 11 48 11C51 11 53 12.5 54.5 15L56 17.5Q57 20 55 21.5Q53.5 22.5 51 22.5L48.5 22.5C46.5 23 46 25 46 28C46.5 33 47 38 45 42C43 46.5 39 48 33 48.5L22 48.5C17 48 14 45 14 40Z' + circ(48, 16, 2.6), ' fill-rule="evenodd"');
  s += C('t-c', 48, 16, 2.6);
  s += P('t-b', 'M15 43C20 47 38 47.5 44.6 42.7C42.5 46.6 38.6 48 33 48.5L22 48.5C18.5 48.2 16 46.2 15 43Z');
  // near legs
  // + near wing: wrist at top, fingers fan down-left to scalloped tips
  s += P('t-a', cq(21, 44, 20.5, 54, 6.6) + cq(39.5, 43, 40.5, 54, 6.4) + cq(18.5, 55.2, 25, 55.2, 4.4) + cq(38.5, 55.2, 45, 55.2, 4.4)
    + 'M32 33Q32.5 18 34 3.5Q24 6.5 12 8.5Q17 16 4.5 18Q14 21.5 9 29.5Q18 27 21 33Z');
  // wing strut, pupil, nostril
  s += P('t-b', cq(31.8, 32, 34, 4, 2.8) + circ(48.8, 16.1, 1.4) + circ(54.3, 15.5, .9));
  // wing fingers and mouth
  s += L('M34 5Q18 10 5 18M34 5Q20 15 9.5 29M50 20Q52.5 21 55 19.4', 1.3);
  // flame: a short cone from the snout, far edge breaking into three upward-curling tongues, teardrop core
  const core = 'M61.2 15.2Q61.8 20.4 59.2 21Q57.2 21.2 57.8 19.4Q58.6 17.2 61.2 15.2Z';
  s += P('t-a', 'M55.2 19.6C57.4 18.2 59.2 17 59.9 14.4C60.4 12.4 60.8 10.4 62.4 7.8C63.2 10.6 63 13.2 61.9 15.4C62.8 14.8 63.2 14 63.4 12.4C63.8 15.6 63.2 17.4 62 18.8C62.7 18.5 63.1 17.8 63.4 16.8C63.6 20.6 62 22.4 59.4 22.6C57.4 22.8 56 21.6 55.2 19.6Z' + core, ' fill-rule="evenodd"');
  s += P('t-c', core + spark(55.5, 5, 3) + spark(57, 33, 2.5));
  add('dragon', 'friendly dragon puffing a small flame', s);
}

// ---------- unicorn
{
  let s = '';
  // ear
  s += P('t-a', 'M26.5 22L30 7L36.5 18Z');
  // head + neck, eye hole
  const eye = 'M36.5 27.5Q40 23.8 44 26.3Q41.2 31.2 36.5 27.5Z';
  s += P('t-a', 'M29 19C33 16 38 15.5 42 18C47 21 52 28 56 34C58.5 37.5 58.5 42 55.5 44.5C53 46.5 49 46.5 46 45C43 44 41 44 40 46C40 52 42 57 45 62.5L16 62.5C14 50 18 36 22 28C24 23 26 20.5 29 19Z' + eye, ' fill-rule="evenodd"');
  s += P('t-b', 'M29 18.5L30.4 11L33.6 17.5Z' + eye + circ(41.4, 26.4, 1) + 'M53.5 37.5a1.5 2.2 -35 1 0 .1 0Z', ' fill-rule="evenodd"');
  s += C('t-c', 41.4, 26.4, 1);
  s += L('M36.5 27.5L34.3 26.3M38 25.8L36.7 23.6M40.2 25L39.8 22.6M45 41.5Q48 43 51 42.5', 1.2);
  s += P('t-b', 'M40 46C41 41.5 40.5 37 38 33.5Q44.5 36 46 45C43 44 41 44 40 46Z');
  // mane: three locks
  s += P('t-b', 'M34 14.5C27 11 17 13 12 19Q9.5 22 6.5 21.5Q8 27 14 26.5C18 26 21 24.5 24.5 25.5C28 23 30 19 34 14.5Z'
    + 'M23.5 27.5C17 27.5 11 31 8 37Q6.5 40 3.5 40Q5.5 45.5 11.5 44C15 43 17 41 20.5 42C23.5 37.5 25.5 32 23.5 27.5Z'
    + 'M19.5 44.5C14 46 11 50 9.5 54Q8.5 57 5.5 57.5Q8 61.5 13 59.5C16 58 18 56 20 57C22 53 22 48.5 19.5 44.5Z');
  // horn with spiral grooves
  s += P('t-a', 'M36.6 15.6L50.4 1.6Q51.4 1 51 2.2L41.8 19.2Z');
  let g = '';
  for (const t of [.12, .32, .52, .7]) g += `M${f(36.8 + 14.2 * t)} ${f(15.5 - 14.5 * t)}L${f(41.6 + 9.4 * (t + .1))} ${f(19 - 18 * (t + .1))}`;
  s += L(g, 1.3);
  s += P('t-c', spark(57.5, 9, 4.5) + spark(43, 6.5, 2.6));
  add('unicorn', 'unicorn head with a spiral horn', s);
}

// ---------- mermaid
{
  let s = '';
  // rock
  s += P('t-b', 'M7 58Q5 47 12 42Q18 37 28 38Q39 37.5 44 43Q48.5 48.5 47.5 58Z');
  // hair (behind body)
  s += P('t-b', 'M32 9C31 5 28 4.5 25.5 5C20.5 5.5 19 10 19.5 14C20 19 18 23 14.5 26C11.5 28.5 13.5 31 12 34C11 36.5 9 37 7.5 36.5C11 40 16 37.5 18 34C19.5 31 21 28 22 24L24 15.5Z');
  // tail + fin
  s += P('t-a', 'M20 35C28 33 38 34.5 43 38.5C47 41.5 49 46 49.5 50.5L46 51.5C45.5 47 43 44.5 39 43C33 41 25 43 19.5 41.5Z');
  s += P('t-a', 'M46.5 49.5Q50 39 56.5 33Q55.8 41 57.5 45Q60.5 48.5 63.3 50Q55.5 55 48 53.5Z');
  s += L('M48.5 51L54.8 38.5M49 51.5L59 47.8M49 52.2L59.5 51.6', 1.2);
  s += L('M23 37.5q1.6 1.6 3.2 0M28 37q1.6 1.6 3.2 0M33 37.4q1.6 1.6 3.2 0M38 38.6q1.6 1.6 3.2 0M30.5 40q1.6 1.6 3.2 0M35.5 40.4q1.6 1.6 3.2 0M42.5 42.5q1.4 1.6 2.8 .2', 1.1);
  // torso, head, arm
  s += P('t-a', 'M22.5 18.5Q26.5 17 30 19.5Q32 23 31 27Q29.5 31 30 35.5L20.5 37Q20 31 21 26Q21.5 21 22.5 18.5Z');
  s += C('t-a', 26.8, 11.3, 6.2);
  s += P('t-a', limb([[25, 21.5], [25.8, 29], [32.5, 33.2]], 3.6));
  s += L('M23.6 23.5Q23.4 27 24 30', 1);
  s += L('M21 35.5Q25 34 29.5 35', 1.4);
  // shell top
  s += P('t-c', 'M28.5 25.5Q28 21 31.5 21.5Q32.5 24 30.5 26.5Z');
  // hair on head
  s += P('t-b', 'M33 9.5C32 4.5 28 3 24.8 4C20 5.5 19.5 10 20.5 14C21.5 17 24 17 24 15.5C24.5 12 27.5 9.5 33 9.5Z');
  s += C('t-b', 30, 11.6, 1);
  s += L('M29.8 14.8Q31.2 15.6 32.3 14.5', 1);
  // waves
  s += P('t-a', 'M1 62.5V57Q5 53 9 57Q13 53 17 57Q21 53 25 57Q29 53 33 57Q37 53 41 57Q45 53 49 57Q53 53 57 57Q60.5 53.5 63 56.5V62.5Z');
  s += L('M5 60.5Q8 58.5 11 60.5M21 60.5Q24 58.5 27 60.5M37 60.5Q40 58.5 43 60.5M53 60.5Q56 58.5 59 60.5', 1.2);
  s += P('t-c', spark(52, 12, 4.5) + spark(42, 25, 2.5) + circ(60.5, 39, 1.3) + circ(61.5, 34, .9));
  add('mermaid', 'mermaid sitting on a rock in the waves', s);
}

// ---------- sea-serpent
{
  let s = '';
  const hump = (cx, rx, ry, t) => `M${f(cx - rx)} 54V50A${f(rx)} ${f(ry)} 0 0 1 ${f(cx + rx)} 50V54H${f(cx + rx - t)}V50A${f(rx - t)} ${f(ry - t)} 0 0 0 ${f(cx - rx + t)} 50V54Z`;
  // frill behind the neck
  s += P('t-b', 'M47 10L40.5 11L45 15.5L38.5 18.5L43.5 22.5L37.5 26.5L42.5 30L37 34.5L41.5 38L37 43L41.5 45L44 45L47 25L48 10Z' + 'M30.5 37.5L33 32.5L36.5 37.5ZM18.5 40.5L20.5 36L23.5 40.5ZM8.3 43L9.8 39.5L12.3 43Z');
  // humps + tail curl
  s += P('t-a', hump(33.6, 6.8, 14, 4.6) + hump(21.2, 5.8, 11, 4.2) + hump(10.3, 4.9, 8.4, 3.8) + 'M.8 54C.6 47 1.8 43.5 4.2 43.5C6.2 43.5 6.6 46 5.2 46.6C4.3 47 3.5 46.2 4 45.6C3.2 45.6 2.9 48 3.1 54Z');
  // neck + head with eye and mouth holes
  const mouth = 'M52.5 16Q57.5 18 62 13.8Q61 19.5 55.5 19.6Q53.5 19.4 52.5 16Z';
  s += P('t-a', 'M41 54C40.5 40 43 31 45 22C43.5 15 45 9.5 49 7Q51 4.5 54 5.5Q56.5 4.5 58 7.5C61 9 63 11.5 63 14.5C63 18.5 60 21 55.5 21.5C53 22 51.5 23.5 51 26C50.5 31 51 37 53 42C54 45 53.5 48 53 54Z' + circ(50.6, 10.6, 3.3) + circ(56.4, 9.8, 2.5) + mouth, ' fill-rule="evenodd"');
  s += P('t-c', circ(50.6, 10.6, 3.3) + circ(56.4, 9.8, 2.5));
  s += C('t-b', 51.6, 11, 1.7) + C('t-b', 57.1, 10.1, 1.3) + C('t-b', 61, 11.8, .7);
  const teeth = 'M54.3 16.5L56.4 16.8L55.4 18.4ZM57.3 16.5L59.3 15.9L58.5 17.9Z';
  s += P('t-b', mouth + teeth, ' fill-rule="evenodd"');
  s += P('t-c', teeth);
  // scales
  s += L('M45 30q1.6 1.5 3.2 0M44 36q1.6 1.5 3.2 0M47.5 41q1.6 1.5 3.2 0M44.5 47q1.6 1.5 3.2 0M28.5 42q1.4 1.4 2.8 0M17 45q1.4 1.4 2.8 0', 1.1);
  // water
  s += P('t-b', 'M.5 62.5V52Q4 49.5 7.5 52Q11 49.5 14.5 52Q18 49.5 21.5 52Q25 49.5 28.5 52Q32 49.5 35.5 52Q39 49.5 42.5 52Q46 49.5 49.5 52Q53 49.5 56.5 52Q60 49.5 63.5 52V62.5Z' + 'M6 57.5q3 -2.4 6 0q-3 -1 -6 0ZM24 59q3 -2.4 6 0q-3 -1 -6 0ZM42 57.5q3 -2.4 6 0q-3 -1 -6 0Z', ' fill-rule="evenodd"');
  s += P('t-c', spark(14, 14, 4) + spark(27, 7, 2.6) + circ(58, 30, 1.4) + circ(61, 26, .9));
  add('sea-serpent', 'sea serpent arching out of the waves', s);
}

// ---------- magic-lamp
{
  let s = '';
  // smoke ribbon: lead-in from the spout, then a spiral; smoothed through midpoints
  const pts = [[56.6, 33.5], [57.6, 28.5], [55.5, 24.6], [51, 22.8]];
  for (let i = 0; i <= 12; i++) { const a = (75 + i * 33) * Math.PI / 180, r = 7.2 - i * .42; pts.push([44 + r * Math.cos(a), 15.5 + r * Math.sin(a)]); }
  const A = [], B = [], n = pts.length;
  pts.forEach((p, i) => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    const w = (i < 5 ? 1.6 + i * .5 : 3.6 - (i - 4) * .2) / 2;
    A.push([p[0] - dy / l * w, p[1] + dx / l * w]); B.unshift([p[0] + dy / l * w, p[1] - dx / l * w]);
  });
  const sm = q => q.slice(1, -1).map((p, i) => `Q${f(p[0])} ${f(p[1])} ${f((p[0] + q[i + 2][0]) / 2)} ${f((p[1] + q[i + 2][1]) / 2)}`).join('');
  s += P('t-a', `M${f(A[0][0])} ${f(A[0][1])}` + sm(A) + `L${f(A[n - 1][0])} ${f(A[n - 1][1])}L${f(B[0][0])} ${f(B[0][1])}` + sm(B) + `L${f(B[n - 1][0])} ${f(B[n - 1][1])}Z`);
  // handle ring (behind body)
  s += P('t-a', circ(12, 44, 7) + circ(12, 44, 3.6), ' fill-rule="evenodd"');
  // foot
  s += P('t-b', 'M21.5 51H35L37.5 56.5Q37.5 58 36 58H20.5Q19 58 19 56.5Z');
  // spout + body, highlight hole
  const hl = 'M17.5 44Q19 40.5 24 39.8Q20.5 42 19.8 45.2Q18.4 46.4 17.5 44Z';
  s += P('t-a', 'M38 40.5C46 41 50 38 55.5 32.6Q57 31.3 58.5 32Q59.5 33.2 57.8 34.5C51.5 40 47 47 38 49.5C34 53 22 54 16.5 50.5C11.5 47 13.5 40 20 38.8C26 37.6 33 38 38 40.5Z' + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', 'M14.5 47C19 50.5 33 51.5 41 47.6C37.6 50 35.5 51.5 33 52.3C26 54 19.5 53 16.5 50.5C15.5 49.6 14.9 48.4 14.5 47Z');
  // lid + knob
  s += P('t-b', 'M19.5 39.6Q28 36.2 37 39.6Q28 41.6 19.5 39.6Z');
  s += P('t-a', 'M21.5 38.3Q22 32.6 28.5 32.3Q35 32.6 35.5 38.3Q28.5 36.4 21.5 38.3Z' + circ(28.5, 29.6, 2.4));
  s += P('t-b', 'M28 43.2L30.3 45.6L28 48L25.7 45.6Z');
  s += P('t-c', spark(57, 9, 4.2) + spark(31, 8, 2.8) + spark(16, 25, 2.4));
  add('magic-lamp', 'genie lamp with a swirl of magic smoke', s);
}
// ---------- troll
{
  let s = '';
  const tusks = 'M27.6 37L25.8 32.4L24 37ZM40 37L38.2 32.4L36.4 37Z';
  // head with eye and tusk holes
  s += P('t-a', 'M11.5 38.5C10.5 27 14 11 32 11C50 11 53.5 27 52.5 38.5ZM14 29Q8.5 30 7 24.5Q7 18.5 14.5 20.5ZM50 20.5Q57 18.5 57 24.5Q55.5 30 50 29Z' + circ(25, 22.6, 2.6) + circ(39, 22.6, 2.6) + tusks);
  s += P('t-c', circ(25, 22.6, 2.6) + circ(39, 22.6, 2.6));
  s += C('t-b', 25.8, 23.2, 1.3) + C('t-b', 38.2, 23.2, 1.3);
  // tufty hair, ear shading
  s += P('t-b', 'M16.5 19Q14 10.5 20.5 10Q19 3 26 4.5Q28 .5 32.5 3Q37 .5 39 4.5Q45.5 3 43.5 10Q50 10.5 47.5 19Q44 14.5 40 15L37 13L34 15.5L31 13L28 15.5L25 13.5Q19.5 14 16.5 19ZM9.5 24.5Q10.5 22 13.5 23V26.5Q10.5 26.5 9.5 24.5ZM54.5 24.5Q53.5 22 50.5 23V26.5Q53.5 26.5 54.5 24.5Z');
  // brows
  s += P('t-b', 'M19.5 20.5Q20 15.5 30 17.5L29.8 20.3L27.6 19.3L25.6 20.8L23.6 19.6L21.4 21.2ZM44.5 20.5Q44 15.5 34 17.5L34.2 20.3L36.4 19.3L38.4 20.8L40.4 19.6L42.6 21.2Z');
  // mouth, tusks cut
  s += P('t-b', 'M21 32Q32 35.5 43 32Q41.5 38.5 32 38.5Q22.5 38.5 21 32Z' + tusks, ' fill-rule="evenodd"');
  s += P('t-c', tusks);
  // bulbous nose
  const nose = 'M25.3 28.3a6.7 5.7 0 1 0 13.4 0a6.7 5.7 0 1 0 -13.4 0Z';
  s += P('t-a', nose) + L(nose, 1.3);
  s += P('t-b', 'M27.5 31.2Q32 34.5 36.5 31.2Q35 34 32 34Q29 34 27.5 31.2Z');
  // stone bridge: capstones, shadow band, wall with arch
  s += P('t-c', 'M1 38.5h11.5v6.5h-11.5ZM13.5 38.5h11.5v6.5h-11.5ZM26 38.5h12v6.5h-12ZM39 38.5h11.5v6.5h-11.5ZM51.5 38.5h11.5v6.5h-11.5Z');
  s += R('t-b', 2, 45, 60, 2.6);
  s += P('t-c', 'M3 47.6H61V63.3H46A14 14 0 0 0 18 63.3H3Z');
  s += P('t-b', 'M14.5 63.3A17.5 17.5 0 0 1 49.5 63.3H46A14 14 0 0 0 18 63.3Z');
  s += L('M3 55.5H13M51 55.5H61M9 47.6V55.5M55 47.6V55.5M6 55.5V62.6M58 55.5V62.6M24 59.5q2 -1.4 4 0t4 0t4 0t4 0', 1.3);
  // knobbly hands gripping the stones
  const hand = 'q0 -7 7.2 -7.5q7.3 .5 7.3 7.5q-1.8 3.4 -3.6 0q-1.8 3.8 -3.6 0q-1.8 3.8 -3.6 0q-1.8 3.4 -3.6 0Z', kn = 'm3.8 -3.5v3m3.6 -3.5v4m3.6 -3.5v3';
  s += P('t-a', 'M3.5 41' + hand + 'M46 41' + hand) + L('M3.5 41' + kn + 'M46 41' + kn, 1);
  s += P('t-c', spark(58.5, 6, 3.4) + spark(5.5, 7, 2.8));
  add('troll', 'troll peeking over a stone bridge', s);
}

// ---------- goblin
{
  let s = '';
  // tunic with raised sleeve
  s += P('t-b', 'M4.5 63.4Q4.5 52 15 49Q21 47.5 26 47.5L31 54L36 47.5Q40.5 47.5 45 49.2L46.5 56H58.5Q60.5 59 60 63.4Z');
  // head + ears + neck (nonzero), eyes, teeth and shine wound the other way
  const eyes = 'M29.5 28.5Q25 25 20.5 28.5Q25 32 29.5 28.5ZM41.5 28.5Q37 25 32.5 28.5Q37 32 41.5 28.5Z';
  const teeth = 'M24.6 37.5L26.2 41.5L27.8 37.9ZM34.2 37.9L35.8 41.5L37.4 37.5Z';
  const shine = 'M21.5 22.5Q23.5 16.5 29 14Q22 15 19.5 22Z';
  s += P('t-a', 'M16 30C16 10 46 10 46 30C46 41 39 45.5 31 45.5C23 45.5 16 41 16 30Z' + 'M18 34.5Q6 31 1.5 15.5L17 23Z' + 'M45 23L60.5 15.5Q56 31 44 34.5Z' + 'M26 43H36V47.5L31 54L26 47.5Z' + eyes + teeth + shine);
  s += P('t-b', 'M15.5 26.5L6 20Q9.5 28.5 16.5 30.5ZM46.5 26.5L56 20Q52.5 28.5 45.5 30.5Z');
  s += P('t-c', eyes + shine);
  s += C('t-b', 27.4, 28.6, 1.6) + C('t-b', 39.4, 28.6, 1.6);
  // heavy sly lids and brows
  s += L('M20.5 28Q25 25.4 29.5 27.6M32.5 27.6Q37 25.4 41.5 28M20.5 23.5L29 25.3M33 24.8Q37.5 21 42 22.5', 1.6);
  s += L('M30.5 28.5Q31.5 33 34 34.2Q31.8 35.3 29.8 34', 1.3);
  // grin with pointy teeth
  s += P('t-b', 'M19.5 35.5Q31 39.5 42.5 35.5Q40.5 44 31 44Q21.5 44 19.5 35.5Z' + teeth, ' fill-rule="evenodd"');
  s += P('t-c', teeth);
  // fist cupping a gold coin
  s += P('t-a', 'M46 56.5Q45 50 46 46.2Q47.6 44 49.2 46.2V48.2A8.2 8.2 0 0 0 59.5 46Q61 51 59.5 56.5Z');
  s += L('M49.2 48.2V56.5M49.5 51.4H59M49.5 54H59', 1.1);
  s += P('t-b', circ(53, 41, 7.2) + circ(53, 41, 5.3), ' fill-rule="evenodd"');
  s += C('t-c', 53, 41, 5.3) + P('t-b', rpoly(star(53, 41.3, 3.6, 1.6), .4));
  s += P('t-c', spark(58, 5.5, 3.6) + spark(7.5, 42, 2.8) + spark(61, 33, 2.2));
  add('goblin', 'grinning goblin holding up a gold coin', s);
}

// ---------- griffin
{
  let s = '';
  // lion paw: heel dome with toe bumps along the front; claw: hooked talon at the end of a toe
  const paw = (x, y) => `M${f(x)} ${f(y)}Q${f(x - .3)} ${f(y - 5.3)} ${f(x + 4)} ${f(y - 5.6)}A2.2 2.2 0 0 1 ${f(x + 7.4)} ${f(y - 4.3)}A2 2 0 0 1 ${f(x + 9.6)} ${f(y - 1.9)}A1.8 1.8 0 0 1 ${f(x + 9.8)} ${f(y)}Z`;
  const claw = (x1, y1, x2, y2) => {
    const l = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / l, uy = (y2 - y1) / l, q = (a, c) => f(x2 + ux * a - uy * c) + ' ' + f(y2 + uy * a + ux * c);
    return `M${q(0, -1.6)}Q${q(3.6, -.6)} ${q(3.4, 2.8)}Q${q(1.4, 1.2)} ${q(0, 1.6)}Z`;
  };
  // clockwise stadium (cap() winds the other way) so toes merge into the nonzero body path
  const toe = (x1, y1, x2, y2, w) => {
    const r = w / 2, l = Math.hypot(x2 - x1, y2 - y1), nx = (y2 - y1) / l * r, ny = -(x2 - x1) / l * r;
    return `M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}A${f(r)} ${f(r)} 0 0 1 ${f(x2 - nx)} ${f(y2 - ny)}L${f(x1 - nx)} ${f(y1 - ny)}A${f(r)} ${f(r)} 0 0 1 ${f(x1 + nx)} ${f(y1 + ny)}Z`;
  };
  // far legs: standing eagle leg, lion hind leg with paw
  s += L('M43.5 46.5L43 57.6', 4.4) + L('M38.8 60L43 58.3L48 59.8', 2.5) + L('M30.5 47L28 51.5L29.5 56.5', 4.8);
  s += P('t-b', claw(43, 58.3, 48, 59.8) + paw(26, 61.5));
  // tail hanging with tuft
  s += L('M13.5 40Q6 40 6.5 48Q7 54 4.5 56.5', 2.6);
  s += P('t-b', 'M6 55Q1.5 54.5 1.2 62Q4.5 59.5 8 59.5Z');
  // body, neck, head, near legs and paws in one nonzero path (eye circle winds the other way: a hole)
  const legs = 'M18.5 42.5L23.6 45.6L19.5 51.4L21.3 57H15.8L13.8 51.6Q13.5 50.3 14.2 49.3Z' + paw(13.5, 61.5) + 'M42.5 40L48 35.5Q52 40 53.5 44.5L55.6 47.2L52.6 50L48.5 47.5Q45 46 42.5 40Z' + toe(54, 48.5, 59, 46, 3.2) + toe(54, 48.5, 58.5, 52.5, 3.2) + toe(54, 48.5, 54.5, 54.5, 3.2);
  s += P('t-a', 'M17 47.5C12 46 11.5 37 16 34C20 31 27 32.5 34 31.5C38 31 40.5 27 40.5 22C40.5 15 42.5 8.5 48 8.5C51 8.5 52.5 10.5 52.5 12.5V21C51.5 23 50.5 25.5 51 29C51.5 33 52.5 37 51 41C49 45 45 47.5 40 47.8C32 48.2 24 48 17 47.5Z' + circ(47.6, 14.4, 2.3) + legs);
  s += C('t-c', 47.6, 14.4, 2.3) + C('t-b', 48.3, 14.4, 1.2);
  s += L('M44.3 11.4L50.5 12.3', 1.4);
  // hooked beak
  s += P('t-c', 'M52.5 12Q58.5 10.5 61.5 15Q63 19 60 22.5Q60.5 19.5 57.5 18.5L52.5 21Z');
  s += L('M52.5 18.3H57.3', 1.1);
  // crest: feathers swept back along the head
  s += P('t-b', 'M49.5 9.5Q43.5 3.5 36 4Q40 6 41.5 8Q38 8 35 10.5Q39.5 11 41.5 12.5Q39 13.8 37 16.5Q41.5 16.5 44 15Z');
  s += L('M45.5 32q1.5 2 3 0', 1.2);
  // haunch shading
  s += P('t-b', 'M13 43.5Q14 35.5 21.5 35.5Q15.5 37.5 15 44.5Z');
  // talons on the raised eagle foot
  s += P('t-b', claw(54, 48.5, 59, 46) + claw(54, 48.5, 58.5, 52.5) + claw(54, 48.5, 54.5, 54.5));
  // near wing, raised and swept back
  s += P('t-a', 'M36 33Q37.5 17 28 2.5Q23 3 20 7L21.5 9Q16.5 9 14.5 13L17 15Q11.5 16 10 21L13.5 22.5Q8.5 25 8.5 29L17 31Q21 34 36 33Z');
  s += P('t-b', 'M36 33Q37.5 17 28 2.5Q33.5 16 32 32.5Z');
  s += L('M30 31.5L21.5 9M26 32L17 15M22 32.3L13.5 22.5', 1.2);
  s += P('t-c', spark(58, 32, 3.4) + spark(5, 8, 2.8));
  add('griffin', 'griffin with eagle head, wings and lion tail', s);
}

// ---------- phoenix
{
  let s = '';
  const mx = d => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (m, x, y) => f(64 - x) + ' ' + y);
  // tapered flame feather from base to tip, bowed by b; mirrored copies keep the same winding
  const fe = (bx, by, tx, ty, w, b, m) => {
    if (m) { bx = 64 - bx; tx = 64 - tx; b = -b; }
    const l = Math.hypot(tx - bx, ty - by), ux = (tx - bx) / l, uy = (ty - by) / l, nx = -uy, ny = ux;
    const p = (x, y, a, c) => f(x + ux * a + nx * c) + ' ' + f(y + uy * a + ny * c);
    return `M${p(bx, by, 0, w / 2)}C${p(bx, by, l * .45, w / 2 + b)} ${p(tx, ty, -l * .3, b * .7)} ${p(tx, ty, 0, 0)}C${p(tx, ty, -l * .3, b * .3)} ${p(bx, by, l * .45, b * .4 - w / 2)} ${p(bx, by, 0, -w / 2)}Z`;
  };
  const W = [[29, 29.5, 7, 4, 9, -2], [28.5, 31, 2.5, 12, 9.5, -2.5], [28.5, 33, 1.5, 21, 9, -2.5], [28.5, 35, 5.5, 29.5, 7.5, -2]];
  // side tail plume: S-curved flame tongue sweeping out and down, licks rising off its outer edge
  const tl = 'M29 35.5C28 41 25.5 44.5 21.5 46.5Q20.5 42.5 17.5 39.5Q17.5 45 14.5 48.5Q12.5 47 9.5 43Q10 48.5 7 51.5Q4.5 51 1.5 48.5Q4.5 54 3 61.5C5.5 58 9.5 56.5 13.5 56.5C18.5 56.5 22.5 55 25 51.5C27 48.5 28.5 45.5 30 41.5Z';
  // mirror x and reverse the drawing order, so the copy winds the same way as the original
  const rv = d => {
    const seg = [...d.matchAll(/([MCQ])([^MCQZ]+)/g)].map(m => [m[1], m[2].trim().split(/\s+/).map(Number)]);
    const pts = seg.map(([, v]) => v.slice(-2)); let o = 'M' + mx(pts.at(-1).join(' '));
    for (let i = seg.length - 1; i > 0; i--) {
      const [c, v] = seg[i], q = []; for (let j = v.length - 4; j >= 0; j -= 2) q.push(v[j] + ' ' + v[j + 1]);
      o += c + [...q, pts[i - 1].join(' ')].map(mx).join(' ');
    }
    return o + 'Z';
  };
  let wings = '', hl = '', fl = '';
  for (const m of [0, 1]) {
    for (const w of W) wings += fe(...w, m);
    { const [bx, by, tx, ty] = W[0]; hl += fe(bx - 6, by - 1, tx + (bx - tx) * .2, ty + (by - ty) * .2, -3.2, 0, m); }
    for (let i = 1; i < 3; i++) {
      const [a, b] = [W[i], W[i + 1]], bx = (a[0] + b[0]) / 2 - 5, by = (a[1] + b[1]) / 2, x = bx + .6 * ((a[2] + b[2]) / 2 - bx), y = by + .6 * ((a[3] + b[3]) / 2 - by);
      fl += `M${f(m ? 64 - bx : bx)} ${f(by)}L${f(m ? 64 - x : x)} ${f(y)}`;
    }
  }
  // wings, head with crest, body and tail flames in one nonzero path (all wound the same way)
  s += P('t-a', wings + tl + rv(tl) + 'M30 42C29.5 48 26 51.5 26.5 57.5Q30.5 54.5 32 50.5Q33.5 54.5 37.5 57.5C38 51.5 34.5 48 34 42Z' + hl + circ(32, 11.5, 7.6) + 'M34.5 5.2Q32 3 32 .6Q29.5 1.5 30 4.5Q27.5 3.5 26 .8Q25 4 28.5 6.5Z' + 'M27.5 17C25 23 25.5 32 27.5 38C29 42.5 30.5 45 32 47.5C33.5 45 35 42.5 36.5 38C38.5 32 39 23 36.5 17Z');
  s += P('t-c', hl) + L(fl, 1.2);
  // hooked beak and eye
  s += P('t-b', 'M38.8 9Q44.5 9 46 14.5Q43.5 13 39.2 15Z');
  s += C('t-b', 35.3, 10.3, 1.6);
  // embers
  s += P('t-c', spark(32, 60.5, 2.5) + spark(57, 38, 2.6) + spark(7, 38, 2.2));
  s += C('t-b', 22.5, 61, 1) + C('t-b', 41.5, 61, 1);
  add('phoenix', 'phoenix rising with flaming wings and tail', s);
}

// ---------- broomstick
{
  let s = '';
  // big crescent moon behind
  s += P('t-c', 'M26.5 6.2A25 25 0 1 0 52.7 38.9A21 21 0 1 1 26.5 6.2Z');
  s += P('t-c', rpoly(star(41, 9.5, 4.2, 1.9), .5) + rpoly(star(53.5, 30, 3.4, 1.5), .4));
  // besom in local coords: x runs along the handle toward the tip
  let g = '';
  g += L('M-9 -13.5H1M-16 -17.5H-7M-8 13H2', 1.5);
  g += P('t-a', 'M-2 -4.5Q-13 -6 -22.5 -11L-20 -7.5L-25 -5L-21.5 -2L-26 1L-21.5 4L-25 7L-20 8.6L-22.5 11Q-13 6 -2 4.5Z');
  g += L('M-4 -2.2L-18.5 -6M-4 0H-20.5M-4 2.2L-18.5 6', 1.1);
  g += P('t-b', limb([[-3, 0], [13, -1.2], [20, 1], [35, 0]], 3.6));
  g += C('t-b', 35, 0, 2.4);
  g += R('t-b', -4.5, -5.8, 3.8, 11.6, 1.2);
  s += `<g transform="translate(28.6 37.8) rotate(-37.3) scale(1.1)">${g}</g>`;
  s += P('t-c', spark(9, 9, 3.2));
  add('broomstick', 'witch broomstick flying across a crescent moon', s);
}
// ---------- cactus
{
  let s = '';
  // low sun sitting on the horizon, cut flat where the sand meets it
  s += P('t-c', 'M42.2 47A10 10 0 1 1 61.8 47Z');
  // sand: hump on the left, flat horizon under the cactus and the sun
  s += P('t-a', 'M0.5 46Q11 40.5 21.5 45.5Q23 47 25 47H63.5V63.5H0.5Z');
  // foreground dune ridge shadow
  s += P('t-b', 'M0.5 58Q16 50 34 52.5Q48 54.5 63.5 50.5V54Q48 59 34 56Q16 54 0.5 61.5Z');
  // the cactus's long evening shadow
  s += P('t-b', 'M25 47H37Q33 50.6 18 50.6Q12.5 50.6 12.5 49.2Q18 47.4 25 47Z');
  // ripples
  s += L('M4 51.5q3 -1.4 6 0t6 0M40 61q3 -1.4 6 0t6 0t6 0M8 61.5q3 -1.4 6 0', 1.3);
  // saguaro: trunk + two raised arms in one path so overlaps fill once
  const trunk = 'M37 47V13A6 6 0 0 0 25 13V47Z';
  s += P('t-a', trunk + limb([[27, 35], [17, 35], [17, 20]], 8) + limb([[35, 28], [46, 28], [46, 13]], 8));
  // shaded right side of trunk and arms
  s += P('t-b', 'M33 47V7.3A6 6 0 0 1 37 13V47Z' + cap(19, 20, 19, 37, 3.6) + cap(48, 13, 48, 30, 3.6) + 'M37 30.5H46V32H37Z');
  // ribs
  s += L('M28.5 11V46M31 9V46M15.5 19V33M44.5 12V26', 1.2);
  s += P('t-c', spark(9, 12, 3.6) + spark(57, 21, 2.6) + spark(21, 6, 2.2));
  add('cactus', 'saguaro cactus in desert dunes at sunset', s);
}

// ---------- shark
{
  let s = '';
  // wavy counter-shading line from snout tip back to the tail stem
  const wp = Array.from({ length: 9 }, (_, i) => [61.5 - i * 47.5 / 8, 31.5 + i * 2 / 8]);
  const seg = (a, b, k) => `Q${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2 + (k % 2 ? 1.6 : -1.6))} ${f(b[0])} ${f(b[1])}`;
  let fwd = '', back = '';
  for (let i = 0; i < 8; i++) fwd += seg(wp[i], wp[i + 1], i);
  for (let i = 7; i >= 0; i--) back += seg(wp[i + 1], wp[i], i);
  // back (with eye hole), dorsal fin and crescent tail in one clockwise path
  const eye = circ(51.5, 25.5, 3.4);
  s += P('t-a', 'M14 29.5C22 23 34 19.5 44 21C53 22.5 59.5 26 61.5 31.5' + fwd + 'Z' + eye +
    'M25 24Q30 14 26 4.5Q37 8 42 21.6Z' + 'M14 37Q12 47 4.5 55Q5 42 11 33Q4 24 3 7Q12 17 14 29.5Z');
  // pale belly below the wave
  s += P('t-c', 'M61.5 31.5C61 37 55.5 41 50 42.5C40 46 26 46 14 37V33.5' + back + 'Z');
  // fin and tail shading
  s += P('t-b', 'M29.2 9Q31.5 16 29.5 22.6L25 24Q30 14 26 4.5Z' + 'M14 37Q12 47 4.5 55Q7.5 44 12 36.5Z');
  // pectoral fin
  s += P('t-b', 'M42 39Q35 46 30 53.5Q39 51 46 41Z');
  // eye
  s += C('t-c', 51.5, 25.5, 3.4) + C('t-b', 52.3, 25.8, 1.8);
  // gill slits
  s += L('M40.5 25.5q-2.2 4 0 8.5M44 24.5q-2.2 4.5 0 9.5M47.5 25q-2.2 4.2 0 8.5', 1.4);
  // toothy grin: teeth are holes showing the pale belly
  s += P('t-b', 'M60 34.5Q52 38.5 43 35.5Q48 45 60 34.5Z' + 'M45.5 36.4L47.1 39L48.7 37Z' + 'M49.5 37.3L51 40L52.5 37.5Z' + 'M53.5 37.4L55 39.8L56.4 36.9Z', ' fill-rule="evenodd"');
  // bubbles and sparkle
  s += L(circ(58, 14, 2.4) + circ(61, 7.5, 1.6), 1.3);
  s += P('t-c', spark(12, 6.5, 3.4) + spark(51, 55, 2.6));
  add('shark', 'friendly cartoon shark with a toothy grin', s);
}

// ---------- lizard
{
  let s = '';
  // gecko drawn upright in local units, then turned to climb towards the upper right
  const th = 26 * Math.PI / 180, k = .95, T = (x, y) => [31 + k * (x * Math.cos(th) - y * Math.sin(th)), 32 + k * (x * Math.sin(th) + y * Math.cos(th))];
  const tp = d => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (m, a, b) => T(+a, +b).map(f).join(' '));
  const cc = (x, y, r, rev) => { const [a, b] = T(x, y), q = f(r * k), sw = rev ? 1 : 0; return `M${f(a - r * k)} ${f(b)}a${q} ${q} 0 1 ${sw} ${f(2 * r * k)} 0a${q} ${q} 0 1 ${sw} ${f(-2 * r * k)} 0Z`; };
  // counter-clockwise polygon (nonzero union with the rest of the body)
  const poly = pts => { pts = pts.map(p => T(p[0], p[1])); let a = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }); if (a > 0) pts.reverse(); return 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z'; };
  // angular rock slab: lit top face, dark right-hand side face, a crack
  s += P('t-c', 'M3 41L9 31L24 26L38 27L52 23L61 31L50 53L29 56L8 54Z');
  s += P('t-b', 'M61 31L63 41L54 61L50 53Z');
  s += L('M52.5 24l1.5 5.5l-2.5 4l2.5 5M4.5 46l5.5 1.5l2.5 4', 1.2);
  // body, head, eyes, curled tail, legs with splayed toes and round pads: one path
  let g = tp('M0 -15Q-6.4 -14 -6.4 -4Q-6.4 6 0 9Q6.4 6 6.4 -4Q6.4 -14 0 -15Z') + tp('M0 -29Q-6.6 -28.5 -6.4 -20.5Q-6 -14 0 -13.5Q6 -14 6.4 -20.5Q6.6 -28.5 0 -29Z');
  g += tp('M-3 6Q-3.5 17 2 23.5Q7 28.5 13 27Q19 25 18.5 17.5Q17.5 11.5 12 11.5Q7 12 7 17Q8 14.4 11 14.8Q14.4 15.8 14 19.6Q13 23 8 23Q3.5 21.5 3 14L3 6Z');
  // hip, knee, foot per leg; the near hind foot steps out clear of the tail curl
  for (const [s0, e0, f0] of [[[-4, -10], [-10, -12], [-12, -18]], [[4, -10], [10, -12], [12, -18]], [[-4, 4], [-10.5, 5], [-13, 11.5]], [[4, 4], [10.5, 6], [15.5, 3]]]) {
    const h = 1.8, ph = Math.atan2(f0[1] - e0[1], f0[0] - e0[0]);
    const nrm = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [-(b[1] - a[1]) / l * h, (b[0] - a[0]) / l * h]; };
    const n1 = nrm(s0, e0), n2 = nrm(e0, f0), nm = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2];
    const pts = [[s0[0] + n1[0], s0[1] + n1[1]], [e0[0] + nm[0], e0[1] + nm[1]], [f0[0] + n2[0] * .7, f0[1] + n2[1] * .7]];
    [48, 24, 0, -24, -48].forEach((a, i) => { const r = i % 2 ? 1.9 : 5, t = ph + a * Math.PI / 180, x = f0[0] + r * Math.cos(t), y = f0[1] + r * Math.sin(t); pts.push([x, y]); if (!(i % 2)) g += cc(x, y, 1.3); });
    pts.push([f0[0] - n2[0] * .7, f0[1] - n2[1] * .7], [e0[0] - nm[0], e0[1] - nm[1]], [s0[0] - n1[0], s0[1] - n1[1]]);
    g += poly(pts);
  }
  // bulging eyes
  g += cc(-5.9, -21.5, 3.2) + cc(5.9, -21.5, 3.2);
  s += P('t-a', g);
  // pupils with a catchlight cut out of each
  const hl = cc(-7, -22.7, .6) + cc(5.8, -22.7, .6);
  s += P('t-b', cc(-6.4, -22, 1.8) + cc(6.4, -22, 1.8) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  // spotted back
  s += P('t-b', cc(-2.4, -8.5, 1.6) + cc(2.6, -4.5, 1.7) + cc(-2.2, .5, 1.5) + cc(0, 13, 1.3));
  s += P('t-c', spark(57, 7, 2.8));
  add('lizard', 'spotted gecko clinging to a rock', s);
}

// ---------- river
{
  let s = '';
  const le = 'C36 24 39 27 37 30.5C35 34 22 36 18 43C14 50 8 56 4 63.5';
  const re = 'C40 23.5 46 26 44.5 30.5C43 35 35 37 35 43C35 50 41 56 44 63.5';
  // distant hills, the river leaving the valley between them
  s += P('t-b', 'M0.5 22V16Q6 9 15 10Q25 11 33 19.5Q40 8 51 7Q59 7 63.5 12V22Z');
  // water winding in from the hills, widening towards the viewer
  s += P('t-c', 'M32 22' + le + 'H44C41 56 35 50 35 43C35 37 43 35 44.5 30.5C46 26 40 23.5 34.5 22Z');
  // grassy banks either side, with pebble holes on the near right bank
  const peb = 'M44.5 58.6a3 2.2 0 1 0 6 0a3 2.2 0 1 0 -6 0ZM47.5 52.8a2.2 1.6 0 1 0 4.4 0a2.2 1.6 0 1 0 -4.4 0ZM46.5 62.4a1.8 1.1 0 1 0 3.6 0a1.8 1.1 0 1 0 -3.6 0Z';
  s += P('t-a', 'M0.5 22H32' + le + 'H0.5Z' + 'M34.5 22' + re + 'H63.5V22Z' + peb, ' fill-rule="evenodd"');
  s += P('t-c', peb);
  // grass tufts along the banks
  const tuft = (x, y, w) => `M${f(x)} ${f(y)}l${f(w)} ${f(-w * 2.6)}l${f(w)} ${f(w * 1.8)}l${f(w)} ${f(-w * 2.6)}l${f(w)} ${f(w * 2.6)}l${f(w)} ${f(-w * 1.8)}l${f(w)} ${f(w * 2.6)}Z`;
  s += P('t-b', tuft(4, 33, 1.3) + tuft(46, 29.5, 1) + tuft(9, 47, 1.5) + tuft(38, 45, 1.4) + tuft(25.5, 26.5, .8));
  // ripples, finer with distance
  s += L('M9 58q3 -1.6 6 0t6 0M25 61q3 -1.6 6 0t6 0M21 50.5q2.6 -1.4 5.2 0t5.2 0', 1.6) + L('M26 41.5q2 -1 4 0t4 0M36.8 32.5q1.4 -.8 2.8 0', 1.1);
  // cattail reeds on the near right bank
  s += L('M54 62.6V41M58.5 62.6V36M62 62.6V44', 1.4);
  s += P('t-b', cap(54, 41, 54, 48, 3) + cap(58.5, 36, 58.5, 43.5, 3.2) + cap(62, 44, 62, 49.5, 2.6) + 'M56 63Q52 53 47.5 47.5Q54.5 52 58 63ZM60 63Q61 55 63.5 51V56Q62 59 61.5 63Z');
  s += P('t-c', spark(7, 5, 2.8) + spark(32.5, 7, 2.2) + spark(59.5, 3.5, 2));
  add('river', 'river winding from hills between grassy banks', s);
}

// ---------- rocks
{
  let s = '';
  const pt = p => f(p[0]) + ' ' + f(p[1]);
  // striped pebble: ellipse in front; granite outline follows its upper-left edge
  const cx = 46, cy = 47, rx = 15, ry = 9.5;
  const ep = t => [cx + rx * Math.cos(t * Math.PI / 180), cy + ry * Math.sin(t * Math.PI / 180)];
  const p1 = ep(-70), p2 = ep(120);
  // quartz crystal: hexagonal prism with a point, leaning right, base buried at y 56; the point clears the granite
  const a = 20 * Math.PI / 180, d = [Math.sin(a), -Math.cos(a)], n = [Math.cos(a), Math.sin(a)], B = [12, 56], w = 6.5, Lb = 26, tip = [B[0] + d[0] * 39, B[1] + d[1] * 39];
  const bot = o => [B[0] + n[0] * o - d[0] * n[1] * o / d[1], 56], sh = o => [B[0] + n[0] * o + d[0] * Lb, B[1] + n[1] * o + d[1] * Lb];
  const face = (o1, o2) => `M${pt(bot(o1))}L${pt(sh(o1))}L${pt(tip)}L${pt(sh(o2))}L${pt(bot(o2))}Z`;
  // ground shadow
  s += P('t-b', 'M4 56H61Q60 60.5 33 60.5Q5 60.5 4 56Z');
  // three faces in three tones, plus the edge where the point begins
  s += P('t-a', face(-w, -w / 3)) + P('t-c', face(-w / 3, w / 3)) + P('t-b', face(w / 3, w));
  s += L(`M${pt(sh(-w))}L${pt(sh(-w / 3))}L${pt(sh(w / 3))}`, 1.1);
  // faceted granite chunk: front face (the lit top facet is left out of it), pale top, dark side
  const m = [sh(w)[0] + (tip[0] - sh(w)[0]) * .75, sh(w)[1] + (tip[1] - sh(w)[1]) * .75];
  s += P('t-a', `M${pt(bot(w))}L${pt(sh(w))}L${pt(m)}L29.5 21L36 21.5L45 19.5L53 17L56 29L${pt(p1)}A${rx} ${ry} 0 0 0 ${pt(p2)}Z`);
  s += P('t-c', 'M29.5 21L35 11L45 10.5L53 17L45 19.5L36 21.5Z');
  s += P('t-b', `M45 19.5L53 17L56 29L${pt(p1)}A${rx} ${ry} 0 0 0 ${pt(ep(-130))}Z`);
  s += P('t-b', `M19 52.5L33 51.2Q37.5 50.5 ${pt(ep(140))}A${rx} ${ry} 0 0 0 ${pt(p2)}L${pt(bot(w))}Z`);
  // granite speckle: small dark flecks, some round, some angular
  const tri = (x, y, q) => `M${x} ${y}l${f(q)} ${f(-q * .4)}l${f(-q * .3)} ${f(q)}Z`;
  s += P('t-b', [[31, 25, .6], [40, 23.5, .5], [37.5, 28, .7], [32.5, 31, .5], [29.5, 35, .6], [35, 34, .5], [31, 39.5, .7], [27, 43, .5], [33.5, 45.5, .6], [28.5, 49.5, .5], [40, 14, .5], [47, 15, .6], [37, 16.5, .5]].map(c => circ(...c)).join('') + tri(35, 24.5, 1.4) + tri(42, 26.5, 1.3) + tri(26, 46.5, 1.3) + tri(43, 14, 1.2));
  s += L('M28.5 28.5l1.6 -.6M34 38.5l1.4 .8M24 52l1.5 -.5', 1);
  // pebble with tilted bands cut by the ellipse
  s += P('t-c', `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`);
  const band = (a, b, m) => {
    const hit = d => { const A = 1 / rx ** 2 + m * m / ry ** 2, B = 2 * d * m / ry ** 2, C = d * d / ry ** 2 - 1, q = Math.sqrt(B * B - 4 * A * C); return [(-B - q) / 2 / A, (-B + q) / 2 / A].map(u => [cx + u, cy + d + m * u]); };
    const [l1, r1] = hit(a), [l2, r2] = hit(b);
    return `M${pt(l1)}L${pt(r1)}A${rx} ${ry} 0 0 1 ${pt(r2)}L${pt(l2)}A${rx} ${ry} 0 0 1 ${pt(l1)}Z`;
  };
  s += P('t-b', band(-4.6, -2.2, -.16) + band(.4, 2.4, -.16) + band(5, 9.6, -.16));
  s += P('t-c', spark(13, 14, 3.4) + spark(23, 5, 2.2) + spark(58.5, 31, 2.2));
  add('rocks', 'granite chunk, striped pebble and quartz crystal', s);
}
// ---------- skyscraper
{
  let s = '';
  const grid = (x0, y0, nc, nr, dx, dy, w, h) => { let d = ''; for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) d += `M${f(x0 + c * dx)} ${f(y0 + r * dy)}h${f(w)}v${f(h)}h${f(-w)}Z`; return d; };
  // left tower: flat roof, antenna, ribbon windows
  s += P('t-a', 'M4.5 35H19V60H4.5Z');
  s += P('t-a', 'M7.5 35V32.5H16V35Z');
  s += L('M11.8 32.5V27', 1.4);
  s += P('t-b', grid(7.2, 38.5, 1, 4, 0, 4.6, 9.2, 2.4));
  // right tower: wedge roof, ribbon windows
  s += P('t-a', 'M45 32L59.5 25V60H45Z');
  s += P('t-b', grid(47.5, 34.5, 1, 5, 0, 4.6, 9.5, 2.4));
  // main glass tower with setbacks and spire, windows cut out
  const body = 'M20.5 60V20H23.5V13H27.5V8H36.5V13H40.5V20H43.5V60Z';
  const holes = grid(23, 23, 4, 7, 5, 4.5, 3, 3) + grid(25.5, 15, 3, 1, 5, 0, 3, 3);
  s += P('t-a', body + holes, ' fill-rule="evenodd"');
  s += P('t-c', holes);
  s += P('t-b', 'M41.5 20H43.5V60H41.5Z');
  s += P('t-b', 'M29 9.5H35V11.5H29Z');
  s += P('t-a', 'M32 1.5L33.4 8H30.6Z');
  // entrance
  s += P('t-b', 'M28.5 60V56Q28.5 54.5 30 54.5H34Q35.5 54.5 35.5 56V60Z');
  // ground
  s += R('t-b', 2, 59.5, 60, 3, 1.5);
  s += P('t-c', spark(12, 13, 4) + spark(53, 8.5, 3));
  add('skyscraper', 'glass skyscraper with spire between two towers', s);
}

// ---------- bridge
{
  let s = '';
  const qy = (y0, yc, y1, t) => (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * yc + t * t * y1;
  // water with wave crests cut out
  const wv = (y, x0, x1, a, n) => { const w = (x1 - x0) / n; let d = `M${f(x0)} ${f(y)}`; for (let i = 0; i < n; i++) d += `q${f(w / 4)} ${f(-a)} ${f(w / 2)} 0t${f(w / 2)} 0`; return d; };
  const crest = 'M8 55.5q3-1.8 6 0q-3 .9-6 0Z' + 'M28 58q3-1.8 6 0q-3 .9-6 0Z' + 'M48 55q3-1.8 6 0q-3 .9-6 0Z';
  s += P('t-a', wv(50, 1.5, 62.5, 2.2, 8).replace(/$/, 'V60Q62.5 62.5 60 62.5H4Q1.5 62.5 1.5 60Z') + crest, ' fill-rule="evenodd"');
  s += P('t-c', crest);
  // towers with portal openings cut out
  const tw = x => `M${f(x - 3)} 52V10H${f(x - 3.6)}V7.5H${f(x + 3.6)}V10H${f(x + 3)}V52Z` +
    `M${f(x - 1.3)} 13h2.6v6h-2.6Z M${f(x - 1.3)} 23h2.6v9h-2.6Z`;
  for (const x of [18, 46]) {
    s += P('t-a', tw(x), ' fill-rule="evenodd"');
    s += P('t-b', `M${f(x + 1.3)} 10H${f(x + 3)}V52H${f(x + 1.3)}Z`);
    s += R('t-b', x - 4.5, 49, 9, 4, 1);
  }
  // main cables
  s += L('M2.2 36Q10 31 18 8.5Q32 61 46 8.5Q54 31 61.8 36', 2);
  // hangers
  let h = '';
  for (let x = 22; x <= 42; x += 4) h += `M${x} ${f(qy(8.5, 61, 8.5, (x - 18) / 28) + .5)}V38`;
  for (const [x0, sg] of [[18, -1], [46, 1]]) for (const dx of [5, 10]) {
    const t = dx / 16.5; const x = x0 + sg * dx;
    h += `M${f(x)} ${f(qy(8.5, sg < 0 ? 31 : 31, 36, t) + .4)}V38`;
  }
  s += L(h, 1.1);
  // deck
  s += R('t-a', 1.5, 37.5, 61, 4.5, 1);
  s += P('t-b', 'M1.5 40.5H62.5V41Q62.5 42 61.5 42H2.5Q1.5 42 1.5 41Z');
  s += P('t-c', spark(32, 15, 4) + spark(56, 23, 2.8) + spark(8, 19, 2.8));
  add('bridge', 'suspension bridge over gentle waves', s);
}

// ---------- metro-train
{
  let s = '';
  // tunnel ring with stone joints and keystone
  s += P('t-a', 'M3 56V34A29 29 0 0 1 61 34V43H55.5V34A23.5 23.5 0 0 0 8.5 34V56Z');
  let jt = '';
  for (const a of [-160, -130, -105, -75, -50, -20]) { const r = a * Math.PI / 180; jt += `M${f(32 + 23.5 * Math.cos(r))} ${f(34 + 23.5 * Math.sin(r))}L${f(32 + 29 * Math.cos(r))} ${f(34 + 29 * Math.sin(r))}`; }
  s += L(jt + 'M3 45H8.5', 1.2);
  s += P('t-b', 'M29.2 4.6H34.8L34.2 11H29.8Z');
  // dark tunnel mouth, train cut out with a gap
  const trainGap = 'M14.8 54.2V26Q14.8 15.8 25 15.8H39Q49.2 15.8 49.2 26V54.2Z';
  s += P('t-b', 'M9.5 56V34A22.5 22.5 0 0 1 54.5 34V42.8H50.6V56Z' + trainGap, ' fill-rule="evenodd"');
  // train front: windscreen and headlights cut out
  const ws = 'M21 22H43Q45 22 45 24V32Q45 34 43 34H21Q19 34 19 32V24Q19 22 21 22Z';
  const hl = circ(21.5, 41.5, 2.6) + circ(42.5, 41.5, 2.6);
  s += P('t-a', 'M16 53V26Q16 17 25 17H39Q48 17 48 26V53Z' + ws + hl, ' fill-rule="evenodd"');
  s += P('t-c', ws + hl);
  s += P('t-b', 'M27 18.8H37Q38 18.8 38 19.8V19.8Q38 20.8 37 20.8H27Q26 20.8 26 19.8V19.8Q26 18.8 27 18.8Z');
  s += P('t-b', 'M16 47.5H48V50H16Z M29.5 50H34.5V53H29.5Z');
  // track: sleeper and rails
  s += P('t-a', 'M14 56.6H49V58.2H14Z M11.5 60.2H49.5V62.2H11.5Z');
  s += P('t-b', 'M20.4 56H23.4L21.4 62.5H17Z M40.6 56H43.6L47 62.5H42.6Z');
  // platform edge with safety stripe
  s += P('t-a', 'M50.6 47H62.5V61Q62.5 62.5 61 62.5H50.6Z');
  s += P('t-c', 'M50.6 44H62.5V46.2H50.6Z');
  s += P('t-b', 'M50.6 47H62.5V49H50.6Z');
  s += P('t-c', spark(6.5, 8, 3.5) + spark(57.5, 8.5, 2.8));
  add('metro-train', 'subway train leaving a round tunnel', s);
}

// ---------- stadium
{
  let s = '';
  const cx = 32, cy = 35, RX = 27, RY = 17, D = 6;
  const rimY = x => cy - RY * Math.sqrt(1 - ((x - cx) / RX) ** 2);
  // floodlight masts (behind: start at rim) and heads with lamps cut out
  const head = (x, y) => { const l = `M${f(x - 3.1)} ${f(y - 2.4)}h6.2v4.4h-6.2Z`; let h = ''; for (const dx of [-1.6, 1.6]) h += circ(x + dx, y - .2, 1.1); return [l, h]; };
  let m = '', hd = '', lp = '';
  for (const [x, y, y0] of [[14, 8, rimY(14)], [50, 8, rimY(50)], [3.9, 14, 55.5], [60.1, 14, 55.5]]) {
    m += `M${f(x)} ${f(y0)}V${f(y + 2)}`; const [a, b] = head(x, y); hd += a; lp += b;
  }
  s += L(m, 1.6);
  s += P('t-a', hd + lp, ' fill-rule="evenodd"');
  s += P('t-c', lp);
  // outer wall crescent with gaps between piers
  let gaps = '';
  for (const x of [13, 22, 32, 42, 51]) { const yt = cy + RY * Math.sqrt(1 - ((x - cx) / RX) ** 2); gaps += `M${f(x - .7)} ${f(yt + 1.2)}h1.4v${f(D - 2.4)}h-1.4Z`; }
  s += P('t-b', `M${cx - RX} ${cy}v${D}a${RX} ${RY} 0 0 0 ${2 * RX} 0v${-D}a${RX} ${RY} 0 0 1 ${-2 * RX} 0Z` + gaps, ' fill-rule="evenodd"');
  // stands ring, field hole
  const inner = `M${cx - 19.5} ${cy + 1.5}a19.5 11.5 0 1 0 39 0a19.5 11.5 0 1 0 -39 0Z`;
  s += P('t-a', `M${cx - RX} ${cy}a${RX} ${RY} 0 1 0 ${2 * RX} 0a${RX} ${RY} 0 1 0 ${-2 * RX} 0Z` + inner, ' fill-rule="evenodd"');
  let ai = '';
  for (const a of [-150, -115, -65, -30, 30, 65, 115, 150]) { const r = a * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r); ai += `M${f(cx + 20.3 * c)} ${f(cy + 1.4 + 12.3 * sn)}L${f(cx + 26 * c)} ${f(cy + .2 + 16 * sn)}`; }
  s += L(ai, 1) + `<ellipse class="ln" stroke-width="1.1" cx="32" cy="35.6" rx="23.4" ry="14.3"/>`;
  // dark track around the pitch, pitch cut out
  const pitch = 'M18.5 29H45.5V44H18.5Z';
  s += P('t-b', inner + pitch, ' fill-rule="evenodd"');
  // mown stripes
  let lt = '', dk = '';
  for (let i = 0; i < 5; i++) { const d = `M${f(18.5 + i * 5.4)} 29h5.4v15h-5.4Z`; if (i % 2) dk += d; else lt += d; }
  s += P('t-c', lt);
  s += P('t-a', dk);
  s += L('M32 29V44' + circ(32, 36.5, 3.2), 1);
  s += P('t-c', spark(32, 9, 4));
  add('stadium', 'oval stadium with floodlights around a pitch', s);
}

// ---------- pier
{
  let s = '';
  const xs = [5, 14, 23, 32, 41, 50, 58.5];
  // sea with crests cut out
  let top = 'M1.5 49.5';
  for (let i = 0; i < 8; i++) top += 'q1.9-2 3.8 0t3.8 0';
  const crest = 'M8 56q3-1.8 6 0q-3 .9-6 0Z' + 'M26 59q3-1.8 6 0q-3 .9-6 0Z' + 'M44 56.5q3-1.8 6 0q-3 .9-6 0Z';
  s += P('t-a', top + 'V60.5Q62.5 62.5 60.5 62.5H3.5Q1.5 62.5 1.5 60.5Z' + crest, ' fill-rule="evenodd"');
  s += P('t-c', crest);
  // stilts with cross bracing
  let st = '', br = '';
  xs.forEach((x, i) => { st += `M${f(x - 1.1)} 39h2.2v20.5h-2.2Z`; if (i) br += `M${f(xs[i - 1])} 41L${f(x)} 48M${f(xs[i - 1])} 48L${f(x)} 41`; });
  s += L(br, 1);
  s += P('t-b', st);
  // deck plank with beam edge
  s += R('t-a', 1.5, 35.5, 61, 4, 1);
  s += P('t-b', 'M1.5 38H62.5V39.5Q62.5 40 62 40H2Q1.5 40 1.5 39.5Z');
  // railing
  let rl = 'M2 30.5H46';
  for (let x = 2; x <= 46; x += 4) rl += `M${x} 30.5V35.5`;
  s += L(rl, 1.1);
  // lamp posts
  for (const x of [11, 31]) {
    s += L(`M${x} 35.5V24.4`, 1.6);
    s += P('t-a', `M${f(x - 2.6)} 19.6H${f(x + 2.6)}L${f(x + 1.4)} 17.6H${f(x - 1.4)}Z`);
    s += C('t-c', x, 22, 2.2);
  }
  // kiosk with arched windows cut out and an onion-dome roof
  const win = 'M50 34V28.5a1.6 1.6 0 0 1 3.2 0V34Z M55.3 34V28.5a1.6 1.6 0 0 1 3.2 0V34Z';
  s += P('t-a', 'M47.5 35.5V24.5H61V35.5Z' + win, ' fill-rule="evenodd"');
  s += P('t-c', win);
  s += P('t-b', 'M46 24.8Q46 22.5 48 22.5H60.5Q62.5 22.5 62.5 24.8Z');
  s += P('t-b', 'M47 22.5Q48 17 54.25 14.5Q55.5 12 54.25 9.5Q53 12 54.25 14.5Q60.5 17 61.5 22.5Z');
  s += L('M54.25 9.6V5', 1.2);
  s += P('t-a', 'M54.8 5L58.8 6.4L54.8 7.8Z');
  s += P('t-c', spark(21, 11, 4) + spark(40, 17, 2.8) + spark(5, 22, 2.6));
  add('pier', 'seaside pier on stilts with lamps and kiosk', s);
}
// ---------- swing-set
{
  let s = '';
  s += P('t-b', 'M2 57.5H62Q63 57.5 63 59V59.5Q63 61 61.5 61H2.5Q1 61 1 59.5V59Q1 57.5 2 57.5Z');
  // slide chute
  s += P('t-a', 'M43 17H48Q51.5 17 53 21.5L57 36Q59 46 63 47.5V53.5Q55.5 53.5 52.5 43L49 28Q47.5 23 44 23H43Z');
  s += P('t-b', 'M49 28L52.5 43Q55.5 53.5 63 53.5V51Q57.5 50.5 55.5 42L52 27Z');
  s += P('t-c', 'M48.5 19.5Q50.5 19.8 51.3 22.5L55 35.5L53.5 35.8L50 23.5Q49.5 21.5 48 21.2Z');
  // A-frame legs
  s += P('t-a', limb([[3.2, 57.5], [8.8, 11], [14.4, 57.5]], 3.8) + limb([[38.6, 57.5], [44, 11], [49.4, 57.5]], 3.8));
  // top beam
  s += P('t-a', cap(3.5, 10.5, 49.5, 10.5, 5));
  s += P('t-b', 'M3.5 10.5H49.5A2.5 2.5 0 0 1 47 13H6A2.5 2.5 0 0 1 3.5 10.5Z');
  s += P('t-c', cap(8, 9.4, 42, 9.4, 1.4));
  // chains
  s += L('M17 13V41M24 13V41M30 13V41M37 13V41', 1.3);
  s += P('t-b', circ(17, 13.6, 1.4) + circ(24, 13.6, 1.4) + circ(30, 13.6, 1.4) + circ(37, 13.6, 1.4));
  // sling seats
  s += P('t-b', 'M15 40H26Q26 45.5 20.5 45.5Q15 45.5 15 40ZM28 40H39Q39 45.5 33.5 45.5Q28 45.5 28 40Z');
  s += P('t-c', spark(57, 7.5, 4.5) + spark(27, 28, 2.6));
  add('swing-set', 'playground swing set with a slide', s);
}

// ---------- school-bus
{
  let s = '';
  const q = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  const wins = [6, 14.2, 22.4, 30.6].map(x => q(x, 18.5, 6.6, 10)).join('') + circ(59.6, 35, 1.8);
  const octo = (r) => 'M' + Array.from({ length: 8 }, (_, i) => { const a = (22.5 + i * 45) * Math.PI / 180; return f(32 + r * Math.cos(a)) + ' ' + f(34.7 + r * Math.sin(a)); }).join('L') + 'Z';
  s += R('t-b', 6, 11.5, 5, 3.5, 1) + R('t-b', 42, 11.5, 5, 3.5, 1);
  s += P('t-a', 'M2.5 19Q2.5 14 7.5 14H48.5Q52.5 14 53 18L54 30H58.5Q62.5 30 62.5 34.5V48Q62.5 50 60.5 50H4.5Q2.5 50 2.5 48Z' + wins + q(40.5, 17.5, 10.5, 30), ' fill-rule="evenodd"');
  s += P('t-c', wins);
  s += P('t-b', 'M2.5 19Q2.5 14 7.5 14H48.5Q52.5 14 53 18H2.5Z');
  s += L('M3 32H40M3 39.5H40M51.5 39.5H62', 1.4);
  const panes = q(41.6, 18.6, 4, 17.5) + q(46.4, 18.6, 3.5, 17.5) + q(41.6, 37.6, 4, 8.6) + q(46.4, 37.6, 3.5, 8.6);
  s += P('t-b', q(40.5, 17.5, 10.5, 30) + panes, ' fill-rule="evenodd"');
  s += P('t-c', panes);
  s += P('t-b', 'M2.5 45H40.5V50H4.5Q2.5 50 2.5 48ZM51 45H62.5V48Q62.5 50 60.5 50H51Z');
  s += R('t-b', .8, 44, 5.5, 5, 1.6) + R('t-b', 57, 44, 6.4, 5, 1.6);
  s += R('t-b', 37, 33.2, 4, 3, .8);
  s += P('t-b', octo(6.2) + octo(5) + octo(3.9), ' fill-rule="evenodd"');
  s += P('t-c', octo(5) + octo(3.9), ' fill-rule="evenodd"');
  for (const x of [15, 52]) { s += P('t-b', circ(x, 50, 7.8) + circ(x, 50, 3.6), ' fill-rule="evenodd"'); s += P('t-c', circ(x, 50, 3.6)); s += C('t-b', x, 50, 1.5); }
  s += P('t-c', spark(56, 8, 4) + spark(30, 6, 2.5));
  add('school-bus', 'yellow school bus side-on', s);
}

// ---------- graded-paper
{
  let s = '';
  // back sheet + paper
  const pg = [[8, 4], [48, 4], [48, 55], [8, 55]], a = -7 * Math.PI / 180;
  const ip = pg.map(([x, y]) => [30 + (x - 30) * Math.cos(a) - (y - 30) * Math.sin(a), 30 + (x - 30) * Math.sin(a) + (y - 30) * Math.cos(a)]);
  s += `<g transform="rotate(7 30 30)">${P('t-a', rpoly([[9.5, 5], [49.5, 5], [49.5, 55], [9.5, 55]], 2.5) + rpoly(ip, 2.5), ' fill-rule="evenodd"')}</g>`;
  s += P('t-c', rpoly(pg, 2.5));
  s += L('M21.5 16.5H44M21.5 23.5H44M21.5 30.5H44M21.5 37.5H44M21.5 44.5H44', 1.2);
  s += L('M18.5 5V54', 1.2);
  s += L([13.5, 20.5, 27.5, 34.5].map(y => `M10.6 ${y}l2.4 2.6l4 -5.4`).join(''), 2.4);
  // star sticker
  const st = star(47.5, 13.5, 12, 5.6, 5, -90);
  s += P('t-b', rpoly(st.map(([x, y]) => [x + 1, y + 1.4]), 1.5));
  const hl = 'M47 5.5L44.5 11.2L39 11.8L40.5 13.2L45.5 12.6Z';
  s += P('t-a', rpoly(st, 1.5) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  // pencil
  let g = '';
  g += R('t-b', -25, -3.5, 7, 7, 2);
  g += R('t-a', -19, -3.5, 3.5, 7, 0);
  g += P('t-a', 'M-15.5 -3.5H15L24.5 0L15 3.5H-15.5Z');
  g += P('t-b', 'M-15.5 1H15V3.5H-15.5Z');
  g += P('t-c', 'M15 -3.5L24.5 0L15 3.5Z');
  g += P('t-b', 'M20.5 -1.5L24.5 0L20.5 1.5Z');
  g += L('M-17.3 -3.2V3.2', 1.1);
  s += `<g transform="translate(31 52) rotate(-12)">${g}</g>`;
  s += P('t-c', spark(57, 33, 4) + spark(5, 27, 2.6));
  add('graded-paper', 'marked worksheet with ticks, star and pencil', s);
}

// ---------- calculator
{
  let s = '';
  const q = (x, y, w, h, r) => rpoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
  const disp = q(16, 8, 32, 12.5, 2.2), ops = [25, 33, 41, 49].map(y => q(41, y, 9, 7, 2)).join('');
  const body = q(10.5, 2.5, 44, 60, 7);
  s += P('t-a', body + disp + ops, ' fill-rule="evenodd"');
  s += P('t-b', body + q(10.5, 2.5, 41.5, 57, 7), ' fill-rule="evenodd"');
  s += P('t-c', disp + ops);
  s += P('t-b', 'M16 10.2Q16 8 18.2 8H45.8Q48 8 48 10.2V11H17V20.5H16Z');
  s += P('t-c', 'M14 9Q14.4 5.6 18 5.2L18 6.6Q15.6 7 15.4 9Z');
  let keys = '';
  for (const y of [28.5, 36.5, 44.5, 52.5]) for (const x of [17, 25.5, 34]) keys += circ(x, y, 3.5);
  s += P('t-b', keys);
  s += L('M43 28.5H48M44.2 34.7L47.8 38.3M47.8 34.7L44.2 38.3M43 44.5H48M45.5 50V55M43 52.5H48', 1.8);
  s += P('t-b', circ(45.5, 26.6, 1) + circ(45.5, 30.4, 1));
  s += P('t-c', spark(5.5, 14, 4) + spark(59, 52, 3.2));
  add('calculator', 'pocket calculator with operator keys', s);
}

// ---------- lunchbox
{
  let s = '';
  // open lid behind
  const lin = rpoly([[11.5, 10], [52.5, 10], [55, 38], [9, 38]], 2.5);
  s += P('t-a', rpoly([[8, 6.5], [56, 6.5], [59, 38], [5, 38]], 4) + lin, ' fill-rule="evenodd"');
  s += P('t-c', lin);
  s += L('M25 6.5V4.5Q25 2 27.5 2H36.5Q39 2 39 4.5V6.5', 2.4);
  // juice box with bent straw
  const lab = 'M12 24.5h5v7h-5Z';
  s += P('t-b', limb([[16, 19], [16, 12], [19.5, 8.5]], 2.2));
  s += P('t-a', 'M10.5 20L12 17.5H19.5L21 20V40H10.5Z' + lab, ' fill-rule="evenodd"');
  s += P('t-c', lab);
  s += P('t-b', 'M18.5 20H21V40H18.5ZM10.5 20L12 17.5H19.5L21 20Z');
  // sandwich wedge: toast face, layered cut face toward the viewer
  // (bread layers are holes onto the t-c lid lining, so they stay light in the tint)
  const A = [22.6, 25.4], K = [37.6, 36.4], d = [3.6, -6.2];
  const G = (u, t) => [A[0] + (K[0] - A[0]) * u + d[0] * t, A[1] + (K[1] - A[1]) * u + d[1] * t], Q = (u, t) => G(u, t).map(f).join(' ');
  const bd = (t0, t1) => `M${Q(.08, t0)}L${Q(.92, t0)}L${Q(.92, t1)}L${Q(.08, t1)}Z`;
  s += P('t-a', rpoly([[A[0], K[1]], K, G(1, 1), G(0, 1), A], 1) + bd(.04, .3) + bd(.62, .88), ' fill-rule="evenodd"');
  // lettuce: ruffled band poking past the crust at both ends
  let w = `M${Q(-.1, .45)}L${Q(1.1, .45)}`;
  for (let i = 6; i > 0; i--) w += `Q${Q((i - .5) / 6 * 1.2 - .1, .86)} ${Q((i - 1) / 6 * 1.2 - .1, .6)}`;
  s += P('t-b', w + 'Z');
  // apple
  const hl = 'M43.6 26Q44.3 22.6 47.3 22.3Q45.5 24 45.3 26.7Z';
  s += P('t-b', limb([[50, 23], [51.5, 17]], 1.8));
  s += E('t-b', 55, 17.5, 3.6, 1.6, -25);
  s += P('t-a', 'M50 22.5C54 19.5 60 21 59.5 29.5C59 36.5 55 40.5 52 39.5Q50 38.8 48 39.5C45 40.5 41 36.5 40.5 29.5C40 21 46 19.5 50 22.5Z' + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', 'M55 22.5Q59.8 24.5 59.5 29.5C59 36.5 55 40.5 52 39.5Q56.5 36 57 30Q57.3 25.5 55 22.5Z');
  // box front
  s += P('t-a', 'M3 38H61V54Q61 60 55 60H9Q3 60 3 54Z');
  s += P('t-b', 'M3 54H61Q61 60 55 60H9Q3 60 3 54Z');
  s += R('t-b', 1.5, 35.5, 61, 4.6, 2);
  s += R('t-b', 28, 39, 8, 7.5, 2);
  s += P('t-c', spark(60, 9, 3) + spark(4, 14, 2.6));
  add('lunchbox', 'open lunchbox with sandwich, apple, juice box', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part16.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
