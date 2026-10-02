// Generates part1.json: space / science / tech / vehicles library icons (64x64 inner SVG).
import fs from 'node:fs';
const OUT = process.argv[2] || new URL('../../icons/part1.json', import.meta.url);

const f = n => { const v = Math.round(n * 10) / 10; return (Object.is(v, -0) ? 0 : v).toString(); };
const P = (cls, d, extra = '') => `<path class="${cls}"${extra} d="${d}"/>`;
const C = (cls, cx, cy, r, extra = '') => `<circle class="${cls}"${extra} cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`;
const E = (cls, cx, cy, rx, ry, rot) => `<ellipse class="${cls}" cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"${rot != null ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : ''}/>`;
const R = (cls, x, y, w, h, rx) => `<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rx ? ` rx="${f(rx)}"` : ''}/>`;
const EO = ' fill-rule="evenodd"';
// circle as a sub-path, for evenodd holes
const cs = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
// rounded rect as a sub-path
const rr = (x, y, w, h, r) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;
const rs = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
// four-point sparkle
const spark = (cx, cy, s) => `M${f(cx)} ${f(cy - s)}Q${f(cx)} ${f(cy)} ${f(cx + s)} ${f(cy)}Q${f(cx)} ${f(cy)} ${f(cx)} ${f(cy + s)}Q${f(cx)} ${f(cy)} ${f(cx - s)} ${f(cy)}Q${f(cx)} ${f(cy)} ${f(cx)} ${f(cy - s)}Z`;
const pts = a => a.map(([x, y]) => `${f(x)} ${f(y)}`);
const poly = a => 'M' + pts(a).join('L') + 'Z';
const rad = d => d * Math.PI / 180;
const onC = (cx, cy, r, deg) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------------------------------------------------------------- planet
{
  const r = 17.5;
  const band = (a, b) => {
    const xa = Math.sqrt(r * r - a * a), xb = Math.sqrt(r * r - b * b);
    return `M${f(-xa)} ${f(a)}L${f(xa)} ${f(a)}A${r} ${r} 0 0 1 ${f(xb)} ${f(b)}L${f(-xb)} ${f(b)}A${r} ${r} 0 0 1 ${f(-xa)} ${f(a)}Z`;
  };
  const [s1x, s1y] = onC(0, 0, r, -25), [s2x, s2y] = onC(0, 0, r, 115);
  let g = '';
  g += P('t-b', 'M-30 0A30 9.5 0 0 1 30 0L22.5 0A22.5 5 0 0 0 -22.5 0Z');
  g += `<circle class="t-a" r="${r}"/>`;
  g += P('t-b', band(-12.5, -9) + band(-3.5, -1));
  g += P('t-b', `M${f(s1x)} ${f(s1y)}A${r} ${r} 0 0 1 ${f(s2x)} ${f(s2y)}A21 21 0 0 0 ${f(s1x)} ${f(s1y)}Z`);
  g += E('t-c', -7, -8.5, 4, 2.2, -38);
  g += P('t-b', 'M-30 2A30 9.5 0 0 0 30 2L22.5 2A22.5 5 0 0 1 -22.5 2Z');
  g += P('t-c', 'M-30 0A30 9.5 0 0 0 30 0L22.5 0A22.5 5 0 0 1 -22.5 0Z');
  let s = `<g transform="translate(31 34) rotate(-18)">${g}</g>`;
  s += C('t-a', 54.5, 9.5, 4.2) + P('t-b', 'M57.5 6.5A4.2 4.2 0 0 1 51.5 12.5A5 5 0 0 0 57.5 6.5Z');
  s += P('t-c', spark(9, 10, 5) + spark(56, 55, 4));
  s += C('t-c', 22, 5, 1.3) + C('t-c', 5, 52, 1.2);
  add('planet', 'ringed planet with a little moon', s);
}

