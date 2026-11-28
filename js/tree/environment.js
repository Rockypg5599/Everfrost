import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { assetUrl, getKtx2Loader, resolveAssetPrefix } from './assets.js';

const rand = (a, b) => a + Math.random() * (b - a);

function snowHeightAt(x, z) {
  const broad = Math.sin(x * 0.043 + z * 0.028) * Math.cos(z * 0.037 - x * 0.016) * 0.62
    + Math.sin(x * 0.021 - z * 0.052) * 0.38;
  const drift = Math.sin(x * 0.13 + z * 0.085 + Math.sin(z * 0.04) * 1.5) * 0.19
    + Math.cos(z * 0.17 - x * 0.06) * 0.11;
  const irregular = Math.sin(x * 0.37 + z * 0.29) * Math.cos(z * 0.41 - x * 0.18) * 0.055;
  const clearing = Math.exp(-((x * x) / 58 + ((z - 0.5) * (z - 0.5)) / 45));
  const foregroundDrift = Math.exp(-(((x + 5.2) * (x + 5.2)) / 18 + ((z - 7.5) * (z - 7.5)) / 8)) * 0.62
    + Math.exp(-(((x - 6.8) * (x - 6.8)) / 24 + ((z - 5.2) * (z - 5.2)) / 12)) * 0.46
    + Math.exp(-((x * x) / 16 + ((z - 11) * (z - 11)) / 18)) * 0.32;
  return broad + drift + irregular + clearing * 0.13 + foregroundDrift;
}

function makeSky() {
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: `varying vec3 vDirection;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vDirection = normalize(worldPosition.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }`,
    fragmentShader: `uniform float uTime;
      varying vec3 vDirection;
      void main() {
        vec3 direction = normalize(vDirection);
        float h = direction.y;
        float elevation = asin(clamp(h, -1.0, 1.0));
        float azimuth = atan(direction.x, direction.z);
        vec3 zenith = vec3(0.001, 0.003, 0.01);
        vec3 mid = vec3(0.004, 0.01, 0.023);
        vec3 horizon = vec3(0.008, 0.014, 0.027);
        vec3 sky = mix(horizon, mid, smoothstep(-0.22, 0.18, h));
        sky = mix(sky, zenith, smoothstep(0.16, 0.74, h));
        float haze = exp(-pow((h - 0.005) * 18.0, 2.0));
        sky += vec3(0.002, 0.004, 0.009) * haze;

        // Subtle, folded aurora ribbons in the upper sky, built into the sky dome.
        float drift = uTime * 0.018;
        float folds = sin(azimuth * 13.0 + sin(azimuth * 3.0 + drift) * 1.4 + drift * 2.0);
        float curtain = sin(azimuth * 2.0 + sin(azimuth * 3.0 + drift) * 0.8);
        float center = 0.56 + 0.12 * curtain + 0.035 * sin(azimuth * 5.0 + drift);
        float foldedElevation = elevation + folds * 0.055;
        float band = exp(-pow((foldedElevation - center) / 0.13, 2.0));
        float lowerBand = exp(-pow((foldedElevation - center - 0.2) / 0.11, 2.0));
        float core = exp(-pow((foldedElevation - center + 0.012) / 0.032, 2.0));
        float lowerCore = exp(-pow((foldedElevation - center - 0.2) / 0.04, 2.0));
        float variation = 0.62 + 0.38 * (0.5 + 0.5 * sin(azimuth * 6.0 - drift * 2.0 + folds));
        float aurora = (band + lowerBand * 0.32) * variation * smoothstep(0.02, 0.16, h);
        float filaments = (core + lowerCore * 0.48) * variation * smoothstep(0.02, 0.16, h);
        sky += vec3(0.09, 0.42, 0.24) * aurora;
        sky += vec3(0.34, 1.2, 0.68) * filaments;
        sky += vec3(0.035, 0.18, 0.24) * band * band;
        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(145, 48, 32), material);
  sky.renderOrder = -10;
  return sky;
}

function makeStars() {
  const count = 420;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const azimuth = Math.random() * Math.PI * 2;
    const elevation = rand(0.08, 1.48);
    const radius = 125;
    positions[i * 3] = Math.cos(azimuth) * Math.cos(elevation) * radius;
    positions[i * 3 + 1] = Math.sin(elevation) * radius;
    positions[i * 3 + 2] = Math.sin(azimuth) * Math.cos(elevation) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(0xc5d4e2) } },
    vertexShader: `varying float vAlpha;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(1.8 * (95.0 / -viewPosition.z), 0.85, 2.2);
        vAlpha = smoothstep(175.0, 42.0, -viewPosition.z) * 0.78;
      }`,
    fragmentShader: `uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        float edge = 1.0 - smoothstep(0.2, 0.5, radius);
        if (edge <= 0.01) discard;
        gl_FragColor = vec4(uColor, edge * vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  return new THREE.Points(geometry, material);
}

