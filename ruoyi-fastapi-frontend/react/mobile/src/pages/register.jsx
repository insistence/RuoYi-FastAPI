import React, { useRef, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import Button from '@/components/ActionButton'
import { getCodeImg, register } from '@/api/login'
import FormField from '@/components/FormField'
import logo from '@/assets/logo.png'
export default function Register() {
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
  const [error, setError] = useState('')
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
      setError(failure.message || '验证码加载失败，请重试')
    }
  }
  useLoad(refreshCode)
  async function submit() {
    if (lock.current || !ready || !captcha.register) return
    const message = !form.username.trim()
      ? '请输入账号'
      : !form.password
        ? '请输入密码'
        : !form.confirmPassword
          ? '请再次输入密码'
          : form.password !== form.confirmPassword
            ? '两次输入的密码不一致'
            : captcha.enabled && !form.code
              ? '请输入验证码'
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
        title: '系统提示',
        content: `恭喜你，您的账号 ${form.username} 注册成功！`,
        showCancel: false,
      })
      await Taro.redirectTo({ url: '/pages/login' })
    } catch (failure) {
      setError(failure.message || '注册失败，请重试')
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
        <Text className="auth-title">RuoYi-FastAPI移动端注册</Text>
      </View>
      <View className="auth-panel">
        {ready && !captcha.register ? (
          <Text className="mobile-error">当前系统未开放注册</Text>
        ) : (
          <>
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
            />
            <FormField
              label="确认密码"
              icon="lock"
              placeholder="请再次输入密码"
              password
              maxlength={20}
              value={form.confirmPassword}
              onChange={(value) => update('confirmPassword', value)}
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
                    <Text className="text-sm text-blue-600">重新获取验证码</Text>
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
              注 册
            </Button>
          </>
        )}
        {error && <Text className="mobile-error">{error}</Text>}
        <View className="auth-footer auth-register-link">
          <Text
            className="auth-link"
            onClick={() => Taro.redirectTo({ url: '/pages/login' })}
          >
            使用已有账号登录
          </Text>
        </View>
      </View>
    </View>
  )
}
