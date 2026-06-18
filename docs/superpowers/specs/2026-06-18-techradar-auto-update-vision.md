# Tech Radar Auto-Update — Future Vision

**Date:** 2026-06-18
**Status:** Vision / north-star (not scheduled for implementation yet — depends on the modernization landing first)
**Owner:** Andreas Bendheimer (Nerdware)
**Related:** `docs/superpowers/specs/2026-06-18-techradar-modernization-design.md` (the React/Vite rewrite currently being built)

## 1. Vision in one sentence

A scheduled job scans Nerdware's GitHub repositories every day, detects the technologies actually in use, and keeps the Tech Radar up to date automatically — proposing changes as a pull request that auto-merges when it passes safety checks, so the radar stays current with almost no manual upkeep.

## 2. Why

Today `data/tech-radar.json` is hand-curated. That is accurate but goes stale: nobody remembers to add a newly-adopted framework or retire an abandoned one. A daily scan of the org's repos turns the radar from a periodically-remembered chore into a living reflection of what Nerdware really builds with — while preserving the editorial layer (deliberate competency rings, German descriptions, and the non-detectable *Techniques* quadrant).

## 3. Decisions (settled during brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| Storage | Database vs files | **File-based in git.** No DB. Automation removes the manual editing; git provides history, audit trail, and the PR workflow for free; the dataset is tiny. A DB is reconsidered only if a live in-app editor/admin UI or heavy historical analytics appears. |
| Update model | How the scan reaches the live radar | **Guardrailed auto-merge.** Daily job opens a PR; CI runs guardrails; if all pass it auto-merges; if any guardrail trips, the PR stays open for a human. |
| Detection scope | Which signals/quadrants | **(a) High-confidence subset.** Languages & Frameworks + Tools well; easy Platform signals (Docker/Terraform/k8s); cloud-platform inference kept minimal. **Techniques stays human-curated** (no reliable repo signal). |

