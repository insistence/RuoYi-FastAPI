import { lazy, Suspense } from 'react'
import { createBrowserRouter, matchPath, useLocation, replace } from 'react-router-dom'
import { PageLoading } from '@/components/LoadingProgress'
import SystemLoading, { PageReady } from '@/components/SystemLoading'
import Layout from '@/layout'
import Login from '@/views/login'
import Register from '@/views/register'
import Lock from '@/views/lock'
import NotFound from '@/views/error/404'
import Forbidden from '@/views/error/401'
import PluginFrame from '@/components/PluginFrame'
import InnerLink from '@/layout/components/InnerLink'
import usePermissionStore from '@/store/modules/permission'
import { checkPermi } from '@/utils/permission'
import { getAuthCenterStatus } from '@/api/authCenter'
import { checkAuthCenterAccess } from '@/utils/authCenterAccess'
import { resolvePluginViewPath } from '@/utils/pluginViewResolver'
import { getToken } from '@/utils/auth'
import { getLoginRedirect } from '@/utils/router'

// 已登录用户访问登录页时，回到经过校验的站内地址，避免循环跳转。
function loginLoader({ request }) {
  if (!getToken()) return null
  return replace(getLoginRedirect(new URL(request.url).searchParams.get('redirect')))
}

// 进入认证中心前检查服务是否启用；错误页自身不使用此加载器。
async function authCenterLoader() {
  const next = await checkAuthCenterAccess(
    { meta: { requiresAuthCenter: true } },
    getAuthCenterStatus
  )
  return next ? replace(`${next.path}?reason=${next.query.reason}`) : null
}
const authPages = {
  login: lazy(() => import('@/views/auth-center/login')),
  consent: lazy(() => import('@/views/auth-center/consent')),
  'change-password': lazy(() => import('@/views/auth-center/changePassword')),
  error: lazy(() => import('@/views/auth-center/error')),
}

// 收集内置业务页面；登录、注册、锁屏和错误页通过公共路由单独加载。
const modules = import.meta.glob([
  '../views/**/*.jsx',
  '!../views/login.jsx',
  '!../views/register.jsx',
  '!../views/lock.jsx',
  '!../views/error/*.jsx',
])
const pluginModules = import.meta.glob('../../plugins/*/views/**/*.jsx')
// 复用 lazy 组件引用，避免重复解析组件时导致页面重新挂载。
const components = new Map()
/**
 * 将后端菜单中的组件路径解析为内置页面、插件页面或特殊容器组件。
 * @param {string} view 组件标识或相对于 views 的路径
 * @returns {import("react").ComponentType} 对应的 React 组件，未找到时返回 404 页面
 */
export function loadView(view) {
  if (view === 'PluginFrame') return PluginFrame
  if (view === 'InnerLink') return InnerLink
  if (!components.has(view)) {
    const loader = view.startsWith('plugin/')
      ? pluginModules[resolvePluginViewPath(view)]
      : modules[`../views/${view}.jsx`]
    components.set(view, loader ? lazy(loader) : NotFound)
  }
  return components.get(view)
}
/**
 * 业务路由与后端菜单共用的配置约定：
 * path：页面路径；component：业务页面路径或 PluginFrame、InnerLink 等组件标识。
 * hidden：不在菜单显示；alwaysShow：只有一个可见子节点时仍保留父级菜单。
 * query：导航时附带的查询参数，可为对象或 JSON 字符串。
 * redirect: "noRedirect"：面包屑节点不可点击。
 * permissions：页面所需权限，具备其中一项或通配权限即可访问。
 * meta.title / icon：菜单、标签与面包屑使用的标题和图标。
 * meta.breadcrumb: false：隐藏该面包屑节点；activeMenu：指定高亮的菜单路径。
 * meta.affix：固定页面标签；noCache：不在标签切换时保留页面状态。
 * 页面缓存由 AppMain 的 React Activity 按路径管理，刷新通过标签版本号触发。
 *
 * 以下补充菜单树之外的内置页面，权限在 DynamicView 渲染前校验。
 */
