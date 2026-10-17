import { create } from 'zustand'
import { getRouters } from '@/api/menu'

/**
 * 将后端菜单树中的相对子路径递归补全为站内绝对路径，保留外链地址。
 * 组件加载由路由模块负责，这里只整理菜单路径及父子关系。
 * @param {Object[]} routes 后端返回的菜单节点
 * @param {string} [parent=""] 父节点路径
 * @returns {Object[]} 路径规范化后的菜单树
 */
export function resolveRoutes(routes, parent = '') {
  return routes.map((route) => {
    const path = /^https?:/.test(route.path)
      ? route.path
      : `${route.path.startsWith('/') ? '' : parent + '/'}${route.path}`.replace(/\/+/g, '/')
    return {
      ...route,
      path,
      children: route.children ? resolveRoutes(route.children, path) : undefined,
    }
  })
}
/**
 * 展平菜单树供页面路由查找使用。
 * @param {Object[]} routes 菜单树
 * @returns {Object[]} 包含各级节点的路由列表
 */
export function flattenRoutes(routes) {
  return routes.flatMap((route) => [route, ...flattenRoutes(route.children || [])])
}
const usePermissionStore = create((set) => ({
  routes: [],
  sidebarRouters: [],
  ready: false,
  // 向后端请求菜单，同时保存用于导航的树和用于页面匹配的平铺列表。
  async generateRoutes() {
    const result = await getRouters()
    const routes = resolveRoutes(result.data)
    set({ routes: flattenRoutes(routes), sidebarRouters: routes, ready: true })
    return routes
  },
  // 清除已加载的菜单与就绪状态，供下一次会话重新初始化。
  reset() {
    set({ routes: [], sidebarRouters: [], ready: false })
  },
}))
export default usePermissionStore
