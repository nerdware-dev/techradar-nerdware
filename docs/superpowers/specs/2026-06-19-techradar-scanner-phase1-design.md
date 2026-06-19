# Tech Radar Scanner — Phase 1 Design (Detect + Reconcile + AI-assist)

**Date:** 2026-06-19
**Status:** Approved design — ready for implementation plan
**Owner:** Andreas Bendheimer (Nerdware)
**Related:** `docs/superpowers/specs/2026-06-18-techradar-auto-update-vision.md` (north-star vision). This spec implements **Phase 1** of that vision, with three decisions taken during brainstorming (see §2).

## 1. Goal

Build an **on-demand scanner** that reads all repositories in the `nerdware-dev` GitHub org, detects the technologies actually in use, and produces a candidate `data/tech-radar.json` that:

- **adds** newly-discovered technologies as blips (AI-categorized into quadrants, with AI-drafted German descriptions),
- **reconciles** existing entries' rings against real adoption, and
- **never** destroys hand-curated editorial content.

The first deliverable is the runnable scanner; we run it against the real org, review the proposed diff, and only then (step 2, a separate plan) wire up the daily GitHub Actions workflow. This earns trust in detection quality before any automation runs — matching the vision's phasing.

## 2. Decisions taken (brainstorming, 2026-06-19)

| # | Decision | Choice |
|---|----------|--------|
| First deliverable | scanner-only vs full pipeline | **Scanner first**, as an on-demand CLI script. Daily workflow is a later step after reviewing real output. |
| AI assist | AI from the start vs deterministic-only | **AI from the start.** Mapping tables handle known techs (0 AI calls); Claude categorizes unknowns (cheap model + confidence) and drafts German descriptions for new blips (stronger model). Low-confidence → `needs-review`. |
| Existing 45 entries | additive-only vs reconcile | **Reconcile.** Beyond adding new blips, the scan re-rings detected existing entries by adoption and flags undetected ones. Safety guards in §6 prevent silent loss of curated content. |

## 3. Non-goals (Phase 1)

- No daily cron / GitHub Actions workflow yet (step 2).
- No auto-merge and no PR-side guardrail gate yet (Phase 2 of the vision).
- No automatic detection of the **Techniques** quadrant (stays human-curated — no reliable repo signal).
- No app/UI changes beyond a single passthrough test (§5). The radar app is unaffected.
- No database. File-based in git, per the vision.

## 4. Architecture

A self-contained `scanner/` directory, separate from the app (`src/`). It shares only `slugify` and `parseRadar` from `src/data/` so its output is provably valid against the same schema the app uses.

```
scanner/
  config.ts          # org name, thresholds, allow/deny lists, model IDs, file paths
  github.ts          # GitHub client: list org repos, language stats, recursive file tree, file contents
  detect/
    languages.ts     # GitHub language bytes  → Languages & Frameworks
    manifests.ts     # parse package.json / requirements.txt / pyproject.toml / Pipfile /
                     #   go.mod / pom.xml / build.gradle / composer.json / Gemfile → dependencies
    tooling.ts       # presence of Dockerfile, docker-compose, *.tf, k8s/Helm, .github/workflows,
                     #   .gitlab-ci.yml, eslint/prettier/vite/vitest/playwright configs → Tools + easy Platforms
  mappings/
    aliases.ts       # raw token → canonical blip name (react, react-dom, @types/react → "React")
    quadrants.ts     # canonical name → quadrant
    ignore.ts        # tokens to skip as noise
  normalize.ts       # raw token → canonical name (table; Claude fallback for unknowns)
  categorize.ts      # canonical name → quadrant (table; Claude fallback with confidence)
  describe.ts        # Claude: draft a German description for a NEW blip only
  aggregate.ts       # collapse detections to per-tech { repoCount, lastSeen, sourceRepos }
  autoRing.ts        # adoption count → ring
  merge.ts           # detections + existing radar (preserving human-owned fields) → candidate radar
  report.ts          # human-readable diff summary (console now; PR body later)
  run.ts             # CLI entrypoint orchestrating the pipeline
data/
  tech-radar.json    # candidate output (the radar the app reads)
  detections/        # machine-owned scan snapshots, one per run (enables trends + the future Out rule)
```

