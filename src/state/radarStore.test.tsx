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

  it('CLEAR_FOCUS also clears the selected blip', () => {
    const selected = radarReducer(initialState, {
      type: 'SELECT_BLIP',
      id: 'k8s',
      quadrant: 'platforms',
    })
    const cleared = radarReducer(selected, { type: 'CLEAR_FOCUS' })
    expect(cleared.focusedQuadrant).toBeNull()
    expect(cleared.selectedBlipId).toBeNull()
  })

  it('switching to another quadrant drops the selection from the previous one', () => {
    const selected = radarReducer(initialState, {
      type: 'SELECT_BLIP',
      id: 'vite',
      quadrant: 'tools',
    })
    const switched = radarReducer(selected, { type: 'FOCUS_QUADRANT', id: 'platforms' })
    expect(switched.focusedQuadrant).toBe('platforms')
    expect(switched.selectedBlipId).toBeNull()
  })

  it('re-focusing the same quadrant keeps the selection and the state object', () => {
    const selected = radarReducer(initialState, {
      type: 'SELECT_BLIP',
      id: 'vite',
      quadrant: 'tools',
    })
    expect(radarReducer(selected, { type: 'FOCUS_QUADRANT', id: 'tools' })).toBe(selected)
  })

  it('CLEAR_FOCUS keeps the state object when there is nothing to clear', () => {
    expect(radarReducer(initialState, { type: 'CLEAR_FOCUS' })).toBe(initialState)
  })
})
