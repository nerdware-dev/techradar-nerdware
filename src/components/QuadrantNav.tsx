import type { CSSProperties } from 'react'
import type { Radar } from '../data/types'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import { quadrantColor } from '../radar/quadrantColor'
import styles from '../styles/quadrantNav.module.scss'

export function QuadrantNav({ radar }: { radar: Radar }) {
  const { focusedQuadrant } = useRadarState()
  const dispatch = useRadarDispatch()
  return (
    <div className={styles.nav}>
      {radar.quadrants.map((q) => {
        const count = radar.blips.filter((b) => b.quadrant === q.id).length
        const active = focusedQuadrant === q.id
        return (
          <button
            key={q.id}
            type="button"
            className={`${styles.chip} ${active ? styles.active : ''}`}
            style={{ '--c': quadrantColor(q.id) } as CSSProperties}
            onClick={() =>
              dispatch(active ? { type: 'CLEAR_FOCUS' } : { type: 'FOCUS_QUADRANT', id: q.id })
            }
          >
            <span className={styles.dot} />
            <span className={styles.label}>{q.name}</span>
            <span className={styles.count}>{count}</span>
          </button>
        )
      })}
    </div>
  )
}
