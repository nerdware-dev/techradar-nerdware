import type { Ring, Quadrant } from './data/types'

export const RINGS: Ring[] = [
  { id: 'high', name: 'High', order: 0 },
  { id: 'dev', name: 'Developing', order: 1 },
  { id: 'low', name: 'Low', order: 2 },
  { id: 'out', name: 'Out', order: 3 },
]

export const QUADRANTS: Quadrant[] = [
  { id: 'techniques', name: 'Techniques', order: 0 },
  { id: 'platforms', name: 'Platforms', order: 1 },
  { id: 'tools', name: 'Tools', order: 2 },
  { id: 'languages-frameworks', name: 'Languages & Frameworks', order: 3 },
]

export const RADAR_DATA_URL: string =
  // `import.meta.env` is injected by Vite in the app build but is undefined under
  // plain Node (the scanner runs via tsx and imports this module for RINGS/QUADRANTS).
  import.meta.env?.VITE_RADAR_DATA_URL ??
  'https://raw.githubusercontent.com/nerdware-dev/techradar-nerdware/master/data/tech-radar.json'

/** Radius of the outermost ring, in SVG user units. */
export const RADAR_SIZE = 400

/** Rendered radius of a blip dot, in SVG user units (see Blip.tsx). */
export const BLIP_RADIUS = 9

/**
 * Minimum center-to-center distance enforced between two blips placed in the
 * same ring+quadrant segment. Sized to the plain dot diameter (2 * BLIP_RADIUS)
 * plus a small gap, not to the larger "isNew" halo (BLIP_RADIUS + 4): at 2x the
 * halo radius, packing 37 blips into the densest real segment (dev/languages-
 * frameworks) is no longer geometrically feasible, so occasional halo overlap
 * on "new" blips is accepted as the cheaper trade-off.
 */
export const MIN_BLIP_DISTANCE = 2 * BLIP_RADIUS + 4
