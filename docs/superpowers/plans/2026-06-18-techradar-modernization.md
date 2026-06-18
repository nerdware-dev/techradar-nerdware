# Tech Radar Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Nerdware Tech Radar as a modern React + Vite + TypeScript single-page app that renders the radar as declarative SVG (no D3, no jQuery), preserving the current UX and content workflow.

**Architecture:** A small SPA. A pure data layer (zod-validated, DOMPurify-sanitized) loads `tech-radar.json` from a configurable URL at runtime. Pure geometry/placement modules compute blip positions; React renders everything as declarative SVG. App state (focused quadrant, hovered/selected blip, search) lives in a `useReducer` + context store. Deployed as a multi-stage Docker image (Node build → nginx serve), built by GitHub Actions.

**Tech Stack:** React 19, Vite, TypeScript (strict), zod, DOMPurify, SCSS modules, Vitest + React Testing Library, Playwright, ESLint 9 (flat) + Prettier 3, Docker + nginx, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-06-18-techradar-modernization-design.md`

## Global Constraints

- **Runtime:** Node 22 LTS. `.nvmrc` = `22`, `package.json` `engines.node` = `>=22`.
- **Language:** TypeScript `strict: true`. No `any` in committed code except where unavoidable and commented.
- **Forbidden deps:** no jQuery, jQuery UI, D3, d3-tip, lodash, chance, webpack, Babel. Do not reinstall them.
- **License:** AGPL-3.0 retained (BYOR is AGPL). Keep `LICENSE.md`.
- **Content:** `data/tech-radar.json` keeps its current shape and German descriptions. Do not edit blip content.
- **Ring ids (from DATA, not README):** `low`, `dev`, `high`, `out`. Display names: Low / Developing / High / Out.
- **Quadrant ids (slugified from DATA):** `techniques`, `platforms`, `tools`, `languages-frameworks`.
- **Data URL default:** `https://raw.githubusercontent.com/nerdware-dev/techradar-nerdware/master/data/tech-radar.json`, overridable via `VITE_RADAR_DATA_URL`.
- **Commits:** conventional commits (`feat:`, `test:`, `chore:`, `docs:`), end every commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Branch:** all work on `modernization-react-vite`.

---

## File Structure

```
.
├── index.html                      # Vite entry (replaces src/index.html template)
├── package.json                    # reset, Nerdware-owned, v1.0.0
├── tsconfig.json / tsconfig.node.json
├── vite.config.ts                  # react plugin, base, vitest config
├── eslint.config.js                # ESLint 9 flat config
├── .prettierrc                     # Prettier 3
├── .nvmrc                          # 22
├── playwright.config.ts
├── Dockerfile                      # multi-stage: node build → nginx serve
├── nginx.conf
├── .github/workflows/ci.yml
├── data/tech-radar.json            # content (UNCHANGED)
├── public/images/                  # logos, banner, favicons (moved from src/images)
├── src/
│   ├── main.tsx                    # React root
│   ├── App.tsx                     # data load + layout + store provider
│   ├── config.ts                   # rings, quadrants, data URL, radar size
│   ├── test/setup.ts               # vitest + jest-dom setup
│   ├── data/
│   │   ├── types.ts                # Blip, Ring, Quadrant, Radar
│   │   ├── slug.ts                 # slugify()
│   │   ├── schema.ts               # zod schema + parseRadar()
│   │   └── loadRadar.ts            # fetch + parse
│   ├── radar/
│   │   ├── geometry.ts             # ringRadii, polarToCartesian, annularSectorPath, quadrantAngles
│   │   └── placement.ts            # seeded PRNG + placeBlips()
│   ├── state/
│   │   └── radarStore.tsx          # reducer + context + hooks
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Legend.tsx
│   │   ├── Search.tsx
│   │   ├── Blip.tsx
│   │   ├── Radar.tsx
│   │   ├── QuadrantTable.tsx
│   │   └── Tooltip.tsx
│   └── styles/
│       ├── tokens.scss             # colors + fonts (ported from old _colors/_fonts)
│       └── *.module.scss
└── e2e/radar.spec.ts               # Playwright smoke tests
```

**Deleted in Task 17:** `webpack.*.js` (×4), `.eslintrc.json`, `.eslintignore`, `jest.config.js`, `cypress.config.js`, `src/graphing/`, `src/util/`, `src/common.js`, `src/site.js`, `src/gtm.js`, `src/config.js`, `src/models/`, `src/exceptions/`, the committed `docs/*.js`/`*.css`/`*.map` build output, `.circleci/`, `build_and_start_nginx.sh`, `default.template`, `run_e2e_tests.sh`, `spec/`.

---

### Task 1: Scaffold Vite + React + TypeScript project and tooling

**Files:**
- Create: `package.json` (overwrite), `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `eslint.config.js`, `.prettierrc`, `.nvmrc`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`, `src/smoke.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable Vite app; `npm run dev`, `npm run build`, `npm test`, `npm run lint` all work.

- [ ] **Step 1: Scaffold and install**

Run from repo root (the `.` keeps the existing git repo and data):

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh prettier
npm install zod dompurify
```

> DOMPurify v3 ships its own TypeScript types — do **not** install `@types/dompurify` (that stub is for v2 and conflicts).

If `npm create vite` refuses because the directory isn't empty, scaffold in a temp dir and copy `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/main.tsx` over, then delete the generated `src/App.css`, `src/index.css`, `src/assets`.

- [ ] **Step 2: Write `package.json`** (overwrite the generated one)

```json
{
  "name": "techradar-nerdware",
  "version": "1.0.0",
  "description": "Nerdware Tech Radar",
  "private": true,
  "type": "module",
  "license": "AGPL-3.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "lint": "eslint . && prettier --check .",
    "lint:fix": "eslint . --fix && prettier --write .",
    "quality": "npm run lint && npm run coverage"
  },
  "dependencies": {
    "dompurify": "^3.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {}
}
```

Leave `devDependencies` as installed by Step 1 (do not hand-edit versions; run `npm install` again after writing this file to reconcile).

- [ ] **Step 3: Write `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
```

`base: './'` produces relative asset paths — this is what eliminates the old manual `./`-prepending hack.

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "e2e"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts", "playwright.config.ts", "eslint.config.js"]
}
```

- [ ] **Step 6: Write `eslint.config.js`**

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'data', 'public', 'coverage', 'playwright-report'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: { ...reactHooks.configs.recommended.rules },
  },
)
```

- [ ] **Step 7: Write `.prettierrc`, `.nvmrc`**

`.prettierrc`:
```json
{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```
`.nvmrc`:
```
22
```

- [ ] **Step 8: Update `.gitignore`** — ensure these lines exist:

```
node_modules
dist
coverage
playwright-report
test-results
.env
.env.*
!.env.example
```

- [ ] **Step 9: Write `index.html`** (repo root)

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="./images/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nerdware Tech Radar</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Write `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 11: Write a minimal `src/App.tsx`**

```tsx
export default function App() {
  return <h1>Nerdware Tech Radar</h1>
}
```

- [ ] **Step 12: Write `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 13: Write smoke test `src/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest'

