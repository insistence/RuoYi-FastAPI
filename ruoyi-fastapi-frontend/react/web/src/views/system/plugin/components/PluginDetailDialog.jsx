import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

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
          t('pluginAdmin:detail.latestError'),
          t('pluginAdmin:detail.pluginDescription'),
          t('pluginAdmin:detail.workerStatus'),
          t('pluginAdmin:detail.targetArtifactDigest'),
          t('pluginAdmin:detail.preparedDigest'),
          t('pluginAdmin:shared.releaseGeneration'),
          t('pluginAdmin:detail.installedSchemaVersion'),
          t('pluginAdmin:detail.backendPath'),
          t('pluginAdmin:detail.backendModule'),
          t('pluginAdmin:detail.frontendPath'),
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
    { width: 120, align: 'center', title: t('common:type'), dataIndex: 'label' },
    { width: 80, align: 'center', title: t('common:count'), render: (_, row) => row.items.length },
    {
      key: 'items',
      title: t('pluginAdmin:detail.dependency'),
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
      title={t('pluginAdmin:detail.pluginDetails')}
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
                {t('pluginAdmin:detail.reinstallToRepair')}
              </Button>
            </HasPermi>
          )}
          <Button onClick={onClose}>{t('layout:search.close')}</Button>
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
            label: t('pluginAdmin:detail.overview'),
            children: (
              <>
                <div className="detail-section-title">
                  {t('pluginAdmin:detail.basicInformation')}
                </div>
                {descriptions([
                  [t('pluginAdmin:id'), item.pluginId],
                  [t('pluginAdmin:name'), item.pluginName],
                  [
                    item.source === 'artifact'
                      ? t('pluginAdmin:artifactVersion')
                      : t('pluginAdmin:sourceVersion'),
                    item.version,
                  ],
                  [t('pluginAdmin:shared.installedVersion'), item.installedVersion],
                  [
                    t('pluginAdmin:enableSettings'),
                    item.enabled === '0' ? t('common:enable') : t('common:disable'),
                  ],
                  [t('pluginAdmin:status'), getStatusLabel(item.status)],
                  [t('common:source'), item.source],
                  [t('common:updatedTime'), formatPluginTime(item.updateTime)],
                  [t('pluginAdmin:shared.category'), item.metadata?.category],
                  [t('system:label'), item.metadata?.tags?.join(', ')],
                  [t('system:author'), item.metadata?.author],
                  [t('pluginAdmin:detail.license'), item.metadata?.license],
                  [t('pluginAdmin:detail.latestError'), item.lastError],
                  [t('pluginAdmin:detail.pluginDescription'), item.description],
                ])}
                {item.source === 'artifact' && (
                  <>
                    <div className="detail-section-title">
                      {t('pluginAdmin:shared.artifactRelease')}
                    </div>
                    {release.unavailable && (
                      <Alert
                        className="plugin-release-alert"
                        title={t(
                          'pluginAdmin:detail.releaseStatusIsUnavailableRefreshTheListAndTry'
                        )}
                        type="info"
                        showIcon
                      />
                    )}
                    {release.error && (
                      <Alert
                        className="plugin-release-alert"
                        title={t('pluginAdmin:detail.artifactReleaseError')}
                        description={release.error}
                        type="error"
                        showIcon
                      />
                    )}
                    {release.restartRequired && (
                      <Alert
                        className="plugin-release-alert"
                        showIcon
                        title={t('pluginAdmin:detail.notAllWorkerStatusesHaveBeenConfirmed')}
                        description={t(
                          'pluginAdmin:detail.completeTheReleaseDuringAMaintenanceWindowThenStart'
                        )}
                        type="warning"
                      />
                    )}
                    {descriptions([
                      [
                        t('pluginAdmin:detail.releaseStatus'),
                        <PluginTag type={release.tagType}>{release.label}</PluginTag>,
                      ],
                      [t('pluginAdmin:detail.maintenancePreparation'), release.preparationLabel],
                      [t('pluginAdmin:detail.workerStatus'), release.workerSummary],
                      [
                        t('pluginAdmin:detail.targetMatchedDisabledConfirmed'),
                        `${release.counts.healthy} / ${release.counts.disabled}`,
                      ],
                      [
                        t('pluginAdmin:detail.mismatchFailed'),
                        `${release.counts.mismatch} / ${release.counts.failed}`,
                      ],
                      [
                        t('pluginAdmin:detail.unconfirmedHeartbeatExpired'),
                        `${release.counts.missing} / ${release.counts.stale}`,
                      ],
                      [t('pluginAdmin:detail.targetCodeVersion'), item.release?.targetVersion],
                      [
                        t('pluginAdmin:detail.targetArtifactDigest'),
                        <code>{item.release?.targetDigest || t('common:noTargetSelected')}</code>,
                      ],
                      [
                        t('pluginAdmin:detail.preparedDigest'),
                        <code>
                          {item.release?.preparedDigest ||
                            t('pluginAdmin:maintenancePreparationIsIncomplete')}
                        </code>,
                      ],
                      [
                        t('pluginAdmin:shared.releaseGeneration'),
                        <code>{item.release?.generation || '-'}</code>,
                      ],
                      [
                        t('pluginAdmin:detail.installedSchemaVersion'),
                        <>
                          {item.installedVersion || '-'}
                          <div className="release-explanation">
                            {t(
                              'pluginAdmin:detail.theVersionReachedByDatabaseMigrationsAndInstalledResources'
                            )}
                          </div>
                        </>,
                      ],
                    ])}
                  </>
                )}
                <div className="detail-section-title">
                  {t('pluginAdmin:detail.backendDeclarations')}
                </div>
                {descriptions([
                  [t('pluginAdmin:detail.backendPath'), item.backendPath],
                  [t('pluginAdmin:detail.backendModule'), item.backend?.module],
                  [
                    t('pluginAdmin:detail.automaticRouteDiscovery'),
                    item.backend?.autoScanRouters == null
                      ? '-'
                      : item.backend.autoScanRouters
                        ? t('common:yes')
                        : t('common:no'),
                  ],
                  [t('system:scheduledTasks'), item.backend?.jobs?.length || 0],
                ])}
                <div className="detail-section-title">
                  {t('pluginAdmin:detail.frontendDeclarations')}
                </div>
                {descriptions([
                  [t('pluginAdmin:detail.frontendPath'), item.frontendPath],
                  [t('pluginAdmin:detail.frontendPluginId'), item.frontend?.pluginId],
                  [t('pluginAdmin:detail.frontendBasePath'), item.frontend?.basePath],
                  [t('pluginAdmin:detail.viewDirectory'), item.frontend?.viewsPath],
                  [t('pluginAdmin:detail.apiDirectory'), item.frontend?.apiPath],
                  [
                    t('pluginAdmin:detail.frontendDelivery'),
                    {
                      none: t('pluginAdmin:detail.noFrontendResources'),
                      source: t('pluginAdmin:detail.sourceDelivery'),
                      bundle: t('pluginAdmin:detail.standaloneFrontendArtifact'),
                    }[item.frontend?.delivery?.type] || item.frontend?.delivery?.type,
                  ],
                  [t('pluginAdmin:detail.menuDeclarations'), item.frontend?.menus?.length || 0],
                ])}
              </>
            ),
          },
          {
            key: 'metrics',
            label: t('pluginAdmin:detail.runtimeMonitoring'),
            children:
              detail && tab === 'metrics' ? (
                <PluginRuntimeMetrics pluginId={item.pluginId} />
              ) : null,
          },
          {
            key: 'menus',
            label: t('system:menu.menu'),
            children: table(
              item.frontend?.menus,
              textColumns([
                ['name', t('common:name')],
                ['path', t('pluginAdmin:shared.path')],
                ['component', t('pluginAdmin:detail.component')],
                ['perms', t('system:permission.title')],
                ['type', t('common:type')],
                ['orderNum', t('common:sort')],
              ]),
              (row) => row.path || row.perms || row.name,
              t('pluginAdmin:detail.noMenuDeclarations')
            ),
          },
          {
            key: 'permissions',
            label: t('system:permission.title'),
            children: table(
              item.permissions,
              textColumns([
                ['code', t('system:menu.permission')],
                ['name', t('pluginAdmin:detail.displayName')],
                ['description', t('common:description')],
              ]),
              'code',
              t('pluginAdmin:detail.noPermissionDeclarations')
            ),
          },
          {
            key: 'config',
            label: t('pluginAdmin:shared.configuration'),
            children: table(
              item.config,
              [
                ...textColumns([
                  ['key', t('pluginAdmin:shared.configurationKey')],
                  ['label', t('common:name')],
                  ['type', t('common:type'), 100],
                ]),
                {
                  width: 70,
                  align: 'center',
                  title: t('system:components.required'),
                  dataIndex: 'required',
                  render: (value) => (
                    <PluginTag type={value ? 'warning' : 'info'}>
                      {value ? t('common:yes') : t('common:no')}
                    </PluginTag>
                  ),
                },
                {
                  width: 70,
                  align: 'center',
                  title: t('pluginAdmin:shared.sensitive'),
                  dataIndex: 'secret',
                  render: (value) => (
                    <PluginTag type={value ? 'warning' : 'info'}>
                      {value ? t('common:yes') : t('common:no')}
                    </PluginTag>
                  ),
                },
                {
                  width: 160,
                  title: t('system:defaultValue'),
                  render: (_, row) => formatConfigDefaultValue(row),
                },
                {
                  width: 200,
                  title: t('pluginAdmin:detail.constraints'),
                  render: (_, row) => formatConfigConstraint(row),
                },
                {
                  title: t('common:description'),
                  dataIndex: 'description',
                  minWidth: 220,
                  ellipsis: true,
                },
              ],
              'key',
              t('pluginAdmin:detail.noConfigurationDeclarations')
            ),
          },
          {
            key: 'dependencies',
            label: t('pluginAdmin:dependencies'),
            children: (
              <>
                <div className="detail-section-title">
                  {t('pluginAdmin:detail.runtimeDependencies')}
                </div>
                {table(dependencies, listColumns, 'kind')}
                <div className="detail-section-title">
                  {t('pluginAdmin:detail.databaseScripts')}
                </div>
                {table(
                  scripts,
                  listColumns.map((column) =>
                    column.key === 'items'
                      ? { ...column, title: t('pluginAdmin:detail.script') }
                      : column
                  ),
                  'kind'
                )}
                <div className="detail-section-title">
                  {t('pluginAdmin:detail.executionHistory')}
                </div>
                <Table
                  size="small"
                  rowKey="migrationPath"
                  bordered
                  loading={migrationLoading}
                  dataSource={migrations}
                  locale={{ emptyText: t('pluginAdmin:detail.noMigrationHistory') }}
                  pagination={false}
                  scroll={{ x: 1300 }}
                  columns={[
                    ...textColumns([
                      ['migrationPath', t('pluginAdmin:detail.script')],
                      ['version', t('pluginAdmin:shared.version')],
                    ]),
                    {
                      width: 120,
                      align: 'center',
                      title: t('common:status'),
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
                            running: t('pluginAdmin:detail.runningInterrupted'),
                            success: t('common:success'),
                            failed: t('common:failed'),
                            unknown: t('common:unknown'),
                          }[value] ||
                            value ||
                            '-'}
                        </PluginTag>
                      ),
                    },
                    ...textColumns([
                      ['attemptCount', t('monitor:count')],
                      ['statementCount', t('pluginAdmin:detail.statement')],
                    ]),
                    {
                      width: 160,
                      align: 'center',
                      title: t('common:startTime'),
                      render: (_, row) => formatPluginTime(row.startedTime || row.createTime),
                    },
                    {
                      width: 160,
                      align: 'center',
                      title: t('common:endTime'),
                      dataIndex: 'finishedTime',
                      render: formatPluginTime,
                    },
                    {
                      width: 220,
                      title: t('pluginAdmin:detail.errorMessage'),
                      dataIndex: 'errorMessage',
                    },
                    {
                      className: 'ruoyi-actions-cell',
                      align: 'center',
                      title: t('common:actions'),
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
                                  {t('pluginAdmin:detail.markSuccessful')}
                                </TableAction>
                              )}
                              {row.status === 'running' && (
                                <TableAction
                                  iconOnly={true}
                                  tone="danger"
                                  symbol="CircleClose"
                                  onClick={() => onMarkMigration(row, false)}
                                >
                                  {t('pluginAdmin:detail.markFailed')}
                                </TableAction>
                              )}
                            </TableActions>
                          </HasPermi>
                        ),
                    },
                  ]}
                />
                <div className="detail-section-title">{t('pluginAdmin:dependencyTitle')}</div>
                {table(
                  item.pluginDependencies,
                  [
                    { title: t('pluginAdmin:id'), dataIndex: 'id', width: 160, ellipsis: true },
                    {
                      title: t('pluginAdmin:detail.versionConstraint'),
                      dataIndex: 'version',
                      width: 140,
                      ellipsis: true,
                    },
                    {
                      title: t('common:description'),
                      dataIndex: 'description',
                      width: 220,
                      ellipsis: true,
                    },
                  ],
                  'id',
                  t('pluginAdmin:detail.noPluginDependencies')
                )}
                <div className="detail-section-title">{t('system:scheduledTasks')}</div>
                {table(
                  item.backend?.jobs,
                  [
                    ...textColumns([
                      ['id', t('pluginAdmin:detail.taskId')],
                      ['name', t('common:name')],
                      ['callable', t('monitor:job.target')],
                      ['cronExpression', 'Cron'],
                    ]),
                    {
                      width: 90,
                      align: 'center',
                      title: t('pluginAdmin:detail.enabledByDefault'),
                      dataIndex: 'enabled',
                      render: (value) => (
                        <PluginTag type={value ? 'success' : 'info'}>
                          {value ? t('common:yes') : t('common:no')}
                        </PluginTag>
                      ),
                    },
                    { title: t('common:description'), dataIndex: 'description' },
                  ],
                  'id',
                  t('pluginAdmin:detail.noScheduledTaskDeclarations')
                )}
              </>
            ),
          },
        ]}
      />
    </Modal>
  )
}
