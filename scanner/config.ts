export const SCANNER_CONFIG = {
  org: 'nerdware-dev',
  /** Ignore a language whose byte share is below this fraction of the repo. */
  languageNoiseRatio: 0.05,
  ringThresholds: { high: 5, dev: 2 },
  /** A newly-detected tech auto-promotes to a blip only if used in at least this
   *  many repos. Below-floor techs go to the review list (and auto-promote later
   *  once adoption grows). Existing blips are never gated by this. */
  promoteMinRepos: 2,
  /** Forge model aliases (its registry tops out at opus-4-6). */
  models: { describe: 'claude-opus-4-6', triage: 'claude-haiku-4-5' },
  forgeBaseUrl: 'https://forge.nerdware.ai/v1',
  paths: {
    radar: 'data/tech-radar.json',
    detectionsDir: 'data/detections',
    verdicts: 'data/verdicts.json',
  },
} as const
