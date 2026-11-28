import * as THREE from 'three';
import '../countdown/settings.js';
import '../countdown/audio.js';
import { createTreeScene } from './scene.js';
import { SURPRISES, loadDiscoveries, saveDiscovery } from './discoveries.js';

const $ = (selector, root = document) => root.querySelector(selector);
const SVG_NS = 'http://www.w3.org/2000/svg';
const ICON_PATHS = {
  star: 'M12 2.5 14.5 9.5 21.5 12 14.5 14.5 12 21.5 9.5 14.5 2.5 12 9.5 9.5Z',
  snow: 'M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7M8 4l4 2 4-2M8 20l4-2 4 2M4 11l4-1 1-4M20 13l-4 1-1 4M4 13l4 1 1 4M20 11l-4-1-1-4',
  candle: 'M12 10c-2-2 1-3.5 1-6 2 2 4 4 2 6M9 10h6l1 10H8l1-10ZM8 13h8',
  letter: 'M4 6h16v12H4zM4 7l8 6 8-6',
  village: 'M3 12 9 7l6 5v7H4v-7M13 11l4-4 5 4v8h-7M7 19v-4h3v4M17 14h2v2h-2'
};
function makeIcon(kind, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[kind] || ICON_PATHS.star);
  svg.append(path);
  return svg;
}
const settingsApi = window.EverfrostSettings;
const localDefaults = { musicVolume: 100, ambientVolume: 100, musicMuted: false, ambientMuted: false, snowEnabled: true, animationsEnabled: true, graphicsQuality: 'medium', snowDensity: 55, windIntensity: 30, particlesEnabled: true, reducedMotion: false };
let preferences = settingsApi ? settingsApi.get() : { ...localDefaults };
function getPreferences() { return preferences; }

const canvas = $('#tree-canvas');
let treeScene;
try { treeScene = createTreeScene(canvas, getPreferences); }
catch (error) {
  console.error('Everfrost scene could not start:', error);
  const hint = $('#scene-hint');
  if (hint) hint.textContent = 'This device could not start the 3D clearing. Try a browser with WebGL enabled.';
  throw error;
}
const soundButton = $('#sound-toggle');
const panel = $('#present-panel');
const collection = loadDiscoveries();
const raycaster = treeScene.presents;
let toastTimer;
let focusTarget = null;
let introHandle = null;

function toast(message) {
  const el = $('#tree-toast');
  el.textContent = message; el.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3000);
}
function updateCollectionCount() {
  $('#discovery-count').textContent = String(collection.size);
  $('#dialog-count').textContent = `${collection.size} / ${SURPRISES.length}`;
}
function renderCollection() {
  const grid = $('#collection-grid');
  grid.replaceChildren();
  for (const item of SURPRISES) {
    const found = collection.has(item.id);
    const card = document.createElement('article'); card.className = `collection-card${found ? ' discovered' : ''}`;
    const icon = document.createElement('div'); icon.className = 'collection-icon';
    if (found) {
      const kind = { 'north-star': 'star', 'lucia-light': 'candle', 'winter-letter': 'letter', 'little-world': 'village' }[item.id];
      icon.append(makeIcon(kind, `collection-symbol ${kind}-symbol`));
    } else icon.append(makeIcon('star', 'collection-symbol star-symbol undiscovered-symbol'));
    const kind = document.createElement('span'); kind.className = 'collection-kind'; kind.textContent = found ? item.type : 'Unfound present';
    const title = document.createElement('h3'); title.textContent = found ? item.name : 'A little mystery';
    const description = document.createElement('p'); description.textContent = found ? item.description : 'A wrapped surprise rests beneath the tree.';
    card.append(icon, kind, title, description); grid.append(card);
  }
  updateCollectionCount();
}
function createMiniWorld() {
  const mini = document.createElement('div'); mini.className = 'mini-world';
  mini.innerHTML = '<span class="mini-moon"></span><span class="mini-hill hill-one"></span><span class="mini-hill hill-two"></span><span class="mini-house"><i></i><b></b></span><span class="mini-snow" aria-hidden="true"><svg viewBox="0 0 100 16"><path d="M10 8h10m-5-5v10m-2-8 4 4m0-4-4 4M45 8h10m-5-5v10m-2-8 4 4m0-4-4 4M80 8h10m-5-5v10m-2-8 4 4m0-4-4 4"/></svg></span>';
  return mini;
}
function revealSurprise(item) {
  collection.add(item.id); saveDiscovery(item.id); renderCollection();
  $('#present-kind').textContent = item.type;
  $('#present-title').textContent = item.name;
  $('#present-description').textContent = item.description;
  const reveal = $('#present-reveal'); reveal.replaceChildren();
  if (item.id === 'little-world') reveal.append(createMiniWorld());
  else {
    const kind = { 'north-star': 'star', 'lucia-light': 'candle', 'winter-letter': 'snow' }[item.id] || 'star';
    reveal.append(makeIcon(kind, `reveal-token token-${item.id}`));
  }
  const message = document.createElement('p'); message.className = 'reveal-message'; message.textContent = item.reveal; reveal.append(message);
  panel.hidden = false; requestAnimationFrame(() => panel.classList.add('visible'));
  toast('Added to your discoveries.');
}
treeScene.presents.setOnSelect((item, present) => {
  revealSurprise(item);
  const worldPos = new THREE.Vector3(); present.getWorldPosition(worldPos);
  focusTarget = { from: treeScene.controls.target.clone(), to: new THREE.Vector3(worldPos.x, worldPos.y + 0.7, worldPos.z), start: performance.now(), duration: 900 };
});

