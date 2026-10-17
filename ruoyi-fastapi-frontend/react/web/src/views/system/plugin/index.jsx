import TableActions, { TableAction } from '@/components/TableActions'
import {
  SearchOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  ApiOutlined,
  UploadOutlined,
  AuditOutlined,
} from '@ant-design/icons'
import './components/style.css'
import { canSelectForBatch } from '@/utils/pluginCapabilities'
import { useEffect, useRef, useState } from 'react'
import { Button, Form, Input, Select, Space, Switch, Tooltip } from 'antd'
import Table from '@/components/Table'
import * as api from '@/api/system/plugin'
import {
  normalizePluginActionResult,
  normalizePluginBatchResponse,
  normalizePluginPlanResponse,
} from '@/utils/pluginPlanFormatter'
import { useDict } from '@/utils/dict'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import { confirm, message } from '@/plugins/modal'
import {
  buildErrorActionResult,
  buildErrorBatchResult,
  canExecuteActionResult,
  canInstall,
  canUninstall,
  canUpgrade,
  formatPluginIdsForDisplay,
  formatPluginOperation,
  formatPluginTime,
  getCapabilityReason,
  getDependencyPolicyReason,
  getErrorMessage,
  getStatusLabel,
  getStatusTagType,
  isCapabilityOperationBlocked,
  isOperationBlocked,
  isOrphanPlugin,
  isUserCancel,
  pluginStatusOptions,
  serializeError,
} from './formatter'
import PluginActionDialog from './components/PluginActionDialog'
import PluginConfigDialog from './components/PluginConfigDialog'
import PluginDependencyDialog from './components/PluginDependencyDialog'
import PluginDetailDialog from './components/PluginDetailDialog'
import PluginDiagnosticDialog from './components/PluginDiagnosticDialog'
import PluginOperationLogDrawer from './components/PluginOperationLogDrawer'
import PluginPlanDialog from './components/PluginPlanDialog'
import PluginTag from './components/PluginTag'
import PluginReleaseStatus from './components/PluginReleaseStatus'

