import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import FormLabel from '@/components/FormLabel'
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Tree,
} from 'antd'
import Table from '@/components/Table'
import { useNavigate } from 'react-router-dom'
import {
  addRole,
  changeRoleStatus,
  dataScope,
  delRole,
  getRole,
  listRole,
  updateRole,
  deptTreeSelect,
} from '@/api/system/role'
import { roleMenuTreeselect, treeselect } from '@/api/system/menu'
import { useDict } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { checkPermi } from '@/utils/permission'
import { download } from '@/utils/request'
import { message, confirm } from '@/plugins/modal'
import useUserStore from '@/store/modules/user'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import './style.css'

const allKeys = (nodes) => nodes.flatMap((node) => [node.id, ...allKeys(node.children || [])])
function withParents(nodes, selected, linked) {
  const result = new Set(selected)
  function visit(node) {
    const children = (node.children || []).map(visit)
    if (linked && children.some(Boolean)) result.add(node.id)
    return result.has(node.id)
  }
  nodes.forEach(visit)
  return [...result]
}
function PermissionTree({ nodes, value, onChange, linked, onLinkedChange }) {
  const [expandedKeys, setExpandedKeys] = useState([])
  const keys = allKeys(nodes)
  return (
    <div className="permission-tree">
      <div className="permission-tree-actions">
        <Checkbox
          checked={expandedKeys.length > 0}
          onChange={(event) => setExpandedKeys(event.target.checked ? keys : [])}
        >
          展开/折叠
        </Checkbox>
        <Checkbox
          checked={keys.length > 0 && value.length === keys.length}
          onChange={(event) => onChange(event.target.checked ? keys : [])}
        >
          全选/全不选
        </Checkbox>
        <Checkbox
          checked={linked}
          onChange={(event) => onLinkedChange(event.target.checked)}
        >
          父子联动
        </Checkbox>
      </div>
      <Tree
        className="permission-tree-border"
        checkable
        treeData={nodes}
        fieldNames={{ title: 'label', key: 'id', children: 'children' }}
        checkedKeys={value}
        checkStrictly={!linked}
        onCheck={(keys) => onChange(Array.isArray(keys) ? keys : keys.checked)}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
      />
    </div>
  )
}
const dataScopeOptions = [
  { value: '1', label: '全部数据权限' },
  { value: '2', label: '自定数据权限' },
  { value: '3', label: '本部门数据权限' },
  { value: '4', label: '本部门及以下数据权限' },
  { value: '5', label: '仅本人数据权限' },
]

