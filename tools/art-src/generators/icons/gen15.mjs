// Generates part15.json (round 3, batches 1-11).
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
// ---------- dog
{ let s = '';
  // tail curled up behind
  s += P('t-a', 'M45 53C54 52 59 47 59 40C59 36 57 33 54 32.5Q53 33.5 54 35C55.5 39 55 44 45 46Z');
  // body
  const bib = 'M21 39C24 37 31 37 33 39C34 45 31.5 52 27 55C22.5 52 20 45 21 39Z', paws = 'M17.6 58.6a4.6 2.3 0 1 0 9.2 0a4.6 2.3 0 1 0-9.2 0ZM28.4 58.6a4.6 2.3 0 1 0 9.2 0a4.6 2.3 0 1 0-9.2 0Z';
  s += P('t-a', 'M19 35C14 42 14 52 16 61H48Q56 61 56 53C56 45 50 40.5 43 40C39 37 35 34.5 30 34.5Z' + bib + paws, ' fill-rule="evenodd"');
  // haunch shade
  s += P('t-b', 'M56 53Q56 61 48 61H40C42 58 48 57.5 52 54C54 52 55 48 54.5 45.5Q56 49 56 53Z');
  s += L('M37 59C35 51 38.5 44.5 46 44', 1.6);
  // chest bib
  s += P('t-c', bib + paws);
  // front legs + paws
  s += L('M27.5 55V58.5', 1.6);
  // head
  const mz = 'M20 27.5a8 6 0 1 0 16 0a8 6 0 1 0-16 0Z';
  s += P('t-a', 'M15 20C15 12 21 8 28 8C35 8 41 12 41 20C41 26 38 31 34 33.5Q28 36 22 33.5C18 31 15 26 15 20Z' + mz, ' fill-rule="evenodd"');
  s += P('t-b', 'M39 13.5C41 17 41.5 23 39 28C37 31.5 34 33.5 30 34.5C36 30 38.5 24 39 13.5Z');
  // muzzle
  s += P('t-c', mz);
  // mouth opening + tongue
  s += P('t-b', 'M23 29.5Q28 33.5 33 29.5Q32 35 28 35Q24 35 23 29.5Z');
  // nose + mouth line
  s += P('t-b', 'M24.5 24Q24.5 22 28 22Q31.5 22 31.5 24Q31.5 26.5 28 27Q24.5 26.5 24.5 24Z');
  s += L('M28 27V29', 1.2);
  // eyes
  s += C('t-b', 22, 18.5, 2.1) + C('t-b', 34, 18.5, 2.1);
  s += C('t-c', 21.3, 17.8, .8) + C('t-c', 33.3, 17.8, .8);
  // floppy ears
  s += P('t-b', 'M19 10C13 9 9 14 8 21C7 28 8.5 34 11.5 35.5C15 37 17.5 32 18 26C18.5 20 19.5 15 21 11.5Z' + 'M37 10C43 9 47 14 48 21C49 28 47.5 34 44.5 35.5C41 37 38.5 32 38 26C37.5 20 36.5 15 35 11.5Z');
  // collar + tag
  s += P('t-b', 'M19.5 33Q28 38.5 36.5 33L37.5 36Q28 42 18.5 36Z');
  s += P('t-b', circ(22.5, 40, 3.2) + circ(22.5, 40, 1.8), ' fill-rule="evenodd"') + C('t-c', 22.5, 40, 1.8);
  const tg = 'M25.5 32Q28.5 33.7 31.5 32V36.5Q31.5 40 28.5 40Q25.5 40 25.5 36.5Z';
  s += P('t-c', tg) + L(tg, 1);
  s += L('M28.5 34V37', 1.2);
  s += P('t-c', spark(9, 47, 3.5) + spark(56, 13, 3));
  add('dog', 'floppy-eared dog with collar and tongue', s);
}

// ---------- bear
{ let s = '';
  // far legs (shade), stepping forward
  s += P('t-b', 'M20.8 44.7L28.2 45.6L31.5 54Q33.5 55 33.5 57Q33.5 59.5 31 59.5H25.5Q23 59.5 23 57Q23 55 24.5 54Z' +
    'M49.6 38.8L56.5 52.5Q59.8 53.5 59.8 56Q59.6 58.3 57.3 58.3H52.5Q50.2 58.3 50.2 56L47.9 49V44.5Z');
  // body + head + near legs, one silhouette
  s += P('t-a', 'M37.5 12C42.5 12 44.5 15 46.3 17.3A2.9 2.9 0 1 1 51.6 17.9C53.6 17.4 55.4 18.4 55.5 20.2Q55.6 22.4 58 23L61.3 24.1Q63.6 24.8 63.4 27.2Q63.2 29.5 60.8 29.6Q58 30.2 56.5 31.2Q54.5 33.4 51.8 33.6Q50.3 35.5 50 38.5L48.3 44.5V53.5Q49.6 54.3 49.6 56.8Q49.6 59.5 47 59.5H42.5Q40 59.5 40 57Q40 54.8 41.3 54V44Q29 48 18.5 44.5L11.8 54.8Q13.8 55.6 13.8 57.4Q13.8 59.5 11.3 59.5H6.5Q3 59.3 2.8 56.8Q2.6 54.6 4.2 53.8L8.8 44.5C6.8 41 4.8 37 4.9 32C5 29.5 5.5 27.5 6.3 26Q3.6 24.8 4.8 22.6Q6.2 20.8 8.8 21.4C12.5 19.5 19.5 18 26 17.3C31 16.5 32 12 37.5 12Z');
  // ear, eye, nose, mouth
  s += C('t-b', 49.1, 16.6, 1.4);
  s += P('t-b', circ(53.2, 22.6, 1.4) + circ(52.8, 22.2, .5), ' fill-rule="evenodd"') + C('t-c', 52.8, 22.2, .5);
  s += P('t-b', 'M60.8 24.6Q63.5 24.6 63.4 27.2Q63.2 29.2 61.2 28.8Q59.8 28.3 60 26.3Q60.1 24.8 60.8 24.6Z');
  s += L('M60.3 29.6Q58.3 29.6 56.6 28.6', 1.2);
  // shoulder shade + contour, haunch
  s += P('t-b', 'M36.5 21C40.5 27 42 35 41.3 44C38.5 38 38.5 28 36.5 21Z');
  s += L('M36.5 21C40.5 27 42 35 41.3 44', 1.6);
  s += L('M18.5 44C20 36 19 29 13 26', 1.6);
  // claws
  s += P('t-c', 'M49.3 56.6L52.3 58.6L49.2 58.9ZM13.6 56.8L16.6 58.8L13.5 59.1ZM33.2 56.6L36.2 58.6L33.1 58.9ZM59.5 55.4L62.3 57.5L59.3 57.6Z');
  // ground
  s += L('M2 61.2H62', 1.4);
  s += P('t-c', spark(10, 9.5, 3.4) + spark(57.5, 8, 2.8));
  add('bear', 'grizzly bear walking on all fours', s);
}

// ---------- field-mouse
{ let s = '';
  // tail
  s += L('M20 57C10 60 3.5 55 4 47C4.5 40 12 38.5 13.5 43.5', 2.2);
  // far ear
  s += C('t-b', 40.5, 11.5, 5.5);
  // body + head + near ear, one silhouette; inner ear cut out
  const ie = circ(31.5, 15.5, 5.3);
  s += P('t-a', 'M25 21A8.5 8.5 0 1 1 39 17.9C43 18 48 21 52 25Q56.5 27.5 53 30C50 32 47 32 45 33C46 38 45 44 41 48C39 51 40 55 42 58H19C13 55 12.5 45 16 39C18 33 22 27 25 21Z' + ie, ' fill-rule="evenodd"');
  s += P('t-c', ie);
  s += L('M25.5 21.5A8.5 8.5 0 0 0 39 18', 1.4);
  // haunch
  s += L('M23 57C18.5 51 20 42 27.5 41C33 40.5 36.5 45 36 50', 1.6);
  s += E('t-b', 35, 58.3, 8, 2.5);
  // belly shade
  s += P('t-b', 'M45 33C46 38 45 44 41 48C39 51 40 55 42 58H38.5C36.5 55 36.5 51 38.5 47.5C42 43 44.5 38 45 33Z');
  // seed held in front paws
  const sd = 'M53.5 31.5C56 36 55.5 42 51 44.5C47.5 46 45.5 43.5 46.5 40C47.5 36 50 33 53.5 31.5Z';
  s += P('t-c', sd) + L(sd, 1.1) + L('M52.5 34.5Q50.5 39 48.8 43.5', 1);
  s += P('t-b', cap(40, 42.5, 46.5, 41.8, 4));
  s += C('t-b', 47, 41.6, 2) + C('t-b', 49.3, 36.3, 1.7);
  // eye, nose, whiskers
  s += C('t-b', 44.5, 22, 2.1) + C('t-c', 43.9, 21.4, .7);
  s += C('t-b', 55, 27.6, 1.7);
  s += L('M52 26L60.5 21.5M52.5 27.5L62 26.5M52.5 29L61 30.5', .9);
  s += P('t-c', spark(57, 13, 3.2) + spark(9, 22, 2.6));
  add('field-mouse', 'mouse sitting up nibbling a seed', s);
}

// ---------- wolf
{ let s = '';
  // moon
  s += P('t-c', 'M21.8 19.5A9 9 0 1 1 13.7 6A8 8 0 0 0 21.8 19.5Z');
  // bushy tail on the ground
  s += P('t-a', 'M16 53C10 51.5 4.5 53.5 1.5 58Q1 60.5 4 60.5H16Z');
  s += P('t-b', 'M5.5 53.5C3.8 54.7 2.4 56.2 1.5 58Q1 60.5 4 60.5H8Q4.8 57.5 5.5 53.5Z');
  // body + neck + head, one silhouette
  const ch = 'M45.5 19.5L47 22L45.5 24.5L47.5 29.5C47 34 46.5 37 45.5 40C42.5 35 42 26 45.5 19.5Z';
  s += P('t-a', ch + 'M31 2L40 8.5C44 7 49 5 54 2.8Q58 1.5 57.5 4.8L48 15L50 18L47.5 20L51 23.5L48 25.5L51.5 30C51 35 49.5 38 49 41L49.5 57Q53 57.5 53 59.5Q53 60.5 51.5 60.5H40L40.5 44C37 45 35 47 34 50V56.5Q37 57 37 59Q37 60.5 35 60.5H19C11 60.5 8 54 9.5 47C11 39 17 33 22 28C27 23.5 30 21 31 17L28.5 17L31.5 14L29.5 12.5L33 11Z', ' fill-rule="evenodd"');
  s += P('t-c', ch);
  s += P('t-b', 'M9.6 46.5C8 54 11.5 60.5 19 60.5H23C15.5 59 11.5 54 9.6 46.5Z');
  // ear, mouth, nose, eye
  s += P('t-b', 'M32.5 5L34.5 10.3L38.5 9Z');
  s += P('t-b', 'M47.5 13L56 6.2L53 10.8Z');
  s += C('t-b', 56.6, 3.7, 1.5);
  s += L('M41.5 11.8Q43.2 13.2 45 11.6', 1.3);
  // haunch, leg, fur
  s += L('M35 58.5C27 60 21 55.5 21.5 49C22 43 27 40.5 33 42', 1.6);
  s += L('M44.5 45V58', 1.4);
  s += L('M35.5 15.5L38 21M40.5 20L42.5 25.5M32.5 22L35 27', 1.3);
  s += P('t-c', spark(26, 4.5, 2.2) + spark(58.5, 24, 3.2) + spark(5, 33, 2.2));
  add('wolf', 'wolf sitting and howling at the moon', s);
}

// ---------- elephant
{ let s = '';
  // tail
  s += L('M6.5 31Q3 36 3.5 42', 1.6);
  s += P('t-b', 'M2 41.5Q3.5 40.5 5 41.5L4.5 46Q3.5 47 2.5 46Z');
  // far legs
  s += P('t-b', 'M20.5 42H27.5V60H20.5ZM28.5 42H35V60H28.5Z');
  // body + head + raised trunk + near legs
  s += P('t-a', 'M6 33C5 22 13 13 25 12.5C33 12 38 13 42 12C47 8 52 8.5 54.5 12L55.5 19C58 15 58.3 11 57 8Q55 8.5 54 6.5Q53 3.5 56 2.5Q59.5 1.5 61 5.5C62.5 10 62.5 16 61.5 22C60.5 27 57 31 52 31L49 32C47 33 45 34 44 37L44.5 57Q44.5 60 42 60H35.5Q33.5 60 33.5 57.5V45C28 46 22 46 18.5 45V57.5Q18.5 60 16.5 60H10Q8 60 8 57.5V42C6 39 6 36 6 33Z');
  // belly shade
  s += P('t-b', 'M6.3 36C7 41 11 44 18.5 45C22 46 28 46 33.5 45C39 43.5 43 40 44 37C40 40 34 42 26 42C17 42 10 40 6.3 36Z');
  // big ear with inner cut out
  const ie = 'M38.5 16C34.5 16.5 33 21 33.5 27C34 32 35.5 35.5 38 38Q39 39 40 37.5C41.5 35 43.5 34.5 45 32.5C47 29 47 23.5 45.5 20C44 17 41.5 15.8 38.5 16Z';
  s += P('t-b', 'M38 13C32 14 30 20 30.5 27C31 33 33 37 36 40.5Q38 43 40 40.5C42 37.5 44 37 46.5 35C49.5 31 50 23 48 18C46 14.5 42 12.5 38 13Z' + ie, ' fill-rule="evenodd"');
  s += P('t-c', ie);
  // eye, mouth, tusk
  s += C('t-b', 51.5, 17.5, 1.6) + C('t-c', 51, 17, .5);
  s += P('t-b', 'M48.5 31.8Q51 35 53.5 31Z');
  s += P('t-c', 'M50.5 30.5Q54 35.5 59 34Q55 32.5 53 29.5Z');
  // trunk wrinkles
  s += L('M58.3 12.5H62M58 17H62.2M56.5 21.5H61.5', 1.2);
  // toenails
  s += P('t-c', 'M37 58.5a1.5 1 0 0 1 3 0ZM40.5 58.5a1.5 1 0 0 1 3 0ZM10 58.5a1.5 1 0 0 1 3 0ZM13.5 58.5a1.5 1 0 0 1 3 0Z');
  s += P('t-c', spark(9, 8, 3.4) + spark(34, 4.5, 2.4));
  add('elephant', 'elephant trumpeting with trunk raised', s);
}
// ---------- panda
{
  let s = '';
  // bamboo stalk (behind the paw)
  s += P('t-a', cap(46.5, 61, 52.5, 6, 5));
  s += P('t-b', 'M45.6 46.3L50.6 46.8L50.4 48.6L45.4 48.1ZM47.8 26.4L52.8 26.9L52.6 28.7L47.6 28.2ZM49.7 9.5L54.7 10L54.5 11.8L49.5 11.3Z');
  // leaves
  s += P('t-a', 'M52.5 10C56 5 60 4 63 4.5C61.5 9 57.5 11.5 52.5 10Z' + 'M52 14C56 13.5 60 15.5 62.5 19.5C58 20.5 54.5 18.5 52 14Z' + 'M50.5 8C47 3.5 42.5 2 39 3C41 7.5 45.5 9.5 50.5 8Z');
  // ears
  s += C('t-b', 14.5, 11, 5.6) + C('t-b', 37.5, 11, 5.6);
  // body
  s += E('t-c', 27, 46, 17, 15.5);
  s += P('t-a', 'M39 35.5A17 15.5 0 0 1 31 61.3A17.5 17.5 0 0 0 39 35.5Z');
  // legs
  s += E('t-b', 14, 55.5, 7.5, 6.5, -15) + E('t-b', 40, 55.5, 7.5, 6.5, 15);
  // shoulder band + resting arm
  s += P('t-b', 'M12.5 38C15 33 22 31.5 27 31.5C32 31.5 38 33 41.5 37L40 40C35 37 30 36 27 36C22 36 18 37.5 16 40C17 42.5 20 44.5 23 46C24.8 47 24.5 50.5 21.5 50.5C16 50 11 46 11 42C11 40.5 11.5 39.2 12.5 38Z');
  // raised arm gripping the stalk
  s += P('t-b', limb([[38, 38.5], [47.5, 29]], 7.5));
  s += C('t-b', 48.8, 28.5, 4.4);
  // head
  s += E('t-c', 26, 21.5, 14, 12.5);
  // eye patches with cut-out eyes
  s += P('t-b', 'M16.5 18.5C18.5 15.5 23 16 23.5 19.5C24 23 21.5 27.5 18 27.5C15 27.5 14.5 22 16.5 18.5Z' + circ(20, 20.8, 2) + 'M35.5 18.5C33.5 15.5 29 16 28.5 19.5C28 23 30.5 27.5 34 27.5C37 27.5 37.5 22 35.5 18.5Z' + circ(32, 20.8, 2), ' fill-rule="evenodd"');
  s += C('t-b', 20.3, 21.2, 1) + C('t-b', 31.7, 21.2, 1);
  // nose + chewing mouth with a leaf
  s += E('t-b', 26, 27.3, 2.6, 1.8);
  s += P('t-a', 'M25.5 31C30 26.5 38 25 46 27.5C40 33 32 34 25.5 31Z');
  s += L('M28 30.5Q36 28 44 28', 1);
  s += L('M21.5 29.5Q24 32 27 30.5', 1.5);
  s += P('t-c', spark(6, 28, 3.4) + spark(58, 36, 2.4));
  add('panda', 'panda chewing bamboo', s);
}

// ---------- kangaroo
{
  let s = '';
  // far ear, far arm, far foot
  s += P('t-b', 'M43 9.5C43 5 44.5 2 46.5 1Q48.5 4 47 10Z');
  s += P('t-b', limb([[43, 27], [47, 31.5], [50.5, 30]], 3.2));
  s += P('t-b', cap(30, 57.2, 52, 57.6, 4.2));
  // tail resting on the ground
  s += P('t-a', 'M24 41C17 47 10 53.5 2.5 58Q1 61 4 61C12 60.5 20 59 27 56.5Z');
  // body: neck, chest, belly, rump
  s += P('t-a', 'M38 12C34 18 29.5 25 25 32.5C20.5 40 17 46 18.5 52C20 57.5 27 59 33 57.5C39.5 56 44 51 45.5 45C47 39.5 46.5 33 47 28C47.5 24 48.5 21.5 49.5 19Z');
  // pouch opening with the joey
  s += P('t-b', 'M34.5 44C36 38.5 42 36 47 37C47.5 41.5 44.5 46 39.5 47Q35 47 34.5 44Z');
  s += P('t-b', 'M38.5 37C37.5 33.5 38 30.5 39.8 28.5Q42.2 31.5 41.5 36.5Z');
  s += L('M37 42C36.5 37 39.5 34 43 34C46 34 47.5 35.8 50.5 37', 2.4);
  s += P('t-a', 'M37 42C36.5 37 39.5 34 43 34C46 34 47.5 35.8 50.5 37Q52.5 38.3 50.5 39.6C48 41 45.5 42 42 43Q37.5 44 37 42Z');
  s += C('t-b', 44, 37.2, 1.1);
  // haunch
  s += E('t-a', 29, 47, 10.5, 10);
  s += P('t-b', 'M37.5 40.5A10.5 10 0 0 1 23 55.5A12 12 0 0 0 37.5 40.5Z');
  // near hind foot
  s += P('t-a', limb([[33, 51], [26.5, 57.5], [48, 59.5]], 5.2));
  // head
  s += P('t-a', 'M37.5 13C38 9 41 7 45 7.5C49 8 51 10.5 53.5 12.5C55.5 14 57.5 15 57.5 17Q57.5 19 55 19.3C52 19.5 49 20 46.5 21.5C43 23 38 19 37.5 13Z');
  // near ear with cut inner
  s += P('t-a', 'M38.5 10C37.5 5.5 38 2.5 39.5 1Q43.5 3.5 43 9.5Z' + 'M40 8.5C39.5 6 39.6 4.6 40.2 3.7Q42 5.3 41.7 8.5Z', ' fill-rule="evenodd"');
  s += P('t-c', 'M40 8.5C39.5 6 39.6 4.6 40.2 3.7Q42 5.3 41.7 8.5Z');
  s += C('t-b', 47.5, 12.8, 1.5) + C('t-c', 47.1, 12.3, .5);
  s += E('t-b', 56.6, 16, 1.4, 1.1);
  // near front paw
  s += P('t-a', limb([[42, 26], [46.5, 31], [50, 29.5]], 3.4));
  s += P('t-c', spark(10, 12, 4) + spark(19, 22, 2.4) + spark(58, 44, 2.6));
  add('kangaroo', 'kangaroo with a joey in its pouch', s);
}

