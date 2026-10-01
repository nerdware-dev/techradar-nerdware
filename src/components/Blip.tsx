import { useRef, type CSSProperties, type MouseEvent } from 'react'
import type { PlacedBlip } from '../radar/placement'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import { quadrantColor } from '../radar/quadrantColor'
import { PING_KEYFRAMES, sweepPhase } from '../radar/sweep'
import { useSweepAnimation } from '../radar/useSweepAnimation'
import { BLIP_RADIUS as RADIUS } from '../config'
import styles from '../styles/blip.module.scss'

/** The "new" badge sits on the dot's upper-right rim (45°). */
const NEW_BADGE_OFFSET = RADIUS * Math.SQRT1_2

export function Blip({ placed }: { placed: PlacedBlip }) {
  const { blip, x, y, number } = placed
  const state = useRadarState()
  const dispatch = useRadarDispatch()
  const pingRef = useRef<SVGCircleElement>(null)
  useSweepAnimation(pingRef, PING_KEYFRAMES, sweepPhase(x, y))

  const activeId = state.hoveredBlipId ?? state.selectedBlipId
  const isActive = activeId === blip.id
  // dim when another blip is active, or when a different quadrant is focused
  const dimmed =
    (activeId !== null && !isActive) ||
    (state.focusedQuadrant !== null && !isActive && blip.quadrant !== state.focusedQuadrant)

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
        <circle ref={pingRef} data-ping className={styles.ping} r={RADIUS} />
        <circle className={styles.halo} r={RADIUS} />
        <circle className={styles.circle} r={RADIUS} />
        <text className={styles.number}>{number}</text>
        {blip.isNew && (
          <circle
            data-isnew="true"
            className={styles.newBadge}
            cx={NEW_BADGE_OFFSET}
            cy={-NEW_BADGE_OFFSET}
            r={3.2}
          />
        )}
        {isActive && (
          <text className={styles.name} x={0} y={-RADIUS - 8}>
            {blip.name}
          </text>
        )}
      </g>
    </g>
  )
}
