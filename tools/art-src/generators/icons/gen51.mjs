// Generates part51.json (round 4).
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
const rev = pts => pts.slice().reverse();
const pt = p => `${f(p[0])} ${f(p[1])}`;
// symmetric outline: left half from top-centre to bottom-centre as [start, [c1,c2,p]...], mirrored about cx
const sym = (cx, start, segs) => {
  const m = p => [2 * cx - p[0], p[1]];
  let d = `M${pt(start)}`; segs.forEach(([a, b, p]) => { d += `C${pt(a)} ${pt(b)} ${pt(p)}`; });
  const all = [start, ...segs.map(s => s[2])];
  for (let i = segs.length - 1; i >= 0; i--) { const [a, b] = segs[i]; d += `C${pt(m(b))} ${pt(m(a))} ${pt(m(all[i]))}`; }
  return d + 'Z';
};

// ---------- banjo
{
  let s = '', g = '';
  const cx = 23, cy = 40.2, R0 = 17, R1 = 13;
  const ang = k => (k / 12) * 2 * Math.PI + .26;
  let br = '', bo = '';
  for (let k = 0; k < 12; k++) { const c = Math.cos(ang(k)), sn = Math.sin(ang(k));
    br += `M${f(cx + 15 * c)} ${f(cy + 15 * sn)}L${f(cx + 18.6 * c)} ${f(cy + 18.6 * sn)}`;
    bo += `M${f(cx + 15 * c)} ${f(cy + 15 * sn)}h0`; }
  // bracket hooks poke out past the rim
  g += L(br, 2.6);
  g += P('t-a', circ(cx, cy, R0) + circ(cx, cy, R1), ' fill-rule="evenodd"');
  g += P('t-b', `M${f(cx + R0)} ${f(cy)}A${R0} ${R0} 0 0 1 ${f(cx)} ${f(cy + R0)}L${f(cx)} ${f(cy + R1)}A${R1} ${R1} 0 0 0 ${f(cx + R1)} ${f(cy)}Z`);
  // light head
  g += C('t-c', cx, cy, R1);
  // bolt heads on the rim
  g += L(bo, 2);
  // tailpiece and bridge on the head
  g += P('t-b', rpoly([[cx - 2.4, cy + 7.4], [cx + 2.4, cy + 7.4], [cx + 1.4, cy + 12.2], [cx - 1.4, cy + 12.2]], .8));
  g += R('t-b', cx - 4, cy + 3.2, 8, 1.8, .6);
  // neck and peghead
  const top = cy - 35.2;
  g += P('t-a', `M${f(cx - 3.3)} ${f(cy - 8)}L${f(cx - 3)} ${f(top + 6)}L${f(cx + 3)} ${f(top + 6)}L${f(cx + 3.3)} ${f(cy - 8)}Z` +
    rpoly([[cx - 3, top + 7], [cx - 4.8, top + 1.5], [cx - 3.4, top - 4], [cx + 3.4, top - 4], [cx + 4.8, top + 1.5], [cx + 3, top + 7]], 1.4));
  // tuning pegs and the short fifth-string peg
  let pg = '';
  for (const y of [top + 2.6, top - 1.6]) pg += cap(cx - 4.4, y, cx - 7.6, y, 2.2) + cap(cx + 4.4, y, cx + 7.6, y, 2.2);
  pg += cap(cx + 3, cy - 24, cx + 6.2, cy - 24, 2.2);
  g += P('t-b', pg);
  // frets
  let fr = '';
  for (let i = 0, y = top + 8.6; y < cy - 10; i++, y += 2.4 + i * .4) fr += `M${f(cx - 3)} ${f(y)}H${f(cx + 3)}`;
  g += L(fr, .8);
  // strings
  let stg = '';
  for (const dx of [-1.5, -.5, .5, 1.5]) stg += `M${f(cx + dx)} ${f(cy + 7.6)}L${f(cx + dx * 1.2)} ${f(top + 6)}`;
  g += L(stg + `M${f(cx + 2.2)} ${f(cy + 7.6)}L${f(cx + 2.6)} ${f(cy - 24)}`, .45);
  s += `<g transform="rotate(34 ${cx} ${cy})">${g}</g>`;
  s += P('t-c', spark(8, 9, 3.6) + spark(57, 55, 3));
  add('banjo', 'banjo with round light drum head, rim brackets, frets and tuning pegs', s);
}

