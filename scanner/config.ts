export const SCANNER_CONFIG = {
  org: 'nerdware-dev',
  /** Ignore a language whose byte share is below this fraction of the repo. */
  languageNoiseRatio: 0.05,
  ringThresholds: { high: 5, dev: 2 },
  /** Forge model aliases (its registry tops out at opus-4-6). */
  models: { categorize: 'claude-haiku-4-5', describe: 'claude-opus-4-6' },
  forgeBaseUrl: 'https://forge.nerdware.ai/v1',
  paths: { radar: 'data/tech-radar.json', detectionsDir: 'data/detections' },
} as const
