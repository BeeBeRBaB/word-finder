// Generates part26.json (round 4).
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
// shoelace sign matches cap() (negative), so rpoly parts union with caps under nonzero
const area = p => p.reduce((s, v, i) => { const w = p[(i + 1) % p.length]; return s + v[0] * w[1] - w[0] * v[1]; }, 0);
const neg = p => area(p) > 0 ? p.slice().reverse() : p;
const mxp = pts => pts.map(([x, y]) => [64 - x, y]);

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- reference-book
{
  let s = '';
  const T = 8.5, B = 58;
  // back board sliver (right edge)
  s += P('t-b', rpoly([[52.5, 9.5], [55.5, 9.5], [57.5, 11.5], [57.5, B], [52.5, B]], [0, 1.5, 1.5, 1.5, 0]));
  // page block with thumb-index notches
  const ys = [15, 22, 29, 36, 43, 50];
  let notch = ''; for (const y of ys) notch += `M54.6 ${f(y - 2.6)}A2.6 2.6 0 0 0 54.6 ${f(y + 2.6)}Z`;
  s += P('t-c', rpoly([[46, T + 1.5], [54.6, T + 1.5], [54.6, B - 1.5], [46, B - 1.5]], .6));
  s += P('t-b', notch);
  // page lines on the fore-edge
  s += L(`M49 ${T + 4}V${B - 4}`, .7);
  // spine (rounded, thick)
  const sp = `M7.5 ${T + 2}Q12.5 ${T - 1.5} 18.5 ${T}V${B}Q12.5 ${B + 2} 7.5 ${B - 1.5}Z`;
  s += P('t-a', sp);
  s += P('t-b', `M7.5 ${T + 2}Q12.5 ${T - 1.5} 18.5 ${T}V${T + 3.5}Q12.5 ${T + 2.3} 7.5 ${T + 5}Z` +
    `M7.5 ${B - 4.5}Q12.5 ${B - 2} 18.5 ${B - 3.5}V${B}Q12.5 ${B + 2} 7.5 ${B - 1.5}Z` +
    `M7.5 14Q12.5 12.5 18.5 13.5V15.2Q12.5 14.2 7.5 15.7Z` + `M7.5 50.5Q12.5 49 18.5 50V51.7Q12.5 50.7 7.5 52.2Z`);
  // A - Z on the spine
  const cx = 13;
  s += L(`M${cx - 3} 25L${cx} 18L${cx + 3} 25M${cx - 1.8} 22.4H${cx + 1.8}` + `M${cx} 28.5V32.5` + `M${cx - 3} 36H${cx + 3}L${cx - 3} 43H${cx + 3}`, 1.7);
  // cover with label hole
  const lab = 'M25 17H41.5Q43 17 43 18.5V26.5Q43 28 41.5 28H25Q23.5 28 23.5 26.5V18.5Q23.5 17 25 17Z';
  s += P('t-a', rpoly([[19.2, T], [46, T], [46, B], [19.2, B]], [0, 1.5, 1.5, 0]) + lab, ' fill-rule="evenodd"');
  s += P('t-c', lab);
  s += R('t-b', 27, 20.3, 12.5, 2, 1) + R('t-b', 29, 24, 8.5, 1.6, .8);
  // cover frame + shade at the joint
  s += L(`M22 ${T + 3}H43V${B - 3}H22Z`, 1);
  s += P('t-b', `M19.2 ${T}H20.8V${B}H19.2Z`);
  s += P('t-b', 'M30 38L33.2 34.8L36.4 38L33.2 41.2Z');
  // ribbon bookmark
  s += P('t-b', `M39 ${B}H42.5V${B + 4}L40.75 ${B + 2.6}L39 ${B + 4}Z`);
  s += P('t-c', spark(58, 4.8, 3.2) + spark(4.5, 59, 2.6));
  add('reference-book', 'thick reference dictionary with thumb-index tabs and A-Z spine', s);
}

