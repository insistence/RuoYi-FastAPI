import { i18n, t } from '@/i18n'
import { handleSessionExpired } from '@/utils/session'
import config from '@/config'
import { getToken } from '@/utils/auth'
import { getDisplayTimezone } from '@/utils/time'
import { getResponseStatus } from '@/utils/response'
import { toast, tansParams } from '@/utils/common'
import {
  decryptTransportErrorResponse,
  decryptTransportResponse,
  encryptTransportRequest,
  invalidateTransportKeyMeta,
  resetTransportRequestConfig,
  shouldRetryTransportWithFreshKey,
} from '@/utils/transportCrypto'

let timeout = 10000
const baseUrl = config.baseUrl

const request = async (config) => {
  // 是否需要设置 token
  const isToken = (config.headers || {}).isToken === false
  config.header = { ...i18n.headers, ...config.header }
  config.headers = config.headers || {}
  config.header['X-Timezone'] = config.header['X-Timezone'] || getDisplayTimezone()
  const token = getToken()
  if (token && !isToken) {
    config.header['Authorization'] = 'Bearer ' + token
  }

  try {
    config = await encryptTransportRequest(config)

    // get请求映射params参数
    if (config.params) {
      let url = config.url + '?' + tansParams(config.params)
      url = url.slice(0, -1)
      config.url = url
    }

    return await new Promise((resolve, reject) => {
      uni.request({
        method: config.method || 'get',
        timeout: config.timeout || timeout,
        url: config.baseUrl || baseUrl + config.url,
        data: config.data,
        header: config.header,
        dataType: 'json',
        success: async (response) => {
          try {
            const res = await decryptTransportResponse(response, config)

            if (shouldRetryTransportWithFreshKey(res) && !config.__transportRetried) {
              invalidateTransportKeyMeta()
              config.__transportRetried = true
              config.headers.repeatSubmit = false
              resetTransportRequestConfig(config)
              resolve(await request(config))
              return
            }

            const { code, msg } = getResponseStatus(res, res.data)
            if (code === 401) {
              handleSessionExpired(isToken ? null : token)
              const error = new Error(t('mobile:errors.sessionInvalid'))
              error.response = res
              reject(error)
            } else if (code === 500) {
              const error = new Error(msg)
              error.response = res
              reject(error)
            } else if (code !== 200) {
              const error = new Error(msg)
              error.response = res
              reject(error)
            } else {
              resolve(res.data)
            }
          } catch (error) {
            reject(error)
          }
        },
        fail: reject,
      })
    })
  } catch (error) {
    error = await decryptTransportErrorResponse(error, config)
    if (shouldRetryTransportWithFreshKey(error) && !config.__transportRetried) {
      invalidateTransportKeyMeta()
      config.__transportRetried = true
      config.headers.repeatSubmit = false
      resetTransportRequestConfig(config)
      return request(config)
    }

    const response = error.response
    const responseStatus = response?.status ?? response?.statusCode
    const responseCode = response?.data?.code
    const responseMsg = response?.data?.msg
    if (responseMsg) {
      uni.showToast({
        title: responseMsg,
        icon: 'none',
        duration: responseStatus === 429 || responseCode === 429 ? 5000 : 3000,
      })
      throw error
    }

    let { message } = error
    if (message === 'Network Error') {
      message = t('common:network.error')
    } else if (message && message.includes('timeout')) {
      message = t('common:network.timeout')
    } else if (message && message.includes('Request failed with status code')) {
      message = t('mobile:errors.httpStatus', { status: message.substr(message.length - 3) })
    }
    if (message) {
      toast(message)
    }
    throw error
  }
}

export default request
