// Generates part30.json (round 4).
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

const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
// rotated ellipse as a path
const rell = (x, y, rx, ry, rot) => {
  const a = rot * Math.PI / 180, cx = Math.cos(a) * rx, cy = Math.sin(a) * rx;
  return `M${f(x - cx)} ${f(y - cy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(x + cx)} ${f(y + cy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(x - cx)} ${f(y - cy)}Z`;
};
const pts = a => 'M' + a.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- lobster (top-down, head up)
{
  let s = '';
  const M = x => 64 - x;
  // walking legs
  let lg = '';
  for (const [y, d] of [[25, 0], [28.5, 1], [32, 1.5], [35.5, 1]]) {
    lg += `M30 ${y}L${f(22 - d)} ${f(y + 1.5)}L${f(19 - d)} ${f(y + 6)}M34 ${y}L${f(M(22 - d))} ${f(y + 1.5)}L${f(M(19 - d))} ${f(y + 6)}`;
  }
  s += L(lg, 2.2);
  // antennae
  s += L('M30 15Q27 8 21.5 4M34 15Q37 8 42.5 4', 1.4);
  // arms + claws, carapace, tail, fan
  const claw = sg => {
    const X = x => sg > 0 ? x : M(x);
    return limb([[X(28), 21], [X(21), 27.5], [X(16.5), 24]], 4.6) +
      rell(X(14), 18.5, 5.8, 8.6, sg * -18) + cap(X(10.5), 13, X(7.6), 4.6, 4.8) + cap(X(15.6), 12.5, X(15.2), 5.6, 3.6);
  };
  let tail = '';
  const tw = [6.8, 6.3, 5.8, 5.2];
  tw.forEach((w, k) => { const y = 36.5 + k * 4; tail += rpoly([[32 - w, y], [32 + w, y], [32 + w - .4, y + 4.6], [32 - w + .4, y + 4.6]], 1.6); });
  const fan = 'M27.2 52L36.8 52L43 57.6Q40.5 61 37 59Q34.5 61.8 32 59.6Q29.5 61.8 27 59Q23.5 61 21 57.6Z';
  s += P('t-a', claw(1) + claw(-1) + ell(32, 27, 7.6, 11) + 'M32 12.5L35 18L29 18Z' + tail + fan);
  // shading: carapace right crescent, claw inner shade, tail right
  s += P('t-b', 'M32 16A7.6 11 0 0 1 32 38A4.6 11 0 0 0 32 16Z');
  s += P('t-b', rell(15.6, 20.5, 2.2, 4.8, -18) + rell(M(15.6), 20.5, 2.2, 4.8, 18));
  // segment seams + fan ribs + carapace groove
  let sm = '';
  for (let k = 1; k <= 4; k++) { const y = 36.5 + k * 4, w = (tw[k] || 5) + .3; sm += `M${f(32 - w)} ${f(y - .6)}Q32 ${f(y + 1.2)} ${f(32 + w)} ${f(y - .6)}`; }
  s += L(sm + 'M32 53V58.5M29 53.5L26 58M35 53.5L38 58', 1.2);
  s += L('M26.2 22.5Q32 26.5 37.8 22.5', 1.2);
  // eyes
  s += P('t-b', circ(29.2, 17.2, 1.5) + circ(34.8, 17.2, 1.5));
  // highlight
  s += P('t-c', 'M27 25Q27.4 20 29.6 18.6Q28.4 22 28.6 26Z' + spark(8, 50, 3.6) + spark(56, 49, 2.6));
  add('lobster', 'a lobster from above with big claws, segmented tail and antennae', s);
}

