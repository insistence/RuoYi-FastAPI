import PluginSummary from "./PluginSummary";
import "./style.css";
import { Alert, Button, Descriptions, Input, Modal, Tabs } from "antd";
import Table from "@/components/Table";
import { getValidationLevelLabel, getValidationLevelTagType } from "@/utils/pluginPlanFormatter";
import { formatBoolean, formatJson } from "../formatter";
import PluginTag from "./PluginTag";

export default function PluginDiagnosticDialog({
  open,
  title = "插件诊断",
  result = {},
  loading,
  onClose,
}) {
  const health = result.health,
    diagnose = result.info || result.check ? result : null,
    check = diagnose?.check || {};
  const validation = [
    ["依赖", check.dependencies],
    ["Manifest 错误", check.manifestIssues],
    ["Manifest 警告", check.manifestWarnings],
    ["插件依赖", check.pluginDependencyErrors],
    ["结构", check.structureErrors],
    ["菜单冲突", check.menuConflicts],
  ].flatMap(([category, rows]) =>
    Array.isArray(rows)
      ? rows.map((item) => ({
          category,
          level: item.level || (category.includes("警告") ? "warning" : "error"),
          kind: item.kind || item.name || item.status || "-",
          value: item.value || item.requirement || item.path || item.pluginId || item.perms || "-",
          message: item.message || item.suggestion || item.reason || "",
        }))
      : [],
  );
  return (
    <Modal
      className="plugin-dialog plugin-result-dialog"
      title={title}
      open={open}
      onCancel={onClose}
      width="min(920px, calc(100vw - 32px))"
      loading={loading}
      footer={<Button onClick={onClose}>关闭</Button>}
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
        autoFit
        items={[
          ["插件ID", result.pluginId || "-"],
          [
            "结果",
            <PluginTag type={result.ok ? "success" : "danger"}>
              {result.ok ? "正常" : "异常"}
            </PluginTag>,
          ],
          ...(health
            ? [
                ["状态", health.status || "-"],
                ["耗时", `${health.durationMs ?? "-"}ms`],
              ]
            : []),
        ].map(([label, children]) => ({ key: label, label, children }))}
      />
      <Tabs
        items={[
          ...(health
            ? [
                {
                  key: "health",
                  label: "健康状态",
                  children: (
                    <>
                      <Descriptions
                        bordered
                        column={2}
                        items={[
                          ["检查器", health.checker],
                          ["状态", health.status],
                          ["说明", health.message],
                          ["错误", health.error],
                        ].map(([label, children]) => ({
                          key: label,
                          label,
                          span: ["说明", "错误"].includes(label) ? 2 : 1,
                          children: children || "-",
                        }))}
                      />
                      <Input.TextArea
                        style={{ marginTop: 16 }}
                        readOnly
                        rows={8}
                        value={formatJson(health.details)}
                      />
                    </>
                  ),
                },
              ]
            : []),
          ...(diagnose
            ? [
                {
                  key: "check",
                  label: "检查摘要",
                  children: (
                    <>
                      <Descriptions
                        bordered
                        column={3}
                        items={[
                          ["依赖", formatBoolean(check.dependencyOk)],
                          ["Manifest", formatBoolean(check.manifestOk)],
                          ["结构", formatBoolean(check.structureOk)],
                          ["插件依赖", formatBoolean(check.pluginDependencyOk)],
                          ["菜单冲突", formatBoolean(check.menuConflictOk)],
                          ["配置项", diagnose.config?.summary?.total ?? "-"],
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
                        scroll={{ x: 820 }}
                        locale={{ emptyText: "暂无诊断问题" }}
                        rowKey={(_, index) => index}
                        pagination={false}
                        dataSource={validation}
                        columns={[
                          { width: 120, align: "center", title: "分类", dataIndex: "category" },
                          {
                            width: 90,
                            align: "center",
                            title: "等级",
                            dataIndex: "level",
                            render: (value) => (
                              <PluginTag type={getValidationLevelTagType(value)}>
                                {getValidationLevelLabel(value)}
                              </PluginTag>
                            ),
                          },
                          { width: 170, title: "类型", dataIndex: "kind" },
                          { width: 180, title: "对象", dataIndex: "value" },
                          { width: 260, title: "说明", dataIndex: "message" },
                        ]}
                      />
                    </>
                  ),
                },
                {
                  key: "menus",
                  label: "菜单计划",
                  children: (
                    <Input.TextArea value={formatJson(diagnose.menuPlan)} readOnly rows={12} />
                  ),
                },
              ]
            : []),
          {
            key: "raw",
            label: "原始数据",
            children: <Input.TextArea value={formatJson(result)} readOnly rows={14} />,
          },
        ]}
      />
    </Modal>
  );
}
