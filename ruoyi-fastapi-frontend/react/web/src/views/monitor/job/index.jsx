import TableActions, { TableAction } from "@/components/TableActions";
import { renderDialogFooter } from "@/components/DialogFooter";
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UnorderedListOutlined,
  ProfileOutlined,
  QuestionCircleFilled,
} from "@ant-design/icons";
import "./style.css";
import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Tooltip,
} from "antd";
import Table from "@/components/Table";
import { useNavigate } from "react-router-dom";
import {
  listJob,
  getJob,
  addJob,
  updateJob,
  delJob,
  runJob,
  changeJobStatus,
} from "@/api/monitor/job";
import { useDict } from "@/utils/dict";
import { buildJobPayload, parseJobParameter, syncStates, notifyJobMutation } from "@/utils/job";
import { checkPermi } from "@/utils/permission";
import { download } from "@/utils/request";
import useUserStore from "@/store/modules/user";
import modal, { confirm, message } from "@/plugins/modal";
import HasPermi from "@/directive/permission/hasPermi";
import Pagination from "@/components/Pagination";
import RightToolbar from "@/components/RightToolbar";
import JsonEditor from "@/components/JsonEditor";
import Crontab from "@/components/Crontab";
import Detail from "./detail";
import Runtime, { StateTag } from "./runtime";

