import errorCode from '@/utils/errorCode'

/**
 * 统一解析 HTTP 状态和业务码，HTTP 失败优先于响应体中的成功码。
 * @param {Object} response 平台原始响应
 * @param {Object} data 已解析或解密的业务响应
 * @returns {{code: number, msg: string}} 统一响应状态
 */
export function getResponseStatus(response, data) {
  const status = Number(response.statusCode ?? response.status ?? 200)
  const code = status < 200 || status >= 300 ? status : Number(data?.code ?? 200)
  const detail = data?.detail
  const detailMessage =
    typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail
            .map((item) => item.msg)
            .filter(Boolean)
            .join('；')
        : ''
  const msg = data?.msg || detailMessage || errorCode[code] || errorCode['default']
  return { code, msg }
}
