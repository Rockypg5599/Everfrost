import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { assetUrl, getKtx2Loader, resolveAssetPrefix } from './assets.js';

const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

function makeReflectionEnvironment(scene) {
  if (scene.environment) return;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const context = canvas.getContext('2d');
  const sky = context.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#172738'); sky.addColorStop(0.46, '#8c9ca0');
  sky.addColorStop(0.53, '#e4c998'); sky.addColorStop(0.6, '#697b84'); sky.addColorStop(1, '#101c28');
  context.fillStyle = sky; context.fillRect(0, 0, 512, 256);
  context.filter = 'blur(16px)';
  for (const [x, y, width, height, color] of [
    [46, 112, 48, 12, 'rgba(255,224,163,.72)'], [152, 126, 32, 8, 'rgba(255,240,206,.58)'],
    [281, 108, 56, 10, 'rgba(255,207,132,.68)'], [424, 122, 38, 8, 'rgba(233,242,250,.52)'],
    [355, 74, 20, 20, 'rgba(255,244,211,.6)']
  ]) { context.fillStyle = color; context.fillRect(x, y, width, height); }
  context.filter = 'none';
  const environment = new THREE.CanvasTexture(canvas);
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.colorSpace = THREE.SRGBColorSpace;
  environment.needsUpdate = true;
  scene.environment = environment;
  scene.environmentIntensity = 0.85;
}

function addSpruceNeedleShader(material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEverfrostWorldPosition;\nvarying vec3 vEverfrostWorldNormal;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
vEverfrostWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );
#ifdef USE_INSTANCING
  vEverfrostWorldNormal = normalize( mat3( modelMatrix * instanceMatrix ) * objectNormal );
#endif`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vEverfrostWorldPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
#ifdef USE_INSTANCING
  vEverfrostWorldPosition = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
#endif`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vEverfrostWorldPosition;
varying vec3 vEverfrostWorldNormal;
float everfrostHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float everfrostNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(everfrostHash(i), everfrostHash(i + vec3(1,0,0)), f.x),
                 mix(everfrostHash(i + vec3(0,1,0)), everfrostHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(everfrostHash(i + vec3(0,0,1)), everfrostHash(i + vec3(1,0,1)), f.x),
                 mix(everfrostHash(i + vec3(0,1,1)), everfrostHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float everfrostCanopyNoise = everfrostNoise(vEverfrostWorldPosition * vec3(2.1, 3.8, 2.1));
float everfrostSnowNoise = everfrostNoise(vEverfrostWorldPosition * vec3(8.0, 15.0, 8.0));
float everfrostSnowMask = smoothstep(0.74, 0.93, vEverfrostWorldNormal.y + (everfrostSnowNoise - 0.5) * 0.28)
  * smoothstep(0.58, 0.79, everfrostSnowNoise);
diffuseColor.rgb *= mix(0.9, 1.14, everfrostCanopyNoise);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.7, 0.77), everfrostSnowMask * 0.52);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * mix(1.12, 0.88, everfrostCanopyNoise), 0.58, 1.0);
roughnessFactor = mix(roughnessFactor, 0.96, everfrostSnowMask);`)
      .replace('vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;', `vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
