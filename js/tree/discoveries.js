const STORAGE_KEY = 'everfrost.tree.discoveries.v1';

export const SURPRISES = [
  { id: 'lucia-light', name: 'Lucia’s little light', type: 'Keepsake', description: 'A small star for the darkest evening. In Sweden, the Lucia celebration brings candles and song to December’s long nights.', reveal: 'May you always find a little light to carry with you.' },
  { id: 'north-star', name: 'The North Star', type: 'Pocket wonder', description: 'A tiny golden compass-star, inspired by the steady light that has helped travellers find their way for generations.', reveal: 'A reminder: even on the longest night, you are never entirely without direction.' },
  { id: 'winter-letter', name: 'A winter letter', type: 'A note for you', description: 'Somewhere in the hush of falling snow, there is room to begin again.', reveal: 'May the coming year bring you gentleness, good company, and reasons to wonder.' },
  { id: 'little-world', name: 'The lantern village', type: 'A tiny world', description: 'A miniature village waits beneath a glassy winter sky, its windows glowing against the blue.', reveal: 'In the smallest windows, the warmest stories.' }
];

export function loadDiscoveries() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved.filter(id => SURPRISES.some(item => item.id === id)) : []);
  } catch (_) { return new Set(); }
}

export function saveDiscovery(id) {
  const collection = loadDiscoveries();
  collection.add(id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...collection])); } catch (_) { /* private browsing fallback */ }
  return collection;
}
