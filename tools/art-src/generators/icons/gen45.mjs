// Generates part45.json (round 4: the-end-page, spelling-bee, book-sewing, heart-locket, thank-you-card, holiday-wreath).
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
const heart = (x, y, s) => `M${f(x)} ${f(y - .25 * s)}C${f(x - .1 * s)} ${f(y - .55 * s)} ${f(x - .55 * s)} ${f(y - .55 * s)} ${f(x - .55 * s)} ${f(y - .15 * s)}C${f(x - .55 * s)} ${f(y + .15 * s)} ${f(x - .2 * s)} ${f(y + .35 * s)} ${f(x)} ${f(y + .6 * s)}C${f(x + .2 * s)} ${f(y + .35 * s)} ${f(x + .55 * s)} ${f(y + .15 * s)} ${f(x + .55 * s)} ${f(y - .15 * s)}C${f(x + .55 * s)} ${f(y - .55 * s)} ${f(x + .1 * s)} ${f(y - .55 * s)} ${f(x)} ${f(y - .25 * s)}Z`;
const rot = (a, x, y) => ` transform="rotate(${a} ${f(x)} ${f(y)})"`;

const icons = [];
const add = (id, motif, svg) => icons.push({ id, motif, svg });

// ---------- the-end-page
{
  let s = '';
  // loose page with a folded top-right corner
  s += P('t-a', rpoly([[4.5, 5], [32, 5], [39, 12], [39, 59], [4.5, 59]], [1.5, .4, .4, 1.5, 1.5]));
  s += P('t-b', rpoly([[32, 5.6], [38.4, 12], [32, 12]], .6));
  s += P('t-b', 'M4.5 56H39V57.5Q39 59 37.5 59H6Q4.5 59 4.5 57.5Z');
  // title bar and text lines
  s += R('t-b', 9, 9.5, 18, 4, 1);
  s += R('t-b', 9, 17.5, 25, 1.7, .85) + R('t-b', 9, 21.5, 20, 1.7, .85);
  // "The" small, "End" big, flourish with a curl
  s += L('M9.5 29.6Q11.5 27.6 15 28.2Q18.5 28.8 21 27.6M15.4 28.4Q15.2 32 14 35.4M22 27Q20.8 31 20.2 35.4M20.7 32.6Q22 30.8 23.2 31.2Q24 31.6 23.5 33.4L23.1 35.4M25.4 33.6Q28.2 33.4 27.9 31.8Q27.2 30.6 25.8 31.8Q24.6 33.8 25.4 35Q26.4 35.8 28.4 34.6', 1.6);
  s += L('M18.5 39Q12 37.6 11.6 41.4Q11.6 44.2 15.4 44.4Q10 44.8 10 48.6Q10.6 52.4 17.6 51M19.4 51Q20.2 47.4 20.8 45.6M20.5 48.2Q22.4 45.4 24.2 45.8Q25.2 46.4 24.6 48.8L24.2 51M31.6 46.8Q29.6 45.2 27.6 46.8Q26.2 48.8 27 50.4Q28.6 51.6 30.6 49.8Q31.6 48.4 31.8 46.6M34 38.6Q32.2 44.6 32.2 49.4Q32.4 51.4 35 50.4', 2);
  s += L('M9.5 54.5Q20 52.6 29.5 53.4Q35.6 53.8 35.8 50.8Q35.8 48.6 33.8 48.8Q32.2 49.2 33 50.8', 1.6);
  // quill resting at the side
  const q = rot(19, 50, 32);
  s += P('t-a', 'M51 5Q44.8 11 45.3 22L47.6 24L45.5 25.4Q46.2 35 50.4 44L51 44Z', ' transform="translate(-1.5 0) rotate(19 51 32)"');
  s += P('t-b', 'M51 5Q57.2 11 56.7 22L54.4 23.6L56.4 25Q55.8 35 51.6 44L51 44Z' + cap(51, 43, 51, 53.5, 1.8) + 'M49.9 53L52.1 53L51 59Z', ' transform="translate(-1.5 0) rotate(19 51 32)"');
  s += P('t-c', spark(55.5, 50, 3.5) + spark(46.5, 4.5, 2.2));
  add('the-end-page', 'loose page ending in a flourished The End, quill at its side', s);
}

