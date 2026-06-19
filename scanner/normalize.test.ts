import { describe, it, expect } from 'vitest'
import { normalize } from './normalize'

describe('normalize', () => {
  it('collapses react aliases to React', () => {
    expect(normalize('react')).toBe('React')
    expect(normalize('react-dom')).toBe('React')
  })
  it('maps an AWS SDK package to AWS', () => {
    expect(normalize('boto3')).toBe('AWS')
  })
  it('drops ignored noise tokens', () => {
    expect(normalize('@types/node')).toBeNull()
  })
  it('title-cases an unknown single token as a best-effort canonical name', () => {
    expect(normalize('fastify')).toBe('Fastify')
  })
  it('is case-insensitive on the raw token', () => {
    expect(normalize('REACT')).toBe('React')
  })
})
