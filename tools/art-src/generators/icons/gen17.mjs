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

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });
// ---------- school-blazer
{
  let s = '';
  const mx = pts => pts.map(([x, y]) => [64 - x, y]);
  // sleeves
  const sl = [[13, 10], [6.5, 15], [4, 55], [12.5, 56], [13.5, 22]];
  s += P('t-a', rpoly(sl, 2.5) + rpoly(mx(sl), 2.5));
  s += P('t-b', 'M4.3 50L12.2 50.5L12.4 54.5Q12.5 56 11 56L4 55Z' + 'M59.7 50L51.8 50.5L51.6 54.5Q51.5 56 53 56L60 55Z');
  // body with V opening and crest hole
  const body = [[22.5, 5.5], [12, 9.5], [10.5, 16], [11.5, 59], [52.5, 59], [53.5, 16], [52, 9.5], [41.5, 5.5], [32, 37]];
  const shield = 'M40.5 28H50.5V33.5Q50.5 38 45.5 40.5Q40.5 38 40.5 33.5Z';
  s += P('t-a', rpoly(body, [1, 4, 3, 2, 2, 3, 4, 1, .6]) + shield, ' fill-rule="evenodd"');
  // seam shadow between sleeve and body
  s += P('t-b', 'M9.6 18L11.2 18L12.2 58.5L10.2 56Z' + 'M54.4 18L52.8 18L51.8 58.5L53.8 56Z');
  // tie geometry
  const xl = y => 30.6 - 2.2 * (y - 13.6) / 17.4, xr = y => 33.4 + 2.2 * (y - 13.6) / 17.4;
  const knot = 'M29.6 8.6H34.4L33.4 13H30.6Z';
  const blade = 'M30.6 13.6H33.4L35.6 31L32 35L28.4 31Z';
  // shirt (cut around tie)
  s += P('t-c', 'M22.5 5.5Q32 11 41.5 5.5L32 37Z' + knot + blade, ' fill-rule="evenodd"');
  s += P('t-a', knot + blade);
  let st = '';
  for (const c of [17, 22.5, 28]) {
    const k = -.55, h = 2.2;
    const yl = c + k * (xl(c) - 32), yr = c + k * (xr(c) - 32);
    st += `M${f(xl(yl))} ${f(yl)}L${f(xr(yr))} ${f(yr)}L${f(xr(yr + h))} ${f(yr + h)}L${f(xl(yl + h))} ${f(yl + h)}Z`;
  }
  s += P('t-b', st);
  // shirt collar wings
  s += L('M23.5 6.5L27.5 15.5L30.2 10.5M40.5 6.5L36.5 15.5L33.8 10.5', 1.2);
  // lapels
  const lap = [[22.5, 5.5], [32.6, 37.2], [18.5, 18], [16.5, 13], [20.5, 12.5], [19, 7.5]];
  s += P('t-b', rpoly(lap, .8) + rpoly(mx(lap), .8));
  // front edge, buttons
  s += L('M32 37V59', 1.4);
  s += P('t-b', circ(32, 44, 2.3) + circ(32, 52, 2.3));
  // pocket flaps
  s += R('t-b', 15, 46, 11, 3.5, 1) + R('t-b', 38, 46, 11, 3.5, 1);
  // crest
  s += P('t-c', shield);
  s += P('t-b', 'M42.5 31.5L45.5 35L48.5 31.5V34L45.5 37.5L42.5 34Z');
  s += R('t-b', 39.5, 25, 12, 2, .6);
  s += P('t-c', spark(5.5, 6.5, 3.5) + spark(58.5, 6.5, 3));
  add('school-blazer', 'school blazer with crest and striped tie', s);
}

// ---------- germ
{
  let s = '';
  const cx = 36.5, cy = 31, Rb = 18.5, n = 9;
  let blob = '';
  for (let k = 0; k < n; k++) {
    const a = (-80 + k * 360 / n) * Math.PI / 180, rk = k % 2 ? 3.3 : 3.9, d = 2 * Math.asin(rk / 2 / Rb);
    const p1 = [cx + Rb * Math.cos(a - d), cy + Rb * Math.sin(a - d)], p2 = [cx + Rb * Math.cos(a + d), cy + Rb * Math.sin(a + d)];
    blob += (k ? `A${Rb} ${Rb} 0 0 1 ` : 'M') + `${f(p1[0])} ${f(p1[1])}A${rk} ${rk} 0 1 1 ${f(p2[0])} ${f(p2[1])}`;
  }
  blob += `A${Rb} ${Rb} 0 0 1 ` + blob.slice(1, blob.indexOf('A')) + 'Z';
  // flagella
  s += L('M20 26Q15 21 11 25T3 23M19 34Q14 31 10 35.5T2.5 36.5M21.5 41Q17.5 41 15 46T6.5 51', 2.6);
  const eyes = circ(30.5, 27.5, 5.6) + circ(42.5, 27.5, 5.6);
  const hl = 'M22.5 22Q24 17.5 29 15.8Q25.5 18.8 25 22.5Q23.6 23.5 22.5 22Z';
  s += P('t-a', blob + eyes + hl, ' fill-rule="evenodd"');
  // shading crescent lower right
  s += P('t-b', 'M52.5 29.6A16 16 0 0 1 27.3 44.1A21 21 0 0 0 52.5 29.6Z');
  s += P('t-b', circ(47, 20, 1.6) + circ(22, 36, 1.4) + circ(45.5, 39, 1.8));
  s += P('t-c', eyes + hl);
  s += P('t-b', circ(32, 28.5, 3.1) + circ(31, 27.2, 1.1) + circ(44, 28.5, 3.1) + circ(43, 27.2, 1.1), ' fill-rule="evenodd"');
  s += L('M31.5 36.5Q36.5 41 41.5 36.5', 2);
  // tiny dots
  s += P('t-a', circ(55, 56, 2.8) + circ(60.2, 49.5, 1.8));
  s += P('t-c', spark(8, 8, 4) + spark(57, 7, 3));
  add('germ', 'friendly round germ with wiggly tails', s);
}

// ---------- ammonite
{
  let s = '';
  // semicircle spiral as drawn: coil 0 = shell circle; odd coils lower halves, even coils upper halves
  const q = .7, cy = 31.5, r = [], c = [31.5];
  for (let k = 0; k < 6; k++) r.push(18 * Math.pow(q, k));
  for (let k = 1; k < 6; k++) c.push(c[k - 1] + (k % 2 ? 1 : -1) * (r[k - 1] - r[k]));
  const pt = (j, a) => [c[j] + r[j] * Math.cos(a), cy + r[j] * Math.sin(a)];
  const shell = circ(c[0], cy, r[0]);
  // stone chunk
  const stone = rpoly([[6, 19], [21, 8.5], [43, 6.5], [58.5, 15], [61.5, 38], [53, 56], [28, 59], [7.5, 51], [2.5, 33]], 4);
  s += P('t-a', stone + shell, ' fill-rule="evenodd"');
  s += P('t-b', 'M2.8 36L7.5 51L28 59L53 56L61.3 40L58 41L50.5 52.5L28.5 55L10 48Z');
  // inset rim
  s += P('t-b', circ(c[0] - .8, cy - 1.5, 19.2) + shell, ' fill-rule="evenodd"');
  s += P('t-c', shell);
  // spiral suture, coils 1..5
  const coil = j => `A${f(r[j])} ${f(r[j])} 0 0 1 ${f(c[j] + (j % 2 ? -r[j] : r[j]))} ${cy}`;
  s += L(`M${f(c[0] + r[0])} ${cy}` + coil(1) + coil(2) + coil(3), 2.4) + L(`M${f(c[3] - r[3])} ${cy}` + coil(4) + coil(5), 1.7) + L(shell, 1.3);
  // ribs: each spans one band, from an outer coil line to the next coil in on the same side
  const rib = bands => bands.map(([o, i, up, n, st]) => Array.from({ length: n }, (_, m) => {
    const a = (up ? Math.PI : 0) + (st + (1 - st) * (m + .5) / n) * Math.PI, p = pt(o, a), e = pt(i, a);
    const dx = e[0] - p[0], dy = e[1] - p[1], mx = (p[0] + e[0]) / 2 + dy * .18, my = (p[1] + e[1]) / 2 - dx * .18;
    return `M${f(p[0])} ${f(p[1])}Q${f(mx)} ${f(my)} ${f(e[0])} ${f(e[1])}`;
  }).join('')).join('');
  s += L(rib([[0, 1, 0, 6, .22], [0, 2, 1, 8, 0], [1, 3, 0, 6, 0]]), 1.3);
  s += L(rib([[2, 4, 1, 5, 0], [3, 5, 0, 4, 0]]), 1.1);
  // cracks: jagged wedges, [x, y, width] per point
  const crack = pts => {
    const a = [], b = [];
    pts.forEach((p, i) => {
      const u = pts[Math.max(i - 1, 0)], v = pts[Math.min(i + 1, pts.length - 1)], dx = v[0] - u[0], dy = v[1] - u[1];
      const h = p[2] / 2 / Math.hypot(dx, dy);
      a.push(`${f(p[0] - dy * h)} ${f(p[1] + dx * h)}`); b.unshift(`${f(p[0] + dy * h)} ${f(p[1] - dx * h)}`);
    });
    return 'M' + a.join('L') + 'L' + b.join('L') + 'Z';
  };
  s += P('t-b', crack([[56.2, 45.2, .3], [52.4, 42.8, 2.2], [51.9, 39.4, 1.5], [49.2, 37.8, .2]]) + crack([[52.2, 43.4, 1], [51, 46, .8], [48.6, 47.4, .1]])
    + crack([[53.9, 14.5, .3], [50.6, 16.2, 1.9], [50, 19.2, 1.2], [47.4, 20.2, .2]]));
  s += P('t-c', spark(7, 7.5, 3.6) + spark(58, 6, 3));
  add('ammonite', 'spiral ammonite fossil in cracked stone', s);
}

// ---------- red-planet
{
  let s = '';
  const cx = 28.5, cy = 35, R0 = 22.5;
  const lump = (x, y, rx, ry, rot, k) => {
    const v = [1, .84, 1.06, .9, 1, .8, .96, .88];
    return rpoly(v.map((m, i) => { const a = i / 8 * 2 * Math.PI, c = Math.cos(rot), sn = Math.sin(rot), px = rx * m * Math.cos(a + k), py = ry * m * Math.sin(a + k); return [x + px * c - py * sn, y + px * sn + py * c]; }), 1.8);
  };
  const yc = 18.5, dx = Math.sqrt(R0 * R0 - (yc - cy) ** 2);
  const cap = `M${f(cx - dx)} ${yc}A${R0} ${R0} 0 0 1 ${f(cx + dx)} ${yc}Q41 22.5 36.5 20.5Q32.5 23.5 28.5 21Q23.5 23.2 19.5 20.5Q16 21.5 ${f(cx - dx)} ${yc}Z`;
  const hl = 'M15 26.8A1.3 4.5 20 1 0 12 35.2A1.3 4.5 20 1 0 15 26.8Z';
  let g = '';
  g += P('t-a', circ(cx, cy, R0) + cap + hl, ' fill-rule="evenodd"');
  // shading crescent
  g += P('t-b', `M${f(cx + R0 * Math.cos(-.35))} ${f(cy + R0 * Math.sin(-.35))}A${R0} ${R0} 0 0 1 ${f(cx + R0 * Math.cos(2.2))} ${f(cy + R0 * Math.sin(2.2))}A27 27 0 0 0 ${f(cx + R0 * Math.cos(-.35))} ${f(cy + R0 * Math.sin(-.35))}Z`);
  // dark patches
  g += P('t-b', 'M17 27Q21 24 25.5 26.5Q28 29 24 30.5Q19.5 31.5 17 29.5Z' + 'M33 46Q37.5 43 42 45.5Q43 49 39 50.5Q34 51.5 33 48.5Z' + 'M14.5 42.5Q18 41 20 43.5Q19 46.5 15.5 45.5Z' + 'M38 26Q41.5 25 43 27.5Q41 30 38.5 28.8Z');
  // canyon scar
  g += P('t-b', 'M11.5 35.5Q20 33.2 28 34.6Q36 35.6 44.5 32.2Q46.5 31.6 46 33Q37 38.5 28 37.8Q20 37 12 37Q10.6 36.4 11.5 35.5Z' + 'M23 35.5L21.5 31.5L24.5 35.2ZM34.5 36.6L37 40.5L33 37Z');
  g += P('t-c', cap + hl);
  s += `<g transform="translate(-2 -2.4) scale(1.07)">${g}</g>`;
  // moons
  s += P('t-c', lump(54, 12.5, 5.2, 3.8, -.4, 0) + lump(58.2, 27, 3.3, 2.5, .5, .4));
  s += P('t-b', circ(52.5, 12, 1.1) + circ(55.6, 13.8, .8) + circ(57.6, 26.8, .7));
  s += P('t-c', spark(7.5, 8, 4) + spark(57, 51, 3.2) + circ(41, 6, 1));
  add('red-planet', 'rusty red planet with ice cap and moons', s);
}

// ---------- planet-earth
{
  let s = '';
  const cx = 30, cy = 34, R0 = 22;
  const pa = a => `${f(cx + R0 * Math.cos(a * Math.PI / 180))} ${f(cy + R0 * Math.sin(a * Math.PI / 180))}`;
  // atmosphere glow hugging the sphere
  s += P('t-c', circ(cx, cy, R0 + 1.6) + circ(cx, cy, R0), ' fill-rule="evenodd"');
  // two long cloud wisps over the ocean
  const clouds = 'M10.5 31Q12 21.5 23 18Q16 22.5 14.2 30.8Q12.4 32.6 10.5 31Z'
    + 'M16.5 50.5Q22 44.5 29.5 45Q23.5 47 19.8 52.6Q17.6 52.8 16.5 50.5Z';
  s += P('t-a', circ(cx, cy, R0) + clouds, ' fill-rule="evenodd"');
  // land
  s += P('t-b', 'M24 20Q26 15 31 15.5Q35 13.5 39 16Q42 18 40 21Q36 22 33 21Q29 23 26 22.5Z'
    + 'M22 27Q25 23.5 31 24.5Q36 24 39 26.5Q41.5 25.6 45 28.2Q44.2 30.6 43.2 31Q43.3 35 41 38Q39.5 42 38 47Q36 52 33.5 51.5Q32 47 31 43Q30 39 27.5 37Q23 36.5 21.5 33Q20.5 29.5 22 27Z'
    + `M${pa(170)}Q14 37 16.5 41Q17 45 ${pa(133)}A${R0} ${R0} 0 0 1 ${pa(170)}Z`);
  // night-side shading
  s += P('t-b', `M${pa(-55)}A${R0} ${R0} 0 0 1 ${pa(80)}A28 28 0 0 0 ${pa(-55)}Z`);
  s += P('t-c', clouds);
  // moon
  s += P('t-c', circ(56, 12, 4.2));
  s += P('t-b', circ(55, 11, 1.2) + circ(57.6, 13.8, .8) + 'M59.5 9.6A4.2 4.2 0 0 1 54.6 16A4.8 4.8 0 0 0 59.5 9.6Z');
  s += P('t-c', spark(7.5, 7.5, 4) + spark(57.5, 53, 3.2) + circ(44, 4.5, 1));
  add('planet-earth', 'blue Earth with clouds and a moon', s);
}
// ---------- gas-giant
{
  let s = '';
  const cx = 28, cy = 33, r = 24;
  const hw = y => Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
  const bulge = y => 2.6 * hw(y) / r;
  // band of the disc between latitudes y1 and y2, edges bowed like a sphere seen from just above
  const band = (y1, y2) => {
    const w1 = hw(y1), w2 = hw(y2);
    return `M${f(cx - w1)} ${f(y1)}Q${f(cx)} ${f(y1 + 2 * bulge(y1))} ${f(cx + w1)} ${f(y1)}` +
      `A${r} ${r} 0 0 1 ${f(cx + w2)} ${f(y2)}Q${f(cx)} ${f(y2 + 2 * bulge(y2))} ${f(cx - w2)} ${f(y2)}` +
      `A${r} ${r} 0 0 1 ${f(cx - w1)} ${f(y1)}Z`;
  };
  const Y = [cy - r, 15.5, 20, 25.5, 31, 36, 40.5, 50.5, cy + r];
  const K = ['t-a', 't-b', 't-c', 't-b', 't-c', 't-a', 't-c', 't-a'];
  const sx = 34.5, sy = 47.2, srx = 6, sry = 3.3;
  const ell = (x, y, a, b) => `M${f(x - a)} ${f(y)}a${f(a)} ${f(b)} 0 1 0 ${f(2 * a)} 0a${f(a)} ${f(b)} 0 1 0 ${f(-2 * a)} 0Z`;
  const by = { 't-a': '', 't-b': '', 't-c': '' };
  for (let i = 0; i < K.length; i++) by[K[i]] += band(Y[i], Y[i + 1]) + (i === 6 ? ell(sx, sy, srx, sry) : '');
  s += P('t-a', by['t-a']) + P('t-c', by['t-c'], ' fill-rule="evenodd"') + P('t-b', by['t-b']);
  // great red spot: dark ring with a lighter eye
  s += P('t-b', ell(sx, sy, srx, sry) + ell(sx + .6, sy, 3.1, 1.5), ' fill-rule="evenodd"');
  s += P('t-a', ell(sx + .6, sy, 3.1, 1.5));
  // shaded limb, lower right
  const ox = -2.6, oy = -2.6, d = Math.hypot(ox, oy), h = Math.sqrt(r * r - d * d / 4);
  const mx = cx + ox / 2, my = cy + oy / 2, ux = -oy / d, uy = ox / d;
  const p1 = [mx - h * ux, my - h * uy], p2 = [mx + h * ux, my + h * uy];
  s += P('t-b', `M${f(p2[0])} ${f(p2[1])}A${r} ${r} 0 1 1 ${f(p1[0])} ${f(p1[1])}A${r} ${r} 0 0 0 ${f(p2[0])} ${f(p2[1])}Z`);
  // two little moons
  s += C('t-a', 55.5, 15, 4) + P('t-b', 'M58.3 12.2A4 4 0 0 1 52.7 17.8A4.6 4.6 0 0 0 58.3 12.2Z');
  s += C('t-a', 57.5, 46, 2.6);
  s += P('t-c', spark(7.5, 8, 4) + spark(57.5, 30, 3));
  s += C('t-c', 50, 59, 1.3) + C('t-c', 4.5, 58, 1.2);
  add('gas-giant', 'striped gas giant with storm spot', s);
}

