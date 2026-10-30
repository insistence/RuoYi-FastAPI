import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React, { useState } from 'react'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { decodeRouteParam } from '@/utils/routeParams'
import { resolveWebviewUrl } from '@/utils/webview'
import { WebView, View, Text } from '@tarojs/components'
export default function Browser() {
  usePageLocale()

  const [params, setParams] = useState({})
  useLoad((options) => {
    setParams({
      title: decodeRouteParam(options.title),
      url: resolveWebviewUrl(options.url),
    })
  })
  useDidShow(() => {
    if (params.title) Taro.setNavigationBarTitle({ title: params.title })
  })
  React.useEffect(() => {
    if (params.title) Taro.setNavigationBarTitle({ title: params.title })
  }, [params.title])
  return params.url ? (
    <WebView src={params.url} />
  ) : (
    <View className="mobile-page">
      <Text>{t('mobile:invalidWebAddress')}</Text>
    </View>
  )
}
