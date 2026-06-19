import type { RingId } from '../src/data/types'
import { SCANNER_CONFIG } from './config'

/** Map an adoption count (number of repos using a tech) to a ring.
 *  `out` is never returned in Phase 1 (it needs scan history we don't have). */
export function autoRing(repoCount: number): RingId {
  const { high, dev } = SCANNER_CONFIG.ringThresholds
  if (repoCount >= high) return 'high'
  if (repoCount >= dev) return 'dev'
  return 'low'
}