// ---------- penguin
{
  let s = '';
  // ice floe
  s += P('t-c', 'M6 59.5C8 56.5 14 55.5 32 55.5C50 55.5 56 56.5 58 59.5C58.5 61.5 56 62.5 50 62.8H14C8 62.5 5.5 61.5 6 59.5Z');
  // far flipper
  s += P('t-b', 'M20 28C14 32 9.5 38 7 45.5Q7 47.5 9 46.5C14 42.5 18.5 38 21 33Z');
  // body with the white face and belly cut out
  const belly = 'M33.5 10.5C36 8 40.5 9 42 12.5C43 15.5 41.5 19 41.5 21.5C42 25 45 30 46 37C47 45 43.5 53 35 54C26 55 21.5 48 22 40C22.5 33 25.5 27 26 23C26.5 20 24.5 17 25.5 13.5C26.5 10 31 8.5 33.5 10.5Z';
  s += P('t-b', 'M31 3.5C38 3.5 43.5 8 44 15C44.3 20 47 26 48.5 34C50.5 46 45 56 33 56.5C21.5 57 15.5 49 16 39C16.5 30 20 22 20 15.5C20 8.5 24.5 3.5 31 3.5Z' + belly, ' fill-rule="evenodd"');
  s += P('t-c', belly);
  // belly shade
  s += P('t-a', 'M44.6 30.5C46.5 36 47.5 44 44 49.5C41 54 36 55 30.5 54C37 52 41.5 47 43 41C44 37 44.6 34 44.6 30.5Z');
  // near flipper held out
  s += P('t-b', 'M45.5 27.5C51 31 55.5 36.5 58 43.5Q58.5 45.5 56.5 45C51.5 42 47.5 38 45.5 33.5Z');
  // eyes
  s += C('t-b', 31.5, 16, 2) + C('t-b', 39, 15.6, 2);
  s += C('t-c', 31, 15.3, .7) + C('t-c', 38.5, 14.9, .7);
  // short beak
  s += P('t-a', 'M36.5 18Q41.5 18.6 46.8 20.6Q47.4 21 46.8 21.4Q41.5 23.2 36.5 23.2Q34.6 20.6 36.5 18Z');
  s += P('t-b', 'M36 20.9Q41.5 21.2 47 21L46.8 21.4Q41.5 22.6 36.3 22.3Z');
  // webbed feet
  s += P('t-a', 'M21 57C21 54.5 24 53.5 27 54L30.5 55Q31.8 56.5 30.5 57.5Q30.5 59.8 28.3 59.2Q27 61 25.2 59.6Q23.5 60.6 22.2 59.2Q20.6 58.4 21 57Z' + 'M36 55L40.5 54C43.5 53.5 46 54.5 46 57Q46.4 58.6 44.8 59.2Q43.5 60.6 41.8 59.6Q40 61 38.7 59.2Q36.5 59.8 36.5 57.5Q35 56.4 36 55Z');
  s += P('t-c', spark(9, 12, 3.8) + spark(56, 10, 2.6));
  s += P('t-c', circ(55, 24, 1.2) + circ(8, 28, 1) + circ(14, 22, .8));
  add('penguin', 'standing penguin on an ice floe', s);
}

// ---------- snake
{
  let s = '';
  const dia = (x, y, w, h) => `M${f(x - w)} ${f(y)}L${f(x)} ${f(y - h)}L${f(x + w)} ${f(y)}L${f(x)} ${f(y + h)}Z`;
  // coil band: ellipse, shade crescent along its lower rim, and a row of diamonds
  const coil = (cx, cy, rx, ry, n) => {
    let o = E('t-a', cx, cy, rx, ry);
    o += P('t-b', `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry * .7)} 0 0 1 ${f(cx - rx)} ${f(cy)}Z`);
    let d = '';
    for (let i = 0; i < n; i++) { const t = Math.PI * (i + .5) / n; d += dia(cx - rx * .8 * Math.cos(t), cy + ry * .45 * Math.sin(t) + .3, 1.9, 1.7); }
    return o + P('t-b', d);
  };
  // tail tip
  s += P('t-a', 'M8 50C4 49 2 45.5 3.5 41.5Q5 44.5 9 45.5Z');
  s += coil(31, 52.5, 25.5, 9, 7);
  s += coil(31, 44, 19.5, 7.5, 5);
  // raised neck
  s += P('t-a', 'M22 37C20.5 29 24 24 30 21C34 19 36 16.5 37 13.5L50 18C48 22.5 44 25.5 39.5 28C35.5 30 33.5 33 35 37.5C31 41 25.5 41 22 37Z');
  s += P('t-b', dia(27.5, 28.5, 2, 1.8) + dia(34, 23.5, 2, 1.8));
  s += coil(31, 36.5, 13.5, 6, 3);
  // head
  s += P('t-a', 'M35 13C35 7.5 40 4.5 46 4.5C52.5 4.5 57 8 57 12.5C57 17 53 20 46.5 20.5C40 21 35 18.5 35 13Z' + circ(45, 10.5, 3), ' fill-rule="evenodd"');
  s += C('t-c', 45, 10.5, 3);
  s += C('t-b', 46, 10.8, 1.7) + C('t-c', 46.6, 10, .6);
  s += C('t-b', 53.5, 10.5, .8);
  s += L('M47 16.5Q51.5 18.5 55.5 15.5', 1.5);
  // forked tongue
  s += L('M56.5 15.5L59.5 16.5M59.5 16.5L62 14.5M59.5 16.5L62 18.5', 1.4);
  s += P('t-c', spark(10, 14, 4) + spark(20, 24, 2.4) + spark(57, 31, 2.8));
  add('snake', 'coiled snake with a forked tongue', s);
}

// ---------- spider-web
{
  let s = '';
  // quarter web in the top-left corner: radials and sagging rings
  const hx = 2, hy = 2, angs = [3, 24, 45, 66, 87].map(a => a * Math.PI / 180);
  const pt = (a, r) => [hx + r * Math.cos(a), hy + r * Math.sin(a)];
  let w = angs.map(a => { const p = pt(a, 35); return `M${hx} ${hy}L${f(p[0])} ${f(p[1])}`; }).join('');
  s += L(w, 1.4);
  let rg = '';
  for (const r of [10, 18.5, 27, 35]) {
    angs.forEach((a, i) => { const p = pt(a, r); if (!i) { rg += `M${f(p[0])} ${f(p[1])}`; return; }
      const c = pt((a + angs[i - 1]) / 2, r * .8); rg += `Q${f(c[0])} ${f(c[1])} ${f(p[0])} ${f(p[1])}`; });
  }
  s += L(rg, 1.1);
  // silk thread
  const top = pt(angs[0], 35);
  s += L(`M${f(top[0])} ${f(top[1])}L37 32`, 1.2);
  // eight bent legs
  const cx = 37, cy = 43, k = 1.12, legs = [[[-7, -5], [-15, -11.5], [-19.5, -6]], [[-8, -1], [-17.5, -3.5], [-21.5, 3.5]], [[-7.5, 3], [-16, 5], [-19, 11.5]], [[-5.5, 7], [-11.5, 11.5], [-13.5, 16.5]]];
  let lg = '';
  for (const l of legs) for (const m of [1, -1]) lg += l.map(([x, y], n) => `${n ? 'L' : 'M'}${f(cx + m * k * x)} ${f(cy + k * y)}`).join('');
  s += L(lg, 3);
  // round body with cut-out eyes
  s += P('t-a', circ(cx, cy, 11.5) + circ(33, 41, 3.4) + circ(41, 41, 3.4), ' fill-rule="evenodd"');
  s += P('t-b', 'M45.5 35.5A11.5 11.5 0 0 1 30.5 52.5A13.5 13.5 0 0 0 45.5 35.5Z');
  s += C('t-c', 33, 41, 3.4) + C('t-c', 41, 41, 3.4);
  s += C('t-b', 33.6, 41.6, 1.8) + C('t-b', 41.6, 41.6, 1.8);
  s += C('t-c', 34.2, 41, .6) + C('t-c', 42.2, 41, .6);
  s += L('M33 47.5Q37 51 41 47.5', 1.6);
  s += C('t-b', 37, 31.6, 1.5);
  s += P('t-c', spark(53, 12, 4.2) + spark(59, 26, 2.6) + spark(46, 21, 2.2));
  add('spider-web', 'friendly spider dangling from its web', s);
}
// ---------- jellyfish
{ let s = '';
  // trailing tentacles (behind everything)
  const ten = [[13, 27, -1], [21, 29, 1], [43, 29, -1], [51, 27, 1]];
  let tl = '';
  for (const [x, y, d] of ten) {
    tl += `M${x} ${y}Q${f(x + 4 * d)} ${y + 6} ${x} ${y + 12}T${x} ${y + 24}T${x} ${f(Math.min(y + 33, 62))}`;
  }
  s += L(tl, 2);
  // frilly oral arms
  const arm = (x0, y0, len, amp, ph, w0) => {
    const N = 6, Lp = [], Rp = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, cx = x0 + amp * Math.sin(t * Math.PI * 1.6 + ph), cy = y0 + t * len, w = w0 * (1 - t * .7);
      Lp.push([cx - w, cy]); Rp.push([cx + w, cy]);
    }
    let d = `M${f(Rp[0][0])} ${f(Rp[0][1])}`;
    for (let i = 1; i <= N; i++) { const a = Rp[i - 1], b = Rp[i]; d += `Q${f((a[0] + b[0]) / 2 + 2.6)} ${f((a[1] + b[1]) / 2)} ${f(b[0])} ${f(b[1])}`; }
    d += `Q${f(x0 + amp * Math.sin(Math.PI * 1.6 + ph))} ${f(y0 + len + 3)} ${f(Lp[N][0])} ${f(Lp[N][1])}`;
    for (let i = N - 1; i >= 0; i--) { const a = Lp[i + 1], b = Lp[i]; d += `Q${f((a[0] + b[0]) / 2 - 2.6)} ${f((a[1] + b[1]) / 2)} ${f(b[0])} ${f(b[1])}`; }
    return d + 'Z';
  };
  s += P('t-b', arm(24, 28, 24, 2.2, 0, 2.8) + arm(40, 28, 24, 2.2, 2.6, 2.8) + arm(32, 29, 29, 2, 1.3, 3));
  // bell with scalloped rim, highlight + spots cut out
  let bell = 'M7 27C7 13 18 4.5 32 4.5C46 4.5 57 13 57 27';
  for (let i = 0; i < 6; i++) { const x = 57 - (i + 1) * 50 / 6; bell += `A4.2 3.4 0 0 1 ${f(x)} 27`; }
  const hi = 'M13.5 21C13.5 14 19 9.5 25 8.5C20 11.5 17 16 16.5 21.5Q15 23 13.5 21Z';
  const dots = circ(24, 17, 1.6) + circ(30.5, 12, 1.3) + circ(38, 15.5, 1.8) + circ(31, 20.5, 1.4);
  s += P('t-a', bell + 'Z' + hi + dots, ' fill-rule="evenodd"');
  // right-side shade on the dome
  s += P('t-b', 'M45 8.5C52 12.5 56.5 19 56.5 26.5H51C51.5 19 49.5 13 45 8.5Z');
  // frilly rim band
  let rim = 'M7.2 24.5Q32 21 56.8 24.5L57 27';
  for (let i = 0; i < 6; i++) { const x = 57 - (i + 1) * 50 / 6; rim += `A4.2 3.4 0 0 1 ${f(x)} 27`; }
  s += P('t-b', rim + 'Z');
  s += P('t-c', hi + dots);
  s += P('t-c', spark(55, 46, 4) + spark(8, 50, 3.2));
  add('jellyfish', 'jellyfish with frilly arms and tentacles', s);
}

// ---------- octopus
{ let s = '';
  // compact path encoder: tenths-rounded relative commands, repeated letters dropped
  const enc = segs => { let o = '', X = 0, Y = 0, last = '';
    for (const [c, ...pts] of segs) {
      let body = ''; const abs = c === 'M';
      for (const [x, y] of pts) for (const [v, V] of [[x, X], [y, Y]]) {
        const t = f((Math.round(v * 10) - (abs ? 0 : V)) / 10).replace(/^(-?)0\./, '$1.');
        body += (body && t[0] !== '-' ? ' ' : '') + t;
      }
      const [x, y] = pts[pts.length - 1]; X = Math.round(x * 10); Y = Math.round(y * 10);
      o += (c === last && body[0] === '-' ? '' : c === last ? ' ' : c) + body; last = c;
    }
    return o; };
  // tentacle: start, heading (deg), length, curl, base width, sucker count; outline always clockwise
  // so head + arms union under nonzero and the anticlockwise sucker / eye holes stay open
  const tent = (sx, sy, th, len, k, w0, nd, n = 8) => {
    const ds = len / n, c = []; let x = sx, y = sy, a = th * Math.PI / 180;
    for (let i = 0; i <= n; i++) {
      c.push([x, y, a, w0 * (1 - .82 * (i / n) ** .8)]);
      a += k * (i / n) ** 2; const st = ds * (1.35 - .7 * i / n); x += st * Math.cos(a); y += st * Math.sin(a);
    }
    const off = (p, sg, m = .5) => [p[0] - sg * Math.sin(p[2]) * p[3] * m, p[1] + sg * Math.cos(p[2]) * p[3] * m];
    const ring = g => [...c.map(p => off(p, g)), ...c.map(p => off(p, -g)).reverse()];
    const sg = ring(1).reduce((A, p, i, r) => A + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) > 0 ? 1 : -1;
    const Lp = c.map(p => off(p, sg)), Rp = c.map(p => off(p, -sg)).reverse(), e = c[n];
    const tip = [e[0] + Math.cos(e[2]) * e[3] * .9, e[1] + Math.sin(e[2]) * e[3] * .9];
    // quadratic B-spline along each edge (one q, then t through midpoints), all relative
    const mid = (A, i) => [(A[i][0] + A[i + 1][0]) / 2, (A[i][1] + A[i + 1][1]) / 2];
    const side = A => { const m = A.slice(0, -1).map((_, i) => mid(A, i));
      return [['l', m[0]], ['q', A[1], m[1]], ...m.slice(2).map(p => ['t', p]), ['l', A[n]]]; };
    const d = enc([['M', Lp[0]], ...side(Lp), ['q', tip, Rp[0]], ...side(Rp)]) + 'Z';
    let h = '';
    for (let i = n - 1 - nd; i < n - 1; i++) { const q = off(c[i], k > 0 ? 1 : -1, .12); h += `M${f(q[0] - 1)} ${f(q[1])}a1 1 0 1 0 2 0a1 1 0 1 0-2 0Z`; }
    return [d, h];
  };
  const T = [[19.5, 30, 140, 24.5, 2, 7.5, 2], [23, 31, 114, 33, 2, 7.5, 2], [25.3, 32, 97, 35, 1.9, 7, 2]];
  let back = '', front = '';
  T.forEach(([x, y, th, l, k, w, nd]) => {
    for (const m of [1, -1]) front += tent(m > 0 ? x : 64 - x, y, m > 0 ? th : 180 - th, l, k * m, w, nd, 6).slice(0, 2).join('');
  });
  // rear pair: starts on the head's rim, between the inner front arms
  for (const m of [1, -1]) back += tent(m > 0 ? 31.1 : 32.9, 36.1, m > 0 ? 94 : 86, 23, 1.5 * m, 3.4, 0, 4)[0];
  // head (clockwise) with eye holes (anticlockwise), unioned with the front arms in one path
  const eyes = 'M18.5 23a5.5 6.5 0 1 0 11 0a5.5 6.5 0 1 0-11 0ZM34.5 23a5.5 6.5 0 1 0 11 0a5.5 6.5 0 1 0-11 0Z';
  s += P('t-a', 'M14 21C14 10.5 22 3.5 32 3.5C42 3.5 50 10.5 50 21C50 28 46 33.5 40 35.5Q32 37.5 24 35.5C18 33.5 14 28 14 21Z' + eyes + front);
  s += P('t-b', back);
  s += P('t-b', 'M42 6.5C47 9.5 50 15 50 21C50 26 48 30 44.5 33C47 28 48 19 42 6.5Z');
  s += P('t-c', eyes);
  s += P('t-b', 'M21 24.5a3.5 4.5 0 1 0 7 0a3.5 4.5 0 1 0-7 0ZM37 24.5a3.5 4.5 0 1 0 7 0a3.5 4.5 0 1 0-7 0ZM24 22.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0ZM40 22.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0Z', ' fill-rule="evenodd"');
  s += L('M28.5 31.5Q32 34 35.5 31.5', 1.6);
  s = `<g transform="translate(0 3)">${s}</g>` + P('t-c', spark(56, 8, 4) + spark(8, 9, 3));
  add('octopus', 'cartoon octopus with curling tentacles', s);
}

// ---------- spray-can
{ let s = '';
  // can built upright (18 wide, 35 tall body + cap), then tilted so the side nozzle points up-right
  const A = -18, ox = 24, oy = 38, tx = -4.5, ty = -2.5;
  const rot = ([x, y]) => { const a = A * Math.PI / 180, dx = x - ox, dy = y - oy;
    return [ox + tx + dx * Math.cos(a) - dy * Math.sin(a), oy + ty + dx * Math.sin(a) + dy * Math.cos(a)]; };
  const [nx, ny] = rot([35, 16.3]), sa = Math.atan2(ny - rot([30, 16.3])[1], nx - rot([30, 16.3])[0]) * 180 / Math.PI;
  // mist cloud
  const puffs = [[46, 12, 8.5], [55, 9, 6], [55.5, 19, 6.5], [46.5, 22, 5.5], [38.5, 15, 5], [41, 6, 4.5]];
  // spray fan of dots from the nozzle into the cloud
  let fan = '';
  for (const a of [-1, 0, 1]) for (const [d, r] of [[3.5, .7], [7, 1], [10.5, 1.3]]) {
    const q = (sa + a * (10 + d)) * Math.PI / 180; fan += circ(nx + 1 + d * Math.cos(q), ny + d * Math.sin(q), r);
  }
  s += P('t-c', puffs.map(([x, y, r]) => circ(x, y, r)).join('') + fan + [[60.5, 29, 1.4], [61, 2.5, 1], [38, 25, 1.2], [50, 1.8, 1.1]].map(([x, y, r]) => circ(x, y, r)).join(''));
  let g = '';
  const hl = 'M17.3 30H19.3V52H17.3Z', ch = 'M18.5 15.5H20.5V20.5H18.5Z';
  // body: straight cylinder, shallow dome, highlight cut out
  g += P('t-a', 'M15 25A14 14 0 0 1 33 25V58Q33 60.5 30.5 60.5H17.5Q15 60.5 15 58Z' + hl, ' fill-rule="evenodd"');
  // cap as wide as the can, its underside following the dome; highlight cut out
  g += P('t-a', 'M16 23V15Q16 12.5 18.5 12.5H29.5Q32 12.5 32 15V23A14 14 0 0 0 16 23Z' + ch, ' fill-rule="evenodd"');
  g += P('t-c', hl + ch);
  // rim ring, right-side shade, bottom ring, side nozzle and two drips (all on top)
  g += P('t-b', 'M15 25H33V58Q33 60.5 30.5 60.5H17.5Q15 60.5 15 58V55.5H30.5V27H15Z' +
    'M29.5 14.8H35Q36 14.8 36 15.8V16.8Q36 17.8 35 17.8H29.5Z' +
    'M26.8 27H29V39A1.1 1.1 0 0 1 26.8 39ZM23 27H24.8V32.5A.9 .9 0 0 1 23 32.5Z');
  s += `<g transform="translate(${tx} ${ty}) rotate(${A} ${ox} ${oy})">${g}</g>`;
  s += P('t-c', spark(52, 46, 4.5) + spark(46, 57, 3));
  add('spray-can', 'tilted spray-paint can with mist and drips', s);
}