function closePresent() {
  panel.classList.remove('visible');
  window.setTimeout(() => { panel.hidden = true; }, 260);
  raycaster.close(); focusTarget = { from: treeScene.controls.target.clone(), to: new THREE.Vector3(0, 4.1, 0), start: performance.now(), duration: 700 };
}
$('#close-present').addEventListener('click', closePresent);
$('#close-reveal').addEventListener('click', closePresent);

const discoverDialog = $('#discoveries-dialog');
const settingsDialog = $('#tree-settings-dialog');
$('#open-discoveries').addEventListener('click', () => { renderCollection(); discoverDialog.showModal(); });
$('#open-settings').addEventListener('click', () => settingsDialog.showModal());
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
for (const dialog of [discoverDialog, settingsDialog]) dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

function syncSettings() {
  document.querySelectorAll('[data-tree-setting]').forEach(control => {
    const key = control.dataset.treeSetting;
    if (!(key in preferences)) return;
    if (control.type === 'checkbox') control.checked = Boolean(preferences[key]);
    else control.value = String(preferences[key]);
    if (control.type === 'range') $(`[data-value-for="${key}"]`).value = `${preferences[key]}%`;
  });
}
function updateSetting(control) {
  const key = control.dataset.treeSetting;
  const value = control.type === 'checkbox' ? control.checked : control.type === 'range' ? Number(control.value) : control.value;
  if (settingsApi) {
    settingsApi.update(key, value);
    preferences = settingsApi.get();
  } else {
    preferences[key] = value;
    try { localStorage.setItem('everfrost.preferences.v1', JSON.stringify(preferences)); } catch (_) { /* optional */ }
  }
  syncSettings();
}
document.querySelectorAll('[data-tree-setting]').forEach(control => {
  control.addEventListener('input', () => updateSetting(control));
  control.addEventListener('change', () => updateSetting(control));
});
window.addEventListener('everfrost:preferences', event => {
  if (!event.detail) return;
  preferences = { ...localDefaults, ...event.detail };
  syncSettings();
});
syncSettings(); renderCollection();

window.addEventListener('everfrost:preferences', () => {
  const musicMuted = preferences.musicMuted || preferences.musicVolume === 0;
  const ambienceMuted = preferences.ambientMuted || preferences.ambientVolume === 0;
  if (musicMuted && ambienceMuted) soundButton.querySelector('.sound-label').textContent = 'Muted';
});

const skipIntro = $('#skip-intro');
const alreadyIntroduced = (() => { try { return localStorage.getItem('everfrost.tree.intro.v1') === 'done'; } catch (_) { return false; } })();
if (!alreadyIntroduced && !preferences.reducedMotion) {
  skipIntro.hidden = false;
  introHandle = treeScene.startIntro(new THREE.Vector3(0, 2.4, 31), new THREE.Vector3(0, 3.4, 2), 6200, () => { skipIntro.hidden = true; });
  if (!introHandle) skipIntro.hidden = true;
  else window.setTimeout(() => { if (!skipIntro.hidden) { skipIntro.hidden = true; } }, 6400);
}
skipIntro.addEventListener('click', () => { introHandle?.finish(); skipIntro.hidden = true; });
$('#reset-view').addEventListener('click', () => treeScene.resetView());
$('#look-sky').addEventListener('click', () => treeScene.lookAtSky());

let pointerDown = null;
canvas.addEventListener('pointerdown', event => { pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId }; }, { passive: true });
canvas.addEventListener('pointermove', event => {
  if (pointerDown && pointerDown.id === event.pointerId && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 7) pointerDown.moved = true;
  if (!pointerDown || !pointerDown.moved) raycaster.pointerMove(event, treeScene.camera, treeScene.renderer);
}, { passive: true });
canvas.addEventListener('pointerup', event => {
  if (pointerDown && !pointerDown.moved && !treeScene.isIntroActive()) raycaster.click(event, treeScene.camera, treeScene.renderer);
  pointerDown = null;
});
canvas.addEventListener('pointercancel', () => { pointerDown = null; });

const originalUpdate = treeScene.controls.update.bind(treeScene.controls);
treeScene.controls.update = (...args) => {
  if (focusTarget) {
    const t = Math.min(1, (performance.now() - focusTarget.start) / focusTarget.duration);
    const ease = t * t * (3 - 2 * t);
    treeScene.controls.target.lerpVectors(focusTarget.from, focusTarget.to, ease);
    if (t >= 1) focusTarget = null;
  }
  return originalUpdate(...args);
};

// Subtle accessibility/status hint clears after the initial visit.
window.setTimeout(() => $('#scene-hint')?.classList.add('hint-muted'), 9500);
window.addEventListener('beforeunload', () => treeScene.dispose(), { once: true });
