# Scanner Detection Coverage + Derivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the scanner to detect more concrete techs (Azure, OpenTelemetry, Kafka, .NET, Maven, Terragrunt) and to mark abstract blips (Cloud Networking, IaC, CI/CD, Message Queues) as detected when their concrete sources are found.

**Architecture:** Two deterministic layers before `mergeRadar`. Layer 1 adds mapping-table entries (families/aliases/tooling) — no new code path. Layer 2 is a new `deriveImplied()` that appends derived detections for implied abstract blips; merge records their `detected` data but never rings-moves or auto-creates them.

**Tech Stack:** TypeScript, Vitest (`npm test` → `vitest run`).

## Global Constraints

- Canonical names in mappings must slug-match existing radar blips: `.NET`→`net`, `Maven`→`maven`, `Terragrunt`→`terragrunt`, `Azure`→`azure`, `Opentelemetry`→`opentelemetry`, `Apache Kafka`→`apache-kafka`, `Cloud Networking`→`cloud-networking`, `Infrastructure as Code`→`infrastructure-as-code`, `CI/CD`→`ci-cd`, `Message Queues`→`message-queues`.
- Derived detections must never move a ring, never trigger reactivation, never create a new blip.
- Run the full `npm test` green before final commit.

---

### Task 1: Direct-detection coverage (families, aliases, tooling)

**Files:**
- Modify: `scanner/mappings/families.ts`
- Modify: `scanner/mappings/aliases.ts`
- Modify: `scanner/detect/tooling.ts`
- Test: `scanner/mappings/families.test.ts`, `scanner/detect/tooling.test.ts`

**Interfaces:**
- Consumes: existing `Family` shape, `ALIASES` record, tooling `Rule` shape.
- Produces: `collapseFamily('@azure/identity')` → `{canonical:'Azure',...}`; `detectTooling(['pom.xml'])` → token `Maven`.

- [ ] **Step 1: Write failing family tests**

In `scanner/mappings/families.test.ts` add inside the `describe`:
```ts
it('collapses cloud + observability families', () => {
  expect(collapseFamily('@azure/identity')?.canonical).toBe('Azure')
  expect(collapseFamily('@opentelemetry/api')?.canonical).toBe('Opentelemetry')
  expect(collapseFamily('go.opentelemetry.io/otel')?.canonical).toBe('Opentelemetry')
})
```

- [ ] **Step 2: Write failing tooling tests**

In `scanner/detect/tooling.test.ts` add:
```ts
it('detects Maven, .NET and Terragrunt from project files', () => {
  expect(detectTooling(['pom.xml']).map((t) => t.raw)).toContain('Maven')
  expect(detectTooling(['src/App.csproj']).map((t) => t.raw)).toContain('.NET')
  expect(detectTooling(['Solution.sln']).map((t) => t.raw)).toContain('.NET')
  expect(detectTooling(['infra/terragrunt.hcl']).map((t) => t.raw)).toContain('Terragrunt')
})
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npm test -- families tooling`
Expected: FAIL (Azure/Maven not found).

- [ ] **Step 4: Add family prefixes**

In `scanner/mappings/families.ts`, append to the `FAMILIES` array (after the npm-scope block, before Python block is fine):
```ts
  { prefix: '@azure/', canonical: 'Azure', verdict: 'radar', quadrant: PLAT },
  { prefix: '@opentelemetry/', canonical: 'Opentelemetry', verdict: 'radar', quadrant: TOOLS },
  { prefix: 'go.opentelemetry.io/', canonical: 'Opentelemetry', verdict: 'radar', quadrant: TOOLS },
```

- [ ] **Step 5: Add aliases**

In `scanner/mappings/aliases.ts`, add entries to the `ALIASES` object:
```ts
  kafkajs: 'Apache Kafka',
  'confluent-kafka': 'Apache Kafka',
  'kafka-python': 'Apache Kafka',
  'kafka-clients': 'Apache Kafka',
  'node-rdkafka': 'Apache Kafka',
  azure: 'Azure',
  opentelemetry: 'Opentelemetry',
```

- [ ] **Step 6: Add tooling rules**

In `scanner/detect/tooling.ts`, append to the `RULES` array:
```ts
  { name: 'Maven', quadrant: 'tools', match: (p) => base(p) === 'pom.xml' },
  {
    name: '.NET',
    quadrant: 'languages-frameworks',
    match: (p) => /\.(cs|fs)proj$/.test(base(p)) || base(p) === 'global.json' || base(p).endsWith('.sln'),
  },
  { name: 'Terragrunt', quadrant: 'tools', match: (p) => base(p) === 'terragrunt.hcl' },
```

