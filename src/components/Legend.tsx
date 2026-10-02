import type { CSSProperties, ReactNode } from 'react'
import type { Radar } from '../data/types'
import { BLIP_RADIUS } from '../config'
import { RING_CLASS } from '../radar/ringClass'
import { NewBadge } from './NewBadge'
import styles from '../styles/chrome.module.scss'
import blipStyles from '../styles/blip.module.scss'

/**
 * A miniature blip drawn with the blip's own classes, so the legend always matches the
 * radar. Neutral colours stand in for the quadrant hue; `--q` sits on the <svg> so that a
 * ring class on the inner <g> (e.g. Out's grey) can still override it.
 */
function Swatch({ color, children }: { color: string; children: ReactNode }) {
  return (
    <svg
      className={styles.swatch}
      viewBox="-12 -12 24 24"
      aria-hidden="true"
      style={{ '--q': color } as CSSProperties}
    >
      {children}
    </svg>
  )
}

export function Legend({ radar }: { radar: Radar }) {
  const rings = [...radar.rings].sort((a, b) => a.order - b.order)
  return (
    <div className={styles.legend}>
      {rings.map((r) => (
        <span key={r.id} className={styles.legendItem}>
          <Swatch color="var(--text)">
            <g className={RING_CLASS[r.id]}>
              <circle className={blipStyles.circle} r={BLIP_RADIUS} />
            </g>
          </Swatch>
          {r.name}
        </span>
      ))}
      <span className={styles.legendItem}>
        <Swatch color="var(--text-mute)">
          <circle className={blipStyles.circle} r={BLIP_RADIUS} />
          <NewBadge />
        </Swatch>
        Neu
      </span>
    </div>
  )
}
