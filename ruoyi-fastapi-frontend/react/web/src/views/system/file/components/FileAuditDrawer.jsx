import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import './style.css'
import { useEffect, useState } from 'react'
import { Button, Descriptions, Drawer, Empty, Modal, Form, Input, Select, Space } from 'antd'
import Table from '@/components/Table'
import { listFileAccessLog } from '@/api/system/file'
import { BusinessDateTimeRangePicker } from '@/components/BusinessDateTimePicker'
import Pagination from '@/components/Pagination'
import { serializeTimeFieldsForSubmit } from '@/utils/time'
import { parseTime } from '@/utils/ruoyi'
import { formatFileSize, parseOperationDetail } from './fileFormatters'
import { TableAction } from '@/components/TableActions'
import FileTag from './FileTag'

const actions = {
  get upload() {
    return t('common:upload')
  },
  get download() {
    return t('common:download')
  },
  get acl_update() {
    return t('system:permissionChange')
  },
  get transfer() {
    return t('system:ownershipTransfer')
  },
  get delete() {
    return t('system:moveToRecycleBin')
  },
  get restore() {
    return t('common:restore')
  },
  get purge() {
    return t('system:permanentlyDelete')
  },
  get reconcile() {
    return t('system:storageReconciliation')
  },
  get retention_extend() {
    return t('system:retentionExtension')
  },
  get retention_dispose() {
    return t('system:expiryDisposal')
  },
}
const results = {
  get allowed() {
    return t('system:allowed')
  },
  get denied() {
    return t('system:denied')
  },
  get completed() {
    return t('common:completed')
  },
  get failed() {
    return t('common:failed')
  },
}
export default function FileAuditDrawer({ file, onClose }) {
  useI18n()

  const [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [data, setData] = useState({ rows: [], total: 0 }),
    [loading, setLoading] = useState(false),
    [detail, setDetail] = useState()
  useLocalizedFormErrors(form)
  useEffect(() => {
    if (!file) return
    form.resetFields()
    setQuery({ pageNum: 1, pageSize: 10 })
    setDetail(undefined)
  }, [file, form])
  useEffect(() => {
    if (!file) return
    let active = true
    setLoading(true)
    listFileAccessLog(file.fileId, query)
      .then((result) => active && setData(result))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [file, query])
  const columns = [
    {
      width: 105,
      align: 'center',
      title: t('common:actions'),
      dataIndex: 'action',
      render: (value) => actions[value] || value,
    },
    {
      width: 100,
      align: 'center',
      title: t('system:result'),
      dataIndex: 'result',
      render: (value) => (
        <FileTag type={['denied', 'failed'].includes(value) ? 'danger' : 'success'}>
          {results[value] || value}
        </FileTag>
      ),
    },
    {
      width: 120,
      align: 'center',
      title: t('system:actingUser'),
      dataIndex: 'actorName',
      ellipsis: true,
    },
    {
      width: 140,
      align: 'center',
      title: t('system:clientAddress'),
      dataIndex: 'ipAddress',
      ellipsis: true,
    },
    {
      width: 110,
      align: 'right',
      title: t('system:bytesTransferred'),
      dataIndex: 'bytesSent',
      render: (value) => (value ? formatFileSize(value) : '-'),
    },
    { width: 140, title: t('common:failureReason'), dataIndex: 'errorMessage', ellipsis: true },
    {
      align: 'center',
      title: t('monitor:accessedAt'),
      width: 180,
      dataIndex: 'accessTime',
      render: (value) => parseTime(value),
    },
    {
      width: 70,
      align: 'center',
      title: t('common:details'),
      render: (_, row) => (
        <TableAction
          iconOnly
          symbol="View"
          onClick={() => setDetail(row)}
        >
          {t('system:viewAuditDetails')}
        </TableAction>
      ),
    },
  ]
  return (
    <>
      <Drawer
        rootClassName="file-drawer"
        title={t('file:fileAuditValue', { arg0: file?.originalName || '' })}
        open={!!file}
        onClose={onClose}
        size="80%"
        afterOpenChange={(open) => !open && setDetail(undefined)}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button onClick={onClose}>{t('common:close')}</Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="inline"
          onFinish={async (values) => {
            try {
              const payload = await serializeTimeFieldsForSubmit(
                {
                  action: values.action,
                  result: values.result,
                  actorName: values.actorName,
                  beginTime: values.dateRange?.[0],
                  endTime: values.dateRange?.[1],
                },
                ['beginTime', 'endTime']
              )
              if (payload) setQuery({ ...query, ...payload, pageNum: 1 })
            } catch {}
          }}
          className="search-form"
          colon={false}
          labelCol={{ flex: '68px' }}
        >
          <Form.Item
            name="action"
            label={t('monitor:log.operationType')}
          >
            <Select
              placeholder={t('monitor:allOperations')}
              allowClear
              style={{ width: 200 }}
              options={Object.entries(actions).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="result"
            label={t('system:operationResult')}
          >
            <Select
              placeholder={t('monitor:allResults')}
              allowClear
              style={{ width: 200 }}
              options={Object.entries(results).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="actorName"
            label={t('system:actingUser')}
          >
            <Input
              style={{ width: 200 }}
              placeholder={t('system:enterAUsername')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="dateRange"
            label={t('monitor:log.operationTime')}
          >
            <BusinessDateTimeRangePicker
              style={{ width: 200 }}
              separator="-"
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                icon={<SearchOutlined />}
                type="primary"
                htmlType="submit"
              >
                {t('common:search')}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  form.resetFields()
                  setQuery({ pageNum: 1, pageSize: 10 })
                }}
              >
                {t('common:reset')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
        <Table
          rowKey="auditId"
          loading={loading}
          dataSource={data.rows}
          columns={columns}
          pagination={false}
          scroll={{ x: 1100 }}
        />
        <Pagination
          total={data.total}
          page={query.pageNum}
          limit={query.pageSize}
          onChange={(page) => setQuery({ ...query, ...page })}
        />
      </Drawer>
      <Modal
        className="file-dialog file-audit-detail"
        title={t('system:auditDetails')}
        open={!!detail}
        onCancel={() => setDetail(undefined)}
        width={720}
        footer={<Button onClick={() => setDetail(undefined)}>{t('common:close')}</Button>}
      >
        <Descriptions
          styles={{ label: { width: 110 } }}
          bordered
          column={2}
          items={
            detail
              ? [
                  {
                    key: 'action',
                    label: t('monitor:log.operationType'),
                    children: actions[detail.action] || detail.action,
                  },
                  {
                    key: 'result',
                    label: t('system:operationResult'),
                    children: results[detail.result] || detail.result,
                  },
                  {
                    key: 'actorName',
                    label: t('system:actingUser'),
                    children: detail.actorName || '-',
                  },
                  {
                    key: 'ipAddress',
                    label: t('system:clientAddress'),
                    children: detail.ipAddress || '-',
                  },
                  {
                    key: 'requestId',
                    label: t('system:requestId'),
                    children: detail.requestId || '-',
                  },
                  { key: 'traceId', label: t('system:traceId'), children: detail.traceId || '-' },
                  {
                    key: 'accessTime',
                    label: t('monitor:log.operationTime'),
                    span: 2,
                    children: parseTime(detail.accessTime) || '-',
                  },
                  {
                    key: 'userAgent',
                    label: t('system:userAgent'),
                    span: 2,
                    children: detail.userAgent || '-',
                  },
                  {
                    key: 'errorMessage',
                    label: t('common:failureReason'),
                    span: 2,
                    children: detail.errorMessage || '-',
                  },
                ]
              : []
          }
        />
        {parseOperationDetail(detail?.operationDetail).length ? (
          <Table
            className="mt20"
            bordered
            pagination={false}
            rowKey="label"
            dataSource={parseOperationDetail(detail.operationDetail)}
            columns={[
              { title: t('system:detailItem'), dataIndex: 'label', width: 180 },
              { title: t('common:content'), dataIndex: 'value', ellipsis: true },
            ]}
          />
        ) : (
          <Empty
            description={t('system:noOperationDetails')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Modal>
    </>
  )
}