export default function Job() {
  const [zoneSearch, setZoneSearch] = useState("");
  const [queryForm] = Form.useForm(),
    [form] = Form.useForm(),
    navigate = useNavigate(),
    appTimezone = useUserStore((state) => state.appTimezone);
  const { sys_job_status, sys_job_executor, sys_job_store } = useDict(
    "sys_job_status",
    "sys_job_executor",
    "sys_job_store",
  );
  const [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [ids, setIds] = useState([]),
    [showSearch, setShowSearch] = useState(true);
  const [open, setOpen] = useState(false),
    [editingId, setEditingId] = useState(),
    [saving, setSaving] = useState(false),
    [busy, setBusy] = useState({}),
    [detail, setDetail] = useState(null),
    [runtime, setRuntime] = useState(null),
    [cron, setCron] = useState(false);
  const grace = Form.useWatch("misfireGraceTime", form),
    timezone = Form.useWatch("timeZone", form);
  const timezones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [appTimezone];
  function refresh() {
    setRevision((value) => value + 1);
  }
  useEffect(() => {
    let disposed = false,
      timer,
      controller,
      version = 0;
    async function load(silent = false) {
      clearTimeout(timer);
      controller?.abort();
      controller = new AbortController();
      const current = ++version;
      if (!silent) setLoading(true);
      let needsRefresh = false;
      try {
        const result = await listJob(query, {
          signal: controller.signal,
          skipErrorMessage: silent,
        });
        if (disposed || current !== version) return;
        setRows(result.rows || []);
        setTotal(result.total);
        needsRefresh = result.rows.some((row) => ["pending", "failed"].includes(row.syncStatus));
      } catch {
      } finally {
        if (!disposed && current === version) {
          setLoading(false);
          if (needsRefresh && !document.hidden) timer = setTimeout(() => load(true), 3000);
        }
      }
    }
    function visibility() {
      if (document.hidden) {
        version++;
        clearTimeout(timer);
        controller?.abort();
        setLoading(false);
      } else void load(true);
    }
    setIds([]);
    void load();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [query, revision]);
  function showRuntime(tab, row, executionId) {
    if (checkPermi(["monitor:job:query"]))
      setRuntime({ initialTab: tab, jobId: row?.jobId, executionId });
  }
  function mutation(result) {
    notifyJobMutation(modal, result);
    if (result.data?.syncStatus === "failed")
      showRuntime("sync", result.data.jobs?.length === 1 ? result.data.jobs[0] : undefined);
    refresh();
  }
  function add() {
    setEditingId(undefined);
    form.resetFields();
    form.setFieldsValue({
      jobGroup: "default",
      jobStore: "default",
      jobExecutor: "default",
      jobArgs: "[]",
      jobKwargs: "{}",
      timeZone: appTimezone,
      misfireGraceTime: 1,
      coalesce: false,
      maxInstances: 1,
      status: "1",
    });
    setOpen(true);
  }
  async function edit(id) {
    try {
      const result = await getJob(id);
      setEditingId(id);
      form.resetFields();
      form.setFieldsValue({
        ...result.data,
        jobArgs: JSON.stringify(result.data.jobArgs ?? [], null, 2),
        jobKwargs: JSON.stringify(result.data.jobKwargs ?? {}, null, 2),
      });
      setOpen(true);
    } catch {}
  }
  async function save() {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const result = await (editingId !== undefined ? updateJob : addJob)(
        buildJobPayload({
          ...values,
          ...(editingId !== undefined ? { jobId: editingId } : {}),
        }),
      );
      setOpen(false);
      mutation(result);
    } catch {
    } finally {
      setSaving(false);
    }
  }
  async function remove(values) {
    try {
      await confirm(`是否确认删除任务编号为“${values}”的数据项？`);
      mutation(await delJob(values));
    } catch {}
  }
  async function status(row, checked) {
    setBusy((previous) => ({ ...previous, [`status-${row.jobId}`]: true }));
    try {
      await confirm(`确认${checked ? "启用" : "暂停"}任务“${row.jobName}”？`);
      mutation(await changeJobStatus(row.jobId, checked ? "0" : "1"));
    } catch {
    } finally {
      setBusy((previous) => ({ ...previous, [`status-${row.jobId}`]: false }));
    }
  }
  async function run(row) {
    setBusy((previous) => ({ ...previous, [`run-${row.jobId}`]: true }));
    try {
      await confirm(`确认立即执行一次任务“${row.jobName}”？`);
      const result = await runJob(row.jobId);
      message.info(result.msg);
      showRuntime("executions", row, result.data?.executionId);
    } catch {
    } finally {
      setBusy((previous) => ({ ...previous, [`run-${row.jobId}`]: false }));
    }
  }
  async function view(row) {
    try {
      setDetail((await getJob(row.jobId)).data);
    } catch {}
  }
  const columns = [
    { align: "center", title: "任务编号", dataIndex: "jobId", width: 100 },
    {
      align: "center",
      title: "任务名称",
      dataIndex: "jobName",
      width: 160,
      render: (value, row) => (
        <Button type="link" onClick={() => view(row)} disabled={!checkPermi(["monitor:job:query"])}>
          {value}
        </Button>
      ),
    },
    ...[
      ["jobGroup", "业务分组"],
      ["invokeTarget", "调用目标字符串"],
      ["cronExpression", "cron执行表达式"],
      ["timeZone", "cron时区"],
    ].map(([dataIndex, title]) => ({
      align: "center",
      dataIndex,
      title,
      ellipsis: true,
      width: 180,
    })),
    {
      align: "center",
      title: "调度同步",
      dataIndex: "syncStatus",
      width: 115,
      render: (value, row) => (
        <Tooltip title={row.syncError}>
          <Button type="text" onClick={() => showRuntime("sync", row)}>
            <StateTag value={value} states={syncStates} />
          </Button>
        </Tooltip>
      ),
    },
    {
      align: "center",
      title: "状态",
      width: 85,
      render: (_, row) => (
        <Switch
          checked={row.status === "0"}
          aria-label={`任务 ${row.jobName} 的启停状态`}
          disabled={!checkPermi(["monitor:job:changeStatus"])}
          loading={busy[`status-${row.jobId}`]}
          onChange={(checked) => status(row, checked)}
        />
      ),
    },
    {
      className: "ruoyi-actions-cell",
      align: "center",
      title: "操作",
      fixed: "right",
      width: 200,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={["monitor:job:edit"]}>
            <TableAction iconOnly={true} symbol="Edit" onClick={() => edit(row.jobId)}>
              修改
            </TableAction>
          </HasPermi>
          <HasPermi value={["monitor:job:remove"]}>
            <TableAction iconOnly={true} symbol="Delete" onClick={() => remove([row.jobId])}>
              删除
            </TableAction>
          </HasPermi>
          <HasPermi value={["monitor:job:changeStatus"]}>
            <TableAction
              iconOnly={true}
              symbol="CaretRight"
              loading={busy[`run-${row.jobId}`]}
              onClick={() => run(row)}
            >
              执行一次
            </TableAction>
          </HasPermi>
          <HasPermi value={["monitor:job:query"]}>
            <TableAction
              iconOnly={true}
              symbol="Operation"
              onClick={() => navigate(`/monitor/job-log/index/${row.jobId}`)}
            >
              调度日志
            </TableAction>
          </HasPermi>
        </TableActions>
      ),
    },
  ];
  return (
    <div className="app-container job-page">
      {showSearch && (
        <Form
          form={queryForm}
          layout="inline"
          className="search-form"
          onFinish={(values) => setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })}
        >
          <Form.Item label="任务名称" name="jobName">
            <Input style={{ width: 200 }} placeholder="请输入任务名称" allowClear />
          </Form.Item>
          <Form.Item label="业务分组" name="jobGroup">
            <Input style={{ width: 200 }} placeholder="请输入业务分组" allowClear />
          </Form.Item>
          <Form.Item label="任务状态" name="status">
            <Select
              style={{ width: 200 }}
              placeholder="请选择任务状态"
              allowClear
              options={sys_job_status}
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
                  queryForm.resetFields();
                  setQuery({ pageNum: 1, pageSize: 10 });
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <HasPermi value={["monitor:job:add"]}>
          <Button
            icon={<PlusOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            onClick={add}
          >
            新增
          </Button>
        </HasPermi>
        <HasPermi value={["monitor:job:edit"]}>
          <Button
            icon={<EditOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--success"
            type="default"
            disabled={ids.length !== 1}
            onClick={() => edit(ids[0])}
          >
            修改
          </Button>
        </HasPermi>
        <HasPermi value={["monitor:job:remove"]}>
          <Button
            icon={<DeleteOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            disabled={!ids.length}
            onClick={() => remove(ids)}
          >
            删除
          </Button>
        </HasPermi>
        <HasPermi value={["monitor:job:export"]}>
          <Button
            icon={<DownloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={() =>
              download("/monitor/job/export", query, `job_${Date.now()}.xlsx`).catch(() => {})
            }
          >
            导出
          </Button>
        </HasPermi>
        <HasPermi value={["monitor:job:query"]}>
          <Button
            className="ruoyi-plain-button ruoyi-plain-button--info"
            icon={<UnorderedListOutlined />}
            onClick={() => navigate("/monitor/job-log/index/0")}
          >
            日志
          </Button>
          <Button
            className="ruoyi-plain-button ruoyi-plain-button--info"
            icon={<ProfileOutlined />}
            onClick={() => showRuntime("executions")}
          >
            运行记录
          </Button>
        </HasPermi>
        <RightToolbar showSearch={showSearch} onShowSearch={setShowSearch} onQuery={refresh} />
      </div>
      <Table
        rowKey="jobId"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ x: 1450 }}
        rowSelection={{ selectedRowKeys: ids, onChange: setIds }}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <Modal
        footer={renderDialogFooter}
        className="job-dialog"
        title={editingId !== undefined ? "修改任务" : "添加任务"}
        open={open}
        width="820px"
        onCancel={() => setOpen(false)}
        onOk={save}
        confirmLoading={saving}
        closable={!saving}
        keyboard={!saving}
        maskClosable={!saving}
        forceRender
      >
        <Form
          name="src-views-monitor-job-index-jsx-editor-2"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: "1 1 0" }}
          labelCol={{ flex: "120px" }}
          form={form}
          layout="horizontal"
        >
          <Form.Item
            label="任务名称"
            name="jobName"
            rules={[{ required: true, whitespace: true, message: "任务名称不能为空" }]}
          >
            <Input placeholder="同一业务分组内名称唯一" maxLength={64} />
          </Form.Item>
          <Row>
            <Col xs={24} sm={12}>
              <Form.Item
                label="业务分组"
                name="jobGroup"
                rules={[{ required: true, whitespace: true, message: "业务分组不能为空" }]}
              >
                <Input placeholder="例如 default、报表、文件维护" maxLength={64} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={
                  <span>
                    任务执行器{" "}
                    <Tooltip title="调用方法为异步函数时此选项无效">
                      <QuestionCircleFilled />
                    </Tooltip>
                  </span>
                }
                name="jobExecutor"
              >
                <Select placeholder="请选择任务执行器" options={sys_job_executor} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="调度存储"
            name="jobStore"
            rules={[{ required: true }]}
            extra="内存存储重启后重建计划；数据库和Redis可保留下次调度进度。"
          >
            <Select placeholder="请选择调度存储" options={sys_job_store} />
          </Form.Item>
          <Form.Item
            label={
              <span>
                调用方法{" "}
                <Tooltip title="调用示例：module_task.scheduler_test.job">
                  <QuestionCircleFilled />
                </Tooltip>
              </span>
            }
            name="invokeTarget"
            rules={[{ required: true, message: "调用目标不能为空" }]}
          >
            <Input placeholder="请输入调用目标字符串" />
          </Form.Item>
          {[
            ["jobArgs", "位置参数"],
            ["jobKwargs", "关键字参数"],
          ].map(([name, label]) => (
            <Form.Item
              key={name}
              label={label}
              name={name}
              extra={
                name === "jobArgs"
                  ? "无参数填写 []，数组内可使用字符串、数字、布尔值和对象。"
                  : "无参数填写 {}，属性名需与函数参数名一致。"
              }
              rules={[
                {
                  validator: (_, value) => {
                    try {
                      parseJobParameter(value, name);
                      return Promise.resolve();
                    } catch (error) {
                      return Promise.reject(error);
                    }
                  },
                },
              ]}
            >
              <JsonEditor
                aria-label={label}
                valueType={name === "jobArgs" ? "array" : "object"}
                validate={(value) => parseJobParameter(value, name)}
              />
            </Form.Item>
          ))}
          <Form.Item label="cron表达式" required>
            <Space.Compact style={{ width: "100%" }}>
              <Form.Item
                name="cronExpression"
                noStyle
                rules={[{ required: true, message: "Cron表达式不能为空" }]}
              >
                <Input placeholder="请输入cron执行表达式" />
              </Form.Item>
              <Button onClick={() => setCron(true)}>生成表达式</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="cron时区" name="timeZone" rules={[{ required: true }]}>
            <Select
              placeholder="选择IANA时区"
              showSearch
              onSearch={setZoneSearch}
              options={[
                ...new Set([appTimezone, ...timezones, timezone, zoneSearch].filter(Boolean)),
              ].map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
          {editingId !== undefined && (
            <Form.Item label="状态" name="status">
              <Radio.Group options={sys_job_status} />
            </Form.Item>
          )}
          <Form.Item
            label="允许延迟"
            extra="从计划时刻起计算，超过宽限时间则跳过本次定时执行；不限延迟时允许补跑过期计划。"
          >
            <Space size={10}>
              <Form.Item
                noStyle
                name="misfireGraceTime"
                rules={[
                  {
                    validator: (_, value) =>
                      value === null ||
                      (Number.isInteger(value) && value >= 1 && value <= 2147483647)
                        ? Promise.resolve()
                        : Promise.reject(new Error("允许延迟必须为正整数")),
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  max={2147483647}
                  precision={0}
                  aria-label="允许延迟秒数"
                  style={{ width: 150, display: grace === null ? "none" : undefined }}
                />
              </Form.Item>
              {grace !== null && <span className="field-unit">秒</span>}
              <Switch
                aria-label="是否不限延迟"
                checked={grace === null}
                onChange={(checked) => form.setFieldValue("misfireGraceTime", checked ? null : 1)}
              />
              <span>不限延迟</span>
            </Space>
          </Form.Item>
          <Form.Item
            label="积压处理"
            name="coalesce"
            extra="同次检查发现多个到期计划时采用此规则，仍受允许延迟限制。"
          >
            <Radio.Group
              optionType="button"
              options={[
                { label: "逐次执行", value: false },
                { label: "只执行最近一次", value: true },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="最大并发数"
            name="maxInstances"
            rules={[{ required: true, type: "number", min: 1 }]}
            extra="定时与手动执行共同遵守此上限；超限时跳过并记录原因，不排队等待。"
          >
            <InputNumber min={1} max={2147483647} precision={0} style={{ width: 150 }} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        className="cron-dialog"
        rootClassName="cron-dialog-root"
        title="Cron表达式生成器"
        open={cron}
        onCancel={() => setCron(false)}
        footer={null}
        width="50%"
        destroyOnHidden
      >
        {cron && (
          <Crontab
            expression={form.getFieldValue("cronExpression")}
            timeZone={timezone || appTimezone}
            onFill={(value) => form.setFieldValue("cronExpression", value)}
            onHide={() => setCron(false)}
          />
        )}
      </Modal>
      <Detail open={!!detail} row={detail || {}} onClose={() => setDetail(null)} />
      <Runtime
        open={!!runtime}
        {...runtime}
        onClose={() => setRuntime(null)}
        onSyncUpdated={refresh}
      />
    </div>
  );
}