// ---------------------------------------------------------------- rocket
{
  let g = '';
  g += P('t-c', 'M-6.5 14Q-9 24 0 34Q9 24 6.5 14Z');
  g += P('t-a', 'M-3.5 14Q-4.5 21 0 28Q4.5 21 3.5 14Z');
  g += P('t-b', 'M-9 1C-15 4 -18.5 10 -18 18.5L-8.5 13Z M9 1C15 4 18.5 10 18 18.5L8.5 13Z');
  g += P('t-b', 'M-6.5 11H6.5L5.5 16.5H-5.5Z');
  g += P('t-a', 'M-9 -12H9Q11.5 0 8.5 13H-8.5Q-11.5 0 -9 -12Z' + cs(0, -2, 5.3), EO);
  g += P('t-b', 'M5.5 -12H9Q11.5 0 8.5 13H5Q7.5 0 5.5 -12Z');
  g += P('t-b', 'M-9.6 6.5H10.2L9.5 10H-9.5Z');
  g += P('t-b', 'M0 -30Q9.8 -22.5 9 -12H-9Q-9.8 -22.5 0 -30Z');
  g += P('t-b', cs(0, -2, 5.3) + cs(0, -2, 3.5), EO);
  g += C('t-c', 0, -2, 3.5);
  g += E('t-c', -3.6, -19, 1.3, 3.4, 30);
  g += R('t-c', -8.3, -10, 2, 8.5, 1);
  let s = `<g transform="translate(34 30) rotate(40)">${g}</g>`;
  s += C('t-c', 11, 58, 3.2) + C('t-c', 5, 51.5, 2.2) + C('t-c', 17.5, 61.5, 1.8);
  s += P('t-c', spark(12, 12, 5) + spark(55, 50, 4));
  s += C('t-c', 50, 5, 1.3) + C('t-c', 4, 30, 1.2);
  add('rocket', 'cartoon rocket blasting off', s);
}

// ---------------------------------------------------------------- crescent-moon
{
  const [cx1, cy1, R1] = [29, 35, 26], [cx2, cy2, R2] = [42, 23, 23];
  const dx = cx2 - cx1, dy = cy2 - cy1, d = Math.hypot(dx, dy);
  const a = (R1 * R1 - R2 * R2 + d * d) / (2 * d), h = Math.sqrt(R1 * R1 - a * a);
  const bx = cx1 + a * dx / d, by = cy1 + a * dy / d;
  const p1 = [bx + h * -dy / d, by + h * dx / d], p2 = [bx - h * -dy / d, by - h * dx / d];
  // p1/p2: whichever is upper is the top tip
  const [top, bot] = p1[1] < p2[1] ? [p1, p2] : [p2, p1];
  const body = `M${f(top[0])} ${f(top[1])}A${R1} ${R1} 0 1 0 ${f(bot[0])} ${f(bot[1])}A${R2} ${R2} 0 0 1 ${f(top[0])} ${f(top[1])}Z`;
  const holes = cs(19, 41, 4.2) + cs(28.5, 52, 2.8) + cs(14, 27, 2.6);
  let s = P('t-a', body + holes, EO);
  // shade along the lower outer edge
  const [q1x, q1y] = onC(cx1, cy1, R1, 150), [q2x, q2y] = onC(cx1, cy1, R1, 38);
  s += P('t-b', `M${f(q1x)} ${f(q1y)}A${R1} ${R1} 0 0 0 ${f(q2x)} ${f(q2y)}A${R1 + 6} ${R1 + 6} 0 0 1 ${f(q1x)} ${f(q1y)}Z`);
  s += P('t-b', cs(19, 41, 4.2) + cs(28.5, 52, 2.8) + cs(14, 27, 2.6));
  s += P('t-c', cs(19.6, 40.2, 2.6) + cs(29, 51.4, 1.7) + cs(14.4, 26.4, 1.5));
  const [g1x, g1y] = onC(cx1, cy1, R1 - 3.5, 205), [g2x, g2y] = onC(cx1, cy1, R1 - 3.5, 245);
  s += P('ln', `M${f(g1x)} ${f(g1y)}A${R1 - 3.5} ${R1 - 3.5} 0 0 1 ${f(g2x)} ${f(g2y)}`, ' stroke-width="2.5"');
  s += P('t-c', spark(46, 27, 5.5) + spark(57, 9, 4));
  s += C('t-c', 58, 38, 1.4) + C('t-c', 38, 6, 1.2);
  add('crescent-moon', 'crescent moon with craters and stars', s);
}

// ---------------------------------------------------------------- telescope
{
  let s = P('ln', 'M30 38L15.5 60.5M31 38L46.5 60.5M30.5 38V61', ' stroke-width="3.5"');
  s += P('ln', 'M22.5 50H38.5', ' stroke-width="2.2"');
  let g = '';
  g += R('t-b', -30, -3.5, 7, 7, 1.5);
  g += P('t-a', 'M-23 -5.5L15 -7.5V7.5L-23 5.5Z');
  g += P('t-c', 'M-20 -3.8L12 -5.5V-3.4L-20 -1.8Z');
  g += R('t-b', -7, -7, 4.5, 14, 1);
  g += P('t-b', 'M-23 3L15 4.8V7.5L-23 5.5Z');
  g += P('t-a', rr(14, -9.5, 11, 19, 2.5) + `M22.5 0a2.4 7.5 0 1 0 4.8 0a2.4 7.5 0 1 0 -4.8 0Z`, EO);
  g += R('t-b', 14, 5.5, 11, 4, 1.5);
  g += E('t-c', 24.9, 0, 2.4, 7.5);
  g += `<ellipse class="t-a" cx="24.3" cy="-3" rx=".8" ry="2.4"/>`;
  s += C('t-b', 30.5, 37, 4.5);
  s += `<g transform="translate(32 28) rotate(-32)">${g}</g>`;
  s += C('t-c', 30.5, 37, 1.8);
  s += P('t-c', spark(55, 6.5, 5) + spark(9, 12, 4));
  s += C('t-c', 44, 4, 1.3) + C('t-c', 61, 20, 1.2) + C('t-c', 6, 34, 1.2);
  add('telescope', 'telescope on a tripod aimed at a star', s);
}

