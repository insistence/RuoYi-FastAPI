import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createInstance } from 'i18next'

test('consent selection counts interpolate independently in both delivered languages', async () => {
  const resources = Object.fromEntries(
    ['zh-CN', 'en-US'].map((code) => [
      code,
      {
        authCenter: JSON.parse(
          readFileSync(
            new URL(`../../src/i18n/locales/${code}/authCenter.json`, import.meta.url),
            'utf8'
          )
        ),
      },
    ])
  )
  const engine = createInstance()
  await engine.init({
    resources,
    lng: 'en-US',
    fallbackLng: false,
    interpolation: { escapeValue: false },
  })
  for (const lng of ['zh-CN', 'en-US']) {
    const text = engine.t('authCenter:selectedValueValue', { lng, selected: 1, total: 3 })
    assert.match(text, /1\s*\/\s*3/)
    assert.ok(!text.includes('{{'))
  }
})
