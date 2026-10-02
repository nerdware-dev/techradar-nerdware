import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Legend } from './Legend'
import { RadarStoreProvider } from '../state/radarStore'
import { parseRadar } from '../data/schema'

const radar = parseRadar([{ name: 'Docker', ring: 'High', quadrant: 'platforms' }])

describe('Legend', () => {
  it('lists all ring names in order, followed by the "new" marker', () => {
    const { container } = render(
      <RadarStoreProvider>
        <Legend radar={radar} />
      </RadarStoreProvider>,
    )
    const items = [...container.querySelectorAll('span')].map((s) => s.textContent).filter((t) => t)
    expect(items).toEqual(['High', 'Developing', 'Low', 'Out', 'Neu'])
  })

  it('draws each ring as a miniature dot in that ring\'s style, and the "new" badge', () => {
    render(
      <RadarStoreProvider>
        <Legend radar={radar} />
      </RadarStoreProvider>,
    )
    for (const ring of ['High', 'Developing', 'Low', 'Out']) {
      const swatch = screen.getByText(ring).querySelector('svg')!
      expect(swatch.querySelector('g[class] circle')).toBeTruthy()
    }
    expect(screen.getByText('Neu').querySelector('[data-isnew="true"]')).toBeTruthy()
  })
})
