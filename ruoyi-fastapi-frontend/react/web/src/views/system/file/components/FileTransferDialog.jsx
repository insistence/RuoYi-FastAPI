import { renderDialogFooter } from "@/components/DialogFooter";
import "./style.css";
import { useEffect, useRef, useState } from "react";
import { Form, Input, Modal, Select, Switch, TreeSelect } from "antd";
import { getFileAclDeptTree, searchFileAclSubjects, transferFile } from "@/api/system/file";
import { message } from "@/plugins/modal";

export default function FileTransferDialog({ files, onClose, onSuccess }) {
  const [form] = Form.useForm(),
    [users, setUsers] = useState([]),
    [depts, setDepts] = useState([]),
    [searching, setSearching] = useState(false),
    [saving, setSaving] = useState(false),
    sequence = useRef(0);
  const retainUploaderAccess = Form.useWatch("retainUploaderAccess", form);
  async function search(keyword) {
    const version = ++sequence.current;
    setSearching(true);
    try {
      const result = await searchFileAclSubjects({
        subjectType: "user",
        keyword,
      });
      if (version === sequence.current) setUsers(result.data || []);
    } catch {
    } finally {
      if (version === sequence.current) setSearching(false);
    }
  }
  useEffect(() => {
    if (!files) return;
    form.resetFields();
    form.setFieldsValue({ retainUploaderAccess: true });
    void search("");
    getFileAclDeptTree()
      .then((result) => setDepts(result.data || []))
      .catch(() => {});
  }, [files, form]);
  async function save() {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await transferFile(
        files.map((row) => row.fileId),
        values,
      );
      message.success("文件转移成功");
      onClose();
      onSuccess();
    } catch {
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      footer={renderDialogFooter}
      width="620px"
      className="file-dialog "
      title={`转移文件 - ${files?.length === 1 ? files[0].originalName : `${files?.length || 0} 个文件`}`}
      open={!!files}
      onCancel={onClose}
      onOk={save}
      confirmLoading={saving}
      forceRender
    >
      <Form
        name="src-views-system-file-components-FileTransferDialog-jsx-editor-10"
        className="ruoyi-dialog-form"
        colon={false}
        wrapperCol={{ flex: "1 1 0" }}
        labelCol={{ flex: "100px" }}
        form={form}
        layout="horizontal"
      >
        <Form.Item
          name="ownerUserId"
          label="新所有者"
          rules={[{ required: true, message: "请选择新所有者" }]}
        >
          <Select
            allowClear
            placeholder="输入用户名称搜索"
            showSearch
            filterOption={false}
            loading={searching}
            onSearch={search}
            options={users.map((row) => ({
              value: row.subjectId,
              label: row.subjectName,
            }))}
            onChange={(id) => {
              const user = users.find((row) => row.subjectId === id);
              if (user?.deptId) form.setFieldValue("deptId", user.deptId);
            }}
          />
        </Form.Item>
        <Form.Item
          name="deptId"
          label="所属部门"
          rules={[{ required: true, message: "请选择所属部门" }]}
        >
          <TreeSelect
            allowClear
            placeholder="请选择所属部门"
            showSearch
            treeNodeFilterProp="label"
            treeData={depts}
            fieldNames={{ label: "label", value: "id", children: "children" }}
          />
        </Form.Item>
        <Form.Item label="上传人权限">
          <div className="file-transfer-permission">
            <span className={!retainUploaderAccess ? "is-active" : ""}>移除</span>
            <Form.Item name="retainUploaderAccess" valuePropName="checked" noStyle>
              <Switch aria-label="保留上传人权限" />
            </Form.Item>
            <span className={retainUploaderAccess ? "is-active" : ""}>保留</span>
          </div>
          <div className="file-form-tip">
            {retainUploaderAccess
              ? "原上传人继续拥有内置下载权限，匹配的显式拒绝仍可覆盖。"
              : "原上传人不再因上传身份获得下载权限，上传记录仍会保留。"}
          </div>
        </Form.Item>
        <Form.Item
          name="reason"
          label="转移原因"
          rules={[{ required: true, whitespace: true, message: "请输入转移原因" }]}
        >
          <Input.TextArea placeholder="请输入转移原因" rows={3} maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
