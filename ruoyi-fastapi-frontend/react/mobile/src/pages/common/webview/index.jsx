import React, { useState } from 'react'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { decodeRouteParam } from '@/utils/routeParams'
import { resolveWebviewUrl } from '@/utils/webview'
import { WebView, View, Text } from '@tarojs/components'
export default function Browser() {
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
      <Text>网页地址无效</Text>
    </View>
  )
}
