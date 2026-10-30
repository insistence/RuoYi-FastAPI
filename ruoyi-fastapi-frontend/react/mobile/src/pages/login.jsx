import { useLocalizedError } from '@/i18n/error'
import { usePageLocale } from '@/i18n/navigation'
import { useI18n } from '@/i18n/adapter'
import LanguageSelect from '@/components/LanguageSelect/index.jsx'
import React, { useRef, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Button from '@/components/ActionButton'
import { getCodeImg } from '@/api/login'
import { getToken } from '@/utils/auth'
import { useUserStore } from '@/store'
import FormField from '@/components/FormField'
import logo from '@/assets/logo.png'
export default function Login() {
  usePageLocale()
  const { t } = useI18n()
  const [form, setForm] = useState({
    username: '',
    password: '',
    code: '',
    uuid: '',
  })
  const [captcha, setCaptcha] = useState({
    enabled: true,
    image: '',
    register: false,
  })
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const captchaVersion = useRef(0)
  const [error, setError] = useLocalizedError()
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }))
  async function refreshCode() {
    const version = ++captchaVersion.current
    try {
      const result = await getCodeImg()
      if (version !== captchaVersion.current) return
      setCaptcha({
        enabled: result.captchaEnabled !== false,
        image: result.img ? `data:image/gif;base64,${result.img}` : '',
        register: result.registerEnabled === true,
      })
      setForm((old) => ({ ...old, uuid: result.uuid || '', code: '' }))
    } catch (failure) {
      setError(failure.message || (() => t('mobile:failedToLoadTheVerificationCodePleaseTryAgain')))
    }
  }
  useLoad(() => {
    if (getToken()) Taro.switchTab({ url: '/pages/index' })
    else refreshCode()
  })
  async function submit() {
    if (lock.current) return
    if (!form.username.trim() || !form.password || (captcha.enabled && !form.code)) {
      setError(
        !form.username.trim()
          ? () => t('common:login.usernameRequired')
          : !form.password
            ? () => t('common:login.passwordRequired')
            : () => t('common:login.codeRequired')
      )
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await useUserStore.getState().login(form)
      await useUserStore.getState().getInfo()
      await Taro.switchTab({ url: '/pages/index' })
    } catch (failure) {
      setError(failure.message || (() => t('mobile:signInFailedPleaseTryAgain')))
      if (captcha.enabled) await refreshCode()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <View className="auth-screen">
      <LanguageSelect />
      <View className="flex flex-col items-center">
        <View className="auth-logo">
          <Image
            src={logo}
            className="size-10"
            mode="widthFix"
          />
        </View>
        <Text className="auth-title">{t('mobile:ruoyiFastapiMobileSignIn')}</Text>
      </View>
      <View className="auth-panel">
        <FormField
          label={t('common:login.username')}
          icon="account"
          placeholder={t('common:login.usernameRequired')}
          maxlength={30}
          value={form.username}
          onChange={(value) => update('username', value)}
        />
        <FormField
          label={t('common:login.password')}
          icon="lock"
          placeholder={t('common:login.passwordRequired')}
          password
          maxlength={20}
          value={form.password}
          onChange={(value) => update('password', value)}
          onConfirm={submit}
        />
        {captcha.enabled && (
          <View className="auth-captcha mb-8 flex items-center gap-3">
            <View className="flex-1">
              <FormField
                label={t('common:login.code')}
                compact
                icon="security"
                type="number"
                placeholder={t('common:login.code')}
                maxlength={4}
                value={form.code}
                onChange={(value) => update('code', value)}
                onConfirm={submit}
              />
            </View>
            <View
              onClick={refreshCode}
              className="w-28 h-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 shadow-sm"
            >
              {captcha.image ? (
                <Image
                  className="w-full h-full"
                  src={captcha.image}
                />
              ) : (
                <Text className="text-sm text-blue-600">{t('mobile:refreshVerificationCode')}</Text>
              )}
            </View>
          </View>
        )}
        {error && <Text className="mobile-error">{error}</Text>}
        <Button
          className="mobile-button auth-submit"
          loading={busy}
          disabled={busy}
          onClick={submit}
        >
          {t('mobile:signIn')}
        </Button>
        {captcha.register && (
          <View className="auth-footer auth-register-link">
            {t('mobile:noAccount')}
            <Text
              className="auth-link"
              onClick={() => Taro.navigateTo({ url: '/pages/register' })}
            >
              {t('mobile:createAnAccount')}
            </Text>
          </View>
        )}
        <View className="auth-footer">
          <Text>{t('mobile:bySigningInYouAgreeTo')}</Text>
          <Text
            className="auth-link"
            onClick={() => Taro.navigateTo({ url: '/pages/common/agreement/index' })}
          >
            {t('mobile:userAgreementLogin')}
          </Text>
          <Text>{t('mobile:and')}</Text>
          <Text
            className="auth-link"
            onClick={() => Taro.navigateTo({ url: '/pages/common/privacy/index' })}
          >
            {t('mobile:privacyPolicyLogin')}
          </Text>
        </View>
      </View>
    </View>
  )
}
