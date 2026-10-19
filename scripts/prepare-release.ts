/** Prepare a patch release in the read-only build job; publishing happens only after checks pass. */
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

type Version = readonly [bigint, bigint, bigint]

function parseVersion(value: string): Version | undefined {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value)
  return match === null || match[0] !== value ? undefined : [BigInt(match[1]!), BigInt(match[2]!), BigInt(match[3]!)]
}

function newer(left: Version, right: Version): boolean {
  for (const index of [0, 1, 2] as const) {
    if (left[index] !== right[index]) return left[index] > right[index]
  }
  return false
}

/** Increment the greatest stable version in the manifest and vX.Y.Z tags, never a prerelease/build tag. */
export function nextReleaseVersion(packageVersion: string, tags: readonly string[]): string {
  let latest = parseVersion(packageVersion)
  if (latest === undefined) throw new Error('Automatic patch releases require a stable X.Y.Z package version')
  for (const tag of tags) {
    if (!tag.startsWith('v')) continue
    const version = parseVersion(tag.slice(1))
    if (version !== undefined && newer(version, latest)) latest = version
  }
  return latest[0] + '.' + latest[1] + '.' + (latest[2] + 1n)
}

/** Update only the manifest version and emit the exact version that this build will validate. */
export function prepareRelease(directory: string, outputFile: string): string {
  const manifestPath = join(directory, 'package.json')
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)
    || !('version' in manifest) || typeof manifest.version !== 'string') {
    throw new Error('The package manifest must contain a version string')
  }
  const tags = execFileSync('git', ['tag', '--list', 'v*'], { cwd: directory, encoding: 'utf8' })
    .split('\n').filter(Boolean)
  const version = nextReleaseVersion(manifest.version, tags)
  manifest.version = version
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  appendFileSync(outputFile, 'version=' + version + '\n')
  return version
}

// Importing the pure helpers in tests never changes the working tree.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = process.env.GITHUB_OUTPUT
  if (output === undefined || output.length === 0) throw new Error('GITHUB_OUTPUT is required; run this through the release workflow')
  console.log('Prepared v' + prepareRelease(process.cwd(), output) + ' for validation')
}