- [ ] **Step 7: Run tests, verify pass**

Run: `npm test -- families tooling`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add scanner/mappings/families.ts scanner/mappings/aliases.ts scanner/detect/tooling.ts scanner/mappings/families.test.ts scanner/detect/tooling.test.ts
git commit -m "feat(scanner): detect Azure, OpenTelemetry, Kafka, .NET, Maven, Terragrunt"
```

---

### Task 2: `deriveImplied` derivation layer

**Files:**
- Modify: `scanner/types.ts` (add `derived?: boolean` to `Detection`)
- Create: `scanner/derive.ts`
- Test: `scanner/derive.test.ts`

**Interfaces:**
- Consumes: `Detection` (`name`, `repoCount`, `sourceRepos`, `lastSeen`).
- Produces: `deriveImplied(detections: Detection[]): Detection[]` — a new array; derived entries carry `derived: true`.

- [ ] **Step 1: Add `derived` field to Detection**

In `scanner/types.ts`, inside `interface Detection`, after `quadrant?: QuadrantId`:
```ts
  /** True when this detection was inferred from another tech, not found directly. */
  derived?: boolean
```

- [ ] **Step 2: Write failing derive tests**

Create `scanner/derive.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { deriveImplied } from './derive'
import type { Detection } from './types'

const det = (name: string, repos: string[], lastSeen = '2026-07-01'): Detection => ({
  name,
  repoCount: repos.length,
  sourceRepos: repos,
  lastSeen,
})

describe('deriveImplied', () => {
  it('derives an abstract blip from a single source', () => {
    const out = deriveImplied([det('Terraform', ['a', 'b'])])
    const iac = out.find((d) => d.name === 'Infrastructure as Code')!
    expect(iac.derived).toBe(true)
    expect(iac.sourceRepos.sort()).toEqual(['a', 'b'])
    expect(iac.repoCount).toBe(2)
  })

  it('unions repos and takes max lastSeen across multiple sources', () => {
    const out = deriveImplied([
      det('AWS', ['a', 'b'], '2026-06-01'),
      det('Azure', ['b', 'c'], '2026-07-05'),
    ])
    const cn = out.find((d) => d.name === 'Cloud Networking')!
    expect(cn.sourceRepos.sort()).toEqual(['a', 'b', 'c'])
    expect(cn.repoCount).toBe(3)
    expect(cn.lastSeen).toBe('2026-07-05')
  })

  it('produces no derived entry when no source is present', () => {
    const out = deriveImplied([det('React', ['a'])])
    expect(out.every((d) => !d.derived)).toBe(true)
    expect(out).toHaveLength(1)
  })

  it('leaves input array and objects untouched', () => {
    const input = [det('Terraform', ['a'])]
    const before = JSON.parse(JSON.stringify(input))
    deriveImplied(input)
    expect(input).toEqual(before)
  })

  it('augments an already-real target instead of duplicating it', () => {
    const out = deriveImplied([
      det('Apache Kafka', ['a']),
      det('Message Queues', ['z']), // already detected directly (hypothetical)
    ])
    const mq = out.filter((d) => d.name === 'Message Queues')
    expect(mq).toHaveLength(1)
    expect(mq[0].derived).toBeUndefined()
    expect(mq[0].sourceRepos.sort()).toEqual(['a', 'z'])
  })
})
```

- [ ] **Step 3: Run tests, verify fail**

Run: `npm test -- derive`
Expected: FAIL (`deriveImplied` not found).

- [ ] **Step 4: Implement derive.ts**

Create `scanner/derive.ts`:
```ts
import type { Detection } from './types'

/** Concrete detected tech (canonical blip name) → abstract blip(s) it implies. */
export const IMPLICATIONS: Record<string, string[]> = {
  AWS: ['Cloud Networking'],
  Azure: ['Cloud Networking'],
  Terraform: ['Infrastructure as Code'],
  Pulumi: ['Infrastructure as Code'],
  Terragrunt: ['Infrastructure as Code'],
  Crossplane: ['Infrastructure as Code'],
  'GitHub Actions': ['CI/CD'],
  'GitLab CI/CD': ['CI/CD'],
  'Apache Kafka': ['Message Queues'],
}

