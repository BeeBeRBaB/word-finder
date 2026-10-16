// Generates part24.json (round 4: convertible, hiker, pipes, garage, car-engine, shopping-cart).
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
// convex hull of sampled circles -> closed path
const hull = (cs, n = 18) => {
  const pts = []; for (const [x, y, r] of cs) for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI; pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const h = lo.slice(0, -1).concat(up.slice(0, -1));
  return h.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('') + 'Z';
};
const wheel = (x, y, r) => P('t-b', circ(x, y, r) + circ(x, y, r * .45), ' fill-rule="evenodd"') + C('t-c', x, y, r * .45) + C('t-b', x, y, r * .17);

// ---------- convertible
{ let s = '';
  // folded soft top bundled behind the seats
  s += P('t-b', rpoly([[7.5, 35], [9, 29.5], [21, 28.5], [24, 35]], 3));
  s += L('M12 31.5Q15.5 30.5 20 31', 1.2);
  // seat backs and headrests
  s += P('t-b', rpoly([[25, 35], [26.5, 25.5], [31, 25.5], [31.5, 35]], 1.6) + rpoly([[31, 35], [32.5, 27], [35.5, 27], [36, 35]], 1.4));
  // windshield: glass with frame
  s += P('t-c', 'M45 35L37.6 22.6L41.2 22.4L48.8 35Z');
  s += P('t-b', cap(37, 22, 44.6, 35, 2.2) + cap(36.6, 22.3, 40.3, 22.1, 2));
  // steering wheel
  s += P('t-b', cap(40.5, 34, 38.8, 28.5, 2.4));
  // body with headlight + side stripe cut out, wheel arches
  const hl = rpoly([[55.5, 38], [60.2, 38.6], [60.2, 41], [55.5, 40.6]], .8);
  const st = 'M9 40H54L52 41.6H9Z';
  const body = 'M4.5 44V40Q4.5 35.5 9 35L24 34.4L52 34.6Q60.5 35.5 61 40.5V44.5Q61 48 58 48H57.5A9.5 9.5 0 0 0 38.5 48H26.5A9.5 9.5 0 0 0 7.5 48Q4.5 48 4.5 44Z';
  s += P('t-a', body + hl + st, ' fill-rule="evenodd"');
  s += P('t-c', hl + st);
  s += P('t-b', 'M4.6 45H7.8A9.5 9.5 0 0 0 7.5 48Q4.6 48 4.6 45ZM26.3 45H38.7A9.5 9.5 0 0 0 38.5 48H26.5ZM57.2 45H61Q61 48 58 48H57.5Z');
  s += R('t-b', 4.5, 37, 2.2, 3.6, .8);
  s += L('M34 36.5V44.5M29.5 38H32', 1.4);
  s += wheel(17, 48, 8.2) + wheel(48, 48, 8.2);
  s += P('t-c', spark(8, 14, 4) + spark(56, 11, 3) + spark(20, 8, 2));
  add('convertible', 'open-top convertible car side-on, roof folded down', s); }

