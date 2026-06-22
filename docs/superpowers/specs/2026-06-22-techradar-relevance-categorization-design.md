# Tech-Radar Scanner — Relevance Categorization (Dependency vs. Radar-worthy)

**Status:** Design · **Datum:** 2026-06-22

## Problem

Der letzte Scan (`data/detections/2026-06-22.json`) liefert **34 veröffentlichte
Detections und 806 „candidates"**. Die candidates-Liste ist zu ~90 % Rauschen, und
das echte Signal versteckt sich darin.

Ursache: Die Relevanz-Entscheidung in `scanner/classify.ts` ist **binär** — ein
Dependency-Token ist `notable` genau dann, wenn es auf der ~30-Einträge-Allowlist
(`ALIASES` / `SCOPE_ALIASES`) steht; alles andere wird „candidate". Der Code hat
keine Vorstellung davon, *was* ein Token ist. Dadurch landen vier grundverschiedene
Dinge unsortiert im selben Topf:

1. **Transitive Go-Module** (größte Rauschquelle). `fromGoMod` greift per Regex
   *alle* `require`-Zeilen ab — inklusive der `// indirect`-Einträge. Ergebnis:
   ~120–150 `github.com/...`-Blips wie `Github Com Modern Go Reflect2`,
   `Filippo Io Edwards25519`, `Github Com Davecgh Go Spew`.
