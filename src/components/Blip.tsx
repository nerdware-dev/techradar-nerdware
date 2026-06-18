import type { PlacedBlip } from '../radar/placement'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import styles from '../styles/blip.module.scss'

const RADIUS = 10

export function Blip({ placed }: { placed: PlacedBlip }) {
  const { blip, x, y, number } = placed
  const state = useRadarState()
  const dispatch = useRadarDispatch()
  const selected = state.selectedBlipId === blip.id || state.hoveredBlipId === blip.id

  return (
    <g
      className={`${styles.group} ${selected ? styles.selected : ''}`}
      transform={`translate(${x} ${y})`}
      role="button"
      aria-label={blip.name}
      tabIndex={0}
      onMouseEnter={() => dispatch({ type: 'HOVER_BLIP', id: blip.id })}
      onMouseLeave={() => dispatch({ type: 'HOVER_BLIP', id: null })}
      onClick={() => dispatch({ type: 'SELECT_BLIP', id: blip.id, quadrant: blip.quadrant })}
    >
      {blip.isNew && <circle data-isnew="true" className={styles.newRing} r={RADIUS + 3} />}
      <circle className={styles.circle} r={RADIUS} />
      <text className={styles.number}>{number}</text>
    </g>
  )
}