// ---------- teapot
{
  let s = '';
  // steam from spout
  s += L('M52 20Q50 17 52 14Q54 11 52 8M57.5 19.5Q55.5 16.5 57.5 13.5', 1.6);
  // handle ring (left)
  s += P('t-a', ell(15, 37, 9, 9.5) + ell(15, 37, 4.8, 5.5), ' fill-rule="evenodd"');
  // spout, lid, knob, foot
  s += P('t-a', 'M39.5 34Q47 37 52 28L54.5 24.6Q57.5 23.2 58 26.4L56.4 29Q52 44 39.5 47Z' +
    'M18 23.5Q19 16.5 28 16.2Q37 16.5 38 23.5Z' + circ(28, 14.4, 2.8) + rpoly([[19, 48], [37, 48], [38.5, 53.5], [17.5, 53.5]], 1.4));
  // body with tag hole + highlight hole
  const tag = 'M30.6 30.5H37.4V38.2H30.6Z', hl = 'M17.5 34Q18.5 27 24 24.6Q20.8 28.6 20.4 35Z';
  s += P('t-a', circ(28, 37, 14) + tag + hl, ' fill-rule="evenodd"');
  s += P('t-c', tag + hl);
  // shade
  s += P('t-b', 'M41.6 34A14 14 0 0 1 17 46A15 15 0 0 0 41.6 34Z');
  s += R('t-b', 17, 21.6, 22, 3.2, 1.6);
  s += P('t-b', 'M37.6 26.6Q55 34 39.5 43.6Z'.replace(/.*/, 'M40 44.5Q47 42 51.6 33L53.4 34Q49 45 40 47Z'));
  // tag string + tag mark
  s += L('M31.5 23.2Q31 27 34 30.5', 1.2);
  s += P('t-b', circ(34, 34.6, 1.7));
  // cup + saucer
  s += P('t-a', ell(51.5, 57.6, 9.2, 2.2) + rpoly([[45, 47], [58, 47], [57, 55.2], [46, 55.2]], [.6, .6, 2.5, 2.5]) + ell(58.4, 50.4, 3, 2.8) + ell(58.4, 50.4, 1.4, 1.2), ' fill-rule="evenodd"');
  s += P('t-b', 'M45 47H58L57.8 49H45.2Z');
  s += P('t-b', 'M54 55.2L57 55.2Q58 52 57.4 50Z');
  s += P('t-c', spark(8, 10, 3.6) + spark(42, 7, 2.4));
  add('teapot', 'a round teapot with a spout, lid knob and a tag hanging out, steam rising, a cup beside', s);
}

// ---------- pulled-weed
{
  let s = '';
  // broad toothed leaf: a few big backward teeth per side, softly rounded
  // dandelion leaf drawn once along +x (length 20), three big saw teeth a side
  const LF = [[0, 0], [2.4, 2.6], [6.6, 6.4], [7, 3.6], [11.4, 6.6], [11.8, 3.8], [16, 5], [16.4, 2.6], [20, 0]];
  const LF2 = [[0, 0], [3, 2.6], [8.4, 6.2], [9, 3.4], [14.4, 5], [15, 2.4], [20, 0]];
  const leaf = (bx, by, tx, ty, ws, lf = LF) => {
    const dx = (tx - bx) / 20, dy = (ty - by) / 20, Ln = Math.hypot(dx, dy), nx = -dy / Ln * ws, ny = dx / Ln * ws;
    const pt = ([x, y]) => [bx + dx * x + nx * y, by + dy * x + ny * y];
    const up = lf.map(pt), dn = lf.slice(1, -1).map(([x, y]) => pt([x, -y])).reverse();
    return rpoly([...up, ...dn], .9);
  };
  // root: one taproot and three rootlets
  s += P('t-a', 'M21 37Q22 49 26.6 60.6Q29 49 28 37Z');
  s += L('M23.4 46L19 49.6M26.4 51L30.8 54M25.2 42L29.8 44.6', 1.4);
  // leaves + stem + flower
  s += P('t-a', leaf(24, 36, 4.4, 28, 1) + leaf(25, 36, 41.6, 26, .95) + leaf(24, 34, 34.4, 14, .72, LF2) +
    cap(23.4, 15, 24.2, 34, 2.8) + pts(star(22, 10.6, 6.8, 4.8, 11)));
  s += L('M24 36L8.2 29.6M25 36L38 28M24 34L32.6 17.4', 1.2);
  s += P('t-b', circ(22, 10.6, 3));
  // soil clump on the crown
  s += P('t-b', rpoly([[16.6, 35.4], [24, 33.2], [31.8, 34.6], [32.4, 40.4], [24.4, 44.4], [16, 41]], 3.4) + circ(17, 48, 1.3) + circ(31.4, 48.4, 1.1));
  // hand fork
  const tine = x => `M${f(x - 1.5)} 30L${f(x - 1.5)} 15Q${f(x - 1.5)} 12.4 ${f(x)} 10Q${f(x + 1.5)} 12.4 ${f(x + 1.5)} 15L${f(x + 1.5)} 30Z`;
  s += P('t-a', tine(45) + tine(50.5) + tine(56) + rpoly([[43.4, 26.5], [57.6, 26.5], [55.6, 32], [45.4, 32]], 1.6) + cap(50.5, 30, 50.5, 39, 3.2));
  s += P('t-a', cap(50.5, 44.5, 50.5, 59.6, 7.4) + circ(50.5, 56, 1.3), ' fill-rule="evenodd"');
  s += P('t-b', 'M53.1 44.5Q53.7 52 53.1 58.8Q54.1 58.4 54.2 56V44.6Z');
  s += R('t-b', 47.5, 38, 6, 6, 1.2);
  s += P('t-c', spark(8, 9, 3.4) + spark(9, 52, 2.6));
  add('pulled-weed', 'a hand-pulled dandelion weed with its long root and soil clumps, a hand fork beside', s);
}

