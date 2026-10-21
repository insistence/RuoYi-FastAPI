import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'

// 加载真实状态模块和状态库，仅隔离后端接口、浏览器资源及持久化存储。
async function createLogoutHarness(root, framework) {
  const require = createRequire(new URL('package.json', root))
  let token = 'saved-token'
  let timezone = 'Asia/Tokyo'
  let resolveLogout, rejectLogout
  let logoutCalls = 0
  const remoteLogout = new Promise((resolve, reject) => {
    resolveLogout = resolve
    rejectLogout = reject
  })
  const saved = new Map([
    ['id', 7],
    ['name', 'tester'],
    ['roles', ['operator']],
    ['permissions', ['system:user:list']],
  ])
  const lock = () => ({ unlockScreen() {} })
  lock.getState = lock
  const mocks = {
    '@/api/login': {
      login: async () => ({ token: 'new-token' }),
      getInfo: async () => ({}),
      logout: () => {
        logoutCalls++
        return remoteLogout
      },
    },
    '@/utils/auth': {
      getToken: () => token,
      setToken: (value) => (token = value),
      removeToken: () => (token = ''),
    },
    '@/utils/time': {
      setBusinessTimezone() {},
      setUserTimezone: (value) => (timezone = value),
    },
    '@/utils/storage': {
      default: {
        get: (key) => saved.get(key),
        set: (key, value) => saved.set(key, value),
        remove: (key) => saved.delete(key),
        clean: () => saved.clear(),
      },
    },
    '@/utils/constant': {
      default: Object.fromEntries(
        ['id', 'name', 'avatar', 'roles', 'permissions', 'timezone'].map((key) => [key, key])
      ),
    },
    '@/utils/validate': { isHttp: () => false, isEmpty: () => true },
    '@/plugins/cache': { default: { session: { set() {} } } },
    '@/router': { default: { push() {} } },
    '@/store': { default: {} },
    '@/config': { default: { baseUrl: 'https://api.example.test' } },
    '@/assets/images/profile.jpg': { default: '/default-avatar.jpg' },
    '@/store/modules/lock': { default: lock },
    './lock': { default: lock },
    'element-plus': { ElMessageBox: {} },
    'element-ui': { MessageBox: {} },
  }
  const globals = { console }
  if (framework === 'vue3') {
    const pinia = require('pinia')
    pinia.setActivePinia(pinia.createPinia())
    globals.defineStore = pinia.defineStore
  }
  const context = createContext(globals)
  const module = new SourceTextModule(
    await readFile(new URL('src/store/modules/user.js', root), 'utf8'),
    { context }
  )
  await module.link((specifier) => {
    const namespace = mocks[specifier] || require(specifier)
    return new SyntheticModule(
      Object.keys(namespace),
      function () {
        for (const [name, value] of Object.entries(namespace)) this.setExport(name, value)
      },
      { context }
    )
  })
  await module.evaluate()
  let getState, logout
  if (framework === 'vue2') {
    const Vue = require('vue')
    const Vuex = require('vuex')
    Vue.use(Vuex)
    const store = new Vuex.Store({ modules: { user: module.namespace.default } })
    getState = () => store.state.user
    logout = () => store.dispatch('LogOut')
  } else if (framework === 'vue3') {
    const store = module.namespace.default()
    getState = () => store
    logout = () => store.logOut()
  } else {
    const store = module.namespace.default || module.namespace.useUserStore
    getState = () => store.getState()
    logout = () => store.getState().logOut()
  }
  Object.assign(getState(), {
    token,
    roles: ['operator'],
    permissions: ['system:user:list'],
    timeZone: timezone,
  })
  return {
    getState,
    logout,
    resolveLogout,
    rejectLogout,
    saved,
    getToken: () => token,
    getTimezone: () => timezone,
    getLogoutCalls: () => logoutCalls,
  }
}

export function runLogoutTests(root, framework) {
  for (const outcome of ['success', 'offline', 'timeout', 'unauthorized']) {
    test(`${framework}: logout clears local session after ${outcome}`, async () => {
      const app = await createLogoutHarness(root, framework)
      let navigated = false
      const completed = app.logout().then(() => {
        navigated = true
      })
      assert.equal(app.getToken(), 'saved-token')
      if (outcome === 'success') app.resolveLogout({ code: 200 })
      else app.rejectLogout(new Error(outcome))
      await completed

      assert.equal(app.getLogoutCalls(), 1)
      assert.equal(navigated, true)
      assert.equal(app.getToken(), '')
      assert.equal(app.getState().token, '')
      assert.equal(app.getState().roles.length, 0)
      assert.equal(app.getState().permissions.length, 0)
      assert.equal(app.getState().timeZone, 'auto')
      assert.equal(app.getTimezone(), 'auto')
      if (framework === 'react-mobile') assert.equal(app.saved.size, 0)
    })
  }
}
