import type { Ring, RingId } from '../data/types'
import { ringRadii } from './geometry'

/** Font size of the ring labels, in SVG user units. */
export const RING_LABEL_FONT_SIZE = 11

/**
 * Upper bound for the advance width of one uppercase label character, in em. Inter 600
 * measures 0.63–0.77 em per character across the four ring names; the margin covers the
 * system-ui fallback shown until the web font has loaded.
 */
const MAX_CHAR_WIDTH_EM = 0.8

/** Half the rendered line box height, in em (Inter: 13.2 units tall at 11 units). */
const HALF_LINE_HEIGHT_EM = 0.6

/** A ring label, centred at (x, y) on the upward axis, and the box it covers. */
export interface RingLabel {
  ringId: RingId
  text: string
  x: number
  y: number
  halfWidth: number
  halfHeight: number
}

/** One label per ring, at the middle of its band, innermost ring first. */
export function ringLabels(rings: Ring[], maxRadius: number): RingLabel[] {
  const bands = ringRadii(rings.length, maxRadius)
  return [...rings]
    .sort((a, b) => a.order - b.order)
    .map((ring, i) => {
      const text = ring.name.toUpperCase()
      return {
        ringId: ring.id,
        text,
        x: 0,
        y: -(bands[i].inner + bands[i].outer) / 2,
        halfWidth: (text.length * MAX_CHAR_WIDTH_EM * RING_LABEL_FONT_SIZE) / 2,
        halfHeight: HALF_LINE_HEIGHT_EM * RING_LABEL_FONT_SIZE,
      }
    })
}
