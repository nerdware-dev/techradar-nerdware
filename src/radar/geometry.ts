export function ringRadii(
  ringCount: number,
  maxRadius: number,
): { inner: number; outer: number }[] {
  const bands: { inner: number; outer: number }[] = []
  for (let i = 0; i < ringCount; i++) {
    bands.push({
      inner: maxRadius * Math.sqrt(i / ringCount),
      outer: maxRadius * Math.sqrt((i + 1) / ringCount),
    })
  }
  return bands
}

export function polarToCartesian(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) }
}

export function quadrantAngles(order: number): { start: number; end: number } {
  return { start: order * 90, end: order * 90 + 90 }
}

export function annularSectorPath(
  startDeg: number,
  endDeg: number,
  inner: number,
  outer: number,
): string {
  const p1 = polarToCartesian(startDeg, inner)
  const p2 = polarToCartesian(startDeg, outer)
  const p3 = polarToCartesian(endDeg, outer)
  const p4 = polarToCartesian(endDeg, inner)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return [
    `M ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
    `L ${p4.x} ${p4.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${p1.x} ${p1.y}`,
    'Z',
  ].join(' ')
}
