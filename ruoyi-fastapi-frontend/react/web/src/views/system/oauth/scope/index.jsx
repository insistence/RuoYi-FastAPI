import TagSummary from "@/components/OAuthWorkspace/TagSummary";
import OAuthTag from "@/components/OAuthWorkspace/OAuthTag";
import {
  SearchOutlined as QuerySearchIcon,
  ReloadOutlined as QueryResetIcon,
  PlusOutlined as AddIcon,
} from "@ant-design/icons";
import { checkPermi } from "@/utils/permission";
import { Dropdown } from "antd";
import TableActions, { TableAction } from "@/components/TableActions";
import { PlusOutlined } from "@ant-design/icons";
import FieldLabel from "@/components/OAuthWorkspace/FieldLabel";
import "@/components/OAuthWorkspace/entities.css";
import EntityCell from "@/components/OAuthWorkspace/EntityCell";
import { useCallback, useEffect, useState } from "react";
import { Empty, Button, Checkbox, Modal, Row, Col, Form, Input, Radio, Select, Space } from "antd";
import Table from "@/components/Table";
import {
  addOAuthScope,
  changeOAuthScopeStatus,
  deleteOAuthScopes,
  getOAuthScope,
  listOAuthResources,
  listOAuthScopes,
  updateOAuthScope,
} from "@/api/system/oauthResource";
import { confirm, message } from "@/plugins/modal";
import PageFrame from "@/components/OAuthWorkspace/PageFrame";
import HasPermi from "@/directive/permission/hasPermi";
import Pagination from "@/components/Pagination";
import RightToolbar from "@/components/RightToolbar";

