import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

// 加载真实状态模块和状态库，仅隔离后端接口、浏览器资源及持久化存储。
async function createLogoutHarness(root, framework) {
  const require = createRequire(new URL("package.json", root));
  let token = "saved-token";
  let timezone = "Asia/Tokyo";
  let localeAccount = "7";
  let localeSnapshot;
  const profileRequests = [];
  let resolveLogout, rejectLogout;
  let logoutCalls = 0;
  let dictionaryCleared = false;
  const remoteLogout = new Promise((resolve, reject) => {
    resolveLogout = resolve;
    rejectLogout = reject;
  });
  const saved = new Map([
    ["id", 7],
    ["name", "tester"],
    ["roles", ["operator"]],
    ["permissions", ["system:user:list"]],
  ]);
  const lock = () => ({ unlockScreen() {} });
  lock.getState = lock;
  const mocks = {
    "@/i18n": {
      i18n: {
        setAccount: (value, locale, revision) => {
          localeAccount = value;
          localeSnapshot = { account: value, locale, revision };
        },
      },
      t: (key) => key,
    },
    "@/api/login": {
      login: async () => ({ token: "new-token" }),
      getInfo: () =>
        new Promise((resolve, reject) =>
          profileRequests.push({ resolve, reject }),
        ),
      logout: () => {
        logoutCalls++;
        return remoteLogout;
      },
    },
    "@/utils/auth": {
      getToken: () => token,
      setToken: (value) => (token = value),
      removeToken: () => (token = ""),
    },
    "@/utils/time": {
      setBusinessTimezone() {},
      setUserTimezone: (value) => (timezone = value),
    },
    "@/utils/storage": {
      default: {
        get: (key) => saved.get(key),
        set: (key, value) => saved.set(key, value),
        remove: (key) => saved.delete(key),
        clean: () => saved.clear(),
      },
    },
    "@/utils/constant": {
      default: Object.fromEntries(
        ["id", "name", "avatar", "roles", "permissions", "timezone"].map(
          (key) => [key, key],
        ),
      ),
    },
    "@/utils/validate": {
      isHttp: () => false,
      isEmpty: (value) => value === null || value === undefined || value === "",
    },
    "@/plugins/cache": { default: { session: { set() {} } } },
    "@/router": { default: { push() {} } },
    "@/store": { default: { dispatch: async () => {} } },
    "@/config": { default: { baseUrl: "https://api.example.test" } },
    "@/assets/images/profile.jpg": { default: "/default-avatar.jpg" },
    "@/static/images/profile.jpg": { default: "/default-avatar.jpg" },
    "@/store/modules/lock": { default: lock },
    "@/store/modules/dict": {
      default: () => ({
        cleanDict: () => {
          dictionaryCleared = true;
        },
      }),
    },
    "./lock": { default: lock },
    "element-plus": { ElMessageBox: {} },
    "element-ui": { MessageBox: {} },
  };
  const globals = { console };
  if (framework.startsWith("vue3")) {
    const pinia = require("pinia");
    pinia.setActivePinia(pinia.createPinia());
    globals.defineStore = pinia.defineStore;
  }
  const context = createContext(globals);
  const module = new SourceTextModule(
    await readFile(new URL("src/store/modules/user.js", root), "utf8"),
    { context },
  );
  await module.link((specifier) => {
    const namespace = mocks[specifier] || require(specifier);
    return new SyntheticModule(
      Object.keys(namespace),
      function () {
        for (const [name, value] of Object.entries(namespace))
          this.setExport(name, value);
      },
      { context },
    );
  });
  await module.evaluate();
  let getState, logout, getInfo, login;
  if (framework.startsWith("vue2")) {
    const Vue = require("vue");
    const Vuex = require("vuex");
    Vue.use(Vuex);
    const store = new Vuex.Store({
      modules: {
        user: module.namespace.default,
        dict: {
          namespaced: true,
          mutations: {
            CLEAN_DICT: () => {
              dictionaryCleared = true;
            },
          },
        },
      },
    });
    getState = () => store.state.user;
    logout = () => store.dispatch("LogOut");
    getInfo = () => store.dispatch("GetInfo");
    login = () =>
      store.dispatch("Login", { username: "next", password: "password" });
  } else if (framework.startsWith("vue3")) {
    const store = (module.namespace.default || module.namespace.useUserStore)();
    getState = () => store;
    logout = () => store.logOut();
    getInfo = () => store.getInfo();
    login = () => store.login({ username: "next", password: "password" });
  } else {
    const store = module.namespace.default || module.namespace.useUserStore;
    getState = () => store.getState();
    logout = () => store.getState().logOut();
    getInfo = () => store.getState().getInfo();
    login = () =>
      store.getState().login({ username: "next", password: "password" });
  }
  Object.assign(getState(), {
    token,
    roles: ["operator"],
    permissions: ["system:user:list"],
    timeZone: timezone,
  });
  return {
    getState,
    logout,
    getInfo,
    login,
    profileRequests,
    resolveLogout,
    rejectLogout,
    saved,
    getToken: () => token,
    getTimezone: () => timezone,
    getLocaleAccount: () => localeAccount,
    getLocaleSnapshot: () => localeSnapshot,
    replaceStoredToken: (value) => (token = value),
    getLogoutCalls: () => logoutCalls,
    wasDictionaryCleared: () => dictionaryCleared,
  };
}