// ---------- mosaic-tiles
{ let s = '';
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - .5;
  // compact path builder: tenths, relative m between tiles, relative l / h v inside
  const T = v => Math.round(v * 10), num = v => f(v / 10).replace(/^(-?)0\./, '$1.');
  const nums = a => a.map(num).reduce((o, t) => o + (o && t[0] !== '-' ? ' ' : '') + t, '');
  const mk = () => ({ d: '', X: 0, Y: 0 });
  const mv = (B, x, y) => { const X = T(x), Y = T(y); B.d += B.d ? 'm' + nums([X - B.X, Y - B.Y]) : 'M' + nums([X, Y]); B.X = X; B.Y = Y; };
  const rect = (B, a, b, w, h) => { mv(B, a, b); B.d += `h${num(T(w))}v${num(T(h))}h${num(-T(w))}Z`; };
  const poly = (B, pts) => { mv(B, ...pts[0]); let X = B.X, Y = B.Y, o = [];
    for (const [x, y] of pts.slice(1)) { o.push(T(x) - X, T(y) - Y); X = T(x); Y = T(y); }
    B.d += 'l' + nums(o) + 'Z'; };
  // Sutherland-Hodgman clip of a polygon by a convex (clockwise) polygon
  const clip = (sub, cp) => { let out = sub;
    for (let i = 0; i < cp.length && out.length; i++) {
      const a = cp[i], b = cp[(i + 1) % cp.length], inn = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
      const X = (p, q) => { const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [b[0] - a[0], b[1] - a[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
        const tt = ((a[0] - p[0]) * d2[1] - (a[1] - p[1]) * d2[0]) / den; return [p[0] + tt * d1[0], p[1] + tt * d1[1]]; };
      const inp = out; out = [];
      inp.forEach((p, j) => { const q = inp[(j + 1) % inp.length];
        if (inn(q)) { if (!inn(p)) out.push(X(p, q)); out.push(q); } else if (inn(p)) out.push(X(p, q)); });
    }
    return out; };
  const area = P2 => Math.abs(P2.reduce((A, p, i) => { const q = P2[(i + 1) % P2.length]; return A + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  // fish: body ellipse + tail + fins, all convex, clockwise
  const body = Array.from({ length: 16 }, (_, i) => { const a = i / 16 * 2 * Math.PI; return [36.5 + 17 * Math.cos(a), 32 + 12 * Math.sin(a)]; });
  const parts = [body, [[21, 32], [8, 45], [8, 19]], [[26, 22.5], [30, 12.5], [42, 21]], [[30, 42], [37, 42.5], [30, 49]]];
  const N = 8, lo = 6.4, span = 52.2, gw = 1.1, eye = [48.4, 28.6];
  const bg = mk(), fish = mk();
  for (let r = 0; r < N; r++) {
    // staggered joints: random tile widths per row, normalised to the panel
    const ws = Array.from({ length: N }, () => 1 + rnd() * .7), k = (span - N * gw) / ws.reduce((A, B) => A + B);
    let x = lo; const y0 = lo + r * span / N, th = span / N - gw;
    ws.forEach((wr, c) => {
      const w = wr * k, b = y0 + rnd() * .6, h = th - .2 + rnd() * .4;
      const q = [[x, b], [x + w, b], [x + w, b + h], [x, b + h]], A = area(q);
      let cov = 0, inEye = eye[0] > x && eye[0] < x + w && eye[1] > b && eye[1] < b + h;
      for (const p of parts) { if (cov >= A - .05) break; const kq = clip(q, p); if (kq.length > 2 && area(kq) > 1.2) { area(kq) > A - .05 ? rect(fish, x, b, w, h) : poly(fish, kq); cov += area(kq); } }
      if (cov < A - .3 || inEye) rect(bg, x, b, w, h);
      x += w + gw;
    });
  }
  s += P('t-a', 'M5.5 1.5h53a4 4 0 0 1 4 4v53a4 4 0 0 1-4 4h-53a4 4 0 0 1-4-4v-53a4 4 0 0 1 4-4ZM5.5 5.5v53h53v-53Z', ' fill-rule="evenodd"');
  s += P('t-c', bg.d);
  s += P('t-b', fish.d + circ(eye[0], eye[1], 2));
  add('mosaic-tiles', 'mosaic panel of tiles forming a fish', s);
}

// ---------- paper-crane
{ let s = '';
  const dy = 2, pg = (...p) => 'M' + p.map(([x, y]) => `${f(x)} ${f(y + dy)}`).join('L') + 'Z';
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // body diamond; every attachment sits exactly on its top edges so facets never overlap
  const L0 = [13, 41], T0 = [29, 37.5], R0 = [46, 41], B0 = [30, 56];
  const P1 = lerp(L0, T0, .28), Q0 = lerp(T0, R0, .4), Q1 = lerp(T0, R0, .74);
  const W = [14, 4], V = [45, 3.5], N = [56.5, 15], TT = [2, 25];
  const nm = lerp(Q1, R0, .5), tm = lerp(L0, P1, .5);
  // far wing, emerging from behind the near wing's edge
  s += P('t-b', pg(Q0, lerp(Q0, W, .5), V, Q1));
  // body
  s += P('t-a', pg(L0, T0, B0));
  s += P('t-b', pg(T0, R0, B0));
  // tail and neck spikes, split along their fold, plus the bent-down head
  s += P('t-a', pg(TT, tm, P1) + pg(N, Q1, nm));
  s += P('t-b', pg(TT, L0, tm) + pg(N, nm, R0) + pg([53.5, 18], [57, 13.5], [62, 23]));
  // near wing, folded along apex-to-centre
  s += P('t-c', pg(W, T0, P1));
  s += P('t-a', pg(W, Q0, T0));
  s += P('t-c', spark(52, 50, 4.5) + spark(10, 52, 3.2) + spark(55, 4, 3));
  add('paper-crane', 'folded origami paper crane', s);
}
// ---------- stained-glass-window
{
  let s = '';
  const cx = 32, cy = 21;
  const pet = (a, r1, r2, w) => {
    const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t), px = -dy, py = dx;
    const x1 = cx + dx * r1, y1 = cy + dy * r1, x2 = cx + dx * r2, y2 = cy + dy * r2, k = (r2 - r1) * .35;
    return `M${f(x1)} ${f(y1)}C${f(x1 + dx * k + px * w)} ${f(y1 + dy * k + py * w)} ${f(x2 + px * w * .8)} ${f(y2 + py * w * .8)} ${f(x2)} ${f(y2)}` +
      `C${f(x2 - px * w * .8)} ${f(y2 - py * w * .8)} ${f(x1 + dx * k - px * w)} ${f(y1 + dy * k - py * w)} ${f(x1)} ${f(y1)}Z`;
  };
  const leaf = (x1, y1, x2, y2, w) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, l = Math.hypot(x2 - x1, y2 - y1), px = -(y2 - y1) / l * w, py = (x2 - x1) / l * w;
    return `M${f(x1)} ${f(y1)}Q${f(mx + px)} ${f(my + py)} ${f(x2)} ${f(y2)}Q${f(mx - px)} ${f(my - py)} ${f(x1)} ${f(y1)}Z`;
  };
  const petals = [-90, -18, 54, 126, 198].map(a => pet(a, 4.3, 13.4, 7)).join('');
  const leaves = leaf(32, 48.5, 19.5, 38.5, 4.4) + leaf(32, 48.5, 44.5, 38.5, 4.4);
  const upper = 'M16.5 34V22A15.5 15.5 0 0 1 47.5 22V34Z';
  const lower = 'M16.5 34H47.5V52H16.5Z';
  s += P('t-a', upper + petals + circ(cx, cy, 3.2), ' fill-rule="evenodd"');
  s += P('t-c', petals);
  s += P('t-c', lower + leaves, ' fill-rule="evenodd"');
  s += P('t-a', leaves);
  s += P('t-b', 'M12.5 55V22A19.5 19.5 0 0 1 51.5 22V55ZM16.5 52H47.5V22A15.5 15.5 0 0 0 16.5 22Z', ' fill-rule="evenodd"');
  s += R('t-a', 8, 55, 48, 5.5, 1.5);
  s += C('t-b', cx, cy, 3.4);
  let rad = '';
  for (const a of [-54, 18, 162, 234]) {
    const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t);
    let r = 16; if (Math.abs(dy) < .5) r = (15.5) / Math.abs(dx); else r = 15.4;
    rad += `M${f(cx + dx * 3.5)} ${f(cy + dy * 3.5)}L${f(cx + dx * r)} ${f(cy + dy * r)}`;
  }
  s += L(petals + leaves, 1.6);
  s += L(rad + 'M16.5 34H47.5M32 24.5V52M19.5 38.5L16.5 43M44.5 38.5L47.5 43', 2.4);
  s += P('t-c', spark(57, 9, 4.2) + spark(7, 30, 3.2));
  add('stained-glass-window', 'arched stained-glass window with a flower', s);
}

// ---------- classical-building
{
  let s = '';
  s += P('t-a', rpoly([[4, 21], [32, 4.5], [60, 21]], [1.5, 2.5, 1.5]));
  s += P('t-b', rpoly([[13, 18.2], [32, 8.6], [51, 18.2]], 1));
  s += P('t-a', 'M6 21.5H58Q59 21.5 59 22.5V27H5V22.5Q5 21.5 6 21.5ZM7 22.6V23.6H57V22.6Z', ' fill-rule="evenodd"');
  s += R('t-b', 5, 25.2, 54, 1.8);
  let cols = '', fl = '', caps = '';
  for (let i = 0; i < 6; i++) {
    const x = 11 + i * 8.4;
    cols += `M${f(x - 2.6)} 28H${f(x + 2.6)}V47.5H${f(x - 2.6)}Z`;
    caps += `M${f(x - 3.8)} 27H${f(x + 3.8)}V29.2H${f(x - 3.8)}ZM${f(x - 3.8)} 46.3H${f(x + 3.8)}V48.5H${f(x - 3.8)}Z`;
    fl += `M${f(x - 1.2)} 30.5V44.5M${f(x + 1.2)} 30.5V44.5`;
  }
  s += P('t-a', cols);
  s += P('t-b', caps);
  s += L(fl, 1);
  s += R('t-a', 5, 48.5, 54, 3.5, 0.8);
  s += R('t-a', 2.5, 52, 59, 3.5, 0.8);
  s += R('t-a', 0.8, 55.5, 62.4, 4, 0.8);
  s += P('t-b', 'M5 51H59V52H5ZM2.5 54.5H61.5V55.5H2.5ZM0.8 58.5H63.2V59.5H0.8Z');
  s += P('t-c', 'M7 22.6H57V23.6H7Z');
  s += P('t-c', spark(8, 8, 3.5) + spark(56, 8, 3.5));
  add('classical-building', 'columned building with pediment and steps', s);
}

// ---------- ear
{
  let s = '';
  const ear = 'M30.5 23C30.5 11.5 38.5 4.5 46 4.5C54 4.5 59 11.5 59 20C59 28 55 32.5 52.5 38C50.5 42.5 50.5 48 48.5 53C46.5 58 40 60.5 36.5 57.5C33.5 55 35.5 50 34.5 46.5C33.5 42 30.5 38.5 30.5 33Z';
  const hl = cap(34.6, 19, 39, 10.6, 2.4);
  s += P('t-a', ear + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', 'M55.6 9.5C58.2 13.5 59 17 59 20C59 28 55 32.5 52.5 38C51.3 40.8 50.8 44 50.2 47.5C50 42 50.8 37.5 52.8 33C55 28 56.6 25 56.6 19.5C56.6 16 56.3 12.5 55.6 9.5Z');
  s += P('t-b', 'M38 31C35 34 36 41 40.5 42.5C44 43.5 46 40 45 36.5C44 33 41 28.5 38 31Z');
  s += L('M37 26C36 18 41 12.5 46.5 12.5C52 12.5 53.5 19 51 24C49 28 45 29.5 43.5 33.5', 3.2);
  s += L('M44.5 47.5C45 50.5 43.5 52.5 41.5 52.5', 2);
  let w = '';
  for (const r of [8, 14, 20]) {
    const a = 0.75, x1 = 2 + r * Math.cos(a), y1 = 32 - r * Math.sin(a), y2 = 32 + r * Math.sin(a);
    w += `M${f(x1)} ${f(y1)}A${r} ${r} 0 0 1 ${f(x1)} ${f(y2)}`;
  }
  s += L(w, 3.2);
  s += P('t-c', spark(10, 9, 4) + spark(12, 56, 3));
  add('ear', 'ear with sound waves', s);
}

// ---------- nose
{
  let s = '';
  const face = 'M6 2.5H21C22.5 4.5 22.5 7 21.5 9.5C26 13 39 16 46 20C51.5 23.5 50 31 44 30.8C41.5 30.7 40.5 29.4 38 29.8C34.5 30.4 31.5 31.5 31 34.5C30.5 37.5 33.5 38.5 33 41.5C32.6 44 29.5 44.5 29.5 46C31.5 48 31.5 51 29.5 52.5C31 55 30 59.5 25 61.5H6C3 52 2.5 42 2.5 32S3 10 6 2.5Z';
  s += P('t-a', face);
  // shadow under the nose tip, on the face's own edge
  s += P('t-b', 'M49.1 23.9C50.2 27.3 48.2 30.9 44 30.8C41.5 30.7 40.5 29.4 38 29.8C40.2 28.3 42.2 28.9 44.2 28.8C46.8 28.7 48.8 26.9 49.1 23.9Z');
  s += E('t-b', 40.6, 27.9, 3.3, 1.7, 15);
  s += L('M35.5 29.6C33 26.5 35.2 22.3 40 22.6', 2.4);
  s += L('M9 13Q13 17 17 13', 2.2);
  s += L('M24 46.3Q27 47.3 29.5 46', 1.8);
  // scent: smooth S-wisps, floating free of both the flower and the nostril
  const wisp = (ax, ay, bx, by, k) => {
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy), px = -dy / l * k, py = dx / l * k;
    return `M${f(ax)} ${f(ay)}C${f(ax + dx * .3 + px)} ${f(ay + dy * .3 + py)} ${f(ax + dx * .6 - px)} ${f(ay + dy * .6 - py)} ${f(bx)} ${f(by)}`;
  };
  s += L(wisp(50, 42, 41, 33.6, 3) + wisp(55.5, 40, 47.5, 33.6, 3), 2.2);
  s += L('M55.5 55.9V61', 2.2);
  s += P('t-a', 'M56 59.5Q57.5 55.5 62 56Q60.5 60.5 56 59.5Z');
  let pet = '';
  for (let i = 0; i < 5; i++) { const a = (-90 + i * 72) * Math.PI / 180; pet += circ(55.5 + 3.9 * Math.cos(a), 49.3 + 3.9 * Math.sin(a), 3.2); }
  s += P('t-a', pet);
  s += C('t-b', 55.5, 49.3, 2.4);
  s += P('t-c', spark(52, 9, 4.5) + spark(59, 20, 2.6));
  add('nose', 'nose sniffing a flower', s);
}

// ---------- comb
{
  let s = '', b = '', c = '';
  // round brush, local x along its axis, crossing point at the origin
  b += P('t-a', 'M7 -3.5H15V3.5H7Z');
  let br = '', dots = '';
  for (let x = 19.5; x <= 43; x += 2.1) br += `M${f(x)} -8.6V-3M${f(x)} 3V8.6`;
  b += L(br, 1.3);
  b += R('t-a', 17, -3.6, 29, 7.2, 3);
  for (let x = 20.5; x <= 43; x += 2.6) dots += circ(x, 0, 0.9);
  b += P('t-b', dots);
  b += R('t-b', 14, -4.4, 4, 8.8, 1.2);
  s += `<g transform="translate(21 43) rotate(-45)">${b}</g>`;
  // wide-tooth comb on top, teeth pointing down the brush handle; the handle shows
  // between the two centre teeth and runs on past the tooth tips (one path, no t-a overlap)
  let d = 'M-20.5 -7H20.5Q22.5 -7 22.5 -5V-1.5H19.5';
  for (let i = 0; i < 8; i++) {
    const x = 17.5 - i * 5;
    d += `L${f(x + 1.4)} -1.5V5.5Q${f(x + 1.4)} 7.5 ${f(x)} 7.5Q${f(x - 1.4)} 7.5 ${f(x - 1.4)} 5.5V-1.5`;
  }
  d += 'H-22.5V-5Q-22.5 -7 -20.5 -7ZM-1.1 -1.5H1.1V7.5H-1.1ZM-3.5 7.5H3.5L3 17A3 3 0 0 1 -3 17Z' + circ(0, 16.5, 1.1);
  c += P('t-a', d);
  c += R('t-b', -22.5, -2.6, 45, 1.6);
  s += `<g transform="translate(21 43) rotate(45)">${c}</g>`;
  s += L('M44 60.5C47 56 51 59 53.5 54.5S58.5 50 60.5 46M47.5 51C49.5 47 53.5 49.5 55.5 45.5S59 42 60.5 40', 1.6);
  s += P('t-c', spark(9, 9, 4) + spark(29, 9, 2.6));
  add('comb', 'wide-tooth comb crossed over a round brush', s);
}
// ---------- stomach
{
  let s = '';
  // duodenum outlet curving off bottom right
  s += P('t-a', 'M44 34.5C55 33.5 60.5 41 60.5 51V58.5Q60.5 61.5 57.3 61.5Q54 61.5 54 58.5V51C54 44.5 51 41.5 44 41.5Z');
  s += P('t-b', 'M54 51C54 46 52.5 43 49 42Q57.5 42 58 52V58.5Q58 61 56 61.4Q54 61 54 58.5Z');
  // oesophagus entering top left
  s += P('t-a', 'M18.5 16L19 3Q19 1 22.5 1Q26 1 26 3L26.5 17Z');
  s += P('t-b', 'M23.5 16.5L23 1.1Q26 1.3 26 3L26.5 17Z');
  // J-shaped bag
  const bag = 'M19.5 14.5C16 8.5 3.5 8 3.5 24C3.5 45 14 57.5 28.5 57.5C39 57.5 46 51 49 44.5Q50.5 41.5 49 38.5Q47.5 35.5 44 35.5C38.5 36 34.5 33 32.5 28C30.5 22.5 29.5 18 27 15.5C24.5 13.5 21.5 13.5 19.5 14.5Z';
  const hl = 'M7.5 24C7.5 17 10 13.5 13.5 13Q10.5 17 10 24Q9.5 27.5 8.5 27.5Q7.5 27.5 7.5 24Z';
  const ck = 'M10.6 41a2.4 1.5 0 1 0 4.8 0a2.4 1.5 0 1 0 -4.8 0ZM30.8 43.5a2.2 1.4 0 1 0 4.4 0a2.2 1.4 0 1 0 -4.4 0Z';
  s += P('t-a', bag + hl + ck, ' fill-rule="evenodd"');
  // greater-curve shade
  s += P('t-b', 'M5.5 34C8 47 16.5 55 28.5 55C38 55 44 50 47.5 43.5Q46.5 49 42 53Q36.5 57.5 28.5 57.5C14 57.5 4.5 47 5.5 34Z');
  // pylorus band
  s += P('t-b', 'M45.5 35.6Q48 36.5 49 38.5Q50.5 41.5 49 44.5Q48 46.5 46.6 47.5Q48 42 45.5 35.6Z');
  // highlight on fundus
  s += P('t-c', hl + ck);
  // friendly face
  s += C('t-b', 17.5, 35, 2.1) + C('t-b', 28, 37, 2.1);
  s += L('M18 42.5Q22.5 47 28 43.5', 2);
  // rumble: short shake arcs around the bag's upper right, like the phone and alarm clock
  const arc = (r, a1, a2) => { const u = a => [24 + r * Math.cos(a * Math.PI / 180), 36 + r * Math.sin(a * Math.PI / 180)], p = u(a1), q = u(a2); return `M${f(p[0])} ${f(p[1])}A${r} ${r} 0 0 1 ${f(q[0])} ${f(q[1])}`; };
  s += L(arc(25, -48, -27) + arc(30, -46, -29), 2.4);
  s += P('t-c', spark(58, 5, 3.5) + spark(7, 5, 3));
  add('stomach', 'friendly rumbling cartoon stomach', s);
}

// ---------- blood-drop
{
  let s = '';
  // dimpled blood cells
  for (const [x, y, r, rot] of [[51.5, 19, 8.5, -20], [54, 40, 7.5, 15], [48.5, 56, 5.5, -10]]) {
    s += E('t-a', x, y, r, r * .86, rot);
    s += E('t-b', x + r * .08, y + r * .1, r * .48, r * .36, rot);
  }
  // the drop, shine cut out
  const drop = 'M24 2C30 12 43 24 43 39A19 19 0 0 1 5 39C5 24 18 12 24 2Z';
  const shine = 'M10 40Q10 30 16.5 23.5Q13.5 31 14 40Q14 43.5 12 43.5Q10 43.5 10 40Z' + circ(12.2, 48.5, 1.8);
  s += P('t-a', drop + shine, ' fill-rule="evenodd"');
  s += P('t-b', 'M43 39A19 19 0 0 1 17 56.7Q33 55.5 38.5 42Q41 33 37 24.5Q43 31 43 39Z');
  s += P('t-c', shine);
  s += P('t-c', spark(37, 6, 4) + spark(59, 58, 2.6));
  add('blood-drop', 'blood drop with round blood cells', s);
}

// ---------- glossy-magazine
{
  let s = '';
  // pages behind
  s += P('t-b', 'M51 5.5H52.7Q54.5 5.5 54.5 7.3V59.7Q54.5 61.5 52.7 61.5H16.3Q14.5 61.5 14.5 59.7V58.5H38L51 45.5Z');
  const flap = 'M51 45.5L38 58.5Q37.5 51.5 39.8 48.2Q42.5 45.5 51 45.5Z';
  // cover with the curled corner folded away
  s += P('t-a', 'M11 4.3Q11 2.5 12.8 2.5H49.2Q51 2.5 51 4.3V45.5L38 58.5H12.8Q11 58.5 11 56.7Z' + flap, ' fill-rule="evenodd"');
  // masthead
  s += R('t-b', 14, 6, 34, 9.5, 1.6);
  // cover lines
  for (const [y, w] of [[19.5, 12], [25, 9], [30.5, 11], [36, 7.5]]) s += R('t-b', 14.5, y, w, 3, 1.5);
  // star sticker
  s += P('t-b', rpoly(star(18.5, 50.5, 6, 3.9, 9), .6));
  // smiling cover star: head and shoulders
  const face = circ(35.6, 28.5, 1.25) + circ(41.4, 28.5, 1.25) + 'M34.6 31.6Q38.5 35.4 42.4 31.6Q38.5 33.4 34.6 31.6Z';
  s += P('t-b', circ(38.5, 29.5, 7.5) + face, ' fill-rule="evenodd"');
  s += P('t-b', 'M35.5 35.5H41.5V42H35.5Z' + 'M30.2 35.5Q28.6 21 38.5 19.8Q48.4 21 46.8 35.5Q45 36.8 44.6 34Q45.6 27 42.5 24.6Q38 27.6 32.6 26.6Q31.8 30.5 32.4 34Q32 36.8 30.2 35.5Z');
  s += P('t-b', 'M26 58.5Q26 41 38.5 40.5Q50 40.5 51 44.5V45.5L38 58.5Z' + flap, ' fill-rule="evenodd"');
  s += P('t-c', flap);
  s += P('t-c', spark(58, 7, 4) + spark(5.5, 30, 3));
  add('glossy-magazine', 'magazine with a smiling cover star', s);
}

// ---------- wedding-rings
{
  let s = '';
  // circle-circle intersection, picking the upper (top=1) or lower point
  const X = (c1, r1, c2, r2, top) => {
    const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy), a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(r1 * r1 - a * a);
    const mx = c1[0] + a * dx / d, my = c1[1] + a * dy / d, p = [mx + h * dy / d, my - h * dx / d], q = [mx - h * dy / d, my + h * dx / d];
    return (p[1] < q[1]) === !!top ? p : q;
  };
  const A = (c, r, p, q, long) => {
    const cr = (p[0] - c[0]) * (q[1] - c[1]) - (p[1] - c[1]) * (q[0] - c[0]);
    return `A${f(r)} ${f(r)} 0 ${long ? 1 : 0} ${(cr > 0) !== !!long ? 1 : 0} ${f(q[0])} ${f(q[1])}`;
  };
  const c1 = [23, 43.5], c2 = [40, 45.5], R = 15.5, r = 10.8;
  // ring 1 (c1) passes under ring 2 at the top crossing / ring 2 (c2) under ring 1 at the bottom one
  const ring = (c, k, top, g = 1.3) => {
    const kO = R + g, kI = r - g;
    const o1 = X(c, R, k, kO, top), o2 = X(c, R, k, kI, top), i1 = X(c, r, k, kO, top), i2 = X(c, r, k, kI, top);
    return `M${f(o1[0])} ${f(o1[1])}` + A(c, R, o1, o2, 1) + A(k, kI, o2, i2, 0) + A(c, r, i2, i1, 1) + A(k, kO, i1, o1, 0) + 'Z';
  };
  // rounded arc band at mid-radius m, width w, from angle a1 to a2 (degrees)
  const band = (c, m, w, a1, a2) => {
    const u = (a, rr) => [c[0] + rr * Math.cos(a * Math.PI / 180), c[1] + rr * Math.sin(a * Math.PI / 180)];
    const o1 = u(a1, m + w / 2), o2 = u(a2, m + w / 2), i2 = u(a2, m - w / 2), i1 = u(a1, m - w / 2), h = f(w / 2), lg = a2 - a1 > 180 ? 1 : 0;
    return `M${f(o1[0])} ${f(o1[1])}A${f(m + w / 2)} ${f(m + w / 2)} 0 ${lg} 1 ${f(o2[0])} ${f(o2[1])}A${h} ${h} 0 0 1 ${f(i2[0])} ${f(i2[1])}A${f(m - w / 2)} ${f(m - w / 2)} 0 ${lg} 0 ${f(i1[0])} ${f(i1[1])}A${h} ${h} 0 0 1 ${f(o1[0])} ${f(o1[1])}Z`;
  };
  const m = (R + r) / 2, hl1 = band(c1, m, 1.8, 195, 245), hl2 = band(c2, m, 1.8, -70, -25);
  s += P('t-a', ring(c1, c2, 0) + hl1, ' fill-rule="evenodd"');
  s += P('t-a', ring(c2, c1, 1) + hl2, ' fill-rule="evenodd"');
  s += P('t-b', band(c1, R - 1.3, 2.4, 105, 175) + band(c2, R - 1.3, 2.4, 15, 95));
  s += P('t-c', hl1 + hl2);
  // faceted stone in its setting on the left ring
  s += P('t-a', 'M13 13.2L17.5 7.5H20.6L19.2 13.2Z' + 'M23.4 7.5H26.5L31 13.2H24.8Z' + 'M13 14L21.6 14V25.5Z');
  s += P('t-c', 'M21.4 7.5H22.6L24 13.2H20Z');
  s += P('t-b', 'M22.4 14H31L22.4 25.5Z');
  s += P('t-b', 'M16.5 21.5Q22 23.5 27.5 21.5L24.5 29.5Q22 30.5 19.5 29.5Z');
  s += P('t-c', spark(7, 10, 4) + spark(38, 9, 3.2) + spark(56, 21, 4.5));
  add('wedding-rings', 'two interlocked rings, one with a diamond', s);
}
// ---------- pram
{
  let s = '';
  // arc command from `a` to `b` on circle (cx,cy,r) that passes through `v`
  const arcVia = (cx, cy, r, a, b, v) => {
    const ang = p => Math.atan2(p[1] - cy, p[0] - cx), n = x => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const ta = ang(a), tb = n(ang(b) - ta), tv = n(ang(v) - ta), sw = tv < tb ? 1 : 0, span = sw ? tb : 2 * Math.PI - tb;
    return `A${f(r)} ${f(r)} 0 ${span > Math.PI ? 1 : 0} ${sw} ${f(b[0])} ${f(b[1])}`;
  };
  // part of the far wheel (fx,fy,fr) that peeks out from behind the near wheel (nx,ny,nr)
  const peek = (fx, fy, fr, nx, ny, nr) => {
    const d = Math.hypot(fx - nx, fy - ny), ux = (fx - nx) / d, uy = (fy - ny) / d;
    const a = (d * d + nr * nr - fr * fr) / (2 * d), h = Math.sqrt(nr * nr - a * a), mx = nx + a * ux, my = ny + a * uy;
    const p1 = [mx - h * uy, my + h * ux], p2 = [mx + h * uy, my - h * ux];
    return `M${f(p1[0])} ${f(p1[1])}` + arcVia(fx, fy, fr, p1, p2, [fx + fr * ux, fy + fr * uy]) + arcVia(nx, ny, nr, p2, p1, [nx + nr * ux, ny + nr * uy]) + 'Z';
  };
  const W = [[19, 51, 10, 23, 49.6, 9.4], [49, 52, 9, 52.6, 50.8, 8.4]];
  // far wheels peeking out behind
  s += P('t-b', W.map(w => peek(w[3], w[4], w[5], w[0], w[1], w[2])).join(''));
  // push handle
  s += L('M17 40C8.5 35 5.5 27 5.5 14.5', 3);
  s += P('t-b', cap(2.6, 14.2, 9.2, 11.2, 4.4));
  // springs to the axles
  s += L('M24 43Q16 45 19 51M44 43Q53 45 49 52', 2);
  // basket body
  const body = 'M12 27H59Q60.6 27 60.2 29C58.6 38 52 44.5 43 44.5H27C18 44.5 11.6 38 10.8 29Q10.6 27 12 27Z';
  const stripe = 'M13.6 32.6H57.6Q57 34.4 56.5 35.2H14.6Q14 34.4 13.6 32.6Z';
  s += P('t-a', body + stripe, ' fill-rule="evenodd"');
  s += P('t-b', 'M13.5 37.5C17 42 21.5 44.5 27 44.5H43C48.5 44.5 53 42 56.6 37.5C54 40 49.5 41.5 43 41.5H27C20.5 41.5 16 40 13.5 37.5Z');
  s += P('t-c', stripe);
  s += P('t-b', 'M10.5 25.5H60.5Q62 25.5 62 27Q62 28.5 60.5 28.5H10.5Q9 28.5 9 27Q9 25.5 10.5 25.5Z');
  // folding hood with radiating bows
  const hx = 38, hy = 26, rx = 26, ry = 21, pt = a => [hx + rx * Math.cos(a * Math.PI / 180), hy + ry * Math.sin(a * Math.PI / 180)];
  const wedge = (a0, a1) => { const p = pt(a0), q = pt(a1); return `M${hx} ${hy}L${f(p[0])} ${f(p[1])}A${rx} ${ry} 0 0 1 ${f(q[0])} ${f(q[1])}Z`; };
  const hl = 'M17.5 14Q24 6.5 33 5.6Q25.5 9 20.5 15.5Z';
  s += P('t-a', wedge(180, 270) + hl, ' fill-rule="evenodd"');
  s += P('t-b', wedge(198, 216) + wedge(234, 252));
  s += P('t-b', cap(38, 5.5, 39.6, 26, 3.4));
  s += P('t-c', hl);
  s += C('t-b', 36.5, 25.5, 2.6) + C('t-c', 36.5, 25.5, 1);
  // spoked near wheels
  for (const [x, y, r] of W) {
    s += P('t-b', circ(x, y, r) + circ(x, y, r - 2.6), ' fill-rule="evenodd"');
    let sp = '';
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .2; sp += `M${f(x + 2 * Math.cos(a))} ${f(y + 2 * Math.sin(a))}L${f(x + (r - 2.4) * Math.cos(a))} ${f(y + (r - 2.4) * Math.sin(a))}`; }
    s += L(sp, 1.3);
    s += C('t-b', x, y, 2.4);
  }
  s += P('t-c', spark(53, 10, 4.5) + spark(60, 19.5, 2.8));
  add('pram', 'baby pram with folding hood', s);
}

