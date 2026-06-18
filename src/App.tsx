import { useEffect, useState } from 'react'
import './styles/tokens.scss'
import styles from './styles/app.module.scss'
import type { Radar } from './data/types'
import { loadRadar } from './data/loadRadar'
import { RadarStoreProvider } from './state/radarStore'
import { Header } from './components/Header'
import { Search } from './components/Search'
import { RadarView } from './components/Radar'
import { QuadrantTable } from './components/QuadrantTable'
import { Tooltip } from './components/Tooltip'
import { Legend } from './components/Legend'

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
          <RadarView radar={load.radar} />
          <div className={styles.sidebar}>
            <Search radar={load.radar} />
            <Legend radar={load.radar} />
            <Tooltip radar={load.radar} />
            <QuadrantTable radar={load.radar} />
          </div>
        </main>
      )}
    </RadarStoreProvider>
  )
}
