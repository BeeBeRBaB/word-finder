// Generates part39.json (round 4: costume and art subjects).
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
// one closed outline around a polyline (no self-overlap), so it can be cut out with evenodd
const ribbon = (pts, w) => {
  const h = w / 2, n = pts.length, L1 = [], R1 = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    L1.push([pts[i][0] - dy / l * h, pts[i][1] + dx / l * h]); R1.push([pts[i][0] + dy / l * h, pts[i][1] - dx / l * h]);
  }
  return 'M' + [...L1, ...R1.reverse()].map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
};
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';

// ---------- costume-trunk
{
  let s = '';
  // clip a straight-edged polygon to y0 <= y <= y1 (Sutherland-Hodgman)
  const clipY = (pts, y0, y1) => {
    const side = (q, yc, keep) => { const out = [];
      for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length], ia = keep(a[1]), ib = keep(b[1]);
        if (ia) out.push(a);
        if (ia !== ib) { const t = (yc - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, yc]); } }
      return out; };
    return side(side(pts, y0, y => y >= y0), y1, y => y <= y1);
  };
  const crown = [[11, 39], [10, 23.5], [14.5, 29], [18.5, 19.5], [22.5, 29], [27, 23.5], [26, 39]];
  // wizard hat: wide brim, tall cone with a bent tip
  const brimB = Array.from({ length: 7 }, (_, i) => { const a = Math.PI * i / 6; return [44 + 12.5 * Math.cos(a), 37.2 + 3 * Math.sin(a)]; });
  const hat = [[31.5, 37.2], [37, 35.4], [40.5, 22], [43.5, 13], [47, 7.5], [51.5, 5.5], [48.5, 10], [48, 17], [49.5, 26], [51.2, 35.4], [56.5, 37.2], ...brimB.slice(1, 6)];
  const stars = poly(star(44.6, 20.5, 2.6, 1.1)) + poly(star(46.6, 12.6, 1.8, .8));
  const jewels = circ(14, 34.5, 1.3) + circ(18.5, 34.5, 1.3) + circ(23, 34.5, 1.3);
  // plain lid thrown back: dark inner face (with the two items cut out of it) and a light top edge
  const lid = rpoly([[6.5, 38], [57.5, 38], [60, 26], [4, 26]], 2);
  s += P('t-b', lid + poly(clipY(crown, 26.6, 37.9)) + poly(clipY(hat, 26.6, 37.9)) + jewels, ' fill-rule="evenodd"');
  // crown with jewel holes and tip balls
  s += P('t-a', poly(crown) + jewels, ' fill-rule="evenodd"');
  s += P('t-a', circ(10, 23, 1.7) + circ(18.5, 19, 1.9) + circ(27, 23, 1.7));
  // hat with star holes and a band
  s += P('t-a', poly(hat) + stars, ' fill-rule="evenodd"');
  s += P('t-c', stars);
  s += P('t-b', 'M38.9 30.8H50.2L50.8 34H38.2Z');
  // trunk front: rim, base, latch
  s += P('t-a', rpoly([[5.5, 38], [58.5, 38], [58.5, 59.5], [5.5, 59.5]], 2.5));
  s += P('t-b', rpoly([[5, 37.5], [59, 37.5], [59, 41.5], [5, 41.5]], 1.5) + 'M5.5 55H58.5V57Q58.5 59.5 56 59.5H8Q5.5 59.5 5.5 57Z');
  s += P('t-b', rpoly([[37, 40], [43, 40], [43, 47], [37, 47]], 1.2));
  s += P('t-a', circ(40, 43.5, 1.2));
  // scarf end hanging over the rim as a smooth wavy ribbon, with fringe
  const sc = Array.from({ length: 13 }, (_, i) => [17 + 2.4 * Math.sin(i / 12 * Math.PI * 2.2), 39 + i * 1.25]);
  s += P('t-b', ribbon(sc, 7));
  const ex = sc[12][0];
  s += L(`M${f(ex - 2)} 54.5v3M${f(ex)} 54.5v3.6M${f(ex + 2)} 54.5v3`, 1.2);
  s += P('t-c', spark(29.5, 9, 3.5) + spark(7, 7, 2.6) + spark(59, 15, 2.4));
  add('costume-trunk', 'open dress-up trunk with a crown and a starry wizard hat, scarf hanging down', s);
}

