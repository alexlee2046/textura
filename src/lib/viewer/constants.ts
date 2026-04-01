export const SUPPORTED_EXTENSIONS = ['glb', 'gltf', 'fbx', 'obj', 'stl'] as const
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number]

export const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB
export const WARN_FILE_SIZE = 50 * 1024 * 1024  // 50MB

export const UNIT_FACTORS = {
  mm: 1,
  cm: 10,
  m: 1000,
  inch: 25.4,
} as const
export type Unit = keyof typeof UNIT_FACTORS

export const VIEW_PRESETS = {
  iso:    { position: [1, 1, 1],  target: [0, 0, 0], up: [0, 1, 0] },
  front:  { position: [0, 0, 1],  target: [0, 0, 0], up: [0, 1, 0] },
  back:   { position: [0, 0, -1], target: [0, 0, 0], up: [0, 1, 0] },
  left:   { position: [-1, 0, 0], target: [0, 0, 0], up: [0, 1, 0] },
  right:  { position: [1, 0, 0],  target: [0, 0, 0], up: [0, 1, 0] },
  top:    { position: [0, 1, 0],  target: [0, 0, 0], up: [0, 0, -1] },
  bottom: { position: [0, -1, 0], target: [0, 0, 0], up: [0, 0, 1] },
} as const
export type ViewPreset = keyof typeof VIEW_PRESETS | 'free'

export const GRID_THRESHOLDS = [
  { maxDim: 100,  cellSize: 10,  sectionSize: 50 },
  { maxDim: 1000, cellSize: 50,  sectionSize: 250 },
  { maxDim: 5000, cellSize: 100, sectionSize: 500 },
  { maxDim: Infinity, cellSize: 500, sectionSize: 2500 },
] as const

export const ANNOTATIONS_VISIBLE_MAP: Record<string, ('x' | 'y' | 'z')[]> = {
  front: ['x', 'y'], back: ['x', 'y'],
  left: ['z', 'y'],  right: ['z', 'y'],
  top: ['x', 'z'],   bottom: ['x', 'z'],
  iso: ['x', 'y', 'z'], free: ['x', 'y', 'z'],
}

export const LABELS = {
  title: 'title',
  dropHint: 'dropHint',
  dropSubHint: 'dropSubHint',
  upload: 'upload',
  close: 'close',
  screenshot: 'screenshot',
  measure: 'measure',
  clearAll: 'clearAll',
  copyAll: 'copyAll',
  annotations: 'annotations',
  displayMode: 'displayMode',
  solid: 'solid',
  wireframe: 'wireframe',
  unit: 'unit',
  viewIso: 'viewIso',
  viewFront: 'viewFront', viewBack: 'viewBack',
  viewLeft: 'viewLeft', viewRight: 'viewRight',
  viewTop: 'viewTop', viewBottom: 'viewBottom',
  viewFree: 'viewFree',
  orthographic: 'orthographic',
  perspective: 'perspective',
  rotateCorrection: 'rotateCorrection',
  fileTooLarge: 'fileTooLarge',
  fileWarning: 'fileWarning',
  unsupportedFormat: 'unsupportedFormat',
  loadFailed: 'loadFailed',
  gltfHint: 'gltfHint',
  abnormalSize: 'abnormalSize',
  emptyModel: 'emptyModel',
  corruptData: 'corruptData',
  gpuOom: 'gpuOom',
  optimizing: 'optimizing',
  modelInfo: 'modelInfo',
  fileName: 'fileName',
  vertices: 'vertices',
  faces: 'faces',
  textures: 'textures',
  dimensions: 'dimensions',
  views: 'views',
  tools: 'tools',
  measureHint: 'measureHint',
  measureLimit: 'measureLimit',
} as const

export const DRAWING_ALGORITHMS = ['edges', 'sobel', 'conditional', 'projection', 'outlines', 'composite'] as const

export const ALGORITHM_LABELS: Record<string, string> = {
  edges: 'drawing.algoEdges',
  sobel: 'drawing.algoSobel',
  conditional: 'drawing.algoConditional',
  projection: 'drawing.algoProjection',
  outlines: 'drawing.algoOutlines',
  composite: 'drawing.algoComposite',
}

export const DRAWING_VIEW_KEYS: Record<string, keyof typeof VIEW_PRESETS> = {
  f: 'front', b: 'back', l: 'left', r: 'right',
  t: 'top', u: 'bottom', i: 'iso',
}

export const DRAWING_LABELS = {
  title: 'drawing.title',
  backTo3D: 'drawing.backTo3D',
  hiddenLines: 'drawing.hiddenLines',
  angleThreshold: 'drawing.angleThreshold',
  lineWidth: 'drawing.lineWidth',
  computing: 'drawing.computing',
  computed: 'drawing.computed',
  cancelled: 'drawing.cancelled',
  failed: 'drawing.failed',
  exportPNG: 'drawing.exportPNG',
  exportPDF: 'drawing.exportPDF',
  exportDXF: 'drawing.exportDXF',
  dxfOnlyAlgo4: 'drawing.dxfOnlyProjection',
  performance: 'drawing.performance',
  computeTime: 'drawing.computeTime',
  lines: 'drawing.lines',
  visible: 'drawing.visible',
  hidden: 'drawing.hidden',
} as const