// ---------- marked-up-page
{
  let s = '';
  const x0 = 10, x1 = 46, y0 = 5, y1 = 57, d = 9;
  // back sheet sliver (left + bottom)
  s += P('t-b', rpoly([[x0, y0 + 4], [x0, y1], [x1 - 3, y1], [x1 - 3, y1 + 3.5], [x0 - 4, y1 + 3.5], [x0 - 4, y0 + 4]], [0, 0, 0, 1, 1.5, 1]));
  // text bars (cut out of the page, drawn in t-a)
  const bar = (a, b, y, h = 3.2) => `M${f(a + h / 2)} ${f(y)}H${f(b - h / 2)}A${f(h / 2)} ${f(h / 2)} 0 0 1 ${f(b - h / 2)} ${f(y + h)}H${f(a + h / 2)}A${f(h / 2)} ${f(h / 2)} 0 0 1 ${f(a + h / 2)} ${f(y)}Z`;
  const bars = bar(15, 31, 11, 4.2) +
    bar(15, 21, 20) + bar(23.5, 33, 20) + bar(35.5, 41, 20) +
    bar(15, 25, 28) + bar(29, 41, 28) +
    bar(15, 41, 36) +
    bar(15, 20, 44) + bar(22.5, 30, 44) + bar(32.5, 37, 44) +
    bar(15, 28, 52, 3);
  const page = `M${x0} ${y0 + 1.5}Q${x0} ${y0} ${x0 + 1.5} ${y0}H${x1 - d}L${x1} ${y0 + d}V${y1 - 1.5}Q${x1} ${y1} ${x1 - 1.5} ${y1}H${x0 + 1.5}Q${x0} ${y1} ${x0} ${y1 - 1.5}Z`;
  // dog-ear
  s += P('t-b', `M${x1 - d} ${y0}V${y0 + d - 1.5}Q${x1 - d} ${y0 + d} ${x1 - d + 1.5} ${y0 + d}H${x1}Z`);
  // pen: dark nib + grip, barrel cut out of the page where it crosses it
  const ang = -45 * Math.PI / 180, ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const nb = [31.5, 50], at = t => [nb[0] + ux * t, nb[1] + uy * t];
  const qp = (t0, t1, w0, w1) => { const a = at(t0), b = at(t1);
    return [[a[0] + nx * w0, a[1] + ny * w0], [b[0] + nx * w1, b[1] + ny * w1], [b[0] - nx * w1, b[1] - ny * w1], [a[0] - nx * w0, a[1] - ny * w0]]; };
  const poly = q => 'M' + q.map(v => `${f(v[0])} ${f(v[1])}`).join('L') + 'Z';
  const quad = (...a) => poly(qp(...a));
  // clip a convex polygon to x <= X (Sutherland-Hodgman, one edge)
  const clipX = (q, X) => { const o = []; q.forEach((v, i) => { const w = q[(i + 1) % q.length], vi = v[0] <= X, wi = w[0] <= X;
    if (vi) o.push(v); if (vi !== wi) { const t = (X - v[0]) / (w[0] - v[0]); o.push([X, v[1] + t * (w[1] - v[1])]); } }); return o; };
  const barrel = qp(17.6, 33, 3.6, 3.6), inPage = clipX(barrel, x1);
  s += P('t-c', page + bars + (inPage.length > 2 ? poly(inPage) : ''), ' fill-rule="evenodd"');
  s += P('t-a', bars);
  // proof marks: strike-through, caret, circled typo
  s += L('M22 21.6H34.6', 2.4);
  s += L('M24.3 35.2L27 31.4L29.7 35.2', 2.2);
  s += E('ln', 26.2, 45.6, 6.4, 4.5, -6).replace('/>', ' stroke-width="2.2"/>');
  s += P('t-b', quad(0, 6, .3, 2.6));
  s += P('t-b', quad(6, 17, 3.4, 3.6));
  s += P('t-a', poly(barrel));
  const e = at(33.6);
  s += P('t-b', quad(33.6, 35.2, 3.6, 3.6) + circ(e[0] + ux * 2.4, e[1] + uy * 2.4, 3.3));
  // clip
  const c0 = at(22), c1 = at(31);
  s += P('t-b', cap(c0[0] + nx * 3.6, c0[1] + ny * 3.6, c1[0] + nx * 3.6, c1[1] + ny * 3.6, 2.2));
  s += P('t-c', spark(57, 7, 3.4) + spark(57, 55, 2.6));
  add('marked-up-page', 'page of text with proofreading marks and a pen', s);
}