// ---------- dress-form
{
  let s = '';
  // stand: pole and tripod
  s += P('t-b', 'M27 50H30V56H27Z' + limb([[28.5, 55.5], [18, 59]], 2.6) + limb([[28.5, 55.5], [39, 59]], 2.6));
  s += P('t-a', circ(18, 59, 1.6) + circ(39, 59, 1.6) + circ(28.5, 55.5, 1.8));
  // neck post and knob
  s += R('t-b', 25.5, 6, 6, 8, 1);
  s += P('t-a', circ(28.5, 5.6, 2.6));
  // tape measure draped round the neck base (cut out of the bare torso)
  const tp = [[19.5, 32], [20.8, 23], [23.5, 17], [28.5, 15.6], [33.5, 17], [35.5, 20.6]];
  const tape = ribbon(tp, 3.2);
  // bare torso: everything the gown does not cover
  const bare = [[28.5, 35], [28.5, 23.5], [36, 21.3], [44, 21.8], [43.6, 19.5], [41.5, 15], [33, 12.5], [24, 12.5], [15.5, 15], [13, 21], [15, 29], [19.5, 35]];
  s += P('t-b', rpoly(bare, [0, 0, 0, 0, 1, 4, 3, 3, 4, 5, 4, 2]) + tape, ' fill-rule="evenodd"');
  s += P('t-a', tape);
  s += L('M18.7 30.4l1.6.3M19.2 27.2l1.6.3M19.8 24.1l1.6.3M21.2 20.5l1.5.6M23.3 17.7l1.2 1M26.5 15.6l.3 1.5M30.5 15.6l-.3 1.5M33.6 17.5l-1.2 1', 1);
  // gown: right half of the bodice and a full skirt with an uneven pinned hem
  const gown = [[28.5, 23.5], [36, 21.3], [44, 21.8], [42, 29], [37.5, 35], [41, 40], [47, 51.5], [44, 52.5], [41, 51], [37.5, 53.5], [33.5, 51.5], [29, 53.5], [24.5, 51.5], [20, 53.5], [15.5, 51.5], [10, 52], [15.5, 40], [19.5, 35], [28.5, 35]];
  s += P('t-a', rpoly(gown, [.3, 1, 1, 4, 3, 2, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 2, 1, .3]));
  // waist sash and skirt folds
  s += P('t-b', 'M18.5 34.5H38.5L39.5 38H17.5Z');
  s += L('M23.5 39.5Q22 46 20 51.5M32.5 39.5Q33.5 45 34 50.5M38.5 39.5Q41.5 45 43.5 50.5', 1.4);
  // pins along the centre seam
  s += L('M25 26L31.5 25M25 30L31.5 29.2', 1.1);
  s += P('t-a', circ(24.8, 26, 1.3) + circ(24.8, 30, 1.3));
  // pincushion with pins
  s += L('M50 51L47.5 43.5M54 50L54.5 42M57.5 51L60 44.5', 1.2);
  s += P('t-a', circ(47.3, 43, 1.5) + circ(54.5, 41.5, 1.5) + circ(60, 44, 1.4));
  s += P('t-a', 'M46.5 55Q46.5 49 54 49Q61.5 49 61.5 55Q61.5 59.5 54 59.5Q46.5 59.5 46.5 55Z');
  s += L('M51 49.6Q49.5 54.5 51 59.2M57 49.6Q58.5 54.5 57 59.2', 1.1);
  s += P('t-b', poly([[54, 46.5], [55.4, 49.2], [58, 49.5], [55.6, 50.5], [54, 52], [52.4, 50.5], [50, 49.5], [52.6, 49.2]]));
  s += P('t-c', spark(8, 8, 3.5) + spark(53.5, 8, 2.8));
  add('dress-form', "tailor's dress form with a half-finished gown, tape measure and pincushion", s);
}

