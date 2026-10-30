import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  TreeSelect,
} from 'antd'
import Table from '@/components/Table'
import { useNavigate } from 'react-router-dom'
import {
  changeUserStatus,
  listUser,
  resetUserPwd,
  delUser,
  getUser,
  updateUser,
  addUser,
  deptTreeSelect,
} from '@/api/system/user'
import { getConfigKey } from '@/api/system/config'
import { usePasswordRule } from '@/utils/passwordRule'
import { useDict } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { getDisplayTimezone } from '@/utils/time'
import { checkPermi } from '@/utils/permission'
import { download } from '@/utils/request'
import { message, confirm } from '@/plugins/modal'
import useUserStore from '@/store/modules/user'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import TreePanel from '@/components/TreePanel'
import ExcelImportDialog from '@/components/ExcelImportDialog'
import UserViewDrawer from './view'

function enabledDepartments(nodes) {
  return nodes
    .filter((node) => !node.disabled)
    .map((node) => ({
      ...node,
      children: node.children && enabledDepartments(node.children),
    }))
}
export default function User() {
  useI18n()

  const { sys_normal_disable, sys_user_sex } = useDict('sys_normal_disable', 'sys_user_sex')
  const { pwdValidator } = usePasswordRule(),
    navigate = useNavigate(),
    timeZone = useUserStore((state) => state.timeZone)
  const [queryRef] = Form.useForm(),
    [userRef] = Form.useForm(),
    [pwdRef] = Form.useForm()
  useLocalizedFormErrors(queryRef, userRef, pwdRef)
  const [userList, setUserList] = useState([]),
    [total, setTotal] = useState(0),
    [ids, setIds] = useState([]),
    [deptOptions, setDeptOptions] = useState([])
  const [roleOptions, setRoleOptions] = useState([]),
    [postOptions, setPostOptions] = useState([]),
    [initPassword, setInitPassword] = useState('')
  const [queryParams, setQueryParams] = useState({ pageNum: 1, pageSize: 10 }),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [importOpen, setImportOpen] = useState(false),
    [userId, setUserId] = useState(),
    [viewId, setViewId] = useState(null),
    [pwdUser, setPwdUser] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState([
    'userId',
    'userName',
    'nickName',
    'deptName',
    'phonenumber',
    'status',
    'createTime',
  ])
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const response = await listUser(queryParams)
      setUserList(response.rows)
      setTotal(response.total)
      setIds([])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [queryParams, timeZone])
  useEffect(() => {
    void getList()
  }, [getList])
  const getDeptTree = useCallback(async () => {
    try {
      const result = await deptTreeSelect()
      setDeptOptions(result.data)
    } catch {}
  }, [])
  useEffect(() => {
    void getDeptTree()
    getConfigKey('sys.user.initPassword')
      .then((result) => setInitPassword(result.msg))
      .catch(() => {})
  }, [getDeptTree])
  function handleQuery({ dateRange, ...values }) {
    setQueryParams({
      ...values,
      deptId: queryParams.deptId,
      beginTime: dateRange?.[0]?.format('YYYY-MM-DD'),
      endTime: dateRange?.[1]?.format('YYYY-MM-DD'),
      pageNum: 1,
      pageSize: queryParams.pageSize,
    })
  }
  async function handleEdit(id) {
    try {
      const result = await getUser(id)
      setUserId(id)
      setPostOptions(result.posts || [])
      setRoleOptions(result.roles || [])
      userRef.resetFields()
      userRef.setFieldsValue(
        id !== undefined
          ? {
              ...result.data,
              postIds: result.postIds,
              roleIds: result.roleIds,
              password: undefined,
            }
          : { status: '0', password: initPassword, postIds: [], roleIds: [] }
      )
      setOpen(true)
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await userRef.validateFields()
      setSaving(true)
      await (userId !== undefined ? updateUser({ ...values, userId }) : addUser(values))
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
      await confirm(t('system:deleteUsersWithIdsValue', { values }))
      await delUser(values)
      message.success(t('common:deleteSuccess'))
      await getList()
    } catch {}
  }
  async function handleStatusChange(row, checked) {
    try {
      await confirm(
        t('system:valueUserValue', {
          arg0: checked ? t('common:enable') : t('common:disable'),
          userName: row.userName,
        })
      )
      await changeUserStatus(row.userId, checked ? '0' : '1')
      message.success(t('common:updateSuccess'))
      await getList()
    } catch {}
  }
  async function handleResetPwd() {
    try {
      const values = await pwdRef.validateFields()
      setSaving(true)
      await resetUserPwd(pwdUser.userId, values.password)
      message.success(t('system:passwordReset'))
      setPwdUser(null)
      pwdRef.resetFields()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  const columns = [
    { align: 'center', title: t('system:user.id'), dataIndex: 'userId' },
    {
      align: 'center',
      title: t('system:user.username'),
      dataIndex: 'userName',
      render: (value, row) => (
        <Button
          type="link"
          onClick={() => setViewId(row.userId)}
        >
          {value}
        </Button>
      ),
    },
    { align: 'center', title: t('system:user.nickname'), dataIndex: 'nickName' },
    {
      align: 'center',
      title: t('system:dept.nameShort'),
      dataIndex: ['dept', 'deptName'],
      key: 'deptName',
    },
    { width: 120, align: 'center', title: t('system:user.phone'), dataIndex: 'phonenumber' },
    {
      align: 'center',
      title: t('common:status'),
      dataIndex: 'status',
      render: (value, row) => (
        <Switch
          checked={value === '0'}
          disabled={row.userId === 1 || !checkPermi(['system:user:edit'])}
          onChange={(checked) => handleStatusChange(row, checked)}
        />
      ),
    },
    {
      align: 'center',
      title: t('common:createdTime'),
      dataIndex: 'createTime',
      width: 160,
      render: (value) => parseTime(value),
    },
  ]
  const actions = {
    className: 'ruoyi-actions-cell',
    align: 'center',
    title: t('common:actions'),
    key: 'action',
    width: 150,
    render: (_, row) =>
      row.userId !== 1 && (
        <TableActions>
          <HasPermi value={['system:user:edit']}>
            <TableAction
              iconOnly
              symbol="Edit"
              onClick={() => handleEdit(row.userId)}
            >
              {t('common:edit')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:user:remove']}>
            <TableAction
              iconOnly
              symbol="Delete"
              onClick={() => handleDelete([row.userId])}
            >
              {t('common:delete')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:user:resetPwd']}>
            <TableAction
              iconOnly
              symbol="Key"
              onClick={() => {
                pwdRef.resetFields()
                setPwdUser(row)
              }}
            >
              {t('system:user.resetPassword')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:user:edit']}>
            <TableAction
              iconOnly
              symbol="CircleCheck"
              onClick={() => navigate(`/system/user-auth/role/${row.userId}`)}
            >
              {t('layout:route.assignRoles')}
            </TableAction>
          </HasPermi>
        </TableActions>
      ),
  }
  return (
    <div className="app-container tree-sidebar-manage-wrap">
      <TreePanel
        title={t('common:organization')}
        storageKey="dept-sidebar-width"
        onRefresh={getDeptTree}
        searchPlaceholder={t('common:enterADepartmentName')}
        data={deptOptions}
        selectedKeys={queryParams.deptId ? [queryParams.deptId] : []}
        onSelect={(keys) => setQueryParams({ ...queryParams, deptId: keys[0], pageNum: 1 })}
      />
      <section className="tree-sidebar-content">
        {showSearch && (
          <Form
            form={queryRef}
            className="search-form"
            layout="inline"
            onFinish={handleQuery}
          >
            <Form.Item
              name="userName"
              label={t('system:user.username')}
            >
              <Input
                style={{ width: 240 }}
                placeholder={t('system:user.usernamePlaceholder')}
                allowClear
              />
            </Form.Item>
            <Form.Item
              name="phonenumber"
              label={t('system:user.phone')}
            >
              <Input
                style={{ width: 240 }}
                placeholder={t('system:user.phonePlaceholder')}
                allowClear
              />
            </Form.Item>
            <Form.Item
              name="status"
              label={t('common:status')}
            >
              <Select
                style={{ width: 240 }}
                placeholder={t('system:user.status')}
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
                aria-label={t('monitor:dateRangeValue', { arg0: getDisplayTimezone() })}
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
                    setQueryParams({
                      pageNum: 1,
                      pageSize: queryParams.pageSize,
                    })
                  }}
                >
                  {t('common:reset')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
        <div className="table-toolbar">
          <HasPermi value={['system:user:add']}>
            <Button
              icon={<PlusOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--primary"
              type="default"
              onClick={() => handleEdit()}
            >
              {t('common:add')}
            </Button>
          </HasPermi>
          <HasPermi value={['system:user:edit']}>
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
          <HasPermi value={['system:user:remove']}>
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
          <HasPermi value={['system:user:import']}>
            <Button
              icon={<UploadOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--info"
              type="default"
              onClick={() => setImportOpen(true)}
            >
              {t('common:import')}
            </Button>
          </HasPermi>
          <HasPermi value={['system:user:export']}>
            <Button
              icon={<DownloadOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--warning"
              type="default"
              onClick={() =>
                download('/system/user/export', queryParams, `user_${Date.now()}.xlsx`).catch(
                  () => {}
                )
              }
            >
              {t('common:export')}
            </Button>
          </HasPermi>
          <RightToolbar
            columns={columns.map((column) => ({
              key: column.key || column.dataIndex,
              label: column.title,
              visible: visibleColumns.includes(column.key || column.dataIndex),
            }))}
            onColumnsChange={(next) =>
              setVisibleColumns(next.filter((column) => column.visible).map((column) => column.key))
            }
            storageKey="react-user-columns"
            showSearch={showSearch}
            onShowSearch={setShowSearch}
            onQuery={getList}
          />
        </div>
        <Table
          rowKey="userId"
          loading={loading}
          dataSource={userList}
          columns={[
            ...columns.filter((column) => visibleColumns.includes(column.key || column.dataIndex)),
            actions,
          ]}
          pagination={false}
          scroll={{ x: 1000 }}
          rowSelection={{
            selectedRowKeys: ids,
            onChange: setIds,
            getCheckboxProps: (row) => ({ disabled: row.userId === 1 }),
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
          title={userId !== undefined ? t('system:editUser') : t('system:addUser')}
          open={open}
          onCancel={() => setOpen(false)}
          onOk={submitForm}
          confirmLoading={saving}
          width="600px"
          forceRender
        >
          <Form
            name="src-views-system-user-index-jsx-editor-20"
            className="ruoyi-dialog-form"
            colon={false}
            wrapperCol={{ flex: '1 1 0' }}
            labelCol={{ flex: '80px' }}
            form={userRef}
            layout="horizontal"
          >
            <Row gutter={20}>
              <Col span={12}>
                <Form.Item
                  name="nickName"
                  label={t('system:user.nickname')}
                  rules={[{ required: true }]}
                >
                  <Input
                    placeholder={t('system:enterNickname')}
                    maxLength={30}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="deptId"
                  label={t('system:department')}
                >
                  <TreeSelect
                    placeholder={t('system:selectDepartment')}
                    treeData={enabledDepartments(deptOptions)}
                    fieldNames={{
                      value: 'id',
                      label: 'label',
                      children: 'children',
                    }}
                    showSearch
                    treeNodeFilterProp="label"
                    treeDefaultExpandAll
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="phonenumber"
                  label={t('system:user.phone')}
                  rules={[
                    {
                      pattern: /^1[3-9]\d{9}$/,
                      message: t('system:user.phoneInvalid'),
                    },
                  ]}
                >
                  <Input
                    placeholder={t('system:user.phonePlaceholder')}
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
                  name="userName"
                  label={t('system:user.username')}
                  rules={[
                    {
                      required: true,
                      min: 2,
                      max: 20,
                      message: t('system:userNameMustBeBetween2And20Characters'),
                    },
                  ]}
                >
                  <Input
                    placeholder={t('system:user.usernamePlaceholder')}
                    disabled={userId !== undefined}
                    autoComplete="off"
                  />
                </Form.Item>
              </Col>
              {userId === undefined && (
                <Col span={12}>
                  <Form.Item
                    name="password"
                    label={t('system:user.password')}
                    rules={pwdValidator}
                  >
                    <Input.Password
                      placeholder={t('system:enterPassword')}
                      autoComplete="new-password"
                    />
                  </Form.Item>
                </Col>
              )}
              <Col span={12}>
                <Form.Item
                  name="sex"
                  label={t('system:gender')}
                >
                  <Select
                    placeholder={t('common:selectPlaceholder')}
                    options={sys_user_sex}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="status"
                  label={t('common:status')}
                >
                  <Radio.Group options={sys_normal_disable} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="postIds"
                  label={t('system:user.post')}
                >
                  <Select
                    placeholder={t('common:selectPlaceholder')}
                    mode="multiple"
                    options={postOptions.map((post) => ({
                      label: post.postName,
                      value: post.postId,
                      disabled: post.status === '1',
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="roleIds"
                  label={t('system:user.role')}
                >
                  <Select
                    placeholder={t('common:selectPlaceholder')}
                    mode="multiple"
                    options={roleOptions.map((role) => ({
                      label: role.roleName,
                      value: role.roleId,
                      disabled: role.status === '1',
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>
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
          title={t('system:resetPasswordForValue', { arg0: pwdUser?.userName || '' })}
          open={!!pwdUser}
          onCancel={() => setPwdUser(null)}
          onOk={handleResetPwd}
          confirmLoading={saving}
          forceRender
        >
          <Form
            form={pwdRef}
            layout="vertical"
          >
            <Form.Item
              name="password"
              label={t('auth:password.new')}
              rules={pwdValidator}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </Form>
        </Modal>
        <UserViewDrawer
          userId={viewId}
          onClose={() => setViewId(null)}
        />
        <ExcelImportDialog
          title={t('system:importUsers')}
          open={importOpen}
          onClose={() => setImportOpen(false)}
          action="/system/user/importData"
          templateAction="/system/user/importTemplate"
          templateFileName="user_template"
          updateSupportLabel={t('system:updateExistingUsers')}
          onSuccess={getList}
        />
      </section>
    </div>
  )
}
