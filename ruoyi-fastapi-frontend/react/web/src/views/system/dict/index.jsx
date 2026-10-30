import { useLocalizedFormErrors } from '@/i18n/form'
import TranslationFields, { SourceLocaleLabel } from '@/components/TranslationFields'
import { translationPatch, localizeOptions } from '@/i18n/entities.mjs'
import { useI18n } from '@/i18n/adapter'
import { i18n, t } from '@/i18n'
import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import FormLabel from '@/components/FormLabel'
import {
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import DictDataDrawer from './detail'
import { useCallback, useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Modal, Radio, Select, Space } from 'antd'
import Table from '@/components/Table'
import {
  listType,
  getType,
  delType,
  addType,
  updateType,
  refreshCache,
} from '@/api/system/dict/type'
import { useDict, clearDictCache } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { download } from '@/utils/request'
import { getDisplayTimezone } from '@/utils/time'
import { message, confirm } from '@/plugins/modal'
import useUserStore from '@/store/modules/user'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'

export default function Dict() {
  useI18n()
  const [originalTranslations, setOriginalTranslations] = useState({})

  const navigate = useNavigate()
  const { sys_normal_disable } = useDict('sys_normal_disable')
  const [drawerRow, setDrawerRow] = useState(null)
  const timeZone = useUserStore((state) => state.timeZone)
  const [queryRef] = Form.useForm(),
    [dictRef] = Form.useForm()
  useLocalizedFormErrors(queryRef, dictRef)
  const [dictList, setDictList] = useState([]),
    [total, setTotal] = useState(0),
    [ids, setIds] = useState([])
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [showSearch, setShowSearch] = useState(true)
  const [open, setOpen] = useState(false),
    [dictId, setDictId] = useState()
  const [queryParams, setQueryParams] = useState({ pageNum: 1, pageSize: 10 })
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listType(queryParams)
      setDictList(result.rows)
      setTotal(result.total)
      setIds([])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [queryParams, timeZone])
  useEffect(() => {
    void getList()
  }, [getList])
  function handleQuery({ dateRange, ...values }) {
    setQueryParams({
      ...values,
      beginTime: dateRange?.[0]?.format('YYYY-MM-DD'),
      endTime: dateRange?.[1]?.format('YYYY-MM-DD'),
      pageNum: 1,
      pageSize: queryParams.pageSize,
    })
  }
  function handleAdd() {
    setDictId(undefined)
    dictRef.resetFields()
    setOriginalTranslations({})
    dictRef.setFieldsValue({ status: '0' })
    setOpen(true)
  }
  async function handleUpdate(id) {
    try {
      const result = await getType(id)
      setDictId(id)
      dictRef.resetFields()
      setOriginalTranslations({})
      dictRef.setFieldsValue(result.data)
      setOriginalTranslations(result.data.dictNameI18n || {})
      setOpen(true)
    } catch {}
  }
  async function handleDelete(values) {
    try {
      await confirm(t('system:deleteDictionariesWithIdsValue', { values }))
      await delType(values)
      message.success(t('common:deleteSuccess'))
      await getList()
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await dictRef.validateFields()
      values.dictNameI18n = translationPatch(values.dictNameI18n, originalTranslations)
      setSaving(true)
      await (dictId !== undefined ? updateType({ ...values, dictId }) : addType(values))
      message.success(dictId !== undefined ? t('common:updateSuccess') : t('common:addSuccess'))
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  const columns = [
    { align: 'center', title: t('system:dictionaryId'), dataIndex: 'dictId' },
    {
      align: 'center',
      title: t('system:dict.name'),
      dataIndex: 'dictName',
      ellipsis: true,
      render: (value, row) => i18n.resolveText(value, row.dictNameI18n),
    },
    {
      align: 'center',
      title: t('system:dict.type'),
      dataIndex: 'dictType',
      render: (value, row) => (
        <Button
          type="link"
          className="ruoyi-table-action"
          onClick={() => setDrawerRow(row)}
        >
          {value}
        </Button>
      ),
    },
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
    { align: 'center', title: t('common:remark'), dataIndex: 'remark', ellipsis: true },
    {
      align: 'center',
      title: t('common:createdTime'),
      dataIndex: 'createTime',
      width: 180,
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      width: 280,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:dict:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => handleUpdate(row.dictId)}
            >
              {t('common:edit')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:dict:edit']}>
            <TableAction
              symbol="Operation"
              onClick={() => navigate(`/system/dict-data/index/${row.dictId}`)}
            >
              {t('system:list')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:dict:remove']}>
            <TableAction
              symbol="Delete"
              onClick={() => handleDelete([row.dictId])}
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
          form={queryRef}
          layout="inline"
          className="search-form"
          onFinish={handleQuery}
        >
          <Form.Item
            label={<SourceLocaleLabel>{t('system:dict.name')}</SourceLocaleLabel>}
            name="dictName"
          >
            <Input
              style={{ width: 240 }}
              placeholder={t('system:dict.namePlaceholder')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('system:dict.type')}
            name="dictType"
          >
            <Input
              style={{ width: 240 }}
              placeholder={t('system:dict.typePlaceholder')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('common:status')}
            name="status"
          >
            <Select
              style={{ width: 240 }}
              placeholder={t('system:dictionaryStatus')}
              allowClear
              options={sys_normal_disable}
            />
          </Form.Item>
          <Form.Item
            label={t('common:createdTime')}
            name="dateRange"
          >
            <DatePicker.RangePicker
              style={{ width: 308 }}
              placeholder={[t('common:startDate'), t('common:endDate')]}
              aria-label={t('monitor:dateRangeValue', { arg0: getDisplayTimezone() })}
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
                  queryRef.resetFields()
                  handleQuery({})
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
              download('/system/dict/type/export', queryParams, `dict_${Date.now()}.xlsx`).catch(
                () => {}
              )
            }
          >
            {t('common:export')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:dict:remove']}>
          <Button
            icon={<ReloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            onClick={() =>
              refreshCache()
                .then(() => {
                  clearDictCache()
                  message.success(t('system:cacheRefreshed'))
                })
                .catch(() => {})
            }
          >
            {t('system:refreshCache')}
          </Button>
        </HasPermi>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={getList}
        />
      </div>
      <Table
        rowKey="dictId"
        loading={loading}
        dataSource={dictList}
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
        title={dictId !== undefined ? t('system:dict.editType') : t('system:dict.addType')}
        onCancel={() => setOpen(false)}
        onOk={submitForm}
        confirmLoading={saving}
        forceRender
      >
        <Form
          name="src-views-system-dict-index-jsx-editor-6"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '100px' }}
          form={dictRef}
          layout="horizontal"
        >
          <Form.Item
            label={<SourceLocaleLabel>{t('system:dict.name')}</SourceLocaleLabel>}
            name="dictName"
            rules={[{ required: true, message: t('system:dict.nameRequired') }]}
          >
            <Input placeholder={t('system:dict.namePlaceholder')} />
          </Form.Item>
          <TranslationFields
            name="dictNameI18n"
            label={t('system:dict.name')}
          />
          <Form.Item
            label={
              <FormLabel
                label={t('system:dict.type')}
                help={t('system:storageKeyForExampleSysUserSex')}
              />
            }
            name="dictType"
            rules={[{ required: true, message: t('system:dict.typeRequired') }]}
          >
            <Input placeholder={t('system:dict.typePlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('common:status')}
            name="status"
          >
            <Radio.Group options={sys_normal_disable} />
          </Form.Item>
          <Form.Item
            label={t('common:remark')}
            name="remark"
          >
            <Input.TextArea
              placeholder={t('common:contentPlaceholder')}
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>
      <DictDataDrawer
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
      />
    </div>
  )
}