const claimOptions = [
  ["sub", "用户唯一标识"],
  ["name", "姓名"],
  ["email", "邮箱"],
  ["roles", "角色"],
  ["preferred_username", "登录账号"],
].map(([value, label]) => ({ value, label: `${label}（${value}）` }));
const defaults = {
  scopeCode: "",
  scopeName: "",
  scopeType: "identity",
  resourceId: null,
  claims: [],
  consentRequired: true,
  sensitive: false,
  status: "0",
  remark: "",
};
const scopeTypes = [
  { value: "identity", label: "登录身份信息" },
  { value: "resource", label: "服务访问" },
];
export default function OAuthScope() {
  const [queryForm] = Form.useForm(),
    [form] = Form.useForm(),
    type = Form.useWatch("scopeType", form),
    scopeCode = Form.useWatch("scopeCode", form);
  const [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [resources, setResources] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState(false),
    [saving, setSaving] = useState(false);
  const getList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listOAuthScopes(query);
      setRows(result.rows || []);
      setTotal(result.total || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [query]);
  async function loadResources() {
    try {
      setResources(
        (await listOAuthResources({ pageNum: 1, pageSize: 200, status: "0" })).rows || [],
      );
    } catch {}
  }
  useEffect(() => {
    void getList();
  }, [getList]);
  useEffect(() => {
    void loadResources();
  }, []);
  function add() {
    form.resetFields();
    form.setFieldsValue(defaults);
    setEditing(false);
    setOpen(true);
    void loadResources();
  }
  async function edit(row) {
    try {
      const result = await getOAuthScope(row.scopeCode);
      form.resetFields();
      form.setFieldsValue({ ...defaults, ...result.data });
      setEditing(true);
      setOpen(true);
      void loadResources();
    } catch {}
  }
  async function save() {
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true),
        data = Object.fromEntries(
          Object.keys(defaults).map((key) => [key, values[key] ?? defaults[key]]),
        );
      if (data.scopeType === "identity") data.resourceId = null;
      setSaving(true);
      await (editing ? updateOAuthScope : addOAuthScope)(data);
      message.success("权限已保存");
      setOpen(false);
      await getList();
    } catch {
    } finally {
      setSaving(false);
    }
  }
  async function change(row, enable) {
    try {
      await confirm(
        enable
          ? `启用权限“${row.scopeName}”？`
          : `停用权限“${row.scopeName}”后，应用不能再申请这项权限，是否继续？`,
      );
      await (enable
        ? changeOAuthScopeStatus({ scopeCode: row.scopeCode, status: "0" })
        : deleteOAuthScopes(row.scopeCode));
      message.success(enable ? "权限已启用" : "权限已停用");
      await getList();
    } catch {}
  }
  const columns = [
    {
      title: "权限",
      width: 230,
      render: (_, row) => (
        <EntityCell name={row.scopeName} detail={row.scopeCode} kind="scope" copyable />
      ),
    },
    {
      width: 135,
      title: "用途",
      dataIndex: "scopeType",
      render: (value) => (
        <OAuthTag effect="plain" type={value === "identity" ? "primary" : "success"}>
          {scopeTypes.find((item) => item.value === value)?.label || value}
        </OAuthTag>
      ),
    },
    {
      width: 180,
      title: "所属服务",
      dataIndex: "resourceId",
      render: (value) =>
        value
          ? resources.find((item) => item.resourceId === value)?.resourceName || value
          : "统一身份信息",
    },
    {
      width: 230,
      title: "返回的用户信息",
      render: (_, row) => (
        <TagSummary
          effect="plain"
          values={row.claims}
          label={(value) =>
            claimOptions.find((item) => item.value === value)?.label.split("（")[0] || value
          }
          empty="不返回额外信息"
        />
      ),
    },
    {
      width: 145,
      title: "用户确认",
      dataIndex: "consentRequired",
      render: (value, row) => (
        <div className="oauth-policy-cell">
          {row.sensitive && (
            <OAuthTag size="small" type="warning">
              敏感权限
            </OAuthTag>
          )}
          <span>{value ? "需要确认" : "无需重复确认"}</span>
        </div>
      ),
    },
    {
      width: 105,
      align: "center",
      title: "状态",
      dataIndex: "status",
      render: (value) => (
        <OAuthTag type={value === "0" ? "success" : "info"}>
          {value === "0" ? "使用中" : "已停用"}
        </OAuthTag>
      ),
    },
    {
      className: "ruoyi-actions-cell",
      align: "center",
      title: "操作",
      width: 180,
      fixed: "right",
      render: (_, row) => (
        <TableActions>
          <HasPermi value={["system:oauthScope:edit"]}>
            <TableAction symbol="Edit" onClick={() => edit(row)}>
              编辑
            </TableAction>
          </HasPermi>
          {row.scopeCode !== "openid" && (
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  row.status !== "0" &&
                    checkPermi(["system:oauthScope:edit"]) && {
                      key: "enable",
                      label: "重新启用",
                      onClick: () => change(row, true),
                    },
                  row.status === "0" &&
                    checkPermi(["system:oauthScope:remove"]) && {
                      key: "disable",
                      label: "停用权限",
                      onClick: () => change(row, false),
                    },
                ].filter(Boolean),
              }}
            >
              <TableAction symbol="ArrowDown">更多</TableAction>
            </Dropdown>
          )}
        </TableActions>
      ),
    },
  ];
  return (
    <PageFrame
      className="oauth-scope-page"
      title="权限"
      description="用业务语言定义应用可以申请的身份信息和服务操作。"
      section="接入管理"
      filterHint="协议代码作为次要信息展示，日常按名称查找即可"
      actions={
        <HasPermi value={["system:oauthScope:add"]}>
          <Button icon={<PlusOutlined />} type="primary" onClick={add}>
            新增权限
          </Button>
        </HasPermi>
      }
      filters={
        showSearch && (
          <Form
            form={queryForm}
            name="oauth-scope-query"
            layout="inline"
            className="search-form"
            onFinish={(values) => setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })}
          >
            <Form.Item label="权限名称" name="scopeName">
              <Input style={{ width: 200 }} placeholder="输入权限名称" allowClear />
            </Form.Item>
            <Form.Item label="用途" name="scopeType">
              <Select
                style={{ width: 200 }}
                placeholder="全部用途"
                allowClear
                options={scopeTypes}
              />
            </Form.Item>
            <Form.Item label="状态" name="status">
              <Select
                style={{ width: 200 }}
                placeholder="全部状态"
                allowClear
                options={[
                  { value: "0", label: "使用中" },
                  { value: "1", label: "已停用" },
                ]}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button icon={<QuerySearchIcon />} htmlType="submit" type="primary">
                  查找
                </Button>
                <Button
                  icon={<QueryResetIcon />}
                  onClick={() => {
                    queryForm.resetFields();
                    setQuery({ pageNum: 1, pageSize: 10 });
                  }}
                >
                  清空
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )
      }
      toolbar={
        <>
          <span className="result-count">
            已定义 <strong>{total}</strong> 项权限
          </span>
          <RightToolbar showSearch={showSearch} onShowSearch={setShowSearch} onQuery={getList} />
        </>
      }
    >
      <Table
        locale={{
          emptyText: (
            <Empty description="还没有符合条件的权限">
              <HasPermi value={["system:oauthScope:add"]}>
                <Button type="primary" onClick={add}>
                  新增第一项权限
                </Button>
              </HasPermi>
            </Empty>
          ),
        }}
        rowKey="scopeCode"
        dataSource={rows}
        columns={columns}
        loading={loading}
        pagination={false}
        scroll={{ x: 1150 }}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <Modal
        className="oauth-dialog oauth-scope-editor"
        title={editing ? "编辑权限" : "新增权限"}
        open={open}
        width="min(780px, calc(100vw - 48px))"
        onCancel={() => setOpen(false)}
        mask={{ closable: false }}
        forceRender
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={save}>
              保存权限
            </Button>
          </Space>
        }
      >
        <Form
          colon={false}
          wrapperCol={{ flex: "1 1 0" }}
          layout="horizontal"
          form={form}
          name="oauth-scope-editor"
          labelCol={{ flex: "160px" }}
          className="permission-form ruoyi-dialog-form"
        >
          <div className="section-heading">
            <h3>权限含义</h3>
            <p>先选择这项权限用于登录信息还是服务访问，再说明它可以返回什么。</p>
          </div>
          <Form.Item
            name="scopeType"
            label={
              <FieldLabel
                label="权限用途"
                help="登录身份信息用于返回用户资料；服务访问用于允许应用调用某个服务。"
              />
            }
            rules={[{ required: true }]}
          >
            <Radio.Group className="choice-grid" disabled={scopeCode === "openid"}>
              <Radio value="identity">
                <strong>登录身份信息</strong>
                <small>例如姓名、邮箱和角色</small>
              </Radio>
              <Radio value="resource">
                <strong>服务访问</strong>
                <small>例如查看订单或修改库存</small>
              </Radio>
            </Radio.Group>
          </Form.Item>
          <Row gutter={18}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="scopeName"
                label={
                  <FieldLabel
                    label="显示名称"
                    help="用户授权和后台列表中看到的名称，应直接说明允许做什么。"
                  />
                }
                rules={[{ required: true, whitespace: true }]}
              >
                <Input maxLength={100} placeholder="例如：查看订单" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="scopeCode"
                label={
                  <FieldLabel
                    label="权限代码"
                    help="应用在登录请求中使用的协议代码，保存后不能修改。"
                  />
                }
                rules={[{ required: true, whitespace: true }]}
              >
                <Input disabled={editing} maxLength={100} placeholder="例如：orders.read" />
              </Form.Item>
            </Col>
          </Row>
          {type === "resource" && (
            <Form.Item
              name="resourceId"
              label={<FieldLabel label="所属服务" help="选择应用获得这项权限后可以访问的服务。" />}
              rules={[{ required: true, message: "请选择这项权限所属的服务" }]}
            >
              <Select
                showSearch={{ optionFilterProp: "label" }}
                placeholder="选择服务"
                options={resources.map((row) => ({
                  value: row.resourceId,
                  label: row.resourceName,
                }))}
                optionRender={({ data }) => (
                  <>
                    <span>{data.label}</span>
                    <code className="option-code">{data.value}</code>
                  </>
                )}
              />
            </Form.Item>
          )}
          <Form.Item
            name="claims"
            label={
              <FieldLabel
                label="返回用户信息"
                help="应用获得这项权限后可以收到的用户信息，可多选。"
              />
            }
          >
            <Select mode="tags" options={claimOptions} placeholder="选择或输入用户字段" />
          </Form.Item>
          <Form.Item
            label={
              <FieldLabel
                label="用户确认"
                help="敏感权限应要求用户明确确认，并在授权页突出展示。"
              />
            }
          >
            <div className="policy-options">
              <Form.Item name="consentRequired" valuePropName="checked" noStyle>
                <Checkbox>使用前让用户确认</Checkbox>
              </Form.Item>
              <Form.Item name="sensitive" valuePropName="checked" noStyle>
                <Checkbox>标记为敏感权限</Checkbox>
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item
            name="remark"
            label={<FieldLabel label="备注" help="仅供管理员记录，不会显示给外部应用。" />}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </PageFrame>
  );
}
