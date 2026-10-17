import "./style.css";
import { useEffect, useState } from "react";
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  FileProtectOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Collapse,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tabs,
} from "antd";
import Table from "@/components/Table";
import {
  getPluginOperationLog,
  listPluginOperationLog,
  retainPluginOperationLog,
} from "@/api/system/plugin";
import { getConfigKey } from "@/api/system/config";
import {
  normalizePluginOperationLogDetail,
  getValidationLevelLabel,
  getValidationLevelTagType,
} from "@/utils/pluginPlanFormatter";
import {
  formatActionPlanState,
  formatJson,
  formatPlanDependencies,
  formatPluginOperation,
  formatPluginTime,
  formatRetentionMessage,
  getOperationLogStatusLabel,
  getOperationLogStatusTagType,
  operationLogStatusOptions,
} from "../formatter";
import Pagination from "@/components/Pagination";
import HasPermi from "@/directive/permission/hasPermi";
import RightToolbar from "@/components/RightToolbar";
import { TableAction } from "@/components/TableActions";
import PluginTag from "./PluginTag";
import { confirm, message } from "@/plugins/modal";
import { download } from "@/utils/request";
import { getDisplayTimezone } from "@/utils/time";

export default function PluginOperationLogDrawer({ open, onClose, dictionary = [] }) {
  const [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [data, setData] = useState({ rows: [], total: 0 }),
    [loading, setLoading] = useState(false),
    [detail, setDetail] = useState(),
    [revision, setRevision] = useState(0),
    [days, setDays] = useState(180),
    [defaultDays, setDefaultDays] = useState(180),
    [retention, setRetention] = useState(),
    [retaining, setRetaining] = useState(false),
    [exporting, setExporting] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setQuery({ pageNum: 1, pageSize: 10 });
    setRetention(undefined);
    getConfigKey("sys.plugin.operationLogRetentionDays")
      .then((result) => {
        const value = Number(result.msg);
        if (Number.isInteger(value) && value >= 0) {
          setDays(value);
          setDefaultDays(value);
        }
      })
      .catch(() => {});
  }, [open, form]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    listPluginOperationLog(query)
      .then((result) => active && setData(result))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, query, revision]);
  const operation = (value) => formatPluginOperation(value, dictionary),
    table = (rows, columns, emptyText, minWidth) => (
      <Table
        size="small"
        bordered
        pagination={false}
        rowKey={(_, index) => index}
        dataSource={rows || []}
        columns={columns}
        locale={{ emptyText }}
        scroll={{ x: minWidth }}
      />
    );
  async function retain(dryRun) {
    if (!Number.isInteger(days) || days < 0) return message.warning("请输入有效的保留天数");
    try {
      if (!dryRun)
        await confirm(
          days === 0
            ? "确认清理当前时间之前的全部插件操作审计日志吗？"
            : `确认清理超过 ${days} 天的插件操作审计日志吗？`,
        );
      setRetaining(true);
      const result = await retainPluginOperationLog({
        retentionDays: days,
        dryRun,
      });
      setRetention(result.data);
      if (!dryRun) {
        message.success("插件操作审计清理完成");
        setRevision((value) => value + 1);
      }
    } catch {
    } finally {
      setRetaining(false);
    }
  }
  return (
    <>
      <Drawer
        rootClassName="plugin-audit-drawer"
        closable={{ placement: "end" }}
        title="插件操作审计"
        open={open}
        onClose={onClose}
        size="max(50vw, min(600px, 100vw))"
      >
        <div className="plugin-audit-content">
          {showSearch && (
            <Form
              form={form}
              name="plugin-audit-query"
              layout="inline"
              className="search-form"
              labelCol={{ flex: "68px" }}
              colon={false}
              onFinish={({ dateRange, ...values }) =>
                setQuery({
                  ...values,
                  beginTime: dateRange?.[0]?.format("YYYY-MM-DD"),
                  endTime: dateRange?.[1]?.format("YYYY-MM-DD"),
                  pageNum: 1,
                  pageSize: query.pageSize,
                })
              }
            >
              <Form.Item name="pluginId" label="插件ID">
                <Input placeholder="请输入插件ID" allowClear />
              </Form.Item>
              <Form.Item name="operation" label="操作">
                <Select placeholder="操作类型" allowClear options={dictionary} />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select placeholder="执行状态" allowClear options={operationLogStatusOptions} />
              </Form.Item>
              <Form.Item name="dateRange" label="创建时间">
                <DatePicker.RangePicker
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
                      form.resetFields();
                      setQuery({ pageNum: 1, pageSize: 10 });
                    }}
                  >
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          )}
          <Collapse
            className="plugin-audit-maintenance"
            expandIconPlacement="end"
            items={[
              {
                key: "retention",
                label: (
                  <Space size={8}>
                    <strong>审计保留策略</strong>
                    <PluginTag className="plugin-audit-retention-tag">
                      默认 {defaultDays} 天
                    </PluginTag>
                  </Space>
                ),
                children: (
                  <>
                    <Space className="plugin-audit-retention-form" wrap size={12}>
                      保留天数
                      <InputNumber
                        min={0}
                        max={3650}
                        precision={0}
                        value={days}
                        onChange={(value) => {
                          setDays(value);
                          setRetention(undefined);
                        }}
                      />
                      <Button
                        icon={<FileProtectOutlined />}
                        loading={retaining}
                        onClick={() => retain(true)}
                      >
                        预览清理
                      </Button>
                      <HasPermi value={["system:plugin:edit"]}>
                        <Button
                          icon={<DeleteOutlined />}
                          className="ruoyi-plain-button ruoyi-plain-button--danger"
                          loading={retaining}
                          onClick={() => retain(false)}
                        >
                          确认清理
                        </Button>
                      </HasPermi>
                    </Space>
                    {retention && (
                      <Alert
                        style={{ marginTop: 12 }}
                        showIcon
                        title={formatRetentionMessage(retention)}
                        type={retention.deletedCount ? "success" : "info"}
                      />
                    )}
                  </>
                ),
              },
            ]}
          />
          <div className="plugin-audit-table">
            <div className="plugin-audit-table-toolbar">
              <HasPermi value={["system:plugin:export"]}>
                <Button
                  icon={<DownloadOutlined />}
                  className="ruoyi-plain-button ruoyi-plain-button--warning"
                  loading={exporting}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      await download(
                        "system/plugin/operation-log/export",
                        { ...query, exportLimit: 5000 },
                        `plugin_operation_log_${Date.now()}.xlsx`,
                      );
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  导出
                </Button>
              </HasPermi>
              <RightToolbar
                showSearch={showSearch}
                onShowSearch={setShowSearch}
                onQuery={() => setRevision((value) => value + 1)}
              />
            </div>
            <Table
              size="small"
              bordered
              rowKey="operationId"
              loading={loading}
              dataSource={data.rows}
              pagination={false}
              scroll={{ x: 830 }}
              columns={[
                { width: 90, align: "center", title: "日志ID", dataIndex: "operationId" },
                {
                  width: 90,
                  align: "center",
                  title: "操作",
                  dataIndex: "operation",
                  render: operation,
                },
                {
                  width: 90,
                  align: "center",
                  title: "状态",
                  dataIndex: "status",
                  render: (value) => (
                    <PluginTag type={getOperationLogStatusTagType(value)}>
                      {getOperationLogStatusLabel(value)}
                    </PluginTag>
                  ),
                },
                {
                  width: 180,
                  title: "插件",
                  ellipsis: true,
                  dataIndex: "pluginIds",
                  render: formatPlanDependencies,
                },
                {
                  width: 70,
                  align: "center",
                  title: "成功",
                  render: (_, row) => row.summary?.succeeded ?? 0,
                },
                {
                  width: 70,
                  align: "center",
                  title: "失败",
                  render: (_, row) => row.summary?.failed ?? 0,
                },
                {
                  width: 170,
                  align: "center",
                  title: "创建时间",
                  dataIndex: "createTime",
                  render: formatPluginTime,
                },
                {
                  width: 70,
                  align: "center",
                  title: "操作",
                  render: (_, row) => (
                    <TableAction
                      iconOnly
                      symbol="View"
                      aria-label="审计详情"
                      tooltip="详情"
                      onClick={() =>
                        getPluginOperationLog(row.operationId)
                          .then((result) =>
                            setDetail(normalizePluginOperationLogDetail(result.data)),
                          )
                          .catch(() => {})
                      }
                    >
                      详情
                    </TableAction>
                  ),
                },
              ]}
            />
            <Pagination
              total={data.total}
              page={query.pageNum}
              limit={query.pageSize}
              onChange={(page) => setQuery({ ...query, ...page })}
            />
          </div>
          <div className="plugin-audit-footer">
            <Button onClick={onClose}>关闭</Button>
          </div>
        </div>
      </Drawer>
      <Modal
        className="plugin-dialog plugin-result-dialog plugin-audit-detail"
        title="审计详情"
        open={!!detail}
        width="min(920px, calc(100vw - 32px))"
        onCancel={() => setDetail(undefined)}
        footer={<Button onClick={() => setDetail(undefined)}>关闭</Button>}
      >
        {detail && (
          <>
            <Descriptions
              bordered
              column={3}
              className="plugin-audit-description"
              items={[
                ["日志ID", detail.operationId || "-"],
                ["操作", operation(detail.operation)],
                ["状态", getOperationLogStatusLabel(detail.status)],
                ["预演", detail.dryRun ? "是" : "否"],
                ["失败后继续", detail.continueOnError ? "是" : "否"],
                ["创建时间", formatPluginTime(detail.createTime)],
                ["插件", formatPlanDependencies(detail.pluginIds), 3],
                ["备注", detail.remark || "-", 3],
              ].map(([label, children, span]) => ({ key: label, label, children, span }))}
            />
            <Tabs
              items={[
                {
                  key: "summary",
                  label: "摘要",
                  children: (
                    <Descriptions
                      bordered
                      column={3}
                      className="plugin-audit-description"
                      items={[
                        ["成功数", detail.summary?.succeeded ?? 0],
                        ["失败数", detail.summary?.failed ?? 0],
                        ["跳过数", detail.summary?.skipped ?? 0],
                        ["变更配置", formatPlanDependencies(detail.summary?.changedKeys), 3],
                        ["失败建议", detail.failedSuggestion || "暂无", 3],
                        [
                          "失败步骤",
                          detail.failedStep ||
                            detail.result?.failedStep ||
                            detail.result?.failed?.result?.failedStep ||
                            "暂无",
                          3,
                        ],
                      ].map(([label, children, span]) => ({
                        key: label,
                        label,
                        children,
                        span,
                      }))}
                    />
                  ),
                },
                {
                  key: "validation",
                  label: "检查结果",
                  children: table(
                    detail.validationItems,
                    [
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
                      { width: 180, title: "类型", dataIndex: "kind", ellipsis: true },
                      { width: 180, title: "对象", dataIndex: "value", ellipsis: true },
                      { title: "说明", dataIndex: "message", ellipsis: true },
                    ],
                    "暂无检查结果",
                    790,
                  ),
                },
                {
                  key: "actions",
                  label: "动作计划",
                  children: table(
                    detail.actionItems,
                    [
                      { title: "动作", dataIndex: "label", ellipsis: true },
                      {
                        width: 80,
                        align: "center",
                        title: "启用",
                        dataIndex: "enabled",
                        render: (value) => (
                          <PluginTag type={value ? "success" : "info"}>
                            {value ? "是" : "否"}
                          </PluginTag>
                        ),
                      },
                      {
                        width: 80,
                        align: "center",
                        title: "数量",
                        dataIndex: "count",
                        render: (value) => value ?? "-",
                      },
                      {
                        title: "状态",
                        ellipsis: true,
                        render: (_, row) => formatActionPlanState(row),
                      },
                    ],
                    "暂无动作计划",
                    500,
                  ),
                },
                {
                  key: "plan",
                  label: "依赖计划",
                  children: table(
                    detail.planItems,
                    [
                      { width: 150, title: "插件ID", dataIndex: "pluginId", ellipsis: true },
                      { width: 110, align: "center", title: "版本", dataIndex: "version" },
                      {
                        width: 90,
                        align: "center",
                        title: "就绪",
                        dataIndex: "ready",
                        render: (value) => (
                          <PluginTag type={value ? "success" : "danger"}>
                            {value ? "是" : "否"}
                          </PluginTag>
                        ),
                      },
                      {
                        title: "依赖",
                        dataIndex: "dependencies",
                        ellipsis: true,
                        render: formatPlanDependencies,
                      },
                    ],
                    "暂无依赖计划",
                    550,
                  ),
                },
                {
                  key: "executed",
                  label: "执行记录",
                  children: table(
                    detail.executed,
                    [
                      { width: 140, title: "插件ID", dataIndex: "pluginId", ellipsis: true },
                      {
                        width: 90,
                        align: "center",
                        title: "操作",
                        dataIndex: "operation",
                        render: operation,
                      },
                      {
                        width: 90,
                        align: "center",
                        title: "状态",
                        render: (_, row) => (
                          <PluginTag type={row.ok ? "success" : "danger"}>
                            {row.status || "-"}
                          </PluginTag>
                        ),
                      },
                      {
                        width: 90,
                        align: "center",
                        title: "耗时",
                        dataIndex: "durationMs",
                        render: (value) => `${value ?? "-"}ms`,
                      },
                      {
                        width: 150,
                        title: "失败步骤",
                        ellipsis: true,
                        render: (_, row) => row.failedStep || row.result?.failedStep || "-",
                      },
                      { width: 220, title: "说明", dataIndex: "message", ellipsis: true },
                      { width: 260, title: "建议", dataIndex: "suggestion", ellipsis: true },
                    ],
                    "暂无执行记录",
                    1040,
                  ),
                },
                {
                  key: "config",
                  label: "配置变更",
                  children: table(
                    detail.configChanges,
                    [
                      { width: 180, title: "配置键", dataIndex: "key", ellipsis: true },
                      { width: 160, title: "名称", dataIndex: "label", ellipsis: true },
                      {
                        width: 80,
                        align: "center",
                        title: "敏感",
                        dataIndex: "secret",
                        render: (value) => (
                          <PluginTag type={value ? "warning" : "info"}>
                            {value ? "是" : "否"}
                          </PluginTag>
                        ),
                      },
                      {
                        title: "变更前",
                        ellipsis: true,
                        render: (_, row) =>
                          row.secret
                            ? "******"
                            : typeof row.before === "object"
                              ? JSON.stringify(row.before)
                              : row.before,
                      },
                      {
                        title: "变更后",
                        ellipsis: true,
                        render: (_, row) =>
                          row.secret
                            ? "******"
                            : typeof row.after === "object"
                              ? JSON.stringify(row.after)
                              : row.after,
                      },
                    ],
                    "暂无配置变更",
                    780,
                  ),
                },
                {
                  key: "raw",
                  label: "原始结果",
                  children: <Input.TextArea rows={14} value={formatJson(detail.result)} readOnly />,
                },
              ]}
            />
          </>
        )}
      </Modal>
    </>
  );
}