// ---------- double-bass
{
  let s = '';
  const cx = 27;
  const body = sym(cx, [cx, 20.5], [
    [[24, 20.5], [22.2, 21.5], [20.8, 24]],
    [[19.2, 27], [14.6, 28], [14.4, 32.5]],
    [[14.2, 35.5], [16.6, 36], [18.3, 37.5]],
    [[19.8, 39], [19.8, 41.6], [18.2, 43]],
    [[16.2, 44.8], [12, 45.5], [12, 50]],
    [[12, 55], [18.5, 56.5], [cx, 56.5]],
  ]);
  const fh = x => cap(x, 41.6, x, 49.2, 1.5) + circ(x + (x < cx ? 1.9 : -1.9), 40.4, 1.05) + circ(x - (x < cx ? 1.9 : -1.9), 50.4, 1.05);
  // endpin
  s += P('t-b', cap(cx, 55, cx, 58.6, 1.8));
  s += P('t-a', body + fh(cx - 7.6) + fh(cx + 7.6), ' fill-rule="evenodd"');
  // shade down the right side
  s += P('t-b', `M${f(2 * cx - 20.8)} 24C${f(2 * cx - 19.2)} 27 ${f(2 * cx - 14.6)} 28 ${f(2 * cx - 14.4)} 32.5L${f(2 * cx - 16)} 32.5C${f(2 * cx - 16.4)} 29 ${f(2 * cx - 19.5)} 27 ${f(2 * cx - 20.8)} 24Z` +
    `M${f(2 * cx - 12)} 50C${f(2 * cx - 12)} 55 ${f(2 * cx - 18.5)} 56.5 ${cx} 56.5L${cx} 55C${f(2 * cx - 17)} 55 ${f(2 * cx - 13.6)} 54 ${f(2 * cx - 13.6)} 50Z`);
  // neck and pegbox
  s += P('t-a', `M${f(cx - 2.2)} 22L${f(cx - 2.4)} 9.5L${f(cx + 2.4)} 9.5L${f(cx + 2.2)} 22Z` + circ(cx, 7.4, 2.9));
  s += P('t-b', cap(cx - 2, 11, cx - 5.4, 11, 2) + cap(cx - 2, 14.6, cx - 5.4, 14.6, 2) + cap(cx + 2, 11, cx + 5.4, 11, 2) + cap(cx + 2, 14.6, cx + 5.4, 14.6, 2));
  // scroll curl
  s += L(`M${f(cx + 1.6)} 8.6A1.7 1.7 0 1 1 ${f(cx + .3)} 5.7A1.1 1.1 0 1 1 ${f(cx - .5)} 7.4`, .8);
  // fingerboard
  s += P('t-b', `M${f(cx - 1.5)} 16.5L${f(cx + 1.5)} 16.5L${f(cx + 2.2)} 38.5Q${cx} 39.6 ${f(cx - 2.2)} 38.5Z`);
  // bridge and tailpiece
  s += P('t-b', `M${f(cx - 4.4)} 46.6L${f(cx - 3.6)} 44.4H${f(cx + 3.6)}L${f(cx + 4.4)} 46.6Z` + rpoly([[cx - 2.4, 48.4], [cx + 2.4, 48.4], [cx + 1.2, 54.6], [cx - 1.2, 54.6]], .7));
  let st = '';
  for (const dx of [-1.5, -.5, .5, 1.5]) st += `M${f(cx + dx * 1.3)} 48.6L${f(cx + dx * .7)} 16.6`;
  s += L(st, .45);
  // bow leaning on the right shoulder
  s += P('t-b', cap(51.2, 57.6, 39.4, 25.2, 1.8) + cap(39.4, 25.2, 41, 23.2, 2.2));
  s += L('M48.6 53.6L41.4 26.2', .7);
  s += P('t-a', rpoly([[47.2, 51.6], [51.2, 50.3], [52.5, 54.6], [48.6, 55.6]], .8));
  s += P('t-c', spark(8, 10, 3.6) + spark(52, 10, 3));
  add('double-bass', 'upright double bass with f-holes, scroll and endpin, bow leaning on it', s);
}

