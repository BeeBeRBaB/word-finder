// Generates part35.json (round 4).
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
const D = Math.PI / 180;
const poly = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('') + 'Z';
const rotp = (x, y, a) => [x * Math.cos(a * D) - y * Math.sin(a * D), x * Math.sin(a * D) + y * Math.cos(a * D)];
// ellipse outline as a path (rotated)
const ellD = (cx, cy, rx, ry, rot = 0) => { const [ax, ay] = rotp(rx, 0, rot);
  return `M${f(cx - ax)} ${f(cy - ay)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx + ax)} ${f(cy + ay)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${f(cx - ax)} ${f(cy - ay)}Z`; };
// band along an ellipse arc between t0..t1 (deg), radii offset dr0..dr1, optional clamp to circle
const arcBand = (cx, cy, rx, ry, rot, t0, t1, dr0, dr1, n = 20, clamp) => {
  const pt = (t, dr) => { let [x, y] = rotp((rx + dr) * Math.cos(t * D), (ry + dr) * Math.sin(t * D), rot); x += cx; y += cy;
    if (clamp) { const [kx, ky, kr] = clamp, d = Math.hypot(x - kx, y - ky); if (d > kr) { x = kx + (x - kx) * kr / d; y = ky + (y - ky) * kr / d; } }
    return [x, y]; };
  const a = [], b = [];
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; a.push(pt(t, dr1)); b.push(pt(t, dr0)); }
  return poly(a.concat(b.reverse()));
};
// latitude band on a sphere (front half), pole tilted toward viewer by elev, then rotated
const latBand = (cx, cy, R, elev, rot, p1, p2, n = 16) => {
  const arc = p => Array.from({ length: n + 1 }, (_, i) => { const t = 180 * i / n;
    return rotp(R * Math.cos(p * D) * Math.cos(t * D), -R * Math.sin(p * D) * Math.cos(elev * D) + R * Math.cos(p * D) * Math.sin(elev * D) * Math.sin(t * D), rot); });
  return poly(arc(p1).concat(arc(p2).reverse()).map(([x, y]) => [x + cx, y + cy]));
};
// crescent: part of circle (cx,cy,R) outside circle offset by (dx,dy) radius R2
const crescent = (cx, cy, R, dx, dy, R2) => {
  const d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d, a = (R * R - R2 * R2 + d * d) / (2 * d), h = Math.sqrt(R * R - a * a);
  const i1 = [cx + a * ux - h * uy, cy + a * uy + h * ux], i2 = [cx + a * ux + h * uy, cy + a * uy - h * ux];
  return `M${f(i1[0])} ${f(i1[1])}A${f(R)} ${f(R)} 0 1 1 ${f(i2[0])} ${f(i2[1])}A${f(R2)} ${f(R2)} 0 0 0 ${f(i1[0])} ${f(i1[1])}Z`;
};
const lens = (x1, y1, x2, y2, w) => { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, l = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / l * w, ny = (x2 - x1) / l * w;
  return `M${f(x1)} ${f(y1)}Q${f(mx + nx)} ${f(my + ny)} ${f(x2)} ${f(y2)}Q${f(mx - nx)} ${f(my - ny)} ${f(x1)} ${f(y1)}Z`; };

// ---------- ice-giant (Uranus)
{
  let s = '';
  const cx = 30, cy = 32, Rp = 19.5, rr = 14, rx = 10.5, ry = 26.5;
  // back ring
  s += P('t-b', ellD(cx, cy, rx + 1.5, ry + 1.5, rr) + ellD(cx, cy, rx - 1.5, ry - 1.5, rr), ' fill-rule="evenodd"');
  // planet with a gap where the front ring crosses
  const gap = arcBand(cx, cy, rx, ry, rr, 90, 270, -2.9, 2.9, 28, [cx, cy, Rp + .2]);
  s += P('t-a', circ(cx, cy, Rp) + gap, ' fill-rule="evenodd"');
  // faint bands parallel to the ring (pole points to the right)
  s += P('t-b', latBand(cx, cy, Rp, 22, rr + 90, 33, 37) + latBand(cx, cy, Rp, 22, rr + 90, 55, 59));
  // shade on the lower left, kept off the gap
  s += P('t-b', crescent(cx, cy, Rp, 4, -3.5, Rp));
  // front ring
  s += P('t-a', arcBand(cx, cy, rx, ry, rr, 90, 270, -1.5, 1.5, 28));
  // moon
  s += C('t-b', 54, 51, 4.6) + C('t-a', 54.9, 50.2, 3.6);
  s += P('t-c', spark(10, 10, 4) + spark(55, 14, 3) + spark(8, 54, 2.5));
  add('ice-giant', 'Uranus tipped on its side with near-vertical rings and a moon', s);
}

