import TableActions, { TableAction } from '@/components/TableActions'
import { PlusOutlined } from '@ant-design/icons'
import FileTag from './FileTag'
import { renderDialogFooter } from '@/components/DialogFooter'
import { useEffect, useState } from 'react'
import { Alert, Button, Drawer, Form, Input, InputNumber, Modal, Radio } from 'antd'
import Table from '@/components/Table'
import {
  addFileRetentionPolicy,
  delFileRetentionPolicy,
  listFileRetentionPolicy,
  updateFileRetentionPolicy,
} from '@/api/system/file'
import { confirm, message } from '@/plugins/modal'
import { parseTime } from '@/utils/ruoyi'

export default function FileRetentionPolicyDrawer({ open, onClose }) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(false),
    [editing, setEditing] = useState(),
    [saving, setSaving] = useState(false),
    [form] = Form.useForm()
  async function load() {
    setLoading(true)
    try {
      const result = await listFileRetentionPolicy()
      setRows(result.data || [])
    } catch {
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (open) load()
  }, [open])
  function edit(row) {
    setEditing(row || {})
    form.resetFields()
    form.setFieldsValue(row || { businessType: '', retentionDays: 30, status: '0', remark: '' })
  }
  async function save() {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await (editing.businessType ? updateFileRetentionPolicy : addFileRetentionPolicy)({
        businessType: values.businessType,
        retentionDays: values.retentionDays,
        status: values.status,
        remark: values.remark,
      })
      message.success('保留策略保存成功')
      setEditing(undefined)
      load()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <Drawer
        rootClassName="file-drawer"
        title="文件保留策略"
        open={open}
        onClose={onClose}
        size="900px"
      >
        <Alert
          title="策略仅应用于后续新建或重建的业务引用；未配置或已停用的业务类型永久保留，既有引用不会被追溯修改。"
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
        />
        <Button
          className="ruoyi-plain-button"
          icon={<PlusOutlined />}
          onClick={() => edit()}
          style={{ marginBottom: 8 }}
        >
          新增
        </Button>
        <Table
          rowKey="businessType"
          dataSource={rows}
          loading={loading}
          pagination={false}
          scroll={{ x: 760 }}
          columns={[
            { minWidth: 140, align: 'center', title: '业务类型', dataIndex: 'businessType' },
            { width: 100, align: 'center', title: '保留天数', dataIndex: 'retentionDays' },
            {
              width: 90,
              align: 'center',
              title: '状态',
              dataIndex: 'status',
              render: (value) => (
                <FileTag type={value === '0' ? 'success' : 'info'}>
                  {value === '0' ? '启用' : '停用'}
                </FileTag>
              ),
            },
            {
              minWidth: 160,
              title: '备注',
              dataIndex: 'remark',
              ellipsis: true,
              render: (value) => value || '-',
            },
            {
              width: 180,
              align: 'center',
              title: '更新时间',
              dataIndex: 'updateTime',
              render: (value) => parseTime(value) || '-',
            },
            {
              width: 90,
              fixed: 'right',
              className: 'ruoyi-actions-cell',
              align: 'center',
              title: '操作',
              render: (_, row) => (
                <TableActions>
                  <TableAction
                    iconOnly={true}
                    symbol="Edit"
                    onClick={() => edit(row)}
                  >
                    修改
                  </TableAction>
                  <TableAction
                    iconOnly={true}
                    tone="danger"
                    symbol="Delete"
                    onClick={async () => {
                      try {
                        await confirm(`是否删除业务类型「${row.businessType}」的保留策略？`)
                        await delFileRetentionPolicy(row.businessType)
                        load()
                      } catch {}
                    }}
                  >
                    删除
                  </TableAction>
                </TableActions>
              ),
            },
          ]}
        />
      </Drawer>
      <Modal
        className="file-dialog"
        footer={renderDialogFooter}
        width="520px"
        title={editing?.businessType ? '修改文件保留策略' : '新增文件保留策略'}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={save}
        confirmLoading={saving}
      >
        <Form
          name="src-views-system-file-components-FileRetentionPolicyDrawer-jsx-editor-8"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '90px' }}
          form={form}
          layout="horizontal"
        >
          <Form.Item
            name="businessType"
            label="业务类型"
            rules={[{ required: true, message: '请输入业务类型' }]}
          >
            <Input
              placeholder="请输入业务类型"
              maxLength={50}
              disabled={!!editing?.businessType}
            />
          </Form.Item>
          <Form.Item
            name="retentionDays"
            label="保留天数"
            rules={[{ required: true }]}
          >
            <InputNumber
              min={1}
              max={36500}
              precision={0}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
          >
            <Radio.Group
              options={[
                { label: '启用', value: '0' },
                { label: '停用', value: '1' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="remark"
            label="备注"
          >
            <Input.TextArea
              placeholder="请输入备注"
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
