/** 使用文件名作为预览页签，语言资源保留目录以区分同名文件。 */
export function previewFileLabel(path) {
  const filename = path.replace(/\.jinja2$/, '')
  if (filename.endsWith('.po')) {
    return filename.replace(/^backend\/i18n\/catalogs\/([^/]+)\/LC_MESSAGES\//, '$1/')
  }
  return filename.endsWith('.json') ? filename : filename.slice(filename.lastIndexOf('/') + 1)
}

/** 优先打开实体模板，其余预览使用响应中的首个文件。 */
export function initialPreviewFile(files) {
  const names = Object.keys(files)
  return names.find((name) => /(?:^|\/)do\.py\.jinja2$/.test(name)) || names[0] || ''
}

/** 按生成文件的扩展名高亮代码，未知语言以转义后的文本展示。 */
export function highlightPreviewCode(code, path, highlighter) {
  const extension = path
    .replace(/\.jinja2$/, '')
    .split('.')
    .pop()
    .toLowerCase()
  const language = ['js', 'mjs', 'jsx'].includes(extension) ? 'javascript' : extension
  const source = String(code ?? '')
  if (highlighter.getLanguage(language)) {
    return highlighter.highlight(source, { language, ignoreIllegals: true }).value || '&nbsp;'
  }
  return source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '&nbsp;'
}
