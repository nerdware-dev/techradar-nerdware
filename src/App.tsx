import { useEffect, useMemo, useState } from 'react'
import './styles/tokens.scss'
import styles from './styles/app.module.scss'
import type { Radar } from './data/types'
import { loadRadar } from './data/loadRadar'
import { RadarStoreProvider } from './state/radarStore'
import { Header } from './components/Header'
import { Search } from './components/Search'
import { RadarView } from './components/Radar'
import { QuadrantNav } from './components/QuadrantNav'
import { QuadrantTable } from './components/QuadrantTable'
import { Tooltip } from './components/Tooltip'
import { Legend } from './components/Legend'
import { placeBlips } from './radar/placement'
import { RADAR_SIZE } from './config'

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; radar: Radar }

export default function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    loadRadar()
      .then((radar) => alive && setLoad({ status: 'ready', radar }))
      .catch((e: unknown) => alive && setLoad({ status: 'error', message: String(e) }))
    return () => {
      alive = false
    }
  }, [])

  const radar = load.status === 'ready' ? load.radar : null
  const placed = useMemo(
    () => (radar ? placeBlips(radar.blips, radar.rings, radar.quadrants, RADAR_SIZE) : []),
    [radar],
  )

  return (
    <RadarStoreProvider>
      <Header />
      {load.status === 'loading' && <p className={styles.status}>Lade Tech Radar…</p>}
      {load.status === 'error' && (
        <p className={styles.status} role="alert">
          Fehler beim Laden: {load.message}
        </p>
      )}
      {load.status === 'ready' && (
        <main className={styles.layout}>
          <div className={styles.radarWrap}>
            <RadarView radar={load.radar} placed={placed} />
          </div>
          <aside className={styles.sidebar}>
            <Search radar={load.radar} />
            <QuadrantNav radar={load.radar} />
            <Legend radar={load.radar} />
            <QuadrantTable radar={load.radar} placed={placed} />
            <Tooltip radar={load.radar} />
          </aside>
        </main>
      )}
    </RadarStoreProvider>
  )
}
