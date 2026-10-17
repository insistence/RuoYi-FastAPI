import './style.css'
import TableActions, { TableAction } from '@/components/TableActions'
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  PlusOutlined,
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, DatePicker, Form, Input, Select, Space } from 'antd'
import Table from '@/components/Table'
import {
  listDataSources,
  listTable,
  previewTable,
  delTable,
  genCode,
  synchDb,
} from '@/api/tool/gen'
import { checkRole } from '@/utils/permission'
import { parseTime } from '@/utils/ruoyi'
import { message, confirm } from '@/plugins/modal'
import download from '@/plugins/download'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import ImportTable from './importTable'
import CreateTable from './createTable'
import CodePreview from './CodePreview'
export default function Gen() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const [form] = Form.useForm()
  const [query, setQuery] = useState({
    pageNum: Number(search.get('pageNum')) || 1,
    pageSize: 10,
  })
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sources, setSources] = useState([])
  const [selected, setSelected] = useState([])
  const [showSearch, setShowSearch] = useState(true)
  const [preview, setPreview] = useState(null)
  const [dialog, setDialog] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await listTable(query)
      setRows(response.rows || [])
      setTotal(response.total || 0)
      setSelected([])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  useEffect(() => {
    load()
  }, [load, search.get('t')])
  useEffect(() => {
    listDataSources()
      .then((r) => setSources(r.data || []))
      .catch(() => {})
  }, [])
  const edit = (row) => navigate(`/tool/gen-edit/index/${row.tableId}?pageNum=${query.pageNum}`)
  async function remove(ids) {
    try {
      await confirm(`是否确认删除表编号为“${ids}”的生成配置？`)
      await delTable(ids)
      message.success('删除成功')
      load()
    } catch {}
  }
  async function sync(row) {
    try {
      await confirm(`确认要强制同步“${row.tableName}”表结构吗？`)
      await synchDb(row.tableName, row.dataSourceName)
      message.success('同步成功')
      load()
    } catch {}
  }
  async function generate(row) {
    const items = row ? [row] : selected
    const sourceNames = [...new Set(items.map((r) => r.dataSourceName).filter(Boolean))]
    if (sourceNames.length !== 1) return message.error('请选择同一数据源下的生成配置')
    try {
      if (row?.genType === '1') {
        await genCode(row.tableName, sourceNames[0])
        message.success(`成功生成到自定义路径：${row.genPath}`)
      } else {
        await download.zip(
          `/tool/gen/batchGenCode?tables=${encodeURIComponent(items.map((r) => r.tableName).join(','))}&dataSourceName=${encodeURIComponent(sourceNames[0])}`,
          row ? `${row.tableName}.zip` : 'vfadmin.zip'
        )
      }
    } catch {}
  }
  const columns = [
    {
      title: '序号',
      width: 50,
      align: 'center',
      render: (_, __, i) => (query.pageNum - 1) * query.pageSize + i + 1,
    },
    ...[
      ['表名称', 'tableName'],
      ['表描述', 'tableComment'],
      ['实体', 'className'],
      ['数据源', 'dataSourceName'],
    ].map(([title, dataIndex]) => ({
      title,
      dataIndex,
      ellipsis: true,
      align: 'center',
      ...(dataIndex === 'dataSourceName' ? { width: 160 } : {}),
    })),
    ...[
      ['创建时间', 'createTime'],
      ['更新时间', 'updateTime'],
    ].map(([title, dataIndex]) => ({
      title,
      dataIndex,
      width: 160,
      align: 'center',
      render: (value) => parseTime(value),
    })),
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      width: 330,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['tool:gen:preview']}>
            <TableAction
              iconOnly={true}
              symbol="View"
              onClick={() =>
                previewTable(row.tableId)
                  .then((r) => setPreview(r.data))
                  .catch(() => {})
              }
            >
              预览
            </TableAction>
          </HasPermi>
          <HasPermi value={['tool:gen:edit']}>
            <TableAction
              iconOnly={true}
              symbol="Edit"
              onClick={() => edit(row)}
            >
              编辑
            </TableAction>
          </HasPermi>
          <HasPermi value={['tool:gen:remove']}>
            <TableAction
              iconOnly={true}
              symbol="Delete"
              onClick={() => remove(row.tableId)}
            >
              删除
            </TableAction>
          </HasPermi>
          <HasPermi value={['tool:gen:edit']}>
            <TableAction
              iconOnly={true}
              symbol="Refresh"
              onClick={() => sync(row)}
            >
              同步
            </TableAction>
          </HasPermi>
          <HasPermi value={['tool:gen:code']}>
            <TableAction
              iconOnly={true}
              symbol="Download"
              onClick={() => generate(row)}
            >
              生成代码
            </TableAction>
          </HasPermi>
        </TableActions>
      ),
    },
  ]
  return (
    <div className="app-container gen-page">
      {showSearch && (
        <Form
          name="gen-search"
          form={form}
          layout="inline"
          colon={false}
          className="search-form"
          onFinish={({ dateRange, ...values }) =>
            setQuery({
              ...values,
              pageNum: 1,
              pageSize: query.pageSize,
              beginTime: dateRange?.[0]?.format('YYYY-MM-DD'),
              endTime: dateRange?.[1]?.format('YYYY-MM-DD'),
            })
          }
        >
          <Form.Item
            label="表名称"
            name="tableName"
          >
            <Input
              placeholder="请输入表名称"
              allowClear
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item
            label="表描述"
            name="tableComment"
          >
            <Input
              placeholder="请输入表描述"
              allowClear
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item
            label="数据源"
            name="dataSourceName"
          >
            <Select
              placeholder="请选择数据源"
              style={{ width: 220 }}
              allowClear
              showSearch
              optionFilterProp="label"
              options={sources.map((s) => ({
                label: `${s.name}（${s.dbType}）`,
                value: s.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="创建时间"
            name="dateRange"
            style={{ width: 308 }}
          >
            <DatePicker.RangePicker
              style={{ width: 308 }}
              separator="-"
              placeholder={['开始日期', '结束日期']}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                icon={<SearchOutlined />}
                type="primary"
                htmlType="submit"
              >
                搜索
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  form.resetFields()
                  setQuery({ pageNum: 1, pageSize: 10 })
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <Space wrap>
          <HasPermi value={['tool:gen:code']}>
            <Button
              icon={<DownloadOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--primary"
              type="default"
              disabled={!selected.length}
              onClick={() => generate()}
            >
              生成
            </Button>
          </HasPermi>
          {checkRole(['admin']) && (
            <Button
              icon={<PlusOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--primary"
              type="default"
              onClick={() => setDialog('create')}
            >
              创建
            </Button>
          )}
          <HasPermi value={['tool:gen:import']}>
            <Button
              icon={<UploadOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--info"
              type="default"
              onClick={() => setDialog('import')}
            >
              导入
            </Button>
          </HasPermi>
          <HasPermi value={['tool:gen:edit']}>
            <Button
              icon={<EditOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--success"
              type="default"
              disabled={selected.length !== 1}
              onClick={() => edit(selected[0])}
            >
              修改
            </Button>
          </HasPermi>
          <HasPermi value={['tool:gen:remove']}>
            <Button
              icon={<DeleteOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--danger"
              type="default"
              disabled={!selected.length}
              onClick={() => remove(selected.map((r) => r.tableId).join(','))}
            >
              删除
            </Button>
          </HasPermi>
        </Space>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={load}
        />
      </div>
      <Table
        rowKey="tableId"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ x: 1155 }}
        rowSelection={{
          columnWidth: 55,
          selectedRowKeys: selected.map((r) => r.tableId),
          onChange: (_, rows) => setSelected(rows),
        }}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <CodePreview
        preview={preview}
        onClose={() => setPreview(null)}
      />
      <ImportTable
        open={dialog === 'import'}
        dataSources={sources}
        onClose={() => setDialog('')}
        onSuccess={load}
      />
      <CreateTable
        open={dialog === 'create'}
        dataSources={sources}
        onClose={() => setDialog('')}
        onSuccess={load}
      />
    </div>
  )
}
