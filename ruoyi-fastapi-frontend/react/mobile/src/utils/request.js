import { i18n, t } from '@/i18n'
import Taro from '@tarojs/taro'
import appConfig from '@/config'
import { getToken } from '@/utils/auth'
import { getDisplayTimezone } from '@/utils/time'
import errorCode from '@/utils/errorCode'
import { useUserStore } from '@/store/modules/user'
import { toast, tansParams } from '@/utils/common'
import {
  decryptTransportErrorResponse,
  decryptTransportResponse,
  encryptTransportRequest,
  invalidateTransportKeyMeta,
  resetTransportRequestConfig,
  shouldRetryTransportWithFreshKey,
} from '@/utils/transportCrypto'
let expiryPrompt
export function handleSessionExpired() {
  if (!expiryPrompt)
    expiryPrompt = Taro.showModal({
      title: t('common:notice'),
      content: t('common:session.expired'),
      confirmText: t('common:session.signIn'),
      cancelText: t('common:session.stay'),
    })
      .then((result) => {
        if (result.confirm) {
          useUserStore.getState().clear()
          return Taro.reLaunch({ url: '/pages/login' })
        }
      })
      .finally(() => {
        expiryPrompt = null
      })
}
export default async function request(options) {
  let config = options
  config.__locale ??= i18n.locale
  const t = i18n.engine.getFixedT(config.__locale)
  config.header = { ...i18n.headers, 'X-Timezone': getDisplayTimezone(), ...config.header }
  config.headers = { ...config.headers }
  if (getToken() && config.headers.isToken !== false)
    config.header.Authorization = `Bearer ${getToken()}`
  try {
    config = await encryptTransportRequest(config)
    // Preserve the original URL/params for the one-time key-rotation retry.
    const query = config.params ? tansParams(config.params).replace(/&$/, '') : ''
    let url = (config.baseUrl ?? appConfig.baseUrl) + config.url
    if (query) url += (url.includes('?') ? '&' : '?') + query
    const response = await Taro.request({
      url,
      method: (config.method || 'GET').toUpperCase(),
      timeout: config.timeout || 10000,
      data: config.data,
      header: config.header,
      dataType: 'json',
    })
    const result = await decryptTransportResponse(response, config)
    if (shouldRetryTransportWithFreshKey(result) && !config.__transportRetried) return retry(config)
    const code = result.data?.code ?? result.statusCode
    if (code !== 200 || result.statusCode >= 400) {
      const error = new Error(
        result.data?.msg ||
          errorCode(t)[code] ||
          t('mobile:apiRequestFailedWithStatusValue', { statusCode: result.statusCode })
      )
      error.response = result
      if (code === 401 || result.statusCode === 401) handleSessionExpired()
      throw error
    }
    return result.data
  } catch (caught) {
    const error = await decryptTransportErrorResponse(caught, config)
    if (shouldRetryTransportWithFreshKey(error) && !config.__transportRetried) return retry(config)
    const message =
      error.response?.data?.msg || error.message || error.errMsg || t('common:network.error')
    toast(message.includes('timeout') ? t('common:network.timeout') : message)
    throw error
  }
}
function retry(config) {
  invalidateTransportKeyMeta()
  config.__transportRetried = true
  resetTransportRequestConfig(config)
  return request(config)
}
