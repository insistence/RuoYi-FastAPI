import createDOMPurify from 'dompurify'

const purifier = createDOMPurify(window)
purifier.addHook('uponSanitizeAttribute', (node, data) => {
  if (
    node.tagName === 'IFRAME' &&
    data.attrName === 'src' &&
    !/^https?:\/\/[^/?#\s]+/i.test(data.attrValue)
  ) {
    data.keepAttr = false
  }
  if (data.attrName === 'href' || data.attrName === 'src') {
    // 显式限制包括图片 data URI 在内的所有链接协议。
    const value = data.attrValue.replace(/[\u0000-\u0020\u007f-\u009f]/g, '')
    const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i)
    if (scheme && !['http', 'https', 'mailto'].includes(scheme[1].toLowerCase())) {
      data.keepAttr = false
    }
  }
})

purifier.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'IFRAME') {
    // 保留 Quill 视频能力，禁止嵌入页面访问父页面及同源存储。
    node.setAttribute('sandbox', 'allow-scripts allow-presentation')
    node.setAttribute('referrerpolicy', 'no-referrer')
  }
  if (!node.hasAttribute('style')) return
  // 保留编辑器使用的文本格式，剔除定位、背景资源等非正文样式。
  const properties = ['color', 'background-color', 'font-size', 'font-family', 'text-align']
  const styles = properties.map((property) => [property, node.style.getPropertyValue(property)])
  node.removeAttribute('style')
  for (const [property, value] of styles) {
    if (value) node.style.setProperty(property, value)
  }
})

/**
 * 清洗公告正文，与后端 notice_html_util 的富文本白名单保持一致。
 * @param {string} content 原始公告正文
 * @returns {string} 可安全渲染的公告正文
 */
export function sanitizeNoticeHtml(content) {
  return purifier.sanitize(content || '', {
    ALLOWED_TAGS:
      'p br div span h1 h2 h3 h4 h5 h6 strong b em i u s strike sub sup blockquote pre code ul ol li hr table thead tbody tfoot tr th td a img iframe'.split(
        ' '
      ),
    ALLOWED_ATTR: [
      'class',
      'title',
      'style',
      'href',
      'src',
      'alt',
      'width',
      'height',
      'colspan',
      'rowspan',
      'start',
      'rel',
      'sandbox',
      'referrerpolicy',
      'frameborder',
      'allowfullscreen',
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  })
}
