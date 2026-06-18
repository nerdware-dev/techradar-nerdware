import type { CSSProperties } from 'react'
import type { Radar } from '../data/types'
import { useRadarState } from '../state/radarStore'
import { quadrantColor } from '../radar/quadrantColor'
import styles from '../styles/chrome.module.scss'

export function Tooltip({ radar }: { radar: Radar }) {
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

  // own column → grows beside the list (no scroll to reach it, never shifts it)
  return (
    <aside
      data-tooltip
      className={styles.tooltip}
      style={{ '--accent': quadrantColor(blip.quadrant) } as CSSProperties}
    >
      <h3>{blip.name}</h3>
      {/* description was sanitized in schema.ts via DOMPurify */}
      <div dangerouslySetInnerHTML={{ __html: blip.description }} />
    </aside>
  )
}
