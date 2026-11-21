import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import PluginSummary from './PluginSummary'
import './style.css'
import { Alert, Button, Descriptions, Modal, Space, Tabs, Typography } from 'antd'
import Table from '@/components/Table'
import HasPermi from '@/directive/permission/hasPermi'
import {
  formatBoolean,
  formatDependencyInstalled,
  formatDependencyVersionSatisfied,
  getDependencyTagType,
  isCapabilityOperationBlocked,
} from '../formatter'
import PluginTag from './PluginTag'

export default function PluginDependencyDialog({
  open,
  result = {},
  loading,
  onClose,
  onDryRun,
  onInstall,
}) {
  useI18n()

  const policy = result.policy,
    blocked = isCapabilityOperationBlocked(result.capability, 'dependency_install'),
    allowed = !blocked && !!result.plan?.length && policy?.allowed !== false
  const list = (value) => (Array.isArray(value) && value.length ? value.join('；') : '-')
  const policyAllowed = policy?.allowed === true
  const policyMessages = policy
    ? [...(policy.reasons || []), ...(policy.requirements || []), ...(policy.warnings || [])]
    : []
  return (
    <Modal
      className="plugin-dialog plugin-result-dialog"
      title={t('pluginAdmin:dependencyTitle')}
      open={open}
      width="min(860px, calc(100vw - 32px))"
      onCancel={onClose}
      footer={
        <Space>
          <Button
            type="primary"
            loading={loading}
            disabled={blocked}
            onClick={onDryRun}
          >
            {t('pluginAdmin:dependencyDetails.generateInstallationPlan')}
          </Button>
          <HasPermi value={['system:plugin:edit']}>
            <Button
              type="primary"
              className="plugin-dependency-install"
              loading={loading}
              disabled={!allowed}
              onClick={onInstall}
            >
              {t('pluginAdmin:dependencyDetails.installDependencies')}
            </Button>
          </HasPermi>
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
      <PluginSummary
        columns={5}
        items={[
          [t('pluginAdmin:id'), result.pluginId || '-'],
          [
            t('pluginAdmin:shared.dependencyCheck'),
            <PluginTag type={result.dependencyOk ? 'success' : 'danger'}>
              {formatBoolean(result.dependencyOk)}
            </PluginTag>,
          ],
          [
            t('pluginAdmin:dependencyDetails.missingDependencies'),
            <span className="plugin-summary-danger">
              {
                (result.dependencies || []).filter((item) => item.status !== 'skipped' && !item.ok)
                  .length
              }
            </span>,
          ],
          [
            t('pluginAdmin:dependencyDetails.installationPlan'),
            result.planCount ?? result.plan?.length ?? 0,
          ],
          [
            t('pluginAdmin:dependencyDetails.installationPolicy'),
            policy ? (
              <PluginTag type={policyAllowed ? 'success' : 'warning'}>
                {policy.mode || '-'}
              </PluginTag>
            ) : (
              '-'
            ),
          ],
        ].map(([label, children]) => ({ key: label, label, children }))}
      />
      {policy && (
        <Alert
          style={{ marginBottom: 16 }}
          showIcon
          type={policyAllowed ? 'success' : 'warning'}
          title={
            policyAllowed
              ? t('pluginAdmin:dependencyDetails.thePolicyPermitsInstallation')
              : t('pluginAdmin:dependencyDetails.thePolicyBlocksInstallation')
          }
          description={
            <>
              {!!policyMessages.length && (
                <div className="dependency-policy-messages">
                  {policyMessages.map((message, index) => (
                    <div key={index}>{message}</div>
                  ))}
                </div>
              )}
              {!policyAllowed && (
                <div className="dependency-policy-next">
                  {policy.mode === 'plan_only'
                    ? t(
                        'pluginAdmin:dependencyDetails.theWebConsoleOnlyGeneratesInstallationPlansPerformControlled'
                      )
                    : t(
                        'pluginAdmin:dependencyDetails.provideTheConfirmationParametersLockFilesOrOfflineArtifacts'
                      )}
                </div>
              )}
            </>
          }
        />
      )}
      <Tabs
        items={[
          {
            key: 'dependencies',
            label: t('pluginAdmin:dependencyDetails.dependencyStatus'),
            children: (
              <Table
                size="small"
                bordered
                scroll={{ x: 860 }}
                locale={{ emptyText: t('pluginAdmin:dependencyDetails.noDependencyDeclarations') }}
                rowKey={(row) => `${row.kind}:${row.requirement}`}
                pagination={false}
                dataSource={result.dependencies || []}
                columns={[
                  { width: 90, align: 'center', title: t('common:type'), dataIndex: 'kind' },
                  {
                    width: 200,
                    title: t('pluginAdmin:dependencies'),
                    dataIndex: 'requirement',
                    ellipsis: true,
                  },
                  {
                    width: 130,
                    title: t('pluginAdmin:shared.installedVersion'),
                    dataIndex: 'installedVersion',
                    ellipsis: true,
                    render: (value) => value || '-',
                  },
                  {
                    width: 100,
                    align: 'center',
                    title: t('pluginAdmin:dependencyDetails.installationStatus'),
                    render: (_, row) => (
                      <PluginTag type={getDependencyTagType(row)}>
                        {formatDependencyInstalled(row)}
                      </PluginTag>
                    ),
                  },
                  {
                    width: 100,
                    align: 'center',
                    title: t('pluginAdmin:shared.versionRequirementMet'),
                    render: (_, row) => (
                      <PluginTag type={getDependencyTagType(row)}>
                        {formatDependencyVersionSatisfied(row)}
                      </PluginTag>
                    ),
                  },
                  {
                    width: 240,
                    title: t('common:description'),
                    dataIndex: 'message',
                    ellipsis: true,
                  },
                ]}
              />
            ),
          },
          {
            key: 'plan',
            label: t('pluginAdmin:dependencyDetails.installationPlan'),
            children: (
              <Table
                size="small"
                bordered
                scroll={{ x: 760 }}
                locale={{ emptyText: t('pluginAdmin:dependencyDetails.noInstallationPlan') }}
                rowKey={(row) => `${row.kind}:${row.requirement}`}
                pagination={false}
                dataSource={result.plan || []}
                columns={[
                  { width: 90, align: 'center', title: t('common:type'), dataIndex: 'kind' },
                  {
                    width: 150,
                    title: t('pluginAdmin:dependencies'),
                    dataIndex: 'requirement',
                    ellipsis: true,
                  },
                  {
                    width: 220,
                    title: t('pluginAdmin:dependencyDetails.workingDirectory'),
                    dataIndex: 'workdir',
                    ellipsis: true,
                  },
                  {
                    width: 300,
                    title: t('system:command'),
                    dataIndex: 'commandText',
                    render: (value) => (
                      <Typography.Text
                        className="dependency-command-text"
                        copyable={
                          value
                            ? {
                                text: value,
                                tooltips: [
                                  t('pluginAdmin:dependencyDetails.copyCommand'),
                                  t('pluginAdmin:dependencyDetails.commandCopied'),
                                ],
                              }
                            : false
                        }
                      >
                        {value || '-'}
                      </Typography.Text>
                    ),
                  },
                ]}
              />
            ),
          },
          ...(policy
            ? [
                {
                  key: 'policy',
                  label: t('pluginAdmin:dependencyDetails.policyDecision'),
                  children: (
                    <>
                      <Descriptions
                        bordered
                        column={2}
                        size="small"
                        items={[
                          [t('pluginAdmin:dependencyDetails.policyMode'), policy.mode || '-'],
                          [
                            t('pluginAdmin:dependencyDetails.executionAllowed'),
                            <PluginTag type={policyAllowed ? 'success' : 'danger'}>
                              {policyAllowed ? t('authCenter:allow') : t('pluginAdmin:blocked')}
                            </PluginTag>,
                          ],
                          [t('pluginAdmin:dependencyDetails.blockingReason'), list(policy.reasons)],
                          [
                            t('pluginAdmin:dependencyDetails.prerequisites'),
                            list(policy.requirements),
                          ],
                          [t('pluginAdmin:dependencyDetails.risks'), list(policy.warnings)],
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
                        scroll={{ x: 960 }}
                        locale={{ emptyText: t('pluginAdmin:dependencyDetails.noPolicyEntries') }}
                        rowKey={(row) => `${row.kind}:${row.requirement}`}
                        pagination={false}
                        dataSource={policy.items || []}
                        columns={[
                          {
                            width: 90,
                            align: 'center',
                            title: t('common:type'),
                            dataIndex: 'kind',
                          },
                          {
                            width: 180,
                            title: t('pluginAdmin:dependencies'),
                            dataIndex: 'requirement',
                            ellipsis: true,
                          },
                          {
                            width: 90,
                            align: 'center',
                            title: t('pluginAdmin:dependencyDetails.decision'),
                            dataIndex: 'allowed',
                            render: (value) => (
                              <PluginTag type={value ? 'success' : 'danger'}>
                                {value ? t('authCenter:allow') : t('pluginAdmin:blocked')}
                              </PluginTag>
                            ),
                          },
                          {
                            width: 120,
                            title: t('pluginAdmin:dependencyDetails.lockedVersion'),
                            dataIndex: 'lockedVersion',
                            ellipsis: true,
                            render: (value) => value || '-',
                          },
                          {
                            width: 220,
                            title: t('pluginAdmin:dependencyDetails.offlineArtifacts'),
                            dataIndex: 'artifactPath',
                            ellipsis: true,
                            render: (value) => value || '-',
                          },
                          {
                            width: 260,
                            title: t('common:description'),
                            ellipsis: true,
                            render: (_, row) =>
                              list([
                                ...(row.reasons || []),
                                ...(row.requirements || []),
                                ...(row.warnings || []),
                              ]),
                          },
                        ]}
                      />
                    </>
                  ),
                },
              ]
            : []),
        ]}
      />
    </Modal>
  )
}