// ---------- rock-hand
{
  let s = '';
  // hand silhouette: one nonzero path, every sub-shape counter-clockwise
  const palm = rpoly(rev([[16, 29], [41.5, 31], [40.5, 46.5], [18, 47]]), 5);
  const hand = cap(20, 30, 18.6, 9, 7) + cap(37.6, 33, 40.8, 15.5, 6.2) + palm +
    cap(26.2, 28, 26.2, 34, 5.6) + cap(32, 29, 32, 34.5, 5.6) + cap(16.6, 44, 31.4, 37.6, 6.6);
  s += P('t-a', hand);
  // folded fingers, thumb outline, knuckle creases
  s += L('M29.1 27.2V34.4M23.4 34.2Q26.2 36.4 29.1 34.4Q32 36.6 34.8 34.6', 1.1);
  s += L('M17.2 40.4L30.4 34.6Q34.2 34.2 34.6 37.4', 1.1);
  s += P('t-b', rpoly([[31.2, 35.4], [34.2, 35.2], [34.4, 38.4], [31.6, 39]], .9));
  s += P('t-b', rpoly([[16.3, 8.4], [21.2, 8.6], [21, 12], [16.4, 12]], 1.6) + rpoly([[38.4, 14.4], [43.2, 15.6], [42.6, 18.4], [38.2, 17.6]], 1.4));
  s += L('M17.2 21H21M38.6 25.3L42 26', .9);
  // studded wristband
  s += P('t-a', rpoly([[16.5, 48.5], [41.5, 48.5], [42, 58.5], [16, 58.5]], 2));
  let sd = '';
  for (let x = 20; x < 40; x += 4.6) sd += `M${f(x)} 50.9L${f(x + 1.8)} 53.1L${f(x)} 55.3L${f(x - 1.8)} 53.1Z`;
  s += P('t-b', sd);
  s += P('t-b', 'M16.1 56.4H41.9L42 57.2Q42 58.5 40.6 58.5H17.4Q16 58.5 16 57.2Z');
  // lightning bolt
  s += P('t-a', rpoly([[49.5, 21], [58.5, 21], [53.6, 32.6], [58, 32.6], [46.2, 53], [49.6, 38.4], [45.2, 38.4]], .8));
  s += P('t-b', 'M53.6 32.6L58 32.6L46.2 53L49.8 38.4Z');
  s += P('t-c', spark(8.5, 16, 3.6) + spark(52, 9.5, 3) + spark(8, 54, 2.4));
  add('rock-hand', 'hand making rock horns with studded wristband and lightning bolt', s);
}

