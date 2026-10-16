// Generates part28.json (round 4).
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

const R0 = (x, y, w, h, r = 0) => r ? rpoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r) : `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });
const arcPts = (cx, cy, r, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

// ---------- loom
{
  let s = '';
  // posts and feet
  s += P('t-a', R0(8, 8, 5.5, 42, 1.5) + R0(50.5, 8, 5.5, 42, 1.5) + R0(5, 46.5, 12, 4.5, 2) + R0(47, 46.5, 12, 4.5, 2));
  s += P('t-b', R0(11.5, 13, 2, 33.5, 0) + R0(54, 13, 2, 33.5, 0));
  // warp threads
  let w = ''; for (let x = 18; x <= 46.1; x += 3.5) w += `M${f(x)} 13V28`; s += L(w, 1.1);
  // heddle bar
  s += R('t-b', 13, 19.5, 38, 3.4, 1.2);
  // cloth with woven pattern
  s += R('t-a', 15.5, 27, 33, 15, 0.8);
  let pat = 'M15.5 27H48.5V29.2H15.5Z';
  for (let x = 15.5; x < 48; x += 5.5) pat += `M${f(x)} 37.5L${f(x + 2.75)} 32.5L${f(x + 5.5)} 37.5L${f(x + 4.1)} 37.5L${f(x + 2.75)} 35L${f(x + 1.4)} 37.5Z`;
  pat += 'M15.5 39.3H48.5V40.5H15.5Z';
  s += P('t-b', pat);
  // top beam, breast beam
  s += R('t-a', 6, 7, 52, 6, 2.2) + R('t-b', 7, 11, 50, 2, 0.8);
  s += R('t-b', 6, 41.5, 52, 5, 2);
  // weft thread to shuttle
  s += L('M48.5 28.5Q57 33 51 52', 1.1);
  // shuttle with bobbin slot
  const sh = 'M10 56.5Q18 52 32 52Q46 52 58 56.5Q46 61 32 61Q18 61 10 56.5Z';
  const slot = 'M25 54.8H39Q40.5 54.8 40.5 56.5Q40.5 58.2 39 58.2H25Q23.5 58.2 23.5 56.5Q23.5 54.8 25 54.8Z';
  s += P('t-a', sh + slot, ' fill-rule="evenodd"');
  s += R('t-b', 26.5, 55.4, 11, 2.2, 1.1);
  s += P('t-c', spark(5.5, 5.5, 3) + spark(4.5, 34, 2.2));
  add('loom', 'weaving loom with half-woven patterned cloth and shuttle', s);
}

// ---------- potters-wheel
{
  let s = '';
  // stand
  s += P('t-a', 'M28 47H36L37 55H27Z' + rpoly([[14, 55], [50, 55], [52, 60], [12, 60]], 1.5));
  s += P('t-b', 'M33.5 47H36L37 55H34.5Z');
  // splash pan
  s += P('t-a', rpoly([[5, 37], [59, 37], [54, 49], [10, 49]], 2));
  s += P('t-b', 'M8.4 44.5H55.6L54 49H10Z');
  s += E('t-b', 32, 37.5, 26, 4);
  // wheel head
  s += E('t-a', 32, 36.5, 18, 3.6) ;
  s += P('t-b', 'M14 36.5A18 3.6 0 0 0 50 36.5V38.5A18 3.6 0 0 1 14 38.5Z');
  // pot
  const pot = 'M21 35.5Q16.5 27 21.5 21Q25.5 17 25.5 13.5Q24 12 23 10.5H41Q40 12 38.5 13.5Q38.5 17 42.5 21Q47.5 27 43 35.5Z';
  s += P('t-a', pot);
  s += P('t-b', 'M38.5 13.5Q38.5 17 42.5 21Q47.5 27 43 35.5H39.5Q43.5 27 39.8 21.5Q37 17.5 37 13.5Z');
  s += E('t-b', 32, 10.9, 9, 1.8);
  s += L('M20.5 24Q32 27 43.5 24M19.6 29Q32 32 44.4 29', 1.2);
  // spin lines
  s += L('M10 31Q5 33 8 35.5M54 31Q59 33 56 35.5', 1.6);
  s += P('t-c', spark(8, 8, 3.5) + spark(56.5, 8, 3) + spark(52, 17, 1.8));
  add('potters-wheel', 'clay pot being thrown on a potter\'s wheel', s);
}

// ---------- diary
{
  let s = '';
  // page edge
  s += R('t-c', 46, 7.5, 7, 46, 1.5);
  s += L('M48 10V51M50.5 10V51', 0.8);
  // cover with heart cut out
  const hx = 29, hy = 20;
  const heart = `M${hx} ${hy + 11}C${hx - 3} ${hy + 8} ${hx - 10} ${hy + 4} ${hx - 10} ${hy - 1.5}C${hx - 10} ${hy - 6} ${hx - 3.5} ${hy - 7.5} ${hx} ${hy - 3}C${hx + 3.5} ${hy - 7.5} ${hx + 10} ${hy - 6} ${hx + 10} ${hy - 1.5}C${hx + 10} ${hy + 4} ${hx + 3} ${hy + 8} ${hx} ${hy + 11}Z`;
  s += P('t-a', rpoly([[11, 5], [47, 5], [47, 56], [11, 56]], [2, 3, 3, 2]) , '');
  s += P('t-b', heart);
  s += L('M17 9H43V52H17Z', 0.9);
  // spine
  s += P('t-b', rpoly([[9, 5], [15.5, 5], [15.5, 56], [9, 56]], [2, 0, 0, 2]));
  s += L('M9.5 11H15M9.5 50H15', 1.2);
  // ribbon
  s += P('t-b', 'M21 55H27V61.5L24 59L21 61.5Z');
  // strap with lock
  s += R('t-b', 37, 32, 21.5, 7, 2);
  s += L('M45 31Q45 24.5 49.5 24.5Q54 24.5 54 31', 2.6);
  const kh = 'M49.5 34.6a1.7 1.7 0 1 1 0 .01ZM48.8 36.5H50.2L50.7 40H48.3Z';
  s += P('t-a', rpoly([[43, 30], [56, 30], [56, 42], [43, 42]], 2) + 'M49.5 33.2a1.8 1.8 0 1 0 0.01 0ZM48.7 35.6H50.3L50.9 39.5H48.1Z', ' fill-rule="evenodd"');
  s += P('t-c', spark(5, 30, 2.5) + spark(57, 50, 2.8) + spark(58.5, 15, 2));
  add('diary', 'closed diary with strap, padlock, ribbon and heart', s);
}

// ---------- bobble-hat
{
  let s = '';
  // dome with knit stripe
  s += P('t-a', 'M12.5 46Q11 22 32 20Q53 22 51.5 46Z');
  s += P('t-b', 'M12.6 32.5Q32 28 51.4 32.5L51.6 37.5Q32 33 12.4 37.5Z');
  s += P('t-b', 'M44 22.8Q53 27 51.5 46H46Q48 30 41 22Z');
  s += L('M22 23.5Q19 33 20 45M32 21V45M42 23.5Q45 33 44 45', 1.1);
  // pompom (fluffy)
  let pp = ''; const pc = [32, 13.5], pr = 8.4, nb = 15;
  for (let i = 0; i < nb; i++) { const a = (i / nb) * 2 * Math.PI, a2 = ((i + 1) / nb) * 2 * Math.PI;
    const p1 = [pc[0] + pr * Math.cos(a), pc[1] + pr * Math.sin(a)], p2 = [pc[0] + pr * Math.cos(a2), pc[1] + pr * Math.sin(a2)];
    pp += `${i ? '' : `M${f(p1[0])} ${f(p1[1])}`}A1.25 1.25 0 0 1 ${f(p2[0])} ${f(p2[1])}`; }
  s += P('t-a', pp + 'Z');
  s += P('t-b', 'M39.5 10Q42 17 36 21Q29 23.5 25 19.5Q31 21 35.5 17.5Q39 14.5 39.5 10Z');
  s += P('t-b', circ(29, 10.5, 1) + circ(34.5, 9, .9) + circ(27.5, 15.5, .9) + circ(33, 14, 1));
  // brim
  s += R('t-a', 8.5, 43, 47, 15, 4);
  let rb = ''; for (let x = 13.2; x < 52; x += 4.7) rb += R0(x, 45.5, 2, 10, 1);
  s += P('t-b', rb);
  s += P('t-c', spark(9, 9, 3.6) + spark(55.5, 10, 3) + spark(55, 24, 1.8));
  add('bobble-hat', 'knitted bobble hat with ribbed brim and pompom', s);
}

// ---------- swimsuit
{
  let s = '';
  const suit = 'M19 5H24.5L24.5 13Q27 22 32 22Q37 22 39.5 13L39.5 5H45L46.5 16Q47 20 45 25Q43 31 44.5 36Q46 40 48.5 42Q39 45 36.5 57.5H27.5Q25 45 15.5 42Q18 40 19.5 36Q21 31 19 25Q17 20 17.5 16Z';
  s += P('t-a', suit);
  // stripe
  s += P('t-b', 'M19.6 27L44.4 21.5L43.5 28L20.4 33.5Z' + 'M20 37.6L44.1 32L44.4 34.6L19.4 40.2Z');
  // right shade
  s += P('t-b', 'M45.8 11L46.5 16Q47 20 45 25Q43 31 44.5 36Q46 40 48.5 42L46 42.5Q43 40.5 42.4 36Q41.6 30.5 43.4 25Q45 20 44.3 15Z');
  s += L('M24.5 13Q27 22 32 22Q37 22 39.5 13', 1.2);
  // drops
  const drop = (x, y, k) => `M${f(x)} ${f(y - 3.4 * k)}Q${f(x + 2.6 * k)} ${f(y)} ${f(x + 2.2 * k)} ${f(y + 1.2 * k)}A2.25 2.25 0 0 1 ${f(x - 2.2 * k)} ${f(y + 1.2 * k)}Q${f(x - 2.6 * k)} ${f(y)} ${f(x)} ${f(y - 3.4 * k)}Z`;
  s += P('t-a', drop(9, 30, 1.4) + drop(55, 40, 1.4) + drop(52, 55, 1) + drop(11, 50, 1));
  s += P('t-c', spark(8, 10, 3.4) + spark(56, 13, 2.6));
  add('swimsuit', 'striped one-piece swimsuit with water drops', s);
}

// ---------- pinky-promise
{
  let s = '';
  const M = ([x, y]) => [64 - x, y + 2.5], mp = pts => pts.map(M);
  const path = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L');
  const w = 4.6, ow = w + 2.4;
  // left hand; the right hand is its mirror, 4 lower
  const pinky = [[23.5, 26], [24, 15], [26.5, 10.5], [32, 10], [35.6, 12.5], [36.2, 18]];
  const pinkyR = [[40, 29], [39.6, 20], [37.6, 16.8], [33.2, 16.5], [30.6, 18.8], [30.4, 23]];
  const fist = [[7, 23], [27.5, 23], [28.5, 41], [8, 41]];
  const knk = [[28.3, 29], [22.5, 29], [28.6, 35], [22.5, 35]];
  const thumb = [[11, 41.5], [23, 40]];
  const hand = (fl) => {
    const T = fl ? M : (p => p), Tp = pts => pts.map(T);
    const pk = fl ? pinkyR : pinky;
    let o = L(path(pk), ow) + P('t-a', limb(pk, w));
    o += P('t-a', rpoly(Tp([[10, 36], [25, 36], [22, 58], [9.5, 58]]), [0, 0, 1.5, 1.5]));
    o += P('t-b', rpoly(Tp([[8.5, 50.5], [23.5, 50.5], [22.6, 58], [8.6, 58]]), 1.2));
    o += P('t-a', rpoly(Tp(fist), 5));
    o += P('t-b', rpoly(Tp([[8, 36], [28.5, 36], [28.5, 41], [8, 41]]), [0, 0, 4, 4]));
    o += P('t-a', cap(...T(thumb[0]), ...T(thumb[1]), 5.4));
    const k = Tp(knk);
    o += L(`M${f(k[0][0])} ${f(k[0][1])}L${f(k[1][0])} ${f(k[1][1])}M${f(k[2][0])} ${f(k[2][1])}L${f(k[3][0])} ${f(k[3][1])}`, 1.3);
    return o;
  };
  s += hand(true) + hand(false);
  s += P('t-b', 'M11 17.5C9 16 5.5 13.5 5.5 10.5C5.5 7.5 9 6.5 11 9.5C13 6.5 16.5 7.5 16.5 10.5C16.5 13.5 13 16 11 17.5Z');
  s += P('t-c', spark(54, 10, 3.4) + spark(46, 6, 1.8) + spark(32, 56, 2.6));
  add('pinky-promise', 'two hands hooking little fingers in a pinky promise', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part28.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
