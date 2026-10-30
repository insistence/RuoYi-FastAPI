import { useLocalizedError } from '@/i18n/error'
import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React, { useRef, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { View, Text, Switch, Input, Picker, Label } from '@tarojs/components'
import Button from '@/components/ActionButton'
import { getTimezoneOptions, updateUserTimezone } from '@/api/system/user'
import { useUserStore } from '@/store'
import { usePageAuth } from '@/permission'
import { getToken } from '@/utils/auth'
import {
  formatBusinessTime,
  getBusinessTimezone,
  getDeviceTimezone,
  getDisplayTimezone,
  getSupportedTimezones,
} from '@/utils/time'
export default function Timezone() {
  usePageLocale()

  const allowed = usePageAuth()
  const [follow, setFollow] = useState(useUserStore.getState().timeZone === 'auto')
  const [zone, setZone] = useState(getDisplayTimezone())
  const [zones, setZones] = useState(getSupportedTimezones())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useLocalizedError()
  const [now, setNow] = useState(new Date())
  const device = getDeviceTimezone()
  const previewZone = follow ? device || getBusinessTimezone() : zone
  const filtered = zones.filter((item) => item.toLowerCase().includes(search.trim().toLowerCase()))
  async function loadOptions() {
    setLoading(true)
    setLoadError(false)
    try {
      const result = await getTimezoneOptions()
      setZones(getSupportedTimezones(result.data))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }
  useLoad(async () => {
    if (!getToken()) return
    await Promise.all([
      loadOptions(),
      useUserStore
        .getState()
        .getInfo()
        .then(() => {
          setFollow(useUserStore.getState().timeZone === 'auto')
          setZone(getDisplayTimezone())
        })
        .catch(() => setError((t) => t('mobile:failedToReadAccountSettingsTrySavingAgainOr'))),
    ])
    setInitializing(false)
  })
  async function save() {
    if (lock.current || initializing) return
    lock.current = true
    setSaving(true)
    setError('')
    const preference = follow ? 'auto' : zone
    try {
      await updateUserTimezone(preference)
      useUserStore.getState().applyTimezone(preference)
      setNow(new Date())
      Taro.showToast({ title: t('mobile:timeZoneSaved'), icon: 'success' })
    } catch (failure) {
      setError(failure.message || (() => t('mobile:saveFailedPleaseTryAgain')))
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  if (!allowed) return null
  return (
    <View className="mobile-page bg-white">
      <Label className="mobile-toggle mb-5">
        <Text className="text-sm font-medium text-gray-700">
          {t('mobile:followDeviceAutomatically')}
        </Text>
        <Switch
          aria-label={t('mobile:followDeviceAutomatically')}
          nativeProps={
            process.env.TARO_ENV === 'h5'
              ? { 'aria-label': t('mobile:followDeviceAutomatically'), role: 'switch' }
              : undefined
          }
          checked={follow}
          disabled={saving || initializing}
          color="#3b82f6"
          onChange={(event) => setFollow(event.detail.value)}
        />
      </Label>
      {!follow && (
        <View className="mobile-field">
          <Label
            for={process.env.TARO_ENV === 'h5' ? 'timezone-search-input' : 'timezone-search'}
            className="mobile-label"
          >
            {t('mobile:displayTimeZone')}
          </Label>
          <Input
            id="timezone-search"
            aria-label={t('mobile:searchTimeZones')}
            nativeProps={
              process.env.TARO_ENV === 'h5'
                ? { id: 'timezone-search-input', 'aria-label': t('mobile:searchTimeZones') }
                : undefined
            }
            className="mobile-input mb-3"
            placeholder={t('mobile:searchTimeZonesEGAsiaShanghai')}
            value={search}
            disabled={saving || initializing}
            onInput={(event) => setSearch(event.detail.value)}
          />
          <Picker
            range={filtered}
            value={Math.max(0, filtered.indexOf(zone))}
            disabled={saving || initializing || loading || !filtered.length}
            onChange={(event) => setZone(filtered[Number(event.detail.value)])}
          >
            <Button
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-2.5 text-left leading-normal border border-gray-200"
              aria-label={t('mobile:chooseADisplayTimeZone')}
              disabled={saving || initializing || loading || !filtered.length}
            >
              <Text className="break-all text-sm text-gray-800">{zone}</Text>
              <View
                className="i-mdi-chevron-down shrink-0 text-base text-gray-400"
                aria-hidden="true"
              />
            </Button>
          </Picker>
          {!filtered.length && (
            <Text className="block mt-2 text-sm text-gray-500">
              {t('mobile:noMatchingTimeZonesTryAnotherSearch')}
            </Text>
          )}
        </View>
      )}
      {loadError && (
        <View className="mb-5">
          <Text className="mobile-muted">{t('mobile:failedToLoadTheTimeZoneListYourCurrent')}</Text>
          <Button
            size="mini"
            className="flex h-11 items-center justify-center rounded-xl bg-blue-50 px-4 text-sm font-medium text-blue-600"
            disabled={loading}
            loading={loading}
            onClick={loadOptions}
          >
            {t('common:retry')}
          </Button>
        </View>
      )}
      <Text className="mobile-label">{t('mobile:timePreview')}</Text>
      <View
        className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800 border border-gray-200"
        aria-live="polite"
      >
        <Text className="block break-all">
          {t('mobile:previewTimeZone')}
          {previewZone}
        </Text>
        <Text className="block">
          {t('mobile:timePreviewMineSettingTimezone')}
          {formatBusinessTime(now, 'YYYY-MM-DD HH:mm:ss', previewZone)}
        </Text>
        {follow && !device && (
          <Text className="mobile-muted">
            {t('mobile:thisDeviceCannotIdentifyItsTimeZoneTheSystem')}
          </Text>
        )}
      </View>
      <Text className="block mt-2 text-xs text-gray-500 leading-5">
        {t('mobile:usedForTimeDisplayDateFilteringAndExportsScheduled')}
      </Text>
      {error && (
        <Text
          className="mobile-error"
          role="alert"
        >
          {error}
        </Text>
      )}
      <Button
        className="mobile-button"
        disabled={saving || initializing}
        loading={saving}
        onClick={save}
      >
        {t('mobile:saveTimeZone')}
      </Button>
    </View>
  )
}
