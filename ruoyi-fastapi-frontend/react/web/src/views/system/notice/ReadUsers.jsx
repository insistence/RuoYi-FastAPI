import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import Pagination from '@/components/Pagination'
import './style.css'
import { useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Space } from 'antd'
import Table from '@/components/Table'
import { listNoticeReadUsers } from '@/api/system/notice'
import { parseTime } from '@/utils/ruoyi'
export default function ReadUsers({ row, onClose }) {
  useI18n()

  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
  const [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false)
  useEffect(() => {
    form.resetFields()
    setQuery({ pageNum: 1, pageSize: 10 })
  }, [row, form])
  useEffect(() => {
    if (!row) return
    let active = true
    setLoading(true)
    listNoticeReadUsers({ ...query, noticeId: row.noticeId })
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
  }, [row, query])
  return (
    <Modal
      className="notice-read-users"
      title={t('system:usersWhoReadValue', { arg0: row?.noticeTitle || '' })}
      open={!!row}
      onCancel={onClose}
      footer={null}
      width="760px"
    >
      <Form
        form={form}
        size="small"
        layout="inline"
        className="notice-read-query"
        onFinish={(values) => setQuery({ pageNum: 1, pageSize: query.pageSize, ...values })}
      >
        <Form.Item name="searchValue">
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('system:loginNameUserName')}
            allowClear
            style={{ width: 220 }}
            onClear={() => {
              form.setFieldValue('searchValue', '')
              form.submit()
            }}
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
                form.submit()
              }}
            >
              {t('common:reset')}
            </Button>
          </Space>
        </Form.Item>
        <span className="read-stat">
          {t('common:total')} <strong>{total}</strong> {t('system:readers')}
        </span>
      </Form>
      <Table
        rowKey="userId"
        scroll={{ y: 300 }}
        rowClassName={(_, index) => (index % 2 ? 'table-striped-row' : '')}
        loading={loading}
        dataSource={rows}
        columns={[
          {
            title: t('common:index'),
            width: 55,
            align: 'center',
            render: (_, row, index) => index + 1,
          },
          { align: 'center', title: t('system:loginName'), dataIndex: 'userName', ellipsis: true },
          {
            title: t('system:user.username'),
            dataIndex: 'nickName',
            align: 'center',
            ellipsis: true,
          },
          {
            align: 'center',
            title: t('system:user.department'),
            dataIndex: 'deptName',
            ellipsis: true,
          },
          { title: t('system:user.phone'), dataIndex: 'phonenumber', width: 120, align: 'center' },
          {
            width: 160,
            align: 'center',
            title: t('system:readAt'),
            dataIndex: 'readTime',
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
