import { TableAction } from '@/components/TableActions'
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  CloseCircleOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, Space } from 'antd'
import Table from '@/components/Table'
import { useNavigate } from 'react-router-dom'
import { allocatedUserList, authUserCancel, authUserCancelAll } from '@/api/system/role'
import { useDict } from '@/utils/dict'
import { message, confirm } from '@/plugins/modal'
import { parseTime } from '@/utils/ruoyi'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import SelectUser from './selectUser'
export default function AuthUser({ params }) {
  const [form] = Form.useForm(),
    navigate = useNavigate(),
    { sys_normal_disable } = useDict('sys_normal_disable')
  const [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [ids, setIds] = useState([]),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [selectOpen, setSelectOpen] = useState(false)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await allocatedUserList({
        ...query,
        roleId: params.roleId,
      })
      setRows(result.rows)
      setTotal(result.total)
      setIds([])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query, params.roleId])
  useEffect(() => {
    void getList()
  }, [getList])
  async function cancel(row) {
    try {
      await confirm(
        row ? `确认取消用户“${row.userName}”的角色授权吗？` : '是否取消选中用户的角色授权？'
      )
      if (row) await authUserCancel({ userId: row.userId, roleId: params.roleId })
      else
        await authUserCancelAll({
          roleId: params.roleId,
          userIds: ids.join(','),
        })
      message.success('取消授权成功')
      await getList()
    } catch {}
  }
  return (
    <div className="app-container">
      {showSearch && (
        <Form
          form={form}
          className="search-form"
          layout="inline"
          onFinish={(values) => setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })}
        >
          <Form.Item
            label="用户名称"
            name="userName"
          >
            <Input
              style={{ width: 240 }}
              placeholder="请输入用户名称"
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="手机号码"
            name="phonenumber"
          >
            <Input
              style={{ width: 240 }}
              placeholder="请输入手机号码"
              allowClear
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
                  setQuery({ pageNum: 1, pageSize: query.pageSize })
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <HasPermi value={['system:role:add']}>
          <Button
            icon={<PlusOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            onClick={() => setSelectOpen(true)}
          >
            添加用户
          </Button>
        </HasPermi>
        <HasPermi value={['system:role:remove']}>
          <Button
            icon={<CloseCircleOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            disabled={!ids.length}
            onClick={() => cancel()}
          >
            批量取消授权
          </Button>
        </HasPermi>
        <Button
          icon={<CloseOutlined />}
          className="ruoyi-plain-button ruoyi-plain-button--warning"
          type="default"
          onClick={() => navigate('/system/role')}
        >
          关闭
        </Button>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={getList}
        />
      </div>
      <Table
        rowKey="userId"
        loading={loading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 900 }}
        rowSelection={{ selectedRowKeys: ids, onChange: setIds }}
        columns={[
          { title: '用户名称', dataIndex: 'userName' },
          { title: '用户昵称', dataIndex: 'nickName' },
          { title: '邮箱', dataIndex: 'email' },
          { title: '手机号码', dataIndex: 'phonenumber' },
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
            width: 180,
            align: 'center',
            title: '创建时间',
            dataIndex: 'createTime',
            render: (value) => parseTime(value),
          },
          {
            className: 'ruoyi-actions-cell',
            align: 'center',
            title: '操作',
            render: (_, row) => (
              <HasPermi value={['system:role:remove']}>
                <TableAction
                  symbol="CircleClose"
                  onClick={() => cancel(row)}
                >
                  取消授权
                </TableAction>
              </HasPermi>
            ),
          },
        ]}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <SelectUser
        roleId={params.roleId}
        open={selectOpen}
        onClose={() => setSelectOpen(false)}
        onSuccess={getList}
      />
    </div>
  )
}
