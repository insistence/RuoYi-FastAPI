import meta from './locale-meta.json'
import zh from './locales/zh-CN/common.json'
import en from './locales/en-US/common.json'

import zhMobile from './locales/zh-CN/mobile.json'
import enMobile from './locales/en-US/mobile.json'

import zhUtility from './locales/zh-CN/utility.json'
import enUtility from './locales/en-US/utility.json'

export { meta }
export const resources = {
  'zh-CN': { utility: zhUtility, common: zh, mobile: zhMobile },
  'en-US': { utility: enUtility, common: en, mobile: enMobile },
}