function makeSnowMaterial(renderer) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x596783,
    roughness: 0.97,
    metalness: 0
  });
  resolveAssetPrefix().then(prefix => {
    const loader = getKtx2Loader(prefix, renderer);
    const load = (name, colorSpace) => new Promise((resolve, reject) => {
      loader.load(assetUrl(prefix, `snow/tevy-v1/${name}-1k.ktx2`), texture => {
        texture.colorSpace = colorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(42, 42);
        texture.anisotropy = 8;
        resolve(texture);
      }, undefined, reject);
    });
    return Promise.all([
      load('color', THREE.SRGBColorSpace),
      load('normal', THREE.NoColorSpace),
      load('orm', THREE.NoColorSpace)
    ]).then(([color, normal, orm]) => {
      material.map = color;
      material.normalMap = normal;
      material.normalScale.set(0.12, 0.12);
      material.aoMap = orm;
      material.aoMapIntensity = 0.38;
      material.roughnessMap = orm;
      material.metalnessMap = orm;
      material.needsUpdate = true;
    });
  }).catch(error => console.warn('Everfrost fresh snow textures unavailable:', error));
  return material;
}

export function createEnvironment(scene, renderer) {
  scene.background = new THREE.Color(0x030812);
  const sky = makeSky();
  scene.add(sky, makeStars());

  // CC0 winter HDRI is used only for subdued material lighting/reflections,
  // never as the visible backdrop or a photographic skybox.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  resolveAssetPrefix().then(prefix => new HDRLoader().load(assetUrl(prefix, 'hdris/snowy_forest_path_01_1k.hdr'), hdr => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    hdr.colorSpace = THREE.LinearSRGBColorSpace;
    hdr.needsUpdate = true;
    const filtered = pmrem.fromEquirectangular(hdr);
    scene.environment = filtered.texture;
    scene.environmentIntensity = 0.07;
    scene.userData.everfrostEnvironmentTarget = filtered;
    hdr.dispose();
    pmrem.dispose();
  }, undefined, error => {
    console.error('Everfrost winter HDR failed to load:', error);
    pmrem.dispose();
  })).catch(error => {
    console.error('Everfrost winter HDR asset path could not be resolved:', error);
    pmrem.dispose();
  });

  // Texture normal detail carries the fine surface; keep enough vertices for the broad drifts.
  const groundGeo = new THREE.PlaneGeometry(320, 320, 160, 160);
  const positions = groundGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = -positions.getY(i);
    positions.setZ(i, snowHeightAt(x, z));
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, makeSnowMaterial(renderer));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  scene.add(ground);

  const key = new THREE.DirectionalLight(0x849dcc, 0.34);
  key.position.set(-16, 24, 13);
  key.target.position.set(0, 3, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -19;
  key.shadow.camera.right = 19;
  key.shadow.camera.top = 23;
  key.shadow.camera.bottom = -15;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 65;
  key.shadow.bias = -0.00012;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 3;
  scene.add(key, key.target);

  const fill = new THREE.HemisphereLight(0x536888, 0x131b2a, 0.25);
  scene.add(fill);
  const coolRim = new THREE.DirectionalLight(0x718db7, 0.12);
  coolRim.position.set(12, 10, -15);
  scene.add(coolRim);
  scene.fog = new THREE.FogExp2(0x0b1220, 0.015);

  // Real spruce geometry forms the clearing edge; there is no distant photo plane.
  function addForest(sourceTree) {
    const placements = [];
    // Cluster the distant trees in a shallow camera-facing arc. A circular ring
    // projected most trees outside the frame and left an artificial central knot.
    const clusters = [
      { x: -20, z: -31, count: 4 }, { x: -15, z: -23, count: 4 },
      { x: -9, z: -17, count: 4 }, { x: 0, z: -31, count: 5 },
      { x: 9, z: -17, count: 4 }, { x: 15, z: -23, count: 4 },
      { x: 20, z: -31, count: 4 }
    ];
    for (const cluster of clusters) {
      for (let i = 0; i < cluster.count; i++) {
        const x = cluster.x + rand(-2.6, 2.6);
        const z = cluster.z + rand(-3.6, 3.6);
        placements.push({
          position: new THREE.Vector3(x, -0.1, z),
          rotation: rand(0, Math.PI * 2),
          scale: rand(0.44, 0.68),
          width: rand(0.86, 1.14)
        });
      }
    }
    // A few smaller silhouettes give the far horizon depth without enclosing the clearing.
    for (let i = 0; i < 18; i++) {
      const x = -24 + (i / 17) * 48 + rand(-1.6, 1.6);
      const z = rand(-48, -40);
      placements.push({
        position: new THREE.Vector3(x, -0.15, z),
        rotation: rand(0, Math.PI * 2),
        scale: rand(0.32, 0.48),
        width: rand(0.84, 1.18)
      });
    }

    sourceTree.updateWorldMatrix(true, true);
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const placementMatrix = new THREE.Matrix4();
    const instanceMatrix = new THREE.Matrix4();
    const forestMaterials = new Map();
    const sectorCount = 12;
    const sectors = Array.from({ length: sectorCount }, () => []);
    for (const tree of placements) {
      const angle = Math.atan2(tree.position.z, tree.position.x) + Math.PI;
      const sector = Math.min(sectorCount - 1, Math.floor(angle / (Math.PI * 2) * sectorCount));
      sectors[sector].push(tree);
    }

    sourceTree.traverse(sourceMesh => {
      if (!sourceMesh.isMesh) return;
      const sourceMaterials = Array.isArray(sourceMesh.material) ? sourceMesh.material : [sourceMesh.material];
      const materialKey = sourceMaterials.map(material => material.uuid).join(':');
      let material = forestMaterials.get(materialKey);
      if (!material) {
        // Distant foliage keeps the authored maps but skips the focal tree's
        // per-fragment snow/noise shader. Preserve the same overall forest look.
        const clones = sourceMaterials.map(sourceMaterial => {
          const clone = sourceMaterial.clone();
          clone.onBeforeCompile = () => {};
          clone.customProgramCacheKey = () => 'everfrost-forest-pbr-v1';
          clone.envMapIntensity = Math.min(clone.envMapIntensity ?? 1, 0.28);
          if (clone.name === 'spruce_needles') {
            clone.color.multiplyScalar(1.3);
            clone.emissive = new THREE.Color(0x0b170d);
            clone.emissiveIntensity = 0.22;
          }
          return clone;
        });
        material = Array.isArray(sourceMesh.material) ? clones : clones[0];
        forestMaterials.set(materialKey, material);
      }
      for (let sector = 0; sector < sectors.length; sector++) {
        const group = sectors[sector];
        if (!group.length) continue;
        const instances = new THREE.InstancedMesh(sourceMesh.geometry, material, group.length);
        instances.name = `Everfrost forest ${sector} ${sourceMesh.name || 'spruce mesh'}`;
        instances.castShadow = false;
        instances.receiveShadow = false;
        for (let i = 0; i < group.length; i++) {
          const tree = group[i];
          position.copy(tree.position);
          rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.rotation);
          scale.set(tree.scale * tree.width, tree.scale, tree.scale * tree.width);
          placementMatrix.compose(position, rotation, scale);
          instanceMatrix.multiplyMatrices(placementMatrix, sourceMesh.matrixWorld);
          instances.setMatrixAt(i, instanceMatrix);
        }
        instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        instances.computeBoundingSphere();
        scene.add(instances);
      }
    });
  }

  return {
    ground, moonLight: key, moon: { update() {} }, addForest, heightAt: snowHeightAt,
    update(time) { sky.material.uniforms.uTime.value = time; }
  };
}
