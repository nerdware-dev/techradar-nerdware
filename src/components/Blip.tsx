import type { CSSProperties, MouseEvent } from 'react'
import type { PlacedBlip } from '../radar/placement'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import { quadrantColor } from '../radar/quadrantColor'
import styles from '../styles/blip.module.scss'

const RADIUS = 9

export function Blip({ placed }: { placed: PlacedBlip }) {
  const { blip, x, y, number } = placed
  const state = useRadarState()
  const dispatch = useRadarDispatch()
  const activeId = state.hoveredBlipId ?? state.selectedBlipId
  const isActive = activeId === blip.id
  const dimmed = activeId !== null && !isActive

  return (
    <g
      className={`${styles.group} ${isActive ? styles.active : ''} ${dimmed ? styles.dimmed : ''}`}
      transform={`translate(${x} ${y})`}
      style={{ '--q': quadrantColor(blip.quadrant) } as CSSProperties}
      role="button"
      aria-label={blip.name}
      tabIndex={0}
      onMouseEnter={() => dispatch({ type: 'HOVER_BLIP', id: blip.id })}
      onMouseLeave={() => dispatch({ type: 'HOVER_BLIP', id: null })}
      onClick={(e: MouseEvent) => {
        e.stopPropagation() // don't let the radar background clear the focus
        dispatch({ type: 'SELECT_BLIP', id: blip.id, quadrant: blip.quadrant })
      }}
    >
      <g className={styles.enter} style={{ animationDelay: `${(number % 14) * 0.05}s` }}>
        {blip.isNew && <circle data-isnew="true" className={styles.newRing} r={RADIUS + 4} />}
        <circle className={styles.halo} r={RADIUS} />
        <circle className={styles.circle} r={RADIUS} />
        <text className={styles.number}>{number}</text>
        {isActive && (
          <text className={styles.name} x={0} y={-RADIUS - 8}>
            {blip.name}
          </text>
        )}
      </g>
    </g>
  )
}
