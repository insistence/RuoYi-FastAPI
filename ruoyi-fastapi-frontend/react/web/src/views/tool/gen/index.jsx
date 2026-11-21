import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

  const navigate = useNavigate()
  const [search] = useSearchParams()
  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
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
      await confirm(t('tool:deleteGenerationConfigurationsForTableIdsValue', { ids }))
      await delTable(ids)
      message.success(t('common:deleteSuccess'))
      load()
    } catch {}
  }
  async function sync(row) {
    try {
      await confirm(t('tool:forceSynchronizationOfTableValue', { tableName: row.tableName }))
      await synchDb(row.tableName, row.dataSourceName)
      message.success(t('tool:synchronizedSuccessfully'))
      load()
    } catch {}
  }
  async function generate(row) {
    const items = row ? [row] : selected
    const sourceNames = [...new Set(items.map((r) => r.dataSourceName).filter(Boolean))]
    if (sourceNames.length !== 1)
      return message.error(t('tool:selectGenerationConfigurationsFromTheSameDataSource'))
    try {
      if (row?.genType === '1') {
        await genCode(row.tableName, sourceNames[0])
        message.success(t('tool:generatedSuccessfullyAtCustomPathValue', { genPath: row.genPath }))
      } else {
        await download.zip(
          `/tool/gen/batchGenCode?tables=${encodeURIComponent(items.map((r) => r.tableName).join(','))}&dataSourceName=${encodeURIComponent(sourceNames[0])}`,
          row ? `${row.tableName}.zip` : 'ruoyi-fastapi.zip'
        )
      }
    } catch {}
  }
  const columns = [
    {
      title: t('common:index'),
      width: 50,
      align: 'center',
      render: (_, __, i) => (query.pageNum - 1) * query.pageSize + i + 1,
    },
    ...[
      [t('tool:gen.tableName'), 'tableName'],
      [t('tool:gen.tableComment'), 'tableComment'],
      [t('tool:entity'), 'className'],
      [t('tool:datasource.title'), 'dataSourceName'],
    ].map(([title, dataIndex]) => ({
      title,
      dataIndex,
      ellipsis: true,
      align: 'center',
      ...(dataIndex === 'dataSourceName' ? { width: 160 } : {}),
    })),
    ...[
      [t('common:createdTime'), 'createTime'],
      [t('common:updatedTime'), 'updateTime'],
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
      title: t('common:actions'),
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
              {t('common:preview')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['tool:gen:edit']}>
            <TableAction
              iconOnly={true}
              symbol="Edit"
              onClick={() => edit(row)}
            >
              {t('common:editAction')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['tool:gen:remove']}>
            <TableAction
              iconOnly={true}
              symbol="Delete"
              onClick={() => remove(row.tableId)}
            >
              {t('common:delete')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['tool:gen:edit']}>
            <TableAction
              iconOnly={true}
              symbol="Refresh"
              onClick={() => sync(row)}
            >
              {t('tool:synchronize')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['tool:gen:code']}>
            <TableAction
              iconOnly={true}
              symbol="Download"
              onClick={() => generate(row)}
            >
              {t('tool:generateCode')}
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
            label={t('tool:gen.tableName')}
            name="tableName"
          >
            <Input
              placeholder={t('tool:enterTableName')}
              allowClear
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item
            label={t('tool:gen.tableComment')}
            name="tableComment"
          >
            <Input
              placeholder={t('tool:enterTableDescription')}
              allowClear
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item
            label={t('tool:datasource.title')}
            name="dataSourceName"
          >
            <Select
              placeholder={t('tool:datasource.select')}
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
            label={t('common:createdTime')}
            name="dateRange"
            style={{ width: 308 }}
          >
            <DatePicker.RangePicker
              style={{ width: 308 }}
              separator="-"
              placeholder={[t('common:startDate'), t('common:endDate')]}
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
              {t('tool:generate')}
            </Button>
          </HasPermi>
          {checkRole(['admin']) && (
            <Button
              icon={<PlusOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--primary"
              type="default"
              onClick={() => setDialog('create')}
            >
              {t('tool:create')}
            </Button>
          )}
          <HasPermi value={['tool:gen:import']}>
            <Button
              icon={<UploadOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--info"
              type="default"
              onClick={() => setDialog('import')}
            >
              {t('common:import')}
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
              {t('common:edit')}
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
              {t('common:delete')}
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