describe('toolchain', () => {
  it('runs typescript and vitest', () => {
    const sum = (a: number, b: number): number => a + b
    expect(sum(2, 3)).toBe(5)
  })
})
```

- [ ] **Step 14: Verify the toolchain**

Run: `npm test`
Expected: 1 passing test.

Run: `npm run build`
Expected: builds to `dist/` with no TS errors.

Run: `npm run lint`
Expected: no errors (Prettier may report formatting — run `npm run lint:fix` then re-run).

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS toolchain

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Data types, slug helper, and radar config

**Files:**
- Create: `src/data/types.ts`, `src/data/slug.ts`, `src/data/slug.test.ts`, `src/config.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `RingId`, `QuadrantId`, `Blip`, `Ring`, `Quadrant`, `Radar`
  - `slug.ts`: `slugify(input: string): string`
  - `config.ts`: `RINGS: Ring[]`, `QUADRANTS: Quadrant[]`, `RADAR_DATA_URL: string`, `RADAR_SIZE: number`

- [ ] **Step 1: Write `src/data/types.ts`**

```ts
export type RingId = 'low' | 'dev' | 'high' | 'out'
export type QuadrantId = 'techniques' | 'platforms' | 'tools' | 'languages-frameworks'

export interface Ring {
  id: RingId
  name: string
  /** 0 = innermost ring */
  order: number
}

export interface Quadrant {
  id: QuadrantId
  name: string
  /** 0..3, maps to a 90° sector */
  order: number
}

export interface Blip {
  id: string
  name: string
  ring: RingId
  quadrant: QuadrantId
  isNew: boolean
  /** sanitized HTML */
  description: string
}

export interface Radar {
  rings: Ring[]
  quadrants: Quadrant[]
  blips: Blip[]
}
```

- [ ] **Step 2: Write failing test `src/data/slug.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('lowercases and trims', () => {
    expect(slugify('  High ')).toBe('high')
  })
  it('collapses non-alphanumerics to single hyphens', () => {
    expect(slugify('languages & frameworks')).toBe('languages-frameworks')
  })
  it('strips leading/trailing hyphens', () => {
    expect(slugify('  Tools!  ')).toBe('tools')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/data/slug.test.ts`
Expected: FAIL — cannot find module `./slug`.

- [ ] **Step 4: Write `src/data/slug.ts`**

```ts
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/slug.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write `src/config.ts`**

> Ring `order` is center→outward. This default places highest competency in the center. Confirm against the current live radar and reorder if needed (see spec §12).

```ts
import type { Ring, Quadrant } from './data/types'

export const RINGS: Ring[] = [
  { id: 'high', name: 'High', order: 0 },
  { id: 'dev', name: 'Developing', order: 1 },
  { id: 'low', name: 'Low', order: 2 },
  { id: 'out', name: 'Out', order: 3 },
]

export const QUADRANTS: Quadrant[] = [
  { id: 'techniques', name: 'Techniques', order: 0 },
  { id: 'platforms', name: 'Platforms', order: 1 },
  { id: 'tools', name: 'Tools', order: 2 },
  { id: 'languages-frameworks', name: 'Languages & Frameworks', order: 3 },
]

export const RADAR_DATA_URL: string =
  import.meta.env.VITE_RADAR_DATA_URL ??
  'https://raw.githubusercontent.com/nerdware-dev/techradar-nerdware/master/data/tech-radar.json'

/** Radius of the outermost ring, in SVG user units. */
export const RADAR_SIZE = 400
```

- [ ] **Step 7: Run full test suite + lint**

Run: `npm test && npm run lint`
Expected: all pass (run `npm run lint:fix` first if Prettier complains).

- [ ] **Step 8: Commit**

```bash
git add src/data/types.ts src/data/slug.ts src/data/slug.test.ts src/config.ts
git commit -m "feat: add radar types, slugify helper, and config

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: zod schema + `parseRadar()` (validation, normalization, sanitization)

**Files:**
- Create: `src/data/schema.ts`, `src/data/schema.test.ts`

**Interfaces:**
- Consumes: `slugify` (Task 2), `RINGS`/`QUADRANTS` (Task 2), `Blip`/`Radar` types.
- Produces: `parseRadar(raw: unknown): Radar` — validates an array of raw entries, normalizes ring/quadrant/isNew, sanitizes description, attaches `RINGS`/`QUADRANTS`. Throws `Error` with a clear message on invalid input.

- [ ] **Step 1: Write failing test `src/data/schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parseRadar } from './schema'

const valid = [
  {
    name: 'Apache Kafka',
    ring: 'High',
    quadrant: 'platforms',
    isNew: 'FALSE',
    description: 'Streaming <a href="https://kafka.apache.org">link</a>',
  },
  { name: 'PHP', ring: 'Out', quadrant: 'languages & frameworks', isNew: 'TRUE', description: 'x' },
]

describe('parseRadar', () => {
  it('normalizes ring and quadrant case-insensitively to ids', () => {
    const radar = parseRadar(valid)
    expect(radar.blips[0].ring).toBe('high')
    expect(radar.blips[1].quadrant).toBe('languages-frameworks')
  })

  it('coerces isNew string to boolean', () => {
    const radar = parseRadar(valid)
    expect(radar.blips[0].isNew).toBe(false)
    expect(radar.blips[1].isNew).toBe(true)
  })

  it('assigns a stable slug id from the name', () => {
    const radar = parseRadar(valid)
    expect(radar.blips[0].id).toBe('apache-kafka')
  })

  it('keeps safe anchor tags but strips dangerous markup', () => {
    const radar = parseRadar([
      { name: 'X', ring: 'high', quadrant: 'tools', isNew: 'FALSE', description: '<a href="https://a.b">k</a><script>alert(1)</script>' },
    ])
    expect(radar.blips[0].description).toContain('<a')
    expect(radar.blips[0].description).not.toContain('<script')
  })

  it('attaches the canonical rings and quadrants', () => {
    const radar = parseRadar(valid)
    expect(radar.rings.map((r) => r.id)).toEqual(['high', 'dev', 'low', 'out'])
    expect(radar.quadrants).toHaveLength(4)
  })

  it('throws a clear error on an unknown ring', () => {
    expect(() =>
      parseRadar([{ name: 'X', ring: 'banana', quadrant: 'tools', isNew: 'FALSE', description: '' }]),
    ).toThrow(/ring/i)
  })

  it('throws when the payload is not an array', () => {
    expect(() => parseRadar({ nope: true })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/schema.test.ts`
Expected: FAIL — cannot find module `./schema`.

- [ ] **Step 3: Write `src/data/schema.ts`**

```ts
import { z } from 'zod'
import DOMPurify from 'dompurify'
import type { Blip, Radar, RingId, QuadrantId } from './types'
import { slugify } from './slug'
import { RINGS, QUADRANTS } from '../config'

const RING_IDS = RINGS.map((r) => r.id) as RingId[]
const QUADRANT_IDS = QUADRANTS.map((q) => q.id) as QuadrantId[]

const TRUTHY = new Set(['true', '1', 'yes'])

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'br', 'p'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

const rawBlipSchema = z.object({
  name: z.string().min(1),
  ring: z.string().min(1),
  quadrant: z.string().min(1),
  isNew: z.union([z.string(), z.boolean()]).optional(),
  description: z.string().optional().default(''),
})

function toBlip(raw: z.infer<typeof rawBlipSchema>, index: number): Blip {
  const ring = slugify(raw.ring)
  if (!RING_IDS.includes(ring as RingId)) {
    throw new Error(`Blip "${raw.name}" (#${index}) has unknown ring "${raw.ring}". Allowed: ${RING_IDS.join(', ')}`)
  }
  const quadrant = slugify(raw.quadrant)
  if (!QUADRANT_IDS.includes(quadrant as QuadrantId)) {
    throw new Error(
      `Blip "${raw.name}" (#${index}) has unknown quadrant "${raw.quadrant}". Allowed: ${QUADRANT_IDS.join(', ')}`,
    )
  }
  const isNew = typeof raw.isNew === 'boolean' ? raw.isNew : TRUTHY.has(String(raw.isNew ?? '').toLowerCase())
  return {
    id: slugify(raw.name),
    name: raw.name,
    ring: ring as RingId,
    quadrant: quadrant as QuadrantId,
    isNew,
    description: sanitize(raw.description ?? ''),
  }
}

