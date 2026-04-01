import { useEffect, useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import {
  WebGLRenderTarget,
  DepthTexture,
  MeshNormalMaterial,
  MeshBasicMaterial,
  ShaderMaterial,
  UnsignedShortType,
  NearestFilter,
  PlaneGeometry,
  Mesh,
  Scene,
  OrthographicCamera as ThreeOrthographicCamera,
  DoubleSide,
  Vector2,
} from 'three'
import { useViewerStore } from '@/stores/useViewerStore'
import { sobelVertexShader, sobelFragmentShader } from '../shaders/sobelShader'

export function useSobelPass() {
  const { gl, scene, camera, size } = useThree()
  const depthWeight = useViewerStore((s) => s.sobelDepthWeight)
  const normalWeight = useViewerStore((s) => s.sobelNormalWeight)
  const threshold = useViewerStore((s) => s.sobelThreshold)
  const lineWidth = useViewerStore((s) => s.drawingLineWidth)
  const setStats = useViewerStore((s) => s.setDrawingStats)

  const normalMat = useMemo(() => new MeshNormalMaterial({ side: DoubleSide }), [])
  const whiteMat = useMemo(() => new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }), [])

  // Use refs for render targets so we can resize them
  const depthTargetRef = useRef<WebGLRenderTarget | null>(null)
  const normalTargetRef = useRef<WebGLRenderTarget | null>(null)
  const sobelMaterialRef = useRef<ShaderMaterial | null>(null)
  const quadSceneRef = useRef<Scene | null>(null)
  const quadCameraRef = useRef<ThreeOrthographicCamera | null>(null)

  // Create/resize render targets when size changes
  useEffect(() => {
    // Dispose old
    depthTargetRef.current?.dispose()
    normalTargetRef.current?.dispose()
    sobelMaterialRef.current?.dispose()

    const depthTex = new DepthTexture(size.width, size.height)
    depthTex.type = UnsignedShortType

    const dt = new WebGLRenderTarget(size.width, size.height, {
      depthTexture: depthTex,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
    })
    depthTargetRef.current = dt

    const nt = new WebGLRenderTarget(size.width, size.height, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
    })
    normalTargetRef.current = nt

    const mat = new ShaderMaterial({
      vertexShader: sobelVertexShader,
      fragmentShader: sobelFragmentShader,
      uniforms: {
        depthTexture: { value: depthTex },
        normalTexture: { value: nt.texture },
        texelSize: { value: new Vector2(1 / size.width, 1 / size.height) },
        depthWeight: { value: depthWeight },
        normalWeight: { value: normalWeight },
        threshold: { value: threshold },
        thickness: { value: lineWidth },
        cameraNear: { value: 0.01 },
        cameraFar: { value: 100000 },
      },
    })
    sobelMaterialRef.current = mat

    // Full-screen quad
    if (!quadSceneRef.current) {
      const quadGeo = new PlaneGeometry(2, 2)
      const quadMesh = new Mesh(quadGeo, mat)
      const qs = new Scene()
      qs.add(quadMesh)
      quadSceneRef.current = qs
      quadCameraRef.current = new ThreeOrthographicCamera(-1, 1, 1, -1, 0, 1)
    } else {
      // Update existing quad material
      const quadMesh = quadSceneRef.current.children[0] as Mesh
      quadMesh.material = mat
    }

    return () => {
      dt.dispose()
      nt.dispose()
      mat.dispose()
    }
  }, [size.width, size.height]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update uniforms when controls change
  useEffect(() => {
    const mat = sobelMaterialRef.current
    if (!mat) return
    mat.uniforms.depthWeight.value = depthWeight
    mat.uniforms.normalWeight.value = normalWeight
    mat.uniforms.threshold.value = threshold
    mat.uniforms.thickness.value = lineWidth
  }, [depthWeight, normalWeight, threshold, lineWidth])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      depthTargetRef.current?.dispose()
      normalTargetRef.current?.dispose()
      sobelMaterialRef.current?.dispose()
      normalMat.dispose()
      whiteMat.dispose()
    }
  }, [normalMat, whiteMat])

  // Custom render loop — takes over rendering entirely.
  // We hide scene children during the default R3F render pass (priority 1 runs first),
  // do our multi-pass rendering, then R3F's default render sees an empty scene.
  useFrame(({ gl: renderer }, delta) => {
    const depthTarget = depthTargetRef.current
    const normalTarget = normalTargetRef.current
    const quadScene = quadSceneRef.current
    const quadCamera = quadCameraRef.current
    if (!depthTarget || !normalTarget || !quadScene || !quadCamera) return

    const start = performance.now()

    // Pass 1: Depth — render scene with white material to get depth buffer
    scene.overrideMaterial = whiteMat
    renderer.setRenderTarget(depthTarget)
    renderer.clear()
    renderer.render(scene, camera)

    // Pass 2: Normals
    scene.overrideMaterial = normalMat
    renderer.setRenderTarget(normalTarget)
    renderer.clear()
    renderer.render(scene, camera)

    scene.overrideMaterial = null

    // Pass 3: Sobel composite to screen
    renderer.setRenderTarget(null)
    renderer.clear()
    renderer.render(quadScene, quadCamera)

    // Hide scene children so R3F's default render pass draws nothing on top
    scene.traverse((child) => {
      if (child !== scene) child.visible = false
    })

    const computeTime = performance.now() - start
    setStats({ computeTime, lineCount: 0, visibleLineCount: 0, hiddenLineCount: 0 })
  }, 1)

  // Restore visibility before next frame
  useFrame(() => {
    scene.traverse((child) => {
      if (child !== scene) child.visible = true
    })
  }, -1)
}
