// Generates part18.json (round 4: art, body, books subjects).
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
const pt = p => f(p[0]) + ' ' + f(p[1]);
// closed / open Catmull-Rom splines as cubic paths
const crc = (q, t = 1) => {
  const n = q.length; let d = 'M' + pt(q[0]);
  for (let i = 0; i < n; i++) {
    const a = q[(i + n - 1) % n], b = q[i], c = q[(i + 1) % n], e = q[(i + 2) % n];
    d += `C${pt([b[0] + (c[0] - a[0]) / 6 * t, b[1] + (c[1] - a[1]) / 6 * t])} ${pt([c[0] - (e[0] - b[0]) / 6 * t, c[1] - (e[1] - b[1]) / 6 * t])} ${pt(c)}`;
  }
  return d + 'Z';
};
const cro = q => {
  let d = 'M' + pt(q[0]);
  for (let i = 0; i < q.length - 1; i++) {
    const a = q[Math.max(i - 1, 0)], b = q[i], c = q[i + 1], e = q[Math.min(i + 2, q.length - 1)];
    d += `C${pt([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6])} ${pt([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6])} ${pt(c)}`;
  }
  return d;
};
// sample an open Catmull-Rom spline: [x, y, tx, ty]
const crSample = (q, per = 8) => {
  const out = [];
  for (let i = 0; i < q.length - 1; i++) {
    const a = q[Math.max(i - 1, 0)], b = q[i], c = q[i + 1], e = q[Math.min(i + 2, q.length - 1)];
    const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6], c2 = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    for (let k = 0; k < per || (i === q.length - 2 && k === per); k++) {
      const t = k / per, u = 1 - t;
      const x = u * u * u * b[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * c[0];
      const y = u * u * u * b[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * c[1];
      const tx = 3 * u * u * (c1[0] - b[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (c[0] - c2[0]);
      const ty = 3 * u * u * (c1[1] - b[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (c[1] - c2[1]);
      out.push([x, y, tx, ty]);
    }
  }
  return out;
};
// rotate points about a centre
const rot = (q, cx, cy, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return q.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]); };
const poly = q => 'M' + q.map(pt).join('L') + 'Z';

// ---------- color-wheel
{
  let s = '';
  const cx = 30, cy = 30, ro = 25.5, ri = 8.8, n = 12, h = .75;
  const P2 = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const by = { 't-a': '', 't-b': '', 't-c': '' }, K = ['t-a', 't-c', 't-b'];
  for (let k = 0; k < n; k++) {
    const a0 = (-105 + k * 30) * Math.PI / 180, a1 = a0 + Math.PI / 6;
    const di = Math.asin(h / ri), dO = Math.asin(h / ro);
    by[K[k % 3]] += `M${pt(P2(ri, a0 + di))}L${pt(P2(ro, a0 + dO))}A${ro} ${ro} 0 0 1 ${pt(P2(ro, a1 - dO))}L${pt(P2(ri, a1 - di))}A${ri} ${ri} 0 0 0 ${pt(P2(ri, a0 + di))}Z`;
  }
  s += P('t-a', by['t-a']) + P('t-c', by['t-c']) + P('t-b', by['t-b']);
  // hub
  s += P('t-a', circ(cx, cy, 6.6) + circ(cx, cy, 2.4), ' fill-rule="evenodd"');
  s += P('t-b', `M${cx + 6.6} ${cy}A6.6 6.6 0 0 1 ${cx - 6.6} ${cy}A6.6 4.6 0 0 0 ${cx + 6.6} ${cy}Z`);
  // brush resting across the lower right
  let g = '';
  const out = 'M0 0Q3 -3.6 9.5 -3.2L15.5 -3.2L16 -2.7L27.5 -1.8A1.8 1.8 0 0 1 27.5 1.8L16 2.7L15.5 3.2L9.5 3.2Q3 3.6 0 0Z';
  g += L(out, 3.2);
  g += P('t-b', 'M0 0Q3 -3.6 9.5 -3.2V3.2Q3 3.6 0 0Z');
  g += R('t-c', 9.5, -3.2, 6, 6.4, .5);
  g += P('t-a', 'M16 -2.7L27.5 -1.8A1.8 1.8 0 0 1 27.5 1.8L16 2.7Z');
  g += L('M13 -3V3', 1.1);
  s += `<g transform="translate(35 36) rotate(41)">${g}</g>`;
  s += P('t-c', spark(57.5, 8, 3.4) + spark(6.5, 57, 3));
  add('color-wheel', 'colour wheel with a paintbrush resting on it', s);
}

// ---------- calligraphy-nib
{
  let s = '';
  const tx = 25, ty = 39, A = 45;
  // ink flourish: broad-nib ribbon ending at the nib tip
  const path = [[56, 58], [40, 58.5], [22, 56.5], [9, 49], [6.5, 38], [12, 30], [20.5, 31], [24, 38.5], [22, 47], [16, 52.5], [13, 47], [18.5, 41], [tx, ty]];
  const smp = crSample(path, 7), na = -40 * Math.PI / 180, lft = [], rgt = [];
  smp.forEach(([x, y, dx, dy], i) => {
    const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    const th = Math.atan2(uy, ux), u = i / (smp.length - 1);
    let w = .9 + 4.2 * Math.abs(Math.sin(th - na));
    w *= Math.min(1, u / .12 + .15) * Math.min(1, (1 - u) / .1 + .3);
    lft.push([x - uy * w / 2, y + ux * w / 2]); rgt.unshift([x + uy * w / 2, y - ux * w / 2]);
  });
  s += P('t-b', poly(lft.concat(rgt)));
  // ink drops
  s += P('t-b', circ(33, 51, 1.3) + circ(36.5, 49, .8));
  // nib, drawn pointing down then turned
  let g = '';
  const nib = 'M0 0Q3.2 -8 8.6 -17Q11 -21.5 9.2 -25.5L7.2 -27.5V-35H-7.2V-27.5L-9.2 -25.5Q-11 -21.5 -8.6 -17Q-3.2 -8 0 0Z';
  const nhl = 'M-5.5 -19Q-4.5 -12 -1.8 -6Q-6 -11 -7.6 -18Z';
  const holes = 'M-.6 -1.8H.6V-15H-.6Z' + circ(0, -17.3, 2.5) + nhl;
  g += R('t-b', -8.4, -42.5, 16.8, 10, 2.6);
  g += R('t-a', -8.4, -42.5, 16.8, 3.2, 1.6);
  g += P('t-a', nib + holes, ' fill-rule="evenodd"');
  g += P('t-b', 'M8.6 -17Q11 -21.5 9.2 -25.5L7.2 -27.5V-35H5V-27.5Q7.4 -23 5.6 -17Q3 -9 .9 -2.5Q3.2 -8 8.6 -17Z');
  g += P('t-b', 'M-7.2 -30H7.2V-31.6H-7.2Z');
  g += L('M-2.5 -21Q-5 -23.5 -4.5 -27M2.5 -21Q5 -23.5 4.5 -27', 1.2);
  g += P('t-c', nhl);
  s += `<g transform="translate(${tx} ${ty}) rotate(${A}) scale(.92)">${g}</g>`;
  s += P('t-c', spark(8, 8, 3.8) + spark(56, 41, 3));
  add('calligraphy-nib', 'fountain pen nib finishing an ink flourish', s);
}

// ---------- anatomical-heart
{
  let s = '';
  // superior vena cava stub (back, left)
  s += P('t-b', rpoly([[9, 14], [18, 14], [18, 36], [9, 36]], [3, 3, 0, 0]));
  // aorta (light): ascending, arch, descending limb behind the body; three stubby branches
  const ax = 31.5, ay = 20, rc = 8, tw = 10, ri = rc - tw / 2, ro = rc + tw / 2;
  const arch = `M${f(ax - ro)} 36V${ay}A${f(ro)} ${f(ro)} 0 0 1 ${f(ax + ro)} ${ay}V34H${f(ax + ri)}V${ay}A${f(ri)} ${f(ri)} 0 0 0 ${f(ax - ri)} ${ay}V36Z`;
  const br = [-124, -94, -64].map(d => { const a = d * Math.PI / 180; return cap(ax + (ro - 2) * Math.cos(a), ay + (ro - 2) * Math.sin(a), ax + (ro + 1.2) * Math.cos(a), ay + (ro + 1.2) * Math.sin(a), 4.6); }).join('');
  s += P('t-c', br) + P('t-c', arch);
  // plump heart body, apex low right, highlight cut out
  const body = crc([[12, 31], [24, 28], [36, 29], [48, 30], [56.5, 37.5], [57.5, 47], [53, 55], [46, 60], [33, 58.5], [19, 53], [8.5, 43]]);
  const hl = 'M14 39Q16.5 33.5 23.5 32.5Q18 36.5 17.4 42Q15.2 43 14 39Z';
  s += P('t-a', body + hl, ' fill-rule="evenodd"');
  s += P('t-b', 'M56 39Q60 48 53.5 55.5Q49 60 46 60Q33 59.5 24 54.5Q38 57 46 52.5Q54 48 56 39Z');
  // pulmonary trunk: one thick stub rising in front of the descending aorta
  s += P('t-b', cap(38.5, 36, 47, 23, 9));
  // two coronary lines
  s += L('M36 40Q36 48 41 52.5Q44.5 56 45 59', 2.2);
  s += L('M21 31Q15.5 37 16.5 47', 1.6);
  s += P('t-c', hl);
  s += P('t-c', spark(6, 57, 3.2) + spark(57.5, 9, 3.4));
  add('anatomical-heart', 'anatomical heart with aortic arch and vessels', s);
}

// ---------- spine
{
  let s = '';
  const N = 8, gap = 1.75, amp = 2.8, per = 52;
  const X = y => 32 + amp * Math.sin((y - 4) / per * 2 * Math.PI);
  const ANG = y => -Math.atan(amp * 2 * Math.PI / per * Math.cos((y - 4) / per * 2 * Math.PI)) * 180 / Math.PI * .7;
  let y = 4.2, bodies = '', wings = '', discs = '', shade = '';
  for (let i = 0; i < N; i++) {
    const hb = 2.9 + .18 * i, a = 3.6 + .45 * i, ww = 2.2 + .48 * i, b = hb / 2, cy = y + b, cx = X(cy), an = ANG(cy);
    bodies += rpoly(rot([[-a, -b], [a, -b], [a, b], [-a, b]], cx, cy, an), 1.1);
    shade += poly(rot([[-a + .4, b * .25], [a - .4, b * .25], [a - .9, b], [-a + .9, b]], cx, cy, an));
    const w = rot([[-a - ww, -b * .35], [a + ww, -b * .35]], cx, cy, an);
    wings += `M${pt(w[0])}L${pt(w[1])}`;
    y += hb;
    if (i < N - 1) {
      const dy = y + gap / 2, da = a * .82 + .2;
      discs += poly(rot([[-da, -gap / 2 - .6], [da, -gap / 2 - .6], [da, gap / 2 + .6], [-da, gap / 2 + .6]], X(dy), dy, ANG(dy)));
      y += gap;
    }
  }
  // sacrum: shield with paired holes, coccyx tip
  const sy = y + gap, sx = X(sy);
  const sac = rpoly([[sx - 10.5, sy], [sx + 10.5, sy], [sx + 7, sy + 6.4], [sx + 1.6, sy + 10.8], [sx, sy + 12.6], [sx - 1.6, sy + 10.8], [sx - 7, sy + 6.4]], [1.5, 1.5, 2, .8, .5, .8, 2]);
  const fo = [[-4, 2.9, 1.25], [4, 2.9, 1.25], [-2.8, 6.4, 1], [2.8, 6.4, 1]].map(([x, yy, r]) => circ(sx + x, sy + yy, r)).join('');
  discs += poly([[sx - 7, y - .6], [sx + 7, y - .6], [sx + 7, sy + .6], [sx - 7, sy + .6]]);
  s += L(wings, 2.6);
  s += P('t-c', discs);
  s += P('t-a', bodies);
  s += P('t-b', shade);
  s += P('t-a', sac + fo, ' fill-rule="evenodd"');
  s += P('t-b', `M${f(sx + 10.5)} ${f(sy + .8)}L${f(sx + 7)} ${f(sy + 6.4)}L${f(sx + 1.6)} ${f(sy + 10.8)}L${f(sx)} ${f(sy + 12.6)}L${f(sx + .8)} ${f(sy + 9.2)}L${f(sx + 5.6)} ${f(sy + 5.2)}Z`);
  s += P('t-c', spark(10, 10, 4) + spark(54.5, 54, 3.3));
  add('spine', 'S-curved spine of vertebrae with discs', s);
}

// ---------- foot
{
  let s = '';
  const cx = 31, cy = 32.6, A = 10;
  const T = q => rot(q.map(([x, y]) => [x * .95, y * .95]), cx, cy, A);
  const ell = (x, y, rx, ry, d) => { const a = d * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a); return `M${f(x - rx * c)} ${f(y - rx * sn)}a${f(rx)} ${f(ry)} ${f(d)} 1 0 ${f(2 * rx * c)} ${f(2 * rx * sn)}a${f(rx)} ${f(ry)} ${f(d)} 1 0 ${f(-2 * rx * c)} ${f(-2 * rx * sn)}Z`; };
  // sole in foot-local coords: big toe side on the left, heel at the bottom
  const sole = [[-12, -11], [-5, -15.5], [3, -15.2], [9.5, -12.2], [12.6, -6], [12, 3], [10.6, 12], [9.6, 19], [8, 24.8], [3.5, 28.2], [-2, 28], [-6.6, 24.5], [-7.6, 18], [-5, 9.5], [-6, 2], [-10, -4.5]];
  const hl = [[-9.8, -7], [-7.5, -11], [-5, -12.6], [-7.6, -9.4], [-8.4, -4.5]];
  s += P('t-a', crc(T(sole)) + crc(T(hl), .6), ' fill-rule="evenodd"');
  // toes: big toe left, four smaller ones arcing down to the right
  const toes = [[-7.6, -22, 4.9, 6.3, -6], [1.2, -22.8, 3.2, 4.1, 2], [7.2, -20.6, 2.8, 3.6, 12], [11.6, -16.9, 2.5, 3.1, 24], [14.6, -12.3, 2.1, 2.7, 36]];
  const tc = T(toes);
  s += P('t-a', toes.map((t, i) => ell(tc[i][0], tc[i][1], t[2], t[3], t[4] + A)).join(''));
  // instep: the arch lifting away on the big-toe side; shade down the outer edge and heel
  s += P('t-b', crc(T([[-7, -1.5], [-3.6, 4], [-2.6, 11], [-5, 18.5], [-7.3, 16.5], [-5.3, 9.5], [-6.6, 2.5]]), .8));
  s += P('t-b', crc(T([[11.8, 2], [10.4, 13], [8.8, 22], [4, 27.6], [7.4, 19.5], [9, 10]]), .8));
  s += P('t-c', spark(54, 50, 3.6) + spark(8.5, 47, 3) + spark(54, 9, 2.6));
  add('foot', 'bare foot seen from the sole with five toes', s);
}

// ---------- scroll
{
  let s = '';
  // paper sheet with verse lines cut out of it
  const paper = 'M10 13H42V47Q36 45 26 48.5Q18 51 10 49Z';
  const vl = [[14, 18, 22], [18, 22.5, 18], [14, 27, 23], [18, 31.5, 14], [14, 37.5, 21], [18, 42, 12]].map(([x, y, w]) => `M${x + 1.1} ${y}H${x + w - 1.1}A1.1 1.1 0 0 1 ${x + w - 1.1} ${y + 2.2}H${x + 1.1}A1.1 1.1 0 0 1 ${x + 1.1} ${y}Z`).join('');
  s += P('t-a', paper + vl, ' fill-rule="evenodd"');
  s += P('t-b', 'M38.5 13H42V47Q40.4 46.3 38.5 46Z');
  // top roll
  const rhl = 'M12 7.2H38Q39 7.2 39 8Q39 8.6 38 8.6H12Q11 8.6 11 7.9Q11 7.2 12 7.2Z';
  s += P('t-a', cap(9, 10, 43, 10, 9) + rhl, ' fill-rule="evenodd"');
  s += P('t-b', 'M9 12.2H43A4.5 4.5 0 0 1 39.6 14.5H9Z');
  s += P('t-c', rhl);
  s += P('t-b', circ(9, 10, 4.5)) + P('t-b', circ(43, 10, 4.5)) ;
  s += L('M9 10.5A1.2 1.2 0 1 1 10.3 9.2A2.6 2.6 0 0 1 7 12.6', 1.2);
  // bottom curl: paper rolls under into a tube
  s += P('t-a', 'M7.5 50.5Q14 52.5 24 49Q36 45.5 46 49.5A5.5 5.5 0 0 1 44 60Q34 57 24 60Q14 62.5 8 59.5A4.6 4.6 0 0 1 7.5 50.5Z');
  s += P('t-b', 'M8 59.5Q14 62.5 24 60Q34 57 44 60A5.5 5.5 0 0 0 49 56Q38 52.5 26 56Q15 58.6 7 56Z');
  s += P('t-b', circ(46, 54.8, 4.4));
  s += L('M46 55.2A1.2 1.2 0 1 1 47.3 53.9A2.6 2.6 0 0 1 44 57.3', 1.2);
  // quill: vane in the upper right, shaft down to a nib on the last line
  const qa = Math.atan2(44.5 - 6, 33 - 58.5);
  let q = '';
  const vane = 'M0 0Q6 -4.5 18 -4.2Q26 -3.2 31 0Q26 2.6 18 3.6Q8 4.4 0 0Z';
  q += P('t-a', vane);
  q += P('t-b', 'M0 0Q8 4.4 18 3.6Q26 2.6 31 0Z');
  q += L('M6 0H33', 1.4);
  q += L('M12 -3.6L15 0M20 -4L23 0M15 3.8L18.4 0', 1.1);
  s += `<g transform="translate(58.5 5.5) rotate(${f(qa * 180 / Math.PI)})">${q}</g>`;
  s += L('M45 26L36.5 39.5', 1.8);
  s += P('t-b', 'M37.6 38.2L35 43.6L33.2 45.4L33.6 42.8L35.2 37.4Z');
  s += P('t-c', spark(55, 46, 3.4) + spark(6.2, 32, 2.4));
  add('scroll', 'half-open scroll with verse and a quill', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part18.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
