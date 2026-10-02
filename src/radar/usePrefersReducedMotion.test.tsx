import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

function Probe() {
  return <span>{usePrefersReducedMotion() ? 'reduced' : 'full'}</span>
}

function mockMatchMedia(initial: boolean) {
  let listener: (() => void) | null = null
  const query = {
    matches: initial,
    addEventListener: vi.fn((_: string, l: () => void) => (listener = l)),
    removeEventListener: vi.fn(),
  }
  window.matchMedia = vi.fn(() => query) as unknown as typeof window.matchMedia
  return {
    change(matches: boolean) {
      query.matches = matches
      act(() => listener?.())
    },
  }
}

afterEach(() => {
  // jsdom does not implement matchMedia; remove the mock for other tests
  delete (window as Partial<Window>).matchMedia
})

describe('usePrefersReducedMotion', () => {
  it('is false where matchMedia is unavailable', () => {
    const { container } = render(<Probe />)
    expect(container.textContent).toBe('full')
  })

  it('reads the preference and follows later changes', () => {
    const media = mockMatchMedia(true)
    const { container } = render(<Probe />)
    expect(container.textContent).toBe('reduced')
    media.change(false)
    expect(container.textContent).toBe('full')
  })
})
