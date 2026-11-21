import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const backend = new URL('../../../', import.meta.url)
const checker = fileURLToPath(new URL('../check-domains.mjs', import.meta.url))
const cli = fileURLToPath(new URL('../node_modules/@x18n/cli/bin.mjs', import.meta.url))

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

msgid "common.success"
msgstr "Plugin success"
`
}

test('real CLI isolates plugin locales and domains while retaining core calls in plugin code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ruoyi-domain-cli-'))
  const plugin = join(root, 'plugins/domain_demo')
  try {
    await mkdir(join(root, '.x18n'), { recursive: true })
    await cp(new URL('x18n.config.mjs', backend), join(root, 'x18n.config.mjs'))
    for (const name of ['core.mjs', 'python-domain.mjs', 'scan_python_domains.py'])
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
ResponseUtil.success(msg_key='common.success', domain=DOMAIN)
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

    // 编辑器在同一个 Python 文件中根据调用的域跳到各自的 PO，即使 msgid 相同。
    for (const [domain, usage, resource] of [
      ['core', "msg_key='common.success')", 'i18n/catalogs/en-US/LC_MESSAGES/core/common.po'],
      [
        'plugin.domain_demo',
        "msg_key='common.success', domain=DOMAIN)",
        'plugins/domain_demo/i18n/catalogs/en-US/LC_MESSAGES/plugin.domain_demo.po',
      ],
    ]) {
      const result = spawnSync(
        process.execPath,
        [cli, '--root', root, 'get', `${domain}:common.success`, '--json'],
        {
          cwd: root,
          encoding: 'utf8',
        }
      )
      assert.ifError(result.error)
      assert.equal(result.status, 0, result.stderr || result.stdout)
      const [key] = JSON.parse(result.stdout).data.projects
      assert.equal(key.messages.find((item) => item.locale === 'en-US').file, resource)
      assert.deepEqual(
        key.usages.map((item) => [item.file, item.line]),
        [
          [
            'plugins/domain_demo/messages.py',
            source.split('\n').findIndex((line) => line.includes(usage)) + 1,
          ],
        ]
      )
    }

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
