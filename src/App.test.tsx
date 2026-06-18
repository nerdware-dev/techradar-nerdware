import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import App from './App'

const data = [
  { name: 'Docker', ring: 'High', quadrant: 'platforms', isNew: 'FALSE', description: 'd' },
  { name: 'AWS', ring: 'Low', quadrant: 'platforms', isNew: 'FALSE', description: 'a' },
]

afterEach(() => vi.restoreAllMocks())

describe('App', () => {
  it('loads data and renders the radar, then focuses a quadrant on blip click', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) }),
    )
    render(<App />)
    await waitFor(() => expect(screen.getByLabelText('Docker')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Docker'))
    // selecting a blip focuses its quadrant → table appears
    await waitFor(() => expect(screen.getByText('Platforms')).toBeInTheDocument())
  })

  it('shows an error state when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    render(<App />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
