import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import LocaleForms from '../../src/i18n/forms.js'
import { resolveRuleMessages } from '../../src/i18n/validation.mjs'

const require = createRequire(import.meta.url)
const elementRequire = createRequire(require.resolve('element-ui/package.json'))
const ValidatorModule = elementRequire('async-validator')
const Validator = ValidatorModule.default || ValidatorModule

function errors(rules, model) {
  return new Promise((resolve) => {
    new Validator(rules).validate(model, (failures) => resolve(failures || []))
  })
}

test('Element UI receives translated error strings on every validation', async () => {
  let locale = 'zh-CN'
  const messages = { 'zh-CN': '请输入密钥编号', 'en-US': 'Enter a key ID' }
  const rule = Object.freeze({ required: true, message: () => messages[locale], trigger: 'blur' })
  let mixin
  LocaleForms.install({ mixin: (value) => (mixin = value) })
  const field = { $options: { name: 'ElFormItem' }, getRules: () => [rule] }
  mixin.created.call(field)
  assert.equal((await errors({ kid: field.getRules() }, { kid: '' }))[0].message, messages['zh-CN'])
  locale = 'en-US'
  assert.equal((await errors({ kid: field.getRules() }, { kid: '' }))[0].message, messages['en-US'])
  assert.deepEqual(await errors({ kid: field.getRules() }, { kid: 'primary-2026' }), [])
  assert.equal(typeof rule.message, 'function')
  assert.equal(field.getRules()[0].trigger, 'blur')
})

test('nested and array rules keep validators and values while translating messages', async () => {
  const pattern = /^[a-z]+$/
  const validator = (_rule, value, callback) => callback(value === 'kept' ? undefined : 'invalid')
  const source = {
    type: 'object',
    fields: {
      name: { pattern, message: () => 'Letters only' },
      tags: { type: 'array', defaultField: { required: true, message: () => 'Enter a tag' } },
      custom: { validator },
    },
  }
  const normalized = resolveRuleMessages(source)
  assert.equal(normalized.fields.name.pattern, pattern)
  assert.equal(normalized.fields.custom.validator, validator)
  assert.equal(typeof source.fields.name.message, 'function')
  assert.equal(typeof source.fields.tags.defaultField.message, 'function')
  const model = { profile: { name: '123', tags: [''], custom: 'kept' } }
  const before = structuredClone(model)
  const failures = await errors({ profile: normalized }, model)
  assert.deepEqual(failures.map((failure) => failure.message).sort(), [
    'Enter a tag',
    'Letters only',
  ])
  assert.deepEqual(model, before)
})