// ---------------------------------------------------------------- shooting-star
{
  const [cx, cy, Ro, Ri, rot] = [42, 22, 18, 8, -12];
  const outer = [], inner = [];
  for (let i = 0; i < 5; i++) { outer.push(onC(cx, cy, Ro, -90 + rot + i * 72)); inner.push(onC(cx, cy, Ri, -90 + rot + 36 + i * 72)); }
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const k = 0.2;
  let d = '', facets = '';
  for (let i = 0; i < 5; i++) {
    const O = outer[i], Ip = inner[(i + 4) % 5], In = inner[i];
    const A = lerp(O, Ip, k), B = lerp(O, In, k);
    d += (i ? 'L' : 'M') + `${f(A[0])} ${f(A[1])}Q${f(O[0])} ${f(O[1])} ${f(B[0])} ${f(B[1])}L${f(In[0])} ${f(In[1])}`;
    const mid = [0.25 * A[0] + 0.5 * O[0] + 0.25 * B[0], 0.25 * A[1] + 0.5 * O[1] + 0.25 * B[1]];
    if (i === 1 || i === 2 || i === 3) facets += `M${f(cx)} ${f(cy)}L${f(mid[0])} ${f(mid[1])}Q${f(lerp(mid, B, .5)[0])} ${f(lerp(mid, B, .5)[1])} ${f(B[0])} ${f(B[1])}L${f(In[0])} ${f(In[1])}Z`;
  }
  d += 'Z';
  // trails toward the lower left
  const u = [-Math.SQRT1_2, Math.SQRT1_2], n = [Math.SQRT1_2, Math.SQRT1_2];
  const trail = (off, d0, w, L) => {
    const S = [cx + n[0] * off + u[0] * d0, cy + n[1] * off + u[1] * d0];
    const a1 = [S[0] + n[0] * w / 2, S[1] + n[1] * w / 2], a2 = [S[0] - n[0] * w / 2, S[1] - n[1] * w / 2];
    const Ept = [S[0] + u[0] * L, S[1] + u[1] * L];
    const c1 = [Ept[0] + n[0] * 1.2, Ept[1] + n[1] * 1.2], c2 = [Ept[0] - n[0] * 1.2, Ept[1] - n[1] * 1.2];
    return `M${f(a1[0])} ${f(a1[1])}L${f(c1[0])} ${f(c1[1])}Q${f(Ept[0] + u[0] * 1.5)} ${f(Ept[1] + u[1] * 1.5)} ${f(c2[0])} ${f(c2[1])}L${f(a2[0])} ${f(a2[1])}Z`;
  };
  let s = P('t-c', trail(-5.5, 0, 5.5, 32));
  s += P('t-b', trail(5.5, 0, 5.5, 30));
  s += P('t-a', trail(0, 2, 7, 44));
  s += P('t-a', d);
  s += P('t-b', facets);
  s += E('t-c', 36.5, 15.5, 2, 4, 40);
  s += P('t-c', spark(12, 12, 5) + spark(56, 50, 4.5));
  s += C('t-c', 26, 49, 1.5) + C('t-c', 58, 4, 1.3) + C('t-c', 6, 36, 1.3);
  add('shooting-star', 'shooting star with a streaming tail', s);
}

