import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);

export function createChristmasTree(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const foliage = new THREE.Group();
  root.add(foliage);
  const greens = [0x12392e, 0x164332, 0x1b4936, 0x20503a, 0x143c32];
  const branchMat = greens.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.02 }));
  const branchGeo = new THREE.ConeGeometry(1, 1, 8, 1);
  for (let tier = 0; tier < 11; tier++) {
    const y = 1.3 + tier * 0.76;
    const radius = 3.15 * (1 - tier / 12.2);
    const layer = new THREE.Group();
    layer.position.y = y;
    const branchCount = 13 + Math.round(radius * 3);
    for (let i = 0; i < branchCount; i++) {
      const angle = (i / branchCount) * Math.PI * 2 + (tier % 2) * 0.13 + rand(-0.1, 0.1);
      const length = radius * rand(0.78, 1.04);
      const branch = new THREE.Mesh(branchGeo, branchMat[(i + tier * 3) % branchMat.length]);
      branch.position.set(Math.cos(angle) * length * 0.3, rand(-0.12, 0.08), Math.sin(angle) * length * 0.3);
      branch.scale.set(length * 0.7, rand(0.3, 0.43), length * rand(0.42, 0.62));
      branch.rotation.z = -Math.cos(angle) * rand(0.16, 0.32);
      branch.rotation.x = Math.sin(angle) * rand(0.14, 0.3);
      branch.rotation.y = -angle;
      branch.castShadow = tier < 8;
      branch.receiveShadow = true;
      layer.add(branch);
    }
    // Dense inner bough volume gives the branch silhouette a fuller, less geometric core.
    const inner = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.76, 1.38, 14), branchMat[(tier + 1) % branchMat.length]);
    inner.position.y = 0.08;
    layer.add(inner);
    foliage.add(layer);
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 3.6, 10), new THREE.MeshStandardMaterial({ color: 0x39291e, roughness: 1 }));
  trunk.position.y = 1.45;
  trunk.castShadow = true;
  root.add(trunk);

  const lights = new THREE.Group();
  const lightMaterials = [0xffe2a0, 0xffcc73, 0xfff1c7].map(color => new THREE.MeshBasicMaterial({ color }));
  const lightGeometry = new THREE.SphereGeometry(0.055, 7, 6);
  for (let i = 0; i < 220; i++) {
    const t = i / 220;
    const y = 1.45 + t * 8.05;
    const r = 3.0 * (1 - t) + 0.12;
    const angle = t * Math.PI * 2 * 7.2 + rand(-0.18, 0.18);
    const bulb = new THREE.Mesh(lightGeometry, lightMaterials[i % 3]);
    bulb.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
    bulb.userData.phase = rand(0, Math.PI * 2);
    lights.add(bulb);
  }
  root.add(lights);

  const ornaments = new THREE.Group();
  const ornamentMats = [0xb78c4b, 0x9b3340, 0xe6d3a7, 0x315643].map(color => new THREE.MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.22, emissive: color, emissiveIntensity: 0.05 }));
  for (let i = 0; i < 56; i++) {
    const t = 0.1 + Math.random() * 0.8;
    const y = 1.7 + t * 7.1;
    const r = 2.9 * (1 - t) + 0.13;
    const angle = Math.random() * Math.PI * 2;
    const size = rand(0.075, 0.15);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), ornamentMats[i % ornamentMats.length]);
    ball.position.set(Math.cos(angle) * r * rand(0.78, 1), y, Math.sin(angle) * r * rand(0.78, 1));
    ball.castShadow = true;
    ornaments.add(ball);
  }
  root.add(ornaments);

  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 0.48 : 0.21;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i === 0 ? starShape.moveTo(x, y) : starShape.lineTo(x, y);
  }
  starShape.closePath();
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.12, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.035, bevelThickness: 0.035 }), new THREE.MeshStandardMaterial({ color: 0xf0d58c, emissive: 0xc08c37, emissiveIntensity: 1.15, metalness: 0.55, roughness: 0.2 }));
  star.position.set(0, 10.12, 0);
  root.add(star);
  const starLight = new THREE.PointLight(0xffd77f, 4.2, 9, 2);
  starLight.position.set(0, 10.35, 0);
  root.add(starLight);
  const treeLight = new THREE.PointLight(0xffcf80, 1.4, 15, 2);
  treeLight.position.set(0, 5.2, 0);
  root.add(treeLight);

  const boughPivots = [];
  for (let i = 0; i < 7; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 2.2 + i * 1.05, 0);
    root.add(pivot);
    boughPivots.push(pivot);
  }
  function update(time, wind, prefs) {
    if (!prefs.animationsEnabled || prefs.reducedMotion) { foliage.rotation.z = 0; return; }
    foliage.rotation.z = Math.sin(time * 0.4) * 0.008 + wind * 0.004;
    foliage.rotation.x = Math.sin(time * 0.27) * 0.006;
    for (const bulb of lights.children) {
      const shimmer = 0.7 + 0.3 * Math.sin(time * 1.35 + bulb.userData.phase);
      bulb.scale.setScalar(shimmer);
    }
    star.rotation.y = Math.sin(time * 0.22) * 0.035;
  }
  return { root, foliage, lights, ornaments, star, update };
}
