// Usage: node bbox.mjs <file.json> -> geometry bbox of each item in its 64x64 viewBox; flags any within 0.5 of an edge.
// Samples outlines, so a .ln stroke adds half its width (default 2, as in styles.css).
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const items = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8'));
const { chromium } = createRequire(new URL('../../../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g id="w"></g></svg>');
let edge = 0;
for (const it of items) {
  const r = await p.evaluate(svg => {
    const w = document.getElementById('w'); w.innerHTML = svg;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const el of w.querySelectorAll('path,circle,ellipse,rect,polygon,polyline,line')) {
      const L = el.getTotalLength(), m = el.getCTM(), sw = el.classList.contains('ln') ? (+(el.getAttribute('stroke-width') || 2)) / 2 : 0;
      for (let i = 0; i <= 400; i++) { const q = el.getPointAtLength(L * i / 400); const t = q.matrixTransform(m);
        x0 = Math.min(x0, t.x - sw); y0 = Math.min(y0, t.y - sw); x1 = Math.max(x1, t.x + sw); y1 = Math.max(y1, t.y + sw); }
    }
    return [x0, y0, x1, y1].map(v => Math.round(v * 10) / 10); }, it.svg);
  const warn = r[0] < 0.5 || r[1] < 0.5 || r[2] > 63.5 || r[3] > 63.5;
  if (warn) edge++;
  console.log(it.id.padEnd(18), r.join(' '), warn ? '  <-- edge' : '');
}
await b.close();
console.log(`${items.length} items, ${edge} at an edge`);