// ---------- jeans
{
  let s = '';
  // dashes of topstitching along a quadratic curve
  const g = n => f(n).replace(/^(-?)0\./, '$1.'), xy = (a, b) => g(a) + (g(b)[0] == '-' ? '' : ' ') + g(b);
  const stitch = (p0, p1, p2, n) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / (n + .4), u = 1 - t, x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
      const tx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), ty = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]), l = Math.hypot(tx, ty);
      const ax = tx / l * 2, ay = ty / l * 2, bx = -ty / l * .9, by = tx / l * .9;
      d += `M${xy(x, y)}l${xy(ax, ay)}l${xy(bx, by)}l${xy(-ax, -ay)}Z`;
    }
    return d;
  };
  const st = stitch([24.2, 11.5], [23.8, 22], [13.8, 24], 4) + stitch([39.8, 11.5], [40.2, 22], [50.2, 24], 4) + stitch([35.6, 10], [35.6, 26.5], [32.2, 27.4], 4);
  const rv = circ(24.3, 13.2, 1.3) + circ(15.4, 23.9, 1.3) + circ(39.7, 13.2, 1.3) + circ(48.6, 23.9, 1.3);
  s += P('t-a', 'M14 11.5H50Q50.7 30 53.7 50.5H37L32 27.5L27 50.5H10.3Q13.3 30 14 11.5Z' + st + rv, ' fill-rule="evenodd"');
  // right-leg shade and scooped pockets
  s += P('t-b', 'M50 11.5Q50.7 30 53.7 50.5H50.5Q48.3 30 48 11.5Z');
  s += P('t-b', 'M14 11.5H22.6Q22.2 20.5 13.7 22.3Q14 16 14 11.5ZM50 11.5H41.4Q41.8 20.5 50.3 22.3Q50 16 50 11.5Z');
  s += P('t-c', st + rv);
  s += L('M32 11.5V27', 1.4);
  // waistband with loops and button
  const lp = [17, 26.5, 37.5, 47], btn = circ(32, 8.5, 2.4);
  s += P('t-b', 'M14.5 5.5H49.5Q50.5 5.5 50.5 6.5V11.5H13.5V6.5Q13.5 5.5 14.5 5.5Z' + lp.map(x => `M${x - 1.2} 5.6h2.4v5.9h-2.4Z`).join('') + btn, ' fill-rule="evenodd"');
  s += P('t-a', lp.map(x => `M${x - 1.2} 4.4h2.4v7.1h-2.4Z`).join(''));
  s += P('t-c', btn);
  s += C('t-b', 32, 8.5, .9);
  // rolled cuffs, pale inside of the denim
  const cf = [[9.7, 27.6], [36.4, 54.3]];
  s += P('t-b', cf.map(([a, b]) => `M${a} 50.5H${b}V52.6H${a}Z`).join(''));
  s += P('t-c', cf.map(([a, b]) => `M${a} 52.6H${b}L${f(b + .2)} 58.5H${f(a - .2)}Z`).join(''));
  s += L(cf.map(([a, b]) => `M${f(a + 1.2)} 55.6H${f(b - 1.2)}`).join(''), 1.2);
  s += P('t-c', spark(57.5, 30, 4));
  add('jeans', 'blue denim jeans with rolled cuffs', s);
}

// ---------- fabric-bolt
{
  let s = '';
  // rolled end of a bolt: pale ellipse with a spiral of cloth layers
  const top = (cx, y) => E('t-c', cx, y, 8.5, 3) + L(`M${f(cx - 1.5)} ${y}a1.5 .6 0 1 1 3 0a3.2 1.3 0 0 1 -6.2 .4a5 2 0 0 1 10 -.5`, 1);
  const B = 51, shade = (x, y) => `M${f(x + 6)} ${y}h2.5V${B}h-2.5Z`;
  // gingham bolt, left
  let ga = `M8.2 12h4.3v${B - 12}H8.2ZM16.8 12h4.2v${B - 12}h-4.2Z`, gb = shade(12.5, 12);
  for (let y = 16.2; y < 48; y += 8.5) { ga += `M4 ${f(y)}h17v4.3H4Z`; gb += `M8.2 ${f(y)}h4.3v4.3H8.2Z`; }
  s += R('t-c', 4, 12, 17, B - 12) + P('t-a', ga) + P('t-b', gb) + top(12.5, 12);
  // striped bolt, right
  s += R('t-a', 43, 10, 17, B - 10);
  let sb = shade(51.5, 10);
  for (const [a, b] of [[-.95, -.75], [-.45, -.15], [.2, .5]]) sb += `M${f(51.5 + 8.5 * a)} 10H${f(51.5 + 8.5 * b)}V${B}H${f(51.5 + 8.5 * a)}Z`;
  s += P('t-b', sb) + top(51.5, 10);
  // polka-dot bolt, middle; it stops where the peeled sheet covers it so nothing ghosts through
  s += P('t-a', 'M23.5 7H40.5V31A8.5 3 0 0 1 23.5 31Z') + P('t-b', 'M38 7h2.5V31Q39.3 32.6 38 33.1Z') + top(32, 7);
  let dots = '';
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) { const x = 26.5 + i * 5.2 + (j % 2) * 2.6; if (x < 37.5) dots += `M${f(x)} ${f(13.5 + j * 5)}h0`; }
  // the outer layer peels off the roll's front, droops and spreads across the floor
  for (const [x, y] of [[32, 38.5], [25.2, 44], [33.2, 45.5], [39, 41], [8.5, 53.5], [16, 54], [22.5, 56], [32.5, 54.5], [46, 53.2], [53, 54.8], [58.6, 52.6]]) dots += `M${x} ${y}h0`;
  s += P('t-a', 'M23.5 30.5A8.5 3 0 0 0 40.5 30.5C41.6 36 40 41.5 41.2 46Q42.2 49.4 47 49.6C52.5 49.8 57 48.5 61.5 50.2Q62.6 55 57.5 57.2C50 60.2 44 57.4 36 59.4C28 61.4 16 59 8 61C6 59.5 4 57 2.5 55.5Q2 50.6 6 50.6Q16 50.4 20 50.3Q22.6 49.8 22.8 46C24 41.5 22.4 36 23.5 30.5Z');
  // shadow where the spread cloth meets the bolts' bases
  s += P('t-b', 'M3.2 52.4Q4 50.6 6 50.6Q16 50.4 20 50.3Q21.8 50 22.4 48.4Q22.6 51.8 20 52.2Q14 52.4 6 52.5Q4 52.6 3.2 52.4ZM41.6 48Q42.6 49.4 47 49.6C52.5 49.8 57 48.5 61.5 50.2L61.7 51.8C57 50.4 52.5 51.6 47 51.4Q43 51.3 41.6 48Z');
  // fold shades running down the hanging sheet into the floor
  s += P('t-b', 'M28.3 34Q26.6 44 25.6 53.5Q27.6 54.4 29.4 53.4Q28.6 44 28.3 34ZM36.4 33.8Q37.4 44 39.6 52.6Q37.8 53.6 36.2 53Q36.8 44 36.4 33.8Z');
  s += L(dots, 2.8) + L('M24.2 31.7A8.5 3 0 0 0 39.8 31.7', 1.4);
  // turned-over hem showing the paler back of the cloth
  s += P('t-c', 'M2.5 55.5C4.5 56.5 6.5 59.5 8 61C16 59 28 61.5 36 59.5C28 57.5 18 59 13 56.5Q8 53.5 2.5 55.5Z');
  s += P('t-c', spark(57, 4.5, 3) + spark(5, 5.5, 3));
  add('fabric-bolt', 'three patterned rolls of cloth', s);
}

// ---------- uniform-jacket
{
  let s = '';
  const coat = 'M26 9.5L9.5 13.5Q6.5 14.5 6 18L2.5 49.5H12.5L15 27.5L15.8 59.5H48.2L49 27.5L51.5 49.5H61.5L58 18Q57.5 14.5 54.5 13.5L38 9.5Q32 13 26 9.5Z';
  // gold parts: epaulettes, buttons, crest, sleeve chevrons
  const ep = x => { const k = x < 32 ? 1 : -1, o = k > 0 ? 0 : 64; const X = v => f(o + k * v); return `M${X(8.5)} 15.5Q${X(15)} 11.8 ${X(22)} 12.5Q${X(24)} 13 ${X(23)} 14.5Q${X(17.5)} 15 ${X(16.6)} 17L${X(16.6)} 21.8` + [14.4, 12.3, 10.2, 8.1].map(v => `Q${X(v + 1.05)} 23.8 ${X(v)} 21.8`).join('') + 'Z'; };
  const gold = ep(0) + ep(64) + [24, 33, 42].map(y => circ(27, y, 1.8) + circ(37, y, 1.8)).join('')
    + 'M41.5 19H47.5V23.5Q47.5 27 44.5 28Q41.5 27 41.5 23.5Z'
    + 'M51.5 27.5L55.7 30L59.7 27L59.9 29.2L55.8 32.4L51.6 29.8ZM51.8 31.8L55.9 34.4L60.1 31.4L60.3 33.6L56 36.8L51.9 34.1Z';
  s += P('t-a', coat + gold, ' fill-rule="evenodd"');
  // shading: sleeves, front overlap, hem and cuffs
  s += P('t-b', 'M12.5 49.5L15 27.5L15.4 41Z' + 'M51.5 49.5L49 27.5L48.6 41Z' + 'M2.5 49.5L2.9 46.2H12.9L12.5 49.5Z' + 'M61.5 49.5L61.1 46.2H51.1L51.5 49.5Z' + 'M15.7 55.5H48.3V59.5H15.8Z' + 'M32.5 11.5V55.5H30.5V12.2Z');
  s += P('t-c', gold);
  s += L([10.2, 12.3, 14.4, 49.6, 51.7, 53.8].map(x => `M${x} 17.6V22`).join(''), .9);
  s += P('t-b', 'M43.4 21H45.6V23.5Q45.6 25.4 44.5 26Q43.4 25.4 43.4 23.5Z');
  // stand-up collar
  s += P('t-b', 'M24 4.5H40Q41 4.5 41 5.5V10Q36.5 13.5 32 13.5Q27.5 13.5 23 10V5.5Q23 4.5 24 4.5Z');
  s += P('t-c', 'M24.5 6.2H39.5V7.6H24.5Z');
  s += L('M32 8.5V13', 1.2);
  s += P('t-c', spark(57, 5.5, 3.5) + spark(6.5, 56, 3));
  add('uniform-jacket', 'navy uniform jacket with gold epaulettes', s);
}