// ---------- fertilizer-bag
{
  let s = '';
  // open mouth + granule mound
  s += P('t-b', ell(25, 14.6, 16.2, 3.4));
  s += P('t-a', 'M10.6 14.8Q13 6 25 5Q37 6 40.6 14.8Q43 15 43.4 17Q25 19.5 10.6 14.8Z');
  // bag body with label hole
  const lab = 'M12.6 28H33.4V47H12.6Z';
  const body = 'M10.4 22Q7.4 40 8.6 55Q9 58.2 12 58.2L38 58.2Q41 58.2 41.4 55Q42.8 40 40 22Z';
  s += P('t-a', body + rpoly([[12.6, 28], [33.4, 28], [33.4, 47], [12.6, 47]], 2.4), ' fill-rule="evenodd"');
  s += P('t-c', rpoly([[12.6, 28], [33.4, 28], [33.4, 47], [12.6, 47]], 2.4));
  // cuff
  s += P('t-a', rpoly([[8.4, 15.6], [41.6, 15.6], [40.8, 23.4], [9.2, 23.4]], 2));
  s += P('t-b', 'M9.4 21.6H40.6L40.4 23.6H9.6Z' + 'M36 24L40.2 23.6Q43 40 41.4 55Q41 58.2 38 58.2L37 58.2Q39.6 40 36 24Z');
  // leaf logo
  s += P('t-a', 'M23 44.5Q14 42 16 31.5Q24.5 33 23 44.5Z' + 'M23 44.5Q22 35 31 33Q32 42 23 44.5Z');
  s += L('M23 44.5L17.6 33.6M23 44.5L29.6 35', 1.1);
  // NPK bars
  s += P('t-b', R('t-b', 0, 0, 0, 0).slice(0, 0) + 'M13 50.5H19V53H13ZM21.5 50.5H27.5V53H21.5ZM30 50.5H34V53H30Z');
  // mound granules
  s += P('t-b', circ(18, 11.6, 1) + circ(23, 8.6, 1) + circ(28.6, 10.4, 1) + circ(33.6, 12.6, 1) + circ(24.4, 13.4, .9) + circ(38.8, 15.4, .9));
  s += P('t-c', circ(20.6, 9.4, .9) + circ(31.4, 8.6, .8) + circ(15, 13.4, .8));
  // spill stream + pile
  s += P('t-a', circ(44.2, 19.6, 1.6) + circ(45.6, 24.6, 1.5) + circ(46.4, 30, 1.4) + circ(47, 35.6, 1.4) + circ(47.4, 41, 1.3) + circ(47.4, 46.4, 1.3) + circ(49.4, 22, 1) + circ(50.6, 31, 1) + circ(51, 40, 1) +
    'M39.6 59.6Q43 50.4 50 50Q57.4 50.4 60.8 59.6Z');
  s += P('t-b', circ(45, 57, 1) + circ(49, 54, 1) + circ(53.6, 56.8, 1) + circ(57.4, 58, .8) + circ(50, 58.4, .8));
  s += P('t-c', spark(6.5, 7.5, 3.4) + spark(55, 9, 3) + spark(56, 40, 2));
  add('fertilizer-bag', 'a sack of plant food with a leaf logo, open top, granules spilling', s);
}

