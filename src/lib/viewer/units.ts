import type { Unit } from './constants'

/**
 * Format a raw model value for display.
 * The unit selector represents what 1 model unit means:
 * - User selects "m" → raw 0.7 → "0.700 m"
 * - User selects "mm" → raw 700 → "700 mm"
 * No conversion is done — the raw value IS in the user's selected unit.
 */
export function formatDimension(rawValue: number, unit: Unit): string {
  const abs = Math.abs(rawValue)
  switch (unit) {
    case 'mm':
      return abs < 1 && abs > 0
        ? rawValue.toFixed(1)
        : Math.round(rawValue).toString()
    case 'cm':
      return rawValue.toFixed(1)
    case 'm':
      return rawValue.toFixed(3)
    case 'inch':
      return rawValue.toFixed(2)
  }
}

/** Format value with unit suffix, e.g. "0.700 m" */
export function formatWithUnit(rawValue: number, unit: Unit): string {
  return `${formatDimension(rawValue, unit)} ${unit}`
}
