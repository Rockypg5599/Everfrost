import * as THREE from 'three';

export function createWeather(scene, getPreferences) {
  const count = 800;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 70;
    positions[i * 3 + 1] = Math.random() * 30;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 65;
    speeds[i] = 1.2 + Math.random() * 3.6;
    phases[i] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xe9f1f4, size: 0.09, transparent: true, opacity: 0.76, depthWrite: false, sizeAttenuation: true });
  const flakes = new THREE.Points(geometry, material);
  scene.add(flakes);

  const emberPositions = new Float32Array(72 * 3);
  for (let i = 0; i < 72; i++) {
    emberPositions[i * 3] = (Math.random() - 0.5) * 10;
    emberPositions[i * 3 + 1] = Math.random() * 11;
    emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  const embers = new THREE.Points(emberGeometry, new THREE.PointsMaterial({ color: 0xe6bd72, size: 0.055, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(embers);
  let gust = 0, gustTarget = 0, elapsed = 0;

  function update(delta, time) {
    const prefs = getPreferences();
    elapsed += delta;
    if (time > gustTarget) { gust = (Math.random() - 0.5) * (prefs.windIntensity / 100) * 4; gustTarget = time + 5 + Math.random() * 8; }
    const p = geometry.attributes.position.array;
    const density = prefs.snowEnabled ? prefs.snowDensity / 100 : 0;
    const quality = prefs.graphicsQuality === 'high' ? 1 : prefs.graphicsQuality === 'low' ? 0.43 : 0.72;
    const visibleCount = Math.floor(count * density * quality * (window.innerWidth < 700 ? 0.72 : 1));
    flakes.visible = visibleCount > 0;
    for (let i = 0; i < visibleCount; i++) {
      const offset = i * 3;
      p[offset + 1] -= speeds[i] * delta;
      p[offset] += (gust * 0.2 + Math.sin(elapsed * 0.7 + phases[i]) * 0.12) * delta;
      p[offset + 2] += Math.cos(elapsed * 0.4 + phases[i]) * delta * 0.06;
      if (p[offset + 1] < -0.5) { p[offset + 1] = 29 + Math.random() * 3; p[offset] = (Math.random() - 0.5) * 70; }
    }
    if (visibleCount > 0) geometry.attributes.position.needsUpdate = true;
    embers.visible = prefs.particlesEnabled && prefs.graphicsQuality !== 'low' && !prefs.reducedMotion;
    embers.rotation.y = elapsed * 0.025;
    embers.position.y = Math.sin(elapsed * 0.18) * 0.12;
  }
  return { update, flakes, embers };
}
