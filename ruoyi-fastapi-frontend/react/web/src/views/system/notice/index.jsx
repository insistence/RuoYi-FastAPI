import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import {
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { Button, Col, Form, Input, Modal, Radio, Row, Select, Space } from 'antd'
import Table from '@/components/Table'
import { listNotice, getNotice, delNotice, addNotice, updateNotice } from '@/api/system/notice'
import { useDict } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { message, confirm } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import Editor from '@/components/Editor'
import NoticeDetailView from '@/layout/components/HeaderNotice/DetailView'
import ReadUsers from './ReadUsers'
export default function Notice() {
  useI18n()

  const { sys_notice_status, sys_notice_type } = useDict('sys_notice_status', 'sys_notice_type')
  const [queryRef] = Form.useForm(),
    [noticeRef] = Form.useForm()
  useLocalizedFormErrors(queryRef, noticeRef)
  const [noticeList, setNoticeList] = useState([]),
    [total, setTotal] = useState(0),
    [ids, setIds] = useState([]),
    [queryParams, setQueryParams] = useState({ pageNum: 1, pageSize: 10 })
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [open, setOpen] = useState(false),
    [noticeId, setNoticeId] = useState(),
    [detailId, setDetailId] = useState(null),
    [readRow, setReadRow] = useState(null)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listNotice(queryParams)
      setNoticeList(result.rows)
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
  async function handleEdit(id) {
    noticeRef.resetFields()
    setNoticeId(id)
    if (id !== undefined) {
      try {
        const result = await getNotice(id)
        noticeRef.setFieldsValue(result.data)
      } catch {
        return
      }
    } else noticeRef.setFieldsValue({ status: '0', noticeContent: '' })
    setOpen(true)
  }
  async function submitForm() {
    try {
      const values = await noticeRef.validateFields()
      setSaving(true)
      await (noticeId !== undefined ? updateNotice({ ...values, noticeId }) : addNotice(values))
      message.success(t('system:savedSuccessfully'))
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  async function handleDelete(values) {
    try {
      await confirm(t('system:deleteAnnouncementsWithIdsValue', { values }))
      await delNotice(values)
      message.success(t('common:deleteSuccess'))
      await getList()
    } catch {}
  }
  const columns = [
    { width: 100, align: 'center', title: t('common:index'), dataIndex: 'noticeId' },
    {
      align: 'center',
      title: t('system:notice.titleLabel'),
      dataIndex: 'noticeTitle',
      render: (value, row) => (
        <Button
          type="link"
          onClick={() => setDetailId(row.noticeId)}
        >
          {value}
        </Button>
      ),
    },
    {
      width: 100,
      align: 'center',
      title: t('system:notice.type'),
      dataIndex: 'noticeType',
      render: (value) => (
        <DictTag
          options={sys_notice_type}
          value={value}
        />
      ),
    },
    {
      width: 100,
      align: 'center',
      title: t('common:status'),
      dataIndex: 'status',
      render: (value) => (
        <DictTag
          options={sys_notice_status}
          value={value}
        />
      ),
    },
    { width: 100, align: 'center', title: t('system:createdBy'), dataIndex: 'createBy' },
    {
      width: 100,
      align: 'center',
      title: t('common:createdTime'),
      dataIndex: 'createTime',
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      width: 250,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:notice:query']}>
            <TableAction
              symbol="User"
              onClick={() => setReadRow(row)}
            >
              {t('system:readersLabel')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:notice:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => handleEdit(row.noticeId)}
            >
              {t('common:edit')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:notice:remove']}>
            <TableAction
              symbol="Delete"
              onClick={() => handleDelete([row.noticeId])}
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
          className="search-form"
          layout="inline"
          onFinish={(values) =>
            setQueryParams({
              ...values,
              pageNum: 1,
              pageSize: queryParams.pageSize,
            })
          }
        >
          <Form.Item
            label={t('system:notice.titleLabel')}
            name="noticeTitle"
          >
            <Input
              style={{ width: 200 }}
              placeholder={t('system:enterAnnouncementTitle')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('monitor:log.operator')}
            name="createBy"
          >
            <Input
              style={{ width: 200 }}
              placeholder={t('system:enterOperatorName')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('common:type')}
            name="noticeType"
          >
            <Select
              style={{ width: 200 }}
              placeholder={t('system:notice.type')}
              allowClear
              options={sys_notice_type}
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
                  setQueryParams({ pageNum: 1, pageSize: queryParams.pageSize })
                }}
              >
                {t('common:reset')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <HasPermi value={['system:notice:add']}>
          <Button
            icon={<PlusOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            onClick={() => handleEdit()}
          >
            {t('common:add')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:notice:edit']}>
          <Button
            icon={<EditOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--success"
            type="default"
            disabled={ids.length !== 1}
            onClick={() => handleEdit(ids[0])}
          >
            {t('common:edit')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:notice:remove']}>
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
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={getList}
        />
      </div>
      <Table
        rowKey="noticeId"
        loading={loading}
        dataSource={noticeList}
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
        title={noticeId !== undefined ? t('system:editAnnouncement') : t('system:addAnnouncement')}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submitForm}
        confirmLoading={saving}
        width="780px"
        forceRender
      >
        <Form
          name="src-views-system-notice-index-jsx-editor-12"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '80px' }}
          form={noticeRef}
          layout="horizontal"
        >
          <Row gutter={20}>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="noticeTitle"
                label={t('system:notice.titleLabel')}
                rules={[{ required: true }]}
              >
                <Input
                  placeholder={t('system:enterAnnouncementTitle')}
                  maxLength={50}
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="noticeType"
                label={t('system:notice.type')}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder={t('common:selectPlaceholder')}
                  options={sys_notice_type}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="status"
            label={t('common:status')}
          >
            <Radio.Group options={sys_notice_status} />
          </Form.Item>
          <Form.Item
            name="noticeContent"
            label={t('common:content')}
          >
            <Editor />
          </Form.Item>
        </Form>
      </Modal>
      <NoticeDetailView
        noticeId={detailId}
        onClose={() => setDetailId(null)}
      />
      <ReadUsers
        row={readRow}
        onClose={() => setReadRow(null)}
      />
    </div>
  )
}
