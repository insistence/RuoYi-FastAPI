import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const cli = join(dirname(require.resolve('@x18n/cli/package.json')), 'bin.mjs')
const plugin = new URL('../../scripts/x18n-project.mjs', import.meta.url).href

test('the CLI creates isolated plugin catalogs and scans the form designer source directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vue2-x18n-project-'))
  const run = (...args) => {
    const result = spawnSync(process.execPath, [cli, '--root', root, ...args, '--json'], {
      encoding: 'utf8',
    })
    return { status: result.status, report: JSON.parse(result.stdout) }
  }
  try {
    await writeFile(
      join(root, 'x18n.config.mjs'),
      `import project from ${JSON.stringify(plugin)};
export default {
 sourceLocale: 'zh-CN', locales: ['zh-CN', 'en-US', 'fr-FR'], presets: ['i18next'], plugins: [project],
 namespace: { separator: ':', default: 'common' },
 resources: [{ pattern: 'plugins/ai/locales/{locale}.json', namespace: 'plugin.ai' }, { pattern: 'src/i18n/locales/{locale}/{namespace}.json' }],
 usage: { include: ['src/**/*.vue', 'plugins/**/*.vue'], calls: [{ callee: '$t' }] },
 checks: { 'missing-translation': 'error', 'empty-translation': 'error' },
}`
    )
    for (const locale of ['zh-CN', 'en-US', 'fr-FR']) {
      const directory = join(root, 'src/i18n/locales', locale)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, 'common.json'), JSON.stringify({ ready: 'OK' }))
    }
    await mkdir(join(root, 'src/views/tool/build'), { recursive: true })
    await writeFile(
      join(root, 'src/views/tool/build/Example.vue'),
      `<template><div>{{ $t('common:designerMissing') }}{{ $t('plugin.ai:reply') }}</div></template>`
    )
    const payload = join(root, 'messages.json')
    await writeFile(
      payload,
      JSON.stringify({
        'zh-CN': { 'plugin.ai:reply': '回复' },
        'en-US': { 'plugin.ai:reply': 'Reply' },
        'fr-FR': { 'plugin.ai:reply': 'Répondre' },
      })
    )
    const applied = run('apply', payload)
    assert.equal(applied.status, 0, JSON.stringify(applied.report.errors))
    assert.deepEqual(
      JSON.parse(await readFile(join(root, 'plugins/ai/locales/en-US.json'), 'utf8')),
      { reply: 'Reply' }
    )
    await assert.rejects(access(join(root, 'src/i18n/locales/en-US/plugin.ai.json')))
    const checked = run('check')
    assert.equal(checked.status, 1)
    assert.ok(
      checked.report.diagnostics.some(
        (item) =>
          item.code === 'missing-key' &&
          item.key === 'common:designerMissing' &&
          item.file === 'src/views/tool/build/Example.vue'
      )
    )
    assert.ok(
      !checked.report.diagnostics.some(
        (item) => item.code === 'missing-key' && item.key === 'plugin.ai:reply'
      )
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
