# Tech Radar Scanner — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an on-demand scanner that reads `nerdware-dev` GitHub repos, detects the technologies in use, and writes a candidate `data/tech-radar.json` (new blips added, existing rings reconciled, curated content preserved) plus a machine snapshot and a human-readable diff report.

**Architecture:** A self-contained `scanner/` directory of small, single-responsibility modules. Pure logic (detect → normalize → categorize → aggregate → autoRing → merge → report) is fully unit-tested with no I/O. GitHub access and LLM access each sit behind a thin injectable interface (`GitHubClient`, `LLMClient`), mocked in tests; the live org run is the integration check. The radar app (`src/`) is unchanged except one passthrough test.

**Tech Stack:** TypeScript (ESM, Node ≥22), `tsx` to run, `@octokit/rest` for GitHub, `@anthropic-ai/sdk` for the default LLM provider, `vitest` for tests, `zod` (already present) via the existing `parseRadar`.

## Global Constraints

- **Runtime:** Node ≥22, ESM (`"type": "module"`). Run the scanner with `tsx`, never bundled by Vite.
- **Node builtins:** import via `node:` specifiers (`node:fs/promises`, `node:path`, `node:process`) so the app's tsconfig global `types` array need not change beyond adding `"node"`.
- **TypeScript:** `strict` is on; `noUnusedLocals`/`noUnusedParameters` are on — no unused symbols.
- **Reuse, don't reimplement:** `slugify` from `src/data/slug.ts`; `parseRadar` from `src/data/schema.ts`; `RingId`/`QuadrantId`/`Blip` from `src/data/types.ts`; `RINGS`/`QUADRANTS` from `src/config.ts`.
- **Org:** `nerdware-dev`. Scope: non-archived, non-fork repos (including private).
- **Rings:** `high` `dev` `low` `out`. **Quadrants:** `techniques` `platforms` `tools` `languages-frameworks`. The **techniques** quadrant is never produced by detection.
- **autoRing thresholds:** `high` ≥ 5 repos · `dev` 2–4 · `low` 1. `out` is never set by the scanner in Phase 1.
- **LLM provider:** selected by env `LLM_PROVIDER` (`anthropic` default, or `forge`). Model aliases are **per-provider** — categorization is `claude-haiku-4-5` on both; German descriptions are `claude-opus-4-8` on `anthropic` and `claude-opus-4-6` on `forge` (Forge has no opus-4-8). Forge is OpenAI-wire (`openai` SDK) at `FORGE_BASE_URL=https://forge.nerdware.ai/v1`, key `FORGE_API_KEY` (`sk-…`, Bearer auth). Keys live in a gitignored `.env` locally / GitHub secret in CI — never committed.
- **Git:** plain commit messages — **no `Co-Authored-By: Claude` trailer, no "Generated with" footer.**
- **Safety invariant:** the scanner never overwrites human-owned fields (`description` once present, `ringOverride`, `quadrantOverride`, `pinned`, `hidden`) and never removes a `pinned`/existing curated blip. Undetected existing blips are kept as-is, never auto-retired.

---

### Task 1: Scaffolding, config, and shared types

**Files:**
- Modify: `package.json` (deps + `scan` script)
- Modify: `vite.config.ts:14` (test `include`)
- Modify: `tsconfig.json:19,21` (`types` + `include`)
- Create: `scanner/config.ts`
- Create: `scanner/types.ts`
- Test: `scanner/config.test.ts`
- (Already created, just commit) `.env.example`

**Interfaces:**
- Produces: `SCANNER_CONFIG` with shape `{ org: string; ringThresholds: { high: number; dev: number }; languageNoiseRatio: number; defaultProvider: 'anthropic' | 'forge'; models: { anthropic: ModelPair; forge: ModelPair }; forgeBaseUrl: string; paths: { radar: string; detectionsDir: string } }` where `ModelPair = { categorize: string; describe: string }`; types `DetectedToken`, `RepoScan`, `Detection`, `ScannerBlip`.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install @octokit/rest @anthropic-ai/sdk openai && npm install -D tsx
```
Expected: packages added to `package.json`, exit 0.

- [ ] **Step 2: Add the `scan` script**

In `package.json` `"scripts"`, add after `"dev": "vite",`:
```json
    "scan": "tsx scanner/run.ts",
```

- [ ] **Step 3: Make vitest discover scanner tests**

In `vite.config.ts`, change the `include` line:
```ts
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scanner/**/*.{test,spec}.ts'],
```

- [ ] **Step 4: Make tsc typecheck scanner code**

In `tsconfig.json`, change two lines:
```json
    "types": ["vitest/globals", "@testing-library/jest-dom", "node"]
```
```json
  "include": ["src", "e2e", "scanner"],
```

- [ ] **Step 5: Write the config test**

Create `scanner/config.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SCANNER_CONFIG } from './config'

