import { useEffect, useState } from "react";
import { Alert, Button, Form, Input, Spin } from "antd";
import { getInteraction, submitInteractionPasswordChange } from "@/api/authCenter";
import { usePasswordRule } from "@/utils/passwordRule";
import {
  LockOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import AuthCenterShell from "./AuthCenterShell";
import { useInteractionContext } from "./useInteraction";
export default function ChangePassword() {
  const context = useInteractionContext();
  const [form] = Form.useForm();
  const { pwdChrType, infoPwdValidator } = usePasswordRule();
  const [interaction, setInteraction] = useState({});
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const password = Form.useWatch("newPassword", form) || "";
  const strength =
    password.length < 6
      ? 0
      : Math.min(
          3,
          1 +
            Number(password.length >= 10) +
            Number([/[A-Za-z]/, /\d/, /[^A-Za-z\d]/].filter((p) => p.test(password)).length >= 2),
        );
  useEffect(() => {
    let active = true;
    (async () => {
      if (!context.interactionId || !context.csrfToken())
        return context.fatal("认证请求不完整，请返回应用重新登录");
      try {
        const response = await getInteraction(context.interactionId, context.csrfToken());
        if (!active) return;
        setInteraction(response.data || {});
        if (response.data?.nextAction !== "changePassword")
          await context.goToAction(response.data?.nextAction);
      } catch (e) {
        if (active) context.fatal(e.message || "认证请求已失效");
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [context]);
  async function submit(values) {
    setSubmitting(true);
    setError("");
    try {
      const response = await submitInteractionPasswordChange(
        context.interactionId,
        context.csrfToken(),
        values,
      );
      form.resetFields();
      if (response.data?.nextAction === "redirect")
        await context.followServerRedirect(response.data.redirectUrl);
      else await context.goToAction(response.data?.nextAction);
    } catch (e) {
      form.setFieldValue("oldPassword", "");
      setError(e.message || "密码更新失败");
    } finally {
      setSubmitting(false);
    }
  }
  const policy = {
    0: "需要 6–20 个字符，不能包含 < > “ ” 单引号、反斜杠或竖线",
    1: "需要 6–20 位数字",
    2: "需要 6–20 个英文字母",
    3: "需要 6–20 个字符，并同时包含字母和数字",
    4: "需要 6–20 个字符，并同时包含字母、数字和特殊字符",
  }[pwdChrType];
  return (
    <AuthCenterShell
      steps={["保护账户", "确认权限"]}
      expiresIn={interaction.expiresIn}
      applicationName={interaction.client?.clientName}
      applicationId={interaction.client?.clientId}
    >
      <Spin spinning={initializing}>
        <div className="auth-password-flow">
          <p className="panel-kicker">账户保护</p>
          <h2>先设置新的登录密码</h2>
          <p className="panel-lead">
            检测到当前密码已过期或仍是初始密码。更新后才能继续访问{" "}
            <strong>{interaction.client?.clientName || "发起登录的应用"}</strong>。
          </p>
          <div className="security-impact">
            <ExclamationCircleOutlined />
            <span>
              <strong>更新后会保护整个账户</strong>
              <small>其他外部应用中的旧登录会话会退出，需要使用新密码重新登录。</small>
            </span>
          </div>
          {error && <Alert type="error" showIcon title={error} />}
          <Form
            form={form}
            layout="vertical"
            onFinish={submit}
            disabled={initializing || submitting}
          >
            <Form.Item
              label="当前密码"
              name="oldPassword"
              rules={[{ required: true, message: "请输入当前密码" }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="用于确认是你本人"
                size="large"
                autoComplete="current-password"
              />
            </Form.Item>
            <Form.Item
              label="新密码"
              name="newPassword"
              dependencies={["oldPassword"]}
              rules={[
                ...infoPwdValidator,
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    value && value === getFieldValue("oldPassword")
                      ? Promise.reject(new Error("新密码不能与当前密码相同"))
                      : Promise.resolve(),
                }),
              ]}
            >
              <Input.Password
                prefix={<KeyOutlined />}
                placeholder="输入新的登录密码"
                size="large"
                autoComplete="new-password"
              />
            </Form.Item>
            <div className="password-meter password-meter-after-field" aria-live="polite">
              <div className="meter-heading">
                <span>安全强度</span>
                <strong className={`is-${strength}`}>
                  {["尚未达到要求", "基础", "良好", "较强"][strength]}
                </strong>
              </div>
              <div className="meter-bars" aria-hidden>
                {[1, 2, 3].map((i) => (
                  <i key={i} className={i <= strength ? "active" : ""} />
                ))}
              </div>
              <small>{policy}</small>
            </div>
            <Form.Item
              label="再次输入新密码"
              name="confirmPassword"
              dependencies={["newPassword"]}
              rules={[
                { required: true, message: "请再次输入新密码" },
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    !value || value === getFieldValue("newPassword")
                      ? Promise.resolve()
                      : Promise.reject(new Error("两次输入的新密码不一致")),
                }),
              ]}
            >
              <Input.Password
                prefix={<CheckCircleOutlined />}
                placeholder="再次输入，避免输错"
                size="large"
                autoComplete="new-password"
              />
            </Form.Item>
            <Button
              className="primary-action"
              type="primary"
              size="large"
              htmlType="submit"
              loading={submitting}
              block
            >
              更新密码并继续
            </Button>
          </Form>
        </div>
      </Spin>
    </AuthCenterShell>
  );
}
