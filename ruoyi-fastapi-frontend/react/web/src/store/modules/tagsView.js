import { create } from 'zustand'
const home = {
  key: '/index',
  fullPath: '/index',
  label: '首页',
  icon: 'dashboard',
  closable: false,
}
// 仅在开启标签持久化时恢复记录，首页固定保留并过滤无效路径。
function restore() {
  try {
    const settings = JSON.parse(localStorage.getItem('react-layout-settings'))?.state
    if (settings?.tagsViewPersist) {
      const tags = JSON.parse(localStorage.getItem('react-visited-views'))
      if (Array.isArray(tags))
        return [
          home,
          ...tags.filter(
            (tag) => tag.key !== '/index' && tag.key?.startsWith('/') && !tag.key.startsWith('//')
          ),
        ]
    }
  } catch {}
  return [home]
}
const useTagsViewStore = create((set, get) => ({
  visitedViews: restore(),
  revisions: {},
  // 以路径键复用已有标签，同时允许更新查询参数和标题。
  addView(view) {
    const tags = get().visitedViews
    const prior = tags.find((tag) => tag.key === view.key)
    if (prior && prior.fullPath === view.fullPath && prior.label === view.label) return
    set({
      visitedViews: prior
        ? tags.map((tag) => (tag.key === view.key ? { ...tag, ...view } : tag))
        : [...tags, view],
    })
  },
  // 固定标签不能通过关闭操作移除。
  closeView(key) {
    set({
      visitedViews: get().visitedViews.filter((tag) => tag.key !== key || !tag.closable),
    })
  },
  // 按左右、其他或全部模式批量关闭，始终保留固定标签。
  closeViews(key, mode) {
    const tags = get().visitedViews
    const index = tags.findIndex((tag) => tag.key === key)
    set({
      visitedViews: tags.filter(
        (tag, i) =>
          !tag.closable ||
          (mode === 'others' && tag.key === key) ||
          (mode === 'left' && i >= index) ||
          (mode === 'right' && i <= index)
      ),
    })
  },
  // 增加页面版本号，让内容区域重新挂载该标签对应的页面。
  refresh(key) {
    set({
      revisions: { ...get().revisions, [key]: (get().revisions[key] || 0) + 1 },
    })
  },
  reset() {
    set({ visitedViews: [home], revisions: {} })
    localStorage.removeItem('react-visited-views')
  },
  persistViews() {
    persistViews(get())
  },
}))
// 标签变化时按当前布局偏好保存或清除持久化记录。
function persistViews(state) {
  try {
    const settings = JSON.parse(localStorage.getItem('react-layout-settings'))?.state
    if (settings?.tagsViewPersist)
      localStorage.setItem('react-visited-views', JSON.stringify(state.visitedViews))
    else localStorage.removeItem('react-visited-views')
  } catch {}
}
useTagsViewStore.subscribe(persistViews)
export default useTagsViewStore
