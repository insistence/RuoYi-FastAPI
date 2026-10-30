import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

  const [form] = Form.useForm(),
    navigate = useNavigate(),
    { sys_normal_disable } = useDict('sys_normal_disable')
  useLocalizedFormErrors(form)
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
        row
          ? t('system:removeTheRoleAssignmentForUserValue', { userName: row.userName })
          : t('system:removeRoleAssignmentsForTheSelectedUsers')
      )
      if (row) await authUserCancel({ userId: row.userId, roleId: params.roleId })
      else
        await authUserCancelAll({
          roleId: params.roleId,
          userIds: ids.join(','),
        })
      message.success(t('system:authorizationRevoked'))
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
            label={t('system:user.username')}
            name="userName"
          >
            <Input
              style={{ width: 240 }}
              placeholder={t('system:user.usernamePlaceholder')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('system:user.phone')}
            name="phonenumber"
          >
            <Input
              style={{ width: 240 }}
              placeholder={t('system:user.phonePlaceholder')}
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
                {t('common:search')}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  form.resetFields()
                  setQuery({ pageNum: 1, pageSize: query.pageSize })
                }}
              >
                {t('common:reset')}
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
            {t('system:addUser')}
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
            {t('system:revokeSelectedAuthorizations')}
          </Button>
        </HasPermi>
        <Button
          icon={<CloseOutlined />}
          className="ruoyi-plain-button ruoyi-plain-button--warning"
          type="default"
          onClick={() => navigate('/system/role')}
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
        rowKey="userId"
        loading={loading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 900 }}
        rowSelection={{ selectedRowKeys: ids, onChange: setIds }}
        columns={[
          { title: t('system:user.username'), dataIndex: 'userName' },
          { title: t('system:user.nickname'), dataIndex: 'nickName' },
          { title: t('system:user.email'), dataIndex: 'email' },
          { title: t('system:user.phone'), dataIndex: 'phonenumber' },
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
          {
            width: 180,
            align: 'center',
            title: t('common:createdTime'),
            dataIndex: 'createTime',
            render: (value) => parseTime(value),
          },
          {
            className: 'ruoyi-actions-cell',
            align: 'center',
            title: t('common:actions'),
            render: (_, row) => (
              <HasPermi value={['system:role:remove']}>
                <TableAction
                  symbol="CircleClose"
                  onClick={() => cancel(row)}
                >
                  {t('system:revokeAuthorization')}
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
