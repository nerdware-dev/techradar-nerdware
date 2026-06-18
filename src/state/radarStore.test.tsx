import { describe, it, expect } from 'vitest'
import { radarReducer, initialState } from './radarStore'

describe('radarReducer', () => {
  it('focuses and clears a quadrant', () => {
    const focused = radarReducer(initialState, { type: 'FOCUS_QUADRANT', id: 'tools' })
    expect(focused.focusedQuadrant).toBe('tools')
    expect(radarReducer(focused, { type: 'CLEAR_FOCUS' }).focusedQuadrant).toBeNull()
  })

  it('selecting a blip also focuses its quadrant when provided', () => {
    const s = radarReducer(initialState, {
      type: 'SELECT_BLIP',
      id: 'docker',
      quadrant: 'platforms',
    })
    expect(s.selectedBlipId).toBe('docker')
    expect(s.focusedQuadrant).toBe('platforms')
  })

  it('sets hover and search independently', () => {
    expect(radarReducer(initialState, { type: 'HOVER_BLIP', id: 'aws' }).hoveredBlipId).toBe('aws')
    expect(radarReducer(initialState, { type: 'SET_SEARCH', value: 'kaf' }).search).toBe('kaf')
  })
})
