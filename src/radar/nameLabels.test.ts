import { describe, it, expect } from 'vitest'
import { estimateTextWidth, layoutNameLabels, NAME_LABEL_FONT_SIZE } from './nameLabels'

describe('estimateTextWidth', () => {
  it('grows with the text and treats wide letters as wider than narrow ones', () => {
    expect(estimateTextWidth('React Router', 11)).toBeGreaterThan(estimateTextWidth('React', 11))
    expect(estimateTextWidth('mmm', 11)).toBeGreaterThan(estimateTextWidth('iii', 11))
  })
})

describe('layoutNameLabels', () => {
  const dot = (id: string, x: number, y: number) => ({ id, name: id, x, y })

  it('puts a label to the right of a lone dot', () => {
    const target = dot('React', 0, 0)
    const [label] = layoutNameLabels([target], [target], [], 400)
    expect(label).toMatchObject({ blipId: 'React', anchor: 'start', side: 'right', y: 0 })
    expect(label.x).toBeGreaterThan(0)
  })

  it('falls back to the left when the right side is out of view', () => {
    const target = dot('React', 390, 0)
    const [label] = layoutNameLabels([target], [target], [], 400)
    expect(label.anchor).toBe('end')
    expect(label.x).toBeLessThan(390)
  })

  it('does not place a label over a neighbouring dot', () => {
    const target = dot('React', 0, 0)
    const right = { x: 30, y: 0 }
    const [label] = layoutNameLabels([target], [target, right], [], 400)
    expect(label.anchor).toBe('end')
  })

  it('uses the spot above, then below, when both sides are blocked', () => {
    const target = dot('React', 0, 0)
    const sides = [
      { x: 30, y: 0 },
      { x: -30, y: 0 },
    ]
    const [above] = layoutNameLabels([target], [target, ...sides], [], 400)
    expect(above.side).toBe('above')
    expect(above.y).toBeLessThan(0)
    const [below] = layoutNameLabels([target], [target, ...sides, { x: 0, y: -25 }], [], 400)
    expect(below.side).toBe('below')
    expect(below.y).toBeGreaterThan(0)
  })

  it('gives earlier targets the preferred spot when they compete for it', () => {
    const first = dot('Alpha', 0, 0)
    const second = dot('Beta', 0, 0)
    const labels = layoutNameLabels([first, second], [first, second], [], 400)
    expect(labels.map((l) => [l.blipId, l.anchor])).toEqual([
      ['Alpha', 'start'],
      ['Beta', 'end'],
    ])
  })

  it('skips a target when no spot fits inside the visible area', () => {
    const target = dot('React', 0, 0)
    expect(layoutNameLabels([target], [target], [], NAME_LABEL_FONT_SIZE)).toEqual([])
  })

  it('keeps clear of obstacles such as ring labels', () => {
    const target = dot('React', 0, 0)
    const ringLabel = { x: 40, y: 0, halfWidth: 20, halfHeight: 6 }
    const [label] = layoutNameLabels([target], [target], [ringLabel], 400)
    expect(label.anchor).not.toBe('start')
  })
})
