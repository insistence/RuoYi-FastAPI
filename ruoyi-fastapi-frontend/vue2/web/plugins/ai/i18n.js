import { createPluginI18n } from '@/i18n/adapter'
import meta from './locale-meta.json'
import zh from './locales/zh-CN.json'
import en from './locales/en-US.json'

const namespace = 'plugin.ai'
const resources = { 'zh-CN': { [namespace]: zh }, 'en-US': { [namespace]: en } }
export const pluginI18n = createPluginI18n(meta, resources, namespace)
export const { t, useI18n, registerPluginLocales, removePluginLocales } = pluginI18n