// ---------- diamond-ring
{
  let s = '';
  // band arc between radii r1 and r2, angles a0..a1 (degrees), around (cx, cy)
  const band = (cx, cy, r1, r2, a0, a1) => {
    const p = (r, a) => `${f(cx + r * Math.cos(a * Math.PI / 180))} ${f(cy + r * Math.sin(a * Math.PI / 180))}`, lg = a1 - a0 > 180 ? 1 : 0;
    return `M${p(r2, a0)}A${r2} ${r2} 0 ${lg} 1 ${p(r2, a1)}L${p(r1, a1)}A${r1} ${r1} 0 ${lg} 0 ${p(r1, a0)}Z`;
  };
  const hl = band(32, 44, 14.2, 16.2, 195, 245);
  s += P('t-a', circ(32, 44, 18) + circ(32, 44, 12.5) + hl, ' fill-rule="evenodd"');
  s += P('t-b', band(32, 44, 12.5, 18, 15, 125) + 'M19.5 44A12.5 12.5 0 0 0 44.5 44A12.5 9.5 0 0 1 19.5 44Z');
  s += P('t-c', hl);
  // setting cup
  s += P('t-b', 'M25.5 30.5L27.5 24H36.5L38.5 30.5Q32 32.5 25.5 30.5Z');
  // faceted stone
  const G0 = [14, 13], P1 = [24, 13], M = [32, 13], P2 = [40, 13], G4 = [50, 13], T1 = [22, 4], T2 = [42, 4], Cu = [32, 30];
  const tri = (...q) => 'M' + q.map(v => v.join(' ')).join('L') + 'Z';
  s += P('t-a', tri(G0, T1, P1) + tri(T2, P2, M) + tri(P1, M, Cu));
  s += P('t-c', tri(T1, M, P1) + tri(T1, T2, M) + tri(G0, P1, Cu) + tri(M, P2, Cu));
  s += P('t-b', tri(T2, G4, P2) + tri(P2, G4, Cu));
  s += L('M15.2 13H48.8', .8);
  // glints
  s += P('t-c', spark(53.5, 7.5, 6) + spark(9, 22, 4.5));
  add('diamond-ring', 'gold ring with a big diamond', s);
}
// ---------- embroidery-hoop
{
  let s = '';
  const cx = 27, cy = 34, R1 = 23.5, R0 = 19;
  const pt = (r, a) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
  const seg = (r1, r2, a1, a2) => { const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1), lg = a2 - a1 > 180 ? 1 : 0;
    return `M${f(x1)} ${f(y1)}A${f(r2)} ${f(r2)} 0 ${lg} 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${f(r1)} ${f(r1)} 0 ${lg} 0 ${f(x4)} ${f(y4)}Z`; };
  // clamp tabs + screw
  s += R('t-a', 22.5, 4.5, 4.4, 9, 1) + R('t-a', 27.4, 4.5, 4.4, 9, 1);
  s += R('t-b', 18.5, 7, 21, 2.6, 1.2);
  s += R('t-a', 37, 3.5, 4.5, 8.6, 1.6);
  s += L('M38.6 5.3V10.3M40 5.3V10.3', 1);
  s += R('t-b', 17, 5.5, 3, 5.6, 1);
  // hoop ring with highlight cut out
  const hl = seg(21.6, 22.8, 195, 245);
  s += P('t-a', circ(cx, cy, R1) + circ(cx, cy, R0) + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', seg(R0, 20.4, 0, 360 - .01).replace(/Z$/, 'Z'));
  s += P('t-b', seg(21.4, R1, 10, 150));
  s += L(circ(cx, cy, 21.3), 1);
  // fabric
  s += C('t-c', cx, cy, R0);
  // stem (running stitch) and leaves
  s += L('M27 38.5V40.5M27 43V45M27 47.5V49.5', 1.8);
  s += P('t-b', 'M26 46Q19 46 17.5 41Q23.5 40 26 46Z');
  s += P('t-b', 'M28 43Q34.5 43.5 36.5 38.5Q30.5 37.5 28 43Z');
  // flower
  const fx = 27, fy = 30;
  for (let k = 0; k < 5; k++) { const a = -90 + 72 * k, r = a * Math.PI / 180;
    s += E('t-a', fx + 5.4 * Math.cos(r), fy + 5.4 * Math.sin(r), 4.6, 3.3, a); }
  let sat = '';
  for (let k = 0; k < 5; k++) { const r = (-90 + 72 * k) * Math.PI / 180;
    sat += `M${f(fx + 3.6 * Math.cos(r))} ${f(fy + 3.6 * Math.sin(r))}L${f(fx + 7.8 * Math.cos(r))} ${f(fy + 7.8 * Math.sin(r))}`; }
  s += L(sat, 1);
  s += C('t-b', fx, fy, 3);
  // needle with eye, pointing into the fabric
  const T = [40, 24], Eo = [59.5, 4.5], ux = (Eo[0] - T[0]), uy = (Eo[1] - T[1]), ul = Math.hypot(ux, uy), nx = -uy / ul, ny = ux / ul;
  const w = 1.5, A = [T[0] + ux * .3 + nx * w, T[1] + uy * .3 + ny * w], B = [T[0] + ux * .3 - nx * w, T[1] + uy * .3 - ny * w];
  const needle = `M${f(T[0])} ${f(T[1])}L${f(A[0])} ${f(A[1])}L${f(Eo[0] + nx * w)} ${f(Eo[1] + ny * w)}A${f(w)} ${f(w)} 0 0 0 ${f(Eo[0] - nx * w)} ${f(Eo[1] - ny * w)}L${f(B[0])} ${f(B[1])}Z`;
  const eye = cap(Eo[0] - ux / ul * 4, Eo[1] - uy / ul * 4, Eo[0] - ux / ul * 1.4, Eo[1] - uy / ul * 1.4, 1);
  s += P('t-b', needle + eye, ' fill-rule="evenodd"');
  // thread looping out of the eye
  s += L('M57.5 6.5C63 10 63 20 57 22C51 24 50 16 55.5 17C61.5 18 61 30 55 36C50.5 41 57 47 60.5 44', 1.8);
  s += L('M57.5 6.5C55 9 54 10 52 10.5', 1.8);
  s += P('t-c', spark(6, 58, 3.6) + spark(56, 56, 2.6));
  add('embroidery-hoop', 'embroidery hoop with stitched flower and needle', s);
}

