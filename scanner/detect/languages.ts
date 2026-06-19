import { SCANNER_CONFIG } from '../config'
import type { DetectedToken } from '../types'

/** Turn GitHub language byte counts into language tokens, dropping trivial noise. */
export function detectLanguages(bytesByLang: Record<string, number>): DetectedToken[] {
  const total = Object.values(bytesByLang).reduce((a, b) => a + b, 0)
  if (total === 0) return []
  return Object.entries(bytesByLang)
    .filter(([, bytes]) => bytes / total >= SCANNER_CONFIG.languageNoiseRatio)
    .map(([raw]) => ({ raw, kind: 'language', quadrantHint: 'languages-frameworks' }))
}
