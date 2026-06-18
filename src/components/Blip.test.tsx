import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Blip } from './Blip'
import { RadarStoreProvider } from '../state/radarStore'
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

  it('does not throw on click (selection dispatch)', () => {
    renderBlip()
    fireEvent.click(screen.getByLabelText('Docker'))
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
