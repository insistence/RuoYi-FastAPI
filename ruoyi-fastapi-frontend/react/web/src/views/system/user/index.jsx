import TableActions, { TableAction } from "@/components/TableActions";
import { renderDialogFooter } from "@/components/DialogFooter";
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { Button, Col, DatePicker, Form, Input, Modal, Radio, Row, Select, Space, Switch, TreeSelect } from "antd";
import Table from "@/components/Table";
import { useNavigate } from "react-router-dom";
import {
  changeUserStatus,
  listUser,
  resetUserPwd,
  delUser,
  getUser,
  updateUser,
  addUser,
  deptTreeSelect,
} from "@/api/system/user";
import { getConfigKey } from "@/api/system/config";
import { usePasswordRule } from "@/utils/passwordRule";
import { useDict } from "@/utils/dict";
import { parseTime } from "@/utils/ruoyi";
import { getDisplayTimezone } from "@/utils/time";
import { checkPermi } from "@/utils/permission";
import { download } from "@/utils/request";
import { message, confirm } from "@/plugins/modal";
import useUserStore from "@/store/modules/user";
import HasPermi from "@/directive/permission/hasPermi";
import Pagination from "@/components/Pagination";
import RightToolbar from "@/components/RightToolbar";
import TreePanel from "@/components/TreePanel";
import ExcelImportDialog from "@/components/ExcelImportDialog";
import UserViewDrawer from "./view";

