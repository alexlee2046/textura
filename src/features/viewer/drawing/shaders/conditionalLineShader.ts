export const conditionalLineVertexShader = /* glsl */ `
attribute vec3 control0;
attribute vec3 control1;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec3 viewDir = cameraPosition - worldPos.xyz;

  vec3 c0World = (modelMatrix * vec4(control0, 1.0)).xyz;
  vec3 c1World = (modelMatrix * vec4(control1, 1.0)).xyz;

  vec3 edge0 = cross(c0World - worldPos.xyz, viewDir);
  vec3 edge1 = cross(c1World - worldPos.xyz, viewDir);

  if (dot(edge0, edge1) > 0.0) {
    gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
  } else {
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
}
`
