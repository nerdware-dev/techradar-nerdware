import { describe, it, expect } from 'vitest'
import { classify } from './classify'
import type { DetectedToken } from './types'

const dep = (raw: string): DetectedToken => ({ raw, kind: 'dependency' })
const lang = (raw: string): DetectedToken => ({
  raw,
  kind: 'language',
  quadrantHint: 'languages-frameworks',
})
const tool = (raw: string): DetectedToken => ({ raw, kind: 'tool', quadrantHint: 'platforms' })

describe('classify', () => {
  it('marks an allowlisted dependency notable with its canonical name', () => {
    expect(classify(dep('react-dom'))).toEqual({ name: 'React', notable: true })
    expect(classify(dep('boto3'))).toEqual({ name: 'AWS', notable: true })
  })
  it('marks an unrecognized dependency as a non-notable candidate', () => {
    expect(classify(dep('bcryptjs'))).toEqual({ name: 'Bcryptjs', notable: false })
  })
  it('drops ignore-list noise for both deps and languages', () => {
    expect(classify(dep('@types/node'))).toBeNull()
    expect(classify(lang('HTML'))).toBeNull()
  })
  it('keeps tooling tokens notable with their name verbatim when unknown', () => {
    expect(classify(tool('GitLab CI/CD'))).toEqual({ name: 'GitLab CI/CD', notable: true })
  })
  it('collapses scoped packages to one canonical blip by @scope', () => {
    expect(classify(dep('@angular/core'))).toEqual({ name: 'Angular', notable: true })
    expect(classify(dep('@nestjs/common'))).toEqual({ name: 'NestJS', notable: true })
  })
  it('drops @types/* stubs whether or not they are in the ignore list', () => {
    expect(classify(dep('@types/react'))).toBeNull()
  })
  it('canonicalizes a language token via the alias table (Vue → Vue.js)', () => {
    // GitHub reports a "Vue" language; the `vue` package aliases to "Vue.js" — these collapse.
    expect(classify(lang('Vue'))).toEqual({ name: 'Vue.js', notable: true })
    expect(classify(dep('vue'))).toEqual({ name: 'Vue.js', notable: true })
  })
})
