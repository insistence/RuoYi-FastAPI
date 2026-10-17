import { useEffect, useState } from "react";
import { Button, Form, Input, Radio, Space } from "antd";
import tab from "@/plugins/tab";
import { updateUserProfile } from "@/api/system/user";
import useUserStore from "@/store/modules/user";
import { message } from "@/plugins/modal";
export default function UserInfo({ user, onSaved }) {
  const [form] = Form.useForm(),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    form.setFieldsValue(user);
  }, [user]);
  async function submit(values) {
    setSaving(true);
    try {
      await updateUserProfile(values);
      useUserStore.setState({ nickName: values.nickName });
      message.success("修改成功");
      onSaved?.();
    } catch {
    } finally {
      setSaving(false);
    }
  }
  return (
    <Form
      form={form}
      className="profile-form"
      labelCol={{ flex: "80px" }}
      wrapperCol={{ flex: "auto" }}
      colon={false}
      onFinish={submit}
    >
      <Form.Item
        name="nickName"
        label="用户昵称"
        rules={[{ required: true, message: "用户昵称不能为空" }]}
      >
        <Input maxLength={30} />
      </Form.Item>
      <Form.Item
        name="phonenumber"
        label="手机号码"
        rules={[
          { required: true, message: "手机号码不能为空" },
          { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的手机号码" },
        ]}
      >
        <Input maxLength={11} />
      </Form.Item>
      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: "邮箱地址不能为空" },
          { type: "email", message: "请输入正确的邮箱地址" },
        ]}
      >
        <Input maxLength={50} />
      </Form.Item>
      <Form.Item name="sex" label="性别">
        <Radio.Group
          options={[
            { label: "男", value: "0" },
            { label: "女", value: "1" },
          ]}
        />
      </Form.Item>
      <Form.Item className="profile-form-actions">
        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存
          </Button>
          <Button type="primary" danger onClick={() => tab.closePage()}>
            关闭
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
