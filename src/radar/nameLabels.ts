import { BLIP_RADIUS } from '../config'
import { overlaps, type Box } from './geometry'

/** Font size of the name labels next to the dots, in SVG user units. */
export const NAME_LABEL_FONT_SIZE = 11

/**
 * Advance width per character class, in em, fitted to Inter 500 against all radar names
 * measured in the browser: mean error 1.4 units at 11px, at most 2 units too narrow
 * (absorbed by LABEL_GAP) and 5.4 too wide.
 */
const CHAR_WIDTH_EM = { space: 0.28, narrow: 0.32, lower: 0.6, upper: 0.68, wide: 0.86 }

function charWidthEm(char: string): number {
  if (char === ' ') return CHAR_WIDTH_EM.space
  if (/[ijlrtfI.\-/]/.test(char)) return CHAR_WIDTH_EM.narrow
  if (/[mwMW]/.test(char)) return CHAR_WIDTH_EM.wide
  if (/[A-Z0-9#+&@%]/.test(char)) return CHAR_WIDTH_EM.upper
  return CHAR_WIDTH_EM.lower
}

export function estimateTextWidth(text: string, fontSize: number): number {
  return [...text].reduce((sum, char) => sum + charWidthEm(char), 0) * fontSize
}

/**
 * Gap between a label and its own dot. Other dots keep a full gap sideways and half of it
 * above and below; other labels keep half of it sideways, while stacked labels rely on
 * their line box, which is taller than the glyphs, to stay apart.
 */
const LABEL_GAP = 4
const HALF_HEIGHT = 0.6 * NAME_LABEL_FONT_SIZE

export interface NameLabel {
  blipId: string
  text: string
  /** Anchor point of the text; vertically it is the text's centre line. */
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  /** Which side of its dot the label sits on. */
  side: 'right' | 'left' | 'above' | 'below'
  /** Area the text covers, e.g. as a hit target that stays put while the text shifts. */
  box: Box
}

export interface LabelTarget {
  id: string
  name: string
  x: number
  y: number
}

function candidates(target: LabelTarget, width: number): { label: NameLabel; box: Box }[] {
  const { id, name, x, y } = target
  const offset = BLIP_RADIUS + LABEL_GAP
  const halfWidth = width / 2
  const make = (
    lx: number,
    ly: number,
    anchor: NameLabel['anchor'],
    side: NameLabel['side'],
    boxX: number,
  ) => {
    const box = { x: boxX, y: ly, halfWidth, halfHeight: HALF_HEIGHT }
    return { label: { blipId: id, text: name, x: lx, y: ly, anchor, side, box }, box }
  }
  const above = y - offset - HALF_HEIGHT
  const below = y + offset + HALF_HEIGHT
  return [
    make(x + offset, y, 'start', 'right', x + offset + halfWidth),
    make(x - offset, y, 'end', 'left', x - offset - halfWidth),
    make(x, above, 'middle', 'above', x),
    make(x, below, 'middle', 'below', x),
  ]
}

/**
 * Places a name label next to as many dots as fit. Targets are handled in the given order
 * (earlier ones win contested space) and try right, left, above and below their dot; the
 * first spot that stays inside the visible square and clear of every dot, every obstacle
 * and every label placed so far is taken. Targets without such a spot get no label.
 * All coordinates are drawing coordinates, in which dots and labels have their final size.
 */
export function layoutNameLabels(
  targets: LabelTarget[],
  dots: { x: number; y: number }[],
  obstacles: Box[],
  visibleHalfSize: number,
): NameLabel[] {
  const dotReach = BLIP_RADIUS + LABEL_GAP / 2
  const dotBoxes: Box[] = dots.map((d) => ({ ...d, halfWidth: dotReach, halfHeight: dotReach }))
  const taken: Box[] = [...obstacles]
  const placed: NameLabel[] = []

  for (const target of targets) {
    const width = estimateTextWidth(target.name, NAME_LABEL_FONT_SIZE)
    const fit = candidates(target, width).find(({ box }) => {
      const inside =
        Math.abs(box.x) + box.halfWidth <= visibleHalfSize &&
        Math.abs(box.y) + box.halfHeight <= visibleHalfSize
      if (!inside) return false
      const padded = { ...box, halfWidth: box.halfWidth + LABEL_GAP / 2 }
      const ownDot = (d: Box) => d.x === target.x && d.y === target.y
      if (dotBoxes.some((d) => !ownDot(d) && overlaps(padded, d))) return false
      return !taken.some((t) => overlaps(padded, t))
    })
    if (!fit) continue
    taken.push(fit.box)
    placed.push(fit.label)
  }
  return placed
}
