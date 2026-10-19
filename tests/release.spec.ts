import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { nextReleaseVersion, prepareRelease } from '../scripts/prepare-release.ts'

const temporaryDirectories: string[] = []
const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_TERMINAL_PROMPT: '0' }
function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'nowcoding-release-'))
  temporaryDirectories.push(directory)
  return directory
}
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    if (dirname(directory) !== tmpdir() || !basename(directory).startsWith('nowcoding-release-')) throw new Error('Unexpected cleanup target')
    rmSync(directory, { recursive: true, force: true })
  }
})
function git(directory: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: directory, env: gitEnv, encoding: 'utf8', stdio: 'pipe' }).trim()
}
function repository(directory: string): void {
  git(directory, '-c', 'init.templateDir=', 'init', '--initial-branch=main')
  git(directory, 'config', 'user.name', 'Release Test')
  git(directory, 'config', 'user.email', 'release-test@example.invalid')
}
function sourceFixture(): { directory: string; output: string } {
  const directory = temporary()
  repository(directory)
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'test-plugin', version: '0.1.8', scripts: { build: 'noop' } }, null, 2) + '\n')
  mkdirSync(join(directory, 'lib'))
  writeFileSync(join(directory, 'lib/index.js'), 'export const built = false\n')
  writeFileSync(join(directory, 'lib/obsolete.d.ts'), 'export declare const obsolete: true\n')
  git(directory, 'add', '.')
  git(directory, 'commit', '-m', 'source')
  git(directory, 'tag', '-a', 'v0.1.8', '-m', 'previous release')
  return { directory, output: join(directory, '.release-output') }
}

describe('automatic patch versions', () => {
  it.each([
    ['0.1.8', [], '0.1.9'],
    ['0.1.8', ['v0.1.8', 'v0.1.9', 'v0.1.10'], '0.1.11'],
    ['0.1.8', ['v1.0.0', 'v0.99.99'], '1.0.1'],
    ['0.2.0', ['v0.1.99'], '0.2.1'],
    ['0.1.8', ['v999.0.0-rc.1', 'v999.0.0-build.1', 'other', '1.0.0', 'v01.2.3', 'v9.0.0\n'], '0.1.9'],
    ['1.2.9007199254740992', [], '1.2.9007199254740993'],
  ] as const)('increments the numeric stable maximum of %s', (version, tags, expected) => {
    expect(nextReleaseVersion(version, tags)).toBe(expected)
  })
  it.each(['', 'v0.1.8', '0.1', '0.1.8-rc.1', '01.1.8', '-1.2.3', '1.2.3\n'])('rejects an invalid or prerelease package version: %s', version => {
    expect(() => nextReleaseVersion(version, [])).toThrow('stable X.Y.Z')
  })
  it('changes only the manifest version, emits the build output and does not create a commit or tag', () => {
    const { directory, output } = sourceFixture()
    git(directory, 'tag', 'v0.1.10')
    const head = git(directory, 'rev-parse', 'HEAD')
    const tags = git(directory, 'tag', '--list')
    expect(prepareRelease(directory, output)).toBe('0.1.11')
    expect(JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))).toEqual({ name: 'test-plugin', version: '0.1.11', scripts: { build: 'noop' } })
    expect(readFileSync(output, 'utf8')).toBe('version=0.1.11\n')
    expect(git(directory, 'rev-parse', 'HEAD')).toBe(head)
    expect(git(directory, 'tag', '--list')).toBe(tags)
  })
  it('runs the same CLI used by Actions without changing the real repository', () => {
    const { directory, output } = sourceFixture()
    const script = fileURLToPath(new URL('../scripts/prepare-release.ts', import.meta.url))
    const result = execFileSync(process.execPath, [script], { cwd: directory, env: { ...gitEnv, GITHUB_OUTPUT: output }, encoding: 'utf8', stdio: 'pipe' })
    expect(result).toContain('Prepared v0.1.9')
    expect(readFileSync(output, 'utf8')).toBe('version=0.1.9\n')
  })
})

// Exercise the exact multiline shell blocks from the workflow, not a second copy of the publishing logic.
const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/build.yml', import.meta.url)), 'utf8')
function runBlock(name: string): string {
  const step = workflow.split('      - name: ' + name + '\n')[1]
  if (step === undefined) throw new Error('Missing workflow step: ' + name)
  const lines = step.split('\n')
  const start = lines.indexOf('        run: |')
  if (start === -1) throw new Error('Missing multiline run block: ' + name)
  const script: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('          ')) break
    script.push(line.slice(10))
  }
  return script.join('\n')
}
const publish = runBlock('Publish versioned bundles and immutable tag atomically')
const guard = runBlock('Skip builds superseded on main')
let hasJq = true
try { execFileSync('jq', ['--version'], { stdio: 'ignore' }) } catch { hasJq = false }
function remoteFixture(): { directory: string; remote: string; source: string; output: string } {
  const fixture = sourceFixture()
  const remote = join(temporary(), 'origin.git')
  git(fixture.directory, '-c', 'init.templateDir=', 'init', '--bare', remote)
  git(fixture.directory, 'remote', 'add', 'origin', remote)
  git(fixture.directory, 'push', 'origin', 'main', '--tags')
  return { ...fixture, remote, source: git(fixture.directory, 'rev-parse', 'HEAD') }
}
function run(directory: string, script: string, extra: Record<string, string>): string {
  return execFileSync('bash', ['-e', '-o', 'pipefail', '-c', script], {
    cwd: directory, encoding: 'utf8', stdio: 'pipe',
    env: { ...gitEnv, RELEASE_VERSION: '0.1.9', RUNNER_TEMP: directory, GITHUB_STEP_SUMMARY: join(directory, '.release-summary'), ...extra },
  })
}
function advanceMain(remote: string): string {
  const other = temporary()
  git(other, '-c', 'init.templateDir=', 'clone', '--branch', 'main', remote, '.')
  git(other, 'config', 'user.name', 'Other')
  git(other, 'config', 'user.email', 'other@example.invalid')
  writeFileSync(join(other, 'new-source'), 'newer source\n')
  git(other, 'add', 'new-source')
  git(other, 'commit', '-m', 'concurrent source')
  git(other, 'push', 'origin', 'main')
  return git(other, 'rev-parse', 'HEAD')
}