export function parseRadar(raw: unknown): Radar {
  const entries = z.array(rawBlipSchema).parse(raw)
  const blips = entries.map(toBlip)
  return { rings: RINGS, quadrants: QUADRANTS, blips }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/schema.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Sanity-check against real data**

Run: `node --input-type=module -e "import('./src/data/schema.ts').catch(()=>{})"` is not viable (TS). Instead add a temporary test that imports the real file:

```ts
// append to src/data/schema.test.ts
import realData from '../../data/tech-radar.json'
it('parses the real tech-radar.json without throwing', () => {
  const radar = parseRadar(realData)
  expect(radar.blips).toHaveLength(45)
})
```

Run: `npx vitest run src/data/schema.test.ts`
Expected: PASS (8 tests). If it throws on a ring/quadrant, the data has a value not in config — reconcile config (Task 2) with the data, do not weaken validation.

- [ ] **Step 6: Commit**

```bash
git add src/data/schema.ts src/data/schema.test.ts
git commit -m "feat: add zod radar schema with normalization and sanitization

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `loadRadar()` — fetch + parse

**Files:**
- Create: `src/data/loadRadar.ts`, `src/data/loadRadar.test.ts`

**Interfaces:**
- Consumes: `parseRadar` (Task 3), `RADAR_DATA_URL` (Task 2).
- Produces: `loadRadar(url?: string): Promise<Radar>` — fetches JSON from `url` (default `RADAR_DATA_URL`), parses it, throws on HTTP or validation error.

- [ ] **Step 1: Write failing test `src/data/loadRadar.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/loadRadar.test.ts`
Expected: FAIL — cannot find module `./loadRadar`.

- [ ] **Step 3: Write `src/data/loadRadar.ts`**

```ts
import type { Radar } from './types'
import { parseRadar } from './schema'
import { RADAR_DATA_URL } from '../config'

export async function loadRadar(url: string = RADAR_DATA_URL): Promise<Radar> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to load radar data from ${url}: HTTP ${res.status}`)
  }
  const json: unknown = await res.json()
  return parseRadar(json)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/loadRadar.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/loadRadar.ts src/data/loadRadar.test.ts
git commit -m "feat: add loadRadar fetch+parse

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Radar geometry (pure)

**Files:**
- Create: `src/radar/geometry.ts`, `src/radar/geometry.test.ts`

**Interfaces:**
- Produces:
  - `ringRadii(ringCount: number, maxRadius: number): { inner: number; outer: number }[]` — area-balanced bands, index 0 = innermost.
  - `polarToCartesian(angleDeg: number, radius: number): { x: number; y: number }` — SVG y-down, origin at center.
  - `quadrantAngles(order: number): { start: number; end: number }` — degrees; `order` 0..3 → consecutive 90° sectors.
  - `annularSectorPath(startDeg: number, endDeg: number, inner: number, outer: number): string` — SVG path `d`.

- [ ] **Step 1: Write failing test `src/radar/geometry.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { ringRadii, polarToCartesian, quadrantAngles, annularSectorPath } from './geometry'

describe('geometry', () => {
  it('produces contiguous, increasing, area-balanced rings ending at maxRadius', () => {
    const r = ringRadii(4, 400)
    expect(r).toHaveLength(4)
    expect(r[0].inner).toBe(0)
    expect(r[3].outer).toBeCloseTo(400)
    // contiguous
    expect(r[1].inner).toBeCloseTo(r[0].outer)
    // increasing
    expect(r[1].outer).toBeGreaterThan(r[0].outer)
    // equal area: each band area ~ pi*max^2/4
    const area = (b: { inner: number; outer: number }) => Math.PI * (b.outer ** 2 - b.inner ** 2)
    expect(area(r[0])).toBeCloseTo(area(r[3]), 5)
  })

  it('maps polar to cartesian with y pointing down', () => {
    expect(polarToCartesian(0, 100)).toEqual({ x: 100, y: 0 })
    const p = polarToCartesian(90, 100)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(100)
  })

  it('splits the circle into 4 consecutive 90° sectors', () => {
    expect(quadrantAngles(0)).toEqual({ start: 0, end: 90 })
    expect(quadrantAngles(3)).toEqual({ start: 270, end: 360 })
  })

  it('builds a closed annular sector path', () => {
    const d = annularSectorPath(0, 90, 100, 200)
    expect(d.startsWith('M')).toBe(true)
    expect(d.trim().endsWith('Z')).toBe(true)
    expect(d).toContain('A')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/radar/geometry.test.ts`
Expected: FAIL — cannot find module `./geometry`.

- [ ] **Step 3: Write `src/radar/geometry.ts`**

```ts
export function ringRadii(ringCount: number, maxRadius: number): { inner: number; outer: number }[] {
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

export function annularSectorPath(startDeg: number, endDeg: number, inner: number, outer: number): string {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/radar/geometry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/radar/geometry.ts src/radar/geometry.test.ts
git commit -m "feat: add pure radar geometry helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Blip placement (deterministic, seeded)

**Files:**
- Create: `src/radar/placement.ts`, `src/radar/placement.test.ts`

**Interfaces:**
- Consumes: `ringRadii`, `quadrantAngles`, `polarToCartesian` (Task 5); `Blip`, `Ring`, `Quadrant` types; `RINGS`/`QUADRANTS`/`RADAR_SIZE`.
- Produces:
  - `interface PlacedBlip { blip: Blip; x: number; y: number; number: number }`
  - `placeBlips(blips: Blip[], rings: Ring[], quadrants: Quadrant[], maxRadius: number): PlacedBlip[]` — deterministic positions seeded by blip name; sequential `number` per quadrant (ordered by ring order then name).

- [ ] **Step 1: Write failing test `src/radar/placement.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { placeBlips } from './placement'
import { RINGS, QUADRANTS } from '../config'
import type { Blip } from '../data/types'

const mk = (name: string, ring: Blip['ring'], quadrant: Blip['quadrant']): Blip => ({
  id: name.toLowerCase(),
  name,
  ring,
  quadrant,
  isNew: false,
  description: '',
})

const blips: Blip[] = [
  mk('Docker', 'high', 'platforms'),
  mk('AWS', 'high', 'platforms'),
  mk('Kafka', 'dev', 'platforms'),
  mk('Go', 'low', 'languages-frameworks'),
]

describe('placeBlips', () => {
  it('is deterministic for the same input', () => {
    const a = placeBlips(blips, RINGS, QUADRANTS, 400)
    const b = placeBlips(blips, RINGS, QUADRANTS, 400)
    expect(a).toEqual(b)
  })

  it('places every blip within its ring band radius', () => {
    const placed = placeBlips(blips, RINGS, QUADRANTS, 400)
    for (const p of placed) {
      const r = Math.hypot(p.x, p.y)
      expect(r).toBeGreaterThan(0)
      expect(r).toBeLessThanOrEqual(400)
    }
  })

  it('numbers blips sequentially within each quadrant starting at 1', () => {
    const placed = placeBlips(blips, RINGS, QUADRANTS, 400)
    const platforms = placed.filter((p) => p.blip.quadrant === 'platforms').map((p) => p.number).sort()
    expect(platforms).toEqual([1, 2, 3])
    const langs = placed.filter((p) => p.blip.quadrant === 'languages-frameworks')
    expect(langs[0].number).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/radar/placement.test.ts`
Expected: FAIL — cannot find module `./placement`.

- [ ] **Step 3: Write `src/radar/placement.ts`**

```ts
import type { Blip, Ring, Quadrant } from '../data/types'
import { ringRadii, quadrantAngles, polarToCartesian } from './geometry'

export interface PlacedBlip {
  blip: Blip
  x: number
  y: number
  number: number
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PAD = 0.12 // fraction of band/sector kept clear of edges

export function placeBlips(
  blips: Blip[],
  rings: Ring[],
  quadrants: Quadrant[],
  maxRadius: number,
): PlacedBlip[] {
  const bands = ringRadii(rings.length, maxRadius)
  const ringOrder = new Map(rings.map((r) => [r.id, r.order]))
  const result: PlacedBlip[] = []

  for (const q of quadrants) {
    const { start, end } = quadrantAngles(q.order)
    const angleSpan = end - start
    const inQuadrant = blips
      .filter((b) => b.quadrant === q.id)
      .sort((a, b) => (ringOrder.get(a.ring)! - ringOrder.get(b.ring)!) || a.name.localeCompare(b.name))

    inQuadrant.forEach((blip, i) => {
      const band = bands[ringOrder.get(blip.ring)!]
      const rng = mulberry32(hashString(blip.name))
      const angle = start + angleSpan * (PAD + rng() * (1 - 2 * PAD))
      const radius = band.inner + (band.outer - band.inner) * (PAD + rng() * (1 - 2 * PAD))
      const { x, y } = polarToCartesian(angle, radius)
      result.push({ blip, x, y, number: i + 1 })
    })
  }

  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/radar/placement.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/radar/placement.ts src/radar/placement.test.ts
git commit -m "feat: add deterministic seeded blip placement

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: App state store (reducer + context)

**Files:**
- Create: `src/state/radarStore.tsx`, `src/state/radarStore.test.tsx`

**Interfaces:**
- Produces:
  - `interface RadarState { focusedQuadrant: QuadrantId | null; hoveredBlipId: string | null; selectedBlipId: string | null; search: string }`
  - `radarReducer(state, action)` with actions: `{type:'FOCUS_QUADRANT', id}`, `{type:'CLEAR_FOCUS'}`, `{type:'HOVER_BLIP', id|null}`, `{type:'SELECT_BLIP', id|null}`, `{type:'SET_SEARCH', value}`
  - `<RadarStoreProvider>` and hooks `useRadarState()`, `useRadarDispatch()`

- [ ] **Step 1: Write failing test `src/state/radarStore.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { radarReducer, initialState } from './radarStore'

describe('radarReducer', () => {
  it('focuses and clears a quadrant', () => {
    const focused = radarReducer(initialState, { type: 'FOCUS_QUADRANT', id: 'tools' })
    expect(focused.focusedQuadrant).toBe('tools')
    expect(radarReducer(focused, { type: 'CLEAR_FOCUS' }).focusedQuadrant).toBeNull()
  })

  it('selecting a blip also focuses its quadrant when provided', () => {
    const s = radarReducer(initialState, { type: 'SELECT_BLIP', id: 'docker', quadrant: 'platforms' })
    expect(s.selectedBlipId).toBe('docker')
    expect(s.focusedQuadrant).toBe('platforms')
  })

  it('sets hover and search independently', () => {
    expect(radarReducer(initialState, { type: 'HOVER_BLIP', id: 'aws' }).hoveredBlipId).toBe('aws')
    expect(radarReducer(initialState, { type: 'SET_SEARCH', value: 'kaf' }).search).toBe('kaf')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/radarStore.test.tsx`
Expected: FAIL — cannot find module `./radarStore`.

- [ ] **Step 3: Write `src/state/radarStore.tsx`**

```tsx
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import type { QuadrantId } from '../data/types'

export interface RadarState {
  focusedQuadrant: QuadrantId | null
  hoveredBlipId: string | null
  selectedBlipId: string | null
  search: string
}

export type RadarAction =
  | { type: 'FOCUS_QUADRANT'; id: QuadrantId }
  | { type: 'CLEAR_FOCUS' }
  | { type: 'HOVER_BLIP'; id: string | null }
  | { type: 'SELECT_BLIP'; id: string | null; quadrant?: QuadrantId }
  | { type: 'SET_SEARCH'; value: string }

export const initialState: RadarState = {
  focusedQuadrant: null,
  hoveredBlipId: null,
  selectedBlipId: null,
  search: '',
}

export function radarReducer(state: RadarState, action: RadarAction): RadarState {
  switch (action.type) {
    case 'FOCUS_QUADRANT':
      return { ...state, focusedQuadrant: action.id }
    case 'CLEAR_FOCUS':
      return { ...state, focusedQuadrant: null, selectedBlipId: null }
    case 'HOVER_BLIP':
      return { ...state, hoveredBlipId: action.id }
    case 'SELECT_BLIP':
      return {
        ...state,
        selectedBlipId: action.id,
        focusedQuadrant: action.quadrant ?? state.focusedQuadrant,
      }
    case 'SET_SEARCH':
      return { ...state, search: action.value }
    default:
      return state
  }
}

const StateContext = createContext<RadarState | null>(null)
const DispatchContext = createContext<Dispatch<RadarAction> | null>(null)

export function RadarStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(radarReducer, initialState)
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  )
}

export function useRadarState(): RadarState {
  const ctx = useContext(StateContext)
  if (!ctx) throw new Error('useRadarState must be used within RadarStoreProvider')
  return ctx
}

export function useRadarDispatch(): Dispatch<RadarAction> {
  const ctx = useContext(DispatchContext)
  if (!ctx) throw new Error('useRadarDispatch must be used within RadarStoreProvider')
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/radarStore.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/radarStore.tsx src/state/radarStore.test.tsx
git commit -m "feat: add radar state store

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `Blip` component

**Files:**
- Create: `src/components/Blip.tsx`, `src/components/Blip.test.tsx`, `src/styles/blip.module.scss`

**Interfaces:**
- Consumes: `PlacedBlip` (Task 6), store hooks (Task 7).
- Produces: `<Blip placed={PlacedBlip} />` — an SVG `<g>` at the blip's position: a circle, the blip number, and (if `isNew`) an outer ring. Dispatches `HOVER_BLIP` on mouse enter/leave and `SELECT_BLIP` on click. Highlights when hovered or selected.

- [ ] **Step 1: Write failing test `src/components/Blip.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Blip } from './Blip'
import { RadarStoreProvider } from '../state/radarStore'
import type { PlacedBlip } from '../radar/placement'

const placed: PlacedBlip = {
  blip: { id: 'docker', name: 'Docker', ring: 'high', quadrant: 'platforms', isNew: true, description: 'd' },
  x: 10,
  y: 20,
  number: 3,
}

function renderBlip(p: PlacedBlip = placed) {
  return render(
    <svg>
      <RadarStoreProvider>
        <Blip placed={p} />
      </RadarStoreProvider>
    </svg>,
  )
}

describe('Blip', () => {
  it('renders the blip number', () => {
    renderBlip()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('exposes the blip name as an accessible label', () => {
    renderBlip()
    expect(screen.getByLabelText('Docker')).toBeInTheDocument()
  })

  it('renders an isNew marker when the blip is new', () => {
    const { container } = renderBlip()
    expect(container.querySelector('[data-isnew="true"]')).toBeTruthy()
  })

  it('does not throw on click (selection dispatch)', () => {
    renderBlip()
    fireEvent.click(screen.getByLabelText('Docker'))
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Blip.test.tsx`
Expected: FAIL — cannot find module `./Blip`.

- [ ] **Step 3: Write `src/styles/blip.module.scss`**

```scss
.group {
  cursor: pointer;
}
.circle {
  fill: var(--blip-fill, #b9027f);
  transition: fill 0.15s ease;
}
.group:hover .circle,
.selected .circle {
  fill: var(--blip-fill-active, #000);
}
.number {
  fill: #fff;
  font-size: 11px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
  user-select: none;
}
.newRing {
  fill: none;
  stroke: var(--blip-fill, #b9027f);
  stroke-width: 1.5;
}
```

- [ ] **Step 4: Write `src/components/Blip.tsx`**

```tsx
import type { PlacedBlip } from '../radar/placement'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import styles from '../styles/blip.module.scss'

const RADIUS = 10

export function Blip({ placed }: { placed: PlacedBlip }) {
  const { blip, x, y, number } = placed
  const state = useRadarState()
  const dispatch = useRadarDispatch()
  const selected = state.selectedBlipId === blip.id || state.hoveredBlipId === blip.id

  return (
    <g
      className={`${styles.group} ${selected ? styles.selected : ''}`}
      transform={`translate(${x} ${y})`}
      role="button"
      aria-label={blip.name}
      tabIndex={0}
      onMouseEnter={() => dispatch({ type: 'HOVER_BLIP', id: blip.id })}
      onMouseLeave={() => dispatch({ type: 'HOVER_BLIP', id: null })}
      onClick={() => dispatch({ type: 'SELECT_BLIP', id: blip.id, quadrant: blip.quadrant })}
    >
      {blip.isNew && <circle data-isnew="true" className={styles.newRing} r={RADIUS + 3} />}
      <circle className={styles.circle} r={RADIUS} />
      <text className={styles.number}>{number}</text>
    </g>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/Blip.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/Blip.tsx src/components/Blip.test.tsx src/styles/blip.module.scss
git commit -m "feat: add Blip component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `Radar` component (rings, axes, sectors, blips)

**Files:**
- Create: `src/components/Radar.tsx`, `src/components/Radar.test.tsx`, `src/styles/radar.module.scss`

**Interfaces:**
- Consumes: `Radar` type, `placeBlips`/`PlacedBlip` (Task 6), `ringRadii`/`quadrantAngles`/`annularSectorPath` (Task 5), `RADAR_SIZE` (config), `<Blip>` (Task 8), store (Task 7).
- Produces: `<RadarView radar={Radar} />` — an `<svg>` with viewBox centered at origin; renders ring circles, two axis lines, and all blips via `<Blip>`. When `focusedQuadrant` is set, dims the other quadrants (renders their sectors with a faded overlay).

- [ ] **Step 1: Write failing test `src/components/Radar.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RadarView } from './Radar'
import { RadarStoreProvider } from '../state/radarStore'
import { parseRadar } from '../data/schema'

const radar = parseRadar([
  { name: 'Docker', ring: 'High', quadrant: 'platforms', isNew: 'FALSE', description: 'd' },
  { name: 'AWS', ring: 'Low', quadrant: 'platforms', isNew: 'TRUE', description: 'a' },
  { name: 'Go', ring: 'Dev', quadrant: 'languages & frameworks', isNew: 'FALSE', description: 'g' },
])

describe('RadarView', () => {
  it('renders an svg with one circle per ring', () => {
    const { container } = render(
      <RadarStoreProvider>
        <RadarView radar={radar} />
      </RadarStoreProvider>,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(container.querySelectorAll('[data-ring-circle]')).toHaveLength(4)
  })

  it('renders one blip group per blip', () => {
    const { container } = render(
      <RadarStoreProvider>
        <RadarView radar={radar} />
      </RadarStoreProvider>,
    )
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Radar.test.tsx`
Expected: FAIL — cannot find module `./Radar`.

- [ ] **Step 3: Write `src/styles/radar.module.scss`**

```scss
.svg {
  width: 100%;
  height: auto;
  max-width: 900px;
  display: block;
  margin: 0 auto;
}
.ring {
  fill: none;
  stroke: #d8d8d8;
  stroke-width: 1;
}
.axis {
  stroke: #d8d8d8;
  stroke-width: 1;
}
.dim {
  fill: #ffffff;
  opacity: 0.6;
  pointer-events: none;
}
.ringLabel {
  fill: #9b9b9b;
  font-size: 11px;
  text-anchor: middle;
  pointer-events: none;
}
```

- [ ] **Step 4: Write `src/components/Radar.tsx`**

```tsx
import { useMemo } from 'react'
import type { Radar } from '../data/types'
import { RADAR_SIZE } from '../config'
import { ringRadii, quadrantAngles, annularSectorPath } from '../radar/geometry'
import { placeBlips } from '../radar/placement'
import { Blip } from './Blip'
import { useRadarState } from '../state/radarStore'
import styles from '../styles/radar.module.scss'

export function RadarView({ radar }: { radar: Radar }) {
  const { focusedQuadrant } = useRadarState()
  const max = RADAR_SIZE
  const bands = useMemo(() => ringRadii(radar.rings.length, max), [radar.rings.length, max])
  const placed = useMemo(
    () => placeBlips(radar.blips, radar.rings, radar.quadrants, max),
    [radar, max],
  )
  const pad = 20
  const view = max + pad

  return (
    <svg
      className={styles.svg}
      viewBox={`${-view} ${-view} ${2 * view} ${2 * view}`}
      role="img"
      aria-label="Tech Radar"
    >
      {bands.map((b, i) => (
        <circle key={i} data-ring-circle r={b.outer} cx={0} cy={0} className={styles.ring} />
      ))}
      <line className={styles.axis} x1={-max} y1={0} x2={max} y2={0} />
      <line className={styles.axis} x1={0} y1={-max} x2={0} y2={max} />

      {placed.map((p) => (
        <Blip key={p.blip.id} placed={p} />
      ))}

      {focusedQuadrant &&
        radar.quadrants
          .filter((q) => q.id !== focusedQuadrant)
          .map((q) => {
            const { start, end } = quadrantAngles(q.order)
            return (
              <path key={q.id} className={styles.dim} d={annularSectorPath(start, end, 0, max)} />
            )
          })}
    </svg>
  )
}
```

> Note: the dim overlay is drawn last so it visually fades non-focused quadrants without removing their blips from the DOM (keeps tests and search highlighting simple).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/Radar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/Radar.tsx src/components/Radar.test.tsx src/styles/radar.module.scss
git commit -m "feat: add RadarView SVG component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `QuadrantTable` component

**Files:**
- Create: `src/components/QuadrantTable.tsx`, `src/components/QuadrantTable.test.tsx`, `src/styles/quadrantTable.module.scss`

**Interfaces:**
- Consumes: `Radar` type, `placeBlips`/`PlacedBlip` (Task 6), store (Task 7), `RADAR_SIZE`.
- Produces: `<QuadrantTable radar={Radar} />` — renders, for the `focusedQuadrant`, the quadrant name and its blips grouped by ring (in ring order), each row showing the blip number + name. Clicking a row dispatches `SELECT_BLIP`. Renders nothing when no quadrant is focused.

- [ ] **Step 1: Write failing test `src/components/QuadrantTable.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuadrantTable } from './QuadrantTable'
import { RadarStoreProvider, radarReducer, initialState } from '../state/radarStore'
import { parseRadar } from '../data/schema'

const radar = parseRadar([
  { name: 'Docker', ring: 'High', quadrant: 'platforms', isNew: 'FALSE', description: 'd' },
  { name: 'AWS', ring: 'Low', quadrant: 'platforms', isNew: 'FALSE', description: 'a' },
  { name: 'Go', ring: 'Dev', quadrant: 'tools', isNew: 'FALSE', description: 'g' },
])

// Provider seeded with a focused quadrant for the test
function Seeded({ children }: { children: React.ReactNode }) {
  return <RadarStoreProvider>{children}</RadarStoreProvider>
}

describe('QuadrantTable', () => {
  it('renders nothing when no quadrant is focused', () => {
    const { container } = render(
      <Seeded>
        <QuadrantTable radar={radar} />
      </Seeded>,
    )
    expect(container.querySelector('[data-quadrant-table]')).toBeNull()
  })

  it('reducer focuses platforms and the table would list its blips', () => {
    // unit check on selection logic that the table relies on
    const s = radarReducer(initialState, { type: 'FOCUS_QUADRANT', id: 'platforms' })
    expect(s.focusedQuadrant).toBe('platforms')
  })
})
```

> The table reads `focusedQuadrant` from context; to test rendered rows, Task 13's integration test exercises the full flow (click quadrant → table appears). Here we verify the empty state and the selection reducer the table depends on.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/QuadrantTable.test.tsx`
Expected: FAIL — cannot find module `./QuadrantTable`.

- [ ] **Step 3: Write `src/styles/quadrantTable.module.scss`**

```scss
.table {
  font-family: inherit;
}
.ringHeading {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  margin: 0.75rem 0 0.25rem;
}
.row {
  display: flex;
  gap: 0.5rem;
  padding: 0.15rem 0;
  cursor: pointer;
  background: none;
  border: none;
  text-align: left;
  width: 100%;
}
.row:hover,
.rowSelected {
  color: #b9027f;
}
.num {
  font-weight: 700;
  min-width: 1.5rem;
}
```

- [ ] **Step 4: Write `src/components/QuadrantTable.tsx`**

```tsx
import type { Radar } from '../data/types'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import styles from '../styles/quadrantTable.module.scss'
import { placeBlips } from '../radar/placement'
import { RADAR_SIZE } from '../config'

export function QuadrantTable({ radar }: { radar: Radar }) {
  const { focusedQuadrant, selectedBlipId } = useRadarState()
  const dispatch = useRadarDispatch()
  if (!focusedQuadrant) return null

  const quadrant = radar.quadrants.find((q) => q.id === focusedQuadrant)!
  const numbers = new Map(placeBlips(radar.blips, radar.rings, radar.quadrants, RADAR_SIZE).map((p) => [p.blip.id, p.number]))
  const rings = [...radar.rings].sort((a, b) => a.order - b.order)

  return (
    <div data-quadrant-table className={styles.table}>
      <h2>{quadrant.name}</h2>
      {rings.map((ring) => {
        const blips = radar.blips
          .filter((b) => b.quadrant === quadrant.id && b.ring === ring.id)
          .sort((a, b) => a.name.localeCompare(b.name))
        if (blips.length === 0) return null
        return (
          <div key={ring.id}>
            <p className={styles.ringHeading}>{ring.name}</p>
            {blips.map((b) => (
              <button
                key={b.id}
                className={`${styles.row} ${selectedBlipId === b.id ? styles.rowSelected : ''}`}
                onMouseEnter={() => dispatch({ type: 'HOVER_BLIP', id: b.id })}
                onMouseLeave={() => dispatch({ type: 'HOVER_BLIP', id: null })}
                onClick={() => dispatch({ type: 'SELECT_BLIP', id: b.id, quadrant: b.quadrant })}
              >
                <span className={styles.num}>{numbers.get(b.id)}</span>
                <span>{b.name}</span>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/QuadrantTable.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/QuadrantTable.tsx src/components/QuadrantTable.test.tsx src/styles/quadrantTable.module.scss
git commit -m "feat: add QuadrantTable component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: `Search` component (filter + select)

**Files:**
- Create: `src/components/Search.tsx`, `src/components/Search.test.tsx`, `src/styles/search.module.scss`

**Interfaces:**
- Consumes: `Radar` type, store (Task 7).
- Produces: `<Search radar={Radar} />` — a text input bound to `state.search`; shows matching blip names (case-insensitive substring, max 8). Clicking a suggestion dispatches `SELECT_BLIP` (with quadrant) and clears the query.

- [ ] **Step 1: Write failing test `src/components/Search.test.tsx`**

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Search.test.tsx`
Expected: FAIL — cannot find module `./Search`.

- [ ] **Step 3: Write `src/styles/search.module.scss`**

```scss
.wrap {
  position: relative;
  max-width: 320px;
}
.input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 14px;
  border: 1px solid #c8c8c8;
  border-radius: 4px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  position: absolute;
  width: 100%;
  background: #fff;
  border: 1px solid #e0e0e0;
  z-index: 10;
}
.option {
  padding: 0.4rem 0.75rem;
  cursor: pointer;
}
.option:hover {
  background: #f3f3f3;
}
```

- [ ] **Step 4: Write `src/components/Search.tsx`**

```tsx
import type { Radar } from '../data/types'
import { useRadarState, useRadarDispatch } from '../state/radarStore'
import styles from '../styles/search.module.scss'

const MAX_SUGGESTIONS = 8

export function Search({ radar }: { radar: Radar }) {
  const { search } = useRadarState()
  const dispatch = useRadarDispatch()
  const q = search.trim().toLowerCase()
  const matches = q
    ? radar.blips.filter((b) => b.name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS)
    : []

  return (
    <div className={styles.wrap}>
      <input
        className={styles.input}
        type="search"
        role="searchbox"
        placeholder="Suche…"
        value={search}
        onChange={(e) => dispatch({ type: 'SET_SEARCH', value: e.target.value })}
      />
      {matches.length > 0 && (
        <ul className={styles.list}>
          {matches.map((b) => (
            <li
              key={b.id}
              role="option"
              aria-selected={false}
              className={styles.option}
              onClick={() => {
                dispatch({ type: 'SELECT_BLIP', id: b.id, quadrant: b.quadrant })
                dispatch({ type: 'SET_SEARCH', value: '' })
              }}
            >
              {b.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/Search.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/Search.tsx src/components/Search.test.tsx src/styles/search.module.scss
git commit -m "feat: add Search component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: `Tooltip`, `Legend`, and `Header`

**Files:**
- Create: `src/components/Tooltip.tsx`, `src/components/Tooltip.test.tsx`, `src/components/Legend.tsx`, `src/components/Header.tsx`, `src/styles/chrome.module.scss`

**Interfaces:**
- Consumes: `Radar` type, store (Task 7).
- Produces:
  - `<Tooltip radar={Radar} />` — shows the hovered (or selected) blip's name + sanitized description HTML; hidden when none.
  - `<Legend radar={Radar} />` — lists rings (in order) with their names.
  - `<Header />` — Nerdware banner/logo + title.

- [ ] **Step 1: Write failing test `src/components/Tooltip.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip } from './Tooltip'
import { Legend } from './Legend'
import { RadarStoreProvider } from '../state/radarStore'
import { parseRadar } from '../data/schema'

const radar = parseRadar([
  { name: 'Docker', ring: 'High', quadrant: 'platforms', isNew: 'FALSE', description: 'Container <a href="https://x.y">docs</a>' },
])

describe('Tooltip', () => {
  it('renders nothing when no blip is active', () => {
    const { container } = render(
      <RadarStoreProvider>
        <Tooltip radar={radar} />
      </RadarStoreProvider>,
    )
    expect(container.querySelector('[data-tooltip]')).toBeNull()
  })
})

describe('Legend', () => {
  it('lists all ring names in order', () => {
    render(
      <RadarStoreProvider>
        <Legend radar={radar} />
      </RadarStoreProvider>,
    )
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Out')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Tooltip.test.tsx`
Expected: FAIL — cannot find module `./Tooltip`.

- [ ] **Step 3: Write `src/styles/chrome.module.scss`**

```scss
.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: #000;
  color: #fff;
}
.logo {
  height: 40px;
}
.tooltip {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  background: #fff;
}
.tooltip h3 {
  margin: 0 0 0.4rem;
}
.legend {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 13px;
}
.legendItem {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}
.swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #b9027f;
}
```

- [ ] **Step 4: Write `src/components/Tooltip.tsx`**

```tsx
import type { Radar } from '../data/types'
import { useRadarState } from '../state/radarStore'
import styles from '../styles/chrome.module.scss'

export function Tooltip({ radar }: { radar: Radar }) {
  const { hoveredBlipId, selectedBlipId } = useRadarState()
  const id = hoveredBlipId ?? selectedBlipId
  const blip = id ? radar.blips.find((b) => b.id === id) : undefined
  if (!blip) return null
  return (
    <aside data-tooltip className={styles.tooltip}>
      <h3>{blip.name}</h3>
      {/* description was sanitized in schema.ts via DOMPurify */}
      <div dangerouslySetInnerHTML={{ __html: blip.description }} />
    </aside>
  )
}
```

- [ ] **Step 5: Write `src/components/Legend.tsx`**

```tsx
import type { Radar } from '../data/types'
import styles from '../styles/chrome.module.scss'

export function Legend({ radar }: { radar: Radar }) {
  const rings = [...radar.rings].sort((a, b) => a.order - b.order)
  return (
    <div className={styles.legend}>
      {rings.map((r) => (
        <span key={r.id} className={styles.legendItem}>
          <span className={styles.swatch} />
          {r.name}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Write `src/components/Header.tsx`**

```tsx
import styles from '../styles/chrome.module.scss'

export function Header() {
  return (
    <header className={styles.header}>
      <img className={styles.logo} src="./images/logo-nw-neu.png" alt="Nerdware" />
      <h1>Tech Radar</h1>
    </header>
  )
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/components/Tooltip.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add src/components/Tooltip.tsx src/components/Tooltip.test.tsx src/components/Legend.tsx src/components/Header.tsx src/styles/chrome.module.scss
git commit -m "feat: add Tooltip, Legend, and Header components

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: App integration (data loading, layout, styling) + integration test

**Files:**
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`, `src/styles/tokens.scss`, `src/styles/app.module.scss`
- Move: `src/images/*` → `public/images/` (copy the assets the app references: `logo-nw-neu.png`, `favicon.ico`, banner images)

**Interfaces:**
- Consumes: `loadRadar` (Task 4), all components (Tasks 8–12), `RadarStoreProvider` (Task 7), `useRadarDispatch`.
- Produces: a working app that loads the radar, shows loading/error states, and renders Header + Search + RadarView + QuadrantTable + Tooltip + Legend. Clicking a quadrant focuses it and shows the table.

- [ ] **Step 1: Move image assets**

```bash
mkdir -p public/images
cp src/images/logo-nw-neu.png src/images/favicon.ico public/images/ 2>/dev/null || true
cp src/images/banner-image-desktop.jpg src/images/banner-image-mobile.jpg public/images/ 2>/dev/null || true
```
If `logo-nw-neu.png` is absent, use `logo-nw.png` and update `Header.tsx` accordingly.

- [ ] **Step 2: Write `src/styles/tokens.scss`** (port the brand colors/fonts from old `src/stylesheets/_colors.scss` and `_fonts.scss`)

```scss
:root {
  --nw-magenta: #b9027f;
  --blip-fill: #b9027f;
  --blip-fill-active: #000000;
  --bg: #ffffff;
  --text: #1a1a1a;
}
body {
  margin: 0;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  color: var(--text);
  background: var(--bg);
}
```
> Open the old `src/stylesheets/_colors.scss` and copy the real hex values for the Nerdware magenta and any secondary brand colors, replacing the placeholders above.

- [ ] **Step 3: Write `src/styles/app.module.scss`**

```scss
.layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 1.5rem;
  padding: 1.5rem;
  align-items: start;
}
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.status {
  padding: 2rem;
  text-align: center;
}
@media (max-width: 800px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Write `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import './styles/tokens.scss'
import styles from './styles/app.module.scss'
import type { Radar } from './data/types'
import { loadRadar } from './data/loadRadar'
import { RadarStoreProvider } from './state/radarStore'
import { Header } from './components/Header'
import { Search } from './components/Search'
import { RadarView } from './components/Radar'
import { QuadrantTable } from './components/QuadrantTable'
import { Tooltip } from './components/Tooltip'
import { Legend } from './components/Legend'

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; radar: Radar }

export default function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    loadRadar()
      .then((radar) => alive && setLoad({ status: 'ready', radar }))
      .catch((e: unknown) => alive && setLoad({ status: 'error', message: String(e) }))
    return () => {
      alive = false
    }
  }, [])

  return (
    <RadarStoreProvider>
      <Header />
      {load.status === 'loading' && <p className={styles.status}>Lade Tech Radar…</p>}
      {load.status === 'error' && (
        <p className={styles.status} role="alert">
          Fehler beim Laden: {load.message}
        </p>
      )}
      {load.status === 'ready' && (
        <main className={styles.layout}>
          <RadarView radar={load.radar} />
          <div className={styles.sidebar}>
            <Search radar={load.radar} />
            <Legend radar={load.radar} />
            <Tooltip radar={load.radar} />
            <QuadrantTable radar={load.radar} />
          </div>
        </main>
      )}
    </RadarStoreProvider>
  )
}
```

- [ ] **Step 5: Write integration test `src/App.test.tsx`**

```tsx
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) }))
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
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests across all files PASS.

- [ ] **Step 7: Manually verify in the browser**

Run: `npm run dev`, open the printed URL.
Confirm: radar renders with 4 rings + axes + 45 blips; hovering a blip shows the tooltip; clicking a quadrant's blips focuses it and shows the table; search filters and selecting jumps to the blip.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/styles/tokens.scss src/styles/app.module.scss public/images
git commit -m "feat: wire up App with data loading and layout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Playwright e2e smoke test

**Files:**
- Create: `playwright.config.ts`, `e2e/radar.spec.ts`
- Modify: `package.json` (Playwright already has a `test:e2e` script from Task 1)

**Interfaces:**
- Consumes: the running app (`npm run dev` / `vite preview`).
- Produces: a Playwright smoke test that loads the app and asserts the radar and interactions work end-to-end.

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 3: Write `e2e/radar.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test('radar loads and a quadrant can be focused', async ({ page }) => {
  await page.goto('/')
  // the SVG radar renders
  await expect(page.getByRole('img', { name: 'Tech Radar' })).toBeVisible()
  // at least one blip exists
  const firstBlip = page.getByRole('button').first()
  await expect(firstBlip).toBeVisible()
  await firstBlip.click()
  // a quadrant heading (table) appears
  await expect(page.locator('[data-quadrant-table]')).toBeVisible()
})

test('search filters blips', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox').fill('a')
  await expect(page.getByRole('option').first()).toBeVisible()
})
```

> This test hits the live data URL via `loadRadar`. If CI has no network egress, set `VITE_RADAR_DATA_URL` to a local fixture served from `public/` (e.g. copy `data/tech-radar.json` to `public/tech-radar.json` and point the env var at `/tech-radar.json`) in the Playwright `webServer` env.

- [ ] **Step 4: Run the e2e test**

Run: `npm run test:e2e`
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/radar.spec.ts package.json package-lock.json
git commit -m "test: add Playwright e2e smoke tests

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Dockerfile + nginx (multi-stage)

**Files:**
- Create: `Dockerfile` (overwrite), `nginx.conf`, `.dockerignore` (overwrite)

**Interfaces:**
- Consumes: `npm run build` → `dist/`.
- Produces: a Docker image that serves the static build via nginx on port 80.

- [ ] **Step 1: Write `Dockerfile`** (overwrite the old one)

```dockerfile
# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- serve stage ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 2: Write `nginx.conf`**

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  # long-cache hashed assets
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
}
```

- [ ] **Step 3: Write `.dockerignore`** (overwrite)

```
node_modules
dist
coverage
playwright-report
test-results
.git
.github
e2e
*.md
```

- [ ] **Step 4: Build and verify the image**

```bash
docker build -t techradar-nerdware:dev .
docker run --rm -d -p 8080:80 --name techradar-test techradar-nerdware:dev
sleep 2
curl -sf http://localhost:8080/ | grep -q "<div id=\"root\"></div>" && echo "OK: index served"
docker rm -f techradar-test
```
Expected: `OK: index served`.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile nginx.conf .dockerignore
git commit -m "chore: multi-stage Docker build serving static bundle via nginx

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm ci`, `npm run lint`, `npm run coverage`, `npm run build`, the Dockerfile.
- Produces: a workflow that on push/PR runs lint + unit tests + build, and on push to `master` builds and pushes the Docker image to GHCR.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master, modernization-react-vite]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run coverage
      - run: npm run build

  docker:
    needs: test
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

> If Nerdware pushes images to a registry other than GHCR (the old `docker_push.sh` referenced a registry), replace the login/registry/tags accordingly and add the credentials as repo secrets.

- [ ] **Step 2: Validate the workflow YAML locally**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid yaml')"`
Expected: `valid yaml`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions build/test/image workflow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Remove legacy code and rewrite the README

**Files:**
- Delete: legacy build/test/source files (listed below)
- Modify: `ReadMe.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a repo with no dead legacy code; `npm test`, `npm run build`, `npm run lint` all still pass.

- [ ] **Step 1: Delete legacy files**

```bash
git rm -r --ignore-unmatch \
  webpack.common.js webpack.dev.js webpack.dev-old-ui.js webpack.prod.js \
  .eslintrc.json .eslintignore jest.config.js cypress.config.js \
  src/common.js src/site.js src/gtm.js src/config.js \
  src/graphing src/util src/models src/exceptions src/stylesheets src/images \
  src/index.html src/error.html \
  spec .circleci build_and_start_nginx.sh default.template run_e2e_tests.sh docker_push.sh
git rm -r --ignore-unmatch docs/*.js docs/*.css docs/*.map docs/index.html docs/error.html docs/images
```
> Keep `docs/superpowers/` (specs + this plan). Keep `data/`, `LICENSE.md`, `CONTRIBUTORS.md`, `.devcontainer`, `.vscode`, `.editorconfig`.

- [ ] **Step 2: Remove now-unused dependencies** (if any survived the scaffold reset)

```bash
npm pkg delete dependencies.jquery dependencies.jquery-ui dependencies.d3 dependencies.d3-tip dependencies.lodash dependencies.chance dependencies.sanitize-html 2>/dev/null || true
npm install
```
Expected: `package.json` lists only React, react-dom, zod, dompurify (+ dev deps). No webpack/babel/jquery/d3.

- [ ] **Step 3: Rewrite `ReadMe.md`**

Replace the whole file with content covering:
- What the radar is and the Notion link (keep the existing Notion URL from the old README).
- **Editing content:** edit `data/tech-radar.json`; document the entry shape and the valid `ring` (Low/Dev/High/Out) and `quadrant` (techniques/platforms/tools/languages & frameworks) values; note values are now case-insensitive and validated, so a typo shows a clear error instead of a blank radar. Remove the entire obsolete "manually add `./` to paths" section.
- **Local dev:** `nvm use`, `npm install`, `npm run dev`.
- **Testing:** `npm test`, `npm run test:e2e`, `npm run lint`.
- **Build & deploy:** `npm run build` → `dist/`; `docker build` / `docker run`; CI auto-builds the image on push to `master`.
- **Config:** `VITE_RADAR_DATA_URL` to point at a different data source.

```bash
# after writing ReadMe.md
git add ReadMe.md
```

- [ ] **Step 4: Verify nothing broke**

Run: `npm run lint && npm test && npm run build`
Expected: all pass; build produces `dist/`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove legacy webpack/jQuery/D3 stack and rewrite README

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (each spec section → task):
- §4 drop unused features → Task 17 (delete `src/util` Sheets/CSV/factory, `src/graphing`) ✓
- §5 architecture / file tree → Tasks 2–13 build exactly that tree ✓
- §6 radar without D3 → Tasks 5 (geometry) + 6 (placement) + 8/9 (SVG components) ✓
- §7 data & validation (configurable URL, zod, case-insensitive, isNew bool, DOMPurify, clear errors) → Tasks 2/3/4 ✓
- §8 SCSS modules + brand tokens → Tasks 8–13 (`*.module.scss` + `tokens.scss`) ✓
- §9 Vite build / Vitest+RTL / Playwright / ESLint 9 / Dockerfile+nginx / GitHub Actions → Tasks 1, 14, 15, 16 ✓
- §10 Node 22, package.json reset, AGPL → Task 1 + global constraints ✓
- §11 deleted vs created → Tasks 1 (created) + 17 (deleted) ✓

**Placeholder scan:** No "TBD"/"implement later". The two judgement calls — exact brand hex values (Task 13 Step 2) and the registry choice (Task 16) — point at concrete source files / the old `docker_push.sh` to copy from, not vague instructions.

**Type consistency:** `Blip`/`Ring`/`Quadrant`/`Radar` (Task 2) are consumed unchanged by schema (3), placement (6), and all components. `PlacedBlip` (Task 6) is consumed by `Blip`/`Radar`/`QuadrantTable`. Store actions (`FOCUS_QUADRANT`/`CLEAR_FOCUS`/`HOVER_BLIP`/`SELECT_BLIP`/`SET_SEARCH`) are used with matching payloads in every component. `parseRadar`/`loadRadar`/`placeBlips`/`radarReducer` signatures match across producer and consumer tasks.

**Known follow-ups (deferred, not blockers):** ring center→outward order (Task 2) and registry credentials (Task 16) need confirmation against the live radar / Nerdware infra; both are flagged inline.
