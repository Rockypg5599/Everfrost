import * as THREE from 'three';
import '../countdown/settings.js';
import '../countdown/audio.js';
import { createTreeScene } from './scene.js';
import { SURPRISES, loadDiscoveries, saveDiscovery } from './discoveries.js';

const $ = (selector, root = document) => root.querySelector(selector);
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
    const icon = document.createElement('div'); icon.className = 'collection-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = found ? ['✦', '✧', '❄', '⌂'][SURPRISES.indexOf(item)] : '·';
    const kind = document.createElement('span'); kind.className = 'collection-kind'; kind.textContent = found ? item.type : 'Unfound present';
    const title = document.createElement('h3'); title.textContent = found ? item.name : 'A little mystery';
    const description = document.createElement('p'); description.textContent = found ? item.description : 'A wrapped surprise rests beneath the tree.';
    card.append(icon, kind, title, description); grid.append(card);
  }
  updateCollectionCount();
}
function createMiniWorld() {
  const mini = document.createElement('div'); mini.className = 'mini-world';
  mini.innerHTML = '<span class="mini-moon"></span><span class="mini-hill hill-one"></span><span class="mini-hill hill-two"></span><span class="mini-house"><i></i><b></b></span><span class="mini-snow">✦　·　✧　·　✦</span>';
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
    const token = document.createElement('span'); token.className = `reveal-token token-${item.id}`;
    token.textContent = item.id === 'north-star' ? '✦' : item.id === 'lucia-light' ? '🕯' : '❄';
    reveal.append(token);
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
