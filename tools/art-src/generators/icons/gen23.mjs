// Generates part23.json (round 4: sun-and-sky subjects).
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
const pt = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
const drop = (x, y, s) => `M${f(x)} ${f(y - 2 * s)}Q${f(x + 1.1 * s)} ${f(y - .4 * s)} ${f(x + s)} ${f(y + .3 * s)}A${f(s)} ${f(s)} 0 0 1 ${f(x - s)} ${f(y + .3 * s)}Q${f(x - 1.1 * s)} ${f(y - .4 * s)} ${f(x)} ${f(y - 2 * s)}Z`;
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
// arc of a circle from deg a0 to a1 as an open path
const arc = (cx, cy, r, a0, a1) => { const p = pt(cx, cy, r, a0), q = pt(cx, cy, r, a1);
  return `M${f(p[0])} ${f(p[1])}A${f(r)} ${f(r)} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${f(q[0])} ${f(q[1])}`; };
// ray wedge from radius r0 to r1 at angle deg, half-width w at base
const ray = (cx, cy, r0, r1, deg, w) => { const a = deg * Math.PI / 180, n = [-Math.sin(a), Math.cos(a)];
  const b = pt(cx, cy, r0, deg), t = pt(cx, cy, r1, deg);
  return poly([[b[0] + n[0] * w, b[1] + n[1] * w], t, [b[0] - n[0] * w, b[1] - n[1] * w]]); };

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- sunscreen-bottle
{
  let g = '';
  const body = 'M21 17H37Q43 19 43 27V55Q43 59 39 59H19Q15 59 15 55V27Q15 19 21 17Z';
  const label = rpoly([[19, 28], [39, 28], [39, 51], [19, 51]], 3);
  const shine = cap(17.8, 30, 17.8, 50, 1.8);
  g += P('t-a', body + label + shine, ' fill-rule="evenodd"');
  g += P('t-b', 'M40.6 22Q43 23.5 43 27V55Q43 59 39 59H36.5Q40.6 58 40.6 54Z');
  g += P('t-c', label + shine);
  // sun print on label
  let rays = ''; for (let k = 0; k < 8; k++) rays += ray(29, 37, 5.6, 8.6, k * 45 + 22.5, 1.5);
  g += P('t-b', circ(29, 37, 4.4) + rays);
  g += R('t-b', 23.5, 46.2, 11, 2, 1);
  // neck and flip cap
  g += R('t-b', 23, 13, 12, 5, 1);
  g += P('t-a', rpoly([[21, 4.5], [37, 4.5], [37.5, 13.5], [20.5, 13.5]], 2.5));
  g += P('t-b', 'M20.6 10.5H37.4V12Q37.4 13.5 36 13.5H22Q20.6 13.5 20.6 12Z');
  g += P('t-b', 'M31 5V3.2Q31 2.2 32 2.2H34Q35 2.2 35 3.2V5Z');
  let s = `<g transform="translate(-5.5 1.2) rotate(-10 32 34)">${g}</g>`;
  // lotion puddle and a falling drop
  const pud = 'M45 58.5Q42.5 58 43.5 55.5Q45 52.5 49.5 53Q51.5 49.5 55 51Q58 50 59.5 53Q62.5 54 61.8 56.8Q61.2 58.6 58.5 58.5Z';
  const dr = drop(52.5, 42.5, 3.2);
  s += P('t-c', pud + dr);
  s += L(pud.replace('Z', '') + 'L45 58.5', 1.3) + L(dr, 1.3);
  s += P('t-b', 'M47 56.6Q52 57.6 58.5 56.4Q60 56.4 59.4 57.4Q52 59 47 57.6Z');
  s += P('t-c', spark(52, 12, 4) + spark(59, 27, 2.6) + circ(46, 34, 1));
  add('sunscreen-bottle', 'squeeze bottle of sun lotion with a sun on the label and a drop of lotion', s);
}

// ---------- rain-cloud
{
  let s = '';
  const sx = 46, sy = 21;
  let rays = ''; for (const d of [-160, -128, -96, -64, -32, 0]) rays += ray(sx, sy, 11.5, 16.5, d, 2.2);
  s += P('t-b', rays);
  s += P('t-a', circ(sx, sy, 10));
  s += P('t-b', arc(sx, sy, 10, -40, 60) + `A12 12 0 0 0 ${f(pt(sx, sy, 10, -40)[0])} ${f(pt(sx, sy, 10, -40)[1])}Z`);
  // cloud body (cream) with a shade band under it
  const cl = circ(18, 33, 8.5) + circ(30, 25.5, 12.5) + circ(43.5, 31, 9.5) + circ(53, 35.5, 6) + rpoly([[10, 32], [10, 41.5], [58.5, 41.5], [58.5, 32]], 4.5);
  s += P('t-b', 'M9.5 39H59V41.5Q59 46 54.5 46H14Q9.5 46 9.5 41.5Z');
  s += P('t-c', cl);
  // rain
  s += P('t-b', drop(16, 52, 2.4) + drop(27, 56, 2.4) + drop(38, 51.5, 2.4) + drop(49, 55.5, 2.4) + drop(21.5, 60, 1.6) + drop(43.5, 60.2, 1.6) + drop(56.5, 50, 1.6) + drop(10.5, 57.5, 1.6));
  s += P('t-c', spark(8, 11, 4) + spark(20, 5.5, 2.2));
  add('rain-cloud', 'fat rain cloud with falling drops and the sun peeking out behind', s);
}