// ---------- flying-hero
{
  let s = '';
  // city skyline with lit windows cut out
  const bl = [[4, 50, 8], [12.5, 44, 8], [21, 52, 7], [28.5, 47, 9], [38, 53, 6], [44.5, 42, 9], [54, 49, 6]];
  let sky = '', win = '';
  for (const [x, top, w] of bl) { sky += `M${f(x)} ${f(top)}H${f(x + w)}V60H${f(x)}Z`;
    for (let y = top + 2.5; y < 57; y += 4) for (let xx = x + 1.6; xx + 1.6 <= x + w - 1.2; xx += 3) win += R('', 0, 0, 0, 0).slice(0, 0) + `M${f(xx)} ${f(y)}h1.6v2h-1.6Z`; }
  s += P('t-b', sky + win, ' fill-rule="evenodd"');
  s += P('t-b', 'M44.5 42H53.5L49 37.5Z');
  // speed lines trailing down-left
  s += L('M5 30.5L13.5 24M9 39.5L16.5 34M23 47L31 40.5M33 44.5L38.5 40', 1.6);
  // cape streaming behind
  s += P('t-b', 'M40.5 19.5Q27 12 7.5 15.5Q11 18 9 21Q13 22.5 10.5 26Q15.5 27 13.5 30.5Q25 31.5 37 28Z');
  // legs with boots
  s += P('t-a', limb([[30.5, 31], [22, 36.5], [15.5, 38]], 5.2) + limb([[31.5, 33], [25, 40], [19.5, 44]], 5.2));
  s += P('t-b', cap(17.5, 37.6, 14, 38.5, 5.4) + cap(21.3, 42.9, 18.2, 45, 5.4));
  // torso, belt, emblem cut out
  const emb = poly(star(37, 25.5, 3, 1.3).map(([x, y]) => [x, y]));
  s += P('t-a', cap(31, 31.5, 40.5, 21.5, 9.5) + emb, ' fill-rule="evenodd"');
  s += P('t-c', emb);
  s += P('t-b', 'M27.6 28.7L33.8 34.6L32.3 36.1L26.1 30.2Z');
  // back arm tucked, front arm punching up-right
  s += P('t-a', limb([[38.5, 21.5], [46.5, 15], [53, 9.5]], 4.6));
  s += P('t-a', circ(54.5, 8.3, 3.5));
  s += P('t-b', cap(51, 11.2, 52.6, 9.8, 5));
  // head with mask
  s += P('t-a', circ(46.5, 17, 5.5));
  s += P('t-b', 'M41.3 18.8A5.5 5.5 0 0 1 49.8 12.6Q46.5 13 44.8 16.5Q43.5 18.5 41.3 18.8Z');
  s += P('t-b', cap(46.5, 17.4, 51.4, 15.3, 3) + circ(49.6, 16, 1.05), ' fill-rule="evenodd"');
  s += P('t-c', spark(6, 7, 3.5) + spark(28, 8, 2.6) + spark(59, 30, 2.6));
  add('flying-hero', 'caped superhero flying up over a city skyline', s);
}

