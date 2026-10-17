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
  const { sys_notice_status, sys_notice_type } = useDict('sys_notice_status', 'sys_notice_type')
  const [queryRef] = Form.useForm(),
    [noticeRef] = Form.useForm()
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
      message.success('保存成功')
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  async function handleDelete(values) {
    try {
      await confirm(`是否确认删除公告编号为“${values}”的数据项？`)
      await delNotice(values)
      message.success('删除成功')
      await getList()
    } catch {}
  }
  const columns = [
    { width: 100, align: 'center', title: '序号', dataIndex: 'noticeId' },
    {
      align: 'center',
      title: '公告标题',
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
      title: '公告类型',
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
      title: '状态',
      dataIndex: 'status',
      render: (value) => (
        <DictTag
          options={sys_notice_status}
          value={value}
        />
      ),
    },
    { width: 100, align: 'center', title: '创建者', dataIndex: 'createBy' },
    {
      width: 100,
      align: 'center',
      title: '创建时间',
      dataIndex: 'createTime',
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      width: 250,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:notice:query']}>
            <TableAction
              symbol="User"
              onClick={() => setReadRow(row)}
            >
              阅读用户
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:notice:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => handleEdit(row.noticeId)}
            >
              修改
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:notice:remove']}>
            <TableAction
              symbol="Delete"
              onClick={() => handleDelete([row.noticeId])}
            >
              删除
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
            label="公告标题"
            name="noticeTitle"
          >
            <Input
              style={{ width: 200 }}
              placeholder="请输入公告标题"
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="操作人员"
            name="createBy"
          >
            <Input
              style={{ width: 200 }}
              placeholder="请输入操作人员"
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="类型"
            name="noticeType"
          >
            <Select
              style={{ width: 200 }}
              placeholder="公告类型"
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
                搜索
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  queryRef.resetFields()
                  setQueryParams({ pageNum: 1, pageSize: queryParams.pageSize })
                }}
              >
                重置
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
            新增
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
            修改
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
            删除
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
        title={noticeId !== undefined ? '修改公告' : '添加公告'}
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
                label="公告标题"
                rules={[{ required: true }]}
              >
                <Input
                  placeholder="请输入公告标题"
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
                label="公告类型"
                rules={[{ required: true }]}
              >
                <Select
                  placeholder="请选择"
                  options={sys_notice_type}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="status"
            label="状态"
          >
            <Radio.Group options={sys_notice_status} />
          </Form.Item>
          <Form.Item
            name="noticeContent"
            label="内容"
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