// ---------- storm-planet (Neptune)
{
  let s = '';
  const cx = 35, cy = 32, Rp = 22;
  const storm = ellD(30.5, 40, 8.5, 5.2, -6);
  const wisps = [lens(41.5, 43.5, 50, 41.5, 1.6), lens(21, 47.5, 31, 48.2, 1.3), lens(40, 25.5, 49, 24, 1.4)];
  s += P('t-a', circ(cx, cy, Rp) + storm + wisps.join(''), ' fill-rule="evenodd"');
  // bands
  s += P('t-b', latBand(cx, cy, Rp, 16, 0, 44, 52) + latBand(cx, cy, Rp, 16, 0, 14, 24) + latBand(cx, cy, Rp, 16, 0, -40, -47));
  // white clouds and the storm's pale rim
  s += P('t-c', storm + wisps.join(''));
  s += P('t-b', ellD(29.6, 39.4, 6.8, 3.8, -6));
  // shade
  s += P('t-b', crescent(cx, cy, Rp, -4.5, -4.5, Rp));
  // wind streaks
  s += L('M5 20H13M4.8 31H9.6M6 42H12.4M10.5 51.5H17', 2.2);
  s += P('t-c', spark(8, 8, 3.5) + spark(57, 8, 3) + spark(57.5, 56, 2.5));
  add('storm-planet', 'Neptune with a great dark storm, white clouds and wind streaks', s);
}
// ---------- space-station
{
  let s = '';
  // Earth below
  s += P('t-b', 'M4.5 59.5Q32 45.5 59.5 59.5Z');
  s += L('M6 54.5Q32 40.5 58 54.5', 1.4);
  // truss
  s += R('t-b', 5, 26.3, 54, 1.6, .5);
  // wings of cells, two rows around the truss
  let cells = '';
  for (const x0 of [4.5, 40]) for (let i = 0; i < 4; i++) for (const [y0, h] of [[19.5, 6], [28.5, 6]]) {
    const w = (19.5 - 3) / 4; cells += `M${f(x0 + i * (w + 1))} ${f(y0)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  }
  s += P('t-a', cells);
  s += P('t-b', 'M4.5 24.3h19.5v1.2h-19.5ZM40 24.3h19.5v1.2h-19.5ZM4.5 33.3h19.5v1.2h-19.5ZM40 33.3h19.5v1.2h-19.5Z');
  // docking ring on top
  s += R('t-b', 29.5, 11, 5, 5);
  s += P('t-a', ellD(32, 10, 7.5, 3.2) + ellD(32, 10, 4.3, 1.4), ' fill-rule="evenodd"');
  s += P('t-b', 'M24.5 10A7.5 3.2 0 0 0 39.5 10A7.5 3.2 0 0 1 24.5 10Z'.replace('A7.5 3.2 0 0 1', 'A7.5 1.8 0 0 1'));
  // central module with portholes
  const ph = circ(32, 20.5, 1.9) + circ(32, 36.5, 1.9);
  s += P('t-a', rpoly([[27, 15], [37, 15], [37, 43], [27, 43]], 3) + ph, ' fill-rule="evenodd"');
  s += P('t-b', 'M34.5 15.3Q37 15.5 37 18V40Q37 42.5 34.5 42.7Z');
  s += P('t-c', ph);
  s += R('t-b', 25.5, 25.3, 13, 3.6, 1);
  s += P('t-b', 'M29 43H35L34 46.5H30Z');
  s += P('t-c', spark(8, 9, 3.5) + spark(56, 9.5, 3) + spark(50, 44, 2.2));
  add('space-station', 'orbital space station with solar wings above the curve of Earth', s);
}
// ---------- sailboat
{
  let s = '', g = '';
  // waves (not tilted)
  const wave = 'M4.5 50.5Q9.5 47 14.5 50.5T24.5 50.5T34.5 50.5T44.5 50.5T54.5 50.5Q57 52.2 59.5 51.3V55.5Q57 57.5 54.5 55.5T44.5 55.5T34.5 55.5T24.5 55.5T14.5 55.5T4.5 55.5Z';
  // tilted boat
  g += P('t-a', 'M29 6.5V37H10Q16.5 21 29 6.5Z');
  g += P('t-b', 'M29 6.5V37H25.5V12Z');
  g += L('M15 29.5L28.5 27M20 20L28.5 18.5', 1.2);
  g += P('t-a', 'M32.5 9.5L52 37H34.5Q36 23 32.5 9.5Z');
  g += P('t-b', 'M34.5 37H52L50.6 35H34.7Z');
  g += R('t-b', 30, 5, 1.8, 36.5, .6);
  g += P('t-b', 'M30 4.8L24.5 6.4L30 8Z');
  g += P('t-b', cap(29, 38.6, 10.5, 38.6, 1.8));
  g += P('t-a', 'M8.5 41H57.5Q56 45 51.5 48.5Q50 49.5 48 49.5H15Q12.5 49.5 11.5 47.5Z');
  g += P('t-b', 'M10.4 45.3H54.7Q53.3 47.2 51.5 48.5Q50 49.5 48 49.5H15Q12.5 49.5 11.5 47.5Z');
  s += `<g transform="rotate(-6 32 46)">${g}</g>`;
  s += P('t-b', wave);
  s += L('M10 59Q14 57 18 59M40 59Q44 57 48 59', 1.4);
  s += P('t-c', spark(51, 10, 4) + spark(58, 22, 2.5) + spark(8, 14, 2.5));
  add('sailboat', 'small sailing dinghy heeling on waves with mainsail and jib', s);
}
// ---------- swimmer
{
  let s = '';
  const hx = 46.5, hy = 37.2, hr = 7.4;
  const pt = a => [hx + hr * Math.cos(a * D), hy + hr * Math.sin(a * D)];
  const p1 = pt(174), p2 = pt(-36);
  const lensH = ellD(50.9, 38.2, 2.6, 2.1, 12);
  // kicking leg and foot, torso, recovering arm and hand
  s += P('t-a', limb([[18, 41], [9, 37.5]], 6) + ellD(7.5, 35.6, 2.1, 3.4, 40) + cap(16, 41.5, 39, 40, 11) + limb([[37, 37], [42.5, 21.5], [54.5, 30]], 6.6));
  s += P('t-a', ellD(56.3, 31.8, 3.8, 2.8, 48));
  // forearm underside shade
  s += P('t-b', cap(44.6, 25.6, 53, 31.6, 1.7));
  // head with goggle lens cut out
  s += P('t-a', circ(hx, hy, hr) + lensH, ' fill-rule="evenodd"');
  s += P('t-c', lensH);
  // swim cap
  s += P('t-b', `M${f(p1[0])} ${f(p1[1])}A${hr} ${hr} 0 0 1 ${f(p2[0])} ${f(p2[1])}Z`);
  s += L('M48.4 38.3L39.4 38.6', 1.3);
  // splashes
  s += P('t-a', lens(5, 31, 6, 27.5, .9) + lens(10.5, 31.5, 12, 28, .9) + lens(14.5, 36, 16.5, 33.5, .8) + lens(59, 39, 58.8, 36, .7));
  // water
  s += P('t-b', 'M4.5 42Q9 39.5 13.5 42T22.5 42T31.5 42T40.5 42T49.5 42T58.5 42L59.5 42V55.5Q59.5 58.5 56.5 58.5H7.5Q4.5 58.5 4.5 55.5Z');
  // lane rope of floats
  let fl = 'M7 51.4H57V52.6H7Z';
  for (let i = 0; i < 9; i++) fl += ellD(9.5 + i * 5.6, 52, 2.4, 2.1);
  s += P('t-a', fl);
  s += P('t-c', spark(10, 12, 3.5) + spark(55, 11, 3) + spark(26, 24, 2.2));
  add('swimmer', 'swimmer doing front crawl with cap and goggles over a lane rope', s);
}
// ---------- control-tower
{
  let s = '';
  // runway and takeoff path
  s += P('t-b', 'M42 56.5H59.5V59.5H42Z');
  s += L('M43 54.5Q48 52 51.5 46', 1.2);
  // base building with windows
  const bw = [0, 1, 2, 3].map(i => `M${f(14.5 + i * 6.3)} 55h3v2.5h-3Z`).join('');
  s += P('t-a', rpoly([[11, 52], [41, 52], [41, 59.5], [11, 59.5]], [1.5, 1.5, 0, 0]) + bw, ' fill-rule="evenodd"');
  s += P('t-b', 'M11 52H41V53.6H11Z');
  // shaft with slot windows
  const sl = [33.5, 39.5, 45.5].map(y => `M24 ${y}h2v3.5h-2Z`).join('');
  s += P('t-a', 'M21.5 29H30.5L32 52H20Z' + sl, ' fill-rule="evenodd"');
  s += P('t-b', 'M27.5 29H30.5L32 52H28Z');
  // gallery under the cab
  s += R('t-b', 18, 26.5, 16, 3, .8);
  // glass cab, wider at the top, panes cut out
  const top = [14.5, 37.5], bot = [19, 33], y0 = 16.6, y1 = 25;
  const lx = (x, y) => x; let panes = '';
  for (let i = 0; i < 4; i++) {
    const a = i / 4, b = (i + 1) / 4, g = .045;
    const tx = t => top[0] + (top[1] - top[0]) * t, bx = t => bot[0] + (bot[1] - bot[0]) * t;
    const yt = t => ({ x: tx(t) + (bx(t) - tx(t)) * (y0 - 15) / 12, y: y0 }), yb = t => ({ x: tx(t) + (bx(t) - tx(t)) * (y1 - 15) / 12, y: y1 });
    const A = yt(a + g), B = yt(b - g), Cc = yb(b - g), Dd = yb(a + g);
    panes += `M${f(A.x)} ${f(A.y)}L${f(B.x)} ${f(B.y)}L${f(Cc.x)} ${f(Cc.y)}L${f(Dd.x)} ${f(Dd.y)}Z`;
  }
  s += P('t-a', 'M14.5 15H37.5L33 27H19Z' + panes, ' fill-rule="evenodd"');
  s += P('t-c', panes);
  // roof and antenna
  s += P('t-b', rpoly([[12.5, 11.5], [39.5, 11.5], [38, 15.2], [14, 15.2]], 1));
  s += R('t-a', 21.5, 8.6, 9, 3.2, 1);
  s += R('t-b', 25.3, 4, 1.4, 5);
  s += L('M23 6H29', 1.2);
  s += C('t-a', 26, 4.2, 1.6);
  // plane taking off
  let pl = '';
  pl += P('t-b', 'M-1.5 1L3.5 1L-.5 8.5H-4Z');
  const win = [-5, -2, 1, 4].map(x => circ(x, -.6, .75)).join('');
  pl += P('t-a', cap(-10, 0, 9, 0, 5.4) + 'M-10 -1L-12.5 -9H-8.6L-4.5 -1Z' + win + 'M7.6 -1.6L9.8 -1.6Q10.6 -.4 9.6 .1L7.4 .1Z', ' fill-rule="evenodd"');
  pl += P('t-b', 'M-12.2 -1.5H-7.5L-6.6 1H-11.2Z');
  pl += P('t-a', 'M-8 -2.3L-3 -2.3L-4.2 -4.5H-6.6Z');
  s += `<g transform="translate(49 36) rotate(-30)">${pl}</g>`;
  s += P('t-c', spark(7, 8, 3.5) + spark(56, 10, 3) + spark(6.5, 42, 2.5));
  add('control-tower', 'airport control tower with angled glass cab and a plane taking off', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part35.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