**Dependencies to add:** `@octokit/rest` (pagination + rate-limit handling), `@anthropic-ai/sdk`, `tsx` (dev, to execute TS directly). **npm script:** `"scan": "tsx scanner/run.ts"`.

**Auth (env-based, portable to CI):** GitHub token from `GH_TOKEN`/`GITHUB_TOKEN`; Anthropic from `ANTHROPIC_API_KEY`. Local invocation: `GH_TOKEN=$(gh auth token) ANTHROPIC_API_KEY=… npm run scan`. The active `gh` account already has `repo` + `read:org` scopes (private repos readable).

## 5. Data model (additive, app-safe)

The scanner writes the **effective** `ring` / `quadrant` / `description` (exactly what the app reads today) **plus** provenance fields the app ignores:

```jsonc
{
  "name": "React",
  "quadrant": "languages-frameworks",   // effective
  "ring": "dev",                          // effective = ringOverride ?? autoRing → "dev" wins here
  "isNew": false,
  "description": "…German…",              // effective
  // ---- machine-owned (scanner writes freely) ----
  "detected": { "repoCount": 7, "lastSeen": "2026-06-18", "sourceRepos": ["graphmind", "vend"] },
  "autoRing": "high",                     // adoption alone would say "high"…
  // ---- human-owned (scanner READS, never writes) ----
  "ringOverride": "dev",        // …but a human pinned it to "dev", and the scanner obeys
  "quadrantOverride": "tools",  // optional: locks quadrant
  "pinned": true,               // optional: manually-added blip (e.g. a Techniques entry)
  "descriptionLocked": true,    // optional: never regenerate this description
  "hidden": false               // optional: keep record, hide from radar
}
```

`merge.ts` computes effective values from the overrides and writes them into the standard fields, so **the app needs no override logic**. zod's non-strict object already strips unknown keys on parse, so provenance fields don't break the app. **One app-side test** asserts a blip carrying these extra fields round-trips through `parseRadar` without error and renders its effective values — no other app change.

Hand-editing a `ringOverride` (or `quadrantOverride`, `descriptionLocked`, `pinned`, `hidden`) in the JSON is the human escape hatch: the next scan reads it via `merge.ts` and never fights it.

## 6. Reconciliation logic (with footgun guards)

For each canonical tech in the detection set, matched to existing radar entries by slug:

- **New blip** (detected, not in radar): add it. `autoRing` from adoption; quadrant from table or AI; German description drafted by AI; `isNew: true`; `detected` populated.
- **Existing + detected**: populate `detected`; set `autoRing`; effective `ring = ringOverride ?? autoRing` (so rings actively reconcile to adoption unless a human has pinned them). **Description preserved** (human-owned — never overwritten). Every `old → new` ring move is listed in the report.
- **Existing + NOT detected** (e.g. AWS, Azure, every Techniques entry — repo scans cannot see these): **never auto-retired.** Kept exactly as-is, listed under "Undetected — confirm still in use / retire manually." Undetected ≠ unused; this guard prevents silent loss of legitimately-used platforms and all human-curated Techniques.
- **`pinned` entries**: always preserved regardless of detection.
- **Out ring**: the vision's "absent > 12 months → Out" rule needs detection history that does not exist on the first run. On run 1, `out` is only ever set by a human (via `ringOverride` or hand edit). The scanner proposes Out for nothing.

`autoRing` thresholds (in `config.ts`, configurable): `high` ≥ 5 repos · `dev` 2–4 repos · `low` 1 repo. `out` is reserved for the history-based rule in a later phase.

## 7. AI usage

Deterministic detection first; Claude only for genuinely ambiguous parts, gated by confidence:

- **Categorization of unknowns** — canonical names not in `mappings/quadrants.ts` are sent to a cheap Claude model (Haiku-tier) that returns one of the four quadrants + a confidence score. Known techs make **zero** AI calls.
- **Name normalization fallback** — unrecognized raw tokens that the alias table doesn't cover can be normalized by Claude (optional; table covers the common cases).
- **German descriptions** — for **new** blips only, a stronger Claude model (Sonnet/Opus-tier) drafts a description in the radar's German editorial voice. Existing descriptions are never sent or overwritten.
- **Confidence gating** — categorizations below a configurable threshold are written with the tech marked `needs-review` (a machine field) and listed separately in the report; they are not silently published into a quadrant. Because AI runs only on new/unknown techs, most runs make few or zero calls.