Defaults proposed in this doc for the remaining open points (ring logic, Claude's role, repo scope) are in §5–§7.

## 4. Architecture

A scanner script + a scheduled GitHub Actions workflow, both living in this repo. **The radar app is unchanged** — it keeps reading `data/tech-radar.json`.

```
.github/workflows/radar-scan.yml   # daily cron → run scanner → PR → guardrails → auto-merge
scanner/                           # Node/TS, run in CI
  listRepos.ts        # GitHub API: org repos (filtered)
  detect/             # per-signal detectors (languages, manifests, tool configs, easy platforms)
  normalize.ts        # raw tech name → canonical blip name (mapping table + Claude fallback)
  categorize.ts       # tech → quadrant (mapping table + Claude fallback, with confidence)
  describe.ts         # Claude: draft German description for a NEW blip
  aggregate.ts        # per-tech: { repoCount, lastSeen, sourceRepos }
  merge.ts            # combine detections (machine fields) with existing human-owned fields → candidate tech-radar.json
  guardrails.ts       # the safety checks (also runnable as a CI gate)
data/
  tech-radar.json     # the radar the app reads (generated projection; PR-updated)
  detections/         # machine-owned scan history (e.g. one snapshot per run) — enables trends later
```

**Daily flow:**
1. Cron triggers the workflow.
2. Scanner lists org repos → for each, pulls language stats + key manifest/config files via the GitHub API.
3. Detect → normalize → categorize → aggregate into per-tech records.
4. `merge.ts` produces a candidate `tech-radar.json` by combining machine-owned fields with the existing human-owned fields (see §8).
5. Workflow opens/updates a PR with the candidate + a generated rationale ("+3 added, 1 → Out, …").
6. Guardrails run as CI checks.
7. **All green → auto-merge** (radar updates, no human action). **Any red → PR stays open**, a human is notified.

## 5. Ring logic (proposed default)

Rings encode **competency** (`high`/`dev`/`low`/`out`), but a repo scan measures **adoption**. We bridge with an adoption-derived default that a human can always override:

- `out` — not seen in any active repo for **> 12 months** (configurable).
- `low` — used in **1** repo, or first detected very recently (experimental).
- `dev` — used in **2 … M−1** repos (growing).
- `high` — used in **≥ M** repos (widespread; M configurable, e.g. 5).

The auto-derived ring is `autoRing`. The **effective ring = `ringOverride ?? autoRing`** — so wherever competency genuinely diverges from raw adoption, a human sets `ringOverride` once and the scanner never fights it. Thresholds live in config.

## 6. Claude's role (proposed default)

Deterministic detection first; Claude only for the genuinely ambiguous parts, and gated:

- **Categorization** — map a detected tech → quadrant. A static mapping table covers known techs (0 AI calls); **a cheap Claude model (e.g. Haiku-tier)** classifies *unknowns* with a confidence score.
- **Name normalization** — collapse aliases (`@aws-sdk/*`, `boto3` → "AWS"; `react`, `react-dom` → "React"). Mapping table + Claude fallback for unrecognized names.
- **German description drafting** — for a **new** blip, **a stronger Claude model (e.g. Sonnet-tier)** drafts the description in the radar's German editorial voice. A human can edit it; once edited it becomes human-owned and is never overwritten.
- **(Optional) "What changed" summary** — a short German changelog in the PR body.

**Confidence gating:** low-confidence AI categorizations are written as `needs-review` rather than auto-published, and trip a guardrail so the PR pauses for a human. Because AI runs only on *new/unknown* techs, most days make **zero** AI calls. (Exact model IDs, SDK, and prompts get pinned via the `claude-api` reference at implementation time.)

## 7. Repository scope (proposed default)

- **All non-archived, non-fork repositories** in the `nerdware-dev` GitHub org, **including private** (requires a token with org repo-read scope).
- Archived and forked repos are excluded (they are not "what we use now").
- An optional allow/deny list in config for exceptions.

## 8. Machine-owned vs human-owned data (the key safety mechanism)

Auto-merge is only safe because the scanner never touches human editorial work. Each blip carries provenance:

- **Machine-owned** (scanner writes freely): `detected: { repoCount, lastSeen, sourceRepos }`, `autoRing`, `isNew`.
- **Human-owned** (scanner never overwrites): `description` (once edited), `ringOverride`, `pinned` (a manually-added blip, e.g. a *Techniques* entry), `hidden`.
- **Effective values:** ring = `ringOverride ?? autoRing`; description = human description if present, else the Claude draft.

This requires extending the radar JSON schema (the modernization's zod schema must accept and preserve these additive fields). The app's rendering still only needs `name`/`ring`/`quadrant`/`isNew`/`description`, so the UI is unaffected.

## 9. Guardrails (concrete checks before auto-merge)

1. **Schema valid** — candidate parses through `parseRadar` with all rings/quadrants known.
2. **No curated deletion** — no `pinned`/human-owned blip is removed.
3. **Change-size cap** — ≤ N net adds/removes/ring-moves per run (configurable, e.g. 10); a larger diff pauses for review.
4. **No human-field overwrite** — the diff touches only machine-owned fields.
5. **AI confidence** — no `needs-review` items in the auto-publish set.

Any failure → the PR is left open and a human is notified. Every merged change is a git commit → fully revertible.

## 10. Phasing (earn trust, then automate)

1. **Phase 1 — Detect + PR (manual merge).** Scanner detects Languages & Frameworks + Tools across org repos, writes detections, opens a daily PR. Humans merge. No AI yet (mapping tables; unknowns → `needs-review`). Builds confidence in detection quality.
2. **Phase 2 — Guardrails + auto-merge.** Add the §9 checks; flip on auto-merge.
3. **Phase 3 — Claude assist.** Categorize unknowns + draft German descriptions, with confidence gating.
4. **Phase 4 — Reach.** Easy platform signals (Docker/Terraform/k8s), "what changed" PR summaries, and (later) trend views from `data/detections/` history.

## 11. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Adoption ≠ competency | `ringOverride` always wins; auto-ring is only a default |
| Private-repo access / token scope / API rate limits | Org token with least scope; paginate + cache; back off on limits |
| AI mis-categorization going live | Mapping tables first; confidence gating; human override; git revert |
| Daily noise / flapping | Thresholds + hysteresis (add after N repos / persists; retire only after months absent) |
| Cloud platforms under-detected | Accepted under scope (a); humans add platform blips manually (often `pinned`) |
| Claude cost | AI runs only on new/unknown techs (usually 0/day); cheap model for categorization |
| Clobbering editorial content | Machine-owned vs human-owned split (§8) — the core safety mechanism |

## 12. Out of scope (for this vision)

- A live in-app editor / admin UI (would justify a backend + DB — explicitly deferred).
- Multi-radar / per-team radars, time-travel UI, comments/voting.
- Detecting *Techniques* automatically.

## 13. Dependencies & next step

- Depends on the **modernization landing first** (the rewrite gives us the configurable JSON, the zod schema to extend, and GitHub Actions already in the repo).
- When ready to build, this vision becomes its own spec → implementation plan, starting at **Phase 1** (detect + manual-merge PR), which is independently useful even before auto-merge is switched on.
