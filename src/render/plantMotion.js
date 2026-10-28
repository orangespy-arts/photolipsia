import * as THREE from 'three';

const motionGLSL = `
attribute vec4 aPlantMotion;
uniform vec3 uPlantBands;
uniform float uPlantOnset;
uniform float uPlantOnsetSize;
uniform float uPlantTime;
uniform float uPlantGround;
vec3 plantMotion() {
  float band = aPlantMotion.x;
  float energy = (band < 0.5 ? uPlantBands.x : band < 1.5 ? uPlantBands.y : uPlantBands.z) * aPlantMotion.y;
  float frequency = band < 0.5 ? 2.2 : band < 1.5 ? 4.5 : 14.0;
  float wave = sin(uPlantTime * aPlantMotion.w * frequency + aPlantMotion.z);
  float bounce = band < 0.5 ? 0.48 : band < 1.5 ? 0.13 : 0.07;
  float punch = band < 0.5 ? 0.22 : band < 1.5 ? 0.08 : 0.03;
  float bend = band < 0.5 ? 0.05 : band < 1.5 ? 0.3 : 0.12;
  float stretch = 1.0 + energy * (bounce * (0.65 + 0.35 * wave) + uPlantOnset * punch * uPlantOnsetSize);
  float sway = energy * bend * wave;
  return vec3(sway * cos(aPlantMotion.z), stretch, sway * sin(aPlantMotion.z));
}
`;

export function addPlantMotion(mesh, count, uniforms) {
  const attribute = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
  attribute.setUsage(THREE.DynamicDrawUsage);
  mesh.geometry.setAttribute('aPlantMotion', attribute);
  mesh.material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const project = THREE.ShaderChunk.project_vertex.replace(
      'mvPosition = modelViewMatrix * mvPosition;', `
      vec3 motion = plantMotion();
      float height = mvPosition.y - uPlantGround;
      mvPosition.xyz += vec3(motion.x * height, (motion.y - 1.0) * height, motion.z * height);
      mvPosition = modelViewMatrix * mvPosition;`);
    const normal = THREE.ShaderChunk.defaultnormal_vertex.replace(
      'transformedNormal = normalMatrix * transformedNormal;', `
      vec3 normalMotion = plantMotion();
      transformedNormal.y = (transformedNormal.y - normalMotion.x * transformedNormal.x
        - normalMotion.z * transformedNormal.z) / normalMotion.y;
      transformedNormal = normalMatrix * transformedNormal;`);
    shader.vertexShader = motionGLSL + shader.vertexShader
      .replace('#include <project_vertex>', project)
      .replace('#include <defaultnormal_vertex>', normal);
  };
  mesh.material.customProgramCacheKey = () => 'plant-band-motion-v2';
  return attribute;
}