/** Append derived detections for abstract blips implied by detected concrete tech.
 *  Pure: clones input; never mutates the passed detections. */
export function deriveImplied(detections: Detection[]): Detection[] {
  const result: Detection[] = detections.map((d) => ({ ...d, sourceRepos: [...d.sourceRepos] }))
  const byName = new Map(result.map((d) => [d.name, d]))
  const derived = new Map<string, { repos: Set<string>; lastSeen: string }>()

  for (const source of detections) {
    const targets = IMPLICATIONS[source.name]
    if (!targets) continue
    for (const target of targets) {
      const real = byName.get(target)
      if (real && !real.derived) {
        for (const r of source.sourceRepos) {
          if (!real.sourceRepos.includes(r)) real.sourceRepos.push(r)
        }
        real.repoCount = real.sourceRepos.length
        if (source.lastSeen > real.lastSeen) real.lastSeen = source.lastSeen
        continue
      }
      const acc = derived.get(target) ?? { repos: new Set<string>(), lastSeen: '' }
      for (const r of source.sourceRepos) acc.repos.add(r)
      if (source.lastSeen > acc.lastSeen) acc.lastSeen = source.lastSeen
      derived.set(target, acc)
    }
  }

  for (const [name, acc] of derived) {
    const repos = [...acc.repos]
    result.push({ name, repoCount: repos.length, sourceRepos: repos, lastSeen: acc.lastSeen, derived: true })
  }
  return result
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test -- derive`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scanner/types.ts scanner/derive.ts scanner/derive.test.ts
git commit -m "feat(scanner): derive abstract blips from detected concrete tech"
```

---

### Task 3: Merge records derived detections without ring moves

**Files:**
- Modify: `scanner/merge.ts`
- Test: `scanner/merge.test.ts`

**Interfaces:**
- Consumes: `deriveImplied` output (`Detection` with `derived: true`), `Detection.derived`.
- Produces: `ChangeSet.derived: string[]`; derived existing blips get `detected` set, no `autoRing`, no ring move; derived detections never become new blips.

- [ ] **Step 1: Write failing merge tests**

In `scanner/merge.test.ts`, add a new `describe` block at the end of the file:
```ts
describe('mergeRadar — derived detections', () => {
  const existingD: ScannerBlip[] = [
    { name: 'Cloud Networking', ring: 'high', quadrant: 'platforms', isNew: 'FALSE', description: 'Net.' },
  ]
  it('records detected data + changes.derived but no ring move, for an existing abstract blip', () => {
    const detections: Detection[] = [
      { name: 'Cloud Networking', repoCount: 9, sourceRepos: ['a'], lastSeen: '2026-07-01', derived: true },
    ]
    const { candidate, changes } = mergeRadar(existingD, detections, new Map(), new Map())
    const cn = candidate.find((b) => b.name === 'Cloud Networking')!
    expect(cn.detected?.repoCount).toBe(9)
    expect(cn.autoRing).toBeUndefined()
    expect(cn.ring).toBe('high')
    expect(changes.ringMoves).toHaveLength(0)
    expect(changes.derived).toContain('Cloud Networking')
    expect(changes.undetected).not.toContain('Cloud Networking')
  })
  it('never creates a new blip from a derived detection', () => {
    const detections: Detection[] = [
      { name: 'Message Queues', repoCount: 3, sourceRepos: ['a'], lastSeen: '2026-07-01', derived: true },
    ]
    const { candidate, changes } = mergeRadar([], detections, new Map(), new Map())
    expect(candidate).toHaveLength(0)
    expect(changes.added).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests, verify fail**

Run: `npm test -- merge`
Expected: FAIL (`changes.derived` undefined / blip created).

- [ ] **Step 3: Add `derived` to ChangeSet**

In `scanner/merge.ts`, add to `interface ChangeSet` after `reactivated`:
```ts
  /** Existing abstract blips marked detected via derivation (no ring move). */
  derived: string[]
```
And in the `changes` initializer object, add:
```ts
    derived: [],
```

- [ ] **Step 4: Branch step 1 on `detection.derived`**

In `scanner/merge.ts`, replace the body of `if (detection) { ... }` (the block currently spanning `const ar = autoRing(...)` through the closing of the `else`) with:
```ts
    if (detection) {
      next.detected = {
        repoCount: detection.repoCount,
        lastSeen: detection.lastSeen,
        sourceRepos: detection.sourceRepos,
      }
      if (detection.derived) {
        // Implied abstract blip: record evidence only — never move its manual ring.
        changes.derived.push(blip.name)
      } else {
        const ar = autoRing(detection.repoCount)
        next.autoRing = ar
        const currentRing = slugify(blip.ring) as RingId
        if (currentRing === 'out' && !next.ringOverride) {
          changes.reactivated.push(blip.name)
        } else {
          const effectiveRing = next.ringOverride ?? ar
          if (effectiveRing !== currentRing) {
            changes.ringMoves.push({ name: blip.name, from: currentRing, to: effectiveRing })
            next.ring = effectiveRing
          }
        }
      }
    } else {
      changes.undetected.push(blip.name)
    }
```

- [ ] **Step 5: Guard step 2 against derived**

In `scanner/merge.ts` step 2 loop, add as the first line inside `for (const detection of detections) {`:
```ts
    if (detection.derived) continue
```

- [ ] **Step 6: Run tests, verify pass**

Run: `npm test -- merge`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scanner/merge.ts scanner/merge.test.ts
git commit -m "feat(scanner): merge records derived detections without ring moves"
```

---

### Task 4: Wire derivation into scan + report the derived section

**Files:**
- Modify: `scanner/scan.ts`
- Modify: `scanner/report.ts`
- Test: `scanner/report.test.ts`

**Interfaces:**
- Consumes: `deriveImplied`, `ChangeSet.derived`.
- Produces: derived detections persisted in `ScanResult.detections`; report gains a derived count + section.

- [ ] **Step 1: Write failing report test**

In `scanner/report.test.ts`, extend the sample `changes` to include `derived: []` (so existing tests keep compiling) and add:
```ts
it('lists derived entries under their own heading', () => {
  const md = renderReport(
    { added: [], ringMoves: [], undetected: [], needsReview: [], reactivated: [], derived: ['Cloud Networking'] },
    10,
  )
  expect(md).toMatch(/Implied/i)
  expect(md).toContain('Cloud Networking')
})
```
(If the file has a shared `changes` fixture object, add `derived: []` to it.)

- [ ] **Step 2: Run test, verify fail**

Run: `npm test -- report`
Expected: FAIL (type error on missing `derived`, or heading absent).

- [ ] **Step 3: Render derived in report**

In `scanner/report.ts`, add to the headline template string (after the `undetected` line, before `needs-review`):
```ts
      `**${changes.derived.length} derived**, ` +
```
And after the `reactivated` block, add:
```ts
  if (changes.derived.length) {
    lines.push(
      '',
      '## Implied (derived from detected tech)',
      ...changes.derived.map((n) => `- ${n}`),
    )
  }
```

- [ ] **Step 4: Wire deriveImplied into scan.ts**

In `scanner/scan.ts`, add the import near the other scanner imports:
```ts
import { deriveImplied } from './derive'
```
Replace:
```ts
  const { candidate, changes } = mergeRadar(existing, promoted, categorized, descriptions)
  const report = renderReport(changes, repos.length, suppressed.length, belowThreshold.length)
  return {
    candidate,
    report,
    detections: promoted,
```
with:
```ts
  const withDerived = deriveImplied(promoted)
  const { candidate, changes } = mergeRadar(existing, withDerived, categorized, descriptions)
  const report = renderReport(changes, repos.length, suppressed.length, belowThreshold.length)
  return {
    candidate,
    report,
    detections: withDerived,
```

- [ ] **Step 5: Run report tests, verify pass**

Run: `npm test -- report`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all green (scan.test.ts included — verify no regression from the `detections` now containing derived entries).

- [ ] **Step 7: Commit**

```bash
git add scanner/scan.ts scanner/report.ts scanner/report.test.ts
git commit -m "feat(scanner): wire derivation into scan pipeline and report"
```

---

## Self-Review notes

- Spec coverage: Layer 1 → Task 1; Layer 2 → Task 2; merge/data-flow → Task 3; scan wiring + report → Task 4. All spec sections mapped.
- Type consistency: `deriveImplied(Detection[]) → Detection[]`, `Detection.derived?`, `ChangeSet.derived: string[]` used identically across tasks.
- Edge cases from spec (target absent → ignored; target `out` → no reactivation via the derived branch skipping that logic; input untouched) are covered by Task 2 Step 4 and Task 3 tests.