// ---------- spelling-bee
{
  let s = '';
  // dotted flight path
  const bz = t => { const u = 1 - t; const p = [[13, 46], [3, 54], [1, 34], [9, 26]];
    return [0, 1].map(k => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]); };
  let dots = '';
  for (let i = 0; i <= 6; i++) { const [x, y] = bz(i / 6); dots += circ(x, y, 1.25 - i * .06); }
  s += P('t-b', dots);
  // wings
  s += E('t-c', 22, 23.5, 5.2, 8.8, -28) + E('ln', 22, 23.5, 5.2, 8.8, -28).replace('/>', ' stroke-width="1.5"/>');
  s += E('t-c', 31.5, 22.5, 4.6, 8, 12) + E('ln', 31.5, 22.5, 4.6, 8, 12).replace('/>', ' stroke-width="1.5"/>');
  // body (unrotated coords, tilted nose-up)
  const cx = 29, cy = 42, rx = 13, ry = 10;
  const yt = x => ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
  const band = (a, b) => `M${f(a)} ${f(cy - yt(a))}A${rx} ${ry} 0 0 1 ${f(b)} ${f(cy - yt(b))}L${f(b)} ${f(cy + yt(b))}A${rx} ${ry} 0 0 1 ${f(a)} ${f(cy + yt(a))}Z`;
  let g = P('t-b', 'M17 39.6L10.5 42L17 44.4Z');
  g += E('t-a', cx, cy, rx, ry);
  g += P('t-b', band(21.5, 25.5) + band(30, 34) + `M18 ${f(cy + 6)}Q29 ${f(cy + 11.5)} 40.5 ${f(cy + 5)}L38 ${f(cy + 8)}Q29 ${f(cy + 13)} 20 ${f(cy + 8)}Z`);
  s += `<g${rot(-10, cx, cy)}>${g}</g>`;
  // head with cut-out eye
  s += P('t-a', circ(48.3, 35, 6.8) + circ(50.4, 33.4, 2.3), ' fill-rule="evenodd"');
  s += C('t-b', 51, 33.6, 1.25);
  s += L('M47 38.6Q49.6 40.8 52.4 38.4', 1.4);
  // antennae
  s += L('M45.6 29Q43.5 25 40.5 24M48.5 28.4Q48 25 45.5 22.8', 1.4) + C('t-b', 40.3, 24, 1.4) + C('t-b', 45.3, 22.6, 1.4);
  // legs reaching up to the card
  s += L('M42 41Q39.6 33 42.8 20.5M51 41.5Q57.5 36 56.6 20.5', 1.8);
  // card with ABC
  const cr = rot(5, 50, 12.5);
  s += P('t-a', rpoly([[41, 5.5], [59, 5.5], [59, 19.5], [41, 19.5]], 1.6) + rpoly([[42.7, 7.2], [57.3, 7.2], [57.3, 17.8], [42.7, 17.8]], .8), ' fill-rule="evenodd"' + cr);
  s += P('t-c', rpoly([[42.7, 7.2], [57.3, 7.2], [57.3, 17.8], [42.7, 17.8]], .8), cr);
  const lx = 43.6, ly = 9, h = 7;
  const A = `M${lx} ${ly + h}L${lx + 2} ${ly}L${lx + 4} ${ly + h}M${lx + .8} ${ly + 4.6}H${lx + 3.2}`;
  const bx = lx + 4.8;
  const B = `M${f(bx)} ${ly}V${ly + h}H${f(bx + 2.2)}Q${f(bx + 4)} ${ly + h} ${f(bx + 4)} ${ly + 5.1}Q${f(bx + 4)} ${ly + 3.4} ${f(bx + 2)} ${ly + 3.4}H${f(bx)}M${f(bx)} ${ly}H${f(bx + 2)}Q${f(bx + 3.6)} ${ly} ${f(bx + 3.6)} ${ly + 1.7}Q${f(bx + 3.6)} ${ly + 3.4} ${f(bx + 2)} ${ly + 3.4}`;
  const ccx = lx + 9.8;
  const Cc = `M${f(ccx + 3.8)} ${ly + 1}Q${f(ccx + 3)} ${ly} ${f(ccx + 2.1)} ${ly}Q${f(ccx)} ${ly} ${f(ccx)} ${ly + 3.5}Q${f(ccx)} ${ly + h} ${f(ccx + 2.1)} ${ly + h}Q${f(ccx + 3)} ${ly + h} ${f(ccx + 3.8)} ${ly + 6}`;
  s += `<path class="ln" stroke-width="1.5"${cr} d="${A + B + Cc}"/>`;
  s += P('t-c', spark(8, 9, 3.5) + spark(26, 6, 2.4));
  add('spelling-bee', 'bee flying right holding up an ABC card, dotted trail behind', s);
}

