'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useViewerStore } from '@/stores/useViewerStore'
import { LABELS, type Unit } from '@/lib/viewer/constants'
import { formatWithUnit, formatDimension } from '@/lib/viewer/units'
import { ViewControls } from './ViewControls'
import { MeasureList } from './MeasureList'
import { Ruler, Eye, EyeOff, RotateCw, Target, X } from 'lucide-react'
import { rotateModel90, computeBBox, extractModelInfo } from '@/lib/viewer/modelProcessing'

const UNITS: Unit[] = ['mm', 'cm', 'm', 'inch']
const AXIS_KEYS = { x: 'axisW', y: 'axisH', z: 'axisD' } as const
const AXIS_COLORS = { x: 'text-red-500', y: 'text-green-500', z: 'text-blue-500' } as const

export function ViewerSidebar() {
  const modelInfo = useViewerStore((s) => s.modelInfo)
  const unit = useViewerStore((s) => s.unit)
  const setUnit = useViewerStore((s) => s.setUnit)
  const showAnnotations = useViewerStore((s) => s.showAnnotations)
  const toggleAnnotations = useViewerStore((s) => s.toggleAnnotations)
  const displayMode = useViewerStore((s) => s.displayMode)
  const setDisplayMode = useViewerStore((s) => s.setDisplayMode)
  const measureMode = useViewerStore((s) => s.measureMode)
  const toggleMeasureMode = useViewerStore((s) => s.toggleMeasureMode)
  const calibrationScale = useViewerStore((s) => s.calibrationScale)
  const calibrate = useViewerStore((s) => s.calibrate)
  const resetCalibration = useViewerStore((s) => s.resetCalibration)
  const t = useTranslations('Viewer')

  // Calibration editing state
  const [editingAxis, setEditingAxis] = useState<'x' | 'y' | 'z' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showCalibrationPanel, setShowCalibrationPanel] = useState(false)
  const [calAxis, setCalAxis] = useState<'x' | 'y' | 'z'>('y')
  const [calValue, setCalValue] = useState('')

  if (!modelInfo) return null

  const handleCalibrate = (axis: 'x' | 'y' | 'z') => {
    const val = parseFloat(editValue)
    if (isNaN(val) || val <= 0) return
    calibrate(axis, val)
    setEditingAxis(null)
    setEditValue('')
  }

  const isCalibrated = calibrationScale !== 1

  return (
    <div className="w-64 h-full border-l border-zinc-200 bg-white/95 backdrop-blur-md overflow-y-auto p-3 pt-12 space-y-4">
      {/* Model Info */}
      <section className="space-y-1.5">
        <div className="text-xs font-medium text-zinc-500 uppercase">{t(LABELS.modelInfo)}</div>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">{t(LABELS.fileName)}</span>
            <span className="text-zinc-800 truncate ml-2 max-w-[140px]" title={modelInfo.fileName}>
              {modelInfo.fileName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">{t(LABELS.vertices)}</span>
            <span className="text-zinc-800">{modelInfo.vertexCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">{t(LABELS.faces)}</span>
            <span className="text-zinc-800">{modelInfo.faceCount.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* Dimensions with calibration */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-500 uppercase">{t(LABELS.dimensions)}</div>
          {isCalibrated && (
            <button
              onClick={resetCalibration}
              className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-0.5"
              title={t('resetCalibrationTitle')}
            >
              <X className="w-3 h-3" />
              {t('reset')}
            </button>
          )}
        </div>

        <div className="text-sm font-mono space-y-1">
          {(['x', 'y', 'z'] as const).map((axis) => {
            const raw = modelInfo.dimensions[axis]
            const display = raw * calibrationScale

            if (editingAxis === axis) {
              return (
                <div key={axis} className="flex items-center gap-1 bg-blue-50 rounded px-1 -mx-1 py-0.5">
                  <span className={AXIS_COLORS[axis]}>{t(AXIS_KEYS[axis])}:</span>
                  <input
                    type="number"
                    ref={(el) => el?.focus()}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation() // Prevent global shortcuts
                      if (e.key === 'Enter') handleCalibrate(axis)
                      if (e.key === 'Escape') { setEditingAxis(null); setEditValue('') }
                    }}
                    onBlur={() => {
                      // Delay to allow click on other elements
                      setTimeout(() => { setEditingAxis(null); setEditValue('') }, 200)
                    }}
                    className="w-20 px-1.5 py-0.5 text-xs border border-blue-400 rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder={formatDimension(display, unit)}
                    step="any"
                  />
                  <span className="text-xs text-zinc-400">{unit}</span>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); handleCalibrate(axis) }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {t('confirm')}
                  </button>
                </div>
              )
            }

            return (
              <div
                key={axis}
                className="flex items-center justify-between group cursor-pointer hover:bg-blue-50 rounded px-1 -mx-1 py-0.5 transition-colors"
                onClick={() => {
                  setEditingAxis(axis)
                  setEditValue(formatDimension(display, unit))
                }}
                title={t('clickToCalibrate')}
              >
                <span>
                  <span className={AXIS_COLORS[axis]}>{t(AXIS_KEYS[axis])}:</span>{' '}
                  {formatWithUnit(display, unit)}
                </span>
                <Target className="w-3.5 h-3.5 text-zinc-300 group-hover:text-blue-400 transition-colors" />
              </div>
            )
          })}
        </div>

        {/* Calibration button & panel */}
        {!isCalibrated && !showCalibrationPanel && (
          <button
            onClick={() => {
              setShowCalibrationPanel(true)
              setCalAxis('y')
              setCalValue('')
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
          >
            <Target className="w-4 h-4" />
            {t('calibrateButton')}
          </button>
        )}

        {showCalibrationPanel && !isCalibrated && (
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <div className="text-xs font-medium text-blue-700">{t('enterKnownDimension')}</div>
            <div className="flex gap-1.5">
              {(['x', 'y', 'z'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setCalAxis(a)}
                  className={`flex-1 px-2 py-1 text-xs rounded-md transition-colors ${
                    calAxis === a
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {t(AXIS_KEYS[a])}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                value={calValue}
                onChange={(e) => setCalValue(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    const val = parseFloat(calValue)
                    if (!isNaN(val) && val > 0) {
                      calibrate(calAxis, val)
                      setShowCalibrationPanel(false)
                    }
                  }
                  if (e.key === 'Escape') setShowCalibrationPanel(false)
                }}
                placeholder={`${t(AXIS_KEYS[calAxis])} ${t('actualValue')}`}
                className="flex-1 px-2 py-1.5 text-sm border border-blue-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
                step="any"
              />
              <span className="text-sm text-zinc-500">{unit}</span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  const val = parseFloat(calValue)
                  if (!isNaN(val) && val > 0) {
                    calibrate(calAxis, val)
                    setShowCalibrationPanel(false)
                  }
                }}
                className="flex-1 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
              >
                {t('calibrate')}
              </button>
              <button
                onClick={() => setShowCalibrationPanel(false)}
                className="px-3 py-1.5 text-sm rounded-md bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {isCalibrated && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-blue-600 font-medium">
              ✓ {t('calibrated')} (×{calibrationScale.toFixed(2)})
            </p>
            <button
              onClick={() => { resetCalibration(); setShowCalibrationPanel(false) }}
              className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
            >
              {t('reset')}
            </button>
          </div>
        )}
      </section>

      {/* Unit selector */}
      <section className="space-y-1.5">
        <div className="text-xs font-medium text-zinc-500 uppercase">{t(LABELS.unit)}</div>
        <select
          value={unit}
          onChange={(e) => { setUnit(e.target.value as Unit); resetCalibration() }}
          className="w-full px-2 py-1.5 text-sm rounded-md border border-zinc-200 bg-white"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </section>

      {/* View Controls */}
      <section>
        <ViewControls />
      </section>

      {/* Display Mode */}
      <section className="space-y-1.5">
        <div className="text-xs font-medium text-zinc-500 uppercase">{t(LABELS.displayMode)}</div>
        <div className="flex gap-1">
          <button
            onClick={() => setDisplayMode('solid')}
            className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
              displayMode === 'solid' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {t(LABELS.solid)}
          </button>
          <button
            onClick={() => setDisplayMode('wireframe')}
            className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
              displayMode === 'wireframe' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {t(LABELS.wireframe)}
          </button>
        </div>
      </section>

      {/* Tools */}
      <section className="space-y-1.5">
        <div className="text-xs font-medium text-zinc-500 uppercase">{t(LABELS.tools)}</div>
        <button
          onClick={toggleMeasureMode}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
            measureMode
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <Ruler className="w-4 h-4" />
          {t(LABELS.measure)} {measureMode ? t('measureExit') : t('measureKey')}
        </button>
        <button
          onClick={toggleAnnotations}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
        >
          {showAnnotations ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {t(LABELS.annotations)}
        </button>
      </section>

      {/* Rotation Correction */}
      <section className="space-y-1.5">
        <div className="text-xs font-medium text-zinc-500 uppercase">{t(LABELS.rotateCorrection)}</div>
        <div className="flex gap-1">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <button
              key={axis}
              className="flex-1 px-2 py-1.5 text-xs rounded-md bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
              onClick={() => {
                const model = useViewerStore.getState().loadedModel
                if (!model) return
                rotateModel90(model, axis)
                const bbox = computeBBox(model)
                const info = extractModelInfo(model, bbox)
                const state = useViewerStore.getState()
                state.setModel(model, bbox.box, {
                  fileName: state.modelInfo?.fileName ?? '',
                  ...info,
                })
                state.resetCalibration()
                state.invalidateFn?.()
              }}
            >
              <RotateCw className="w-3 h-3 inline mr-1" />
              {axis.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      {/* Measurement List */}
      <MeasureList />
    </div>
  )
}
