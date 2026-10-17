import { App, Button, ColorPicker, Divider, Drawer, Radio, Switch, Tooltip } from "antd";
import { CheckOutlined, DownOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import useSettingsStore from "@/store/modules/settings";
import useTagsViewStore from "@/store/modules/tagsView";
import darkPreview from "@/assets/images/dark.svg";
import lightPreview from "@/assets/images/light.svg";

const colors = [
  "#409EFF",
  "#ff4500",
  "#ff8c00",
  "#ffd700",
  "#90ee90",
  "#00ced1",
  "#1e90ff",
  "#c71585",
];
const navigationModes = [
  [1, "左侧菜单", "left"],
  [2, "混合菜单", "mix"],
  [3, "顶部菜单", "top"],
];

export default function Settings({ open, onClose }) {
  const settings = useSettingsStore();
  const { message } = App.useApp();
  function switchRow(key, label, disabled = false) {
    return (
      <div className="layout-setting-row" key={key}>
        <span>{label}</span>
        <Switch
          aria-label={label}
          checked={settings[key]}
          disabled={disabled}
          onChange={(value) => settings.update({ [key]: value })}
        />
      </div>
    );
  }
  function save() {
    try {
      settings.save();
      useTagsViewStore.getState().persistViews();
      message.success("配置已保存到本地");
    } catch {
      message.error("保存失败，请检查浏览器存储是否可用");
    }
  }
  function reset() {
    settings.reset();
    useTagsViewStore.getState().reset();
    onClose();
    message.success("已恢复默认布局配置");
  }
  return (
    <Drawer
      size="300px"
      rootClassName="layout-settings"
      aria-label="布局设置"
      closable={false}
      open={open}
      onClose={onClose}
    >
      <h3 className="layout-settings-title">菜单导航设置</h3>
      <div className="layout-nav-options" role="group" aria-label="菜单导航设置">
        {navigationModes.map(([value, label, style]) => (
          <Tooltip title={label} placement="bottom" key={value}>
            <button
              type="button"
              className={`layout-nav-option ${style}`}
              aria-label={label}
              aria-pressed={settings.navType === value}
              onClick={() => settings.update({ navType: value })}
            >
              <b />
              <b />
            </button>
          </Tooltip>
        ))}
      </div>
      <h3 className="layout-settings-title">主题风格设置</h3>
      <div className="layout-theme-options" role="group" aria-label="主题风格设置">
        {[
          ["dark", "深色侧栏", darkPreview],
          ["light", "浅色侧栏", lightPreview],
        ].map(([value, label, image]) => (
          <button
            type="button"
            key={value}
            aria-label={label}
            aria-pressed={settings.sideTheme === value}
            className="layout-theme-option"
            onClick={() => settings.update({ sideTheme: value })}
          >
            <img src={image} alt="" />
            {settings.sideTheme === value && <CheckOutlined />}
          </button>
        ))}
      </div>
      <div className="layout-setting-row">
        <span>主题颜色</span>
        <ColorPicker
          value={settings.colorPrimary}
          presets={[{ label: "预设颜色", colors }]}
          disabledAlpha
          onChange={(color) => settings.update({ colorPrimary: color.toHexString() })}
        >
          <button type="button" className="layout-theme-color" aria-label="主题颜色">
            <span style={{ background: settings.colorPrimary }} />
            <DownOutlined />
          </button>
        </ColorPicker>
      </div>
      <Divider />
      <h3 className="layout-settings-title layout-settings-section">系统布局配置</h3>
      {switchRow("tagsView", "开启页签")}
      {switchRow("tagsViewPersist", "持久化标签页", !settings.tagsView)}
      {switchRow("tagsIcon", "显示页签图标", !settings.tagsView)}
      <div className="layout-setting-row">
        <span>标签页样式</span>
        <Radio.Group
          size="small"
          aria-label="标签页样式"
          optionType="button"
          buttonStyle="solid"
          value={settings.tagsViewStyle}
          disabled={!settings.tagsView}
          options={[
            { label: "卡片", value: "card" },
            { label: "谷歌", value: "chrome" },
          ]}
          onChange={(event) => settings.update({ tagsViewStyle: event.target.value })}
        />
      </div>
      {switchRow("fixedHeader", "固定 Header")}
      {switchRow("sidebarLogo", "显示 Logo")}
      {switchRow("dynamicTitle", "动态标题")}
      {switchRow("footerVisible", "底部版权")}
      <Divider />
      <div className="layout-settings-actions">
        <Button color="primary" variant="outlined" icon={<SaveOutlined />} onClick={save}>
          保存配置
        </Button>
        <Button icon={<ReloadOutlined />} onClick={reset}>
          重置配置
        </Button>
      </div>
    </Drawer>
  );
}
