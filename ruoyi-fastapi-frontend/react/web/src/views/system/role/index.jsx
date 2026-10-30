import { useLocalizedFormErrors } from '@/i18n/form'
import { localizeOptions } from '@/i18n/entities.mjs'
import { useI18n } from '@/i18n/adapter'
import { i18n, t } from '@/i18n'
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
  useI18n()

  const [expandedKeys, setExpandedKeys] = useState([])
  const keys = allKeys(nodes)
  return (
    <div className="permission-tree">
      <div className="permission-tree-actions">
        <Checkbox
          checked={expandedKeys.length > 0}
          onChange={(event) => setExpandedKeys(event.target.checked ? keys : [])}
        >
          {t('common:expandCollapse')}
        </Checkbox>
        <Checkbox
          checked={keys.length > 0 && value.length === keys.length}
          onChange={(event) => onChange(event.target.checked ? keys : [])}
        >
          {t('common:checkAll')}
        </Checkbox>
        <Checkbox
          checked={linked}
          onChange={(event) => onLinkedChange(event.target.checked)}
        >
          {t('system:linkParentAndChildSelection')}
        </Checkbox>
      </div>
      <Tree
        className="permission-tree-border"
        checkable
        treeData={localizeOptions(nodes, i18n.resolveText)}
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
  {
    value: '1',
    get label() {
      return t('system:allData')
    },
  },
  {
    value: '2',
    get label() {
      return t('system:customDataScope')
    },
  },
  {
    value: '3',
    get label() {
      return t('system:thisDepartment')
    },
  },
  {
    value: '4',
    get label() {
      return t('system:thisDepartmentAndItsSubdepartments')
    },
  },
  {
    value: '5',
    get label() {
      return t('system:ownDataOnly')
    },
  },
]

export default function Role() {
  useI18n()

  const { sys_normal_disable } = useDict('sys_normal_disable'),
    navigate = useNavigate(),
    timeZone = useUserStore((state) => state.timeZone)
  const [queryRef] = Form.useForm(),
    [roleRef] = Form.useForm(),
    [scopeRef] = Form.useForm()
  useLocalizedFormErrors(queryRef, roleRef, scopeRef)
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
      message.success(t('system:savedSuccessfully'))
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  async function handleDelete(values) {
    try {
      await confirm(t('system:deleteRolesWithIdsValue', { values }))
      await delRole(values)
      message.success(t('common:deleteSuccess'))
      await getList()
    } catch {}
  }
  async function handleStatusChange(row, checked) {
    try {
      await confirm(
        t('system:valueRoleValue', {
          arg0: checked ? t('common:enable') : t('common:disable'),
          roleName: row.roleName,
        })
      )
      await changeRoleStatus(row.roleId, checked ? '0' : '1')
      message.success(t('common:updateSuccess'))
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
      message.success(t('common:updateSuccess'))
      setScopeRole(null)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  const columns = [
    { width: 120, title: t('system:roleID'), dataIndex: 'roleId' },
    { width: 150, title: t('system:role.name'), dataIndex: 'roleName' },
    { width: 150, title: t('system:permission.code'), dataIndex: 'roleKey' },
    { width: 100, title: t('system:displayOrderLabel'), dataIndex: 'roleSort' },
    {
      width: 100,
      align: 'center',
      title: t('common:status'),
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
      title: t('common:createdTime'),
      dataIndex: 'createTime',
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
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
                {t('common:edit')}
              </TableAction>
            </HasPermi>
            <HasPermi value={['system:role:remove']}>
              <TableAction
                iconOnly
                symbol="Delete"
                onClick={() => handleDelete([row.roleId])}
              >
                {t('common:delete')}
              </TableAction>
            </HasPermi>
            <HasPermi value={['system:role:edit']}>
              <TableAction
                iconOnly
                symbol="CircleCheck"
                onClick={() => handleDataScope(row)}
              >
                {t('system:role.dataScope')}
              </TableAction>
              <TableAction
                iconOnly
                symbol="User"
                onClick={() => navigate(`/system/role-auth/user/${row.roleId}`)}
              >
                {t('layout:route.assignUsers')}
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
            label={t('system:role.name')}
          >
            <Input
              style={{ width: 240 }}
              placeholder={t('system:enterRoleName')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="roleKey"
            label={t('system:permission.code')}
          >
            <Input
              style={{ width: 240 }}
              placeholder={t('system:enterPermissionString')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="status"
            label={t('common:status')}
          >
            <Select
              style={{ width: 240 }}
              placeholder={t('system:role.status')}
              allowClear
              options={sys_normal_disable}
            />
          </Form.Item>
          <Form.Item
            name="dateRange"
            label={t('common:createdTime')}
          >
            <DatePicker.RangePicker
              style={{ width: 308 }}
              placeholder={[t('common:startDate'), t('common:endDate')]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                icon={<SearchOutlined />}
                htmlType="submit"
                type="primary"
              >
                {t('common:search')}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  queryRef.resetFields()
                  handleQuery({})
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
            onClick={() => handleEdit()}
          >
            {t('common:add')}
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
            {t('common:edit')}
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
            {t('common:delete')}
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
            {t('common:export')}
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
        title={roleId !== undefined ? t('system:editRole') : t('system:addRole')}
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
            label={t('system:role.name')}
            rules={[{ required: true }]}
          >
            <Input placeholder={t('system:enterRoleName')} />
          </Form.Item>
          <Form.Item
            name="roleKey"
            label={
              <FormLabel
                label={t('system:permission.code')}
                help={t(
                  'system:rolePermissionDefinedInTheControllerEGRoleinterfaceauthdependencyAdmin'
                )}
              />
            }
            rules={[{ required: true }]}
          >
            <Input placeholder={t('system:enterPermissionString')} />
          </Form.Item>
          <Form.Item
            name="roleSort"
            label={t('system:role.order')}
            rules={[{ required: true }]}
          >
            <InputNumber
              min={0}
              precision={0}
            />
          </Form.Item>
          <Form.Item
            name="status"
            label={t('common:status')}
          >
            <Radio.Group options={sys_normal_disable} />
          </Form.Item>
          <Form.Item label={t('system:menuPermissions')}>
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
            label={t('common:remark')}
          >
            <Input.TextArea
              placeholder={t('common:contentPlaceholder')}
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        footer={renderDialogFooter}
        width="500px"
        title={t('system:assignDataScope')}
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
            label={t('system:role.name')}
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="roleKey"
            label={t('system:permission.code')}
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="dataScope"
            label={t('system:permissionScope')}
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
            <Form.Item label={t('system:role.dataScope')}>
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
