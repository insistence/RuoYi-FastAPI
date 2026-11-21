import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { checkLocaleRegistration } from '../../scripts/check-i18n.mjs'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ruoyi-message-shapes-'))
  const url = pathToFileURL(root + sep)
  const write = async (file, content) => {
    const path = join(root, file)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content)
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
  await write('src/i18n/locale-meta.json', JSON.stringify(metadata(['zh-CN', 'en-US'])))
  for (const code of ['zh-CN', 'en-US']) {
    await write(
      `src/i18n/locales/${code}/common.json`,
      JSON.stringify({ ready: code, branch: { leaf: code }, list: [code] })
    )
  }
  // A host language must not become an implicit requirement of the plugin.
  await write('plugins/example/locale-meta.json', JSON.stringify(metadata(['zh-CN'])))
  await write('plugins/example/locales/zh-CN.json', JSON.stringify({ ready: '插件' }))
  return { root, url, write }
}

test('literal string messages pass and comments, examples and missing keys remain separate concerns', async () => {
  const { root, url, write } = await fixture()
  try {
    await write(
      'src/Example.jsx',
      `// t('common:branch')
const example = "t('common:list')";
export const render = () => <span>{t('common:branch.leaf')}{t('common:missing')}</span>;
const dynamic = 'common:' + name; t(dynamic);`
    )
    await write(
      'src/Example.vue',
      `<template><div :title="$t('common:ready')">{{ t('common:branch.leaf') }}</div></template>
<script>this.$t('common:ready'); i18n.t('common:ready')</script>`
    )
    assert.deepEqual(await checkLocaleRegistration(url), [
      { name: 'host', locales: ['zh-CN', 'en-US'] },
      { name: 'plugin.example', locales: ['zh-CN'] },
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

for (const locale of ['zh-CN', 'en-US']) {
  for (const [shape, message] of [
    ['object', { nested: 'text' }],
    ['array', ['text']],
  ]) {
    test(`rejects ${locale} ${shape} messages referenced from Vue templates and JS calls`, async () => {
      const { root, url, write } = await fixture()
      try {
        for (const code of ['zh-CN', 'en-US']) {
          await write(
            `src/i18n/locales/${code}/common.json`,
            JSON.stringify({ ready: 'OK', invalid: code === locale ? message : 'Valid string' })
          )
        }
        await write('src/script.js', "this.$t('common:invalid')")
        await write(
          'src/views/tool/build/Example.vue',
          `<template><span>{{ $t('common:invalid') }}</span></template>`
        )
        await assert.rejects(checkLocaleRegistration(url), (error) => {
          assert.match(error.message, /Invalid translation message shape/)
          assert.ok(error.message.includes(`common:invalid resolves to ${shape} in ${locale}`))
          assert.ok(error.message.includes('src/script.js:1'))
          assert.ok(error.message.includes('src/views/tool/build/Example.vue:1'))
          assert.equal(error.message.includes(locale === 'zh-CN' ? 'in en-US' : 'in zh-CN'), false)
          return true
        })
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    })
  }
}
