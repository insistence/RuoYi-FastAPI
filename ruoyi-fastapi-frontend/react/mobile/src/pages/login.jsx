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
  const [error, setError] = useState('')
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
      setError(failure.message || '验证码加载失败，请重试')
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
        !form.username.trim() ? '请输入账号' : !form.password ? '请输入密码' : '请输入验证码'
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
      setError(failure.message || '登录失败，请重试')
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
        <Text className="auth-title">RuoYi-FastAPI移动端登录</Text>
      </View>
      <View className="auth-panel">
        <FormField
          label="账号"
          icon="account"
          placeholder="请输入账号"
          maxlength={30}
          value={form.username}
          onChange={(value) => update('username', value)}
        />
        <FormField
          label="密码"
          icon="lock"
          placeholder="请输入密码"
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
                label="验证码"
                compact
                icon="security"
                type="number"
                placeholder="验证码"
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
                <Text className="text-sm text-blue-600">重新获取验证码</Text>
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
          登 录
        </Button>
        {captcha.register && (
          <View className="auth-footer auth-register-link">
            没有账号？
            <Text
              className="auth-link"
              onClick={() => Taro.navigateTo({ url: '/pages/register' })}
            >
              立即注册
            </Text>
          </View>
        )}
        <View className="auth-footer">
          <Text>登录即代表同意</Text>
          <Text
            className="auth-link"
            onClick={() => Taro.navigateTo({ url: '/pages/common/agreement/index' })}
          >
            《用户协议》
          </Text>
          <Text>和</Text>
          <Text
            className="auth-link"
            onClick={() => Taro.navigateTo({ url: '/pages/common/privacy/index' })}
          >
            《隐私协议》
          </Text>
        </View>
      </View>
    </View>
  )
}
