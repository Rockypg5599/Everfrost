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
    uniforms: { uTime: { value: 0 }, uBoost: { value: 1 } },
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: `varying vec3 vDirection;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vDirection = normalize(worldPosition.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }`,
    fragmentShader: `uniform float uTime;
      uniform float uBoost;
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
        // uBoost richens the aurora when the camera pitches up at the sky; the
        // dome is real geometry, so the tree still occludes it correctly.
        sky += vec3(0.09, 0.42, 0.24) * aurora * uBoost;
        sky += vec3(0.34, 1.2, 0.68) * filaments * uBoost;
        sky += vec3(0.035, 0.18, 0.24) * band * band * uBoost;
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

// A ray-marched volumetric moonlight shaft — there is no beam geometry at all.
// A camera-facing quad marches each pixel's view ray through the beam volume
// (position on the axis, cone radius, wispy animated density), so the light has
// no silhouette or hard edges: it is pure accumulated glow, like fog lit up.
// The pool of light on the snow and the drifting motes remain as accents.
const CAMERA_FOV_Y = 41;      // matches the fixed camera fov in scene.js
const BEAM_DISTANCE = 45;     // how far in front of the camera the march quad sits
const BEAM_HEIGHT = 34;
const BEAM_TOP_RADIUS = 1.1;
const BEAM_BOTTOM_RADIUS = 5.2;

function makeMoonBeam() {
  const group = new THREE.Group(); // oriented along the beam axis; carries the motes
  const uniforms = {
    uTime: { value: 0 }, uIntensity: { value: 1 }, uSteps: { value: 20 },
    uOrigin: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3(0, -1, 0) },
    uSpanX: { value: 1 }, uSpanY: { value: 1 }, uDist: { value: BEAM_DISTANCE }
  };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // The billboarded corners wind the plane's front face away from the
      // camera, so culling must be disabled or the whole quad disappears.
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms,
      vertexShader: `uniform float uSpanX;
        uniform float uSpanY;
        uniform float uDist;
        varying vec3 vWorld;
        void main() {
          // Billboard the quad in front of the camera; the fragment shader then
          // reconstructs each pixel's world view ray without any matrix inverses.
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 forward = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
          vec3 world = cameraPosition + forward * uDist + right * position.x * uSpanX + up * position.y * uSpanY;
          vWorld = world;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }`,
      fragmentShader: `uniform float uTime;
        uniform float uIntensity;
        uniform float uSteps;
        uniform vec3 uOrigin;
        uniform vec3 uAxis;
        varying vec3 vWorld;
        const float H = ${BEAM_HEIGHT.toFixed(1)};
        const float R0 = ${BEAM_TOP_RADIUS.toFixed(1)};
        const float R1 = ${BEAM_BOTTOM_RADIUS.toFixed(1)};
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float noise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
                         mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                         mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }
        void main() {
          vec3 ray = normalize(vWorld - cameraPosition);
          vec3 w = cameraPosition - uOrigin;
          float db = dot(ray, uAxis);
          // Closest approach of the view ray to the beam axis; the march window
          // around it covers the slanted entry and exit of the cone.
          float tClose = ((dot(w, uAxis) * db) - dot(w, ray)) / max(1e-4, 1.0 - db * db);
          vec3 qClose = w + ray * tClose;
          float perpClose = length(qClose - uAxis * dot(qClose, uAxis));
          float tEnd = tClose + H * 0.9;
          if (perpClose > R1 * 2.4 || tEnd < 0.5) discard;
          float tStart = max(0.5, tClose - H * 0.9);
          float stepSize = (tEnd - tStart) / uSteps;
          // Jitter the first sample per pixel: turns discrete march slabs into
          // fine noise instead of concentric banding arcs.
          float jitter = hash(vec3(gl_FragCoord.xy, floor(uTime * 60.0) * 0.001));
          float tStartJittered = tStart + (jitter - 0.5) * stepSize;
          float acc = 0.0;
          for (int i = 0; i < 24; i++) {
            if (float(i) >= uSteps) break;
            float t = tStartJittered + float(i) * stepSize;
            vec3 q = cameraPosition + ray * t - uOrigin;
            float along = dot(q, uAxis);
            if (along < 0.0 || along > H) continue;
            float s = along / H;
            float radius = mix(R0, R1, s);
            float perp = length(q - uAxis * along);
            // Dense toward the axis with a wide soft edge, plus a faint halo
            // beyond it — no silhouette anywhere.
            float edge = 1.0 - smoothstep(radius * 0.25, radius * 0.85, perp);
            float halo = exp(-pow(perp / (radius * 1.3), 2.2)) * 0.1;
            float density = edge + halo;
            // Wispy, slowly drifting density so the shaft never reads solid.
            float wisp = noise(q * 0.33 + uAxis * (uTime * 0.05)) * 0.75 + noise(q * 1.1 - uAxis * (uTime * 0.03)) * 0.25;
            density *= 0.35 + 0.95 * wisp;
            // Brighter through the upper shaft, softly fading at both ends so
            // the light appears to stream down and dissolve before the source.
            density *= smoothstep(0.02, 0.1, s) * (1.0 - smoothstep(0.86, 1.0, s)) * mix(0.3, 1.0, s);
            acc += density;
          }
          vec3 color = vec3(0.58, 0.72, 1.0) * acc * stepSize * 0.032 * uIntensity;
          if (color.r + color.g + color.b < 0.002) discard;
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
  );
  quad.renderOrder = 6;
  quad.frustumCulled = false;

  // Soft pool of moonlight where the shaft meets the snow. It lives in world
  // space (horizontal on the ground), not inside the rotated beam group.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(4.4, 40),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime;
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          float falloff = 1.0 - smoothstep(0.08, 0.72, length(vUv - 0.5) * 2.0);
          float drift = 0.9 + 0.1 * sin(uTime * 0.19 + 0.6);
          gl_FragColor = vec4(vec3(0.5, 0.64, 0.95) * falloff * falloff * 0.08 * uIntensity * drift, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.renderOrder = 3;

  function updateSpans() {
    const spanY = Math.tan((CAMERA_FOV_Y / 2) * Math.PI / 180) * BEAM_DISTANCE;
    uniforms.uSpanY.value = spanY;
    uniforms.uSpanX.value = spanY * (window.innerWidth / Math.max(1, window.innerHeight));
  }
  window.addEventListener('resize', updateSpans, { passive: true });
  updateSpans();

  return {
    group,
    quad,
    pool,
    // Align the beam axis with the moon key light (-16, 24, 13) → (0, 4.6, 0).
    place(target, moonPosition) {
      const direction = target.clone().sub(moonPosition).normalize();
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
      group.position.copy(moonPosition).addScaledVector(direction, -2);
      uniforms.uOrigin.value.copy(group.position);
      uniforms.uAxis.value.copy(direction);
      const landing = group.position.clone().addScaledVector(direction, BEAM_HEIGHT);
      pool.position.set(landing.x, snowHeightAt(landing.x, landing.z) + 0.06, landing.z);
    },
    update(time, intensity, quality) {
      uniforms.uTime.value = time;
      uniforms.uIntensity.value = intensity;
      uniforms.uSteps.value = quality === 'high' ? 26 : quality === 'low' ? 14 : 20;
      pool.material.uniforms.uTime.value = time;
      pool.material.uniforms.uIntensity.value = intensity;
    }
  };
}