// ---------- band-stage
{
  let s = '';
  const pg = (c, pts) => `<polygon class="${c}" points="${pts.map(pt).join(' ')}"/>`;
  const mx = pts => pts.map(([x, y]) => [64 - x, y]);
  // spotlight beams and cans
  const beam = [[9.6, 13.6], [14.4, 8.8], [36, 47.5], [17, 47.5]], can = [[5, 7.4], [8.2, 4.6], [15, 9.4], [10.2, 14.2]];
  s += P('t-c', `M${beam.map(pt).join('L')}ZM${mx(beam).map(pt).join('L')}Z`);
  s += P('t-b', rpoly(can, 1.2) + rpoly(mx(can), 1.2));
  // stage
  s += R('t-a', 4.5, 47.5, 55, 3);
  s += P('t-b', 'M5 50.5H59V56.4Q59 58 57.4 58H6.6Q5 58 5 56.4Z');
  // drummer behind (centre back), sticks up
  const arm = [[26.4, 30.6], [28.4, 28.4], [23.2, 21.8], [21, 23.4]];
  s += P('t-a', circ(32, 24.4, 3.1) + `M27 28.6H37L36.4 38H27.6Z` + `M${arm.map(pt).join('L')}ZM${rev(mx(arm)).map(pt).join('L')}Z`);
  s += L('M22 22.6L19.4 18.6M42 22.6L44.6 18.6', 1);
  // cymbals on stands
  s += pg('t-b', [[18.4, 31.6], [25.6, 29.8], [25.8, 30.8], [18.6, 32.6]]) + pg('t-b', mx([[18.4, 31.6], [25.6, 29.8], [25.8, 30.8], [18.6, 32.6]]));
  s += L('M22 31.4V47.5M42 31.4V47.5', .8);
  // bass drum ring, light head, toms
  s += P('t-b', circ(32, 41, 6.6) + circ(32, 41, 4.9) + 'M25.2 32.8H30.6L30.4 36.2H25.4ZM33.4 32.8H38.8L38.6 36.2H33.6Z', ' fill-rule="evenodd"');
  s += C('t-c', 32, 41, 4.9);
  s += C('t-b', 32, 41, 1.8);
  // guitarist (left)
  const legs = (x, y) => [[x - 4, y], [x + 4, y], [x + 3.3, y + 9.6], [x + 4.9, y + 17.1], [x + 1.5, y + 17.1], [x, y + 11.2], [x - 1.5, y + 17.1], [x - 4.9, y + 17.1], [x - 3.3, y + 9.6]];
  s += P('t-a', circ(11.6, 26.2, 3.2) + rpoly(legs(11.6, 30.4), .9));
  s += P('t-b', circ(12.6, 39.4, 3.4) + circ(15.6, 37.4, 2.6) + cap(15, 37.8, 23.2, 30.6, 1.6) + rpoly([[22, 31.2], [24.6, 28.2], [26.4, 29.8], [23.6, 32.4]], .6));
  // singer at a mic stand (right), free arm punching up
  s += P('t-a', circ(52.6, 25.4, 3.2) + rpoly(legs(52.6, 29.6), .9) + 'M55 30.4L57.4 31L59.6 21.6L57.2 21Z' + circ(58.6, 20.4, 1.9) + 'M49.6 30.4L50.4 32.8L46.4 31L47 28.8Z');
  s += L('M45.4 47.5V30.6M42.8 47.5L45.4 44.4L48 47.5', 1);
  s += P('t-b', cap(45.2, 30.6, 47.4, 28.4, 2.6));
  s += P('t-c', spark(32, 9.5, 3.2));
  add('band-stage', 'small stage with guitarist, singer at a mic and drummer under two spotlights', s);
}

// ---------- concert-hall
{
  let s = '';
  const mx = pts => pts.map(([x, y]) => [64 - x, y]);
  // proscenium with an arched opening
  const open = 'M12.5 49.5V25A19.5 13.5 0 0 1 51.5 25V49.5Z';
  s += P('t-a', rpoly(rev([[4.5, 4.5], [59.5, 4.5], [59.5, 49.5], [4.5, 49.5]]), 1.6) + open, ' fill-rule="evenodd"');
  // pilasters, capitals and keystone
  s += P('t-b', 'M6.8 14H10.4V49.5H6.8ZM53.6 14H57.2V49.5H53.6ZM5.8 10.4H11.4V13H5.8ZM52.6 10.4H58.2V13H52.6ZM29.4 5.8H34.6L33.8 11.6H30.2Z');
  // plain stage floor
  s += R('t-b', 12.5, 43, 39, 6.5);
  // heavy curtains swagged back to the sides, tie-backs cut out
  const cur = 'M12.5 43V25A19.5 13.5 0 0 1 19 14.9Q17.6 26 15.6 33.4Q16 39.4 18.4 43Z';
  const tie = 'M13.2 32.6L15.8 32.9L15.7 34.5L13.2 34.3Z';
  const curR = 'M51.5 43V25A19.5 13.5 0 0 0 45 14.9Q46.4 26 48.4 33.4Q48 39.4 45.6 43Z';
  const tieR = 'M50.8 32.6L48.2 32.9L48.3 34.5L50.8 34.3Z';
  s += P('t-b', cur + tie + curR + tieR, ' fill-rule="evenodd"');
  // grand piano, lid propped open, keyboard facing the conductor
  s += P('t-a', rpoly(rev([[19.6, 31.4], [31.4, 31.4], [31.4, 35.4], [20.4, 35.4]]), [2.4, .6, .6, 2.4]) +
    rpoly(rev([[19.4, 30.4], [30.2, 30.4], [22.2, 22.6], [20.6, 22.8]]), .8) + 'M31.4 32.4H34V34.6H31.4Z' +
    cap(21.8, 35, 21.8, 43, 2) + cap(29.6, 35, 29.6, 43, 2));
  s += L('M24.4 30.2L22.9 25.6', .9);
  s += R('t-b', 31.4, 32.4, 2.6, .9);
  // conductor on the podium, back to us, baton raised
  s += P('t-a', circ(40, 26.6, 2.4) + rpoly(rev([[37.2, 29.8], [42.8, 29.8], [43.4, 37], [36.6, 37]]), 1.2) +
    cap(38.7, 36, 38.7, 39.6, 2.2) + cap(41.3, 36, 41.3, 39.6, 2.2) +
    cap(42.4, 30.8, 44.2, 25, 2) + cap(37.6, 30.8, 35, 29.4, 2) +
    rpoly(rev([[36, 39.4], [44, 39.4], [44.8, 43], [35.2, 43]]), .6));
  s += L('M44.2 25L44.9 20.6', .9);
  s += L('M36 39.6H44', .8);
  // row of round seat backs
  let se = '';
  for (let x = 4.5; x < 59; x += 7) se += `M${f(x)} 59.5V55.6A3 3 0 0 1 ${f(x + 6)} 55.6V59.5Z`;
  s += P('t-b', se);
  s += P('t-c', spark(32, 18, 2.6));
  add('concert-hall', 'arched concert hall stage with swagged curtains, grand piano and conductor on a podium', s);
}

