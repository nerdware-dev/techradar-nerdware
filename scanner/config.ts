export const SCANNER_CONFIG = {
  org: 'nerdware-dev',
  /** Ignore a language whose byte share is below this fraction of the repo. */
  languageNoiseRatio: 0.05,
  ringThresholds: { high: 5, dev: 2 },
  defaultProvider: 'anthropic',
  /** Per-provider model aliases (Forge's registry has no opus-4-8). */
  models: {
    anthropic: { categorize: 'claude-haiku-4-5', describe: 'claude-opus-4-8' },
    forge: { categorize: 'claude-haiku-4-5', describe: 'claude-opus-4-6' },
  },
  forgeBaseUrl: 'https://forge.nerdware.ai/v1',
  paths: { radar: 'data/tech-radar.json', detectionsDir: 'data/detections' },
} as const
