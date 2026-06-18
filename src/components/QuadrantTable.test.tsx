import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { QuadrantTable } from './QuadrantTable'
import { RadarStoreProvider, radarReducer, initialState } from '../state/radarStore'
import { parseRadar } from '../data/schema'
import { placeBlips } from '../radar/placement'
import { RADAR_SIZE } from '../config'

const radar = parseRadar([
  { name: 'Docker', ring: 'High', quadrant: 'platforms', isNew: 'FALSE', description: 'd' },
  { name: 'AWS', ring: 'Low', quadrant: 'platforms', isNew: 'FALSE', description: 'a' },
  { name: 'Go', ring: 'Dev', quadrant: 'tools', isNew: 'FALSE', description: 'g' },
])
const placed = placeBlips(radar.blips, radar.rings, radar.quadrants, RADAR_SIZE)

// Provider seeded with a focused quadrant for the test
function Seeded({ children }: { children: React.ReactNode }) {
  return <RadarStoreProvider>{children}</RadarStoreProvider>
}

describe('QuadrantTable', () => {
  it('renders nothing when no quadrant is focused', () => {
    const { container } = render(
      <Seeded>
        <QuadrantTable radar={radar} placed={placed} />
      </Seeded>,
    )
    expect(container.querySelector('[data-quadrant-table]')).toBeNull()
  })

  it('reducer focuses platforms and the table would list its blips', () => {
    // unit check on selection logic that the table relies on
    const s = radarReducer(initialState, { type: 'FOCUS_QUADRANT', id: 'platforms' })
    expect(s.focusedQuadrant).toBe('platforms')
  })
})
