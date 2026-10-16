// Generates part40.json (round 4, subject hero icons).
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
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const rot = (pts, a, cx, cy) => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180); return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); };
const rrect = (x, y, w, h, r) => rpoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
// leaf outline from tip a to tip b, half-width w
const leaf = (ax, ay, bx, by, w) => { const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy), nx = -dy / l * w * 2, ny = dx / l * w * 2;
  return `M${f(ax)} ${f(ay)}Q${f(mx + nx)} ${f(my + ny)} ${f(bx)} ${f(by)}Q${f(mx - nx)} ${f(my - ny)} ${f(ax)} ${f(ay)}Z`; };

// ---------- camera-lens
{
  let s = '';
  const F = { x: 22, y: 31, rx: 16, ry: 20.5 }, B = { x: 42.5, y: 27.5, rx: 11, ry: 15 };
  const E = t => ({ x: F.x + (B.x - F.x) * t, y: F.y + (B.y - F.y) * t, rx: F.rx + (B.rx - F.rx) * t, ry: F.ry + (B.ry - F.ry) * t });
  const pt = (t, a) => { const e = E(t), r = a * Math.PI / 180; return [e.x + e.rx * Math.cos(r), e.y + e.ry * Math.sin(r)]; };
  const arc = (t, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => pt(t, a0 + (a1 - a0) * i / n));
  const band = (t1, t2, a0 = -90, a1 = 90) => poly([...arc(t1, a0, a1), ...arc(t2, a1, a0)]);
  // barrel silhouette
  s += P('t-a', poly([pt(0, -90), pt(1, -90), ...arc(1, -90, 90, 8), pt(0, 90)]));
  // knurled focus ring: fine ridges cut out
  let ridges = '';
  for (let a = -78; a <= 78; a += 13) ridges += poly([pt(.24, a - 1.8), pt(.54, a - 1.8), pt(.54, a + 1.8), pt(.24, a + 1.8)]);
  s += P('t-b', band(.24, .54) + ridges, ' fill-rule="evenodd"');
  // front edge shade, aperture ring and rear mount
  s += P('t-b', band(0, .08) + band(.66, .73) + band(.88, 1));
  // front face: thin rim, big dark glass
  const g = (k, dx = 0) => ell(F.x + dx, F.y, F.rx * k, F.ry * k);
  s += P('t-a', g(1) + g(.88, .4), ' fill-rule="evenodd"');
  const cs = (k1, k2, a0, a1) => { const c = [F.x + .8, F.y];
    const Q = (k, a) => [c[0] + F.rx * k * Math.cos(a * Math.PI / 180), c[1] + F.ry * k * Math.sin(a * Math.PI / 180)];
    return poly([...Array.from({ length: 6 }, (_, i) => Q(k1, a0 + (a1 - a0) * i / 5)), ...Array.from({ length: 6 }, (_, i) => Q(k2, a1 - (a1 - a0) * i / 5))]); };
  const sh = cs(.8, .66, 190, 262) + cs(.8, .7, 25, 60);
  const ring = g(.6, 1.4) + g(.53, 1.6), core = g(.22, 2);
  s += P('t-b', g(.88, .4) + ring + sh + core, ' fill-rule="evenodd"');
  s += P('t-a', ring, ' fill-rule="evenodd"');
  s += P('t-c', sh + core);
  // lens cap
  s += P('t-b', ell(50, 54, 10, 6.4) + 'M40 51H60V54H40Z');
  s += P('t-a', ell(50, 51, 10, 6.4) + ell(50, 51, 7.2, 4.4) + ell(50, 51, 5.8, 3.4), ' fill-rule="evenodd"');
  s += P('t-c', spark(57, 9, 3.5) + spark(7.5, 56, 2.8));
  add('camera-lens', 'camera lens at three-quarter view with focus rings and a lens cap', s);
}

