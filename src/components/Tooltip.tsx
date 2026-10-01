import { useState, type CSSProperties } from 'react'
import type { Radar } from '../data/types'
import { useRadarState } from '../state/radarStore'
import { quadrantColor } from '../radar/quadrantColor'
import styles from '../styles/chrome.module.scss'

/**
 * Compact details of the hovered (else selected) blip. The card keeps a fixed height and
 * the description opens as an overlay, because the quadrant list sits right below it:
 * a card that grew on hover would push the row under the cursor away and flicker.
 */
export function Tooltip({ radar }: { radar: Radar }) {
  const { hoveredBlipId, selectedBlipId } = useRadarState()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const id = hoveredBlipId ?? selectedBlipId
  const blip = id ? radar.blips.find((b) => b.id === id) : undefined

  if (!blip) {
    return (
      <div className={styles.detailHint}>
        Fahre über einen Punkt oder wähle einen, um Details zu sehen.
      </div>
    )
  }

  const quadrant = radar.quadrants.find((q) => q.id === blip.quadrant)!
  const ring = radar.rings.find((r) => r.id === blip.ring)!
  const expanded = expandedId === blip.id

  return (
    <aside
      data-tooltip
      className={styles.detail}
      style={{ '--accent': quadrantColor(blip.quadrant) } as CSSProperties}
    >
      <div className={styles.detailHead}>
        <h3 title={blip.name}>{blip.name}</h3>
        {blip.description && (
          <button
            type="button"
            className={styles.more}
            aria-expanded={expanded}
            onClick={() => setExpandedId(expanded ? null : blip.id)}
          >
            {expanded ? 'Weniger' : 'Mehr'}
          </button>
        )}
      </div>
      <div className={styles.detailMeta}>
        <span>{quadrant.name}</span>
        <span aria-hidden="true">·</span>
        <span>{ring.name}</span>
        {blip.isNew && <span className={styles.newTag}>Neu</span>}
      </div>
      {expanded && (
        // description was sanitized in schema.ts via DOMPurify
        <div
          data-description
          className={styles.description}
          dangerouslySetInnerHTML={{ __html: blip.description }}
        />
      )}
    </aside>
  )
}