// ---------- painter
{
  let s = '';
  // easel: back leg, front A-frame, ledge
  s += P('t-b', limb([[46, 6], [46.5, 59]], 2.6));
  s += P('t-a', limb([[45, 5.5], [35.5, 59]], 3) + limb([[47, 5.5], [57, 59]], 3));
  // canvas with a little landscape
  const cv = rpoly([[33, 11], [58, 11], [58, 37], [33, 37]], 1);
  s += P('t-a', cv);
  s += P('t-b', 'M34.5 35.5L41 26L45 30.5L49.5 23L56.5 35.5Z' + circ(39.5, 17.5, 2.6));
  s += L('M33.5 11.5H57.5V36.5H33.5Z', 1);
  s += P('t-b', rpoly([[31, 37], [60, 37], [60, 40], [31, 40]], 1));
  // artist: legs, smock, head facing right
  s += P('t-b', limb([[15.5, 44], [14, 57.5]], 4.2) + limb([[21, 44], [23, 57.5]], 4.2));
  s += P('t-b', cap(11, 58, 15, 58, 3) + cap(22, 58, 26.5, 58, 3));
  const smock = [[13.5, 22.5], [23.5, 22.5], [28, 47.5], [8.5, 47.5]];
  s += P('t-a', rpoly(smock, [4, 4, 2, 2]));
  s += P('t-b', 'M12.5 26Q10 38 9.2 46.5Q8.5 47.6 10 47.6H13.5Q13.5 36 15 27Z');
  // floppy bow at the collar
  s += P('t-b', 'M18.5 23.5L14.5 21.2Q13.6 25.4 14.5 26.2ZM18.5 23.5L22.5 21.2Q23.4 25.4 22.5 26.2Z' + circ(18.5, 23.6, 1.6));
  // head with nose to the right
  s += P('t-a', circ(18.5, 15.5, 5.6) + 'M23.5 14L26 16.6L23.6 17.6Z');
  s += P('t-b', circ(21.3, 14.4, .9));
  // beret, tilted, with stalk
  s += P('t-b', E('', 18, 10.2, 7.6, 2.9, -12).replace(/^.*?cx/, '').slice(0, 0) + 'M10.5 12Q11 6.2 18.5 6.2Q25.5 6.4 25.8 9.6Q20 9.2 10.5 12Z' + cap(18, 6.5, 18.7, 4.2, 1.6));
  // far arm holding palette low in front
  const pal = 'M2.8 32.5Q3 27.5 9.5 27.3Q15.5 27.3 16 31.5Q13 31.5 13 33.5Q13.5 36.5 9 37Q3 37.5 2.8 32.5Z';
  const dabs = circ(6, 31, 1.3) + circ(9.6, 30, 1.3) + circ(6.8, 34.4, 1.2);
  s += P('t-b', pal + dabs, ' fill-rule="evenodd"');
  s += P('t-a', dabs);
  s += P('t-a', limb([[17, 27], [14.5, 33.5]], 3.6) + circ(14, 33.5, 2.2));
  // near arm raised, brush to the canvas
  s += P('t-a', limb([[21, 26], [27, 29], [30.5, 22.5]], 3.8));
  s += L('M23.5 26.5L26.8 28.2L29.2 23.5', 1);
  s += P('t-a', circ(30.8, 22, 2.3));
  s += L('M31.5 21.2L37.5 15.5', 1.6);
  s += P('t-b', 'M36.6 16.4L39.8 12.6L38.2 16.9Z');
  s += P('t-c', spark(5.5, 7, 3) + spark(5.5, 55, 2.5));
  add('painter', 'artist in a beret painting at an easel with brush and palette', s);
}

