// Generates part21.json (round 4): camping-tent, binoculars, village, party-hat, walking-figure, ladybug.
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
// extra: rotated ellipse as a path (for evenodd holes), straight polygon, arched window
const ell = (cx, cy, rx, ry, rot = 0) => {
  const a = rot * Math.PI / 180, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
  return `M${f(cx - dx)} ${f(cy - dy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx + dx)} ${f(cy + dy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx - dx)} ${f(cy - dy)}Z`;
};
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const arch = (x, y, w, h) => `M${f(x)} ${f(y + h)}V${f(y + w / 2)}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w)} ${f(y + w / 2)}V${f(y + h)}Z`;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- camping-tent
{
  let s = '';
  // pine tree behind, left
  s += P('t-b', rpoly([[13, 4.5], [6.5, 16], [19.5, 16]], [1, 1.2, 1.2]) + rpoly([[13, 10], [4.5, 26], [21.5, 26]], [1, 1.5, 1.5]) + rpoly([[13, 18], [2.5, 37.5], [23.5, 37.5]], [1, 1.5, 1.5]));
  // side wall receding right
  s += P('t-b', rpoly([[27, 11], [46, 8.5], [59, 49.5], [47, 55.5]], [1, 1, 1.2, .5]));
  s += L('M47.5 20L56 48', 1.2);
  // door interior
  s += P('t-b', poly([[27, 21], [17, 55.5], [37, 55.5]]));
  // front panel with the door notch
  s += P('t-a', rpoly([[27, 10.5], [4.5, 55.5], [17, 55.5], [27, 21], [37, 55.5], [48, 55.5]], [1.2, 1.2, .3, .6, .3, .6]));
  // flap tied back, highlight along the front's left edge
  s += P('t-c', rpoly([[27, 21], [37, 55.5], [40.5, 41]], [.4, .4, 1]));
  s += L('M38 38.5L42 43', 1.6);
  s += P('t-c', poly([[25.6, 16], [26.5, 17.5], [12.5, 47], [10.8, 46.6]]));
  // poles, guy ropes, pegs
  s += L('M27 11V6M46 9V5', 2.2);
  s += L('M15.5 33L3.5 55.5M53 31L60.5 51', 1.2);
  s += P('t-b', poly([[2.5, 54], [5, 54], [3.7, 58]]) + poly([[59.5, 49.5], [62, 49.5], [60.7, 53.5]]));
  // ground with tufts
  s += L('M2.5 57.5H61.5', 2);
  s += L('M51 57L52 54M53 57L54.5 53.5', 1.2);
  s += P('t-c', spark(56.5, 9, 3.6) + spark(36.5, 4.5, 2) + spark(58.5, 22, 1.8));
  add('camping-tent', 'A-frame camping tent with open door flap, guy ropes and a pine tree behind', s);
}

// ---------- binoculars
{
  let s = '';
  // eyepieces
  s += R('t-b', 13.5, 5, 13, 10, 3) + R('t-b', 41.5, 5, 13, 10, 3);
  // barrels
  s += P('t-a', rpoly([[13, 12], [28, 12], [31, 42], [8, 42]], 3) + rpoly([[40, 12], [55, 12], [58, 42], [36, 42]], 3));
  s += P('t-b', 'M24.5 13H27L29.8 41H26Z' + 'M51.5 13H54L56.8 41H53Z');
  // bridge and focus wheel
  s += R('t-b', 27, 18, 14, 13, 2.5);
  s += R('t-a', 29.5, 11.5, 9, 9, 2);
  s += P('t-b', 'M31.3 12.5h1.4v7h-1.4zM34.3 12.5h1.4v7h-1.4z');
  // rim depth (cylinder side), seen up-right of each objective
  s += C('t-b', 20.5, 43, 12.5) + C('t-b', 48.5, 43, 12.5);
  // objective rims
  s += P('t-a', circ(18, 46, 12.5) + circ(18, 46, 8.6) + circ(46, 46, 12.5) + circ(46, 46, 8.6), ' fill-rule="evenodd"');
  // glass with glint holes
  const gl = (x, y) => circ(x, y, 8.6);
  const gh = (x, y) => ell(x - 3.2, y - 3.3, 3.4, 1.5, -45) + circ(x + 3.6, y + 3.4, 1.3);
  s += P('t-b', gl(18, 46) + gh(18, 46) + gl(46, 46) + gh(46, 46), ' fill-rule="evenodd"');
  s += P('t-c', gh(18, 46) + gh(46, 46));
  s += P('t-c', spark(34, 6, 3.4) + spark(5.5, 12, 2.4));
  add('binoculars', 'pair of binoculars, front three-quarter view, with lens glints', s);
}

