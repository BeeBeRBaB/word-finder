// Generates part27.json (round 4).
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
// quadratic bezier point
const qb = (p0, p1, p2, t) => [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
// tapered swoosh along a quadratic: width w at peak (t=pk), thin ends
const swoosh = (p0, p1, p2, w, pk = .6, n = 14) => {
  const a = [], b = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = qb(p0, p1, p2, t), q = qb(p0, p1, p2, Math.min(1, t + .01)), r0 = qb(p0, p1, p2, Math.max(0, t - .01));
    const dx = q[0] - r0[0], dy = q[1] - r0[1], l = Math.hypot(dx, dy) || 1;
    const ww = (t < pk ? Math.sin(t / pk * Math.PI / 2) : Math.cos((t - pk) / (1 - pk) * Math.PI / 2)) * w / 2 + .15;
    a.push([p[0] - dy / l * ww, p[1] + dx / l * ww]); b.push([p[0] + dy / l * ww, p[1] - dx / l * ww]);
  }
  return 'M' + [...a, ...b.reverse()].map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
};
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';

// ---------- relieved-face
{
  let s = '';
  const cx = 26, cy = 36, r = 21.5;
  s += C('t-a', cx, cy, r);
  const pt = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
  const [ax, ay] = pt(-25), [bx, by] = pt(130);
  s += P('t-b', `M${f(ax)} ${f(ay)}A${r} ${r} 0 0 1 ${f(bx)} ${f(by)}A25 25 0 0 0 ${f(ax)} ${f(ay)}Z`);
  // closed eyes, lifted brows
  s += L('M13 33Q17 37.5 21 33M30 33Q34 37.5 38 33', 2.6);
  s += L('M12.5 26.5Q16 23 20.5 23.5M31.5 23.5Q36 23 39.5 26.5', 2.2);
  // pursed mouth blowing
  s += E('t-b', 31.5, 46, 2.6, 3);
  // breath puff
  s += P('t-c', circ(52, 46.5, 4.2) + circ(57.3, 43.5, 3) + circ(57, 50, 2.7), '');
  s += E('t-b', 12.5, 42, 3.2, 2);
  // sweat drop sliding off
  s += P('t-c', 'M0 -6.5Q3.4 -1.8 3.4 1Q3.4 4.5 0 4.5Q-3.4 4.5 -3.4 1Q-3.4 -1.8 0 -6.5Z', ' transform="translate(52 17) rotate(-55)"');
  s += L('M0 -6.5Q3.4 -1.8 3.4 1Q3.4 4.5 0 4.5Q-3.4 4.5 -3.4 1Q-3.4 -1.8 0 -6.5Z', 1.3).replace('/>', ' transform="translate(52 17) rotate(-55)"/>');
  s += L('M40 9.5L44 11.5M38.5 14L43.5 16', 1.5);
  s += P('t-c', spark(8, 9, 3.6) + spark(57, 59, 2.6));
  add('relieved-face', 'round face with closed eyes, a phew breath puff and a sweat drop', s);
}
// ---------- banana-peel
{
  let s = '';
  // floor shadow
  s += E('t-b', 32, 55.2, 26, 3);
  // slip swoosh
  s += P('t-c', swoosh([44, 30], [55, 29], [58, 9], 4.4, .35, 12));
  s += L('M50 36Q57.5 34 59.5 24M45 23Q50 20 50 12', 1.6);
  // back flap (shade), leaning right
  s += P('t-b', 'M29 31Q20 28 16.5 18.5Q15.5 16 18 16.5Q22 24.5 30 25Z');
  // curved banana top with stem
  s += P('t-a', 'M25.5 34Q25 20 34 14.5L37.6 16.4Q38.8 25 38.8 34Z');
  s += P('t-b', 'M33.6 15L38.6 9.6Q40.4 9 41.2 10.8L37.8 16.6Z');
  // side flaps
  s += P('t-a', 'M28 26Q14 31 8.5 46Q5.5 52.5 9.5 53.5Q12.5 54 13.5 50.5Q18 42 31 37.5Z');
  s += P('t-a', 'M36.5 26Q50 31 55.5 46Q58.5 52.5 54.5 53.5Q51.5 54 50.5 50.5Q46 42 33 37.5Z');
  // front flap flopped toward bottom-left
  s += P('t-a', 'M28 33Q24 46 20 54Q18.5 58 22.5 58Q26.5 58 28.5 54.5Q34 46 37.5 34Z');
  // brown tips
  s += P('t-b', 'M7 49.5Q5.8 53 9.5 53.5Q12.5 54 13.5 50.5L14 49Q11 46 7 49.5Z' + 'M57 49.5Q58.2 53 54.5 53.5Q51.5 54 50.5 50.5L50 49Q53 46 57 49.5Z' + 'M19.4 54Q18.5 58 22.5 58Q26.5 58 28.5 54.5L29 53.2Q24 51 19.4 54Z');
  // seams
  s += L('M28.2 34Q20 38 15 47M36.5 34Q44 38 49 47M31.5 22Q30.6 27 30.8 32', 1.3);
  s += P('t-c', spark(8, 8, 3.6) + spark(25, 6, 2.2));
  add('banana-peel', 'slippery banana peel on the floor with a slip swoosh', s);
}
// ---------- concert-crowd
{
  let s = '';
  // beams
  s += P('t-c', poly([[12, 13], [17, 13], [30, 33], [12, 33]]) + poly([[29.5, 13], [34.5, 13], [40, 33], [24, 33]]) + poly([[47, 13], [52, 13], [52, 33], [34, 33]]));
  // truss + cans
  s += R('t-b', 4, 4.5, 56, 3.5, 1.5);
  s += L('M8 6.2L12 6.2M20 6.2H24M40 6.2H44M52 6.2H56', 1);
  for (const x of [14.5, 32, 49.5]) s += P('t-a', `M${f(x - 2.5)} 8H${f(x + 2.5)}L${f(x + 3.5)} 13.5H${f(x - 3.5)}Z`);
  // singer on stage
  s += C('t-a', 32, 22, 3) + P('t-a', 'M28.5 33V28.5Q28.5 25.5 32 25.5Q35.5 25.5 35.5 28.5V33Z') + P('t-a', limb([[34.5, 27], [37, 24], [36, 20]], 2.2));
  // stage
  s += R('t-b', 4, 32.5, 56, 5, 1);
  // back row (shade)
  let br = '';
  for (const x of [8.5, 23, 41, 55.5]) br += circ(x, 42, 4) + `M${f(x - 7)} 60V51Q${f(x - 7)} 46.5 ${f(x)} 46.5Q${f(x + 7)} 46.5 ${f(x + 7)} 51V60Z`;
  s += P('t-b', br);
  // front row with raised arms
  let fr = '';
  const ppl = [[14, 47, [[-6, 1, -10, -13]], [[6, 1, 7, -14]]], [32, 46, [], [[6, 1, 9, -15]]], [50, 47, [[-6, 1, -8, -12]], [[6, 1, 9, -14]]]];
  for (const [x, y, la, ra] of ppl) {
    fr += circ(x, y, 5) + `M${f(x - 8.5)} 60V${f(y + 10.5)}Q${f(x - 8.5)} ${f(y + 5.5)} ${f(x)} ${f(y + 5.5)}Q${f(x + 8.5)} ${f(y + 5.5)} ${f(x + 8.5)} ${f(y + 10.5)}V60Z`;
    for (const [dx, dy, hx, hy] of [...la, ...ra]) { const sx = x + dx, sy = y + 8 + dy; fr += limb([[sx, sy], [sx + (hx - dx) * .25 + Math.sign(dx) * 2, y + (hy + 8) / 2], [x + hx, y + hy]], 3.4) + circ(x + hx, y + hy - 1.5, 2.6); }
  }
  s += P('t-a', fr);
  s += P('t-c', spark(6.5, 20, 2.6) + spark(58, 21, 2.6));
  add('concert-crowd', 'crowd silhouettes with raised hands before a lit stage', s);
}
// ---------- play-screen
{
  let s = '';
  s += P('t-b', rpoly([[4, 7], [60, 7], [60, 47], [4, 47]], 4) + rpoly([[7.5, 10.5], [56.5, 10.5], [56.5, 43.5], [7.5, 43.5]], 2), ' fill-rule="evenodd"');
  const tri = 'M27 17.5L41 26L27 34.5Z';
  const track = 'M12 39.5H52V41.5H12Z';
  s += P('t-a', rpoly([[7.5, 10.5], [56.5, 10.5], [56.5, 43.5], [7.5, 43.5]], 2) + rpoly([[26.5, 16], [42, 26], [26.5, 36]], 2.2) + track, ' fill-rule="evenodd"');
  s += R('t-b', 12, 39.5, 22, 2, .8) + C('t-b', 34, 40.5, 2.8);
  s += P('t-c', 'M11 14.5H17L13 20.5H11Z');
  // stand
  s += P('t-b', 'M28 47H36L37.5 53H26.5Z');
  s += R('t-a', 16, 52, 32, 4.5, 2.2);
  s += P('t-c', spark(7, 55, 3) + spark(57, 55, 3.4) + spark(53.5, 4, 0));
  add('play-screen', 'widescreen display with a big play triangle and progress bar', s);
}
// ---------- market-stall
{
  let s = '';
  // roof cap
  s += R('t-b', 9, 4, 46, 3.5, 1.5);
  // awning stripes with scallops
  const n = 6, sa = [], sc = [];
  for (let i = 0; i < n; i++) {
    const t0 = 10 + 44 * i / n, t1 = 10 + 44 * (i + 1) / n, b0 = 4 + 56 * i / n, b1 = 4 + 56 * (i + 1) / n, rr = (b1 - b0) / 2;
    const d = `M${f(t0)} 7L${f(t1)} 7L${f(b1)} 19A${f(rr)} ${f(rr * .9)} 0 0 1 ${f(b0)} 19Z`;
    (i % 2 ? sc : sa).push(d);
  }
  s += P('t-a', sa.join('')) + P('t-c', sc.join(''));
  // posts
  s += R('t-b', 7, 22, 3, 36) + R('t-b', 54, 22, 3, 36);
  // produce
  let pr = '';
  for (const [x, y] of [[15.5, 31.5], [22, 31.5], [18.8, 27.5]]) pr += circ(x, y, 3.3);
  pr += 'M28 34Q27 26 33 25.5Q39 26 38 34Z';
  for (const [x, y] of [[44, 31.5], [50.5, 31.5], [47.2, 27.5]]) pr += circ(x, y, 3.3);
  s += P('t-a', pr);
  s += L('M18.8 24.2L19.8 22.5M33 25.5V33M33 29L30 27M33 30.5L36 28.5M47.2 24.2L48.2 22.5', 1.2);
  // crates
  let cr = '';
  for (const x0 of [11.5, 26.5, 40]) cr += `M${f(x0)} 33.5H${f(x0 + 13.5)}V42H${f(x0)}Z` + `M${f(x0 + 1.5)} 37H${f(x0 + 12)}V38.3H${f(x0 + 1.5)}Z`;
  s += P('t-b', cr, ' fill-rule="evenodd"');
  // counter
  s += P('t-a', rpoly([[5.5, 42], [58.5, 42], [58.5, 58.5], [5.5, 58.5]], 1.5) + 'M10 48H54V49.5H10Z' + 'M10 53H54V54.5H10Z', ' fill-rule="evenodd"');
  s += R('t-b', 5, 41.5, 54, 3, 1);
  s += P('t-c', spark(5.5, 9.5, 2.8) + spark(58.5, 9.5, 2.8));
  add('market-stall', 'awninged market stall with crates of produce', s);
}
// ---------- rug
{
  let s = '';
  const FL = [17, 15], FR = [47, 15], NL = [6, 48], NR = [58, 48];
  const M = (u, v) => { const l = [FL[0] + (NL[0] - FL[0]) * v, FL[1] + (NL[1] - FL[1]) * v], r = [FR[0] + (NR[0] - FR[0]) * v, FR[1] + (NR[1] - FR[1]) * v]; return [l[0] + (r[0] - l[0]) * u, l[1] + (r[1] - l[1]) * u]; };
  const quad = (u0, v0, u1, v1) => poly([M(u0, v0), M(u1, v0), M(u1, v1), M(u0, v1)]);
  // thickness edge
  s += P('t-b', poly([NL, NR, [NR[0], NR[1] + 3], [NL[0], NL[1] + 3]]));
  // rug body with field cut
  s += P('t-a', quad(0, 0, 1, 1) + quad(.17, .19, .83, .81), ' fill-rule="evenodd"');
  // border band (shade)
  s += P('t-b', quad(.08, .1, .92, .9) + quad(.15, .17, .85, .83), ' fill-rule="evenodd"');
  // inner field
  s += P('t-a', quad(.17, .19, .83, .81));
  // medallion diamond with hole
  const dia = (k) => poly([M(.5, .5 - .28 * k), M(.5 + .2 * k, .5), M(.5, .5 + .28 * k), M(.5 - .2 * k, .5)]);
  s += P('t-b', dia(1) + dia(.45), ' fill-rule="evenodd"');
  // corner motifs
  let cm = '';
  for (const [u, v] of [[.26, .29], [.74, .29], [.26, .71], [.74, .71]]) cm += poly([M(u, v - .06), M(u + .045, v), M(u, v + .06), M(u - .045, v)]);
  s += P('t-b', cm);
  // fringe
  let fr = '';
  for (let i = 0; i <= 10; i++) { const u = .04 + .92 * i / 10; const a = M(u, 0), b = M(u, 1);
    fr += `M${f(a[0])} ${f(a[1])}L${f(a[0] + (a[0] - 32) * .04)} ${f(a[1] - 4)}`;
    fr += `M${f(b[0])} ${f(b[1] + 3)}L${f(b[0] + (b[0] - 32) * .06)} ${f(b[1] + 9)}`; }
  s += L(fr, 1.4);
  s += P('t-c', spark(6, 9, 3.4) + spark(58, 10, 2.8));
  add('rug', 'fringed patterned rug seen at an angle', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part27.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
