import { useMemo, useRef } from 'react'
import type { Radar } from '../data/types'
import { RADAR_SIZE } from '../config'
import { ringRadii, quadrantAngles, annularSectorPath, polarToCartesian } from '../radar/geometry'
import { layoutNameLabels, NAME_LABEL_FONT_SIZE } from '../radar/nameLabels'
import type { PlacedBlip } from '../radar/placement'
import { quadrantColor } from '../radar/quadrantColor'
import { ringLabels, RING_LABEL_FONT_SIZE } from '../radar/ringLabels'
import { AFTERGLOW_SLICES, SWEEP_ROTATION, SWEEP_START_DEG, SWEEP_TRAIL_DEG } from '../radar/sweep'
import { usePrefersReducedMotion, useSweepAnimation } from '../radar/useSweepAnimation'
import { applyZoom, NO_ZOOM, quadrantZoom, zoomedTranslate, zoomTransform } from '../radar/zoom'
import { Blip } from './Blip'
import { useRadarState } from '../state/radarStore'
import styles from '../styles/radar.module.scss'

/** Distance from the bezel's top or bottom to a quadrant label's centre line. */
const QUADRANT_LABEL_GAP = 22

/**
 * Focusing a quadrant zooms it to fill the radar. Only the background scene is scaled;
 * dots and all text are moved to their zoomed positions but keep their size, so the
 * quadrant gains room between points and its dots can carry name labels.
 */
export function RadarView({ radar, placed }: { radar: Radar; placed: PlacedBlip[] }) {
  const { focusedQuadrant, hoveredBlipId, selectedBlipId } = useRadarState()
  const max = RADAR_SIZE
  // room for the quadrant labels, which sit just above/below the bezel in the corners
  const pad = 40
  const view = max + pad
  const bands = useMemo(() => ringRadii(radar.rings.length, max), [radar.rings.length, max])
  const labels = useMemo(() => ringLabels(radar.rings, max), [radar.rings, max])

  const zoom = useMemo(() => {
    const quadrant = radar.quadrants.find((q) => q.id === focusedQuadrant)
    return quadrant ? quadrantZoom(quadrant.order, max) : NO_ZOOM
  }, [radar.quadrants, focusedQuadrant, max])

  const nameLabels = useMemo(() => {
    if (!focusedQuadrant) return []
    const targets = placed
      .filter((p) => p.blip.quadrant === focusedQuadrant)
      .sort((a, b) => a.number - b.number)
      .map((p) => ({ id: p.blip.id, name: p.blip.name, ...applyZoom(zoom, p) }))
    const dots = placed.map((p) => applyZoom(zoom, p))
    const ringLabelBoxes = labels.map((l) => ({ ...l, ...applyZoom(zoom, l) }))
    return layoutNameLabels(targets, dots, ringLabelBoxes, view)
  }, [focusedQuadrant, placed, zoom, labels, view])
  const labeledIds = useMemo(() => new Set(nameLabels.map((l) => l.blipId)), [nameLabels])
  const activeId = hoveredBlipId ?? selectedBlipId

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

  const nameLabelClass = (blipId: string) => {
    if (activeId === null) return styles.nameLabel
    return `${styles.nameLabel} ${blipId === activeId ? styles.nameLabelActive : styles.nameLabelDimmed}`
  }

  return (
    <svg
      className={styles.svg}
      viewBox={`${-view} ${-view} ${2 * view} ${2 * view}`}
      role="img"
      aria-label="Tech Radar"
    >
      {/* background scene, drawn in radar coordinates and scaled as a whole when zoomed */}
      <g data-scene className={styles.scene} style={{ transform: zoomTransform(zoom) }}>
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

        {/* focus dim overlay over the other quadrants */}
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
      </g>

      {/* ring (competency) labels up the top axis; above the dim overlay, never dimmed */}
      {labels.map((label) => (
        <text
          key={label.ringId}
          className={styles.ringLabel}
          style={{ transform: zoomedTranslate(zoom, label) }}
          fontSize={RING_LABEL_FONT_SIZE}
        >
          {label.text}
        </text>
      ))}

      {/* quadrant labels — in the corners of the bounding square, hidden while zoomed */}
      {radar.quadrants.map((q) => {
        const { start, end } = quadrantAngles(q.order)
        const corner = polarToCartesian((start + end) / 2, 1)
        const onRight = corner.x > 0
        return (
          <text
            key={q.id}
            className={`${styles.quadrantLabel} ${focusedQuadrant ? styles.hidden : ''}`}
            x={onRight ? max : -max}
            y={Math.sign(corner.y) * (max + QUADRANT_LABEL_GAP)}
            textAnchor={onRight ? 'end' : 'start'}
            style={{ fill: quadrantColor(q.id) }}
          >
            {q.name}
          </text>
        )
      })}

      {placed.map((p) => (
        <Blip key={p.blip.id} placed={p} zoom={zoom} labeled={labeledIds.has(p.blip.id)} />
      ))}

      {/* name labels of the focused quadrant; keyed so they fade in again after each zoom */}
      {nameLabels.length > 0 && (
        <g key={focusedQuadrant} data-name-labels className={styles.nameLabels}>
          {nameLabels.map((label) => (
            <text
              key={label.blipId}
              className={nameLabelClass(label.blipId)}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              data-side={label.side}
              fontSize={NAME_LABEL_FONT_SIZE}
            >
              {label.text}
            </text>
          ))}
        </g>
      )}
    </svg>
  )
}
