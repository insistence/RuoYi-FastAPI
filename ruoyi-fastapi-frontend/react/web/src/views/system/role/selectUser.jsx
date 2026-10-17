import { parseTime } from '@/utils/ruoyi'
import Pagination from '@/components/Pagination'
import { renderDialogFooter } from '@/components/DialogFooter'
import { useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Space } from 'antd'
import Table from '@/components/Table'
import { unallocatedUserList, authUserSelectAll } from '@/api/system/role'
import { useDict } from '@/utils/dict'
import { message } from '@/plugins/modal'
import DictTag from '@/components/DictTag'
export default function SelectUser({ open, roleId, onClose, onSuccess }) {
  const [form] = Form.useForm(),
    { sys_normal_disable } = useDict('sys_normal_disable')
  const [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [ids, setIds] = useState([]),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) {
      form.resetFields()
      setQuery({ pageNum: 1, pageSize: 10 })
      setIds([])
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    unallocatedUserList({ ...query, roleId })
      .then((result) => {
        if (active) {
          setRows(result.rows)
          setTotal(result.total)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, query, roleId])
  async function submit() {
    if (!ids.length) return message.warning('请选择要分配的用户')
    setSaving(true)
    try {
      await authUserSelectAll({ roleId, userIds: ids.join(',') })
      message.success('授权成功')
      onSuccess()
      onClose()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      footer={renderDialogFooter}
      title="选择用户"
      open={open}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      width="800px"
      style={{ top: '5vh' }}
      forceRender
    >
      <Form
        form={form}
        className="search-form"
        layout="inline"
        onFinish={(values) => setQuery({ ...values, pageNum: 1, pageSize: 10 })}
      >
        <Form.Item
          label="用户名称"
          name="userName"
        >
          <Input
            style={{ width: 180 }}
            placeholder="请输入用户名称"
            allowClear
          />
        </Form.Item>
        <Form.Item
          label="手机号码"
          name="phonenumber"
        >
          <Input
            style={{ width: 180 }}
            placeholder="请输入手机号码"
            allowClear
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              htmlType="submit"
              type="primary"
            >
              搜索
            </Button>
            <Button
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
      <Table
        rowKey="userId"
        scroll={{ y: 220 }}
        onRow={(row) => ({
          onClick: (event) => {
            if (!event.target.closest('.ant-checkbox-wrapper'))
              setIds((ids) =>
                ids.includes(row.userId)
                  ? ids.filter((id) => id !== row.userId)
                  : [...ids, row.userId]
              )
          },
        })}
        loading={loading}
        dataSource={rows}
        rowSelection={{
          selectedRowKeys: ids,
          onChange: setIds,
          preserveSelectedRowKeys: true,
        }}
        columns={[
          { title: '用户名称', dataIndex: 'userName' },
          { title: '用户昵称', dataIndex: 'nickName' },
          { title: '邮箱', dataIndex: 'email' },
          { title: '手机', dataIndex: 'phonenumber' },
          {
            align: 'center',
            title: '状态',
            dataIndex: 'status',
            render: (value) => (
              <DictTag
                options={sys_normal_disable}
                value={value}
              />
            ),
          },
          {
            title: '创建时间',
            dataIndex: 'createTime',
            width: 180,
            align: 'center',
            render: (value) => parseTime(value),
          },
        ]}
        pagination={false}
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
