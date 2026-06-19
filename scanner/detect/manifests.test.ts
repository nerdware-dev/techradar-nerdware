import { describe, it, expect } from 'vitest'
import { detectManifest } from './manifests'

describe('detectManifest', () => {
  it('reads dependencies and devDependencies from package.json', () => {
    const json = JSON.stringify({ dependencies: { react: '^19' }, devDependencies: { vite: '^8' } })
    expect(
      detectManifest('package.json', json)
        .map((t) => t.raw)
        .sort(),
    ).toEqual(['react', 'vite'])
  })
  it('reads top-level packages from requirements.txt', () => {
    const txt = 'fastapi==0.110\n# comment\nboto3>=1.0\n'
    expect(
      detectManifest('requirements.txt', txt)
        .map((t) => t.raw)
        .sort(),
    ).toEqual(['boto3', 'fastapi'])
  })
  it('reads module paths from go.mod require blocks', () => {
    const mod = 'module x\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n'
    expect(detectManifest('go.mod', mod).map((t) => t.raw)).toContain('github.com/gin-gonic/gin')
  })
  it('reads packages from composer.json require', () => {
    const json = JSON.stringify({ require: { 'laravel/framework': '^11', php: '^8.2' } })
    expect(detectManifest('composer.json', json).map((t) => t.raw)).toContain('laravel/framework')
  })
  it('reads artifactIds from pom.xml', () => {
    const xml =
      '<project><dependencies><dependency><artifactId>spring-boot</artifactId></dependency></dependencies></project>'
    expect(detectManifest('pom.xml', xml).map((t) => t.raw)).toContain('spring-boot')
  })
  it('returns nothing for an unknown file', () => {
    expect(detectManifest('README.md', 'hi')).toEqual([])
  })
  it('does not throw on malformed JSON', () => {
    expect(detectManifest('package.json', '{ not json')).toEqual([])
  })
})