// ---------- four-seasons-tree
{
  let s = '';
  const cx = 32, cy = 26, Rr = 21.5;
  const sector = (a0, a1, nb, ox, oy) => {
    const c = [cx + ox, cy + oy]; let d = `M${f(c[0])} ${f(c[1])}`; const st = pt(c[0], c[1], Rr, a0); d += `L${f(st[0])} ${f(st[1])}`;
    for (let i = 0; i < nb; i++) { const q = pt(c[0], c[1], Rr, a0 + (a1 - a0) * (i + 1) / nb); const ch = 2 * Rr * Math.sin((a1 - a0) / nb / 2 * Math.PI / 180);
      d += `A${f(ch * .58)} ${f(ch * .58)} 0 0 1 ${f(q[0])} ${f(q[1])}`; }
    return d + 'Z';
  };
  const g = 1;
  // trunk and winter branches
  s += P('t-a', 'M28.5 30H35.5L36 52Q37 56.5 42 58.5H22Q27 56.5 28 52Z');
  s += P('t-b', 'M33 48H35.8L36 52Q37 56.5 42 58.5H35Q33.3 55 33 50Z');
  s += P('t-c', 'M8 59.5Q10 55.5 17 56Q22 55 24.5 58.5Q25 60.5 22.5 60.5H9.5Q7.5 60.5 8 59.5Z');
  // snow caps (drawn under the branches)
  s += P('t-c', 'M14.6 33.6Q16.5 31.2 20 32.6Q19.6 34.4 16.5 34.6Z' + 'M21 40Q23.5 37.8 26.5 39.4Q25.5 41.2 22.5 41.2Z' + 'M11.5 40.5Q13.5 38.5 16.6 39.8Q15.6 41.6 12.8 41.6Z');
  s += P('t-a', limb([[30, 46], [22, 40], [12.5, 41]], 2.6) + limb([[22.5, 40.5], [17, 34]], 2) + limb([[29.5, 38], [24.5, 31]], 2.2) + limb([[24.5, 31.2], [20.5, 30]], 1.6) + limb([[25.5, 33.5], [16, 34]], 1.6));
  s += P('t-c', circ(12, 47, 1.1) + circ(19, 47.5, .9) + circ(15.5, 51, .9));
  // spring: leaf mass with blossoms cut out
  const fl = [[18, 18, 2.7], [26, 12.5, 2.7], [25.5, 21.5, 2.6], [15.5, 25.5, 2.3], [19.5, 9.5, 2.1], [12.5, 19.5, 1.8]];
  s += P('t-a', sector(180, 270, 3, -g, -g) + fl.map(([x, y, r]) => circ(x, y, r)).join(''), ' fill-rule="evenodd"');
  s += P('t-c', fl.map(([x, y, r]) => circ(x, y, r)).join(''));
  s += P('t-b', fl.map(([x, y, r]) => circ(x, y, r * .38)).join(''));
  // summer: full leaf
  s += P('t-a', sector(270, 360, 3, g, -g));
  s += P('t-b', 'M42 12Q46 11.5 47 14.5Q44 16 42 12ZM37 18.5Q41 18 42 21Q39 22.5 37 18.5ZM38.5 9Q41.5 7.5 43.5 9.5Q41 11.5 38.5 9Z' + arc(cx + g, cy - g, Rr, 300, 360) + `L${f(cx + g + 17)} ${f(cy - g)}A18 18 0 0 0 ${f(pt(cx + g, cy - g, Rr, 300)[0])} ${f(pt(cx + g, cy - g, Rr, 300)[1])}Z`);
  // autumn: rusty quarter with leaf marks and falling leaves
  const leaf = (x, y, l, rot) => { const a = rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), T = (u, v) => [x + u * c - v * sn, y + u * sn + v * c];
    const p0 = T(-l / 2, 0), p1 = T(l / 2, 0), q1 = T(0, -l * .42), q2 = T(0, l * .42);
    return `M${f(p0[0])} ${f(p0[1])}Q${f(q1[0])} ${f(q1[1])} ${f(p1[0])} ${f(p1[1])}Q${f(q2[0])} ${f(q2[1])} ${f(p0[0])} ${f(p0[1])}Z`; };
  s += P('t-b', sector(0, 90, 3, g, g));
  s += P('t-a', leaf(40, 32, 6, -30) + leaf(46.5, 36.5, 5.5, 20) + leaf(38, 40, 5, 60));
  s += P('t-b', leaf(57, 49, 5.5, 35) + leaf(51, 55.5, 5, -25));
  s += P('t-c', spark(57, 8, 3.6) + spark(7, 11, 2.6));
  add('four-seasons-tree', 'one tree whose crown is split into blossom, full leaf, autumn and bare snowy quarters', s);
}

