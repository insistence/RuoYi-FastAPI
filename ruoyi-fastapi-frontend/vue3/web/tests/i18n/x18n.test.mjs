import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import config from '../../x18n.config.mjs'
const require = createRequire(import.meta.url)
const cli = join(dirname(require.resolve('@x18n/cli/package.json')), 'bin.mjs')
test('the pinned x18n CLI scans framework calls and fails on broken catalogs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ruoyi-x18n-'))
  const source = { greeting: '你好，{{name}}', items_other: '{{count}} 项', routeTitle: '首页' }
  const english = {
    greeting: 'Hello, {{name}}',
    items_one: '{{count}} item',
    items_other: '{{count}} items',
    routeTitle: 'Home',
  }
  async function catalog(code, values) {
    const dir = join(root, 'locales', code)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'common.json'), JSON.stringify(values))
  }
  function check() {
    const result = spawnSync(process.execPath, [cli, '--root', root, 'check', '--json'], {
      encoding: 'utf8',
    })
    return { status: result.status, report: JSON.parse(result.stdout) }
  }
  try {
    await writeFile(
      join(root, 'x18n.config.mjs'),
      `import projectResources from ${JSON.stringify(new URL('../../scripts/x18n-project.mjs', import.meta.url).href)}; export default { ...${JSON.stringify(
        {
          ...config,
          plugins: [],
          locales: ['zh-CN', 'en-US', 'ja-JP'],
          sourceLocale: 'zh-CN',
          presets: ['i18next'],
          resources: [{ pattern: 'locales/{locale}/{namespace}.json' }],
          namespace: { separator: ':', default: 'common' },
          checks: { 'missing-translation': 'error', 'empty-translation': 'error' },
        }
      )}, plugins: [projectResources] }`
    )
    await mkdir(join(root, 'src'))
    await writeFile(
      join(root, 'src/usage.vue'),
      "<template><span>{{ $t('common:greeting', { name: 'Ada' }) }}{{ $t('common:items', { count: 2 }) }}</span></template>"
    )
    await catalog('zh-CN', source)
    await catalog('en-US', english)
    await catalog('ja-JP', {
      greeting: 'こんにちは、{{name}}',
      items_other: '{{count}} 件',
      routeTitle: 'ホーム',
    })
    await writeFile(
      join(root, 'src/routes.js'),
      "const route = { meta: { titleKey: 'common:routeTitle' } }"
    )
    let result = check()
    assert.equal(result.status, 0, JSON.stringify(result.report.errors))
    assert.equal(result.report.data.projects[0].coverage.length, 3)
    assert.ok(
      result.report.data.projects[0].coverage.every((item) => item.total > 0 && item.missing === 0)
    )
    assert.ok(!result.report.diagnostics.some((item) => item.code === 'unused-key'))
    await catalog('en-US', { items_one: english.items_one, items_other: english.items_other })
    result = check()
    assert.equal(result.status, 1)
    assert.ok(result.report.diagnostics.some((item) => item.code === 'missing-translation'))
    await catalog('en-US', { ...english, greeting: 'Hello' })
    result = check()
    assert.equal(result.status, 1)
    assert.ok(result.report.diagnostics.some((item) => item.code === 'placeholder-mismatch'))
    await writeFile(join(root, 'src/missing.js'), "t('common:missing')")
    result = check()
    assert.ok(result.report.diagnostics.some((item) => item.code === 'missing-key'))
    await writeFile(
      join(root, 'src/routes.js'),
      "const route = { meta: { titleKey: 'common:missingRoute' } }"
    )
    result = check()
    assert.ok(
      result.report.diagnostics.some(
        (item) => item.code === 'missing-key' && item.key === 'common:missingRoute'
      )
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
