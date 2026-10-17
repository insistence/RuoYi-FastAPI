import { Alert, Button, Descriptions, Input, Modal, Space, Tabs, Tag } from "antd";
import Table from "@/components/Table";
import HasPermi from "@/directive/permission/hasPermi";
import { getValidationLevelLabel, getValidationLevelTagType } from "@/utils/pluginPlanFormatter";
import {
  formatBoolean,
  formatDependencyInstalled,
  formatDependencyVersionSatisfied,
  formatJson,
  formatPluginOperation,
} from "../formatter";
import { tagColors } from "./PluginReleaseStatus";

export default function PluginActionDialog({
  open,
  title = "插件操作结果",
  result = {},
  pending,
  loading,
  dictionary = [],
  onExecute,
  onClose,
}) {
  const level = {
    align: "center",
    title: "等级",
    dataIndex: "level",
    render: (value) => (
      <Tag color={tagColors[getValidationLevelTagType(value)]}>
        {getValidationLevelLabel(value)}
      </Tag>
    ),
  };
  const table = (data, columns) => (
    <Table
      size="small"
      rowKey={(_, index) => index}
      dataSource={data || []}
      columns={columns}
      pagination={false}
      scroll={{ x: "max-content" }}
    />
  );
  return (
    <Modal
      title={title}
      open={open}
      width="min(860px, calc(100vw - 32px))"
      onCancel={onClose}
      footer={
        <Space>
          {pending?.type && (
            <HasPermi
              value={[pending.type === "purge" ? "system:plugin:remove" : "system:plugin:edit"]}
            >
              <Button
                type="primary"
                danger={pending.type === "purge"}
                loading={loading}
                onClick={onExecute}
              >
                执行{pending.label}
              </Button>
            </HasPermi>
          )}
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
      <Descriptions
        bordered
        items={[
          ["插件 ID", result.pluginId],
          ["依赖检查", formatBoolean(result.dependencyOk)],
          ["结构检查", formatBoolean(result.structureOk)],
          ["菜单冲突", formatBoolean(result.menuConflictOk)],
          ["预演模式", result.dryRun ? "是" : "否"],
          ["需要升级", formatBoolean(result.needsUpgrade)],
        ].map(([label, children]) => ({
          key: label,
          label,
          children: children ?? "-",
        }))}
      />
      <Tabs
        items={[
          ...(result.error
            ? [
                {
                  key: "error",
                  label: "错误详情",
                  children: (
                    <>
                      <Alert
                        type="error"
                        showIcon
                        title={result.error.message || "插件操作失败"}
                        style={{ marginBottom: 16 }}
                      />
                      <Descriptions
                        bordered
                        column={2}
                        items={[
                          ["插件 ID", result.pluginId || pending?.pluginId],
                          ["操作", formatPluginOperation(result.operation, dictionary)],
                          ["失败步骤", result.failedStep || result.error.failedStep],
                          ["Migration", result.migrationRecovery?.migrationPath],
                          ["Migration 状态", result.migrationRecovery?.status],
                          ["建议", result.error.suggestion || "请查看后端日志或重新执行检查。"],
                        ].map(([label, children]) => ({
                          key: label,
                          label,
                          children: children ?? "-",
                        }))}
                      />
                      <Input.TextArea
                        rows={10}
                        readOnly
                        value={formatJson(result.error.raw)}
                        style={{ marginTop: 16 }}
                      />
                    </>
                  ),
                },
              ]
            : []),
          {
            key: "actions",
            label: "动作计划",
            children: table(result.actions, [
              { title: "动作", dataIndex: "label" },
              {
                align: "center",
                title: "启用",
                dataIndex: "enabled",
                render: (value) => (value ? "是" : "否"),
              },
              { align: "center", title: "状态", dataIndex: "ok", render: formatBoolean },
              { align: "center", title: "数量", dataIndex: "count" },
            ]),
          },
          {
            key: "dependencies",
            label: "依赖",
            children: table(result.dependencies, [
              level,
              { align: "center", title: "类型", dataIndex: "kind" },
              { title: "依赖", dataIndex: "requirement" },
              {
                align: "center",
                title: "已安装",
                render: (_, row) => formatDependencyInstalled(row),
              },
              {
                align: "center",
                title: "版本满足",
                render: (_, row) => formatDependencyVersionSatisfied(row),
              },
              { title: "说明", dataIndex: "message" },
            ]),
          },
          {
            key: "manifest",
            label: "Manifest 提示",
            children: table(
              [...(result.manifestIssues || []), ...(result.manifestWarnings || [])],
              [
                level,
                { align: "center", title: "类型", dataIndex: "kind" },
                { title: "路径", dataIndex: "path" },
                { title: "说明", dataIndex: "message" },
                { title: "建议", dataIndex: "suggestion" },
              ],
            ),
          },
          {
            key: "structure",
            label: "结构错误",
            children: table(result.structureErrors, [
              level,
              { align: "center", title: "类型", dataIndex: "kind" },
              { title: "路径", dataIndex: "path" },
              { title: "说明", dataIndex: "message" },
            ]),
          },
          {
            key: "conflicts",
            label: "菜单冲突",
            children: table(result.menuConflicts, [
              level,
              { align: "center", title: "类型", dataIndex: "kind" },
              { title: "冲突值", dataIndex: "value" },
              { title: "说明", dataIndex: "message" },
            ]),
          },
        ]}
      />
    </Modal>
  );
}
