import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import './style.css'
import { renderDialogFooter } from '@/components/DialogFooter'
import { useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Select, Space } from 'antd'
import Table from '@/components/Table'
import { listDbTable, importTable } from '@/api/tool/gen'
import { parseTime } from '@/utils/ruoyi'
import { message } from '@/plugins/modal'
import Pagination from '@/components/Pagination'
export default function ImportTable({ open, dataSources, onClose, onSuccess }) {
  useI18n()

  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
  const [query, setQuery] = useState({ pageNum: 1, pageSize: 10 })
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) {
      const dataSourceName = (dataSources.find((s) => s.isDefault) || dataSources[0])?.name
      form.resetFields()
      form.setFieldValue('dataSourceName', dataSourceName)
      setQuery({ pageNum: 1, pageSize: 10, dataSourceName })
      setSelected([])
    }
  }, [open])
  useEffect(() => {
    let active = true
    if (!open || !query.dataSourceName) {
      setRows([])
      setTotal(0)
      return
    }
    setLoading(true)
    listDbTable(query)
      .then((r) => {
        if (active) {
          setRows(r.rows || [])
          setTotal(r.total || 0)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, open])
  async function submit() {
    if (!selected.length) return message.warning(t('tool:selectTablesToImport'))
    setSaving(true)
    try {
      await importTable({
        tables: selected.join(','),
        dataSourceName: query.dataSourceName,
      })
      message.success(t('common:importCompleted'))
      onClose()
      onSuccess()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      footer={renderDialogFooter}
      title={t('tool:importTables')}
      className="gen-import"
      style={{ top: '6vh' }}
      open={open}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      width="800px"
      forceRender
    >
      <Form
        name="gen-import-search"
        form={form}
        layout="inline"
        colon={false}
        className="search-form"
        onFinish={(values) => {
          setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })
          setSelected([])
        }}
      >
        <Form.Item
          label={t('tool:datasource.title')}
          name="dataSourceName"
          required
        >
          <Select
            placeholder={t('tool:datasource.select')}
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            options={dataSources.map((s) => ({
              label: `${s.name}（${s.dbType}）`,
              value: s.name,
            }))}
            onChange={(value) => {
              setSelected([])
              setQuery({
                ...form.getFieldsValue(),
                dataSourceName: value,
                pageNum: 1,
                pageSize: query.pageSize,
              })
            }}
          />
        </Form.Item>
        <Form.Item
          label={t('tool:gen.tableName')}
          name="tableName"
        >
          <Input
            placeholder={t('tool:enterTableName')}
            allowClear
            style={{ width: 180 }}
          />
        </Form.Item>
        <Form.Item
          label={t('tool:gen.tableComment')}
          name="tableComment"
        >
          <Input
            placeholder={t('tool:enterTableDescription')}
            allowClear
            style={{ width: 180 }}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              icon={<SearchOutlined />}
              htmlType="submit"
              type="primary"
            >
              {t('common:search')}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                const source = query.dataSourceName
                form.resetFields()
                form.setFieldValue('dataSourceName', source)
                form.submit()
              }}
            >
              {t('common:reset')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
      <Table
        rowKey="tableName"
        dataSource={rows}
        loading={loading}
        pagination={false}
        scroll={{ y: 220 }}
        className="gen-import-table"
        onRow={(row) => ({
          onClick: (event) => {
            if (!event.target.closest('.ant-table-selection-column'))
              setSelected((keys) =>
                keys.includes(row.tableName)
                  ? keys.filter((key) => key !== row.tableName)
                  : [...keys, row.tableName]
              )
          },
        })}
        rowSelection={{ columnWidth: 55, selectedRowKeys: selected, onChange: setSelected }}
        columns={[
          { title: t('tool:gen.tableName'), dataIndex: 'tableName' },
          { title: t('tool:gen.tableComment'), dataIndex: 'tableComment' },
          {
            title: t('common:createdTime'),
            dataIndex: 'createTime',
            render: (value) => parseTime(value),
          },
          {
            title: t('common:updatedTime'),
            dataIndex: 'updateTime',
            render: (value) => parseTime(value),
          },
        ]}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
    </Modal>
  )
}
