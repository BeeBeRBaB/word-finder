// Validate + preview flat vector illustrations. Usage: node check.mjs <file.json>
// file.json: [{ "id": "space", "motif": "...", "svg": "<path class=\"t-a\" d=\"...\"/>..." }]
// Inner SVG markup for a viewBox of 0 0 64 64. Allowed elements: path circle ellipse rect
// polygon polyline line g. Allowed attributes: d cx cy r rx ry x y width height points x1 y1
// x2 y2 transform fill-rule stroke-width stroke-linecap stroke-linejoin class.
// class must be one of: t-a (main fill), t-b (shade fill), t-c (highlight fill), ln (outline/stroke detail).
import fs from 'node:fs'; import { createRequire } from 'node:module';
const file = (await import('node:path')).resolve(process.argv[2]); const items = JSON.parse(fs.readFileSync(file, 'utf8'));
const TAGS = new Set(['path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line', 'g']);
const ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points', 'x1', 'y1', 'x2', 'y2', 'transform', 'fill-rule', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'class']);
const CLASSES = new Set(['t-a', 't-b', 't-c', 'ln']);
let bad = 0;
for (const it of items) {
  const errs = []; const svg = it.svg || '';
  if (svg.length > 3000) errs.push(`too long (${svg.length} chars, max 3000)`);
  for (const m of svg.matchAll(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g)) {
    const [, tag, rest] = m; if (!TAGS.has(tag)) errs.push(`tag <${tag}>`);
    for (const a of rest.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
      if (!ATTRS.has(a[1])) errs.push(`attr ${a[1]}`);
      if (a[1] === 'class' && !a[2].split(/\s+/).every(c => CLASSES.has(c))) errs.push(`class "${a[2]}"`);
    }
  }
  if (/url\(|href|javascript|on\w+=|style/i.test(svg)) errs.push('forbidden content');
  const shapes = (svg.match(/<(path|circle|ellipse|rect|polygon|polyline|line)\b/g) || []).length;
  if (shapes < 3) errs.push(`only ${shapes} shapes`);
  if (errs.length) { bad++; console.log(`FAIL ${it.id}: ${[...new Set(errs)].join(', ')}`); } else console.log(`ok   ${it.id} (${it.motif}) ${shapes} shapes, ${svg.length} chars`);
}
const style = `.t-a{fill:#e8a33d}.t-b{fill:#9a5a1a}.t-c{fill:#ffe2a8}.ln{fill:none;stroke:#9a5a1a;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}`;
const faint = `.f .t-a{fill:#e8a33d;fill-opacity:.72}.f .t-b{fill:#e8a33d;fill-opacity:1}.f .t-c{fill:#e8a33d;fill-opacity:.4}.f .ln{fill:none;stroke:#e8a33d;stroke-width:2}`;
const cells = items.map((it, k) => { const x0 = (k % 5) * 190, y0 = Math.floor(k / 5) * 230;
  return `<g transform="translate(${x0 + 10},${y0 + 10})"><rect width="170" height="170" fill="#241a15"/><svg x="5" y="5" width="160" height="160" viewBox="0 0 64 64">${it.svg}</svg>
  <rect y="175" width="170" height="40" fill="#241a15"/><svg class="f" x="130" y="176" width="38" height="38" viewBox="0 0 64 64" opacity=".5">${it.svg}</svg>
  <text x="4" y="200" fill="#f0e0d2" font-size="12" font-family="Helvetica">${it.id}: ${it.motif}</text></g>`; }).join('');
const W = 960, H = Math.ceil(items.length / 5) * 230 + 10;
const out = file.replace(/\.json$/, '.svg');
fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#100a05"><style>${style}${faint}</style>${cells}</svg>`);
const { chromium } = createRequire(new URL('../../../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto('file://' + out); await p.screenshot({ path: out.replace(/\.svg$/, '.png') }); await b.close();
console.log('preview: ' + out.replace(/\.svg$/, '.png')); process.exit(bad ? 1 : 0);
