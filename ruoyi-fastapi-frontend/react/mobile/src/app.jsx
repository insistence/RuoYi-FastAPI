import { I18nextProvider } from 'react-i18next'
import { i18n, refreshDeviceLocale } from '@/i18n'
import { getToken } from '@/utils/auth'
import { useDidShow, useLaunch } from '@tarojs/taro'
import { refreshDeviceTimezone } from '@/utils/time'
import { useConfigStore } from '@/store'
import config from './config'
import './app.css'
export default function App({ children }) {
  useLaunch(() => {
    i18n.initialize(Boolean(getToken()))
    useConfigStore.getState().setConfig(config)
  })
  useDidShow(() => {
    refreshDeviceTimezone()
    refreshDeviceLocale()
  })
  return <I18nextProvider i18n={i18n.engine}>{children}</I18nextProvider>
}
