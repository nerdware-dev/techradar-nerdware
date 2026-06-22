# Scanner Relevance Categorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the binary allowlist gate in the radar scanner with a staged relevance resolver that separates radar-worthy technologies from transitive/plumbing/sub-package dependencies, backed by a self-growing verdict cache and LLM triage.

**Architecture:** A per-token resolver decides `radar | child | noise` cheapest-stage-first: detection hygiene → family-collapse → plumbing-suppression → verdict-cache lookup → LLM triage (cache-misses only). LLM verdicts are written back to `data/verdicts.json` so each repeats for free. Known/cached techs never reach the LLM. Radar verdicts flow into the existing `mergeRadar` auto-blip path (machine-owned, human-vetoable).

**Tech Stack:** TypeScript (ESM, Node ≥22), Vitest, Forge gateway (OpenAI-wire) for the LLM, run via `tsx`.

## Global Constraints

- Node ≥22, ESM modules (`"type": "module"`). One line per import; no CommonJS.
- LLM provider is **Forge only** (`createLLMClient` / `createForgeClient`); model aliases come from `SCANNER_CONFIG.models`. Never add a direct Anthropic path.
- `runScan` stays free of filesystem/network setup — all IO (reading/writing `data/verdicts.json`, computing `today`) happens in `run.ts` and is passed in.
- The `run.ts` safety guardrail must remain intact: the candidate radar must `parseRadar`, and no existing/pinned blip may disappear.
- Tests use Vitest (`describe`/`it`/`expect`, `vi` for fakes). Run a single file with `npx vitest run scanner/<file>.test.ts`.
- Canonical-name keys everywhere use `slugify` from `src/data/slug`.
- Quadrant ids: `'techniques' | 'platforms' | 'tools' | 'languages-frameworks'`. The scanner never assigns `techniques` (LLM/resolver clamp unknowns to `tools`).
- Commit style: `feat(scanner): …`, `fix(scanner): …`, `refactor(scanner): …`, `data(radar): …`. No attribution trailers.
- Final gate before done: `npm run quality` (lint + typecheck + coverage) is green.

---

## Shared Types (introduced in Task 2, referenced throughout)

Added to `scanner/types.ts`:

```ts
/** What a token is, for radar purposes. */
export type Verdict = 'radar' | 'child' | 'noise'
/** A verdict the cache can store (child is resolved to its parent at scan time). */
export type TerminalVerdict = 'radar' | 'noise'

/** Result of the deterministic per-token resolver (Task 6). */
export interface Resolved {
  /** Canonical blip name, e.g. "Radix UI". */
  canonical: string
  /** 'unknown' = no deterministic verdict; must go to LLM triage. */
  verdict: TerminalVerdict | 'unknown'
  /** Present when verdict is 'radar' and the quadrant is known deterministically. */
  quadrant?: QuadrantId
}

/** One entry in the persisted verdict cache (Task 4). */
export interface VerdictEntry {
  verdict: TerminalVerdict
  quadrant?: QuadrantId
  source: 'seed' | 'llm' | 'human'
  confidence?: number
  /** ISO date (YYYY-MM-DD) the verdict was decided. */
  decidedAt?: string
}

/** The persisted verdict cache, keyed by slugified canonical name. */
export type VerdictCache = Record<string, VerdictEntry>

/** Result of LLM triage for one unknown tech (Task 7). */
export interface TriageResult {
  verdict: Verdict
  /** Canonical parent name when verdict is 'child'. */
  parent?: string
  /** Present when verdict is 'radar'. */
  quadrant?: QuadrantId
  confidence: number
}
```

Also add `quadrant?: QuadrantId` to the existing `Detection` interface (the resolved/triaged quadrant, authoritative; distinct from the detector `quadrantHint`).

---

### Task 1: Detection hygiene — drop Go indirect deps and Maven plugins/parents

**Files:**
- Modify: `scanner/detect/manifests.ts` (`fromGoMod`, `fromPomXml`)
- Test: `scanner/detect/manifests.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `detectManifest(path, content)` unchanged signature; `go.mod` now yields only direct requires, `pom.xml` only real `<dependencies>` artifactIds.

- [ ] **Step 1: Write the failing tests**

Add to `scanner/detect/manifests.test.ts`:

```ts
it('drops // indirect requires from go.mod, keeping only direct deps', () => {
  const mod = [
    'module x',
    '',
    'require (',
    '\tgithub.com/gin-gonic/gin v1.9.1',
    '\tgithub.com/modern-go/reflect2 v1.0.2 // indirect',
    ')',
    '',
    'require github.com/stretchr/testify v1.8.0',
  ].join('\n')
  const raws = detectManifest('go.mod', mod).map((t) => t.raw)
  expect(raws).toContain('github.com/gin-gonic/gin')
  expect(raws).toContain('github.com/stretchr/testify')
  expect(raws).not.toContain('github.com/modern-go/reflect2')
})