// ---------- book-sewing
{
  let s = '', sec = '', und = '', fold = '';
  for (let k = 0; k < 3; k++) {
    const y = 31 + k * 9.6, h = 8.8, r = h / 2;
    const m = y + h / 2;
    sec += `M${f(5 + r)} ${f(y)}L43 ${f(y - .9)}V${f(m - 1.1)}L27 ${f(m)}L43 ${f(m + 1.1)}V${f(y + h)}H${f(5 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(5 + r)} ${f(y)}Z`;
    und += `M12 ${f(y + h - 1.2)}H43V${f(y + h)}H${f(5 + r)}Q8 ${f(y + h)} 7 ${f(y + h - 1)}Z`;
    fold += `M40 ${f(y + 1.3)}L${f(9.4)} ${f(y + 1.9)}A${f(r - 1.9)} ${f(r - 1.9)} 0 0 0 9.4 ${f(y + h - 1.9)}H38`;
  }
  s += P('t-a', sec);
  s += P('t-b', und);
  s += L(fold, 1.1);
  // stitches crossing between the sections at the spine
  s += L('M12.4 33.4C5 35 5 40 12.6 42.8C5 44.6 5 49.6 12.6 52.4', 1.5);
  // curved needle poised over the spine, point down, eye up
  s += P('t-b', 'M8.6 30Q8.2 16 21 9.4L22 11.4Q11 17 8.6 30Z' + 'M19.3 11.6a.5 1.3 62 1 0 .1 0Z', ' fill-rule="evenodd"');
  // long thread from the eye, looping off to the spool
  s += L('M21.6 10.2C30 4 38 6 35 14C32 22 44 27 48.6 40', 1.4);
  // spool
  s += P('t-a', rpoly([[48.5, 36], [58, 36], [58, 55], [48.5, 55]], .5));
  s += L('M48.8 40.4L57.6 38.6M48.8 44.4L57.6 42.6M48.8 48.4L57.6 46.6M48.8 52.4L57.6 50.6', 1.1);
  s += R('t-b', 46.5, 33, 13.5, 3.6, 1.3) + R('t-b', 46.5, 54.6, 13.5, 3.6, 1.3);
  s += P('t-c', spark(55, 12, 3.5) + spark(7, 12, 2.6));
  add('book-sewing', 'folded sections stitched at the spine with a curved needle, thread to a spool', s);
}

// ---------- heart-locket
{
  let s = '';
  // chain to a ring
  let beads = '';
  for (let i = 0; i <= 7; i++) { const t = i / 7.6;
    beads += circ(6.5 + (29.6 - 6.5) * t, 5 + (24.6 - 5) * t, 1.15) + circ(57.5 - (57.5 - 34.4) * t, 5 + (24.6 - 5) * t, 1.15); }
  s += P('t-b', beads);
  s += `<circle class="ln" stroke-width="1.8" cx="32" cy="27" r="2.4"/>`;
  // hinge
  s += R('t-b', 29, 38.5, 6, 6.5, 1.6);
  const half = (x, a, woman) => {
    const y = 40, r = rot(a, x, y);
    let h = P('t-a', heart(x, y, 24) + heart(x, y + .7, 17.5), ' fill-rule="evenodd"' + r);
    h += P('t-c', heart(x, y + .7, 17.5), r);
    let por = circ(x, y - 1.4, 3.3) + `M${f(x - 4.8)} ${f(y + 6.8)}Q${f(x - 4.8)} ${f(y + 2.4)} ${x} ${f(y + 2.4)}Q${f(x + 4.8)} ${f(y + 2.4)} ${f(x + 4.8)} ${f(y + 6.8)}Z`;
    if (woman) por += `M${f(x - 3.6)} ${f(y + 2.6)}Q${f(x - 5)} ${f(y - 6.2)} ${x} ${f(y - 5.2)}Q${f(x + 5)} ${f(y - 6.2)} ${f(x + 3.6)} ${f(y + 2.6)}Z`;
    h += P('t-b', por, r);
    return h;
  };
  s += half(18, -10, true) + half(46, 10, false);
  s += P('t-c', spark(32, 10, 3.5) + spark(6.5, 56.5, 2.6) + spark(57.5, 56.5, 2.6));
  add('heart-locket', 'open heart locket on a chain with two tiny portraits', s);
}