// ---------------------------------------------------------------- satellite
{
  let g = '';
  const panel = x0 => {
    let d = rr(x0, -8, 17, 16, 1.5);
    for (const [cx, cy] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]) d += rs(x0 + 1.5 + cx * 5, -6.5 + cy * 6.8, 4, 6);
    return d;
  };
  g += R('t-b', -15, -1.6, 30, 3.2);
  g += P('t-b', panel(-32) + panel(15), EO);
  let cells = '';
  for (const x0 of [-32, 15]) for (const [cx, cy] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]) cells += rs(x0 + 1.5 + cx * 5, -6.5 + cy * 6.8, 4, 6);
  g += P('t-c', cells);
  g += P('ln', 'M0 -11V-17', ' stroke-width="2.2"');
  g += P('t-b', 'M-7 -17.5Q0 -11 7 -17.5Z');
  g += C('t-b', 0, -24.5, 1.6);
  g += P('ln', 'M0 -17V-23', ' stroke-width="1.6"');
  g += R('t-a', -8.5, -11, 17, 22, 3);
  g += P('t-b', 'M4 -11H5.5Q8.5 -11 8.5 -8V8Q8.5 11 5.5 11H4Z');
  g += R('t-c', -6, -8.5, 2.4, 14, 1.2);
  g += R('t-b', -4, 11, 8, 3, 1);
  g += C('t-c', 0, 0, 3.4);
  g += C('t-b', 0, 0, 1.5);
  let s = `<g transform="translate(32 34) scale(.94) rotate(-28)">${g}</g>`;
  s += P('ln', 'M44 8.5Q49.5 7 53 12M46.5 4Q54.5 2 59 9.5', ' stroke-width="2.2"');
  s += P('t-c', spark(9, 56, 4.5) + spark(55, 55, 3.5));
  s += C('t-c', 8, 10, 1.3) + C('t-c', 60, 30, 1.2);
  add('satellite', 'satellite with solar panels and a dish', s);
}

// ---------------------------------------------------------------- atom
{
  let s = '';
  for (const rot of [0, 60, 120]) s += `<ellipse class="ln" stroke-width="3" cx="32" cy="32" rx="28" ry="10.5" transform="rotate(${rot + 30} 32 32)"/>`;
  s += C('t-a', 32, 32, 9);
  s += C('t-b', 35.5, 29.5, 3.6) + C('t-b', 29.5, 35.8, 3.6);
  s += C('t-c', 28.5, 29, 3.4) + C('t-c', 36, 35.5, 3.2);
  for (const [rot, t] of [[30, 200], [150, 160], [90, 20]]) {
    // point on rotated ellipse
    const ex = 28 * Math.cos(rad(t)), ey = 10.5 * Math.sin(rad(t));
    const x = 32 + ex * Math.cos(rad(rot)) - ey * Math.sin(rad(rot)), y = 32 + ex * Math.sin(rad(rot)) + ey * Math.cos(rad(rot));
    s += C('t-a', x, y, 4.2) + C('t-c', x - 1.2, y - 1.2, 1.4);
  }
  add('atom', 'atom with orbiting electrons', s);
}

// ---------------------------------------------------------------- microscope
{
  const split = (p, t) => { // second half of a cubic split at t
    const L = (u, v) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
    const a1 = L(p[0], p[1]), b1 = L(p[1], p[2]), c1 = L(p[2], p[3]), a2 = L(a1, b1), b2 = L(b1, c1), a3 = L(a2, b2);
    return [a3, b2, c1, p[3]];
  };
  const q = pt => `${f(pt[0])} ${f(pt[1])}`;
  let s = '';
  s += E('t-b', 33, 61.6, 25, 1.9);
  s += P('t-a', 'M26 8C46 7 54 24 51 44V52H41V44C43 29 39 18.5 27 18Z');
  const [q0, q1, q2, q3] = split([[26, 8], [46, 7], [54, 24], [51, 44]], 0.3);
  s += P('t-b', `M${q(q0)}C${q(q1)} ${q(q2)} ${q(q3)}V52H47V44C${f(q2[0] - 5)} ${f(q2[1] + 1)} ${f(q1[0] - 3)} ${f(q1[1] + 2)} ${q(q0)}Z`);
  s += E('t-c', 34.5, 11, 4.2, 1.2, 6);
  s += P('t-a', rr(14, 51, 40, 9, 3));
  s += P('t-b', 'M14 56.5H54V57Q54 60 51 60H17Q14 60 14 57Z');
  s += P('t-a', 'M24 46H36L34 49.5H26Z');
  s += R('t-b', 13, 41.5, 32, 4.5, 2);
  s += R('t-c', 20, 39.7, 14, 1.8, 0.6);
  s += C('t-c', 30, 47.4, 1.4);
  let g = '';
  g += R('t-b', -3.2, -3, 6.4, 5.5, 1);
  g += R('t-a', -5.5, -29, 11, 27, 2.5);
  g += R('t-b', -6.2, -15, 12.4, 4.5, 1);
  g += R('t-b', -7, -35, 14, 7, 2);
  g += R('t-c', -3.2, -26, 2.4, 9, 1.2);
  s += `<g transform="translate(30 38) rotate(-18)">${g}</g>`;
  s += C('t-c', 46.8, 33, 4.5) + C('t-b', 46.8, 33, 1.8);
  add('microscope', 'lab microscope', s);
}

