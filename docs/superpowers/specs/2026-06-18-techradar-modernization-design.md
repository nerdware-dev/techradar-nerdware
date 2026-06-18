# Tech Radar Modernization — Design

**Date:** 2026-06-18
**Status:** Approved (design); pending implementation plan
**Owner:** Andreas Bendheimer (Nerdware)

## 1. Background

The Nerdware Tech Radar is a fork of Thoughtworks'
[`build-your-own-radar`](https://github.com/thoughtworks/build-your-own-radar) (BYOR).
It has been customized for Nerdware (corporate design, German blip descriptions) and
loads its content from a single JSON file (`data/tech-radar.json`) fetched at runtime
from the project's raw GitHub URL.

### Current stack (what we're replacing)

| Area | Current |
|------|---------|
| Build | Webpack 5 + Babel 7 (4 configs: common/dev/dev-old-ui/prod) |
| Rendering | D3 v7 (~175 `d3.select`/`selectAll` calls) |
| DOM / UI | jQuery 3.6 + jQuery UI 1.13 (across all graphing components) |
| Misc libs | lodash, chance, sanitize-html, d3-tip 0.9 (unmaintained) |
| Styling | SCSS + PostCSS |
| Tests | Jest 29 (unit) + Cypress 12 (e2e) |
| Lint | ESLint 8 + Prettier 2 |
| Modules | CommonJS (`require`/`module.exports`) |
| Runtime | Node 18 (EOL since Apr 2025) |
| CI / Deploy | CircleCI + Docker/nginx **and** a manual GitHub Pages flow |

### Pain points

1. **Manual post-build path editing** — the README documents hand-editing generated
   `index.html`/`main.js` to prepend `./` to asset paths on every build.
2. **Committed build output** — ~4 MB `main.js` + source maps + ~800 KB CSS live in git.
3. **Two conflicting deploy stories** — Docker/nginx/CircleCI (from upstream) vs. GitHub Pages.
4. **jQuery + jQuery UI** alongside D3 — redundant legacy weight.
5. **EOL Node 18** and a generally one-major-version-behind toolchain.
6. **Fragile content workflow** — string-typed `ring`/`isNew`, case-sensitive values;
   the README warns the radar "won't generate" if the JSON shape isn't followed exactly.

## 2. Decisions

These were settled during brainstorming and frame the whole design:

| # | Decision | Choice |
|---|----------|--------|
| Ownership | Track upstream vs. own it | **Fully own the fork**, diverge freely |
| Scope | Refresh vs. rewrite | **Full rewrite** to a modern framework |
| Framework | React / Angular / Svelte | **React + Vite + TypeScript** |
| Rendering | Keep D3 vs. drop it | **Drop D3 and jQuery** — declarative SVG |
| Deploy | Pages / Docker / both | **Docker + nginx** (modernized) |
| A | Unused upstream features | **Drop** Google Sheets, CSV, file-upload, multi-format input |
| B | Content data loading | **Fetch from a configurable URL** (default raw GitHub); zero-rebuild edits |
| C | CI | **GitHub Actions**; retire CircleCI |

## 3. Goals & non-goals

### Goals

- Modern, maintainable, fully typed codebase a new intern can pick up quickly.
- Render the radar as **declarative SVG** — no library fighting the framework for the DOM.
- Preserve the current Nerdware UX and corporate design.
- Preserve the **zero-rebuild content workflow**: edit `tech-radar.json`, radar updates live.
- Eliminate the manual path-fixing and the committed build output.
- One clear build & deploy path (Vite → static bundle → nginx image, built in GitHub Actions).

### Non-goals

- No new radar features beyond today's UX.
- No backend/CMS — content stays a JSON file in git.
- No change to the *meaning* of rings/quadrants (low/dev/high/old; the 4 quadrants).
- Not preserving upstream BYOR's "build from any source" capabilities (see Decision A).

## 4. Scope: keep vs. drop

Upstream BYOR is a *"build your own radar from any source"* tool; Nerdware only ever
loads one fixed JSON. The input machinery is therefore dead weight.

**Drop entirely:** Google Sheets auth (`googleAuth.js`), Sheets/CSV import (`sheet.js`),
the file-upload landing page, multi-document handling, the input-format branching in
`factory.js`, jQuery, jQuery UI, D3, d3-tip, lodash, chance, webpack (×4), Babel,
the Cypress system-lib install in the Dockerfile, the committed `docs/` build output,
and CircleCI config.

**Keep (the actual Nerdware UX):**

- Full radar view: 4 quadrants × 4 rings, numbered blips placed within each.
- Click a quadrant → focus/zoom that quadrant + a per-ring table of its blips.
- Blip interaction: hover → tooltip (description) + highlight; click a table row → highlight on radar.
- Search / autocomplete across blips.
- `isNew` indicator (ring around a blip).
- Ring legend.
- Nerdware branding (banner, logo, colors, fonts).
- `data/tech-radar.json` as the unchanged content source.

## 5. Architecture

A small single-page React app. The radar is declarative SVG driven by a pure geometry
module. State is plain React (`useReducer` + context) — no Redux/Zustand at this size.

```
src/
  main.tsx
  App.tsx
  config.ts             # data URL + radar config (rings, quadrants), env-overridable
  data/
    types.ts            # Blip, Ring, Quadrant, Radar (typed model)
    schema.ts           # zod schema → validates & normalizes the JSON
    loadRadar.ts        # fetch + validate + normalize → Radar
  radar/
    geometry.ts         # ring radii, polar→cartesian, quadrant arc paths (pure)
    placement.ts        # deterministic seeded blip placement + collision spacing (pure)
  state/
    radarStore.ts       # selected quadrant, hovered/selected blip, search query
  components/
    Radar.tsx           # the SVG scene: quadrant arcs + ring circles + blips
    Quadrant.tsx
    Blip.tsx            # one blip: number, isNew ring, hover/selected state
    Tooltip.tsx         # blip description on hover (sanitized HTML)
    QuadrantTable.tsx   # blips of the focused quadrant, grouped by ring
    Search.tsx          # autocomplete search
    Legend.tsx
    Header.tsx          # Nerdware banner / branding
  styles/
    tokens.scss         # colors + fonts, reused from existing _colors/_fonts partials
    *.module.scss       # scoped component styles
public/
  images/               # logos, banner, favicons
data/
  tech-radar.json       # content — unchanged shape, still git-maintained
```

Each unit has one purpose, a typed interface, and is testable in isolation:
geometry/placement/schema are pure functions; components consume the typed `Radar` model
and the store.

## 6. The radar without D3

D3 did two jobs here, both trivially replaceable:

- **DOM manipulation** (~175 `d3.select` calls) → React renders the SVG declaratively.
- **Blip math** → `radar/geometry.ts` + `radar/placement.ts`:
  - Rings are concentric circles with increasing radii.
  - Each quadrant occupies a 90° sector.
  - A blip at `(quadrant, ring)` is placed at an angle/radius **seeded by its name**
    (stable layout across reloads), with simple collision spacing.
  - ~40 lines of pure, unit-tested trig. Replaces `chance` + `d3` + `ringCalculator` + `mathUtils`.

## 7. Data & validation

- **Loading (Decision B):** `loadRadar(url)` fetches the JSON at runtime from a
  **configurable URL** (`config.ts`, overridable via a build-time env var). Default = the
  existing raw GitHub URL, preserving zero-rebuild content edits. Can be repointed at a
  JSON served by the same nginx if desired.
- **Validation:** a **zod** schema validates and normalizes on load:
  - `ring` / `quadrant` accepted case-insensitively (kills the README's uppercase rule).
  - `isNew` coerced to a real boolean.
  - `description` HTML-sanitized via **DOMPurify** (descriptions legitimately contain
    `<a href>` links; sanitize-html is replaced).
  - Invalid entries produce a clear, surfaced error instead of a silently broken radar.
- This removes the entire "radar won't generate" class of content errors.

## 8. Styling

- **SCSS modules** (`*.module.scss`) via Vite — scoped, framework-native, low ceremony.
- Reuse the existing color/font tokens (`_colors.scss`, `_fonts.scss`) so the Nerdware
  corporate design is preserved with minimal restyling.

## 9. Build, test, deploy

- **Build:** Vite → static `dist/`. Vite's `base` config handles asset paths once —
  no more manual `./` edits. Build output is **not** committed.
- **Test:**
  - **Vitest + React Testing Library** — unit/component (geometry, placement, schema
    validation, search filtering, component rendering). Coverage retained.
  - **Playwright** replaces Cypress for e2e (lighter, faster, no libgtk install).
  - **ESLint 9** (flat config) + **Prettier 3**.
- **Deploy (Docker + nginx):** multi-stage `Dockerfile`:
  - Stage 1 `node:22-alpine` → `vite build`.
  - Stage 2 `nginx:1.27-alpine` → copies `dist/` + `nginx.conf` (SPA fallback, gzip,
    cache headers). Tiny final image, no Node/Cypress baggage.
  - The existing `docker_push.sh` registry-push pattern is preserved.
- **CI (Decision C):** **GitHub Actions** — one workflow: install → lint → test →
  `vite build` → build & push Docker image on push to `master`. CircleCI retired.

## 10. Runtime & metadata

- **Node 22 LTS** — update `.nvmrc`, `engines`, Docker base, CI.
- `package.json` reset: drop upstream `name`/`author`/`version 0.3.0`; rename to a
  Nerdware-owned package starting at `1.0.0`; AGPL-3.0 license retained (BYOR is AGPL).

## 11. Deleted vs. created (summary)

**Deleted:** `webpack.*.js` (×4), Babel config, `jest.config.js`, `cypress.config.js`,
`src/graphing/*`, `src/util/{factory,googleAuth,sheet,autoComplete,ringCalculator,mathUtils,queryParamProcessor,...}`,
committed `docs/` build output, `.circleci/`, and the jQuery/jQuery-UI/D3/d3-tip/lodash/chance deps.

**Created:** the `src/` tree (section 5), `vite.config.ts`, `vitest.config.ts`,
Playwright config, multi-stage `Dockerfile` + `nginx.conf`, ESLint 9 flat config,
and `.github/workflows/` (build/test/deploy).

## 12. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Visual regression vs. current radar | Keep `data/tech-radar.json` + color/font tokens; compare against the live radar; Playwright visual checks. |
| Blip placement differs from old layout | Deterministic seeded placement; positions only need to be stable & legible, not byte-identical to D3's. |
| AGPL compliance (BYOR is AGPL-3.0) | Retain license; keep attribution; repo stays the place source is available. |
| Losing a quietly-used input feature | Confirmed during brainstorming that only the JSON is used (Decision A). |

## 13. Open items for the implementation plan

- Exact `nginx.conf` (caching/headers, SPA fallback).
- GitHub Actions secrets for the registry push (mirror current `docker_push.sh`).
- Whether to add a JSON Schema for `tech-radar.json` so editors get editor validation
  (the zod schema can be the single source).
