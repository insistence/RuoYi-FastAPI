import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeRouteParam } from '../src/utils/routeParams.js'

test('navigation decodes Chinese, delimiters and embedded URLs once', () => {
  for (const value of [
    '如何退出登录？',
    '说明 & 100% + 空格',
    'https://example.com/help?q=%E4%B8%AD%E6%96%87&a=1#intro',
  ]) {
    assert.equal(decodeRouteParam(encodeURIComponent(value)), value)
  }
})
test('missing and malformed query values do not crash the page', () => {
  assert.equal(decodeRouteParam(), '')
  assert.equal(decodeRouteParam(null), '')
  assert.equal(decodeRouteParam('说明 100%'), '说明 100%')
  assert.equal(decodeRouteParam('%E4%B8'), '%E4%B8')
})

test('webview keeps nested query encoding and rejects non-HTTP protocols', async () => {
  const { resolveWebviewUrl } = await import('../src/utils/webview.js')
  const url =
    'https://example.com/中文?q=100%25&next=https%3A%2F%2Fother.example%2F%3Fa%3D1%26b%3D2'
  assert.equal(resolveWebviewUrl(url), url)
  assert.equal(resolveWebviewUrl(encodeURIComponent(url)), url)
  for (const invalid of [
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///private',
    '//example.com',
    'https://',
    '%E4%B8',
  ]) {
    assert.equal(resolveWebviewUrl(invalid), '')
  }
})
