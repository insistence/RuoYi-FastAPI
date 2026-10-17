import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import "./style.css";
import { useEffect, useState } from "react";
import { Button, Descriptions, Drawer, Empty, Modal, Form, Input, Select, Space } from "antd";
import Table from "@/components/Table";
import { listFileAccessLog } from "@/api/system/file";
import { BusinessDateTimeRangePicker } from "@/components/BusinessDateTimePicker";
import Pagination from "@/components/Pagination";
import { serializeTimeFieldsForSubmit } from "@/utils/time";
import { parseTime } from "@/utils/ruoyi";
import { formatFileSize, parseOperationDetail } from "./fileFormatters";
import { TableAction } from "@/components/TableActions";
import FileTag from "./FileTag";

const actions = {
  upload: "上传",
  download: "下载",
  acl_update: "授权变更",
  transfer: "归属转移",
  delete: "移入回收站",
  restore: "恢复",
  purge: "永久清理",
  reconcile: "存储对账",
  retention_extend: "保留延期",
  retention_dispose: "到期处置",
};
const results = {
  allowed: "已授权",
  denied: "已拒绝",
  completed: "已完成",
  failed: "失败",
};
export default function FileAuditDrawer({ file, onClose }) {
  const [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [data, setData] = useState({ rows: [], total: 0 }),
    [loading, setLoading] = useState(false),
    [detail, setDetail] = useState();
  useEffect(() => {
    if (!file) return;
    form.resetFields();
    setQuery({ pageNum: 1, pageSize: 10 });
    setDetail(undefined);
  }, [file, form]);
  useEffect(() => {
    if (!file) return;
    let active = true;
    setLoading(true);
    listFileAccessLog(file.fileId, query)
      .then((result) => active && setData(result))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [file, query]);
  const columns = [
    {
      width: 105,
      align: "center",
      title: "操作",
      dataIndex: "action",
      render: (value) => actions[value] || value,
    },
    {
      width: 100,
      align: "center",
      title: "结果",
      dataIndex: "result",
      render: (value) => (
        <FileTag type={["denied", "failed"].includes(value) ? "danger" : "success"}>
          {results[value] || value}
        </FileTag>
      ),
    },
    { width: 120, align: "center", title: "操作用户", dataIndex: "actorName", ellipsis: true },
    { width: 140, align: "center", title: "客户端地址", dataIndex: "ipAddress", ellipsis: true },
    {
      width: 110,
      align: "right",
      title: "传输字节",
      dataIndex: "bytesSent",
      render: (value) => (value ? formatFileSize(value) : "-"),
    },
    { width: 140, title: "失败原因", dataIndex: "errorMessage", ellipsis: true },
    {
      align: "center",
      title: "访问时间",
      width: 180,
      dataIndex: "accessTime",
      render: (value) => parseTime(value),
    },
    {
      width: 70,
      align: "center",
      title: "详情",
      render: (_, row) => (
        <TableAction iconOnly symbol="View" onClick={() => setDetail(row)}>
          查看审计详情
        </TableAction>
      ),
    },
  ];
  return (
    <>
      <Drawer
        rootClassName="file-drawer"
        title={`文件审计 - ${file?.originalName || ""}`}
        open={!!file}
        onClose={onClose}
        size="80%"
        afterOpenChange={(open) => !open && setDetail(undefined)}
        footer={
          <div style={{ textAlign: "right" }}>
            <Button onClick={onClose}>关 闭</Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="inline"
          onFinish={async (values) => {
            try {
              const payload = await serializeTimeFieldsForSubmit(
                {
                  action: values.action,
                  result: values.result,
                  actorName: values.actorName,
                  beginTime: values.dateRange?.[0],
                  endTime: values.dateRange?.[1],
                },
                ["beginTime", "endTime"],
              );
              if (payload) setQuery({ ...query, ...payload, pageNum: 1 });
            } catch {}
          }}
          className="search-form"
          colon={false}
          labelCol={{ flex: "68px" }}
        >
          <Form.Item name="action" label="操作类型">
            <Select
              placeholder="全部操作"
              allowClear
              style={{ width: 200 }}
              options={Object.entries(actions).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item name="result" label="操作结果">
            <Select
              placeholder="全部结果"
              allowClear
              style={{ width: 200 }}
              options={Object.entries(results).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item name="actorName" label="操作用户">
            <Input style={{ width: 200 }} placeholder="请输入用户名" allowClear />
          </Form.Item>
          <Form.Item name="dateRange" label="操作时间">
            <BusinessDateTimeRangePicker style={{ width: 200 }} separator="-" />
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
        <Table
          rowKey="auditId"
          loading={loading}
          dataSource={data.rows}
          columns={columns}
          pagination={false}
          scroll={{ x: 1100 }}
        />
        <Pagination
          total={data.total}
          page={query.pageNum}
          limit={query.pageSize}
          onChange={(page) => setQuery({ ...query, ...page })}
        />
      </Drawer>
      <Modal
        className="file-dialog file-audit-detail"
        title="审计详情"
        open={!!detail}
        onCancel={() => setDetail(undefined)}
        width={720}
        footer={<Button onClick={() => setDetail(undefined)}>关 闭</Button>}
      >
        <Descriptions
          styles={{ label: { width: 110 } }}
          bordered
          column={2}
          items={
            detail
              ? [
                  {
                    key: "action",
                    label: "操作类型",
                    children: actions[detail.action] || detail.action,
                  },
                  {
                    key: "result",
                    label: "操作结果",
                    children: results[detail.result] || detail.result,
                  },
                  { key: "actorName", label: "操作用户", children: detail.actorName || "-" },
                  { key: "ipAddress", label: "客户端地址", children: detail.ipAddress || "-" },
                  { key: "requestId", label: "请求ID", children: detail.requestId || "-" },
                  { key: "traceId", label: "链路ID", children: detail.traceId || "-" },
                  {
                    key: "accessTime",
                    label: "操作时间",
                    span: 2,
                    children: parseTime(detail.accessTime) || "-",
                  },
                  {
                    key: "userAgent",
                    label: "用户代理",
                    span: 2,
                    children: detail.userAgent || "-",
                  },
                  {
                    key: "errorMessage",
                    label: "失败原因",
                    span: 2,
                    children: detail.errorMessage || "-",
                  },
                ]
              : []
          }
        />
        {parseOperationDetail(detail?.operationDetail).length ? (
          <Table
            className="mt20"
            bordered
            pagination={false}
            rowKey="label"
            dataSource={parseOperationDetail(detail.operationDetail)}
            columns={[
              { title: "详情项", dataIndex: "label", width: 180 },
              { title: "内容", dataIndex: "value", ellipsis: true },
            ]}
          />
        ) : (
          <Empty description="无操作详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Modal>
    </>
  );
}
