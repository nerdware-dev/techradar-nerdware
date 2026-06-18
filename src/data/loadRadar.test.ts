import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadRadar } from './loadRadar'

const sample = [{ name: 'Docker', ring: 'High', quadrant: 'platforms', isNew: 'FALSE', description: 'x' }]

afterEach(() => vi.restoreAllMocks())

describe('loadRadar', () => {
  it('fetches and parses the radar from a url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(sample) }),
    )
    const radar = await loadRadar('https://example.test/radar.json')
    expect(radar.blips[0].id).toBe('docker')
  })

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(loadRadar('https://example.test/missing.json')).rejects.toThrow(/404/)
  })
})
