import { useLocalizedError } from '@/i18n/error'
import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React, { useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import Button from '@/components/ActionButton'
import { updateUserPwd } from '@/api/system/user'
import { usePageAuth } from '@/permission'
import FormField from '@/components/FormField'
export default function Password() {
  usePageLocale()

  const allowed = usePageAuth()
  const [user, setUser] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useLocalizedError()
  async function submit() {
    if (lock.current) return
    const message = !user.oldPassword
      ? () => t('auth:password.oldRequired')
      : !user.newPassword
        ? () => t('auth:password.newRequired')
        : user.newPassword.length < 6 || user.newPassword.length > 20
          ? () => t('auth:password.length')
          : !user.confirmPassword
            ? () => t('auth:password.confirmRequired')
            : user.newPassword !== user.confirmPassword
              ? () => t('auth:password.mismatch')
              : ''
    if (message) {
      setError(message)
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await updateUserPwd(user.oldPassword, user.newPassword)
      setUser({ oldPassword: '', newPassword: '', confirmPassword: '' })
      await Taro.showToast({ title: t('common:updateSuccess'), icon: 'success' })
      Taro.navigateBack()
    } catch (failure) {
      setError(failure.message || (() => t('common:updateFailed')))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (!allowed) return null
  return (
    <View className="mobile-page bg-white">
      {[
        ['oldPassword', t('auth:password.old')],
        ['newPassword', t('auth:password.new')],
        ['confirmPassword', t('auth:password.confirm')],
      ].map(([key, label]) => (
        <FormField
          key={key}
          label={label}
          placeholder={t('auth:password.placeholder', { label })}
          password
          maxlength={20}
          value={user[key]}
          onChange={(value) => setUser((old) => ({ ...old, [key]: value }))}
        />
      ))}
      {error && <Text className="mobile-error">{error}</Text>}
      <Button
        className="mobile-button"
        disabled={busy}
        loading={busy}
        onClick={submit}
      >
        {t('common:submit')}
      </Button>
    </View>
  )
}