// ---------- lino-roller
{
  let s = '';
  // fresh print, tilted sheet
  const sheet = rot([[6, 6], [27, 6], [27, 31], [6, 31]], -8, 16.5, 18.5), ink = rot([[9.5, 9.5], [23.5, 9.5], [23.5, 27.5], [9.5, 27.5]], -8, 16.5, 18.5);
  const pl = rot([[12, 24.5], [21, 12.5]], -8, 16.5, 18.5);
  const pleaf = leaf(pl[0][0], pl[0][1], pl[1][0], pl[1][1], 3.6);
  s += P('t-c', rpoly(sheet, 1));
  s += P('t-b', rpoly(ink, .6) + pleaf, ' fill-rule="evenodd"');
  s += P('t-b', cap(pl[0][0], pl[0][1], pl[0][0] + (pl[1][0] - pl[0][0]) * .8, pl[0][1] + (pl[1][1] - pl[0][1]) * .8, 1));
  // lino block: top face with carved leaf, front edge
  s += P('t-b', rrect(5, 48, 47, 9, 1.5));
  const la = [8.5, 50], lb = [30, 41.5];
  const lf = leaf(la[0], la[1], lb[0], lb[1], 4.6);
  s += P('t-a', rrect(5, 38.5, 47, 14, 1.5) + lf, ' fill-rule="evenodd"');
  s += P('t-c', lf);
  // veins left standing in the carving
  const vx = t => la[0] + (lb[0] - la[0]) * t, vy = t => la[1] + (lb[1] - la[1]) * t;
  let vn = cap(vx(.08), vy(.08), vx(.9), vy(.9), 1.4);
  for (const t of [.3, .5, .7]) { vn += cap(vx(t), vy(t), vx(t + .13) - 1.6, vy(t + .13) - 3.6, 1.1) + cap(vx(t), vy(t), vx(t + .13) + 1.4, vy(t + .13) + 3.6, 1.1); }
  s += P('t-a', vn);
  // roller: inked rubber cylinder with highlight slit, visible end cap
  const hl = rrect(37, 33.6, 13, 1.6, .8);
  s += P('t-b', `M34 32H52.5V44.4H34A2.6 6.2 0 0 1 34 32Z` + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-a', ell(52.5, 38.2, 2.8, 6.2) + ell(52.7, 38.2, 1, 1.6), ' fill-rule="evenodd"');
  // fork and handle
  s += P('t-a', limb([[33, 38.2], [33.5, 29], [42.5, 24]], 2.4) + limb([[52.7, 38.2], [51.5, 29], [42.5, 24]], 2.4));
  s += P('t-a', cap(44.5, 21.5, 56, 8, 7));
  s += P('t-b', cap(42.3, 24.2, 45.4, 20.5, 6.2));
  s += P('t-c', spark(38, 9.5, 3.2) + spark(58.5, 58.5, 2.4));
  add('lino-roller', 'ink brayer rolling over a carved lino block, with a fresh leaf print', s);
}

// ---------- book-conveyor
{
  let s = '';
  // direction arrow
  s += L('M9 17H33M28.5 12.8L33 17L28.5 21.2', 2.2);
  // belt loop, rollers, legs
  s += P('t-b', 'M11 49h3v9h-3ZM32 49h3v9h-3Z') + R('t-b', 4, 57.5, 56, 2.5, 1.2);
  s += P('t-b', cap(9, 44, 37, 44, 10.4) + cap(9, 44, 37, 44, 7.2), ' fill-rule="evenodd"');
  let rl = '';
  for (const x of [9, 16, 23, 30, 37]) rl += circ(x, 44, 3) + circ(x, 44, 1);
  s += P('t-a', rl, ' fill-rule="evenodd"');
  // three identical new books upright on the belt
  let bk = '', sp = '';
  const sq = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  let pe = '';
  for (const x of [6, 17, 28]) { const t = sq(x + 4, 26.5, 3.6, 1.3) + sq(x + 4, 29.3, 3.6, 1.3), pg = `M${x + 7.4} 24.2h1.8v14.6h-1.8Z`;
    bk += sq(x, 22.5, 9.6, 16.3) + t + pg; sp += sq(x, 22.5, 2.8, 16.3); pe += pg; }
  s += P('t-a', bk, ' fill-rule="evenodd"');
  s += P('t-b', sp);
  s += P('t-c', pe);
  // finished stack at the end
  const offs = [44.5, 45.8, 44, 45.4, 44.8];
  let st = '', ss = '', pg = '';
  offs.forEach((x, i) => { const y = 52.4 - i * 5.3;
    st += sq(x, y, 15, 4.7) + sq(x + 11.6, y + 1.1, 2.6, 2.5);
    ss += sq(x, y, 3, 4.7); pg += sq(x + 11.6, y + 1.1, 2.6, 2.5); });
  s += P('t-a', st, ' fill-rule="evenodd"');
  s += P('t-b', ss);
  s += P('t-c', pg);
  s += P('t-c', spark(52, 22, 3.4) + spark(58.5, 7, 2.6) + spark(42, 8, 2));
  add('book-conveyor', 'identical new books riding a conveyor belt into a finished stack', s);
}

// ---------- arm-wrestle
{
  let s = '';
  // table
  s += P('t-b', rrect(8.5, 50, 4, 10, 0) + rrect(51.5, 50, 4, 10, 0));
  s += P('t-b', rrect(4, 45.5, 56, 6, 1.5));
  // upper arms and sleeves
  s += P('t-a', cap(16.5, 41, 9.5, 32.5, 9.4) + cap(47.5, 41, 54.5, 32.5, 9.4));
  s += P('t-b', cap(11.4, 35, 8.9, 31.8, 10) + cap(52.6, 35, 55.1, 31.8, 10));
  // forearms tapering to the wrists
  const fa = (ex, ey, wx, wy) => { const dx = wx - ex, dy = wy - ey, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
    return `M${f(ex + nx * 5)} ${f(ey + ny * 5)}L${f(wx + nx * 3.6)} ${f(wy + ny * 3.6)}L${f(wx - nx * 3.6)} ${f(wy - ny * 3.6)}L${f(ex - nx * 5)} ${f(ey - ny * 5)}A5 5 0 0 1 ${f(ex + nx * 5)} ${f(ey + ny * 5)}Z`; };
  s += P('t-a', fa(16.5, 41, 28, 25) + fa(47.5, 41, 36.5, 25));
  // muscle shade on the inner side of each forearm
  s += P('t-b', 'M20.4 41.8Q25 36 27.6 30.2L30.6 27.6Q28.5 37 21.4 44.6Z' + 'M43.6 41.8Q39 36 36.4 30.2L33.4 27.6Q35.5 37 42.6 44.6Z');
  // gripped hands with finger gaps cut out
  let fg = '';
  for (const y of [16.6, 20, 23.4]) fg += rrect(25.2, y, 6.4, 1.2, .6);
  s += P('t-a', rrect(24, 12.5, 16.5, 16, 6) + fg, ' fill-rule="evenodd"');
  s += P('t-b', 'M34.5 13.6Q40.5 14 40.5 20.5Q40.5 27.5 34 28.4Q37.8 24 37.8 20.5Q37.8 16 34.5 13.6Z');
  s += P('t-a', cap(29, 14.5, 33.8, 9.2, 4.6));
  // effort lines
  s += L('M19.5 14.5L15 11M18.5 20.5L13 20M44.5 14.5L49 11M45.5 20.5L51 20M32 5.5V4.6', 2);
  s += P('t-c', spark(6.5, 7.5, 3.2) + spark(57.5, 7.5, 3.2));
  add('arm-wrestle', 'two forearms gripping hands in an arm wrestle on a table', s);
}

// ---------- confident-pose
{
  let s = '';
  // legs and feet
  s += P('t-a', limb([[27.5, 43], [22.5, 57.5]], 6.4) + limb([[36.5, 43], [41.5, 57.5]], 6.4));
  s += P('t-b', cap(19.5, 58.5, 24.5, 58.5, 3.6) + cap(39.5, 58.5, 44.5, 58.5, 3.6));
  // arms akimbo
  s += P('t-a', limb([[21.5, 23.5], [11.5, 32], [24.5, 39.5]], 6.2) + limb([[42.5, 23.5], [52.5, 32], [39.5, 39.5]], 6.2));
  // torso, chest out, with V collar cut
  const col = 'M29 20.5L32 25.5L35 20.5Z';
  s += P('t-a', 'M20 22.5Q20.5 20 24 19.8H40Q43.5 20 44 22.5Q46 29 40 34Q38 37 38.5 41H25.5Q26 37 24 34Q18 29 20 22.5Z' + col, ' fill-rule="evenodd"');
  s += P('t-b', 'M40 21.5Q43.6 22 43.6 25Q43.8 29.6 39.6 33.6Q37.6 36.5 37.9 40H35.6Q35.4 36.4 37.8 33Q41.6 28.6 40 21.5Z');
  // belt and hips
  s += P('t-b', rrect(24.8, 39.5, 14.4, 4.4, 1.4));
  s += P('t-a', circ(24.5, 39.5, 3.3) + circ(39.5, 39.5, 3.3));
  // neck, head tipped up with face cut out
  s += P('t-b', rrect(29.2, 14.5, 5.6, 6.5, 1.5));
  const face = circ(29.6, 9.4, .95) + circ(34.4, 9.4, .95) + 'M29.2 12.2Q32 14.6 34.8 12.2Q32 13.4 29.2 12.2Z';
  s += P('t-a', ell(32, 10.4, 6, 6.2) + face, ' fill-rule="evenodd"');
  s += P('t-b', 'M26.6 8.2Q27 3.6 32 3.8Q37 3.6 37.4 8.2Q35 5.6 32 6Q29 5.6 26.6 8.2Z');
  // star and sparkles
  s += P('t-c', poly(star(48.5, 9.5, 5.6, 2.4)));
  s += P('t-c', spark(14, 10, 3.2) + spark(55.5, 20, 2.2));
  add('confident-pose', 'figure standing tall with hands on hips and a star by the head', s);
}

// ---------- breath-cloud
{
  let s = '';
  // breath: a curling puff made of overlapping circles, swirls stroked inside
  const pts = [[30.5, 36.5, 2.2], [34, 37.6, 3], [38.5, 38.6, 3.8], [43.5, 39, 4.6], [49, 37.6, 5.2], [53.5, 33.5, 5.4], [55, 27.5, 5.2], [53, 21.5, 5], [47.5, 18, 4.6], [42, 19.2, 4], [39.5, 24, 3.4], [42.6, 27.6, 3]];
  s += P('t-c', pts.map(([x, y, r]) => circ(x, y, r)).join(''));
  s += L('M46.6 31.4Q50 31.6 50.4 28.2Q50.4 25.4 47.6 25.8Q46 26.4 46.8 28M37 39Q39.5 36.6 41.6 38.6M53 20.2Q55.6 21.4 55.4 24', 1.6);
  // head in profile facing right: puffed cheek, pursed lips
  const head = 'M17 4.5Q26.5 4.5 27.4 15Q27.6 18.6 27.8 20.5L31.4 27.5Q32 28.8 30.2 29.2L28.6 29.6Q30.6 31.6 30.8 34.2Q32.2 35 32.2 36.7Q32.2 38.6 30.2 39Q29.2 42.6 26 43.6Q23.6 44.6 21.6 44.5L22 50.5Q25 51.5 28.5 55Q30 57 30 60H4V50.5Q9.5 48.5 10.5 43Q5 37 5 22Q5.5 5.5 17 4.5Z';
  const eye = 'M21.2 19.5Q23.6 18.4 25 20Q23.4 20.6 21.2 19.5Z';
  s += P('t-a', head + eye, ' fill-rule="evenodd"');
  // hair, ear, puffed cheek, lip line
  s += P('t-b', 'M5.4 19Q6.5 4.4 18 4.2Q25.4 4.8 27 12.6Q22 9.6 16.5 11Q13.5 14 13.6 20L11 26Q8.6 30 8.2 37.4Q5.2 31 5.4 19Z');
  s += P('t-b', ell(12.8, 27.5, 2.8, 4));
  s += P('t-b', ell(24.4, 34.6, 3.6, 3.2));
  s += P('t-b', 'M8 53Q16 52.5 22 50.5L22.5 53Q15 56 8 56Z');
  s += L('M24.8 16.6Q23 15.6 21.3 16.4', 1.3);
  s += P('t-c', spark(58, 56, 3.2) + spark(38, 7, 2.6));
  add('breath-cloud', 'face in profile blowing out a long curling puff of air', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part40.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