// ---------- pop-star
{
  let s = '';
  s += P('t-c', rpoly(star(32, 32.5, 26.5, 11.5), 1.6));
  const hx = 30.5, hy = 15.5;
  // figure (one nonzero path, counter-clockwise parts)
  const torso = rpoly(rev([[24.4, 22.6], [36.6, 22.6], [34.4, 36], [27, 36]]), 2.6);
  const fig = circ(hx, hy, 4.8) + torso + cap(29.6, 21, 31, 23.5, 3.2) +
    limb([[35.2, 24.4], [41.4, 15.2], [44, 7.6]], 3.6) + circ(44.4, 7.4, 2.6) +
    limb([[25.6, 24.6], [19.6, 30.4], [25.8, 34.6]], 3.6) +
    limb([[28.4, 35], [24.8, 46.6], [22.2, 56.4]], 4.4) + limb([[33, 35], [37.4, 46], [41.4, 55.6]], 4.4);
  s += P('t-a', fig);
  // hair with a swinging ponytail
  s += P('t-b', `M${f(hx - 4.9)} ${f(hy + 1)}A4.9 4.9 0 0 1 ${f(hx + 4.9)} ${f(hy + .6)}Q${f(hx + 2)} ${f(hy - 3)} ${f(hx - 3)} ${f(hy - 1.4)}Q${f(hx - 4.4)} ${f(hy + .4)} ${f(hx - 4.9)} ${f(hy + 1)}Z` +
    `M${f(hx - 3.6)} ${f(hy - 2.6)}Q${f(hx - 9.6)} ${f(hy - 2.4)} ${f(hx - 11.4)} ${f(hy + 4.6)}Q${f(hx - 8.4)} ${f(hy + 1.6)} ${f(hx - 4.6)} ${f(hy + 1.4)}Z`);
  // headset: ear cup, boom, mic
  s += P('t-b', circ(hx + 4.4, hy + .8, 1.9));
  s += L(`M${f(hx + 4.2)} ${f(hy + 2.4)}Q${f(hx + 3.6)} ${f(hy + 4.6)} ${f(hx + .8)} ${f(hy + 4.4)}`, 1.1);
  s += P('t-b', circ(hx + .4, hy + 4.4, 1.2));
  // outfit: belt and boots
  s += P('t-b', rpoly([[26.6, 33.2], [34.8, 33.2], [34.5, 35.6], [26.9, 35.6]], .6));
  s += P('t-b', cap(23.1, 52.6, 22.2, 56.4, 4.6) + cap(40.3, 52, 41.4, 55.6, 4.6) + rpoly([[19.2, 55.2], [25, 55.2], [24.6, 58.4], [18.6, 58.4]], 1) + rpoly([[38.8, 54.4], [44.6, 54.4], [45.4, 57.8], [39.4, 57.8]], 1));
  s += P('t-c', spark(9, 9, 3.6) + spark(56, 55, 3) + spark(8.5, 53, 2.4));
  add('pop-star', 'singer with headset mic striking a pose, arm raised, big star behind', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part51.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
