import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const backend = new URL('../../../', import.meta.url)
const checker = fileURLToPath(new URL('../check-domains.mjs', import.meta.url))

function check(args) {
  const result = spawnSync(process.execPath, [checker, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  assert.ifError(result.error)
  assert.ok(result.stdout, result.stderr)
  return { status: result.status, domains: JSON.parse(result.stdout).domains }
}

function catalog(locale, value = 'Translated') {
  return `msgid ""
msgstr ""
"Language: ${locale}\\n"
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "plugin.only"
msgstr "${value}"

msgid "plugin.other"
msgstr "Other message"
`
}

test('real CLI isolates plugin locales and domains while retaining core calls in plugin code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ruoyi-domain-cli-'))
  const plugin = join(root, 'plugins/domain_demo')
  try {
    await mkdir(join(root, '.x18n'), { recursive: true })
    await cp(new URL('x18n.config.yml', backend), join(root, 'x18n.config.yml'))
    for (const name of ['python-domain.mjs', 'scan_python_domains.py'])
      await cp(new URL(`.x18n/${name}`, backend), join(root, '.x18n', name))
    await cp(new URL('i18n/catalogs/', backend), join(root, 'i18n/catalogs'), { recursive: true })
    await mkdir(join(plugin, 'i18n'), { recursive: true })
    await writeFile(
      join(plugin, 'i18n/locale-meta.json'),
      JSON.stringify({
        defaultLocale: 'en-US',
        locales: [{ code: 'en-US' }, { code: 'ru-RU', fallback: ['en-US'] }],
      })
    )
    for (const code of ['en-US', 'ru-RU']) {
      const directory = join(plugin, `i18n/catalogs/${code}/LC_MESSAGES`)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, 'plugin.domain_demo.po'), catalog(code))
    }
    const source = `from i18n import t
DOMAIN = 'plugin.domain_demo'
t(
    'plugin.only',
    {'value': nested('a closing ) in a string')},
    domain=DOMAIN,
)
I18nMessage('原文', msg_key='plugin.other', domain='plugin.domain_demo')
ResponseUtil.success(msg_key='common.success')
`
    await writeFile(join(plugin, 'messages.py'), source)
    let result = check(['--root', root])
    assert.equal(result.status, 0, JSON.stringify(result.domains))
    assert.deepEqual(
      result.domains.map((item) => item.domain),
      ['core', 'plugin.domain_demo']
    )
    const pluginReport = result.domains.find((item) => item.domain === 'plugin.domain_demo').report
    assert.deepEqual(pluginReport.data.projects[0].coverage.map((item) => item.locale).sort(), [
      'en-US',
      'ru-RU',
    ])
    assert.ok(
      !pluginReport.diagnostics.some(
        (item) => item.code === 'unused-key' && item.key === 'plugin.only'
      )
    )

    // 插件中默认使用 core 的调用仍须按核心词库检查。
    await writeFile(
      join(plugin, 'messages.py'),
      source.replace('common.success', 'missing.coreInPlugin')
    )
    result = check(['--root', root])
    assert.equal(result.status, 1)
    assert.ok(
      result.domains[0].report.diagnostics.some(
        (item) => item.code === 'missing-key' && item.key === 'missing.coreInPlugin'
      )
    )
    assert.equal(result.domains[1].status, 0)

    // 独立插件校验不依赖宿主词库、宿主语言或其他插件。
    await rm(join(root, 'i18n'), { recursive: true, force: true })
    result = check(['--plugin', `domain_demo=${plugin}`])
    assert.equal(result.status, 0, JSON.stringify(result.domains))
    assert.deepEqual(
      result.domains.map((item) => item.domain),
      ['plugin.domain_demo']
    )
    await writeFile(
      join(plugin, 'messages.py'),
      source + "t('missing.pluginOnly', domain=DOMAIN)\n"
    )
    result = check(['--plugin', `domain_demo=${plugin}`])
    assert.equal(result.status, 1)
    assert.ok(
      result.domains[0].report.diagnostics.some(
        (item) => item.code === 'missing-key' && item.key === 'missing.pluginOnly'
      )
    )

    await writeFile(join(plugin, 'messages.py'), source)
    await writeFile(
      join(plugin, 'i18n/catalogs/ru-RU/LC_MESSAGES/plugin.domain_demo.po'),
      catalog('ru-RU', '')
    )
    result = check(['--plugin', `domain_demo=${plugin}`])
    assert.equal(result.status, 1)
    assert.ok(
      result.domains[0].report.diagnostics.some((item) => item.code === 'empty-translation')
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
