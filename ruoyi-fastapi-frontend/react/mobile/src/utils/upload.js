import { i18n } from '@/i18n'
import Taro from '@tarojs/taro'
import appConfig from '@/config'
import { getToken } from '@/utils/auth'
import { getDisplayTimezone } from '@/utils/time'
import { toast, tansParams } from '@/utils/common'
import { handleSessionExpired } from './request'
export default async function upload(config) {
  const t = i18n.engine.getFixedT(i18n.locale)
  const header = { ...i18n.headers, 'X-Timezone': getDisplayTimezone(), ...config.header }
  if (getToken() && config.headers?.isToken !== false) header.Authorization = `Bearer ${getToken()}`
  const query = config.params ? tansParams(config.params).replace(/&$/, '') : ''
  try {
    const response = await Taro.uploadFile({
      url: appConfig.baseUrl + config.url + (query ? '?' + query : ''),
      filePath: config.filePath,
      name: config.name || 'file',
      timeout: config.timeout || 20000,
      header,
      formData: config.formData,
    })
    let result
    try {
      result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
    } catch {
      throw new Error(t('mobile:theUploadApiReturnedInvalidData'))
    }
    if (response.statusCode === 401 || result.code === 401) handleSessionExpired()
    if (response.statusCode >= 400 || (result.code ?? 200) !== 200)
      throw new Error(result.msg || t('mobile:uploadFailed'))
    return result
  } catch (error) {
    toast(error.message || error.errMsg || t('mobile:uploadFailed'))
    throw error
  }
}
