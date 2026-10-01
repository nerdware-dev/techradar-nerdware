export type RingId = 'low' | 'dev' | 'high' | 'out'
export type QuadrantId = 'techniques' | 'platforms' | 'tools' | 'languages-frameworks'

export interface Ring {
  id: RingId
  name: string
  /** 0 = innermost ring */
  order: number
}

export interface Quadrant {
  id: QuadrantId
  name: string
  /** 0..3, maps to a 90° sector */
  order: number
}

export interface Blip {
  id: string
  name: string
  ring: RingId
  quadrant: QuadrantId
  /** Derived: added to the radar within the last NEW_WINDOW_DAYS (see config.ts). */
  isNew: boolean
  /** sanitized HTML */
  description: string
}

export interface Radar {
  rings: Ring[]
  quadrants: Quadrant[]
  blips: Blip[]
}
