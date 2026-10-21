import useLockStore from './lock'
import { create } from 'zustand'
import { login, logout, getInfo } from '@/api/login'
import { getToken, setToken, removeToken } from '@/utils/auth'
import { setBusinessTimezone, setUserTimezone } from '@/utils/time'
import cache from '@/plugins/cache'
import defAva from '@/assets/images/profile.jpg'

const useUserStore = create((set, get) => ({
  token: getToken(),
  id: '',
  name: '',
  nickName: '',
  avatar: '',
  roles: [],
  permissions: [],
  appTimezone: 'Asia/Shanghai',
  timeZone: 'auto',
  loaded: false,
  // 保存成功后，同步当前页面使用的显示时区偏好。
  applyTimezone(preference = 'auto') {
    setUserTimezone(preference)
    set({ timeZone: preference })
  },
  // 登录并保存令牌，解除锁屏；用户资料在后续 getInfo 中加载。
  async login(form) {
    const result = await login(form.username.trim(), form.password, form.code, form.uuid)
    setToken(result.token)
    set({ token: result.token, loaded: false })
    useLockStore.getState().unlockScreen()
  },
  // 获取用户资料、角色权限及密码状态，同时应用服务端业务时区。
  async getInfo() {
    const result = await getInfo()
    const user = result.user
    setBusinessTimezone(result.appTimezone)
    get().applyTimezone(user.timeZone)
    cache.session.set('pwrChrtype', result.pwdChrtype)
    set({
      id: user.userId,
      name: user.userName,
      nickName: user.nickName,
      avatar: user.avatar
        ? /^https?:\/\//.test(user.avatar)
          ? user.avatar
          : import.meta.env.VITE_APP_BASE_API + user.avatar
        : defAva,
      // 后端未返回有效角色时使用默认角色。
      roles: result.roles?.length ? result.roles : ['ROLE_DEFAULT'],
      permissions: result.permissions || [],
      appTimezone: result.appTimezone,
      loaded: true,
      // 初始密码提示优先于过期提示，由布局展示并引导用户修改密码。
      passwordWarning: result.isDefaultModifyPwd
        ? '您的密码还是初始密码，请修改密码！'
        : result.isPasswordExpired
          ? '您的密码已过期，请尽快修改密码！'
          : '',
    })
    return result
  },
  // 退出系统：远端撤销失败也必须清理本地会话，保证可以重新登录。
  async logOut() {
    try {
      await logout()
    } catch {
      // 远端异常由请求层提示，本地退出不依赖远端撤销结果。
    } finally {
      get().clear()
    }
  },
  // 清除令牌和授权状态，将显示时区恢复为跟随设备并解除锁屏。
  clear() {
    removeToken()
    setUserTimezone('auto')
    set({
      token: '',
      roles: [],
      permissions: [],
      loaded: false,
      timeZone: 'auto',
    })
    useLockStore.getState().unlockScreen()
  },
}))
export default useUserStore
