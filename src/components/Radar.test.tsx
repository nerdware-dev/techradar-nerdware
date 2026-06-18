import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RadarView } from './Radar'
import { RadarStoreProvider } from '../state/radarStore'
import { parseRadar } from '../data/schema'

const radar = parseRadar([
  { name: 'Docker', ring: 'High', quadrant: 'platforms', isNew: 'FALSE', description: 'd' },
  { name: 'AWS', ring: 'Low', quadrant: 'platforms', isNew: 'TRUE', description: 'a' },
  { name: 'Go', ring: 'Dev', quadrant: 'languages & frameworks', isNew: 'FALSE', description: 'g' },
])

describe('RadarView', () => {
  it('renders an svg with one circle per ring', () => {
    const { container } = render(
      <RadarStoreProvider>
        <RadarView radar={radar} />
      </RadarStoreProvider>,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(container.querySelectorAll('[data-ring-circle]')).toHaveLength(4)
  })

  it('renders one blip group per blip', () => {
    const { container } = render(
      <RadarStoreProvider>
        <RadarView radar={radar} />
      </RadarStoreProvider>,
    )
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(3)
  })
})
