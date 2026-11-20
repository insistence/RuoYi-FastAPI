/**
 * 为公开配置和公钥请求提取语言协商所需的请求头。
 *
 * @param {Object} headers 发起请求时的请求头
 * @returns {Object} 使用标准字段名的语言请求头
 */
export function localeRequestHeaders(headers = {}) {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'accept-language' && value !== undefined) {
      return { 'Accept-Language': value }
    }
  }
  return {}
}
