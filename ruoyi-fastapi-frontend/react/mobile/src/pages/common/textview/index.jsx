import React, { useState } from "react";
import Taro, { useLoad, useDidShow } from "@tarojs/taro";
import { decodeRouteParam } from "@/utils/routeParams";
import { View, Text } from "@tarojs/components";
import { usePageAuth } from "@/permission";
export default function TextView() {
  const allowed = usePageAuth();
  const [params, setParams] = useState({});
  useLoad((options) => {
    setParams({
      title: decodeRouteParam(options.title),
      content: decodeRouteParam(options.content),
    });
  });
  useDidShow(() => {
    if (params.title) Taro.setNavigationBarTitle({ title: params.title });
  });
  React.useEffect(() => {
    if (params.title) Taro.setNavigationBarTitle({ title: params.title });
  }, [params.title]);
  if (!allowed) return null;
  return (
    <View className="mobile-page">
      <View className="mobile-card">
        <Text className="block text-lg font-bold mb-3 border-b border-gray-100 pb-2">
          {params.title}
        </Text>
        <Text className="block text-sm text-gray-600 leading-relaxed">
          {params.content}
        </Text>
      </View>
    </View>
  );
}
