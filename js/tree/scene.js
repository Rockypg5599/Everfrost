import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnvironment } from './environment.js';
import { createChristmasTree } from './tree.js';
import { createWeather } from './weather.js';
import { createPresents } from './presents.js';

const QUALITY = { low: 0.68, medium: 0.84, high: 1.0 };
const MAX_PIXEL_RATIO = 1.25;
const FRAME_INTERVAL = 1000 / 45;
const STATIC_FRAME_INTERVAL = 1000 / 12;

export function createTreeScene(canvas, getPreferences) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio <= 1.25, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(41, window.innerWidth / window.innerHeight, 0.1, 180);
  camera.position.set(0, 10.3, 20.5);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 5.1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  let dirty = true;
  let controlsInteracting = false;
  canvas.addEventListener('pointerdown', () => { controlsInteracting = true; dirty = true; }, { passive: true });
  window.addEventListener('pointerup', () => { controlsInteracting = false; dirty = true; }, { passive: true });
  controls.minDistance = 11.5;
  controls.maxDistance = 27;
  controls.minPolarAngle = 0.16;
  // Past horizontal (~1.57) lets the camera rotate up under the crown to face
  // the sky; the frame loop keeps it above the snow surface.
  controls.maxPolarAngle = 1.95;
  controls.enablePan = false;
  controls.rotateSpeed = 0.48;
  controls.zoomSpeed = 0.65;
  controls.update();

  const environment = createEnvironment(scene, renderer);
  scene.userData.everfrostAddForest = model => environment.addForest(model);
  scene.userData.everfrostSnowHeightAt = environment.heightAt;
  scene.userData.everfrostRefreshShadows = () => {
    if (!renderer.shadowMap.enabled) return;
    renderer.shadowMap.needsUpdate = true;
    dirty = true;
  };
  const tree = createChristmasTree(scene, renderer);
  const weather = createWeather(scene, getPreferences);
  const presents = createPresents(scene);
  let last = performance.now();
  let lastFrame = 0;
  let elapsed = 0;
  let disposed = false;
  let intro = null;
  let introFinish = null;
  let bodySkyView = false;

  function resize() {
    dirty = true;
    const width = window.innerWidth, height = window.innerHeight;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    const quality = getPreferences().graphicsQuality;
    const scale = QUALITY[quality] || QUALITY.medium;
    renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * scale, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
  }
  window.addEventListener('everfrost:preferences', () => resize());
  function frame(now) {
    if (disposed) return;
    requestAnimationFrame(frame);
    const prefs = getPreferences();
    const animated = prefs.animationsEnabled && !prefs.reducedMotion;
    const interacting = intro || controlsInteracting;
    const minFrameInterval = animated || interacting ? FRAME_INTERVAL : STATIC_FRAME_INTERVAL;
    if (!dirty && now - lastFrame < minFrameInterval) return;
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    lastFrame = now;
    elapsed += delta;
    dirty = false;
    if (intro) {
      const t = Math.min(1, (now - intro.start) / intro.duration);
      const ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(intro.from, intro.to, ease);
      controls.target.lerpVectors(intro.targetFrom, intro.targetTo, ease);
      if (t >= 1 && introFinish) introFinish();
    }
    const controlsChanged = controls.update();
    if (controlsChanged) dirty = true;
    // Free look: when the user rotates the camera up past the crown, keep it
    // above the snow instead of letting it sink under the terrain.
    const minY = scene.userData.everfrostSnowHeightAt(camera.position.x, camera.position.z) + 1.0;
    if (camera.position.y < minY) { camera.position.y = minY; dirty = true; }
    // Pitched up at the sky is when the lush aurora curtain belongs on screen
    // (what the old "Look up" button used to toggle, now driven by the camera).
    const lookingUp = camera.position.y < 2.2;
    if (lookingUp !== bodySkyView) {
      bodySkyView = lookingUp;
      document.body.classList.toggle('sky-view-active', lookingUp);
    }
    if (animated) {
      environment.update(elapsed, prefs, lookingUp);
      weather.update(delta, elapsed);
      tree.update(elapsed, Math.sin(elapsed * 0.35) * prefs.windIntensity / 100, prefs);
      presents.update();
    }
    if (Math.floor(elapsed) !== Math.floor(elapsed - delta)) environment.moon.update();
    renderer.render(scene, camera);
    if (controlsChanged || intro) dirty = true;
  }
  const resizeListener = () => resize();
  window.addEventListener('resize', resizeListener, { passive: true });
  document.addEventListener('visibilitychange', () => { last = performance.now(); lastFrame = 0; dirty = true; });
  resize();
  // Draw the fully assembled scene synchronously so the canvas is never a blank
  // backdrop while the first animation frame is waiting in the browser queue.
  renderer.render(scene, camera);
  requestAnimationFrame(frame);

  function startIntro(onFinish) {
    let introDone = false;
    try { introDone = localStorage.getItem('everfrost.tree.intro.v1') === 'done'; } catch (_) { /* optional */ }
    if (introDone || getPreferences().reducedMotion) return false;
    intro = {
      start: performance.now(), duration: 6200,
      from: new THREE.Vector3(0, 2.4, 38), to: new THREE.Vector3(0, 9.4, 20.5),
      targetFrom: new THREE.Vector3(0, 3.4, 2), targetTo: new THREE.Vector3(0, 5.1, 0)
    };
    controls.enabled = false;
    const end = () => {
      if (!intro) return;
      intro = null; introFinish = null; controls.enabled = true;
      camera.position.set(0, 9.4, 20.5); controls.target.set(0, 5.1, 0); controls.update();
      try { localStorage.setItem('everfrost.tree.intro.v1', 'done'); } catch (_) { /* optional */ }
      onFinish?.();
    };
    introFinish = end;
    return { finish: end, get active() { return Boolean(intro); } };
  }
  function setIntro(cameraStart, targetStart, duration = 6200, onFinish) {
    const started = startIntro(onFinish);
    if (started) {
      intro.from.copy(cameraStart); intro.targetFrom.copy(targetStart); intro.duration = duration;
      return started;
    }
    return null;
  }
  function dispose() { disposed = true; window.removeEventListener('resize', resizeListener); controls.dispose(); renderer.dispose(); }
  function lookAtSky() {
    intro = null;
    introFinish = null;
    document.body.classList.add('sky-view-active');
    controls.enabled = true;
    controls.target.set(0, 30, -8);
    camera.position.set(0, 19, 13);
    controls.update();
    dirty = true;
  }
  return { scene, camera, renderer, controls, environment, tree, weather, moon: environment.moon, presents, startIntro: setIntro, isIntroActive: () => Boolean(intro), dispose, lookAtSky, resetView() { document.body.classList.remove('sky-view-active'); camera.position.set(0, 9.4, 20.5); controls.target.set(0, 5.1, 0); controls.update(); dirty = true; } };
}
