import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import PluginSummary from './PluginSummary'
import './style.css'
import { Alert, Button, Descriptions, Modal, Space, Switch, Tabs } from 'antd'
import PluginTag from './PluginTag'
import Table from '@/components/Table'
import {
  getPlanBlockerStatusLabel,
  normalizePluginBatchResponse,
  normalizePluginPlanResponse,
} from '@/utils/pluginPlanFormatter'
import HasPermi from '@/directive/permission/hasPermi'
import {
  formatPlanDependencies,
  formatPluginIdsForDisplay,
  formatPluginOperation,
} from '../formatter'

export default function PluginPlanDialog({
  open,
  plan = normalizePluginPlanResponse({}),
  batch = normalizePluginBatchResponse({}),
  dictionary = [],
  loading,
  continueOnError,
  onContinueOnError,
  onExecute,
  onClose,
}) {
  useI18n()

  const operation = (value) => formatPluginOperation(value, dictionary)
  return (
    <Modal
      className="plugin-dialog plugin-result-dialog plugin-plan-dialog"
      title={t('pluginAdmin:pluginValuePlan', { arg0: operation(plan.operation) })}
      open={open}
      onCancel={onClose}
      width="min(920px, calc(100vw - 32px))"
      footer={
        <Space wrap>
          <div className="plugin-plan-continue">
            <span className={!continueOnError ? 'is-active' : undefined}>
              {t('pluginAdmin:plan.stopOnFailure')}
            </span>
            <Switch
              checked={continueOnError}
              aria-label={t('pluginAdmin:shared.continueAfterFailure')}
              onChange={onContinueOnError}
            />
            <span className={continueOnError ? 'is-active' : undefined}>
              {t('pluginAdmin:shared.continueAfterFailure')}
            </span>
          </div>
          <HasPermi value={['system:plugin:edit']}>
            <Button
              type="primary"
              loading={loading}
              disabled={!plan.ok || !plan.executablePluginIds.length}
              onClick={onExecute}
            >
              {t('pluginAdmin:plan.executionPlan')}
              {operation(plan.operation)}
            </Button>
          </HasPermi>
          <Button onClick={onClose}>{t('layout:search.close')}</Button>
        </Space>
      }
    >
      {plan.message && (
        <Alert
          title={plan.message}
          type={plan.ok ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <PluginSummary
        columns={4}
        items={[
          [t('pluginAdmin:plan.plannedOperation'), operation(plan.operation)],
          [t('pluginAdmin:plan.targetPlugin'), plan.requestedPluginIds.length],
          [t('pluginAdmin:plan.executable'), plan.executablePluginIds.length],
          [
            t('pluginAdmin:plan.blockers'),
            <span className="plugin-summary-danger">{plan.blockerCount}</span>,
          ],
        ].map(([label, children]) => ({ key: label, label, children }))}
      />
      <Descriptions
        bordered
        column={1}
        className="plugin-plan-scope"
        items={[
          [t('pluginAdmin:plan.targetScope'), formatPluginIdsForDisplay(plan.requestedPluginIds)],
          [
            t('pluginAdmin:plan.executionOrder'),
            <Space
              wrap
              size={[6, 4]}
            >
              {plan.executablePluginIds.map((id) => (
                <PluginTag key={id}>{id}</PluginTag>
              ))}
              {!plan.executablePluginIds.length && '-'}
            </Space>,
          ],
        ].map(([label, children]) => ({ key: label, label, children }))}
      />
      <Tabs
        items={[
          {
            key: 'items',
            label: t('pluginAdmin:plan.planItem'),
            children: (
              <Table
                size="small"
                bordered
                scroll={{ x: 910 }}
                locale={{ emptyText: t('pluginAdmin:plan.noPlanItems') }}
                rowKey="pluginId"
                dataSource={plan.items}
                pagination={false}
                columns={[
                  {
                    width: 70,
                    align: 'center',
                    title: t('pluginAdmin:plan.order'),
                    dataIndex: 'order',
                  },
                  { width: 140, title: t('pluginAdmin:id'), dataIndex: 'pluginId', ellipsis: true },
                  { width: 150, title: t('pluginAdmin:name'), dataIndex: 'name', ellipsis: true },
                  {
                    width: 100,
                    align: 'center',
                    title: t('pluginAdmin:shared.version'),
                    dataIndex: 'version',
                  },
                  {
                    width: 90,
                    align: 'center',
                    title: t('pluginAdmin:plan.explicitlySelected'),
                    dataIndex: 'requested',
                    render: (value) => (
                      <PluginTag type={value ? 'success' : 'info'}>
                        {value ? t('common:yes') : t('pluginAdmin:dependencies')}
                      </PluginTag>
                    ),
                  },
                  {
                    width: 90,
                    align: 'center',
                    title: t('pluginAdmin:plan.executable'),
                    dataIndex: 'ready',
                    render: (value) => (
                      <PluginTag type={value ? 'success' : 'danger'}>
                        {value ? t('common:yes') : t('common:no')}
                      </PluginTag>
                    ),
                  },
                  {
                    width: 180,
                    title: t('pluginAdmin:dependencies'),
                    dataIndex: 'dependencies',
                    ellipsis: true,
                    render: formatPlanDependencies,
                  },
                  {
                    width: 90,
                    align: 'center',
                    title: t('pluginAdmin:plan.blockers'),
                    dataIndex: 'blockers',
                    render: (value) => (
                      <PluginTag type={value?.length ? 'danger' : 'success'}>
                        {value?.length || 0}
                      </PluginTag>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'blockers',
            label: t('pluginAdmin:plan.blockingReason'),
            children: (
              <>
                <Table
                  size="small"
                  bordered
                  scroll={{ x: 750 }}
                  locale={{ emptyText: t('pluginAdmin:plan.noBlockers') }}
                  rowKey={(_, index) => index}
                  pagination={false}
                  dataSource={plan.blockers}
                  columns={[
                    {
                      width: 140,
                      title: t('pluginAdmin:id'),
                      dataIndex: 'pluginId',
                      ellipsis: true,
                    },
                    {
                      width: 140,
                      title: t('pluginAdmin:plan.requiredPlugin'),
                      dataIndex: 'dependencyId',
                      ellipsis: true,
                    },
                    {
                      width: 150,
                      align: 'center',
                      title: t('common:status'),
                      dataIndex: 'status',
                      render: (value) => (
                        <PluginTag type="danger">{getPlanBlockerStatusLabel(value)}</PluginTag>
                      ),
                    },
                    {
                      width: 320,
                      title: t('common:description'),
                      dataIndex: 'message',
                      ellipsis: true,
                    },
                  ]}
                />
                {plan.capabilityBlockers.map((item, index) => (
                  <Alert
                    key={index}
                    type="warning"
                    showIcon
                    title={
                      item.message || item.reason || item.primaryReason || JSON.stringify(item)
                    }
                    style={{ marginTop: 8 }}
                  />
                ))}
              </>
            ),
          },
          {
            key: 'executed',
            label: t('monitor:executionResult'),
            children: (
              <>
                <Descriptions
                  bordered
                  column={4}
                  style={{ marginBottom: 16 }}
                  items={Object.entries({
                    total: t('pluginAdmin:plan.total'),
                    succeeded: t('common:success'),
                    failed: t('common:failed'),
                    skipped: t('pluginAdmin:plan.skipped'),
                  }).map(([key, label]) => ({
                    key,
                    label,
                    children: batch.summary[key],
                  }))}
                />
                {batch.message && (
                  <Alert
                    title={batch.message}
                    type={batch.ok ? 'success' : 'error'}
                    style={{ marginBlock: 12 }}
                  />
                )}
                <Table
                  size="small"
                  bordered
                  scroll={{ x: 890 }}
                  locale={{ emptyText: t('pluginAdmin:shared.noExecutionRecords') }}
                  rowKey="pluginId"
                  dataSource={batch.executed}
                  pagination={false}
                  columns={[
                    {
                      width: 140,
                      title: t('pluginAdmin:id'),
                      dataIndex: 'pluginId',
                      ellipsis: true,
                    },
                    {
                      width: 90,
                      align: 'center',
                      title: t('common:actions'),
                      dataIndex: 'operation',
                      render: operation,
                    },
                    {
                      width: 90,
                      align: 'center',
                      title: t('common:status'),
                      render: (_, row) => (
                        <PluginTag type={row.ok ? 'success' : 'danger'}>
                          {row.status || '-'}
                        </PluginTag>
                      ),
                    },
                    {
                      width: 90,
                      align: 'center',
                      title: t('monitor:job.duration'),
                      dataIndex: 'durationMs',
                      render: (value) => `${value ?? '-'}ms`,
                    },
                    {
                      width: 220,
                      title: t('common:description'),
                      dataIndex: 'message',
                      ellipsis: true,
                    },
                    {
                      width: 260,
                      title: t('common:suggestion'),
                      dataIndex: 'suggestion',
                      ellipsis: true,
                    },
                  ]}
                />
              </>
            ),
          },
        ]}
      />
    </Modal>
  )
}
