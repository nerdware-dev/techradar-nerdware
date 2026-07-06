# Scanner: Detection Coverage + Derivation Layer

**Date:** 2026-07-06
**Status:** Approved (design)

## Problem

Each weekly radar scan reports a large "undetected" list — 32 entries in the
2026-07-06 scan. Investigation showed **all 32 have `detected=never`**: they are
legacy/manual radar entries the scanner has no fingerprint for, not techs that
dropped out of use. The scanner only sees three signals: GitHub-linguist
languages, a fixed set of tooling file paths, and dependencies from five manifest
types (`package.json`, `composer.json`, `requirements.txt`, `go.mod`, `pom.xml`),
mapped through `aliases.ts` / `families.ts`.

Two categories of undetected entries are addressable:

1. **Concrete techs with no mapping yet** — e.g. Azure, OpenTelemetry, Kafka,
   .NET, Maven, Terragrunt. A missing table entry, nothing more.
2. **Abstract practices implied by concrete techs** — e.g. AWS implies Cloud
   Networking, Terraform implies Infrastructure as Code, GitHub Actions implies
   CI/CD. The evidence exists; it just isn't propagated to the abstraction.

The rest (Microservices, Serverless, GitOps, Design Systems, SPA, Git, GitHub,
Bash Scripting, and SaaS/infra tools like WIZ/Dynatrace/Grafana with no repo
footprint) are structurally undetectable and correctly stay on the undetected
list.

## Goal

Two composable, purely deterministic layers slotted into the existing pipeline
before `mergeRadar`, cutting the undetected list from 32 to roughly 18–20 by
covering the two addressable categories above.

Non-goals (explicitly out of scope for this spec):
- Content-scanning Dockerfiles / CI workflow files for CLI installs (e.g.
  detecting `awscli` in a `RUN` line). Noted as possible future work.
- Data cleanup (merging the `Springboot` duplicate into `Spring`; retiring
  `GitLab` / `GitLab CI/CD`). Separate concern.
- Any ring-movement behavior for derived blips.

## Layer 1 — Direct-detection coverage

New mapping-table entries only; no new code paths. Each entry makes a concrete
blip resolve and therefore get detected.

### `scanner/mappings/families.ts`
Add `Family` prefixes:
- `@azure/` → `Azure`, quadrant `platforms`, verdict `radar`
- `@opentelemetry/` → `Opentelemetry`, quadrant `tools`, verdict `radar`
- `go.opentelemetry.io/` → `Opentelemetry`, quadrant `tools`, verdict `radar`

### `scanner/mappings/aliases.ts`
Add slug → canonical entries:
- `kafkajs`, `confluent-kafka`, `kafka-python`, `kafka-clients`, `node-rdkafka`
  → `Apache Kafka`
- `azure` → `Azure`
- `opentelemetry` → `Opentelemetry`

### `scanner/detect/tooling.ts`
Add path rules (matched against repo file paths):
- base `pom.xml` → `Maven`, quadrant `tools`
- path ends with `.csproj` / `.sln` / `.fsproj`, or base `global.json`
  → `.NET`, quadrant `languages-frameworks`
- base `terragrunt.hcl` → `Terragrunt`, quadrant `tools`

`.NET` is detected via project files rather than the linguist "C#" language on
purpose: `slugify("C#") === "c"`, which would collide with the C language.
Project-file paths are unambiguous.

Canonical-name check: `slugify` of each canonical must match the existing radar
blip's slug so `mergeRadar` links them:
- `.NET` → `net`, `Maven` → `maven`, `Terragrunt` → `terragrunt`,
  `Azure` → `azure`, `Opentelemetry` → `opentelemetry`, `Apache Kafka`
  → `apache-kafka`. All match the current radar entries.

## Layer 2 — Derivation map

New file `scanner/derive.ts`.

```ts
/** Concrete detected tech (canonical blip name) → abstract blip(s) it implies. */
export const IMPLICATIONS: Record<string, string[]> = {
  'AWS': ['Cloud Networking'],
  'Azure': ['Cloud Networking'],
  'Terraform': ['Infrastructure as Code'],
  'Pulumi': ['Infrastructure as Code'],
  'Terragrunt': ['Infrastructure as Code'],
  'Crossplane': ['Infrastructure as Code'],
  'GitHub Actions': ['CI/CD'],
  'GitLab CI/CD': ['CI/CD'],
  'Apache Kafka': ['Message Queues'],
}

/** Given the final detections, append derived detections for implied abstract
 *  blips. Pure; returns a new array (input untouched). */
export function deriveImplied(detections: Detection[]): Detection[]
```

