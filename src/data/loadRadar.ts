import type { Radar } from './types'
import { parseRadar } from './schema'
import { RADAR_DATA_URL } from '../config'

export async function loadRadar(url: string = RADAR_DATA_URL): Promise<Radar> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to load radar data from ${url}: HTTP ${res.status}`)
  }
  const json: unknown = await res.json()
  return parseRadar(json)
}
