import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { TableAction } from '@/components/TableActions'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, Space } from 'antd'
import Table from '@/components/Table'
import { list, forceLogout } from '@/api/monitor/online'
import { parseTime } from '@/utils/ruoyi'
import { confirm, message } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'

export default function Online() {
  useI18n()

  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
  const [query, setQuery] = useState({}),
    [rows, setRows] = useState([]),
    [loading, setLoading] = useState(false)
  const [page, setPage] = useState({ pageNum: 1, pageSize: 10 })
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await list(query)
      setRows(result.rows || [])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  useEffect(() => {
    void getList()
  }, [getList])
  function search(values) {
    setQuery(values)
    setPage({ ...page, pageNum: 1 })
  }
  async function logout(row) {
    try {
      await confirm(t('monitor:forceUserValueToSignOut', { userName: row.userName }))
      await forceLogout(row.tokenId)
      message.success(t('monitor:userSignedOut'))
      await getList()
    } catch {}
  }
  const columns = [
    {
      align: 'center',
      title: t('common:index'),
      width: 50,
      render: (_, row, index) => (page.pageNum - 1) * page.pageSize + index + 1,
    },
    ...[
      ['tokenId', t('monitor:online.sessionId')],
      ['userName', t('system:loginName')],
      ['deptName', t('system:user.department')],
      ['ipaddr', t('monitor:host')],
      ['loginLocation', t('monitor:signInLocation')],
      ['os', t('monitor:server.os')],
      ['browser', t('monitor:browser')],
    ].map(([dataIndex, title]) => ({ align: 'center', title, dataIndex, ellipsis: true })),
    {
      align: 'center',
      title: t('monitor:login.time'),
      dataIndex: 'loginTime',
      width: 180,
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      width: 80,
      render: (_, row) => (
        <HasPermi value={['monitor:online:forceLogout']}>
          <TableAction
            symbol="Delete"
            onClick={() => logout(row)}
          >
            {t('monitor:forceSignOut')}
          </TableAction>
        </HasPermi>
      ),
    },
  ]
  return (
    <div className="app-container">
      <Form
        form={form}
        layout="inline"
        className="search-form"
        onFinish={search}
      >
        <Form.Item
          label={t('monitor:login.location')}
          name="ipaddr"
        >
          <Input
            style={{ width: 200 }}
            placeholder={t('monitor:enterSignInAddress')}
            allowClear
          />
        </Form.Item>
        <Form.Item
          label={t('system:user.username')}
          name="userName"
        >
          <Input
            style={{ width: 200 }}
            placeholder={t('system:user.usernamePlaceholder')}
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
                search({})
              }}
            >
              {t('common:reset')}
            </Button>
            <Button onClick={getList}>{t('layout:tags.refresh')}</Button>
          </Space>
        </Form.Item>
      </Form>
      <Table
        loading={loading}
        rowKey="tokenId"
        dataSource={rows.slice((page.pageNum - 1) * page.pageSize, page.pageNum * page.pageSize)}
        columns={columns}
        pagination={false}
        scroll={{ x: 1200 }}
      />
      <Pagination
        total={rows.length}
        page={page.pageNum}
        limit={page.pageSize}
        onChange={setPage}
      />
    </div>
  )
}
