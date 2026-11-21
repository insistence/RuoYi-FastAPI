import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createInstance } from 'i18next'
import { localeRequestHeaders } from '../../src/utils/transportLocale.mjs'

function loadSource(name, bindings, names) {
  const source = readFileSync(new URL(`../../src/utils/${name}.js`, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '')
    .replace(/\bexport (?=(?:async )?function)/g, '')
  return new Function(...Object.keys(bindings), source + `\nreturn {${names.join(',')}}`)(
    ...Object.values(bindings)
  )
}

test('policy, public key and key retry keep the original language without forwarding credentials', async () => {
  const values = new Map()
  const calls = []
  let policyReply
  const platform = {
    getStorageSync: (key) => values.get(key),
    setStorageSync: (key, value) => values.set(key, value),
    removeStorageSync: (key) => values.delete(key),
    request(options) {
      calls.push(options)
      if (options.url.endsWith('/frontend-config'))
        policyReply = () =>
          options.success({
            data: {
              code: 200,
              data: {
                transportCryptoActive: true,
                configExpireAt: Math.floor(Date.now() / 1000) + 600,
              },
            },
          })
      else queueMicrotask(() => options.success({ data: { code: 500 } }))
    },
  }
  const engine = createInstance()
  await engine.init({
    lng: 'en-US',
    resources: {
      'en-US': {
        utility: JSON.parse(
          readFileSync(new URL('../../src/i18n/locales/en-US/utility.json', import.meta.url))
        ),
      },
    },
  })
  const bindings = {
    localeRequestHeaders,
    uni: platform,
    Taro: platform,
    config: { baseUrl: 'https://api.example.test' },
    getStorage: platform.getStorageSync,
    setStorage: platform.setStorageSync,
    removeStorage: platform.removeStorageSync,
    translateMessage: (key, fallback, options) =>
      engine.t(key, { defaultValue: fallback, ...options }),
    forge: {},
    primeForgeRandomBytes() {},
  }
  const policy = loadSource('transportCryptoPolicy', bindings, [
    'ensureTransportCryptoPolicyLoaded',
    'getTransportCryptoPolicy',
    'getTransportRequestPath',
    'shouldEncryptQuery',
    'shouldEncryptRequest',
    'shouldEncryptResponse',
  ])
  const crypto = loadSource('transportCrypto', { ...bindings, ...policy }, [
    'encryptTransportRequest',
    'resetTransportRequestConfig',
    'invalidateTransportKeyMeta',
    'shouldRetryTransportWithFreshKey',
  ])
  const original = {
    'Accept-Language': 'en-US',
    Authorization: 'Bearer secret',
  }
  const config = {
    url: '/login',
    method: 'post',
    data: { username: 'example' },
    header: { ...original },
  }
  const pending = crypto.encryptTransportRequest(config)
  // A concurrent UI switch must not change the headers of this request's remaining bootstrap work.
  original['Accept-Language'] = 'zh-CN'
  policyReply()
  await assert.rejects(pending, /Could not retrieve the transport public key/)
  for (const msgKey of ['transport.decryptFailed', 'transport.keyExpired']) {
    assert.equal(crypto.shouldRetryTransportWithFreshKey({ data: { msgKey } }), true)
    assert.equal(crypto.shouldRetryTransportWithFreshKey({ response: { data: { msgKey } } }), true)
  }
  assert.equal(
    crypto.shouldRetryTransportWithFreshKey({ data: { msg: 'Decryption failed' } }),
    false
  )
  crypto.invalidateTransportKeyMeta()
  crypto.resetTransportRequestConfig(config)
  await assert.rejects(
    crypto.encryptTransportRequest(config),
    /Could not retrieve the transport public key/
  )
  assert.equal(calls.length, 3)
  assert.ok(calls[0].url.endsWith('/frontend-config'))
  assert.ok(calls.slice(1).every((call) => call.url.endsWith('/public-key')))
  for (const call of calls) assert.deepEqual(call.header, { 'Accept-Language': 'en-US' })
  assert.equal(config.header.Authorization, 'Bearer secret')
  assert.deepEqual(localeRequestHeaders({ 'accept-language': 'zh-CN', Cookie: 'secret' }), {
    'Accept-Language': 'zh-CN',
  })
})
