import * as THREE from 'three';
import { createMoon } from './astronomy.js';

const rand = (a, b) => a + Math.random() * (b - a);

function makeTerrainMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#dbe4e9'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 15000; i++) {
    const shade = Math.random() > 0.52 ? 255 : 130;
    ctx.fillStyle = `rgba(${shade},${shade + (shade === 130 ? 18 : 0)},${shade + (shade === 130 ? 25 : 0)},${Math.random() * 0.075})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, rand(1, 3), rand(1, 3));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createEnvironment(scene) {
  scene.background = null;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(110, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vWorldPosition; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldPosition=worldPosition.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vWorldPosition; void main(){ float h=normalize(vWorldPosition).y; vec3 zenith=vec3(0.018,0.045,0.095); vec3 mid=vec3(0.055,0.13,0.21); vec3 horizon=vec3(0.12,0.20,0.25); float t=smoothstep(-0.12,0.72,h); vec3 c=mix(horizon,mid,smoothstep(-0.12,0.28,h)); c=mix(c,zenith,smoothstep(0.28,0.86,h)); gl_FragColor=vec4(c,1.0); }'
  }));
  sky.renderOrder = -10; scene.add(sky);
  scene.fog = new THREE.FogExp2(0x172a38, 0.012);
  const groundGeo = new THREE.PlaneGeometry(150, 150, 96, 96);
  const positions = groundGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    const hill = Math.sin(x * 0.085) * Math.cos(y * 0.07) * 0.32 + Math.sin(x * 0.21 + y * 0.13) * 0.11;
    positions.setZ(i, hill);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: makeTerrainMaterial(), color: 0xcddbe2, roughness: 0.94, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  scene.add(ground);

  const mountainMats = [0x172a38, 0x1d3341, 0x243b48].map(color => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  for (let range = 0; range < 3; range++) {
    const radius = range === 0 ? 10 : range === 1 ? 7 : 5;
    const count = 13 + range * 3;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand(-0.08, 0.08);
      const distance = 37 + range * 8 + rand(-3, 3);
      const height = rand(7, 15) * (range === 2 ? 0.7 : 1);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(radius * rand(0.55, 1), height, 6 + range, 1), mountainMats[range]);
      peak.position.set(Math.cos(angle) * distance, height / 2 - 1, Math.sin(angle) * distance);
      peak.rotation.y = rand(0, 1);
      scene.add(peak);
      if (range === 0) {
        const snowcap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.2, height * 0.24, 6, 1), new THREE.MeshStandardMaterial({ color: 0xbacbd3, roughness: 1, flatShading: true }));
        snowcap.position.set(peak.position.x, height * 0.9 - 1, peak.position.z);
        scene.add(snowcap);
      }
    }
  }

  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x46545a, roughness: 0.96, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xdce5e7, roughness: 1 });
  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * Math.PI * 2, distance = rand(5.2, 17);
    const size = rand(0.25, 0.95);
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(Math.cos(angle) * distance, size * 0.35 - 0.1, Math.sin(angle) * distance);
    rock.scale.set(size * rand(0.8, 1.5), size * 0.7, size);
    rock.rotation.set(rand(0, 1), rand(0, 2), rand(0, 1));
    rock.castShadow = true; rock.receiveShadow = true; scene.add(rock);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(size * 0.68, 9, 6), snowMat);
    cap.scale.y = 0.22;
    cap.position.set(rock.position.x, rock.position.y + size * 0.55, rock.position.z);
    scene.add(cap);
  }

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x322b25, roughness: 1 });
  const greens = [0x112c25, 0x16382c, 0x1c4032];
  for (let i = 0; i < 44; i++) {
    const angle = Math.random() * Math.PI * 2, distance = rand(11, 32);
    const height = rand(4.4, 8.7), r = height * rand(0.14, 0.23);
    const tree = new THREE.Group();
    tree.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
    tree.rotation.y = Math.random() * Math.PI;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, height * 0.28, 7), trunkMat);
    trunk.position.y = height * 0.14; tree.add(trunk);
    for (let tier = 0; tier < 4; tier++) {
      const coneHeight = height * (0.4 - tier * 0.035), coneR = r * (1 - tier * 0.22);
      const bough = new THREE.Mesh(new THREE.ConeGeometry(coneR, coneHeight, 7, 1), new THREE.MeshStandardMaterial({ color: greens[(i + tier) % greens.length], roughness: 0.96, flatShading: true }));
      bough.position.y = height * 0.28 + tier * height * 0.15;
      bough.castShadow = true; tree.add(bough);
    }
    scene.add(tree);
  }

  // Aurora is represented as layered translucent ribbons in the permanent twilight sky.
  const auroraGroup = new THREE.Group();
  const colors = [0x3e9c87, 0x4b77a0, 0xa17c52];
  for (let band = 0; band < 3; band++) {
    const points = [];
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48 - 0.5) * 85;
      const y = 16 + Math.sin(i * 0.16 + band) * 2.5 + band * 2;
      points.push(new THREE.Vector3(x, y, -46 + band * 3));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: colors[band], transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geometry, material);
    auroraGroup.add(line);
  }
  scene.add(auroraGroup);

  // A broad, low-power hemisphere preserves a readable twilight sky without a visible sun.
  const hemi = new THREE.HemisphereLight(0x9bb9d4, 0x26302d, 1.1);
  scene.add(hemi);
  const astronomicalMoon = createMoon(scene);
  const moonLight = astronomicalMoon.light;
  moonLight.intensity = 1.8;
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.left = -22; moonLight.shadow.camera.right = 22; moonLight.shadow.camera.top = 25; moonLight.shadow.camera.bottom = -20;
  const fill = new THREE.PointLight(0xe4b76c, 0.75, 28, 2);
  fill.position.set(0, 5, 5); scene.add(fill);

  const starCount = 650;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 100;
    starPos[i * 3 + 1] = rand(12, 48);
    starPos[i * 3 + 2] = -40 - Math.random() * 20;
  }
  const starsGeo = new THREE.BufferGeometry(); starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xf4e7c6, size: 0.12, transparent: true, opacity: 0.8, sizeAttenuation: true }));
  scene.add(stars);
  return { ground, auroraGroup, stars, moonLight, moon: astronomicalMoon, update(time, prefs) {
    if (prefs.animationsEnabled && !prefs.reducedMotion) {
      auroraGroup.position.x = Math.sin(time * 0.04) * 1.8;
      auroraGroup.rotation.y = Math.sin(time * 0.035) * 0.025;
      stars.rotation.y = time * 0.001;
    }
  } };
}
