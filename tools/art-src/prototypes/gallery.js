// One live tile per animated entry in the registry; each module exports start(host, opts) -> stop.
import { BACKGROUNDS } from '../../../src/backgrounds.js';

const q = new URLSearchParams(location.search);
const dark = !q.has('light');
document.body.classList.toggle('light', !dark);
const colors = dark ? ['#ff8c3a', '#ffc14d', '#78cdc8', '#ff828c', '#c89bff']
  : ['#b84e0d', '#e0a014', '#1e9691', '#e1506e', '#965fdc'];
const tiles = /** @type {HTMLElement} */ (document.getElementById('tiles'));

for (const [i, bg] of BACKGROUNDS.filter(b => b.file).entries()) {
  const tile = document.createElement('section');
  tile.className = 'tile';
  const host = document.createElement('div'); host.className = 'host';
  const card = document.createElement('div'); card.className = 'card';
  const label = document.createElement('div'); label.className = 'label';
  tile.append(host, card, label);
  tiles.append(tile);
  try {
    const mod = await import(`../../../src/backgrounds/${bg.file}.js`);
    label.textContent = `${i + 1}. ${bg.name} (${bg.id})`;
    mod.start(host, { colors, dark, reducedMotion: q.has('rm') });
  } catch (err) {
    label.textContent = `${i + 1}. ${bg.file} failed: ${err instanceof Error ? err.message : err}`;
  }
}
