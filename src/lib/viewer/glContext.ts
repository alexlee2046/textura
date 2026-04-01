import type { WebGLRenderer, Scene, Camera } from 'three'

let _gl: WebGLRenderer | null = null
let _scene: Scene | null = null
let _camera: Camera | null = null

export function setGLContext(gl: WebGLRenderer, scene: Scene, camera: Camera) {
  _gl = gl; _scene = scene; _camera = camera
}

export function clearGLContext() {
  _gl = null; _scene = null; _camera = null
}

export function getGLContext() {
  return { gl: _gl, scene: _scene, camera: _camera }
}
