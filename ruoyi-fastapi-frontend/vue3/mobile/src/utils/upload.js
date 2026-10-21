import { handleSessionExpired } from '@/utils/session'
import config from '@/config'
import { getToken } from '@/utils/auth'
import { getResponseStatus } from '@/utils/response'
import { toast, tansParams } from '@/utils/common'

let timeout = 10000
const baseUrl = config.baseUrl

export default function upload(config) {
  // 是否需要设置 token
  const isToken = (config.headers || {}).isToken === false
  config.header = config.header || {}
  const token = getToken()
  if (token && !isToken) {
    config.header['Authorization'] = 'Bearer ' + token
  }
  // get请求映射params参数
  if (config.params) {
    let url = config.url + '?' + tansParams(config.params)
    url = url.slice(0, -1)
    config.url = url
  }
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      timeout: config.timeout || timeout,
      url: baseUrl + config.url,
      filePath: config.filePath,
      name: config.name || 'file',
      header: config.header,
      formData: config.formData,
      success: (res) => {
        try {
          const result = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          if (!result || typeof result !== 'object') {
            throw new Error('上传响应格式不正确')
          }
          const { code, msg } = getResponseStatus(res, result)
          if (code === 200) {
            resolve(result)
          } else if (code == 401) {
            handleSessionExpired(isToken ? null : token)
            reject('无效的会话，或者会话已过期，请重新登录。')
          } else if (code === 500) {
            toast(msg)
            reject('500')
          } else if (code !== 200) {
            toast(msg)
            reject(code)
          }
        } catch (error) {
          toast('上传响应格式不正确')
          reject(error)
        }
      },
      fail: (error) => {
        let message = String(error?.message || error?.errMsg || '上传失败')
        if (message == 'Network Error') {
          message = '后端接口连接异常'
        } else if (message.includes('timeout')) {
          message = '系统接口请求超时'
        } else if (message.includes('Request failed with status code')) {
          message = '系统接口' + message.substr(message.length - 3) + '异常'
        }
        toast(message)
        const uploadError = error instanceof Error ? error : new Error(message)
        if (uploadError !== error) uploadError.cause = error
        reject(uploadError)
      },
    })
  })
}