describe.skipIf(!hasJq)('atomic release publishing (requires jq, preinstalled on the Actions runner)', () => {
  it('publishes a matching package version and annotated tag at the compiled commit, then refuses reuse', () => {
    const { directory, remote } = remoteFixture()
    writeFileSync(join(directory, 'lib/index.js'), 'export const built = true\n')
    rmSync(join(directory, 'lib/obsolete.d.ts'))
    run(directory, publish, {})
    const head = git(remote, 'rev-parse', 'refs/heads/main')
    expect(git(remote, 'cat-file', '-t', 'refs/tags/v0.1.9')).toBe('tag')
    expect(git(remote, 'rev-parse', 'refs/tags/v0.1.9^{}')).toBe(head)
    expect(JSON.parse(git(remote, 'show', head + ':package.json'))).toEqual({ name: 'test-plugin', version: '0.1.9', scripts: { build: 'noop' } })
    expect(git(remote, 'show', head + ':lib/index.js')).toBe('export const built = true')
    expect(() => git(remote, 'show', head + ':lib/obsolete.d.ts')).toThrow()
    expect(() => run(directory, publish, {})).toThrow()
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(head)
    expect(git(remote, 'rev-parse', 'refs/tags/v0.1.8^{}')).not.toBe(head)
  })
  it('still publishes a new patch when the compiled files have not changed', () => {
    const { directory, remote } = remoteFixture()
    run(directory, publish, {})
    expect(git(remote, 'show', 'refs/tags/v0.1.9:package.json')).toContain('"version": "0.1.9"')
    expect(git(remote, 'diff', 'v0.1.8', 'v0.1.9', '--', 'lib')).toBe('')
  })
  it('refuses a candidate older than a stable tag that advanced independently of main', () => {
    const { directory, remote, source } = remoteFixture()
    git(remote, 'tag', 'v0.1.10', source)
    git(directory, 'fetch', 'origin', 'main', '--tags')
    expect(() => run(directory, publish, {})).toThrow()
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(source)
    expect(git(remote, 'tag', '--list', 'v0.1.9')).toBe('')
  })
  it('publishes neither ref if the server rejects creation of the release tag', () => {
    const { directory, remote, source } = remoteFixture()
    mkdirSync(join(remote, 'hooks'), { recursive: true })
    writeFileSync(join(remote, 'hooks/pre-receive'), '#!/bin/sh\nwhile read old new ref; do\n  case "$ref" in refs/tags/*) exit 1 ;; esac\ndone\n', { mode: 0o755 })
    expect(() => run(directory, publish, {})).toThrow()
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(source)
    expect(git(remote, 'tag', '--list', 'v0.1.9')).toBe('')
  })
  it.each(['v0.1.9', '0.1.9-rc.1', '01.2.3'])('rejects an invalid release output without publishing: %s', version => {
    const { directory, remote, source } = remoteFixture()
    expect(() => run(directory, publish, { RELEASE_VERSION: version })).toThrow()
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(source)
    expect(git(remote, 'tag', '--list')).toBe('v0.1.8')
  })
  it('skips an outdated source revision without creating a tag', () => {
    const { directory, remote, source, output } = remoteFixture()
    const newer = advanceMain(remote)
    run(directory, guard, { SOURCE_SHA: source, GITHUB_OUTPUT: output })
    expect(readFileSync(output, 'utf8')).toBe('current=false\n')
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(newer)
    expect(git(remote, 'tag', '--list', 'v0.1.9')).toBe('')
  })
  it('publishes neither the branch nor tag if main advances after the guard', () => {
    const { directory, remote, source, output } = remoteFixture()
    run(directory, guard, { SOURCE_SHA: source, GITHUB_OUTPUT: output })
    expect(readFileSync(output, 'utf8')).toBe('current=true\n')
    const newer = advanceMain(remote)
    expect(() => run(directory, publish, {})).toThrow()
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(newer)
    expect(git(remote, 'tag', '--list', 'v0.1.9')).toBe('')
  })
  it('does not publish the branch or overwrite a tag that appears after the guard', () => {
    const { directory, remote, source, output } = remoteFixture()
    run(directory, guard, { SOURCE_SHA: source, GITHUB_OUTPUT: output })
    git(remote, 'tag', 'v0.1.9', source)
    expect(() => run(directory, publish, {})).toThrow()
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(source)
    expect(git(remote, 'rev-parse', 'refs/tags/v0.1.9')).toBe(source)
  })
})
