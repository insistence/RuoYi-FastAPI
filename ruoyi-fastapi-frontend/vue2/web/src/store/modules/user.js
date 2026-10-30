import { t, i18n } from '@/i18n'
import { setBusinessTimezone, setUserTimezone } from '@/utils/time'
import store from '@/store'
import router from '@/router'
import cache from '@/plugins/cache'
import { MessageBox } from 'element-ui'
import { login, logout, getInfo } from '@/api/login'
import { getToken, setToken, removeToken } from '@/utils/auth'
import { isHttp, isEmpty } from '@/utils/validate'
import defAva from '@/assets/images/profile.jpg'

const user = {
  state: {
    token: getToken(),
    id: '',
    name: '',
    nickName: '',
    avatar: '',
    appTimezone: 'Asia/Shanghai',
    timeZone: 'auto',
    roles: [],
    permissions: [],
  },

  mutations: {
    SET_APP_TIMEZONE: (state, timezone) => {
      setBusinessTimezone(timezone)
      state.appTimezone = timezone
    },
    SET_TIMEZONE: (state, preference = 'auto') => {
      setUserTimezone(preference)
      state.timeZone = preference
    },
    SET_TOKEN: (state, token) => {
      state.token = token
    },
    SET_ID: (state, id) => {
      state.id = id
    },
    SET_NAME: (state, name) => {
      state.name = name
    },
    SET_NICK_NAME: (state, nickName) => {
      state.nickName = nickName
    },
    SET_AVATAR: (state, avatar) => {
      state.avatar = avatar
    },
    SET_ROLES: (state, roles) => {
      state.roles = roles
    },
    SET_PERMISSIONS: (state, permissions) => {
      state.permissions = permissions
    },
  },

  actions: {
    ApplyTimezone({ commit }, preference = 'auto') {
      commit('SET_TIMEZONE', preference)
    },
    // 登录
    Login({ commit }, userInfo) {
      const username = userInfo.username.trim()
      const password = userInfo.password
      const code = userInfo.code
      const uuid = userInfo.uuid
      return new Promise((resolve, reject) => {
        login(username, password, code, uuid)
          .then((res) => {
            setToken(res.token)
            commit('SET_TOKEN', res.token)
            store.dispatch('lock/unlockScreen')
            resolve()
          })
          .catch((error) => {
            reject(error)
          })
      })
    },

    // 获取用户信息
    GetInfo({ commit, state }) {
      return new Promise((resolve, reject) => {
        getInfo()
          .then((res) => {
            const user = res.user
            i18n.setAccount(user?.userId, user?.locale)
            commit('SET_APP_TIMEZONE', res.appTimezone)
            commit('SET_TIMEZONE', user.timeZone)
            let avatar = user.avatar || ''
            if (!isHttp(avatar)) {
              avatar = isEmpty(avatar) ? defAva : process.env.VUE_APP_BASE_API + avatar
            }
            if (res.roles && res.roles.length > 0) {
              // 验证返回的roles是否是一个非空数组
              commit('SET_ROLES', res.roles)
              commit('SET_PERMISSIONS', res.permissions)
            } else {
              commit('SET_ROLES', ['ROLE_DEFAULT'])
            }
            commit('SET_ID', user.userId)
            commit('SET_NAME', user.userName)
            commit('SET_NICK_NAME', user.nickName)
            commit('SET_AVATAR', avatar)
            cache.session.set('pwrChrtype', res.pwdChrtype)
            /* 初始密码提示 */
            if (res.isDefaultModifyPwd) {
              MessageBox.confirm(
                t('auth:password.defaultWarning'),
                t('auth:password.securityTitle'),
                {
                  confirmButtonText: t('common:confirm'),
                  cancelButtonText: t('common:cancel'),
                  type: 'warning',
                }
              )
                .then(() => {
                  router.push({ name: 'Profile', params: { activeTab: 'resetPwd' } })
                })
                .catch(() => {})
            }
            /* 过期密码提示 */
            if (!res.isDefaultModifyPwd && res.isPasswordExpired) {
              MessageBox.confirm(
                t('auth:password.expiredWarning'),
                t('auth:password.securityTitle'),
                {
                  confirmButtonText: t('common:confirm'),
                  cancelButtonText: t('common:cancel'),
                  type: 'warning',
                }
              )
                .then(() => {
                  router.push({ name: 'Profile', params: { activeTab: 'resetPwd' } })
                })
                .catch(() => {})
            }
            resolve(res)
          })
          .catch((error) => {
            reject(error)
          })
      })
    },

    // 退出系统：远端撤销失败也必须清理本地会话，保证可以重新登录。
    async LogOut({ commit, state }) {
      try {
        await logout(state.token)
      } catch {
        // 远端异常由请求层提示，本地退出不依赖远端撤销结果。
      } finally {
        commit('SET_TOKEN', '')
        commit('SET_TIMEZONE', 'auto')
        commit('SET_ROLES', [])
        commit('SET_PERMISSIONS', [])
        removeToken()
        i18n.setAccount(null)
      }
    },

    // 前端 登出
    FedLogOut({ commit }) {
      return new Promise((resolve) => {
        commit('SET_TOKEN', '')
        commit('SET_TIMEZONE', 'auto')
        removeToken()
        i18n.setAccount(null)
        resolve()
      })
    },
  },
}

export default user
