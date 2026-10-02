import { useState, type CSSProperties } from 'react'
import type { Blip, Radar } from '../data/types'
import { useRadarState } from '../state/radarStore'
import { quadrantColor } from '../radar/quadrantColor'
import styles from '../styles/chrome.module.scss'

/**
 * Compact details of the hovered (else selected) blip. The card keeps a fixed height and
 * the description opens as an overlay, because the quadrant list sits right below it:
 * a card that grew on hover would push the row under the cursor away and flicker.
 */
export function DetailCard({ radar }: { radar: Radar }) {
  const { hoveredBlipId, selectedBlipId } = useRadarState()
  const id = hoveredBlipId ?? selectedBlipId
  const blip = id ? radar.blips.find((b) => b.id === id) : undefined

  if (!blip) {
    return (
      <div className={styles.detailHint}>
        Fahre über einen Punkt oder wähle einen, um Details zu sehen.
      </div>
    )
  }

  // keyed: an opened description closes as soon as the card shows another blip
  return <Details key={blip.id} radar={radar} blip={blip} selected={blip.id === selectedBlipId} />
}

/**
 * "Mehr" is only offered for the selected blip: a merely hovered blip leaves the card as
 * soon as the pointer heads for the button.
 */
function Details({ radar, blip, selected }: { radar: Radar; blip: Blip; selected: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const quadrant = radar.quadrants.find((q) => q.id === blip.quadrant)!
  const ring = radar.rings.find((r) => r.id === blip.ring)!

  return (
    <aside
      data-detail-card
      className={styles.detail}
      style={{ '--accent': quadrantColor(blip.quadrant) } as CSSProperties}
    >
      <div className={styles.detailHead}>
        <h2 title={blip.name}>{blip.name}</h2>
        {selected && blip.description && (
          <button
            type="button"
            className={styles.more}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
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
