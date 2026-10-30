import { useLocalizedError } from '@/i18n/error'
import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React, { useRef, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import Button from '@/components/ActionButton'
import { getUserProfile, updateUserProfile } from '@/api/system/user'
import { useUserStore } from '@/store'
import { usePageAuth } from '@/permission'
import { getToken } from '@/utils/auth'
import FormField from '@/components/FormField'
export default function EditProfile() {
  usePageLocale()

  const allowed = usePageAuth()
  const [user, setUser] = useState({
    nickName: '',
    phonenumber: '',
    email: '',
    sex: '',
  })
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useLocalizedError()
  const update = (key, value) => setUser((old) => ({ ...old, [key]: value }))
  async function load() {
    if (!getToken()) return
    try {
      const { data } = await getUserProfile()
      setUser({
        nickName: data.nickName,
        phonenumber: data.phonenumber,
        email: data.email,
        sex: data.sex,
      })
      setReady(true)
      setError('')
    } catch (failure) {
      setError(failure.message || (() => t('mobile:failedToLoadProfile')))
    }
  }
  useLoad(load)
  async function submit() {
    if (lock.current || !ready) return
    const message = !user.nickName?.trim()
      ? () => t('mobile:nicknameIsRequired')
      : !/^1[3-9]\d{9}$/.test(user.phonenumber)
        ? () => t('mobile:enterAValidMobileNumber')
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
          ? () => t('mobile:enterAValidEmailAddress')
          : ''
    if (message) {
      setError(message)
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await updateUserProfile(user)
      await useUserStore.getState().getInfo()
      await Taro.showToast({ title: t('mobile:updatedSuccessfully'), icon: 'success' })
      Taro.navigateBack()
    } catch (failure) {
      setError(failure.message || (() => t('mobile:updateFailed')))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (!allowed) return null
  return (
    <View className="mobile-page bg-white">
      <FormField
        label={t('mobile:nickname')}
        placeholder={t('mobile:enterYourNickname')}
        maxlength={30}
        value={user.nickName}
        onChange={(value) => update('nickName', value)}
      />
      <FormField
        label={t('mobile:mobileNumber')}
        placeholder={t('mobile:enterYourMobileNumber')}
        type="number"
        maxlength={11}
        value={user.phonenumber}
        onChange={(value) => update('phonenumber', value)}
      />
      <FormField
        label={t('mobile:emailMineInfoEdit')}
        placeholder={t('mobile:enterYourEmailAddress')}
        maxlength={50}
        value={user.email}
        onChange={(value) => update('email', value)}
      />
      <Text className="mobile-label">{t('mobile:gender')}</Text>
      <View
        className="flex gap-4"
        role="group"
        aria-label={t('mobile:gender')}
      >
        {[
          ['0', t('mobile:male')],
          ['1', t('mobile:female')],
        ].map(([value, label]) => (
          <Button
            key={value}
            className={`flex flex-1 items-center justify-center rounded-xl border py-2.5 text-sm font-medium ${user.sex === value ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-gray-50 border-transparent text-gray-500'}`}
            aria-pressed={user.sex === value}
            disabled={busy || !ready}
            onClick={() => update('sex', value)}
          >
            {label}
          </Button>
        ))}
      </View>
      {error && <Text className="mobile-error">{error}</Text>}
      {!ready && <Button onClick={load}>{t('mobile:reload')}</Button>}
      <Button
        className="mobile-button"
        disabled={busy || !ready}
        loading={busy}
        onClick={submit}
      >
        {t('mobile:submit')}
      </Button>
    </View>
  )
}
