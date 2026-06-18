import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip } from './Tooltip'
import { Legend } from './Legend'
import { RadarStoreProvider } from '../state/radarStore'
import { parseRadar } from '../data/schema'

const radar = parseRadar([
  {
    name: 'Docker',
    ring: 'High',
    quadrant: 'platforms',
    isNew: 'FALSE',
    description: 'Container <a href="https://x.y">docs</a>',
  },
])

describe('Tooltip', () => {
  it('renders nothing when no blip is active', () => {
    const { container } = render(
      <RadarStoreProvider>
        <Tooltip radar={radar} />
      </RadarStoreProvider>,
    )
    expect(container.querySelector('[data-tooltip]')).toBeNull()
  })
})

describe('Legend', () => {
  it('lists all ring names in order', () => {
    render(
      <RadarStoreProvider>
        <Legend radar={radar} />
      </RadarStoreProvider>,
    )
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Out')).toBeInTheDocument()
  })
})