describe('SCANNER_CONFIG', () => {
  it('targets the nerdware-dev org', () => {
    expect(SCANNER_CONFIG.org).toBe('nerdware-dev')
  })

  it('has a high threshold strictly greater than the dev threshold', () => {
    expect(SCANNER_CONFIG.ringThresholds.high).toBeGreaterThan(SCANNER_CONFIG.ringThresholds.dev)
  })

  it('points the radar path at data/tech-radar.json', () => {
    expect(SCANNER_CONFIG.paths.radar).toMatch(/data\/tech-radar\.json$/)
  })

  it('defines a model pair for each provider', () => {
    expect(SCANNER_CONFIG.models.anthropic.categorize).toBeTruthy()
    expect(SCANNER_CONFIG.models.forge.describe).toBe('claude-opus-4-6')
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run scanner/config.test.ts`
Expected: FAIL — `Cannot find module './config'`.

- [ ] **Step 7: Create the config**

Create `scanner/config.ts`:
```ts
export const SCANNER_CONFIG = {
  org: 'nerdware-dev',
  /** Ignore a language whose byte share is below this fraction of the repo. */
  languageNoiseRatio: 0.05,
  ringThresholds: { high: 5, dev: 2 },
  defaultProvider: 'anthropic',
  /** Per-provider model aliases (Forge's registry has no opus-4-8). */
  models: {
    anthropic: { categorize: 'claude-haiku-4-5', describe: 'claude-opus-4-8' },
    forge: { categorize: 'claude-haiku-4-5', describe: 'claude-opus-4-6' },
  },
  forgeBaseUrl: 'https://forge.nerdware.ai/v1',
  paths: { radar: 'data/tech-radar.json', detectionsDir: 'data/detections' },
} as const
```

- [ ] **Step 8: Create the shared types**

Create `scanner/types.ts`:
```ts
import type { RingId, QuadrantId } from '../src/data/types'

export type SignalKind = 'language' | 'dependency' | 'tool'

/** A raw signal found in one repo, before normalization. */
export interface DetectedToken {
  raw: string
  kind: SignalKind
  /** Strong quadrant signal from the detector (e.g. a language → languages-frameworks). */
  quadrantHint?: QuadrantId
}

/** The result of scanning a single repository. */
export interface RepoScan {
  repo: string
  /** ISO date (YYYY-MM-DD) the repo was last pushed to. */
  pushedAt: string
  tokens: DetectedToken[]
}

/** One technology aggregated across all repos. */
export interface Detection {
  /** Canonical blip name, e.g. "React". */
  name: string
  repoCount: number
  sourceRepos: string[]
  /** Most recent pushedAt across sourceRepos (ISO date). */
  lastSeen: string
  quadrantHint?: QuadrantId
}

/** A radar entry as stored on disk, including additive provenance fields. */
export interface ScannerBlip {
  name: string
  ring: RingId
  quadrant: QuadrantId
  isNew: boolean | string
  description?: string
  // machine-owned
  detected?: { repoCount: number; lastSeen: string; sourceRepos: string[] }
  autoRing?: RingId
  needsReview?: boolean
  // human-owned (scanner reads, never writes)
  ringOverride?: RingId
  quadrantOverride?: QuadrantId
  pinned?: boolean
  descriptionLocked?: boolean
  hidden?: boolean
  // allow unknown human fields to survive
  [key: string]: unknown
}
```

- [ ] **Step 9: Run the test to verify it passes + typecheck**

Run: `npx vitest run scanner/config.test.ts && npx tsc -b`
Expected: PASS, and tsc exits 0.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json scanner/config.ts scanner/types.ts scanner/config.test.ts .env.example
git commit -m "feat(scanner): scaffold scanner dir, config, and shared types"
```

---

### Task 2: autoRing — adoption count to ring

**Files:**
- Create: `scanner/autoRing.ts`
- Test: `scanner/autoRing.test.ts`

**Interfaces:**
- Consumes: `SCANNER_CONFIG.ringThresholds`; `RingId` from `src/data/types`.
- Produces: `autoRing(repoCount: number): RingId`.

- [ ] **Step 1: Write the failing test**

Create `scanner/autoRing.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { autoRing } from './autoRing'

describe('autoRing', () => {
  it('returns low for exactly one repo', () => {
    expect(autoRing(1)).toBe('low')
  })
  it('returns dev for two through four repos', () => {
    expect(autoRing(2)).toBe('dev')
    expect(autoRing(4)).toBe('dev')
  })
  it('returns high for five or more repos', () => {
    expect(autoRing(5)).toBe('high')
    expect(autoRing(12)).toBe('high')
  })
  it('treats zero (or negative) as low, never out', () => {
    expect(autoRing(0)).toBe('low')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/autoRing.test.ts`
Expected: FAIL — `Cannot find module './autoRing'`.

- [ ] **Step 3: Implement**

Create `scanner/autoRing.ts`:
```ts
import type { RingId } from '../src/data/types'
import { SCANNER_CONFIG } from './config'

/** Map an adoption count (number of repos using a tech) to a ring.
 *  `out` is never returned in Phase 1 (it needs scan history we don't have). */
export function autoRing(repoCount: number): RingId {
  const { high, dev } = SCANNER_CONFIG.ringThresholds
  if (repoCount >= high) return 'high'
  if (repoCount >= dev) return 'dev'
  return 'low'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scanner/autoRing.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scanner/autoRing.ts scanner/autoRing.test.ts
git commit -m "feat(scanner): autoRing adoption-to-ring mapping"
```

---

### Task 3: Mapping tables and name normalization

**Files:**
- Create: `scanner/mappings/aliases.ts`
- Create: `scanner/mappings/quadrants.ts`
- Create: `scanner/mappings/ignore.ts`
- Create: `scanner/normalize.ts`
- Test: `scanner/normalize.test.ts`

**Interfaces:**
- Consumes: `slugify` from `src/data/slug.ts`; `QuadrantId` from `src/data/types`.
- Produces: `ALIASES: Record<string, string>` (slug → canonical name), `QUADRANT_MAP: Record<string, QuadrantId>` (slug → quadrant), `IGNORE: Set<string>` (slugs to drop), `normalize(raw: string): string | null` (raw token → canonical name, or null if ignored).

- [ ] **Step 1: Write the failing test**

Create `scanner/normalize.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalize } from './normalize'

describe('normalize', () => {
  it('collapses react aliases to React', () => {
    expect(normalize('react')).toBe('React')
    expect(normalize('react-dom')).toBe('React')
  })
  it('maps an AWS SDK package to AWS', () => {
    expect(normalize('boto3')).toBe('AWS')
  })
  it('drops ignored noise tokens', () => {
    expect(normalize('@types/node')).toBeNull()
  })
  it('title-cases an unknown single token as a best-effort canonical name', () => {
    expect(normalize('fastify')).toBe('Fastify')
  })
  it('is case-insensitive on the raw token', () => {
    expect(normalize('REACT')).toBe('React')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/normalize.test.ts`
Expected: FAIL — `Cannot find module './normalize'`.

- [ ] **Step 3: Create the ignore set**

Create `scanner/mappings/ignore.ts`:
```ts
/** Slugs of tokens that are noise, not radar-worthy technologies. */
export const IGNORE = new Set<string>([
  'types-node',
  'eslint-config-prettier',
  'html',
  'css',
  'scss',
  'shell',
  'dockerfile',
  'makefile',
  'roff',
])
```

- [ ] **Step 4: Create the alias table**

Create `scanner/mappings/aliases.ts`:
```ts
/** Maps a slugified raw token to a canonical blip name.
 *  Seeded from common ecosystem packages; extend as detection coverage grows. */
export const ALIASES: Record<string, string> = {
  react: 'React',
  'react-dom': 'React',
  next: 'Next.js',
  nextjs: 'Next.js',
  vue: 'Vue.js',
  express: 'Express',
  fastapi: 'FastAPI',
  django: 'Django',
  flask: 'Flask',
  boto3: 'AWS',
  'aws-sdk': 'AWS',
  spring: 'Spring',
  'spring-boot': 'Spring',
  laravel: 'Laravel',
  symfony: 'Symfony',
  typescript: 'TypeScript',
  go: 'Go',
  golang: 'Go',
  python: 'Python',
  java: 'Java',
  php: 'PHP',
  vite: 'Vite',
  vitest: 'Vitest',
  playwright: 'Playwright',
  prisma: 'Prisma',
  redis: 'Redis',
  postgresql: 'PostgreSQL',
  postgres: 'PostgreSQL',
  docker: 'Docker',
  terraform: 'Terraform',
  kubernetes: 'Kubernetes',
  'github-actions': 'GitHub Actions',
}
```

- [ ] **Step 5: Create the quadrant table**

Create `scanner/mappings/quadrants.ts`:
```ts
import type { QuadrantId } from '../../src/data/types'

/** Maps a slugified canonical name to its quadrant. Unknowns fall back to AI. */
export const QUADRANT_MAP: Record<string, QuadrantId> = {
  react: 'languages-frameworks',
  'next-js': 'languages-frameworks',
  'vue-js': 'languages-frameworks',
  express: 'languages-frameworks',
  fastapi: 'languages-frameworks',
  django: 'languages-frameworks',
  flask: 'languages-frameworks',
  spring: 'languages-frameworks',
  laravel: 'languages-frameworks',
  symfony: 'languages-frameworks',
  typescript: 'languages-frameworks',
  go: 'languages-frameworks',
  python: 'languages-frameworks',
  java: 'languages-frameworks',
  php: 'languages-frameworks',
  vite: 'tools',
  vitest: 'tools',
  playwright: 'tools',
  prisma: 'tools',
  docker: 'platforms',
  terraform: 'platforms',
  kubernetes: 'platforms',
  'github-actions': 'platforms',
  aws: 'platforms',
  redis: 'platforms',
  postgresql: 'platforms',
}
```

- [ ] **Step 6: Implement normalize**

Create `scanner/normalize.ts`:
```ts
import { slugify } from '../src/data/slug'
import { ALIASES } from './mappings/aliases'
import { IGNORE } from './mappings/ignore'

/** Convert a raw detected token to its canonical blip name.
 *  Returns null when the token is ignored noise. */
export function normalize(raw: string): string | null {
  const slug = slugify(raw)
  if (!slug || IGNORE.has(slug)) return null
  if (ALIASES[slug]) return ALIASES[slug]
  // Best-effort: title-case a single-word token; leave multi-word tokens joined.
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run scanner/normalize.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add scanner/mappings scanner/normalize.ts scanner/normalize.test.ts
git commit -m "feat(scanner): mapping tables and name normalization"
```

---

### Task 4: LLMClient interface and categorization

**Files:**
- Create: `scanner/llm/types.ts`
- Create: `scanner/categorize.ts`
- Test: `scanner/categorize.test.ts`

**Interfaces:**
- Consumes: `QUADRANT_MAP`; `slugify`; `Detection` from `scanner/types`.
- Produces: `interface LLMClient { categorize(name: string, context: string): Promise<{ quadrant: QuadrantId; confidence: number }>; describe(name: string, context: string): Promise<string> }`; `categorize(detection: Detection, llm: LLMClient): Promise<{ quadrant: QuadrantId; needsReview: boolean }>`. Constant `CONFIDENCE_THRESHOLD = 0.7`.

- [ ] **Step 1: Define the LLM interface**

Create `scanner/llm/types.ts`:
```ts
import type { QuadrantId } from '../../src/data/types'

export interface LLMClient {
  /** Classify a tech into a quadrant with a 0..1 confidence. */
  categorize(name: string, context: string): Promise<{ quadrant: QuadrantId; confidence: number }>
  /** Draft a German radar description for a new tech. */
  describe(name: string, context: string): Promise<string>
}

/** The model aliases a provider uses for each call type. */
export interface ModelPair {
  categorize: string
  describe: string
}
```

- [ ] **Step 2: Write the failing test**

Create `scanner/categorize.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { categorize } from './categorize'
import type { LLMClient } from './llm/types'
import type { Detection } from './types'

const det = (name: string, quadrantHint?: Detection['quadrantHint']): Detection => ({
  name,
  repoCount: 1,
  sourceRepos: ['r'],
  lastSeen: '2026-06-18',
  quadrantHint,
})

const fakeLLM = (quadrant: any, confidence: number): LLMClient => ({
  categorize: vi.fn().mockResolvedValue({ quadrant, confidence }),
  describe: vi.fn(),
})

describe('categorize', () => {
  it('uses the detector quadrant hint without calling the LLM', async () => {
    const llm = fakeLLM('tools', 0.1)
    const result = await categorize(det('Docker', 'platforms'), llm)
    expect(result).toEqual({ quadrant: 'platforms', needsReview: false })
    expect(llm.categorize).not.toHaveBeenCalled()
  })

  it('uses the static quadrant table without calling the LLM', async () => {
    const llm = fakeLLM('tools', 0.1)
    const result = await categorize(det('React'), llm)
    expect(result.quadrant).toBe('languages-frameworks')
    expect(llm.categorize).not.toHaveBeenCalled()
  })

  it('falls back to the LLM for unknown techs', async () => {
    const llm = fakeLLM('tools', 0.9)
    const result = await categorize(det('Grafana'), llm)
    expect(result).toEqual({ quadrant: 'tools', needsReview: false })
    expect(llm.categorize).toHaveBeenCalledOnce()
  })

  it('flags low-confidence LLM categorizations as needs-review', async () => {
    const llm = fakeLLM('tools', 0.4)
    const result = await categorize(det('Grafana'), llm)
    expect(result.needsReview).toBe(true)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run scanner/categorize.test.ts`
Expected: FAIL — `Cannot find module './categorize'`.

- [ ] **Step 4: Implement**

Create `scanner/categorize.ts`:
```ts
import type { QuadrantId } from '../src/data/types'
import { slugify } from '../src/data/slug'
import { QUADRANT_MAP } from './mappings/quadrants'
import type { Detection } from './types'
import type { LLMClient } from './llm/types'

export const CONFIDENCE_THRESHOLD = 0.7

/** Resolve a detection's quadrant: detector hint → static table → LLM fallback.
 *  Low-confidence LLM results are flagged needsReview (held back from publish). */
export async function categorize(
  detection: Detection,
  llm: LLMClient,
): Promise<{ quadrant: QuadrantId; needsReview: boolean }> {
  if (detection.quadrantHint) {
    return { quadrant: detection.quadrantHint, needsReview: false }
  }
  const mapped = QUADRANT_MAP[slugify(detection.name)]
  if (mapped) {
    return { quadrant: mapped, needsReview: false }
  }
  const context = `Used in ${detection.repoCount} repositories: ${detection.sourceRepos.join(', ')}`
  const { quadrant, confidence } = await llm.categorize(detection.name, context)
  return { quadrant, needsReview: confidence < CONFIDENCE_THRESHOLD }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run scanner/categorize.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add scanner/llm/types.ts scanner/categorize.ts scanner/categorize.test.ts
git commit -m "feat(scanner): LLMClient interface and quadrant categorization"
```

---

### Task 5: Aggregate per-repo signals into per-tech detections

**Files:**
- Create: `scanner/aggregate.ts`
- Test: `scanner/aggregate.test.ts`

**Interfaces:**
- Consumes: `normalize`; `RepoScan`, `Detection` from `scanner/types`.
- Produces: `aggregate(scans: RepoScan[]): Detection[]`.

- [ ] **Step 1: Write the failing test**

Create `scanner/aggregate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { aggregate } from './aggregate'
import type { RepoScan } from './types'

const scans: RepoScan[] = [
  {
    repo: 'graphmind',
    pushedAt: '2026-06-17',
    tokens: [
      { raw: 'react', kind: 'dependency' },
      { raw: 'typescript', kind: 'language', quadrantHint: 'languages-frameworks' },
    ],
  },
  {
    repo: 'vend',
    pushedAt: '2026-06-15',
    tokens: [
      { raw: 'react-dom', kind: 'dependency' },
      { raw: '@types/node', kind: 'dependency' },
    ],
  },
]

describe('aggregate', () => {
  it('collapses aliases and counts distinct repos', () => {
    const react = aggregate(scans).find((d) => d.name === 'React')!
    expect(react.repoCount).toBe(2)
    expect(react.sourceRepos.sort()).toEqual(['graphmind', 'vend'])
  })
  it('records the most recent pushedAt as lastSeen', () => {
    const react = aggregate(scans).find((d) => d.name === 'React')!
    expect(react.lastSeen).toBe('2026-06-17')
  })
  it('drops ignored tokens', () => {
    expect(aggregate(scans).some((d) => d.name.includes('types'))).toBe(false)
  })
  it('preserves a quadrant hint when present', () => {
    const ts = aggregate(scans).find((d) => d.name === 'TypeScript')!
    expect(ts.quadrantHint).toBe('languages-frameworks')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/aggregate.test.ts`
Expected: FAIL — `Cannot find module './aggregate'`.

- [ ] **Step 3: Implement**

Create `scanner/aggregate.ts`:
```ts
import { normalize } from './normalize'
import type { Detection, RepoScan } from './types'

/** Collapse per-repo tokens into per-tech detections (deduped by canonical name). */
export function aggregate(scans: RepoScan[]): Detection[] {
  const byName = new Map<string, Detection>()
  for (const scan of scans) {
    // A repo counts once per tech even if it lists the tech in several tokens.
    const seenInRepo = new Set<string>()
    for (const token of scan.tokens) {
      const name = normalize(token.raw)
      if (!name || seenInRepo.has(name)) continue
      seenInRepo.add(name)
      const existing = byName.get(name)
      if (existing) {
        existing.repoCount += 1
        existing.sourceRepos.push(scan.repo)
        if (scan.pushedAt > existing.lastSeen) existing.lastSeen = scan.pushedAt
        if (!existing.quadrantHint && token.quadrantHint) existing.quadrantHint = token.quadrantHint
      } else {
        byName.set(name, {
          name,
          repoCount: 1,
          sourceRepos: [scan.repo],
          lastSeen: scan.pushedAt,
          quadrantHint: token.quadrantHint,
        })
      }
    }
  }
  return [...byName.values()]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scanner/aggregate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scanner/aggregate.ts scanner/aggregate.test.ts
git commit -m "feat(scanner): aggregate per-repo signals into detections"
```

---

### Task 6: Merge detections with the existing radar (safety-critical)

**Files:**
- Create: `scanner/merge.ts`
- Test: `scanner/merge.test.ts`

**Interfaces:**
- Consumes: `autoRing`; `slugify`; `Detection`, `ScannerBlip` from `scanner/types`; `RingId`/`QuadrantId`.
- Produces: `mergeRadar(existing: ScannerBlip[], detections: Detection[], categorized: Map<string, { quadrant: QuadrantId; needsReview: boolean }>, descriptions: Map<string, string>): { candidate: ScannerBlip[]; changes: ChangeSet }` and exported `interface ChangeSet { added: string[]; ringMoves: { name: string; from: RingId; to: RingId }[]; undetected: string[]; needsReview: string[] }`. `descriptions`/`categorized` are keyed by `slugify(detection.name)`.

- [ ] **Step 1: Write the failing test**

Create `scanner/merge.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mergeRadar } from './merge'
import type { Detection, ScannerBlip } from './types'
import { slugify } from '../src/data/slug'

const existing: ScannerBlip[] = [
  { name: 'AWS', ring: 'high', quadrant: 'platforms', isNew: 'FALSE', description: 'Cloud.' },
  { name: 'React', ring: 'low', quadrant: 'languages-frameworks', isNew: 'FALSE', description: 'UI lib.' },
  { name: 'Scrum', ring: 'high', quadrant: 'techniques', isNew: 'FALSE', description: 'Method.', pinned: true },
]

// React detected widely; a brand-new tech "Grafana"; AWS and Scrum NOT detected.
const detections: Detection[] = [
  { name: 'React', repoCount: 6, sourceRepos: ['a', 'b', 'c', 'd', 'e', 'f'], lastSeen: '2026-06-18' },
  { name: 'Grafana', repoCount: 1, sourceRepos: ['a'], lastSeen: '2026-06-10' },
]
const categorized = new Map([
  [slugify('React'), { quadrant: 'languages-frameworks' as const, needsReview: false }],
  [slugify('Grafana'), { quadrant: 'tools' as const, needsReview: false }],
])
const descriptions = new Map([[slugify('Grafana'), 'Grafana ist ein Dashboard-Tool.']])

describe('mergeRadar', () => {
  const { candidate, changes } = mergeRadar(existing, detections, categorized, descriptions)
  const byName = (n: string) => candidate.find((b) => b.name === n)!

  it('adds a new blip with detection data, autoRing, quadrant and German description', () => {
    const g = byName('Grafana')
    expect(g.isNew).toBe(true)
    expect(g.autoRing).toBe('low')
    expect(g.quadrant).toBe('tools')
    expect(g.description).toBe('Grafana ist ein Dashboard-Tool.')
    expect(g.detected?.repoCount).toBe(1)
    expect(changes.added).toContain('Grafana')
  })

  it('reconciles a detected existing blip ring to autoRing and records the move', () => {
    expect(byName('React').ring).toBe('high') // 6 repos → high, was low
    expect(changes.ringMoves).toContainEqual({ name: 'React', from: 'low', to: 'high' })
  })

  it('never overwrites an existing human description', () => {
    expect(byName('React').description).toBe('UI lib.')
  })

  it('keeps an undetected existing blip unchanged and lists it for review', () => {
    expect(byName('AWS').ring).toBe('high')
    expect(byName('AWS').detected).toBeUndefined()
    expect(changes.undetected).toContain('AWS')
  })

  it('never drops a pinned curated blip and never auto-retires it', () => {
    expect(byName('Scrum')).toBeTruthy()
    expect(byName('Scrum').ring).toBe('high')
  })

  it('honors a ringOverride instead of autoRing', () => {
    const withOverride: ScannerBlip[] = [
      { name: 'React', ring: 'dev', quadrant: 'languages-frameworks', isNew: 'FALSE', description: 'x', ringOverride: 'dev' },
    ]
    const { candidate: c } = mergeRadar(withOverride, detections, categorized, descriptions)
    expect(c.find((b) => b.name === 'React')!.ring).toBe('dev')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/merge.test.ts`
Expected: FAIL — `Cannot find module './merge'`.

- [ ] **Step 3: Implement**

Create `scanner/merge.ts`:
```ts
import type { RingId, QuadrantId } from '../src/data/types'
import { slugify } from '../src/data/slug'
import { autoRing } from './autoRing'
import type { Detection, ScannerBlip } from './types'

export interface ChangeSet {
  added: string[]
  ringMoves: { name: string; from: RingId; to: RingId }[]
  undetected: string[]
  needsReview: string[]
}

/** Combine machine detections with the existing radar, preserving all human-owned
 *  fields. New techs are added; detected existing blips are re-ringed to autoRing
 *  (unless a ringOverride is set); undetected existing blips are left untouched. */
export function mergeRadar(
  existing: ScannerBlip[],
  detections: Detection[],
  categorized: Map<string, { quadrant: QuadrantId; needsReview: boolean }>,
  descriptions: Map<string, string>,
): { candidate: ScannerBlip[]; changes: ChangeSet } {
  const changes: ChangeSet = { added: [], ringMoves: [], undetected: [], needsReview: [] }
  const detectionBySlug = new Map(detections.map((d) => [slugify(d.name), d]))
  const candidate: ScannerBlip[] = []

  // 1. Update / preserve existing blips.
  for (const blip of existing) {
    const slug = slugify(blip.name)
    const detection = detectionBySlug.get(slug)
    const next: ScannerBlip = { ...blip }
    if (detection) {
      const ar = autoRing(detection.repoCount)
      next.autoRing = ar
      next.detected = {
        repoCount: detection.repoCount,
        lastSeen: detection.lastSeen,
        sourceRepos: detection.sourceRepos,
      }
      const effectiveRing = next.ringOverride ?? ar
      if (effectiveRing !== blip.ring) {
        changes.ringMoves.push({ name: blip.name, from: blip.ring as RingId, to: effectiveRing })
      }
      next.ring = effectiveRing
    } else {
      changes.undetected.push(blip.name)
    }
    candidate.push(next)
  }

  // 2. Add newly-detected techs not already present.
  const existingSlugs = new Set(existing.map((b) => slugify(b.name)))
  for (const detection of detections) {
    const slug = slugify(detection.name)
    if (existingSlugs.has(slug)) continue
    const cat = categorized.get(slug)
    const ar = autoRing(detection.repoCount)
    const blip: ScannerBlip = {
      name: detection.name,
      ring: ar,
      quadrant: cat?.quadrant ?? 'tools',
      isNew: true,
      description: descriptions.get(slug) ?? '',
      autoRing: ar,
      detected: {
        repoCount: detection.repoCount,
        lastSeen: detection.lastSeen,
        sourceRepos: detection.sourceRepos,
      },
    }
    if (cat?.needsReview) {
      blip.needsReview = true
      changes.needsReview.push(detection.name)
    }
    candidate.push(blip)
    changes.added.push(detection.name)
  }

  return { candidate, changes }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scanner/merge.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scanner/merge.ts scanner/merge.test.ts
git commit -m "feat(scanner): merge detections with radar, preserving curated data"
```

---

### Task 7: Diff report

**Files:**
- Create: `scanner/report.ts`
- Test: `scanner/report.test.ts`

**Interfaces:**
- Consumes: `ChangeSet` from `scanner/merge`.
- Produces: `renderReport(changes: ChangeSet, reposScanned: number): string` (Markdown).

- [ ] **Step 1: Write the failing test**

Create `scanner/report.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { renderReport } from './report'

const changes = {
  added: ['Grafana'],
  ringMoves: [{ name: 'React', from: 'low' as const, to: 'high' as const }],
  undetected: ['AWS'],
  needsReview: ['Grafana'],
}

describe('renderReport', () => {
  const md = renderReport(changes, 30)
  it('summarizes counts in a headline', () => {
    expect(md).toMatch(/30 repos/)
    expect(md).toMatch(/\+1 added/)
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/report.test.ts`
Expected: FAIL — `Cannot find module './report'`.

- [ ] **Step 3: Implement**

Create `scanner/report.ts`:
```ts
import type { ChangeSet } from './merge'

/** Render a human-readable Markdown summary of a scan's proposed changes. */
export function renderReport(changes: ChangeSet, reposScanned: number): string {
  const lines: string[] = []
  lines.push(`# Tech Radar scan`)
  lines.push('')
  lines.push(
    `Scanned **${reposScanned} repos** — ` +
      `**+${changes.added.length} added**, ` +
      `**${changes.ringMoves.length} ring moves**, ` +
      `**${changes.undetected.length} undetected**, ` +
      `**${changes.needsReview.length} needs-review**.`,
  )

  if (changes.added.length) {
    lines.push('', '## Added', ...changes.added.map((n) => `- ${n}`))
  }
  if (changes.ringMoves.length) {
    lines.push('', '## Ring moves', ...changes.ringMoves.map((m) => `- ${m.name}: ${m.from} → ${m.to}`))
  }
  if (changes.needsReview.length) {
    lines.push(
      '',
      '## Needs-review (low AI confidence — verify quadrant)',
      ...changes.needsReview.map((n) => `- ${n}`),
    )
  }
  if (changes.undetected.length) {
    lines.push(
      '',
      '## Undetected — confirm still in use / retire manually',
      ...changes.undetected.map((n) => `- ${n}`),
    )
  }
  return lines.join('\n') + '\n'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scanner/report.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scanner/report.ts scanner/report.test.ts
git commit -m "feat(scanner): human-readable diff report"
```

---

### Task 8: Language detector

**Files:**
- Create: `scanner/detect/languages.ts`
- Test: `scanner/detect/languages.test.ts`

**Interfaces:**
- Consumes: `SCANNER_CONFIG.languageNoiseRatio`; `DetectedToken` from `scanner/types`.
- Produces: `detectLanguages(bytesByLang: Record<string, number>): DetectedToken[]` (each token `kind: 'language'`, `quadrantHint: 'languages-frameworks'`).

- [ ] **Step 1: Write the failing test**

Create `scanner/detect/languages.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { detectLanguages } from './languages'

describe('detectLanguages', () => {
  it('emits a language-kind token with a languages-frameworks hint', () => {
    const tokens = detectLanguages({ TypeScript: 1000 })
    expect(tokens[0]).toMatchObject({ raw: 'TypeScript', kind: 'language', quadrantHint: 'languages-frameworks' })
  })
  it('ignores languages below the noise ratio', () => {
    const tokens = detectLanguages({ TypeScript: 9900, HTML: 100 })
    expect(tokens.map((t) => t.raw)).toEqual(['TypeScript'])
  })
  it('returns nothing for an empty repo', () => {
    expect(detectLanguages({})).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/detect/languages.test.ts`
Expected: FAIL — `Cannot find module './languages'`.

- [ ] **Step 3: Implement**

Create `scanner/detect/languages.ts`:
```ts
import { SCANNER_CONFIG } from '../config'
import type { DetectedToken } from '../types'

/** Turn GitHub language byte counts into language tokens, dropping trivial noise. */
export function detectLanguages(bytesByLang: Record<string, number>): DetectedToken[] {
  const total = Object.values(bytesByLang).reduce((a, b) => a + b, 0)
  if (total === 0) return []
  return Object.entries(bytesByLang)
    .filter(([, bytes]) => bytes / total >= SCANNER_CONFIG.languageNoiseRatio)
    .map(([raw]) => ({ raw, kind: 'language', quadrantHint: 'languages-frameworks' }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scanner/detect/languages.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scanner/detect/languages.ts scanner/detect/languages.test.ts
git commit -m "feat(scanner): language detector from GitHub byte counts"
```

---

### Task 9: Manifest detector

**Files:**
- Create: `scanner/detect/manifests.ts`
- Test: `scanner/detect/manifests.test.ts`

**Interfaces:**
- Consumes: `DetectedToken` from `scanner/types`.
- Produces: `detectManifest(path: string, content: string): DetectedToken[]` (each token `kind: 'dependency'`). Handles `package.json`, `requirements.txt`, `go.mod`, `composer.json`, `pom.xml`. Other paths return `[]`. (Additional manifest formats — pyproject, Gemfile, build.gradle — are out of scope for this task.)

- [ ] **Step 1: Write the failing test**

Create `scanner/detect/manifests.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { detectManifest } from './manifests'

describe('detectManifest', () => {
  it('reads dependencies and devDependencies from package.json', () => {
    const json = JSON.stringify({ dependencies: { react: '^19' }, devDependencies: { vite: '^8' } })
    expect(detectManifest('package.json', json).map((t) => t.raw).sort()).toEqual(['react', 'vite'])
  })
  it('reads top-level packages from requirements.txt', () => {
    const txt = 'fastapi==0.110\n# comment\nboto3>=1.0\n'
    expect(detectManifest('requirements.txt', txt).map((t) => t.raw).sort()).toEqual(['boto3', 'fastapi'])
  })
  it('reads module paths from go.mod require blocks', () => {
    const mod = 'module x\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n'
    expect(detectManifest('go.mod', mod).map((t) => t.raw)).toContain('github.com/gin-gonic/gin')
  })
  it('reads packages from composer.json require', () => {
    const json = JSON.stringify({ require: { 'laravel/framework': '^11', php: '^8.2' } })
    expect(detectManifest('composer.json', json).map((t) => t.raw)).toContain('laravel/framework')
  })
  it('reads artifactIds from pom.xml', () => {
    const xml = '<project><dependencies><dependency><artifactId>spring-boot</artifactId></dependency></dependencies></project>'
    expect(detectManifest('pom.xml', xml).map((t) => t.raw)).toContain('spring-boot')
  })
  it('returns nothing for an unknown file', () => {
    expect(detectManifest('README.md', 'hi')).toEqual([])
  })
  it('does not throw on malformed JSON', () => {
    expect(detectManifest('package.json', '{ not json')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/detect/manifests.test.ts`
Expected: FAIL — `Cannot find module './manifests'`.

- [ ] **Step 3: Implement**

Create `scanner/detect/manifests.ts`:
```ts
import type { DetectedToken } from '../types'

const dep = (raw: string): DetectedToken => ({ raw, kind: 'dependency' })

function fromPackageJson(content: string): string[] {
  try {
    const pkg = JSON.parse(content) as Record<string, Record<string, string> | undefined>
    return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]
  } catch {
    return []
  }
}

function fromComposerJson(content: string): string[] {
  try {
    const pkg = JSON.parse(content) as { require?: Record<string, string>; 'require-dev'?: Record<string, string> }
    return [...Object.keys(pkg.require ?? {}), ...Object.keys(pkg['require-dev'] ?? {})]
  } catch {
    return []
  }
}

function fromRequirementsTxt(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('-'))
    .map((line) => line.split(/[=<>!~ ]/)[0].trim())
    .filter(Boolean)
}

function fromGoMod(content: string): string[] {
  return [...content.matchAll(/^\s*([\w.\-/]+\.[\w.\-/]+)\s+v\d/gm)].map((m) => m[1])
}

function fromPomXml(content: string): string[] {
  return [...content.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)].map((m) => m[1].trim())
}

/** Parse a manifest file into dependency tokens. Unknown files yield []. */
export function detectManifest(path: string, content: string): DetectedToken[] {
  const file = path.split('/').pop() ?? path
  switch (file) {
    case 'package.json':
      return fromPackageJson(content).map(dep)
    case 'composer.json':
      return fromComposerJson(content).map(dep)
    case 'requirements.txt':
      return fromRequirementsTxt(content).map(dep)
    case 'go.mod':
      return fromGoMod(content).map(dep)
    case 'pom.xml':
      return fromPomXml(content).map(dep)
    default:
      return []
  }
}

/** Filenames this detector knows how to parse (used to decide which files to fetch). */
export const MANIFEST_FILES = ['package.json', 'composer.json', 'requirements.txt', 'go.mod', 'pom.xml']
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scanner/detect/manifests.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add scanner/detect/manifests.ts scanner/detect/manifests.test.ts
git commit -m "feat(scanner): manifest dependency parsers"
```

---

### Task 10: Tooling / platform detector

**Files:**
- Create: `scanner/detect/tooling.ts`
- Test: `scanner/detect/tooling.test.ts`

**Interfaces:**
- Consumes: `DetectedToken`, `QuadrantId`.
- Produces: `detectTooling(paths: string[]): DetectedToken[]` (each token carries a `quadrantHint`).

- [ ] **Step 1: Write the failing test**

Create `scanner/detect/tooling.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { detectTooling } from './tooling'

describe('detectTooling', () => {
  it('detects Docker from a Dockerfile anywhere in the tree', () => {
    const tokens = detectTooling(['svc/Dockerfile'])
    expect(tokens).toContainEqual({ raw: 'Docker', kind: 'tool', quadrantHint: 'platforms' })
  })
  it('detects Terraform from any .tf file', () => {
    expect(detectTooling(['infra/main.tf']).map((t) => t.raw)).toContain('Terraform')
  })
  it('detects GitHub Actions from a workflow file', () => {
    expect(detectTooling(['.github/workflows/ci.yml']).map((t) => t.raw)).toContain('GitHub Actions')
  })
  it('emits each tool at most once', () => {
    const tokens = detectTooling(['a/Dockerfile', 'b/Dockerfile'])
    expect(tokens.filter((t) => t.raw === 'Docker')).toHaveLength(1)
  })
  it('returns nothing when no known tool files are present', () => {
    expect(detectTooling(['src/index.ts'])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/detect/tooling.test.ts`
Expected: FAIL — `Cannot find module './tooling'`.

- [ ] **Step 3: Implement**

Create `scanner/detect/tooling.ts`:
```ts
import type { QuadrantId } from '../../src/data/types'
import type { DetectedToken } from '../types'

interface Rule {
  name: string
  quadrant: QuadrantId
  match: (path: string) => boolean
}

const base = (p: string) => p.split('/').pop() ?? p

const RULES: Rule[] = [
  { name: 'Docker', quadrant: 'platforms', match: (p) => /^Dockerfile/.test(base(p)) || base(p) === 'docker-compose.yml' },
  { name: 'Terraform', quadrant: 'platforms', match: (p) => p.endsWith('.tf') },
  { name: 'Kubernetes', quadrant: 'platforms', match: (p) => base(p) === 'Chart.yaml' || base(p) === 'kustomization.yaml' },
  { name: 'GitHub Actions', quadrant: 'platforms', match: (p) => p.startsWith('.github/workflows/') },
  { name: 'GitLab CI/CD', quadrant: 'platforms', match: (p) => base(p) === '.gitlab-ci.yml' },
  { name: 'Vite', quadrant: 'tools', match: (p) => /^vite\.config\.(t|j)s$/.test(base(p)) },
  { name: 'Playwright', quadrant: 'tools', match: (p) => /^playwright\.config\.(t|j)s$/.test(base(p)) },
]

/** Detect tools and easy platforms from the set of file paths in a repo. */
export function detectTooling(paths: string[]): DetectedToken[] {
  const tokens: DetectedToken[] = []
  for (const rule of RULES) {
    if (paths.some((p) => rule.match(p))) {
      tokens.push({ raw: rule.name, kind: 'tool', quadrantHint: rule.quadrant })
    }
  }
  return tokens
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scanner/detect/tooling.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scanner/detect/tooling.ts scanner/detect/tooling.test.ts
git commit -m "feat(scanner): tooling and platform file detector"
```

---

### Task 11: German description drafting

**Files:**
- Create: `scanner/describe.ts`
- Test: `scanner/describe.test.ts`

**Interfaces:**
- Consumes: `LLMClient`; `Detection`.
- Produces: `draftDescription(detection: Detection, llm: LLMClient): Promise<string>`.

- [ ] **Step 1: Write the failing test**

Create `scanner/describe.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { draftDescription } from './describe'
import type { LLMClient } from './llm/types'
import type { Detection } from './types'

const det: Detection = { name: 'Grafana', repoCount: 2, sourceRepos: ['a', 'b'], lastSeen: '2026-06-18' }

describe('draftDescription', () => {
  it('calls the LLM with the tech name and returns the German draft', async () => {
    const llm: LLMClient = { categorize: vi.fn(), describe: vi.fn().mockResolvedValue('Grafana ist ...') }
    const result = await draftDescription(det, llm)
    expect(result).toBe('Grafana ist ...')
    expect(llm.describe).toHaveBeenCalledWith('Grafana', expect.stringContaining('2'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/describe.test.ts`
Expected: FAIL — `Cannot find module './describe'`.

- [ ] **Step 3: Implement**

Create `scanner/describe.ts`:
```ts
import type { Detection } from './types'
import type { LLMClient } from './llm/types'

/** Ask the LLM to draft a German radar description for a newly-detected tech. */
export function draftDescription(detection: Detection, llm: LLMClient): Promise<string> {
  const context = `Erkannt in ${detection.repoCount} Repositories: ${detection.sourceRepos.join(', ')}.`
  return llm.describe(detection.name, context)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scanner/describe.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add scanner/describe.ts scanner/describe.test.ts
git commit -m "feat(scanner): German description drafting via LLMClient"
```

---

### Task 12: Default Anthropic LLM client

**Files:**
- Create: `scanner/llm/anthropicClient.ts`
- Test: `scanner/llm/anthropicClient.test.ts`

**Interfaces:**
- Consumes: `LLMClient`, `ModelPair`; `QUADRANTS` from `src/config.ts`.
- Produces: `createAnthropicClient(sdk: AnthropicLike, models: ModelPair): LLMClient` where `interface AnthropicLike { messages: { create(args: unknown): Promise<{ content: { type: string; text?: string }[] }> } }`.

- [ ] **Step 1: Write the failing test**

Create `scanner/llm/anthropicClient.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { createAnthropicClient } from './anthropicClient'

const textResponse = (text: string) => ({ content: [{ type: 'text', text }] })
const models = { categorize: 'claude-haiku-4-5', describe: 'claude-opus-4-8' }

describe('createAnthropicClient', () => {
  it('parses a quadrant + confidence JSON object from categorize', async () => {
    const sdk = { messages: { create: vi.fn().mockResolvedValue(textResponse('{"quadrant":"tools","confidence":0.9}')) } }
    const client = createAnthropicClient(sdk, models)
    expect(await client.categorize('Grafana', 'ctx')).toEqual({ quadrant: 'tools', confidence: 0.9 })
  })

  it('clamps an unknown quadrant to tools with zero confidence', async () => {
    const sdk = { messages: { create: vi.fn().mockResolvedValue(textResponse('{"quadrant":"banana","confidence":0.9}')) } }
    const client = createAnthropicClient(sdk, models)
    expect(await client.categorize('X', 'ctx')).toEqual({ quadrant: 'tools', confidence: 0 })
  })

  it('returns the text body from describe', async () => {
    const sdk = { messages: { create: vi.fn().mockResolvedValue(textResponse('Grafana ist ein Tool.')) } }
    const client = createAnthropicClient(sdk, models)
    expect(await client.describe('Grafana', 'ctx')).toBe('Grafana ist ein Tool.')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/llm/anthropicClient.test.ts`
Expected: FAIL — `Cannot find module './anthropicClient'`.

- [ ] **Step 3: Implement**

Create `scanner/llm/anthropicClient.ts`:
```ts
import type { QuadrantId } from '../../src/data/types'
import { QUADRANTS } from '../../src/config'
import type { LLMClient, ModelPair } from './types'

/** Minimal shape of the Anthropic SDK we depend on (keeps tests SDK-free). */
export interface AnthropicLike {
  messages: { create(args: unknown): Promise<{ content: { type: string; text?: string }[] }> }
}

const QUADRANT_IDS = QUADRANTS.map((q) => q.id) as QuadrantId[]
const DETECTABLE = QUADRANT_IDS.filter((q) => q !== 'techniques')

/** Prompt builders shared with the Forge client so both providers ask identically. */
export function categorizePrompt(name: string, context: string): string {
  return (
    `Classify the technology "${name}" into exactly one tech-radar quadrant.\n` +
    `${context}\n` +
    `Allowed quadrants: ${DETECTABLE.join(', ')}.\n` +
    `Reply with ONLY a JSON object: {"quadrant": "<id>", "confidence": <0..1>}.`
  )
}

export function describePrompt(name: string, context: string): string {
  return (
    `Schreibe eine sachliche deutsche Kurzbeschreibung (2-4 Sätze) der Technologie "${name}" ` +
    `für einen Tech-Radar. Kontext: ${context} Antworte nur mit der Beschreibung, ohne Vorrede.`
  )
}

/** Parse the categorize JSON, clamping unknown quadrants to a safe default. */
export function parseCategory(text: string): { quadrant: QuadrantId; confidence: number } {
  try {
    const parsed = JSON.parse(text) as { quadrant: string; confidence: number }
    if (!DETECTABLE.includes(parsed.quadrant as QuadrantId)) return { quadrant: 'tools', confidence: 0 }
    return { quadrant: parsed.quadrant as QuadrantId, confidence: parsed.confidence }
  } catch {
    return { quadrant: 'tools', confidence: 0 }
  }
}

function firstText(res: { content: { type: string; text?: string }[] }): string {
  return res.content.find((b) => b.type === 'text')?.text ?? ''
}

export function createAnthropicClient(sdk: AnthropicLike, models: ModelPair): LLMClient {
  return {
    async categorize(name, context) {
      const res = await sdk.messages.create({
        model: models.categorize,
        max_tokens: 256,
        messages: [{ role: 'user', content: categorizePrompt(name, context) }],
      })
      return parseCategory(firstText(res))
    },
    async describe(name, context) {
      const res = await sdk.messages.create({
        model: models.describe,
        max_tokens: 400,
        messages: [{ role: 'user', content: describePrompt(name, context) }],
      })
      return firstText(res).trim()
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scanner/llm/anthropicClient.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scanner/llm/anthropicClient.ts scanner/llm/anthropicClient.test.ts
git commit -m "feat(scanner): default Anthropic LLM client"
```

---

### Task 13: GitHub client

**Files:**
- Create: `scanner/github.ts`
- Test: `scanner/github.test.ts`

**Interfaces:**
- Consumes: `SCANNER_CONFIG.org`.
- Produces: `interface RepoMeta { name: string; defaultBranch: string; pushedAt: string }`; `interface GitHubClient { listRepos(): Promise<RepoMeta[]>; getLanguages(repo: string): Promise<Record<string, number>>; listFiles(repo: string, branch: string): Promise<string[]>; getFileContent(repo: string, path: string): Promise<string | null> }`; `createGitHubClient(octokit: OctokitLike, org: string): GitHubClient` with the minimal `OctokitLike` shape used here.

- [ ] **Step 1: Write the failing test**

Create `scanner/github.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { createGitHubClient } from './github'

function fakeOctokit() {
  return {
    paginate: vi.fn().mockResolvedValue([
      { name: 'live', archived: false, fork: false, default_branch: 'main', pushed_at: '2026-06-18T10:00:00Z' },
      { name: 'old', archived: true, fork: false, default_branch: 'main', pushed_at: '2024-01-01T00:00:00Z' },
      { name: 'forked', archived: false, fork: true, default_branch: 'main', pushed_at: '2026-01-01T00:00:00Z' },
    ]),
    rest: {
      repos: {
        listForOrg: vi.fn(),
        listLanguages: vi.fn().mockResolvedValue({ data: { TypeScript: 100 } }),
        getContent: vi.fn().mockResolvedValue({ data: { content: Buffer.from('hello').toString('base64') } }),
      },
      git: {
        getTree: vi.fn().mockResolvedValue({ data: { tree: [{ path: 'package.json', type: 'blob' }] } }),
      },
    },
  }
}

describe('createGitHubClient', () => {
  it('lists only non-archived, non-fork repos with normalized pushedAt date', async () => {
    const gh = createGitHubClient(fakeOctokit() as any, 'nerdware-dev')
    const repos = await gh.listRepos()
    expect(repos).toEqual([{ name: 'live', defaultBranch: 'main', pushedAt: '2026-06-18' }])
  })
  it('returns language byte counts', async () => {
    const gh = createGitHubClient(fakeOctokit() as any, 'nerdware-dev')
    expect(await gh.getLanguages('live')).toEqual({ TypeScript: 100 })
  })
  it('lists blob paths from the recursive tree', async () => {
    const gh = createGitHubClient(fakeOctokit() as any, 'nerdware-dev')
    expect(await gh.listFiles('live', 'main')).toEqual(['package.json'])
  })
  it('decodes base64 file content', async () => {
    const gh = createGitHubClient(fakeOctokit() as any, 'nerdware-dev')
    expect(await gh.getFileContent('live', 'package.json')).toBe('hello')
  })
  it('returns null when a file is missing', async () => {
    const oct = fakeOctokit()
    oct.rest.repos.getContent = vi.fn().mockRejectedValue({ status: 404 })
    const gh = createGitHubClient(oct as any, 'nerdware-dev')
    expect(await gh.getFileContent('live', 'nope.json')).toBeNull()
  })
}
)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/github.test.ts`
Expected: FAIL — `Cannot find module './github'`.

- [ ] **Step 3: Implement**

Create `scanner/github.ts`:
```ts
export interface RepoMeta {
  name: string
  defaultBranch: string
  pushedAt: string
}

export interface GitHubClient {
  listRepos(): Promise<RepoMeta[]>
  getLanguages(repo: string): Promise<Record<string, number>>
  listFiles(repo: string, branch: string): Promise<string[]>
  getFileContent(repo: string, path: string): Promise<string | null>
}

/** Minimal subset of @octokit/rest used by the scanner (keeps tests light). */
export interface OctokitLike {
  paginate(route: unknown, params: unknown): Promise<Array<Record<string, unknown>>>
  rest: {
    repos: {
      listForOrg: unknown
      listLanguages(args: { owner: string; repo: string }): Promise<{ data: Record<string, number> }>
      getContent(args: { owner: string; repo: string; path: string }): Promise<{ data: unknown }>
    }
    git: {
      getTree(args: {
        owner: string
        repo: string
        tree_sha: string
        recursive: string
      }): Promise<{ data: { tree: Array<{ path?: string; type?: string }> } }>
    }
  }
}

export function createGitHubClient(octokit: OctokitLike, org: string): GitHubClient {
  return {
    async listRepos() {
      const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
        org,
        type: 'all',
        per_page: 100,
      })
      return repos
        .filter((r) => !r.archived && !r.fork)
        .map((r) => ({
          name: String(r.name),
          defaultBranch: String(r.default_branch),
          pushedAt: String(r.pushed_at).slice(0, 10),
        }))
    },
    async getLanguages(repo) {
      const res = await octokit.rest.repos.listLanguages({ owner: org, repo })
      return res.data
    },
    async listFiles(repo, branch) {
      const res = await octokit.rest.git.getTree({ owner: org, repo, tree_sha: branch, recursive: 'true' })
      return res.data.tree.filter((n) => n.type === 'blob' && n.path).map((n) => n.path as string)
    },
    async getFileContent(repo, path) {
      try {
        const res = await octokit.rest.repos.getContent({ owner: org, repo, path })
        const data = res.data as { content?: string }
        if (!data.content) return null
        return Buffer.from(data.content, 'base64').toString('utf8')
      } catch {
        return null
      }
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scanner/github.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scanner/github.ts scanner/github.test.ts
git commit -m "feat(scanner): GitHub client over Octokit"
```

---

### Task 13a: Forge gateway client and provider selection

**Files:**
- Create: `scanner/llm/forgeClient.ts`
- Create: `scanner/llm/createLLMClient.ts`
- Test: `scanner/llm/forgeClient.test.ts`
- Test: `scanner/llm/createLLMClient.test.ts`

**Interfaces:**
- Consumes: `LLMClient`, `ModelPair`; `categorizePrompt`, `describePrompt`, `parseCategory` from `scanner/llm/anthropicClient` (reused so both providers prompt identically); `SCANNER_CONFIG`; `createAnthropicClient`.
- Produces: `createForgeClient(openai: OpenAILike, models: ModelPair): LLMClient` with `interface OpenAILike { chat: { completions: { create(args: unknown): Promise<{ choices: { message: { content: string | null } }[] }> } } }`; and `createLLMClient(env?: NodeJS.ProcessEnv): LLMClient` (env-driven provider selector).

- [ ] **Step 1: Write the failing Forge-client test**

Create `scanner/llm/forgeClient.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { createForgeClient } from './forgeClient'

const chatResponse = (content: string) => ({ choices: [{ message: { content } }] })
const models = { categorize: 'claude-haiku-4-5', describe: 'claude-opus-4-6' }

describe('createForgeClient', () => {
  it('parses a quadrant + confidence object from an OpenAI-shaped response', async () => {
    const openai = { chat: { completions: { create: vi.fn().mockResolvedValue(chatResponse('{"quadrant":"platforms","confidence":0.8}')) } } }
    const client = createForgeClient(openai, models)
    expect(await client.categorize('Redis', 'ctx')).toEqual({ quadrant: 'platforms', confidence: 0.8 })
  })

  it('sends the configured forge model alias for describe', async () => {
    const create = vi.fn().mockResolvedValue(chatResponse('Redis ist ein In-Memory-Store.'))
    const openai = { chat: { completions: { create } } }
    const client = createForgeClient(openai, models)
    const text = await client.describe('Redis', 'ctx')
    expect(text).toBe('Redis ist ein In-Memory-Store.')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-opus-4-6' }))
  })

  it('tolerates a null message content', async () => {
    const openai = { chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: null } }] }) } } }
    const client = createForgeClient(openai, models)
    expect(await client.describe('X', 'ctx')).toBe('')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run scanner/llm/forgeClient.test.ts`
Expected: FAIL — `Cannot find module './forgeClient'`.

- [ ] **Step 3: Implement the Forge client**

Create `scanner/llm/forgeClient.ts`:
```ts
import type { LLMClient, ModelPair } from './types'
import { categorizePrompt, describePrompt, parseCategory } from './anthropicClient'

/** Minimal shape of the OpenAI SDK we depend on (keeps tests SDK-free). */
export interface OpenAILike {
  chat: {
    completions: {
      create(args: unknown): Promise<{ choices: { message: { content: string | null } }[] }>
    }
  }
}

function firstContent(res: { choices: { message: { content: string | null } }[] }): string {
  return res.choices[0]?.message?.content ?? ''
}

/** OpenAI-wire LLM client for the Forge gateway. Same prompts as the Anthropic
 *  client so categorization/description behavior matches across providers. */
export function createForgeClient(openai: OpenAILike, models: ModelPair): LLMClient {
  return {
    async categorize(name, context) {
      const res = await openai.chat.completions.create({
        model: models.categorize,
        max_tokens: 256,
        messages: [{ role: 'user', content: categorizePrompt(name, context) }],
      })
      return parseCategory(firstContent(res))
    },
    async describe(name, context) {
      const res = await openai.chat.completions.create({
        model: models.describe,
        max_tokens: 400,
        messages: [{ role: 'user', content: describePrompt(name, context) }],
      })
      return firstContent(res).trim()
    },
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run scanner/llm/forgeClient.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing selector test**

Create `scanner/llm/createLLMClient.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createLLMClient } from './createLLMClient'

describe('createLLMClient', () => {
  it('builds a forge client when LLM_PROVIDER=forge and a key is present', () => {
    const client = createLLMClient({ LLM_PROVIDER: 'forge', FORGE_API_KEY: 'sk-x' } as NodeJS.ProcessEnv)
    expect(typeof client.categorize).toBe('function')
    expect(typeof client.describe).toBe('function')
  })

  it('throws when forge is selected without a key', () => {
    expect(() => createLLMClient({ LLM_PROVIDER: 'forge' } as NodeJS.ProcessEnv)).toThrow(/FORGE_API_KEY/)
  })

  it('defaults to the anthropic provider and requires its key', () => {
    expect(() => createLLMClient({} as NodeJS.ProcessEnv)).toThrow(/ANTHROPIC_API_KEY/)
    const client = createLLMClient({ ANTHROPIC_API_KEY: 'x' } as NodeJS.ProcessEnv)
    expect(typeof client.categorize).toBe('function')
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run scanner/llm/createLLMClient.test.ts`
Expected: FAIL — `Cannot find module './createLLMClient'`.

- [ ] **Step 7: Implement the selector**

Create `scanner/llm/createLLMClient.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { SCANNER_CONFIG } from '../config'
import type { LLMClient } from './types'
import { createAnthropicClient } from './anthropicClient'
import { createForgeClient } from './forgeClient'

/** Choose and construct the LLM provider from the environment.
 *  `anthropic` (default) calls Anthropic directly; `forge` routes through the
 *  OpenAI-wire Nerdware gateway. SDK construction makes no network calls. */
export function createLLMClient(env: NodeJS.ProcessEnv = process.env): LLMClient {
  const provider = env.LLM_PROVIDER ?? SCANNER_CONFIG.defaultProvider
  if (provider === 'forge') {
    if (!env.FORGE_API_KEY) throw new Error('LLM_PROVIDER=forge requires FORGE_API_KEY')
    const openai = new OpenAI({
      apiKey: env.FORGE_API_KEY,
      baseURL: env.FORGE_BASE_URL ?? SCANNER_CONFIG.forgeBaseUrl,
    })
    return createForgeClient(openai, SCANNER_CONFIG.models.forge)
  }
  if (!env.ANTHROPIC_API_KEY) throw new Error('LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY')
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  return createAnthropicClient(anthropic, SCANNER_CONFIG.models.anthropic)
}
```

- [ ] **Step 8: Run it to verify it passes + typecheck**

Run: `npx vitest run scanner/llm/createLLMClient.test.ts && npx tsc -b`
Expected: PASS (3 tests), tsc exits 0. (If tsc reports the real `OpenAI` client is not assignable to `OpenAILike`, wrap the argument as `openai as unknown as OpenAILike` — the runtime shape is correct.)

- [ ] **Step 9: Commit**

```bash
git add scanner/llm/forgeClient.ts scanner/llm/createLLMClient.ts scanner/llm/forgeClient.test.ts scanner/llm/createLLMClient.test.ts
git commit -m "feat(scanner): Forge gateway client and env-driven provider selection"
```

---

### Task 14: Orchestration (`run.ts`) and outputs

**Files:**
- Create: `scanner/scan.ts` (pure orchestration, testable)
- Create: `scanner/run.ts` (CLI entrypoint wiring real clients + file I/O)
- Test: `scanner/scan.test.ts`

**Interfaces:**
- Consumes (`scan.ts`): `GitHubClient`, `LLMClient`, all detectors, `aggregate`, `categorize`, `draftDescription`, `mergeRadar`, `renderReport`, `slugify`, `MANIFEST_FILES`. Consumes (`run.ts`): `createGitHubClient`, `createLLMClient`, `parseRadar`, `runScan`, `SCANNER_CONFIG`.
- Produces: `interface ScanResult { candidate: ScannerBlip[]; report: string; detections: Detection[] }`; `runScan(gh: GitHubClient, llm: LLMClient, existing: ScannerBlip[]): Promise<ScanResult>`. `run.ts` is the side-effecting entrypoint (no exported API).

- [ ] **Step 1: Write the failing test**

Create `scanner/scan.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { runScan } from './scan'
import type { GitHubClient } from './github'
import type { LLMClient } from './llm/types'
import type { ScannerBlip } from './types'

const gh: GitHubClient = {
  listRepos: vi.fn().mockResolvedValue([{ name: 'graphmind', defaultBranch: 'main', pushedAt: '2026-06-18' }]),
  getLanguages: vi.fn().mockResolvedValue({ TypeScript: 1000 }),
  listFiles: vi.fn().mockResolvedValue(['package.json', 'Dockerfile']),
  getFileContent: vi.fn().mockResolvedValue(JSON.stringify({ dependencies: { react: '^19' } })),
}
const llm: LLMClient = {
  categorize: vi.fn().mockResolvedValue({ quadrant: 'tools', confidence: 0.9 }),
  describe: vi.fn().mockResolvedValue('Beschreibung.'),
}

describe('runScan', () => {
  it('produces a candidate that includes detected techs and a valid report', async () => {
    const existing: ScannerBlip[] = []
    const result = await runScan(gh, llm, existing)
    const names = result.candidate.map((b) => b.name)
    expect(names).toContain('React')
    expect(names).toContain('Docker')
    expect(names).toContain('TypeScript')
    expect(result.report).toMatch(/Scanned \*\*1 repos/)
  })

  it('preserves a pinned curated blip that is never detected', async () => {
    const existing: ScannerBlip[] = [
      { name: 'Scrum', ring: 'high', quadrant: 'techniques', isNew: 'FALSE', description: 'x', pinned: true },
    ]
    const result = await runScan(gh, llm, existing)
    expect(result.candidate.find((b) => b.name === 'Scrum')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scanner/scan.test.ts`
Expected: FAIL — `Cannot find module './scan'`.

- [ ] **Step 3: Implement the orchestration**

Create `scanner/scan.ts`:
```ts
import { slugify } from '../src/data/slug'
import type { QuadrantId } from '../src/data/types'
import type { GitHubClient } from './github'
import type { LLMClient } from './llm/types'
import type { Detection, RepoScan, ScannerBlip } from './types'
import { detectLanguages } from './detect/languages'
import { detectManifest, MANIFEST_FILES } from './detect/manifests'
import { detectTooling } from './detect/tooling'
import { aggregate } from './aggregate'
import { categorize } from './categorize'
import { draftDescription } from './describe'
import { mergeRadar } from './merge'
import { renderReport } from './report'

export interface ScanResult {
  candidate: ScannerBlip[]
  report: string
  detections: Detection[]
}

/** Run the full pipeline against injected clients. Pure of file/network setup. */
export async function runScan(
  gh: GitHubClient,
  llm: LLMClient,
  existing: ScannerBlip[],
): Promise<ScanResult> {
  const repos = await gh.listRepos()
  const scans: RepoScan[] = []

  for (const repo of repos) {
    const tokens = []
    const languages = await gh.getLanguages(repo.name).catch(() => ({}))
    tokens.push(...detectLanguages(languages))

    const files = await gh.listFiles(repo.name, repo.defaultBranch).catch(() => [] as string[])
    tokens.push(...detectTooling(files))

    for (const path of files) {
      const file = path.split('/').pop() ?? path
      if (!MANIFEST_FILES.includes(file)) continue
      const content = await gh.getFileContent(repo.name, path)
      if (content) tokens.push(...detectManifest(path, content))
    }
    scans.push({ repo: repo.name, pushedAt: repo.pushedAt, tokens })
  }

  const detections = aggregate(scans)
  const existingSlugs = new Set(existing.map((b) => slugify(b.name)))

  const categorized = new Map<string, { quadrant: QuadrantId; needsReview: boolean }>()
  const descriptions = new Map<string, string>()
  for (const detection of detections) {
    const slug = slugify(detection.name)
    categorized.set(slug, await categorize(detection, llm))
    if (!existingSlugs.has(slug)) {
      descriptions.set(slug, await draftDescription(detection, llm))
    }
  }

  const { candidate, changes } = mergeRadar(existing, detections, categorized, descriptions)
  const report = renderReport(changes, repos.length)
  return { candidate, report, detections }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scanner/scan.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the CLI entrypoint**

Create `scanner/run.ts`:
```ts
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { Octokit } from '@octokit/rest'
import { parseRadar } from '../src/data/schema'
import { slugify } from '../src/data/slug'
import { SCANNER_CONFIG } from './config'
import { createGitHubClient } from './github'
import { createLLMClient } from './llm/createLLMClient'
import { runScan } from './scan'
import type { ScannerBlip } from './types'

async function main(): Promise<void> {
  // Load .env locally (gitignored); in CI the vars come from the environment.
  if (existsSync('.env')) process.loadEnvFile('.env')

  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (!token) throw new Error('Set GH_TOKEN (e.g. GH_TOKEN=$(gh auth token)).')

  const gh = createGitHubClient(new Octokit({ auth: token }), SCANNER_CONFIG.org)
  const llm = createLLMClient() // provider chosen by LLM_PROVIDER; validates its own key

  const existingRaw = JSON.parse(await readFile(SCANNER_CONFIG.paths.radar, 'utf8')) as ScannerBlip[]
  const result = await runScan(gh, llm, existingRaw)

  // Safety guardrail: candidate must parse, and no pinned/existing blip may vanish.
  parseRadar(result.candidate)
  const candidateSlugs = new Set(result.candidate.map((b) => slugify(b.name)))
  const dropped = existingRaw.filter((b) => !candidateSlugs.has(slugify(b.name)))
  if (dropped.length) throw new Error(`Refusing to write: dropped ${dropped.map((b) => b.name).join(', ')}`)

  const today = new Date().toISOString().slice(0, 10)
  await writeFile(SCANNER_CONFIG.paths.radar, JSON.stringify(result.candidate, null, 2) + '\n')
  await mkdir(SCANNER_CONFIG.paths.detectionsDir, { recursive: true })
  await writeFile(
    join(SCANNER_CONFIG.paths.detectionsDir, `${today}.json`),
    JSON.stringify(result.detections, null, 2) + '\n',
  )
  process.stdout.write(result.report)
}

main().catch((err) => {
  process.stderr.write(`Scan failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
```

- [ ] **Step 6: Typecheck the entrypoint**

Run: `npx tsc -b`
Expected: exit 0 (no type errors across `scanner/`).

- [ ] **Step 7: Commit**

```bash
git add scanner/scan.ts scanner/scan.test.ts scanner/run.ts
git commit -m "feat(scanner): orchestration pipeline and CLI entrypoint"
```

---

### Task 15: App-side passthrough test (provenance fields are tolerated)

**Files:**
- Test: `src/data/schema.provenance.test.ts`

**Interfaces:**
- Consumes: `parseRadar` from `src/data/schema.ts`.

- [ ] **Step 1: Write the test**

Create `src/data/schema.provenance.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseRadar } from './schema'

describe('parseRadar with scanner provenance fields', () => {
  const withProvenance = [
    {
      name: 'React',
      ring: 'high',
      quadrant: 'languages-frameworks',
      isNew: false,
      description: 'UI.',
      detected: { repoCount: 7, lastSeen: '2026-06-18', sourceRepos: ['a', 'b'] },
      autoRing: 'high',
      ringOverride: 'dev',
      pinned: true,
      needsReview: false,
    },
  ]

  it('parses blips carrying extra provenance fields without throwing', () => {
    const radar = parseRadar(withProvenance)
    expect(radar.blips[0].ring).toBe('high')
    expect(radar.blips[0].quadrant).toBe('languages-frameworks')
  })

  it('renders only the standard fields the app needs', () => {
    const radar = parseRadar(withProvenance)
    expect(Object.keys(radar.blips[0]).sort()).toEqual(
      ['description', 'id', 'isNew', 'name', 'quadrant', 'ring'].sort(),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/data/schema.provenance.test.ts`
Expected: PASS (2 tests). (zod strips unknown keys, so the extra fields are dropped on parse and the app is unaffected.)

- [ ] **Step 3: Run the full suite + typecheck + lint**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/data/schema.provenance.test.ts
git commit -m "test(radar): provenance fields survive parseRadar untouched"
```

---

## After the plan: the first real run

This is the integration checkpoint from the spec — done together, **not** an automated task. With a `.env` containing `LLM_PROVIDER=forge` + `FORGE_API_KEY` (or `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`):

```bash
GH_TOKEN=$(gh auth token) npm run scan
```

Review the printed report and the `git diff` of `data/tech-radar.json`. Once detection quality looks right, the daily GitHub Actions workflow (spec §11, step 2 — with `FORGE_API_KEY` as a repo/org secret) is a separate plan.

## Self-Review

**Spec coverage:**
- §4 architecture / file layout → Tasks 1, 3–14 create the mapped files (one detector/module per task).
- §5 data model (provenance, app-safe) → `ScannerBlip` (Task 1), merge writes effective + provenance (Task 6), passthrough test (Task 15).
- §6 reconciliation (new add / detected re-ring / undetected untouched / pinned preserved / no auto-Out) → Task 6 tests cover each branch; Task 14 preserves pinned end-to-end.
- §7 AI usage (table → AI fallback, confidence gating, German descriptions) → Tasks 4, 11, 12.
- §7.1/§7.2 execution model + `LLMClient` seam (default Anthropic; Forge gateway, OpenAI-wire) → Tasks 4 (interface + `ModelPair`), 12 (Anthropic impl + shared prompts), 13a (Forge impl + env-driven provider selection). Per-provider model aliases in config (Task 1).
- §8 outputs (candidate, detections snapshot, report) → Task 14 `run.ts`; Task 7 report.
- §9 error handling (skip-on-error, malformed-tolerant, output safety assertion) → Task 9 (malformed JSON), Task 13 (404 → null), Task 14 `runScan` `.catch` per repo + `run.ts` guardrail.
- §10 testing (units + safety-critical merge + fixtures + mocked clients) → every task is TDD; Tasks 6, 13 are the safety/integration seams.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The manifest task explicitly scopes its format set (a scope statement, not a deferred code gap).

**Type consistency:** `LLMClient.categorize/describe` signatures match across Tasks 4, 11, 12, 14. `Detection`, `ScannerBlip`, `RepoScan`, `DetectedToken` defined in Task 1 and used unchanged. `ChangeSet` defined in Task 6, consumed in Task 7. `GitHubClient` defined in Task 13, consumed in Task 14. `categorized`/`descriptions` maps are keyed by `slugify(name)` consistently in Tasks 6 and 14.
