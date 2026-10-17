import FileAclDrawer from "@/views/system/file/components/FileAclDrawer";
import OAuthResource from "@/views/system/oauth/resource";
import OAuthScope from "@/views/system/oauth/scope";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  App,
  ConfigProvider,
  theme,
  Tabs,
  Button,
  Card,
  Table,
  Tag,
  Form,
  Input,
  Space,
  Modal,
} from "antd";
import zhCN from "antd/locale/zh_CN";
import "@/assets/styles/react.css";
import "@/layout/style.css";
import PageFrame from "@/components/OAuthWorkspace/PageFrame";
import AccessMap from "@/components/OAuthWorkspace/AccessMap";
import EntityCell from "@/components/OAuthWorkspace/EntityCell";
import TreePanel from "@/components/TreePanel";
import FileStatistics from "@/views/system/file/components/FileStatistics";
import { NoticeArticle } from "@/layout/components/HeaderNotice/DetailView";
import Dashboard from "@/views/dashboard";
import Editor from "@/components/Editor";
import IconSelect from "@/components/IconSelect";
import BusinessDateTimePicker from "@/components/BusinessDateTimePicker";
import BusinessFileUpload from "@/components/BusinessFileUpload";
import CronField from "@/components/Crontab/field";
import HeaderSearch from "@/components/HeaderSearch";
import Client from "@/views/system/oauth/client";
import OAuthKey from "@/views/system/oauth/key";
import Navbar from "@/layout/components/Navbar";
import TagsView from "@/layout/components/TagsView";
import Sidebar from "@/layout/components/Sidebar";
import Settings from "@/layout/components/Settings";
import AuthCenterShell from "@/views/auth-center/AuthCenterShell";
import Builder from "@/views/tool/build";
import AiMessageCheck from "./ai-message-check";
import useSettingsStore from "@/store/modules/settings";
import PluginSummary from "@/views/system/plugin/components/PluginSummary";
import Error404 from "@/views/error/404";
import request from "@/utils/request";
import useUserStore from "@/store/modules/user";
import usePermissionStore from "@/store/modules/permission";
import useTagsViewStore from "@/store/modules/tagsView";
const routes = [
  { path: "/system/user", meta: { title: "用户管理", icon: "user" } },
  { path: "/system/role", meta: { title: "角色管理", icon: "peoples" } },
  {
    path: "/system/oauth/client",
    meta: { title: "接入应用", icon: "component" },
  },
];
useUserStore.setState({
  roles: ["admin"],
  permissions: ["*:*:*"],
  nickName: "样式核查",
  name: "样例用户",
});
usePermissionStore.setState({ routes, sidebarRouters: routes, ready: true });
useTagsViewStore.setState({
  visitedViews: [
    { key: "/index", fullPath: "/index", label: "首页", closable: false },
    {
      key: "/system/user",
      fullPath: "/system/user",
      label: "用户管理",
      closable: true,
    },
    {
      key: "/system/oauth/client",
      fullPath: "/system/oauth/client",
      label: "接入应用",
      closable: true,
    },
  ],
});
const sampleClient = {
  clientId: "portal-demo",
  clientName: "门户应用",
  clientType: "confidential",
  grantTypes: ["authorization_code"],
  resourceIds: ["business-api"],
  scopeCodes: ["openid"],
  status: "0",
  updateTime: "2026-10-11T08:00:00+08:00",
};
// Development-only visual fixture. Its Axios pipeline is isolated from authentication,
// transport policy lookup and all backend calls; production entry points never import it.
if (!import.meta.env.DEV) throw new Error("Visual fixtures are development-only");
request.interceptors.request.clear();
request.interceptors.response.clear();
request.interceptors.response.use((response) => response.data);
request.defaults.adapter = async (config) => ({
  status: 200,
  statusText: "OK",
  headers: {},
  config,
  data: {
    code: 200,
    rows: config.url.includes("/client/") ? [sampleClient] : [],
    data: config.url.includes("/acl/list")
      ? {
          aclVersion: 1,
          builtinPermissions: [
            {
              source: "admin",
              subjectName: "平台管理员",
              enabled: true,
              denyOverridable: false,
              description: "管理员内置下载权限",
            },
            {
              source: "owner",
              subjectName: "项目负责人",
              enabled: true,
              denyOverridable: false,
              description: "文件所有者内置下载权限",
            },
            {
              source: "uploader",
              subjectName: "上传用户",
              enabled: true,
              denyOverridable: true,
              description: "启用的上传人权限可被显式拒绝覆盖",
            },
          ],
          entries: [
            {
              subjectType: "dept",
              subjectId: 10,
              subjectName: "研发部",
              effect: "allow",
              includeChildren: true,
              expireTime: null,
            },
          ],
        }
      : config.url.includes("/acl/dept-tree")
        ? [{ id: 10, label: "研发部" }]
        : config.url.includes("/client/")
          ? sampleClient
          : [],
    total: config.url.includes("/client/") ? 1 : 0,
    enabled: true,
    ready: false,
  },
});
const notice = {
  noticeType: "2",
  noticeTitle: "Web 迁移样式核查：通知正文与长标题显示",
  createBy: "系统管理员",
  createTime: "2026-10-11T08:00:00+08:00",
  status: "0",
  noticeContent:
    "<h2>样式恢复核查</h2><p>通知内容应保留正文间距、标题层级和引用区块，同时适应窄屏与深色主题。</p><blockquote>这是一段用于核查排版的示例引用内容。</blockquote><table><thead><tr><th>检查项目</th><th>示例状态</th></tr></thead><tbody><tr><td>组件样式</td><td>已接入</td></tr><tr><td>页面布局</td><td>浏览器核查中</td></tr></tbody></table>",
};
const sampleRows = [
  { id: 1, name: "门户应用", detail: "portal-demo", status: "使用中" },
  {
    id: 2,
    name: "移动办公",
    detail: "mobile-office-client-long-identifier",
    status: "使用中",
  },
];
const columns = [
  {
    title: "应用",
    dataIndex: "name",
    render: (_, r) => <EntityCell name={r.name} detail={r.detail} />,
  },
  {
    title: "状态",
    dataIndex: "status",
    render: (t) => <Tag color="success">{t}</Tag>,
  },
];
function Inputs() {
  const [date, setDate] = useState("2026-10-11 12:00:00"),
    [cron, setCron] = useState("1W"),
    [files, setFiles] = useState([
      {
        fileId: "sample-1",
        name: "用于检查文件名过长时是否正确省略以及按钮是否错位的示例文件.pdf",
        url: "/fixture-only",
      },
      { fileId: "sample-2", name: "核查记录.pdf", url: "/fixture-only" },
    ]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 24 }}>
      <Card title="上传与时间输入">
        <BusinessFileUpload value={files} onChange={setFiles} />
        <div style={{ marginTop: 20, maxWidth: 460 }}>
          <BusinessDateTimePicker value={date} onChange={setDate} />
        </div>
      </Card>
      <Card title="图标选择与 Cron">
        <IconSelect style={{ width: "100%", maxWidth: 480 }} />
        <CronField name="day" label="日" min={1} max={31} value={cron} onChange={setCron} />
      </Card>
      <Card title="富文本编辑器">
        <Editor value="<p>核查工具栏、内容边框与中文选项。</p>" />
      </Card>
    </div>
  );
}
function AclCheck() {
  const [acl, setAcl] = useState();
  const row = { fileId: "sample-file", originalName: "项目资料.pdf", accessType: "private" };
  return (
    <>
      <Table
        rowKey="fileId"
        dataSource={[row]}
        pagination={false}
        columns={[
          { title: "文件名", dataIndex: "originalName" },
          { title: "访问类型", render: () => "受保护" },
          {
            title: "操作",
            render: () => (
              <Space>
                <Button onClick={() => setAcl({ files: [row], batch: false })}>访问权限</Button>
                <Button onClick={() => setAcl({ files: [row], batch: true })}>
                  批量授权（选中一个）
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <FileAclDrawer
        files={acl?.files}
        batch={acl?.batch}
        onClose={() => setAcl(undefined)}
        onSuccess={() => {}}
      />
    </>
  );
}

function Check() {
  const dark = useSettingsStore((state) => state.dark);
  const setDark = (value) => useSettingsStore.getState().update({ dark: value });
  const [tab, setTab] = useState(new URLSearchParams(location.search).get("view") || "work"),
    [settingsOpen, setSettingsOpen] = useState(false);
  const sampleLayoutSettings = {
    navType: 1,
    tagsViewStyle: "card",
    sideTheme: dark ? "dark" : "light",
    showSettings: true,
  };
  const items = [
    {
      key: "work",
      label: "公共工作台",
      children: (
        <>
          <FileStatistics
            stats={{
              totalCount: 1268,
              activeCount: 1200,
              deletedCount: 68,
              totalSize: 8349281045,
              publicSize: 2149281045,
              privateSize: 6200000000,
              expiredCount: 8,
              retentionExpiringCount: 12,
              aclExpiringCount: 5,
            }}
          />
          <div className="split-page">
            <TreePanel
              storageKey="style-fixture-tree"
              data={[
                {
                  id: 1,
                  label: "总公司",
                  children: [
                    { id: 2, label: "研发部门" },
                    { id: 3, label: "包含较长名称的业务运营与支持部门" },
                  ],
                },
              ]}
            />
            <PageFrame
              title="接入应用"
              section="统一认证"
              description="管理应用、访问权限与资源服务。"
              context={
                <AccessMap
                  application="门户应用"
                  type="confidential"
                  permissions={["身份信息", "资料读取"]}
                  resources={["业务服务"]}
                />
              }
              filters={
                <Form layout="inline" className="search-form">
                  <Form.Item label="应用名称">
                    <Input placeholder="请输入应用名称" />
                  </Form.Item>
                  <Button type="primary">搜索</Button>
                </Form>
              }
              actions={<Button type="primary">新增应用</Button>}
              toolbar={<span>共 2 个应用</span>}
            >
              <Table columns={columns} dataSource={sampleRows} rowKey="id" pagination={false} />
            </PageFrame>
          </div>
        </>
      ),
    },
    { key: "dashboard", label: "首页", children: <Dashboard /> },
    {
      key: "notice",
      label: "通知正文",
      children: <NoticeArticle detail={notice} />,
    },
    { key: "inputs", label: "输入组件", children: <Inputs /> },
    { key: "client", label: "OAuth 应用", children: <Client /> },
    { key: "keys", label: "签名密钥", children: <OAuthKey /> },
    { key: "acl", label: "文件权限", children: <AclCheck /> },
    { key: "resource", label: "资源服务", children: <OAuthResource /> },
    { key: "scope", label: "权限范围", children: <OAuthScope /> },
    {
      key: "layout",
      label: "导航布局",
      children: (
        <>
          <Navbar
            showSidebar
            settings={sampleLayoutSettings}
            permission={{ sidebarRouters: routes }}
            user={{ nickName: "核查用户" }}
            onSettings={() => setSettingsOpen(true)}
          />
          <TagsView />
          <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          <div style={{ width: 220 }}>
            <Sidebar routes={routes} />
          </div>
        </>
      ),
    },
    {
      key: "auth",
      label: "认证中心",
      children: (
        <AuthCenterShell applicationName="门户应用" applicationId="portal-demo">
          <h2>确认要分享的信息</h2>
          <p className="panel-lead">检查认证中心容器、步骤条和权限卡片。</p>
          <section className="scope-section">
            <h3>完成访问所需</h3>
            <div className="scope-item is-selected">
              <strong>身份信息</strong>
              <Tag>必需</Tag>
              <small>用于确认登录用户的身份</small>
            </div>
          </section>
          <div className="remember-card">记住本次选择</div>
          <div className="primary-action">
            <Button>不允许并返回</Button>
            <Button type="primary">允许并继续</Button>
          </div>
        </AuthCenterShell>
      ),
    },
    { key: "builder", label: "表单设计器", children: <Builder /> },
    {
      key: "ai",
      label: "AI 消息",
      children: <AiMessageCheck />,
    },
    {
      key: "plugin",
      label: "插件摘要",
      children: (
        <Card title="插件信息">
          <PluginSummary
            columns={4}
            items={[
              { label: "当前版本", children: "1.0.0" },
              { label: "依赖检查", children: "通过" },
              { label: "运行进程", children: 4 },
              { label: "配置状态", children: "已生效" },
            ]}
          />
        </Card>
      ),
    },
    { key: "error", label: "错误页", children: <Error404 /> },
  ];
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        cssVar: true,
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorPrimary: "#409eff", borderRadius: 6 },
      }}
    >
      <App>
        <MemoryRouter initialEntries={["/index"]}>
          <div style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <h2 style={{ fontSize: 20 }}>Web 样式迁移核查 · 本地样例</h2>
              <Space>
                <HeaderSearch />
                <Button onClick={() => setDark(!dark)}>{dark ? "浅色主题" : "深色主题"}</Button>
              </Space>
            </div>
            <Tabs activeKey={tab} onChange={setTab} items={items} destroyOnHidden />
          </div>
        </MemoryRouter>
      </App>
    </ConfigProvider>
  );
}
createRoot(document.getElementById("root")).render(<Check />);
