import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const backend = new URL('../../../', import.meta.url)
const cli = fileURLToPath(new URL('../node_modules/@x18n/cli/bin.mjs', import.meta.url))

test('Python translation entry points are scanned with the project config', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ruoyi-python-x18n-'))
  function check() {
    const result = spawnSync(process.execPath, [cli, '--root', root, 'check', '--json'], {
      encoding: 'utf8',
    })
    assert.ifError(result.error)
    assert.ok(result.stdout, result.stderr)
    return { status: result.status, report: JSON.parse(result.stdout) }
  }

  try {
    await cp(new URL('x18n.config.yml', backend), join(root, 'x18n.config.yml'))
    await cp(new URL('i18n/catalogs/', backend), join(root, 'i18n/catalogs'), { recursive: true })
    await writeFile(
      join(root, 'messages.py'),
      `from i18n import t
from i18n.translator import I18nUtil

t('common.success')
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
    let result = check()
    assert.equal(result.status, 0, JSON.stringify(result.report))
    assert.ok(result.report.data.projects[0].coverage.every((item) => item.total > 0))
    const unused = new Set(
      result.report.diagnostics.filter((item) => item.code === 'unused-key').map((item) => item.key)
    )
    for (const key of [
      'common.success',
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
    result = check()
    assert.equal(result.status, 1)
    assert.deepEqual(
      new Set(
        result.report.diagnostics
          .filter((item) => item.code === 'missing-key')
          .map((item) => item.key)
      ),
      new Set(['missing.shortEntry', 'missing.classEntry'])
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
