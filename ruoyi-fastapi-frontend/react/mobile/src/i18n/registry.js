import meta from './locale-meta.json'
import zhAuth from './locales/zh-CN/auth.json'
import enAuth from './locales/en-US/auth.json'
import zhCommon from './locales/zh-CN/common.json'
import enCommon from './locales/en-US/common.json'
import zhMobile from './locales/zh-CN/mobile.json'
import enMobile from './locales/en-US/mobile.json'
import zhUtility from './locales/zh-CN/utility.json'
import enUtility from './locales/en-US/utility.json'

export { meta }
export const resources = {
  'zh-CN': { auth: zhAuth, common: zhCommon, mobile: zhMobile, utility: zhUtility },
  'en-US': { auth: enAuth, common: enCommon, mobile: enMobile, utility: enUtility },
}
