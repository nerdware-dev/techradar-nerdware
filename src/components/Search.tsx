import type { Radar } from '../data/types'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import styles from '../styles/search.module.scss'

const MAX_SUGGESTIONS = 8

export function Search({ radar }: { radar: Radar }) {
  const { search } = useRadarState()
  const dispatch = useRadarDispatch()
  const q = search.trim().toLowerCase()
  const matches = q
    ? radar.blips.filter((b) => b.name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS)
    : []

  return (
    <div className={styles.wrap}>
      <input
        className={styles.input}
        type="search"
        role="searchbox"
        placeholder="Suche…"
        value={search}
        onChange={(e) => dispatch({ type: 'SET_SEARCH', value: e.target.value })}
      />
      {matches.length > 0 && (
        <ul role="listbox" aria-label="Suchergebnisse" className={styles.list}>
          {matches.map((b) => (
            <li
              key={b.id}
              role="option"
              aria-selected={false}
              className={styles.option}
              onClick={() => {
                dispatch({ type: 'SELECT_BLIP', id: b.id, quadrant: b.quadrant })
                dispatch({ type: 'SET_SEARCH', value: '' })
              }}
            >
              {b.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
