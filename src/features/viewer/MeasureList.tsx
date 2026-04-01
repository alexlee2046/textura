'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useViewerStore } from '@/stores/useViewerStore'
import { LABELS } from '@/lib/viewer/constants'
import { formatWithUnit, formatDimension } from '@/lib/viewer/units'
import { X, ChevronDown, ChevronRight, Copy, Trash2 } from 'lucide-react'

/**
 * Sidebar measurement list (regular React component, NOT inside Canvas).
 *
 * Shows saved measurements with expandable delta breakdown,
 * hover highlighting, per-item delete, clear all, and copy all.
 */
export function MeasureList() {
  const calibrationScale = useViewerStore((s) => s.calibrationScale)
  const measurements = useViewerStore((s) => s.measurements)
  const unit = useViewerStore((s) => s.unit)
  const removeMeasurement = useViewerStore((s) => s.removeMeasurement)
  const clearMeasurements = useViewerStore((s) => s.clearMeasurements)
  const setHighlightedMeasureId = useViewerStore((s) => s.setHighlightedMeasureId)
  const invalidateFn = useViewerStore((s) => s.invalidateFn)
  const t = useTranslations('Viewer')

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleMouseEnter = useCallback(
    (id: string) => {
      setHighlightedMeasureId(id)
      invalidateFn?.()
    },
    [setHighlightedMeasureId, invalidateFn],
  )

  const handleMouseLeave = useCallback(() => {
    setHighlightedMeasureId(null)
    invalidateFn?.()
  }, [setHighlightedMeasureId, invalidateFn])

  const handleDelete = useCallback(
    (id: string) => {
      removeMeasurement(id)
      invalidateFn?.()
    },
    [removeMeasurement, invalidateFn],
  )

  const handleClearAll = useCallback(() => {
    clearMeasurements()
    setExpandedIds(new Set())
    invalidateFn?.()
  }, [clearMeasurements, invalidateFn])

  const handleCopyAll = useCallback(async () => {
    const text = measurements
      .map((m, i) => {
        const dist = formatWithUnit(m.distance * calibrationScale, unit)
        const dx = formatDimension(m.delta.x * calibrationScale, unit)
        const dy = formatDimension(m.delta.y * calibrationScale, unit)
        const dz = formatDimension(m.delta.z * calibrationScale, unit)
        return `#${i + 1}: ${dist} (dX: ${dx}, dY: ${dy}, dZ: ${dz})`
      })
      .join('\n')

    try {
      await navigator.clipboard.writeText(text)
    } catch {
      console.warn('Clipboard write failed')
    }
  }, [measurements, calibrationScale, unit])

  if (measurements.length === 0) return null

  return (
    <section className="space-y-1.5">
      <div className="text-xs font-medium text-zinc-500 uppercase">{t(LABELS.measure)}</div>

      <div className="space-y-0.5">
        {measurements.map((m, index) => {
          const isExpanded = expandedIds.has(m.id)
          return (
            <div
              key={m.id}
              className="group rounded-md border border-zinc-100 bg-zinc-50 hover:bg-yellow-50 hover:border-yellow-200 transition-colors"
              onMouseEnter={() => handleMouseEnter(m.id)}
              onMouseLeave={handleMouseLeave}
            >
              {/* Main row */}
              <div className="flex items-center gap-1 px-2 py-1.5">
                <button
                  onClick={() => toggleExpand(m.id)}
                  className="flex-shrink-0 text-zinc-400 hover:text-zinc-600"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                <span
                  className="flex-1 text-sm text-zinc-700 font-mono cursor-pointer"
                  onClick={() => toggleExpand(m.id)}
                >
                  #{index + 1}: {formatWithUnit(m.distance * calibrationScale, unit)}
                </span>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Expanded delta detail */}
              {isExpanded && (
                <div className="px-2 pb-1.5 pl-7 text-xs text-zinc-500 font-mono space-y-0.5">
                  <div>
                    <span className="text-red-500">dX:</span>{' '}
                    {formatWithUnit(m.delta.x * calibrationScale, unit)}
                  </div>
                  <div>
                    <span className="text-green-500">dY:</span>{' '}
                    {formatWithUnit(m.delta.y * calibrationScale, unit)}
                  </div>
                  <div>
                    <span className="text-blue-500">dZ:</span>{' '}
                    {formatWithUnit(m.delta.z * calibrationScale, unit)}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={handleCopyAll}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-md bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
        >
          <Copy className="w-3 h-3" />
          {t(LABELS.copyAll)}
        </button>
        <button
          onClick={handleClearAll}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-md bg-zinc-100 text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          {t(LABELS.clearAll)}
        </button>
      </div>
    </section>
  )
}
