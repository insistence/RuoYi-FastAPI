import "./style.css";
import { renderDialogFooter } from "@/components/DialogFooter";
import { useEffect, useState } from "react";
import { Form, Input, Modal, Select } from "antd";
import { createTable } from "@/api/tool/gen";
import { message } from "@/plugins/modal";
export default function CreateTable({ open, dataSources, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open)
      form.setFieldValue(
        "dataSourceName",
        (dataSources.find((s) => s.isDefault) || dataSources[0])?.name,
      );
  }, [open]);
  async function submit() {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await createTable(values);
      message.success("创建成功");
      form.resetFields();
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
      title="创建表"
      style={{ top: "6vh" }}
      open={open}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      width={800}
      forceRender
    >
      <Form
        name="src-views-tool-gen-createTable-jsx-editor-23"
        className="ruoyi-dialog-form"
        colon={false}
        wrapperCol={{ flex: "1 1 0" }}
        labelCol={{ flex: "80px" }}
        form={form}
        layout="horizontal"
      >
        <Form.Item
          label="数据源"
          name="dataSourceName"
          rules={[{ required: true, message: "请选择数据源" }]}
        >
          <Select
            placeholder="请选择数据源"
            style={{ width: 260 }}
            showSearch
            optionFilterProp="label"
            options={dataSources.map((s) => ({
              label: `${s.name}（${s.dbType}）`,
              value: s.name,
            }))}
          />
        </Form.Item>
        <Form.Item
          label="创建表语句(支持多个建表语句)："
          className="gen-sql-field"
          layout="vertical"
          labelCol={{ flex: "none" }}
          wrapperCol={{ flex: "none" }}
          name="sql"
          rules={[{ required: true, whitespace: true, message: "请输入建表语句" }]}
        >
          <Input.TextArea placeholder="请输入文本" rows={10} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