// ---------- village
{
  let s = '';
  // hill
  const hill = 'M2.5 60.5V52Q4 42 16 40Q26 36.5 32 36.5Q40 36.5 48 39.5Q60 44 61.5 52V60.5Z';
  // winding lane cut out of the hill
  const lane = 'M38 60.5Q37 56 41.5 53Q45 51 43 48.2L45.4 47.8Q48.4 51.6 44 55Q41 57.5 42 60.5Z';
  s += P('t-b', hill + lane, ' fill-rule="evenodd"');
  s += P('t-c', lane);
  // church: tower with spire, nave to the right
  const navR = [[35, 23], [44, 23], [49, 31.5], [35, 31.5]];
  s += P('t-b', rpoly(navR, [.5, 1, 1, .5]));
  const nave = 'M35 31H48V45H35Z', nw = arch(38, 34, 2.6, 5) + arch(43, 34, 2.6, 5);
  const tower = 'M27 18H35V46H27Z', tw = arch(29.6, 22, 2.8, 6) + circ(31, 34, 2);
  s += P('t-a', nave + nw + tower + tw, ' fill-rule="evenodd"');
  s += P('t-c', nw + tw);
  s += P('t-b', rpoly([[31, 4], [26, 19.5], [36, 19.5]], [.5, .8, .8]));
  s += R('t-b', 26.5, 17.5, 9, 2.5, .6);
  // left cottage: front gable
  const wA = poly([[6, 57], [6, 44], [14, 36], [22, 44], [22, 57]]);
  const hA = ('M9 46.5h4v4h-4z' + 'M15.5 49H19V57H15.5Z' + circ(14, 41.5, 1.4));
  s += R('t-b', 17, 33, 3, 7, .5);
  s += P('t-a', wA + hA, ' fill-rule="evenodd"');
  s += P('t-c', hA);
  s += P('t-b', rpoly([[14, 32.5], [3, 43.5], [5.5, 46], [14, 37.5], [22.5, 46], [25, 43.5]], [1.2, 1, .5, .5, .5, 1]));
  // right cottage: side gable
  s += R('t-b', 52, 35, 3, 6, .5);
  const wB = 'M44 44H58V56H44Z', hB = 'M46.5 47h4v4h-4zM53 47h3v4h-3z';
  s += P('t-a', wB + hB, ' fill-rule="evenodd"');
  s += P('t-c', hB);
  s += P('t-b', rpoly([[46.5, 37.5], [55.5, 37.5], [60.5, 45.5], [41.5, 45.5]], 1));
  // front cottage: small front gable, overlapping the tower base
  const wC = poly([[22, 60], [22, 50], [29, 43], [36, 50], [36, 60]]);
  const hC = 'M27 53H31V60H27Z' + circ(29, 48.3, 1.3);
  s += P('t-a', wC + hC, ' fill-rule="evenodd"');
  s += P('t-c', hC);
  s += P('t-b', rpoly([[29, 39.5], [19.5, 49], [22, 51.5], [29, 44.5], [36, 51.5], [38.5, 49]], [1.2, 1, .5, .5, .5, 1]));
  s += P('t-c', spark(9, 11, 3.6) + spark(52, 11, 3) + spark(19, 24, 1.8));
  add('village', 'small village of cottages with pitched roofs and a church spire on a hill', s);
}

