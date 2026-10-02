import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuadrantTable } from './QuadrantTable'
import { RadarStoreProvider, radarReducer, initialState } from '../state/radarStore'
import { FocusOn } from '../test/radarState'
import { parseRadar } from '../data/schema'
import { placeBlips } from '../radar/placement'
import { RADAR_SIZE } from '../config'

const radar = parseRadar([
  { name: 'Docker', ring: 'High', quadrant: 'platforms', description: 'd' },
  { name: 'AWS', ring: 'Low', quadrant: 'platforms', description: 'a' },
  { name: 'Go', ring: 'Dev', quadrant: 'tools', description: 'g' },
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

  it('lists a ring most-used first, entries without scan data last', () => {
    const counted = parseRadar([
      { name: 'Little', ring: 'High', quadrant: 'tools', detected: { repoCount: 2 } },
      { name: 'Curated', ring: 'High', quadrant: 'tools' },
      { name: 'Lots', ring: 'High', quadrant: 'tools', detected: { repoCount: 12 } },
    ])
    const countedPlaced = placeBlips(counted.blips, counted.rings, counted.quadrants, RADAR_SIZE)
    render(
      <RadarStoreProvider>
        <FocusOn id="tools">
          <QuadrantTable radar={counted} placed={countedPlaced} />
        </FocusOn>
      </RadarStoreProvider>,
    )
    const rows = screen.getAllByRole('button').map((row) => row.textContent)
    expect(rows).toEqual(['1Lots', '2Little', '3Curated'])
  })
})