// ---------- pyjamas
{
  let s = '';
  const M = (p) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('') + 'Z';
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // trousers
  const tr = [[21, 30], [43, 30], [45.5, 60], [33.5, 60], [32, 41], [30.5, 60], [18.5, 60]];
  s += P('t-a', M(tr));
  let st = '';
  for (const t of [.33, .67]) {
    const a = lerp([21, 33.5], [32, 33.5], t), b = lerp([19, 56.5], [30.7, 56.5], t);
    const c = lerp([43, 33.5], [32, 33.5], t), d = lerp([45, 56.5], [33.3, 56.5], t);
    st += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}M${f(c[0])} ${f(c[1])}L${f(d[0])} ${f(d[1])}`;
  }
  s += P('t-b', M([[21.1, 30], [42.9, 30], [43.2, 33.5], [20.8, 33.5]]));
  s += P('t-b', M([[18.7, 57], [30.8, 57], [31, 60], [18.5, 60]]) + M([[33.2, 57], [45.3, 57], [45.5, 60], [33.5, 60]]));
  // shirt with collar flaps cut out
  const sh = [[22, 5], [25, 4], [39, 4], [42, 5], [60, 19], [55, 25], [43, 15], [44, 28], [20, 28], [21, 15], [9, 25], [4, 19]];
  const fl = [[25.8, 4.2], [32, 11], [25, 12.8]], fr = fl.map(([x, y]) => [64 - x, y]);
  s += P('t-a', rpoly(sh, 1.4) + M(fl) + M(fr), ' fill-rule="evenodd"');
  s += P('t-c', M(fl) + M(fr));
  s += P('t-b', M([[27.8, 4], [36.2, 4], [32, 9]]));
  s += P('t-b', M([[58, 17.4], [60, 19], [55, 25], [53, 23.4]]) + M([[6, 17.4], [4, 19], [9, 25], [11, 23.4]]));
  for (const x of [24, 40]) st += `M${x} 6.8V26.5`;
  for (const x of [28, 36]) st += `M${x} 14V26.5`;
  for (const t of [.33, .67]) {
    const a = lerp([42, 5], [43, 15], t), b = lerp([58, 17.4], [53, 23.4], t);
    st += `M${f(a[0] + 1.5)} ${f(a[1] + 1.2)}L${f(b[0] - .8)} ${f(b[1] - .6)}M${f(64 - a[0] - 1.5)} ${f(a[1] + 1.2)}L${f(64 - b[0] + .8)} ${f(b[1] - .6)}`;
  }
  s += L(st, 1.8);
  s += L('M32 11V27.5', 1.2);
  s += C('t-b', 32, 15, 1.4) + C('t-b', 32, 20, 1.4) + C('t-b', 32, 25, 1.4);
  // fluffy slippers
  const scal = (cx, cy, rx, ry, n, br) => { let d = ''; for (let i = 0; i <= n; i++) { const a = (i / n) * 2 * Math.PI, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
    d += i ? `A${br} ${br} 0 0 1 ${f(x)} ${f(y)}` : `M${f(x)} ${f(y)}`; } return d + 'Z'; };
  for (const x of [10, 54]) {
    const fluff = scal(x, 45, 6.4, 5, 7, 2.9);
    s += P('t-a', `M${x - 6} 50.5A6 10.5 0 1 0 ${x + 6} 50.5A6 10.5 0 1 0 ${x - 6} 50.5Z` + fluff, ' fill-rule="evenodd"');
    s += P('t-c', fluff);
    s += E('t-b', x, 54.8, 3.5, 4.6);
  }
  s += P('t-c', spark(7, 7, 3.6) + spark(57, 7.5, 2.8));
  add('pyjamas', 'striped pyjamas and fluffy slippers', s);
}

// ---------- handbag
{
  let s = '';
  const clasp = rpoly([[27, 40], [37, 40], [37, 47.5], [27, 47.5]], 2.2);
  const hl = 'M15.5 26.6H25Q26 26.6 26 27.5Q26 28.4 25 28.4H15.2Q14.4 28.4 14.6 27.5Q14.8 26.6 15.5 26.6Z';
  // handle
  s += P('t-a', 'M18 24.5A14 18.5 0 0 1 46 24.5H42.4A10.4 14.6 0 0 0 21.6 24.5Z');
  s += P('t-b', 'M41 12A10.4 14.6 0 0 1 42.4 24.5H46A14 18.5 0 0 0 44.4 16Z');
  // lower body and flap
  s += P('t-a', 'M9.8 36Q32 52 54.2 36L57.2 52.5Q58 57 53.5 57H10.5Q6 57 6.8 52.5Z' + clasp, ' fill-rule="evenodd"');
  s += P('t-b', 'M9.8 36Q32 52 54.2 36L54.6 38.5Q32 55.5 9.4 38.5Z' + clasp, ' fill-rule="evenodd"');
  s += P('t-b', 'M7.1 51H56.9L57.2 52.5Q58 57 53.5 57H10.5Q6 57 6.8 52.5Z');
  s += P('t-a', 'M14 24H50Q52 24 52.4 26L54.2 36Q32 52 9.8 36L11.6 26Q12 24 14 24Z' + clasp + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  // stitching
  let st = '';
  const q = (t, a, c, b) => (1 - t) * (1 - t) * a + 2 * t * (1 - t) * c + t * t * b;
  for (let t = .02; t < .97; t += .07) {
    const x1 = q(t, 12, 32, 52), y1 = q(t, 34, 48.5, 34), x2 = q(t + .04, 12, 32, 52), y2 = q(t + .04, 34, 48.5, 34);
    if (Math.abs((x1 + x2) / 2 - 32) > 6.5) st += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
  }
  for (let x = 10.5; x < 53; x += 3.6) st += `M${f(x)} 48.6H${f(x + 1.8)}`;
  s += L(st, 1);
  // clasp
  s += P('t-c', clasp);
  s += R('t-b', 30.6, 41.6, 2.8, 4.4, 1.2);
  // handle rings
  s += R('t-b', 17, 22.5, 5.5, 4.5, 1.6) + R('t-b', 41.5, 22.5, 5.5, 4.5, 1.6);
  // tassel charm
  s += L('M45 26.5Q46.5 30 47.5 32.5', 1.3);
  s += C('t-b', 47.6, 33.6, 1.9);
  s += P('t-b', 'M46.3 35H48.9L50.8 44.4L49.7 45.6L48.7 44.4L47.6 45.8L46.5 44.4L45.5 45.6L44.4 44.4Z');
  s += P('t-c', spark(8, 10, 3.8) + spark(56, 11, 3));
  add('handbag', 'handbag with clasp and tassel charm', s);
}

// ---------- hourglass
{
  let s = '';
  const ny = 32, H = 21.5;
  const w = d => { let v = 1.5 + 11.5 * Math.sin(Math.min(d * 1.25, 1) * Math.PI / 2) ** 1.6; if (d > .8) v -= 50 * (d - .8) ** 2; return v; };
  const ds = Array.from({ length: 11 }, (_, i) => i / 10);
  const pts = (d0, d1, sgnY, sgnX) => ds.filter(d => d >= d0 - 1e-9 && d <= d1 + 1e-9).map(d => [32 + sgnX * w(d), ny + sgnY * d * H]);
  const pl = p => p.map(([x, y]) => `L${f(x)} ${f(y)}`).join('');
  // glass: left wall top->neck->bottom, right wall bottom->neck->top
  const left = [...pts(0, 1, -1, -1).reverse(), ...pts(0, 1, 1, -1).slice(1)];
  const right = [...pts(0, 1, 1, 1).reverse(), ...pts(0, 1, -1, 1).slice(1)];
  const glass = 'M' + pl([...left, ...right]).slice(1) + 'Z';
  s += P('t-c', glass);
  // top sand with a dipped surface
  const ys = ny - .6 * H, ws = w(.6);
  s += P('t-a', `M${f(32 - ws)} ${f(ys)}Q32 ${f(ys + 4)} ${f(32 + ws)} ${f(ys)}` + pl(pts(0, .6, -1, 1).reverse()) + pl(pts(0, .6, -1, -1)) + 'Z');
  // trickle and heap
  s += R('t-a', 31.4, 31, 1.2, 12);
  const yb = ny + .8 * H, wb = w(.8);
  s += P('t-a', `M${f(32 - wb)} ${f(yb)}C24 ${f(yb)} 29 41.5 32 41.5C35 41.5 40 ${f(yb)} ${f(32 + wb)} ${f(yb)}` + pl(pts(.8, 1, 1, 1)) + pl(pts(.8, 1, 1, -1).reverse()) + 'Z');
  s += C('t-a', 30, 38, .7) + C('t-a', 34, 36, .7);
  s += L(glass, 1.2);
  // wooden frame
  for (const x of [13, 51]) {
    s += R('t-b', x - 1.4, 9, 2.8, 46);
    s += E('t-b', x, 16, 2.7, 2.2) + E('t-b', x, 32, 2.7, 2.6) + E('t-b', x, 48, 2.7, 2.2);
  }
  const phl = 'M10.8 5.4H21.2Q22 5.4 22 6.2Q22 7 21.2 7H10.8Q10 7 10 6.2Q10 5.4 10.8 5.4Z';
  for (const y of [4, 53.5]) {
    s += P('t-a', `M9.4 ${y}H54.6Q57 ${y} 57 ${y + 2.4}V${y + 4.1}Q57 ${y + 6.5} 54.6 ${y + 6.5}H9.4Q7 ${y + 6.5} 7 ${y + 4.1}V${y + 2.4}Q7 ${y} 9.4 ${y}Z` + (y < 10 ? phl : ''), ' fill-rule="evenodd"');
    s += P('t-b', `M7 ${y + 3.8}H57V${y + 4.1}Q57 ${y + 6.5} 54.6 ${y + 6.5}H9.4Q7 ${y + 6.5} 7 ${y + 4.1}Z`);
  }
  s += P('t-c', phl);
  s += P('t-c', spark(59, 31, 3.4) + spark(5, 38, 2.6));
  add('hourglass', 'wooden hourglass with trickling sand', s);
}

// ---------- worried-face
{
  let s = '';
  const ell = (x, y, rx, ry, deg = 0) => { const a = deg * Math.PI / 180, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
    return `M${f(x - dx)} ${f(y - dy)}A${f(rx)} ${f(ry)} ${deg} 1 0 ${f(x + dx)} ${f(y + dy)}A${f(rx)} ${f(ry)} ${deg} 1 0 ${f(x - dx)} ${f(y - dy)}Z`; };
  const eyes = ell(22, 28.5, 5, 6.2) + ell(39, 28.5, 5, 6.2);
  const hl = ell(19.5, 11, 4.5, 2, -35);
  const drop = 'M50.6 14.6Q54.7 21 54.7 24.6A3.85 3.85 0 0 1 47 24.6Q47 21 50.6 14.6Z';
  s += P('t-a', circ(32, 32, 28) + eyes + hl + drop, ' fill-rule="evenodd"');
  s += P('t-b', 'M4 32a28 28 0 1 0 56 0a28 28 0 1 0 -56 0ZM5.5 30.5a25.5 25.5 0 1 0 51 0a25.5 25.5 0 1 0 -51 0Z', ' fill-rule="evenodd"');
  s += P('t-c', eyes + hl + drop);
  // pupils with a catchlight cut out
  s += P('t-b', circ(22.6, 29.6, 2.8) + circ(39.6, 29.6, 2.8) + circ(23.5, 28.6, .9) + circ(40.5, 28.6, .9), ' fill-rule="evenodd"');
  // raised worried brows and wobbly mouth
  s += L('M14.5 18.5Q19 17.5 26 13.5M46.5 18.5Q42 17.5 35 13.5', 2.8);
  s += L('M19.5 46.5L23 43.3L26.5 46.5L30 43.3L33.5 46.5L37 43.3L40.5 46.5', 2.4);
  s += P('t-b', 'M48.9 22.2Q49.7 19.6 50.7 18Q50.1 20.2 50 22.4Z');
  add('worried-face', 'worried face with sweat drop', s);
}
// ---------- meditating-figure
{
  let s = '';
  // calm rings: open arcs that end at the folded legs
  s += L('M8.6 49A29.5 29.5 0 1 1 55.4 49', 1.6);
  s += L('M11.4 45A25 25 0 0 1 22.4 9.9M41.6 9.9A25 25 0 0 1 52.6 45', 2.2);
  // folded legs
  s += P('t-a', 'M22 41Q12 41 9.5 47.5Q8 55 16 55.5H48Q56 55 54.5 47.5Q52 41 42 41Z');
  s += P('t-b', 'M13 52.5Q24 46 37 49.5Q46 52 52 50.5Q53 55 48 55.5H16Q12.5 55.2 13 52.5Z');
  s += E('t-c', 40.5, 48.5, 4, 2.2, -12);
  // torso
  s += P('t-a', rpoly([[22.5, 26], [41.5, 26], [38.5, 45], [25.5, 45]], 5));
  s += P('t-b', 'M35.5 26H37.5Q41.5 26 41 30.5L38.7 45H35Q37.5 36 35.5 26Z');
  // neck + head
  s += R('t-a', 29.5, 21, 5, 6);
  s += C('t-a', 32, 16.5, 6.6);
  s += P('t-b', 'M25.4 16.2A6.6 6.6 0 0 1 38.6 16.2Q35 12.5 25.4 16.2Z');
  s += L('M28.2 18.2Q29.4 19.4 30.6 18.2M33.4 18.2Q34.6 19.4 35.8 18.2M30.8 21.1Q32 21.8 33.2 21.1', 1.1);
  // arms resting on knees
  s += P('t-a', limb([[24.8, 29.5], [18, 37], [12.8, 46.5]], 5.4) + limb([[39.2, 29.5], [46, 37], [51.2, 46.5]], 5.4));
  s += P('t-b', cap(46.8, 38.2, 51.6, 46.4, 1.6));
  s += C('t-c', 12.8, 46.5, 2.7);
  s += C('t-c', 51.2, 46.5, 2.7);
  s += P('t-c', spark(9, 11, 3.6) + spark(56, 12, 3));
  add('meditating-figure', 'cross-legged figure meditating inside calm rings', s);
}

// ---------- pizza-slice
{
  let s = '', g = '';
  // wavy cheese top edge, left to right (w) and right to left (wr)
  const wv = [[-20.5, -15], [-12.5, -15.5], [-4, -14.5], [4, -15], [12.5, -15], [20.5, -15]];
  let w = '', wr = '';
  for (let i = 1; i < wv.length; i++) { const a = wv[i - 1], b = wv[i]; w += `Q${f((a[0] + b[0]) / 2)} ${f(i % 2 ? -11.5 : -18.5)} ${f(b[0])} ${f(b[1])}`; }
  for (let i = wv.length - 2; i >= 0; i--) { const a = wv[i + 1], b = wv[i]; wr += `Q${f((a[0] + b[0]) / 2)} ${f((i + 1) % 2 ? -11.5 : -18.5)} ${f(b[0])} ${f(b[1])}`; }
  const leaf = (x, y, l, wd, a) => { const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180), p = (u, v) => `${f(x + u * c - v * sn)} ${f(y + u * sn + v * c)}`;
    return `M${p(-l, 0)}C${p(-l * .2, -wd * 1.25)} ${p(l * .5, -wd * .7)} ${p(l, 0)}C${p(l * .5, wd * .7)} ${p(-l * .2, wd * 1.25)} ${p(-l, 0)}Z`; };
  const basil = leaf(-0.4, -4.2, 5.4, 4.2, -60) + leaf(-6.2, 2.8, 4.8, 3.8, -10);
  g += P('t-b', `M-23 -19.5L23 -19.5L20.5 -15${wr}Z`);
  g += P('t-a', `M-20.5 -15${w}L0 22Z` + basil, ' fill-rule="evenodd"');
  g += P('t-c', basil);
  g += L('M-3 0.4L1.4 -6.8M-11.2 3.7L-3.4 2', 0.9);
  g += P('t-b', circ(-10, -6.5, 4.5) + circ(9.5, -7, 4.5) + circ(1, 7.5, 4));
  g += P('t-b', 'M20.5 -15L0 22L2.2 15.5Q11.5 0 17.5 -15Z');
  // puffy crust
  g += P('t-a', 'M-23.5 -16Q0 -20 23.5 -16A4.6 4.6 0 0 0 24 -25.2Q0 -29.5 -24 -25.2A4.6 4.6 0 0 0 -23.5 -16Z');
  g += P('t-b', 'M-23.5 -16Q0 -20 23.5 -16A4.6 4.6 0 0 0 28 -20Q0 -23.5 -28 -20A4.6 4.6 0 0 0 -23.5 -16Z');
  g += P('t-c', 'M-19 -24.5Q-7 -26.8 6 -26.3Q-7 -25.2 -18.8 -23.2Z');
  s += `<g transform="translate(26 33.5) rotate(20)">${g}</g>`;
  // stretchy cheese pull off the tip
  s += P('t-a', 'M17.8 50Q18.6 55 17.4 59.1A1.8 1.8 0 1 0 19.2 59.1Q19.3 55.5 20.3 52Z');
  s += P('t-b', 'M19.9 53.4Q19.2 56 19.2 59.1A1.8 1.8 0 0 1 18.4 62.4Q19.7 61.6 19.9 60.2Q19.7 57 19.9 53.4Z');
  s += P('t-c', spark(53, 47, 4.2) + spark(8, 11, 3.2) + circ(48, 57, 1.3));
  add('pizza-slice', 'pizza slice with pepperoni and cheese pull', s);
}

// ---------- herb-bunch
{
  let s = '';
  // leaf with its base at (x,y), pointing along angle a
  const lf = (x, y, l, wd, a) => { const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180), p = (u, v) => `${f(x + u * c - v * sn)} ${f(y + u * sn + v * c)}`;
    return `M${p(0, 0)}C${p(l * .2, -wd * .75)} ${p(l * .8, -wd * .45)} ${p(l, 0)}C${p(l * .8, wd * .45)} ${p(l * .2, wd * .75)} ${p(0, 0)}Z`; };
  // thyme (left): thin stem, tiny paired leaves
  s += L('M28 45Q18 37 6.5 26', 1.3);
  s += P('t-a', [[9, 28.5, -135], [12.5, 32, -140], [16.5, 35.2, -145], [20.5, 38, -150]].map(([x, y, a]) => lf(x, y, 4.2, 3.6, a - 55) + lf(x, y, 4.2, 3.6, a + 55)).join('') + lf(8, 27.5, 4.5, 3.6, -135));
  // rosemary (right): stem with needle leaves
  let ro = 'M33.5 46L55.5 9.5';
  for (let i = 0; i < 9; i++) { const t = i / 9, x = 34.5 + 21 * t, y = 44.5 - 35 * t, l = 5.6 - t * 2;
    ro += `M${f(x)} ${f(y)}l${f(l * .99)} ${f(l * .06)}M${f(x)} ${f(y)}l${f(l * -.5)} ${f(l * -.86)}`; }
  s += L(ro + 'l.3-3', 2);
  // basil (centre, front): broad leaves on a stem
  s += P('t-a', cap(30, 45, 28.5, 15, 2.6));
  const bs = [[28.5, 17, 14, -88, 12], [28.8, 26, 15, -150, 12], [28.8, 26, 15, -30, 12], [29.5, 36.5, 12, 175, 10], [29.5, 36.5, 12, 5, 10]];
  s += P('t-a', bs.map(([x, y, l, a, wd]) => lf(x, y, l, wd, a)).join(''));
  s += P('t-b', bs.map(([x, y, l, a, wd]) => lf(x, y, l, wd * .45, a)).join(''));
  // stems below the tie
  s += P('t-a', cap(29, 48, 25, 60, 2.4) + cap(31, 48, 31, 61, 2.4) + cap(33, 48, 37, 59.5, 2.4));
  // twine wrap and bow
  s += P('t-b', cap(26.5, 46.8, 36.5, 45.6, 5.6));
  s += L('M37 45.5C42.5 40 47.5 43 44.5 47C43 49 39.5 47.5 37 45.5Q40.5 51 43.5 56', 2);
  s += P('t-c', spark(10, 52, 3.8) + spark(51, 30, 2.8));
  add('herb-bunch', 'bunch of fresh herbs tied with twine', s);
}

// ---------- mortar-pestle
{
  let s = '';
  // pestle leaning out of the bowl
  s += P('t-a', cap(30, 26, 47, 7.5, 7.6));
  s += P('t-b', 'M48.2 3.6A3.8 3.8 0 0 1 49.8 10.1L36.4 25.6L33.5 23Q42 13 48.2 3.6Z');
  s += P('t-c', cap(38.5, 14.5, 44, 8.2, 1.6));
  // rim and heaped spice
  s += E('t-a', 25.5, 30, 19.5, 5.6);
  s += P('t-b', 'M9.5 30A16 3.8 0 0 0 41.5 30Q40 24 34.5 21.8Q30 15.5 24 16.5Q14.5 18 9.5 30Z' + circ(19, 24, 1.1) + circ(26, 21, 1) + circ(30.5, 27, 1.1), ' fill-rule="evenodd"');
  s += P('t-c', circ(19, 24, 1.1) + circ(26, 21, 1) + circ(30.5, 27, 1.1));
  // stone bowl and foot
  s += P('t-a', 'M6 30A19.5 5.6 0 0 0 45 30Q44.5 45 35.5 49.5H15.5Q6.5 45 6 30Z');
  s += P('t-b', 'M45 30Q44.5 45 35.5 49.5H30Q38.5 44 39.5 34.4Q43 33 45 30Z');
  s += P('t-a', rpoly([[13, 48.5], [38, 48.5], [40, 54.5], [11, 54.5]], 1.5));
  s += P('t-b', circ(14, 40, 1) + circ(20, 44.5, .9) + circ(24, 38.5, .8));
  s += P('t-c', 'M9.5 35Q11 42 15 46Q10 43.5 9.5 35Z');
  // star anise: eight canoe-shaped pods joined at the base (one outline: per pod a cubic out to a
  // blunt rounded prow and a mirrored 's' back to the next notch), each with a counter-wound seed
  // slit so the seed reads lighter in the tint; small dark centre on top. Deltas snap to whole
  // numbers when within 0.2 (controls) / 0.1 (points) to fit the 2500-char budget.
  {
    const cn = a => a.map(n => f(n).replace(/^(-?)0\./, '$1.')).reduce((t, x, i) => !i ? x : t + (x[0] === '-' || (x[0] === '.' && /\.\d*$/.test(t.split(/[ -]/).pop())) ? '' : ' ') + x, '');
    const sn = (n, tol) => Math.abs(n - Math.round(n)) <= tol + 1e-9 ? Math.round(n) : Math.round(n * 10) / 10;
    const ax = 54.5, ay = 31, rn = 3, u1 = 4.4, w1 = 2.9, ut = 7.5, k = .7, rs = 5, sl = 1.3, sw = .6;
    const Q = (u, v, i, o = 0) => { const a = (-66 + i * 45 - o) * Math.PI / 180, c = Math.cos(a), sa = Math.sin(a); return [ax + u * c - v * sa, ay + u * sa + v * c]; };
    let cur = Q(rn, 0, 0, 22.5).map(n => Math.round(n * 10) / 10), d = 'M' + cn(cur);
    const cmd = (c, groups) => { const nums = [];
      for (const [ctrls, end] of groups) { for (const q of ctrls) nums.push(sn(q[0] - cur[0], .2), sn(q[1] - cur[1], .2));
        const e = [sn(end[0] - cur[0], .1), sn(end[1] - cur[1], .1)]; nums.push(...e); cur = [cur[0] + e[0], cur[1] + e[1]]; }
      d += c + cn(nums); };
    for (let i = 0; i < 8; i++) { cmd('c', [[[Q(u1, -w1, i), Q(ut, -k, i)], Q(ut, 0, i)]]); cmd('s', [[[Q(u1, w1, i)], Q(rn, 0, i + 1, 22.5)]]); }
    for (let i = 0; i < 8; i++) cmd('m', [[[], Q(rs - sl, 0, i)], [[], Q(rs, sw, i)], [[], Q(rs + sl, 0, i)], [[], Q(rs, -sw, i)]]);
    s += P('t-a', d);
    s += C('t-b', ax, ay, 1.3);
  }
  // cinnamon stick
  s += P('t-a', cap(4.5, 59, 26, 57.6, 5.8));
  s += L('M10 56.3V61.5M17 55.9V61', 1);
  s += E('t-b', 26, 57.6, 2.3, 2.9);
  // red chili
  s += P('t-a', 'M55 46.5C48 46.5 42 52 38.5 61C45 59 53 57.5 57.5 52.5Q59 48 55 46.5Z');
  s += P('t-b', 'M38.5 61C45 59 53 57.5 57.5 52.5Q55.5 57 45.5 59.3Z');
  s += P('t-c', 'M52 48.5Q46 50 42.5 55Q46.5 51.5 52.5 49.6Z');
  s += P('t-b', 'M53.5 46Q58.5 44.5 60 48.5Q60.5 52 57.5 53Q58 48.5 53.5 46Z' + cap(58.5, 47, 61, 42.5, 1.8));
  s += P('t-c', spark(9, 10, 3.8));
  add('mortar-pestle', 'mortar and pestle heaped with spice', s);
}

// ---------- cheese-wedge
{
  let s = '';
  // top face, front cut face, pale rind end
  s += P('t-a', 'M4 26.6L43 31.2L57.5 14.5Q38 12.5 4 26.6Z');
  s += P('t-a', 'M4 28.6L43 33.4V59.5L4 42V38.2A3.2 3.2 0 0 0 4 31.8Z');
  s += P('t-c', 'M44.5 33.2L58.5 16.4Q62 31 58.5 46L44.5 59.4Z');
  s += P('t-b', 'M44.5 33.2L58.5 16.4Q59.2 19.5 59.6 23L44.5 39Z');
  // holes
  s += P('t-b', circ(14.5, 40, 3.2) + circ(28, 44, 4.6) + circ(36.5, 53, 2.7) + circ(37.5, 39.5, 2.4) + circ(20.8, 44.6, 1.7) + circ(39.6, 47.4, 2.1));
  s += E('t-b', 29, 22.5, 4.4, 1.7, -10);
  s += E('t-b', 44.5, 19.8, 2.8, 1.2, -12);
  s += E('t-b', 16.5, 25.4, 2.4, 1, -10);
  s += P('t-b', 'M4 40L43 55.5V59.5L4 42Z');
  s += P('t-c', spark(12, 11, 4.2) + spark(56.5, 56.5, 3) + circ(24, 7.5, 1.3));
  add('cheese-wedge', 'wedge of holey cheese with a pale rind', s);
}
// ---------- soup-bowl
{
  let s = '';
  const ell = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
  // steam
  s += L('M17 17C14 14 20 11.5 17 7.5M27 15C24 12 30 9.5 27 5.5M37 17C34 14 40 11.5 37 7.5', 2.2);
  // bowl body + rim, with a cut-out highlight
  const hl = 'M8.6 38.5C9.6 44 12.5 48 17 51C14.6 48 12.3 44.5 11.4 39.6Z';
  s += P('t-a', 'M4 31A27 10 0 0 1 58 31C58 48 45 56.5 31 56.5C17 56.5 4 48 4 31Z' + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  s += P('t-b', 'M57.7 33.5C57 48 45 56.5 31 56.5C43 53 50.5 46 52.5 38.5Q56 36.5 57.7 33.5Z');
  s += L('M4.6 32.8A27 10 0 0 0 57.4 32.8', 1.3);
  s += P('t-b', rpoly([[20, 54.5], [42, 54.5], [43.5, 59.5], [18.5, 59.5]], 1.4));
  // soup with a cream swirl cut out
  const sw = (() => {
    const cx = 27, cy = 31, ky = .42, n = 15, T = 2.15 * Math.PI, o = [], i = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n * T, r = 1 + 2.05 * t, w = .8 + 1.3 * (k / n), a = t + .4;
      o.push([cx + (r + w) * Math.cos(a), cy + (r + w) * Math.sin(a) * ky]);
      i.push([cx + (r - w) * Math.cos(a), cy + (r - w) * Math.sin(a) * ky]);
    }
    const pts = o.concat(i.reverse());
    return 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
  })();
  const dots = circ(44, 34, 1.1) + circ(40, 36.2, .9) + circ(13.5, 33.5, .9);
  s += P('t-b', ell(31, 31, 23.5, 7.5) + sw + dots, ' fill-rule="evenodd"');
  s += P('t-c', sw + dots);
  // spoon handle rising out of the soup, highlight cut out
  const hh = cap(50, 21.6, 56.3, 12.6, 1.4);
  s += P('t-b', cap(46.5, 27.5, 57.5, 11.5, 4.8) + hh, ' fill-rule="evenodd"');
  s += P('t-c', hh);
  s += P('t-c', spark(8, 11, 3.4) + spark(48, 5, 2.6));
  add('soup-bowl', 'steaming bowl of soup with a spoon', s);
}

// ---------- salad-bowl
{
  let s = '';
  const pt = (x, y) => f(x) + ' ' + f(y);
  // heap: dome + leaves, all wound the same way so overlaps stay solid
  let la = 'M57 41A25 24 0 0 0 7 41Z', veins = '';
  const leaf = (bx, by, tx, ty, w, ch) => {
    const dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy), nx = -dy / l * w, ny = dx / l * w, q = (u, v) => pt(bx + dx * u + nx * v, by + dy * u + ny * v);
    la += `M${q(0, 0)}C${q(.25, 1)} ${q(.75, .8)} ${q(1, 0)}C${q(.75, -.8)} ${q(.25, -1)} ${q(0, 0)}Z`;
    veins += `M${q(.35, 0)}L${q(.86, 0)}` + (ch ? `M${q(.6, .45)}L${q(.48, 0)}L${q(.6, -.45)}M${q(.78, .32)}L${q(.68, 0)}L${q(.78, -.32)}` : '');
  };
  leaf(24, 38, 4.5, 25, 7, 0); leaf(26.5, 33, 9.5, 12, 8.5, 1); leaf(32, 31, 32.5, 4, 8.5, 1); leaf(37.5, 33, 54.5, 13, 8, 1); leaf(40, 38, 59.5, 26, 7, 0);
  s += P('t-a', la);
  s += L(veins, 1.2);
  // crossed servers: spoon up-left, fork up-right; lower ends hidden by the salad
  const ax = (bx, by, ux, uy) => (d, o) => pt(bx + ux * d - uy * o, by + uy * d + ux * o);
  const a = ax(36.5, 34, -.627, -.779), b = ax(27.5, 34, .627, -.779);
  const sh = `M${a(21, -.8)}Q${a(24, -3.4)} ${a(27, -.8)}Q${a(24, -1.2)} ${a(21, -.8)}Z`;
  s += P('t-b', `M${a(0, 1.2)}L${a(19.5, .9)}A4.4 3.1 51 1 0 ${a(19.5, -.9)}L${a(0, -1.2)}Z` + sh, ' fill-rule="evenodd"');
  let fk = `M${b(0, 1.2)}L${b(16.5, .9)}L${b(19.5, 3.3)}`;
  [[3.3, 1.85], [.7, -.7], [-1.85, -3.3]].forEach(([o1, o2], k) => { fk += (k ? `L${b(21.5, o1)}` : '') + `L${b(26.5, o1)}L${b(26.5, o2)}` + (k < 2 ? `L${b(21.5, o2)}` : ''); });
  fk += `L${b(19.5, -3.3)}L${b(16.5, -.9)}L${b(0, -1.2)}Z`;
  s += P('t-b', fk);
  s += P('t-c', sh);
  // tomato halves (shine cut out), cucumber rounds, croutons
  const ts = circ(11.4, 36, 1) + circ(30.6, 34.8, 1.1) + circ(52.6, 36, 1), cu = circ(21.5, 37.5, 2.6) + circ(42.5, 37.5, 2.6);
  s += P('t-b', circ(12.8, 37.4, 4.2) + circ(32, 36.4, 4.6) + circ(51.2, 37.4, 4.2) + ts + circ(21.5, 37.5, 3.7) + circ(42.5, 37.5, 3.7) + cu
    + 'M22 29l4.4-.6.6 4.4-4.4.6ZM37.2 28.6l4.4.6-.6 4.4-4.4-.6Z', ' fill-rule="evenodd"');
  s += P('t-c', ts + cu);
  // bowl
  const bh = 'M10 46C11.5 51 15 54 19.5 56C16.5 53.5 14 50 13 46Z';
  s += P('t-a', 'M6 43H58C57 53 47 58 32 58C17 58 7 53 6 43Z' + bh, ' fill-rule="evenodd"');
  s += P('t-c', bh);
  s += P('t-b', 'M57.6 46C56 54 47 58 32 58C43.5 56 50.5 51.5 53 46Z');
  s += R('t-b', 3, 40, 58, 4.6, 2.3);
  s += R('t-b', 23, 56.5, 18, 3.5, 1.5);
  s += P('t-c', spark(6, 9, 3.2) + spark(58, 6, 2.6));
  add('salad-bowl', 'bowl of leafy salad with servers', s);
}

// ---------- spaghetti
{
  let s = '';
  const pt = (x, y) => f(x) + ' ' + f(y);
  // pasta heap with noodle lines
  s += P('t-a', 'M7 44C6 39 9 36 13 36C14 33 19 31.5 24 32.5C28 30.5 36 30.5 40 32.5C45 31.5 50 33 51 36C55 36 58 39 57 44Z');
  s += L('M9.5 42.5Q12 38 16 41T23 40.5M41 42Q44 37.5 48 40.5T55 41M11 39Q14 36 18.5 37.5M47 36.5Q51 35.5 54 38.5M15 43.5Q20 41 25 43', 1.3);
  // tomato sauce with a gap round the meatball; basil leaf cut from the meatball
  const gap = circ(40.5, 34.5, 6.4), bas = 'M36.5 32.6Q40 28.8 44.5 31.4Q40.5 34.2 36.5 32.6Z';
  s += P('t-b', 'M19 37.5C19 33 26 32 31 33C37 31 47 32 49 36.5C50 39.5 46.5 39 44.5 41C42.5 43 40 39.5 37 40.5C34 41.5 32 38.5 29 40.5C26 42.5 24 39.5 21.5 40.5C19.5 41.2 19 39.5 19 37.5Z' + gap, ' fill-rule="evenodd"');
  s += P('t-b', circ(40.5, 34.5, 5.4) + bas, ' fill-rule="evenodd"');
  s += P('t-c', bas);
  // shallow bowl
  const bh = 'M10.5 48.5C12 53 15.5 55.5 19.5 57C16.5 55 14.5 52 13.5 48.5Z';
  s += P('t-a', 'M5.5 46H58.5C57 55 47 59.5 32 59.5C17 59.5 7 55 5.5 46Z' + bh, ' fill-rule="evenodd"');
  s += P('t-c', bh);
  s += P('t-b', 'M58 48.5C55.5 56 46 59.5 32 59.5C43.5 58 51 54 53 48.5Z');
  s += R('t-b', 2.5, 42.5, 59, 4.6, 2.3);
  // fork: handle up to the right, tines down into the twirl
  const C = [25, 23], u = [-.643, .766], n = [.766, .643], at = (d, o) => [C[0] + u[0] * d + n[0] * o, C[1] + u[1] * d + n[1] * o];
  const hl = cap(...at(-26, .5), ...at(-19, .3), 1);
  let fk = `M${pt(...at(-6, 4.2))}L${pt(...at(-12, 4.2))}Q${pt(...at(-15, 4))} ${pt(...at(-16, 1.2))}L${pt(...at(-25.5, 2.5))}A2.5 2.5 0 0 0 ${pt(...at(-25.5, -2.5))}L${pt(...at(-16, -1.2))}Q${pt(...at(-15, -4))} ${pt(...at(-12, -4.2))}L${pt(...at(-6, -4.2))}`;
  [-2.1, 0, 2.1].forEach(o => { fk += `L${pt(...at(-6, o - .7))}L${pt(...at(-10, o - .7))}L${pt(...at(-10, o + .7))}L${pt(...at(-6, o + .7))}`; });
  s += P('t-b', fk + 'Z' + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  // strands hanging from the twirl, then the twirl
  s += L('M20 27Q16.5 30 19 32.5T17.5 36M24.5 29Q22.5 32 25 34.5M29 28Q30.5 31 28.5 34', 1.6);
  s += E('t-a', C[0], C[1], 10, 6.8, 40);
  s += L(`M${pt(...at(-3, -8.5))}Q${pt(...at(-6, 0))} ${pt(...at(-2, 8.5))}M${pt(...at(1.5, -9.2))}Q${pt(...at(-1.5, 0))} ${pt(...at(2.5, 8.8))}M${pt(...at(5, -6.5))}Q${pt(...at(3, 1))} ${pt(...at(5.5, 5.5))}`, 1.3);
  s += P('t-c', spark(9, 9, 3.4) + spark(55, 26, 2.6));
  add('spaghetti', 'fork twirling spaghetti over a bowl', s);
}

// ---------- barbecue-grill
{
  let s = '';
  // legs and rack
  s += P('t-b', cap(16, 44, 9.5, 60, 3) + cap(48, 44, 54.5, 60, 3) + cap(32, 48, 32, 60, 3));
  s += L('M12.5 53.5H51.5', 1.6);
  // lid propped open on the left hinge (closed dome rotated up)
  const rot = (x, y) => { const a = 32 * Math.PI / 180, dx = x - 10, dy = y - 32; return f(10 + dx * Math.cos(a) + dy * Math.sin(a)) + ' ' + f(32 - dx * Math.sin(a) + dy * Math.cos(a)); };
  const lh = `M${rot(17, 27.5)}Q${rot(21, 23)} ${rot(28, 22)}Q${rot(21, 25)} ${rot(19, 28.5)}Z`;
  s += P('t-a', `M${rot(10, 31)}C${rot(10, 20)} ${rot(22, 18)} ${rot(32, 18)}C${rot(42, 18)} ${rot(54, 20)} ${rot(54, 31)}Z` + lh, ' fill-rule="evenodd"');
  s += P('t-c', lh);
  s += P('t-b', cap(...rot(10, 31).split(' ').map(Number), ...rot(54, 31).split(' ').map(Number), 3) + circ(...rot(32, 15.4).split(' ').map(Number), 2.6));
  // kettle bowl
  const bh = 'M13.5 38C14.5 42.5 18 46 22.5 47.5C19 45 16.5 42 16 38Z';
  s += P('t-a', 'M9.5 32A22.5 5.8 0 0 0 54.5 32C54.5 43 45 50 32 50C19 50 9.5 43 9.5 32Z' + bh, ' fill-rule="evenodd"');
  s += P('t-c', bh);
  s += P('t-b', 'M54.3 34.5C53.5 44 45 50 32 50C42 47.5 48.5 42 50 36Z' + circ(32, 46, 1.6));
  // open top: pale glow, grate, food
  s += E('t-c', 32, 32, 22.5, 5.8);
  s += L('M14 29.5H50M12 32H52M14 34.5H50', 1);
  s += L('M9.5 32A22.5 5.8 0 0 0 54.5 32A22.5 5.8 0 0 0 9.5 32', 1.8);
  const sl = cap(17.5, 28.6, 25, 28.6, .9) + cap(20, 33, 28.5, 33, .9) + 'M39.5 31.5L42.5 28.5L43.5 29L40.5 32ZM43.5 32.5L46.5 29.5L47.5 30L44.5 33Z';
  s += P('t-b', cap(15, 29.5, 29, 29.5, 4.2) + cap(17.5, 34, 31.5, 34, 4.2) + `M37 31A7 4.2 0 0 0 51 31A7 4.2 0 0 0 37 31Z` + sl, ' fill-rule="evenodd"');
  s += P('t-c', sl);
  // smoke
  s += L('M40 22C37 18 43 15.5 40 11.5M47 22C44 18 50 15.5 47 11.5M54 20C51 16 57 13.5 54 9.5', 2.2);
  s += P('t-c', spark(58, 26, 2.6) + spark(4, 46, 3));
  add('barbecue-grill', 'kettle barbecue with sausages and smoke', s);
}

// ---------- greenhouse
{
  let s = '';
  const leaf = (x, y, l, w, a) => {
    const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180), p = (u, v) => f(x + u * c - v * sn) + ' ' + f(y + u * sn + v * c);
    return `M${p(0, 0)}Q${p(l / 2, -w)} ${p(l, 0)}Q${p(l / 2, w)} ${p(0, 0)}Z`;
  };
  // glass panes (glints cut out) = holes in the frame
  const panes = 'M9.2 29L31 9.4V29ZM33 9.4L54.8 29H33Z' + [[8, 19], [21, 31], [33, 43], [45, 56]].map(([a, b]) => `M${a} 31.5H${b}V41H${a}ZM${a} 43H${b}V52H${a}Z`).join('');
  const gl = 'M23 37L27 33H28.5L24.5 37ZM35 38L40 33H41.5L36.5 38ZM36 26L41 21H42.5L37.5 26ZM47 48L51 44H52.5L48.5 48Z';
  s += P('t-c', panes + gl, ' fill-rule="evenodd"');
  // tomato plant on the left
  s += P('t-a', cap(16, 52, 17, 24, 2) + leaf(16, 48, 9, 3.6, -165) + leaf(16.3, 42, 11, 4, -20) + leaf(16.6, 35, 9.5, 3.6, -160) + leaf(16.8, 29, 11, 3.8, -28) + leaf(17, 25, 5, 2.4, -110));
  s += P('t-b', circ(22, 47, 2.8) + circ(11.5, 39.5, 2.7) + circ(25, 35.5, 2.5) + circ(12, 27.5, 2.2));
  // seedlings in a tray on the right
  let sp = '';
  [38, 44, 50].forEach((x, k) => { const h = k % 2 ? 9 : 7.5; sp += cap(x, 48, x, 48 - h, 1.5) + leaf(x, 48 - h, 5.6, 2.4, -150) + leaf(x, 48 - h, 5.6, 2.4, -30); });
  s += P('t-a', sp);
  s += R('t-b', 34.5, 47, 21, 5.5, 1);
  // white frame (outer shape with the panes as holes)
  s += P('t-b', 'M2.5 31L32 4.5L61.5 31H58V60H6V31Z' + panes, ' fill-rule="evenodd"');
  s += P('t-c', spark(55, 9, 3.4) + spark(8, 14, 2.6));
  add('greenhouse', 'glass greenhouse with tomato plant and seedlings', s);
}
// ---------- clipped-hedge
{
  let s = '';
  // leaf: lens shape from (x,y), length l, angle a (deg)
  const leaf = (x, y, l, a) => { const r = a * Math.PI / 180, c = Math.cos(r), n = Math.sin(r), w = l * .32;
    return `M${f(x)} ${f(y)}q${f(l / 2 * c + w * n)} ${f(l / 2 * n - w * c)} ${f(l * c)} ${f(l * n)}q${f(-l / 2 * c - w * n)} ${f(-l / 2 * n + w * c)} ${f(-l * c)} ${f(-l * n)}Z`; };
  // bumpy foliage ball
  const bush = (cx, cy, r, k, b) => { let d = ''; for (let i = 0; i <= k; i++) { const a = (i / k) * 2 * Math.PI - Math.PI / 2, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); d += i ? `A${f(b)} ${f(b)} 0 0 1 ${f(x)} ${f(y)}` : `M${f(x)} ${f(y)}`; } return d + 'Z'; };
  s += P('t-b', 'M3 55.5H61Q62 55.5 62 57Q62 58.5 61 58.5H3Q2 58.5 2 57Q2 55.5 3 55.5Z');
  // little trunks under the foliage
  s += P('t-b', 'M14 50h2.4v6h-2.4ZM30 50h2.4v6h-2.4ZM46 50h2.4v6h-2.4Z');
  // hedge: top face (light), front face with leafy bumpy bottom and left edge, end face
  s += P('t-c', 'M4 33L9 28.5H59.5L54.5 33Z');
  let fr = 'M4 33H54.5V50.5';
  for (let i = 0; i < 8; i++) fr += 'a3.2 2.6 0 0 1-6.3 0';
  fr += 'a3 3 0 0 1 0-5.8a3 3 0 0 1 0-5.8Z';
  s += P('t-a', fr);
  s += P('t-b', 'M54.5 33L59.5 28.5V46L54.5 50.5Z');
  let sc = '';
  for (let r = 0; r < 3; r++) { sc += `M${8 + (r % 2) * 5} ${37 + r * 4.6}`; for (let x = 8 + (r % 2) * 5; x < 48; x += 10) sc += 'a3 2.4 0 0 0 6 0m4 0'; }
  s += L(sc, 1.3);
  // topiary ball finial at the left end
  s += P('t-b', cap(12.5, 29, 12.5, 23, 3.2));
  const hl = 'M8 14.5Q9.5 10.5 13.5 9.6Q10.9 12.4 10.2 15.6Z';
  s += P('t-a', bush(12.5, 16, 7.4, 9, 3) + hl, ' fill-rule="evenodd"');
  s += P('t-b', 'M20.5 17.5A8 8 0 0 1 7.5 23Q15.5 24 20.5 17.5Z');
  s += P('t-c', hl);
  // long-handled shears
  const g = [];
  const bl = (m) => `M3 ${f(-2.6 * m)}L-16 ${f(-2.4 * m)}Q-20.5 ${f(-1.8 * m)} -20 ${m}L3 ${f(1.4 * m)}Z`;
  g.push(`<g transform="rotate(-9)">${P('t-a', bl(-1))}</g>`);
  g.push(`<g transform="rotate(9)">${P('t-a', bl(1))}${P('t-b', 'M3 1.4L-20 1Q-20.3 0 -19.6 -.6L3 -.2Z')}</g>`);
  for (const a of [9, -9]) g.push(`<g transform="rotate(${a})">${P('t-b', cap(5, 0, 16.5, 0, 4.6))}${P('t-a', cap(16, 0, 23.5, 0, 5))}</g>`);
  g.push(P('t-b', circ(0, 0, 3) + circ(0, 0, 1.2), ' fill-rule="evenodd"'));
  s += `<g transform="translate(37 22) rotate(-36)">${g.join('')}</g>`;
  // clippings flying off
  s += P('t-a', leaf(19.5, 27, 4.4, -40) + leaf(28, 8, 4, 200) + leaf(22, 4, 3.8, 30));
  s += P('t-c', spark(57, 23, 3.5) + spark(4, 5, 3));
  add('clipped-hedge', 'boxy clipped hedge with topiary ball and shears', s);
}

// ---------- compost-bin
{
  let s = '';
  const leaf = (x, y, l, a) => { const r = a * Math.PI / 180, c = Math.cos(r), n = Math.sin(r), w = l * .32;
    return `M${f(x)} ${f(y)}q${f(l / 2 * c + w * n)} ${f(l / 2 * n - w * c)} ${f(l * c)} ${f(l * n)}q${f(-l / 2 * c - w * n)} ${f(-l / 2 * n + w * c)} ${f(-l * c)} ${f(-l * n)}Z`; };
  // open banana peel: a neck and four tongues, one outline. Its top contour (left tip, neck, right tip)
  // is shared with the heap so the peel lies over the top of the heap and is cut cleanly out of it.
  const cx = 21, cy = 19, F = [[6, 11.5, 2.3, 7], [64, 10.5, 2.1, 1.5], [116, 10.5, 2.1, 1.5], [174, 11.5, 2.3, 7]], notch = [36, 90, 144];
  const pt = (x, y) => `${f(cx + x)} ${f(cy + y)}`, pol = (a, r) => [r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)];
  const seg = F.map(([a, L, w, dr], i) => {
    const u = pol(a, 1), n = [-u[1], u[0]], M = [u[0] * L * .55, u[1] * L * .55], T = [u[0] * L, u[1] * L + dr];
    const t = [T[0] - M[0], T[1] - M[1]], tl = Math.hypot(...t), tu = [t[0] / tl, t[1] / tl], tn = [-tu[1], tu[0]];
    return [`Q${pt(M[0] - n[0] * w, M[1] - n[1] * w)} ${pt(T[0] - tn[0] * w * .8, T[1] - tn[1] * w * .8)}`,
      `Q${pt(T[0] + tu[0] * w * 1.6, T[1] + tu[1] * w * 1.6)} ${pt(T[0] + tn[0] * w * .8, T[1] + tn[1] * w * .8)}`,
      `Q${pt(M[0] + n[0] * w, M[1] + n[1] * w)} ${pt(...(i < 3 ? pol(notch[i], 2.3) : pol(190, 2.2)))}`];
  });
  const lp = seg[3][1].split(' ').slice(-2).join(' ');
  const top = seg[3][2] + `L${pt(-1.5, -4)}Q${pt(0, -5)} ${pt(1.5, -4)}L${pt(...pol(-10, 2.2))}` + seg[0][0];
  const pe = `M${lp}${top}${seg[0][1]}${seg[0][2]}${seg[1].join('')}${seg[2].join('')}${seg[3][0]}${seg[3][1]}Z`;
  s += R('t-b', 3, 57.5, 58, 3, 1.5);
  // leaf and apple core poking out behind the heap
  s += P('t-a', leaf(12.5, 22, 9, -122));
  s += P('t-a', 'M35 13C34 9.6 36 8.2 39 8.7C42 8.2 44 9.6 43 13ZM43 20C44 23.4 42 25 39 24.6C36 25 34 23.4 35 20Z');
  s += P('t-c', 'M35 13H43A3.9 3.9 0 0 0 43 20H35A3.9 3.9 0 0 0 35 13Z');
  s += P('t-b', cap(39, 9, 39.6, 4.5, 1.5) + 'M38.2 15.6q.8-1.8 1.6 0q-.8 1.8-1.6 0Z' + leaf(39.8, 6, 5, -20));
  // heap under the peel, crumbs cut out
  const cr = 'M38.5 28h1.2v1.2h-1.2Zm6.5-1.5h1.2v1.2h-1.2Z';
  s += P('t-b', `M7.5 33Q4 31.5 5.5 28L${lp}${top}Q36 23.4 39 23.6Q43 23.6 45 26.5Q48 27.5 48 33Z` + pe + cr, ' fill-rule="evenodd"');
  s += P('t-a', pe) + P('t-c', cr);
  s += P('t-b', cap(21, 14.6, 21.8, 11, 2.6));
  // friendly worm peeking over the rim
  s += P('t-a', limb([[52, 36], [52.6, 28.5], [50.5, 24]], 6) + circ(50.4, 21.4, 4.2));
  s += P('t-b', circ(48.7, 20.7, 1) + circ(52.3, 20.3, 1));
  s += L('M48.7 23.4Q50.6 24.9 52.6 23M49.8 29.2Q52.6 30.6 55.4 28.8', 1.2);
  // slatted bin: compost with pale crumbs in the gaps between the boards
  const g = 'M9 36.7h46v3.6H9Zm0 7h46v3.6H9Zm0 7h46v3.6H9Z';
  s += P('t-c', g);
  s += P('t-b', g + 'M15 37.9h1.2v1.2h-1.2Zm13 .4h1.2v1.2h-1.2Zm13-.6h1.2v1.2h-1.2ZM21 45h1.2v1.2h-1.2Zm14-.4h1.2v1.2h-1.2ZM14 52h1.2v1.2h-1.2Zm14 .3h1.2v1.2h-1.2Zm13-.4h1.2v1.2h-1.2Z', ' fill-rule="evenodd"');
  s += P('t-a', 'M9 33h46v4H9Zm0 7h46v4H9Zm0 7h46v4H9Zm0 7h46v3.8H9Z');
  s += P('t-b', 'M6.5 59V31.5a2.25 2.25 0 0 1 4.5 0V59ZM53 59V31.5a2.25 2.25 0 0 1 4.5 0V59Z');
  s += P('t-c', spark(57, 10, 4));
  add('compost-bin', 'slatted compost bin with scraps and a worm', s);
}

// ---------- bird-feeder
{
  let s = '';
  // shepherd's-crook hook pole
  s += P('t-b', 'M51 61.5Q51 59.5 57 59.5Q63 59.5 63 61.5Z');
  s += L('M57 60V13a8.5 8.5 0 0 0-17 0v1.5', 3);
  // hanger wire, roof, base
  s += L('M40 14v4', 1.4);
  s += P('t-b', 'M28.5 20.5Q30 12.5 40 12.5Q50 12.5 51.5 20.5Z' + rpoly([[27.5, 19.5], [52.5, 19.5], [52.5, 22.5], [27.5, 22.5]], 1.2));
  // seed-filled tube with a glass shine cut out and seeds
  const hl = cap(35.6, 25, 35.6, 46, 1.6);
  s += P('t-a', 'M33 22.5H47V50H33Z' + hl, ' fill-rule="evenodd"');
  s += P('t-c', hl);
  let sd = '';
  for (let r = 0; r < 7; r++) for (let x = 39.5 + (r % 2) * 2.6; x < 46; x += 5.2) sd += `M${f(x)} ${f(26 + r * 3.4)}q1-1 2 0q-1 1-2 0Z`;
  s += P('t-b', sd);
  s += P('t-b', rpoly([[31, 49.5], [49, 49.5], [47.5, 54], [32.5, 54]], 1.2) + circ(40, 55.2, 1.6));
  // ports and perch pegs
  s += P('t-b', circ(35, 40.5, 2) + circ(45, 30, 2) + cap(17, 49.6, 34, 49.6, 2.2) + cap(45, 34.5, 53, 34.5, 2.2));
  // round songbird perched, facing right, pecking at the port
  const belly = 'M15.5 43.5Q19 47.6 24.5 46Q21 46 18.5 43Z';
  s += P('t-a', 'M14 38L6 32.5L8.6 37.2L5.4 40L14 42.5Z' + 'M12.5 42A8.4 7 0 0 1 23 33.5A5 5 0 1 1 29.6 40Q28 47.5 20.5 47.5Q14 47.5 12.5 42Z' + belly, ' fill-rule="evenodd"');
  s += P('t-c', belly);
  s += P('t-b', 'M13.5 39.5Q17 35.5 22.5 38Q21.5 42.5 16 43Q14 42 13.5 39.5Z' + circ(26.6, 35.8, 1.1) + 'M29.2 37.4L34 40L29 41Z');
  s += L('M19.5 47v2.2M22.5 47v2.2', 1.2);
  // dropped seeds
  s += P('t-a', circ(28, 58.5, .9) + circ(34, 60.5, .9) + circ(41, 59, .9) + circ(23, 61, .8));
  s += P('t-c', spark(9, 11, 4) + spark(20, 4, 2.6));
  add('bird-feeder', 'hanging tube bird feeder with perched songbird', s);
}

// ---------- garden-shed
{
  let s = '';
  const wy = x => 15.5 + .196 * (x - 2.5);
  s += R('t-b', 1.5, 58, 61, 3, 1.5);
  // plank walls
  s += P('t-a', `M5 ${f(wy(5))}L47 ${f(wy(47))}V57H5Z`);
  let pl = '';
  for (let x = 9; x < 46; x += 6.5) pl += `M${f(x)} ${f(wy(x) + 1)}V54`;
  s += L(pl, 1.2);
  s += P('t-b', 'M4 54H48V58H4Z');
  // pent roof sloping down to the right
  const rh = 'M4 12.6L49 20.8V21.8L4 13.6Z';
  s += P('t-b', 'M2 11Q1.5 11 1.5 12V14.5Q1.5 15.6 2.6 15.8L51 24.6Q52 24.7 52 23.6V21.4Q52 20.6 51 20.4Z' + rh, ' fill-rule="evenodd"');
  s += P('t-c', rh);
  // door with latch, shackle loop and padlock cut out
  const lt = 'M18 37.4H25V39.6H18Z', ar = 'M19.8 37.4A2 2 0 0 1 23.8 37.4H22.5A.7 .7 0 0 0 21.1 37.4Z',
    pk = 'M18.8 42.2H19.8V39.6H21.1V42.2H22.5V39.6H23.8V42.2H24.8V47Q24.8 47.8 24 47.8H19.6Q18.8 47.8 18.8 47Z';
  s += P('t-b', rpoly([[10, 26.5], [25, 26.5], [25, 54], [10, 54]], [1.2, 1.2, 0, 0]) + lt + ar + pk, ' fill-rule="evenodd"');
  s += P('t-c', ar + pk) + P('t-a', lt);
  s += P('t-b', circ(21.8, 44.3, .9) + 'M21.4 44.5h.8v2h-.8Z');
  // four-pane window
  const pn = 'M32 30.5h4.8v4.4h-4.8ZM39.2 30.5h4.8v4.4h-4.8ZM32 37.3h4.8v4.4h-4.8ZM39.2 37.3h4.8v4.4h-4.8Z';
  s += P('t-b', 'M30 28.5H46V43.7H30Z' + pn + 'M29 43.5H47V45.5H29Z', ' fill-rule="evenodd"');
  s += P('t-c', pn);
  // rake (tines up) and spade leaning on the side
  s += P('t-b', cap(60, 59, 56, 13, 2.2) + rpoly([[49.5, 11.5], [62, 12.4], [61.9, 14.6], [49.4, 13.7]], .8));
  s += L('M50.5 12.2V7.5M53.3 12.4V7.7M56.1 12.6V7.9M58.9 12.8V8.1M61.4 13V8.4', 1.5);
  s += P('t-b', cap(49.6, 22.5, 53.4, 48, 2.2) + circ(49.2, 19.8, 3) + circ(49.2, 19.8, 1.4), ' fill-rule="evenodd"');
  const sh = 'M51.6 50.5L53.2 50.3L54 56.4L52.5 56.6Z';
  s += P('t-a', rpoly([[49.8, 47.5], [56.8, 46.5], [58.2, 56], [54.8, 59.5], [51.6, 57.5]], [1, 1, 1.4, 1, 1.4]) + sh, ' fill-rule="evenodd"');
  s += P('t-c', sh);
  s += P('t-c', spark(34, 6.5, 3.8));
  add('garden-shed', 'plank shed with pent roof, padlock and tools', s);
}

// ---------- raised-bed
{
  let s = '';
  const bush = (cx, cy, r, k, b) => { let d = ''; for (let i = 0; i <= k; i++) { const a = (i / k) * 2 * Math.PI - Math.PI / 2, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); d += i ? `A${f(b)} ${f(b)} 0 0 1 ${f(x)} ${f(y)}` : `M${f(x)} ${f(y)}`; } return d + 'Z'; };
  const leaf = (x, y, l, a, k = .24) => { const r = a * Math.PI / 180, c = Math.cos(r), n = Math.sin(r), w = l * k;
    return `M${f(x)} ${f(y)}q${f(l / 2 * c + w * n)} ${f(l / 2 * n - w * c)} ${f(l * c)} ${f(l * n)}q${f(-l / 2 * c - w * n)} ${f(-l / 2 * n + w * c)} ${f(-l * c)} ${f(-l * n)}Z`; };
  const lx = [12.5, 32, 51.5], cx = [22.25, 41.75], cy = 30.6, rr = 6.6, hw = Math.sqrt(rr * rr - (31.5 - cy) ** 2);
  s += R('t-b', 2, 57.5, 60, 3, 1.5);
  // back rim plank
  s += P('t-a', 'M6 28.5H58V31.5H6Z');
  // three solid fronds on each carrot
  s += P('t-b', cx.map(x => leaf(x - .6, 32, 13, -124) + leaf(x, 32, 17, -90) + leaf(x + .6, 32, 13, -56)).join(''));
  // soil with the lettuce bases and carrot shoulders cut out
  let hol = '';
  for (const x of lx) hol += `M${f(x - hw)} 31.5A${rr} ${rr} 0 0 0 ${f(x + hw)} 31.5Z`;
  const cr = cx.map(x => `M${f(x - 2.2)} 37.6L${f(x - 3)} 33.6Q${f(x - 3)} 31.4 ${f(x)} 31.4Q${f(x + 3)} 31.4 ${f(x + 3)} 33.6L${f(x + 2.2)} 37.6Z`).join('');
  s += P('t-b', 'M6 31.5H58V39H6Z' + hol + cr, ' fill-rule="evenodd"');
  s += P('t-a', cr);
  s += L(cx.map(x => `M${f(x - 2.6)} 34.6Q${f(x - .6)} 35.5 ${f(x + 1.4)} 34.9`).join(''), 1);
  // lettuces
  s += P('t-a', lx.map(x => bush(x, cy, 5.9, 9, 2.5)).join(''));
  s += L(lx.map(x => `M${f(x)} 36.5V27.5M${f(x)} 34.5Q${f(x - 1)} 31 ${f(x - 3.6)} 28.8M${f(x)} 34.5Q${f(x + 1)} 31 ${f(x + 3.6)} 28.8`).join(''), 1.2);
  // stacked plank front and corner posts
  s += P('t-a', 'M5 39H59V57.5H5Z');
  s += L('M5 45H59M5 51H59M14 42h8M36 48h10M20 54h9', 1.2);
  s += P('t-b', rpoly([[2.5, 27], [8, 27], [8, 58.5], [2.5, 58.5]], [1.4, 1.4, 0, 0]) + rpoly([[56, 27], [61.5, 27], [61.5, 58.5], [56, 58.5]], [1.4, 1.4, 0, 0]));
  s += P('t-c', spark(8, 10, 4));
  add('raised-bed', 'plank raised bed with lettuces and carrot tops', s);
}
// ---------- secateurs
{
  let s = '';
  // leaf: lens from (x,y), length l, angle a (deg)
  const leaf = (x, y, l, a) => { const r = a * Math.PI / 180, c = Math.cos(r), n = Math.sin(r), w = l * .4;
    return `M${f(x)} ${f(y)}q${f(l / 2 * c + w * n)} ${f(l / 2 * n - w * c)} ${f(l * c)} ${f(l * n)}q${f(-l / 2 * c - w * n)} ${f(-l / 2 * n + w * c)} ${f(-l * c)} ${f(-l * n)}Z`; };
  const rib = (x, y, l, a) => { const r = a * Math.PI / 180; return `M${f(x + Math.cos(r) * 1.5)} ${f(y + Math.sin(r) * 1.5)}L${f(x + Math.cos(r) * l * .75)} ${f(y + Math.sin(r) * l * .75)}`; };
  // twig still on the plant, coming in from the top
  const lv = [[26, 8.5, 13, -8], [30.5, 5, 9.5, 190]];
  s += P('t-a', lv.map(v => leaf(...v)).join(''));
  s += P('t-b', limb([[33.5, 2.6], [26, 8.5], [13.5, 20.5]], 3.6));
  s += L(lv.map(v => rib(...v)).join(''), 1.2);
  // secateurs, local frame: pivot at 0,0, blades to -x, handles to +x
  const g = [];
  const handle = (m) => P('t-a', `M3 ${-3 * m}L37 ${-1.5 * m}Q41 ${-1.3 * m} 41 ${2 * m}Q41 ${5.5 * m} 37 ${5.7 * m}L3 ${3.5 * m}Z`) +
    P('t-b', `M12 ${-2.4 * m}L37 ${-1.5 * m}Q41 ${-1.3 * m} 41 ${2 * m}Q41 ${5.5 * m} 37 ${5.7 * m}L12 ${4.1 * m}Z`);
  // anvil hook blade + its handle
  g.push(`<g transform="rotate(-26)">${P('t-a', 'M4 -1Q-8 4 -19 -4Q-20 2.5 -14.5 5.5Q-6 9 4 5.5Z') + P('t-b', 'M4 3.5Q-6 6.5 -14.5 3.5Q-18.5 2 -19.4 -1.5Q-20 2.5 -14.5 5.5Q-6 9 4 5.5Z')}</g>`);
  g.push(`<g transform="rotate(-13)">${handle(-1)}</g>`);
  // curved cutting blade + its handle
  g.push(`<g transform="rotate(13)">${handle(1)}</g>`);
  const bev = 'M2 .4Q-10 .6 -19.5 -.6Q-10 -2.4 2 -1.6Z';
  g.push(`<g transform="rotate(28)">${P('t-a', 'M4 -5Q-10 -9 -23.5 0Q-11 2.8 4 2.8Z' + bev, ' fill-rule="evenodd"')}${P('t-c', bev)}</g>`);
  g.push(P('t-b', circ(0, 0, 3.8) + circ(0, 0, 1.5), ' fill-rule="evenodd"') + C('t-c', 0, 0, 1.5));
  s += `<g transform="translate(25 26) rotate(45) scale(.92)">${g.join('')}</g>`;
  // the snipped sprig falling away
  const fl = [[13, 40.5, 11, 190], [16, 44.5, 11, 15], [19, 49, 10, 160], [22, 53, 9, 30]];
  s += P('t-a', fl.map(v => leaf(...v)).join(''));
  s += P('t-b', cap(11, 37, 22, 53, 3));
  s += L(fl.map(v => rib(...v)).join(''), 1.1);
  s += L('M3.5 29Q2.5 32 3.5 35M7.5 31Q6.5 33.5 7.5 36', 1.6);
  s += P('t-c', spark(55, 13, 4.5) + spark(6, 6, 3));
  add('secateurs', 'pruning secateurs snipping off a leafy sprig', s);
}

// ---------- picket-fence
{
  let s = '';
  // five round petals; their ring leaves the centre open
  const flower = (cx, cy, k = 1) => { let d = ''; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; d += circ(cx + 2.9 * k * Math.cos(a), cy + 2.9 * k * Math.sin(a), 2 * k); } return d; };
  const pk = (x, w, tip, bot) => `M${f(x)} ${f(bot)}V${f(tip + w * .7)}L${f(x + w / 2)} ${f(tip)}L${f(x + w)} ${f(tip + w * .7)}V${f(bot)}Z`;
  // rails behind the two fence sections
  s += P('t-b', 'M.5 21H17V25H.5ZM.5 41H17V45H.5ZM47 21H63.5V25H47ZM47 41H63.5V45H47Z');
  // pickets
  let p = '', sh = '';
  for (const x of [1.5, 9, 49.5, 57]) { p += pk(x, 5.5, 8, 55); sh += `M${f(x + 3.8)} ${f(8 + 5.5 * .7 + 1.2)}L${f(x + 5.5)} ${f(8 + 5.5 * .7)}V55H${f(x + 3.8)}Z`; }
  s += P('t-a', p);
  s += P('t-b', sh);
  // gate posts with ball caps
  for (const x of [16.5, 41.5]) {
    s += R('t-a', x, 9, 6, 46);
    s += P('t-b', `M${f(x + 4.2)} 9H${f(x + 6)}V55H${f(x + 4.2)}Z`);
    s += R('t-b', x - .8, 8, 7.6, 2.6, .8);
    s += C('t-a', x + 3, 5, 2.7);
  }
  // the gate, swung open toward us on the left post: its free edge is nearer, so taller;
  // it hangs clear of the ground, which is what separates it from the fence
  const top = x => 16 - (x - 22.5) * .47, bot = x => 46.8 + (x - 22.5) * .44;
  let gp = '';
  for (const [x, w] of [[23, 2.8], [26.7, 3], [30.6, 3.2]]) {
    gp += `M${f(x)} ${f(bot(x))}V${f(top(x) + w)}L${f(x + w / 2)} ${f(top(x + w / 2) - .5)}L${f(x + w)} ${f(top(x + w) + w)}V${f(bot(x + w))}Z`;
  }
  s += P('t-a', gp);
  const rail = (y0, y1, h) => `M22.5 ${f(y0)}L34 ${f(y1)}V${f(y1 + h)}L22.5 ${f(y0 + h)}Z`;
  s += P('t-b', rail(22, 18, 3.2) + rail(41.5, 46.5, 3.2));
  s += R('t-b', 20.5, 22.3, 3.5, 2.6, .6) + R('t-b', 20.5, 41.8, 3.5, 2.6, .6);
  // ring latch on the free edge
  s += P('t-b', circ(34.2, 30.5, 1.9) + circ(34.2, 30.5, .9), ' fill-rule="evenodd"');
  // grass and flowers along the base
  s += P('t-b', 'M.5 59.5V55Q3 52.5 5 54.5Q8 51.5 11 54.5Q14 52 16.5 54.5Q22 53.5 26 55.5Q33 54 38 56Q41 53 44 55Q47 52 50 54.5Q54 52 57 54.5Q60 52.5 63.5 54.5V59.5Z');
  s += L('M8 47V55M38.6 52V57M56 46V55', 1.5);
  s += P('t-b', flower(8, 46) + flower(56, 45.5) + flower(38.6, 51, .8));
  s += C('t-c', 38.6, 51, .9);
  s += P('t-c', spark(30.5, 5.5, 4));
  add('picket-fence', 'white picket fence with an open gate and flowers', s);
}

// ---------- trellis
{
  let s = '';
  const leaf = (x, y, l, a) => { const r = a * Math.PI / 180, c = Math.cos(r), n = Math.sin(r), w = l * .45;
    return `M${f(x)} ${f(y)}q${f(l / 2 * c + w * n)} ${f(l / 2 * n - w * c)} ${f(l * c)} ${f(l * n)}q${f(-l / 2 * c - w * n)} ${f(-l / 2 * n + w * c)} ${f(-l * c)} ${f(-l * n)}Z`; };
  // five round petals as one scalloped outline, centre punched out
  const flower = (cx, cy) => { let d = ''; for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i + .5) * 2 * Math.PI / 5, x = cx + 1.7 * Math.cos(a), y = cy + 1.7 * Math.sin(a);
    d += i ? `A2 2 0 1 1 ${f(x)} ${f(y)}` : `M${f(x)} ${f(y)}`; } return d + 'Z' + circ(cx, cy, 1); };
  // diamond lattice; slat ends tucked into the frame, which shares the path so overlaps don't double up
  const X0 = 10, X1 = 54, Y0 = 11.5, Y1 = 47.5, d = 11.7;
  let lat = 'M7 5H11.5V57H7ZM52.5 5H57V57H52.5ZM11.5 9H52.5V13H11.5ZM11.5 46H52.5V50H11.5ZM6.7 4a2.6 2.6 0 1 1 5.2 0a2.6 2.6 0 1 1-5.2 0ZM52.2 4a2.6 2.6 0 1 1 5.2 0a2.6 2.6 0 1 1-5.2 0Z';
  for (let k = -3; k <= 3; k++) {
    const a = 2.5 + k * d, xa = Math.max(X0, Y0 + a), xb = Math.min(X1, Y1 + a), la = f(xb - xa);
    if (xb > xa) lat += `M${f(xa)} ${f(xa - a - 1.7)}l${la} ${la}v3.4l-${la}-${la}z`;
    const b = 61.5 + k * d, xc = Math.max(X0, b - Y1), xd = Math.min(X1, b - Y0), lb = f(xd - xc);
    if (xd > xc) lat += `M${f(xc)} ${f(b - xc - 1.7)}l${lb}-${lb}v3.4l-${lb} ${lb}z`;
  }
  s += P('t-a', lat);
  s += P('t-b', 'M10 5H11.5V57H10ZM55.5 5H57V57H55.5ZM11.5 12H52.5V13H11.5ZM11.5 49H52.5V50H11.5Z');
  s += P('t-b', 'M2 59.5Q2 55 8 55.5Q14 53.5 20 55.5Q27 53.5 34 55.5Q41 53.5 48 55.5Q56 54 62 56Q62 59.5 60 59.5Z');
  // climbing vine with leaves and flowers
  s += L('M20 57C14 48 30 46 26 38S36 30 34 22S44 14 42 7Q41 3.5 44.5 3.5Q47.5 4 46.5 7', 2.3);
  const lv = [[22, 47, 10, 190], [26, 38, 10, -15], [29.5, 30, 10, 195], [34, 22, 10, -10], [38, 14, 9, 195]];
  s += P('t-b', lv.map(v => leaf(...v)).join(''));
  s += P('t-b', flower(17, 39) + flower(43, 31) + flower(23.5, 20.5), ' fill-rule="evenodd"');
  s += P('t-c', spark(3.5, 14, 3) + spark(60.5, 26, 3));
  add('trellis', 'diamond lattice trellis with a flowering vine', s);
}

// ---------- stepping-stones
{
  let s = '';
  // stones: [cx, cy, rx, ry, thickness], near (big) to far (small)
  const st = [[15, 52.5, 10, 5, 2], [33, 45, 8.5, 3.9, 1.7], [41, 36.5, 6.6, 2.9, 1.4], [31.5, 30, 5.2, 2.2, 1.1], [24, 25.3, 4, 1.6, .9], [29.5, 21.8, 2.8, 1.1, .7]];
  // each stone's footprint (top + side) as a hole in the lawn
  const foot = ([x, y, rx, ry, t]) => `M${f(x - rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x + rx)} ${f(y)}V${f(y + t)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x - rx)} ${f(y + t)}Z`;
  const side = ([x, y, rx, ry, t]) => `M${f(x - rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y)}V${f(y + t)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x - rx)} ${f(y + t)}Z`;
  const top = ([x, y, rx, ry]) => `M${f(x - rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 1 0 ${f(x + rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 1 0 ${f(x - rx)} ${f(y)}Z`;
  // distant shrubs on the horizon
  s += P('t-b', 'M2.5 22Q1.5 17 5.5 16Q7 12 11 13.5Q15.5 13 16 17.5Q18 19.5 17 21ZM44 21Q42.5 15.5 47 14.5Q48.5 10 53.5 11.5Q58 11.5 58.5 16Q61 17 60.5 20Z');
  s += P('t-a', 'M.5 21.5Q16 17.5 31 20Q47 22.5 63.5 18.5V56Q63.5 59.5 60 59.5H4Q.5 59.5 .5 56Z' + st.map(foot).join(''), ' fill-rule="evenodd"');
  s += P('t-c', st.map(top).join(''));
  s += P('t-b', st.map(side).join(''));
  // grass tufts and little flowers (rings of round dots) along the edges
  const tuft = (x, y) => `M${x} ${y}l1.2-4 .8 3 1-4.5 1 4.5 .8-3 1.2 4z`;
  s += P('t-b', tuft(3, 36) + tuft(53, 44) + tuft(45, 28.5) + tuft(13, 31) + tuft(50, 58.5) + tuft(28, 58.5));
  const fl = (x, y, r) => [0, 1, 2, 3, 4].map(i => `M${f(x + r * Math.cos(i * 1.257 - 1.57))} ${f(y + r * Math.sin(i * 1.257 - 1.57))}h0`).join('');
  s += L(fl(6, 43, 1.8) + fl(50, 50, 1.8) + fl(4, 54, 1.8) + fl(56, 37, 1.6), 2.5);
  s += L(fl(20, 36.5, 1.2) + fl(52, 30.5, 1.1) + fl(40.5, 25.5, 1) + fl(17, 26.5, 1), 1.7);
  s += P('t-c', spark(31, 9, 4.5) + spark(20, 5.5, 2.6) + spark(40, 4, 2));
  add('stepping-stones', 'winding stepping-stone path across a lawn', s);
}

// ---------- window-box
{
  let s = '';
  const leaf = (x, y, l, a) => { const r = a * Math.PI / 180, c = Math.cos(r), n = Math.sin(r), w = l * .45;
    return `M${f(x)} ${f(y)}q${f(l / 2 * c + w * n)} ${f(l / 2 * n - w * c)} ${f(l * c)} ${f(l * n)}q${f(-l / 2 * c - w * n)} ${f(-l / 2 * n + w * c)} ${f(-l * c)} ${f(-l * n)}Z`; };
  const dot = (x, y) => `M${f(x)} ${f(y)}h0`;
  // open shutters with louvres
  s += R('t-a', 6, 4, 11.5, 29, 1) + R('t-a', 46.5, 4, 11.5, 29, 1);
  let lv = '';
  for (let y = 8; y < 31; y += 3.4) lv += `M8.5 ${f(y)}H15M49 ${f(y)}H55.5`;
  s += L(lv, 1.4);
  // window frame with four panes of glass
  const panes = 'M21.5 5.5H31V16.5H21.5ZM33 5.5H42.5V16.5H33ZM21.5 18.5H31V30.5H21.5ZM33 18.5H42.5V30.5H33Z';
  s += P('t-a', 'M19 3H45V33H19Z' + panes, ' fill-rule="evenodd"');
  s += P('t-c', panes);
  s += P('t-b', 'M15 33H49Q50 33 50 34V35.5Q50 36.5 49 36.5H15Q14 36.5 14 35.5V34Q14 33 15 33Z');
  // the planter box on brackets
  s += P('t-a', 'M9 39.5H55L53.5 53.5H10.5Z');
  s += P('t-b', 'M10.2 50.5H53.8L53.5 53.5H10.5ZM13 53.5H18L13 58ZM51 53.5H46L51 58Z');
  // geranium leaves (a bumpy mound) and round flower heads of little florets
  s += L([[11.5, 38.5], [16, 36], [21, 37.5], [26, 35.5], [31, 37.5], [36, 35.5], [41, 37.5], [46, 35.5], [51.5, 38]].map(p => dot(...p)).join(''), 7);
  const hd = [[15.5, 25.5], [25, 21.5], [34.5, 24.5], [43.5, 21], [51.5, 26.5]];
  s += L(hd.map(([x, y]) => `M${x} ${y}Q${x + 1} ${y + 6} ${x - .5} ${y + 11}`).join(''), 1.5);
  let fh = '';
  for (const [x, y] of hd) {
    fh += dot(x, y); for (let i = 0; i < 7; i++) fh += dot(x + 2.7 * Math.cos(i * .898), y + 2.7 * Math.sin(i * .898));
  }
  s += L(fh, 3.2);
  // ivy trailing over the front
  s += L('M10 40Q6 47 9 52Q11 57 7.5 61M54 40Q58 47 55.5 53Q54 57 57 61M23 41Q25 45 22.5 49M41 41Q39 45 41.5 49', 1.4);
  s += P('t-b', leaf(8.5, 45, 5, 200) + leaf(9.3, 51.5, 5, 10) + leaf(9.5, 57.5, 5, 190) + leaf(55.5, 46, 5, -20) + leaf(55, 52.5, 5, 170) + leaf(55, 58.5, 5, -10) + leaf(24, 45, 4.5, 20) + leaf(22.5, 49, 4.5, 120) + leaf(40, 45, 4.5, 160) + leaf(41.5, 49, 4.5, 60));
  s += P('t-c', spark(3, 39, 2.5) + spark(61, 38, 2.5));
  add('window-box', 'window with shutters and a flowering window box', s);
}

fs.writeFileSync(process.argv[2] || new URL('../../icons/part15.json', import.meta.url), JSON.stringify(icons, null, 1));
console.log(icons.map(i => `${i.id} ${i.svg.length}`).join('\n'));