// ---------- party-hat
{
  let s = '';
  const A = [22, 14], BL = [5, 52], BR = [39, 57], ctl = [20, 63];
  const lp = t => lerp(A, BL, t), rp = t => lerp(A, BR, t);
  s += P('t-a', `M${f(A[0])} ${f(A[1])}L${f(BL[0])} ${f(BL[1])}Q${f(ctl[0])} ${f(ctl[1])} ${f(BR[0])} ${f(BR[1])}Z`);
  // diagonal stripes
  let st = '';
  for (const [t1, t2] of [[.2, .33], [.45, .58], [.7, .8]]) {
    const o = -.1;
    st += poly([lp(t1), lp(t2), rp(t2 + o), rp(t1 + o)]);
  }
  s += P('t-b', st);
  // brim trim
  const bl2 = lp(.9), br2 = rp(.9);
  s += P('t-b', `M${f(BL[0])} ${f(BL[1])}Q${f(ctl[0])} ${f(ctl[1])} ${f(BR[0])} ${f(BR[1])}L${f(br2[0])} ${f(br2[1])}Q${f(ctl[0] + 1)} ${f(ctl[1] - 5)} ${f(bl2[0])} ${f(bl2[1])}Z`);
  // highlight on the cone's left side
  s += P('t-c', poly([lp(.36), lp(.43), [12.5 + 1.6, 36], [13.2, 33.6]]));
  // pompom
  let pom = circ(A[0], A[1] - 3, 4);
  for (let i = 0; i < 7; i++) { const a = i / 7 * 2 * Math.PI - Math.PI / 2; pom += circ(A[0] + 3.7 * Math.cos(a), A[1] - 3 + 3.7 * Math.sin(a), 2.5); }
  s += P('t-c', pom);
  // party horn: straight tube rising from the mouthpiece, its tip curling into a spiral
  const pts = [], M0 = [51.5, 52], E0 = [46, 30], r0 = 8.5, th0 = 166;
  const cx = E0[0] - r0 * Math.cos(th0 * Math.PI / 180), cy = E0[1] - r0 * Math.sin(th0 * Math.PI / 180);
  for (let i = 0; i <= 8; i++) pts.push(lerp(M0, E0, i / 8));
  const NS = 36, sweep = 470;
  for (let i = 1; i <= NS; i++) { const k = i / NS, th = (th0 + sweep * k) * Math.PI / 180, r = r0 - 5.6 * Math.pow(k, .9); pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]); }
  const n = pts.length, W = i => i <= 8 ? 6.2 - .3 * i / 8 : 5.9 - 3.4 * (i - 8) / (n - 9);
  const side = sgn => pts.map((p, i) => { const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return [p[0] - dy / l * W(i) / 2 * sgn, p[1] + dx / l * W(i) / 2 * sgn]; });
  const sl = side(1), sr = side(-1), pl = q => q.map(p => `${f(p[0])} ${f(p[1])}`).join('L');
  s += P('t-a', 'M' + pl(sl) + `A1.6 1.6 0 0 1 ${f(sr[n - 1][0])} ${f(sr[n - 1][1])}L` + pl(sr.slice().reverse()) + 'Z');
  let hs = '';
  for (const i of [1, 4, 7, 11, 16]) hs += poly([sl[i], sl[i + 1.5 | 0] , sr[i + 1.5 | 0], sr[i]]);
  s += P('t-b', hs);
  // flared mouthpiece with a frilled collar
  s += P('t-b', rpoly([[47.5, 51.5], [55.5, 50], [55.8, 54], [54.5, 60.5], [51.5, 61], [49.5, 55]], [1, 1, .5, 1, 1, .5]));
  s += P('t-c', cap(51.3, 53.8, 53.6, 53.4, 1.3));
  // confetti
  s += P('t-a', rpoly([[7, 11], [10.5, 9], [11.5, 11], [8, 13]], .5) + rpoly([[36, 8.5], [39.5, 10.5], [38.5, 12.5], [35, 10.5]], .5) + circ(5.5, 26, 1.6) + circ(32.5, 22, 1.4));
  s += P('t-c', spark(58, 6.5, 3.4) + spark(13, 4.5, 1.6) + spark(30.5, 4.5, 1.8));
  add('party-hat', 'striped cone party hat with a pompom and a party horn unrolling beside it', s);
}

