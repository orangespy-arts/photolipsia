import * as THREE from 'three';

// Alpha-composited glass: Spark is transparent and is not captured by the
// standard opaque-only transmission buffer. Keep the scene visible through
// the center, with Fresnel edge reflections and small soft highlights.
export function createGlassBall() {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    uniforms: {},
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = -viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 viewDir = normalize(vView);
        float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
        float highlight = pow(max(dot(n, normalize(vec3(-0.4, 0.65, 0.8))), 0.0), 90.0);
        float softLight = pow(max(dot(n, normalize(vec3(0.65, 0.2, 0.7))), 0.0), 24.0);
        float alpha = clamp(0.025 + fresnel * 0.42 + highlight * 0.65 + softLight * 0.12, 0.0, 0.8);
        vec3 tint = mix(vec3(0.72, 0.86, 0.91), vec3(1.0), clamp(highlight + softLight, 0.0, 1.0));
        gl_FragColor = vec4(tint, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 40, 28), material);
  // Composite after Spark; retain depth testing against ordinary mesh plants.
  ball.renderOrder = 10;
  ball.visible = false;
  return ball;
}
