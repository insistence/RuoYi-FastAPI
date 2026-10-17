const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/
const VIEW_SEGMENT_PATTERN = /^[a-z][a-z0-9_-]*$/
/**
 * 将后端菜单中的插件组件路径转换为 React 页面在 Vite glob 模块表中的键。
 * @param {string} view 组件路径，格式为 plugin/<pluginId>/<viewPath>
 * @returns {string} 对应的 .jsx 模块路径；插件标识或路径片段不合法时返回空字符串
 */
export function resolvePluginViewPath(view) {
  if (typeof view !== 'string') return ''
  const [kind, plugin, ...segments] = view.replace(/^\/+/, '').split('/')
  if (
    kind !== 'plugin' ||
    !PLUGIN_ID_PATTERN.test(plugin) ||
    !segments.length ||
    !segments.every((segment) => VIEW_SEGMENT_PATTERN.test(segment))
  )
    return ''
  return `../../plugins/${plugin}/views/${segments.join('/')}.jsx`
}
