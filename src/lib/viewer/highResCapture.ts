import { WebGLRenderer, WebGLRenderTarget, Scene, Camera, Vector2, Vector4 } from 'three'

/**
 * Render the scene at high resolution using an offscreen render target.
 * Returns a PNG Blob suitable for Potrace vectorization.
 *
 * IMPORTANT: Does NOT call renderer.setSize() (would break R3F state).
 * Uses viewport manipulation only.
 */
export async function captureHighRes(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  width = 4096,
  height = 4096,
): Promise<Blob> {
  const gl = renderer.getContext()
  const maxSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number
  const w = Math.min(width, maxSize)
  const h = Math.min(height, maxSize)

  const prevTarget = renderer.getRenderTarget()
  const prevViewport = renderer.getViewport(new Vector4())

  // No MSAA — clean binary edges for Potrace
  const rt = new WebGLRenderTarget(w, h, { samples: 0 })

  try {
    renderer.setRenderTarget(rt)
    renderer.setViewport(0, 0, w, h)
    renderer.setClearColor(0xffffff, 1)
    renderer.clear()
    renderer.render(scene, camera)

    const pixels = new Uint8Array(w * h * 4)
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, pixels)

    // Flip Y (WebGL readPixels is bottom-up)
    const rowSize = w * 4
    const halfH = Math.floor(h / 2)
    const tempRow = new Uint8Array(rowSize)
    for (let y = 0; y < halfH; y++) {
      const topOff = y * rowSize
      const botOff = (h - 1 - y) * rowSize
      tempRow.set(pixels.subarray(topOff, topOff + rowSize))
      pixels.copyWithin(topOff, botOff, botOff + rowSize)
      pixels.set(tempRow, botOff)
    }

    // Encode as PNG
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer), w, h), 0, 0)
    return await canvas.convertToBlob({ type: 'image/png' })
  } finally {
    renderer.setRenderTarget(prevTarget)
    renderer.setViewport(prevViewport)
    rt.dispose()
  }
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