// ---------- grandfather-clock
{
  let s = '';
  // hood with face hole
  const hood = 'M16 26V11Q16 8 19 8H22Q32 0.5 42 8H45Q48 8 48 11V26Z';
  s += P('t-a', hood + circ(32, 15.8, 8.6), ' fill-rule="evenodd"');
  s += P('t-b', circ(32, 15.8, 8.6) + circ(32, 15.8, 7), ' fill-rule="evenodd"');
  s += P('t-c', circ(32, 15.8, 7));
  s += L('M32 9.9V11.3M32 20.3V21.7M26.1 15.8H27.5M36.5 15.8H37.9', 1.2);
  s += L('M32 15.8L32 11.6M32 15.8L35.4 17.6', 1.5);
  s += C('t-b', 32, 15.8, 1.1);
  // finials
  s += C('t-a', 19, 5.6, 2.1) + C('t-a', 45, 5.6, 2.1);
  // waist with door hole
  const door = 'M26 49V32Q26 27.5 32 27.5Q38 27.5 38 32V49Z';
  s += P('t-a', 'M21 28H43V50H21Z' + door, ' fill-rule="evenodd"');
  s += P('t-c', door);
  // pendulum (swung a little)
  s += `<g transform="rotate(8 32 28.5)">` + L('M32 28.5V41', 1.6) + C('t-b', 32, 43, 3.6) + `</g>`;
  s += L('M28 30.5V33.5', 1.3);
  // base
  s += P('t-a', 'M18 51H46V58H18Z');
  s += R('t-b', 22.5, 52.8, 19, 3.4, 1);
  // ledges and feet
  s += R('t-b', 14, 25, 36, 3.2, 1.2) + R('t-b', 17, 48.8, 30, 2.8, 1) + R('t-b', 15.5, 57.3, 33, 2.8, 1.2);
  s += P('t-b', 'M18 59.8H24.5L23.5 62H19Z' + 'M39.5 59.8H46L45 62H40.5Z');
  // right-side shade of the case
  s += P('t-b', 'M44.6 11V25H48V11Q48 8.4 45.5 8Z' + 'M40.8 28.2H43V48.8H40.8Z');
  s += P('t-c', spark(8, 33, 3.6) + spark(56.5, 41, 2.8) + spark(7, 50, 2.2));
  add('grandfather-clock', 'tall grandfather clock with round face and pendulum', s);
}

// ---------- newspaper
{
  let s = '';
  const x0 = 13, x1 = 58, y0 = 8, y1 = 54;
  // folded-back half behind (left + bottom)
  s += P('t-b', rpoly([[x0, y0 + 2], [x0, y1], [x1 - 2, y1], [x1 - 4, y1 + 4.5], [x0 - 6.5, y1 + 4.5], [x0 - 6.5, y0 + 6]], [0, 0, 0, 1.2, 1.5, 1.5]));
  // photo hole contents: the t-b photo has a sun + hills cut out, revealing the page
  const ph = [16.5, 35, 17.5, 13.5];
  const photoHoles = circ(ph[0] + 12.5, ph[1] + 4, 2.2) + `M${ph[0] + 1.5} ${ph[1] + ph[3] - 1.5}L${ph[0] + 6.5} ${ph[1] + 6}L${ph[0] + 10} ${ph[1] + 10}L${ph[0] + 12.5} ${ph[1] + 8}L${ph[0] + 16} ${ph[1] + ph[3] - 1.5}Z`;
  s += P('t-a', rpoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [1, 1.5, 1.5, 0]));
  // masthead
  s += R('t-b', 22, 11, 27, 5.2, 1.2);
  s += L(`M16.5 19.3H${x1 - 3.5}M16.5 21.4H${x1 - 3.5}`, .9);
  // headline (two heavy lines)
  s += R('t-b', 16.5, 24, 38, 4.2, 1.2) + R('t-b', 16.5, 30, 26, 3.4, 1.2);
  // photo block
  s += P('t-b', `M${ph[0]} ${ph[1]}h${ph[2]}v${ph[3]}h${-ph[2]}Z` + photoHoles, ' fill-rule="evenodd"');
  // caption + columns
  s += L(`M16.5 51H${ph[0] + ph[2]}`, 1.3);
  let col = '';
  for (let y = 35.8; y < 51.5; y += 3.05) col += `M37.5 ${f(y)}H${y > 50 ? 48 : 54.5}`;
  s += L(col, 1.3);
  s += L('M46 31.7H54.5', 1.3);
  s += P('t-c', spark(6, 6, 3.4) + spark(59.5, 60, 2.6));
  add('newspaper', 'folded newspaper with headline, photo and columns', s);
}

