import assert from 'node:assert/strict'
import * as gates from '../../src/utils/pluginCapabilities.js'


import { getPluginReleaseView } from '../../src/utils/pluginReleaseFormatter.js'

const plugin = {
  source: 'artifact',
  enabled: '0',
  release: {
    status: 'pending_restart',
    prepareStatus: 'prepared',
    healthyWorkers: 0,
    disabledWorkers: 0,
    liveWorkers: 0,
    expectedWorkers: 2,
    missingWorkers: 2,
    mismatchWorkers: 0,
    staleWorkers: 0,
    failedWorkers: 0,
    restartRequired: true,
  },
}
const view = () => getPluginReleaseView(plugin)
assert.equal(view().label, '等待重启')
assert.equal(view().workerSummary, '已就绪 0 · 在线 0 / 预期 2')
assert.equal(view().preparationLabel, '准备完成')
assert.equal(view().restartRequired, true)

plugin.release.status = 'partial'
plugin.release.liveWorkers = 2
plugin.release.healthyWorkers = 1
plugin.release.mismatchWorkers = 1
assert.equal(view().label, '部分生效')
assert.equal(view().tagType, 'warning')
assert.equal(view().counts.mismatch, '1')
assert.match(view().workerSummary, /^已就绪 1/)

plugin.release.status = 'active'
plugin.release.healthyWorkers = 2
plugin.release.restartRequired = false
assert.equal(view().label, '已生效')
assert.equal(view().tagType, 'success')
assert.equal(view().restartRequired, false)

plugin.enabled = '1'
plugin.release.status = 'disabled'
plugin.release.healthyWorkers = 0
plugin.release.disabledWorkers = 2
assert.equal(view().label, '已停用')
assert.equal(view().workerSummary, '已停用 2 · 在线 2 / 预期 2')

plugin.release.verificationError = '公钥已撤销'
plugin.release.lastError = 'older maintenance failure'
assert.equal(view().label, '验证失败', 'signature failure must not retain a healthy label')
assert.equal(view().tagType, 'danger')
assert.equal(view().error, '公钥已撤销')

const missing = getPluginReleaseView({ source: 'artifact' })
assert.equal(missing.label, '状态未知')
assert.equal(missing.unavailable, true)
assert.equal(missing.workerSummary, '已就绪 未知 · 在线 未知 / 预期 未知')
assert.equal(missing.restartRequired, false)
for (const value of [undefined, null, -1, NaN, '2', true]) {
  assert.equal(getPluginReleaseView({ release: { healthyWorkers: value } }).counts.healthy, '未知')
}
assert.equal(getPluginReleaseView({ release: { status: 'no_target' } }).label, '未选择目标')
assert.equal(
  getPluginReleaseView({ release: { status: 'failed', prepareStatus: 'failed' } }).preparationLabel,
  '准备失败'
)
assert.equal(getPluginReleaseView({ release: { status: 'new_server_state' } }).label, '状态未知')
assert.equal(
  getPluginReleaseView({ release: { lastError: 'failed preparation' } }).error,
  'failed preparation'
)

// 执行页面的真实操作限制：即使旧版接口响应缺少能力元数据，制品记录也应保持只读。
for (const status of ['discovered', 'installed', 'pending_upgrade', 'error']) {
  const artifact = { source: 'artifact', enabled: '0', installedVersion: '1.0.0', status }
  assert.equal(gates.canSelectForBatch(artifact), false)
  assert.equal(gates.canInstall(artifact), false)
  assert.equal(gates.canUpgrade(artifact), false)
  assert.equal(gates.canUninstall(artifact), false)
  for (const operation of ['install', 'upgrade', 'enable', 'disable', 'uninstall']) {
    assert.equal(gates.isOperationBlocked(artifact, operation), true)
  }
}
const local = { source: 'local', status: 'discovered' }
assert.equal(gates.canSelectForBatch(local), true)
assert.equal(gates.canInstall(local), true)
assert.equal(gates.isOperationBlocked(local, 'install'), false)

