import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { RadarView } from './Radar'
import { RadarStoreProvider, useRadarDispatch } from '../state/radarStore'
import { parseRadar } from '../data/schema'
import { placeBlips } from '../radar/placement'
import { AFTERGLOW_SLICES } from '../radar/sweep'
import { RADAR_SIZE } from '../config'

const radar = parseRadar([
  { name: 'Docker', ring: 'High', quadrant: 'platforms', description: 'd' },
  { name: 'AWS', ring: 'Low', quadrant: 'platforms', description: 'a' },
  { name: 'Go', ring: 'Dev', quadrant: 'languages & frameworks', description: 'g' },
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

  it('zooms the background into the focused quadrant and labels its dots by name', () => {
    const { container } = render(
      <RadarStoreProvider>
        <FocusOn id="platforms">
          <RadarView radar={radar} placed={placed} />
        </FocusOn>
      </RadarStoreProvider>,
    )
    const scene = container.querySelector<SVGGElement>('[data-scene]')!
    expect(scene.style.transform).toContain('scale(2)')
    const names = [...container.querySelectorAll('[data-name-labels] text')].map(
      (t) => t.textContent,
    )
    expect(names.sort()).toEqual(['AWS', 'Docker'])
  })

  it('neither zooms nor labels dots when no quadrant is focused', () => {
    const { container } = render(
      <RadarStoreProvider>
        <RadarView radar={radar} placed={placed} />
      </RadarStoreProvider>,
    )
    expect(container.querySelector<SVGGElement>('[data-scene]')!.style.transform).toContain(
      'scale(1)',
    )
    expect(container.querySelector('[data-name-labels]')).toBeNull()
  })

  describe('sweep', () => {
    afterEach(() => {
      delete (window as Partial<Window>).matchMedia
    })

    it('draws the afterglow as arc-ended slices behind the beam', () => {
      const { container } = render(
        <RadarStoreProvider>
          <RadarView radar={radar} placed={placed} />
        </RadarStoreProvider>,
      )
      const slices = container.querySelectorAll('[data-sweep] path')
      expect(slices).toHaveLength(AFTERGLOW_SLICES)
      // an arc command, not a straight chord, closes each slice at the bezel
      for (const slice of slices) expect(slice.getAttribute('d')).toMatch(/ A /)
    })

    it('is not drawn when the user prefers reduced motion', () => {
      window.matchMedia = vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })) as unknown as typeof window.matchMedia
      const { container } = render(
        <RadarStoreProvider>
          <RadarView radar={radar} placed={placed} />
        </RadarStoreProvider>,
      )
      expect(container.querySelector('[data-sweep]')).toBeNull()
    })
  })
})