// ---------------------------------------------------------------- dna
{
  const A = 10.5, W = 5, per = 27, y0 = -30, y1 = 30, k = 2 * Math.PI / per;
  const x1 = y => A * Math.sin(k * y), z1 = y => Math.cos(k * y);
  const ribbon = (fx, ya, yb) => {
    const N = Math.max(4, Math.round((yb - ya) / 2));
    const L = [], Rr = [];
    for (let i = 0; i <= N; i++) {
      const y = ya + (yb - ya) * i / N, x = fx(y);
      const dxdy = (fx(y + 0.01) - fx(y - 0.01)) / 0.02;
      const len = Math.hypot(1, dxdy), nx = 1 / len, ny = -dxdy / len;
      L.push([x + nx * W / 2, y + ny * W / 2]); Rr.push([x - nx * W / 2, y - ny * W / 2]);
    }
    return 'M' + pts(L).join('L') + 'L' + pts(Rr.reverse()).join('L') + 'Z';
  };
  // split points where cos changes sign
  const cuts = [y0];
  for (let m = -10; m <= 10; m++) { const y = (Math.PI / 2 + m * Math.PI) / k; if (y > y0 && y < y1) cuts.push(y); }
  cuts.push(y1); cuts.sort((p, q) => p - q);
  let back = '', front = '';
  const s1 = y => x1(y), s2 = y => -x1(y);
  for (let i = 0; i < cuts.length - 1; i++) {
    const ya = cuts[i], yb = cuts[i + 1], ym = (ya + yb) / 2;
    const f1 = z1(ym) > 0;
    (f1 ? (front += ribbon(s1, ya, yb)) : (back += ribbon(s1, ya, yb)));
    (!f1 ? (front += ribbon(s2, ya, yb)) : (back += ribbon(s2, ya, yb)));
  }
  let rungs = '';
  for (let y = y0 + 2.5; y <= y1 - 2; y += 5) {
    const xx = Math.abs(x1(y));
    if (xx < 4) continue;
    rungs += rr(-xx, y - 1.3, 2 * xx, 2.6, 1.3);
  }
  let g = P('t-b', back) + P('t-c', rungs) + P('t-a', front);
  let s = `<g transform="translate(32 32) rotate(35)">${g}</g>`;
  s += P('t-c', spark(10, 11, 4.5) + spark(55, 54, 4));
  add('dna', 'twisting double helix', s);
}

// ---------------------------------------------------------------- magnet
{
  let g = '';
  g += P('t-a', 'M12 46V26A20 20 0 0 1 52 26V46H40.5V26A8.5 8.5 0 0 0 23.5 26V46Z');
  g += P('t-b', 'M43.5 9.6A20 20 0 0 1 52 26V46H47V26A17 17 0 0 0 43.5 9.6Z');
  g += P('t-c', 'M14.7 33V26A17.3 17.3 0 0 1 22.1 11.8L23.5 13.9A14.8 14.8 0 0 0 17.2 26V33Z');
  g += R('t-c', 12, 46, 7.5, 10) + R('t-b', 19.5, 46, 4, 10) + R('t-c', 40.5, 46, 7.5, 10) + R('t-b', 48, 46, 4, 10);
  g += P('ln', 'M13 59.5L10.5 63M17.8 60V64M22.5 59.5L25 63M41.5 59.5L39 63M46.3 60V64M51 59.5L53.5 63', ' stroke-width="2.6"');
  let s = `<g transform="translate(30.5 30) scale(.86) rotate(-35) translate(-32 -36)">${g}</g>`;
  s += P('t-c', spark(55, 9, 4.5) + spark(8, 56, 3.5));
  add('magnet', 'horseshoe magnet with a pull', s);
}

