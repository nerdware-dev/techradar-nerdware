import { useEffect, useState, type RefObject } from 'react'
import { SWEEP_PERIOD_MS } from './sweep'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function matchesReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(matchesReducedMotion)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * Plays `keyframes` once per sweep revolution on the element in `ref`, shifted
 * by `phase` (0…1) of a revolution. Every sweep-bound animation is anchored to
 * the document timeline's origin rather than to its own mount time, so the beam
 * and all blip pings stay in lockstep even when a blip mounts later than the
 * sweep (a remount would otherwise restart its animation out of sync).
 * Does nothing when the user prefers reduced motion.
 */
export function useSweepAnimation(
  ref: RefObject<Element | null>,
  keyframes: Keyframe[],
  phase: number,
): void {
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const element = ref.current
    if (reducedMotion) return
    if (!element || typeof element.animate !== 'function') return

    const animation = element.animate(keyframes, {
      duration: SWEEP_PERIOD_MS,
      iterations: Infinity,
    })
    animation.startTime = phase * SWEEP_PERIOD_MS
    return () => animation.cancel()
  }, [ref, keyframes, phase, reducedMotion])
}
