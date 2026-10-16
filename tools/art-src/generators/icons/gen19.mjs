// Generates part19.json (round 4, batch N=19).
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
// extras
const heart = (x, y, s) => `M${f(x)} ${f(y + .9 * s)}C${f(x - .25 * s)} ${f(y + .62 * s)} ${f(x - s)} ${f(y + .2 * s)} ${f(x - s)} ${f(y - .3 * s)}C${f(x - s)} ${f(y - .85 * s)} ${f(x - .3 * s)} ${f(y - 1.05 * s)} ${f(x)} ${f(y - .5 * s)}C${f(x + .3 * s)} ${f(y - 1.05 * s)} ${f(x + s)} ${f(y - .85 * s)} ${f(x + s)} ${f(y - .3 * s)}C${f(x + s)} ${f(y + .2 * s)} ${f(x + .25 * s)} ${f(y + .62 * s)} ${f(x)} ${f(y + .9 * s)}Z`;
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
// filled stroke along a polyline with round caps
const band = (pts, w) => {
  const r = w / 2, n = pts.length, nm = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); nm.push([-dy / l, dx / l]);
  }
  const L = pts.map((p, i) => [p[0] + nm[i][0] * r, p[1] + nm[i][1] * r]), Rr = pts.map((p, i) => [p[0] - nm[i][0] * r, p[1] - nm[i][1] * r]).reverse();
  return 'M' + L.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + `A${f(r)} ${f(r)} 0 0 0 ` + Rr.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + `A${f(r)} ${f(r)} 0 0 0 ${f(L[0][0])} ${f(L[0][1])}Z`;
};
const ell = (cx, cy, rx, ry, rot = 0, n = 48) => { const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
  return Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI, x = rx * Math.cos(a), y = ry * Math.sin(a); return [cx + x * c - y * s, cy + x * s + y * c]; }); };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// ---------- love-letter
{
  let s = '';
  const x0 = 5, y0 = 22, x1 = 53, y1 = 57, mx = 29, my = 42;
  // body with flap edges and pocket folds cut as thin gaps
  const gaps = band([[x0 + 1.6, y0 + 1.6], [mx - 3, my - 2.4]], 1.5) + band([[x1 - 1.6, y0 + 1.6], [mx + 3, my - 2.4]], 1.5) +
    band([[x0 + 2.2, y1 - 2.4], [mx - 7.5, my + 3.2]], 1.4) + band([[x1 - 2.2, y1 - 2.4], [mx + 7.5, my + 3.2]], 1.4);
  const flapHl = `M${x0 + 7} ${y0 + 3}L${x0 + 10.5} ${y0 + 3}L${mx - 4} ${my - 8.4}L${mx - 5.6} ${my - 6.8}Z`;
  s += P('t-a', rpoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 3) + gaps + flapHl, ' fill-rule="evenodd"');
  s += P('t-c', flapHl);
  s += P('t-b', `M${x0} ${y1 - 3.5}H${x1}V${y1 - 2}Q${x1} ${y1} ${x1 - 2} ${y1}H${x0 + 2}Q${x0} ${y1} ${x0} ${y1 - 2}Z`);
  // wax seal (scalloped) with heart
  const sc = [];
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, r = i % 2 ? 6.6 : 7.8; sc.push([mx + r * Math.cos(a), my + r * Math.sin(a)]); }
  s += P('t-b', rpoly(sc, 1.2));
  s += P('t-a', heart(mx, my + .3, 4.3));
  // floating hearts + trail
  s += L('M37 33.5Q40 28.5 43 26.5M46.5 23.8L47.6 22.9', 1.6);
  const hh = 'M47.4 9.4Q48.4 7.6 50.4 7.3L50.7 8.8Q49.3 9.1 48.7 10.2Z';
  s += P('t-a', heart(52, 13, 8.6) + hh, ' fill-rule="evenodd"');
  s += P('t-c', hh);
  s += P('t-b', 'M60.6 10.4C60.6 14.7 54.2 18.3 52 20.7C55 17 58.6 14.4 59.2 10.4Z');
  s += P('t-a', heart(37.5, 11.5, 4.4));
  s += P('t-c', spark(11, 11, 4.2) + spark(23.5, 6, 2.2) + spark(58.5, 31.5, 2.6));
  add('love-letter', 'sealed envelope with heart wax seal and a floating heart', s);
}

