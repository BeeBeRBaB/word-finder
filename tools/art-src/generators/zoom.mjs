// Usage: node zoom.mjs <file.json> [ids...]
// Big full-colour render, the faint app tint on dark, and the same at 20% and 45% on a light bg.
// Writes <file>-zoom.svg and -zoom.png next to the JSON. Works for icon parts and illo groups.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const file = path.resolve(process.argv[2]); let items = JSON.parse(fs.readFileSync(file, 'utf8'));
const only = process.argv.slice(3); if (only.length) items = items.filter(i => only.includes(i.id));
// .ln widths follow styles.css: an explicit stroke-width attribute wins over the default 2.
const ln = c => `.${c} .ln{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}.${c} .ln:not([stroke-width]){stroke-width:2}`;
const style = `.c{color:#9a5a1a}.c .t-a{fill:#e8a33d}.c .t-b{fill:#9a5a1a}.c .t-c{fill:#ffe2a8}${ln('c')}
.f{fill:#e8a33d;color:#e8a33d}.g{fill:#2a6f68;color:#2a6f68}.f .t-a,.g .t-a{fill-opacity:.72}.f .t-b,.g .t-b{fill-opacity:1}.f .t-c,.g .t-c{fill-opacity:.4}${ln('f')}${ln('g')}`;
const S = 280, cells = items.map((it, k) => { const x0 = (k % 3) * (S * 2 + 30), y0 = Math.floor(k / 3) * (S + 30);
  return `<g transform="translate(${x0 + 10},${y0 + 10})"><rect width="${S}" height="${S}" fill="#241a15"/><svg class="c" width="${S}" height="${S}" viewBox="0 0 64 64">${it.svg}</svg>
  <rect x="${S + 5}" width="${S}" height="${S / 2}" fill="#241a15"/><svg class="f" x="${S + 5}" y="0" width="${S / 2}" height="${S / 2}" viewBox="0 0 64 64" opacity=".5">${it.svg}</svg>
  <rect x="${S + 5}" y="${S / 2}" width="${S}" height="${S / 2}" fill="#f4efe6"/><svg class="g" x="${S + 5}" y="${S / 2}" width="${S / 2}" height="${S / 2}" viewBox="0 0 64 64" opacity=".2">${it.svg}</svg>
  <svg class="g" x="${S + 5 + S / 2}" y="${S / 2}" width="${S / 2}" height="${S / 2}" viewBox="0 0 64 64" opacity=".45">${it.svg}</svg>
  <text x="4" y="${S + 18}" fill="#f0e0d2" font-size="14" font-family="Helvetica">${it.id} (${it.svg.length})</text></g>`; }).join('');
const W = 3 * (S * 2 + 30) + 10, H = Math.ceil(items.length / 3) * (S + 30) + 10;
const out = file.replace(/\.json$/, '-zoom.svg');
fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#100a05"><style>${style}</style>${cells}</svg>`);
const { chromium } = createRequire(new URL('../../../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto('file://' + out); await p.screenshot({ path: out.replace(/\.svg$/, '.png') }); await b.close();
console.log(out.replace(/\.svg$/, '.png'));
