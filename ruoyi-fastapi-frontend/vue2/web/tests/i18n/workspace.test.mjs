import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, dirname, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { checkLocaleRegistration } from '../../scripts/check-i18n.mjs'

const require = createRequire(import.meta.url)
const cli = join(dirname(require.resolve('@x18n/cli/package.json')), 'bin.mjs')

test('host and plugin checks use independent declared language sets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ruoyi-plugin-locales-'))
  const rootUrl = pathToFileURL(root + sep)
  const write = async (file, text) => {
    const path = join(root, file)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, text)
  }
  const metadata = (codes) => ({
    sourceLocale: 'zh-CN',
    defaultLocale: 'zh-CN',
    locales: codes.map((code) => ({
      code,
      enabled: true,
      aliases: [],
      fallback: [],
      direction: 'ltr',
    })),
  })
  try {
    for (const file of [
      'x18n.config.mjs',
      'src/i18n/x18n.config.mjs',
      'plugins/ai/x18n.config.mjs',
    ]) {
      const original = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8')
      const finder = new URL('../../scripts/x18n-project.mjs', import.meta.url).href
      await write(
        file,
        original.replace("'../../scripts/x18n-project.mjs'", JSON.stringify(finder))
      )
    }
    await write('src/i18n/locale-meta.json', JSON.stringify(metadata(['zh-CN', 'en-US', 'ja-JP'])))
    await write('plugins/ai/locale-meta.json', JSON.stringify(metadata(['zh-CN', 'en-US'])))
    for (const code of ['zh-CN', 'en-US', 'ja-JP'])
      await write(`src/i18n/locales/${code}/common.json`, JSON.stringify({ greeting: code }))
    for (const code of ['zh-CN', 'en-US'])
      await write(`plugins/ai/locales/${code}.json`, JSON.stringify({ greeting: code }))
    await write('src/example.js', "t('common:greeting')")
    await write('plugins/ai/views/example.js', "t('plugin.ai:greeting')")
    const projects = await checkLocaleRegistration(rootUrl)
    assert.deepEqual(
      projects.map((project) => project.locales.length),
      [3, 2]
    )
    const check = () => {
      const result = spawnSync(process.execPath, [cli, '--root', root, 'check', '--json'], {
        encoding: 'utf8',
      })
      return { status: result.status, report: JSON.parse(result.stdout) }
    }
    const valid = check()
    assert.equal(valid.status, 0, JSON.stringify(valid.report))
    assert.deepEqual(
      valid.report.data.projects.map((project) => [project.name, project.coverage.length]),
      [
        ['plugins/ai', 2],
        [basename(root), 3],
      ]
    )
    await write(
      'plugins/ai/locale-meta.json',
      JSON.stringify(metadata(['zh-CN', 'en-US', 'ja-JP']))
    )
    await assert.rejects(checkLocaleRegistration(rootUrl), /ja-JP/)
    await write('plugins/ai/locales/ja-JP.json', JSON.stringify({ greeting: '' }))
    const missing = check()
    assert.equal(missing.status, 1)
    assert.ok(
      missing.report.diagnostics.some(
        (item) => item.code === 'empty-translation' && item.locale === 'ja-JP'
      )
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