export default function Role() {
  const { sys_normal_disable } = useDict('sys_normal_disable'),
    navigate = useNavigate(),
    timeZone = useUserStore((state) => state.timeZone)
  const [queryRef] = Form.useForm(),
    [roleRef] = Form.useForm(),
    [scopeRef] = Form.useForm()
  const [roleList, setRoleList] = useState([]),
    [total, setTotal] = useState(0),
    [ids, setIds] = useState([]),
    [queryParams, setQueryParams] = useState({ pageNum: 1, pageSize: 10 })
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [open, setOpen] = useState(false),
    [roleId, setRoleId] = useState()
  const [menuOptions, setMenuOptions] = useState([]),
    [menuIds, setMenuIds] = useState([]),
    [menuLinked, setMenuLinked] = useState(true)
  const [scopeRole, setScopeRole] = useState(null),
    [deptOptions, setDeptOptions] = useState([]),
    [deptIds, setDeptIds] = useState([]),
    [deptLinked, setDeptLinked] = useState(true)
  const scopeValue = Form.useWatch('dataScope', scopeRef)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listRole(queryParams)
      setRoleList(result.rows)
      setTotal(result.total)
      setIds([])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [queryParams, timeZone])
  useEffect(() => {
    void getList()
  }, [getList])
  function handleQuery({ dateRange, ...values }) {
    setQueryParams({
      ...values,
      beginTime: dateRange?.[0]?.format('YYYY-MM-DD'),
      endTime: dateRange?.[1]?.format('YYYY-MM-DD'),
      pageNum: 1,
      pageSize: queryParams.pageSize,
    })
  }
  async function handleEdit(id) {
    try {
      roleRef.resetFields()
      setRoleId(id)
      if (id !== undefined) {
        const [role, menus] = await Promise.all([getRole(id), roleMenuTreeselect(id)])
        roleRef.setFieldsValue({
          ...role.data,
          roleSort: Number(role.data.roleSort),
        })
        setMenuOptions(menus.menus)
        setMenuIds(menus.checkedKeys)
        setMenuLinked(role.data.menuCheckStrictly)
      } else {
        const menus = await treeselect()
        setMenuOptions(menus.data)
        setMenuIds([])
        setMenuLinked(true)
        roleRef.setFieldsValue({ status: '0', roleSort: 0 })
      }
      setOpen(true)
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await roleRef.validateFields()
      setSaving(true)
      const data = {
        ...values,
        roleId,
        menuIds: withParents(menuOptions, menuIds, menuLinked),
        menuCheckStrictly: menuLinked,
      }
      await (roleId !== undefined ? updateRole(data) : addRole(data))
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
      await confirm(`是否确认删除角色编号为“${values}”的数据项？`)
      await delRole(values)
      message.success('删除成功')
      await getList()
    } catch {}
  }
  async function handleStatusChange(row, checked) {
    try {
      await confirm(`确认要${checked ? '启用' : '停用'}“${row.roleName}”角色吗？`)
      await changeRoleStatus(row.roleId, checked ? '0' : '1')
      message.success('修改成功')
      await getList()
    } catch {}
  }
  async function handleDataScope(row) {
    try {
      const [role, tree] = await Promise.all([getRole(row.roleId), deptTreeSelect(row.roleId)])
      setScopeRole(role.data)
      scopeRef.resetFields()
      scopeRef.setFieldsValue(role.data)
      setDeptOptions(tree.depts)
      setDeptIds(tree.checkedKeys)
      setDeptLinked(role.data.deptCheckStrictly)
    } catch {}
  }
  async function submitDataScope() {
    try {
      const values = await scopeRef.validateFields()
      setSaving(true)
      await dataScope({
        ...scopeRole,
        ...values,
        deptIds: values.dataScope === '2' ? withParents(deptOptions, deptIds, deptLinked) : [],
        deptCheckStrictly: deptLinked,
      })
      message.success('修改成功')
      setScopeRole(null)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  const columns = [
    { width: 120, title: '角色编号', dataIndex: 'roleId' },
    { width: 150, title: '角色名称', dataIndex: 'roleName' },
    { width: 150, title: '权限字符', dataIndex: 'roleKey' },
    { width: 100, title: '显示顺序', dataIndex: 'roleSort' },
    {
      width: 100,
      align: 'center',
      title: '状态',
      dataIndex: 'status',
      render: (value, row) => (
        <Switch
          checked={value === '0'}
          disabled={row.roleId === 1 || !checkPermi(['system:role:edit'])}
          onChange={(checked) => handleStatusChange(row, checked)}
        />
      ),
    },
    {
      align: 'center',
      title: '创建时间',
      dataIndex: 'createTime',
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      width: 150,
      render: (_, row) =>
        row.roleId !== 1 && (
          <TableActions>
            <HasPermi value={['system:role:edit']}>
              <TableAction
                iconOnly
                symbol="Edit"
                onClick={() => handleEdit(row.roleId)}
              >
                修改
              </TableAction>
            </HasPermi>
            <HasPermi value={['system:role:remove']}>
              <TableAction
                iconOnly
                symbol="Delete"
                onClick={() => handleDelete([row.roleId])}
              >
                删除
              </TableAction>
            </HasPermi>
            <HasPermi value={['system:role:edit']}>
              <TableAction
                iconOnly
                symbol="CircleCheck"
                onClick={() => handleDataScope(row)}
              >
                数据权限
              </TableAction>
              <TableAction
                iconOnly
                symbol="User"
                onClick={() => navigate(`/system/role-auth/user/${row.roleId}`)}
              >
                分配用户
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
          onFinish={handleQuery}
        >
          <Form.Item
            name="roleName"
            label="角色名称"
          >
            <Input
              style={{ width: 240 }}
              placeholder="请输入角色名称"
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="roleKey"
            label="权限字符"
          >
            <Input
              style={{ width: 240 }}
              placeholder="请输入权限字符"
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
          >
            <Select
              style={{ width: 240 }}
              placeholder="角色状态"
              allowClear
              options={sys_normal_disable}
            />
          </Form.Item>
          <Form.Item
            name="dateRange"
            label="创建时间"
          >
            <DatePicker.RangePicker
              style={{ width: 308 }}
              placeholder={['开始日期', '结束日期']}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                icon={<SearchOutlined />}
                htmlType="submit"
                type="primary"
              >
                搜索
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  queryRef.resetFields()
                  handleQuery({})
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
            onClick={() => handleEdit()}
          >
            新增
          </Button>
        </HasPermi>
        <HasPermi value={['system:role:edit']}>
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
        <HasPermi value={['system:role:remove']}>
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
        <HasPermi value={['system:role:export']}>
          <Button
            icon={<DownloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={() =>
              download('/system/role/export', queryParams, `role_${Date.now()}.xlsx`).catch(
                () => {}
              )
            }
          >
            导出
          </Button>
        </HasPermi>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={getList}
        />
      </div>
      <Table
        rowKey="roleId"
        loading={loading}
        dataSource={roleList}
        columns={columns}
        pagination={false}
        scroll={{ x: 1150 }}
        rowSelection={{
          selectedRowKeys: ids,
          onChange: setIds,
          getCheckboxProps: (row) => ({ disabled: row.roleId === 1 }),
        }}
      />
      <Pagination
        total={total}
        page={queryParams.pageNum}
        limit={queryParams.pageSize}
        onChange={(page) => setQueryParams({ ...queryParams, ...page })}
      />
      <Modal
        footer={renderDialogFooter}
        title={roleId !== undefined ? '修改角色' : '添加角色'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submitForm}
        confirmLoading={saving}
        width="500px"
        forceRender
      >
        <Form
          name="src-views-system-role-index-jsx-editor-18"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '100px' }}
          form={roleRef}
          layout="horizontal"
        >
          <Form.Item
            name="roleName"
            label="角色名称"
            rules={[{ required: true }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item
            name="roleKey"
            label={
              <FormLabel
                label="权限字符"
                help="控制器中定义的权限字符，如：RoleInterfaceAuthDependency('admin')"
              />
            }
            rules={[{ required: true }]}
          >
            <Input placeholder="请输入权限字符" />
          </Form.Item>
          <Form.Item
            name="roleSort"
            label="角色顺序"
            rules={[{ required: true }]}
          >
            <InputNumber
              min={0}
              precision={0}
            />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
          >
            <Radio.Group options={sys_normal_disable} />
          </Form.Item>
          <Form.Item label="菜单权限">
            <PermissionTree
              key={`${roleId}-${open}`}
              nodes={menuOptions}
              value={menuIds}
              onChange={setMenuIds}
              linked={menuLinked}
              onLinkedChange={setMenuLinked}
            />
          </Form.Item>
          <Form.Item
            name="remark"
            label="备注"
          >
            <Input.TextArea
              placeholder="请输入内容"
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        footer={renderDialogFooter}
        width="500px"
        title="分配数据权限"
        open={!!scopeRole}
        onCancel={() => setScopeRole(null)}
        onOk={submitDataScope}
        confirmLoading={saving}
        forceRender
      >
        <Form
          name="src-views-system-role-index-jsx-editor-19"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '80px' }}
          form={scopeRef}
          layout="horizontal"
        >
          <Form.Item
            name="roleName"
            label="角色名称"
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="roleKey"
            label="权限字符"
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="dataScope"
            label="权限范围"
            rules={[{ required: true }]}
          >
            <Select
              options={dataScopeOptions}
              onChange={(value) => {
                if (value !== '2') setDeptIds([])
              }}
            />
          </Form.Item>
          {scopeValue === '2' && (
            <Form.Item label="数据权限">
              <PermissionTree
                key={scopeRole?.roleId}
                nodes={deptOptions}
                value={deptIds}
                onChange={setDeptIds}
                linked={deptLinked}
                onLinkedChange={setDeptLinked}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
