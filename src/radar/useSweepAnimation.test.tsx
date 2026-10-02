import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { useRef } from 'react'
import { useSweepAnimation } from './useSweepAnimation'
import { SWEEP_PERIOD_MS } from './sweep'

const KEYFRAMES: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }]

function Probe({ phase, enabled = true }: { phase: number; enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useSweepAnimation(ref, KEYFRAMES, phase, enabled)
  return <div ref={ref} />
}

function mockAnimate() {
  const animation = { startTime: null as number | null, cancel: vi.fn() }
  const animate = vi.fn(() => animation as unknown as Animation)
  Element.prototype.animate = animate
  return { animate, animation }
}

afterEach(() => {
  // jsdom does not implement the Web Animations API; remove the mock for other tests
  delete (Element.prototype as Partial<Element>).animate
})

describe('useSweepAnimation', () => {
  it('anchors the animation to the timeline origin, shifted by its phase', () => {
    const { animate, animation } = mockAnimate()
    render(<Probe phase={0.25} />)

    expect(animate).toHaveBeenCalledWith(KEYFRAMES, {
      duration: SWEEP_PERIOD_MS,
      iterations: Infinity,
    })
    expect(animation.startTime).toBe(0.25 * SWEEP_PERIOD_MS)
  })

  it('cancels the animation on unmount', () => {
    const { animation } = mockAnimate()
    const { unmount } = render(<Probe phase={0} />)
    unmount()
    expect(animation.cancel).toHaveBeenCalled()
  })

  it('does not animate when disabled', () => {
    const { animate } = mockAnimate()
    render(<Probe phase={0} enabled={false} />)
    expect(animate).not.toHaveBeenCalled()
  })
})
