import TableActions, { TableAction } from "@/components/TableActions";
import { SearchOutlined, ReloadOutlined, CheckOutlined } from "@ant-design/icons";
import FileTag from "./FileTag";
import { renderDialogFooter } from "@/components/DialogFooter";
import { useEffect, useState } from "react";
import { Alert, Button, Drawer, Form, Input, Modal, Select, Space } from "antd";
import Table from "@/components/Table";
import {
  disposeExpiredFile,
  extendFileRetention,
  listFileRetentionReminder,
  readFileRetentionReminder,
  scanFileRetentionReminder,
} from "@/api/system/file";
import BusinessDateTimePicker from "@/components/BusinessDateTimePicker";
import Pagination from "@/components/Pagination";
import HasPermi from "@/directive/permission/hasPermi";
import { serializeTimeFieldsForSubmit, toBusinessDateTimeInput } from "@/utils/time";
import { parseTime } from "@/utils/ruoyi";
import { message } from "@/plugins/modal";

export default function FileRetentionReminderDrawer({ open, onClose, onSuccess }) {
  const [form] = Form.useForm(),
    [actionForm] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10, status: "0" }),
    [data, setData] = useState({ rows: [], total: 0 }),
    [loading, setLoading] = useState(false),
    [scanning, setScanning] = useState(false),
    [selected, setSelected] = useState([]),
    [action, setAction] = useState(),
    [saving, setSaving] = useState(false),
    [revision, setRevision] = useState(0);
  const refresh = () => {
    setSelected([]);
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    listFileRetentionReminder(query)
      .then((result) => active && setData(result))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, query, revision]);
  function openAction(type, row) {
    setAction({ type, row });
    actionForm.resetFields();
    if (type === "extend")
      actionForm.setFieldValue(
        "expireTime",
        toBusinessDateTimeInput(
          new Date(Math.max(Date.now(), new Date(row.expireTime).getTime()) + 30 * 86400000),
        ),
      );
  }
  async function submit() {
    const values = await actionForm.validateFields();
    const payload =
      action.type === "extend"
        ? await serializeTimeFieldsForSubmit(values, ["expireTime"])
        : values;
    if (!payload) return;
    setSaving(true);
    try {
      await (action.type === "extend" ? extendFileRetention : disposeExpiredFile)(
        action.row.noticeId,
        payload,
      );
      message.success(action.type === "extend" ? "文件保留期限已延长" : "到期文件已移入回收站");
      setAction(undefined);
      refresh();
      onSuccess();
    } catch {
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Drawer
        rootClassName="file-drawer"
        title="文件保留期限提醒"
        open={open}
        onClose={onClose}
        size="70%"
      >
        <Alert
          title="到期前可延长保留期限；到期后仅在全部业务引用均已到期时才可移入回收站，处置会解除这些业务引用。"
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
        />
        <Form
          form={form}
          initialValues={{ status: "0" }}
          layout="inline"
          className="search-form"
          colon={false}
          labelCol={{ flex: "68px" }}
          onFinish={(values) => {
            setQuery({ ...values, pageNum: 1, pageSize: query.pageSize });
            setSelected([]);
          }}
        >
          <Form.Item name="originalName" label="文件名称">
            <Input style={{ width: 200 }} placeholder="请输入原始文件名" allowClear />
          </Form.Item>
          <Form.Item name="noticeType" label="提醒类型">
            <Select
              placeholder="请选择提醒类型"
              allowClear
              style={{ width: 200 }}
              options={[
                { label: "即将到期", value: "expiring" },
                { label: "已到期", value: "expired" },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="提醒状态">
            <Select
              placeholder="请选择提醒状态"
              allowClear
              style={{ width: 200 }}
              options={[
                { label: "未读", value: "0" },
                { label: "已读", value: "1" },
              ]}
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
                  setQuery({ pageNum: 1, pageSize: 10, status: "0" });
                  setSelected([]);
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
        <Space size={10} style={{ marginBottom: 8 }}>
          <HasPermi value={["system:file:edit"]}>
            <Button
              className="ruoyi-plain-button"
              icon={<ReloadOutlined />}
              loading={scanning}
              onClick={async () => {
                setScanning(true);
                try {
                  const result = await scanFileRetentionReminder();
                  message.success(
                    `扫描完成，新增即将到期 ${result.data.expiringCount} 条、已到期 ${result.data.expiredCount} 条提醒`,
                  );
                  refresh();
                  onSuccess();
                } catch {
                } finally {
                  setScanning(false);
                }
              }}
            >
              扫描
            </Button>
          </HasPermi>
          <Button
            className="ruoyi-plain-button ruoyi-plain-button--success"
            icon={<CheckOutlined />}
            disabled={!selected.length}
            onClick={async () => {
              try {
                await readFileRetentionReminder(selected.join(","));
                message.success("提醒已标记为已读");
                refresh();
              } catch {}
            }}
          >
            已读
          </Button>
        </Space>
        <Table
          rowKey="noticeId"
          loading={loading}
          dataSource={data.rows}
          pagination={false}
          scroll={{ x: 1300 }}
          rowSelection={{
            columnWidth: 50,
            selectedRowKeys: selected,
            onChange: setSelected,
            getCheckboxProps: (row) => ({ disabled: row.status !== "0" }),
          }}
          columns={[
            { width: 180, title: "文件名称", dataIndex: "originalName", ellipsis: true },
            {
              width: 120,
              align: "center",
              title: "所有者",
              dataIndex: "ownerName",
              ellipsis: true,
              render: (value) => value || "-",
            },
            {
              width: 140,
              align: "center",
              title: "所属部门",
              dataIndex: "deptName",
              ellipsis: true,
              render: (value) => value || "-",
            },
            {
              align: "center",
              title: "提醒类型",
              width: 110,
              dataIndex: "noticeType",
              render: (value) => (
                <FileTag type={value === "expired" ? "danger" : "warning"}>
                  {value === "expired" ? "已到期" : "即将到期"}
                </FileTag>
              ),
            },
            {
              width: 180,
              align: "center",
              title: "到期时间",
              dataIndex: "expireTime",
              render: (value) => parseTime(value),
            },
            {
              width: 90,
              align: "center",
              title: "状态",
              dataIndex: "status",
              render: (value) => (
                <FileTag type={value === "0" ? "warning" : "success"}>
                  {value === "0" ? "未读" : "已读"}
                </FileTag>
              ),
            },
            { width: 90, align: "center", title: "业务引用", dataIndex: "referenceCount" },
            {
              width: 180,
              align: "center",
              title: "提醒时间",
              dataIndex: "createTime",
              render: (value) => parseTime(value),
            },
            {
              width: 110,
              align: "center",
              title: "读取人",
              dataIndex: "readBy",
              ellipsis: true,
              render: (value) => value || "-",
            },
            {
              className: "ruoyi-actions-cell",
              align: "center",
              title: "操作",
              fixed: "right",
              width: 100,
              render: (_, row) => (
                <TableActions>
                  <HasPermi value={["system:file:edit"]}>
                    <TableAction
                      iconOnly={true}
                      symbol="Clock"
                      onClick={() => openAction("extend", row)}
                    >
                      延长保留期限
                    </TableAction>
                  </HasPermi>
                  {new Date(row.expireTime).getTime() <= Date.now() && (
                    <HasPermi value={["system:file:remove"]}>
                      <TableAction
                        iconOnly={true}
                        tone="danger"
                        symbol="Delete"
                        disabled={!row.canDispose}
                        onClick={() => openAction("dispose", row)}
                      >
                        {row.canDispose ? "移入回收站" : "存在永久或尚未到期的业务引用，暂不可处置"}
                      </TableAction>
                    </HasPermi>
                  )}
                </TableActions>
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
      </Drawer>
      <Modal
        className="file-dialog"
        mask={{ closable: action?.type !== "dispose" }}
        okText={action?.type === "dispose" ? "确定处置" : "确 定"}
        footer={renderDialogFooter}
        width="520px"
        title={action?.type === "extend" ? "延长文件保留期限" : "到期文件处置"}
        open={!!action}
        onCancel={() => setAction(undefined)}
        onOk={submit}
        confirmLoading={saving}
      >
        {action?.type === "dispose" && (
          <Alert
            type="warning"
            showIcon
            title={`处置后“${action.row.originalName}”将移入回收站，并解除 ${action.row.referenceCount || 0} 条已到期业务引用。`}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form
          name="src-views-system-file-components-FileRetentionReminderDrawer-jsx-editor-9"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: "1 1 0" }}
          labelCol={{ flex: "92px" }}
          form={actionForm}
          layout="horizontal"
        >
          {action?.type === "extend" && (
            <>
              <Form.Item label="文件名称">{action.row.originalName}</Form.Item>
              <Form.Item label="原到期时间">{parseTime(action.row.expireTime)}</Form.Item>
            </>
          )}
          {action?.type === "extend" && (
            <Form.Item
              name="expireTime"
              label="新到期时间"
              rules={[{ required: true, message: "请选择新的到期时间" }]}
            >
              <BusinessDateTimePicker label="新到期时间" />
            </Form.Item>
          )}
          <Form.Item
            name="reason"
            label={action?.type === "extend" ? "延期原因" : "处置原因"}
            rules={[{ required: true, whitespace: true, message: "请输入操作原因" }]}
          >
            <Input.TextArea
              placeholder={action?.type === "extend" ? "请输入延期原因" : "请输入处置原因"}
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
