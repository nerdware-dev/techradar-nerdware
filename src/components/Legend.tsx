import type { Radar } from '../data/types'
import styles from '../styles/chrome.module.scss'

export function Legend({ radar }: { radar: Radar }) {
  const rings = [...radar.rings].sort((a, b) => a.order - b.order)
  return (
    <div className={styles.legend}>
      {rings.map((r) => (
        <span key={r.id} className={styles.legendItem}>
          <span className={styles.swatch} />
          {r.name}
        </span>
      ))}
    </div>
  )
}
