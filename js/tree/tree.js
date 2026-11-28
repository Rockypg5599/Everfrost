import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

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
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvEverfrostWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvEverfrostWorldPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');

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
float everfrostSnowMask = smoothstep(0.76, 0.94, vEverfrostWorldNormal.y + (everfrostSnowNoise - 0.5) * 0.34)
  * smoothstep(0.54, 0.76, everfrostSnowNoise);
diffuseColor.rgb *= mix(0.88, 1.12, everfrostCanopyNoise);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.58, 0.67, 0.73), everfrostSnowMask * 0.64);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * mix(1.12, 0.88, everfrostCanopyNoise), 0.58, 1.0);
roughnessFactor = mix(roughnessFactor, 0.96, everfrostSnowMask);`)
      .replace('vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;', `vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
float everfrostBacklight = pow(max(dot(-normalize(normal), normalize(mat3(viewMatrix) * vec3(-0.12, 0.72, 0.68))), 0.0), 2.0);
totalDiffuse += diffuseColor.rgb * vec3(0.022, 0.045, 0.025) * everfrostBacklight * mix(0.72, 1.22, everfrostCanopyNoise);`);
  };
  material.customProgramCacheKey = () => 'everfrost-spruce-needle-pbr-v1';
}

function addInstance(mesh, index, position, direction, scale, color = null) {
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  mesh.setMatrixAt(index, new THREE.Matrix4().compose(position, quaternion, scale));
  if (color) mesh.setColorAt(index, color);
}

export function createChristmasTree(scene, renderer) {
  makeReflectionEnvironment(scene);
  const root = new THREE.Group();
  scene.add(root);

  // Authored CC0 Norway spruce with real branch geometry, PBR textures, and
  // compressed needle alpha/normal maps. A single coherent model replaces the
  // visibly procedural cone/needle experiments.
  const loader = new GLTFLoader();
  const ktx2 = new KTX2Loader()
    .setTranscoderPath(new URL('./assets/basis/', document.baseURI).href)
    .detectSupport(renderer);
  loader.setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  const modelUrl = new URL('./assets/norway-spruce-lod0.glb', document.baseURI);
  const modelReady = new Promise(resolve => {
    loader.load(modelUrl.href, gltf => {
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const scale = 10.1 / size.y;
      model.scale.set(scale * 1.95, scale, scale * 1.95);
      model.position.set(0, -bounds.min.y * scale, 0);
      model.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = false;
        object.receiveShadow = false;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          material.envMapIntensity = 0.45;
          material.roughness = Math.max(material.roughness ?? 0.7, 0.68);
          if (material.name === 'spruce_needles' || object.name === 'needles') {
            material.color.multiplyScalar(1.8);
            material.emissive = new THREE.Color(0x24482a);
            material.emissiveIntensity = 0.32;
            addSpruceNeedleShader(material);
          }
          material.needsUpdate = true;
        }
      });
      root.add(model);
      ktx2.dispose();
      resolve(model);
    }, undefined, error => {
      console.error('Everfrost spruce asset failed to load:', error);
      ktx2.dispose();
      resolve(null);
    });
  });

  const lights = new THREE.Group();
  const lightMaterials = [0xffd88c, 0xffbd58, 0xffedc1].map(color => new THREE.MeshBasicMaterial({ color }));
  const lightGeometry = new THREE.SphereGeometry(0.035, 10, 8);
  for (let i = 0; i < 96; i++) {
    const t = i / 96;
    const y = 0.8 + t * 8.9;
    const radius = 2.1 * Math.pow(1 - t, 0.78);
    const angle = t * TAU * 5.4 + rand(-0.22, 0.22);
    const bulb = new THREE.Mesh(lightGeometry, lightMaterials[i % lightMaterials.length]);
    bulb.position.set(Math.cos(angle) * radius * 0.98, y, Math.sin(angle) * radius * 0.98);
    bulb.userData.phase = rand(0, TAU);
    lights.add(bulb);
  }
  root.add(lights);

  const ornaments = new THREE.Group();
  const ornamentMats = [0xb78c4b, 0x9b3340, 0xe6d3a7, 0x315643].map(color => new THREE.MeshPhysicalMaterial({ color, metalness: 0.76, roughness: 0.19, clearcoat: 1, clearcoatRoughness: 0.1, emissive: color, emissiveIntensity: 0.015 }));
  const ornamentGeometry = new THREE.SphereGeometry(1, 28, 20);
  for (let i = 0; i < 28; i++) {
    const t = 0.08 + Math.random() * 0.84;
    const y = 1.55 + t * 7.4;
    const radius = 2.08 * Math.pow(1 - t, 0.78);
    const angle = Math.random() * TAU;
    const size = rand(0.065, 0.12);
    const ornament = new THREE.Mesh(ornamentGeometry, ornamentMats[i % ornamentMats.length]);
    ornament.position.set(Math.cos(angle) * radius * rand(0.88, 1.03), y, Math.sin(angle) * radius * rand(0.88, 1.03));
    ornament.scale.setScalar(size);
    ornament.castShadow = true;
    ornaments.add(ornament);
  }
  root.add(ornaments);

  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * TAU - Math.PI / 2;
    const radius = i % 2 === 0 ? 0.48 : 0.21;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    i === 0 ? starShape.moveTo(x, y) : starShape.lineTo(x, y);
  }
  starShape.closePath();
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.12, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.035, bevelThickness: 0.035 }), new THREE.MeshPhysicalMaterial({ color: 0xf0d58c, emissive: 0xc08c37, emissiveIntensity: 0.5, metalness: 0.68, roughness: 0.19, clearcoat: 0.7 }));
  star.position.set(0, 10.22, 0);
  root.add(star);
  const starLight = new THREE.PointLight(0xffd77f, 3.6, 9, 2);
  starLight.position.set(0, 10.42, 0);
  root.add(starLight);
  const treeLight = new THREE.SpotLight(0xffe8c6, 27, 27, 0.88, 0.7, 1.2);
  treeLight.position.set(-1.4, 11.2, 10.5);
  treeLight.target.position.set(0, 4.7, 0);
  root.add(treeLight, treeLight.target);

  function update(time, wind, prefs) {
    if (prefs.animationsEnabled && !prefs.reducedMotion) {
      root.rotation.z = Math.sin(time * 0.4) * 0.001 + wind * 0.0008;
      root.rotation.x = Math.sin(time * 0.27) * 0.0008;
      for (const bulb of lights.children) bulb.scale.setScalar(0.84 + 0.16 * Math.sin(time * 1.25 + bulb.userData.phase));
      star.rotation.y = Math.sin(time * 0.22) * 0.035;
    }
  }
  return { root, modelReady, lights, ornaments, star, update };
}