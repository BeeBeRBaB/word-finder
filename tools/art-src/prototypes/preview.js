// One background full-page behind a stand-in board.
// Query: name=<file in src/backgrounds/>, light, rm (reduced motion), src=<module URL override>.
const q = new URLSearchParams(location.search);
const name = q.get('name') || 'pixel-starfield';
const dark = !q.has('light') && q.get('dark') !== '0';
document.body.classList.toggle('light', !dark);

const board = /** @type {HTMLElement} */ (document.getElementById('board'));
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
for (let i = 0; i < 144; i++) {
  const s = document.createElement('span');
  s.textContent = A[(i * 7 + (i >> 3) * 3) % 26];
  board.appendChild(s);
}

const colors = dark ? ['#ff8c3a', '#ffc14d', '#78cdc8', '#ff828c', '#c89bff']
  : ['#b84e0d', '#e0a014', '#1e9691', '#e1506e', '#965fdc'];
const mod = await import(q.get('src') || `../../../src/backgrounds/${name}.js`);
document.title = mod.meta?.name ?? name;
const w = /** @type {any} */ (window);
w.__meta = mod.meta;
w.__stop = mod.start(document.getElementById('bg'), { colors, dark, reducedMotion: q.has('rm') });
w.__ready = true;