// ---------- walking-figure
{
  let s = '';
  // far limbs (t-b): back leg pushing off the toe, forward arm
  s += P('t-b', limb([[30, 36], [24, 46], [17.5, 53.5]], 7.6) + cap(17.5, 53.5, 22.5, 57, 5.4) + limb([[36, 22.5], [41.5, 30.5], [47.5, 26.5]], 6.4));
  // torso
  s += P('t-a', cap(35.5, 21.5, 31.5, 36.5, 11));
  // near leg striding forward onto the heel, near arm swinging back
  s += P('t-a', limb([[31, 36.5], [38.5, 46], [41.5, 56]], 8) + cap(40, 56.5, 47.5, 55.5, 5.6) + limb([[34.5, 22.5], [27, 30.5], [21.5, 26.5]], 6.6));
  // head with highlight cut out
  const hx = 38.5, hy = 10.5, hl = `M${f(hx - 5.3)} ${f(hy - .5)}A5.5 5.5 0 0 1 ${f(hx - 1.3)} ${f(hy - 5.4)}L${f(hx - .9)} ${f(hy - 4)}A4.1 4.1 0 0 0 ${f(hx - 3.9)} ${f(hy - .1)}Z`;
  s += P('t-a', circ(hx, hy, 6.4) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', `M${f(hx + 5.5)} ${f(hy - 3.2)}A6.4 6.4 0 0 1 ${f(hx - 3)} ${f(hy + 5.6)}A7.4 7.4 0 0 0 ${f(hx + 5.5)} ${f(hy - 3.2)}Z`);
  // motion lines and ground
  s += L('M7 24H15M4.5 32H12.5M8 40H14', 3);
  s += L('M12 59.5H54', 1.6);
  s += P('t-c', spark(55, 9, 4.2) + spark(57, 40, 2.6) + spark(14, 9, 2));
  add('walking-figure', 'pictogram person walking briskly, side-on facing right', s);
}

// ---------- ladybug
{
  let s = '';
  // legs and antennae under/around the body
  s += L('M14.5 28L9 25.5L6.5 21M9.5 41H6.5L4 45M15 53L11 56.5L10 60.5M49.5 28L55 25.5L57.5 21M54.5 41H57.5L60 45M49 53L53 56.5L54 60.5', 2.2);
  s += L('M29.5 9Q26.5 4.5 22.5 5M34.5 9Q37.5 4.5 41.5 5', 1.8);
  s += P('t-b', circ(22, 5, 2) + circ(42, 5, 2));
  // abdomen showing in the gap
  s += E('t-b', 32, 42, 13, 17);
  // wing cases, each hinged near the top centre and swung slightly out
  const half = sw => `M32 22A21.5 19.5 0 0 ${sw} 32 61Z`;
  const sp = [[21, 33, 3.6], [17.5, 44, 2.8], [26, 50, 3.4], [28.2, 29.5, 2]];
  const spotsL = sp.map(([x, y, r]) => circ(x, y, r)).join(''), spotsR = sp.map(([x, y, r]) => circ(64 - x, y, r)).join('');
  const glL = 'M16.5 27.5Q20 24 25 23.5Q21 26.5 18.5 30Z', glR = 'M47.5 27.5Q44 24 39 23.5Q43 26.5 45.5 30Z';
  s += `<g transform="rotate(9 32 23)">` + P('t-a', half(0) + spotsL, ' fill-rule="evenodd"') + P('t-c', glL) + '</g>';
  s += `<g transform="rotate(-9 32 23)">` + P('t-a', half(1) + spotsR, ' fill-rule="evenodd"') + P('t-c', glR) + '</g>';
  // pronotum with white patches, and head with eyes
  const patches = ell(25.8, 22.5, 2.6, 1.9, -15) + ell(38.2, 22.5, 2.6, 1.9, 15);
  const eyes = circ(29.2, 12.5, 1.5) + circ(34.8, 12.5, 1.5);
  s += P('t-b', circ(32, 13.5, 5.8) + eyes, ' fill-rule="evenodd"');
  s += P('t-b', ell(32, 22.5, 11.5, 6.5) + patches, ' fill-rule="evenodd"');
  s += P('t-c', patches + eyes);
  s += P('t-c', spark(9, 11, 3.4) + spark(55, 12, 2.4));
  add('ladybug', 'ladybird seen from above, spotted wing cases slightly open, antennae', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part21.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