// ---------- hand
{
  let s = '<g transform="rotate(-14 32 40)">';
  const palm = neg([[19.5, 33], [44.6, 33.5], [45.8, 45], [41.5, 52.5], [40.2, 59.5], [26, 59.5], [24.6, 53], [18.5, 46]]);
  const fingers = cap(24.4, 33, 21.8, 13.8, 6.4) + cap(30.8, 31.5, 30.4, 9.8, 6.8) + cap(37, 32.5, 39.2, 12.4, 6.4) + cap(42.4, 36, 47.8, 22, 5.6);
  const thumb = limb([[25, 48], [16.5, 41.5], [11.8, 33.2]], 7.6);
  s += P('t-a', rpoly(palm, [5, 5, 6, 4, 3, 3, 4, 6]) + fingers + thumb);
  // shade: heel of hand, palm creases
  s += P('t-b', 'M45.6 41Q46 48 41.5 52.5L40.4 58Q40.2 59.5 38.6 59.5H37.4Q38.4 49 42 41Z');
  s += L('M25.6 50Q23 43.6 25.8 37.5', 1.6);
  s += L('M29.4 43.4Q35.2 40.8 41.4 42.6', 1.6);
  s += '</g>';
  // motion marks
  s += L('M8.5 15.5Q6.8 9.8 10.4 5.6M13.4 18.4Q12.2 13.4 14.8 10.2', 2.2);
  s += L('M53.6 7.4Q58.8 11.1 58.8 17.3M51 12.4Q54.4 14.7 54.8 19', 2.2);
  s += P('t-c', spark(56.5, 31, 2.8) + spark(8, 54, 2.6));
  add('hand', 'open waving hand, palm forward, with motion marks', s);
}

// ---------- heart-hands
{
  let s = '';
  // two open palms from the front, fingers together pointing up and out, thumbs outside
  const ROT = -9 * Math.PI / 180, ox = 31.2, oy = 58, cs = Math.cos(ROT), sn = Math.sin(ROT);
  const rt = ([x, y]) => [ox + (x - ox) * cs - (y - oy) * sn, oy + (x - ox) * sn + (y - oy) * cs];
  const hand = m => {
    const T = pt => { const q = rt(pt); return m ? [64 - q[0], q[1]] : q; };
    const cp = (a, b, w) => { const p = T(a), q = T(b); return cap(p[0], p[1], q[0], q[1], w); };
    const palm = neg([[12, 30], [31.2, 30], [31.2, 52], [28.5, 59], [17, 59], [12, 50]].map(T));
    const fin = cp([14.8, 31], [14.8, 13.5], 5.6) + cp([20.2, 31], [20.2, 9.5], 5.8) + cp([25.6, 31], [25.6, 11.5], 5.6) + cp([30.3, 32], [30.3, 17.5], 5);
    const th = [[16, 51], [10, 43.5], [8.6, 35.5]].map(T);
    return { body: rpoly(palm, [4, .5, .5, 4, 4, 4]) + fin + limb(th, 6.6),
      lines: [[[17.5, 17], [17.5, 29.5]], [[22.9, 14.5], [22.9, 29.5]], [[28.1, 20], [28.1, 30]]].map(([a, b]) => { const p = T(a), q = T(b); return `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`; }).join(''),
      crease: (() => { const a = T([16.5, 47]), c = T([18, 38.5]), b = T([24, 36.5]); return `M${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`; })() };
  };
  const hl = hand(0), hr = hand(1);
  s += P('t-a', hl.body + hr.body);
  s += L(hl.lines + hr.lines, 1.3);
  s += L(hl.crease + hr.crease, 1.4);
  // heart resting in the hollow of the palms, highlight cut out to the palm below
  const hrt = 'M32 57.5C23.6 52 19.2 47 20 41.6C20.8 36.4 27.4 34.8 32 39.8C36.6 34.8 43.2 36.4 44 41.6C44.8 47 40.4 52 32 57.5Z';
  const hg = 'M22.8 42.4C22.8 40 24.4 38.6 26.4 38.6C27.3 38.6 27.3 39.9 26.4 40C25.3 40.2 24.6 41 24.5 42.4C24.4 43.5 22.9 43.5 22.8 42.4Z';
  s += P('t-b', hrt + hg, ' fill-rule="evenodd"');
  s += P('t-c', spark(55.5, 6.5, 3.2) + spark(8.5, 7, 2.6));
  add('heart-hands', 'two open cupped palms holding a heart', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part26.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
