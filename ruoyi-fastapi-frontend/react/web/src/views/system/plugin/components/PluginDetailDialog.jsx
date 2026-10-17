import TableActions, { TableAction } from '@/components/TableActions'
import './style.css'
import { useEffect, useState } from 'react'
import { Alert, Button, Descriptions, Modal, Space, Tabs } from 'antd'
import Table from '@/components/Table'
import HasPermi from '@/directive/permission/hasPermi'
import { getPluginReleaseView } from '@/utils/pluginReleaseFormatter'
import {
  formatConfigConstraint,
  formatConfigDefaultValue,
  formatPluginTime,
  getStatusLabel,
} from '../formatter'
import PluginRuntimeMetrics from './PluginRuntimeMetrics'
import PluginTag from './PluginTag'

export default function PluginDetailDialog({
  detail,
  onClose,
  migrations = [],
  migrationLoading,
  onMarkMigration,
  onRepair,
}) {
  const [tab, setTab] = useState('overview'),
    item = detail || {},
    release = getPluginReleaseView(item)
  useEffect(() => {
    if (detail) setTab('overview')
  }, [detail])
  const descriptions = (rows) => (
    <Descriptions
      bordered
      column={2}
      size="small"
      style={{ marginBottom: 16 }}
      items={rows.map(([label, children]) => ({
        key: label,
        span: [
          '最近错误',
          '插件说明',
          'Worker 状态',
          '目标制品摘要',
          '已准备摘要',
          '发布代际',
          '已安装数据结构版本',
          '后端路径',
          '后端模块',
          '前端路径',
        ].includes(label)
          ? 2
          : 1,
        label,
        children: children === '' || children == null ? '-' : children,
      }))}
    />
  )
  const table = (rows, columns, key, emptyText) => (
    <Table
      size="small"
      bordered
      rowKey={key}
      dataSource={rows || []}
      columns={columns}
      pagination={false}
      locale={emptyText ? { emptyText } : undefined}
      scroll={{ x: 'max-content' }}
    />
  )
  const textColumns = (fields) =>
    fields.map(([dataIndex, title, width]) => ({
      dataIndex,
      title,
      width:
        width ??
        {
          type: 70,
          orderNum: 70,
          version: 100,
          attemptCount: 70,
          statementCount: 70,
          id: 140,
          cronExpression: 150,
        }[dataIndex],
      minWidth: {
        name: 140,
        path: 140,
        component: 180,
        perms: 160,
        code: 180,
        description: 220,
        key: 160,
        label: 140,
        migrationPath: 220,
        callable: 220,
      }[dataIndex],
      ellipsis: !['type', 'orderNum', 'attemptCount', 'statementCount'].includes(dataIndex),
      render: (value) => (value === '' || value == null ? '-' : value),
      align: ['type', 'orderNum', 'version', 'attemptCount', 'statementCount'].includes(dataIndex)
        ? 'center'
        : 'left',
    }))
  const normalizeItems = (items) => (Array.isArray(items) ? items.filter(Boolean) : [])
  const dependencies = [
    ['python', 'Python', 'success'],
    ['npm', 'npm', 'primary'],
    ['npmDev', 'npmDev', 'warning'],
  ].map(([kind, label, tagType]) => ({
    kind,
    label,
    tagType,
    items: normalizeItems(item.dependencies?.[kind]),
  }))
  const scripts = [
    { kind: 'migration', label: 'Migration', items: normalizeItems(item.backend?.migrations) },
    { kind: 'seed', label: 'Seed', items: normalizeItems(item.backend?.seeds) },
  ]
  const listColumns = [
    { width: 120, align: 'center', title: '类型', dataIndex: 'label' },
    { width: 80, align: 'center', title: '数量', render: (_, row) => row.items.length },
    {
      title: '依赖项',
      minWidth: 520,
      render: (_, row) => (
        <div className="detail-tag-list">
          {row.items.map((value) => (
            <PluginTag
              key={value}
              type={row.tagType || 'info'}
              effect="plain"
            >
              {value}
            </PluginTag>
          ))}
          {!row.items.length && <span className="detail-empty-text">-</span>}
        </div>
      ),
    },
  ]
  return (
    <Modal
      className="plugin-dialog plugin-detail-dialog"
      title="插件详情"
      open={!!detail}
      width="min(920px, calc(100vw - 32px))"
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Space>
          {item.status === 'error' && item.source !== 'artifact' && (
            <HasPermi value={['system:plugin:edit']}>
              <Button
                type="primary"
                onClick={onRepair}
              >
                重新安装修复
              </Button>
            </HasPermi>
          )}
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <Tabs
        activeKey={tab}
        onChange={setTab}
        destroyOnHidden
        items={[
          {
            key: 'overview',
            label: '概览',
            children: (
              <>
                <div className="detail-section-title">基础信息</div>
                {descriptions([
                  ['插件ID', item.pluginId],
                  ['插件名称', item.pluginName],
                  [item.source === 'artifact' ? '制品版本' : '源码版本', item.version],
                  ['已安装版本', item.installedVersion],
                  ['启用设置', item.enabled === '0' ? '启用' : '停用'],
                  ['插件状态', getStatusLabel(item.status)],
                  ['来源', item.source],
                  ['更新时间', formatPluginTime(item.updateTime)],
                  ['分类', item.metadata?.category],
                  ['标签', item.metadata?.tags?.join(', ')],
                  ['作者', item.metadata?.author],
                  ['许可证', item.metadata?.license],
                  ['最近错误', item.lastError],
                  ['插件说明', item.description],
                ])}
                {item.source === 'artifact' && (
                  <>
                    <div className="detail-section-title">制品发布</div>
                    {release.unavailable && (
                      <Alert
                        className="plugin-release-alert"
                        title="暂未获取发布状态，请刷新列表后查看"
                        type="info"
                        showIcon
                      />
                    )}
                    {release.error && (
                      <Alert
                        className="plugin-release-alert"
                        title="制品发布异常"
                        description={release.error}
                        type="error"
                        showIcon
                      />
                    )}
                    {release.restartRequired && (
                      <Alert
                        className="plugin-release-alert"
                        showIcon
                        title="尚未完成全部 worker 的状态确认"
                        description="请在停机维护窗口完成发布操作，再启动全部 worker；以下状态以实际进程报告为准。"
                        type="warning"
                      />
                    )}
                    {descriptions([
                      ['发布状态', <PluginTag type={release.tagType}>{release.label}</PluginTag>],
                      ['维护准备', release.preparationLabel],
                      ['Worker 状态', release.workerSummary],
                      [
                        '目标匹配 / 停用确认',
                        `${release.counts.healthy} / ${release.counts.disabled}`,
                      ],
                      ['不一致 / 失败', `${release.counts.mismatch} / ${release.counts.failed}`],
                      ['未确认 / 心跳过期', `${release.counts.missing} / ${release.counts.stale}`],
                      ['目标代码版本', item.release?.targetVersion],
                      ['目标制品摘要', <code>{item.release?.targetDigest || '未选择目标'}</code>],
                      [
                        '已准备摘要',
                        <code>{item.release?.preparedDigest || '尚未完成维护准备'}</code>,
                      ],
                      ['发布代际', <code>{item.release?.generation || '-'}</code>],
                      [
                        '已安装数据结构版本',
                        <>
                          {item.installedVersion || '-'}
                          <div className="release-explanation">
                            表示数据库迁移和安装资源已到达的版本；代码回滚不会降低此版本。worker
                            是否使用目标代码由发布状态确认。
                          </div>
                        </>,
                      ],
                    ])}
                  </>
                )}
                <div className="detail-section-title">后端声明</div>
                {descriptions([
                  ['后端路径', item.backendPath],
                  ['后端模块', item.backend?.module],
                  [
                    '自动扫描路由',
                    item.backend?.autoScanRouters == null
                      ? '-'
                      : item.backend.autoScanRouters
                        ? '是'
                        : '否',
                  ],
                  ['定时任务', item.backend?.jobs?.length || 0],
                ])}
                <div className="detail-section-title">前端声明</div>
                {descriptions([
                  ['前端路径', item.frontendPath],
                  ['前端插件ID', item.frontend?.pluginId],
                  ['前端基础路径', item.frontend?.basePath],
                  ['视图目录', item.frontend?.viewsPath],
                  ['API 目录', item.frontend?.apiPath],
                  [
                    '前端交付',
                    {
                      none: '无前端资源',
                      source: '源码交付',
                      bundle: '独立前端制品',
                    }[item.frontend?.delivery?.type] || item.frontend?.delivery?.type,
                  ],
                  ['菜单声明', item.frontend?.menus?.length || 0],
                ])}
              </>
            ),
          },
          {
            key: 'metrics',
            label: '运行观测',
            children:
              detail && tab === 'metrics' ? (
                <PluginRuntimeMetrics pluginId={item.pluginId} />
              ) : null,
          },
          {
            key: 'menus',
            label: '菜单',
            children: table(
              item.frontend?.menus,
              textColumns([
                ['name', '名称'],
                ['path', '路径'],
                ['component', '组件'],
                ['perms', '权限'],
                ['type', '类型'],
                ['orderNum', '排序'],
              ]),
              (row) => row.path || row.perms || row.name,
              '暂无菜单声明'
            ),
          },
          {
            key: 'permissions',
            label: '权限',
            children: table(
              item.permissions,
              textColumns([
                ['code', '权限标识'],
                ['name', '展示名称'],
                ['description', '说明'],
              ]),
              'code',
              '暂无权限声明'
            ),
          },
          {
            key: 'config',
            label: '配置',
            children: table(
              item.config,
              [
                ...textColumns([
                  ['key', '配置键'],
                  ['label', '名称'],
                  ['type', '类型', 100],
                ]),
                {
                  width: 70,
                  align: 'center',
                  title: '必填',
                  dataIndex: 'required',
                  render: (value) => (
                    <PluginTag type={value ? 'warning' : 'info'}>{value ? '是' : '否'}</PluginTag>
                  ),
                },
                {
                  width: 70,
                  align: 'center',
                  title: '敏感',
                  dataIndex: 'secret',
                  render: (value) => (
                    <PluginTag type={value ? 'warning' : 'info'}>{value ? '是' : '否'}</PluginTag>
                  ),
                },
                { width: 160, title: '默认值', render: (_, row) => formatConfigDefaultValue(row) },
                { width: 200, title: '约束', render: (_, row) => formatConfigConstraint(row) },
                { title: '说明', dataIndex: 'description', minWidth: 220, ellipsis: true },
              ],
              'key',
              '暂无配置声明'
            ),
          },
          {
            key: 'dependencies',
            label: '依赖',
            children: (
              <>
                <div className="detail-section-title">运行依赖</div>
                {table(dependencies, listColumns, 'kind')}
                <div className="detail-section-title">数据库脚本</div>
                {table(
                  scripts,
                  listColumns.map((column) =>
                    column.title === '依赖项' ? { ...column, title: '脚本' } : column
                  ),
                  'kind'
                )}
                <div className="detail-section-title">执行历史</div>
                <Table
                  size="small"
                  rowKey="migrationPath"
                  bordered
                  loading={migrationLoading}
                  dataSource={migrations}
                  locale={{ emptyText: '暂无 migration 执行历史' }}
                  pagination={false}
                  scroll={{ x: 1300 }}
                  columns={[
                    ...textColumns([
                      ['migrationPath', '脚本'],
                      ['version', '版本'],
                    ]),
                    {
                      width: 120,
                      align: 'center',
                      title: '状态',
                      dataIndex: 'status',
                      render: (value) => (
                        <PluginTag
                          type={
                            {
                              running: 'warning',
                              success: 'success',
                              failed: 'danger',
                            }[value] || 'info'
                          }
                        >
                          {{
                            running: '执行中/中断',
                            success: '成功',
                            failed: '失败',
                            unknown: '未知',
                          }[value] ||
                            value ||
                            '-'}
                        </PluginTag>
                      ),
                    },
                    ...textColumns([
                      ['attemptCount', '次数'],
                      ['statementCount', '语句'],
                    ]),
                    {
                      width: 160,
                      align: 'center',
                      title: '开始时间',
                      render: (_, row) => formatPluginTime(row.startedTime || row.createTime),
                    },
                    {
                      width: 160,
                      align: 'center',
                      title: '结束时间',
                      dataIndex: 'finishedTime',
                      render: formatPluginTime,
                    },
                    { width: 220, title: '错误信息', dataIndex: 'errorMessage' },
                    {
                      className: 'ruoyi-actions-cell',
                      align: 'center',
                      title: '操作',
                      fixed: 'right',
                      width: 110,
                      render: (_, row) =>
                        item.source !== 'artifact' && (
                          <HasPermi value={['system:plugin:edit']}>
                            <TableActions>
                              {['running', 'failed'].includes(row.status) && (
                                <TableAction
                                  iconOnly={true}
                                  tone="success"
                                  symbol="CircleCheck"
                                  onClick={() => onMarkMigration(row, true)}
                                >
                                  标记成功
                                </TableAction>
                              )}
                              {row.status === 'running' && (
                                <TableAction
                                  iconOnly={true}
                                  tone="danger"
                                  symbol="CircleClose"
                                  onClick={() => onMarkMigration(row, false)}
                                >
                                  标记失败
                                </TableAction>
                              )}
                            </TableActions>
                          </HasPermi>
                        ),
                    },
                  ]}
                />
                <div className="detail-section-title">插件依赖</div>
                {table(
                  item.pluginDependencies,
                  [
                    { title: '插件ID', dataIndex: 'id', width: 160, ellipsis: true },
                    { title: '版本约束', dataIndex: 'version', width: 140, ellipsis: true },
                    { title: '说明', dataIndex: 'description', width: 220, ellipsis: true },
                  ],
                  'id',
                  '暂无插件依赖'
                )}
                <div className="detail-section-title">定时任务</div>
                {table(
                  item.backend?.jobs,
                  [
                    ...textColumns([
                      ['id', '任务ID'],
                      ['name', '名称'],
                      ['callable', '调用目标'],
                      ['cronExpression', 'Cron'],
                    ]),
                    {
                      width: 90,
                      align: 'center',
                      title: '默认启用',
                      dataIndex: 'enabled',
                      render: (value) => (
                        <PluginTag type={value ? 'success' : 'info'}>
                          {value ? '是' : '否'}
                        </PluginTag>
                      ),
                    },
                    { title: '说明', dataIndex: 'description' },
                  ],
                  'id',
                  '暂无定时任务声明'
                )}
              </>
            ),
          },
        ]}
      />
    </Modal>
  )
}
