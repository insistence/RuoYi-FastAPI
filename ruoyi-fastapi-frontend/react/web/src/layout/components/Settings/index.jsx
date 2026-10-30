import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { App, Button, ColorPicker, Divider, Drawer, Radio, Switch, Tooltip } from 'antd'
import { CheckOutlined, DownOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import useSettingsStore from '@/store/modules/settings'
import useTagsViewStore from '@/store/modules/tagsView'
import darkPreview from '@/assets/images/dark.svg'
import lightPreview from '@/assets/images/light.svg'

const colors = [
  '#409EFF',
  '#ff4500',
  '#ff8c00',
  '#ffd700',
  '#90ee90',
  '#00ced1',
  '#1e90ff',
  '#c71585',
]
const navigationModes = () => [
  [1, t('layout:settings.sidebar'), 'left'],
  [2, t('layout:settings.mixed'), 'mix'],
  [3, t('layout:settings.top'), 'top'],
]

export default function Settings({ open, onClose }) {
  useI18n()

  const settings = useSettingsStore()
  const { message } = App.useApp()
  function switchRow(key, label, disabled = false) {
    return (
      <div
        className="layout-setting-row"
        key={key}
      >
        <span>{label}</span>
        <Switch
          aria-label={label}
          checked={settings[key]}
          disabled={disabled}
          onChange={(value) => settings.update({ [key]: value })}
        />
      </div>
    )
  }
  function save() {
    try {
      settings.save()
      useTagsViewStore.getState().persistViews()
      message.success(t('layout:settingsSavedLocally'))
    } catch {
      message.error(t('layout:saveFailedCheckBrowserStorageAvailability'))
    }
  }
  function reset() {
    settings.reset()
    useTagsViewStore.getState().reset()
    onClose()
    message.success(t('layout:defaultLayoutRestored'))
  }
  return (
    <Drawer
      size="300px"
      rootClassName="layout-settings"
      aria-label={t('layout:navbar.settings')}
      closable={false}
      open={open}
      onClose={onClose}
    >
      <h3 className="layout-settings-title">{t('layout:settings.navigation')}</h3>
      <div
        className="layout-nav-options"
        role="group"
        aria-label={t('layout:settings.navigation')}
      >
        {navigationModes().map(([value, label, style]) => (
          <Tooltip
            title={label}
            placement="bottom"
            key={value}
          >
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
      <h3 className="layout-settings-title">{t('layout:settings.theme')}</h3>
      <div
        className="layout-theme-options"
        role="group"
        aria-label={t('layout:settings.theme')}
      >
        {[
          ['dark', t('layout:darkSidebar'), darkPreview],
          ['light', t('layout:lightSidebar'), lightPreview],
        ].map(([value, label, image]) => (
          <button
            type="button"
            key={value}
            aria-label={label}
            aria-pressed={settings.sideTheme === value}
            className="layout-theme-option"
            onClick={() => settings.update({ sideTheme: value })}
          >
            <img
              src={image}
              alt=""
            />
            {settings.sideTheme === value && <CheckOutlined />}
          </button>
        ))}
      </div>
      <div className="layout-setting-row">
        <span>{t('layout:settings.color')}</span>
        <ColorPicker
          value={settings.colorPrimary}
          presets={[{ label: t('layout:presetColor'), colors }]}
          disabledAlpha
          onChange={(color) => settings.update({ colorPrimary: color.toHexString() })}
        >
          <button
            type="button"
            className="layout-theme-color"
            aria-label={t('layout:settings.color')}
          >
            <span style={{ background: settings.colorPrimary }} />
            <DownOutlined />
          </button>
        </ColorPicker>
      </div>
      <Divider />
      <h3 className="layout-settings-title layout-settings-section">
        {t('layout:settings.layout')}
      </h3>
      {switchRow('tagsView', t('layout:settings.tabs'))}
      {switchRow('tagsViewPersist', t('layout:settings.persistTabs'), !settings.tagsView)}
      {switchRow('tagsIcon', t('layout:settings.tabIcons'), !settings.tagsView)}
      <div className="layout-setting-row">
        <span>{t('layout:settings.tabStyle')}</span>
        <Radio.Group
          size="small"
          aria-label={t('layout:settings.tabStyle')}
          optionType="button"
          buttonStyle="solid"
          value={settings.tagsViewStyle}
          disabled={!settings.tagsView}
          options={[
            { label: t('layout:settings.card'), value: 'card' },
            { label: t('layout:settings.chrome'), value: 'chrome' },
          ]}
          onChange={(event) => settings.update({ tagsViewStyle: event.target.value })}
        />
      </div>
      {switchRow('fixedHeader', t('layout:settings.fixedHeader'))}
      {switchRow('sidebarLogo', t('layout:settings.logo'))}
      {switchRow('dynamicTitle', t('layout:settings.dynamicTitle'))}
      {switchRow('footerVisible', t('layout:settings.footer'))}
      <Divider />
      <div className="layout-settings-actions">
        <Button
          color="primary"
          variant="outlined"
          icon={<SaveOutlined />}
          onClick={save}
        >
          {t('layout:settings.save')}
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={reset}
        >
          {t('layout:settings.reset')}
        </Button>
      </div>
    </Drawer>
  )
}