it('ignores pom.xml artifactIds inside plugin, parent and dependencyManagement', () => {
  const xml = [
    '<project>',
    '  <parent><artifactId>spring-boot-starter-parent</artifactId></parent>',
    '  <dependencyManagement><dependencies><dependency>',
    '    <artifactId>libraries-bom</artifactId>',
    '  </dependency></dependencies></dependencyManagement>',
    '  <dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies>',
    '  <build><plugins><plugin><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>',
    '</project>',
  ].join('\n')
  const raws = detectManifest('pom.xml', xml).map((t) => t.raw)
  expect(raws).toEqual(['spring-boot-starter-web'])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scanner/detect/manifests.test.ts`
Expected: FAIL — current `fromGoMod` includes the `// indirect` line; current `fromPomXml` returns all four artifactIds.

- [ ] **Step 3: Implement the minimal change**

In `scanner/detect/manifests.ts`, replace `fromGoMod` and `fromPomXml`:

```ts
function fromGoMod(content: string): string[] {
  return [...content.matchAll(/^\s*([\w.\-/]+\.[\w.\-/]+)\s+v\d\S*(.*)$/gm)]
    .filter((m) => !/\/\/\s*indirect/.test(m[2]))
    .map((m) => m[1])
}

/** Extract only the `<dependencies>` artifactIds, skipping `<dependencyManagement>`,
 *  `<parent>` and `<build><plugins>` (BOMs and build plugins aren't tech choices). */
function fromPomXml(content: string): string[] {
  const stripped = content
    .replace(/<dependencyManagement>[\s\S]*?<\/dependencyManagement>/g, '')
    .replace(/<parent>[\s\S]*?<\/parent>/g, '')
    .replace(/<plugins>[\s\S]*?<\/plugins>/g, '')
  return [...stripped.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)].map((m) => m[1].trim())
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scanner/detect/manifests.test.ts`
Expected: PASS (including the pre-existing go.mod/pom.xml tests).

- [ ] **Step 5: Commit**

```bash
git add scanner/detect/manifests.ts scanner/detect/manifests.test.ts
git commit -m "fix(scanner): go.mod direct-deps only + pom.xml dependency scoping"
```

---

### Task 2: Generalized parent-collapse families

**Files:**
- Modify: `scanner/types.ts` (add the shared types from the "Shared Types" section above)
- Create: `scanner/mappings/families.ts`
- Test: `scanner/mappings/families.test.ts`

**Interfaces:**
- Consumes: `QuadrantId` from `../../src/data/types`; `TerminalVerdict` from `../types`.
- Produces:
  - `interface Family { prefix: string; canonical: string; verdict: TerminalVerdict; quadrant?: QuadrantId }`
  - `collapseFamily(raw: string): { canonical: string; verdict: TerminalVerdict; quadrant?: QuadrantId } | null` — case-insensitive prefix match against the raw token (npm scope like `@radix-ui/react-dialog` or Go path like `github.com/aws/aws-sdk-go-v2/service/s3`); returns the first matching family, else `null`.

- [ ] **Step 1: Add the shared types to `scanner/types.ts`**

Append the full "Shared Types" block above to `scanner/types.ts`, and add `quadrant?: QuadrantId` to the existing `Detection` interface. (`QuadrantId` is already imported there.)

- [ ] **Step 2: Write the failing tests**

Create `scanner/mappings/families.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { collapseFamily } from './families'

describe('collapseFamily', () => {
  it('collapses an npm scope family to its canonical radar blip', () => {
    expect(collapseFamily('@radix-ui/react-dialog')).toEqual({
      canonical: 'Radix UI',
      verdict: 'radar',
      quadrant: 'languages-frameworks',
    })
    expect(collapseFamily('@nx/eslint')?.canonical).toBe('Nx')
    expect(collapseFamily('@nrwl/jest')?.canonical).toBe('Nx')
  })
  it('collapses a Go module-path family by prefix', () => {
    expect(collapseFamily('github.com/aws/aws-sdk-go-v2/service/s3')).toEqual({
      canonical: 'AWS',
      verdict: 'radar',
      quadrant: 'platforms',
    })
  })
  it('marks golang.org/x/* as noise', () => {
    expect(collapseFamily('golang.org/x/sys')).toEqual({ canonical: 'golang.org/x', verdict: 'noise' })
  })
  it('returns null for a token that matches no family', () => {
    expect(collapseFamily('langchain')).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run scanner/mappings/families.test.ts`
Expected: FAIL — `collapseFamily` not defined.

- [ ] **Step 4: Implement `scanner/mappings/families.ts`**

```ts
import type { QuadrantId } from '../../src/data/types'
import type { TerminalVerdict } from '../types'

export interface Family {
  /** Lowercased prefix: npm scope ("@radix-ui/") or Go module path ("github.com/aws/aws-sdk-go-v2/"). */
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
```

- [ ] **Step 5: Run tests, then commit**

Run: `npx vitest run scanner/mappings/families.test.ts`
Expected: PASS

```bash
git add scanner/types.ts scanner/mappings/families.ts scanner/mappings/families.test.ts
git commit -m "feat(scanner): generalized parent-collapse families + relevance types"
```

---

### Task 3: Plumbing suppression

**Files:**
- Create: `scanner/mappings/plumbing.ts`
- Test: `scanner/mappings/plumbing.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isPlumbing(raw: string): boolean` — true for build/lint/test plumbing that is never a radar tech. Matches by raw token (for `@scope/` and `@types/` patterns) and by slug (for suffix/exact patterns).

- [ ] **Step 1: Write the failing tests**

Create `scanner/mappings/plumbing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isPlumbing } from './plumbing'

describe('isPlumbing', () => {
  it('matches eslint plugin/config and webpack loaders/plugins by pattern', () => {
    expect(isPlumbing('eslint-plugin-react')).toBe(true)
    expect(isPlumbing('eslint-config-prettier')).toBe(true)
    expect(isPlumbing('ts-loader')).toBe(true)
    expect(isPlumbing('copy-webpack-plugin')).toBe(true)
    expect(isPlumbing('@swc/core')).toBe(true)
    expect(isPlumbing('@babel/preset-env')).toBe(true)
  })
  it('matches the exact-set of build/test plumbing', () => {
    expect(isPlumbing('tslib')).toBe(true)
    expect(isPlumbing('reflect-metadata')).toBe(true)
    expect(isPlumbing('zone.js')).toBe(true)
  })
  it('does not flag a real radar tech', () => {
    expect(isPlumbing('langchain')).toBe(false)
    expect(isPlumbing('drizzle-orm')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scanner/mappings/plumbing.test.ts`
Expected: FAIL — `isPlumbing` not defined.

- [ ] **Step 3: Implement `scanner/mappings/plumbing.ts`**

```ts
import { slugify } from '../../src/data/slug'

/** Exact slugs that are build/test plumbing, never a deliberate tech choice. */
const EXACT = new Set<string>([
  'tslib', 'postcss', 'autoprefixer', 'reflect-metadata', 'zone-js', 'core-js',
  'regenerator-runtime', 'ts-node', 'tsx', 'globals', 'source-map-support',
  'rimraf', 'husky', 'lint-staged', 'nodemon', 'concurrently', 'cross-env', 'copyfiles',
])

/** Raw-token prefixes (scoped plumbing namespaces). */
const RAW_PREFIXES = ['@types/', '@swc/', '@babel/', 'babel-']

/** Slug patterns for plumbing families. */
const SLUG_PATTERNS = [
  /^eslint-plugin-/, /^eslint-config-/, /-loader$/, /-webpack-plugin$/,
]

/** True when a token is build/lint/test plumbing rather than a radar technology. */
export function isPlumbing(raw: string): boolean {
  const lower = raw.toLowerCase()
  if (RAW_PREFIXES.some((p) => lower.startsWith(p))) return true
  const slug = slugify(raw)
  if (EXACT.has(slug)) return true
  return SLUG_PATTERNS.some((re) => re.test(slug))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scanner/mappings/plumbing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scanner/mappings/plumbing.ts scanner/mappings/plumbing.test.ts
git commit -m "feat(scanner): plumbing-suppression rules"
```

---

### Task 4: Verdict cache module (lookup + write-back merge)

**Files:**
- Create: `scanner/verdicts.ts`
- Test: `scanner/verdicts.test.ts`

**Interfaces:**
- Consumes: `VerdictCache`, `VerdictEntry`, `TerminalVerdict` from `./types`.
- Produces:
  - `lookupVerdict(canonical: string, cache: VerdictCache): VerdictEntry | undefined` — keyed by `slugify(canonical)`.
  - `mergeVerdicts(cache: VerdictCache, patch: VerdictCache): VerdictCache` — returns a new cache; an existing entry with `source: 'human'` is never overwritten; otherwise the patch wins.

- [ ] **Step 1: Write the failing tests**

Create `scanner/verdicts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { lookupVerdict, mergeVerdicts } from './verdicts'
import type { VerdictCache } from './types'

const cache: VerdictCache = {
  react: { verdict: 'radar', quadrant: 'languages-frameworks', source: 'seed' },
  axios: { verdict: 'noise', source: 'human' },
}

describe('lookupVerdict', () => {
  it('finds an entry by slugified canonical name', () => {
    expect(lookupVerdict('React', cache)?.verdict).toBe('radar')
  })
  it('returns undefined for an unknown name', () => {
    expect(lookupVerdict('LangChain', cache)).toBeUndefined()
  })
})

describe('mergeVerdicts', () => {
  it('adds new llm verdicts', () => {
    const next = mergeVerdicts(cache, {
      langchain: { verdict: 'radar', quadrant: 'languages-frameworks', source: 'llm', confidence: 0.9 },
    })
    expect(next.langchain.source).toBe('llm')
  })
  it('never overwrites a human entry with an llm patch', () => {
    const next = mergeVerdicts(cache, { axios: { verdict: 'radar', source: 'llm', confidence: 0.8 } })
    expect(next.axios).toEqual({ verdict: 'noise', source: 'human' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scanner/verdicts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scanner/verdicts.ts`**

```ts
import { slugify } from '../src/data/slug'
import type { VerdictCache, VerdictEntry } from './types'

/** Look up a verdict by canonical name (slug-keyed). */
export function lookupVerdict(canonical: string, cache: VerdictCache): VerdictEntry | undefined {
  return cache[slugify(canonical)]
}

/** Merge LLM/seed verdicts into the cache without clobbering human decisions. */
export function mergeVerdicts(cache: VerdictCache, patch: VerdictCache): VerdictCache {
  const next: VerdictCache = { ...cache }
  for (const [key, entry] of Object.entries(patch)) {
    if (next[key]?.source === 'human') continue
    next[key] = entry
  }
  return next
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scanner/verdicts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scanner/verdicts.ts scanner/verdicts.test.ts
git commit -m "feat(scanner): verdict-cache lookup + write-back merge"
```

---

### Task 5: Seed `data/verdicts.json` from the existing allowlist

**Files:**
- Create: `scanner/scripts/seedVerdicts.ts`
- Create: `data/verdicts.json` (generated output, committed)
- Modify: `scanner/config.ts` (add `paths.verdicts`)

**Interfaces:**
- Consumes: `ALIASES`, `SCOPE_ALIASES` from `../mappings/aliases`; `QUADRANT_MAP` from `../mappings/quadrants`; `slugify`.
- Produces: a committed `data/verdicts.json` mapping `slug(canonical) → { verdict: 'radar', quadrant, source: 'seed' }`.

- [ ] **Step 1: Add the config path**

In `scanner/config.ts`, extend `paths`:

```ts
  paths: { radar: 'data/tech-radar.json', detectionsDir: 'data/detections', verdicts: 'data/verdicts.json' },
```

- [ ] **Step 2: Write the seed script `scanner/scripts/seedVerdicts.ts`**

```ts
import process from 'node:process'
import { slugify } from '../../src/data/slug'
import { ALIASES, SCOPE_ALIASES } from '../mappings/aliases'
import { QUADRANT_MAP } from '../mappings/quadrants'
import type { VerdictCache } from '../types'

/** One-shot: derive the seed verdict cache from today's allowlist + quadrant table.
 *  Run: `npx tsx scanner/scripts/seedVerdicts.ts > data/verdicts.json` */
const cache: VerdictCache = {}
for (const canonical of [...Object.values(ALIASES), ...Object.values(SCOPE_ALIASES)]) {
  const slug = slugify(canonical)
  const quadrant = QUADRANT_MAP[slug]
  cache[slug] = quadrant
    ? { verdict: 'radar', quadrant, source: 'seed' }
    : { verdict: 'radar', source: 'seed' }
}
const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)))
process.stdout.write(JSON.stringify(sorted, null, 2) + '\n')
```

- [ ] **Step 3: Generate the file**

Run: `npx tsx scanner/scripts/seedVerdicts.ts > data/verdicts.json`
Expected: `data/verdicts.json` contains ~34 entries, each `{ "verdict": "radar", "quadrant": "...", "source": "seed" }`, e.g. `"react": { "verdict": "radar", "quadrant": "languages-frameworks", "source": "seed" }`.

- [ ] **Step 4: Verify it parses and is non-empty**

Run: `node -e "const c=require('./data/verdicts.json'); if(Object.keys(c).length<30) throw new Error('too few'); if(c.react.verdict!=='radar') throw new Error('bad'); console.log('ok', Object.keys(c).length)"`
Expected: `ok 34` (or similar count ≥30).

- [ ] **Step 5: Commit**

```bash
git add scanner/config.ts scanner/scripts/seedVerdicts.ts data/verdicts.json
git commit -m "data(radar): seed verdict cache from allowlist + quadrant table"
```

---

### Task 6: Staged deterministic resolver (replaces `classify`)

**Files:**
- Create: `scanner/resolve.ts`
- Test: `scanner/resolve.test.ts`

**Interfaces:**
- Consumes: `slugify`; `ALIASES` from `./mappings/aliases`; `IGNORE` from `./mappings/ignore`; `collapseFamily` from `./mappings/families`; `isPlumbing` from `./mappings/plumbing`; `lookupVerdict` from `./verdicts`; types `DetectedToken`, `Resolved`, `VerdictCache`.
- Produces: `resolve(token: DetectedToken, cache: VerdictCache): Resolved | null` — `null` means hard-drop (ignore-list / `@types`). Otherwise a `Resolved` with `verdict` of `'radar' | 'noise' | 'unknown'`.

Resolution order (dependency tokens): IGNORE → `@types/*` → family → plumbing → canonicalize via ALIASES → cache lookup → `unknown`. Language/tool tokens are always `radar` (canonicalized via ALIASES, quadrant from `quadrantHint`), bypassing cache/LLM — preserving today's behavior.

- [ ] **Step 1: Write the failing tests**

Create `scanner/resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolve } from './resolve'
import type { DetectedToken, VerdictCache } from './types'

const dep = (raw: string): DetectedToken => ({ raw, kind: 'dependency' })
const lang = (raw: string): DetectedToken => ({ raw, kind: 'language', quadrantHint: 'languages-frameworks' })
const cache: VerdictCache = {
  react: { verdict: 'radar', quadrant: 'languages-frameworks', source: 'seed' },
  axios: { verdict: 'noise', source: 'human' },
}

describe('resolve', () => {
  it('hard-drops ignore-list and @types tokens', () => {
    expect(resolve(dep('@types/react'), cache)).toBeNull()
    expect(resolve(lang('HTML'), cache)).toBeNull()
  })
  it('collapses a family member to its parent verdict', () => {
    expect(resolve(dep('@radix-ui/react-tabs'), cache)).toEqual({
      canonical: 'Radix UI', verdict: 'radar', quadrant: 'languages-frameworks',
    })
    expect(resolve(dep('golang.org/x/sys'), cache)).toEqual({ canonical: 'golang.org/x', verdict: 'noise' })
  })
  it('marks plumbing as noise', () => {
    expect(resolve(dep('eslint-plugin-react'), cache)?.verdict).toBe('noise')
  })
  it('uses the cache for a known canonical dep', () => {
    expect(resolve(dep('react-dom'), cache)).toEqual({
      canonical: 'React', verdict: 'radar', quadrant: 'languages-frameworks',
    })
    expect(resolve(dep('axios'), cache)?.verdict).toBe('noise')
  })
  it('returns unknown for an unrecognized direct dep', () => {
    expect(resolve(dep('langchain'), cache)).toEqual({ canonical: 'Langchain', verdict: 'unknown' })
  })
  it('always treats a language/tool token as radar', () => {
    expect(resolve(lang('Vue'), cache)).toEqual({
      canonical: 'Vue.js', verdict: 'radar', quadrant: 'languages-frameworks',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scanner/resolve.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scanner/resolve.ts`**

```ts
import { slugify } from '../src/data/slug'
import { ALIASES } from './mappings/aliases'
import { IGNORE } from './mappings/ignore'
import { collapseFamily } from './mappings/families'
import { isPlumbing } from './mappings/plumbing'
import { lookupVerdict } from './verdicts'
import type { DetectedToken, Resolved, VerdictCache } from './types'

function titleCase(slug: string): string {
  return slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

/** Stage the relevance decision cheapest-first. Returns null for hard-drops. */
export function resolve(token: DetectedToken, cache: VerdictCache): Resolved | null {
  const slug = slugify(token.raw)
  if (!slug || IGNORE.has(slug)) return null

  if (token.kind !== 'dependency') {
    // language | tool — curated detector signals are always radar.
    const canonical = ALIASES[slug] ?? token.raw
    return { canonical, verdict: 'radar', quadrant: token.quadrantHint }
  }

  if (token.raw.toLowerCase().startsWith('@types/')) return null

  const family = collapseFamily(token.raw)
  if (family) return { canonical: family.canonical, verdict: family.verdict, quadrant: family.quadrant }

  if (isPlumbing(token.raw)) return { canonical: titleCase(slug), verdict: 'noise' }

  const canonical = ALIASES[slug] ?? titleCase(slug)
  const cached = lookupVerdict(canonical, cache)
  if (cached) return { canonical, verdict: cached.verdict, quadrant: cached.quadrant }

  return { canonical, verdict: 'unknown' }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scanner/resolve.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scanner/resolve.ts scanner/resolve.test.ts
git commit -m "feat(scanner): staged deterministic relevance resolver"
```

---

### Task 7: LLM triage (client method + prompt + orchestration)

**Files:**
- Modify: `scanner/llm/types.ts` (add `triage` to `LLMClient`)
- Modify: `scanner/llm/prompts.ts` (add `triagePrompt`, `parseTriage`)
- Modify: `scanner/llm/forgeClient.ts` (implement `triage`)
- Create: `scanner/triage.ts` (orchestrate triage over unknown detections)
- Test: `scanner/llm/prompts.test.ts` (add cases), `scanner/triage.test.ts`

**Interfaces:**
- Consumes: `Detection`, `TriageResult`, `QuadrantId`, `LLMClient`.
- Produces:
  - `LLMClient.triage(name: string, context: string): Promise<TriageResult>`
  - `triagePrompt(name: string, context: string): string`
  - `parseTriage(text: string): TriageResult` — clamps unknown quadrants to `tools` and unknown verdicts to `noise`.
  - `triageAll(unknowns: Detection[], llm: LLMClient): Promise<Map<string, TriageResult>>` — keyed by `slugify(name)`, one LLM call per unknown.

- [ ] **Step 1: Add `triage` to the `LLMClient` interface**

In `scanner/llm/types.ts`, import `TriageResult` from `../types` and add to the interface:

```ts
  /** Decide whether an unrecognized dep is radar-worthy, a child of a parent, or noise. */
  triage(name: string, context: string): Promise<import('../types').TriageResult>
```

Also add `triage: string` to the `ModelPair` interface and set it in `SCANNER_CONFIG.models` (`scanner/config.ts`): reuse the cheap model — `triage: 'claude-haiku-4-5'`.

- [ ] **Step 2: Write the failing tests**

Add to `scanner/llm/prompts.test.ts` (create the file if absent, mirroring the existing prompt-test style):

```ts
import { describe, it, expect } from 'vitest'
import { parseTriage } from './prompts'

describe('parseTriage', () => {
  it('parses a radar verdict with quadrant and confidence', () => {
    expect(parseTriage('{"verdict":"radar","quadrant":"tools","confidence":0.9}')).toEqual({
      verdict: 'radar', quadrant: 'tools', confidence: 0.9,
    })
  })
  it('clamps an unknown quadrant to tools', () => {
    expect(parseTriage('{"verdict":"radar","quadrant":"bogus","confidence":0.8}').quadrant).toBe('tools')
  })
  it('falls back to noise on malformed JSON', () => {
    expect(parseTriage('not json')).toEqual({ verdict: 'noise', confidence: 0 })
  })
})
```

Create `scanner/triage.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { triageAll } from './triage'
import type { Detection, LLMClient } from './types'
import type { LLMClient as _LLM } from './llm/types'

const det = (name: string): Detection => ({ name, repoCount: 2, sourceRepos: ['a', 'b'], lastSeen: '2026-06-22' })

const fakeLLM = (result: { verdict: string; quadrant?: string; confidence: number }): _LLM => ({
  categorize: vi.fn(),
  describe: vi.fn(),
  triage: vi.fn().mockResolvedValue(result),
})

describe('triageAll', () => {
  it('calls the LLM once per unknown and keys results by slug', async () => {
    const llm = fakeLLM({ verdict: 'radar', quadrant: 'languages-frameworks', confidence: 0.9 })
    const out = await triageAll([det('LangChain'), det('Drizzle ORM')], llm)
    expect(out.get('langchain')?.verdict).toBe('radar')
    expect(out.get('drizzle-orm')?.quadrant).toBe('languages-frameworks')
    expect(llm.triage).toHaveBeenCalledTimes(2)
  })
})
```

(Note: import `Detection` and `LLMClient` types from wherever the project re-exports; if `./types` does not re-export `LLMClient`, import it from `./llm/types` as shown.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run scanner/llm/prompts.test.ts scanner/triage.test.ts`
Expected: FAIL — `parseTriage` / `triageAll` not defined.

- [ ] **Step 4: Implement**

In `scanner/llm/prompts.ts` add:

```ts
import type { TriageResult } from '../types'

/** Build the relevance-triage prompt with the architecture-stance rubric. */
export function triagePrompt(name: string, context: string): string {
  return (
    `You curate a tech radar. A radar tracks technologies a team deliberately CHOOSES ` +
    `and has an opinion on — frameworks, ORMs, databases, platforms, state management, ` +
    `auth, testing frameworks, AI/ML SDKs, significant libraries. It does NOT track ` +
    `transitive dependencies, build/lint plumbing, polyfills, type stubs, or micro-utilities ` +
    `(date formatting, classname helpers, UUID generation).\n` +
    `Classify the dependency "${name}". ${context}\n` +
    `Allowed quadrants: ${DETECTABLE.join(', ')}.\n` +
    `Reply with ONLY JSON: {"verdict":"radar"|"child"|"noise","parent":<name|null>,` +
    `"quadrant":"<id|null>","confidence":<0..1>}. Use "child" only if it is a sub-package ` +
    `of a larger product; put that product in "parent".`
  )
}

/** Parse triage JSON, clamping unknown verdicts to noise and unknown quadrants to tools. */
export function parseTriage(text: string): TriageResult {
  try {
    const p = JSON.parse(text) as { verdict?: string; parent?: string; quadrant?: string; confidence?: number }
    const verdict = p.verdict === 'radar' || p.verdict === 'child' ? p.verdict : 'noise'
    const confidence = typeof p.confidence === 'number' ? p.confidence : 0
    const quadrant = DETECTABLE.includes(p.quadrant as QuadrantId) ? (p.quadrant as QuadrantId) : undefined
    const result: TriageResult = { verdict, confidence }
    if (verdict === 'radar') result.quadrant = quadrant ?? 'tools'
    if (verdict === 'child' && p.parent) result.parent = p.parent
    return result
  } catch {
    return { verdict: 'noise', confidence: 0 }
  }
}
```

In `scanner/llm/forgeClient.ts`, add to the returned object (after `describe`), importing `triagePrompt`/`parseTriage`:

```ts
    async triage(name, context) {
      const res = await openai.chat.completions.create({
        model: models.triage,
        max_tokens: 256,
        messages: [{ role: 'user', content: triagePrompt(name, context) }],
      })
      return parseTriage(firstContent(res))
    },
```

Create `scanner/triage.ts`:

```ts
import { slugify } from '../src/data/slug'
import type { Detection, TriageResult } from './types'
import type { LLMClient } from './llm/types'

/** Triage each unknown detection via the LLM. One call per unknown; keyed by slug. */
export async function triageAll(
  unknowns: Detection[],
  llm: LLMClient,
): Promise<Map<string, TriageResult>> {
  const out = new Map<string, TriageResult>()
  for (const d of unknowns) {
    const context = `Used in ${d.repoCount} repositories: ${d.sourceRepos.join(', ')}.`
    out.set(slugify(d.name), await llm.triage(d.name, context))
  }
  return out
}
```

- [ ] **Step 5: Update the existing fake-LLM in `categorize.test.ts` and any forge/createLLMClient tests**

Add `triage: vi.fn()` to the `fakeLLM` factory in `scanner/categorize.test.ts` (it must satisfy the widened `LLMClient`). In `scanner/llm/forgeClient.test.ts`, add a case asserting `triage` posts to `models.triage` and returns `parseTriage` output (mirror the existing `categorize` test there).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run scanner/llm scanner/triage.test.ts scanner/categorize.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scanner/llm scanner/triage.ts scanner/triage.test.ts scanner/categorize.test.ts scanner/config.ts
git commit -m "feat(scanner): LLM relevance triage (architecture-stance rubric)"
```

---

### Task 8: Rewire `aggregate` onto the resolver

**Files:**
- Modify: `scanner/aggregate.ts`
- Test: `scanner/aggregate.test.ts`

**Interfaces:**
- Consumes: `resolve` from `./resolve`; `VerdictCache`, `Detection`, `RepoScan`.
- Produces: `aggregate(scans: RepoScan[], cache: VerdictCache): Aggregated` where
  `Aggregated = { detections: Detection[]; unknowns: Detection[]; suppressed: Detection[] }`.
  - `detections`: radar verdicts (deterministic/cached), each carrying its resolved `quadrant`.
  - `unknowns`: `verdict === 'unknown'`, awaiting LLM triage.
  - `suppressed`: `noise` verdicts, sorted by adoption (for the audit log).
  - Grouping is by canonical name; a repo counts once per canonical. `lastSeen` is the max `pushedAt`; `quadrant` is taken from the first resolve that supplies one.

- [ ] **Step 1: Rewrite the tests**

Replace `scanner/aggregate.test.ts` with cache-aware tests:

```ts
import { describe, it, expect } from 'vitest'
import { aggregate } from './aggregate'
import type { RepoScan, VerdictCache } from './types'

const cache: VerdictCache = {
  react: { verdict: 'radar', quadrant: 'languages-frameworks', source: 'seed' },
}
const scans: RepoScan[] = [
  { repo: 'a', pushedAt: '2026-06-17', tokens: [
    { raw: 'react', kind: 'dependency' },
    { raw: '@radix-ui/react-tabs', kind: 'dependency' },
    { raw: 'TypeScript', kind: 'language', quadrantHint: 'languages-frameworks' },
  ]},
  { repo: 'b', pushedAt: '2026-06-15', tokens: [
    { raw: 'react-dom', kind: 'dependency' },
    { raw: '@radix-ui/react-dialog', kind: 'dependency' },
    { raw: 'tslib', kind: 'dependency' },
    { raw: 'langchain', kind: 'dependency' },
  ]},
]

describe('aggregate', () => {
  it('groups radar verdicts by canonical and counts distinct repos', () => {
    const react = aggregate(scans, cache).detections.find((d) => d.name === 'React')!
    expect(react.repoCount).toBe(2)
    expect(react.quadrant).toBe('languages-frameworks')
  })
  it('collapses family sub-packages into one detection', () => {
    const radix = aggregate(scans, cache).detections.find((d) => d.name === 'Radix UI')!
    expect(radix.repoCount).toBe(2)
  })
  it('routes plumbing to suppressed and unknown deps to unknowns', () => {
    const { unknowns, suppressed } = aggregate(scans, cache)
    expect(unknowns.find((d) => d.name === 'Langchain')).toBeTruthy()
    expect(suppressed.find((d) => d.name === 'Tslib')).toBeTruthy()
  })
  it('keeps a language token as a radar detection', () => {
    expect(aggregate(scans, cache).detections.find((d) => d.name === 'TypeScript')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scanner/aggregate.test.ts`
Expected: FAIL — `aggregate` takes one arg / returns old shape.

- [ ] **Step 3: Rewrite `scanner/aggregate.ts`**

```ts
import { resolve } from './resolve'
import type { Detection, RepoScan, VerdictCache } from './types'

export interface Aggregated {
  /** Radar-worthy techs (deterministic/cached), each with a resolved quadrant. */
  detections: Detection[]
  /** Cache-miss deps awaiting LLM triage. */
  unknowns: Detection[]
  /** Noise (transitive/plumbing/family-noise), sorted by adoption — audit only. */
  suppressed: Detection[]
}

/** Collapse per-repo tokens into per-canonical records, split by verdict. */
export function aggregate(scans: RepoScan[], cache: VerdictCache): Aggregated {
  const buckets = { radar: new Map<string, Detection>(), unknown: new Map<string, Detection>(), noise: new Map<string, Detection>() }

  for (const scan of scans) {
    const seenInRepo = new Set<string>()
    for (const token of scan.tokens) {
      const r = resolve(token, cache)
      if (!r || seenInRepo.has(r.canonical)) continue
      seenInRepo.add(r.canonical)
      const bucket = r.verdict === 'radar' ? buckets.radar : r.verdict === 'noise' ? buckets.noise : buckets.unknown
      const existing = bucket.get(r.canonical)
      if (existing) {
        existing.repoCount += 1
        existing.sourceRepos.push(scan.repo)
        if (scan.pushedAt > existing.lastSeen) existing.lastSeen = scan.pushedAt
        if (!existing.quadrant && r.quadrant) existing.quadrant = r.quadrant
      } else {
        bucket.set(r.canonical, {
          name: r.canonical,
          repoCount: 1,
          sourceRepos: [scan.repo],
          lastSeen: scan.pushedAt,
          quadrant: r.quadrant,
        })
      }
    }
  }

  const byAdoption = (a: Detection, b: Detection) => b.repoCount - a.repoCount
  return {
    detections: [...buckets.radar.values()],
    unknowns: [...buckets.unknown.values()].sort(byAdoption),
    suppressed: [...buckets.noise.values()].sort(byAdoption),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scanner/aggregate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scanner/aggregate.ts scanner/aggregate.test.ts
git commit -m "refactor(scanner): aggregate via staged resolver (radar/unknown/noise)"
```

---

### Task 9: Rewire `scan` — triage, child-rollup, write-back, categorized map

**Files:**
- Modify: `scanner/scan.ts`
- Test: `scanner/scan.test.ts`

**Interfaces:**
- Consumes: `aggregate(scans, cache)`; `triageAll(unknowns, llm)`; `mergeVerdicts(cache, patch)`; `draftDescription`; `mergeRadar`; `renderReport`; `CONFIDENCE_THRESHOLD`.
- Produces: `runScan(gh, llm, existing, cache, today, log?)` returning
  `{ candidate, report, detections, suppressed, verdicts }`. `verdicts` is the merged cache for `run.ts` to persist. The separate `categorize` call is removed — quadrants come from `detection.quadrant` (deterministic) or the triage result (unknowns).

Triage handling: for each unknown, `radar` → push to detections + `categorized.set(slug, { quadrant, needsReview: confidence < CONFIDENCE_THRESHOLD })` + cache patch `{ verdict:'radar', quadrant, source:'llm', confidence, decidedAt: today }`; `child` with a matching detection parent → roll `repoCount`/`sourceRepos`/`lastSeen` into the parent, else push to suppressed; both `child` and `noise` → cache patch `{ verdict:'noise', source:'llm', confidence, decidedAt: today }`.

- [ ] **Step 1: Update `scanner/scan.test.ts`**

The existing test injects a fake `gh` + `llm` and calls `runScan`. Update the call sites to pass `cache` and `today`, widen the fake `llm` with `triage: vi.fn()`, and assert the new return shape. Add:

```ts
it('auto-promotes a triaged radar unknown into a new blip and records its verdict', async () => {
  // gh fake returns one repo whose package.json has "langchain"
  const llm = { categorize: vi.fn(), describe: vi.fn().mockResolvedValue('desc'),
    triage: vi.fn().mockResolvedValue({ verdict: 'radar', quadrant: 'languages-frameworks', confidence: 0.9 }) }
  const result = await runScan(gh, llm, [], {}, '2026-06-22')
  expect(result.candidate.find((b) => b.name === 'Langchain')).toBeTruthy()
  expect(result.verdicts.langchain).toMatchObject({ verdict: 'radar', source: 'llm' })
})
```

(Reuse/extend the existing `gh` fake in the file; keep the existing assertions, adjusting them to the new `runScan` arity and to `result.suppressed` replacing `result.candidates`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scanner/scan.test.ts`
Expected: FAIL — `runScan` arity/return shape changed.

- [ ] **Step 3: Rewrite `scanner/scan.ts`**

Replace the body of `runScan` (keep the repo-scan loop that builds `scans` unchanged). New `ScanResult` + post-aggregate logic:

```ts
import { slugify } from '../src/data/slug'
import type { QuadrantId } from '../src/data/types'
import type { GitHubClient } from './github'
import type { LLMClient } from './llm/types'
import type { Detection, RepoScan, ScannerBlip, DetectedToken, VerdictCache } from './types'
import { detectLanguages } from './detect/languages'
import { detectManifest, MANIFEST_FILES } from './detect/manifests'
import { detectTooling } from './detect/tooling'
import { aggregate } from './aggregate'
import { triageAll } from './triage'
import { mergeVerdicts } from './verdicts'
import { draftDescription } from './describe'
import { mergeRadar } from './merge'
import { renderReport } from './report'

const CONFIDENCE_THRESHOLD = 0.7

export interface ScanResult {
  candidate: ScannerBlip[]
  report: string
  detections: Detection[]
  /** Noise, for the audit log (not published). */
  suppressed: Detection[]
  /** Verdict cache merged with this scan's LLM verdicts, for run.ts to persist. */
  verdicts: VerdictCache
}

export type Logger = (message: string) => void
const noop: Logger = () => {}

export async function runScan(
  gh: GitHubClient,
  llm: LLMClient,
  existing: ScannerBlip[],
  cache: VerdictCache,
  today: string,
  log: Logger = noop,
): Promise<ScanResult> {
  // … unchanged repo-scan loop building `scans: RepoScan[]` …

  const { detections, unknowns, suppressed } = aggregate(scans, cache)
  log(`Detected ${detections.length} radar techs + ${unknowns.length} unknown, ${suppressed.length} suppressed. Triaging…`)

  const categorized = new Map<string, { quadrant: QuadrantId; needsReview: boolean }>()
  for (const d of detections) {
    categorized.set(slugify(d.name), { quadrant: d.quadrant ?? 'tools', needsReview: false })
  }

  const triaged = await triageAll(unknowns, llm)
  const patch: VerdictCache = {}
  for (const u of unknowns) {
    const slug = slugify(u.name)
    const t = triaged.get(slug)!
    if (t.verdict === 'radar') {
      u.quadrant = t.quadrant
      detections.push(u)
      categorized.set(slug, { quadrant: t.quadrant ?? 'tools', needsReview: t.confidence < CONFIDENCE_THRESHOLD })
      patch[slug] = { verdict: 'radar', quadrant: t.quadrant, source: 'llm', confidence: t.confidence, decidedAt: today }
    } else {
      if (t.verdict === 'child' && t.parent) {
        const parent = detections.find((d) => slugify(d.name) === slugify(t.parent!))
        if (parent) {
          parent.repoCount += u.repoCount
          parent.sourceRepos.push(...u.sourceRepos)
          if (u.lastSeen > parent.lastSeen) parent.lastSeen = u.lastSeen
        } else suppressed.push(u)
      } else suppressed.push(u)
      patch[slug] = { verdict: 'noise', source: 'llm', confidence: t.confidence, decidedAt: today }
    }
  }

  const existingSlugs = new Set(existing.map((b) => slugify(b.name)))
  const descriptions = new Map<string, string>()
  for (const d of detections) {
    const slug = slugify(d.name)
    if (!existingSlugs.has(slug)) descriptions.set(slug, await draftDescription(d, llm))
  }

  const { candidate, changes } = mergeRadar(existing, detections, categorized, descriptions)
  const report = renderReport(changes, repos.length, suppressed.length)
  return { candidate, report, detections, suppressed, verdicts: mergeVerdicts(cache, patch) }
}
```

(Keep the existing `gh.listRepos()` / per-repo token loop verbatim above the `aggregate` call; `repos` stays in scope for `renderReport`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scanner/scan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scanner/scan.ts scanner/scan.test.ts
git commit -m "refactor(scanner): triage unknowns, child-rollup, verdict write-back"
```

---

### Task 10: Wire `run.ts` IO + report wording

**Files:**
- Modify: `scanner/run.ts` (load/persist `data/verdicts.json`; pass `cache` + `today`; write `suppressed`)
- Modify: `scanner/report.ts` (rename "candidates" → "suppressed" wording)
- Test: `scanner/report.test.ts` (update the summary-line assertion)

**Interfaces:**
- Consumes: `runScan(gh, llm, existing, cache, today, log)` from Task 9.
- Produces: persisted `data/verdicts.json` (sorted) and `data/detections/{today}.json` with `{ detections, suppressed }`.

- [ ] **Step 1: Update `scanner/report.test.ts`**

Change the summary assertion so the count label reads `suppressed` instead of `candidates`:

```ts
expect(report).toContain('suppressed')
```

(Adjust any existing assertion that referenced the word "candidates".)

- [ ] **Step 2: Run report test to verify it fails**

Run: `npx vitest run scanner/report.test.ts`
Expected: FAIL — report still says "candidates".

- [ ] **Step 3: Update `scanner/report.ts`**

In `renderReport`, rename the parameter and the rendered token:

```ts
export function renderReport(changes: ChangeSet, reposScanned: number, suppressed = 0): string {
```

and in the summary line replace ``**${candidates} candidates** (see data/detections/).`` with:

```ts
      `**${suppressed} suppressed** (see data/detections/).`,
```

- [ ] **Step 4: Update `scanner/run.ts`**

Add verdict-cache IO and the new `runScan` arguments. After reading `existingRaw`:

```ts
  const verdictsPath = SCANNER_CONFIG.paths.verdicts
  const cache = existsSync(verdictsPath)
    ? (JSON.parse(await readFile(verdictsPath, 'utf8')) as import('./types').VerdictCache)
    : {}
  const today = new Date().toISOString().slice(0, 10)
  const result = await runScan(gh, llm, existingRaw, cache, today, log)
```

Replace the detections-file write payload `{ detections: result.detections, candidates: result.candidates }` with `{ detections: result.detections, suppressed: result.suppressed }`, and after writing the radar, persist the cache (sorted for stable diffs):

```ts
  const sortedVerdicts = Object.fromEntries(
    Object.entries(result.verdicts).sort(([a], [b]) => a.localeCompare(b)),
  )
  await writeFile(verdictsPath, JSON.stringify(sortedVerdicts, null, 2) + '\n')
```

Remove the now-duplicate `const today = …` further down if present (reuse the one above for the detections filename).

- [ ] **Step 5: Run report test + typecheck**

Run: `npx vitest run scanner/report.test.ts && npm run typecheck`
Expected: PASS / no type errors.

- [ ] **Step 6: Commit**

```bash
git add scanner/run.ts scanner/report.ts scanner/report.test.ts
git commit -m "refactor(scanner): persist verdict cache + suppressed audit; report wording"
```

---

### Task 11: Cleanup — remove the dead allowlist path

**Files:**
- Delete: `scanner/classify.ts`, `scanner/classify.test.ts`, `scanner/categorize.ts`, `scanner/categorize.test.ts`
- Modify: `scanner/llm/types.ts`, `scanner/llm/forgeClient.ts`, `scanner/llm/prompts.ts` (drop the now-unused `categorize`/`categorizePrompt`/`parseCategory`), `scanner/llm/forgeClient.test.ts`, `scanner/llm/createLLMClient.test.ts`
- Modify: `scanner/mappings/aliases.ts` (remove `SCOPE_ALIASES`, superseded by `families.ts`)
- Modify: `scanner/config.ts` (`models.categorize` → keep only `triage` + `describe`)

**Interfaces:**
- Consumes: nothing new.
- Produces: a tree with no references to `classify`, `categorize`, `SCOPE_ALIASES`, or `models.categorize`.

- [ ] **Step 1: Find references before deleting**

Run: `grep -rn "classify\|categorize\|SCOPE_ALIASES\|models.categorize\|parseCategory\|categorizePrompt" scanner/`
Expected: only the files listed above; if anything else references them, stop and reconcile.

- [ ] **Step 2: Delete dead files**

```bash
git rm scanner/classify.ts scanner/classify.test.ts scanner/categorize.ts scanner/categorize.test.ts
```

- [ ] **Step 3: Drop `categorize` from the LLM layer**

Remove the `categorize` method from `LLMClient` (`scanner/llm/types.ts`), from `createForgeClient` (`scanner/llm/forgeClient.ts`), and `categorizePrompt`/`parseCategory` from `scanner/llm/prompts.ts`. Remove `categorize` from `ModelPair` (types.ts) and `models.categorize` from `SCANNER_CONFIG` (`scanner/config.ts`). Update `scanner/llm/forgeClient.test.ts` and `scanner/llm/createLLMClient.test.ts` to drop `categorize` assertions/fakes.

- [ ] **Step 4: Remove `SCOPE_ALIASES`**

Delete the `SCOPE_ALIASES` export from `scanner/mappings/aliases.ts` (kept only `ALIASES`, still used by `resolve` for canonicalization and by the seed script). Confirm no remaining importers: `grep -rn "SCOPE_ALIASES" scanner/` → empty.

- [ ] **Step 5: Full quality gate**

Run: `npm run quality`
Expected: lint clean, typecheck clean, all tests pass with coverage.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(scanner): remove allowlist classify/categorize path"
```

---

### Task 12: Live dry-run validation against the org

**Files:** none (validation only)

- [ ] **Step 1: Run a real scan**

Run: `GH_TOKEN=$(gh auth token) npm run scan > /tmp/scan-report.md 2>/tmp/scan.log`
Expected: completes without error; `git diff --stat` shows changes to `data/tech-radar.json`, a new `data/detections/<today>.json`, and an updated `data/verdicts.json`.

- [ ] **Step 2: Verify the denoise worked**

Run: `node -e "const d=require('./data/detections/'+new Date().toISOString().slice(0,10)+'.json'); console.log('detections', d.detections.length, 'suppressed', d.suppressed.length)"`
Expected: suppressed count is far smaller than the prior 806; detections include newly auto-promoted techs (e.g. LangChain, Drizzle, tRPC). Spot-check `/tmp/scan-report.md` "## Added".

- [ ] **Step 3: Review, then open the PR**

Inspect the radar diff and the report. If a tech is misclassified, add a `human`-source override to `data/verdicts.json` and re-run. When satisfied, push the branch and open a review PR (the weekly workflow's normal output):

```bash
git push -u origin feat/scanner-relevance-categorization
gh pr create --fill --title "feat(scanner): relevance categorization (dependency vs radar)"
```

---

## Self-Review

**Spec coverage:**
- Stufe 0 (Detection-Hygiene) → Task 1 ✓
- Stufe 1 (Parent-Collapse families) → Task 2 ✓
- Stufe 2 (Plumbing-Suppression) → Task 3 ✓
- Stufe 3 (Verdict-Cache + Migration/Seed) → Task 4 (module) + Task 5 (seed) ✓
- Stufe 4 (LLM-Triage, Rubrik, categorize merged in) → Task 7 ✓
- Stufe 5 (Write-back, human precedence) → Task 4 (`mergeVerdicts`) + Task 9 (patch) + Task 10 (persist) ✓
- `radar/child/noise` verdicts → Task 6 (radar/noise/unknown deterministic) + Task 7/9 (child via LLM + rollup) ✓
- Outputs: `suppressed` replaces `candidates` → Task 9/10 ✓; report wording → Task 10 ✓. (The spec's "Neue Radar-Techs entdeckt" section is served by the existing report `## Added` section, which lists auto-promoted blips — no new section needed.)
- Affected files (resolve, aggregate, categorize removal, scan, run, report, config) → Tasks 6/8/11/9/10/5 ✓
- `runScan` stays FS-free; cache + today injected → Task 9/10 ✓
- run.ts guardrail intact (untouched `parseRadar` + dropped-blip check) → preserved in Task 10 ✓
- Risks/non-goals: requirements.txt pip-freeze left out (non-goal) ✓; human override path exercised in Task 12 ✓.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. The one prose-only spot (Task 9 Step 3 "unchanged repo-scan loop") references existing code the implementer already has — acceptable, with the boundary stated explicitly.

**Type consistency:** `Resolved.verdict` is `TerminalVerdict | 'unknown'`; `VerdictEntry.verdict`/`TerminalVerdict` are `'radar'|'noise'`; `TriageResult.verdict` is the full `Verdict` (`radar|child|noise`). `aggregate(scans, cache)` arity matches its caller in `scan.ts`. `runScan(gh, llm, existing, cache, today, log)` arity matches `run.ts`. `collapseFamily`/`isPlumbing`/`lookupVerdict`/`triageAll`/`mergeVerdicts` signatures are consistent between definition and use. `categorized` map shape `{ quadrant, needsReview }` matches `mergeRadar`'s existing `categorized` parameter — so `merge.ts` is untouched.
