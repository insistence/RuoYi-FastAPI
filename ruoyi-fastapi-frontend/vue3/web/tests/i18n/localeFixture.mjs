import { readFileSync, readdirSync } from 'node:fs'
import { createLocaleRuntime } from '../../src/i18n/runtime.mjs'

const meta = JSON.parse(readFileSync(new URL('../../src/i18n/locale-meta.json', import.meta.url)))
const resources = Object.fromEntries(
  meta.locales.map(({ code }) => [
    code,
    Object.fromEntries(
      readdirSync(new URL(`../../src/i18n/locales/${code}/`, import.meta.url))
        .filter((file) => file.endsWith('.json'))
        .map((file) => [
          file.slice(0, -5),
          JSON.parse(
            readFileSync(new URL(`../../src/i18n/locales/${code}/${file}`, import.meta.url))
          ),
        ])
    ),
  ])
)
export const testLocale = createLocaleRuntime({
  meta,
  resources,
  scope: 'fixture',
  storage: { get() {}, set() {} },
})