// ---------- paint-pots
{
  let s = '';
  // brushes standing up in pots A and C (drawn first so pots hide the ends)
  const brush = (x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    const fx = x2 - ux * 9, fy = y2 - uy * 9, tx = x2 + ux * 4, ty = y2 + uy * 4;
    return { h: cap(x1, y1, fx, fy, 2.6), fe: cap(fx, fy, x2, y2, 3.6),
      tip: `M${f(x2 - uy * 2.1)} ${f(y2 + ux * 2.1)}Q${f(tx - uy * 1.6)} ${f(ty + ux * 1.6)} ${f(tx + ux * 3)} ${f(ty + uy * 3)}Q${f(tx + uy * 1.6)} ${f(ty - ux * 1.6)} ${f(x2 + uy * 2.1)} ${f(y2 - ux * 2.1)}Z`,
      paint: `M${f(tx - uy * 1.6)} ${f(ty + ux * 1.6)}Q${f(tx + ux * 1.5)} ${f(ty + uy * 1.5 - .3)} ${f(tx + ux * 3)} ${f(ty + uy * 3)}Q${f(tx + uy * 1.6)} ${f(ty - ux * 1.6)} ${f(tx + uy * 1.6)} ${f(ty - ux * 1.6)}Z` };
  };
  const b1 = brush(10.5, 46, 7.5, 16), b2 = brush(40, 46, 43, 18);
  s += P('t-a', b1.h + b2.h + b1.tip + b2.tip);
  s += P('t-b', b1.fe + b2.fe + b1.paint + b2.paint);
  // pots: body t-a with a cut-out shine, rim t-a, paint surface + drips t-b
  const pot = (x, w, top) => {
    const rx = w / 2, cx = x + rx, ry = 2.6, sx = x + w - 2.8;
    const body = `M${f(x)} ${f(top)}V57Q${f(x)} 59.5 ${f(x + 2.5)} 59.5H${f(x + w - 2.5)}Q${f(x + w)} 59.5 ${f(x + w)} 57V${f(top)}Z`;
    const shine = `M${f(sx)} ${f(top + 6)}h1.4v${f(54 - top - 6)}h-1.4Z`;
    const rim = `M${f(x - .6)} ${f(top)}a${f(rx + .6)} ${f(ry + .6)} 0 1 0 ${f(w + 1.2)} 0a${f(rx + .6)} ${f(ry + .6)} 0 1 0 ${f(-w - 1.2)} 0Z`;
    const paint = `M${f(x + 1)} ${f(top)}a${f(rx - 1)} ${f(ry - .9)} 0 1 0 ${f(w - 2)} 0a${f(rx - 1)} ${f(ry - .9)} 0 1 0 ${f(2 - w)} 0Z`;
    let dr = `M${f(x - .6)} ${f(top)}Q${f(cx)} ${f(top + 2 * ry + 3)} ${f(x + w + .6)} ${f(top)}Z`;
    for (const [dx, len] of [[.15, 7], [.42, 11], [.66, 5]]) { const xx = x + w * dx; dr += cap(xx, top + 1.5, xx, top + 1.5 + len, 2.4); }
    return { body, shine, rim, paint, dr };
  };
  const A = pot(3.5, 13, 40), B = pot(18, 14.5, 35.5), Cp = pot(34, 12.5, 40.5);
  s += P('t-a', A.body + A.shine + B.body + B.shine + Cp.body + Cp.shine, ' fill-rule="evenodd"');
  s += P('t-a', A.rim + B.rim + Cp.rim);
  s += P('t-c', A.shine + B.shine + Cp.shine);
  s += P('t-b', A.paint + B.paint + Cp.paint + A.dr + B.dr + Cp.dr);
  // jar of water: glass ring (t-b), water (t-a) with bubbles cut out, lid rim
  const jo = rpoly([[47.5, 33], [60.5, 33], [60.5, 59.5], [47.5, 59.5]], 3), ji = rpoly([[49.3, 34.5], [58.7, 34.5], [58.7, 57.8], [49.3, 57.8]], 2);
  s += P('t-b', jo + ji, ' fill-rule="evenodd"');
  const wat = 'M49.3 42Q51.6 40.6 54 42Q56.4 43.4 58.7 42V55.8Q58.7 57.8 56.7 57.8H51.3Q49.3 57.8 49.3 55.8Z';
  const bub = circ(52, 48, 1.1) + circ(55.8, 51.5, .9) + circ(52.6, 54.3, .8);
  s += P('t-a', wat + bub, ' fill-rule="evenodd"');
  s += P('t-b', rpoly([[46.5, 30], [61.5, 30], [61.5, 34], [46.5, 34]], 1));
  s += P('t-c', 'M51 36.5h1.6v4h-1.6Z');
  s += P('t-c', spark(26, 9, 3.5) + spark(57, 10, 2.8) + spark(33.5, 20, 2));
  add('paint-pots', 'row of open dripping paint pots with brushes and a jar of water', s);
}

