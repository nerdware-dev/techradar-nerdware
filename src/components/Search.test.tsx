import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Search } from './Search'
import { RadarStoreProvider } from '../state/radarStore'
import { parseRadar } from '../data/schema'

const radar = parseRadar([
  { name: 'Apache Kafka', ring: 'High', quadrant: 'platforms', isNew: 'FALSE', description: 'k' },
  { name: 'Docker', ring: 'High', quadrant: 'platforms', isNew: 'FALSE', description: 'd' },
])

function renderSearch() {
  return render(
    <RadarStoreProvider>
      <Search radar={radar} />
    </RadarStoreProvider>,
  )
}

describe('Search', () => {
  it('filters suggestions by case-insensitive substring', () => {
    renderSearch()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'kaf' } })
    expect(screen.getByText('Apache Kafka')).toBeInTheDocument()
    expect(screen.queryByText('Docker')).toBeNull()
  })

  it('shows no suggestions for an empty query', () => {
    renderSearch()
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('selecting a suggestion clears the input', () => {
    renderSearch()
    const input = screen.getByRole('searchbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'doc' } })
    fireEvent.click(screen.getByText('Docker'))
    expect(input.value).toBe('')
  })
})
