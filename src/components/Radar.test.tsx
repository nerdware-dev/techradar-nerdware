import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { RadarView } from './Radar'
import { RadarStoreProvider, useRadarDispatch } from '../state/radarStore'
import { parseRadar } from '../data/schema'
import { placeBlips } from '../radar/placement'
import { RADAR_SIZE } from '../config'

const radar = parseRadar([
  { name: 'Docker', ring: 'High', quadrant: 'platforms', isNew: 'FALSE', description: 'd' },
  { name: 'AWS', ring: 'Low', quadrant: 'platforms', isNew: 'TRUE', description: 'a' },
  { name: 'Go', ring: 'Dev', quadrant: 'languages & frameworks', isNew: 'FALSE', description: 'g' },
])
const placed = placeBlips(radar.blips, radar.rings, radar.quadrants, RADAR_SIZE)

function FocusOn({ id, children }: { id: 'platforms'; children: ReactNode }) {
  const dispatch = useRadarDispatch()
  useEffect(() => {
    dispatch({ type: 'FOCUS_QUADRANT', id })
  }, [dispatch, id])
  return <>{children}</>
}

describe('RadarView', () => {
  it('renders an svg with one circle per ring', () => {
    const { container } = render(
      <RadarStoreProvider>
        <RadarView radar={radar} placed={placed} />
      </RadarStoreProvider>,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(container.querySelectorAll('[data-ring-circle]')).toHaveLength(4)
  })

  it('renders one blip group per blip', () => {
    const { container } = render(
      <RadarStoreProvider>
        <RadarView radar={radar} placed={placed} />
      </RadarStoreProvider>,
    )
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(3)
  })

  it('renders no dim overlay when nothing is focused', () => {
    const { container } = render(
      <RadarStoreProvider>
        <RadarView radar={radar} placed={placed} />
      </RadarStoreProvider>,
    )
    // sector tints are always present; the focus dim overlay is marked [data-dim]
    expect(container.querySelectorAll('[data-dim]')).toHaveLength(0)
  })

  it('renders a dim overlay over each non-focused quadrant when focused', () => {
    const { container } = render(
      <RadarStoreProvider>
        <FocusOn id="platforms">
          <RadarView radar={radar} placed={placed} />
        </FocusOn>
      </RadarStoreProvider>,
    )
    // 4 quadrants total, 1 focused → 3 dim-overlay paths
    expect(container.querySelectorAll('[data-dim]')).toHaveLength(3)
  })
})
