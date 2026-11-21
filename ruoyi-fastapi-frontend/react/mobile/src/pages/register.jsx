import { useLocalizedError } from '@/i18n/error'
import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React, { useRef, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Button from '@/components/ActionButton'
import { getCodeImg, register } from '@/api/login'
import FormField from '@/components/FormField'
import logo from '@/assets/logo.png'
export default function Register() {
  usePageLocale()

  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    code: '',
    uuid: '',
  })
  const [captcha, setCaptcha] = useState({
    enabled: true,
    image: '',
    register: false,
  })
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const version = useRef(0)
  const [error, setError] = useLocalizedError()
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }))
  async function refreshCode() {
    const current = ++version.current
    try {
      const result = await getCodeImg()
      if (current !== version.current) return
      setCaptcha({
        enabled: result.captchaEnabled !== false,
        image: result.img ? `data:image/gif;base64,${result.img}` : '',
        register: result.registerEnabled === true,
      })
      setReady(true)
      setForm((old) => ({ ...old, uuid: result.uuid || '', code: '' }))
    } catch (failure) {
      setError(failure.message || (() => t('auth:login.captchaFailed')))
    }
  }
  useLoad(refreshCode)
  async function submit() {
    if (lock.current || !ready || !captcha.register) return
    const message = !form.username.trim()
      ? () => t('auth:register.usernameRequired')
      : !form.password
        ? () => t('auth:register.passwordRequired')
        : !form.confirmPassword
          ? () => t('auth:register.confirmRequired')
          : form.password !== form.confirmPassword
            ? () => t('auth:password.mismatch')
            : captcha.enabled && !form.code
              ? () => t('auth:login.codeRequired')
              : ''
    if (message) {
      setError(message)
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await register({ ...form, username: form.username.trim() })
      await Taro.showModal({
        confirmText: t('common:confirm'),
        cancelText: t('common:cancel'),
        title: t('common:systemNotice'),
        content: t('auth:register.success', {
          username: form.username,
        }),
        showCancel: false,
      })
      await Taro.redirectTo({ url: '/pages/login' })
    } catch (failure) {
      setError(failure.message || (() => t('auth:register.failed')))
      if (captcha.enabled) await refreshCode()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <View className="auth-screen">
      <View className="flex flex-col items-center">
        <View className="auth-logo">
          <Image
            src={logo}
            className="size-10"
            mode="widthFix"
          />
        </View>
        <Text className="auth-title">{t('auth:register.title')}</Text>
      </View>
      <View className="auth-panel">
        {ready && !captcha.register ? (
          <Text className="mobile-error">{t('auth:register.unavailable')}</Text>
        ) : (
          <>
            <FormField
              label={t('auth:login.username')}
              icon="account"
              placeholder={t('auth:register.usernameRequired')}
              maxlength={30}
              value={form.username}
              onChange={(value) => update('username', value)}
            />
            <FormField
              label={t('auth:login.password')}
              icon="lock"
              placeholder={t('auth:register.passwordRequired')}
              password
              maxlength={20}
              value={form.password}
              onChange={(value) => update('password', value)}
            />
            <FormField
              label={t('auth:password.confirm')}
              icon="lock"
              placeholder={t('auth:register.confirmRequired')}
              password
              maxlength={20}
              value={form.confirmPassword}
              onChange={(value) => update('confirmPassword', value)}
            />
            {captcha.enabled && (
              <View className="auth-captcha mb-8 flex items-center gap-3">
                <View className="flex-1">
                  <FormField
                    label={t('auth:login.code')}
                    compact
                    icon="security"
                    type="number"
                    placeholder={t('auth:login.code')}
                    maxlength={4}
                    value={form.code}
                    onChange={(value) => update('code', value)}
                  />
                </View>
                <View
                  onClick={refreshCode}
                  className="w-28 h-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 shadow-sm"
                >
                  {captcha.image ? (
                    <Image
                      src={captcha.image}
                      className="w-full h-full"
                    />
                  ) : (
                    <Text className="text-sm text-blue-600">{t('auth:login.refreshCaptcha')}</Text>
                  )}
                </View>
              </View>
            )}
            <Button
              className="mobile-button auth-submit"
              loading={busy}
              disabled={busy || !ready}
              onClick={submit}
            >
              {t('auth:register.submit')}
            </Button>
          </>
        )}
        {error && <Text className="mobile-error">{error}</Text>}
        <View className="auth-footer auth-register-link">
          <Text
            className="auth-link"
            onClick={() => Taro.redirectTo({ url: '/pages/login' })}
          >
            {t('auth:register.signIn')}
          </Text>
        </View>
      </View>
    </View>
  )
}