// ---------- solar-system
{
  let s = '';
  const sx = 15.5, sy = 32;
  const orbit = r => { const a = Math.asin(Math.min(1, 26 / r)) * 180 / Math.PI; return arc(sx, sy, r, -a, a); };
  s += L(orbit(17.5) + orbit(27.5) + orbit(38.5), 1.3);
  let rays = ''; for (let k = 0; k < 10; k++) rays += ray(sx, sy, 9.5, 13.2, k * 36, 2);
  s += P('t-b', rays);
  s += P('t-a', circ(sx, sy, 8.6) + `M${f(sx - 5.8)} ${f(sy - 2)}A6 6 0 0 1 ${f(sx - 1.5)} ${f(sy - 6.2)}A7.5 7.5 0 0 0 ${f(sx - 5.8)} ${f(sy - 2)}Z`, ' fill-rule="evenodd"');
  s += P('t-c', `M${f(sx - 5.8)} ${f(sy - 2)}A6 6 0 0 1 ${f(sx - 1.5)} ${f(sy - 6.2)}A7.5 7.5 0 0 0 ${f(sx - 5.8)} ${f(sy - 2)}Z`);
  s += P('t-b', arc(sx, sy, 8.6, -20, 110) + `A10 10 0 0 0 ${f(pt(sx, sy, 8.6, -20)[0])} ${f(pt(sx, sy, 8.6, -20)[1])}Z`);
  // planet 1 (small, inner)
  const p1 = pt(sx, sy, 17.5, -52); s += P('t-b', circ(p1[0], p1[1], 3));
  // planet 2 (blue world)
  const p2 = pt(sx, sy, 27.5, 36);
  s += P('t-a', circ(p2[0], p2[1], 5));
  s += P('t-b', `M${f(p2[0] - 3)} ${f(p2[1] - 2)}Q${f(p2[0])} ${f(p2[1] - 4.5)} ${f(p2[0] + 2)} ${f(p2[1] - 1)}Q${f(p2[0])} ${f(p2[1] + 1)} ${f(p2[0] - 1)} ${f(p2[1] + 3.5)}Q${f(p2[0] - 4)} ${f(p2[1] + 1)} ${f(p2[0] - 3)} ${f(p2[1] - 2)}Z` + arc(p2[0], p2[1], 5, -30, 110) + `A6 6 0 0 0 ${f(pt(p2[0], p2[1], 5, -30)[0])} ${f(pt(p2[0], p2[1], 5, -30)[1])}Z`);
  // planet 3 (ringed giant)
  const p3 = pt(sx, sy, 38.5, -20), [x3, y3] = p3;
  const ringOut = (rx, ry, front) => `M${f(x3 - rx)} ${f(y3)}A${f(rx)} ${f(ry)} 0 0 ${front ? 0 : 1} ${f(x3 + rx)} ${f(y3)}`;
  s += `<g transform="rotate(-18 ${f(x3)} ${f(y3)})">`;
  s += P('t-b', ringOut(11, 3.6, false) + `L${f(x3 + 7.6)} ${f(y3)}A7.6 1.8 0 0 0 ${f(x3 - 7.6)} ${f(y3)}Z`);
  s += P('t-a', circ(x3, y3, 6.2));
  s += P('t-b', `M${f(x3 - 6.3)} ${f(y3 - 2.2)}H${f(x3 + 6.3)}V${f(y3 - 1)}H${f(x3 - 6.4)}Z`);
  s += P('t-b', ringOut(10, 3.4, true) + `L${f(x3 + 7.6)} ${f(y3)}A7.6 1.8 0 0 1 ${f(x3 - 7.6)} ${f(y3)}Z`);
  s += '</g>';
  // tiny outer moon / dwarf
  const p4 = pt(sx, sy, 38.5, 32); s += P('t-a', circ(p4[0], p4[1], 2.4));
  s += P('t-c', spark(32, 7, 3.4) + spark(55, 56, 3) + circ(8, 54, 1) + circ(42, 32, .9));
  add('solar-system', 'sun with planets on curved orbit lines', s);
}