function enabledDepartments(nodes) {
  return nodes
    .filter((node) => !node.disabled)
    .map((node) => ({
      ...node,
      children: node.children && enabledDepartments(node.children),
    }));
}
export default function User() {
  const { sys_normal_disable, sys_user_sex } = useDict("sys_normal_disable", "sys_user_sex");
  const { pwdValidator } = usePasswordRule(),
    navigate = useNavigate(),
    timeZone = useUserStore((state) => state.timeZone);
  const [queryRef] = Form.useForm(),
    [userRef] = Form.useForm(),
    [pwdRef] = Form.useForm();
  const [userList, setUserList] = useState([]),
    [total, setTotal] = useState(0),
    [ids, setIds] = useState([]),
    [deptOptions, setDeptOptions] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]),
    [postOptions, setPostOptions] = useState([]),
    [initPassword, setInitPassword] = useState("");
  const [queryParams, setQueryParams] = useState({ pageNum: 1, pageSize: 10 }),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [importOpen, setImportOpen] = useState(false),
    [userId, setUserId] = useState(),
    [viewId, setViewId] = useState(null),
    [pwdUser, setPwdUser] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([
    "userId",
    "userName",
    "nickName",
    "deptName",
    "phonenumber",
    "status",
    "createTime",
  ]);
  const getList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listUser(queryParams);
      setUserList(response.rows);
      setTotal(response.total);
      setIds([]);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [queryParams, timeZone]);
  useEffect(() => {
    void getList();
  }, [getList]);
  const getDeptTree = useCallback(async () => {
    try {
      const result = await deptTreeSelect();
      setDeptOptions(result.data);
    } catch {}
  }, []);
  useEffect(() => {
    void getDeptTree();
    getConfigKey("sys.user.initPassword")
      .then((result) => setInitPassword(result.msg))
      .catch(() => {});
  }, [getDeptTree]);
  function handleQuery({ dateRange, ...values }) {
    setQueryParams({
      ...values,
      deptId: queryParams.deptId,
      beginTime: dateRange?.[0]?.format("YYYY-MM-DD"),
      endTime: dateRange?.[1]?.format("YYYY-MM-DD"),
      pageNum: 1,
      pageSize: queryParams.pageSize,
    });
  }
  async function handleEdit(id) {
    try {
      const result = await getUser(id);
      setUserId(id);
      setPostOptions(result.posts || []);
      setRoleOptions(result.roles || []);
      userRef.resetFields();
      userRef.setFieldsValue(
        id !== undefined
          ? {
              ...result.data,
              postIds: result.postIds,
              roleIds: result.roleIds,
              password: undefined,
            }
          : { status: "0", password: initPassword, postIds: [], roleIds: [] },
      );
      setOpen(true);
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await userRef.validateFields();
      setSaving(true);
      await (userId !== undefined ? updateUser({ ...values, userId }) : addUser(values));
      message.success("保存成功");
      setOpen(false);
      await getList();
    } catch {
    } finally {
      setSaving(false);
    }
  }
  async function handleDelete(values) {
    try {
      await confirm(`是否确认删除用户编号为“${values}”的数据项？`);
      await delUser(values);
      message.success("删除成功");
      await getList();
    } catch {}
  }
  async function handleStatusChange(row, checked) {
    try {
      await confirm(`确认要${checked ? "启用" : "停用"}“${row.userName}”用户吗？`);
      await changeUserStatus(row.userId, checked ? "0" : "1");
      message.success("修改成功");
      await getList();
    } catch {}
  }
  async function handleResetPwd() {
    try {
      const values = await pwdRef.validateFields();
      setSaving(true);
      await resetUserPwd(pwdUser.userId, values.password);
      message.success("密码重置成功");
      setPwdUser(null);
      pwdRef.resetFields();
    } catch {
    } finally {
      setSaving(false);
    }
  }
  const columns = [
    { align: "center", title: "用户编号", dataIndex: "userId" },
    {
      align: "center",
      title: "用户名称",
      dataIndex: "userName",
      render: (value, row) => (
        <Button type="link" onClick={() => setViewId(row.userId)}>
          {value}
        </Button>
      ),
    },
    { align: "center", title: "用户昵称", dataIndex: "nickName" },
    { align: "center", title: "部门", dataIndex: ["dept", "deptName"], key: "deptName" },
    { width: 120, align: "center", title: "手机号码", dataIndex: "phonenumber" },
    {
      align: "center",
      title: "状态",
      dataIndex: "status",
      render: (value, row) => (
        <Switch
          checked={value === "0"}
          disabled={row.userId === 1 || !checkPermi(["system:user:edit"])}
          onChange={(checked) => handleStatusChange(row, checked)}
        />
      ),
    },
    {
      align: "center",
      title: "创建时间",
      dataIndex: "createTime",
      width: 160,
      render: (value) => parseTime(value),
    },
  ];
  const actions = {
    className: "ruoyi-actions-cell",
    align: "center",
    title: "操作",
    key: "action",
    width: 150,
    render: (_, row) =>
      row.userId !== 1 && (
        <TableActions>
          <HasPermi value={["system:user:edit"]}>
            <TableAction iconOnly symbol="Edit" onClick={() => handleEdit(row.userId)}>
              修改
            </TableAction>
          </HasPermi>
          <HasPermi value={["system:user:remove"]}>
            <TableAction iconOnly symbol="Delete" onClick={() => handleDelete([row.userId])}>
              删除
            </TableAction>
          </HasPermi>
          <HasPermi value={["system:user:resetPwd"]}>
            <TableAction
              iconOnly
              symbol="Key"
              onClick={() => {
                pwdRef.resetFields();
                setPwdUser(row);
              }}
            >
              重置密码
            </TableAction>
          </HasPermi>
          <HasPermi value={["system:user:edit"]}>
            <TableAction
              iconOnly
              symbol="CircleCheck"
              onClick={() => navigate(`/system/user-auth/role/${row.userId}`)}
            >
              分配角色
            </TableAction>
          </HasPermi>
        </TableActions>
      ),
  };
  return (
    <div className="app-container tree-sidebar-manage-wrap">
      <TreePanel
        title="组织机构"
        storageKey="dept-sidebar-width"
        onRefresh={getDeptTree}
        searchPlaceholder="请输入部门名称"
        data={deptOptions}
        selectedKeys={queryParams.deptId ? [queryParams.deptId] : []}
        onSelect={(keys) => setQueryParams({ ...queryParams, deptId: keys[0], pageNum: 1 })}
      />
      <section className="tree-sidebar-content">
        {showSearch && (
          <Form form={queryRef} className="search-form" layout="inline" onFinish={handleQuery}>
            <Form.Item name="userName" label="用户名称">
              <Input style={{ width: 240 }} placeholder="请输入用户名称" allowClear />
            </Form.Item>
            <Form.Item name="phonenumber" label="手机号码">
              <Input style={{ width: 240 }} placeholder="请输入手机号码" allowClear />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select style={{ width: 240 }} placeholder="用户状态" allowClear options={sys_normal_disable} />
            </Form.Item>
            <Form.Item name="dateRange" label="创建时间">
              <DatePicker.RangePicker style={{ width: 308 }}
                placeholder={["开始日期", "结束日期"]}
                aria-label={`日期范围（${getDisplayTimezone()}）`}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button icon={<SearchOutlined />} type="primary" htmlType="submit">
                  搜索
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    queryRef.resetFields();
                    setQueryParams({
                      pageNum: 1,
                      pageSize: queryParams.pageSize,
                    });
                  }}
                >
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
        <div className="table-toolbar">
          <HasPermi value={["system:user:add"]}>
            <Button
              icon={<PlusOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--primary"
              type="default"
              onClick={() => handleEdit()}
            >
              新增
            </Button>
          </HasPermi>
          <HasPermi value={["system:user:edit"]}>
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
          <HasPermi value={["system:user:remove"]}>
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
          <HasPermi value={["system:user:import"]}>
            <Button
              icon={<UploadOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--info"
              type="default"
              onClick={() => setImportOpen(true)}
            >
              导入
            </Button>
          </HasPermi>
          <HasPermi value={["system:user:export"]}>
            <Button
              icon={<DownloadOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--warning"
              type="default"
              onClick={() =>
                download("/system/user/export", queryParams, `user_${Date.now()}.xlsx`).catch(
                  () => {},
                )
              }
            >
              导出
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
          title={userId !== undefined ? "修改用户" : "添加用户"}
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
            wrapperCol={{ flex: "1 1 0" }}
            labelCol={{ flex: "80px" }}
            form={userRef}
            layout="horizontal"
          >
            <Row gutter={20}>
              <Col span={12}>
                <Form.Item name="nickName" label="用户昵称" rules={[{ required: true }]}>
                  <Input placeholder="请输入用户昵称" maxLength={30} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="deptId" label="归属部门">
                  <TreeSelect
                    placeholder="请选择归属部门"
                    treeData={enabledDepartments(deptOptions)}
                    fieldNames={{
                      value: "id",
                      label: "label",
                      children: "children",
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
                  label="手机号码"
                  rules={[
                    {
                      pattern: /^1[3-9]\d{9}$/,
                      message: "请输入正确的手机号码",
                    },
                  ]}
                >
                  <Input placeholder="请输入手机号码" maxLength={11} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="email" label="邮箱" rules={[{ type: "email" }]}>
                  <Input placeholder="请输入邮箱" maxLength={50} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="userName"
                  label="用户名称"
                  rules={[
                    {
                      required: true,
                      min: 2,
                      max: 20,
                      message: "用户名称长度必须介于 2 和 20 之间",
                    },
                  ]}
                >
                  <Input
                    placeholder="请输入用户名称"
                    disabled={userId !== undefined}
                    autoComplete="off"
                  />
                </Form.Item>
              </Col>
              {userId === undefined && (
                <Col span={12}>
                  <Form.Item name="password" label="用户密码" rules={pwdValidator}>
                    <Input.Password placeholder="请输入用户密码" autoComplete="new-password" />
                  </Form.Item>
                </Col>
              )}
              <Col span={12}>
                <Form.Item name="sex" label="用户性别">
                  <Select placeholder="请选择" options={sys_user_sex} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="status" label="状态">
                  <Radio.Group options={sys_normal_disable} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="postIds" label="岗位">
                  <Select
                    placeholder="请选择"
                    mode="multiple"
                    options={postOptions.map((post) => ({
                      label: post.postName,
                      value: post.postId,
                      disabled: post.status === "1",
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="roleIds" label="角色">
                  <Select
                    placeholder="请选择"
                    mode="multiple"
                    options={roleOptions.map((role) => ({
                      label: role.roleName,
                      value: role.roleId,
                      disabled: role.status === "1",
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="remark" label="备注">
              <Input.TextArea placeholder="请输入内容" rows={2} />
            </Form.Item>
          </Form>
        </Modal>
        <Modal
          title={`重置“${pwdUser?.userName || ""}”的密码`}
          open={!!pwdUser}
          onCancel={() => setPwdUser(null)}
          onOk={handleResetPwd}
          confirmLoading={saving}
          forceRender
        >
          <Form form={pwdRef} layout="vertical">
            <Form.Item name="password" label="新密码" rules={pwdValidator}>
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </Form>
        </Modal>
        <UserViewDrawer userId={viewId} onClose={() => setViewId(null)} />
        <ExcelImportDialog
          title="用户导入"
          open={importOpen}
          onClose={() => setImportOpen(false)}
          action="/system/user/importData"
          templateAction="/system/user/importTemplate"
          templateFileName="user_template"
          updateSupportLabel="是否更新已经存在的用户数据"
          onSuccess={getList}
        />
      </section>
    </div>
  );
}
