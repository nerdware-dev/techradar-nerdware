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
  it('drops // indirect requires from go.mod, keeping only direct deps', () => {
    const mod = [
      'module x',
      '',
      'require (',
      '\tgithub.com/gin-gonic/gin v1.9.1',
      '\tgithub.com/modern-go/reflect2 v1.0.2 // indirect',
      ')',
      '',
      'require github.com/stretchr/testify v1.8.0',
    ].join('\n')
    const raws = detectManifest('go.mod', mod).map((t) => t.raw)
    expect(raws).toContain('github.com/gin-gonic/gin')
    expect(raws).toContain('github.com/stretchr/testify')
    expect(raws).not.toContain('github.com/modern-go/reflect2')
  })
  it('ignores pom.xml artifactIds inside plugin, parent and dependencyManagement', () => {
    const xml = [
      '<project>',
      '  <parent><artifactId>spring-boot-starter-parent</artifactId></parent>',
      '  <dependencyManagement><dependencies><dependency>',
      '    <artifactId>libraries-bom</artifactId>',
      '  </dependency></dependencies></dependencyManagement>',
      '  <dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies>',
      '  <build><plugins><plugin><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>',
      '</project>',
    ].join('\n')
    const raws = detectManifest('pom.xml', xml).map((t) => t.raw)
    expect(raws).toEqual(['spring-boot-starter-web'])
  })
  it('excludes reporting plugins, keeping real dependencies', () => {
    const xml = [
      '<project>',
      '  <dependencies><dependency><artifactId>guava</artifactId></dependency></dependencies>',
      '  <reporting><plugins><plugin><artifactId>maven-site-plugin</artifactId></plugin></plugins></reporting>',
      '</project>',
    ].join('\n')
    const raws = detectManifest('pom.xml', xml).map((t) => t.raw)
    expect(raws).toEqual(['guava'])
  })
})