// ---------------------------------------------------------------- lightbulb
{
  let rays = '';
  for (const a of [-90, -55, -125, -20, -160]) { const [x1, y1] = onC(32, 26, 20, a), [x2, y2] = onC(32, 26, 23.6, a); rays += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`; }
  let s = P('ln', rays, ' stroke-width="2.6"');
  s += P('t-a', 'M24 44C24 38 16 35.5 16 26A16 16 0 0 1 48 26C48 35.5 40 38 40 44Z');
  s += P('t-b', 'M43.3 14.7A16 16 0 0 1 48 26C48 35.5 40 38 40 44H35.5C35.5 38 44 35 44 26C44 21.5 44 18 43.3 14.7Z');
  s += E('t-c', 23.5, 19.5, 2.2, 5.5, 38);
  s += P('ln', 'M28.5 44V34L30.3 30.5L32 34L33.7 30.5L35.5 34V44', ' stroke-width="2.2"');
  s += P('t-b', rr(23, 43.5, 18, 4, 1.5));
  s += P('t-c', rr(24, 47.5, 16, 2.6, 1.2));
  s += P('t-b', rr(24, 50.1, 16, 3, 1.2));
  s += P('t-c', rr(25, 53.1, 14, 2.6, 1.2));
  s += P('t-b', 'M27.5 55.7H36.5Q35.5 60.5 32 60.5Q28.5 60.5 27.5 55.7Z');
  add('lightbulb', 'glowing light bulb', s);
}

// ---------------------------------------------------------------- gear
{
  const gear = (cx, cy, r0, rt, n, ph) => {
    const pitch = 360 / n; let d = '';
    for (let i = 0; i < n; i++) {
      const a = ph + i * pitch;
      const q = [[a - 0.27 * pitch, r0], [a - 0.14 * pitch, rt], [a + 0.14 * pitch, rt], [a + 0.27 * pitch, r0]].map(([ang, r]) => onC(cx, cy, r, ang));
      d += (i ? 'L' : 'M') + `${f(q[0][0])} ${f(q[0][1])}L${f(q[1][0])} ${f(q[1][1])}L${f(q[2][0])} ${f(q[2][1])}L${f(q[3][0])} ${f(q[3][1])}`;
      if (i === n - 1) { const s0 = onC(cx, cy, r0, ph - 0.27 * pitch); d += 'Z'; }
    }
    return d;
  };
  const band = (cx, cy, r1, r2, a1, a2) => { const [p1, p2, p3, p4] = [onC(cx, cy, r2, a1), onC(cx, cy, r2, a2), onC(cx, cy, r1, a2), onC(cx, cy, r1, a1)];
    return `M${f(p1[0])} ${f(p1[1])}A${r2} ${r2} 0 0 1 ${f(p2[0])} ${f(p2[1])}L${f(p3[0])} ${f(p3[1])}A${r1} ${r1} 0 0 0 ${f(p4[0])} ${f(p4[1])}Z`; };
  const B = [26, 39, 17, 22.5, 10, -27], S = [48, 17, 9.5, 13.5, 8, 135];
  let s = '';
  s += P('t-b', gear(B[0] + 1, B[1] + 1.5, ...B.slice(2)) + cs(B[0] + 1, B[1] + 1.5, 5.5), EO);
  s += P('t-a', gear(...B) + cs(B[0], B[1], 5.5), EO);
  s += P('t-b', cs(B[0], B[1], 9) + cs(B[0], B[1], 5.5), EO);
  s += P('t-c', band(B[0], B[1], 11.5, 14, 195, 250));
  s += P('t-b', gear(S[0] + 0.8, S[1] + 1.2, ...S.slice(2)) + cs(S[0] + 0.8, S[1] + 1.2, 3.4), EO);
  s += P('t-a', gear(...S) + cs(S[0], S[1], 3.4), EO);
  s += P('t-b', cs(S[0], S[1], 5.6) + cs(S[0], S[1], 3.4), EO);
  s += P('t-c', band(S[0], S[1], 6.6, 8.3, 195, 250));
  add('gear', 'two meshing cogs', s);
}

// ---------------------------------------------------------------- laptop
{
  let s = E('t-b', 32, 58.3, 27, 1.9);
  s += P('t-a', rr(8, 5, 48, 37, 3.5) + rr(12, 9, 40, 29, 1.5), EO);
  s += P('t-c', rr(12, 9, 40, 29, 1.5));
  s += P('ln', 'M25 17.5L19 23.5L25 29.5M39 17.5L45 23.5L39 29.5M35 15.5L29 31.5', ' stroke-width="3"');
  s += C('t-b', 32, 7, 0.9);
  s += R('t-b', 10, 42, 44, 3);
  s += P('t-a', 'M2 45H62V48.5Q62 52.5 58 52.5H6Q2 52.5 2 48.5Z');
  s += P('t-b', 'M2 49H62Q62 52.5 58 52.5H6Q2 52.5 2 49Z');
  s += P('t-b', 'M26 45H38V46Q38 47.5 36.5 47.5H27.5Q26 47.5 26 46Z');
  s += R('t-c', 6, 45.8, 13, 1.4, 0.7);
  add('laptop', 'open laptop showing code', s);
}

// ---------------------------------------------------------------- smartphone
{
  let s = P('ln', 'M10 16Q7 22.5 10 29M5 12.5Q0.5 22.5 5 32.5M55 16Q58 22.5 55 29M60 12.5Q64.5 22.5 60 32.5', ' stroke-width="2.4"');
  s += P('t-b', rr(19, 5, 30, 58, 6));
  s += P('t-a', rr(16, 3, 30, 58, 6) + rr(19, 9, 24, 45, 2), EO);
  s += P('t-c', rr(19, 9, 24, 45, 2));
  s += R('t-b', 27, 5.3, 8, 1.8, 0.9) + R('t-b', 26, 56.8, 10, 1.8, 0.9) + R('t-b', 14.4, 15, 1.8, 7, 0.9);
  let a = '', b = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const d = rr(21 + c * 7.25, 12 + r * 7.5, 5.5, 5.5, 1.6);
    ((r * 3 + c) % 4 === 1 ? (b += d) : (a += d));
  }
  s += P('t-a', a) + P('t-b', b);
  s += P('t-a', rr(20.5, 44.8, 21, 7.4, 2.4));
  s += P('t-b', rr(22.8, 46.2, 4.6, 4.6, 1.4) + rr(28.7, 46.2, 4.6, 4.6, 1.4) + rr(34.6, 46.2, 4.6, 4.6, 1.4));
  add('smartphone', 'smartphone with app icons, buzzing', s);
}

// ---------------------------------------------------------------- battery
{
  let s = P('t-b', rr(3, 19, 52, 31, 6.5));
  s += P('t-b', rr(52, 25.5, 9, 15, 2.5));
  s += P('t-a', rr(3, 16.5, 52, 31, 6.5) + rr(8, 21.5, 42, 21, 3), EO);
  s += P('t-c', rr(9, 23, 8.5, 18, 1.5) + rr(19.5, 23, 8.5, 18, 1.5) + rr(30, 23, 8.5, 18, 1.5));
  s += R('t-c', 9, 18.2, 16, 1.6, 0.8);
  s += P('t-b', 'M36 9L21.5 34H30.5L25.5 55L41.5 28.5H32Z');
  add('battery', 'charging battery with a lightning bolt', s);
}

// ---------------------------------------------------------------- game-controller
{
  const body = 'M20 17H44C54 17 58.5 24 61 36C63.5 48 60 55 54 55C49.5 55 46.5 50 43 46H21C17.5 50 14.5 55 10 55C4 55 0.5 48 3 36C5.5 24 10 17 20 17Z';
  const btn = [[46, 24.5], [46, 37.5], [39.5, 31], [52.5, 31]];
  let s = P('ln', 'M32 17C32 11 25 12.5 25 7.5C25 3.5 30 2.5 33 4', ' stroke-width="2.5"');
  s += `<path class="t-b" transform="translate(0 2.5)" d="${body}"/>`;
  s += P('t-a', body + btn.map(([x, y]) => cs(x, y, 3.2)).join(''), EO);
  s += P('t-c', btn.map(([x, y]) => cs(x, y, 3.2)).join(''));
  s += P('t-b', 'M14 25H18V29H22V33H18V37H14V33H10V29H14Z');
  s += C('t-b', 25, 40, 3.6) + C('t-b', 39, 40, 3.6);
  s += R('t-b', 26.5, 26, 4.5, 2.2, 1.1) + R('t-b', 33, 26, 4.5, 2.2, 1.1);
  s += P('t-c', 'M8 28Q11 20.5 19 20L19.5 22.5Q13 23 10.5 29Z');
  add('game-controller', 'video game controller', s);
}

// ---------------------------------------------------------------- wheel
{
  const [cx, cy] = [35.5, 32];
  let tread = '';
  const N = 30, st = 360 / N;
  for (let i = 0; i < N; i++) {
    const a = i * st;
    tread += (i ? 'L' : 'M') + pts([onC(cx, cy, 25.6, a - 0.32 * st), onC(cx, cy, 26.8, a - 0.22 * st), onC(cx, cy, 26.8, a + 0.22 * st), onC(cx, cy, 25.6, a + 0.32 * st)]).join('L');
  }
  tread += 'Z';
  let s = P('ln', 'M3 23H8M2 32H6M3 41H8', ' stroke-width="2.5"');
  s += P('t-b', tread + cs(cx, cy, 17), EO);
  const [g1, g2, g3, g4] = [onC(cx, cy, 24, 200), onC(cx, cy, 24, 250), onC(cx, cy, 21.5, 250), onC(cx, cy, 21.5, 200)];
  s += P('t-c', `M${f(g1[0])} ${f(g1[1])}A24 24 0 0 1 ${f(g2[0])} ${f(g2[1])}L${f(g3[0])} ${f(g3[1])}A21.5 21.5 0 0 0 ${f(g4[0])} ${f(g4[1])}Z`);
  let holes = '';
  for (let k = 0; k < 5; k++) { const [x, y] = onC(cx, cy, 10.8, -90 + k * 72); holes += cs(x, y, 3.8); }
  s += P('t-a', cs(cx, cy, 17) + holes + cs(cx, cy, 4.8), EO);
  s += `<circle class="ln" stroke-width="1.6" cx="${cx}" cy="${cy}" r="15"/>`;
  s += C('t-c', cx, cy, 4.8) + C('t-b', cx, cy, 1.8);
  add('wheel', 'rolling tyre and rim', s);
}

// ---------------------------------------------------------------- traffic-cone
{
  const xl = y => 26 - 12 * (y - 6) / 44, xr = y => 38 + 12 * (y - 6) / 44;
  const piece = (ya, yb) => poly([[xl(ya), ya], [xr(ya), ya], [xr(yb), yb], [xl(yb), yb]]);
  let s = E('t-b', 32, 60.5, 28, 1.8);
  s += P('t-a', 'M9 46H55L60.5 51.5H3.5Z');
  s += P('t-b', rr(3.5, 51, 57, 7, 2));
  s += P('t-a', `M28 4.5H36Q38.2 4.5 38.7 6.8L${f(xr(16))} 16H${f(xl(16))}L25.3 6.8Q25.8 4.5 28 4.5Z`);
  s += P('t-c', piece(16, 25) + piece(33, 42));
  s += P('t-a', piece(25, 33) + piece(42, 49));
  s += P('t-b', 'M35.3 4.6Q38.2 4.5 38.7 6.8L50.2 49H43Z');
  s += P('t-c', 'M27.2 7H29.2L27.8 14H25.3Z');
  add('traffic-cone', 'striped traffic cone', s);
}

// ---------------------------------------------------------------- steering-wheel
{
  const [cx, cy] = [32, 32];
  const ring = (r1, r2, a1, a2) => { const [p1, p2, p3, p4] = [onC(cx, cy, r2, a1), onC(cx, cy, r2, a2), onC(cx, cy, r1, a2), onC(cx, cy, r1, a1)];
    return `M${f(p1[0])} ${f(p1[1])}A${r2} ${r2} 0 0 1 ${f(p2[0])} ${f(p2[1])}L${f(p3[0])} ${f(p3[1])}A${r1} ${r1} 0 0 0 ${f(p4[0])} ${f(p4[1])}Z`; };
  // nonzero: outer circle and spokes wind one way, the inner circle the other
  const outer = `M${cx - 28} ${cy}a28 28 0 1 0 56 0a28 28 0 1 0 -56 0Z`;
  const inner = `M${cx - 21.5} ${cy}a21.5 21.5 0 1 1 43 0a21.5 21.5 0 1 1 -43 0Z`;
  const spokes = 'M10.5 28V36L26 37.5V26.5ZM38 26.5V37.5L53.5 36V28ZM28 36V54H36V36Z';
  let s = P('t-b', `M${cx - 28 + 1} ${cy + 2}a28 28 0 1 0 56 0a28 28 0 1 0 -56 0ZM${cx - 21.5 + 1} ${cy + 2}a21.5 21.5 0 1 1 43 0a21.5 21.5 0 1 1 -43 0Z`);
  s += P('t-a', outer + inner + spokes);
  s += P('t-b', ring(21.5, 28, 10, 80));
  s += P('t-c', ring(23.5, 26, 195, 250));
  s += C('t-b', cx, cy, 9);
  s += C('t-c', cx, cy, 4.5);
  add('steering-wheel', 'car steering wheel', s);
}

// ---------------------------------------------------------------- siren
{
  let rays = '';
  for (const a of [-90, -125, -55, -160, -20]) { const [x1, y1] = onC(32, 33, 21.5, a), [x2, y2] = onC(32, 33, 28, a); rays += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`; }
  let s = P('ln', rays, ' stroke-width="2.8"');
  s += P('t-a', 'M15 44V32A17 17 0 0 1 49 32V44Z');
  s += P('t-b', 'M43.5 44V32C43.5 26 41.5 21.5 38 18.4A17 17 0 0 1 49 32V44Z');
  s += R('t-b', 15, 34, 34, 4);
  s += P('t-c', rr(20, 22, 3.2, 10, 1.6));
  s += C('t-c', 32, 27, 3.6);
  s += P('t-a', rr(11, 43, 42, 6, 2));
  s += P('t-b', rr(8, 48, 48, 9, 3));
  s += R('t-c', 12, 50.5, 10, 1.6, 0.8);
  add('siren', 'flashing emergency siren light', s);
}

fs.writeFileSync(OUT, JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
