import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { DetailCard } from './DetailCard'
import { RadarStoreProvider } from '../state/radarStore'
import { parseRadar } from '../data/schema'
import { Hovered, Selected } from '../test/radarState'

const radar = parseRadar(
  [
    {
      name: 'Docker',
      ring: 'High',
      quadrant: 'platforms',
      addedAt: '2026-09-20',
      description: 'Container <a href="https://x.y">docs</a>',
    },
    { name: 'AWS', ring: 'Low', quadrant: 'platforms', description: 'Cloud' },
  ],
  new Date('2026-10-01T12:00:00Z'),
)

function renderCard(wrap: (card: ReactNode) => ReactNode = (card) => card) {
  return render(<RadarStoreProvider>{wrap(<DetailCard radar={radar} />)}</RadarStoreProvider>)
}

describe('DetailCard', () => {
  it('shows a hint when no blip is active', () => {
    const { container } = renderCard()
    expect(container.querySelector('[data-detail-card]')).toBeNull()
    expect(screen.getByText(/Fahre über einen Punkt/)).toBeInTheDocument()
  })

  it('shows name, quadrant, ring and the "neu" tag, with the description collapsed', () => {
    const { container } = renderCard((card) => <Selected id="docker">{card}</Selected>)
    expect(screen.getByRole('heading', { level: 2, name: 'Docker' })).toBeInTheDocument()
    expect(screen.getByText('Platforms')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Neu')).toBeInTheDocument()
    expect(container.querySelector('[data-description]')).toBeNull()
  })

  it('opens and closes the description of the selected blip with the Mehr toggle', () => {
    const { container } = renderCard((card) => <Selected id="docker">{card}</Selected>)
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }))
    expect(container.querySelector('[data-description]')?.innerHTML).toContain('Container')
    fireEvent.click(screen.getByRole('button', { name: 'Weniger' }))
    expect(container.querySelector('[data-description]')).toBeNull()
  })

  it('offers no Mehr toggle for a blip that is only hovered', () => {
    renderCard((card) => <Hovered id="docker">{card}</Hovered>)
    expect(screen.getByRole('heading', { name: 'Docker' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mehr' })).toBeNull()
  })

  it('closes an opened description once the card shows another blip', () => {
    const { container, rerender } = render(
      <RadarStoreProvider>
        <Selected id="docker">
          <DetailCard radar={radar} />
        </Selected>
      </RadarStoreProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }))
    rerender(
      <RadarStoreProvider>
        <Selected id="aws">
          <DetailCard radar={radar} />
        </Selected>
      </RadarStoreProvider>,
    )
    expect(screen.getByRole('heading', { name: 'AWS' })).toBeInTheDocument()
    expect(container.querySelector('[data-description]')).toBeNull()
  })
})
