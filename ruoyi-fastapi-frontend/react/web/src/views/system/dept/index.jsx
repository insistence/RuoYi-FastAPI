import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import { PlusOutlined, SearchOutlined, ReloadOutlined, CheckOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  TreeSelect,
} from 'antd'
import Table from '@/components/Table'
import {
  listDept,
  getDept,
  delDept,
  addDept,
  updateDept,
  updateDeptSort,
  listDeptExcludeChild,
} from '@/api/system/dept'
import { useDict } from '@/utils/dict'
import { handleTree, parseTime } from '@/utils/ruoyi'
import { checkPermi } from '@/utils/permission'
import { message, confirm } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import RightToolbar from '@/components/RightToolbar'

export default function Dept() {
  const { sys_normal_disable } = useDict('sys_normal_disable')
  const [queryRef] = Form.useForm(),
    [deptRef] = Form.useForm()
  const [rows, setRows] = useState([]),
    [orders, setOrders] = useState({}),
    [expanded, setExpanded] = useState([])
  const [deptOptions, setDeptOptions] = useState([]),
    [deptId, setDeptId] = useState(),
    [query, setQuery] = useState({})
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [showSearch, setShowSearch] = useState(true)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listDept(query)
      setRows(result.data)
      setOrders({})
      setExpanded(result.data.map((row) => row.deptId))
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  useEffect(() => {
    void getList()
  }, [getList])
  async function handleAdd(parent) {
    try {
      const result = await listDept()
      setDeptOptions(handleTree(result.data, 'deptId'))
      setDeptId(undefined)
      deptRef.resetFields()
      deptRef.setFieldsValue({
        parentId: parent?.deptId,
        orderNum: 0,
        status: '0',
      })
      setOpen(true)
    } catch {}
  }
  async function handleUpdate(row) {
    try {
      const [options, result] = await Promise.all([
        listDeptExcludeChild(row.deptId),
        getDept(row.deptId),
      ])
      setDeptOptions(handleTree(options.data, 'deptId'))
      setDeptId(row.deptId)
      deptRef.resetFields()
      deptRef.setFieldsValue(result.data)
      setOpen(true)
    } catch {}
  }
  async function handleDelete(row) {
    try {
      await confirm(`是否确认删除名称为“${row.deptName}”的数据项？`)
      await delDept(row.deptId)
      message.success('删除成功')
      await getList()
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await deptRef.validateFields()
      setSaving(true)
      await (deptId !== undefined ? updateDept({ ...values, deptId }) : addDept(values))
      message.success('保存成功')
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  async function handleSaveSort() {
    const changed = rows.filter(
      (row) =>
        orders[row.deptId] !== undefined && String(orders[row.deptId]) !== String(row.orderNum)
    )
    if (!changed.length) return message.warning('未检测到排序修改')
    try {
      await updateDeptSort({
        deptIds: changed.map((row) => row.deptId).join(','),
        orderNums: changed.map((row) => orders[row.deptId]).join(','),
      })
      message.success('排序保存成功')
      await getList()
    } catch {}
  }
  const columns = [
    { title: '部门名称', dataIndex: 'deptName', width: 260 },
    {
      title: '排序',
      dataIndex: 'orderNum',
      width: 200,
      render: (value, row) => (
        <InputNumber
          size="small"
          min={0}
          precision={0}
          value={orders[row.deptId] ?? value}
          disabled={!checkPermi(['system:dept:edit'])}
          onChange={(value) => setOrders({ ...orders, [row.deptId]: value ?? 0 })}
        />
      ),
    },
    {
      width: 100,
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
      width: 200,
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
        <TableActions>
          <HasPermi value={['system:dept:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => handleUpdate(row)}
            >
              修改
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:dept:add']}>
            <TableAction
              symbol="Plus"
              onClick={() => handleAdd(row)}
            >
              新增
            </TableAction>
          </HasPermi>
          {row.parentId !== 0 && (
            <HasPermi value={['system:dept:remove']}>
              <TableAction
                symbol="Delete"
                onClick={() => handleDelete(row)}
              >
                删除
              </TableAction>
            </HasPermi>
          )}
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
          onFinish={setQuery}
        >
          <Form.Item
            label="部门名称"
            name="deptName"
          >
            <Input
              style={{ width: 200 }}
              placeholder="请输入部门名称"
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
          >
            <Select
              style={{ width: 200 }}
              placeholder="部门状态"
              allowClear
              options={sys_normal_disable}
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
                  setQuery({})
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <HasPermi value={['system:dept:add']}>
          <Button
            icon={<PlusOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            onClick={() => handleAdd()}
          >
            新增
          </Button>
        </HasPermi>
        <HasPermi value={['system:dept:edit']}>
          <Button
            icon={<CheckOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={handleSaveSort}
          >
            保存排序
          </Button>
        </HasPermi>
        <Button
          className="ruoyi-plain-button ruoyi-plain-button--info"
          type="default"
          onClick={() => setExpanded(expanded.length ? [] : rows.map((row) => row.deptId))}
        >
          展开 / 折叠
        </Button>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={getList}
        />
      </div>
      <Table
        rowKey="deptId"
        loading={loading}
        columns={columns}
        dataSource={handleTree(
          rows.map((row) => ({ ...row })),
          'deptId'
        )}
        pagination={false}
        scroll={{ x: 900 }}
        expandable={{
          expandedRowKeys: expanded,
          onExpandedRowsChange: setExpanded,
        }}
      />
      <Modal
        footer={renderDialogFooter}
        title={deptId !== undefined ? '修改部门' : '添加部门'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submitForm}
        confirmLoading={saving}
        forceRender
        width="600px"
      >
        <Form
          name="src-views-system-dept-index-jsx-editor-4"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '80px' }}
          form={deptRef}
          layout="horizontal"
        >
          <Form.Item
            label="上级部门"
            name="parentId"
            rules={[{ required: true, message: '上级部门不能为空' }]}
          >
            <TreeSelect
              placeholder="选择上级部门"
              treeData={[{ deptId: 0, deptName: '顶级部门', children: deptOptions }]}
              fieldNames={{
                value: 'deptId',
                label: 'deptName',
                children: 'children',
              }}
              treeDefaultExpandAll
              showSearch
              treeNodeFilterProp="deptName"
            />
          </Form.Item>
          <Row gutter={20}>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="deptName"
                label="部门名称"
                rules={[{ required: true }]}
              >
                <Input
                  placeholder="请输入部门名称"
                  maxLength={30}
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="orderNum"
                label="显示排序"
                rules={[{ required: true }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="leader"
                label="负责人"
              >
                <Input
                  placeholder="请输入负责人"
                  maxLength={20}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="联系电话"
                rules={[{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' }]}
              >
                <Input
                  placeholder="请输入联系电话"
                  maxLength={11}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[{ type: 'email' }]}
              >
                <Input
                  placeholder="请输入邮箱"
                  maxLength={50}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="部门状态"
              >
                <Radio.Group options={sys_normal_disable} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
