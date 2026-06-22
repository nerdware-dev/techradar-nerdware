import { describe, it, expect } from 'vitest'
import { isPlumbing } from './plumbing'

describe('isPlumbing', () => {
  it('matches eslint plugin/config and webpack loaders/plugins by pattern', () => {
    expect(isPlumbing('eslint-plugin-react')).toBe(true)
    expect(isPlumbing('eslint-config-prettier')).toBe(true)
    expect(isPlumbing('ts-loader')).toBe(true)
    expect(isPlumbing('copy-webpack-plugin')).toBe(true)
    expect(isPlumbing('@swc/core')).toBe(true)
    expect(isPlumbing('@babel/preset-env')).toBe(true)
  })
  it('matches the exact-set of build/test plumbing', () => {
    expect(isPlumbing('tslib')).toBe(true)
    expect(isPlumbing('reflect-metadata')).toBe(true)
    expect(isPlumbing('zone.js')).toBe(true)
  })
  it('does not flag a real radar tech', () => {
    expect(isPlumbing('langchain')).toBe(false)
    expect(isPlumbing('drizzle-orm')).toBe(false)
  })
})