Exact model IDs, the SDK call shape, and prompts are pinned via the `claude-api` reference at implementation time (default to the latest capable Claude models — e.g. `claude-haiku-4-5` for categorization, `claude-opus-4-8` for German descriptions).

### 7.1 Where the AI runs (execution model)

There is **no persistent Claude process or hosted agent.** The scanner makes ordinary, stateless HTTPS calls to the Anthropic Messages API (`POST /v1/messages`) via the `@anthropic-ai/sdk` package, authenticated with `ANTHROPIC_API_KEY`. Both AI uses (categorize-unknown = classification; draft-description = text generation) are single-call requests — **not** the Managed Agents / Claude Code surface, which would add containers and session state we don't need.

The calls run **wherever the scanner process runs**:
- **Step 1 (on-demand):** on the developer's machine via `npm run scan`, with `ANTHROPIC_API_KEY` in the local env.
- **Step 2 (daily workflow):** on the GitHub Actions runner. The runner has network egress to `api.anthropic.com`; the key is supplied as a GitHub Actions secret (`ANTHROPIC_API_KEY`, repo- or org-level) and passed as an env var to `npm run scan`. Because AI fires only on new/unknown techs, most scheduled runs make few or zero calls; only the first bulk run (and occasional new tech) incurs meaningful cost.

## 8. Outputs of one run

1. **`data/tech-radar.json`** — the candidate radar (app-readable), updated in place.
2. **`data/detections/<YYYY-MM-DD>.json`** — the machine snapshot: per-tech raw signals, `repoCount`, `sourceRepos`, detected version hints. Enables future trend views and the history-based Out rule. (This is a normal Node script run, so real timestamps are available.)
3. **A printed report** (`report.ts`) — human-readable diff summary: `+N added`, ring moves (`old → new`), `needs-review` items, and undetected-existing items. This becomes the PR body in step 2.

## 9. Error handling

- **GitHub**: paginate all listings; exponential backoff on `403` rate-limit and `5xx`. A repo that errors (access, empty, etc.) is skipped and logged — never fails the whole run.
- **Manifest parsing**: each file parsed in its own try/catch; a malformed manifest is skipped and logged.
- **Claude**: retry transient failures; on persistent failure, fall back to marking the tech `needs-review` rather than crashing. Cap total AI calls per run (config).
- **Output safety assertion** (a guardrail even before auto-merge exists): before writing, the candidate must `parseRadar` successfully, and no `pinned`/human-owned entry may have been dropped. If either fails, the run aborts without writing.

## 10. Testing (TDD; vitest already configured)

Pure, deterministic units are tested directly:

- `normalize` — alias → canonical, including ignore-list behavior.
- `categorize` — table hits; AI path mocked.
- `autoRing` — threshold boundaries (0/1/2/4/5 repos).
- `aggregate` — dedup + `repoCount`/`sourceRepos` correctness.
- `merge` — **the safety-critical test**: human-owned fields (`description`, `ringOverride`, `quadrantOverride`, `pinned`, `hidden`) survive a merge unchanged; undetected existing entries are not retired; new blips are added.
- `manifests` / `tooling` — parse against checked-in fixture files (a sample `package.json`, `go.mod`, `requirements.txt`, `pom.xml`, `composer.json`, `Dockerfile`, `*.tf`).
- `report` — produces the expected sections for a known diff.

`github.ts` and the Claude client sit behind thin, injectable interfaces; tests pass mocks. The **live org run** is the integration check we do together before building the workflow.

## 11. Step 2 (separate plan, after reviewing run 1)

`.github/workflows/radar-scan.yml`: daily cron → `npm run scan` (with `GITHUB_TOKEN` + `ANTHROPIC_API_KEY` secrets) → open/update a pull request with the candidate + the report as the PR body → **human merges manually**. Auto-merge and the guardrail gate are deferred to vision Phase 2.

## 12. Open items pinned at implementation time

- Exact Claude model IDs + prompts (via `claude-api` reference).
- Final language-noise threshold and the full seed contents of `mappings/` (bootstrapped from the existing 45 entries + common ecosystem libs).
- `@octokit/rest` vs shelling out to `gh api` — design assumes Octokit for robust pagination/rate-limit handling; revisit only if dependency footprint is a concern.