// ---------- question-mark
{
  let s = '';
  const cx = 32, cy = 21.5, r = 12, pts = [];
  for (let a = 180; a <= 400; a += 10) pts.push([cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)]);
  pts.push([33.2, 35], [32.6, 38.5], [32.6, 41]);
  const w = 11.5;
  const q = band(pts, w), dot = circ(32.6, 53, 6.2);
  // extrusion shadow
  s += `<g transform="translate(2.4 2.4)">${P('t-b', q + dot)}</g>`;
  // highlight slit on the hook
  const hp = []; for (let a = 200; a <= 255; a += 5) hp.push([cx + 15.2 * Math.cos(a * Math.PI / 180), cy + 15.2 * Math.sin(a * Math.PI / 180)]);
  const hl = band(hp, 2.6), dh = `M28.4 50.6A4.6 4.6 0 0 1 31.6 48.4L31.8 50.2A2.8 2.8 0 0 0 30 51.4Z`;
  s += P('t-a', q + hl, ' fill-rule="evenodd"');
  s += P('t-a', dot + dh, ' fill-rule="evenodd"');
  s += P('t-c', hl + dh);
  s += P('t-c', spark(52, 11, 6) + spark(11.5, 46, 3.4) + spark(56, 30, 2.2));
  s += L('M47.5 44.5L52 47M45 50.5L49 54.5M8.5 13L13.5 15.5', 1.8);
  add('question-mark', 'big chunky question mark with a sparkle', s);
}

// ---------- ice-cream-sundae
{
  let s = '';
  const creamB = x => { const t = Math.min(Math.max((x - 25) / 14, 0), 1); return 17.2 + 4.4 * t * (1 - t); };
  const sides = [[22, 32.5, 10.1], [42, 32.5, 10.1]];
  // wafer behind, stopping short of the scoop
  s += P('t-b', rpoly([[45.2, 22.8], [52, 8.5], [57, 11], [50.5, 24.6]], 1));
  s += L('M48 15.6L54 18.6M50.4 10.8L55.6 13.4M49.4 11.4L53 21.6', 1);
  // foot and stem
  s += P('t-a', 'M19 59.5Q19 55 32 55Q45 55 45 59.5Z');
  s += P('t-b', 'M19.2 58H44.8L45 59.5H19Z');
  s += P('t-a', 'M29.6 48.5H34.4L33.6 51.6Q35.6 52.8 33.8 54L35 56H29L30.2 54Q28.4 52.8 30.4 51.6Z');
  s += P('t-b', 'M32.8 48.5H34.4L33.6 51.6Q35.6 52.8 33.8 54L35 56H33.2Z');
  // middle scoop (darker flavour): only what shows between cream and side scoops, with a gap
  const mid = [];
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2; let p = [32 + 9.5 * Math.cos(a), 24 + 9.5 * Math.sin(a)];
    for (const [cx, cy, r] of sides) { const d = Math.hypot(p[0] - cx, p[1] - cy); if (d < r) p = [cx + (p[0] - cx) * r / d, cy + (p[1] - cy) * r / d]; }
    if (p[1] < creamB(p[0]) + 1.1) p[1] = creamB(p[0]) + 1.1;
    if (p[1] > 36) p[1] = 36;
    mid.push(p);
  }
  s += P('t-b', poly(mid));
  const hl = 'M15.8 30.2A7.1 7.1 0 0 1 19.9 25.7L20.4 27.4A5.3 5.3 0 0 0 17.5 30.6ZM35.8 30.2A7.1 7.1 0 0 1 39.9 25.7L40.4 27.4A5.3 5.3 0 0 0 37.5 30.6Z';
  s += P('t-a', circ(22, 32.5, 9) + circ(42, 32.5, 9) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  // bowl with shine
  const shine = 'M15.5 41.5H18.5Q19.5 44 23.5 45.6L22.5 47Q16.8 45 15.5 41.5Z';
  s += P('t-a', 'M10.5 39.5H53.5Q53 48 38.5 48.8H25.5Q11 48 10.5 39.5Z' + shine, ' fill-rule="evenodd"');
  s += P('t-c', shine);
  s += L('M27 42.5L28 47M37 42.5L36 47M45.5 42.5Q45 44.5 42.5 46', 1.3);
  // rim with drips
  s += P('t-b', rpoly([[9.5, 36.5], [54.5, 36.5], [54.5, 40.5], [9.5, 40.5]], 2) + cap(16, 39, 16, 43.5, 3.2) + cap(47.5, 39, 47.5, 45, 3.2));
  // whipped cream
  s += P('t-a', 'M25 17.2Q24 13.6 27.8 13.2Q27 9.8 31 9.8Q31.5 7.2 34 7.8Q36.6 8.6 35.4 10Q38 10.4 36.4 13.2Q40 13.6 39 17.2Q32 19.4 25 17.2Z');
  s += L('M27.8 13.2Q32 14.8 36.4 13.2', 1.2);
  // cherry
  const ch = 'M33.4 6.9A2.4 2.4 0 0 1 34.9 5.5L35.4 6.5A1.4 1.4 0 0 0 34.4 7.4Z';
  s += P('t-b', circ(35.8, 7.8, 3.6) + ch, ' fill-rule="evenodd"');
  s += L('M36.4 4.4Q37.4 2.6 40.8 2.8', 1.4);
  s += P('t-c', spark(11, 12, 4.4) + spark(55, 51, 3) + spark(19, 5, 2));
  add('ice-cream-sundae', 'tall glass sundae with scoops, whipped cream, cherry and wafer', s);
}