export function runLogoutTests(root, framework) {
  for (const outcome of ["success", "offline", "timeout", "unauthorized"]) {
    test(`${framework}: logout clears local session after ${outcome}`, async () => {
      const app = await createLogoutHarness(root, framework);
      let navigated = false;
      const completed = app.logout().then(() => {
        navigated = true;
      });
      assert.equal(app.getToken(), "saved-token");
      if (outcome === "success") app.resolveLogout({ code: 200 });
      else app.rejectLogout(new Error(outcome));
      await completed;

      assert.equal(app.getLogoutCalls(), 1);
      assert.equal(navigated, true);
      assert.equal(app.getToken(), "");
      assert.equal(app.getState().token, "");
      assert.equal(app.getState().roles.length, 0);
      assert.equal(app.getState().permissions.length, 0);
      assert.equal(app.getState().timeZone, "auto");
      assert.equal(app.getTimezone(), "auto");
      assert.equal(app.getLocaleAccount(), null);
      if (
        ["vue2", "vue3"].includes(framework) &&
        root.pathname.endsWith("/web/")
      )
        assert.equal(app.wasDictionaryCleared(), true);
      if (framework === "react-mobile") assert.equal(app.saved.size, 0);
    });
  }
}

function profile(userId, locale = "en-US", revision = "9007199254740993") {
  return {
    user: {
      userId,
      userName: `user-${userId}`,
      nickName: `User ${userId}`,
      avatar: "",
      timeZone: "auto",
      locale,
      localeRevision: revision,
    },
    roles: [`role-${userId}`],
    permissions: [`permission-${userId}`],
    appTimezone: "UTC",
  };
}

async function loadPermissionGuard(root, framework, app) {
  let guard,
    logoutCalls = 0,
    errors = 0;
  const user = {
    get roles() {
      return app.getState().roles;
    },
    getInfo: app.getInfo,
    logOut: async () => {
      logoutCalls++;
    },
  };
  const store = {
    getters: {
      get roles() {
        return user.roles;
      },
      isLock: false,
    },
    dispatch: (name) =>
      name === "GetInfo"
        ? app.getInfo()
        : name === "LogOut"
          ? user.logOut()
          : Promise.resolve([]),
  };
  const router = {
    beforeEach: (handler) => {
      guard = handler;
    },
    afterEach() {},
    addRoute() {},
    addRoutes() {},
  };
  const mocks = {
    "./router": { default: router },
    "./store": { default: store },
    "@/api/authCenter": { getAuthCenterStatus: async () => ({}) },
    "@/utils/authCenterAccess": { checkAuthCenterAccess: async () => null },
    "@/utils/auth": { getToken: app.getToken },
    "@/utils/validate": { isHttp: () => false, isPathMatch: () => false },
    "@/utils/request": { isRelogin: { show: false } },
    "@/store/modules/user": { default: () => user },
    "@/store/modules/lock": { default: () => ({ isLock: false }) },
    "@/store/modules/permission": {
      default: () => ({ generateRoutes: async () => [] }),
    },
    "element-plus": {
      ElMessage: {
        error: () => {
          errors++;
        },
      },
    },
    "element-ui": {
      Message: {
        error: () => {
          errors++;
        },
      },
    },
    nprogress: { default: { configure() {}, start() {}, done() {} } },
    "nprogress/nprogress.css": {},
  };
  const context = createContext({ console });
  const module = new SourceTextModule(
    await readFile(new URL("src/permission.js", root), "utf8"),
    { context },
  );
  await module.link((specifier) => {
    const namespace = mocks[specifier];
    assert.ok(namespace, `Unmocked permission import: ${specifier}`);
    return new SyntheticModule(
      Object.keys(namespace),
      function () {
        for (const [key, value] of Object.entries(namespace))
          this.setExport(key, value);
      },
      { context },
    );
  });
  await module.evaluate();
  return {
    navigate: () =>
      framework === "vue2"
        ? new Promise((resolve, reject) => {
            Promise.resolve(
              guard({ path: "/index", fullPath: "/index" }, {}, resolve),
            ).catch(reject);
          })
        : guard({ path: "/index", fullPath: "/index" }, {}),
    getLogoutCalls: () => logoutCalls,
    getErrors: () => errors,
  };
}

