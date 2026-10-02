import { useEffect, type ReactNode } from 'react'
import type { QuadrantId } from '../data/types'
import { useRadarDispatch } from '../state/radarStore'

/** Test helpers that put the surrounding RadarStoreProvider into a given state on mount. */

export function FocusOn({ id, children }: { id: QuadrantId; children: ReactNode }) {
  const dispatch = useRadarDispatch()
  useEffect(() => {
    dispatch({ type: 'FOCUS_QUADRANT', id })
  }, [dispatch, id])
  return <>{children}</>
}

export function Selected({ id, children }: { id: string; children: ReactNode }) {
  const dispatch = useRadarDispatch()
  useEffect(() => {
    dispatch({ type: 'SELECT_BLIP', id })
  }, [dispatch, id])
  return <>{children}</>
}

export function Hovered({ id, children }: { id: string; children: ReactNode }) {
  const dispatch = useRadarDispatch()
  useEffect(() => {
    dispatch({ type: 'HOVER_BLIP', id })
  }, [dispatch, id])
  return <>{children}</>
}
