import { i18n } from '@/i18n'
import { create } from 'zustand'
import config from '@/config'
import storage from '@/utils/storage'
import constant from '@/utils/constant'
import { getInfo, login, logout } from '@/api/login'
import { getToken, setToken, removeToken } from '@/utils/auth'
import { setBusinessTimezone, setUserTimezone } from '@/utils/time'
import defaultAvatar from '@/assets/images/profile.jpg'

export function avatarUrl(value) {
  return value ? (/^https?:\/\//i.test(value) ? value : config.baseUrl + value) : defaultAvatar
}
const saved = getToken() && storage.get(constant.timezone)
let initialTimezone = { appTimezone: 'Asia/Shanghai', timeZone: 'auto' }
if (saved) {
  try {
    setBusinessTimezone(saved.appTimezone)
    setUserTimezone(saved.timeZone)
    initialTimezone = saved
  } catch {
    storage.remove(constant.timezone)
  }
}
export const useUserStore = create((set, get) => ({
  token: getToken(),
  id: storage.get(constant.id),
  name: storage.get(constant.name),
  avatar: storage.get(constant.avatar) || defaultAvatar,
  roles: storage.get(constant.roles) || [],
  permissions: storage.get(constant.permissions) || [],
  ...initialTimezone,
  restoreStorage() {
    const timezone = storage.get(constant.timezone)
    if (timezone) {
      try {
        setBusinessTimezone(timezone.appTimezone)
        setUserTimezone(timezone.timeZone)
        set(timezone)
      } catch {
        storage.remove(constant.timezone)
      }
    }
    set({
      token: getToken(),
      id: storage.get(constant.id),
      name: storage.get(constant.name),
      avatar: storage.get(constant.avatar) || defaultAvatar,
      roles: storage.get(constant.roles) || [],
      permissions: storage.get(constant.permissions) || [],
    })
  },
  applyTimezone(timeZone = 'auto') {
    setUserTimezone(timeZone)
    set({ timeZone })
    storage.set(constant.timezone, {
      appTimezone: get().appTimezone,
      timeZone,
    })
  },
  SET_AVATAR(avatar) {
    storage.set(constant.avatar, avatar)
    set({ avatar })
  },
  async login(values) {
    const result = await login(values.username.trim(), values.password, values.code, values.uuid)
    setToken(result.token)
    set({ token: result.token })
  },
  async getInfo() {
    const result = await getInfo()
    const user = result.user
    i18n.setAccount(user?.userId, user?.locale)
    setBusinessTimezone(result.appTimezone)
    set({ appTimezone: result.appTimezone })
    get().applyTimezone(user.timeZone || 'auto')
    const data = {
      id: user.userId,
      name: user.userName,
      avatar: avatarUrl(user.avatar),
      roles: result.roles?.length ? result.roles : ['ROLE_DEFAULT'],
      permissions: result.permissions || [],
    }
    Object.entries(data).forEach(([key, value]) => storage.set(constant[key], value))
    set(data)
    return result
  },
  clear() {
    removeToken()
    i18n.setAccount(null)
    storage.clean()
    setUserTimezone('auto')
    set({
      token: '',
      id: '',
      name: '',
      avatar: defaultAvatar,
      roles: [],
      permissions: [],
      timeZone: 'auto',
    })
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
}))
