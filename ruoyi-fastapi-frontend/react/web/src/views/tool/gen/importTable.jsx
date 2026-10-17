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
  const [form] = Form.useForm()
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
    if (!selected.length) return message.warning('请选择要导入的表')
    setSaving(true)
    try {
      await importTable({
        tables: selected.join(','),
        dataSourceName: query.dataSourceName,
      })
      message.success('导入成功')
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
      title="导入表"
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
          label="数据源"
          name="dataSourceName"
          required
        >
          <Select
            placeholder="请选择数据源"
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
          label="表名称"
          name="tableName"
        >
          <Input
            placeholder="请输入表名称"
            allowClear
            style={{ width: 180 }}
          />
        </Form.Item>
        <Form.Item
          label="表描述"
          name="tableComment"
        >
          <Input
            placeholder="请输入表描述"
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
              搜索
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
              重置
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
          { title: '表名称', dataIndex: 'tableName' },
          { title: '表描述', dataIndex: 'tableComment' },
          {
            title: '创建时间',
            dataIndex: 'createTime',
            render: (value) => parseTime(value),
          },
          {
            title: '更新时间',
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
