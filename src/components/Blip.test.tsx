import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Blip } from './Blip'
import { RadarStoreProvider } from '../state/radarStore'
import { Selected } from '../test/radarState'
import { quadrantZoom } from '../radar/zoom'
import type { PlacedBlip } from '../radar/placement'

const placed: PlacedBlip = {
  blip: {
    id: 'docker',
    name: 'Docker',
    ring: 'high',
    quadrant: 'platforms',
    isNew: true,
    description: 'd',
  },
  x: 10,
  y: 20,
  number: 3,
}

function renderBlip(p: PlacedBlip = placed) {
  return render(
    <svg>
      <RadarStoreProvider>
        <Blip placed={p} />
      </RadarStoreProvider>
    </svg>,
  )
}

describe('Blip', () => {
  it('renders the blip number', () => {
    renderBlip()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('exposes the blip name as an accessible label', () => {
    renderBlip()
    expect(screen.getByLabelText('Docker')).toBeInTheDocument()
  })

  it('renders an isNew marker when the blip is new', () => {
    const { container } = renderBlip()
    expect(container.querySelector('[data-isnew="true"]')).toBeTruthy()
  })

  it('renders no isNew marker when the blip is not new', () => {
    const { container } = renderBlip({ ...placed, blip: { ...placed.blip, isNew: false } })
    expect(container.querySelector('[data-isnew="true"]')).toBeNull()
  })

  it('marks the dot with its ring so the ring style applies', () => {
    const { container } = renderBlip({ ...placed, blip: { ...placed.blip, ring: 'out' } })
    expect(container.querySelector('[data-ring="out"]')).toBeTruthy()
  })

  it('shows the name above the active dot unless a name label already shows it', () => {
    const renderActive = (labeled: boolean) =>
      render(
        <svg>
          <RadarStoreProvider>
            <Selected id="docker">
              <Blip placed={placed} labeled={labeled} />
            </Selected>
          </RadarStoreProvider>
        </svg>,
      )
    expect(renderActive(false).getByText('Docker')).toBeInTheDocument()
    const { container } = renderActive(true)
    expect([...container.querySelectorAll('text')].map((t) => t.textContent)).toEqual(['3'])
  })

  it('moves to its zoomed position without being scaled', () => {
    const zoom = quadrantZoom(1, 400) // platforms: scale 2, shifted by (400, -400)
    const { getByLabelText } = render(
      <svg>
        <RadarStoreProvider>
          <Blip placed={placed} zoom={zoom} />
        </RadarStoreProvider>
      </svg>,
    )
    // (10, 20) → 2 · (10, 20) + (400, -400)
    expect((getByLabelText('Docker') as unknown as SVGGElement).style.transform).toBe(
      'translate(420px, -360px)',
    )
  })

  it('renders a ping element for the sweep flash', () => {
    const { container } = renderBlip()
    expect(container.querySelector('[data-ping]')).toBeTruthy()
  })

  it('does not throw on click (selection dispatch)', () => {
    renderBlip()
    fireEvent.click(screen.getByLabelText('Docker'))
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