// ---------- moka-pot
{
  let s = '';
  // handle
  s += P('t-b', rpoly([[45, 16.5], [55.5, 18.5], [57.5, 21.5], [53, 36], [49.5, 37.5], [45.5, 34], [48.5, 31], [51.5, 22.5], [45.5, 21.5]], [1, 2.5, 2, 2.5, 2, 1.5, 1.5, 1.5, 1]));
  // top chamber with facets
  const T = [[17, 16], [47, 16], [40.5, 35], [23.5, 35]];
  const fa = t => lerp(T[0], T[1], t), fb = t => lerp(T[3], T[2], t);
  const hlT = poly([lerp(fa(.06), fb(.06), .05), lerp(fa(.22), fb(.22), .05), lerp(fa(.22), fb(.22), .95), lerp(fa(.06), fb(.06), .95)]);
  const spout = 'M17.5 16L8 13.6Q6.8 13.4 7.6 14.4L17 23Z';
  s += P('t-a', poly(T) + hlT, ' fill-rule="evenodd"');
  s += P('t-a', spout);
  s += P('t-c', hlT);
  s += P('t-b', poly([fa(.71), T[1], T[2], fb(.71)]));
  s += L(`M${f(fa(.29)[0])} ${f(fa(.29)[1])}L${f(fb(.29)[0])} ${f(fb(.29)[1])}`, 1.2);
  // lid with knob
  s += P('t-a', 'M15.5 16.5Q15.5 11 32 10.5Q48.5 11 48.5 16.5Z');
  s += P('t-b', 'M15.5 15H48.5V16.5Q48.5 17.6 47.4 17.6H16.6Q15.5 17.6 15.5 16.5Z');
  s += P('t-b', rpoly([[28.5, 11], [29.5, 6], [34.5, 6], [35.5, 11]], 1.2));
  // waist
  s += R('t-b', 21, 34.5, 22, 5, 1.5);
  s += L('M23 37H41', 1);
  // boiler
  const B = [[23.5, 39.5], [40.5, 39.5], [49.5, 59], [14.5, 59]];
  const ba = t => lerp(B[0], B[1], t), bb = t => lerp(B[3], B[2], t);
  const hlB = poly([lerp(ba(.06), bb(.06), .08), lerp(ba(.22), bb(.22), .08), lerp(ba(.22), bb(.22), .92), lerp(ba(.06), bb(.06), .92)]);
  const valve = circ(32, 48, 2.6);
  s += P('t-a', rpoly(B, [1, 1, 1.5, 1.5]) + hlB, ' fill-rule="evenodd"');
  s += P('t-c', hlB);
  s += P('t-b', poly([ba(.71), B[1], [B[2][0] - .3, B[2][1]], bb(.71)]) + valve);
  s += L(`M${f(ba(.29)[0])} ${f(ba(.29)[1])}L${f(bb(.29)[0])} ${f(bb(.29)[1])}`, 1.2);
  // steam
  s += L('M9 10Q6.5 7.5 9 5.5Q11 3.8 9.5 2.6M14 9.5Q12 7.2 14 5.2', 1.6);
  s += P('t-c', spark(56, 8, 3.8) + spark(7, 40, 3) + spark(57.5, 48, 2));
  add('moka-pot', 'eight-sided stovetop moka pot with handle and steam', s);
}

