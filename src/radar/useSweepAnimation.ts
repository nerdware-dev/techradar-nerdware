import { useEffect, type RefObject } from 'react'
import { SWEEP_PERIOD_MS } from './sweep'

/**
 * Plays `keyframes` once per sweep revolution on the element in `ref`, shifted
 * by `phase` (0…1) of a revolution. Every sweep-bound animation is anchored to
 * the document timeline's origin rather than to its own mount time, so the beam
 * and all blip pings stay in lockstep even when a blip mounts later than the
 * sweep (a remount would otherwise restart its animation out of sync).
 * `enabled` is false when the user prefers reduced motion; the caller reads that
 * preference once instead of every blip subscribing to it.
 */
export function useSweepAnimation(
  ref: RefObject<Element | null>,
  keyframes: Keyframe[],
  phase: number,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return
    const element = ref.current
    if (!element) return
    // jsdom and very old browsers lack the Web Animations API
    if (typeof element.animate !== 'function') return

    const animation = element.animate(keyframes, {
      duration: SWEEP_PERIOD_MS,
      iterations: Infinity,
    })
    animation.startTime = phase * SWEEP_PERIOD_MS
    return () => animation.cancel()
  }, [ref, keyframes, phase, enabled])
}
