import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Alert, Button, Descriptions, Input, Modal, Space, Tabs, Tag } from 'antd'
import Table from '@/components/Table'
import HasPermi from '@/directive/permission/hasPermi'
import { getValidationLevelLabel, getValidationLevelTagType } from '@/utils/pluginPlanFormatter'
import {
  formatBoolean,
  formatDependencyInstalled,
  formatDependencyVersionSatisfied,
  formatJson,
  formatPluginOperation,
} from '../formatter'
import { tagColors } from './PluginReleaseStatus'

export default function PluginActionDialog({
  open,
  title = t('pluginAdmin:actions.pluginOperationResult'),
  result = {},
  pending,
  loading,
  dictionary = [],
  onExecute,
  onClose,
}) {
  useI18n()

  const level = {
    align: 'center',
    title: t('common:level'),
    dataIndex: 'level',
    render: (value) => (
      <Tag color={tagColors[getValidationLevelTagType(value)]}>
        {getValidationLevelLabel(value)}
      </Tag>
    ),
  }
  const table = (data, columns) => (
    <Table
      size="small"
      rowKey={(_, index) => index}
      dataSource={data || []}
      columns={columns}
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  )
  return (
    <Modal
      title={title}
      open={open}
      width="min(860px, calc(100vw - 32px))"
      onCancel={onClose}
      footer={
        <Space>
          {pending?.type && (
            <HasPermi
              value={[pending.type === 'purge' ? 'system:plugin:remove' : 'system:plugin:edit']}
            >
              <Button
                type="primary"
                danger={pending.type === 'purge'}
                loading={loading}
                onClick={onExecute}
              >
                {t('pluginAdmin:actions.execute')}
                {pending.label}
              </Button>
            </HasPermi>
          )}
          <Button onClick={onClose}>{t('layout:search.close')}</Button>
        </Space>
      }
    >
      {result.message && (
        <Alert
          title={result.message}
          type={result.ok ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Descriptions
        bordered
        items={[
          [t('pluginAdmin:actions.pluginId'), result.pluginId],
          [t('pluginAdmin:shared.dependencyCheck'), formatBoolean(result.dependencyOk)],
          [t('pluginAdmin:actions.structureCheck'), formatBoolean(result.structureOk)],
          [t('pluginAdmin:menuConflict'), formatBoolean(result.menuConflictOk)],
          [t('pluginAdmin:actions.dryRunMode'), result.dryRun ? t('common:yes') : t('common:no')],
          [t('pluginAdmin:actions.upgradeRequired'), formatBoolean(result.needsUpgrade)],
        ].map(([label, children]) => ({
          key: label,
          label,
          children: children ?? '-',
        }))}
      />
      <Tabs
        items={[
          ...(result.error
            ? [
                {
                  key: 'error',
                  label: t('pluginAdmin:actions.errorDetails'),
                  children: (
                    <>
                      <Alert
                        type="error"
                        showIcon
                        title={
                          result.error.message || t('pluginAdmin:shared.pluginOperationFailed')
                        }
                        style={{ marginBottom: 16 }}
                      />
                      <Descriptions
                        bordered
                        column={2}
                        items={[
                          [t('pluginAdmin:actions.pluginId'), result.pluginId || pending?.pluginId],
                          [
                            t('common:actions'),
                            formatPluginOperation(result.operation, dictionary),
                          ],
                          [
                            t('pluginAdmin:shared.failedStep'),
                            result.failedStep || result.error.failedStep,
                          ],
                          ['Migration', result.migrationRecovery?.migrationPath],
                          [
                            t('pluginAdmin:actions.migrationStatus'),
                            result.migrationRecovery?.status,
                          ],
                          [
                            t('common:suggestion'),
                            result.error.suggestion ||
                              t('pluginAdmin:reviewBackendLogsOrRunTheChecksAgain'),
                          ],
                        ].map(([label, children]) => ({
                          key: label,
                          label,
                          children: children ?? '-',
                        }))}
                      />
                      <Input.TextArea
                        rows={10}
                        readOnly
                        value={formatJson(result.error.raw)}
                        style={{ marginTop: 16 }}
                      />
                    </>
                  ),
                },
              ]
            : []),
          {
            key: 'actions',
            label: t('pluginAdmin:shared.actionPlan'),
            children: table(result.actions, [
              { title: t('pluginAdmin:shared.action'), dataIndex: 'label' },
              {
                align: 'center',
                title: t('common:enable'),
                dataIndex: 'enabled',
                render: (value) => (value ? t('common:yes') : t('common:no')),
              },
              {
                align: 'center',
                title: t('common:status'),
                dataIndex: 'ok',
                render: formatBoolean,
              },
              { align: 'center', title: t('common:count'), dataIndex: 'count' },
            ]),
          },
          {
            key: 'dependencies',
            label: t('pluginAdmin:dependencies'),
            children: table(result.dependencies, [
              level,
              { align: 'center', title: t('common:type'), dataIndex: 'kind' },
              { title: t('pluginAdmin:dependencies'), dataIndex: 'requirement' },
              {
                align: 'center',
                title: t('pluginAdmin:shared.installed'),
                render: (_, row) => formatDependencyInstalled(row),
              },
              {
                align: 'center',
                title: t('pluginAdmin:shared.versionRequirementMet'),
                render: (_, row) => formatDependencyVersionSatisfied(row),
              },
              { title: t('common:description'), dataIndex: 'message' },
            ]),
          },
          {
            key: 'manifest',
            label: t('pluginAdmin:actions.manifestNotices'),
            children: table(
              [...(result.manifestIssues || []), ...(result.manifestWarnings || [])],
              [
                level,
                { align: 'center', title: t('common:type'), dataIndex: 'kind' },
                { title: t('pluginAdmin:shared.path'), dataIndex: 'path' },
                { title: t('common:description'), dataIndex: 'message' },
                { title: t('common:suggestion'), dataIndex: 'suggestion' },
              ]
            ),
          },
          {
            key: 'structure',
            label: t('pluginAdmin:actions.structureErrors'),
            children: table(result.structureErrors, [
              level,
              { align: 'center', title: t('common:type'), dataIndex: 'kind' },
              { title: t('pluginAdmin:shared.path'), dataIndex: 'path' },
              { title: t('common:description'), dataIndex: 'message' },
            ]),
          },
          {
            key: 'conflicts',
            label: t('pluginAdmin:menuConflict'),
            children: table(result.menuConflicts, [
              level,
              { align: 'center', title: t('common:type'), dataIndex: 'kind' },
              { title: t('pluginAdmin:actions.conflictingValue'), dataIndex: 'value' },
              { title: t('common:description'), dataIndex: 'message' },
            ]),
          },
        ]}
      />
    </Modal>
  )
}
