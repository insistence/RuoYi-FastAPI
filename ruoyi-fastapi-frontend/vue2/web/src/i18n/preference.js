import request from '@/utils/request'
import { getInfo } from '@/api/login'
import { i18n } from './index'

/**
 * 保存当前账号或访客的语言偏好。
 *
 * @param {string} preference 语言标识或 auto
 * @returns {Promise<void>} 偏好保存与界面切换结果
 */
export function saveLocale(preference) {
  return i18n.setPreference(preference, {
    save: (locale) =>
      request({ url: '/system/user/profile/locale', method: 'put', data: { locale } }),
    readBack: async () => (await getInfo()).user?.locale,
  })
}
