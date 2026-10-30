import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import PluginSummary from './PluginSummary'
import './style.css'
import { Alert, Button, Descriptions, Input, Modal, Tabs } from 'antd'
import Table from '@/components/Table'
import { getValidationLevelLabel, getValidationLevelTagType } from '@/utils/pluginPlanFormatter'
import { formatBoolean, formatJson } from '../formatter'
import PluginTag from './PluginTag'

export default function PluginDiagnosticDialog({
  open,
  title = t('system:pluginDiagnostics'),
  result = {},
  loading,
  onClose,
}) {
  useI18n()

  const health = result.health,
    diagnose = result.info || result.check ? result : null,
    check = diagnose?.check || {}
  const validation = [
    [t('pluginAdmin:dependencies'), check.dependencies],
    [t('common:manifestError'), check.manifestIssues],
    [t('common:manifestWarning'), check.manifestWarnings],
    [t('pluginAdmin:dependencyTitle'), check.pluginDependencyErrors],
    [t('common:structure'), check.structureErrors],
    [t('pluginAdmin:menuConflict'), check.menuConflicts],
  ].flatMap(([category, rows]) =>
    Array.isArray(rows)
      ? rows.map((item) => ({
          category,
          level: item.level || (category.includes(t('common:warning')) ? 'warning' : 'error'),
          kind: item.kind || item.name || item.status || '-',
          value: item.value || item.requirement || item.path || item.pluginId || item.perms || '-',
          message: item.message || item.suggestion || item.reason || '',
        }))
      : []
  )
  return (
    <Modal
      className="plugin-dialog plugin-result-dialog"
      title={title}
      open={open}
      onCancel={onClose}
      width="min(920px, calc(100vw - 32px))"
      loading={loading}
      footer={<Button onClick={onClose}>{t('layout:search.close')}</Button>}
    >
      {result.message && (
        <Alert
          title={result.message}
          type={result.ok ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <PluginSummary
        autoFit
        items={[
          [t('pluginAdmin:id'), result.pluginId || '-'],
          [
            t('system:result'),
            <PluginTag type={result.ok ? 'success' : 'danger'}>
              {result.ok ? t('layout:notices.active') : t('common:exception')}
            </PluginTag>,
          ],
          ...(health
            ? [
                [t('common:status'), health.status || '-'],
                [t('monitor:job.duration'), `${health.durationMs ?? '-'}ms`],
              ]
            : []),
        ].map(([label, children]) => ({ key: label, label, children }))}
      />
      <Tabs
        items={[
          ...(health
            ? [
                {
                  key: 'health',
                  label: t('system:healthStatus'),
                  children: (
                    <>
                      <Descriptions
                        bordered
                        column={2}
                        items={[
                          [t('system:checker'), health.checker],
                          [t('common:status'), health.status],
                          [t('common:description'), health.message],
                          [t('common:error'), health.error],
                        ].map(([label, children]) => ({
                          key: label,
                          label,
                          span: [t('common:description'), t('common:error')].includes(label)
                            ? 2
                            : 1,
                          children: children || '-',
                        }))}
                      />
                      <Input.TextArea
                        style={{ marginTop: 16 }}
                        readOnly
                        rows={8}
                        value={formatJson(health.details)}
                      />
                    </>
                  ),
                },
              ]
            : []),
          ...(diagnose
            ? [
                {
                  key: 'check',
                  label: t('system:checkSummary'),
                  children: (
                    <>
                      <Descriptions
                        bordered
                        column={3}
                        items={[
                          [t('pluginAdmin:dependencies'), formatBoolean(check.dependencyOk)],
                          ['Manifest', formatBoolean(check.manifestOk)],
                          [t('common:structure'), formatBoolean(check.structureOk)],
                          [
                            t('pluginAdmin:dependencyTitle'),
                            formatBoolean(check.pluginDependencyOk),
                          ],
                          [t('pluginAdmin:menuConflict'), formatBoolean(check.menuConflictOk)],
                          [t('system:configurationItem'), diagnose.config?.summary?.total ?? '-'],
                        ].map(([label, children]) => ({
                          key: label,
                          label,
                          children,
                        }))}
                      />
                      <Table
                        style={{ marginTop: 16 }}
                        size="small"
                        bordered
                        scroll={{ x: 820 }}
                        locale={{ emptyText: t('system:noDiagnosticIssues') }}
                        rowKey={(_, index) => index}
                        pagination={false}
                        dataSource={validation}
                        columns={[
                          {
                            width: 120,
                            align: 'center',
                            title: t('system:category'),
                            dataIndex: 'category',
                          },
                          {
                            width: 90,
                            align: 'center',
                            title: t('common:level'),
                            dataIndex: 'level',
                            render: (value) => (
                              <PluginTag type={getValidationLevelTagType(value)}>
                                {getValidationLevelLabel(value)}
                              </PluginTag>
                            ),
                          },
                          { width: 170, title: t('common:type'), dataIndex: 'kind' },
                          { width: 180, title: t('system:object'), dataIndex: 'value' },
                          { width: 260, title: t('common:description'), dataIndex: 'message' },
                        ]}
                      />
                    </>
                  ),
                },
                {
                  key: 'menus',
                  label: t('system:menuPlan'),
                  children: (
                    <Input.TextArea
                      value={formatJson(diagnose.menuPlan)}
                      readOnly
                      rows={12}
                    />
                  ),
                },
              ]
            : []),
          {
            key: 'raw',
            label: t('system:rawData'),
            children: (
              <Input.TextArea
                value={formatJson(result)}
                readOnly
                rows={14}
              />
            ),
          },
        ]}
      />
    </Modal>
  )
}
