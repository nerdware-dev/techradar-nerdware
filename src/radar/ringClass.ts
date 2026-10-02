import type { RingId } from '../data/types'
import styles from '../styles/blip.module.scss'

/**
 * Dot style per ring, from the centre outward: solid, softer fill, outline,
 * grey dashed outline. The quadrant colour stays the hue; the ring sets the fill.
 */
export const RING_CLASS: Record<RingId, string> = {
  high: styles.ringHigh,
  dev: styles.ringDev,
  low: styles.ringLow,
  out: styles.ringOut,
}
