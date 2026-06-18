import type { CSSProperties } from 'react'
import type { Radar } from '../data/types'
import { useRadarState } from '../state/radarStore'
import { quadrantColor } from '../radar/quadrantColor'
import styles from '../styles/chrome.module.scss'

export function Tooltip({ radar }: { radar: Radar }) {
  const { hoveredBlipId, selectedBlipId } = useRadarState()
  const id = hoveredBlipId ?? selectedBlipId
  const blip = id ? radar.blips.find((b) => b.id === id) : undefined

  // Constant-height slot: content changes but the outer height never does,
  // so hovering list rows can't shift the layout (no flicker loop).
  return (
    <div className={styles.tooltipSlot}>
      {blip ? (
        <aside
          data-tooltip
          className={styles.tooltip}
          style={{ '--accent': quadrantColor(blip.quadrant) } as CSSProperties}
        >
          <h3>{blip.name}</h3>
          {/* description was sanitized in schema.ts via DOMPurify */}
          <div dangerouslySetInnerHTML={{ __html: blip.description }} />
        </aside>
      ) : (
        <div className={styles.tooltipHint}>Punkt antippen oder überfahren für Details</div>
      )}
    </div>
  )
}
