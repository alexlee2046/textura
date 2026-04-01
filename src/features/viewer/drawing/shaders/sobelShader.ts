export const sobelVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const sobelFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D depthTexture;
uniform sampler2D normalTexture;
uniform vec2 texelSize;
uniform float depthWeight;
uniform float normalWeight;
uniform float threshold;
uniform float thickness;
uniform float cameraNear;
uniform float cameraFar;

varying vec2 vUv;

// Orthographic depth is already linear
float linearizeDepth(float d) {
  return cameraNear + d * (cameraFar - cameraNear);
}

float sobelDepthSample(vec2 uv, vec2 offset) {
  float tl = linearizeDepth(texture2D(depthTexture, uv + vec2(-offset.x, -offset.y)).r);
  float t  = linearizeDepth(texture2D(depthTexture, uv + vec2(0.0, -offset.y)).r);
  float tr = linearizeDepth(texture2D(depthTexture, uv + vec2(offset.x, -offset.y)).r);
  float l  = linearizeDepth(texture2D(depthTexture, uv + vec2(-offset.x, 0.0)).r);
  float r  = linearizeDepth(texture2D(depthTexture, uv + vec2(offset.x, 0.0)).r);
  float bl = linearizeDepth(texture2D(depthTexture, uv + vec2(-offset.x, offset.y)).r);
  float b  = linearizeDepth(texture2D(depthTexture, uv + vec2(0.0, offset.y)).r);
  float br = linearizeDepth(texture2D(depthTexture, uv + vec2(offset.x, offset.y)).r);

  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;

  return sqrt(gx * gx + gy * gy);
}

float sobelNormalSample(vec2 uv, vec2 offset) {
  vec3 tl = texture2D(normalTexture, uv + vec2(-offset.x, -offset.y)).rgb;
  vec3 t  = texture2D(normalTexture, uv + vec2(0.0, -offset.y)).rgb;
  vec3 tr = texture2D(normalTexture, uv + vec2(offset.x, -offset.y)).rgb;
  vec3 l  = texture2D(normalTexture, uv + vec2(-offset.x, 0.0)).rgb;
  vec3 r  = texture2D(normalTexture, uv + vec2(offset.x, 0.0)).rgb;
  vec3 bl = texture2D(normalTexture, uv + vec2(-offset.x, offset.y)).rgb;
  vec3 b  = texture2D(normalTexture, uv + vec2(0.0, offset.y)).rgb;
  vec3 br = texture2D(normalTexture, uv + vec2(offset.x, offset.y)).rgb;

  vec3 gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  vec3 gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;

  return length(gx) + length(gy);
}

void main() {
  vec2 offset = texelSize * thickness;
  float depthEdge = sobelDepthSample(vUv, offset) * depthWeight;
  float normalEdge = sobelNormalSample(vUv, offset) * normalWeight;
  float edge = max(depthEdge, normalEdge);

  float a = edge > threshold ? 1.0 : 0.0;
  gl_FragColor = vec4(vec3(1.0 - a), 1.0);
}
`
