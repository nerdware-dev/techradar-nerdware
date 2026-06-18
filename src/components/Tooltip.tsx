import type { CSSProperties } from 'react'
import type { Radar } from '../data/types'
import { useRadarState } from '../state/radarStore'
import { quadrantColor } from '../radar/quadrantColor'
import styles from '../styles/chrome.module.scss'

export function Tooltip({ radar }: { radar: Radar }) {
  const { hoveredBlipId, selectedBlipId } = useRadarState()
  const id = hoveredBlipId ?? selectedBlipId
  const blip = id ? radar.blips.find((b) => b.id === id) : undefined
  if (!blip) return null
  // Rendered last in the sidebar (below the list), so it can grow to any height
  // without shifting the list above it — no clipping, no hover flicker loop.
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
