// Generates part43.json (round 4).
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
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const ep = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
// local frame: origin, angle (deg) -> (u, v) => [x, y]
const frame = (ox, oy, a) => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180); return (u, v) => [ox + u * c - v * s, oy + u * s + v * c]; };
const tf = (T, pts) => pts.map(([u, v]) => T(u, v));

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- lily-pad-pond
{
  let s = '';
  const pad = (cx, cy, rx, ry, a0, w = 24) => { const p = a => [cx + rx * Math.cos(a * Math.PI / 180), cy + ry * Math.sin(a * Math.PI / 180)];
    const [x1, y1] = p(a0 + w), [x2, y2] = p(a0 - w); return `M${f(cx)} ${f(cy)}L${f(x1)} ${f(y1)}A${f(rx)} ${f(ry)} 0 1 1 ${f(x2)} ${f(y2)}Z`; };
  s += P('t-b', ep(32, 37, 28, 21.5) + ep(32, 35, 27, 19), ' fill-rule="evenodd"');
  const fl = 'M22 31Q19 29.5 19.5 26.5Q21.5 27 23 28.2Q22 25 22.6 22Q24.6 23.4 25.4 25.4Q26 22 27 19.8Q28 22 28.6 25.4Q29.4 23.4 31.4 22Q32 25 31 28.2Q32.5 27 34.5 26.5Q35 29.5 32 31Q27 32.6 22 31Z';
  const kx = 1.5;
  const koi = `M${46} 46Q45.7 42.6 41 42.5L39.5 42.6Q37.5 39.6 35.3 40Q36.3 41.6 36.5 43Q34 43.6 31.7 45L27.7 42.2Q28.9 46 27.7 49.8L31.7 47Q34 48.4 36.5 49Q36.3 50.4 35.3 52Q37.5 52.4 39.5 49.4L41 49.5Q45.7 49.4 46 46Z`;
  s += P('t-a', ep(32, 35, 27, 19) + fl + koi, ' fill-rule="evenodd"');
  s += P('t-c', fl + koi);
  s += L('M27 31.5L25.4 25.8M27 31.5L28.6 25.8', 1);
  s += P('t-b', circ(43, 45.4, 1.5) + 'M37 44.6Q39 44 39.8 46Q39.2 48 37 47.6Q35.8 46.2 37 44.6Z');
  // pads
  s += P('t-b', pad(17.5, 40.5, 8.5, 5.8, -25) + pad(43, 27, 7.8, 5.2, 165) + pad(51.5, 38.5, 5.6, 3.8, 200));
  // reeds
  s += L('M9 33Q8.5 22 9.5 11M12.5 32Q13 22 14 9M10 33Q5.5 27 5 19', 1.4);
  s += P('t-b', cap(9.3, 14, 9.1, 21.5, 3.2) + cap(13.7, 12, 13.3, 19.5, 3.2));
  // ripples
  s += L('M24.8 43.5Q23.2 46 24.8 48.5M21.8 42.4Q19.6 46 21.8 49.6M49 47Q51.5 48.5 54 46M15 30Q18 33.2 23 34', 1.2);
  s += P('t-c', spark(56, 9, 3.2) + spark(25, 9, 2.4));
  add('lily-pad-pond', 'oval pond with notched lily pads, a water lily and a koi', s);
}