export const dynamicRoutes = [
  {
    path: '/system/user-auth/role/:userId',
    component: 'system/user/authRole',
    permissions: ['system:user:edit'],
    meta: { title: '分配角色', titleKey: 'layout:route.assignRoles', activeMenu: '/system/user' },
  },
  {
    path: '/system/role-auth/user/:roleId',
    component: 'system/role/authUser',
    permissions: ['system:role:edit'],
    meta: { title: '分配用户', titleKey: 'layout:route.assignUsers', activeMenu: '/system/role' },
  },
  {
    path: '/system/dict-data/index/:dictId',
    component: 'system/dict/data',
    permissions: ['system:dict:list'],
    meta: {
      title: '字典数据',
      titleKey: 'layout:route.dictionaryData',
      activeMenu: '/system/dict',
    },
  },
  {
    path: '/monitor/job-log/index/:jobId',
    component: 'monitor/job/log',
    permissions: ['monitor:job:list'],
    meta: { title: '调度日志', titleKey: 'layout:route.jobLog', activeMenu: '/monitor/job' },
  },
  {
    path: '/tool/gen-edit/index/:tableId',
    component: 'tool/gen/editTable',
    permissions: ['tool:gen:edit'],
    meta: {
      title: '修改生成配置',
      titleKey: 'layout:route.generatorEdit',
      activeMenu: '/tool/gen',
    },
  },
  {
    path: '/user/profile/:activeTab?',
    component: 'system/user/profile/index',
    meta: { title: '个人中心', titleKey: 'layout:route.profile' },
  },
  {
    path: '/index',
    component: 'dashboard/index',
    meta: { title: '首页', titleKey: 'layout:route.home', affix: true },
  },
]
/**
 * 先匹配内置业务路由，再匹配后端菜单；忽略仅用于分组的布局节点。
 * @param {string} pathname 当前页面路径
 * @param {Object[]} routes 已展平的后端菜单路由
 * @returns {Object|undefined} 首个匹配的业务路由
 */
export function findRoute(pathname, routes) {
  return [...dynamicRoutes, ...routes].find(
    (route) =>
      !['Layout', 'ParentView'].includes(route.component) && matchPath(route.path, pathname)
  )
}
// 按当前地址解析页面，处理不存在、无权限与异步加载状态。
export function DynamicView() {
  const location = useLocation()
  const routes = usePermissionStore((state) => state.routes)
  const route = findRoute(location.pathname, routes)
  if (!route)
    return (
      <PageReady>
        <NotFound />
      </PageReady>
    )
  if (route.permissions && !checkPermi(route.permissions))
    return (
      <PageReady>
        <Forbidden />
      </PageReady>
    )
  const View = loadView(route.component)
  return (
    <Suspense fallback={<PageLoading />}>
      <PageReady>
        <View
          route={route}
          params={matchPath(route.path, location.pathname)?.params || {}}
        />
      </PageReady>
    </Suspense>
  )
}
// 公共页面独立注册，其余地址由 Layout 完成登录初始化和动态页面渲染。
const router = createBrowserRouter([
  ...Object.entries(authPages).map(([path, Page]) => ({
    path: `/auth-center/${path}`,
    loader: path === 'error' ? undefined : authCenterLoader,
    hydrateFallbackElement: <SystemLoading />,
    element: (
      <Suspense fallback={<SystemLoading />}>
        <PageReady>
          <Page />
        </PageReady>
      </Suspense>
    ),
  })),
  {
    path: '/login',
    loader: loginLoader,
    element: (
      <PageReady>
        <Login />
      </PageReady>
    ),
  },
  {
    path: '/register',
    element: (
      <PageReady>
        <Register />
      </PageReady>
    ),
  },
  {
    path: '/lock',
    element: (
      <PageReady>
        <Lock />
      </PageReady>
    ),
  },
  {
    path: '/401',
    element: (
      <PageReady>
        <Forbidden />
      </PageReady>
    ),
  },
  { path: '*', element: <Layout /> },
])
export default router
