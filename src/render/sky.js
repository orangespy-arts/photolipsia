import * as THREE from 'three';

// Procedural sky dome (W6c): zenith→horizon gradient plus soft drifting fbm
// clouds, for scans with no captured sky. Drawn first in the opaque pass with
// no depth write, so every splat composites over it; it follows the camera so
// it can never be reached. Config comes from mapping/skyPresets.js skyFor().
const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */`
uniform vec3 uTop, uHorizon, uBottom, uCloud, uShade;
uniform float uCover, uSoft, uOpacity, uScale, uTime, uSpeed;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 sky = h >= 0.0 ? mix(uHorizon, uTop, smoothstep(0.0, 0.55, h)) : mix(uHorizon, uBottom, smoothstep(0.0, 0.25, -h));
  // clouds on a virtual plane above the camera; fade toward the horizon
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.18) * uScale + vec2(uTime * uSpeed, uTime * uSpeed * 0.4);
    float n = fbm(uv);
    float c = smoothstep(uCover, uCover + uSoft, n) * smoothstep(0.0, 0.22, h) * uOpacity;
    // underside shading: denser cloud reads darker
    vec3 col = mix(uCloud, uShade, smoothstep(uCover + uSoft, uCover + uSoft + 0.25, n) * 0.6);
    sky = mix(sky, col, c);
  }
  gl_FragColor = vec4(sky, 1.0);
}`;

export function createSky({ scene, camera, radius = 80 }) {
  const uniforms = {
    uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
    uCloud: { value: new THREE.Color() }, uShade: { value: new THREE.Color() },
    uCover: { value: 0.5 }, uSoft: { value: 0.2 }, uOpacity: { value: 0.8 }, uScale: { value: 1 },
    uTime: { value: 0 }, uSpeed: { value: 0.01 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG,
    side: THREE.BackSide, depthWrite: false, depthTest: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), material);
  mesh.renderOrder = -1000; mesh.frustumCulled = false; mesh.visible = false;
  // keep the dome centred on the camera every frame (sky at infinity)
  mesh.onBeforeRender = () => { mesh.position.copy(camera.getWorldPosition(mesh.position)); mesh.updateMatrixWorld(); };
  scene.add(mesh);
  return {
    set(config) {
      mesh.visible = !!config;
      if (!config) return;
      for (const [u, k] of [['uTop', 'top'], ['uHorizon', 'horizon'], ['uBottom', 'bottom'], ['uCloud', 'cloud'], ['uShade', 'shade']]) uniforms[u].value.setRGB(...config[k]);
      uniforms.uCover.value = config.cover; uniforms.uSoft.value = config.softness;
      uniforms.uOpacity.value = config.opacity; uniforms.uScale.value = config.scale; uniforms.uSpeed.value = config.speed;
    },
    tick(seconds) { uniforms.uTime.value = seconds; },
    get visible() { return mesh.visible; },
    dispose() { scene.remove(mesh); mesh.geometry.dispose(); material.dispose(); },
  };
}
