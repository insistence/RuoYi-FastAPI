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
          t('system:latestError'),
          t('system:pluginDescription'),
          t('system:workerStatus'),
          t('system:targetArtifactDigest'),
          t('system:preparedDigest'),
          t('system:releaseGeneration'),
          t('system:installedSchemaVersion'),
          t('system:backendPath'),
          t('system:backendModule'),
          t('system:frontendPath'),
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
      title: t('system:dependency'),
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
      title={t('system:pluginDetails')}
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
                {t('system:reinstallToRepair')}
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
            label: t('system:overview'),
            children: (
              <>
                <div className="detail-section-title">{t('system:basicInformation')}</div>
                {descriptions([
                  [t('pluginAdmin:id'), item.pluginId],
                  [t('pluginAdmin:name'), item.pluginName],
                  [
                    item.source === 'artifact'
                      ? t('pluginAdmin:artifactVersion')
                      : t('pluginAdmin:sourceVersion'),
                    item.version,
                  ],
                  [t('system:installedVersion'), item.installedVersion],
                  [
                    t('pluginAdmin:enableSettings'),
                    item.enabled === '0' ? t('common:enable') : t('common:disable'),
                  ],
                  [t('pluginAdmin:status'), getStatusLabel(item.status)],
                  [t('common:source'), item.source],
                  [t('common:updatedTime'), formatPluginTime(item.updateTime)],
                  [t('system:category'), item.metadata?.category],
                  [t('system:label'), item.metadata?.tags?.join(', ')],
                  [t('system:author'), item.metadata?.author],
                  [t('system:license'), item.metadata?.license],
                  [t('system:latestError'), item.lastError],
                  [t('system:pluginDescription'), item.description],
                ])}
                {item.source === 'artifact' && (
                  <>
                    <div className="detail-section-title">{t('system:artifactRelease')}</div>
                    {release.unavailable && (
                      <Alert
                        className="plugin-release-alert"
                        title={t('system:releaseStatusIsUnavailableRefreshTheListAndTry')}
                        type="info"
                        showIcon
                      />
                    )}
                    {release.error && (
                      <Alert
                        className="plugin-release-alert"
                        title={t('system:artifactReleaseError')}
                        description={release.error}
                        type="error"
                        showIcon
                      />
                    )}
                    {release.restartRequired && (
                      <Alert
                        className="plugin-release-alert"
                        showIcon
                        title={t('system:notAllWorkerStatusesHaveBeenConfirmed')}
                        description={t(
                          'system:completeTheReleaseDuringAMaintenanceWindowThenStart'
                        )}
                        type="warning"
                      />
                    )}
                    {descriptions([
                      [
                        t('system:releaseStatus'),
                        <PluginTag type={release.tagType}>{release.label}</PluginTag>,
                      ],
                      [t('system:maintenancePreparation'), release.preparationLabel],
                      [t('system:workerStatus'), release.workerSummary],
                      [
                        t('system:targetMatchedDisabledConfirmed'),
                        `${release.counts.healthy} / ${release.counts.disabled}`,
                      ],
                      [
                        t('system:mismatchFailed'),
                        `${release.counts.mismatch} / ${release.counts.failed}`,
                      ],
                      [
                        t('system:unconfirmedHeartbeatExpired'),
                        `${release.counts.missing} / ${release.counts.stale}`,
                      ],
                      [t('system:targetCodeVersion'), item.release?.targetVersion],
                      [
                        t('system:targetArtifactDigest'),
                        <code>{item.release?.targetDigest || t('common:noTargetSelected')}</code>,
                      ],
                      [
                        t('system:preparedDigest'),
                        <code>
                          {item.release?.preparedDigest ||
                            t('pluginAdmin:maintenancePreparationIsIncomplete')}
                        </code>,
                      ],
                      [
                        t('system:releaseGeneration'),
                        <code>{item.release?.generation || '-'}</code>,
                      ],
                      [
                        t('system:installedSchemaVersion'),
                        <>
                          {item.installedVersion || '-'}
                          <div className="release-explanation">
                            {t('system:theVersionReachedByDatabaseMigrationsAndInstalledResources')}
                          </div>
                        </>,
                      ],
                    ])}
                  </>
                )}
                <div className="detail-section-title">{t('system:backendDeclarations')}</div>
                {descriptions([
                  [t('system:backendPath'), item.backendPath],
                  [t('system:backendModule'), item.backend?.module],
                  [
                    t('system:automaticRouteDiscovery'),
                    item.backend?.autoScanRouters == null
                      ? '-'
                      : item.backend.autoScanRouters
                        ? t('common:yes')
                        : t('common:no'),
                  ],
                  [t('system:scheduledTasks'), item.backend?.jobs?.length || 0],
                ])}
                <div className="detail-section-title">{t('system:frontendDeclarations')}</div>
                {descriptions([
                  [t('system:frontendPath'), item.frontendPath],
                  [t('system:frontendPluginId'), item.frontend?.pluginId],
                  [t('system:frontendBasePath'), item.frontend?.basePath],
                  [t('system:viewDirectory'), item.frontend?.viewsPath],
                  [t('system:apiDirectory'), item.frontend?.apiPath],
                  [
                    t('system:frontendDelivery'),
                    {
                      none: t('system:noFrontendResources'),
                      source: t('system:sourceDelivery'),
                      bundle: t('system:standaloneFrontendArtifact'),
                    }[item.frontend?.delivery?.type] || item.frontend?.delivery?.type,
                  ],
                  [t('system:menuDeclarations'), item.frontend?.menus?.length || 0],
                ])}
              </>
            ),
          },
          {
            key: 'metrics',
            label: t('system:runtimeMonitoring'),
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
                ['path', t('system:path')],
                ['component', t('system:component')],
                ['perms', t('system:permission.title')],
                ['type', t('common:type')],
                ['orderNum', t('common:sort')],
              ]),
              (row) => row.path || row.perms || row.name,
              t('system:noMenuDeclarations')
            ),
          },
          {
            key: 'permissions',
            label: t('system:permission.title'),
            children: table(
              item.permissions,
              textColumns([
                ['code', t('system:menu.permission')],
                ['name', t('system:components.displayName')],
                ['description', t('common:description')],
              ]),
              'code',
              t('system:noPermissionDeclarations')
            ),
          },
          {
            key: 'config',
            label: t('system:configuration'),
            children: table(
              item.config,
              [
                ...textColumns([
                  ['key', t('system:configurationKey')],
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
                  title: t('system:sensitive'),
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
                  title: t('system:constraints'),
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
              t('system:noConfigurationDeclarations')
            ),
          },
          {
            key: 'dependencies',
            label: t('pluginAdmin:dependencies'),
            children: (
              <>
                <div className="detail-section-title">{t('system:runtimeDependencies')}</div>
                {table(dependencies, listColumns, 'kind')}
                <div className="detail-section-title">{t('system:databaseScripts')}</div>
                {table(
                  scripts,
                  listColumns.map((column) =>
                    column.key === 'items' ? { ...column, title: t('system:script') } : column
                  ),
                  'kind'
                )}
                <div className="detail-section-title">{t('system:executionHistory')}</div>
                <Table
                  size="small"
                  rowKey="migrationPath"
                  bordered
                  loading={migrationLoading}
                  dataSource={migrations}
                  locale={{ emptyText: t('system:noMigrationHistory') }}
                  pagination={false}
                  scroll={{ x: 1300 }}
                  columns={[
                    ...textColumns([
                      ['migrationPath', t('system:script')],
                      ['version', t('system:version')],
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
                            running: t('system:runningInterrupted'),
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
                      ['statementCount', t('system:statement')],
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
                    { width: 220, title: t('system:errorMessage'), dataIndex: 'errorMessage' },
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
                                  {t('system:markSuccessful')}
                                </TableAction>
                              )}
                              {row.status === 'running' && (
                                <TableAction
                                  iconOnly={true}
                                  tone="danger"
                                  symbol="CircleClose"
                                  onClick={() => onMarkMigration(row, false)}
                                >
                                  {t('system:markFailed')}
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
                      title: t('system:versionConstraint'),
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
                  t('system:noPluginDependencies')
                )}
                <div className="detail-section-title">{t('system:scheduledTasks')}</div>
                {table(
                  item.backend?.jobs,
                  [
                    ...textColumns([
                      ['id', t('system:taskId')],
                      ['name', t('common:name')],
                      ['callable', t('monitor:job.target')],
                      ['cronExpression', 'Cron'],
                    ]),
                    {
                      width: 90,
                      align: 'center',
                      title: t('system:enabledByDefault'),
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
                  t('system:noScheduledTaskDeclarations')
                )}
              </>
            ),
          },
        ]}
      />
    </Modal>
  )
}
