import './style.css'
import useTagsViewStore from '@/store/modules/tagsView'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Checkbox, Form, Input, Select, Space, Tabs } from 'antd'
import Table from '@/components/Table'
import { getGenTable, updateGenTable } from '@/api/tool/gen'
import { optionselect } from '@/api/system/dict/type'
import { message } from '@/plugins/modal'
import BasicInfoForm from './basicInfoForm'
import GenInfoForm from './genInfoForm'
const pythonTypes = [
  'str',
  'int',
  'float',
  'Decimal',
  'date',
  'time',
  'datetime',
  'bytes',
  'dict',
  'list',
]
const htmlTypes = [
  ['input', '文本框'],
  ['textarea', '文本域'],
  ['select', '下拉框'],
  ['radio', '单选框'],
  ['checkbox', '复选框'],
  ['date', '日期（不含时间）'],
  ['time', '时间（一天内）'],
  ['datetime', '日期时间（真实时刻）'],
  ['imageUpload', '图片上传'],
  ['fileUpload', '文件上传'],
  ['editor', '富文本控件'],
]
export default function EditTable({ params }) {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [search] = useSearchParams()
  const [columns, setColumns] = useState([])
  const [tables, setTables] = useState([])
  const [dicts, setDicts] = useState([])
  const [info, setInfo] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('columnInfo')
  const dragIndex = useRef(null)
  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([getGenTable(params.tableId), optionselect()])
      .then(([r, d]) => {
        if (!active) return
        setInfo(r.data.info)
        setColumns(r.data.rows || [])
        setTables(r.data.tables || [])
        setDicts(d.data || [])
        form.setFieldsValue({
          ...r.data.info,
          tplWebType: r.data.info.tplWebType || 'react-antd',
        })
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [params.tableId])
  function patch(index, field, value) {
    setColumns((items) =>
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }
  function move(from, to) {
    if (from === null || to < 0 || to >= columns.length || from === to) return
    setColumns((items) => {
      const next = [...items]
      next.splice(to, 0, next.splice(from, 1)[0])
      return next.map((row, i) => ({ ...row, sort: i + 1 }))
    })
  }
  const close = () => {
    useTagsViewStore.getState().closeView(pathname)
    navigate(`/tool/gen?t=${Date.now()}&pageNum=${search.get('pageNum') || 1}`)
  }
  async function submit() {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        ...info,
        ...values,
        columns,
        params: {
          genView: values.view ? '1' : '0',
          treeCode: values.treeCode,
          treeName: values.treeName,
          treeParentCode: values.treeParentCode,
          parentMenuId: values.parentMenuId,
        },
      }
      await updateGenTable(payload)
      message.success('修改成功')
      close()
    } catch (e) {
      if (e.errorFields) {
        const names = e.errorFields.map((f) => f.name[0])
        setTab(
          names.some((n) =>
            ['tableName', 'tableComment', 'className', 'functionAuthor'].includes(n)
          )
            ? 'basic'
            : 'genInfo'
        )
        message.warning('表单校验未通过，请检查提交内容')
      }
    } finally {
      setSaving(false)
    }
  }
  const fields = [
    {
      title: '序号',
      width: '4%',
      render: (_, row, i) => (
        <span
          className="gen-drag-handle"
          draggable
          tabIndex={0}
          aria-label={`移动字段 ${row.columnName}，按上下方向键排序`}
          onDragStart={() => {
            dragIndex.current = i
          }}
          onDragEnd={() => {
            dragIndex.current = null
          }}
          onKeyDown={(event) => {
            if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
              event.preventDefault()
              move(i, i + (event.key === 'ArrowUp' ? -1 : 1))
            }
          }}
        >
          {i + 1}
        </span>
      ),
    },
    {
      title: '字段列名',
      dataIndex: 'columnName',
      width: '8%',
      ellipsis: true,
      onCell: (_, i) => ({
        draggable: true,
        onDragStart: () => {
          dragIndex.current = i
        },
        onDragEnd: () => {
          dragIndex.current = null
        },
        style: { cursor: 'grab' },
      }),
    },
    {
      title: '字段描述',
      width: '8%',
      render: (_, row, i) => (
        <Input
          value={row.columnComment}
          onChange={(e) => patch(i, 'columnComment', e.target.value)}
        />
      ),
    },
    { title: '物理类型', dataIndex: 'columnType', width: '8%' },
    {
      title: 'Python类型',
      width: '8%',
      render: (_, row, i) => (
        <Select
          style={{ width: '100%' }}
          value={row.pythonType}
          options={pythonTypes.map((value) => ({ value, label: value }))}
          onChange={(v) => patch(i, 'pythonType', v)}
        />
      ),
    },
    {
      title: 'Python属性',
      width: '8%',
      render: (_, row, i) => (
        <Input
          value={row.pythonField}
          onChange={(e) => patch(i, 'pythonField', e.target.value)}
        />
      ),
    },
    ...['isInsert', 'isEdit', 'isList', 'isQuery'].map((key, i) => ({
      title: ['插入', '编辑', '列表', '查询'][i],
      width: '4%',
      render: (_, row, index) => (
        <Checkbox
          aria-label={`${row.columnName} ${['插入', '编辑', '列表', '查询'][i]}`}
          checked={row[key] === '1'}
          onChange={(e) => patch(index, key, e.target.checked ? '1' : '0')}
        />
      ),
    })),
    {
      title: '查询方式',
      width: '8%',
      render: (_, row, i) => (
        <Select
          style={{ width: '100%' }}
          value={row.queryType}
          options={['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'LIKE', 'BETWEEN'].map((value, i) => ({
            value,
            label: ['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'BETWEEN'][i],
          }))}
          onChange={(v) => patch(i, 'queryType', v)}
        />
      ),
    },
    ...['isRequired', 'isUnique'].map((key, i) => ({
      title: ['必填', '唯一'][i],
      width: '4%',
      render: (_, row, index) => (
        <Checkbox
          aria-label={`${row.columnName} ${['必填', '唯一'][i]}`}
          checked={row[key] === '1'}
          onChange={(event) => patch(index, key, event.target.checked ? '1' : '0')}
        />
      ),
    })),
    {
      title: '显示类型',
      width: '10%',
      render: (_, row, i) => (
        <Select
          style={{ width: '100%' }}
          value={row.htmlType}
          options={htmlTypes.map(([value, label]) => ({ value, label }))}
          onChange={(v) => patch(i, 'htmlType', v)}
        />
      ),
    },
    {
      title: '字典类型',
      width: '10%',
      render: (_, row, i) => (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          value={row.dictType || undefined}
          placeholder="请选择"
          options={dicts.map((d) => ({
            value: d.dictType,
            label: `${d.dictName} (${d.dictType})`,
          }))}
          onChange={(v) => patch(i, 'dictType', v || '')}
        />
      ),
    },
  ]
  return (
    <Card
      className="gen-edit"
      loading={loading}
    >
      <Form
        className="gen-edit-form"
        form={form}
        layout="horizontal"
        colon={false}
        labelCol={{ flex: '150px' }}
        wrapperCol={{ flex: '1 1 0' }}
      >
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'basic',
              label: '基本信息',
              forceRender: true,
              children: <BasicInfoForm />,
            },
            {
              key: 'columnInfo',
              label: '字段信息',
              forceRender: true,
              children: (
                <Table
                  rowKey="columnId"
                  size="small"
                  dataSource={columns}
                  columns={fields}
                  pagination={false}
                  scroll={{ x: 1000, y: 'calc(100vh - 285px)' }}
                  onRow={(_, i) => ({
                    onDragOver: (e) => e.preventDefault(),
                    onDrop: (e) => {
                      e.preventDefault()
                      move(dragIndex.current, i)
                      dragIndex.current = null
                    },
                  })}
                />
              ),
            },
            {
              key: 'genInfo',
              label: '生成信息',
              forceRender: true,
              children: (
                <GenInfoForm
                  form={form}
                  columns={columns}
                  tables={tables}
                />
              ),
            },
          ]}
        />
        <Space className={`gen-edit-footer${tab !== 'columnInfo' ? ' gen-edit-footer-form' : ''}`}>
          <Button
            type="primary"
            loading={saving}
            onClick={submit}
          >
            提交
          </Button>
          <Button onClick={close}>返回</Button>
        </Space>
      </Form>
    </Card>
  )
}