// Dust motes drifting down inside the beam. All motion is computed in the vertex
// shader, so the whole system is one draw call with no per-frame CPU work.
function makeBeamMotes() {
  const count = 90;
  const seeds = new Float32Array(count);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) { seeds[i] = Math.random(); speeds[i] = rand(0.6, 1.5); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    vertexShader: `uniform float uTime;
      attribute float aSeed;
      attribute float aSpeed;
      varying float vAlpha;
      void main() {
        float height = 34.0;
        float t = fract(aSeed + uTime * 0.011 * aSpeed);
        float radius = mix(1.1, 4.6, t) * sqrt(fract(aSeed * 7.31)) * 0.85;
        float angle = aSeed * 6.2831 + uTime * 0.05 * (0.4 + aSeed);
        vec3 local = vec3(cos(angle) * radius, -t * height, sin(angle) * radius);
        vec4 world = modelMatrix * vec4(local, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
        gl_PointSize = clamp((70.0 / max(1.0, -(viewMatrix * world).z)) * (0.6 + aSeed * 0.8), 1.0, 3.4);
        vAlpha = (0.4 + 0.6 * fract(aSeed * 3.7)) * smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.9, 1.0, t));
      }`,
    fragmentShader: `uniform float uIntensity;
      varying float vAlpha;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        float edge = 1.0 - smoothstep(0.12, 0.5, radius);
        if (edge <= 0.01) discard;
        gl_FragColor = vec4(vec3(0.75, 0.84, 1.0) * edge * vAlpha * uIntensity, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 5;
  points.frustumCulled = false;
  return { points, update(time, intensity, quality) {
    material.uniforms.uTime.value = time;
    material.uniforms.uIntensity.value = intensity;
    geometry.setDrawRange(0, quality === 'high' ? count : quality === 'low' ? 36 : 64);
  } };
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

  // The aurora bands overhead spill a faint green light onto the tree and the
  // snow — this carries it, pulsing gently in step with the sky shader.
  const auroraGlow = new THREE.DirectionalLight(0x46d9a0, 0.13);
  auroraGlow.position.set(0, 30, 11);
  auroraGlow.target.position.set(0, 4, 0);
  scene.add(auroraGlow, auroraGlow.target);

  // A soft spot aligned with the beam, so the tree itself is lit by its own
  // moonlight. decay 0 keeps the classic intensity scale; no extra shadows.
  const beamSpot = new THREE.SpotLight(0xbcd0ff, 0.5, 0, 0.12, 0.85, 0);
  beamSpot.position.copy(key.position);
  beamSpot.target.position.set(0, 4.6, 0);
  beamSpot.castShadow = false;
  scene.add(beamSpot, beamSpot.target);

  // Moonbeam: shaft + light pool + drifting motes, built along the key light axis
  // and aimed so the beam mouth envelopes the tree crown.
  const beam = makeMoonBeam();
  beam.place(new THREE.Vector3(0, 4.6, 0), key.position);
  scene.add(beam.quad, beam.group, beam.pool);
  const motes = makeBeamMotes();
  beam.group.add(motes.points);

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

  const beamIntensityByQuality = { low: 0.78, medium: 1, high: 1.3 };
  let skyBoost = 0;

  return {
    ground, moonLight: key, moon: { update() {} }, addForest, heightAt: snowHeightAt, beam,
    update(time, prefs, skyTarget) {
      sky.material.uniforms.uTime.value = time;
      // Ease the sky aurora toward its looking-up richness (~0.7 s fade).
      skyBoost += ((skyTarget ? 1 : 0) - skyBoost) * 0.07;
      sky.material.uniforms.uBoost.value = 1 + skyBoost * 1.3;
      const quality = prefs && prefs.graphicsQuality in beamIntensityByQuality ? prefs.graphicsQuality : 'medium';
      const intensity = beamIntensityByQuality[quality];
      beam.update(time, intensity, quality);
      motes.update(time, intensity, quality);
      // The aurora bands breathe slowly; the glow on the tree follows them.
      const animated = !prefs || (prefs.animationsEnabled && !prefs.reducedMotion);
      const pulse = animated ? 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(time * 0.24)) : 0.88;
      auroraGlow.intensity = 0.3 * pulse;
    }
  };
}
