import "@/components/OAuthWorkspace/entities.css";
import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, Form, Input, Modal, Space } from "antd";
import { message } from "@/plugins/modal";
import FieldLabel from "@/components/OAuthWorkspace/FieldLabel";

export default function SecretDialog({ open, secret = {}, onClose }) {
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(secret.clientSecret);
      message.success("密钥已复制");
    } catch {
      message.error("浏览器拒绝访问剪贴板，请手动复制");
    }
  }
  return (
    <Modal
      className="oauth-dialog oauth-secret-dialog"
      title="保存应用密钥"
      open={open}
      width="min(680px, calc(100vw - 48px))"
      maskClosable={false}
      onCancel={onClose}
      footer={
        <Button type="primary" disabled={!confirmed} onClick={onClose}>
          完成
        </Button>
      }
    >
      <Space orientation="vertical" style={{ width: "100%" }} size="middle">
        <Alert type="warning" title="应用密钥只显示这一次，请保存在安全的密钥管理系统中。" />
        <Form
          name="src-views-system-oauth-client-secret-jsx-editor-14"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: "1 1 0" }}
          labelCol={{ flex: "160px" }}
          layout="horizontal"
        >
          <Form.Item
            label={
              <FieldLabel label="应用编号" help="系统生成的应用编号，复制后用于配置外部应用。" />
            }
          >
            <Input readOnly value={secret.clientId || ""} />
          </Form.Item>
          <Form.Item
            label={
              <FieldLabel
                label="应用密钥"
                help="应用密钥相当于应用密码，只显示这一次；请复制后保存在安全的密钥管理系统中。"
              />
            }
          >
            <Space.Compact style={{ width: "100%" }}>
              <Input readOnly value={secret.clientSecret || ""} />
              <Button onClick={copy}>复制</Button>
            </Space.Compact>
          </Form.Item>
        </Form>
        <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}>
          我已将密钥保存到安全位置
        </Checkbox>
      </Space>
    </Modal>
  );
}
