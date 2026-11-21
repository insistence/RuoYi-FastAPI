import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

test('the copied bridge SDK imports without host modules', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ruoyi-vue3-plugin-sdk-'))
  try {
    const file = join(directory, 'pluginBridge.mjs')
    await copyFile(new URL('../../src/utils/pluginBridge.js', import.meta.url), file)
    const sdk = await import(pathToFileURL(file).href)
    assert.equal(typeof sdk.createPluginClient, 'function')
    assert.equal(typeof sdk.setPluginBridgeTranslator, 'function')
    sdk.setPluginBridgeTranslator((key) => key)
    assert.throws(() => sdk.validatePluginApiPath('../invalid'))
    sdk.setPluginBridgeTranslator(undefined)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
