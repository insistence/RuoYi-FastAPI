import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

  const { sys_normal_disable } = useDict('sys_normal_disable')
  const [queryRef] = Form.useForm(),
    [deptRef] = Form.useForm()
  useLocalizedFormErrors(queryRef, deptRef)
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
      await confirm(t('system:dept.deleteTheItemNamedValue', { deptName: row.deptName }))
      await delDept(row.deptId)
      message.success(t('common:deleteSuccess'))
      await getList()
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await deptRef.validateFields()
      setSaving(true)
      await (deptId !== undefined ? updateDept({ ...values, deptId }) : addDept(values))
      message.success(t('system:savedSuccessfully'))
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
    if (!changed.length) return message.warning(t('system:noSortOrderChangesDetected'))
    try {
      await updateDeptSort({
        deptIds: changed.map((row) => row.deptId).join(','),
        orderNums: changed.map((row) => orders[row.deptId]).join(','),
      })
      message.success(t('system:sortOrderSaved'))
      await getList()
    } catch {}
  }
  const columns = [
    { title: t('system:dept.name'), dataIndex: 'deptName', width: 260 },
    {
      title: t('common:sort'),
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
      width: 200,
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
        <TableActions>
          <HasPermi value={['system:dept:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => handleUpdate(row)}
            >
              {t('common:edit')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:dept:add']}>
            <TableAction
              symbol="Plus"
              onClick={() => handleAdd(row)}
            >
              {t('common:add')}
            </TableAction>
          </HasPermi>
          {row.parentId !== 0 && (
            <HasPermi value={['system:dept:remove']}>
              <TableAction
                symbol="Delete"
                onClick={() => handleDelete(row)}
              >
                {t('common:delete')}
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
            label={t('system:dept.name')}
            name="deptName"
          >
            <Input
              style={{ width: 200 }}
              placeholder={t('common:enterADepartmentName')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('common:status')}
            name="status"
          >
            <Select
              style={{ width: 200 }}
              placeholder={t('system:dept.status')}
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
                {t('common:search')}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  queryRef.resetFields()
                  setQuery({})
                }}
              >
                {t('common:reset')}
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
            {t('common:add')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:dept:edit']}>
          <Button
            icon={<CheckOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={handleSaveSort}
          >
            {t('system:saveSortOrder')}
          </Button>
        </HasPermi>
        <Button
          className="ruoyi-plain-button ruoyi-plain-button--info"
          type="default"
          onClick={() => setExpanded(expanded.length ? [] : rows.map((row) => row.deptId))}
        >
          {t('system:expandCollapse')}
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
        title={deptId !== undefined ? t('system:editDepartment') : t('system:addDepartment')}
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
            label={t('system:dept.parent')}
            name="parentId"
            rules={[{ required: true, message: t('system:parentDepartmentIsRequired') }]}
          >
            <TreeSelect
              placeholder={t('system:selectParentDepartment')}
              treeData={[
                { deptId: 0, deptName: t('system:rootDepartment'), children: deptOptions },
              ]}
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
                label={t('system:dept.name')}
                rules={[{ required: true }]}
              >
                <Input
                  placeholder={t('common:enterADepartmentName')}
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
                label={t('system:dept.order')}
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
                label={t('system:dept.leader')}
              >
                <Input
                  placeholder={t('system:enterManagerName')}
                  maxLength={20}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label={t('system:dept.phone')}
                rules={[{ pattern: /^1[3-9]\d{9}$/, message: t('system:user.phoneInvalid') }]}
              >
                <Input
                  placeholder={t('system:enterContactNumber')}
                  maxLength={11}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label={t('system:user.email')}
                rules={[{ type: 'email' }]}
              >
                <Input
                  placeholder={t('system:user.emailPlaceholder')}
                  maxLength={50}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label={t('system:dept.status')}
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
