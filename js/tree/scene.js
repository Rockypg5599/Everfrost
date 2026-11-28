import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnvironment } from './environment.js';
import { createChristmasTree } from './tree.js';
import { createWeather } from './weather.js';
import { createPresents } from './presents.js';

const QUALITY = { low: 0.7, medium: 1, high: 1.35 };

export function createTreeScene(canvas, getPreferences) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio <= 1.5, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.1, 180);
  camera.position.set(0, 10.7, 22);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 7.4, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 11.5;
  controls.maxDistance = 27;
  controls.minPolarAngle = 0.9;
  controls.maxPolarAngle = 1.52;
  controls.enablePan = false;
  controls.rotateSpeed = 0.48;
  controls.zoomSpeed = 0.65;
  controls.update();

  const environment = createEnvironment(scene);
  const tree = createChristmasTree(scene, renderer);
  const weather = createWeather(scene, getPreferences);
  const presents = createPresents(scene);
  let last = performance.now();
  let elapsed = 0;
  let disposed = false;
  let intro = null;
  let introFinish = null;

  function resize() {
    const width = window.innerWidth, height = window.innerHeight;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    const quality = getPreferences().graphicsQuality;
    const scale = QUALITY[quality] || 1;
    renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * scale, 2));
    renderer.setSize(width, height, false);
  }
  function frame(now) {
    if (disposed) return;
    requestAnimationFrame(frame);
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now; elapsed += delta;
    const prefs = getPreferences();
    if (!intro && prefs.animationsEnabled && !prefs.reducedMotion) {
      // The visual effects update here; time continues at a gentle pace.
    }
    if (intro) {
      const t = Math.min(1, (now - intro.start) / intro.duration);
      const ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(intro.from, intro.to, ease);
      controls.target.lerpVectors(intro.targetFrom, intro.targetTo, ease);
      if (t >= 1 && introFinish) introFinish();
    }
    controls.update();
    environment.update(elapsed, prefs);
    weather.update(delta, elapsed);
    tree.update(elapsed, Math.sin(elapsed * 0.35) * prefs.windIntensity / 100, prefs);
    presents.update();
    if (Math.floor(elapsed) !== Math.floor(elapsed - delta)) environment.moon.update();
    renderer.render(scene, camera);
  }
  const resizeListener = () => resize();
  window.addEventListener('resize', resizeListener, { passive: true });
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
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
      from: new THREE.Vector3(0, 2.4, 38), to: new THREE.Vector3(0, 10.7, 22),
      targetFrom: new THREE.Vector3(0, 3.4, 2), targetTo: new THREE.Vector3(0, 7.4, 0)
    };
    controls.enabled = false;
    const end = () => {
      if (!intro) return;
      intro = null; introFinish = null; controls.enabled = true;
      camera.position.set(0, 10.7, 22); controls.target.set(0, 7.4, 0); controls.update();
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
  return { scene, camera, renderer, controls, environment, tree, weather, moon: environment.moon, presents, startIntro: setIntro, isIntroActive: () => Boolean(intro), dispose, resetView() { camera.position.set(0, 10.7, 22); controls.target.set(0, 7.4, 0); controls.update(); } };
}
