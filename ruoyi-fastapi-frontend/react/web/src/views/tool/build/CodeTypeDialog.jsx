import { useEffect } from "react";
import { Form, Input, Modal, Radio } from "antd";
export default function CodeTypeDialog({ open, onClose, onConfirm, showFileName }) {
  const [form] = Form.useForm();
  useEffect(() => {
    if (open) form.setFieldsValue({ type: "file", fileName: `form-${Date.now()}.jsx` });
  }, [open]);
  return (
    <Modal
      width="500px"
      title="选择生成类型"
      open={open}
      onCancel={onClose}
      onOk={() =>
        form
          .validateFields()
          .then(onConfirm)
          .catch(() => {})
      }
      forceRender
    >
      <Form
        name="src-views-tool-build-CodeTypeDialog-jsx-editor-21"
        className="ruoyi-dialog-form"
        colon={false}
        wrapperCol={{ flex: "1 1 0" }}
        labelCol={{ flex: "100px" }}
        form={form}
        layout="horizontal"
      >
        <Form.Item
          name="type"
          label="生成类型"
          rules={[{ required: true, message: "请选择生成类型" }]}
        >
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: "页面", value: "file" },
              { label: "弹窗", value: "dialog" },
            ]}
          />
        </Form.Item>
        {showFileName && (
          <Form.Item
            name="fileName"
            label="文件名"
            rules={[
              { required: true, message: "请输入文件名" },
              {
                pattern: /^[^\\/:*?"<>|]+\.jsx$/,
                message: "请输入合法的 .jsx 文件名",
              },
            ]}
          >
            <Input allowClear placeholder="请输入文件名" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
