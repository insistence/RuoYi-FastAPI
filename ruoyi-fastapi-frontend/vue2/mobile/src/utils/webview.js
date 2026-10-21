/**
 * 解析 WebView 路由地址，保留 HTTP(S) 外部网页能力。
 * 仅对整体编码的 URL 解码一次，避免改写已解码地址中的嵌套查询参数。
 * @param {string} value 路由传入的网页地址
 * @returns {string} 合法的 HTTP(S) 地址，无效时返回空字符串
 */
export function resolveWebviewUrl(value) {
  if (typeof value !== 'string') return ''
  let url = value.trim()
  if (/^https?%3a%2f%2f/i.test(url)) {
    try {
      url = decodeURIComponent(url)
    } catch {
      return ''
    }
  }
  // 各移动平台的 URL API 支持不同，使用保守的协议与主机检查。
  if (!/^https?:\/\/[^/?#\s]+(?:[/?#]|$)/i.test(url) || /[\u0000-\u0020\u007f\\]/.test(url)) {
    return ''
  }
  return url
}