// ---------- twinkling-stars
{
  let s = '';
  const pt = p => f(p[0]) + ' ' + f(p[1]);
  const poly = v => 'M' + v.map(pt).join('L') + 'Z';
  // star whose tips poke out of a round glow: returns [star, glow pieces, outline of both]
  const glow = (cx, cy, R1, R2, hr, n) => {
    const v = star(cx, cy, R1, R2, n), N = v.length;
    const cut = (a, b) => { // a inside the glow, b outside
      const dx = b[0] - a[0], dy = b[1] - a[1], ex = a[0] - cx, ey = a[1] - cy;
      const A = dx * dx + dy * dy, B = 2 * (dx * ex + dy * ey), Cc = ex * ex + ey * ey - hr * hr;
      const t = (-B + Math.sqrt(B * B - 4 * A * Cc)) / (2 * A); return [a[0] + dx * t, a[1] + dy * t];
    };
    let g = '', o = 'M';
    for (let k = 0; k < N; k += 2) {
      const T = v[k], V = v[k + 1], T2 = v[(k + 2) % N];
      const b = cut(V, T), a = cut(V, T2);
      g += `M${pt(b)}A${hr} ${hr} 0 0 1 ${pt(a)}L${pt(V)}Z`;
      o += `${pt(T)}L${pt(b)}A${hr} ${hr} 0 0 1 ${pt(a)}L`;
    }
    return [poly(v), g, o.slice(0, -1) + 'Z'];
  };
  // grow a star polygon outwards by d with mitred corners (c = its centre)
  const grow = (v, d, c) => v.map((p, i) => {
    const N = v.length, a = v[(i + N - 1) % N], b = v[(i + 1) % N];
    const nrm = (q, r) => {
      let x = r[1] - q[1], y = q[0] - r[0]; const l = Math.hypot(x, y);
      if (x * ((q[0] + r[0]) / 2 - c[0]) + y * ((q[1] + r[1]) / 2 - c[1]) < 0) { x = -x; y = -y; }
      return [x / l, y / l];
    };
    const n1 = nrm(a, p), n2 = nrm(p, b), k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k];
  });
  // round patch of sky, low right; the big star sits on its upper-left rim
  const ox = 40, oy = 40, rr = 20, bx = 25.5, by = 25.5;
  const big = star(bx, by, 17.5, 7.4), H = grow(big, 2, [bx, by]);
  // disc minus the halo polygon: arcs of the rim outside the halo + halo runs inside the disc, reversed
  const ins = p => Math.hypot(p[0] - ox, p[1] - oy) < rr;
  const roots = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], ex = a[0] - ox, ey = a[1] - oy;
    const A = dx * dx + dy * dy, B = 2 * (dx * ex + dy * ey), Cc = ex * ex + ey * ey - rr * rr, D = B * B - 4 * A * Cc;
    if (D < 0) return [];
    const q = Math.sqrt(D); return [(-B - q) / (2 * A), (-B + q) / (2 * A)].map(t => [t, [a[0] + dx * t, a[1] + dy * t]]);
  };
  const chains = []; let cur = null;
  const st = H.findIndex(p => !ins(p)), N = H.length;
  for (let j = 1; j <= N; j++) {
    const a = H[(st + j - 1) % N], b = H[(st + j) % N], r = roots(a, b);
    if (!ins(a) && ins(b)) cur = [r[0][1], b];
    else if (ins(a) && ins(b)) cur.push(b);
    else if (ins(a)) { cur.push(r[1][1]); chains.push(cur); cur = null; }
    else if (r.length && r[0][0] > 0 && r[1][0] < 1) chains.push([r[0][1], r[1][1]]);
  }
  const ang = p => Math.atan2(p[1] - oy, p[0] - ox), last = q => q[q.length - 1];
  let sky = 'M' + pt(last(chains[0])), c = chains[0], guard = 0;
  do {
    sky += c.slice(0, -1).reverse().map(p => 'L' + pt(p)).join('');
    const a0 = ang(c[0]); let best = null, bd = 9;
    for (const q of chains) { let da = ang(last(q)) - a0; while (da <= 1e-6) da += 2 * Math.PI; if (da < bd) { bd = da; best = q; } }
    sky += `A${rr} ${rr} 0 ${bd > Math.PI ? 1 : 0} 1 ${pt(last(best))}`;
    c = best;
  } while (c !== chains[0] && ++guard < 20);
  sky += 'Z';
  const S = [glow(46.5, 49, 7.8, 3.4, 4.8), glow(49.5, 31, 5.6, 1.5, 2.9, 4)];
  s += P('t-b', sky + S.map(x => x[2]).join(''), ' fill-rule="evenodd"');
  // big star: cream halo, yellow star, shaded facets
  s += P('t-c', poly(H)) + P('t-a', poly(big));
  let fac = '';
  for (let i = 0; i < 10; i += 2) fac += `M${bx} ${by}L${pt(big[i])}L${pt(big[i + 1])}Z`;
  s += P('t-b', fac);
  s += P('t-a', S.map(x => x[1]).join(''));
  s += P('t-c', S.map(x => x[0]).join(''));
  s += P('t-c', spark(55, 9.5, 4) + spark(8.5, 55, 3.4) + circ(50, 4.5, 1.1) + circ(4.5, 45, 1.1));
  add('twinkling-stars', 'big star and twinkles on a sky patch', s);
}

// ---------- spiral-galaxy
{
  let s = '';
  const cx = 32, cy = 32, r0 = 9, r1 = 28.5, T = 1.8 * Math.PI, k = Math.log(r1 / r0) / T, n = 10;
  const at = (t, ph, off) => { // point on an arm's centre line, pushed sideways by off
    const r = r0 * Math.exp(k * t), a = t + ph, c = Math.cos(a), sn = Math.sin(a);
    const tx = k * c - sn, ty = k * sn + c, l = Math.hypot(tx, ty);
    return [cx + r * c - ty / l * off, cy + r * sn + tx / l * off];
  };
  const W = t => 7 * Math.sin(Math.PI * Math.pow(t / T, .75)) + .4;
  const pt = p => f(p[0]) + ' ' + f(p[1]);
  const smooth = q => q.slice(1, -1).map((p, i) => `Q${pt(p)} ${pt(i === q.length - 3 ? q[q.length - 1] : [(p[0] + q[i + 2][0]) / 2, (p[1] + q[i + 2][1]) / 2])}`).join('');
  const strip = (ph, a, b, t0 = 0) => { // band between offsets a(t) and b(t), smoothed
    const L = [], Rr = [];
    for (let i = 0; i <= n; i++) { const t = t0 + (T - t0) * i / n; L.push(at(t, ph, a(t))); Rr.push(at(t, ph, b(t))); }
    Rr.reverse();
    let A = 0; const all = L.concat(Rr);
    for (let i = 0; i < all.length; i++) { const p = all[i], q = all[(i + 1) % all.length]; A += p[0] * q[1] - q[0] * p[1]; }
    const [u, v] = A > 0 ? [Rr.slice().reverse(), L.slice().reverse()] : [L, Rr]; // wind like circ() so hub and arms union under nonzero
    return `M${pt(u[0])}${smooth(u)}L${pt(v[0])}${smooth(v)}Z`;
  };
  // solid hub, two thin arms winding nearly a full turn, dust lane on each arm's inner edge
  let arms = circ(cx, cy, 10), shade = '', dots = '';
  for (const ph of [-.5, Math.PI - .5]) {
    arms += strip(ph, t => -W(t) / 2, t => W(t) / 2);
    shade += strip(ph, t => W(t) * .3, t => W(t) / 2, 2);
    for (const [t, r, o] of [[2.8, 2, -.4], [4, 1.7, -.3]]) { const p = at(t, ph, o); dots += circ(p[0], p[1], r); }
    for (const [t, r] of [[1.9, 1.5], [3.4, 1.8], [5, 1.4]]) { const p = at(t, ph + Math.PI / 2, 0); dots += circ(p[0], p[1], r); }
  }
  s += P('t-a', arms) + P('t-b', shade);
  // bright core: cream in colour; the shade under it makes it the strongest tone in the one-colour tint
  s += C('t-b', cx, cy, 5) + P('t-c', circ(cx, cy, 6.5) + dots);
  s += P('t-c', spark(56, 8, 3.6) + spark(7.5, 56.5, 3.2));
  add('spiral-galaxy', 'two-armed spiral galaxy around a bright core', s);
}

// ---------- black-hole
{
  let s = '';
  const cx = 32, cy = 32.5, rd = 11.8, rr = 13.4, rg = 14.8, rh = 19.6, rh2 = 17.4, ro = 21, ro2 = 23;
  const a = 30.5, b = 4.8, ag = 31.5, bg = 6, yc = cy - 1.5, yt = cy - 2.5;
  const p = (x, y) => `${f(x)} ${f(y)}`;
  const ix = (r, A, B) => { const x = Math.sqrt((r * r - B * B) / (1 - B * B / (A * A))); return [x, Math.sqrt(r * r - x * x)]; };
  const hx = (r, y) => Math.sqrt(r * r - (cy - y) * (cy - y));
  // lensed far side of the disk: big arch over the top, thinner one underneath
  const [xo, yo] = ix(rh, ag, bg), [xi, yi] = ix(rg, ag, bg);
  let halo = `M${p(cx - xo, cy - yo)}A${rh} ${rh} 0 0 1 ${p(cx + xo, cy - yo)}A${ag} ${bg} 0 0 0 ${p(cx + xi, cy - yi)}` +
    `A${rg} ${rg} 0 0 0 ${p(cx - xi, cy - yi)}A${ag} ${bg} 0 0 0 ${p(cx - xo, cy - yo)}Z`;
  const under = (r1, r2) => { // annulus r1..r2 below the gap ellipse
    const [x1, y1] = ix(r1, ag, bg), [x2, y2] = ix(r2, ag, bg);
    return `M${p(cx - x2, cy + y2)}A${ag} ${bg} 0 0 0 ${p(cx - x1, cy + y1)}A${r1} ${r1} 0 0 0 ${p(cx + x1, cy + y1)}` +
      `A${ag} ${bg} 0 0 0 ${p(cx + x2, cy + y2)}A${r2} ${r2} 0 0 1 ${p(cx - x2, cy + y2)}Z`;
  };
  halo += under(rg, rh2);
  const [xp, yp] = ix(ro, ag, bg), [xq, yq] = ix(ro2, ag, bg);
  const outer = `M${p(cx - xq, cy - yq)}A${ro2} ${ro2} 0 0 1 ${p(cx + xq, cy - yq)}A${ag} ${bg} 0 0 0 ${p(cx + xp, cy - yp)}A${ro} ${ro} 0 0 0 ${p(cx - xp, cy - yp)}A${ag} ${bg} 0 0 0 ${p(cx - xq, cy - yq)}Z`;
  // photon ring around the empty centre, split where the near side of the disk crosses in front
  const ring = `M${p(cx - hx(rr, yt), yt)}A${rr} ${rr} 0 0 1 ${p(cx + hx(rr, yt), yt)}L${p(cx + hx(rd, yt), yt)}A${rd} ${rd} 0 0 0 ${p(cx - hx(rd, yt), yt)}Z` + under(rd, rr);
  // near side of the disk, edge-on, passing in front of the hole
  const [xe, ye] = ix(rr, a, b), xc = hx(rr, yc);
  const disk = `M${p(cx - a, cy)}A${a} ${b} 0 0 1 ${p(cx - xe, cy - ye)}A${rr} ${rr} 0 0 0 ${p(cx - xc, yc)}L${p(cx + xc, yc)}` +
    `A${rr} ${rr} 0 0 0 ${p(cx + xe, cy - ye)}A${a} ${b} 0 0 1 ${p(cx + a, cy)}A${a} ${b} 0 0 1 ${p(cx, cy + b)}A${a} ${b} 0 0 1 ${p(cx - a, cy)}Z`;
  const streak = `M${p(cx - 19, cy + 1.4)}A19 1 0 1 0 ${p(cx + 19, cy + 1.4)}A19 1 0 1 0 ${p(cx - 19, cy + 1.4)}Z`;
  s += P('t-a', halo + disk + streak, ' fill-rule="evenodd"');
  s += P('t-c', ring + streak + outer);
  s += P('t-b', `M${p(cx - a, cy)}A${a} ${b} 0 0 0 ${p(cx + a, cy)}A${a} ${b - 1.7} 0 0 1 ${p(cx - a, cy)}Z`);
  s += P('t-c', spark(7.5, 8, 3.8) + spark(57, 56.5, 3.2) + circ(55, 10, 1.2) + circ(9, 54, 1.1));
  add('black-hole', 'black hole with a glowing warped disk', s);
}

