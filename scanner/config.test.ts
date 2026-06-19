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

  it('defines a model pair for each provider', () => {
    expect(SCANNER_CONFIG.models.anthropic.categorize).toBeTruthy()
    expect(SCANNER_CONFIG.models.forge.describe).toBe('claude-opus-4-6')
  })
})
