import { useLocalizedFormErrors } from '@/i18n/form'
import TranslationFields, { SourceLocaleLabel } from '@/components/TranslationFields'
import { translationPatch, localizeOptions } from '@/i18n/entities.mjs'
import { useI18n } from '@/i18n/adapter'
import { i18n, t } from '@/i18n'
import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import {
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  DownloadOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Radio, Select, Space } from 'antd'
import Table from '@/components/Table'
import { useNavigate } from 'react-router-dom'
import { listData, getData, delData, addData, updateData } from '@/api/system/dict/data'
import { getType, optionselect } from '@/api/system/dict/type'
import { useDict, clearDictCache } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { download } from '@/utils/request'
import { message, confirm } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
const listClassOptions = [
  {
    value: 'default',
    get label() {
      return t('layout:size.default')
    },
  },
  {
    value: 'primary',
    get label() {
      return t('system:primary')
    },
  },
  {
    value: 'success',
    get label() {
      return t('common:success')
    },
  },
  {
    value: 'info',
    get label() {
      return t('system:information')
    },
  },
  {
    value: 'warning',
    get label() {
      return t('common:warning')
    },
  },
  {
    value: 'danger',
    get label() {
      return t('system:danger')
    },
  },
]

export default function DictData({ params }) {
  useI18n()
  const [originalTranslations, setOriginalTranslations] = useState({})

  const { sys_normal_disable } = useDict('sys_normal_disable')
  const [queryRef] = Form.useForm(),
    [dataRef] = Form.useForm(),
    navigate = useNavigate()
  useLocalizedFormErrors(queryRef, dataRef)
  const [dataList, setDataList] = useState([]),
    [total, setTotal] = useState(0),
    [typeOptions, setTypeOptions] = useState([]),
    [defaultType, setDefaultType] = useState('')
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [ids, setIds] = useState([])
  const [open, setOpen] = useState(false),
    [dictCode, setDictCode] = useState(),
    [queryParams, setQueryParams] = useState({ pageNum: 1, pageSize: 10 })
  useEffect(() => {
    getType(params.dictId)
      .then((result) => {
        setDefaultType(result.data.dictType)
        queryRef.setFieldValue('dictType', result.data.dictType)
        setQueryParams({
          pageNum: 1,
          pageSize: 10,
          dictType: result.data.dictType,
        })
      })
      .catch(() => {})
    optionselect()
      .then((result) =>
        setTypeOptions(
          result.data.map((item) => ({
            label: item.dictName,
            labelI18n: item.dictNameI18n,
            value: item.dictType,
          }))
        )
      )
      .catch(() => {})
  }, [params.dictId])
  const getList = useCallback(async () => {
    if (!queryParams.dictType) return
    setLoading(true)
    try {
      const result = await listData(queryParams)
      setDataList(result.rows)
      setTotal(result.total)
      setIds([])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [queryParams])
  useEffect(() => {
    void getList()
  }, [getList])
  function handleQuery(values) {
    setQueryParams({ ...values, pageNum: 1, pageSize: queryParams.pageSize })
  }
  function handleAdd() {
    setDictCode(undefined)
    dataRef.resetFields()
    setOriginalTranslations({})
    dataRef.setFieldsValue({
      dictType: queryParams.dictType,
      dictSort: 0,
      listClass: 'default',
      status: '0',
    })
    setOpen(true)
  }
  async function handleUpdate(id) {
    try {
      const result = await getData(id)
      setDictCode(id)
      dataRef.resetFields()
      setOriginalTranslations({})
      dataRef.setFieldsValue(result.data)
      setOriginalTranslations(result.data.dictLabelI18n || {})
      setOpen(true)
    } catch {}
  }
  async function handleDelete(values) {
    try {
      await confirm(t('system:deleteDictionaryEntriesWithCodesValue', { values }))
      await delData(values)
      clearDictCache()
      message.success(t('common:deleteSuccess'))
      await getList()
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await dataRef.validateFields()
      values.dictLabelI18n = translationPatch(values.dictLabelI18n, originalTranslations)
      setSaving(true)
      await (dictCode !== undefined ? updateData({ ...values, dictCode }) : addData(values))
      clearDictCache()
      message.success(dictCode !== undefined ? t('common:updateSuccess') : t('common:addSuccess'))
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  const columns = [
    { align: 'center', title: t('system:dictionaryCode'), dataIndex: 'dictCode' },
    {
      align: 'center',
      title: t('system:dictionaryLabel'),
      dataIndex: 'dictLabel',
      render: (value, row) => (
        <DictTag
          options={[
            {
              label: i18n.resolveText(value, row.dictLabelI18n),
              value: row.dictValue,
              elTagType: row.listClass,
            },
          ]}
          value={row.dictValue}
        />
      ),
    },
    { align: 'center', title: t('system:dictionaryValue'), dataIndex: 'dictValue' },
    { align: 'center', title: t('system:dictionarySortOrder'), dataIndex: 'dictSort' },
    {
      align: 'center',
      title: t('common:status'),
      dataIndex: 'status',
      render: (value) => (
        <DictTag
          options={sys_normal_disable}
          value={value}
        />
      ),
    },
    { align: 'center', title: t('common:remark'), dataIndex: 'remark' },
    {
      width: 180,
      align: 'center',
      title: t('common:createdTime'),
      dataIndex: 'createTime',
      render: (value) => parseTime(value),
    },
    {
      width: 160,
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:dict:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => handleUpdate(row.dictCode)}
            >
              {t('common:edit')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:dict:remove']}>
            <TableAction
              symbol="Delete"
              onClick={() => handleDelete([row.dictCode])}
            >
              {t('common:delete')}
            </TableAction>
          </HasPermi>
        </TableActions>
      ),
    },
  ]
  return (
    <div className="app-container">
      {showSearch && (
        <Form
          className="search-form"
          form={queryRef}
          layout="inline"
          onFinish={handleQuery}
        >
          <Form.Item
            name="dictType"
            label={t('system:dict.name')}
          >
            <Select
              style={{ width: 200 }}
              options={localizeOptions(typeOptions, i18n.resolveText)}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="dictLabel"
            label={t('system:dictionaryLabel')}
          >
            <Input
              style={{ width: 200 }}
              placeholder={t('system:enterADictionaryLabel')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="status"
            label={t('common:status')}
          >
            <Select
              style={{ width: 200 }}
              placeholder={t('system:dataStatus')}
              allowClear
              options={sys_normal_disable}
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
                  queryRef.resetFields()
                  queryRef.setFieldValue('dictType', defaultType)
                  handleQuery({ dictType: defaultType })
                }}
              >
                {t('common:reset')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <HasPermi value={['system:dict:add']}>
          <Button
            icon={<PlusOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            onClick={handleAdd}
          >
            {t('common:add')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:dict:edit']}>
          <Button
            icon={<EditOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--success"
            type="default"
            disabled={ids.length !== 1}
            onClick={() => handleUpdate(ids[0])}
          >
            {t('common:edit')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:dict:remove']}>
          <Button
            icon={<DeleteOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            disabled={!ids.length}
            onClick={() => handleDelete(ids)}
          >
            {t('common:delete')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:dict:export']}>
          <Button
            icon={<DownloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={() =>
              download(
                '/system/dict/data/export',
                queryParams,
                `dict_data_${Date.now()}.xlsx`
              ).catch(() => {})
            }
          >
            {t('common:export')}
          </Button>
        </HasPermi>
        <Button
          icon={<CloseOutlined />}
          className="ruoyi-plain-button ruoyi-plain-button--warning"
          type="default"
          onClick={() => navigate('/system/dict')}
        >
          {t('layout:search.close')}
        </Button>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={getList}
        />
      </div>
      <Table
        rowKey="dictCode"
        loading={loading}
        dataSource={dataList}
        columns={columns}
        pagination={false}
        scroll={{ x: 1100 }}
        rowSelection={{ selectedRowKeys: ids, onChange: setIds }}
      />
      <Pagination
        total={total}
        page={queryParams.pageNum}
        limit={queryParams.pageSize}
        onChange={(page) => setQueryParams({ ...queryParams, ...page })}
      />
      <Modal
        footer={renderDialogFooter}
        width="500px"
        open={open}
        title={dictCode !== undefined ? t('system:dict.editData') : t('system:dict.addData')}
        onCancel={() => setOpen(false)}
        onOk={submitForm}
        confirmLoading={saving}
        forceRender
      >
        <Form
          name="src-views-system-dict-data-jsx-editor-5"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '80px' }}
          form={dataRef}
          layout="horizontal"
        >
          <Form.Item
            name="dictType"
            label={t('system:dict.type')}
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="dictLabel"
            label={<SourceLocaleLabel>{t('system:dict.label')}</SourceLocaleLabel>}
            rules={[{ required: true }]}
          >
            <Input placeholder={t('system:dict.labelPlaceholder')} />
          </Form.Item>
          <TranslationFields
            name="dictLabelI18n"
            label={t('system:dict.label')}
          />
          <Form.Item
            name="dictValue"
            label={t('system:dict.value')}
            rules={[{ required: true }]}
          >
            <Input placeholder={t('system:dict.valuePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="dictSort"
            label={t('system:dept.order')}
            rules={[{ required: true }]}
          >
            <InputNumber
              min={0}
              precision={0}
            />
          </Form.Item>
          <Form.Item
            name="cssClass"
            label={t('system:cssClass')}
          >
            <Input placeholder={t('system:enterACssClass')} />
          </Form.Item>
          <Form.Item
            name="listClass"
            label={t('system:dict.listClass')}
          >
            <Select options={listClassOptions} />
          </Form.Item>
          <Form.Item
            name="status"
            label={t('common:status')}
          >
            <Radio.Group options={sys_normal_disable} />
          </Form.Item>
          <Form.Item
            name="remark"
            label={t('common:remark')}
          >
            <Input.TextArea
              placeholder={t('common:contentPlaceholder')}
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
