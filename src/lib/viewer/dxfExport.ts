import type { BufferGeometry } from 'three'
import { downloadBlob } from '@/lib/downloadBlob'

export async function exportDXF(
  visible: BufferGeometry,
  hidden: BufferGeometry | null,
  fileName: string,
): Promise<void> {
  const { DxfWriter, Units } = await import('@tarikjabiri/dxf')

  const dxf = new DxfWriter()
  dxf.setUnits(Units.Millimeters)

  // Register DASHED linetype before referencing it in the layer definition
  dxf.addLType('DASHED', 'Dashed line __ __ __', [0.5, -0.25])

  dxf.addLayer('VISIBLE', 7, 'CONTINUOUS')
  dxf.addLayer('HIDDEN', 8, 'DASHED')

  function writeLines(geometry: BufferGeometry, layerName: string) {
    const pos = geometry.attributes.position
    if (!pos) return
    const arr = pos.array as Float32Array
    for (let i = 0; i < arr.length; i += 6) {
      const x1 = arr[i]
      const y1 = arr[i + 2]   // Z → DXF Y (XZ plane projected geometry)
      const x2 = arr[i + 3]
      const y2 = arr[i + 5]   // Z → DXF Y
      dxf.addLine(
        { x: x1, y: y1, z: 0 },
        { x: x2, y: y2, z: 0 },
        { layerName },
      )
    }
  }

  writeLines(visible, 'VISIBLE')
  if (hidden) {
    writeLines(hidden, 'HIDDEN')
  }

  const content = dxf.stringify()
  downloadBlob(content, 'application/dxf', `${fileName}.dxf`)
}
