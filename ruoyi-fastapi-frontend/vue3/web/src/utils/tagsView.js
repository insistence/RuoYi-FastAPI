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

/** 兼容旧版数组格式，从当前路由恢复元数据，忽略已经移除或无权访问的路由。 */
export function restoreVisitedViews(snapshot, resolveRoute) {
  const views = Array.isArray(snapshot) ? snapshot : snapshot?.version === 1 ? snapshot.views : []
  if (!Array.isArray(views)) return []
  return views.flatMap((view) => {
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
          customTitle:
            view.customTitle ??
            (view.title && view.title !== view.meta?.title ? view.title : undefined),
        },
      ]
    } catch {
      return []
    }
  })
}
