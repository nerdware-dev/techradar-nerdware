import { describe, it, expect } from 'vitest'
import { collapseFamily } from './families'

describe('collapseFamily', () => {
  it('collapses an npm scope family to its canonical radar blip', () => {
    expect(collapseFamily('@radix-ui/react-dialog')).toEqual({
      canonical: 'Radix UI',
      verdict: 'radar',
      quadrant: 'languages-frameworks',
    })
    expect(collapseFamily('@nx/eslint')?.canonical).toBe('Nx')
    expect(collapseFamily('@nrwl/jest')?.canonical).toBe('Nx')
  })
  it('collapses a Go module-path family by prefix', () => {
    expect(collapseFamily('github.com/aws/aws-sdk-go-v2/service/s3')).toEqual({
      canonical: 'AWS',
      verdict: 'radar',
      quadrant: 'platforms',
    })
  })
  it('marks golang.org/x/* as noise', () => {
    expect(collapseFamily('golang.org/x/sys')).toEqual({
      canonical: 'golang.org/x',
      verdict: 'noise',
    })
  })
  it('returns null for a token that matches no family', () => {
    expect(collapseFamily('some-unknown-package')).toBeNull()
  })
  it('collapses new npm scope families', () => {
    expect(collapseFamily('@ngrx/store')?.canonical).toBe('NgRx')
    expect(collapseFamily('@pulumi/aws')?.canonical).toBe('Pulumi')
    expect(collapseFamily('@dnd-kit/core')?.canonical).toBe('dnd kit')
    expect(collapseFamily('@fullcalendar/react')?.canonical).toBe('FullCalendar')
    expect(collapseFamily('@playwright/test')?.canonical).toBe('Playwright')
  })
  it('collapses Python/pip ecosystem prefixes', () => {
    expect(collapseFamily('langchain-core')?.canonical).toBe('LangChain')
    expect(collapseFamily('langchain')?.canonical).toBe('LangChain')
    expect(collapseFamily('llama-index-llms-ollama')?.canonical).toBe('LlamaIndex')
    expect(collapseFamily('smolagents-openai')?.canonical).toBe('Smolagents')
  })
  it('collapses Go AWS base module (no trailing path) and sub-paths', () => {
    expect(collapseFamily('github.com/aws/aws-sdk-go-v2')?.canonical).toBe('AWS')
    expect(collapseFamily('github.com/aws/aws-sdk-go-v2/service/s3')?.canonical).toBe('AWS')
  })
})