const actionRequests = {
  install: api.installPlugin,
  upgrade: api.upgradePlugin,
  uninstall: api.uninstallPlugin,
  purge: api.purgePlugin,
}
const actionLabels = {
  install: '安装',
  upgrade: '升级',
  uninstall: '卸载',
  purge: '清理孤儿元数据',
  enable: '启用',
  disable: '停用',
}
export default function Plugin() {
  const { plugin_operation_type } = useDict('plugin_operation_type'),
    [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [data, setData] = useState({ rows: [], total: 0 }),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [selected, setSelected] = useState([]),
    [revision, setRevision] = useState(0)
  const [detail, setDetail] = useState(),
    [migrations, setMigrations] = useState([]),
    [migrationLoading, setMigrationLoading] = useState(false),
    [action, setAction] = useState(),
    [actionLoading, setActionLoading] = useState(false),
    [config, setConfig] = useState(),
    [configLoading, setConfigLoading] = useState(false),
    [configRevision, setConfigRevision] = useState(0),
    configRequest = useRef(0),
    detailRequest = useRef(0)
  const [dependency, setDependency] = useState(),
    [dependencyLoading, setDependencyLoading] = useState(false),
    [diagnostic, setDiagnostic] = useState(),
    [diagnosticLoading, setDiagnosticLoading] = useState(false),
    [plan, setPlan] = useState(),
    [batch, setBatch] = useState(normalizePluginBatchResponse({})),
    [planLoading, setPlanLoading] = useState(false),
    [continueOnError, setContinueOnError] = useState(false),
    [auditOpen, setAuditOpen] = useState(false)
  const refresh = () => setRevision((value) => value + 1),
    operationLabel = (value) => formatPluginOperation(value, plugin_operation_type)
  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .listPlugin(query)
      .then((result) => active && setData(result))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query, revision])
  useEffect(
    () => () => {
      configRequest.current++
      detailRequest.current++
    },
    []
  )
  function showAction(title, result, pending) {
    const normalized = normalizePluginActionResult(result)
    setAction({
      title,
      result: normalized,
      pending: canExecuteActionResult(normalized) ? pending : undefined,
    })
  }
  async function toggle(row, enabled) {
    const operation = enabled ? 'enable' : 'disable'
    if (isOperationBlocked(row, operation))
      return message.warning(getCapabilityReason(row.capability))
    try {
      await confirm(`确认${enabled ? '启用' : '停用'}「${row.pluginName}」插件吗？`)
      await (enabled ? api.enablePlugin : api.disablePlugin)(row.pluginId)
      message.success('操作成功')
      refresh()
    } catch (error) {
      if (!isUserCancel(error))
        showAction(
          `插件${actionLabels[operation]}失败`,
          buildErrorActionResult(error, { pluginId: row.pluginId, operation })
        )
    }
  }
  async function loadMigrations(pluginId, request = detailRequest.current) {
    setMigrationLoading(true)
    try {
      const result = await api.listPluginMigrations(pluginId)
      if (request === detailRequest.current) setMigrations(result.data?.migrations || [])
    } catch {
    } finally {
      if (request === detailRequest.current) setMigrationLoading(false)
    }
  }
  async function showDetail(row) {
    const current = ++detailRequest.current
    setMigrations([])
    try {
      const result = await api.getPlugin(row.pluginId)
      if (current !== detailRequest.current) return
      setDetail(result.data)
      loadMigrations(row.pluginId, current)
    } catch {}
  }
  async function markMigration(row, success) {
    try {
      await confirm(
        `确认将「${row.migrationPath}」标记为${success ? '执行成功' : '失败并允许后续重试'}吗？`
      )
      setMigrationLoading(true)
      await (success ? api.markPluginMigrationSuccess : api.markPluginMigrationFailed)(
        detail.pluginId,
        {
          migrationPath: row.migrationPath,
          note: `管理页人工标记为${success ? '成功' : '失败'}`,
        }
      )
      message.success('Migration 状态已更新')
      await loadMigrations(detail.pluginId)
      refresh()
    } catch {
    } finally {
      setMigrationLoading(false)
    }
  }
  async function showConfig(row) {
    const current = ++configRequest.current
    setConfigLoading(true)
    try {
      const result = await api.getPluginConfig(row.pluginId)
      if (current === configRequest.current) {
        setConfig({
          pluginId: row.pluginId,
          title: `${row.pluginName}配置`,
          items: result.data?.configs || [],
        })
        setConfigRevision((value) => value + 1)
      }
    } catch {
    } finally {
      if (current === configRequest.current) setConfigLoading(false)
    }
  }
  async function saveConfig(values) {
    const current = ++configRequest.current
    setConfigLoading(true)
    try {
      const result = await api.updatePluginConfig(config.pluginId, { values })
      if (current === configRequest.current) {
        message.success('插件配置已保存')
        setConfig((previous) => ({
          ...previous,
          items: result.data?.configs || previous.items,
        }))
        setConfigRevision((value) => value + 1)
      }
    } catch {
    } finally {
      if (current === configRequest.current) setConfigLoading(false)
    }
  }
  async function showDependencies(row) {
    setDependencyLoading(true)
    try {
      const result = await api.checkPluginDependencies(row.pluginId)
      setDependency({ pluginId: row.pluginId, result: result.data || {} })
    } catch (error) {
      setDependency({
        pluginId: row.pluginId,
        result: {
          ok: false,
          message: getErrorMessage(error),
          dependencies: [],
          plan: [],
        },
      })
    } finally {
      setDependencyLoading(false)
    }
  }
  async function installDependencies(dryRun) {
    const result = dependency.result
    if (isCapabilityOperationBlocked(result.capability, 'dependency_install'))
      return message.warning(getCapabilityReason(result.capability))
    if (!dryRun && result.policy?.allowed === false)
      return message.warning(getDependencyPolicyReason(result.policy))
    try {
      if (!dryRun) await confirm(`确认安装「${dependency.pluginId}」插件的缺失依赖吗？`)
      setDependencyLoading(true)
      const response = await api.installPluginDependencies(dependency.pluginId, dryRun)
      setDependency((previous) => ({
        ...previous,
        result: response.data || {},
      }))
      if (!dryRun) message.success('插件依赖安装完成')
    } catch {
    } finally {
      setDependencyLoading(false)
    }
  }
  async function check(row) {
    setActionLoading(true)
    try {
      const result = await api.checkPlugin(row.pluginId)
      showAction('插件检查结果', result.data)
    } catch (error) {
      showAction(
        '插件检查失败',
        buildErrorActionResult(error, {
          pluginId: row.pluginId,
          operation: 'check',
        })
      )
    } finally {
      setActionLoading(false)
    }
  }
  async function diagnose(row, health) {
    const title = `${row.pluginName}${health ? '健康检查' : '诊断包'}`
    setDiagnostic({ title, result: { pluginId: row.pluginId } })
    setDiagnosticLoading(true)
    try {
      const result = await (health ? api.healthPlugin : api.diagnosePlugin)(row.pluginId)
      setDiagnostic({ title, result: result.data || {} })
    } catch (error) {
      setDiagnostic({
        title,
        result: {
          ok: false,
          pluginId: row.pluginId,
          message: getErrorMessage(error),
          error: serializeError(error),
        },
      })
    } finally {
      setDiagnosticLoading(false)
    }
  }
  async function preview(row, type) {
    if (isOperationBlocked(row, type)) return message.warning(getCapabilityReason(row.capability))
    setActionLoading(true)
    try {
      const result = await actionRequests[type](row.pluginId, true)
      showAction(`插件${actionLabels[type]}预演`, result.data, {
        type,
        label: actionLabels[type],
        pluginId: row.pluginId,
        pluginName: row.pluginName,
      })
    } catch (error) {
      showAction(
        `插件${actionLabels[type]}预演失败`,
        buildErrorActionResult(error, {
          pluginId: row.pluginId,
          operation: type,
        })
      )
    } finally {
      setActionLoading(false)
    }
  }
  async function executeAction() {
    const pending = action?.pending
    if (!pending) return
    try {
      await confirm(`确认执行「${pending.pluginName}」插件${pending.label}吗？`)
      setActionLoading(true)
      const result = await actionRequests[pending.type](pending.pluginId, false)
      showAction(`插件${pending.label}结果`, result.data)
      message.success(`插件${pending.label}完成`)
      refresh()
    } catch (error) {
      if (!isUserCancel(error))
        showAction(
          `插件${pending.label}失败`,
          buildErrorActionResult(error, {
            pluginId: pending.pluginId,
            operation: pending.type,
          })
        )
    } finally {
      setActionLoading(false)
    }
  }
  async function createPlan(operation) {
    if (!selected.length) return
    setPlanLoading(true)
    setBatch(normalizePluginBatchResponse({}))
    try {
      const result = await api.planPlugins(operation, selected)
      setPlan(normalizePluginPlanResponse(result.data))
    } catch {
    } finally {
      setPlanLoading(false)
    }
  }
  async function executePlan() {
    if (!plan?.ok || !plan.executablePluginIds.length) return
    try {
      await confirm(
        `确认批量执行插件${operationLabel(plan.operation)}吗？目标：${plan.executablePluginIds.join(', ')}`
      )
      setPlanLoading(true)
      const result = await api.batchPlugins(
        plan.operation,
        plan.executablePluginIds,
        false,
        continueOnError
      )
      setBatch(normalizePluginBatchResponse(result.data))
      setPlan(normalizePluginPlanResponse(result.data))
      message.success(result.data?.message || '插件批量操作完成')
      refresh()
    } catch (error) {
      if (!isUserCancel(error))
        setBatch(
          normalizePluginBatchResponse(
            buildErrorBatchResult(error, plan.operation, plan.executablePluginIds)
          )
        )
    } finally {
      setPlanLoading(false)
    }
  }
  function switchBlocked(row) {
    return (
      (row.status === 'error' && row.enabled !== '0') ||
      isOperationBlocked(row, row.enabled === '0' ? 'disable' : 'enable')
    )
  }
  function switchTooltip(row) {
    if (row.source === 'artifact')
      return '签名制品须在停机维护窗口通过 release enable/disable 修改启停设置，再启动全部 worker'
    if (row.status === 'error')
      return row.enabled === '0'
        ? '插件当前被异常状态隔离；关闭开关可取消自动恢复意图'
        : '插件处于异常状态，请重新安装或升级修复，不能直接启用'
    return switchBlocked(row) ? getCapabilityReason(row.capability) : ''
  }
  const columns = [
    { align: 'center', title: '插件ID', dataIndex: 'pluginId', width: 120 },
    { align: 'center', title: '插件名称', dataIndex: 'pluginName', width: 140 },
    { align: 'center', title: '代码版本', dataIndex: 'version', width: 100 },
    {
      align: 'center',
      title: '已安装版本',
      dataIndex: 'installedVersion',
      width: 110,
      render: (value) => value || '-',
    },
    {
      align: 'center',
      title: '启用设置',
      width: 90,
      render: (_, row) => (
        <HasPermi value={['system:plugin:edit']}>
          <Tooltip title={switchTooltip(row)}>
            <Switch
              aria-label={`${row.pluginName}启用设置`}
              disabled={switchBlocked(row)}
              checked={row.enabled === '0'}
              onChange={(enabled) => toggle(row, enabled)}
            />
          </Tooltip>
        </HasPermi>
      ),
    },
    {
      align: 'center',
      title: '插件状态',
      dataIndex: 'status',
      width: 110,
      render: (value) => (
        <PluginTag type={getStatusTagType(value)}>{getStatusLabel(value)}</PluginTag>
      ),
    },
    {
      align: 'center',
      title: '制品发布',
      width: 220,
      render: (_, row) => (row.source === 'artifact' ? <PluginReleaseStatus plugin={row} /> : '-'),
    },
    { align: 'center', title: '来源', dataIndex: 'source', width: 80 },
    {
      align: 'center',
      title: '更新时间',
      dataIndex: 'updateTime',
      width: 165,
      render: formatPluginTime,
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      fixed: 'right',
      width: 260,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:plugin:query']}>
            <TableAction
              iconOnly={true}
              symbol="View"
              onClick={() => showDetail(row)}
            >
              详情
            </TableAction>
            {!isOrphanPlugin(row) && (
              <>
                <TableAction
                  iconOnly={true}
                  symbol="Setting"
                  loading={configLoading}
                  onClick={() => showConfig(row)}
                >
                  配置
                </TableAction>
                <TableAction
                  iconOnly={true}
                  symbol="Connection"
                  onClick={() => showDependencies(row)}
                >
                  依赖
                </TableAction>
                <TableAction
                  iconOnly={true}
                  symbol="CircleCheck"
                  onClick={() => check(row)}
                >
                  检查
                </TableAction>
                <TableAction
                  iconOnly={true}
                  symbol="FirstAidKit"
                  onClick={() => diagnose(row, true)}
                >
                  健康检查
                </TableAction>
                <TableAction
                  iconOnly={true}
                  symbol="DocumentChecked"
                  onClick={() => diagnose(row, false)}
                >
                  诊断包
                </TableAction>
              </>
            )}
          </HasPermi>
          <HasPermi value={['system:plugin:edit']}>
            {[
              [canInstall(row), 'install'],
              [canUpgrade(row), 'upgrade'],
              [canUninstall(row), 'uninstall'],
            ].map(
              ([visible, type]) =>
                visible && (
                  <TableAction
                    key={type}
                    iconOnly
                    symbol={
                      { install: 'Download', upgrade: 'Upload', uninstall: 'SwitchButton' }[type]
                    }
                    tone={
                      type === 'install' ? 'success' : type === 'upgrade' ? 'warning' : 'danger'
                    }
                    aria-label={actionLabels[type]}
                    tooltip={
                      isOperationBlocked(row, type)
                        ? getCapabilityReason(row.capability)
                        : actionLabels[type]
                    }
                    danger={type === 'uninstall'}
                    disabled={isOperationBlocked(row, type)}
                    onClick={() => preview(row, type)}
                  >
                    {actionLabels[type]}
                  </TableAction>
                )
            )}
          </HasPermi>
          {isOrphanPlugin(row) && (
            <HasPermi value={['system:plugin:remove']}>
              <TableAction
                iconOnly={true}
                tone="danger"
                symbol="Delete"
                onClick={() => preview(row, 'purge')}
              >
                清理孤儿元数据
              </TableAction>
            </HasPermi>
          )}
        </TableActions>
      ),
    },
  ]
  return (
    <div className="app-container plugin-management">
      <Form
        form={form}
        layout="inline"
        className="search-form plugin-query-form"
        colon={false}
        labelCol={{ flex: '68px' }}
        style={{ display: showSearch ? undefined : 'none' }}
        onFinish={(values) => {
          setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })
          setSelected([])
        }}
      >
        <Form.Item
          name="pluginId"
          label="插件ID"
        >
          <Input
            style={{ width: 220 }}
            placeholder="请输入插件ID"
            allowClear
          />
        </Form.Item>
        <Form.Item
          name="pluginName"
          label="插件名称"
        >
          <Input
            style={{ width: 220 }}
            placeholder="请输入插件名称"
            allowClear
          />
        </Form.Item>
        <Form.Item
          name="enabled"
          label="启用设置"
        >
          <Select
            style={{ width: 220 }}
            placeholder="启用设置"
            allowClear
            options={[
              { label: '启用', value: '0' },
              { label: '停用', value: '1' },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="status"
          label="插件状态"
        >
          <Select
            style={{ width: 220 }}
            placeholder="插件状态"
            allowClear
            options={pluginStatusOptions}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              icon={<SearchOutlined />}
              type="primary"
              htmlType="submit"
            >
              搜索
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                form.resetFields()
                setQuery({ pageNum: 1, pageSize: 10 })
                setSelected([])
              }}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
      <div className="table-toolbar">
        <div className="plugin-plan-toolbar-actions">
          <HasPermi value={['system:plugin:query']}>
            {['install', 'enable', 'upgrade'].map((type) => (
              <Button
                key={type}
                className={`ruoyi-plain-button${type === 'enable' ? ' ruoyi-plain-button--success' : type === 'upgrade' ? ' ruoyi-plain-button--warning' : ''}`}
                icon={
                  type === 'install' ? (
                    <ShareAltOutlined />
                  ) : type === 'enable' ? (
                    <ApiOutlined />
                  ) : (
                    <UploadOutlined />
                  )
                }
                loading={planLoading}
                disabled={!selected.length}
                onClick={() => createPlan(type)}
              >
                {actionLabels[type]}计划
              </Button>
            ))}
            <Button
              icon={<AuditOutlined />}
              onClick={() => setAuditOpen(true)}
            >
              审计记录
            </Button>
          </HasPermi>
          <Tooltip title={formatPluginIdsForDisplay(selected)}>
            <PluginTag
              closable={!!selected.length}
              onClose={() => setSelected([])}
              type={selected.length ? 'success' : 'info'}
            >
              {selected.length ? `已选 ${selected.length} 个插件` : '请选择插件'}
            </PluginTag>
          </Tooltip>
        </div>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={refresh}
        />
      </div>
      <Table
        rowKey="pluginId"
        dataSource={data.rows}
        columns={columns}
        loading={loading}
        pagination={false}
        scroll={{ x: 1700 }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: setSelected,
          getCheckboxProps: (row) => ({ disabled: !canSelectForBatch(row) }),
        }}
      />
      <Pagination
        total={data.total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => {
          setQuery({ ...query, ...page })
          setSelected([])
        }}
      />
      <PluginDetailDialog
        detail={detail}
        migrations={migrations}
        migrationLoading={migrationLoading}
        onClose={() => {
          detailRequest.current++
          setDetail(undefined)
        }}
        onMarkMigration={markMigration}
        onRepair={() => {
          const row = detail
          setDetail(undefined)
          preview(row, 'install')
        }}
      />
      <PluginConfigDialog
        open={!!config}
        {...config}
        loading={configLoading}
        refreshKey={configRevision}
        onSubmit={saveConfig}
        onClose={() => {
          configRequest.current++
          setConfig(undefined)
          setConfigLoading(false)
        }}
      />
      <PluginDependencyDialog
        open={!!dependency}
        result={dependency?.result}
        loading={dependencyLoading}
        onClose={() => setDependency(undefined)}
        onDryRun={() => installDependencies(true)}
        onInstall={() => installDependencies(false)}
      />
      <PluginDiagnosticDialog
        open={!!diagnostic}
        {...diagnostic}
        loading={diagnosticLoading}
        onClose={() => setDiagnostic(undefined)}
      />
      <PluginActionDialog
        open={!!action}
        {...action}
        dictionary={plugin_operation_type}
        loading={actionLoading}
        onExecute={executeAction}
        onClose={() => setAction(undefined)}
      />
      <PluginPlanDialog
        open={!!plan}
        plan={plan || undefined}
        batch={batch}
        dictionary={plugin_operation_type}
        continueOnError={continueOnError}
        onContinueOnError={setContinueOnError}
        loading={planLoading}
        onExecute={executePlan}
        onClose={() => setPlan(undefined)}
      />
      <PluginOperationLogDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        dictionary={plugin_operation_type}
      />
    </div>
  )
}
