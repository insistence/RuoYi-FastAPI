/** 持久化路由身份和显式自定义标题，不保存翻译后的展示文字。 */
export function serializeVisitedViews(views) {
  return {
    version: 1,
    views: views
      .filter((view) => !view.meta?.affix)
      .map(({ path, fullPath, name, params, query, hash, customTitle }) => ({
        path,
        fullPath,
        name,
        params,
        query,
        hash,
        customTitle,
      })),
  }
}

/** 从当前路由恢复标签，忽略已经移除或无权访问的路由。 */
export function restoreVisitedViews(snapshot, resolveRoute) {
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.views)) return []
  return snapshot.views.flatMap((view) => {
    if (!view || typeof view.path !== 'string') return []
    try {
      const route = resolveRoute(
        view.fullPath || { path: view.path, query: view.query, hash: view.hash }
      )
      if (!route.name || !route.matched.length || (!route.meta.title && !route.meta.titleKey))
        return []
      return [
        {
          ...route,
          meta: { ...route.meta },
          customTitle: view.customTitle,
        },
      ]
    } catch {
      return []
    }
  })
}
