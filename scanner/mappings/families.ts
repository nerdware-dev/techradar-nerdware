import type { QuadrantId } from '../../src/data/types'
import type { TerminalVerdict } from '../types'

export interface Family {
  /** Must be lowercase — matched against the lowercased raw token. Examples: npm scope ("@radix-ui/") or Go module path ("github.com/aws/aws-sdk-go-v2/"). */
  prefix: string
  canonical: string
  verdict: TerminalVerdict
  quadrant?: QuadrantId
}

const LF: QuadrantId = 'languages-frameworks'
const TOOLS: QuadrantId = 'tools'
const PLAT: QuadrantId = 'platforms'

/** Sub-packages collapse to one canonical blip by prefix. Order matters only for
 *  overlapping prefixes (longest/most-specific should precede the more general). */
export const FAMILIES: Family[] = [
  // npm scope families
  { prefix: '@radix-ui/', canonical: 'Radix UI', verdict: 'radar', quadrant: LF },
  { prefix: '@nx/', canonical: 'Nx', verdict: 'radar', quadrant: TOOLS },
  { prefix: '@nrwl/', canonical: 'Nx', verdict: 'radar', quadrant: TOOLS },
  { prefix: '@tanstack/', canonical: 'TanStack', verdict: 'radar', quadrant: LF },
  { prefix: '@tiptap/', canonical: 'Tiptap', verdict: 'radar', quadrant: LF },
  { prefix: '@mikro-orm/', canonical: 'MikroORM', verdict: 'radar', quadrant: TOOLS },
  { prefix: '@sentry/', canonical: 'Sentry', verdict: 'radar', quadrant: TOOLS },
  { prefix: '@trpc/', canonical: 'tRPC', verdict: 'radar', quadrant: LF },
  { prefix: '@mui/', canonical: 'MUI', verdict: 'radar', quadrant: LF },
  { prefix: '@emotion/', canonical: 'Emotion', verdict: 'radar', quadrant: LF },
  { prefix: '@storybook/', canonical: 'Storybook', verdict: 'radar', quadrant: TOOLS },
  { prefix: '@langchain/', canonical: 'LangChain', verdict: 'radar', quadrant: LF },
  { prefix: '@angular/', canonical: 'Angular', verdict: 'radar', quadrant: LF },
  { prefix: '@nestjs/', canonical: 'NestJS', verdict: 'radar', quadrant: LF },
  { prefix: '@aws-sdk/', canonical: 'AWS', verdict: 'radar', quadrant: PLAT },
  { prefix: '@reduxjs/', canonical: 'Redux Toolkit', verdict: 'radar', quadrant: LF },
  // Go module-path families (most-specific first)
  { prefix: 'github.com/aws/aws-sdk-go-v2/', canonical: 'AWS', verdict: 'radar', quadrant: PLAT },
  { prefix: 'github.com/jackc/pgx', canonical: 'pgx', verdict: 'radar', quadrant: TOOLS },
  { prefix: 'github.com/gin-gonic/gin', canonical: 'Gin', verdict: 'radar', quadrant: LF },
  { prefix: 'github.com/prometheus/', canonical: 'Prometheus', verdict: 'radar', quadrant: PLAT },
  { prefix: 'gorm.io/', canonical: 'GORM', verdict: 'radar', quadrant: TOOLS },
  { prefix: 'golang.org/x/', canonical: 'golang.org/x', verdict: 'noise' },
]

/** Collapse a raw token to its family, or null if it matches none. */
export function collapseFamily(
  raw: string,
): { canonical: string; verdict: TerminalVerdict; quadrant?: QuadrantId } | null {
  const lower = raw.toLowerCase()
  const hit = FAMILIES.find((f) => lower.startsWith(f.prefix))
  if (!hit) return null
  return { canonical: hit.canonical, verdict: hit.verdict, quadrant: hit.quadrant }
}
