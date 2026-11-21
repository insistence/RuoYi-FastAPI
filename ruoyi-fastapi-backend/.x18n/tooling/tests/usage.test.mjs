import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const backend = new URL('../../../', import.meta.url)
const cli = fileURLToPath(new URL('../node_modules/@x18n/cli/bin.mjs', import.meta.url))

test('Python translation entry points are scanned with the project config', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ruoyi-python-x18n-'))
  function check() {
    const config = join(root, '.x18n/core.mjs')
    const result = spawnSync(
      process.execPath,
      [cli, '--root', root, '--config', config, 'check', '--json'],
      {
        encoding: 'utf8',
      }
    )
    assert.ifError(result.error)
    assert.ok(result.stdout, result.stderr)
    return { status: result.status, report: JSON.parse(result.stdout) }
  }

  try {
    await mkdir(join(root, '.x18n'), { recursive: true })
    for (const name of ['core.mjs', 'python-domain.mjs', 'scan_python_domains.py'])
      await cp(new URL(`.x18n/${name}`, backend), join(root, '.x18n', name))
    await cp(new URL('i18n/catalogs/', backend), join(root, 'i18n/catalogs'), { recursive: true })
    const scaffold = join(root, 'cli/runtime/plugin/scaffold')
    await mkdir(scaffold, { recursive: true })
    for (const name of ['frontend.py', 'frontend_vue2.py', 'frontend_react.py']) {
      await cp(new URL(`cli/runtime/plugin/scaffold/${name}`, backend), join(scaffold, name))
    }
    await writeFile(
      join(root, 'messages.py'),
      `from i18n import t
from i18n.translator import I18nUtil

t('common.success')
t('generated.sample.order.created')
t("common.failure", locale='en-US')
I18nUtil.translate('common.error')
I18nUtil.translate("common.forbidden")
t(
    'common.unavailable',
    locale='en-US',
)
ResponseUtil.success(msg_key='profile.localeSaved')
my_t('missing.otherFunction')
item.t('missing.otherObject')
OtherI18nUtil.translate('missing.otherClass')
t('missing.' + suffix)
t(f'missing.{suffix}')
`
    )
    // 生成模块和内置模块使用同一个 core 域；新增分片不需要修改扫描配置。
    const modulePath = (code) =>
      join(root, 'i18n/catalogs', code, 'LC_MESSAGES/core/generated.sample.order.po')
    function moduleCatalog(code, translation) {
      return `msgid ""
msgstr ""
"Language: ${code}\\n"
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "generated.sample.order.created"
msgstr "${translation}"
`
    }
    await writeFile(modulePath('zh-CN'), moduleCatalog('zh-CN', '订单已创建'))
    const missingModule = check()
    assert.equal(missingModule.status, 1, JSON.stringify(missingModule.report))
    assert.ok(
      missingModule.report.diagnostics.some(
        (item) =>
          item.code === 'missing-translation' &&
          item.key === 'generated.sample.order.created' &&
          item.message.includes('en-US')
      )
    )
    await writeFile(modulePath('en-US'), moduleCatalog('en-US', 'Order created'))
    let result = check()
    assert.equal(result.status, 0, JSON.stringify(result.report))
    assert.ok(result.report.data.projects[0].coverage.every((item) => item.total > 0))
    const unused = new Set(
      result.report.diagnostics.filter((item) => item.code === 'unused-key').map((item) => item.key)
    )
    for (const key of [
      'common.success',
      'generated.sample.order.created',
      'common.failure',
      'common.error',
      'common.forbidden',
      'common.unavailable',
      'profile.localeSaved',
    ]) {
      assert.ok(!unused.has(key), `Usage was not found: ${key}`)
    }

    await writeFile(
      join(root, 'missing.py'),
      `t('missing.shortEntry')\nI18nUtil.translate("missing.classEntry")\n`
    )
    await writeFile(
      join(scaffold, 'backend.py'),
      `ResponseUtil.failure(msg_key='missing.scaffoldBackend')\n`
    )
    result = check()
    assert.equal(result.status, 1)
    assert.deepEqual(
      new Set(
        result.report.diagnostics
          .filter((item) => item.code === 'missing-key')
          .map((item) => item.key)
      ),
      new Set(['missing.shortEntry', 'missing.classEntry', 'missing.scaffoldBackend'])
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