// ---------- thank-you-card
{
  let s = '';
  // inside page peeking out
  const inner = [[33, 8], [47, 12.5], [47, 45.5], [33, 49]];
  s += P('t-c', poly(inner));
  s += `<path class="ln" stroke-width="1.4" d="${poly(inner)}M37 18.5L43.5 20.2M37 22.5L43.5 24M37 26.5L41.5 27.6"/>`;
  // front cover
  s += P('t-a', rpoly([[5, 9], [34, 4], [34, 54], [5, 49]], 1.2));
  s += P('t-b', heart(21.5, 23.5, 20));
  // "thanks" squiggle
  s += L('M11 44Q13 43 13.5 38.4Q12.7 42 13.3 44.4M11.4 40.8H15M13.6 44.4Q15.6 41 16.4 37.8Q15 40 15.4 44.4Q16 41.8 17.5 41.8Q18.5 42 18.1 44.4M21.4 42.4Q19.8 41.6 19.2 43.4Q19.2 44.8 20.6 44.3Q21.4 43.8 21.6 42.2Q21.4 44.6 22.4 44.4Q23.2 44 23.4 42Q23.6 44.5 23.8 44Q24.4 41.8 25.4 42Q26 42.5 25.8 44.4M26.9 44.4Q27.8 41 28.2 37.6M27.3 43Q29 41.2 29.6 42Q29.4 43 27.8 43.2Q29 43.6 29.8 44.6M32.1 42Q31.1 41.6 30.9 42.6Q32.1 43.4 31.7 44.4Q30.9 45 30.3 44.2', 1.3);
  s += L('M11 47.5Q22 45.6 31.5 46.6', 1.3);
  // flower lying beside it
  s += L('M47.2 53.6Q36 56.6 20 58.8', 2);
  s += P('t-b', 'M37.5 54.2Q35 50 29.5 51Q32.5 55.2 37.5 54.2Z' + 'M31 56.3Q29.6 59.8 24.5 60Q26.2 56.6 31 56.3Z');
  let pet = '';
  for (let i = 0; i < 5; i++) { const a = (i * 72 - 90 + 18) * Math.PI / 180; pet += circ(53 + 4.4 * Math.cos(a), 50 + 4.4 * Math.sin(a), 3.5); }
  s += P('t-a', pet);
  s += P('t-b', circ(53, 50, 2.6) + circ(53, 50, 1), ' fill-rule="evenodd"');
  s += P('t-c', spark(51.5, 13, 3.5) + spark(57, 27, 2.2));
  add('thank-you-card', 'greeting card standing open with a heart and a thanks squiggle, flower beside', s);
}

// ---------- holiday-wreath
{
  let s = '';
  const cx = 32, cy = 30;
  const ring = (n, rs) => Array.from({ length: n * 2 }, (_, i) => { const a = (-90 + i * 180 / n) * Math.PI / 180, r = rs[i % 4]; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  const starHole = poly(star(cx, 8.4, 4.4, 1.9));
  s += P('t-a', poly(ring(36, [26, 22.4, 24.4, 22.4])) + poly(ring(22, [12.2, 15.4, 12.2, 14.2])) + starHole, ' fill-rule="evenodd"');
  s += P('t-c', starHole);
  // light rays around the star
  s += L('M24.8 6.6L26.8 7.3M39.2 6.6L37.2 7.3', 1.3);
  // baubles with cut highlights, and berry clusters
  let bb = '';
  for (const [deg, r] of [[200, 3.4], [340, 3.4], [145, 3], [35, 3]]) {
    const a = deg * Math.PI / 180, x = cx + 19 * Math.cos(a), y = cy + 19 * Math.sin(a);
    bb += circ(x, y, r) + circ(x - r * .35, y - r * .35, r * .32);
  }
  s += P('t-b', bb, ' fill-rule="evenodd"');
  let be = '';
  for (const deg of [235, 305, 170, 10]) {
    const a = deg * Math.PI / 180, x = cx + 19 * Math.cos(a), y = cy + 19 * Math.sin(a);
    be += `M${f(x - 1.3)} ${f(y + .7)}h0M${f(x + 1.3)} ${f(y + .7)}h0M${f(x)} ${f(y - 1.3)}h0`;
  }
  s += L(be, 2.8);
  // big bow at the bottom
  const bowL = 'M29.5 49.5C23 42.5 13.5 43 14.5 50.5C15.3 56 23 56.5 29.5 52Z' + 'M27.5 50.2C22.5 46.5 17.5 47 17.8 50.4C18.2 53 22.5 53.4 27.5 51.6Z';
  const mir = d => d.replace(/([MLCQ ])(-?[\d.]+) /g, (m, c, x) => `${c}${f(64 - +x)} `);
  s += P('t-b', bowL + mir(bowL), ' fill-rule="evenodd"');
  s += P('t-b', 'M30 54L25.8 59.8L28.2 59.3L29.3 61.2L32.5 55Z' + 'M34 54L38.2 59.8L35.8 59.3L34.7 61.2L31.5 55Z');
  s += R('t-b', 29.8, 47.8, 4.4, 6, 1.4);
  s += P('t-c', spark(6.5, 7, 3.2) + spark(57.5, 7, 3.2) + spark(57, 57, 2.4));
  add('holiday-wreath', 'evergreen wreath with a big bow, berries, baubles and a star of light', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part45.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
