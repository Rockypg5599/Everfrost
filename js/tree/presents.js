import * as THREE from 'three';
import { SURPRISES } from './discoveries.js';

const boxes = [
  { id: 'lucia-light', size: [1.22, 0.78, 1.02], color: 0x8f2934, ribbon: 0xc9a45f, pos: [-2.75, 0, 0.5], rot: 0.24 },
  { id: 'north-star', size: [0.88, 1.25, 0.82], color: 0x174333, ribbon: 0xd5bd84, pos: [2.15, 0, 1.6], rot: -0.18 },
  { id: 'winter-letter', size: [1.42, 0.65, 0.9], color: 0xb58b4d, ribbon: 0x7e2731, pos: [0.9, 0, 3.45], rot: 0.36 },
  { id: 'little-world', size: [0.93, 0.74, 0.92], color: 0xeee4ce, ribbon: 0x234534, pos: [-1.65, 0, 3.25], rot: -0.3 }
];

function addBow(parent, x, y, z, material, scale = 1) {
  for (const side of [-1, 1]) {
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.2, 0.16, 0.06), new THREE.Vector3(side * 0.42, 0.1, 0.015), new THREE.Vector3(side * 0.35, -0.1, -0.04), new THREE.Vector3(0, 0, 0)];
    const curve = new THREE.CatmullRomCurve3(points);
    const loop = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.038, 7, false), material);
    loop.position.set(x, y, z); loop.scale.setScalar(scale); loop.castShadow = true; parent.add(loop);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 10, 8), material);
  knot.position.set(x, y, z); parent.add(knot);
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09 * scale, 0.36 * scale, 0.035), material);
    tail.position.set(x + side * 0.12 * scale, y - 0.2 * scale, z);
    tail.rotation.z = side * 0.18; parent.add(tail);
  }
}

function createGift(def) {
  const group = new THREE.Group();
  group.position.set(...def.pos);
  group.rotation.y = def.rot;
  group.userData.presentId = def.id;
  const [w, h, d] = def.size;
  const wrap = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.42, metalness: 0.13 });
  const ribbon = new THREE.MeshStandardMaterial({ color: def.ribbon, roughness: 0.28, metalness: 0.52 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wrap);
  body.position.y = h / 2 + 0.05; body.castShadow = true; body.receiveShadow = true; group.add(body);
  const lid = new THREE.Group();
  lid.position.set(0, h + 0.1, -d / 2);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 1.055, 0.18, d * 1.055), wrap);
  lidMesh.position.set(0, 0.09, d / 2); lidMesh.castShadow = true; lid.add(lidMesh);
  const lidRibbon = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, 0.185, 0.1), ribbon);
  lidRibbon.position.set(0, 0.095, d / 2); lid.add(lidRibbon);
  const lidCross = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.19, d * 1.06), ribbon);
  lidCross.position.set(0, 0.095, d / 2); lid.add(lidCross);
  addBow(lid, 0, 0.24, d / 2, ribbon, Math.min(1, w * 0.75));
  group.add(lid);

  const stripeZ = new THREE.Mesh(new THREE.BoxGeometry(w * 1.005, h * 1.002, 0.105), ribbon);
  stripeZ.position.set(0, h / 2 + 0.05, d / 2 + 0.012); group.add(stripeZ);
  const stripeX = new THREE.Mesh(new THREE.BoxGeometry(0.105, h * 1.002, d * 1.005), ribbon);
  stripeX.position.set(w / 2 + 0.012, h / 2 + 0.05, 0); group.add(stripeX);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6), ribbon);
  bottom.position.set(0, h + 0.11, d / 2); lid.add(bottom);
  const pick = new THREE.Mesh(new THREE.BoxGeometry(w * 1.16, h + 0.52, d * 1.16), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  pick.position.y = (h + 0.52) / 2 + 0.08; group.add(pick);
  group.userData = { presentId: def.id, lid, wrap, ribbon, pick, isOpen: false, originalY: group.position.y };
  group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
  return group;
}

export function createPresents(scene) {
  const presents = boxes.map(createGift);
  presents.forEach(item => scene.add(item));
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.12;
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  let active = null;
  let onSelect = () => {};
  let hovered = null;

  function pick(event, camera, renderer) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(presents, true);
    return hits.map(hit => {
      let node = hit.object;
      while (node && !node.userData.presentId) node = node.parent;
      return node;
    }).find(Boolean) || null;
  }
  function pointerMove(event, camera, renderer) {
    const hit = pick(event, camera, renderer);
    if (hit !== hovered) {
      if (hovered) hovered.scale.setScalar(1);
      hovered = hit;
      if (hovered) hovered.scale.setScalar(1.045);
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    }
  }
  function click(event, camera, renderer) {
    const hit = pick(event, camera, renderer);
    if (!hit) return false;
    open(hit);
    return true;
  }
  function open(present) {
    if (active && active !== present) close(active);
    active = present;
    present.userData.isOpen = true;
    present.userData.openFromRotation = present.userData.lid.rotation.x;
    present.userData.openFromY = present.userData.lid.position.y;
    present.userData.openStart = performance.now();
    const details = SURPRISES.find(item => item.id === present.userData.presentId);
    onSelect(details, present);
  }
  function close(present = active) {
    if (!present) return;
    present.userData.isOpen = false;
    present.userData.closeFromRotation = present.userData.lid.rotation.x;
    present.userData.closeFromY = present.userData.lid.position.y;
    present.userData.closeStart = performance.now();
    if (active === present) active = null;
  }
  function update() {
    const now = performance.now();
    for (const present of presents) {
      const data = present.userData;
      const opening = data.isOpen;
      const start = opening ? data.openStart : data.closeStart;
      if (!start) continue;
      const raw = Math.min(1, (now - start) / 720);
      const eased = raw * raw * (3 - 2 * raw);
      data.lid.originalRotationX ??= data.lid.rotation.x;
      data.lid.originalY ??= data.lid.position.y;
      const fromRotation = opening ? data.openFromRotation : data.closeFromRotation;
      const fromY = opening ? data.openFromY : data.closeFromY;
      const toRotation = data.lid.originalRotationX + (opening ? -0.72 : 0);
      const toY = data.lid.originalY + (opening ? 0.72 : 0);
      data.lid.rotation.x = fromRotation + (toRotation - fromRotation) * eased;
      data.lid.position.y = fromY + (toY - fromY) * eased;
      if (opening && raw < 0.4) present.position.y = Math.sin(eased * Math.PI) * 0.08;
      else present.position.y = 0;
      if (raw >= 1 && !opening) data.closeStart = null;
      if (raw >= 1 && opening) data.openStart = null;
    }
  }
  return { presents, pointerMove, click, open, close, update, setOnSelect(fn) { onSelect = fn; }, getActive() { return active; } };
}