// ---------- pharaoh-mask
{
  let s = '';
  const edge = [];
  for (let a = 270; a >= 180; a -= 15) edge.push([32 + 17.5 * Math.cos(a * Math.PI / 180), 18 + 13.5 * Math.sin(a * Math.PI / 180)]);
  edge.push([7, 38], [7.4, 40.4], [9, 41]);
  const xl = y => { for (let i = 1; i < edge.length; i++) if (y <= edge[i][1]) { const a = edge[i - 1], b = edge[i]; return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); } return 9; };
  const mxp = p => [64 - p[0], p[1]];
  const sil = [...edge, [9, 57.5], [10.5, 59], [19.5, 59], [21, 57.5], [21, 44], [43, 44], [43, 57.5], [44.5, 59], [53.5, 59], [55, 57.5], [55, 41], ...edge.slice().reverse().map(mxp)];
  const ring = (rx, ry) => `M${f(32 - rx)} 30a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
  s += P('t-a', poly(sil) + ring(12.3, 15.4), ' fill-rule="evenodd"');
  // stripes, stopping inside the face frame
  let st = '';
  const ex = y => Math.abs(y - 30) < 15.4 ? 12.3 * Math.sqrt(1 - ((y - 30) / 15.4) ** 2) - .8 : 0;
  for (let y = 8; y < 37; y += 4.4) { const y2 = y + 2.2, a = xl(y), b = xl(y2), c = ex(y), d = ex(y2);
    st += c || d ? poly([[a, y], [32 - c, y], [32 - d, y2], [b, y2]]) + poly([[64 - a, y], [32 + c, y], [32 + d, y2], [64 - b, y2]]) : poly([[a, y], [64 - a, y], [64 - b, y2], [b, y2]]); }
  st += 'M7.2 39.5H21V41.8H9ZM56.8 39.5H43V41.8H55Z';
  for (let y = 44.4; y < 57; y += 4.4) st += `M9 ${f(y)}h12v2.2h-12zM43 ${f(y)}h12v2.2h-12z`;
  s += P('t-b', st);
  // collar
  s += R('t-a', 21.6, 40, 20.8, 19, 1.5);
  s += L('M22 44.6A14 14 0 0 0 42 44.6M22 50A18 18 0 0 0 42 50M22 55A22 22 0 0 0 42 55', 2.2);
  // beard
  s += P('t-b', rpoly([[28.6, 40], [35.4, 40], [35, 57], [32, 59], [29, 57]], 1.5));
  s += P('t-a', 'M29.2 46h5.6v1.2h-5.6zM29.3 50.5h5.4v1.2h-5.4zM29.5 55h5v1h-5z');
  // face frame ring and face
  s += P('t-b', ring(12.3, 15.4) + ring(10.6, 13.6), ' fill-rule="evenodd"');
  const eL = 'M24 27.5Q27.5 24.6 31 27.5Q27.5 29.6 24 27.5Z', eR = 'M33 27.5Q36.5 24.6 40 27.5Q36.5 29.6 33 27.5Z';
  s += P('t-a', ring(10.6, 13.6) + eL + eR, ' fill-rule="evenodd"');
  s += P('t-c', eL + eR);
  s += C('t-b', 27.6, 27.3, 1.3) + C('t-b', 36.4, 27.3, 1.3);
  s += L('M24 27.5Q27.5 24.6 31 27.5Q27.5 29.6 24 27.5L21.5 28.6M40 27.5Q36.5 24.6 33 27.5Q36.5 29.6 40 27.5L42.5 28.6', 1.1);
  s += L('M23.5 23.6Q27.5 21.6 30.5 23.2M40.5 23.6Q36.5 21.6 33.5 23.2', 1.6);
  s += L('M32 29V34.5L30.8 35.4M32 34.5L33.2 35.4', 1.1);
  s += P('t-b', 'M28.8 38.4Q32 37.2 35.2 38.4Q32 40.6 28.8 38.4Z');
  // cobra (uraeus)
  s += E('t-b', 32, 13.5, 4, 5.4);
  s += P('t-a', 'M32 8.6Q35 9.4 34.6 13Q34.2 16.5 32 18.3Q29.8 16.5 29.4 13Q29 9.4 32 8.6Z');
  s += P('t-c', spark(8.5, 8.5, 4) + spark(56, 8.5, 2.6));
  add('pharaoh-mask', 'golden pharaoh death mask with striped nemes and cobra', s);
}

// ---------- gold-pan
{
  let s = '', g = '';
  const cx = 32, cy = 30, rx = 27, ry = 19.5, dp = 6;
  const el = (x, y, a, b) => `M${f(x - a)} ${f(y)}a${f(a)} ${f(b)} 0 1 0 ${f(2 * a)} 0a${f(a)} ${f(b)} 0 1 0 ${f(-2 * a)} 0Z`;
  // outer sloped wall below the rim
  g += P('t-b', `M${f(cx - rx)} ${cy}A${rx} ${ry} 0 0 0 ${f(cx + rx)} ${cy}L${f(cx + rx - 1.5)} ${f(cy + dp)}A${rx - 1.5} ${ry - .5} 0 0 1 ${f(cx - rx + 1.5)} ${f(cy + dp)}Z`);
  // wide rim
  g += P('t-a', el(cx, cy, rx, ry) + el(cx, cy + .8, 21.6, 14.5), ' fill-rule="evenodd"');
  // basin with the pool cut out (deeper at the low left side)
  const bx = 20.7, by = 13.7, bc = cy + 1;
  const water = `M${f(cx - 20.6)} ${f(bc + 1.35)}Q${f(cx - 2)} ${f(bc + .5)} ${f(cx + 18)} ${f(bc + 6.8)}A${bx} ${by} 0 0 1 ${f(cx - 20.6)} ${f(bc + 1.35)}Z`;
  g += P('t-a', el(cx, bc, bx, by) + water, ' fill-rule="evenodd"');
  g += P('t-c', water);
  // shadowed far wall and the floor edge, which show the slope
  g += P('t-b', `M${f(cx - bx)} ${bc}A${bx} ${by} 0 0 1 ${f(cx + bx)} ${bc}Q${cx} ${f(bc - 11.5)} ${f(cx - bx)} ${bc}Z`);
  g += L(`M${f(cx - 17)} ${f(bc + 6.5)}Q${f(cx - 14)} ${f(bc + 5.3)} ${f(cx - 11)} ${f(bc + 6.2)}M${f(cx + 7)} ${f(bc + 12)}Q${f(cx + 10)} ${f(bc + 11.2)} ${f(cx + 13)} ${f(bc + 11.6)}`, 1.2);
  // three big nuggets in the pool
  const nug = (x, y, k) => rpoly([[x - 3 * k, y + .5 * k], [x - 1.6 * k, y - 2 * k], [x + 1.4 * k, y - 2.3 * k], [x + 3.2 * k, y], [x + 1.8 * k, y + 2 * k], [x - 1.4 * k, y + 2.1 * k]], .8 * k);
  const ns = [[cx - 6.5, bc + 7.8, 2.2], [cx + 6, bc + 8, 1.65], [cx - 14.5, bc + 6.8, 1.2]];
  const fc = ns.map(([x, y, k]) => poly([[x - 1.3 * k, y - 1.3 * k], [x + 1.1 * k, y - 1.7 * k], [x - .2 * k, y - .1 * k]])).join('');
  g += P('t-a', ns.map(([x, y, k]) => nug(x, y, k)).join('') + fc, ' fill-rule="evenodd"');
  g += P('t-c', fc);
  g += P('t-b', ns.map(([x, y, k]) => `M${f(x - 3 * k)} ${f(y + .5 * k)}L${f(x - 1.4 * k)} ${f(y + 2.1 * k)}L${f(x + 1.8 * k)} ${f(y + 2 * k)}L${f(x + 3.2 * k)} ${f(y)}Q${f(x + .5 * k)} ${f(y + 1.4 * k)} ${f(x - 3 * k)} ${f(y + .5 * k)}Z`).join(''));
  g += P('t-c', spark(cx - 3.4, bc - 1.4, 3.6) + spark(cx + 10, bc + 1.6, 2.8) + spark(cx - 13, bc - .6, 2.2));
  s += `<g transform="rotate(-12 ${cx} ${cy})">${g}</g>`;
  // drips off the low edge
  s += P('t-c', 'M10.6 47Q12.6 50.1 12.6 51.5Q12.6 53.5 10.6 53.5Q8.6 53.5 8.6 51.5Q8.6 50.1 10.6 47ZM15.5 53Q16.8 55 16.8 55.9Q16.8 57.2 15.5 57.2Q14.2 57.2 14.2 55.9Q14.2 55 15.5 53Z');
  s += P('t-c', spark(8.5, 8.5, 4.2) + spark(56, 7, 2.8) + spark(56.5, 52, 2.4));
  add('gold-pan', 'prospector gold pan tilted with water and glinting nuggets', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part19.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
