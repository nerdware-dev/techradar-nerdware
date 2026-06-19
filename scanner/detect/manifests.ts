import type { DetectedToken } from '../types'

const dep = (raw: string): DetectedToken => ({ raw, kind: 'dependency' })

function fromPackageJson(content: string): string[] {
  try {
    const pkg = JSON.parse(content) as Record<string, Record<string, string> | undefined>
    return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]
  } catch {
    return []
  }
}

function fromComposerJson(content: string): string[] {
  try {
    const pkg = JSON.parse(content) as { require?: Record<string, string>; 'require-dev'?: Record<string, string> }
    return [...Object.keys(pkg.require ?? {}), ...Object.keys(pkg['require-dev'] ?? {})]
  } catch {
    return []
  }
}

function fromRequirementsTxt(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('-'))
    .map((line) => line.split(/[=<>!~ ]/)[0].trim())
    .filter(Boolean)
}

function fromGoMod(content: string): string[] {
  return [...content.matchAll(/^\s*([\w.\-/]+\.[\w.\-/]+)\s+v\d/gm)].map((m) => m[1])
}

function fromPomXml(content: string): string[] {
  return [...content.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)].map((m) => m[1].trim())
}

/** Parse a manifest file into dependency tokens. Unknown files yield []. */
export function detectManifest(path: string, content: string): DetectedToken[] {
  const file = path.split('/').pop() ?? path
  switch (file) {
    case 'package.json':
      return fromPackageJson(content).map(dep)
    case 'composer.json':
      return fromComposerJson(content).map(dep)
    case 'requirements.txt':
      return fromRequirementsTxt(content).map(dep)
    case 'go.mod':
      return fromGoMod(content).map(dep)
    case 'pom.xml':
      return fromPomXml(content).map(dep)
    default:
      return []
  }
}

/** Filenames this detector knows how to parse (used to decide which files to fetch). */
export const MANIFEST_FILES = ['package.json', 'composer.json', 'requirements.txt', 'go.mod', 'pom.xml']
