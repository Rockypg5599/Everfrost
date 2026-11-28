import * as THREE from 'three';

// Keeps the moon's sky position tied to the real date/time and lunar phase,
// while the authored scene remains permanent twilight.
export function createMoon(scene) {
  const group = new THREE.Group();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 24), new THREE.MeshStandardMaterial({ color: 0xf5edda, roughness: 0.82, emissive: 0x7c8791, emissiveIntensity: 0.13 }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xe7dfcb, transparent: true, opacity: 0.12, depthWrite: false }));
  glow.scale.set(6, 6, 1);
  group.add(glow, moon);
  scene.add(group);
  const light = new THREE.DirectionalLight(0xb6cae0, 1.2);
  scene.add(light);
  const update = () => {
    const now = new Date();
    const day = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(2000, 0, 6)) / 86400000);
    const phase = ((day % 29.530588853) + 29.530588853) % 29.530588853 / 29.530588853;
    const hours = now.getUTCHours() + now.getUTCMinutes() / 60;
    // Real-time hour moves the moon around the celestial arc; deliberately never below the twilight horizon.
    const angle = (hours / 24) * Math.PI * 2 - Math.PI / 2;
    const azimuth = phase * Math.PI * 2;
    const position = new THREE.Vector3(Math.cos(angle) * 34, 24 + Math.sin(angle) * 9, Math.sin(azimuth) * 30 - 12);
    group.position.copy(position);
    light.position.copy(position);
    light.target.position.set(0, 0, 0);
    scene.add(light.target);
    // Approximate the waxing/waning terminator with a subtle phase-dependent emissive intensity.
    moon.material.emissiveIntensity = 0.06 + Math.abs(Math.cos(phase * Math.PI * 2)) * 0.12;
  };
  update();
  return { group, light, update };
}
