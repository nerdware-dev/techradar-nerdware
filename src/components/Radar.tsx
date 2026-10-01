import { useMemo, useRef } from 'react'
import type { Radar } from '../data/types'
import { RADAR_SIZE } from '../config'
import { ringRadii, quadrantAngles, annularSectorPath, polarToCartesian } from '../radar/geometry'
import type { PlacedBlip } from '../radar/placement'
import { quadrantColor } from '../radar/quadrantColor'
import { ringLabels, RING_LABEL_FONT_SIZE } from '../radar/ringLabels'
import { AFTERGLOW_SLICES, SWEEP_ROTATION, SWEEP_START_DEG, SWEEP_TRAIL_DEG } from '../radar/sweep'
import { usePrefersReducedMotion, useSweepAnimation } from '../radar/useSweepAnimation'
import { Blip } from './Blip'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import styles from '../styles/radar.module.scss'

/** Distance from the bezel's top or bottom to a quadrant label's centre line. */
const QUADRANT_LABEL_GAP = 22

export function RadarView({ radar, placed }: { radar: Radar; placed: PlacedBlip[] }) {
  const { focusedQuadrant } = useRadarState()
  const dispatch = useRadarDispatch()
  const max = RADAR_SIZE
  // room for the quadrant labels, which sit just above/below the bezel in the corners
  const pad = 40
  const view = max + pad
  const bands = useMemo(() => ringRadii(radar.rings.length, max), [radar.rings.length, max])
  const labels = useMemo(() => ringLabels(radar.rings, max), [radar.rings, max])

  const sweepRef = useRef<SVGGElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  useSweepAnimation(sweepRef, SWEEP_ROTATION, 0)

  // The sweep turns clockwise, so the afterglow lies counter-clockwise of the beam.
  const beam = polarToCartesian(SWEEP_START_DEG, max)
  const afterglow = useMemo(
    () =>
      Array.from({ length: AFTERGLOW_SLICES }, (_, i) => {
        const reach = (SWEEP_TRAIL_DEG * (i + 1)) / AFTERGLOW_SLICES
        return annularSectorPath(SWEEP_START_DEG - reach, SWEEP_START_DEG, 0, max)
      }),
    [max],
  )

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

      {/* rotating radar sweep; a static beam would only cover the ring labels */}
      {!reducedMotion && (
        <g ref={sweepRef} data-sweep className={styles.sweep}>
          {afterglow.map((d, i) => (
            <path key={i} className={styles.afterglow} d={d} />
          ))}
          <line className={styles.sweepBeam} x1={0} y1={0} x2={beam.x} y2={beam.y} />
        </g>
      )}

      {/* outer bezel + quadrant divider axes */}
      <circle className={styles.bezel} r={max} cx={0} cy={0} />
      <line className={styles.axis} x1={-max} y1={0} x2={max} y2={0} />
      <line className={styles.axis} x1={0} y1={-max} x2={0} y2={max} />

      {/* ring grid circles — exactly one per ring (data-ring-circle) */}
      {bands.map((b, i) => (
        <circle key={i} data-ring-circle r={b.outer} cx={0} cy={0} className={styles.ring} />
      ))}

      {/* ring (competency) labels up the top axis */}
      {labels.map((label) => (
        <text
          key={label.ringId}
          className={styles.ringLabel}
          x={label.x}
          y={label.y}
          fontSize={RING_LABEL_FONT_SIZE}
        >
          {label.text}
        </text>
      ))}

      {/* quadrant labels — in the corners of the bounding square, outside the circle */}
      {radar.quadrants.map((q) => {
        const { start, end } = quadrantAngles(q.order)
        const corner = polarToCartesian((start + end) / 2, 1)
        const onRight = corner.x > 0
        return (
          <text
            key={q.id}
            className={styles.quadrantLabel}
            x={onRight ? max : -max}
            y={Math.sign(corner.y) * (max + QUADRANT_LABEL_GAP)}
            textAnchor={onRight ? 'end' : 'start'}
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