// ---------- photographer
{
  let s = '';
  // shoulders and chest, neck
  s += P('t-a', rpoly([[4, 60], [5.5, 47], [11, 41], [29, 41], [36, 46], [38, 60]], [1, 4, 5, 5, 4, 1]));
  s += P('t-b', 'M15 36H23V41.5Q19 44 15 41.5Z');
  // head side-on facing right, eye cut out, hair cap on the top and back
  const eye = 'M25.5 23.6a1.3 1.7 0 1 0 0.01 0Z';
  s += P('t-a', circ(19.5, 26, 9.5) + eye + 'M28.6 27L30.1 29.5L28 30.3Z', ' fill-rule="evenodd"');
  s += P('t-b', 'M27.6 21.2Q25 16.5 19.5 16.5Q10 16.5 10 26.5Q10 32 12.5 34.5Q14.2 30 14 27Q18.5 26 20 21.5Q24 22.5 27.6 21.2Z');
  s += P('t-b', 'M15.6 26.4Q18.6 26 18.6 29Q18.4 31.8 15.8 31.4Q17 29 15.6 26.4Z');
  // camera strap from the body down round the neck
  s += L('M33 31.5C32 44 22 47 18.5 37', 2.4);
  // camera held in front of the face (clear gap to the head)
  s += P('t-a', rpoly([[32, 19], [50, 19], [50, 33.5], [32, 33.5]], 2.5) + rpoly([[36.5, 19.5], [38, 15], [44, 15], [45.5, 19.5]], .8));
  s += P('t-b', rpoly([[32, 29], [50, 29], [50, 33.5], [32, 33.5]], [0, 0, 2.5, 2.5]) + 'M34 16.5h3v2.5h-3Z');
  s += L('M33.8 22.5H37', 1.2);
  // flash on top with its window cut out
  const fw = 'M40.6 9.6H43.6V12.8H40.6Z';
  s += P('t-b', 'M38.5 14H43.5V15.5H38.5Z');
  s += P('t-a', rpoly([[36, 8], [45, 8], [45, 14.5], [36, 14.5]], 1.4) + fw, ' fill-rule="evenodd"');
  s += P('t-c', fw);
  // big round lens pointing right: barrel, ring, glass
  s += P('t-b', rpoly([[49.5, 18], [57.5, 18], [57.5, 34.5], [49.5, 34.5]], 1.5));
  s += P('t-a', 'M52 18H55V34.5H52Z');
  const gl = 'M58 21.8a2 4.4 0 1 0 0.01 0Z';
  s += P('t-a', 'M57.5 18a3 8.25 0 1 1 0 16.5a3 8.25 0 1 1 0-16.5Z' + gl, ' fill-rule="evenodd"');
  // near arm: upper arm and forearm up to a hand under the camera
  s += P('t-b', limb([[26, 45], [38, 52], [46, 38]], 8));
  s += P('t-a', limb([[26, 45], [38, 52], [46, 38]], 5.8) + circ(46.5, 36.5, 3.3));
  // flash burst firing
  const bs = star(52, 9, 6.5, 2.8, 8, -90);
  s += P('t-a', rpoly(bs, .4) + circ(52, 9, 1.8), ' fill-rule="evenodd"');
  s += P('t-c', circ(52, 9, 1.8));
  s += P('t-c', spark(7, 8, 3.5) + spark(57, 48, 2.6) + spark(47, 56, 2));
  add('photographer', 'person side-on shooting with a big camera, flash firing, strap round the neck', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part39.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
