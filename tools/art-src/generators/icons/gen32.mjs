// Generates part32.json (round 4): fairy, elf, toucan, cargo-ship, clock-tower, row-houses.
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
// ellipse as a path (for evenodd holes)
const ep = (cx, cy, rx, ry, rot = 0) => {
  const a = rot * Math.PI / 180, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
  return `M${f(cx - dx)} ${f(cy - dy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx + dx)} ${f(cy + dy)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx - dx)} ${f(cy - dy)}Z`;
};
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const bez = (p0, p1, p2, p3, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t;
  return [0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]); });
const box = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- fairy
{
  let s = '';
  // wings: rims with gossamer panes cut out
  const w1 = [22, 15, 13, 7.5, 35], w2 = [20, 32, 10, 5.5, -22];
  const h1 = [22.5, 15.3, 9.8, 4.6, 35], h2 = [20.6, 31.8, 7, 3, -22];
  s += P('t-a', ep(...w1) + ep(...h1) + ep(...w2) + ep(...h2), ' fill-rule="evenodd"');
  s += P('t-c', ep(...h1) + ep(...h2));
  s += L('M31 23Q22 18 15 10M30 25Q24 30 15 33', 1);
  // legs trailing back, arms
  s += P('t-a', limb([[35, 34], [31, 43], [25.5, 46]], 3.2) + limb([[38.5, 34], [37.5, 43.5], [33, 49.5]], 3.2) +
    limb([[39.5, 21.5], [44, 24.5], [48.5, 20.5]], 3) + limb([[35, 21.5], [30.5, 26.5]], 2.8));
  // dress with petal hem
  s += P('t-b', rpoly([[35, 18.5], [40.5, 18.5], [39.5, 25.5], [46, 35], [41.5, 34], [38.5, 38.5], [35, 34.5], [29.5, 37.5], [33.5, 25.5]], [1.5, 1.5, 1, 1, .8, 1, .8, 1, 1]));
  // head with eye cut out, hair
  s += P('t-a', circ(38.5, 12.5, 5.6) + ep(41, 12.8, .9, 1.3), ' fill-rule="evenodd"');
  s += P('t-b', 'M32.9 12.3A5.6 5.6 0 0 1 43.5 9.6Q39 9.5 37 13.5Q35 11.5 33 14.5Z' + circ(33, 8.5, 2.8));
  // wand and star
  s += L('M48.5 20.5L52.5 13.5', 1.6);
  s += P('t-a', rpoly(star(53.5, 10.2, 6, 2.7), .6));
  // sparkle trail
  s += P('t-c', spark(59, 22, 2.8) + spark(56.5, 40.5, 2.4) + spark(48, 52, 3.2) + circ(57.5, 31, 1.1) + circ(53, 47, 1) + spark(9, 51, 3.2));
  add('fairy', 'little fairy with gossamer wings and a star wand', s);
}

// ---------- elf
{
  let s = '';
  // hood and cloak, face opening cut out
  const outer = rpoly([[19, 4.5], [41, 9], [47, 20], [47.5, 36], [54, 46], [56.5, 59.5], [7.5, 59.5], [9.5, 46], [16.5, 38], [15.5, 20]], [1.5, 9, 5, 3, 4, 1, 1, 4, 3, 6]);
  const open = rpoly([[26, 16.5], [40, 15.5], [45, 24], [46, 34.5], [41, 44], [32.5, 46.5], [25, 41], [23, 27]], 5);
  s += P('t-a', outer + open, ' fill-rule="evenodd"');
  s += P('t-b', open);
  // cloak folds and clasp
  s += P('t-b', 'M16.5 46L21 59.5H17ZM44 47L40 59.5H44.5Z' + circ(32.5, 51, 2.6));
  // ear poking out to the back, with a dark halo
  const ear = [[27, 27], [8.5, 17.5], [26.5, 34.5]];
  s += P('t-b', rpoly([[29, 25], [6, 15.5], [28.5, 37]], 2));
  s += P('t-a', rpoly(ear, [1, .6, 1]));
  s += P('t-b', rpoly([[25, 28.5], [14, 21.5], [24.5, 32.5]], .8));
  // face, three-quarter right, eye cut out
  const face = rpoly([[28, 21], [39, 19.5], [42, 25], [45.5, 30.5], [42, 32.5], [40.5, 39], [34, 43], [28.5, 39.5], [26.5, 30]], [3, 3, 2, 1, 1, 3, 4, 4, 3]);
  s += P('t-a', face + ep(38.6, 28, 1.1, 1.7), ' fill-rule="evenodd"');
  // fringe
  s += P('t-b', 'M27 22Q33 18 41 20.5Q38 22 34 22.5Q31 26 28 27.5Z');
  s += L('M36.5 25.2L40.5 24.5', 1.1) + L('M37 37.2Q39 37.5 40.5 36.5', 1.1);
  // bow: limb, string, gripping hand
  s += L('M50.5 5.5L50.5 58.5', 1);
  s += L('M50.5 5.5C62 16 62 48 50.5 58.5', 3);
  s += P('t-a', rpoly([[53.5, 28.5], [60, 28.5], [60, 37], [53.5, 37]], 2.2) + limb([[47.5, 41], [54, 34]], 5));
  s += L('M54 31.5H59.5M54 34H59.5', 1);
  s += P('t-c', spark(6.5, 6.5, 3.4) + spark(56, 7.5, 2));
  add('elf', 'elf with pointed ears and hood holding a bow', s);
}

