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
  const operation = (value) => formatPluginOperation(value, dictionary)
  return (
    <Modal
      className="plugin-dialog plugin-result-dialog plugin-plan-dialog"
      title={`插件${operation(plan.operation)}计划`}
      open={open}
      onCancel={onClose}
      width="min(920px, calc(100vw - 32px))"
      footer={
        <Space wrap>
          <div className="plugin-plan-continue">
            <span className={!continueOnError ? 'is-active' : undefined}>失败即中止</span>
            <Switch
              checked={continueOnError}
              aria-label="失败后继续"
              onChange={onContinueOnError}
            />
            <span className={continueOnError ? 'is-active' : undefined}>失败后继续</span>
          </div>
          <HasPermi value={['system:plugin:edit']}>
            <Button
              type="primary"
              loading={loading}
              disabled={!plan.ok || !plan.executablePluginIds.length}
              onClick={onExecute}
            >
              执行计划：{operation(plan.operation)}
            </Button>
          </HasPermi>
          <Button onClick={onClose}>关闭</Button>
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
          ['计划操作', operation(plan.operation)],
          ['目标插件', plan.requestedPluginIds.length],
          ['可执行', plan.executablePluginIds.length],
          ['阻塞项', <span className="plugin-summary-danger">{plan.blockerCount}</span>],
        ].map(([label, children]) => ({ key: label, label, children }))}
      />
      <Descriptions
        bordered
        column={1}
        className="plugin-plan-scope"
        items={[
          ['目标范围', formatPluginIdsForDisplay(plan.requestedPluginIds)],
          [
            '执行顺序',
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
            label: '计划项',
            children: (
              <Table
                size="small"
                bordered
                scroll={{ x: 910 }}
                locale={{ emptyText: '暂无计划项' }}
                rowKey="pluginId"
                dataSource={plan.items}
                pagination={false}
                columns={[
                  { width: 70, align: 'center', title: '顺序', dataIndex: 'order' },
                  { width: 140, title: '插件ID', dataIndex: 'pluginId', ellipsis: true },
                  { width: 150, title: '插件名称', dataIndex: 'name', ellipsis: true },
                  { width: 100, align: 'center', title: '版本', dataIndex: 'version' },
                  {
                    width: 90,
                    align: 'center',
                    title: '显式选择',
                    dataIndex: 'requested',
                    render: (value) => (
                      <PluginTag type={value ? 'success' : 'info'}>
                        {value ? '是' : '依赖'}
                      </PluginTag>
                    ),
                  },
                  {
                    width: 90,
                    align: 'center',
                    title: '可执行',
                    dataIndex: 'ready',
                    render: (value) => (
                      <PluginTag type={value ? 'success' : 'danger'}>
                        {value ? '是' : '否'}
                      </PluginTag>
                    ),
                  },
                  {
                    width: 180,
                    title: '依赖',
                    dataIndex: 'dependencies',
                    ellipsis: true,
                    render: formatPlanDependencies,
                  },
                  {
                    width: 90,
                    align: 'center',
                    title: '阻塞项',
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
            label: '阻塞原因',
            children: (
              <>
                <Table
                  size="small"
                  bordered
                  scroll={{ x: 750 }}
                  locale={{ emptyText: '暂无阻塞项' }}
                  rowKey={(_, index) => index}
                  pagination={false}
                  dataSource={plan.blockers}
                  columns={[
                    { width: 140, title: '插件ID', dataIndex: 'pluginId', ellipsis: true },
                    { width: 140, title: '依赖插件', dataIndex: 'dependencyId', ellipsis: true },
                    {
                      width: 150,
                      align: 'center',
                      title: '状态',
                      dataIndex: 'status',
                      render: (value) => (
                        <PluginTag type="danger">{getPlanBlockerStatusLabel(value)}</PluginTag>
                      ),
                    },
                    { width: 320, title: '说明', dataIndex: 'message', ellipsis: true },
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
            label: '执行结果',
            children: (
              <>
                <Descriptions
                  bordered
                  column={4}
                  style={{ marginBottom: 16 }}
                  items={Object.entries({
                    total: '总数',
                    succeeded: '成功',
                    failed: '失败',
                    skipped: '跳过',
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
                  locale={{ emptyText: '暂无执行记录' }}
                  rowKey="pluginId"
                  dataSource={batch.executed}
                  pagination={false}
                  columns={[
                    { width: 140, title: '插件ID', dataIndex: 'pluginId', ellipsis: true },
                    {
                      width: 90,
                      align: 'center',
                      title: '操作',
                      dataIndex: 'operation',
                      render: operation,
                    },
                    {
                      width: 90,
                      align: 'center',
                      title: '状态',
                      render: (_, row) => (
                        <PluginTag type={row.ok ? 'success' : 'danger'}>
                          {row.status || '-'}
                        </PluginTag>
                      ),
                    },
                    {
                      width: 90,
                      align: 'center',
                      title: '耗时',
                      dataIndex: 'durationMs',
                      render: (value) => `${value ?? '-'}ms`,
                    },
                    { width: 220, title: '说明', dataIndex: 'message', ellipsis: true },
                    { width: 260, title: '建议', dataIndex: 'suggestion', ellipsis: true },
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