// ---------- book-on-head (front view)
{
  let s = '';
  // legs + feet
  s += P('t-b', cap(27.4, 50, 27.4, 58.4, 5.4) + cap(36.6, 50, 36.6, 58.4, 5.4) + cap(23.4, 59.4, 28, 59.4, 4) + cap(36, 59.4, 40.6, 59.4, 4));
  // arms out for balance, torso, dress, neck, head (highlight cut out)
  const hl = 'M25.4 19.6Q25.8 14.6 30 13.4Q27.8 16.4 27.6 20.2Z';
  s += P('t-a', limb([[25, 31.6], [13, 35.4], [7.2, 33.2]], 5.6) + limb([[39, 31.6], [51, 35.4], [56.8, 33.2]], 5.6) + circ(6, 32.8, 3.2) + circ(58, 32.8, 3.2));
  s += P('t-a', rpoly([[19.6, 28.4], [44.4, 28.4], [41.6, 41], [22.4, 41]], [3, 3, 1, 1]) + rpoly([[24, 38], [40, 38], [48.4, 53], [15.6, 53]], [1, 1, 2, 2]) +
    'M29 25H35V30H29Z');
  s += P('t-a', circ(32, 19.8, 7.6) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  // waist band + dress shade
  s += P('t-b', 'M22.6 38.4H41.4L40.8 41.2H23.2Z' + 'M37.4 41.2L40.8 41.2L48.4 53L44 53Z');
  // thick closed book, page edges cut out
  const pg = 'M18.4 6.3H45.6V7.3H18.4ZM18.4 8.3H45.6V9.3H18.4Z';
  s += P('t-a', rpoly([[15, 2.8], [49, 2.8], [49, 12.3], [15, 12.3]], 1.6) + pg, ' fill-rule="evenodd"');
  s += P('t-b', 'M15 10.6H49V10.9Q49 12.3 47.4 12.3H16.6Q15 12.3 15 10.9Z');
  s += P('t-c', spark(7, 8, 3.2) + spark(57, 8, 3.2) + spark(8, 50, 2.6) + spark(56, 50, 2.6));
  add('book-on-head', 'a pictogram person standing tall balancing a book on their head', s);
}

// ---------- office-desk
{
  let s = '';
  // lamp
  s += P('t-a', limb([[10.5, 35], [7, 24], [15.6, 12.6]], 2.6) + rpoly([[5.4, 37.2], [16, 37.2], [15, 34], [6.4, 34]], 1) + rpoly([[12, 9.4], [19.6, 9.4], [23, 18], [8.6, 18]], [1.5, 1.5, 1, 1]));
  s += P('t-b', circ(7, 24, 1.8) + 'M8.6 18H23L22.4 16.4H9.2Z');
  // monitor with screen hole
  const scr = 'M26.8 10.6H48.2V26.4H26.8Z';
  s += P('t-a', rpoly([[24.4, 8.2], [50.6, 8.2], [50.6, 30.4], [24.4, 30.4]], 2) + scr, ' fill-rule="evenodd"');
  s += P('t-c', scr);
  s += P('t-a', 'M28.8 12.8H40V14.8H28.8ZM28.8 17H36V19H28.8ZM28.8 21.2H38V23.2H28.8Z' + rpoly([[41.6, 16.4], [46.2, 16.4], [46.2, 24.2], [41.6, 24.2]], .8));
  s += P('t-a', 'M35.4 30H39.6V35H35.4Z' + rpoly([[31, 34.4], [44, 34.4], [44, 37.4], [31, 37.4]], 1.2));
  s += P('t-b', 'M24.4 28H50.6V28.4Q50.6 30.4 48.6 30.4H26.4Q24.4 30.4 24.4 28.4Z');
  // mug + steam
  s += P('t-a', rpoly([[52.2, 29.4], [58.4, 29.4], [58, 37.4], [52.6, 37.4]], [.5, .5, 1.6, 1.6]) + ell(58.8, 33, 2.6, 2.4) + ell(58.8, 33, 1.2, 1), ' fill-rule="evenodd"');
  s += P('t-b', 'M56.4 29.4H58.4L58 37.4H56.6Z');
  s += L('M54.4 26.6Q53.2 24.6 54.6 22.6Q56 20.6 54.8 18.6', 1.3);
  // desk top, leg, pedestal
  s += P('t-a', rpoly([[4, 37.2], [60, 37.2], [60, 41.8], [4, 41.8]], 1.4) + R('t-a', 0, 0, 0, 0).slice(0, 0) + 'M6.4 41H10V59.6H6.4Z' + rpoly([[42, 41], [57.6, 41], [57.6, 59.6], [42, 59.6]], [.1, .1, 1, 1]));
  s += P('t-b', 'M4.6 41.8H59.4V43.6H4.6Z');
  s += L('M42.6 50.4H57M42.6 55.2H57', 1);
  s += P('t-b', 'M47.4 46H52.2V47.8H47.4ZM47.4 51.8H52.2V53.6H47.4ZM47.4 56.6H52.2V58.2H47.4Z');
  // chair (in front)
  s += P('t-b', rpoly([[16, 38.6], [31, 38.6], [30, 49.6], [17, 49.6]], 3) + 'M22.4 52H25V56.6H22.4Z' + limb([[23.7, 57], [15.6, 58.8]], 2.2) + limb([[23.7, 57], [31.8, 58.8]], 2.2) + circ(15.4, 60.2, 1.7) + circ(32, 60.2, 1.7) + circ(23.7, 60.2, 1.7));
  s += P('t-a', rpoly([[13.2, 49], [33.8, 49], [33, 53], [14, 53]], 1.8));
  s += P('t-c', rpoly([[18.6, 40.6], [28.4, 40.6], [27.8, 47.6], [19.2, 47.6]], 2).replace(/.*/, m => m) && 'M19.6 41.4H21.6L21.2 47H19.8Z');
  s += P('t-c', spark(5.6, 5.4, 3) + spark(58, 9, 3.2));
  add('office-desk', 'a home-office desk with a monitor, desk lamp, mug and chair', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part30.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
