/** 模板用文件名展示，语言资源保留语言目录以区分同名文件。 */
export function previewFileLabel(key) {
  if (key.endsWith('.po')) {
    return key.replace(/^backend\/i18n\/catalogs\/([^/]+)\/LC_MESSAGES\//, '$1/')
  }
  return key.endsWith('.jinja2') ? key.slice(key.lastIndexOf('/') + 1, -'.jinja2'.length) : key
}

/** 使用响应中的真实键定位默认页签，兼容没有 Python 模板的预览。 */
export function initialPreviewFile(files) {
  const keys = Object.keys(files || {})
  return (
    keys.find((key) => key === 'do.py.jinja2' || key.endsWith('/do.py.jinja2')) || keys[0] || ''
  )
}
