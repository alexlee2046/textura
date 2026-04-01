import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { MeshStandardMaterial, Mesh, type Object3D, type BufferGeometry } from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SUPPORTED_EXTENSIONS, type SupportedExtension } from './constants'

export function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

export function isSupportedFormat(fileName: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(getExtension(fileName))
}

const DEFAULT_MATERIAL = new MeshStandardMaterial({
  color: 0x888888,
  metalness: 0.1,
  roughness: 0.7,
})

export async function loadModel(
  url: string,
  fileName: string,
  onProgress?: (progress: number) => void,
): Promise<Object3D> {
  const ext = getExtension(fileName) as SupportedExtension

  switch (ext) {
    case 'glb':
    case 'gltf': {
      const loader = new GLTFLoader()
      const gltf = await loader.loadAsync(url, (e) => {
        if (e.total > 0) onProgress?.(Math.round((e.loaded / e.total) * 100))
      })
      return gltf.scene
    }
    case 'fbx': {
      const loader = new FBXLoader()
      const fbx = await loader.loadAsync(url, (e) => {
        if (e.total > 0) onProgress?.(Math.round((e.loaded / e.total) * 100))
      })
      return fbx
    }
    case 'obj': {
      const loader = new OBJLoader()
      const obj = await loader.loadAsync(url, (e) => {
        if (e.total > 0) onProgress?.(Math.round((e.loaded / e.total) * 100))
      })
      // Apply default material (MVP: no MTL support)
      obj.traverse((child) => {
        if ((child as Mesh).isMesh) {
          ;(child as Mesh).material = DEFAULT_MATERIAL
        }
      })
      return obj
    }
    case 'stl': {
      const loader = new STLLoader()
      const geometry = (await loader.loadAsync(url, (e) => {
        if (e.total > 0) onProgress?.(Math.round((e.loaded / e.total) * 100))
      })) as BufferGeometry
      // STL returns raw geometry; create indexed geometry + wrap in Mesh
      const indexed = BufferGeometryUtils.mergeVertices(geometry)
      indexed.computeVertexNormals()
      const mesh = new Mesh(indexed, DEFAULT_MATERIAL.clone())
      mesh.name = fileName
      return mesh
    }
    default:
      throw new Error(`Unsupported format: ${ext}`)
  }
}
