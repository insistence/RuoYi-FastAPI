import "./style.css";
import { useEffect, useState } from "react";
import { Alert, Button, Form, Radio, Select } from "antd";
import { getTimezoneOptions, updateUserTimezone } from "@/api/system/user";
import {
  formatBusinessTime,
  getBusinessTimezone,
  getDeviceTimezone,
  getDisplayTimezone,
  getSupportedTimezones,
} from "@/utils/time";
import useUserStore from "@/store/modules/user";
import { message } from "@/plugins/modal";
export default function TimezoneSettings({ user, onSaved }) {
  const [mode, setMode] = useState(user.timeZone === "auto" ? "auto" : "custom"),
    [selectedZone, setSelectedZone] = useState(getDisplayTimezone());
  const [zones, setZones] = useState(getSupportedTimezones()),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [fieldError, setFieldError] = useState(""),
    [now, setNow] = useState(new Date());
  const deviceZone = getDeviceTimezone(),
    previewZone = mode === "auto" ? deviceZone || getBusinessTimezone() : selectedZone;
  async function loadOptions() {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await getTimezoneOptions();
      setZones(getSupportedTimezones(response.data));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadOptions();
  }, []);
  useEffect(() => {
    if (user.timeZone) {
      setMode(user.timeZone === "auto" ? "auto" : "custom");
      setSelectedZone(user.timeZone === "auto" ? getDisplayTimezone() : user.timeZone);
    }
  }, [user.timeZone]);
  async function save() {
    if (saving) return;
    if (mode === "custom" && !selectedZone) return setFieldError("请选择显示时区");
    setSaving(true);
    setError("");
    const preference = mode === "auto" ? "auto" : selectedZone;
    try {
      await updateUserTimezone(preference);
      useUserStore.getState().applyTimezone(preference);
      setNow(new Date());
      onSaved?.(preference);
      message.success("时区设置已保存");
    } catch (error) {
      setError(error.message || "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Form layout="vertical" onFinish={save} className="timezone-settings">
      <Form.Item label="时间显示方式">
        <Radio.Group
          aria-label="时间显示方式"
          disabled={saving}
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          options={[
            { value: "auto", label: "自动跟随设备" },
            { value: "custom", label: "手动选择" },
          ]}
        />
      </Form.Item>
      {mode === "custom" && (
        <Form.Item
          label="显示时区"
          validateStatus={fieldError ? "error" : undefined}
          help={fieldError || undefined}
        >
          <Select
            aria-label="显示时区"
            placeholder="搜索时区，例如 Asia/Shanghai"
            showSearch
            value={selectedZone}
            loading={loading}
            disabled={saving}
            options={zones.map((value) => ({ label: value, value }))}
            onChange={(value) => {
              setSelectedZone(value);
              setFieldError("");
            }}
          />
        </Form.Item>
      )}
      {loadError && (
        <Alert
          className="timezone-settings-notice"
          type="warning"
          title="时区列表加载失败，仍可使用当前时区。"
          action={
            <Button
              className="ruoyi-table-action"
              type="link"
              loading={loading}
              onClick={loadOptions}
            >
              重试
            </Button>
          }
        />
      )}
      <div className="timezone-preview" aria-live="polite">
        <div>
          预览时区：<strong>{previewZone}</strong>
        </div>
        <div>
          时间预览：
          {formatBusinessTime(now, "YYYY-MM-DD HH:mm:ss", previewZone)}
        </div>
        {mode === "auto" && !deviceZone && (
          <div className="timezone-settings-fallback">
            当前设备无法识别时区，已使用系统时区；你也可以手动选择。
          </div>
        )}
      </div>
      <p className="timezone-settings-hint">
        用于时间显示、日期筛选和导出。定时任务和业务统计使用各自配置的时区。
      </p>
      {error && (
        <p role="alert" className="timezone-settings-error">
          {error}
        </p>
      )}
      <Button type="primary" htmlType="submit" loading={saving}>
        保存时区
      </Button>
    </Form>
  );
}
