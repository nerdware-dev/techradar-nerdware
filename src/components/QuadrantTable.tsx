import type { Radar } from '../data/types'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import styles from '../styles/quadrantTable.module.scss'
import { placeBlips } from '../radar/placement'
import { RADAR_SIZE } from '../config'

export function QuadrantTable({ radar }: { radar: Radar }) {
  const { focusedQuadrant, selectedBlipId } = useRadarState()
  const dispatch = useRadarDispatch()
  if (!focusedQuadrant) return null

  const quadrant = radar.quadrants.find((q) => q.id === focusedQuadrant)!
  const numbers = new Map(
    placeBlips(radar.blips, radar.rings, radar.quadrants, RADAR_SIZE).map((p) => [
      p.blip.id,
      p.number,
    ]),
  )
  const rings = [...radar.rings].sort((a, b) => a.order - b.order)

  return (
    <div data-quadrant-table className={styles.table}>
      <h2>{quadrant.name}</h2>
      {rings.map((ring) => {
        const blips = radar.blips
          .filter((b) => b.quadrant === quadrant.id && b.ring === ring.id)
          .sort((a, b) => a.name.localeCompare(b.name))
        if (blips.length === 0) return null
        return (
          <div key={ring.id}>
            <p className={styles.ringHeading}>{ring.name}</p>
            {blips.map((b) => (
              <button
                key={b.id}
                className={`${styles.row} ${selectedBlipId === b.id ? styles.rowSelected : ''}`}
                onMouseEnter={() => dispatch({ type: 'HOVER_BLIP', id: b.id })}
                onMouseLeave={() => dispatch({ type: 'HOVER_BLIP', id: null })}
                onClick={() => dispatch({ type: 'SELECT_BLIP', id: b.id, quadrant: b.quadrant })}
              >
                <span className={styles.num}>{numbers.get(b.id)}</span>
                <span>{b.name}</span>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
