import PluginSummary from "./PluginSummary";
import "./style.css";
import { Alert, Button, Descriptions, Modal, Space, Tabs, Typography } from "antd";
import Table from "@/components/Table";
import HasPermi from "@/directive/permission/hasPermi";
import {
  formatBoolean,
  formatDependencyInstalled,
  formatDependencyVersionSatisfied,
  getDependencyTagType,
  isCapabilityOperationBlocked,
} from "../formatter";
import PluginTag from "./PluginTag";

export default function PluginDependencyDialog({
  open,
  result = {},
  loading,
  onClose,
  onDryRun,
  onInstall,
}) {
  const policy = result.policy,
    blocked = isCapabilityOperationBlocked(result.capability, "dependency_install"),
    allowed = !blocked && !!result.plan?.length && policy?.allowed !== false;
  const list = (value) => (Array.isArray(value) && value.length ? value.join("；") : "-");
  const policyAllowed = policy?.allowed === true;
  const policyMessages = policy
    ? [...(policy.reasons || []), ...(policy.requirements || []), ...(policy.warnings || [])]
    : [];
  return (
    <Modal
      className="plugin-dialog plugin-result-dialog"
      title="插件依赖"
      open={open}
      width="min(860px, calc(100vw - 32px))"
      onCancel={onClose}
      footer={
        <Space>
          <Button type="primary" loading={loading} disabled={blocked} onClick={onDryRun}>
            生成安装计划
          </Button>
          <HasPermi value={["system:plugin:edit"]}>
            <Button
              type="primary"
              className="plugin-dependency-install"
              loading={loading}
              disabled={!allowed}
              onClick={onInstall}
            >
              执行依赖安装
            </Button>
          </HasPermi>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      {result.message && (
        <Alert
          title={result.message}
          type={result.ok ? "success" : "warning"}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <PluginSummary
        columns={5}
        items={[
          ["插件ID", result.pluginId || "-"],
          [
            "依赖检查",
            <PluginTag type={result.dependencyOk ? "success" : "danger"}>
              {formatBoolean(result.dependencyOk)}
            </PluginTag>,
          ],
          [
            "缺失依赖",
            <span className="plugin-summary-danger">
              {
                (result.dependencies || []).filter((item) => item.status !== "skipped" && !item.ok)
                  .length
              }
            </span>,
          ],
          ["安装计划", result.planCount ?? result.plan?.length ?? 0],
          [
            "安装策略",
            policy ? (
              <PluginTag type={policyAllowed ? "success" : "warning"}>
                {policy.mode || "-"}
              </PluginTag>
            ) : (
              "-"
            ),
          ],
        ].map(([label, children]) => ({ key: label, label, children }))}
      />
      {policy && (
        <Alert
          style={{ marginBottom: 16 }}
          showIcon
          type={policyAllowed ? "success" : "warning"}
          title={policyAllowed ? "策略允许执行真实安装" : "策略已阻断真实安装"}
          description={
            <>
              {!!policyMessages.length && (
                <div className="dependency-policy-messages">
                  {policyMessages.map((message, index) => (
                    <div key={index}>{message}</div>
                  ))}
                </div>
              )}
              {!policyAllowed && (
                <div className="dependency-policy-next">
                  {policy.mode === "plan_only"
                    ? "Web 管理端仅生成安装计划；真实安装请使用 CLI install-deps 受控执行。"
                    : "请按策略要求补齐确认参数、锁文件或离线制品后重试。"}
                </div>
              )}
            </>
          }
        />
      )}
      <Tabs
        items={[
          {
            key: "dependencies",
            label: "依赖状态",
            children: (
              <Table
                size="small"
                bordered
                scroll={{ x: 860 }}
                locale={{ emptyText: "暂无依赖声明" }}
                rowKey={(row) => `${row.kind}:${row.requirement}`}
                pagination={false}
                dataSource={result.dependencies || []}
                columns={[
                  { width: 90, align: "center", title: "类型", dataIndex: "kind" },
                  { width: 200, title: "依赖", dataIndex: "requirement", ellipsis: true },
                  {
                    width: 130,
                    title: "已安装版本",
                    dataIndex: "installedVersion",
                    ellipsis: true,
                    render: (value) => value || "-",
                  },
                  {
                    width: 100,
                    align: "center",
                    title: "安装状态",
                    render: (_, row) => (
                      <PluginTag type={getDependencyTagType(row)}>
                        {formatDependencyInstalled(row)}
                      </PluginTag>
                    ),
                  },
                  {
                    width: 100,
                    align: "center",
                    title: "版本满足",
                    render: (_, row) => (
                      <PluginTag type={getDependencyTagType(row)}>
                        {formatDependencyVersionSatisfied(row)}
                      </PluginTag>
                    ),
                  },
                  { width: 240, title: "说明", dataIndex: "message", ellipsis: true },
                ]}
              />
            ),
          },
          {
            key: "plan",
            label: "安装计划",
            children: (
              <Table
                size="small"
                bordered
                scroll={{ x: 760 }}
                locale={{ emptyText: "暂无安装计划" }}
                rowKey={(row) => `${row.kind}:${row.requirement}`}
                pagination={false}
                dataSource={result.plan || []}
                columns={[
                  { width: 90, align: "center", title: "类型", dataIndex: "kind" },
                  { width: 150, title: "依赖", dataIndex: "requirement", ellipsis: true },
                  { width: 220, title: "工作目录", dataIndex: "workdir", ellipsis: true },
                  {
                    width: 300,
                    title: "命令",
                    dataIndex: "commandText",
                    render: (value) => (
                      <Typography.Text
                        className="dependency-command-text"
                        copyable={
                          value ? { text: value, tooltips: ["复制命令", "命令已复制"] } : false
                        }
                      >
                        {value || "-"}
                      </Typography.Text>
                    ),
                  },
                ]}
              />
            ),
          },
          ...(policy
            ? [
                {
                  key: "policy",
                  label: "策略判定",
                  children: (
                    <>
                      <Descriptions
                        bordered
                        column={2}
                        size="small"
                        items={[
                          ["策略模式", policy.mode || "-"],
                          [
                            "允许执行",
                            <PluginTag type={policyAllowed ? "success" : "danger"}>
                              {policyAllowed ? "允许" : "阻断"}
                            </PluginTag>,
                          ],
                          ["阻断原因", list(policy.reasons)],
                          ["前置要求", list(policy.requirements)],
                          ["风险提示", list(policy.warnings)],
                        ].map(([label, children]) => ({
                          key: label,
                          label,
                          children,
                        }))}
                      />
                      <Table
                        style={{ marginTop: 16 }}
                        size="small"
                        bordered
                        scroll={{ x: 960 }}
                        locale={{ emptyText: "暂无策略项" }}
                        rowKey={(row) => `${row.kind}:${row.requirement}`}
                        pagination={false}
                        dataSource={policy.items || []}
                        columns={[
                          { width: 90, align: "center", title: "类型", dataIndex: "kind" },
                          { width: 180, title: "依赖", dataIndex: "requirement", ellipsis: true },
                          {
                            width: 90,
                            align: "center",
                            title: "判定",
                            dataIndex: "allowed",
                            render: (value) => (
                              <PluginTag type={value ? "success" : "danger"}>
                                {value ? "允许" : "阻断"}
                              </PluginTag>
                            ),
                          },
                          {
                            width: 120,
                            title: "锁定版本",
                            dataIndex: "lockedVersion",
                            ellipsis: true,
                            render: (value) => value || "-",
                          },
                          {
                            width: 220,
                            title: "离线制品",
                            dataIndex: "artifactPath",
                            ellipsis: true,
                            render: (value) => value || "-",
                          },
                          {
                            width: 260,
                            title: "说明",
                            ellipsis: true,
                            render: (_, row) =>
                              list([
                                ...(row.reasons || []),
                                ...(row.requirements || []),
                                ...(row.warnings || []),
                              ]),
                          },
                        ]}
                      />
                    </>
                  ),
                },
              ]
            : []),
        ]}
      />
    </Modal>
  );
}
