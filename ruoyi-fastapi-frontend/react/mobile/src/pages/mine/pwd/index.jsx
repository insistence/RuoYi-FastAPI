import React, { useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import Button from '@/components/ActionButton'
import { updateUserPwd } from '@/api/system/user'
import { usePageAuth } from '@/permission'
import FormField from '@/components/FormField'
export default function Password() {
  const allowed = usePageAuth()
  const [user, setUser] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  async function submit() {
    if (lock.current) return
    const message = !user.oldPassword
      ? '旧密码不能为空'
      : !user.newPassword
        ? '新密码不能为空'
        : user.newPassword.length < 6 || user.newPassword.length > 20
          ? '长度在 6 到 20 个字符'
          : !user.confirmPassword
            ? '确认密码不能为空'
            : user.newPassword !== user.confirmPassword
              ? '两次输入的密码不一致'
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
      await Taro.showToast({ title: '修改成功', icon: 'success' })
      Taro.navigateBack()
    } catch (failure) {
      setError(failure.message || '修改失败')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (!allowed) return null
  return (
    <View className="mobile-page bg-white">
      {[
        ['oldPassword', '旧密码'],
        ['newPassword', '新密码'],
        ['confirmPassword', '确认密码'],
      ].map(([key, label]) => (
        <FormField
          key={key}
          label={label}
          placeholder={`请输入${label}`}
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
        提 交
      </Button>
    </View>
  )
}
