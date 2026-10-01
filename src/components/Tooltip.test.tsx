import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { Tooltip } from './Tooltip'
import { Legend } from './Legend'
import { RadarStoreProvider, useRadarDispatch } from '../state/radarStore'
import { parseRadar } from '../data/schema'

const radar = parseRadar([
  {
    name: 'Docker',
    ring: 'High',
    quadrant: 'platforms',
    description: 'Container <a href="https://x.y">docs</a>',
  },
])

function Selected({ id, children }: { id: string; children: ReactNode }) {
  const dispatch = useRadarDispatch()
  useEffect(() => {
    dispatch({ type: 'SELECT_BLIP', id })
  }, [dispatch, id])
  return <>{children}</>
}

function renderSelected() {
  return render(
    <RadarStoreProvider>
      <Selected id="docker">
        <Tooltip radar={radar} />
      </Selected>
    </RadarStoreProvider>,
  )
}

describe('Tooltip', () => {
  it('renders nothing when no blip is active', () => {
    const { container } = render(
      <RadarStoreProvider>
        <Tooltip radar={radar} />
      </RadarStoreProvider>,
    )
    expect(container.querySelector('[data-tooltip]')).toBeNull()
  })

  it('shows name, quadrant and ring of the active blip, with the description collapsed', () => {
    const { container } = renderSelected()
    expect(screen.getByRole('heading', { name: 'Docker' })).toBeInTheDocument()
    expect(screen.getByText('Platforms')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(container.querySelector('[data-description]')).toBeNull()
  })

  it('opens and closes the description with the Mehr toggle', () => {
    const { container } = renderSelected()
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }))
    expect(container.querySelector('[data-description]')?.innerHTML).toContain('Container')
    fireEvent.click(screen.getByRole('button', { name: 'Weniger' }))
    expect(container.querySelector('[data-description]')).toBeNull()
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