// ---------- toucan (side-on, facing right)
{
  let s = '';
  // branch
  s += P('t-b', cap(4.5, 50.5, 59, 47, 5));
  // tail
  s += P('t-a', cap(19, 44, 11.5, 58.5, 7.5));
  s += P('t-b', cap(17.5, 50, 12, 58, 3));
  // body + head with bib and eye cut out
  const bib = 'M33 19Q38.5 23 37 31Q35 37 29.5 40Q27 33 28 26Q29 21 33 19Z';
  const eye = circ(33, 16.5, 2.8);
  s += P('t-a', ep(24.5, 34, 10.5, 16, 22) + circ(30, 18, 8.8) + bib + eye, ' fill-rule="evenodd"');
  s += P('t-c', bib + eye);
  s += P('t-b', circ(33.4, 16.6, 1.3));
  // wing
  s += P('t-b', ep(20.5, 35, 6.5, 12.5, 22) + 'M14 44L10 52L18.5 46Z');
  // feet
  s += L('M25 45.5Q24 48.5 26.5 48.5M29.5 44.5Q29 48 31.5 48', 1.6);
  // beak
  const up = bez([36.5, 11.5], [46, 6.5], [56, 11], [60.5, 25.5]), lo = bez([60.5, 25.5], [53, 23.5], [45, 25.5], [38, 26.5]);
  const out = [...up, ...lo];
  s += P('t-a', poly(out));
  // base band and dark tip by x-range
  const cut = (lo_, hi_) => { const a = out.filter(p => p[0] >= lo_ && p[0] <= hi_); return a; };
  s += P('t-b', poly(cut(36, 40.5)) + poly([...up.filter(p => p[0] >= 54), ...lo.filter(p => p[0] >= 54)]));
  s += L('M40.5 19.5Q50 18 59 24.5', 1.1);
  s += P('t-c', spark(8, 9, 3.4) + spark(57, 59, 2.4) + spark(51.5, 33, 1.8));
  add('toucan', 'toucan perched on a branch with a huge banded beak', s);
}

// ---------- cargo-ship (side-on, facing right)
{
  let s = '';
  // funnel and mast behind
  s += P('t-b', rpoly([[9, 22], [14.5, 22], [14.5, 30], [9, 30]], 1));
  s += L('M18 12V20M15.5 14.5H20.5', 1.3);
  // bridge tower with window strip cut out
  const win = box(8.5, 26.5, 13, 3);
  s += P('t-a', rpoly([[7, 22.5], [22.5, 22.5], [22.5, 41], [7, 41]], [1.5, 1.5, 0, 0]) + rpoly([[5, 31], [23.5, 31], [23.5, 41], [5, 41]], .8) + win, ' fill-rule="evenodd"');
  s += P('t-c', win);
  s += P('t-b', box(5, 31, 18.5, 2) + box(9, 20.5, 12, 2.2));
  // containers stacked
  const A = [], B = [];
  const col = [[24.5, 4], [31.6, 4], [38.7, 3], [45.8, 3]];
  col.forEach(([x, n], i) => { for (let r = 0; r < n; r++) ((i + r) % 2 ? B : A).push(box(x, 35.4 - r * 5.4, 6.6, 4.9)); });
  A.push(box(52.9, 35.4, 4.6, 4.9)); B.push(box(52.9, 30, 3.4, 4.9));
  s += P('t-a', A.join(''));
  s += P('t-b', B.join(''));
  // hull with portholes
  const hull = rpoly([[3.5, 40.5], [61, 39], [55, 52], [7.5, 52]], [1, .8, 2, 3]);
  const ports = circ(14, 44.5, 1.1) + circ(20, 44.5, 1.1);
  s += P('t-a', hull + ports, ' fill-rule="evenodd"');
  s += P('t-c', ports);
  s += P('t-b', 'M5.5 47.5L57.4 46.5L55.7 50.5L7.2 51Z');
  // waves
  let wv = 'M4 53.5';
  for (let x = 4; x < 60; x += 8) wv += `Q${f(x + 4)} ${f(50.5)} ${f(x + 8)} 53.5`;
  wv += 'V57.5Q32 59.8 4 57.5Z';
  s += P('t-a', wv);
  s += L('M10 57.5Q14 56 18 57.5M36 57.5Q40 56 44 57.5', 1);
  s += P('t-c', spark(32, 11, 3.5) + spark(52, 20, 2.6) + spark(5.5, 8, 2.2));
  add('cargo-ship', 'container ship with stacked containers and a bridge tower', s);
}

