/** 模板用文件名展示，直接生成的资源保留路径以区分不同语言。 */
export function previewFileLabel(key) {
  return key.endsWith('.jinja2') ? key.slice(key.lastIndexOf('/') + 1, -'.jinja2'.length) : key
}

/** 使用响应中的真实键定位默认页签，兼容没有 Python 模板的预览。 */
export function initialPreviewFile(files) {
  const keys = Object.keys(files || {})
  return (
    keys.find((key) => key === 'do.py.jinja2' || key.endsWith('/do.py.jinja2')) || keys[0] || ''
  )
}
