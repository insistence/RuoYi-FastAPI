import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toEditor, clientPayload } from '../../src/views/system/oauth/client/form.js'
test('重新打开服务应用后切换用户登录，响应类型随授权方式更新', () => {
  const values = toEditor({
    clientId: 'machine',
    grantTypes: ['client_credentials'],
    responseTypes: [],
  })
  values.grantTypes.push('authorization_code')
  values.redirectUris = ['https://app.example/callback']
  const login = clientPayload(values, 'machine')
  assert.deepEqual(login.responseTypes, ['code'])
  assert.deepEqual(login.redirectUris, ['https://app.example/callback'])
  const reopened = toEditor(login)
  reopened.grantTypes = ['client_credentials']
  assert.deepEqual(clientPayload(reopened).responseTypes, [])
  reopened.grantTypes = ['authorization_code', 'refresh_token']
  assert.deepEqual(clientPayload(reopened).responseTypes, ['code'])
  assert.deepEqual(
    toEditor({ redirectUris: 'https://a.example/cb, https://b.example/cb' }).redirectUris,
    ['https://a.example/cb', 'https://b.example/cb']
  )
  assert.deepEqual(toEditor().grantTypes, ['authorization_code', 'refresh_token'])
})
