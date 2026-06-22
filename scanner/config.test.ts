import { describe, it, expect } from 'vitest'
import { SCANNER_CONFIG } from './config'

describe('SCANNER_CONFIG', () => {
  it('targets the nerdware-dev org', () => {
    expect(SCANNER_CONFIG.org).toBe('nerdware-dev')
  })

  it('has a high threshold strictly greater than the dev threshold', () => {
    expect(SCANNER_CONFIG.ringThresholds.high).toBeGreaterThan(SCANNER_CONFIG.ringThresholds.dev)
  })

  it('points the radar path at data/tech-radar.json', () => {
    expect(SCANNER_CONFIG.paths.radar).toMatch(/data\/tech-radar\.json$/)
  })

  it('uses Forge model aliases (opus-4-6 for describe, haiku for triage)', () => {
    expect(SCANNER_CONFIG.models.describe).toBe('claude-opus-4-6')
    expect(SCANNER_CONFIG.models.triage).toBe('claude-haiku-4-5')
  })
})