// ---------- asteroid
{
  let s = '';
  const cx = 36.5, cy = 28.5, rot = -28 * Math.PI / 180, co = Math.cos(rot), si = Math.sin(rot);
  const T = (x, y) => [cx + x * co - y * si, cy + x * si + y * co]; // rock-local -> icon, tilted
  const K = [1.1, .86, 1.1, .92, 1.06, .84, 1.12, .9, 1.06];
  const V = K.map((k, i) => { const a = i * 2 * Math.PI / 9 - .2; return T(24 * k * Math.cos(a), 16 * k * Math.sin(a)); });
  const pt = p => f(p[0]) + ' ' + f(p[1]);
  const mid = i => { const a = V[i % 9], b = V[(i + 1) % 9]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  // smooth lumpy outline: through edge midpoints, vertices as controls
  const run = (i, j) => { let d = ''; for (let k = i; k < j; k++) d += `Q${pt(V[k % 9])} ${pt(mid(k))}`; return d; };
  const rock = `M${pt(mid(8))}${run(9, 18)}Z`;
  // craters: [x, y, r] in rock-local coords; shadowed rim thick on the upper left
  const cr = [[-10, -3, 5], [5.5, -6.5, 3.6], [12.5, 2, 2.7], [-1, 5, 2.6]].map(([x, y, r]) => [...T(x, y), r]);
  const gl = [T(-11, -10.8), T(.5, -10.8)], glint = `M${pt(gl[0])}A5.8 1.3 -28 1 0 ${pt(gl[1])}A5.8 1.3 -28 1 0 ${pt(gl[0])}Z`;
  s += P('t-a', rock + glint, ' fill-rule="evenodd"') + P('t-c', glint);
  // underside shade: same outline from mid(0) round to mid(4), back along an inner curve
  s += P('t-b', `M${pt(mid(0))}${run(1, 5)}Q${pt(T(-15, 5))} ${pt(T(-5, 7.5))}Q${pt(T(8, 9))} ${pt(T(15, 6))}Q${pt(T(20, 4))} ${pt(mid(0))}Z`);
  s += P('t-b', cr.map(c => circ(c[0], c[1], c[2]) + circ(c[0] + c[2] * .25, c[1] + c[2] * .25, c[2] * .72)).join(''), ' fill-rule="evenodd"');
  // chips flying with it
  s += P('t-a', rpoly([[6.5, 26], [13, 24], [15, 30], [10.5, 34], [5.5, 31.5]], 1.6) + rpoly([[51.5, 50], [57, 48.5], [59, 54], [54, 57.5]], 1.4));
  s += P('t-b', 'M5.8 30.6L14.2 31.3Q12 34.2 10.5 34L6 31.6Z M51.9 53.5L58.8 53.6Q56.5 56.4 54 57.5Z');
  // motion lines trailing to the lower left
  s += L('M3.5 50L11.5 45.6M7 58.5L17 53M17 61.5L24.5 57.4', 2.2);
  s += P('t-c', spark(55.5, 8.5, 3.8) + spark(9, 9, 3) + circ(60, 33, 1.2) + circ(31, 59, 1.1));
  add('asteroid', 'tumbling cratered space rock with chips', s);
}
// ---------- eclipse
{
  let s = '';
  const cx = 31, cy = 33, rm = 14, rk = 15.2, rr = 18.8, RO = 22.4, fa = -46, D = Math.PI / 180;
  const pol = (a, r) => [cx + r * Math.cos(a * D), cy + r * Math.sin(a * D)];
  const pt = p => f(p[0]) + ' ' + f(p[1]);
  const rad = p => Math.hypot(p[0] - cx, p[1] - cy);
  const cw = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 1 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 1 ${f(-2 * r)} 0Z`;
  // diamond-ring flash: a house spark sitting on the rim, long arms outward, short inward ones clipped at the moon
  const [X, Y] = pol(fa, 16.5), U = [X, Y - 18], Rt = [X + 18, Y], Dn = [X, Y + 9], Lf = [X - 9, Y];
  const q = (a, b, t) => [0, 1].map(i => (1 - t) ** 2 * a[i] + 2 * t * (1 - t) * [X, Y][i] + t * t * b[i]);
  const cross = (a, b, R) => {
    let lo = 0, hi = 1; const sg = rad(a) < R;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if ((rad(q(a, b, m)) < R) === sg) lo = m; else hi = m; }
    return lo;
  };
  // piece of a spark edge between two parameters (control from the blossom)
  const sub = (a, b, t0, t1) => 'Q' + pt([0, 1].map(i => a[i] * (1 - t0) * (1 - t1) + [X, Y][i] * ((1 - t0) * t1 + t0 * (1 - t1)) + b[i] * t0 * t1)) + ' ' + pt(q(a, b, t1));
  const LT = r => cross(Lf, U, r), RD = r => cross(Rt, Dn, r);
  // soft corona: lumpy glow band hugging the ring, opening where the flash sits
  const a1 = Math.atan2(q(Lf, U, LT(RO))[1] - cy, q(Lf, U, LT(RO))[0] - cx) / D + 360;
  const a2 = Math.atan2(q(Rt, Dn, RD(RO))[1] - cy, q(Rt, Dn, RD(RO))[0] - cx) / D;
  const N = 22, pts = [];
  for (let k = 0; k <= N; k++) {
    const a = a2 + (a1 - a2) * k / N, w = Math.min(1, Math.max(0, (Math.abs(((a - fa + 540) % 360) - 180) - 18) / 30));
    pts.push(pol(a, RO + w * (.25 * Math.cos(2 * (a - 18) * D) + .25 * Math.sin(4 * a * D + 1) + .15 * Math.sin(7 * a * D + 2))));
  }
  const mid = (p, r) => [(p[0] + r[0]) / 2, (p[1] + r[1]) / 2];
  let band = 'M' + pt(pts[0]);
  for (let k = 1; k < N - 1; k++) band += 'Q' + pt(pts[k]) + ' ' + pt(mid(pts[k], pts[k + 1]));
  band += 'Q' + pt(pts[N - 1]) + ' ' + pt(pts[N]);
  band += sub(Lf, U, LT(RO), LT(rr)) + `A${rr} ${rr} 0 1 0 ${pt(q(Rt, Dn, RD(rr)))}` + sub(Rt, Dn, RD(rr), RD(RO)) + 'Z';
  // curved wisps with rounded tips, the longest pair on a tilted axis
  const wisp = (a, T, bend, hw = 9, tr = .9) => {
    const k = pol(a + bend, T), c = pol(a + bend * .25, 20 + (T - 20) * .5);
    const tx = k[0] - c[0], ty = k[1] - c[1], tl = Math.hypot(tx, ty), nx = -ty / tl, ny = tx / tl, w1 = 1.4;
    return 'M' + pt(pol(a - hw, 20.5)) + 'Q' + pt([c[0] - nx * w1, c[1] - ny * w1]) + ' ' + pt([k[0] - nx * tr, k[1] - ny * tr]) +
      `A${f(tr)} ${f(tr)} 0 0 1 ${pt([k[0] + nx * tr, k[1] + ny * tr])}` + 'Q' + pt([c[0] + nx * w1, c[1] + ny * w1]) + ' ' + pt(pol(a + hw, 20.5)) + 'Z';
  };
  const wisps = wisp(18, 30.5, -6) + wisp(198, 29.5, 6) + wisp(78, 26.5, -8) + wisp(138, 27.5, 8) + wisp(256, 27, -8);
  s += P('t-a', band + wisps);
  // bright ring round the black moon, fused with the flash (its inner arms stop at the moon's edge)
  const flash = 'M' + pt(q(Lf, U, LT(rm))) + sub(Lf, U, LT(rm), 1) + 'Q' + pt([X, Y]) + ' ' + pt(Rt) + sub(Rt, Dn, 0, RD(rm)) + `A${rm} ${rm} 0 0 0 ${pt(q(Lf, U, LT(rm)))}Z`;
  s += P('t-c', cw(cx, cy, rr) + circ(cx, cy, rm) + flash);
  // crisp dark limb on the moon's edge, broken only where the flash crosses it
  s += P('t-b', 'M' + pt(q(Rt, Dn, RD(rk))) + `A${rk} ${rk} 0 1 1 ${pt(q(Lf, U, LT(rk)))}` + sub(Lf, U, LT(rk), LT(rm)) +
    `A${rm} ${rm} 0 1 0 ${pt(q(Rt, Dn, RD(rm)))}` + sub(Rt, Dn, RD(rm), RD(rk)) + 'Z');
  s += P('t-c', spark(57, 56.5, 3.5) + spark(6.5, 7, 3));
  s += C('t-c', 57, 6, 1.3) + C('t-c', 5, 58, 1.2);
  add('eclipse', 'total solar eclipse with diamond ring', s);
}

// ---------- constellation
{
  let s = '';
  const cx = 32, cy = 32, R0 = 27;
  // the Big Dipper: handle end, handle, bowl (Megrez, Dubhe, Merak, Phecda)
  const S = [[9.5, 25], [18.5, 21.5], [26.5, 26], [33.5, 31.5], [50.5, 29], [49, 44], [34.5, 43.5]];
  const sr = [2.6, 2.6, 2.6, 2.4, 3.1, 2.8, 2.7];
  const E2 = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]];
  const pt = (x, y) => f(x) + ' ' + f(y);
  let lines = '';
  for (const [i, j] of E2) {
    // straight bar between two stars, stopping just short of each
    const [x1, y1] = S[i], [x2, y2] = S[j], l = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / l, uy = (y2 - y1) / l;
    const g1 = sr[i] + 1.1, g2 = sr[j] + 1.1, h = .85, nx = -uy * h, ny = ux * h;
    const ax = x1 + ux * g1, ay = y1 + uy * g1, bx = x2 - ux * g2, by = y2 - uy * g2;
    lines += `M${pt(ax + nx, ay + ny)}L${pt(bx + nx, by + ny)}L${pt(bx - nx, by - ny)}L${pt(ax - nx, ay - ny)}Z`;
  }
  const stars = S.map((p, k) => circ(p[0], p[1], sr[k])).join('');
  const faint = [[16, 40], [25, 51], [42, 13], [24, 12], [45, 54], [56, 38]].map(p => circ(p[0], p[1], 1.1)).join('');
  s += P('t-a', circ(cx, cy, R0 + 3) + circ(cx, cy, R0), ' fill-rule="evenodd"');
  s += P('t-b', circ(cx, cy, R0) + lines + stars + faint, ' fill-rule="evenodd"');
  s += P('t-c', lines + stars);
  s += P('t-a', faint);
  s += P('t-c', spark(57.5, 6.5, 4.5) + spark(6.5, 57.5, 3.5));
  add('constellation', 'Big Dipper stars joined on night sky', s);
}

// ---------- baseball-bat
{
  let s = '';
  const pt = (x, y) => f(x) + ' ' + f(y);
  // bat drawn lying along +u in a frame turned 45deg; ball centre mapped into that frame
  const ox = 8.5, oy = 55.5, bx = 43, by = 44, br = 14, k = Math.SQRT1_2;
  const uc = (bx - ox - (by - oy)) * k, vc = (bx - ox + by - oy) * k, cr = br + 1.3;
  // lower edge (end -> knob), bitten where it passes behind the ball
  const low = [[61, 5.3], [44, 5], [22, 2.1], [2.2, 1.9]];
  let d = `M2.2 -1.9L22 -2.1L44 -5L61 -5.3Q65.5 -5.3 65.5 0Q65.5 5.3 61 5.3`, inside = false;
  for (let i = 0; i < low.length - 1; i++) {
    const [x1, y1] = low[i], [x2, y2] = low[i + 1], dx = x2 - x1, dy = y2 - y1, fx = x1 - uc, fy = y1 - vc;
    const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), Cq = fx * fx + fy * fy - cr * cr, D = B * B - 4 * A * Cq;
    const ts = D > 0 ? [(-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A)].filter(t => t > 0 && t < 1) : [];
    for (const t of ts) {
      const q = pt(x1 + t * dx, y1 + t * dy);
      d += inside ? `A${f(cr)} ${f(cr)} 0 0 0 ${q}` : `L${q}`;
      inside = !inside;
    }
    if (!inside) d += 'L' + pt(x2, y2);
  }
  d += 'A2.4 4.4 0 1 1 2.2 -1.9Z';
  let g = P('t-a', d + 'M36 -2.3L59 -3.3Q61.5 -3.4 62.5 -2Q60.5 -1.6 59 -1.6L36 -1Z', ' fill-rule="evenodd"');
  // cream highlight laid into the cut-out, so the barrel shines instead of showing a slit
  g += P('t-c', 'M36 -2.3L59 -3.3Q61.5 -3.4 62.5 -2Q60.5 -1.6 59 -1.6L36 -1Z');
  // grip tape on the handle, darker knob, shade under the barrel tip
  g += P('t-b', [5, 9, 13].map(u => `M${u + 1} -2.2H${u + 3.4}L${u + 2.4} 2.2H${u}Z`).join('') + 'M0 -4.4A2.4 4.4 0 0 0 0 4.4A1.3 4.4 0 0 1 0 -4.4Z');
  g += P('t-b', 'M48 4.5L61 4.6Q63.8 4.6 64.8 2.4Q65.6 5.3 61 5.3L48 5.1Z');
  s += `<g transform="translate(${ox} ${oy}) rotate(-45)">${g}</g>`;
  // ball with curved double seams and chevron stitches
  s += C('t-c', bx, by, br);
  s += P('t-a', `M${pt(bx + 9, by + 10.6)}A${br} ${br} 0 0 0 ${pt(bx + 13.4, by - 4)}A${br} ${br - 2} 0 0 1 ${pt(bx + 9, by + 10.6)}Z`);
  const rot = (x, y, a = -.35) => [bx + x * Math.cos(a) - y * Math.sin(a), by + x * Math.sin(a) + y * Math.cos(a)];
  let seam = '', st = '';
  for (const sg of [-1, 1]) {
    const p0 = rot(sg * 8.5, -11), c = rot(sg * 2.5, 0), p1 = rot(sg * 8.5, 11);
    seam += `M${pt(...p0)}Q${pt(...c)} ${pt(...p1)}`;
    for (const t of [.17, .39, .61, .83]) {
      const x = (1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * c[0] + t * t * p1[0], y = (1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * c[1] + t * t * p1[1];
      const tx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]), ty = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]), tl = Math.hypot(tx, ty);
      const ux = tx / tl, uy = ty / tl, nx = -uy, ny = ux;
      st += `M${pt(x + nx * 2.2 - ux * 1.2, y + ny * 2.2 - uy * 1.2)}L${pt(x, y)}L${pt(x - nx * 2.2 - ux * 1.2, y - ny * 2.2 - uy * 1.2)}`;
    }
  }
  s += L(seam, 1.6) + L(st, 1.2);
  s += P('t-c', spark(12, 12, 5) + spark(25, 5, 2.6));
  add('baseball-bat', 'wooden baseball bat behind a stitched ball', s);
}

// ---------- basketball-hoop
{
  let s = '';
  const pt = (x, y) => f(x) + ' ' + f(y);
  const bx = 32, by = 33.5, br = 11.5, kr = br + 1.2;
  const hx = 32, hy = 41, ro = [17, 5], ri = [14.5, 3];
  // backboard with a gap cut round the ball where it overlaps
  const X0 = 8, X1 = 56, Y0 = 3.5, Y1 = 35.5, dx = Math.sqrt(kr * kr - (Y1 - by) ** 2);
  s += P('t-c', `M${pt(bx + dx, Y1)}H${X1 - 3}Q${X1} ${Y1} ${X1} ${Y1 - 3}V${Y0 + 3}Q${X1} ${Y0} ${X1 - 3} ${Y0}H${X0 + 3}Q${X0} ${Y0} ${X0} ${Y0 + 3}V${Y1 - 3}Q${X0} ${Y1} ${X0 + 3} ${Y1}H${f(bx - dx)}A${f(kr)} ${f(kr)} 0 1 1 ${pt(bx + dx, Y1)}Z`);
  s += P('t-b', `M${X1 - 3} ${Y1}Q${X1} ${Y1} ${X1} ${Y1 - 3}V${Y0 + 3}Q${X1} ${Y0} ${X1 - 3} ${Y0}H${X1 - 5}Q${X1 - 2} ${Y0} ${X1 - 2} ${Y0 + 3}V${Y1 - 3}Q${X1 - 2} ${Y1} ${X1 - 5} ${Y1}Z`);
  s += P('t-b', 'M21 24.5V15H43V24.5H41.2V16.8H22.8V24.5Z');
  // back half of the rim, cut away where the ball passes in front of it
  const ep = ([a, b], t) => [hx + a * Math.cos(t), hy + b * Math.sin(t)];
  const hit = r => { let lo = Math.PI, hi = 1.5 * Math.PI; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2, p = ep(r, m); (Math.hypot(p[0] - bx, p[1] - by) > kr ? lo = m : hi = m); } return ep(r, lo); };
  const o = hit(ro), n = hit(ri), mo = [2 * hx - o[0], o[1]], mn = [2 * hx - n[0], n[1]];
  s += P('t-b', `M${pt(hx - ro[0], hy)}A${ro[0]} ${ro[1]} 0 0 1 ${pt(...o)}A${f(kr)} ${f(kr)} 0 0 0 ${pt(...n)}A${ri[0]} ${ri[1]} 0 0 0 ${pt(hx - ri[0], hy)}Z` +
    `M${pt(hx + ro[0], hy)}A${ro[0]} ${ro[1]} 0 0 0 ${pt(...mo)}A${f(kr)} ${f(kr)} 0 0 1 ${pt(...mn)}A${ri[0]} ${ri[1]} 0 0 1 ${pt(hx + ri[0], hy)}Z`);
  // net: a lattice of diamond holes in a tapering bag
  const T0 = 42.5, T1 = 59, M = (u, t) => [16.5 + 31 * u + (6 - 12 * u) * t, T0 + (T1 - T0) * t];
  let holes = '';
  [[.21, 4, 0], [.52, 3, .125], [.83, 4, 0]].forEach(([t, k, o2]) => {
    for (let i = 0; i < k; i++) {
      const u = .125 + o2 + i * .25, a = .09, b = .12;
      holes += `M${pt(...M(u - a, t))}L${pt(...M(u, t - b))}L${pt(...M(u + a, t))}L${pt(...M(u, t + b))}Z`;
    }
  });
  let bag = `M${pt(...M(0, 0))}`;
  for (let i = 0; i <= 4; i++) bag += `L${pt(...M(i * .25, 1))}` + (i < 4 ? `L${pt(...M(i * .25 + .125, .94))}` : '');
  s += P('t-c', bag + `L${pt(...M(1, 0))}A15.5 3 0 0 1 ${pt(...M(0, 0))}Z` + holes, ' fill-rule="evenodd"');
  // ball, then the front of the rim over it
  const hl = `M${pt(bx - 7.5, by - 6.5)}Q${pt(bx - 5, by - 10)} ${pt(bx - 1, by - 10.7)}Q${pt(bx - 4.5, by - 8.5)} ${pt(bx - 5.7, by - 5.2)}Z`;
  s += P('t-a', circ(bx, by, br) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', `M${pt(bx + 9.5, by - 6.8)}A${br} ${br} 0 0 1 ${pt(bx - 7, by + 9.1)}A${br + 1} ${br + 1.5} 0 0 0 ${pt(bx + 9.5, by - 6.8)}Z`);
  s += L(`M${pt(bx - 11.3, by + 1.5)}Q${pt(bx, by + 3.5)} ${pt(bx + 11.3, by - 1.5)}M${pt(bx + 1.5, by - 11.4)}Q${pt(bx - 3, by)} ${pt(bx - 1.5, by + 11.4)}` +
    `M${pt(bx - 6.5, by - 9.4)}Q${pt(bx - 2, by - 2)} ${pt(bx - 9.6, by + 6.3)}M${pt(bx + 9.6, by - 6.3)}Q${pt(bx + 2.5, by + 1.5)} ${pt(bx + 6.5, by + 9.4)}`, 1.5);
  s += P('t-b', `M${pt(hx - ro[0], hy)}A${ro[0]} ${ro[1]} 0 0 0 ${pt(hx + ro[0], hy)}H${hx + ri[0]}A${ri[0]} ${ri[1]} 0 0 1 ${pt(hx - ri[0], hy)}Z`);
  s += P('t-c', spark(5, 49, 3.5) + spark(59, 47, 3));
  add('basketball-hoop', 'basketball dropping through a hoop and net', s);
}

// ---------- tennis-racket
{
  let s = '';
  const pt = (x, y) => f(x) + ' ' + f(y);
  // racket drawn upright in a frame turned so the handle runs to the lower right
  const ox = 22.5, oy = 22, RO = [14.5, 18.5], RI = [11.7, 15.6];
  const el = ([a, b], sw) => `M${f(-a)} 0A${a} ${b} 0 1 ${sw} ${f(a)} 0A${a} ${b} 0 1 ${sw} ${f(-a)} 0Z`;
  let g = P('t-a', el(RO, 1) + el(RI, 0) + 'M-5.5 15.4L0 16.4L5.5 15.4L2.3 28H3.1V41.5Q3.1 44.5 0 44.5Q-3.1 44.5 -3.1 41.5V28H-2.3Z' + 'M-2.7 19.6L0 24.2L2.7 19.6L0 20.1Z');
  // shade along one side of the frame and the leather grip
  g += P('t-b', `M${f(RO[0] * Math.cos(-1.1))} ${f(RO[1] * Math.sin(-1.1))}A${RO[0]} ${RO[1]} 0 0 1 ${f(RO[0] * Math.cos(1.25))} ${f(RO[1] * Math.sin(1.25))}A${RO[0] - 1.3} ${RO[1] - 1.3} 0 0 0 ${f(RO[0] * Math.cos(-1.1))} ${f(RO[1] * Math.sin(-1.1))}Z`);
  g += P('t-b', [30, 34, 38].map(y => `M-3.1 ${y + 1}L3.1 ${y - 1}V${y + 1.6}L-3.1 ${y + 3.6}Z`).join('') + 'M-3.1 42Q-2.9 44.5 0 44.5Q2.9 44.5 3.1 42Z');
  // criss-cross strings, each a thin bar stopping at the frame
  const sw = .7, hy = x => RI[1] * Math.sqrt(1 - (x / RI[0]) ** 2), hx = y => RI[0] * Math.sqrt(1 - (y / RI[1]) ** 2);
  let str = '';
  for (let x = -8; x < 9; x += 4) { const h = hy(Math.abs(x) + sw); str += `M${f(x - sw)} ${f(-h)}H${f(x + sw)}V${f(h)}H${f(x - sw)}Z`; }
  for (let y = -12; y < 13; y += 4) { const h = hx(Math.abs(y) + sw); str += `M${f(-h)} ${f(y - sw)}H${f(h)}V${f(y + sw)}H${f(-h)}Z`; }
  g += P('t-c', str);
  s += `<g transform="translate(${ox} ${oy}) rotate(-45)">${g}</g>`;
  // fuzzy ball with a curved seam on each side
  const bx = 13, by = 50.5, br = 10.4, rot = .5;
  let fuzz = '';
  for (let i = 0; i < 26; i++) {
    const a = i * Math.PI / 13, b = a + Math.PI / 26, c = a + Math.PI / 13;
    fuzz += (i ? '' : `M${pt(bx + br * Math.cos(a), by + br * Math.sin(a))}`) + `Q${pt(bx + (br + .7) * Math.cos(b), by + (br + .7) * Math.sin(b))} ${pt(bx + br * Math.cos(c), by + br * Math.sin(c))}`;
  }
  const seam = sg => {
    const P0 = [sg * 7.3, -7], C0 = [sg * 1.6, 0], P1 = [sg * 7.3, 7], L1 = [], L2 = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, x = (1 - t) ** 2 * P0[0] + 2 * t * (1 - t) * C0[0] + t * t * P1[0], y = (1 - t) ** 2 * P0[1] + 2 * t * (1 - t) * C0[1] + t * t * P1[1];
      const tx = 2 * (1 - t) * (C0[0] - P0[0]) + 2 * t * (P1[0] - C0[0]), ty = 2 * (1 - t) * (C0[1] - P0[1]) + 2 * t * (P1[1] - C0[1]), l = Math.hypot(tx, ty);
      L1.push([x - ty / l * .85, y + tx / l * .85]); L2.unshift([x + ty / l * .85, y - tx / l * .85]);
    }
    return 'M' + [...L1, ...L2].map(([x, y]) => pt(bx + x * Math.cos(rot) - y * Math.sin(rot), by + x * Math.sin(rot) + y * Math.cos(rot))).join('L') + 'Z';
  };
  const seams = seam(-1) + seam(1);
  s += P('t-a', fuzz + 'Z' + seams, ' fill-rule="evenodd"');
  s += P('t-c', seams);
  s += P('t-c', spark(55, 9, 5) + spark(45.5, 4.5, 2.5));
  add('tennis-racket', 'tennis racket with strings and a fuzzy ball', s);
}
// ---------- skis
{
  let s = '';
  const A = 26, cx = 32, cy = 32, Yc = 51, h = 4, Ys = -21, T = 64 * Math.PI / 180, ra = A * Math.PI / 180, w = 2.7, r0 = 8;
  const co = Math.cos(ra), si = Math.sin(ra);
  const yb = x => (Yc - cy - x * si) / co;
  const ux = -Math.sin(2 * ra), uy = -Math.cos(2 * ra);
  const yc = (x, sg) => (sg * h + uy * x) / ux;
  const pt = (x, y) => `${f(x)} ${f(y)}`;
  const ro = r0 + w, ri = r0 - w;
  const curl = `L${-w} ${Ys}A${ro} ${ro} 0 0 1 ${pt(r0 - ro * Math.cos(T), Ys - ro * Math.sin(T))}A${w} ${w} 0 0 1 ${pt(r0 - ri * Math.cos(T), Ys - ri * Math.sin(T))}A${f(ri)} ${f(ri)} 0 0 0 ${w} ${Ys}`;
  const slit = (y1, y2) => `M-.6 ${f(y1)}H.6V${f(y2)}H-.6Z`;
  const bind = R('t-b', -3.7, -15, 7.4, 4.2, 1.2) + R('t-b', -3.7, -7.5, 7.4, 2.4, 1);
  // snow mound
  s += P('t-c', `M2.5 61.5C3 53.5 7 ${Yc} 16 ${Yc}H48C57 ${Yc} 61 53.5 61.5 61.5Z`);
  // poles behind the skis, flatter than them; hidden where a ski covers them
  const pa = 52 * Math.PI / 180, dxp = Math.sin(pa), dyp = Math.cos(pa), tH = (w + 1.3) / Math.sin(pa - ra), t1 = -23, t2 = (Yc + 1.2 - cy) / dyp;
  const pp = (sg, t) => pt(cx + sg * t * dxp, cy + t * dyp);
  s += L(`M${pp(1, t1)}L${pp(1, -tH)}M${pp(1, tH)}L${pp(1, t2)}M${pp(-1, t1)}L${pp(-1, -tH)}M${pp(-1, tH)}L${pp(-1, t2)}`, 2.2);
  const gp = (sg) => cap(cx + sg * (t1 - 1.5) * dxp, cy + (t1 - 1.5) * dyp, cx + sg * (t1 + 5) * dxp, cy + (t1 + 5) * dyp, 3.8);
  s += P('t-b', gp(1) + gp(-1));
  const tb = t2 - 4.5;
  s += L(circ(cx + tb * dxp, cy + tb * dyp, 2.4) + circ(cx - tb * dxp, cy + tb * dyp, 2.4), 1.5);
  // back ski (split where the front ski crosses)
  const bs = slit(-17, yc(.6, 1) - 1.5) + slit(yc(-.6, -1) + 1.5, yb(0) - 2);
  let b = P('t-a', `M${-w} ${f(yb(-w))}L${-w} ${f(yc(-w, -1))}L${w} ${f(yc(w, -1))}L${w} ${f(yb(w))}Z` + `M${-w} ${f(yc(-w, 1))}${curl}L${w} ${f(yc(w, 1))}Z` + bs, ' fill-rule="evenodd"');
  b += P('t-c', bs) + bind;
  s += `<g transform="translate(${cx} ${cy}) rotate(${A})">${b}</g>`;
  let fr = P('t-a', `M${-w} ${f(yb(-w))}${curl}L${w} ${f(yb(w))}Z` + slit(-17, yb(0) - 2), ' fill-rule="evenodd"');
  fr += P('t-c', slit(-17, yb(0) - 2)) + bind;
  s += `<g transform="translate(${cx} ${cy}) rotate(${-A}) scale(-1 1)">${fr}</g>`;
  // holes where skis and poles enter the snow
  const dx = (Yc - cy) * Math.tan(ra);
  s += E('t-b', cx - dx, Yc + .8, 4.4, 1.5) + E('t-b', cx + dx, Yc + .8, 4.4, 1.5);
  s += P('t-c', spark(32, 8, 3.6) + spark(7, 34, 2.6) + spark(57, 34, 2.6));
  add('skis', 'crossed skis and poles in snow', s);
}

// ---------- ice-skate
{
  let s = '';
  const lace = 'M30 9.5L35.4 9.5L36 25Q37 29 42.5 31L39.5 34.5Q33 32 31 27.5Z', toe = 'M47 35.2Q52 36 54.5 38.6Q55 39.8 53.8 39.5Q51 37.5 46.6 36.6Q46 35.4 47 35.2Z';
  // boot with the lace panel cut out
  s += P('t-a', 'M14.5 9Q14 5.5 17.5 5.5L35 4.5Q38 4.5 38 7.5L38.3 23Q38.8 28.5 45 30.5L52 33Q58 35.5 57.5 41Q57 45 52.5 45H17Q13.5 45 13.5 41.5L13.5 30Q13.5 20 14.5 9Z' + lace + toe, ' fill-rule="evenodd"');
  s += P('t-c', lace + toe);
  // shading: back seam, collar, sole
  s += P('t-b', 'M14.5 9Q13.5 20 13.5 30L13.5 41.5Q13.5 45 17 45H19Q17.5 44 17.5 41V30Q17.5 20 18.5 9Z');
  s += P('t-b', 'M14.6 8Q14.5 5.5 17.5 5.5L35 4.5Q38 4.5 38 7.5V9.5L14.5 10.5Z');
  s += P('t-b', 'M13.5 41.5H57.3Q57 45 52.5 45H17Q13.5 45 13.5 41.5Z');
  // laces: eyelets and criss-cross
  s += L('M30.6 12L35.6 15.5M30.6 15.5L35.6 12M31 19L35.8 22.5M31 22.5L35.8 19M32 26.5L37.5 29.5M33.8 29.5L37.8 26', 1.5);
  // heel, toe plate and stanchions
  s += P('t-b', 'M17 45H27V49H25L24 53H19.5L18.5 49H17Z');
  s += P('t-b', 'M40 45H53L51.5 48L50 53H44L42.5 48Z');
  // blade with toothed toe pick
  const bl = 'M11 53H53Q57.5 53 58 49L58.5 46.5H61.5Q61.5 49 60.5 50.5L62 51.5L60 52.5L61 54L58.8 54.5L59.2 56.2Q57 57 54 57H11Q9 57 9 55Q9 53 11 53Z';
  const hl = 'M13 54.6H52.5V55.4H13Z';
  s += P('t-b', bl + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  // ice scratches
  s += L('M5 61H22M27 61H33', 1.4);
  s += P('t-c', spark(41, 60.2, 3) + spark(50, 60.8, 2.2) + spark(7, 18, 3.4) + spark(51, 14, 4));
  add('ice-skate', 'figure skating boot with a toothed blade', s);
}

// ---------- surfboard
{
  let s = '';
  const A = 34, ra = A * Math.PI / 180, ux = Math.cos(ra), uy = -Math.sin(ra), nx = -uy, ny = ux;
  const cx = 25, cy = 37, off = 9, F = [cx + off * nx, cy + off * ny];
  const fp = t => `${f(F[0] + t * ux)} ${f(F[1] + t * uy)}`, t0 = (F[1] - 61.5) / -uy;
  // crest from the lip tip to the right edge; foam scallops bulge down into the wave
  const cr = [[42.5, 15.5], [45, 11.5], [49, 9], [53.5, 8.5], [58, 9.8], [62.5, 13]];
  const sc = (pts) => pts.slice(1).map((p, i) => { const a = pts[i], dx = p[0] - a[0], dy = p[1] - a[1], l = Math.hypot(dx, dy), k = 2.2 * Math.sign(dx);
    return `Q${f((a[0] + p[0]) / 2 - dy / l * k)} ${f((a[1] + p[1]) / 2 + dx / l * k)} ${f(p[0])} ${f(p[1])}`; }).join('');
  // wave: face the board rests against, rising into a curl whose lip throws left
  const face = `M${fp(t0)}L${fp(17)}Q52.5 25 53 20.5Q53.5 16 49 16Q45.5 16.5 42.5 15.5`;
  s += P('t-a', face + sc(cr) + 'V61.5Z');
  s += P('t-c', 'M42.5 15.5Q40.5 10 45 6.5Q50 3 56 3.5Q60.5 4 62.5 7V13' + sc(cr.slice().reverse()) + 'Z');
  s += P('t-b', `M${fp(t0)}L${fp(17)}Q52.5 25 53 20.5Q53.5 16 49 16Q55.5 17 55 22Q54.5 28 ${fp(14)}Z`);
  s += L('M44 54Q52 50 55 42M57 58Q61 55 62 50M34 59H40', 1.8);
  // board resting on the face, nose up-right toward the curl
  const bd = 'M-25 -4.5Q-27.3 0 -25 4.5C-14 8.6 8 9 26.5 0C8 -9 -14 -8.6 -25 -4.5Z';
  const hl = 'M4 -5.6C11 -5.2 15.5 -3.6 20.5 -1.5C14.5 -2.6 10 -3.6 4 -4.2Z';
  let g = P('t-b', 'M-13 7.4Q-15 12.5 -21.5 14Q-20 10.5 -20.5 7Z');
  g += P('t-a', bd + hl, ' fill-rule="evenodd"') + P('t-c', hl);
  g += P('t-b', 'M-25.3 -1.7C-10 -2 8 -1.7 22 0C8 1.7 -10 2 -25.3 1.7Z');
  s += `<g transform="translate(${cx} ${cy}) rotate(${-A})">${g}</g>`;
  s += P('t-c', spark(9, 14, 5) + spark(28, 7, 2.8) + circ(38, 9, 1.4) + circ(35, 4, 1.1) + circ(40.5, 3.5, .9));
  add('surfboard', 'surfboard riding a curling wave', s);
}

// ---------- rock-climber
{
  let s = '';
  // holds: irregular three-lobed blobs cut out of the rock, a shadow stroke along the lowest side
  const hp = (x, y, r, a, k) => { const v = [0, 1, 2].map(i => { const t = (a + i * 120) * Math.PI / 180, q = r * k[i]; return [x + q * Math.cos(t), y + q * Math.sin(t)]; });
    let d = `M${f(v[0][0])} ${f(v[0][1])}`, lo = -1, sh = '';
    v.forEach((p, i) => { const n = v[(i + 1) % 3], dx = n[0] - p[0], dy = n[1] - p[1], R = Math.round(Math.hypot(dx, dy) * .72), arc = `a${R} ${R} 0 0 1 ${f(dx)} ${f(dy)}`;
      d += arc; const mx = (p[0] + n[0]) / 2 - x, my = ((p[1] + n[1]) / 2 - y + .6 * mx) / Math.hypot(mx, (p[1] + n[1]) / 2 - y); if (my > lo) { lo = my; sh = `M${f(p[0])} ${f(p[1])}` + arc; } });
    return [d + 'z', sh]; };
  const H = [[45, 8.8, 3.4, 15, [1, .9, .8]], [13, 28.5, 3.1, 95, [.85, 1, .9]], [48.5, 46.8, 3.1, 25, [1, .8, .95]], [21, 56.5, 3.2, 35, [.9, 1, .8]],
    [21, 10, 2.8, 100, [1, .85, .9]], [12.5, 44.5, 2.6, 45, [.9, .8, 1]], [36, 55.5, 2.6, 85, [1, .9, .85]], [56.5, 54.5, 2.6, 20, [.85, 1, .9]]].map(h => hp(...h));
  const hs = H.map(h => h[0]).join('');
  s += P('t-a', 'M11 3.5L27 1L47 2L58.5 6.5L61.5 22L57.5 37L62 50L57.5 62.5H8.5L4 51L8 38.5L2.5 26L7.5 15Z' + hs, ' fill-rule="evenodd"');
  s += P('t-c', hs);
  s += L(H.map(h => h[1]).join(''), 1.4);
  s += P('t-b', 'M11 3.5L7.5 15L13.5 10L16 2.5ZM2.5 26L8 38.5L4 51L9.5 41.5ZM61.5 22L57.5 37L62 50L60 36.5Z');
  s += L('M27.5 2.5L30 6.5L28.5 9.5M8.5 62.5L12 58', 1.5);
  // quickdraw: bolt, carabiner, sling, carabiner; rope from the harness runs through the lower one
  const cb = (x, y, a, g) => { const t = a * Math.PI / 180, p = u => { u *= Math.PI / 180; const ex = 2.1 * Math.cos(u), ey = 3.2 * Math.sin(u); return `${f(x + ex * Math.cos(t) - ey * Math.sin(t))} ${f(y + ex * Math.sin(t) + ey * Math.cos(t))}`; };
    return `M${p(g + 22)}A2.1 3.2 ${a} 1 1 ${p(g - 22)}`; };
  s += C('t-b', 54, 6.8, 1.9);
  s += L(cb(54.6, 11.6, 12, -25) + cb(55.6, 23.4, -8, 205), 1.5);
  s += P('t-b', cap(55, 14.2, 55.4, 20.6, 2.6));
  s += L('M36.5 33Q47 31 55.6 26.6', 2);
  // climber seen from behind: helmet (rim cut as a thin line), head, torso, harness belt
  s += P('t-b', 'M28.6 15.4A5.4 5 0 0 1 39.4 15.4ZM28.6 16.2H39.4V16.8H37.6A4 4 0 1 1 30.4 16.8H28.6Z');
  s += P('t-b', 'M26.5 32V27.5A5 5 0 0 1 36.5 27.5V32ZM26.5 33.8H36.5V35.5Q36.5 38 34 38H29Q26.5 38 26.5 35.5Z');
  s += R('t-c', 26.5, 32, 10, 1.8);
  s += L('M35.5 25L41.5 17L44.5 10M28 25.5L20.5 23.5L14 27.5', 3.8);
  s += L('M33.5 36L42 40L46.5 45M29 37L24.5 46L21 54.5', 4.6);
  add('rock-climber', 'climber on a rock wall with holds', s.replace(/ -/g, '-').replace(/([^\d])0\./g, '$1.'));
}

// ---------- golf-flag
{
  let s = '';
  // putting green with the ball cut out of it
  const ball = circ(21, 49.5, 6);
  s += P('t-a', 'M3 50.5C3 43 16 38.5 32 38.5C48 38.5 61 43 61 50.5C61 58 48 62 32 62C16 62 3 58 3 50.5Z' + ball, ' fill-rule="evenodd"');
  s += P('t-b', 'M3 50.5C3 58 16 62 32 62C48 62 61 58 61 50.5C59 55.5 47 58.5 32 58.5C17 58.5 5 55.5 3 50.5Z');
  s += L('M45 42.5Q52 43.5 55 46M8 47Q10 44.5 14 43', 1.4);
  // hole and pole
  s += E('t-b', 39, 49.5, 5.2, 2);
  s += R('t-b', 37.9, 4.5, 2.2, 45, 1.1);
  s += C('t-b', 39, 4.5, 2);
  // pennant flag waving to the right
  const hl = 'M42.5 9.4Q48.5 7.8 54.5 10.6Q48.5 10.5 42.5 11.8Z';
  s += P('t-a', 'M40 6.5C47 3.5 53 10.5 62 12C55 15.5 49 16.5 45 21Q42.5 23.8 40 25.5Z' + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', 'M40 17.5Q46.5 18.5 52.5 16C49.5 17.5 47 18.8 45 21Q42.5 23.8 40 25.5Z');
  // dimpled ball
  s += P('t-c', ball);
  s += P('t-a', 'M24.5 44.6A6 6 0 1 1 16.1 53A6 6 0 0 0 24.5 44.6Z');
  s += P('t-a', circ(19, 46.8, .8) + circ(22.5, 46.3, .8) + circ(20.6, 49.6, .8) + circ(24, 49.4, .8) + circ(17.6, 50, .8));
  s += P('t-c', spark(14, 16, 5) + spark(26, 29, 3) + spark(55, 33, 3.4));
  add('golf-flag', 'golf flag on a putting green', s);
}
// ---------- hockey-stick
{ let s = '';
  // pale ice patch with two cut-out shine streaks
  s += P('t-c', 'M3 43C3 32 16 25 33 25C50 25 61 32 61 43C61 54 49 61.5 32 61.5C15 61.5 3 54 3 43Z' + 'M45.5 36.5L50.5 30.2L52.5 30.2L47.5 36.5Z' + 'M51 37.5L54.5 33.2L56.3 33.2L52.8 37.5Z', ' fill-rule="evenodd"');
  // stick: shaft from top-left down to the heel, blade running right with an upturned toe
  const stick = rpoly([[6, 8], [12.3, 4], [38.5, 41], [53, 41.5], [58.5, 38.5], [61, 41], [58.5, 48.5], [35.5, 50], [31.5, 47.5]], [2.5, 2.5, 3, 4, 2.5, 2, 4, 3, 2]);
  s += P('t-a', stick);
  // shaded right edge of the shaft
  s += P('t-b', 'M12.3 4L38.5 41L36 41.5L10.6 5.3Z');
  // blade underside shade
  s += P('t-b', 'M36 47.6Q46 47.6 59.5 45.4L58.5 48.5Q57.8 49.4 56.3 49.5L35.5 50Q33.6 50 32.3 48.7L31.5 47.6Z');
  // tape wrapped round the blade
  let tape = '';
  for (let i = 0; i < 5; i++) { const x = 39.5 + i * 3.6; tape += `M${f(x)} 41.6L${f(x + 2.2)} 41.6L${f(x + 1.2)} 48.4L${f(x - 1)} 48.6Z`; }
  s += P('t-b', tape);
  // grip tape at the top of the shaft
  let grip = '';
  for (let i = 0; i < 3; i++) { const t = .03 + i * .045, x = 6.5 + t * 25, y = 7.5 + t * 40; grip += `M${f(x - .2)} ${f(y + .3)}L${f(x + 5.3)} ${f(y - 3.2)}L${f(x + 6.4)} ${f(y - 1.4)}L${f(x + .9)} ${f(y + 2.1)}Z`; }
  s += P('t-b', grip);
  // shaft highlight
  s += P('t-c', 'M8.6 9.8L27 38.5L26 39.2L7.6 10.5Z');
  // rubber puck with a cut highlight rim
  s += P('t-b', 'M5 47.5V52C5 54.8 9.5 57 15 57C20.5 57 25 54.8 25 52V47.5C25 50.4 20.5 52.6 15 52.6C9.5 52.6 5 50.4 5 47.5Z' + 'M5 46.6C5 43.8 9.5 41.6 15 41.6C20.5 41.6 25 43.8 25 46.6C25 49.4 20.5 51.6 15 51.6C9.5 51.6 5 49.4 5 46.6Z');
  s += P('t-c', 'M8.6 45.2Q11.5 43.4 16 43.4Q14.2 44.2 13 45.4Q10.8 45 8.6 45.2Z');
  // sparkles
  s += P('t-a', spark(52, 12, 4.5) + spark(41, 7, 2.5) + spark(59, 22, 2.2));
  add('hockey-stick', 'taped hockey stick and puck on ice', s); }

// ---------- boxing-gloves
{ let s = '', g = '';
  // one glove in local coords (cuff on top, thumb on the inner side); the right one is mirrored
  const glint = 'M-6.5 1.5Q-4 -1.2 0 -1.2Q-3.5 0.6 -5 3.6Z';
  g += P('t-a', 'M8.5 -1.5C13.5 -2 16 3 15 8.5C14.3 12.5 11.5 13.5 9.5 12Z');
  g += P('t-a', 'M-9.5 -6C-13 0 -14 8 -13 14.5C-12 21.5 -6 25 0.5 25C7 25 11.5 21 11.5 14C11.5 8 10.8 2 9.5 -6Z' + glint, ' fill-rule="evenodd"');
  g += P('t-c', glint);
  // outer shade, curled-finger fold and thumb seam
  g += P('t-b', 'M-9.5 -6C-13 0 -14 8 -13 14.5C-12 21.5 -6 25 0.5 25C-4.5 23 -8.6 19 -9.5 13C-10.3 7 -9.6 0 -7 -6Z');
  g += P('t-b', 'M-10.5 12.5Q0 18.5 11.4 12Q11.5 14.2 11.2 15.4Q0 21 -10 15Z');
  g += P('t-b', 'M9.8 -1.6Q11.4 5 9.6 12.2L11 12.8Q12.8 5 11.3 -1.6Z');
  // white cuff with lacing and a dark band
  g += R('t-c', -9, -20, 18, 14, 2.2);
  g += R('t-b', -9.8, -7.5, 19.6, 3, 1.4);
  g += L('M-2.6 -18L2.6 -14.5M2.6 -18L-2.6 -14.5M-2.6 -13.5L2.6 -10M2.6 -13.5L-2.6 -10', 1.3);
  s += `<g transform="translate(17.5 35) rotate(12)">${g}</g><g transform="translate(46.5 35) rotate(-12) scale(-1 1)">${g}</g>`;
  // laces looped over a nail
  s += L('M18.9 15.2L32 5.5L24.4 16.4M45.1 15.2L32 5.5L39.6 16.4', 1.6);
  s += C('t-b', 32, 5, 2.4);
  s += P('t-a', spark(8, 9, 4) + spark(57, 8, 3) + spark(55.5, 19, 1.8));
  add('boxing-gloves', 'pair of boxing gloves hanging by laces', s); }

// ---------- gymnast
{ let s = '';
  // tapered limb: round end of radius a at (x1,y1) narrowing to radius b at (x2,y2)
  const tp = (x1, y1, a, x2, y2, b) => {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, k = (a - b) / l, q = Math.sqrt(1 - k * k);
    const n1 = [ux * k - uy * q, uy * k + ux * q], n2 = [ux * k + uy * q, uy * k - ux * q];
    return `M${f(x1 + a * n1[0])} ${f(y1 + a * n1[1])}L${f(x2 + b * n1[0])} ${f(y2 + b * n1[1])}A${f(b)} ${f(b)} 0 0 0 ${f(x2 + b * n2[0])} ${f(y2 + b * n2[1])}L${f(x1 + a * n2[0])} ${f(y1 + a * n2[1])}A${f(a)} ${f(a)} 0 1 0 ${f(x1 + a * n1[0])} ${f(y1 + a * n1[1])}Z`;
  };
  // ribbon: one loose loop off the stick, then an S-shaped tail along the bottom (behind the figure)
  s += L('M11.5 11C5 6 2 14 3.5 22C5 30 9 35 8.5 42C8 48.5 7.5 55 13.5 58C19.5 61 25.5 55.5 22.5 50C19.5 44.5 11 47 12.5 53C14 59 24 60.5 32 56.5C39 53 46 51 54 57', 2.4);
  // legs in a mid-air split
  s += P('t-a', tp(30, 40.5, 4.2, 6.5, 35, 2.4) + tp(34, 40, 4.2, 58.5, 35, 2.4));
  // leotard over the torso and hips
  s += P('t-b', rpoly([[30, 22.5], [42, 23.5], [39.3, 32], [39.5, 40], [33, 44.5], [26.5, 40.5], [28.8, 32]], [3, 3, 2, 2, 2, 2, 2]));
  // arms in a V: back arm up and back to the ribbon stick, front arm raised forward
  s += P('t-a', cap(33, 26, 19.5, 17, 6.2) + cap(39.5, 26, 53, 13.5, 6.2));
  s += P('t-b', cap(19, 16.5, 11.5, 11, 2.4));
  // head with a hair bun, cut highlight and shade
  const gl = 'M29.1 11.5A6 6 0 0 1 33.5 6L33.9 7.4A4.6 4.6 0 0 0 30.5 11.6Z';
  s += P('t-a', circ(35.5, 12, 7) + circ(27.5, 7.5, 3) + gl, ' fill-rule="evenodd"');
  s += P('t-c', gl);
  s += P('t-b', 'M41.7 8.5A7 7 0 0 1 31.1 17.5A8 8 0 0 0 41.7 8.5Z');
  s += P('t-a', spark(57, 26, 3.6) + spark(49.5, 5, 2.2) + spark(57.5, 46, 2.6));
  add('gymnast', 'gymnast leaping with a swirling ribbon', s); }

// ---------- archery-target
{ let s = '';
  const cx = 29, cy = 28, a = -40 * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, w = 2.1;
  const pt = (r, sg) => { const t = Math.sqrt(Math.max(r * r - w * w, 0)); return `${f(cx + t * ux + sg * w * nx)} ${f(cy + t * uy + sg * w * ny)}`; };
  // ring as an annulus with a channel cut along the arrow, so the shaft reads over every ring
  const ring = (r1, r2) => `M${pt(r2, 1)}A${r2} ${r2} 0 1 1 ${pt(r2, -1)}` + (r1 ? `L${pt(r1, -1)}A${r1} ${r1} 0 1 0 ${pt(r1, 1)}Z` : `L${f(cx - w * nx)} ${f(cy - w * ny)}L${f(cx + w * nx)} ${f(cy + w * ny)}Z`);
  // wooden easel: two splayed front legs and a back leg, hidden where the target covers them
  const legs = (ax, ay, bx, by, wd) => { const dx = bx - ax, dy = by - ay, ex = ax - cx, ey = ay - cy, A = dx * dx + dy * dy, B = 2 * (ex * dx + ey * dy), Cq = ex * ex + ey * ey - 22.2 * 22.2, D = Math.sqrt(B * B - 4 * A * Cq), t1 = (-B - D) / (2 * A), t2 = (-B + D) / (2 * A);
    return cap(ax, ay, ax + t1 * dx, ay + t1 * dy, wd) + cap(ax + t2 * dx, ay + t2 * dy, bx, by, wd); };
  s += P('t-b', legs(29, 3.5, 29, 58, 3.4));
  s += P('t-a', legs(26.5, 2.8, 8.5, 60.5, 4.2) + legs(31.5, 2.8, 49.5, 60.5, 4.2));
  s += P('t-b', cap(9.8, 56, 8.5, 60.5, 1.3) + cap(48.2, 56, 49.5, 60.5, 1.3));
  // target face on a thick straw boss: rim, white, black, blue, red, yellow
  s += P('t-b', ring(20.2, 23.4));
  s += P('t-c', ring(16.4, 20.2));
  s += P('t-b', ring(12.4, 16.4));
  s += P('t-a', ring(8.4, 12.4));
  s += P('t-b', ring(4.4, 8.4));
  s += P('t-c', ring(0, 4.4));
  // ledge, with a cut-out highlight
  s += P('t-b', rpoly([[6, 49.5], [52, 49.5], [52, 53.7], [6, 53.7]], 1.6) + 'M9 50.6H49V51.5H9Z', ' fill-rule="evenodd"');
  // arrow stuck in the bullseye, fletching up and to the right
  const tip = r => [cx + r * ux, cy + r * uy];
  const [t0x, t0y] = tip(1.2), [t1x, t1y] = tip(33.5);
  s += P('t-b', cap(t0x, t0y, t1x, t1y, 2.2));
  let fl = '';
  for (const sg of [1, -1]) { const p = (r, o) => `${f(cx + r * ux + sg * o * nx)} ${f(cy + r * uy + sg * o * ny)}`;
    fl += `M${p(25.5, 1)}L${p(29.5, 4.4)}L${p(34.5, 4.4)}L${p(31.5, 1)}Z`; }
  s += P('t-a', fl);
  s += P('t-a', spark(57, 30, 4) + spark(53, 43, 2.4) + spark(6, 7, 2.6));
  add('archery-target', 'archery target on an easel with an arrow', s); }

// ---------- playing-cards
{ let s = '';
  const px = 32, py = 47, w = 23, h = 38, off = -1, gap = 2.2, ang = [-33, -11, 11, 33];
  const loc = (x, y, t) => { const r = t * Math.PI / 180, c = Math.cos(r), n = Math.sin(r); return [px + x * c - y * n, py + x * n + y * c]; };
  // each card is clipped against the cards in front of it, so no card shows through another
  const clip = (poly, t) => { const r = t * Math.PI / 180, v = q => (q[0] - px) * Math.cos(r) + (q[1] - py) * Math.sin(r) + w / 2 + gap, out = [];
    poly.forEach((a, i) => { const b = poly[(i + 1) % poly.length], va = v(a), vb = v(b);
      if (va < 0) out.push(a); if ((va < 0) !== (vb < 0)) { const k = va / (va - vb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } });
    return out; };
  const heart = 'M0 .9C-.45 .5-1 .1-1-.35C-1-.75-.7-1-.45-1C-.2-1-.05-.85 0-.65C.05-.85 .2-1 .45-1C.7-1 1-.75 1-.35C1 .1 .45 .5 0 .9Z';
  const spade = 'M0-1C-.45-.55-1-.2-1 .2C-1 .55-.75 .75-.45 .75C-.25 .75-.1 .65-.05 .5L-.25 1H.25L.05 .5C.1 .65 .25 .75 .45 .75C.75 .75 1 .55 1 .2C1-.2 .45-.55 0-1Z';
  const diamond = 'M0-1Q.35-.45 .72 0Q.35 .45 0 1Q-.35 .45-.72 0Q-.35-.45 0-1Z';
  const club = circ(0, -.5, .42) + circ(-.5, .15, .42) + circ(.5, .15, .42) + 'M-.12 0L-.32 1H.32L.12 0Z';
  const pips = [[heart, 't-a'], [spade, 't-b'], [diamond, 't-a'], [club, 't-b']];
  ang.forEach((t, i) => {
    let poly = [[-w / 2, -h], [w / 2, -h], [w / 2, 0], [-w / 2, 0]].map(([x, y]) => loc(x, y + off, t));
    for (let j = i + 1; j < ang.length; j++) poly = clip(poly, ang[j]);
    const d = rpoly(poly, 2.6); s += P('t-c', d) + L(d, 1.3);
    const front = i === ang.length - 1, sc = front ? 6.8 : 3.9, [cx, cy] = front ? [0, -h / 2 + off] : [-w / 2 + 5.6, -h + off + 6.4];
    s += `<g transform="rotate(${t} ${px} ${py}) translate(${f(px + cx)} ${f(py + cy)}) scale(${sc})">${P(pips[i][1], pips[i][0])}</g>`;
  });
  s += P('t-a', spark(11, 57, 3.4) + spark(53, 57, 3.4) + spark(32, 59.5, 2.4));
  add('playing-cards', 'fanned hand of four suit cards', s); }
// ---------- jigsaw-piece
{
  let s = '';
  // piece outline: square at (x,y) size z, edges [top,right,bottom,left]: 1 tab, -1 blank, 0 flat; rotated a deg about (ox,oy)
  const KN = [[[.38, 0]], [[.44, 0], [.45, .05], [.42, .09]], [[.37, .19], [.42, .28], [.5, .28]], [[.58, .28], [.63, .19], [.58, .09]], [[.55, .05], [.56, 0], [.62, 0]], [[1, 0]]];
  const rot = (p, a, ox, oy) => { const c = Math.cos(a * Math.PI / 180), n = Math.sin(a * Math.PI / 180), dx = p[0] - ox, dy = p[1] - oy; return [ox + dx * c - dy * n, oy + dx * n + dy * c]; };
  const jig = (x, y, z, ed, a = 0, ox = 0, oy = 0) => {
    const cs = [[x, y], [x + z, y], [x + z, y + z], [x, y + z]]; const T = p => { const q = rot(p, a, ox, oy); return `${f(q[0])} ${f(q[1])}`; };
    let d = 'M' + T(cs[0]);
    for (let i = 0; i < 4; i++) {
      const p0 = cs[i], p1 = cs[(i + 1) % 4], dx = (p1[0] - p0[0]) / z, dy = (p1[1] - p0[1]) / z, k = ed[i];
      const m = ([t, h]) => [p0[0] + dx * t * z + dy * h * z * k, p0[1] + dy * t * z - dx * h * z * k];
      if (!k) { d += 'L' + T(p1); continue; }
      for (const seg of KN) d += (seg.length === 1 ? 'L' : 'C') + seg.map(pt => T(m(pt))).join(' ');
    }
    return d + 'Z';
  };
  const band = (x, y, z, w, a = 0, ox = 0, oy = 0) => 'M' + [[x, y + z - w], [x + z, y + z - w], [x + z, y + z], [x, y + z]].map(p => rot(p, a, ox, oy).map(f).join(' ')).join('L') + 'Z';
  // piece A (resting, left); the part of it under piece B is cut out so B stays clean in the one-colour tint
  const hl = 'M5.5 37Q5.5 33.5 9 33.5H13Q10.5 34.5 9 36Q7 37.8 5.5 40.3Z';
  const under = 'M31.1 30.5L33.5 30.5L33.5 42.5L33.4 43.2L33.1 43.6L32.8 43.9L32.3 44L31.5 43.9L29.9 43.2L30.7 43.1L31.2 42.9L31.5 42.4L31.5 41.7L28.1 31.6Z';
  s += P('t-a', jig(2.5, 30.5, 31, [1, -1, 0, -1]) + hl + under, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', band(2.5, 30.5, 31, 4.5));
  // piece B, lifted and tilted, its knob over A's socket (pivot = knob centre); shadow it casts down-left onto A
  s += P('t-b', 'M28.4 32.7L31.5 41.5L31.5 42L31.4 42.6L31 43L30.6 43.2L29.9 43.2L29.4 43L29.3 42.9L26.1 33.6ZM24.9 45.4L24.8 46.2L25 47L25.3 47.6L25.8 48.2L26.4 48.6L27.1 49L28 49.1L28.9 49L28.9 49.1L28.4 49.6L27.6 50.1L26.4 50.5L25.6 50.6L25 50.5L24.4 50.2L24 49.9L23.5 49.3L23.3 48.8L23.2 48.3L23.2 47.6L23.4 46.9L23.7 46.3L24.2 45.8ZM31.8 48L32.4 48L32.9 48.2L33.2 48.6L33.4 49.1L33.5 55.1L31.5 49.2L31.2 48.8L30.8 48.4L31.2 48.2Z');
  const a = -19, ox = 27.61, oy = 46;
  s += P('t-c', jig(32.74, 32.5, 27, [-1, 0, 0, 1], a, ox, oy));
  s += P('t-b', band(32.74, 32.5, 27, 4.5, a, ox, oy));
  s += P('t-c', spark(11, 12, 4.8) + spark(49, 9, 3.8) + spark(29, 6.5, 2.4));
  add('jigsaw-piece', 'two interlocking jigsaw pieces', s);
}

// ---------- printer
{
  let s = '';
  const eo = ' fill-rule="evenodd"';
  // paper tray standing up at the back
  s += P('t-b', rpoly([[13, 12], [51, 12], [53, 23], [11, 23]], [2.5, 2.5, 0, 0]) + 'M17 12H47V21H17Z', eo);
  s += P('t-c', 'M17 3.5H47V21H17Z');
  s += L('M21 9H38M21 13.5H43', 1.6);
  // body, with the sheet, highlight and buttons cut out so they stay light in the tint
  const hl = 'M8 26Q8 25 9 25H30Q22 26 10 29.5Q8 30 8 29Z';
  s += P('t-a', 'M9.5 22H54.5Q60 22 60 27.5V43.5Q60 49 54.5 49H9.5Q4 49 4 43.5V27.5Q4 22 9.5 22Z' + hl + 'M15 37.5H49L50.7 49H13.3Z', eo);
  s += P('t-c', hl);
  s += P('t-b', 'M4 42H60V43.5Q60 49 54.5 49H9.5Q4 49 4 43.5ZM14.3 42H49.7L50.7 49H13.3Z', eo);
  s += P('t-b', 'M43 26.5H54Q56 26.5 56 28.5V30.5Q56 32.5 54 32.5H43Q41 32.5 41 30.5V28.5Q41 26.5 43 26.5Z' + circ(45, 29.5, 1.5) + circ(50.5, 29.5, 1.5), eo);
  s += C('t-c', 45, 29.5, 1.5) + C('t-c', 50.5, 29.5, 1.5);
  // output slot and sheet sliding out
  s += P('t-b', 'M13.5 35H50.5Q53 35 53 37.5Q53 40 50.5 40H13.5Q11 40 11 37.5Q11 35 13.5 35ZM15 37.5H49L49.4 40H14.6Z', eo);
  s += P('t-c', 'M15 37.5H49L52.5 61H11.5Z');
  // the picture: sun over hills
  s += C('t-a', 23.5, 47, 4.6);
  s += P('t-a', [0, 45, 90, 135, 180, 225, 270, 315].map(d => { const r = d * Math.PI / 180, c = Math.cos(r), n = Math.sin(r); return cap(23.5 + 6.6 * c, 47 + 6.6 * n, 23.5 + 8.4 * c, 47 + 8.4 * n, 1.6); }).join(''));
  s += P('t-b', 'M12.4 55Q21 49.5 29.5 54Q38.5 47.5 51.7 54.5L52.5 61H11.5Z');
  s += P('t-c', spark(58, 10, 4) + spark(6, 12, 3));
  add('printer', 'desktop printer printing a sunny picture', s);
}

// ---------- drone
{
  let s = '';
  const rotors = [[18, 18, 10, 3.8], [46, 18, 10, 3.8], [11.5, 37, 10.5, 4.5], [52.5, 37, 10.5, 4.5]];
  // motors under the rotors
  s += P('t-b', rotors.map(([x, y, rx]) => `M${f(x - 2.4)} ${f(y)}h${f(4.8)}v${f(rx * .5)}a2.4 1.2 0 0 1 -4.8 0Z`).join(''));
  // body and arms as one shape (all counter-clockwise), top highlight cut out clockwise
  const body = rpoly([[22.5, 30], [26, 37], [38, 37], [41.5, 30], [37.5, 24.5], [26.5, 24.5]], 3);
  const hl = 'M28 26.5H36Q31 27.5 27.5 30.5L26.2 29.6Z';
  s += P('t-a', body + cap(32, 30, 18, 18, 4) + cap(32, 30, 46, 18, 4) + cap(30, 32, 11.5, 37, 5) + cap(34, 32, 52.5, 37, 5) + hl);
  s += P('t-c', hl);
  s += P('t-b', rpoly([[23.6, 32.2], [26, 37], [38, 37], [40.4, 32.2]], [0, 2.5, 2.5, 0]));
  s += C('t-c', 32, 34.4, 1);
  // rotor blurs
  for (const [x, y, rx, ry] of rotors) {
    s += E('t-c', x, y, rx, ry);
    s += P('t-a', cap(x - rx * .66, y + ry * .42, x + rx * .66, y - ry * .42, 1.9));
    s += E('t-b', x, y, 2.2, 1.2);
  }
  // camera on a gimbal underneath
  s += P('t-b', cap(32, 36, 32, 41, 3.2) + 'M25.5 42.5Q25.5 40 28 40H36Q38.5 40 38.5 42.5V47H36.4V43Q36.4 42.1 35.5 42.1H28.5Q27.6 42.1 27.6 43V47H25.5Z');
  s += C('t-a', 32, 47, 5.6);
  const gl = circ(30.8, 45.8, 1.1);
  s += P('t-b', circ(32, 47.3, 3.3) + gl, ' fill-rule="evenodd"');
  s += P('t-c', gl);
  s += P('t-c', spark(32, 7, 4) + spark(56, 52, 3.4) + spark(7, 51, 2.6));
  add('drone', 'quadcopter drone with a hanging camera', s);
}

// ---------- smartwatch
{
  let s = '';
  const eo = ' fill-rule="evenodd"';
  // silicone strap, with holes punched in the lower half
  s += P('t-b', 'M20 14.5L21.8 3.5Q22 1.5 24 1.5H40Q42 1.5 42.2 3.5L44 14.5ZM20 49.5L21.8 60.5Q22 62.5 24 62.5H40Q42 62.5 42.2 60.5L44 49.5Z' + circ(32, 55.5, 1.6) + circ(32, 60, 1.4), eo);
  s += R('t-b', 50, 25, 5, 9, 2);
  // case, screen cut out
  const scr = 'M24 17H40Q47 17 47 24V40Q47 47 40 47H24Q17 47 17 40V24Q17 17 24 17Z';
  s += P('t-a', 'M23 13H41Q51 13 51 23V41Q51 51 41 51H23Q13 51 13 41V23Q13 13 23 13Z' + scr, eo);
  s += P('t-b', 'M51 30V41Q51 51 41 51H23Q15 51 13.4 44Q15.5 48 23 48H41Q48 48 48 41V30Z');
  s += P('t-c', 'M15.5 22Q15.5 15.5 22 15.5H28Q20 16.5 15.5 27Z');
  s += P('t-c', scr);
  // heart and heartbeat
  const gl = 'M27.3 23.3Q25.5 24.6 26.2 27Q27 25 28.8 24.2Z';
  s += P('t-a', 'M32 34.5C24.5 29.5 23.5 25 25.8 22.6C27.8 20.6 30.6 21.2 32 23.6C33.4 21.2 36.2 20.6 38.2 22.6C40.5 25 39.5 29.5 32 34.5Z' + gl, eo);
  s += P('t-c', gl);
  s += L('M19.5 40.5H24.5L26.8 37L29.8 44.2L33.4 35.8L35.8 40.5H44.5', 2);
  s += P('t-c', spark(8, 10, 4) + spark(57, 56, 3.6) + spark(56, 9, 2.4));
  add('smartwatch', 'smartwatch showing a heart and heartbeat', s);
}

// ---------- vr-headset
{
  let s = '';
  const eo = ' fill-rule="evenodd"';
  // head strap: a band round the back of the head, leaving both ends of the box (only the part not behind it)
  s += P('t-b', 'M29.9 10L33.9 10.1L37.7 10.5L41.3 11.1L44.8 12.1L48.4 13.4L51 14.8L53.6 16.4L55.9 18.3L57.6 20.2L59 22.3L60 24.6L60.3 26L60.5 27.1L60.4 29.6L59.9 31.8L58.8 34.1L57.4 36L57.4 28.9L57.2 27.7L57 27.1L56.2 25.6L55.4 24.8L54.8 24.4L54.1 23.3L53.5 22.5L52.6 21.6L51.4 20.5L49.5 19.3L47.4 18.1L45 17.1L42.1 16.2L39.2 15.5L36.4 15.1L33.4 14.9L30 14.8L27.1 15L24.2 15.3L21.2 15.9L18.5 16.6L16.2 17.4L13.6 18.6L11.3 20L10 21.1L9 22L7.9 23.3L7.1 24.8L6.6 25.9L6.3 27.6L6.4 29.4L7 31.1L7.8 32.5L6.6 33.6L5.8 34.7L5.4 35.5L5.1 36.6L3.4 34.4L2.3 32.1L1.9 30.8L1.6 29.6L1.5 27.5L1.9 25.2L2.6 23.2L3.9 20.8L5.5 18.9L7.8 16.9L10 15.3L12.6 13.9L15.8 12.6L19.3 11.5L22.8 10.7L26.5 10.2Z');
  // padded face cushion: a thick rim peeking out round the back edge of the box
  s += P('t-c', 'M12.6 27.6L15 25.2A5.5 5.5 0 0 1 18.9 23.6L51.9 23.6A5.5 5.5 0 0 1 57.4 29.1L57.4 39.1A5.5 5.5 0 0 1 55.8 43L53.4 45.4A5.5 5.5 0 0 0 55 41.5L55 31.5A5.5 5.5 0 0 0 49.5 26L16.5 26A5.5 5.5 0 0 0 12.6 27.6Z');
  // goggle box in three-quarter view: shell, side face in shade, glossy visor with a reflection streak cut out
  s += P('t-a', 'M6.6 33.6L12.6 27.6A5.5 5.5 0 0 1 16.5 26L49.5 26A5.5 5.5 0 0 1 55 31.5L55 41.5A5.5 5.5 0 0 1 53.4 45.4L47.4 51.4A5.5 5.5 0 0 1 43.5 53L10.5 53A5.5 5.5 0 0 1 5 47.5L5 37.5A5.5 5.5 0 0 1 6.6 33.6Z');
  s += P('t-b', 'M49 37.5L55 31.5L55 41.5A5.5 5.5 0 0 1 53.4 45.4L47.4 51.4A5.5 5.5 0 0 0 49 47.5Z');
  const gl = 'M9.5 43Q9.5 36.5 16 36.5H30Q16 38 9.5 43Z';
  s += P('t-b', 'M15.5 34H38.5A8.5 8.5 0 0 1 47 42.5V42.5A8.5 8.5 0 0 1 38.5 51H15.5A8.5 8.5 0 0 1 7 42.5V42.5A8.5 8.5 0 0 1 15.5 34Z' + gl, eo);
  s += P('t-c', gl);
  s += P('t-c', spark(6, 7, 3.8) + spark(58, 7, 3.2) + spark(57, 58, 3.4) + spark(7, 59, 2.2));
  add('vr-headset', 'virtual-reality headset with a head strap', s);
}
// ---------- cruise-ship
{
  let s = '';
  // funnel (behind decks), red top
  s += P('t-a', rpoly([[23.5, 14], [21.5, 3.5], [30.5, 3.5], [33, 14]], 1.2));
  s += P('t-b', rpoly([[22.4, 8.5], [21.5, 3.5], [30.5, 3.5], [31.4, 8.5]], [0, 1.2, 1.2, 0]));
  // decks, stepping back toward the stern
  s += P('t-a', rpoly([[16, 20], [16, 13], [37, 13], [42.5, 20]], 1));
  s += P('t-a', rpoly([[12, 27], [12, 19.5], [44, 19.5], [49.5, 27]], 1));
  s += P('t-a', rpoly([[8, 34.5], [8, 26.5], [50, 26.5], [56, 34.5]], 1));
  // window rows
  let w = '';
  for (let x = 19; x < 34; x += 4) w += `M${x} 15h2.5v2.8h-2.5Z`;
  w += 'M35 15H37.5L39.5 17.8H35Z';
  for (let x = 15; x < 44; x += 4) w += `M${x} 22h2.5v2.8h-2.5Z`;
  for (let x = 11; x < 50; x += 4) w += `M${x} 29h2.5v2.8h-2.5Z`;
  s += P('t-b', w);
  // hull with portholes cut out
  let ph = '';
  for (let x = 10; x < 54; x += 5.4) ph += circ(x, 39.3, 1.5);
  s += R('t-c', 8.3, 37.7, 46.6, 3.2);
  s += P('t-a', 'M3 34H62L55.2 48.5Q54.3 51 51.5 51H9Q6 51 5.3 48Z' + ph, ' fill-rule="evenodd"');
  s += P('t-b', 'M4.4 43.5H57.5L55.2 48.5Q54.3 51 51.5 51H9Q6 51 5.3 48Z');
  s += R('t-b', 3, 34, 59, 1.6);
  // waves
  s += P('t-b', 'M2 54Q5.8 51.5 9.5 54T17 54T24.5 54T32 54T39.5 54T47 54T54.5 54T62 54V57.5Q58.3 60 54.5 57.5T47 57.5T39.5 57.5T32 57.5T24.5 57.5T17 57.5T9.5 57.5T2 57.5Z');
  s += L('M5 61Q9 58.5 13 61T21 61M29 61Q33 58.5 37 61T45 61', 1.8);
  s += P('t-c', spark(51, 9, 4.5) + spark(9, 13, 3));
  add('cruise-ship', 'passenger cruise ship on the waves', s);
}

// ---------- service-bell
{
  let s = '';
  // counter: lit top edge, dark front
  s += R('t-a', 1, 51.8, 62, 4, 1);
  s += R('t-b', 1, 54.5, 62, 6.5, 1.5);
  // room tag with a cut string hole, tied to the key
  s += P('t-a', circ(54.5, 29, 8) + circ(54.5, 34.6, 1.3), ' fill-rule="evenodd"');
  s += `<circle class="ln" cx="54.5" cy="28.3" r="4.2" stroke-width="1.4"/>`;
  s += L('M54.5 36Q54.5 39 51.5 39.8', 1.3);
  // key lying on the counter
  s += P('t-a', circ(49.8, 44.5, 4.6) + circ(49.8, 44.5, 1.9) + 'M54 43H62.5V46.2H61.8V50.3H59.1V46.2H58.4V49H56V46.2H54Z', ' fill-rule="evenodd"');
  // bell base
  const slot = 'M6.8 47H41.2Q42 47 42 47.8Q42 48.5 41.2 48.5H6.8Q6 48.5 6 47.8Q6 47 6.8 47Z';
  s += P('t-b', rpoly([[2.5, 44], [45.5, 44], [45.5, 51.5], [2.5, 51.5]], 2) + slot, ' fill-rule="evenodd"');
  s += P('t-c', slot);
  // dome with highlight cut out
  const hl = 'M9 40Q9.5 29.5 18 25.6Q12.3 31.5 12.2 40Z';
  s += P('t-a', 'M5.5 43A18.5 18.5 0 0 1 42.5 43Z' + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', 'M32.5 27.5A18.5 18.5 0 0 1 42.5 43H37Q37 32.5 32.5 27.5Z');
  s += R('t-a', 3.5, 41.5, 41, 4, 1.8);
  // push button
  s += R('t-b', 22.3, 18.5, 3.4, 7, .8);
  s += E('t-a', 24, 17.5, 6.5, 2.5);
  s += E('t-b', 26.3, 18.3, 4.2, 1.4);
  // ding
  s += L('M12 13L8.5 9.5M9.5 19H4.5M36 13L39.5 9.5M38.5 19H43.5', 2);
  s += P('t-c', spark(55, 13, 5) + spark(5, 30, 2.6));
  add('service-bell', 'hotel reception bell and a room key', s);
}

// ---------- passport
{
  let s = '';
  // back cover peeking under the page block
  // back cover edge and the page block, both only where the lifted cover leaves them visible
  s += P('t-b', 'M36.8 57H53.5V9.5H54Q56 9.5 56 11.5V57.5Q56 59.5 54 59.5H36.8Z');
  s += P('t-a', 'M36.8 7H51.5Q53.5 7 53.5 9V55Q53.5 57 51.5 57H36.8Z');
  s += L('M40 48.5H50M40 52H47', 1.2);
  // inked entry stamps on the visible page
  s += `<circle class="ln" cx="45.5" cy="35" r="6.6" stroke-width="1.8"/><circle class="ln" cx="45.5" cy="35" r="4" stroke-width="1"/>`;
  s += P('t-b', rpoly(star(45.5, 35, 2.6, 1.1), .3));
  s += L(rpoly([[39.5, 13.5], [50.5, 11.5], [52, 20], [41, 22]], 1.5) + 'M42.5 17.3L48.8 16.2', 1.4);
  // front cover lifted open on its spine, globe emblem cut out
  const g = circ(22.5, 27, 8);
  const bars = 'M15 44H30V46H15ZM17.5 48.5H27.5V50H17.5Z';
  s += P('t-b', rpoly([[8.5, 7], [37, 4.5], [37, 60.5], [8.5, 57]], [2, 1.5, 1.5, 2]) + g + bars, ' fill-rule="evenodd"');
  s += P('t-c', g + bars);
  s += L('M14.5 27H30.5M22.5 19V35M16 22.5Q22.5 25 29 22.5M16 31.5Q22.5 29 29 31.5', 1.1);
  s += `<ellipse class="ln" cx="22.5" cy="27" rx="3.6" ry="8" stroke-width="1.1"/>`;
  s += P('t-c', spark(58.5, 5.5, 4) + spark(4.5, 62 - 8, 2.8));
  add('passport', 'open passport with globe emblem and stamp', s);
}

// ---------- snow-globe
{
  let s = '';
  // glass ring and shine
  s += P('t-a', circ(32, 27.5, 23) + circ(32, 27.5, 20.8), ' fill-rule="evenodd"');
  s += P('t-c', 'M14 27Q14.5 15.5 24 10.3Q17.8 17 17.3 27.5Z');
  // snowy ground inside the dome
  s += P('t-c', 'M14.6 39Q32 34.5 49.4 39A20.8 20.8 0 0 1 14.6 39Z');
  // clock tower with a cut clock face and windows
  const face = circ(32, 21, 2.2), win = 'M30.8 27.5h2.4v3.5h-2.4ZM30.8 33h2.4v4h-2.4Z';
  s += P('t-b', 'M28.5 39V17.5L32 11L35.5 17.5V39Z' + face + win, ' fill-rule="evenodd"');
  s += L('M32 11V8', 1.4);
  // two little houses
  for (const [x, w] of [[16.5, 9.5], [38, 9.5]]) {
    const dw = `M${f(x + w / 2 - 1.3)} 34.8h2.6v3.2h-2.6Z`;
    s += P('t-a', `M${x} 39V32.5H${f(x + w)}V39Z` + dw, ' fill-rule="evenodd"');
    s += P('t-b', `M${f(x - 1)} 33L${f(x + w / 2)} 27L${f(x + w + 1)} 33Z`);
  }
  // swirling snow
  let sn = '';
  for (const [x, y, r] of [[22, 15.5, 1.2], [42.5, 14, 1.1], [19.5, 22, .9], [26.5, 10.5, .9], [38.5, 9.5, 1], [24.5, 27.5, .8], [40.5, 25.5, .9], [47, 30, .8], [36.5, 18.5, .8]]) sn += circ(x, y, r);
  s += P('t-c', sn + spark(27, 18, 2) + spark(45.5, 22.5, 2));
  // wooden base with a blank plaque
  s += P('t-a', rpoly([[15.5, 46.5], [48.5, 46.5], [48.5, 51], [15.5, 51]], 1.5));
  const plq = rpoly([[24, 53.5], [40, 53.5], [40, 57.5], [24, 57.5]], 1.2);
  s += P('t-b', rpoly([[12, 50.5], [52, 50.5], [57, 60.5], [7, 60.5]], 2) + plq, ' fill-rule="evenodd"');
  s += P('t-c', plq);
  s += P('t-c', spark(57, 8, 4.5) + spark(7, 50, 2.8));
  add('snow-globe', 'snow globe with a tiny town inside', s);
}

// ---------- taxi
{
  let s = '';
  // roof sign: blank lit panel cut out of the box
  const lit = rpoly([[27.2, 16.2], [36.8, 16.2], [36.8, 19.8], [27.2, 19.8]], 1);
  s += R('t-b', 28.5, 21, 7, 3.4, .6);
  s += P('t-a', rpoly([[25, 14], [39, 14], [39, 22], [25, 22]], 2) + lit, ' fill-rule="evenodd"');
  s += L('M32 10.8V7.8M24.6 12L22.4 9.8M39.4 12L41.6 9.8', 1.6);
  // body with windows, checker band and headlight cut out
  const holes = 'M23.5 27.5H31.4V35.4H17.8L21.6 28.6Q22.3 27.5 23.5 27.5Z' + 'M34 27.5H40.3Q41.6 27.5 42.4 28.7L46.6 35.4H34Z' + 'M5 39H57V43H5Z' + 'M57.8 39H60.6V42.5H57.8Z';
  s += P('t-a', 'M7 52Q3 52 3 48V41Q3 37 7 36.5L14 36L20 26Q21.5 24 24 24H40Q42.5 24 44 26L50 35.5L57.5 36.5Q61 37.2 61 41V48Q61 52 57 52H56A8 8 0 0 0 40 52H24A8 8 0 0 0 8 52Z' + holes, ' fill-rule="evenodd"');
  s += P('t-c', holes);
  let ck = '';
  for (let i = 0; i < 26; i++) ck += `M${5 + i * 2} ${i % 2 ? 41 : 39}h2v2h-2Z`;
  s += P('t-b', ck);
  // lower body, door seam, tail light
  s += P('t-b', 'M3 47.5H9.4A8 8 0 0 0 8 52H7Q3 52 3 48ZM22.6 47.5H41.4A8 8 0 0 0 40 52H24A8 8 0 0 0 22.6 47.5ZM54.6 47.5H61V48Q61 52 57 52H56A8 8 0 0 0 54.6 47.5Z');
  s += R('t-b', 3.3, 39.3, 1.4, 3.4, .6);
  s += L('M32.7 36V38.5M32.7 43.5V47.5', 1.3);
  s += R('t-b', 36, 37, 3.5, 1.2, .6);
  // wheels with cut hubs
  for (const x of [16, 48]) {
    s += P('t-b', circ(x, 52, 6.6) + circ(x, 52, 3), ' fill-rule="evenodd"');
    s += C('t-c', x, 52, 3);
    s += C('t-b', x, 52, 1.2);
  }
  s += L('M3 61H61', 1.2);
  s += P('t-c', spark(55, 15, 4.5) + spark(9, 21, 3));
  add('taxi', 'yellow taxi cab with a roof sign', s);
}
// ---------- double-decker-bus
{
  let s = '';
  const rr = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  const wr = 15, wf = 38, ra = 8.5, by = 48;
  let holes = '';
  const up = [], lo = [];
  for (let i = 0; i < 5; i++) up.push([8.5 + i * 10.2, 13, 8.6, 9]);
  for (let i = 0; i < 3; i++) lo.push([8.5 + i * 13.2, 28.5, 11.6, 8.5]);
  for (const w of [...up, ...lo]) holes += rr(...w, 1.5);
  const door = [48.5, 28.5, 7.5, 15], scr = [57.3, 28.5, 3, 11.5];
  holes += rr(...door, 1.2) + rr(...scr, 1) + rr(57.8, 40.8, 2.6, 2);
  const body = `M5 ${by}V14Q5 9 10 9H54Q60.5 9 60.8 15L61 44Q61 ${by} 58 ${by}H${wf + ra}A${ra} ${ra} 0 0 0 ${wf - ra} ${by}H${wr + ra}A${ra} ${ra} 0 0 0 ${wr - ra} ${by}Z`;
  s += P('t-a', body + holes, ' fill-rule="evenodd"');
  s += P('t-c', holes);
  s += L(`M${door[0] + door[2] / 2} 29V43.5`, 1.4);
  // skirt between the arches
  { const t = 43.5, k = f(Math.sqrt(ra * ra - (by - t) ** 2)), seg = (x1, x2, a1, a2) => `M${x1} ${t}H${x2}${a2 ? `A${ra} ${ra} 0 0 0 ${f(a2 - ra)} ${by}` : `V${by}`}H${a1 ? f(a1 + ra) : x1}${a1 ? `A${ra} ${ra} 0 0 0 ${x1} ${t}` : ''}Z`;
    s += P('t-b', seg(5, f(wr - k), 0, wr) + seg(f(wr + +k), f(wf - k), wr, wf) + seg(f(wf + +k), 61, wf, 0)); }
  s += L('M60.8 29.5h1.4v4', 1.4);
  // destination display + trim
  s += R('t-b', 48.5, 23, 12.3, 3.6, 1);
  s += L('M5.5 25H46', 1.5);
  // wheels
  for (const x of [wr, wf]) { s += P('t-b', circ(x, by, 7) + circ(x, by, 3.2), ' fill-rule="evenodd"'); s += C('t-c', x, by, 3.2); s += C('t-b', x, by, 1.3); }
  s = `<g transform="translate(0 1.5)">${s}</g>` + P('t-c', spark(9, 4.5, 3.2));
  add('double-decker-bus', 'red double-decker bus', s);
}

// ---------- road-sign
{
  let s = '';
  // pole segments (only where no sign covers it) and base
  s += E('t-b', 32, 60.5, 9, 2.2);
  s += P('t-a', 'M29.8 32H34.2V38H29.8ZM29.8 55H34.2V60.5H29.8Z');
  s += P('t-b', 'M32.3 32H34.2V38H32.3ZM32.3 55H34.2V60.5H32.3Z');
  // triangular warning sign
  const tri = [[32, 2], [13.5, 33.5], [50.5, 33.5]], c = [32, 23], k = .57;
  const inn = tri.map(p => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]);
  s += P('t-b', rpoly(tri, 4) + rpoly(inn, 1.5), ' fill-rule="evenodd"');
  s += P('t-c', rpoly(inn, 1.5));
  s += L('M27.8 29.5V28C27.8 25 32.2 25 32.2 21.8', 2.8);
  s += P('t-b', 'M32.2 16.2L35.6 22H28.8Z');
  // round straight-on sign
  const arr = 'M32 38.5L38.4 45.2H34.1V54H29.9V45.2H25.6Z';
  s += P('t-a', circ(32, 46.5, 10.5) + arr, ' fill-rule="evenodd"');
  s += P('t-c', arr);
  s += P('t-b', 'M41 41.2A10.5 10.5 0 0 1 26.2 55.3A11.5 11.5 0 0 0 41 41.2Z');
  s += P('t-c', spark(52.5, 8.5, 3.6) + spark(13, 46, 2.6));
  add('road-sign', 'warning triangle over round arrow sign', s);
}

// ---------- motorbike
{
  let s = '';
  const wy = 49, W = [14, 50.5], RO = 10, RI = 6.8;
  // wheels: tyre ring, spokes, hub
  for (const x of W) {
    s += P('t-b', circ(x, wy, RO) + circ(x, wy, RI), ' fill-rule="evenodd"');
    let sp = '';
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .3; sp += `M${f(x + 2 * Math.cos(a))} ${f(wy + 2 * Math.sin(a))}L${f(x + 7 * Math.cos(a))} ${f(wy + 7 * Math.sin(a))}`; }
    s += L(sp, 1.2);
    s += C('t-b', x, wy, 2.6);
  }
  // swingarm + front fork
  s += P('t-b', cap(14, wy, 29, 44, 3.6));
  s += P('t-a', cap(50.5, wy, 43.5, 23, 3.4));
  // engine with fins cut out
  s += P('t-b', rpoly([[26, 35], [40, 35], [41.5, 46], [27.5, 47]], 2) + 'M29 38.5h9v1.3h-9ZM29 41.5h9.4v1.3h-9.4Z', ' fill-rule="evenodd"');
  // chrome exhaust running back to a muffler under the tail
  s += P('t-c', limb([[41, 44], [34, 47.6], [29.5, 46.5], [27.5, 41]], 2.6) + cap(28.5, 39.8, 6.5, 35.8, 4));
  s += C('t-b', 6.6, 35.8, 1.2);
  // tail + saddle
  s += P('t-a', 'M4.5 30H31L29.5 34.2H7Q4.5 34 4.5 32Z');
  s += P('t-b', 'M5 29.5Q5.5 25 10 25.3L22 26.3Q28 26.8 31.5 28.5V30.5H5Z');
  // teardrop tank
  s += P('t-a', 'M29 30.2C29 25 34 21.5 40.5 21.5C45.5 21.5 48 24 47 27.5C46 31 41 33 35 33C31 33 29 32 29 30.2Z');
  s += P('t-b', 'M30 31.5C33 32.5 41 32.5 46.4 28.6C45 31.5 40.5 33 35 33C32.5 33 30.8 32.5 30 31.5Z');
  // raised handlebars + headlamp
  s += L('M43.5 23L41.5 14.5L36 13', 2.6);
  s += P('t-b', circ(49, 22.5, 4.8) + circ(49, 22.5, 3), ' fill-rule="evenodd"');
  s += C('t-c', 49, 22.5, 3);
  s += P('t-c', spark(57.5, 9, 3.6) + spark(10, 15, 2.6));
  add('motorbike', 'motorbike with spoked wheels', s);
}

// ---------- truck
{
  let s = '';
  const wy = 52, wr = 5.6, rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  // trailer box with panel seams and underframe
  s += P('t-a', rpoly([[2.5, 13], [41.5, 13], [41.5, 44], [2.5, 44]], 1.5));
  s += P('t-b', rect(2.5, 13, 39, 2.5) + rect(2.5, 41, 39, 3) + rect(6, 44, 22, 3) + rect(28, 45, 15, 3));
  s += L('M12.3 17V39M22.1 17V39M31.9 17V39', 1.4);
  // chrome exhaust stack between trailer and cab
  s += P('t-c', cap(43.6, 10, 43.6, 40, 2.8));
  s += P('t-b', 'M42.2 15h2.8v1.6h-2.8ZM42.2 20h2.8v1.6h-2.8Z');
  // cab with windows cut out
  const win = rect(48.5, 19, 7, 9) + rect(57.5, 19, 3.2, 9) + rect(58.6, 39.5, 2.4, 2.4);
  s += P('t-a', `M46 49V19Q46 13.5 51.5 13.5H56.5Q60.3 13.5 60.8 17.5L61.8 29V49H${53 + 7.3}A7.3 7.3 0 0 0 ${53 - 7.3} 49Z` + win, ' fill-rule="evenodd"');
  s += P('t-c', win);
  s += L('M47.8 33H56M53.4 36.5H55.4', 1.4);
    // wheels
  for (const x of [10.5, 22.5, 37.5, 53]) { s += P('t-b', circ(x, wy, wr) + circ(x, wy, 2.4), ' fill-rule="evenodd"'); s += C('t-c', x, wy, 2.4); }
  s += P('t-c', spark(55, 7, 3.4) + spark(8, 6.5, 2.4));
  add('truck', 'articulated lorry with box trailer', s);
}

// ---------- fire-engine
{
  let s = '';
  const wy = 49.5, W = [14.5, 51], ra = 8.3, by = 47, rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  // ladder supports, then the silver ladder with gaps between rungs
  s += P('t-b', rect(9, 16, 3, 9) + rect(37, 16, 3, 9));
  let rungs = '';
  for (let i = 0; i < 10; i++) rungs += rect(4.9 + i * 4.1, 12.4, 2.7, 3.4);
  s += P('t-c', rect(3.5, 11, 42.1, 6.2) + rungs, ' fill-rule="evenodd"');
  // body + cab with windows cut out
  const win = rect(48, 23, 7, 8.5) + rect(57.2, 23, 3.4, 8.5) + rect(58.6, 40, 2.4, 2.4);
  s += P('t-a', `M3 ${by}V27.5Q3 24 6.5 24H45V21Q45 19 47 19H56Q59.8 19 60.5 23L61.5 31V${by}H${W[1] + ra}A${ra} ${ra} 0 0 0 ${W[1] - ra} ${by}H${W[0] + ra}A${ra} ${ra} 0 0 0 ${W[0] - ra} ${by}Z` + win, ' fill-rule="evenodd"');
  s += P('t-c', win);
  // dark skirt between the arches
  { const t = 43, k = f(Math.sqrt(ra * ra - (by - t) ** 2)), seg = (x1, x2, a1, a2) => `M${x1} ${t}H${x2}${a2 ? `A${ra} ${ra} 0 0 0 ${f(a2 - ra)} ${by}` : `V${by}`}H${a1 ? f(a1 + ra) : x1}${a1 ? `A${ra} ${ra} 0 0 0 ${x1} ${t}` : ''}Z`;
    s += P('t-b', seg(3, f(W[0] - k), 0, W[0]) + seg(f(W[0] + +k), f(W[1] - k), W[0], W[1]) + seg(f(W[1] + +k), 61.5, W[1], 0)); }
  // lockers + cab door line
  s += L('M29 27.5H43.5V40H29ZM36.2 27.5V40M46.5 34.5H56', 1.4);
  // coiled hose reel
  s += P('t-b', circ(19, 33.5, 6.8) + circ(19, 33.5, 5.3) + circ(19, 33.5, 3.8) + circ(19, 33.5, 2.4), ' fill-rule="evenodd"');
  s += C('t-b', 19, 33.5, 1.2);
  s += L('M25.6 35.5Q27.5 40 23 41', 1.6);
  // flashing blue lights on the cab roof
  s += P('t-b', rect(49.5, 17.3, 10.5, 2));
  s += P('t-c', 'M50.3 17.3a2.3 2.3 0 0 1 4.6 0ZM54.5 17.3a2.3 2.3 0 0 1 4.6 0Z');
  s += L('M52.6 12.3V9.5M56.8 12.3V9.5M49.6 13.8L47.9 12.4M59.8 13.8L61.6 12.4', 1.4);
  // wheels
  for (const x of W) { s += P('t-b', circ(x, wy, 6.8) + circ(x, wy, 3), ' fill-rule="evenodd"'); s += C('t-c', x, wy, 3); s += C('t-b', x, wy, 1.2); }
  s += P('t-c', spark(9, 5.5, 3) + spark(30, 4.5, 2));
  add('fire-engine', 'fire engine with ladder and hose reel', s);
}
// ---------- ambulance
{
  let s = '';
  // flashing light rays
  s += L('M12 8.5L9.5 5.5M18 8.5L20.5 5.5M15 7V3M32 8.5L29.5 5.5M38 8.5L40.5 5.5M35 7V3', 2);
  // roof light domes
  s += P('t-b', 'M11 14V12Q11 9 15 9Q19 9 19 12V14Z' + 'M31 14V12Q31 9 35 9Q39 9 39 12V14Z');
  // body: box + cab, with cab window cut out
  const win = rpoly([[44.5, 25.5], [49.6, 25.5], [55.5, 33.5], [44.5, 33.5]], 1.2);
  const body = 'M7 50Q4 50 4 47V17Q4 14 7 14H40Q42.5 14 42.5 16.5V22H48Q50 22 51.3 23.8L57.5 32.6L59 33.2Q61 34 61 37V47Q61 50 58 50Z';
  s += P('t-a', body + win, ' fill-rule="evenodd"');
  s += P('t-c', win);
  s += P('t-c', 'M7.5 17.5H38Q39 17.5 39 18.3H7.5Z');
  s += P('t-c', 'M12.8 11.2Q13.3 10.4 14.5 10.3V12.3H12.8Z' + 'M32.8 11.2Q33.3 10.4 34.5 10.3V12.3H32.8Z');
  // bold stripe
  s += P('t-b', 'M4 37H61V43H4Z');
  // medical plus on the box side
  s += P('t-b', 'M19.5 18H26.5V23.5H32V30.5H26.5V36H19.5V30.5H14V23.5H19.5Z');
  // cab/box seam + door handle
  s += L('M42.5 23V49', 1.6);
  s += L('M45.5 35.5H48.5', 1.6);
  // headlight, rear light
  s += R('t-c', 57.5, 44.5, 3, 2.5, 1);
  s += R('t-b', 2, 44, 4, 6, 1.2);
  // wheels
  for (const x of [16, 50]) { s += P('t-b', circ(x, 50, 8) + circ(x, 50, 3.8), ' fill-rule="evenodd"'); s += C('t-c', x, 50, 3.8); s += C('t-b', x, 50, 1.6); }
  s += P('t-c', spark(55, 9, 4) + spark(5, 6, 2.6));
  add('ambulance', 'ambulance with stripe, roof lights and plus', s);
}

// ---------- submarine
{
  let s = '';
  // bubbles trailing up from the propeller
  s += L(circ(6, 25, 1.8) + circ(9, 17.5, 2.6) + circ(5.5, 9, 1.8) + circ(50, 18, 1.5), 1.6);
  // periscope
  s += P('t-b', limb([[36.5, 20], [36.5, 9.5], [41, 9.5]], 2.6));
  s += R('t-b', 40, 7.2, 3.6, 4.6, 1);
  // conning tower
  s += P('t-a', rpoly([[26, 31], [28.5, 18], [42, 18], [45.5, 31]], [1, 2.5, 2.5, 1]));
  s += P('t-b', 'M38.5 18H40Q41.8 18 42.2 19.8L45 31H41.5Z');
  s += P('t-c', 'M30.3 21H33L31.8 28H29Z');
  // tail fin + propeller
  s += P('t-b', 'M15 33.5L12.5 26.5Q12.3 25.5 13.3 25.5H15.5L21.5 31.5Z');
  s += P('t-b', 'M4 40H9V42H4Z');
  s += E('t-b', 4.6, 35, 2, 5, -8) + E('t-b', 4.6, 47, 2, 5, 8);
  s += C('t-b', 5, 41, 2.4);
  // hull with porthole holes
  const ports = [[22, 40.5], [33.5, 40.5], [45, 40.5]];
  const holes = ports.map(([x, y]) => circ(x, y, 4.4)).join('');
  const hull = 'M7.5 41C9.5 34.5 18 29 30 29H45C54.5 29 60 34 60 41C60 47.5 54.5 52.5 45 52.5H30C18 52.5 9.5 47.5 7.5 41Z';
  s += P('t-a', hull + holes, ' fill-rule="evenodd"');
  s += P('t-b', 'M10.5 46.5Q30 49.5 58.4 46.6Q55 52.5 45 52.5H30Q17 52.5 10.5 46.5Z');
  s += P('t-c', 'M20 32.3Q24 31.4 29.5 31.4H43Q46 31.4 48 32.3Z');
  for (const [x, y] of ports) { s += P('t-b', circ(x, y, 4.4) + circ(x, y, 2.8), ' fill-rule="evenodd"'); s += C('t-c', x, y, 2.8); }
  s += P('t-c', spark(55, 12, 4) + spark(22, 59, 2.4));
  add('submarine', 'friendly submarine with periscope and portholes', s);
}

// ---------- helicopter
{
  let s = '';
  // landing skids
  s += P('t-b', limb([[30, 44], [27.5, 53.5]], 2.6) + limb([[47, 44], [49, 53.5]], 2.6));
  s += P('t-b', limb([[14, 54], [53, 54], [57.5, 50.5]], 3.2));
  // tail boom, fin and tail rotor
  s += P('t-a', 'M28 27.5L9 29Q6.5 29.2 6.5 31Q6.5 32.8 9 33L28 38.5Z');
  s += P('t-b', 'M6.6 31.5Q7 32.8 9 33L28 38.5V35Z');
  s += P('t-b', 'M8.5 29.5L5.3 17.5Q5 16.5 6.1 16.5H8.6L14.5 28.8Z');
  s += C('t-c', 9, 24, 5.2);
  s += P('t-b', cap(9, 19.6, 9, 28.4, 2.2) + cap(4.6, 24, 13.4, 24, 2.2));
  s += C('t-b', 9, 24, 1.8);
  // cabin with bubble cockpit and side window cut out
  const glass = 'M45.5 23.5C52.5 24 57 29 57.4 34.5H45.5Z';
  const side = rpoly([[33, 26], [41.5, 26], [41.5, 34], [33, 34]], 2);
  const cab = 'M24 35.5C24 26 32 21 42 21C53 21 60 28 60 35.5C60 42 55 46 47 46H31C26.5 46 24 42 24 35.5Z';
  s += P('t-a', cab + glass + side, ' fill-rule="evenodd"');
  s += P('t-c', glass + side);
  s += P('t-b', 'M24.7 40.5H59.3Q57.5 46 47 46H31Q26 46 24.7 40.5Z');
  s += L('M43.5 24V40', 1.6);
  // rotor mast, motion blur and blades
  s += R('t-b', 33, 14, 5, 8, 1.5);
  s += E('t-c', 34, 11.5, 29, 3.4);
  s += P('t-b', cap(8, 11.5, 31, 11.5, 2.8) + cap(37, 11.5, 60.5, 11.5, 2.8));
  s += E('t-b', 35.5, 11.5, 4.5, 2.6);
  s += L('M12 6.4Q20 4.4 28 4.8M42 4.8Q50 4.4 58 6.4', 1.6);
  s += P('t-c', spark(16, 43, 3.4) + spark(58.5, 20, 2.2));
  add('helicopter', 'helicopter with spinning rotor and skids', s);
}

// ---------- hot-air-balloon
{
  let s = '';
  const g = k => [32 - 15 * k, 32 - 24 * k, 32 - 8 * k].map(f);
  const fwd = k => { const [a, b, c] = g(k); return `M32 1.5C${a} 1.5 ${b} 9.5 ${b} 20.5C${b} 30.5 ${a} 35.5 ${c} 42`; };
  const back = k => { const [a, b, c] = g(k); return `L${c} 42C${a} 35.5 ${b} 30.5 ${b} 20.5C${b} 9.5 ${a} 1.5 32 1.5Z`; };
  // ropes
  s += L('M25.5 44L25.5 53M38.5 44L38.5 53', 1.4);
  // envelope with stripes
  s += P('t-a', fwd(1) + back(-1));
  s += P('t-b', fwd(.2) + back(.6) + fwd(-.2) + back(-.6));
  s += P('t-c', 'M13.6 16Q15.6 9.5 21 6.4Q17.5 10.5 16.4 17.4Q15 17.8 13.6 16Z');
  // skirt
  s += P('t-b', 'M23.5 41H40.5L38.6 45H25.4Z');
  // flame (lighter core cut out of the outer flame)
  const core = 'M32 46.5C33.3 48 33.8 49 33.8 49.8C33.8 50.8 33 51.3 32 51.3C31 51.3 30.2 50.8 30.2 49.8C30.2 49 30.7 48 32 46.5Z';
  s += P('t-a', 'M32 43C35 46.2 36 48.2 36 49.8C36 51.8 34.3 53 32 53C29.7 53 28 51.8 28 49.8C28 48.2 29 46.2 32 43Z' + core, ' fill-rule="evenodd"');
  s += P('t-c', core);
  // basket
  s += P('t-a', rpoly([[23.5, 54], [40.5, 54], [39, 62], [25, 62]], 1.5));
  s += P('t-b', 'M40.2 56L39 62H35.6L36.6 56Z');
  s += R('t-b', 22.5, 52.3, 19, 3.6, 1.6);
  s += L('M24.4 59H39.6M28.5 56.5V61.5M32 56.5V61.5', 1.2);
  s += P('t-c', spark(55, 47, 3.8) + spark(8, 45, 2.6) + spark(56, 5.5, 2.4));
  add('hot-air-balloon', 'striped hot-air balloon with basket', s);
}

// ---------- race-car
{
  let s = '';
  // speed lines
  s += L('M2 40.5H5M2.4 46.5H5.4M2 52.5H5', 2);
  // rear wing: flat plate on a square endplate and a strut, thin highlight cut along its top
  const hl = 'M9.5 21.2H17.5V22.2H9.5Z';
  s += P('t-b', cap(14, 23, 14, 31.5, 2.6));
  s += P('t-b', rpoly([[2.5, 19], [8.5, 19], [8.5, 31.5], [2.5, 33]], 1.4) + rpoly([[7, 20], [19.5, 20], [19.5, 24], [7, 24]], 1.6) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  // helmet in the cockpit
  const visor = rpoly([[32.8, 29], [36.6, 29], [36.6, 32.4], [32.8, 32.4]], 1.2);
  s += P('t-b', circ(32.5, 31.5, 4.5) + visor, ' fill-rule="evenodd"');
  s += P('t-c', visor);
  // long low body, nose dipping down to the front wing, racing stripe cut out
  const stripe = 'M11 36.4H40.5L49 38.4H11Z';
  const body = 'M6 43.5V37Q6 34 9 33.6L20 29.6Q21 29 23 29H26.5Q27.5 29 27.8 30L29 34.6H36.5Q38 34.6 39.5 35.2L61.5 44.2Q63 45 62 46.2Q61.5 46.8 60 46.8L50 45Z';
  s += P('t-a', body + stripe, ' fill-rule="evenodd"');
  s += P('t-c', stripe);
  s += P('t-b', 'M6 41.5H50L62.2 46Q61.5 46.8 60 46.8L50 45L50 43.5H6Z');
  s += P('t-b', 'M23 29H26.5Q27.5 29 27.8 30L28.6 33H23Z');
  // front wing: low plate ahead of the tyre, endplate rising to the nose tip
  s += P('t-b', rpoly([[57.6, 45.6], [61.8, 45.2], [63, 53.5], [59, 53.5]], 1) + rpoly([[52.5, 50.4], [63, 50], [63, 53.5], [52.5, 53.5]], 1.3));
  // fat tyres
  for (const [x, y, r] of [[17, 45, 9.5], [45, 46, 8.5]]) {
    s += P('t-b', circ(x, y, r) + circ(x, y, r * .42), ' fill-rule="evenodd"');
    s += C('t-c', x, y, r * .42); s += C('t-b', x, y, 1.5);
  }
  s = `<g transform="translate(0 -1)">${s}</g>`;
  s += P('t-c', spark(51, 15, 4.2) + spark(33, 7.5, 2.6) + spark(56, 31, 2.2));
  add('race-car', 'open-wheel race car with speed lines', s);
}
// ---------- van
{ let s = '';
  const EO = ' fill-rule="evenodd"';
  const win = 'M40.5 16H43.5Q44.6 16 45.1 17L49.5 26.5Q50 27.5 49 27.5H40.5Z';
  const bay = 'M7 16.5Q7 15 8.5 15H36.5Q38 15 38 16.5V42H7Z';
  const lamp = 'M56 32.5Q56 31.8 56.7 31.8H58.3Q59 31.8 59 32.5V34.3Q59 35 58.3 35H56.7Q56 35 56 34.3Z';
  // body with wheel arches, cut for cab window, door bay and headlamp
  s += P('t-a', 'M4 44V16Q4 12 8 12H41Q44 12 45.5 14.5L52 28L56.5 29Q60 30 60 34V45Q60 48 57 48H56.5A9.5 9.5 0 0 0 37.5 48H24.5A9.5 9.5 0 0 0 5.5 48Q4 48 4 46Z' + win + bay + lamp, EO);
  s += P('t-c', win + lamp);
  // rocker / bumper band
  s += P('t-b', 'M4 42H7.6A9.5 9.5 0 0 0 5.5 48Q4 48 4 46ZM22.4 42H39.6A9.5 9.5 0 0 0 37.5 48H24.5A9.5 9.5 0 0 0 22.4 42ZM54.4 42H60V45Q60 48 57 48H56.5A9.5 9.5 0 0 0 54.4 42Z');
  // dark load bay with parcels cut out
  const b1 = 'M26 31.3H36.5V40.5H26Z', b2 = 'M26.6 23H34.6V30H26.6Z', b3 = 'M28.6 16.8H35.2V21.7H28.6Z';
  s += P('t-b', 'M24.5 15H36.5Q38 15 38 16.5V42H24.5Z' + b1 + b2 + b3, EO);
  s += P('t-c', b1 + b2 + b3);
  s += R('t-b', 31, 35.5, 4, 3, .8) + R('t-b', 27.8, 26.8, 3, 2, .6);
  // sliding door, slid back over the rear panel
  s += P('t-a', 'M8 17.5Q8 16 9.5 16H24.5V41H8Z');
  s += P('t-b', 'M21.5 16H24.5V41H21.5Z');
  s += R('t-b', 16.5, 27.3, 3.6, 1.8, .9);
  // cab door handle, tail lamp, mirror
  s += L('M42 31.5H45', 1.6);
  s += R('t-b', 4, 29, 2.4, 6, 1);
  s += P('t-b', 'M50 24.5H52.5Q53.5 24.5 53.5 25.5V27.5Q53.5 28.5 52.5 28.5H51.5Z');
  // wheels
  for (const x of [15, 47]) { s += P('t-b', circ(x, 48, 7.6) + circ(x, 48, 3.4), EO); s += C('t-c', x, 48, 3.4); s += C('t-b', x, 48, 1.4); }
  s += P('t-c', spark(55, 13, 4.5));
  s += C('t-c', 61, 21, 1.1);
  add('van', 'panel van with parcels in open door', s);
}

// ---------- scooter
{ let s = '';
  const EO = ' fill-rule="evenodd"';
  const pt = (cx, cy, r, a) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
  // rear brake fender arcing over the back wheel
  const [o1, o2, i2, i1] = [pt(12, 50.5, 10.7, -40), pt(12, 50.5, 10.7, -170), pt(12, 50.5, 8.1, -170), pt(12, 50.5, 8.1, -40)];
  s += P('t-b', `M${f(o1[0])} ${f(o1[1])}A10.7 10.7 0 0 0 ${f(o2[0])} ${f(o2[1])}A1.3 1.3 0 0 0 ${f(i2[0])} ${f(i2[1])}A8.1 8.1 0 0 1 ${f(i1[0])} ${f(i1[1])}Z`);
  // wheels
  for (const x of [12, 52]) { s += P('t-b', circ(x, 50.5, 7.1) + circ(x, 50.5, 3.2), EO); s += C('t-c', x, 50.5, 3.2); }
  // deck, neck and stem with fork
  s += P('t-a', 'M18.5 40.5H43Q46 40.5 46 43.5V43.5Q46 46.5 43 46.5H18.5Q15.5 46.5 15.5 43.5V43.5Q15.5 40.5 18.5 40.5Z');
  s += P('t-a', cap(41, 43.5, 49.6, 36, 5.4));
  s += P('t-a', cap(52, 50.5, 46, 10, 4.6));
  s += P('t-b', 'M19 40.5H41.5V42.5H19Z');
  // head clamp and height collar
  s += P('t-b', cap(49.4, 38.6, 49, 35.4, 6));
  s += P('t-b', cap(47.4, 24.6, 47.2, 23.4, 5.4));
  // T-bar with grips
  s += P('t-a', cap(36, 10, 56, 10, 3.6));
  s += P('t-b', cap(33.5, 10, 39.5, 10, 5.2) + cap(52.5, 10, 58.5, 10, 5.2));
  s += C('t-b', 52, 50.5, 1.3) + C('t-b', 12, 50.5, 1.3);
  s += P('t-c', spark(17, 21, 5) + spark(7, 33, 2.6));
  s += C('t-c', 27, 30, 1.3);
  add('scooter', 'kick scooter with T-bar handlebar', s);
}

// ---------- bulldozer
{ let s = '';
  const EO = ' fill-rule="evenodd"';
  // low body with cab on the rear, windows cut out
  const w1 = 'M11 17.5H16V27.5H11Z', w2 = 'M17.6 17.5H21.6Q23 17.5 23 19V27.5H17.6Z';
  s += P('t-a', 'M4.5 44.5V33Q4.5 30.5 7 30.5H8.5V16.5Q8.5 14.5 10.5 14.5H23.5Q25.5 14.5 25.5 16.5V32H39.5Q41.5 32 42 34L42.5 36V44.5Z' + w1 + w2, EO);
  s += P('t-c', w1 + w2);
  s += R('t-b', 7.3, 11.8, 19.4, 3.6, 1.6);
  s += P('t-b', 'M4.5 41.5H42.5V44.5H4.5Z');
  s += L('M28.5 35.8H36.5M28.5 38.8H36.5', 1.5);
  // short exhaust pipe
  s += P('t-b', cap(38, 32, 38, 25, 2.8) + 'M36.3 25.3L39.9 24.2V22.4L36.3 23.5Z');
  // crawler track with road wheels
  s += P('t-b', cap(10.5, 51, 34, 51, 13) + cap(10.5, 51, 34, 51, 7.6), EO);
  for (const [x, r] of [[10.5, 3.3], [18.3, 2.5], [26.1, 2.5], [34, 3.3]]) s += C('t-c', x, 51, r);
  // push arm and lift ram
  s += P('t-b', cap(32, 46.8, 46, 47.5, 3.6) + cap(40, 35.5, 46, 32.5, 2.4));
  // big curved blade
  s += P('t-a', 'M43.5 28Q43.5 25.5 46 25.5H51Q54.5 25.8 54.3 28.5Q47.8 35 47.8 42.5Q47.8 50 54.5 55V57.5H46Q43.5 57.5 43.5 55Z');
  s += P('t-b', 'M43.5 28Q43.5 25.5 46 25.5V57.5Q43.5 57.5 43.5 55Z');
  // heap of soil against the blade, pebbles cut out
  const peb = circ(55.5, 50.5, 1.4) + circ(59.8, 54, 1.1) + circ(58.6, 45, 1) + circ(53.3, 44, .8);
  s += P('t-b', 'M49.6 57.5Q48.6 47 51.6 41.8Q55.2 36 59.4 38.8Q63.2 42.2 63.2 57.5Z' + peb, EO);
  s += P('t-c', peb);
  s += C('t-b', 56.3, 32.6, 1.6) + C('t-b', 61, 34.4, 1.2);
  s += P('t-c', spark(54, 14, 5) + spark(33, 7, 2.6));
  add('bulldozer', 'bulldozer pushing a heap of soil', s);
}

// ---------- construction-crane
{ let s = '';
  const EO = ' fill-rule="evenodd"';
  // inset a triangle by t (lattice hole between members of width 2t)
  const tri = (p, t) => {
    const [a, b, c] = p, la = Math.hypot(b[0] - c[0], b[1] - c[1]), lb = Math.hypot(a[0] - c[0], a[1] - c[1]), lc = Math.hypot(a[0] - b[0], a[1] - b[1]), per = la + lb + lc;
    const I = [(la * a[0] + lb * b[0] + lc * c[0]) / per, (la * a[1] + lb * b[1] + lc * c[1]) / per];
    const ar = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2, r = 2 * ar / per, k = (r - t) / r;
    return 'M' + p.map(q => `${f(I[0] + (q[0] - I[0]) * k)} ${f(I[1] + (q[1] - I[1]) * k)}`).join('L') + 'Z';
  };
  let holes = '';
  // jib: chords at y 11 / 17, from x 5 to 60
  for (let i = 0; i < 8; i++) { const x0 = 5 + i * 55 / 8, x1 = x0 + 55 / 8;
    holes += i % 2 ? tri([[x0, 11], [x1, 11], [x0, 17]], 1) + tri([[x1, 11], [x1, 17], [x0, 17]], 1) : tri([[x0, 11], [x1, 11], [x1, 17]], 1) + tri([[x0, 11], [x1, 17], [x0, 17]], 1); }
  // mast: rails at x 17 / 26, from y 17 to 57
  for (let i = 0; i < 6; i++) { const y0 = 17 + i * 40 / 6, y1 = y0 + 40 / 6;
    holes += i % 2 ? tri([[17, y0], [26, y0], [17, y1]], 1) + tri([[26, y0], [26, y1], [17, y1]], 1) : tri([[17, y0], [26, y0], [26, y1]], 1) + tri([[17, y0], [26, y1], [17, y1]], 1); }
  s += P('t-a', 'M4 10H61V18H4ZM16 18H27V57H16Z' + holes, EO);
  // apex and tie ropes
  s += P('t-a', 'M16.5 10L21.5 2.5L26.5 10Z');
  s += L('M21.5 3.5L59 10.5M21.5 3.5L5 10.5', 1.2);
  // counterweight slabs and cab
  s += R('t-b', 4, 18.6, 8.5, 2.5, .6) + R('t-b', 4, 21.7, 8.5, 2.5, .6) + R('t-b', 4, 24.8, 8.5, 2.5, .6);
  const cw = 'M29 19.6H32V23.4H29Z';
  s += P('t-a', 'M27 18H32.5Q33.5 18 33.5 19V24Q33.5 25 32.5 25H27Z' + cw, EO);
  s += P('t-c', cw);
  // trolley, cable, hook block, slings
  s += R('t-b', 44.5, 18, 7, 2.6, .8);
  s += L('M48 20.6V31', 1.4);
  s += R('t-b', 45.5, 30.5, 5, 5, 1.3);
  s += L('M48 35.5V38.3M47.8 38.5L37.5 45.6M48.2 38.5L58.5 45.6', 1.3);
  // red steel girder with lightening holes
  const gh = [38.5, 43.5, 48.5, 53.5, 58.5].map(x => circ(x, 48.5, 1.3)).join('');
  s += P('t-b', 'M34 45.5H62V51.5H34Z' + gh, EO);
  s += P('t-c', gh);
  s += R('t-b', 11, 56.5, 21, 4, 1);
  s += P('t-c', spark(8, 41, 4.5) + spark(46, 58.5, 2.8));
  add('construction-crane', 'tower crane lifting a steel girder', s);
}

// ---------- forklift
{ let s = '';
  const EO = ' fill-rule="evenodd"';
  // body: raised counterweight at the back, low bonnet, wheel arches
  s += P('t-a', 'M4 46V37.5Q4 33 8.5 33H21Q22.6 33 23 34.5L23.5 36H37Q39.5 36 39.5 38.5V46.2A9.3 9.3 0 0 0 21.7 50H20.8A7.8 7.8 0 0 0 5.2 50Q4 50 4 48Z');
  s += P('t-b', 'M4 41H7.5V48H4Z');
  // seat and steering
  s += P('t-b', 'M12.5 24Q12.5 22 14.5 22Q16 22 16 24V29.5H20.5Q22 29.5 22 31V33H12.5Z');
  s += L('M31.5 36L28.3 27.5', 1.8);
  s += P('t-b', cap(25.6, 27.6, 30.6, 26, 2.4));
  // overhead guard
  s += P('t-b', cap(11.3, 33, 12.3, 13.5, 2.4) + cap(35, 36, 32, 13.5, 2.4) + 'M9.5 11.5H35.5Q37 11.5 37 13V13Q37 14.5 35.5 14.5H9.5Q8 14.5 8 13V13Q8 11.5 9.5 11.5Z');
  // mast, carriage and forks
  s += P('t-b', 'M39.6 9H43.8V56H39.6Z' + cap(38.8, 8.6, 44.6, 8.6, 2.2));
  s += P('t-b', 'M44.4 22.5H47.6V42.3H62Q63 42.3 63 43.4Q63 44.4 62 44.4H44.4Z');
  // pallet on the forks
  s += P('t-a', 'M47.8 34.4H63V36.4H61.2V39.8H63V41.8H47.8V39.8H49.6V36.4H47.8ZM53.4 36.4H57.4V39.8H53.4Z');
  // boxes with tape cut out
  const t1 = 'M51.1 23H53.1V26.8H51.1Z', t2 = 'M58.9 26.2H60.9V29.2H58.9Z', t3 = 'M51.3 15H53.3V18.2H51.3Z';
  s += P('t-a', 'M48 23H56.3V33.8H48ZM56.9 26.2H63V33.8H56.9ZM48.7 15H55.7V22.4H48.7Z' + t1 + t2 + t3, EO);
  s += P('t-c', t1 + t2 + t3);
  // wheels
  for (const [x, r] of [[13, 6], [31, 7.5]]) { s += P('t-b', circ(x, 50, r) + circ(x, 50, r * .45), EO); s += C('t-c', x, 50, r * .45); s += C('t-b', x, 50, 1.2); }
  s += P('t-c', spark(57, 8, 4) + spark(5, 24, 2.6));
  add('forklift', 'forklift lifting a pallet of boxes', s);
}
// ---------- caravan
{
  let s = '';
  const rr = (x, y, w, h, r) => rpoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
  // tow hitch A-frame + jockey wheel
  s += L('M53 41L61 44.5', 3);
  s += L('M57 43V50.5', 1.8);
  s += C('t-b', 57, 52, 2.4);
  s += R('t-b', 58.5, 42.2, 4.5, 4, 1.6);
  // awning stripes (trapezoid flaring out, scalloped hem)
  let st = '', sc = '';
  for (let i = 0; i < 5; i++) {
    const t0 = 5 + i * 4.4, t1 = t0 + 4.4, b0 = 1.5 + i * 5.3, b1 = b0 + 5.3;
    const d = `M${f(t0)} 15.5H${f(t1)}L${f(b1)} 24A2.65 2.65 0 0 1 ${f(b0)} 24Z`;
    if (i % 2) sc += d; else st += d;
  }
  // body with window, door-window and light-stripe holes
  const body = rpoly([[3, 13], [46, 13], [53, 25], [53, 45], [3, 45]], [5, 6, 4, 3, 3]);
  const win = rr(36, 18, 11, 9.5, 2);
  const dwin = rr(11, 28, 8, 4.5, 1.2);
  s += P('t-a', body + win + dwin + sc, ' fill-rule="evenodd"');
  s += P('t-c', win + dwin);
  s += P('t-b', 'M3 40H53V42Q53 45 50 45H6Q3 45 3 42Z');
  // coloured stripe
  s += P('t-b', 'M3 34.5H53V37.5H3Z');
  // door outline + handle
  s += L('M9.5 43V27.5Q9.5 26 11 26H19Q20.5 26 20.5 27.5V43', 1.5);
  s += C('t-b', 18.3, 39.5, 1.1);
  // roof vent + highlight
  s += R('t-b', 34, 10, 8, 3.5, 1.2);
  s += P('t-c', 'M33 14.6H45V15.4H33Z');
  s += P('t-b', st) + P('t-c', sc);
  s += P('t-b', 'M3.5 13.5H30Q31 13.5 31 14.5V16.5H2.5V14.5Q2.5 13.5 3.5 13.5Z');
  // awning poles
  s += L('M2.5 25.5L2 55M27.5 25.5L28.5 55', 1.4);
  // wheel
  s += C('t-b', 39, 46, 8);
  s += C('t-c', 39, 46, 3.6);
  s += C('t-b', 39, 46, 1.5);
  s += P('t-c', spark(58, 9, 4) + spark(49, 5, 2.4));
  add('caravan', 'touring caravan with striped awning', s);
}

// ---------- golf-cart
{
  let s = '';
  const rr = (x, y, w, h, r) => rpoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
  // far posts (the second pair)
  s += L('M18 12V36M52 12L48.5 31', 1.3);
  // golf clubs + bag at the back
  s += L('M5 19L3.8 7M7.5 19L7.3 5M10 19L10.6 8', 1.5);
  s += E('t-b', 3.4, 6, 2.9, 2.1, -15);
  s += P('t-b', 'M5.6 2.2L10 3.2L9.5 6.4L6.4 5.4Z');
  s += C('t-b', 10.6, 8.6, 1.9);
  const bag = rr(2.5, 17, 9.5, 25, 2.5), pocket = rr(5, 25, 4.5, 8, 1.5);
  s += P('t-a', bag + pocket, ' fill-rule="evenodd"');
  s += P('t-c', pocket);
  s += R('t-b', 2, 16, 10.5, 4, 1.2);
  s += R('t-b', 2.5, 37.5, 9.5, 4.5, 1.5);
  // canopy roof
  s += P('t-a', rr(12.5, 6.5, 45.5, 5.5, 2));
  s += P('t-b', 'M12.5 10H58V10.5Q58 12 56.5 12H14Q12.5 12 12.5 10.5Z');
  s += P('t-c', 'M16 7.8H42V8.6H16Z');
  // near posts
  s += L('M15 12V37M50 12L46 31', 2.4);
  // strap from bag to post
  s += L('M12 29H15', 1.8);
  // steering column + wheel
  s += L('M45.5 32L40.5 23', 1.6);
  s += E('t-b', 40, 22.5, 4, 1.3, -25);
  // bench seat
  s += P('t-a', rr(16.5, 18.5, 5.5, 18, 2.2));
  s += P('t-a', rr(17, 31.5, 19, 5.5, 2.2));
  s += P('t-b', 'M17 35H36Q36 37 34 37H19Q17 37 17 35Z');
  s += P('t-c', 'M18.2 21H19.2V29.5H18.2Z');
  // body tub with front cowl
  s += P('t-a', 'M10 37H43L46.5 31.5Q48.5 29 52 29.4L57 30.5Q61 31.6 61 36V43.5Q61 47 57.5 47H11Q7.5 47 7.5 43.5V39.5Q7.5 37 10 37Z');
  s += P('t-b', 'M7.5 42.5H61V43.5Q61 47 57.5 47H11Q7.5 47 7.5 43.5Z');
  s += P('t-c', 'M48.5 32Q50 31 52 31.3L56.5 32.3Q57.5 32.6 57 33.4L49 33.4Q48 33.2 48.5 32Z');
  s += R('t-c', 57.5, 35, 3, 3, 1);
  // small wheels
  for (const x of [19, 50]) { s += C('t-b', x, 49.5, 6.2); s += C('t-c', x, 49.5, 2.8); s += C('t-b', x, 49.5, 1.1); }
  s += P('t-c', spark(33, 3.2, 2.6) + spark(36, 18, 2.2));
  add('golf-cart', 'golf cart with a bag of clubs', s);
}

// ---------- snowmobile
{
  let s = '';
  // spray of snow thrown from the track
  s += P('t-c', circ(8, 47, 2.8) + circ(3.6, 42.5, 2.3) + circ(8.2, 38.5, 1.8) + circ(3.4, 34, 1.4) + circ(3.5, 50.5, 1.9));
  s += P('t-a', circ(5.8, 46.5, 1.3) + circ(11.5, 42.5, 1.4));
  // far ski + strut
  s += P('t-a', limb([[31, 50], [52, 50], [57, 45.5]], 2.2));
  s += L('M47.5 42L46 49.5');
  // handlebar + windscreen
  s += L('M37.5 33L36 26.5M33.5 26.5H38.5');
  s += P('t-c', 'M41.5 31.5L48.5 29.6L42 21.6Q41 20.8 40 21.6L38 23.5Z');
  // rubber track with bogie wheels
  const tr = cap(17.5, 47.5, 37.5, 47.5, 11.5), bw = circ(17.5, 47.5, 3.3) + circ(27.5, 48, 3) + circ(37.5, 47.5, 3.3);
  s += P('t-b', tr + bw, ' fill-rule="evenodd"');
  s += P('t-c', bw);
  let lug = '';
  for (let x = 14; x < 42; x += 4) lug += `M${x} 52.5h2.4v2.2h-2.4Z`;
  s += P('t-b', lug);
  // body: tunnel + hood
  const body = 'M11 37Q11 35 13 35H38L43.5 30.5Q46 28.5 49.5 29.5L58 33.5Q62 35.5 61.5 39.5L61 41Q60.5 43.5 57.5 43.5H13Q11 43.5 11 41.5Z';
  const lamp = 'M57 35.6L59.6 37Q60.3 37.5 60 38.4L59.4 38.4L56 36.6Z';
  s += P('t-a', body + lamp, ' fill-rule="evenodd"');
  s += P('t-c', lamp);
  s += P('t-b', 'M11 40H35L52 37L61.3 38.6L61 41Q60.5 43.5 57.5 43.5H13Q11 43.5 11 41.5Z');
  // seat
  const sh = 'M18 30.8H32.5V31.8H18Z';
  s += P('t-b', rpoly([[14, 29], [37, 29], [39, 35.5], [12, 35.5]], [3, 2, 1, 1]) + sh, ' fill-rule="evenodd"');
  s += P('t-c', sh);
  s += R('t-b', 9.5, 35, 3, 4.5, 1);
  // near ski + strut
  s += L('M51 42.5L49.5 51.5', 2.6);
  s += P('t-b', limb([[35, 53], [55.5, 53], [61, 47.5]], 2.8));
  s = `<g transform="translate(0 -3) rotate(-7 34 44)">${s}</g>` + P('t-c', spark(55, 11, 4) + spark(22, 16, 2.6));
  add('snowmobile', 'snowmobile kicking up snow', s);
}

// ---------- rickshaw
{
  let s = '';
  const hx = 19, hy = 37, rx = 17, ry = 26;
  const pt = a => { const r = a * Math.PI / 180; return `${f(hx + rx * Math.cos(r))} ${f(hy + ry * Math.sin(r))}`; };
  // folding striped hood: radial panels between the bows
  let hb = '', hc = '';
  const A = [-176, -147, -118, -89, -60, -31];
  for (let i = 0; i < 5; i++) {
    const d = `M${hx} ${hy}L${pt(A[i])}A${rx} ${ry} 0 0 1 ${pt(A[i + 1])}Z`;
    if (i % 2) hc += d; else hb += d;
  }
  s += P('t-b', hb) + P('t-c', hc);
  s += L(`M${hx} ${hy}L${pt(-31)}`, 2.6);
  s += C('t-b', hx, hy, 2.6);
  // frame: chain, down tube, top tube, seat tube, fork, stem
  s += L('M17 49.5L39 47', 1.2);
  s += L('M30 43L39 47L52.5 30.5M40.5 31L52 31M39 47L41 30M52.5 29L55 50.5M52.5 30L51.5 23.5', 2.2);
  s += L('M48.5 23.5H54.5', 2.6);
  // passenger carriage + bench + footboard
  s += P('t-a', rpoly([[5, 37], [31, 37], [29, 45], [7, 45]], [2, 2, 1.5, 1.5]));
  s += P('t-b', rpoly([[5, 34.5], [32, 34.5], [32, 38.5], [5, 38.5]], 1.8));
  s += P('t-b', 'M6.5 42.5H30L29.5 45H7Z');
  s += R('t-b', 28, 43.5, 11, 2.4, 1);
  // saddle
  s += P('t-b', 'M37.5 29.5Q38 28 40 28H44.5Q46 28.3 45 30Q42 31.5 38.5 31Q37.3 30.8 37.5 29.5Z');
  // wheels
  const wh = (x, y, r) => {
    let w = P('t-b', circ(x, y, r) + circ(x, y, r - 2), ' fill-rule="evenodd"');
    let sp = '';
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4 + .3, c = Math.cos(a) * (r - 2), d = Math.sin(a) * (r - 2); sp += `M${f(x - c)} ${f(y - d)}L${f(x + c)} ${f(y + d)}`; }
    return w + L(sp, 1) + C('t-b', x, y, 1.8);
  };
  s += wh(17, 49.5, 9.5) + wh(54.5, 50.5, 8);
  // pedals + crank
  s += L('M36 50.5L42 43.5', 1.8);
  s += C('t-b', 39, 47, 2.6);
  s += R('t-b', 34.2, 50, 3.6, 1.6, .6) + R('t-b', 40.2, 42.5, 3.6, 1.6, .6);
  s += P('t-c', spark(53, 9, 4) + spark(38, 16, 2.5));
  add('rickshaw', 'cycle rickshaw with a striped hood', s);
}
// ---------- dancer
{ let s = '';
  // quadratic curve sampled into limb points
  const qb = (a, c, b, n = 4) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });
  // music notes, all wound clockwise so they union: head, stem, flag, beam
  const nh = (x, y) => `M${f(x - 3.1)} ${f(y + 1.1)}A3.3 2.5 -20 1 1 ${f(x + 3.1)} ${f(y - 1.1)}A3.3 2.5 -20 1 1 ${f(x - 3.1)} ${f(y + 1.1)}Z`;
  const st = (x, y, t) => `M${f(x + 1.7)} ${f(y)}V${f(t)}H${f(x + 3.3)}V${f(y)}Z`;
  const fl = (x, t) => `M${f(x + 3.3)} ${f(t)}Q${f(x + 4)} ${f(t + 2.5)} ${f(x + 6.8)} ${f(t + 4.2)}Q${f(x + 8.6)} ${f(t + 5.6)} ${f(x + 7.2)} ${f(t + 8.2)}Q${f(x + 7)} ${f(t + 5.6)} ${f(x + 3.3)} ${f(t + 4.6)}Z`;
  const bm = (x1, t1, x2, t2) => `M${f(x1 + 1.7)} ${f(t1)}L${f(x2 + 3.3)} ${f(t2)}V${f(t2 + 3)}L${f(x1 + 1.7)} ${f(t1 + 3)}Z`;
  // floor shadow under the pointe toe
  s += E('t-b', 37.5, 61.6, 5.5, 1.3);
  // back arm (shade), raised in a curve
  s += P('t-b', limb(qb([34, 22], [21.5, 16.5], [25.5, 4]), 5.5));
  // body: torso, flared skirt, front arm, standing leg on tiptoe, leg kicked up behind
  s += P('t-a', cap(36.5, 21, 32, 31, 9.5) + rpoly([[17, 38], [45, 39.5], [36.5, 28.5], [28, 27.5]], [2.5, 2.5, 2, 2]) +
    limb(qb([37.5, 22], [51, 18], [49, 4]), 5.5) +
    limb([[33, 37], [35, 52.5]], 6.5) + cap(35, 52.5, 37, 59.5, 5) +
    limb([[29.5, 36], [18.5, 33.5], [8.5, 27]], 6.5) + cap(8.5, 27, 4.5, 24.5, 5));
  // petticoat ruffle along the skirt hem, laid over the tops of the legs
  const hm = x => 38 + (x - 17) * 1.5 / 28;
  let pc = `M18 ${f(hm(18))}L44 ${f(hm(44))}L44.6 ${f(hm(44.6) + 1.2)}`;
  for (let x = 44.6; x > 19; x -= 6.65) pc += `Q${f(x - 3.3)} ${f(hm(x - 3.3) + 4.8)} ${f(x - 6.65)} ${f(hm(x - 6.65) + 1.2)}`;
  s += P('t-b', pc + 'Z');
  // head with cut-out highlight
  const hx = 38, hy = 11;
  const hl = `M${f(hx - 4.6)} ${f(hy - 1)}A5 5 0 0 1 ${f(hx - 1.6)} ${f(hy - 5.3)}L${f(hx - 1)} ${f(hy - 4.1)}A3.8 3.8 0 0 0 ${f(hx - 3.4)} ${f(hy - .8)}Z`;
  s += P('t-a', circ(hx, hy, 5.4) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', `M${f(hx + 5)} ${f(hy - 2.5)}A5.4 5.4 0 0 1 ${f(hx - 2.7)} ${f(hy + 4.7)}A6.3 6.3 0 0 0 ${f(hx + 5)} ${f(hy - 2.5)}Z`);
  // music notes and sparkles
  s += P('t-a', nh(52, 27) + st(52, 27, 15) + fl(52, 15) + nh(46, 54) + st(46, 54, 42) + nh(56, 51) + st(56, 51, 39) + bm(46, 42, 56, 39) + nh(11, 55) + st(11, 55, 44) + fl(11, 44));
  s += P('t-c', spark(9, 14, 4) + spark(58, 6, 2.6));
  add('dancer', 'figure dancing on tiptoe to music', s); }

fs.writeFileSync(process.argv[2] || new URL('../../icons/part17.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