float everfrostBacklight = pow(max(dot(-normalize(normal), normalize(mat3(viewMatrix) * vec3(-0.12, 0.72, 0.68))), 0.0), 2.0);
totalDiffuse += diffuseColor.rgb * vec3(0.032, 0.064, 0.036) * everfrostBacklight * mix(0.76, 1.24, everfrostCanopyNoise);`);
  };
  material.customProgramCacheKey = () => 'everfrost-spruce-needle-pbr-v1';
}

function addInstance(mesh, index, position, direction, scale, color = null) {
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  mesh.setMatrixAt(index, new THREE.Matrix4().compose(position, quaternion, scale));
  if (color) mesh.setColorAt(index, color);
}

function createFallbackTree() {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 8.7, 10), new THREE.MeshStandardMaterial({ color: 0x443327, roughness: 0.93 }));
  trunk.position.y = 4.35;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);
  const greens = [0x103d2e, 0x174a36, 0x20543d, 0x294d39].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.88, flatShading: false }));
  for (let tier = 0; tier < 13; tier++) {
    const t = tier / 13;
    const y = 0.9 + t * 7.55;
    const radius = 2.8 * Math.pow(1 - t, 0.82) + 0.12;
    const bough = new THREE.Mesh(new THREE.ConeGeometry(radius, 1.65 - t * 0.55, 18, 3), greens[tier % greens.length]);
    bough.position.y = y;
    bough.rotation.y = tier * 0.71;
    bough.castShadow = true;
    bough.receiveShadow = true;
    tree.add(bough);
  }
  return tree;
}

export function createChristmasTree(scene, renderer) {
  const root = new THREE.Group();
  scene.add(root);
  const fallback = createFallbackTree();
  root.add(fallback);

  // Authored CC0 Norway spruce with real branch geometry, PBR textures, and
  // compressed needle alpha/normal maps. A single coherent model replaces the
  // visibly procedural cone/needle experiments.
  const loader = new GLTFLoader();
  const modelReady = resolveAssetPrefix().then(prefix => new Promise(resolve => {
    const ktx2 = getKtx2Loader(prefix, renderer);
    loader.setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
    const modelUrl = assetUrl(prefix, 'norway-spruce-lod0.glb');
    loader.load(modelUrl, gltf => {
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const scale = 10.1 / size.y;
      model.scale.set(scale * 2.05, scale, scale * 2.05);
      model.position.set(0, -bounds.min.y * scale, 0);
      model.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = object.name !== 'needles';
        object.receiveShadow = false;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          material.envMapIntensity = 0.45;
          material.roughness = Math.max(material.roughness ?? 0.7, 0.68);
          if (material.name === 'spruce_needles' || object.name === 'needles') {
            material.color.multiplyScalar(1.38);
            material.emissive = new THREE.Color(0x183321);
            material.emissiveIntensity = 0.2;
            material.alphaTest = 0.34;
            material.alphaToCoverage = true;
            addSpruceNeedleShader(material);
          }
          material.needsUpdate = true;
        }
      });
      root.add(model);
      fallback.visible = false;
      scene.userData.everfrostAddForest?.(model);
      scene.userData.everfrostRefreshShadows?.();
      resolve(model);
    }, undefined, error => {
      console.error('Everfrost spruce asset failed to load; keeping visible fallback:', error);
      resolve(fallback);
    });
  }));

  const lights = new THREE.Group();
  const strandPoints = [];
  const lightCount = 156;
  const lightMaterials = [0xffce75, 0xffb84e, 0xffe7b0].map(color => new THREE.MeshBasicMaterial({ color }));
  const lightGeometry = new THREE.SphereGeometry(0.052, 8, 6);
  const lightPhases = new Float32Array(lightCount);
  for (let i = 0; i <= lightCount; i++) {
    const t = i / lightCount;
    const y = 0.68 + t * 9.25;
    const radius = 3.35 * Math.pow(1 - t, 0.8) + 0.035;
    const angle = t * TAU * 5.35;
    strandPoints.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
  }
  const strandCurve = new THREE.CatmullRomCurve3(strandPoints);
  const strand = new THREE.Mesh(
    new THREE.TubeGeometry(strandCurve, 260, 0.018, 4, false),
    new THREE.MeshStandardMaterial({ color: 0x92754c, roughness: 0.72, metalness: 0.38 })
  );
  lights.add(strand);
  const bulbs = new THREE.InstancedMesh(lightGeometry, lightMaterials[0], lightCount);
  bulbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bulbs.castShadow = false;
  const bulbDummy = new THREE.Object3D();
  for (let i = 0; i < lightCount; i++) {
    const position = strandPoints[i];
    lightPhases[i] = rand(0, TAU);
    bulbDummy.position.copy(position);
    bulbDummy.updateMatrix();
    bulbs.setMatrixAt(i, bulbDummy.matrix);
    bulbs.setColorAt(i, lightMaterials[i % lightMaterials.length].color);
  }
  bulbs.instanceMatrix.needsUpdate = true;
  if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
  lights.add(bulbs);
  root.add(lights);

  const ornaments = new THREE.Group();
  const ornamentMats = [0xb78c4b, 0x9b3340, 0xe6d3a7, 0x315643].map(color => new THREE.MeshPhysicalMaterial({ color, metalness: 0.76, roughness: 0.19, clearcoat: 1, clearcoatRoughness: 0.1, emissive: color, emissiveIntensity: 0.015 }));
  const ornamentGeometry = new THREE.SphereGeometry(1, 16, 12);
  const ornamentMeshes = ornamentMats.map((material, index) => {
    const mesh = new THREE.InstancedMesh(ornamentGeometry, material, 7);
    mesh.name = `Tree ornaments ${index}`;
    mesh.castShadow = false;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    ornaments.add(mesh);
    return mesh;
  });
  const ornamentCounts = new Array(ornamentMeshes.length).fill(0);
  for (let i = 0; i < 28; i++) {
    const t = 0.08 + Math.random() * 0.84;
    const y = 1.55 + t * 7.4;
    const radius = 3.12 * Math.pow(1 - t, 0.8);
    const angle = Math.random() * TAU;
    const size = rand(0.065, 0.12);
    const groupIndex = i % ornamentMeshes.length;
    const instanceIndex = ornamentCounts[groupIndex]++;
    bulbDummy.position.set(Math.cos(angle) * radius * rand(0.91, 1.04), y, Math.sin(angle) * radius * rand(0.91, 1.04));
    bulbDummy.scale.setScalar(size);
    bulbDummy.updateMatrix();
    ornamentMeshes[groupIndex].setMatrixAt(instanceIndex, bulbDummy.matrix);
  }
  ornamentMeshes.forEach((mesh, index) => {
    mesh.count = ornamentCounts[index];
    mesh.instanceMatrix.needsUpdate = true;
  });


  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * TAU - Math.PI / 2;
    const radius = i % 2 === 0 ? 0.48 : 0.21;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    i === 0 ? starShape.moveTo(x, y) : starShape.lineTo(x, y);
  }
  starShape.closePath();
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.12, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.035, bevelThickness: 0.035 }), new THREE.MeshPhysicalMaterial({ color: 0xf0d58c, emissive: 0xc08c37, emissiveIntensity: 0.5, metalness: 0.68, roughness: 0.19, clearcoat: 0.7 }));
  star.position.set(0, 10.62, 0);
  root.add(star);
  const starLight = new THREE.PointLight(0xffd77f, 2.1, 8, 2);
  starLight.position.set(0, 10.82, 0);
  root.add(starLight);
  const treeLight = new THREE.SpotLight(0xffe8c6, 13, 24, 0.88, 0.7, 1.2);
  treeLight.position.set(-1.4, 11.2, 10.5);
  treeLight.target.position.set(0, 4.7, 0);
  root.add(treeLight, treeLight.target);

  function update(time, wind, prefs) {
    if (prefs.animationsEnabled && !prefs.reducedMotion) {
      root.rotation.z = Math.sin(time * 0.4) * 0.001 + wind * 0.0008;
      root.rotation.x = Math.sin(time * 0.27) * 0.0008;
      for (let i = 0; i < lightCount; i++) {
        bulbDummy.position.copy(strandPoints[i]);
        bulbDummy.scale.setScalar(0.84 + 0.16 * Math.sin(time * 1.25 + lightPhases[i]));
        bulbDummy.updateMatrix();
        bulbs.setMatrixAt(i, bulbDummy.matrix);
      }
      bulbs.instanceMatrix.needsUpdate = true;
      star.rotation.y = Math.sin(time * 0.22) * 0.035;
    }
  }
  return { root, modelReady, lights, ornaments, star, update };
}