// ---------- hiker
{ let s = '';
  const gy = x => 59 - .27 * (x - 4);
  // hillside
  s += P('t-b', `M4 ${f(gy(4))}L60 ${f(gy(60))}V60H4Z`);
  // backpack behind the torso, with a bedroll on top
  s += P('t-b', rpoly([[22, 16.5], [31, 18], [27, 37], [18, 34.5]], 3));
  s += P('t-a', cap(20.5, 14.5, 30.5, 16.3, 5));
  s += P('t-b', cap(20.5, 14.5, 30.5, 16.3, 1.3));
  // back leg (shade)
  s += P('t-b', limb([[28.5, 35], [23, 44.5], [16.5, 52]], 7) + cap(16, 52.5, 21, gy(21) - 1.6, 5));
  // pole
  s += L(`M45.5 21L53 ${f(gy(53) + .5)}`, 2.2);
  // body: torso + front arm + front leg
  s += P('t-a', cap(35.5, 21, 29, 35, 10) + limb([[35, 23], [40, 30], [47.5, 27.5]], 6) + limb([[29.5, 35], [38, 39], [38.5, 46.5]], 7.5) + cap(38, 47.2, 43.5, gy(43.5) - 1.6, 5.4));
  // shoulder strap
  s += P('t-b', cap(32.5, 19.5, 31.5, 31, 2.4));
  // head with highlight + sun hat
  const hx = 39.5, hy = 13;
  const hl = `M${f(hx - 4.4)} ${f(hy + 1.5)}A4.8 4.8 0 0 1 ${f(hx - 3.6)} ${f(hy - 2)}L${f(hx - 2.6)} ${f(hy - 1.2)}A3.6 3.6 0 0 0 ${f(hx - 3.2)} ${f(hy + 1.5)}Z`;
  s += P('t-a', circ(hx, hy, 5.5) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', cap(32.5, 10, 47, 11.5, 2.4) + `M34.5 10.4Q35 4.4 40 4.4Q45 4.4 45 11Z`);
  // grip on the pole
  s += C('t-a', 47.5, 27.5, 3);
  s += P('t-c', spark(55, 7, 4) + spark(9, 26, 2.8) + spark(58, 25, 2.2));
  add('hiker', 'pictogram hiker with backpack and pole striding uphill', s); }

// ---------- pipes
{ let s = '';
  // wrench on the floor
  s += `<g transform="rotate(-16 20 54)">${P('t-b', cap(7, 54, 26, 54, 4.6) + circ(30, 54, 5.8) + 'M30 51.8H37V56.2H30Z')}</g>`;
  // pipe run: down, elbow, across, elbow, down; highlight stripes cut out
  const hlA = 'M9.4 9H10.8V25H9.4Z', hlB = 'M22 31.2H41V32.6H22Z';
  s += P('t-a', 'M7.5 4.5H16.5V26A3.5 3.5 0 0 0 20 29.5H44A12.5 12.5 0 0 1 56.5 42V47H47.5V42A3.5 3.5 0 0 0 44 38.5H20A12.5 12.5 0 0 1 7.5 26Z' + hlA + hlB, ' fill-rule="evenodd"');
  s += P('t-c', hlA + hlB);
  // undersides
  s += P('t-b', 'M14 8H16.5V26A3.5 3.5 0 0 0 20 29.5V32A6 6 0 0 1 14 26ZM20 36H44A6 6 0 0 1 50 42V47H47.5V42A3.5 3.5 0 0 0 44 38.5H20Z');
  // wall flange and couplings
  s += R('t-b', 5, 4.5, 14, 3.5, 1) + R('t-b', 6, 19, 12, 3.6, 1) + R('t-b', 24, 28, 3.6, 12, 1) + R('t-b', 40, 28, 3.6, 12, 1) + R('t-b', 45.5, 45.5, 13, 4.5, 1.2);
  // valve: stem and wheel
  s += R('t-b', 30.6, 22, 3, 8);
  let sp = ''; for (let k = 0; k < 4; k++) { const a = (k * 90 + 45) * Math.PI / 180; sp += cap(32 + 1.5 * Math.cos(a), 17 + 1.5 * Math.sin(a), 32 + 6.5 * Math.cos(a), 17 + 6.5 * Math.sin(a), 2.4); }
  s += P('t-a', circ(32, 17, 8) + circ(32, 17, 5.8), ' fill-rule="evenodd"');
  s += P('t-a', sp + circ(32, 17, 2.6));
  s += C('t-b', 32, 17, 1.1);
  // drip
  const dh = 'M50.5 56.2A2 2 0 0 1 51.4 54.4L52 55.2A1.2 1.2 0 0 0 51.6 56.4Z';
  s += P('t-a', 'M52 50.8C50.6 53.2 48.9 54.8 48.9 56.6A3.1 3.1 0 0 0 55.1 56.6C55.1 54.8 53.4 53.2 52 50.8Z' + dh, ' fill-rule="evenodd"');
  s += P('t-c', dh);
  s += P('t-c', spark(53, 10, 4) + spark(44, 21, 2.4));
  add('pipes', 'plumbing pipe run with elbows, valve wheel and drip', s); }

// ---------- garage
{ let s = '';
  // car front seen through the half-open door (drawn first, door overlaps its top)
  const ws = rpoly([[23.5, 41], [40.5, 41], [42, 47], [22, 47]], 1.2);
  const lamps = rpoly([[19.5, 49.5], [25.5, 49.5], [25.5, 52], [19.5, 52]], 1) + rpoly([[38.5, 49.5], [44.5, 49.5], [44.5, 52], [38.5, 52]], 1);
  const grille = 'M28 50H36V52.2H28Z';
  s += R('t-b', 19.5, 53, 5, 5.5, 1.2) + R('t-b', 39.5, 53, 5, 5.5, 1.2);
  s += P('t-a', rpoly([[22, 38], [42, 38], [44.5, 47], [47, 48], [47, 55], [17, 55], [17, 48], [19.5, 47]], 2) + ws + lamps + grille, ' fill-rule="evenodd"');
  s += P('t-c', ws + lamps + grille);
  s += R('t-b', 16.5, 53.5, 31, 2.4, 1);
  // wall with door opening and round vent cut out
  const vent = circ(32, 19.5, 3.6);
  s += P('t-a', 'M8 58V25L32 9L56 25V58ZM15 30V58H49V30Z' + vent, ' fill-rule="evenodd"');
  s += P('t-c', vent);
  s += L('M32 16V23M28.5 19.5H35.5', 1.2);
  // frame around the opening, wall shade
  s += P('t-b', 'M13.5 28.5H50.5V58H49V30H15V58H13.5Z');
  s += P('t-b', 'M52.5 24L56 26.3V58H52.5Z');
  // roll-up door, half open: slats
  let sl = ''; for (let y = 30; y < 43; y += 3.4) sl += `M15 ${f(y)}H49V${f(y + 2.4)}H15Z`;
  s += P('t-a', sl);
  s += R('t-b', 15, 43.2, 34, 2.2, .6);
  // roof
  s += P('t-b', cap(4.5, 28.5, 32, 8, 5) + cap(32, 8, 59.5, 28.5, 5));
  // ground
  s += R('t-b', 4, 57.5, 56, 2.5, 1.2);
  s += P('t-c', spark(9, 9, 3.8) + spark(55, 8, 3));
  add('garage', 'garage with roll-up door half open and a car front showing', s); }

// ---------- car-engine (V8 from the front)
{ let s = '';
  const mx = pts => pts.map(([x, y]) => [64 - x, y]);
  // exhaust manifolds hugging the block sides: ports, collector, down pipe
  s += P('t-b', 'M8.5 31.5H13V47.5L9.5 53L6 51L8.5 46.5ZM12 35.5H16V39.5H12ZM12 41.5H16V45.5H12Z'
    + 'M55.5 31.5H51V47.5L54.5 53L58 51L55.5 46.5ZM52 35.5H48V39.5H52ZM52 41.5H48V45.5H52Z');
  // block
  s += P('t-a', rpoly([[14, 24], [26, 19], [38, 19], [50, 24], [47, 53], [17, 53]], 2.5));
  // valve covers slanted out either side, with gasket rail and ribs
  for (const [cx, d] of [[14.6, -36], [49.4, 36]]) {
    const rot = ` transform="rotate(${d} ${cx} 23.6)"`;
    s += R('t-b', cx - 8, 26.4, 16, 3.2, 1.2, rot) + R('t-a', cx - 9, 19.2, 18, 8, 2.8, rot);
    s += `<g${rot}>${L(`M${f(cx - 6)} 22H${f(cx + 6)}M${f(cx - 6)} 25.2H${f(cx + 6)}`, 1.2)}</g>`;
  }
  // carb base and round air filter on top
  s += R('t-b', 26, 14, 12, 6, 1);
  const hf = 'M21.5 8.2H42.5V9.6H21.5Z';
  s += P('t-a', rpoly([[16.5, 6], [47.5, 6], [47.5, 15.5], [16.5, 15.5]], 4.5) + hf, ' fill-rule="evenodd"');
  s += P('t-c', hf);
  s += P('t-b', 'M16.6 12H47.4V12Q47.4 15.5 43 15.5H21Q16.6 15.5 16.6 12Z' + cap(28.5, 5, 35.5, 5, 2.6));
  // belt round fan, accessory and crank pulleys
  const ps = [[32, 34, 4], [19.5, 44, 3.4], [44.5, 44, 3.4], [32, 48.5, 4.6]];
  s += P('t-b', hull(ps.map(([x, y, r]) => [x, y, r + 1.8]), 10) + hull(ps, 10), ' fill-rule="evenodd"');
  s += P('t-b', ps.slice(1).map(([x, y, r]) => circ(x, y, r * .62) + circ(x, y, r * .26)).join(''), ' fill-rule="evenodd"');
  // sump
  s += P('t-b', rpoly([[19, 53.5], [45, 53.5], [42, 59.5], [22, 59.5]], 1.6));
  // big fan in front
  s += C('t-b', 32, 34, 11);
  for (let k = 0; k < 5; k++) { const a = k * 72 - 90, r = a * Math.PI / 180; s += E('t-a', 32 + 5.4 * Math.cos(r), 34 + 5.4 * Math.sin(r), 4.8, 2.6, a + 20); }
  s += C('t-a', 32, 34, 3) + C('t-b', 32, 34, 1.2);
  s += P('t-c', spark(7, 8, 3.8) + spark(57.5, 9, 2.8));
  add('car-engine', 'V8 car engine from the front: air filter, valve covers, fan and belt', s); }

// ---------- shopping-cart
{ let s = '';
  // groceries: baguette, bottle, greens
  s += P('t-a', cap(21, 24, 29, 6, 6.5));
  s += P('t-b', cap(23.2, 13, 26.6, 13.6, 1.4) + cap(24.6, 9.4, 28, 10, 1.4) + cap(21.8, 16.6, 25.2, 17.2, 1.4));
  s += P('t-b', rpoly([[33, 24], [33, 15], [35, 11.5], [35, 6], [38.5, 6], [38.5, 11.5], [40.5, 15], [40.5, 24]], 1.4));
  s += R('t-a', 34.5, 4.6, 4.5, 2.6, .8);
  s += P('t-a', 'M42 24Q40 15 45 10Q46 16 46.5 24ZM45 24Q47 13 54.5 11Q52 18 50 24ZM48.5 24Q53 18 58 18.5Q55 22 53 24Z');
  s += L('M44.6 22Q44 17 45 13.5M48 22.5Q49.5 17 52.5 13.5', 1);
  // basket with grid holes, rim on top
  const top = 22.5, bot = 43, xl = y => 12.5 + (y - top) * .18, xr = y => 58 - (y - top) * .3;
  let g = '';
  for (const [y0, y1] of [[26.5, 30], [32.5, 36], [38.5, 41]]) {
    const a = xl(y1) + 2.6, b = xr(y1) - 2.6, n = 6, w = (b - a - (n - 1) * 1.8) / n;
    for (let i = 0; i < n; i++) { const x = a + i * (w + 1.8); g += `M${f(x)} ${f(y0)}H${f(x + w)}V${f(y1)}H${f(x)}Z`; }
  }
  s += P('t-a', rpoly([[xl(top), top], [xr(top), top], [xr(bot), bot], [xl(bot), bot]], 2) + g, ' fill-rule="evenodd"');
  s += P('t-b', cap(11.5, 23.2, 59, 23.2, 3.4));
  // handle
  s += P('t-b', limb([[13, 23], [9, 14.5]], 3) + cap(5.5, 14.2, 12, 13.6, 4.4));
  // chassis and wheels
  s += P('t-b', limb([[17, 42], [19, 51]], 3) + limb([[50, 42], [47, 51]], 3) + cap(13, 50.5, 53, 50.5, 3));
  s += P('t-b', circ(20, 55.5, 4.2) + circ(20, 55.5, 1.5) + circ(46, 55.5, 4.2) + circ(46, 55.5, 1.5), ' fill-rule="evenodd"');
  s += P('t-c', spark(9, 6.5, 3.4) + spark(57, 6, 2.6));
  add('shopping-cart', 'shopping trolley full of groceries side-on', s); }

fs.writeFileSync(process.argv[2] || new URL('../../icons/part24.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