export function runUserInfoSessionTests(root, framework) {
  test(`${framework}: delayed getInfo cannot restore an account after logout`, async () => {
    const app = await createLogoutHarness(root, framework);
    const pending = assert.rejects(app.getInfo(), {
      code: "USER_SESSION_CHANGED",
    });
    const logout = app.logout();
    app.resolveLogout({ code: 200 });
    await logout;
    app.profileRequests[0].resolve(profile(7));
    await pending;
    assert.equal(app.getLocaleAccount(), null);
    assert.equal(app.getState().roles.length, 0);
    assert.equal(app.getState().token, "");
  });

  for (const outcome of ["success", "failure"]) {
    test(`${framework}: old getInfo ${outcome} cannot replace the next account`, async () => {
      const app = await createLogoutHarness(root, framework);
      const pending = assert.rejects(app.getInfo(), {
        code: "USER_SESSION_CHANGED",
      });
      await app.login();
      const next = app.getInfo();
      app.profileRequests[1].resolve(profile(8, "zh-CN", "2"));
      await next;
      if (outcome === "success") app.profileRequests[0].resolve(profile(7));
      else app.profileRequests[0].reject(new Error("old request failed"));
      await pending;
      assert.equal(app.getToken(), "new-token");
      assert.equal(app.getState().id, 8);
      assert.equal(app.getLocaleAccount(), 8);
      assert.deepEqual([...app.getState().roles], ["role-8"]);
      assert.deepEqual(app.getLocaleSnapshot(), {
        account: 8,
        locale: "zh-CN",
        revision: "2",
      });
    });
  }

  test(`${framework}: getInfo honors external token replacement and preserves revision strings`, async () => {
    const app = await createLogoutHarness(root, framework);
    const current = app.getInfo();
    app.profileRequests[0].resolve(profile(7));
    await current;
    assert.equal(app.getLocaleSnapshot().revision, "9007199254740993");
    const pending = assert.rejects(app.getInfo(), {
      code: "USER_SESSION_CHANGED",
    });
    app.replaceStoredToken("other-tab-token");
    app.profileRequests[1].resolve(profile(8, "zh-CN", "2"));
    await pending;
    assert.equal(app.getLocaleAccount(), 7);
  });

  if (["vue2", "vue3"].includes(framework) && root.pathname.endsWith("/web/")) {
    test(`${framework}: cancelled profile navigation does not log out the new session`, async () => {
      const app = await createLogoutHarness(root, framework);
      app.getState().roles = [];
      const guard = await loadPermissionGuard(root, framework, app);
      const navigation = guard.navigate();
      for (
        let attempt = 0;
        attempt < 10 && app.profileRequests.length === 0;
        attempt++
      )
        await Promise.resolve();
      assert.equal(app.profileRequests.length, 1);
      await app.login();
      const next = app.getInfo();
      app.profileRequests[1].resolve(profile(8, "zh-CN", "2"));
      await next;
      app.profileRequests[0].resolve(profile(7));
      assert.equal(await navigation, false);
      assert.equal(guard.getLogoutCalls(), 0);
      assert.equal(guard.getErrors(), 0);
      assert.equal(app.getToken(), "new-token");
      assert.equal(app.getLocaleAccount(), 8);
    });
  }
}
