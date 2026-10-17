import defaultSettings from "@/settings";
import { useEffect, useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { UserOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { getCodeImg, register } from "@/api/login";
import { usePasswordRule } from "@/utils/passwordRule";
import { message } from "@/plugins/modal";

export default function Register() {
  const [form] = Form.useForm();
  const [captcha, setCaptcha] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function getCode() {
    try {
      setCaptcha(await getCodeImg());
      form.setFieldValue("code", "");
    } catch (error) {
      setError(error.message);
    }
  }
  useEffect(() => {
    void getCode();
  }, []);
  async function handleRegister(values) {
    if (!captcha?.registerEnabled) return;
    setLoading(true);
    setError("");
    try {
      await register({ ...values, uuid: captcha.uuid });
      message.success(`账号 ${values.username} 注册成功`);
      navigate("/login");
    } catch (error) {
      setError(error.message);
      void getCode();
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-card">
        <h1>{import.meta.env.VITE_APP_TITLE}</h1>
        {captcha && !captcha.registerEnabled && <Alert type="info" title="当前系统未开放注册" />}
        {error && <Alert type="error" title={error} />}
        <Form
          form={form}
          layout="vertical"
          size="large"
          onFinish={handleRegister}
          disabled={!captcha?.registerEnabled}
        >
          <Form.Item
            label="账号"
            name="username"
            rules={[
              { required: true, message: "请输入您的账号" },
              {
                min: 2,
                max: 20,
                message: "用户账号长度必须介于 2 和 20 之间",
              },
            ]}
          >
            <Input placeholder="账号" prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={usePasswordRule().registerPwdValidator}>
            <Input.Password
              placeholder="密码"
              prefix={<LockOutlined />}
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={["password"]}
            rules={[
              { required: true, message: "请再次输入您的密码" },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  value === getFieldValue("password")
                    ? Promise.resolve()
                    : Promise.reject(new Error("两次输入的密码不一致")),
              }),
            ]}
          >
            <Input.Password
              placeholder="确认密码"
              prefix={<LockOutlined />}
              autoComplete="new-password"
            />
          </Form.Item>
          {captcha?.captchaEnabled !== false && (
            <div className="captcha-row">
              <Form.Item
                name="code"
                label="验证码"
                rules={[{ required: true, message: "请输入验证码" }]}
              >
                <Input placeholder="验证码" prefix={<SafetyOutlined />} autoComplete="off" />
              </Form.Item>
              <button type="button" aria-label="刷新验证码" onClick={getCode}>
                {captcha?.img && (
                  <img alt="注册验证码" src={`data:image/gif;base64,${captcha.img}`} />
                )}
              </button>
            </div>
          )}
          <Form.Item className="login-submit">
            <Button type="primary" block htmlType="submit" loading={loading}>
              注册
            </Button>
            <div className="login-link">
              <Link to="/login">使用已有账户登录</Link>
            </div>
          </Form.Item>
        </Form>
      </section>
      <footer className="login-footer">{defaultSettings.footerContent}</footer>
    </main>
  );
}
