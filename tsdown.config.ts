/**
 * tsdown build for `@elves-ai/dsh-llm-nowcoding`:
 * - Host half: `src/index.ts` -> `lib/index.js` (ESM, node).
 * - Browser half: `src/client/index.tsx` -> `lib/client.js`, a CJS closure
 *   factory registered through `window.__ModuleLoader__.load` under the
 *   package name.
 *
 * The Host bundle keeps every `@deepseek-ai/*` import external: the active dsh
 * profile owns those instances, and a bundled second copy would register the
 * adapter into a seam the running loop never reads. Declarations come from
 * `tsc -p tsconfig.build.json` into `lib/types`, so `clean` stays off — it must
 * never wipe that tree.
 *
 * The browser half replicates the official DSH client-bundle preset: platform
 * modules resolve through the frozen module table at runtime and everything
 * else is inlined. The purity gate rejects any non-platform `@deepseek-ai/*`
 * VALUE import, so cross-plugin collaboration goes through cordis services or
 * type-only imports. CSS Modules compile to hashed class maps and inject a
 * `<style data-plugin>` tag at factory execution.
 */
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import { builtinModules, createRequire } from 'node:module'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const require = createRequire(import.meta.url)

const PACKAGE_NAME = '@elves-ai/dsh-llm-nowcoding'

/** Node builtins must never survive into the browser module-loader factory. */
const NODE_BUILTINS = new Set([...builtinModules, ...builtinModules.map(id => 'node:' + id)])

/** Module specifiers the web shell shares into the frozen module table. */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'cordis',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-runtime/client',
]

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** The style-injection prologue shared by every CSS Modules load. */
function injectTag(pluginId: string, fileId: string, cssText: string): string {
  const tagId = pluginId + '/' + basename(fileId)
  return [
    'const css = ' + JSON.stringify(cssText) + ';',
    'const tagId = ' + JSON.stringify(tagId) + ';',
    "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
    "  const tag = document.createElement('style');",
    '  tag.dataset.plugin = ' + JSON.stringify(pluginId) + ';',
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
  ].join('\n')
}

type BuildPlugin = NonNullable<UserConfig['plugins']>

/** Reject Node builtins and non-platform `@deepseek-ai/*` value imports. */
function purityGatePlugin(): BuildPlugin {
  return {
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (NODE_BUILTINS.has(source)) {
        throw new Error('client bundle purity: Node builtin "' + source + '" cannot run in the browser module table')
      }
      if (!source.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(source)) return null
      throw new Error('client bundle purity: "' + source + '" is not a platform module')
    },
  }
}

/** Compile CSS Modules into class maps plus an injected `<style data-plugin>` tag. */
function makeCssPlugin(pluginId: string): BuildPlugin {
  return {
    name: 'dsh-css-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.css')) return null
      const abs = importer === undefined ? source : resolvePath(dirname(importer), source)
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: 'nowcoding_[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
      return injectTag(pluginId, fileId, code.toString()) + '\nexport default ' + JSON.stringify(classMap) + ';'
    },
  }
}

export default [
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2023',
    fixedExtension: false,
    dts: false,
    sourcemap: true,
    clean: false,
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [...CLIENT_EXTERNALS],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    inputOptions: { resolve: { conditionNames: ['browser', 'import', 'require', 'default'] } },
    noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    plugins: [purityGatePlugin(), makeCssPlugin(PACKAGE_NAME)],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(PACKAGE_NAME) + ', factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      codeSplitting: false,
    },
  },
] satisfies UserConfig[]
