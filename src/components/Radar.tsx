import { useMemo } from 'react'
import type { Radar } from '../data/types'
import { RADAR_SIZE } from '../config'
import { ringRadii, quadrantAngles, annularSectorPath, polarToCartesian } from '../radar/geometry'
import type { PlacedBlip } from '../radar/placement'
import { quadrantColor } from '../radar/quadrantColor'
import { Blip } from './Blip'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import styles from '../styles/radar.module.scss'

export function RadarView({ radar, placed }: { radar: Radar; placed: PlacedBlip[] }) {
  const { focusedQuadrant } = useRadarState()
  const dispatch = useRadarDispatch()
  const max = RADAR_SIZE
  const pad = 132
  const view = max + pad
  const bands = useMemo(() => ringRadii(radar.rings.length, max), [radar.rings.length, max])
  const rings = useMemo(() => [...radar.rings].sort((a, b) => a.order - b.order), [radar.rings])

  // radar sweep wedge: leading beam points up, trailing edge ~46° behind
  const beam = polarToCartesian(-90, max)
  const trail = polarToCartesian(-90 + 46, max)

  const sectorOpacity = (qid: string) =>
    focusedQuadrant ? (qid === focusedQuadrant ? 0.15 : 0.02) : 0.06

  return (
    <svg
      className={styles.svg}
      viewBox={`${-view} ${-view} ${2 * view} ${2 * view}`}
      role="img"
      aria-label="Tech Radar"
      onClick={() => dispatch({ type: 'CLEAR_FOCUS' })}
    >
      {/* per-quadrant sector tints — make the sectors read clearly */}
      {radar.quadrants.map((q) => {
        const { start, end } = quadrantAngles(q.order)
        return (
          <path
            key={`sector-${q.id}`}
            className={styles.sector}
            d={annularSectorPath(start, end, 0, max)}
            style={{ fill: quadrantColor(q.id), fillOpacity: sectorOpacity(q.id) }}
          />
        )
      })}

      {/* concentric band shading (decorative; outer drawn first) */}
      {bands
        .slice()
        .reverse()
        .map((b, idx) => {
          const i = bands.length - 1 - idx
          return (
            <circle
              key={`band-${i}`}
              className={i % 2 === 0 ? styles.bandA : styles.bandB}
              r={b.outer}
              cx={0}
              cy={0}
            />
          )
        })}

      {/* rotating radar sweep */}
      <g>
        <polygon
          className={styles.sweepArea}
          points={`0,0 ${beam.x},${beam.y} ${trail.x},${trail.y}`}
        />
        <line className={styles.sweepBeam} x1={0} y1={0} x2={beam.x} y2={beam.y} />
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 0 0"
          to="360 0 0"
          dur="11s"
          repeatCount="indefinite"
        />
      </g>

      {/* outer bezel + quadrant divider axes */}
      <circle className={styles.bezel} r={max} cx={0} cy={0} />
      <line className={styles.axis} x1={-max} y1={0} x2={max} y2={0} />
      <line className={styles.axis} x1={0} y1={-max} x2={0} y2={max} />

      {/* ring grid circles — exactly one per ring (data-ring-circle) */}
      {bands.map((b, i) => (
        <circle key={i} data-ring-circle r={b.outer} cx={0} cy={0} className={styles.ring} />
      ))}

      {/* ring (competency) labels up the top axis */}
      {rings.map((ring, i) => {
        const b = bands[i]
        const midR = (b.inner + b.outer) / 2
        return (
          <text key={ring.id} className={styles.ringLabel} x={0} y={-midR}>
            {ring.name.toUpperCase()}
          </text>
        )
      })}

      {/* quadrant labels — pushed into the corner whitespace, clear of the rings */}
      {radar.quadrants.map((q) => {
        const { start, end } = quadrantAngles(q.order)
        const p = polarToCartesian((start + end) / 2, max * 1.18)
        return (
          <text
            key={q.id}
            className={styles.quadrantLabel}
            x={p.x}
            y={p.y}
            style={{ fill: quadrantColor(q.id) }}
          >
            {q.name}
          </text>
        )
      })}

      {/* focus dim overlay — UNDER the blips, so the active blip + its label
          (which may extend over a neighbouring quadrant) never get darkened */}
      {focusedQuadrant &&
        radar.quadrants
          .filter((q) => q.id !== focusedQuadrant)
          .map((q) => {
            const { start, end } = quadrantAngles(q.order)
            return (
              <path
                key={q.id}
                data-dim
                className={styles.dim}
                d={annularSectorPath(start, end, 0, max)}
              />
            )
          })}

      {/* blips on top of everything */}
      {placed.map((p) => (
        <Blip key={p.blip.id} placed={p} />
      ))}
    </svg>
  )
}