// ---------- clock-tower
{
  let s = '';
  // town houses either side
  const wl = box(7, 47, 3.5, 4) + box(7, 54, 3.5, 4), wr = box(53.5, 47, 3.5, 4) + box(53.5, 54, 3.5, 4);
  s += P('t-b', rpoly([[4.5, 59.5], [4.5, 44], [10.5, 38], [16.5, 44], [16.5, 59.5]], [0, .8, 1, .8, 0]) + rpoly([[47.5, 59.5], [47.5, 44], [53.5, 38], [59.5, 44], [59.5, 59.5]], [0, .8, 1, .8, 0]) + wl + wr, ' fill-rule="evenodd"');
  // roof
  s += P('t-a', rpoly([[32, 4.5], [49, 20.5], [15, 20.5]], [1, 1.2, 1.2]));
  s += P('t-b', 'M32 5.8L47.4 20.5H32Z');
  // belfry with arched window
  const arch = 'M26.5 31V25.5A5.5 5.5 0 0 1 37.5 25.5V31Z';
  s += P('t-a', box(20, 20, 24, 12) + arch, ' fill-rule="evenodd"');
  s += P('t-b', 'M29 25Q29 21.8 32 21.8Q35 21.8 35 25L35.5 28.5H28.5Z' + circ(32, 29.6, 1.2));
  s += L('M24 31V24M40 31V24', 1);
  // cornice
  s += P('t-b', box(17.5, 31.5, 29, 3) + box(16.5, 56, 31, 3.5));
  // shaft with face cut out
  const face = circ(32, 45, 8.8);
  s += P('t-a', box(19.5, 34.5, 25, 21.5) + face, ' fill-rule="evenodd"');
  s += P('t-c', face);
  s += P('t-b', box(31.2, 37.6, 1.6, 2.6) + box(31.2, 50.4, 1.6, 2.6) + box(24.6, 44.2, 2.6, 1.6) + box(36.8, 44.2, 2.6, 1.6));
  s += L('M32 45V40.5M32 45L35.5 47', 1.8);
  s += P('t-b', circ(32, 45, 1.3));
  s += P('t-c', spark(9, 10, 3.6) + spark(55.5, 12, 2.6));
  add('clock-tower', 'town clock tower with a big face and a bell window', s);
}

// ---------- row-houses
{
  let s = '';
  const H = [[5, 14, 30], [23, 11.5, 27.5], [41, 14, 30]];
  // chimneys behind the roofs
  s += P('t-a', box(8, 15, 4, 9) + box(30, 6.5, 4, 7) + box(52, 15, 4, 9));
  s += P('t-b', box(7.3, 14, 5.4, 2) + box(29.3, 5.5, 5.4, 2) + box(51.3, 14, 5.4, 2));
  let walls = '', holes = '', doorsB = '', doorsC = '';
  H.forEach(([x, ap, ev], i) => {
    const m = x + 9;
    walls += poly([[x, 59.5], [x, ev + 1], [m, ap + 1], [x + 18, ev + 1], [x + 18, 59.5]]);
    const hw = circ(m, ev - 3.5, 2) + box(x + 3.5, ev + 4, 4.6, 7) + box(x + 9.9, ev + 4, 4.6, 7);
    const dl = i === 1 ? x + 10 : x + 3.2;
    const gw = i === 1 ? box(x + 3, 46, 5.5, 6.5) : box(x + 10, 46, 5.5, 6.5);
    const door = box(dl, 45.5, 5, 14);
    holes += hw + gw; walls += hw + gw + door;
    if (i === 1) doorsC += door; else if (i === 0) doorsB += door;
    else { doorsC += door; doorsB += door + box(dl + 1.2, 47, 2.6, 4.5) + box(dl + 1.2, 53, 2.6, 4.5); }
    if (i === 2) { holes += `M${f(dl)} 44.5A2.5 2.5 0 0 1 ${f(dl + 5)} 44.5Z`; walls += `M${f(dl)} 44.5A2.5 2.5 0 0 1 ${f(dl + 5)} 44.5Z`; }
  });
  s += P('t-a', walls, ' fill-rule="evenodd"');
  s += P('t-c', holes + doorsC);
  s += P('t-b', doorsB, ' fill-rule="evenodd"');
  // door knobs on the light door
  s += P('t-b', circ(37, 52.5, .7));
  // roofs as chevrons
  s += P('t-b', H.map(([x, ap, ev]) => limb([[x - .8, ev + 1.5], [x + 9, ap], [x + 18.8, ev + 1.5]], 4)).join(''));
  // party walls / downpipes
  s += L('M23 31V59M41 31V59', 1.2);
  s += P('t-c', spark(5.5, 7.5, 3.2) + spark(58.5, 7.5, 2.6));
  add('row-houses', 'terrace of three joined houses with different coloured doors', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part32.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