// ---------- cratered-planet
{
  let s = '';
  // big sun edge in the top-left corner
  const sunEdge = 'M5 1.5H30A28.5 28.5 0 0 1 1.5 30V5Q1.5 1.5 5 1.5Z';
  let rays = ''; for (const d of [8, 22, 36, 50, 64, 78]) rays += ray(1.5, 1.5, 31, 36.5, d, 2.4);
  s += P('t-b', rays);
  s += P('t-a', sunEdge);
  s += P('t-b', 'M30 1.5A28.5 28.5 0 0 1 1.5 30V26A24.5 24.5 0 0 0 26 1.5Z');
  s += P('t-c', circ(8.5, 9, 1.4) + circ(15, 6.5, 1) + circ(6.5, 16, 1));
  // planet
  const cx = 39.5, cy = 39.5, R0 = 20;
  const lit = `M${f(cx - 16)} ${f(cy - 7)}A16 16 0 0 1 ${f(cx - 7)} ${f(cy - 16)}A18 18 0 0 0 ${f(cx - 16)} ${f(cy - 7)}Z`;
  s += P('t-a', circ(cx, cy, R0) + lit, ' fill-rule="evenodd"');
  s += P('t-c', lit);
  s += P('t-b', arc(cx, cy, R0, -40, 130) + `A23 23 0 0 0 ${f(pt(cx, cy, R0, -40)[0])} ${f(pt(cx, cy, R0, -40)[1])}Z`);
  // craters: dark bowl with a lit floor
  const cr = [[34, 33, 4.6], [45, 29.5, 3.2], [31.5, 45.5, 3.4], [44, 44, 5], [25.5, 36.5, 2.2], [38.5, 53, 2.3], [52, 37.5, 2.2], [37.5, 23.5, 1.8]];
  s += P('t-b', cr.map(([x, y, r]) => circ(x, y, r)).join(''));
  s += P('t-a', cr.map(([x, y, r]) => circ(x + r * .2, y + r * .22, r * .68)).join(''));
  s += P('t-c', spark(57.5, 9, 3.6) + spark(9.5, 55, 3) + circ(53, 16, 1));
  add('cratered-planet', 'small rocky cratered planet right next to the edge of a huge sun', s);
}

// ---------- cloudy-planet
{
  let s = '';
  const cx = 32, cy = 32.5, R0 = 20.5;
  const clamp = ([x, y]) => { const dx = x - cx, h = Math.sqrt(Math.max(0, R0 * R0 - dx * dx)); return [x, Math.max(cy - h, Math.min(cy + h, y))]; };
  const band = (y0, a, w, ph, k = 1) => { const top = [], bot = [];
    for (let i = 0; i <= 12; i++) { const x = cx - R0 + 2 * R0 * i / 12, t = i / 12 * Math.PI * 2 * k + ph, yc = y0 + a * Math.sin(t) + (x - cx) * .18, ww = w * (.7 + .3 * Math.cos(t * 1.3));
      top.push(clamp([x, yc - ww])); bot.push(clamp([x, yc + ww])); }
    return poly([...top, ...bot.reverse()]); };
  // hazy glow rings
  s += P('t-c', circ(cx, cy, 25.5));
  s += L(arc(cx, cy, 27.6, 150, 230) + arc(cx, cy, 27.6, -30, 50), 1.2);
  const light = band(22, 3, 2.6, 0, 1.4) + band(38, 2.8, 2.4, 2.2, 1.3);
  const swirl = `M${f(cx - 6)} ${f(cy + 3)}a4 3 0 1 1 6 1.5a2.2 1.6 0 1 1 -3.3 -1.5a1 1 0 0 0 -2.7 0Z`;
  s += P('t-a', circ(cx, cy, R0) + light, ' fill-rule="evenodd"');
  s += P('t-c', light);
  s += P('t-b', band(30, 2.6, 1.8, 1.1, 1.4) + band(46, 2, 1.8, 3.5, 1.2) + band(14.5, 1.6, 1.3, 2.6, 1.3));
  s += P('t-b', arc(cx, cy, R0, -55, 105) + `A24 24 0 0 0 ${f(pt(cx, cy, R0, -55)[0])} ${f(pt(cx, cy, R0, -55)[1])}Z`);
  s += L(`M${f(cx - 12)} ${f(cy - 3)}q4 -4.5 8.5 -1q3 3 -1 4.5q-3 .5 -2.6 -2M${f(cx + 2)} ${f(cy + 10)}q4 3.5 8 .5q2.5 -2.6 -.6 -4q-2.6 -.6 -2.4 1.8`, 1.5);
  s += P('t-c', spark(7, 8, 3.8) + spark(58, 57, 3) + circ(57, 9, 1.1) + circ(6, 56, 1));
  add('cloudy-planet', 'planet wrapped in thick swirling cloud bands with a hazy glow', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part23.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
