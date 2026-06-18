/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import type { QuadrantId } from '../data/types'

export interface RadarState {
  focusedQuadrant: QuadrantId | null
  hoveredBlipId: string | null
  selectedBlipId: string | null
  search: string
}

export type RadarAction =
  | { type: 'FOCUS_QUADRANT'; id: QuadrantId }
  | { type: 'CLEAR_FOCUS' }
  | { type: 'HOVER_BLIP'; id: string | null }
  | { type: 'SELECT_BLIP'; id: string | null; quadrant?: QuadrantId }
  | { type: 'SET_SEARCH'; value: string }

export const initialState: RadarState = {
  focusedQuadrant: null,
  hoveredBlipId: null,
  selectedBlipId: null,
  search: '',
}

export function radarReducer(state: RadarState, action: RadarAction): RadarState {
  switch (action.type) {
    case 'FOCUS_QUADRANT':
      return { ...state, focusedQuadrant: action.id }
    case 'CLEAR_FOCUS':
      return { ...state, focusedQuadrant: null, selectedBlipId: null }
    case 'HOVER_BLIP':
      return { ...state, hoveredBlipId: action.id }
    case 'SELECT_BLIP':
      return {
        ...state,
        selectedBlipId: action.id,
        focusedQuadrant: action.quadrant ?? state.focusedQuadrant,
      }
    case 'SET_SEARCH':
      return { ...state, search: action.value }
    default:
      return state
  }
}

const StateContext = createContext<RadarState | null>(null)
const DispatchContext = createContext<Dispatch<RadarAction> | null>(null)

export function RadarStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(radarReducer, initialState)
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  )
}

export function useRadarState(): RadarState {
  const ctx = useContext(StateContext)
  if (!ctx) throw new Error('useRadarState must be used within RadarStoreProvider')
  return ctx
}

export function useRadarDispatch(): Dispatch<RadarAction> {
  const ctx = useContext(DispatchContext)
  if (!ctx) throw new Error('useRadarDispatch must be used within RadarStoreProvider')
  return ctx
}
