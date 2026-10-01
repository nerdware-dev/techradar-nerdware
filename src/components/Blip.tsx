import { useRef, type CSSProperties, type MouseEvent } from 'react'
import type { PlacedBlip } from '../radar/placement'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import { quadrantColor } from '../radar/quadrantColor'
import { RING_CLASS } from '../radar/ringClass'
import { PING_KEYFRAMES, sweepPhase } from '../radar/sweep'
import { useSweepAnimation } from '../radar/useSweepAnimation'
import { NO_ZOOM, zoomedTranslate, type Zoom } from '../radar/zoom'
import { BLIP_RADIUS as RADIUS } from '../config'
import { NewBadge } from './NewBadge'
import styles from '../styles/blip.module.scss'

/**
 * `zoom` moves the dot without scaling it, so dots keep their size when a quadrant is
 * zoomed in. `labeled` means a name label is already drawn next to the dot, so the
 * hover name is not repeated.
 */
export function Blip({
  placed,
  zoom = NO_ZOOM,
  labeled = false,
}: {
  placed: PlacedBlip
  zoom?: Zoom
  labeled?: boolean
}) {
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
      style={
        {
          '--q': quadrantColor(blip.quadrant),
          transform: zoomedTranslate(zoom, { x, y }),
        } as CSSProperties
      }
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
      <g
        data-ring={blip.ring}
        className={`${styles.enter} ${RING_CLASS[blip.ring]}`}
        style={{ animationDelay: `${(number % 14) * 0.05}s` }}
      >
        <circle ref={pingRef} data-ping className={styles.ping} r={RADIUS} />
        <circle className={styles.halo} r={RADIUS} />
        <circle className={styles.circle} r={RADIUS} />
        <text className={styles.number}>{number}</text>
        {blip.isNew && <NewBadge />}
        {isActive && !labeled && (
          <text className={styles.name} x={0} y={-RADIUS - 8}>
            {blip.name}
          </text>
        )}
      </g>
    </g>
  )
}
