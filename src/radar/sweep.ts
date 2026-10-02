/** Duration of one full revolution of the radar sweep, in ms. */
export const SWEEP_PERIOD_MS = 11_000

/** Beam angle at the start of every revolution: straight up (SVG y grows downward). */
export const SWEEP_START_DEG = -90

/** Angular length of the fading afterglow trailing behind the beam, in degrees. */
export const SWEEP_TRAIL_DEG = 46

/**
 * Number of stacked slices that draw the afterglow. SVG has no conic gradient,
 * so the fade is built from slices that all start at the beam and reach
 * progressively further back; where more of them overlap, the glow is brighter.
 */
export const AFTERGLOW_SLICES = 24

/** One clockwise revolution of the sweep group around the radar centre. */
export const SWEEP_ROTATION: Keyframe[] = [
  { transform: 'rotate(0deg)' },
  { transform: 'rotate(360deg)' },
]

/**
 * A blip's flash when the beam passes it. Offset 0 is the moment of the pass;
 * the flash has faded by the time the afterglow's tail has passed too.
 */
export const PING_KEYFRAMES: Keyframe[] = [
  { offset: 0, opacity: 0.85, transform: 'scale(1)', easing: 'ease-out' },
  { offset: SWEEP_TRAIL_DEG / 360, opacity: 0, transform: 'scale(2.6)' },
  { offset: 1, opacity: 0, transform: 'scale(2.6)' },
]

/**
 * Fraction of a revolution (0 inclusive, 1 exclusive) at which the beam passes
 * the point (x, y). The beam turns clockwise on screen, i.e. towards increasing
 * SVG angles, starting at SWEEP_START_DEG.
 */
export function sweepPhase(x: number, y: number): number {
  const angle = (Math.atan2(y, x) * 180) / Math.PI
  return ((((angle - SWEEP_START_DEG) % 360) + 360) % 360) / 360
}
