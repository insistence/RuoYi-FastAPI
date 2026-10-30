import meta from './locale-meta.json'
import zh from './locales/zh-CN/common.json'
import en from './locales/en-US/common.json'
import zhMobile from './locales/zh-CN/mobile.json'
import enMobile from './locales/en-US/mobile.json'

export { meta }
export const resources = {
  'zh-CN': { common: zh, mobile: zhMobile },
  'en-US': { common: en, mobile: enMobile },
}
