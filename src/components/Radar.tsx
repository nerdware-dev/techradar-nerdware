import { useMemo } from 'react'
import type { Radar } from '../data/types'
import { RADAR_SIZE } from '../config'
import { ringRadii, quadrantAngles, annularSectorPath } from '../radar/geometry'
import type { PlacedBlip } from '../radar/placement'
import { Blip } from './Blip'
import { useRadarState } from '../state/radarStore'
import styles from '../styles/radar.module.scss'

export function RadarView({ radar, placed }: { radar: Radar; placed: PlacedBlip[] }) {
  const { focusedQuadrant } = useRadarState()
  const max = RADAR_SIZE
  const bands = useMemo(() => ringRadii(radar.rings.length, max), [radar.rings.length, max])
  const pad = 20
  const view = max + pad

  return (
    <svg
      className={styles.svg}
      viewBox={`${-view} ${-view} ${2 * view} ${2 * view}`}
      role="img"
      aria-label="Tech Radar"
    >
      {bands.map((b, i) => (
        <circle key={i} data-ring-circle r={b.outer} cx={0} cy={0} className={styles.ring} />
      ))}
      <line className={styles.axis} x1={-max} y1={0} x2={max} y2={0} />
      <line className={styles.axis} x1={0} y1={-max} x2={0} y2={max} />

      {placed.map((p) => (
        <Blip key={p.blip.id} placed={p} />
      ))}

      {focusedQuadrant &&
        radar.quadrants
          .filter((q) => q.id !== focusedQuadrant)
          .map((q) => {
            const { start, end } = quadrantAngles(q.order)
            return (
              <path key={q.id} className={styles.dim} d={annularSectorPath(start, end, 0, max)} />
            )
          })}
    </svg>
  )
}