2. **Sub-Pakete eines Tech, das selbst ein Blip ist.** `Radix Ui React Dialog`,
   `…Popover`, `…Tabs` (∼33 Einzelblips = eigentlich *ein* „Radix UI"). Ebenso
   `Nx *`, `Tanstack *`, `Tiptap *`, `Mikro Orm *`, `Sentry *`, `Karma *` und alle
   `Github Com Aws Aws Sdk Go V2 Service *` (∼20 Blips = *ein* „AWS").
   `SCOPE_ALIASES` deckt nur 4 npm-Scopes ab; das Prinzip ist nicht generalisiert.
3. **Build-/Test-Plumbing.** `tslib`, `postcss`, `autoprefixer`, `reflect-metadata`,
   `zone.js`, `core-js`, dutzende `eslint-plugin-*` / `@typescript-eslint/*`.
   Technisch direkte Deps, aber keine bewussten Technologie-Entscheidungen.
4. **Echtes Signal, das untergeht.** Mitten in den 806 stecken klar radar-würdige
   Techs, die nur nicht auf der Allowlist stehen: LangChain, LangGraph, Drizzle,
   tRPC, Hono, Fastify, Better Auth, Zustand, Pydantic, Three.js, Supabase,
   ChromaDB, Pulumi, AWS CDK, OpenAI-/Anthropic-SDK, …

**Kern:** „ist es nur eine Dependency" und „ist es radar-relevant" sind zwei Achsen,
aber der Code kennt nur eine (Allowlist ja/nein). Die Allowlist als alleiniges Tor
skaliert nicht — sie produziert eine 800-Zeilen-Liste, die niemand triagiert, und
verfehlt gleichzeitig neue strategische Techs.

## Entscheidungen (Leitplanken)

Per Brainstorming festgelegt:

1. **Verwerfen: aggressiv & automatisch.** Der Scanner verwirft transitive /
   Plumbing / Sub-Pakete selbstständig; die Review-Liste enthält nur echte
   Tech-Kandidaten (Dutzende statt 800).
2. **Promoten: Auto-Blip mit Veto.** Eine neu entdeckte radar-würdige Tech wird
   sofort als Blip (machine-owned, bei Unsicherheit `needsReview`). Der Mensch
   vetot/korrigiert im wöchentlichen PR. Die Allowlist wächst automatisch mit —
   sie wird vom handgepflegten Tor zum **Cache**.
3. **Relevanz-Latte: nur Architektur-Haltung.** Radar = Dinge, zu denen man eine
   Haltung hat (Frameworks, ORMs, DBs, Plattformen, State-Mgmt, Auth,
   Test-Frameworks, AI-SDKs). Micro-Utilities (clsx, uuid, date-fns, lodash) werden
   verworfen. Ziel: ~50–100 kuratierte Blips.

## Gewählter Ansatz: Hybrid-Pipeline mit selbst-wachsendem Verdict-Cache

Verworfene Alternativen:
- **Regel-lastig (LLM nur Tiebreaker):** skaliert nicht — die 806 sind genau die
  Regel-Tretmühle; Plumbing-Liste wächst ewig, neue Ökosysteme brauchen Regel-Updates.
- **LLM-lastig (fast alles an die LLM):** teuer und nicht-deterministisch (gleiche
  Dep kann zwischen Scans kippen) ohne Caching.

Hybrid kombiniert beides: deterministisch wo billig & sicher, LLM wo Urteil nötig,
und die heutige Allowlist wird zum automatisch wachsenden Cache.

## Architektur: Staged Relevance Resolver

Die binäre `classify`-Entscheidung wird durch einen **gestuften Resolver** ersetzt,
der pro aggregiertem Tech genau ein Urteil liefert:

| Verdict  | Bedeutung                        | Folge                                          |
|----------|----------------------------------|------------------------------------------------|
| `radar`  | Architektur-Entscheidung         | wird/aktualisiert einen Blip (mit Quadrant)    |
| `child`  | Sub-Komponente eines Eltern-Blips| Adoption rollt **in den Eltern**, kein eigener Blip |
| `noise`  | transitiv / Plumbing / Micro-Util| verworfen, nur im Audit-Zähler                 |

Die Entscheidung fällt **billigste Stufe zuerst**. Die LLM sieht nur, was keine
deterministische Stufe und kein Cache klären konnte.

### Stufe 0 — Detection-Hygiene (an der Quelle)

In `scanner/detect/manifests.ts`:

- `fromGoMod`: nur **direkte** Requires. go.mod markiert transitive Deps mit einem
  abschließenden `// indirect`-Kommentar → diese Zeilen verwerfen. Single-line
  `require x vN` (immer direkt) und Block-Einträge ohne `// indirect` bleiben.
  *Erwartung: ~120–150 `github.com/...`-Tokens fallen weg.*
- `fromPomXml`: nur `<artifactId>` innerhalb von `<dependencies>` zählen — nicht
  innerhalb von `<plugin>`, `<parent>` oder `<dependencyManagement>` (BOMs,
  Build-Plugins). *Killt `Spring Boot Starter Parent`, `…Maven Plugin`, `Libraries Bom`.*

`fromPackageJson` ist bereits direkt-only (package.json listet keine transitiven
Deps); `fromComposerJson` (`require`/`require-dev`) ebenso. requirements.txt aus
`pip freeze` (vollständig per `==` gepinnt) als transitiver Dump wird **nicht** in
dieser Iteration behandelt — als künftige Erweiterung notiert.

### Stufe 1 — Parent-Collapse, generalisiert

Neu: `scanner/mappings/families.ts`. Ersetzt das punktuelle `SCOPE_ALIASES` durch
**Präfix-Familien**, die für npm-Scopes *und* Go-Modulpfade funktionieren. Jede
Familie trägt `{ canonical, verdict, quadrant }`:

```ts
interface Family {
  /** Präfix-Match: npm-Scope ("@radix-ui/") oder Go-Modulpfad ("github.com/aws/aws-sdk-go-v2/"). */
  prefix: string
  canonical: string
  verdict: 'radar' | 'noise'
  quadrant?: QuadrantId   // nur bei verdict 'radar'
}
```

Beispiele:
- npm: `@radix-ui/*`→Radix UI, `@nx/*`+`@nrwl/*`→Nx, `@tanstack/*`→TanStack,
  `@tiptap/*`→Tiptap, `@mikro-orm/*`→MikroORM, `@sentry/*`→Sentry, `@trpc/*`→tRPC,
  `@mui/*`→MUI, `@emotion/*`→Emotion, `@storybook/*`→Storybook, `@langchain/*`→LangChain,
  `@angular/*`→Angular, `@nestjs/*`→NestJS, `@aws-sdk/*`→AWS, `@reduxjs/*`→Redux Toolkit.
- Go: `github.com/aws/aws-sdk-go-v2/*`→AWS, `gorm.io/*`→GORM, `github.com/jackc/pgx*`→pgx,
  `github.com/gin-gonic/gin`→Gin, `github.com/prometheus/*`→Prometheus;
  `golang.org/x/*`→**noise** (Quasi-Stdlib, keine Tech-Wahl).

Ein Token, das ein Familien-Präfix matcht, kollabiert auf `canonical` mit dem
Familien-Verdict. → `@radix-ui/react-*` (∼33 Tokens) wird **ein** „Radix UI";
gleiches für Nx, TanStack, Tiptap, Sentry, AWS-SDK-Go (∼20→1).

### Stufe 2 — Plumbing-Suppression

Neu: `scanner/mappings/plumbing.ts` (oder erweitertes `ignore.ts`). Muster + Exact-Set,
die ein Token direkt als `noise` markieren:

- Muster: `@types/*` (bereits), `eslint-plugin-*`, `eslint-config-*`, `*-loader`,
  `*-webpack-plugin`, `babel-*`, `@swc/*`.
- Exact-Set: `tslib, postcss, autoprefixer, reflect-metadata, zone.js, core-js,
  regenerator-runtime, ts-node, tsx, globals, source-map-support, rimraf, husky,
  lint-staged, nodemon, concurrently, cross-env, copyfiles` (erweiterbar).

### Stufe 3 — Verdict-Cache

Neu: `data/verdicts.json` — in-repo, **mensch- und maschinen-editierbar** (wie
`tech-radar.json`). Als JSON statt TS-Konstante, weil der Scanner ihn zur Laufzeit
fortschreiben können muss (TS-Mappings kann er nicht schreiben).

```jsonc
{
  "react":    { "verdict": "radar", "quadrant": "languages-frameworks", "source": "seed" },
  "langchain":{ "verdict": "radar", "quadrant": "languages-frameworks", "source": "llm",   "confidence": 0.9, "decidedAt": "2026-06-22" },
  "tslib":    { "verdict": "noise", "source": "seed" },
  "axios":    { "verdict": "noise", "source": "human", "decidedAt": "2026-06-22" }
}
```

Schlüssel = slugified canonical name. **Einmalige Migration** aus heutigem
`ALIASES` + `QUADRANT_MAP` (alle → `verdict: 'radar'`, Quadrant aus `QUADRANT_MAP`,
`source: 'seed'`). Cache-Treffer = 0 LLM-Kosten.

`source`-Präzedenz: `human` > `llm` > `seed`. Ein `human`-Eintrag wird von der LLM
**nie** überschrieben (so kann ein Mensch eine Fehlklassifikation dauerhaft fixen).

### Stufe 4 — LLM-Triage (nur auf Cache-Misses)

Direkte, unbekannte Deps (die Stufen 0–3 überlebt haben) → Batch an das günstige
Modell (`SCANNER_CONFIG.models.categorize`, heute `claude-haiku-4-5`) mit der
**Architektur-Haltung-Rubrik**:

> Ein Tech-Radar trackt Technologien, die ein Team bewusst *wählt* und zu denen es
> eine Haltung hat — Frameworks, ORMs, Datenbanken, Plattformen, State-Management,
> Auth, Test-Frameworks, AI/ML-SDKs, signifikante Libraries. Es trackt **nicht**:
> transitive Dependencies, Build-/Lint-Plumbing, Polyfills, Type-Stubs oder
> Micro-Utilities (Datums-Formatierung, Classname-Helper, UUID-Generierung).

Kontext pro Tech: `repoCount` + `sourceRepos` (wie heute in `categorize`).
Rückgabe: `{ verdict: 'radar'|'child'|'noise', parent?: string, quadrant?: QuadrantId, confidence: 0..1 }`.
Niedrige Confidence (< `CONFIDENCE_THRESHOLD`, heute 0.7) → `needsReview`.

**Konsolidierung:** Dieser eine Call **ersetzt** den heutigen separaten
`categorize`-Call — der Quadrant kommt mit dem `radar`-Verdict. Bekannte/gecachte
Techs überspringen die LLM ganz. Netto bleibt das LLM-Volumen gleich oder sinkt,
weil Stufe 0–2 hunderte Tokens gar nicht erst zur LLM lässt.

Neuer LLM-Methodenname (`triage`) im `LLMClient`-Interface (`scanner/llm/types.ts`),
Prompt in `scanner/llm/prompts.ts`. Der bisherige `categorize` entfällt bzw. wird
intern von `triage` subsumiert.

### Stufe 5 — Write-back

Alle LLM-Urteile (`radar` *und* `noise`) werden in `data/verdicts.json`
zurückgeschrieben (`source: 'llm'`, `confidence`, `decidedAt`) → nächster Scan ist
für sie gratis. `human`-Einträge bleiben unangetastet (Präzedenz). Geschrieben wird
in `run.ts` (FS-Boundary), nicht in `runScan`.

## Datenfluss & betroffene Dateien

```
detect/* (Stufe 0 fix) ─► aggregate (per canonical, child→parent) ─► resolve (Stufen 1–3)
   ─► triage (Stufe 4, nur misses) ─► write-back (Stufe 5)
   ─► merge (radar→Blip) ─► report
```

- `scanner/detect/manifests.ts` — Stufe 0 (Go-`indirect`, pom-Scoping).
- `scanner/mappings/families.ts` — **neu**, Stufe 1 (ersetzt `SCOPE_ALIASES`).
- `scanner/mappings/plumbing.ts` — **neu**, Stufe 2 (erweitert `ignore.ts`).
- `scanner/classify.ts` → `scanner/resolve.ts` — gestufter Resolver, liefert
  `{ canonical, verdict, quadrant?, parent? }` statt `{ name, notable }`.
- `scanner/aggregate.ts` — gruppiert per canonical; `child`-Verdicts rollen ihre
  Adoption (`repoCount`, `sourceRepos`, `lastSeen`) in den Eltern-Blip.
- `scanner/categorize.ts` — vereinfacht: Quadrant kommt aus Verdict; LLM-Call ist
  in `triage` gewandert.
- `scanner/llm/{types,prompts}.ts` — `triage`-Methode + Rubrik-Prompt.
- `scanner/scan.ts` / `scanner/run.ts` — Verdict-Cache injizieren (read in `run.ts`),
  Triage + write-back verdrahten; `ScanResult.candidates` → `suppressed`.
- `scanner/report.ts` — „N candidates" → „N suppressed (M neu)" + Sektion
  „Neue Radar-Techs entdeckt".
- `scanner/config.ts` — Pfad `paths.verdicts: 'data/verdicts.json'`.

**Isolation:** Jede Stufe ist eine reine, einzeln testbare Funktion
(`detectGoMod` fixed, `collapseFamily(token)`, `suppress(token)`,
`lookupVerdict(name, cache)`, `triage(unknowns, llm)`, `writeBackVerdicts`).
`runScan` bleibt FS-frei (Cache wird wie `existing` reingereicht).

## Outputs & Report

- `radar`-Verdicts → bestehender `mergeRadar`-Flow (Auto-Blip mit Veto,
  `needsReview` bei niedriger Confidence) — unverändert.
- `data/detections/{date}.json`: `candidates` (die 806-Liste) → ersetzt durch
  `suppressed` (Audit: Zähler + Namen, klar als „verworfen", nicht „zu triagieren").
- `report.ts`: Zeile „N candidates" → „**N suppressed (M neu)**"; neue Sektion
  **„Neue Radar-Techs entdeckt"** listet die auto-promoteten Blips.

## Erwarteter Effekt (Schätzung auf den echten 806)

- Stufe 0–2 entfernt grob **500–600** (Go-transitiv, Familien-Collapse, Plumbing).
- Cache + Rubrik klären den Großteil des Rests.
- Es bleiben **~20–50 echte neue Radar-Kandidaten**, die auto-promotet werden:
  LangChain, Drizzle, tRPC, Hono, Fastify, Better Auth, Zustand, Pydantic, Three.js,
  Supabase, ChromaDB, Pulumi, AWS CDK, OpenAI-/Anthropic-SDK, Recharts,
  React Hook Form, Cypress, Storybook, TanStack Query, Redux, MUI, Emotion …

*Zahlen sind Schätzungen aus der Sichtung der `2026-06-22.json`-candidates; sie
werden in der Implementierung gegen den realen Scan validiert.*

## Testing

- **Stufe 0:** Fixtures mit `// indirect`-go.mod und pom.xml mit `<plugin>`/`<parent>`
  → nur direkte Deps kommen durch.
- **Stufe 1:** `@radix-ui/react-dialog` + `@radix-ui/react-tabs` → ein „Radix UI";
  `golang.org/x/sys` → noise.
- **Stufe 2:** `eslint-plugin-react`, `tslib` → noise.
- **Stufe 3:** Cache-Hit (seed/llm/human) überspringt LLM; `human` schlägt `llm`.
- **Stufe 4:** gemockter `triage`-Client; low-confidence → `needsReview`.
- **Stufe 5:** write-back persistiert llm-Urteile, lässt `human` unangetastet.
- **aggregate:** `child` rollt Adoption korrekt in den Eltern.
- **Regression:** bestehende `merge`/`report`/provenance-Tests bleiben grün; die
  `run.ts`-Guardrail (kein pinned/existing Blip verschwindet) bleibt scharf.

## Rollout / Migration

1. Einmaliges Migrations-Skript: `ALIASES` + `QUADRANT_MAP` → `data/verdicts.json`
   (seed). Danach sind `aliases.ts`/`quadrants.ts` nur noch Migrations-Quelle;
   `families.ts` übernimmt die Scope-Collapse-Rolle.
2. Implementierung stufenweise (jede Stufe testgetrieben, Pipeline bleibt zwischen
   den Stufen lauffähig).
3. Erster echter Scan gegen den Org; `suppressed`-Audit und auto-promotete Blips im
   Wochen-PR sichten, Cache via `human`-Korrekturen nachschärfen.

## Risiken & Gegenmaßnahmen

- **Echte Tech fälschlich als noise verworfen.** → `suppressed`-Audit-Log (Namen
  bleiben sichtbar); `human`-Override im Cache promotet dauerhaft zurück.
- **LLM halluziniert Quadrant/Verdict.** → `confidence`-Schwelle + `needsReview` +
  Veto im Wochen-PR; Verdict auf `radar|child|noise` geklemmt (wie heute der
  Quadrant in `parseCategory`).
- **Familien-Liste veraltet.** → unbekannte Scopes fallen automatisch in die
  LLM-Triage; Familien sind nur die billige Abkürzung, kein Tor.

## Non-Goals

- requirements.txt-`pip freeze`-Dumps entrauschen (künftig).
- Versions-/CVE-Tracking, License-Scanning.
- Änderung des Ring-Algorithmus (`autoRing`) oder der Quadrant-Definitionen.
