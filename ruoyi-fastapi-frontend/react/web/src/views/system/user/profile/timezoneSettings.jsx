import { useLocalizedText } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useEffect, useState } from 'react'
import { Alert, Button, Form, Radio, Select } from 'antd'
import { getTimezoneOptions, updateUserTimezone } from '@/api/system/user'
import {
  formatBusinessTime,
  getBusinessTimezone,
  getDeviceTimezone,
  getDisplayTimezone,
  getSupportedTimezones,
} from '@/utils/time'
import useUserStore from '@/store/modules/user'
import { message } from '@/plugins/modal'
export default function TimezoneSettings({ user, onSaved }) {
  useI18n()

  const [mode, setMode] = useState(user.timeZone === 'auto' ? 'auto' : 'custom'),
    [selectedZone, setSelectedZone] = useState(getDisplayTimezone())
  const [zones, setZones] = useState(getSupportedTimezones()),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useLocalizedText(''),
    [fieldError, setFieldError] = useState(''),
    [now, setNow] = useState(new Date())
  const deviceZone = getDeviceTimezone(),
    previewZone = mode === 'auto' ? deviceZone || getBusinessTimezone() : selectedZone
  async function loadOptions() {
    setLoading(true)
    setLoadError(false)
    try {
      const response = await getTimezoneOptions()
      setZones(getSupportedTimezones(response.data))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void loadOptions()
  }, [])
  useEffect(() => {
    if (user.timeZone) {
      setMode(user.timeZone === 'auto' ? 'auto' : 'custom')
      setSelectedZone(user.timeZone === 'auto' ? getDisplayTimezone() : user.timeZone)
    }
  }, [user.timeZone])
  async function save() {
    if (saving) return
    if (mode === 'custom' && !selectedZone) return setFieldError(t('system:selectDisplayTimeZone'))
    setSaving(true)
    setError('')
    const preference = mode === 'auto' ? 'auto' : selectedZone
    try {
      await updateUserTimezone(preference)
      useUserStore.getState().applyTimezone(preference)
      setNow(new Date())
      onSaved?.(preference)
      message.success(t('system:timeZoneSaved'))
    } catch (error) {
      setError((t) => error.message || t('common:saveFailed'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Form
      layout="vertical"
      onFinish={save}
      className="timezone-settings"
    >
      <Form.Item label={t('system:timeDisplayMode')}>
        <Radio.Group
          aria-label={t('system:timeDisplayMode')}
          disabled={saving}
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          options={[
            { value: 'auto', label: t('system:followDeviceAutomatically') },
            { value: 'custom', label: t('system:chooseManually') },
          ]}
        />
      </Form.Item>
      {mode === 'custom' && (
        <Form.Item
          label={t('system:displayTimeZone')}
          validateStatus={fieldError ? 'error' : undefined}
          help={fieldError || undefined}
        >
          <Select
            aria-label={t('system:displayTimeZone')}
            placeholder={t('system:searchTimeZonesEGAsiaShanghai')}
            showSearch
            value={selectedZone}
            loading={loading}
            disabled={saving}
            options={zones.map((value) => ({ label: value, value }))}
            onChange={(value) => {
              setSelectedZone(value)
              setFieldError('')
            }}
          />
        </Form.Item>
      )}
      {loadError && (
        <Alert
          className="timezone-settings-notice"
          type="warning"
          title={t('system:failedToLoadTheTimeZoneListYourCurrent')}
          action={
            <Button
              className="ruoyi-table-action"
              type="link"
              loading={loading}
              onClick={loadOptions}
            >
              {t('common:retry')}
            </Button>
          }
        />
      )}
      <div
        className="timezone-preview"
        aria-live="polite"
      >
        <div>
          {t('system:previewTimeZone')}
          <strong>{previewZone}</strong>
        </div>
        <div>
          {t('system:timePreview')}
          {formatBusinessTime(now, 'YYYY-MM-DD HH:mm:ss', previewZone)}
        </div>
        {mode === 'auto' && !deviceZone && (
          <div className="timezone-settings-fallback">
            {t('system:thisDeviceCannotIdentifyItsTimeZoneTheSystem')}
          </div>
        )}
      </div>
      <p className="timezone-settings-hint">
        {t('system:usedForTimeDisplayDateFilteringAndExportsScheduled')}
      </p>
      {error && (
        <p
          role="alert"
          className="timezone-settings-error"
        >
          {error}
        </p>
      )}
      <Button
        type="primary"
        htmlType="submit"
        loading={saving}
      >
        {t('system:saveTimeZone')}
      </Button>
    </Form>
  )
}
