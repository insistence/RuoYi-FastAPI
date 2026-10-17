import FileTag from "./FileTag";
import { TableAction } from "@/components/TableActions";
import "./style.css";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Drawer, Empty, Select, Space, Switch, Tooltip, TreeSelect } from "antd";
import Table from "@/components/Table";
import { PlusOutlined } from "@ant-design/icons";
import {
  batchSaveFileAcl,
  getFileAclDeptTree,
  listFileAcl,
  saveFileAcl,
  searchFileAclSubjects,
} from "@/api/system/file";
import BusinessDateTimePicker from "@/components/BusinessDateTimePicker";
import { prepareTimeFields, serializeTimeFieldsForSubmit } from "@/utils/time";
import { confirm, message } from "@/plugins/modal";

export default function FileAclDrawer({ files, batch = false, onClose, onSuccess }) {
  const [entries, setEntries] = useState([]),
    [builtin, setBuiltin] = useState([]),
    [departments, setDepartments] = useState([]),
    [version, setVersion] = useState(),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false);
  const sequence = useRef(0),
    subjectRequests = useRef(new Map());
  useEffect(() => {
    const current = ++sequence.current;
    subjectRequests.current.clear();
    setEntries([]);
    setBuiltin([]);
    setVersion(undefined);
    if (!files?.length) return;
    setLoading(true);
    Promise.all([
      getFileAclDeptTree(),
      batch ? Promise.resolve({ data: { entries: [] } }) : listFileAcl(files[0].fileId),
    ])
      .then(([dept, result]) => {
        if (current !== sequence.current) return;
        setDepartments(dept.data || []);
        setVersion(result.data.aclVersion);
        setBuiltin(result.data.builtinPermissions || []);
        setEntries(
          (result.data.entries || []).map((entry, index) => ({
            ...prepareTimeFields(entry, ["expireTime"]),
            key: index,
            subjectOptions: [
              { value: entry.subjectId, label: entry.subjectName || String(entry.subjectId) },
            ],
          })),
        );
      })
      .catch(() => {})
      .finally(() => current === sequence.current && setLoading(false));
    return () => {
      sequence.current++;
    };
  }, [files, batch]);
  function update(key, patch) {
    setEntries((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }
  async function search(row, keyword) {
    const requestId = (subjectRequests.current.get(row.key) || 0) + 1;
    subjectRequests.current.set(row.key, requestId);
    const current = sequence.current;
    const isCurrent = () =>
      current === sequence.current && subjectRequests.current.get(row.key) === requestId;
    update(row.key, { subjectLoading: true });
    try {
      const result = await searchFileAclSubjects({ subjectType: row.subjectType, keyword });
      if (isCurrent())
        update(row.key, {
          subjectOptions: (result.data || []).map((item) => ({
            value: item.subjectId,
            label: item.subjectName,
          })),
        });
    } finally {
      if (isCurrent()) update(row.key, { subjectLoading: false });
    }
  }
  function addEntry() {
    setEntries((rows) => [
      ...rows,
      {
        key: crypto.randomUUID(),
        subjectType: "user",
        effect: "allow",
        includeChildren: false,
        subjectOptions: [],
      },
    ]);
  }
  async function save() {
    if (entries.some((entry) => !entry.subjectId)) return message.warning("请选择完整的授权主体");
    setSaving(true);
    try {
      const payload = [];
      for (const entry of entries) {
        const value = await serializeTimeFieldsForSubmit(entry, ["expireTime"]);
        if (!value) return;
        payload.push({
          subjectType: value.subjectType,
          subjectId: value.subjectId,
          effect: value.effect,
          includeChildren: value.subjectType === "dept" && !!value.includeChildren,
          expireTime: value.expireTime || null,
        });
      }
      if (batch) {
        await confirm(`将覆盖所选${files.length}个文件的全部授权，是否继续?`);
        await batchSaveFileAcl({
          fileIds: files.map((file) => file.fileId).join(","),
          entries: payload,
        });
      } else {
        await saveFileAcl(files[0].fileId, { aclVersion: version, entries: payload });
      }
      message.success(batch ? "文件权限批量保存成功" : "文件权限保存成功");
      onSuccess();
      onClose();
    } catch {
    } finally {
      setSaving(false);
    }
  }
  return (
    <Drawer
      rootClassName="file-drawer file-acl-drawer"
      title={
        batch
          ? `批量授权 - ${files?.length || 0}个文件`
          : `访问权限 - ${files?.[0]?.originalName || ""}`
      }
      open={!!files?.length}
      onClose={onClose}
      placement="right"
      size="70%"
      mask={{ closable: !saving }}
      destroyOnHidden
      footer={
        <Space className="dialog-footer">
          <Button type="primary" loading={saving} disabled={loading} onClick={save}>
            保 存
          </Button>
          <Button onClick={onClose}>取 消</Button>
        </Space>
      }
    >
      <Alert
        showIcon
        type="info"
        className="mb8"
        title={
          batch
            ? "批量操作仅覆盖所选文件的显式授权；内置权限仍按各文件规则生效。"
            : "内置权限只读展示；管理员和所有者不可被拒绝，启用的上传人权限可被匹配的显式拒绝覆盖。"
        }
      />
      {!batch && (
        <section className="permission-section">
          <div className="permission-section__title">内置权限</div>
          <Table
            rowKey="source"
            loading={loading}
            dataSource={builtin}
            bordered
            pagination={false}
            scroll={{ x: 855 }}
            columns={[
              {
                title: "权限来源",
                align: "center",
                width: 110,
                dataIndex: "source",
                render: (source) => (
                  <FileTag
                    effect="plain"
                    type={{ admin: "danger", owner: "primary", uploader: "warning" }[source]}
                  >
                    {{ admin: "平台管理员", owner: "文件所有者", uploader: "文件上传人" }[source] ||
                      source}
                  </FileTag>
                ),
              },
              {
                title: "权限主体",
                align: "center",
                width: 180,
                render: (_, row) => row.subjectName || row.subjectId || "-",
              },
              {
                title: "规则",
                align: "center",
                width: 110,
                render: (_, row) => (
                  <FileTag effect="plain" type={row.enabled ? "success" : "info"}>
                    {row.enabled ? "允许下载" : "已移除"}
                  </FileTag>
                ),
              },
              {
                title: "拒绝覆盖",
                align: "center",
                width: 135,
                render: (_, row) =>
                  row.enabled ? (
                    <FileTag effect="plain" type={row.denyOverridable ? "warning" : "info"}>
                      {row.denyOverridable ? "可以覆盖" : "不可覆盖"}
                    </FileTag>
                  ) : (
                    "-"
                  ),
              },
              { width: 320, title: "权限说明", dataIndex: "description", ellipsis: true },
            ]}
          />
        </section>
      )}
      <div className="permission-section__header">
        <span className="permission-section__title">显式授权</span>
        <Button className="ruoyi-plain-button" icon={<PlusOutlined />} onClick={addEntry}>
          添加授权
        </Button>
      </div>
      <Table
        rowKey="key"
        loading={loading}
        dataSource={entries}
        pagination={false}
        locale={{ emptyText: <Empty description="暂无数据" /> }}
        scroll={{ x: 980 }}
        columns={[
          {
            title: "主体类型",
            align: "center",
            width: 125,
            render: (_, row) => (
              <Select
                style={{ width: "100%" }}
                value={row.subjectType}
                aria-label="主体类型"
                options={[
                  { value: "user", label: "用户" },
                  { value: "role", label: "角色" },
                  { value: "dept", label: "部门" },
                ]}
                onChange={(subjectType) => {
                  subjectRequests.current.set(
                    row.key,
                    (subjectRequests.current.get(row.key) || 0) + 1,
                  );
                  update(row.key, {
                    subjectType,
                    subjectId: undefined,
                    includeChildren: false,
                    subjectOptions: [],
                    subjectLoading: false,
                  });
                }}
              />
            ),
          },
          {
            title: "授权主体",
            align: "center",
            width: 230,
            render: (_, row) =>
              row.subjectType === "dept" ? (
                <TreeSelect
                  style={{ width: "100%" }}
                  value={row.subjectId}
                  treeData={departments}
                  fieldNames={{ value: "id", label: "label" }}
                  showSearch
                  treeNodeFilterProp="label"
                  allowClear
                  placeholder="请选择部门"
                  aria-label="授权部门"
                  onChange={(subjectId) => update(row.key, { subjectId })}
                />
              ) : (
                <Select
                  style={{ width: "100%" }}
                  allowClear
                  placeholder="输入名称搜索"
                  aria-label="授权主体"
                  loading={row.subjectLoading}
                  showSearch={{
                    filterOption: false,
                    onSearch: (keyword) => search(row, keyword).catch(() => {}),
                  }}
                  value={row.subjectId}
                  options={row.subjectOptions}
                  onOpenChange={(open) =>
                    open && !row.subjectOptions.length && search(row, "").catch(() => {})
                  }
                  onChange={(subjectId) => update(row.key, { subjectId })}
                />
              ),
          },
          {
            title: "规则",
            align: "center",
            width: 120,
            render: (_, row) => (
              <Select
                style={{ width: "100%" }}
                value={row.effect}
                aria-label="授权规则"
                options={[
                  { value: "allow", label: "允许下载" },
                  { value: "deny", label: "拒绝下载" },
                ]}
                onChange={(effect) => update(row.key, { effect })}
              />
            ),
          },
          {
            title: "包含下级部门",
            align: "center",
            width: 125,
            render: (_, row) =>
              row.subjectType === "dept" ? (
                <Switch
                  aria-label="包含下级部门"
                  checked={row.includeChildren}
                  onChange={(includeChildren) => update(row.key, { includeChildren })}
                />
              ) : (
                "-"
              ),
          },
          {
            title: "有效期至",
            align: "center",
            width: 310,
            render: (_, row) => (
              <BusinessDateTimePicker
                value={row.expireTime}
                label="有效期至，留空为永久有效"
                onChange={(expireTime) => update(row.key, { expireTime })}
              />
            ),
          },
          {
            className: "ruoyi-actions-cell",
            title: "操作",
            align: "center",
            width: 70,
            render: (_, row) => (
              <Tooltip title="删除">
                <TableAction
                  iconOnly={true}
                  tone="danger"
                  symbol="Delete"
                  aria-label="删除授权"
                  onClick={() =>
                    setEntries((rows) => rows.filter((entry) => entry.key !== row.key))
                  }
                />
              </Tooltip>
            ),
          },
        ]}
      />
    </Drawer>
  );
}
