import { describe, it, expect } from 'vitest'
import { renderReport } from './report'

const changes = {
  added: ['Grafana'],
  ringMoves: [{ name: 'React', from: 'low' as const, to: 'high' as const }],
  undetected: ['AWS'],
  needsReview: ['Grafana'],
  reactivated: ['PHP'],
}

describe('renderReport', () => {
  const md = renderReport(changes, 30, 905)
  it('summarizes counts in a headline', () => {
    expect(md).toMatch(/30 repos/)
    expect(md).toMatch(/\+1 added/)
    expect(md).toMatch(/905 suppressed/)
  })
  it('lists ring moves with old and new ring', () => {
    expect(md).toMatch(/React.*low.*high/)
  })
  it('lists undetected entries under their own heading', () => {
    expect(md).toMatch(/Undetected/i)
    expect(md).toMatch(/AWS/)
  })
  it('flags needs-review items', () => {
    expect(md).toMatch(/needs.review/i)
  })
  it('lists reactivated (currently-Out) entries', () => {
    expect(md).toMatch(/Detected again/i)
    expect(md).toMatch(/PHP/)
  })
})