// ---------- fossil-dig
{
  let s = '';
  const slab = [[7, 13], [24, 8], [44, 9], [57, 14], [59, 30], [55, 41], [32, 44], [9, 42], [5, 28]];
  s += P('t-b', rpoly([[5.4, 27], [9.6, 40.6], [32, 42.6], [54.6, 39.6], [58.6, 29], [59, 34.5], [55, 45.5], [32, 48.5], [9, 46.5], [5, 32.5]], [.3, .3, .3, .3, .3, 3, 3, 3, 3, 3]));
  const ax = 19.5, ay = 26, ar = 10.3;
  s += P('t-a', rpoly(slab, 3) + circ(ax, ay, ar), ' fill-rule="evenodd"');
  s += P('t-c', circ(ax, ay, ar));
  // spiral
  const rr = t => (ar - .3) * Math.pow(.4, t), pt = t => { const a = t * 2 * Math.PI - 1; return [ax + rr(t) * Math.cos(a), ay + rr(t) * Math.sin(a)]; };
  let sp = ''; for (let i = 0; i <= 27; i++) { const [x, y] = pt(i / 10); sp += `${i ? 'L' : 'M'}${f(x)} ${f(y)}`; }
  s += L(sp, 1.5);
  let rb = ''; for (let i = 0; i < 11; i++) { const t = i / 11, [x1, y1] = pt(t), [x2, y2] = pt(t + 1); rb += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`; }
  s += L(rb, 1);
  // fish skeleton
  let fb = rpoly([[46, 21.5], [52, 23], [56, 27.5], [52, 31.5], [46, 33]], [1.5, 2, 1, 2, 1.5]) + cap(35, 27.3, 47, 27.3, 2);
  fb += rpoly([[36, 27.3], [31, 21], [33, 27.3], [31, 33.6]], .8);
  s += P('t-b', fb + circ(51.3, 25.9, 1.3), ' fill-rule="evenodd"');
  s += L([38, 41.5, 45].map(x => `M${x - 2} 21Q${x} 23 ${x} 27.3Q${x} 31.6 ${x - 2} 33.6`).join(''), 1.6);
  s += L('M42 40.5L44.5 37.5L43.5 35M10 37L13 39.5', 1.2);
  // brush
  const B = frame(6.5, 58.5, -12);
  s += P('t-a', cap(...B(0, 0), ...B(12.5, 0), 3.6));
  s += P('t-b', rpoly(tf(B, [[12, -2.4], [17.5, -2.6], [17.5, 2.6], [12, 2.4]]), 1));
  s += P('t-a', rpoly(tf(B, [[17.5, -2.8], [24.5, -4], [24.5, 4], [17.5, 2.8]]), [0, 1, 1, 0]));
  s += L(`M${B(19.5, -1.2).map(f).join(' ')}L${B(24, -1.6).map(f).join(' ')}M${B(19.5, 1.2).map(f).join(' ')}L${B(24, 1.6).map(f).join(' ')}`, 1);
  // pick
  s += P('t-a', cap(34.5, 57.5, 54, 55.8, 3.4));
  s += P('t-b', rpoly([[52.8, 60.5], [52.8, 53.5], [55, 48.5], [57.2, 53.5], [57.2, 60.5]], [1, 1.5, .4, 1.5, 1]));
  s += P('t-c', spark(57, 6, 2.6) + spark(6, 6, 2.4));
  add('fossil-dig', 'rock slab with ammonite and fish fossil, brush and pick', s);
}

// ---------- ink-pen
{
  let s = '';
  // flourish
  s += L('M4.5 52C12 52 18 46 16 38C14.5 32 8 33 9.5 39C11 46 20 49 24 44', 2.4);
  const T = frame(24, 44, -45);
  const nib = [[0, 0], [6.5, 2.6], [10.5, 3.7], [13, 3.5], [13, -3.5], [10.5, -3.7], [6.5, -2.6]];
  const hole = circ(...T(8.6, 0), 1.15);
  s += P('t-a', rpoly(tf(T, nib), [.3, 1.5, 1, .4, .4, 1, 1.5]) + hole, ' fill-rule="evenodd"');
  s += P('t-b', rpoly(tf(T, [[1, .4], [6.5, 2.6], [10.5, 3.7], [13, 3.5], [13, 1.7], [10, 1.7], [8.6, 1.6], [7.2, 1.3]]), .4));
  s += L(`M${T(.8, 0).map(f).join(' ')}L${T(7.3, 0).map(f).join(' ')}`, .9);
  s += P('t-b', rpoly(tf(T, [[12.6, -4], [20.5, -4], [20.5, 4], [12.6, 4]]), 1.5));
  const hl = cap(...T(23, -1.5), ...T(41, -1.3), 1.3);
  s += P('t-a', rpoly(tf(T, [[20, 3.3], [44, 2.5], [47.2, 0], [44, -2.5], [20, -3.3]]), [.5, 2, 2, 2, .5]) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', circ(24, 44, 1.5));
  // bottle
  const lab = rpoly([[41.5, 49], [54.5, 49], [54.5, 56], [41.5, 56]], 1);
  s += P('t-b', rpoly([[44, 41], [52, 41], [58, 47], [58, 59], [38, 59], [38, 47]], [1.5, 1.5, 4, 2.5, 2.5, 4]) + lab, ' fill-rule="evenodd"');
  s += P('t-c', lab);
  s += L('M44 54Q46 50.5 48 52.5Q50 54.5 52 51', 1.2);
  s += P('t-a', rpoly([[44, 41.5], [44, 38.5], [42.5, 38.5], [42.5, 35.5], [53.5, 35.5], [53.5, 38.5], [52, 38.5], [52, 41.5]], .7));
  s += P('t-c', spark(9, 11, 3.2) + spark(34, 7, 2.4) + spark(26, 26, 1.8));
  add('ink-pen', 'dip pen with split nib drawing a flourish, ink bottle', s);
}

// ---------- kiln
{
  let s = '';
  s += L('M42 11Q40.3 9 42 7Q43.7 5 42 3M46 12Q44.3 10 46 8Q47.7 6 46 4M50 11Q48.3 9 50 7Q51.7 5 50 3', 1.6);
  s += P('t-a', rpoly([[41, 15], [49, 15], [49, 31], [41, 31]], .5));
  s += R('t-b', 46.4, 16, 2.6, 13);
  s += R('t-b', 39.5, 12.8, 11, 3.6, 1);
  const op = 'M18.5 56V41A11.5 11.5 0 0 1 41.5 41V56Z';
  s += P('t-a', 'M6 58V38A24 14 0 0 1 54 38V58Z' + op, ' fill-rule="evenodd"');
  s += P('t-c', op);
  // voussoir blocks + jambs
  let vb = ''; const n = 7, g = 3.2;
  for (let i = 0; i < n; i++) {
    const a1 = 180 + i * 180 / n + g / 2, a2 = 180 + (i + 1) * 180 / n - g / 2, pa = (a, r) => [30 + r * Math.cos(a * Math.PI / 180), 41 + r * Math.sin(a * Math.PI / 180)];
    const [p1, p2, p3, p4] = [pa(a1, 11.5), pa(a1, 14.2), pa(a2, 14.2), pa(a2, 11.5)];
    vb += `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}A14.2 14.2 0 0 1 ${f(p3[0])} ${f(p3[1])}L${f(p4[0])} ${f(p4[1])}A11.5 11.5 0 0 0 ${f(p1[0])} ${f(p1[1])}Z`;
  }
  vb += 'M15.8 41.8H18.5V47.6H15.8ZM15.8 49.2H18.5V55H15.8ZM41.5 41.8H44.2V47.6H41.5ZM41.5 49.2H44.2V55H41.5Z';
  s += P('t-b', vb);
  // shelf, pots, fire
  s += R('t-b', 18.5, 46, 23, 2.2);
  s += P('t-b', 'M21.5 46Q19.6 42 22.6 39.5V38H21.9V36.4H28.1V38H27.4V39.5Q30.4 42 28.5 46Z' + 'M31.5 46Q30 41.5 33 40H32.4V38.4H38.6V40H38Q41 41.5 39.5 46Z');
  s += P('t-b', 'M19.5 56Q20.5 52 22.5 53Q23.5 49.6 26 52.3Q28 49 30 51.8Q32 49 34 52.3Q36.5 49.6 37.5 53Q39.5 52 40.5 56Z');
  // open door
  s += P('t-b', 'M15 56V37.5Q12.8 31 7.8 33.5L7.6 54Z' + circ(10.6, 44.5, 1.1), ' fill-rule="evenodd"');
  // bricks
  s += L('M45.5 35H53.3M45.5 41H54M45.5 47H54M45.5 53H54M49.5 29.5V35M49.5 41V47M47.5 35V41M51.8 35V41M47.5 47V53M51.8 47V53M8 30.5Q12 27.5 17 26.5M24 25H36', 1.1);
  s += P('t-b', rpoly([[4, 55.5], [56, 55.5], [56, 59.5], [4, 59.5]], 1.2));
  s += P('t-c', spark(8, 10, 3.2) + spark(24, 13, 2.2) + spark(58, 21, 2.4));
  add('kiln', 'brick kiln with open arched door, glowing pots and chimney', s);
}

// ---------- collage
{
  let s = '';
  const torn = (w, h, sides, amp = 1.2, step = 2.8) => {
    const pts = [], cr = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], nm = 'trbl';
    for (let k = 0; k < 4; k++) { const a = cr[k], b = cr[(k + 1) % 4]; pts.push(a);
      if (sides.includes(nm[k])) { const Lh = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(Lh / step)), nx = -(b[1] - a[1]) / Lh, ny = (b[0] - a[0]) / Lh;
        for (let i = 1; i < n; i++) { const t = i / n, o = (i % 2 ? 1 : -1) * amp * (.55 + .45 * ((i * 5) % 3) / 2); pts.push([a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + ny * o]); } } }
    return pts; };
  // photo (bottom, light)
  const Ph = frame(20, 42, 7), pw = 28, ph = 22;
  s += P('t-c', poly(tf(Ph, torn(pw, ph, 'r'))));
  s += L(poly(tf(Ph, [[-11.5, -8.5], [11.5, -8.5], [11.5, 8.5], [-11.5, 8.5]])), 1);
  const mt = [[-11.5, 8.5], [-11.5, 4], [-5, -4.5], [-1.5, -.5], [1.5, -2.5], [8, 4.5], [8, 8.5]];
  const snow = [[-6.9, -1.6], [-5, -4.5], [-3.1, -2.4], [-4, -1.2], [-5.1, -2.1], [-6, -.9]];
  s += P('t-a', poly(tf(Ph, mt)) + poly(tf(Ph, snow)), ' fill-rule="evenodd"');
  s += P('t-b', circ(...Ph(-8, -4.5), 2.2));
  // stripes (middle, main)
  const St = frame(22, 18, -10), sw = 33, sh = 19;
  let stp = ''; for (let u = -12.5; u < 13; u += 5.2) stp += poly(tf(St, [[u, -6.2], [u + 2.2, -6.2], [u + 2.2, 6.2], [u, 6.2]]));
  s += P('t-a', poly(tf(St, torn(sw, sh, 'tb'))) + stp, ' fill-rule="evenodd"');
  // dots (top, shade)
  const Dt = frame(36.5, 32, 15), dw = 19, dh = 26;
  let dt = ''; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) { const u = -5 + c * 5 + (r % 2 ? 2.5 : 0); if (u > 6) continue; dt += circ(...Dt(u, -9 + r * 4.5), 1.4); }
  s += P('t-b', poly(tf(Dt, torn(dw, dh, 'lb'))) + dt, ' fill-rule="evenodd"');
  // glue stick
  s += P('t-c', rpoly([[51.5, 34], [51.5, 29.5], [57.5, 26.5], [57.5, 34]], [0, 1.5, 1.5, 0]));
  s += P('t-a', rpoly([[51, 36], [58, 36], [58, 55], [51, 55]], .8));
  s += P('t-b', rpoly([[50.3, 33.5], [58.7, 33.5], [58.7, 37], [50.3, 37]], 1));
  s += R('t-b', 51, 42.5, 7, 6.5);
  s += P('t-b', rpoly([[50.3, 54], [58.7, 54], [58.7, 59.5], [50.3, 59.5]], 1.2));
  s += P('t-c', spark(55, 8, 3) + spark(7, 58, 2.4));
  add('collage', 'torn paper scraps with stripes, dots and a mountain photo, glue stick', s);
}

// ---------- greek-vase
{
  let s = '';
  const mx = pts => pts.map(([x, y]) => [64 - x, y]);
  const hd = [[38.4, 12], [47, 10.8], [51.2, 15.5], [47.2, 26.5]];
  s += P('t-a', limb(hd, 3.4) + limb(mx(hd), 3.4));
  const hl = 'M17.5 29.5Q14.6 33.5 16.2 38Q16.8 33.5 19 30Z';
  s += P('t-a', 'M25 9.5H39Q38 15 38.4 20Q39.5 23 45 25.5Q53 29.5 52 36Q51 44 41 50Q37.5 52 37 53.5H27Q26.5 52 23 50Q13 44 12 36Q11 29.5 19 25.5Q24.5 23 25.6 20Q26 15 25 9.5Z' + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', rpoly([[22.5, 5], [41.5, 5], [41.5, 8.5], [39.5, 10], [24.5, 10], [22.5, 8.5]], 1));
  // meander band
  let mk = 'M25.7 12.6H38.3M25.9 18.6H38.1';
  for (const x of [27, 30.9, 34.8]) mk += `M${f(x)} 18.6V14.2H${f(x + 3)}V16.5H${f(x + 1.5)}`;
  s += L(mk, 1);
  // bands, lower body, foot
  s += P('t-b', 'M50.9 40L50 41.6H14L13.1 40Z' + 'M49.1 43.4Q46.4 46.8 41 50Q37.5 52 37 53.5H27Q26.5 52 23 50Q17.6 46.8 14.9 43.4Z');
  s += P('t-b', rpoly([[26.5, 53], [37.5, 53], [38.5, 55], [43, 56.3], [43, 59], [21, 59], [21, 56.3], [25.5, 55]], [.3, .3, 1, 1, .5, .5, 1, 1]));
  // shoulder tongues
  let tg = ''; for (const x of [24, 28, 32, 36, 40]) tg += `M${f(x - 1.6)} 23.6Q${f(x)} 27.5 ${f(x + 1.6)} 23.6Z`;
  s += P('t-b', 'M19.6 25.2Q25 22.8 25.7 20.4H38.3Q39 22.8 44.4 25.2Z');
  // running figure (black-figure, facing right)
  let fg = circ(37, 28.6, 2.5) + cap(35.6, 31.6, 32.4, 35.8, 3.2);
  fg += limb([[35.2, 32], [39, 33.4], [42.3, 31]], 1.9) + limb([[34.6, 32], [30.5, 31], [28, 33.6]], 1.9);
  fg += limb([[32.4, 35.8], [36.8, 37], [38.6, 40.5]], 2.3) + limb([[32.4, 35.8], [28.4, 38.3], [24.6, 36.6]], 2.3);
  s += P('t-b', fg);
  s += P('t-c', spark(8, 9, 3.2) + spark(57, 6, 2.4) + spark(8, 53, 2.4) + spark(56, 53, 2.4));
  add('greek-vase', 'black-figure amphora with meander neck band and running figure', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part43.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
