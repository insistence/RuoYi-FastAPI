import "./style.css";
import { Button, Form, Input, Modal, Space } from "antd";
import { useState } from "react";
import { PlusOutlined } from "@ant-design/icons";
const defaultLinks = ["一", "二", "三", "四", "五", "六"].map((number) => ({
  title: `操作${number}`,
  href: "",
}));
export default function EditableLinkGroup() {
  const [links, setLinks] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("react-dashboard-links"));
      return Array.isArray(saved) ? saved : defaultLinks;
    } catch {
      return defaultLinks;
    }
  });
  const [open, setOpen] = useState(false),
    [form] = Form.useForm();
  async function add() {
    try {
      const values = await form.validateFields();
      const next = [...links, values];
      setLinks(next);
      localStorage.setItem("react-dashboard-links", JSON.stringify(next));
      setOpen(false);
      form.resetFields();
    } catch {}
  }
  return (
    <>
      <div className="dashboard-links">
        {links.map((item, index) => (
          <a key={index} href={item.href} target="_blank" rel="noreferrer">
            {item.title}
          </a>
        ))}
        <Button
          size="small"
          type="primary"
          ghost
          icon={<PlusOutlined />}
          onClick={() => setOpen(true)}
        >
          添加
        </Button>
      </div>
      <Modal
        title="添加便捷导航"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={add}
        forceRender
      >
        <Form form={form} layout="vertical">
          <Form.Item label="名称" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="地址"
            name="href"
            rules={[
              { required: true },
              {
                pattern: /^(https?:\/\/|\/(?!\/))/,
                message: "请输入站内路径或 HTTP(S) 地址",
              },
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
