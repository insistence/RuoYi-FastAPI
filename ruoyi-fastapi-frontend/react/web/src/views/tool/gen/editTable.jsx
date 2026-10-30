import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
const htmlTypes = () => [
  ['input', t('tool:textInput')],
  ['textarea', t('tool:textArea')],
  ['select', t('tool:dropdown')],
  ['radio', t('tool:radioButtons')],
  ['checkbox', t('tool:checkboxes')],
  ['date', t('tool:dateNoTime')],
  ['time', t('tool:timeOfDay')],
  ['datetime', t('tool:dateAndTimeInstant')],
  ['imageUpload', t('tool:imageUpload')],
  ['fileUpload', t('tool:fileUpload')],
  ['editor', t('tool:richTextEditor')],
]
export default function EditTable({ params }) {
  useI18n()

  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
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
      message.success(t('common:updateSuccess'))
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
        message.warning(t('tool:formValidationFailedCheckTheSubmittedContent'))
      }
    } finally {
      setSaving(false)
    }
  }
  const fields = [
    {
      title: t('common:index'),
      width: '4%',
      render: (_, row, i) => (
        <span
          className="gen-drag-handle"
          draggable
          tabIndex={0}
          aria-label={t('tool:moveFieldValueUseTheUpAndDownArrow', { columnName: row.columnName })}
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
      title: t('tool:columnName'),
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
      title: t('tool:columnDescription'),
      width: '8%',
      render: (_, row, i) => (
        <Input
          value={row.columnComment}
          onChange={(e) => patch(i, 'columnComment', e.target.value)}
        />
      ),
    },
    { title: t('tool:databaseType'), dataIndex: 'columnType', width: '8%' },
    {
      title: t('tool:pythonType'),
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
      title: t('tool:pythonAttribute'),
      width: '8%',
      render: (_, row, i) => (
        <Input
          value={row.pythonField}
          onChange={(e) => patch(i, 'pythonField', e.target.value)}
        />
      ),
    },
    ...['isInsert', 'isEdit', 'isList', 'isQuery'].map((key, i) => ({
      title: [t('tool:insert'), t('common:editAction'), t('system:list'), t('monitor:search')][i],
      width: '4%',
      render: (_, row, index) => (
        <Checkbox
          aria-label={`${row.columnName} ${[t('tool:insert'), t('common:editAction'), t('system:list'), t('monitor:search')][i]}`}
          checked={row[key] === '1'}
          onChange={(e) => patch(index, key, e.target.checked ? '1' : '0')}
        />
      ),
    })),
    {
      title: t('tool:queryMethod'),
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
      title: [t('system:components.required'), t('tool:unique')][i],
      width: '4%',
      render: (_, row, index) => (
        <Checkbox
          aria-label={`${row.columnName} ${[t('system:components.required'), t('tool:unique')][i]}`}
          checked={row[key] === '1'}
          onChange={(event) => patch(index, key, event.target.checked ? '1' : '0')}
        />
      ),
    })),
    {
      title: t('tool:displayType'),
      width: '10%',
      render: (_, row, i) => (
        <Select
          style={{ width: '100%' }}
          value={row.htmlType}
          options={htmlTypes().map(([value, label]) => ({ value, label }))}
          onChange={(v) => patch(i, 'htmlType', v)}
        />
      ),
    },
    {
      title: t('system:dict.type'),
      width: '10%',
      render: (_, row, i) => (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          value={row.dictType || undefined}
          placeholder={t('common:selectPlaceholder')}
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
              label: t('common:basicInfo'),
              forceRender: true,
              children: <BasicInfoForm />,
            },
            {
              key: 'columnInfo',
              label: t('tool:columnInformation'),
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
              label: t('tool:generationSettings'),
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
            {t('common:submit')}
          </Button>
          <Button onClick={close}>{t('layout:error.back')}</Button>
        </Space>
      </Form>
    </Card>
  )
}
