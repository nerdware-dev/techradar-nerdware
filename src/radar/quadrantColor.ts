import type { QuadrantId } from '../data/types'

/**
 * Per-quadrant accent colors, drawn from the Nerdware dark-mode design system
 * palette: Cyan (brand), Yellow, Lavender/Indigo (primary), Rose.
 */
export const QUADRANT_COLORS: Record<QuadrantId, string> = {
  techniques: '#00ffbf', // Cyan 500 (brand)
  platforms: '#facc15', // Yellow 400
  tools: '#a0aaff', // Indigo 300 (lavender / primary)
  'languages-frameworks': '#fb7185', // Rose 400
}

export function quadrantColor(id: QuadrantId): string {
  return QUADRANT_COLORS[id] ?? '#00ffbf'
}