Behavior:
- Index detections by canonical name. For each source present in `IMPLICATIONS`,
  for each target:
  - If the target already exists as a **real** detection → union the source's
    `sourceRepos` into it (dedup), recompute `repoCount = sourceRepos.length`,
    `lastSeen = max`. It stays real (no `derived` flag).
  - Otherwise create a Detection: `name = target`, `sourceRepos` = union of all
    triggering sources' repos (dedup), `repoCount = sourceRepos.length`,
    `lastSeen = max` across triggers, `derived: true`.
- Multiple sources feeding one target merge into a single derived Detection.
- `deriveImplied` does not consult the radar; it only transforms the detections
  list. Whether a target blip actually exists is decided later in `mergeRadar`.

## Data flow & interface changes

- `scanner/types.ts`: `Detection` gains optional `derived?: boolean`.
- `scanner/merge.ts`: `ChangeSet` gains `derived: string[]`.
- `scanner/scan.ts`: after unknowns are triaged and pushed into `detections`,
  and before `mergeRadar`, call `const withDerived = deriveImplied(detections)`.
  Pass `withDerived` to `mergeRadar` and return it as `ScanResult.detections`
  (so the persisted `data/detections/<date>.json` audit file includes derived
  entries with their `derived: true` flag — transparency about why an abstract
  blip shows detected).
- `scanner/merge.ts` step 1 (existing blips): when `detection.derived` is true,
  set `next.detected` from the detection but **skip** `autoRing`, ring-move, and
  reactivation logic entirely; push `blip.name` to `changes.derived`. Otherwise
  unchanged.
- `scanner/merge.ts` step 2 (add new blips): `continue` on any `detection.derived`
  — derived detections must never create a new blip.
- `scanner/report.ts`: add `derived` count to the headline line and, when
  `changes.derived.length`, a `## Implied (derived from detected tech)` section
  listing the names. These names are removed from the undetected list naturally
  because merge records `detected` for them.

## Edge cases

- **Target blip not on the radar** → step 1 never matches it and step 2 skips it;
  the derived detection is silently ignored. No accidental auto-creation.
- **Target retired to `out`** → `next.detected` is recorded, but because the
  derived branch skips the reactivation logic, it is not added to
  `changes.reactivated`. Derivation never resurrects a deliberate retirement.
- **Slug consistency** → matching reuses `slugify`, identical to existing merge
  behavior (`.NET` → `net`, etc.).

## Testing

- `scanner/derive.test.ts` (new):
  - single source → single derived target with that source's repos
  - two sources → one target, `sourceRepos` unioned & deduped, `repoCount`
    = distinct count, `lastSeen` = max
  - source absent → no derived target produced
  - target already present as a real detection → stays real (no `derived` flag),
    repos unioned in
- `scanner/detect/tooling.test.ts` (extend): `pom.xml`→Maven, `foo.csproj`→.NET,
  `terragrunt.hcl`→Terragrunt; a non-matching path yields none of these.
- `scanner/mappings/families.test.ts` (extend): `@azure/identity`→Azure,
  `@opentelemetry/api`→Opentelemetry, `go.opentelemetry.io/otel`→Opentelemetry.
- A resolve/alias test: `kafkajs`→Apache Kafka, `confluent-kafka`→Apache Kafka.
- `scanner/merge.test.ts` (extend): a derived detection records `detected`,
  produces no ring move, is not added as a new blip, and appears in
  `changes.derived`; a derived detection for a blip not on the radar is ignored.
- `scanner/report.test.ts` (extend): the Implied section renders when
  `changes.derived` is non-empty and is absent otherwise.

## Expected effect on the 2026-07-06 list

- Newly directly detectable (when present in repos): Azure, Opentelemetry,
  Apache Kafka, .NET, Maven, Terragrunt.
- Newly detected via derivation (when their sources are present): Cloud
  Networking, Infrastructure as Code, CI/CD, Message Queues.
- Correctly still undetected: Microservices, Serverless architecture, GitOps,
  Design Systems, Design system decision records, Single Page Application, Git,
  GitHub, Bash Scripting, plus SaaS/infra with no repo footprint (WIZ, Dynatrace,
  Grafana, SonarQube, Sonatype Nexus Repository, GitLab, GraalVM, Terratest, and
  Redis/Spring where they appear only as infra rather than declared deps).
