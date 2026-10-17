import React from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { View, Text, Image } from "@tarojs/components";
import { useUserStore } from "@/store";
import { getToken } from "@/utils/auth";
import { usePageAuth } from "@/permission";
import { toast } from "@/utils/common";
export default function Mine() {
  const allowed = usePageAuth();
  const name = useUserStore((state) => state.name);
  const avatar = useUserStore((state) => state.avatar);
  useDidShow(() => {
    if (getToken())
      useUserStore
        .getState()
        .getInfo()
        .catch(() => {});
  });
  const go = (url) => Taro.navigateTo({ url });
  if (!allowed) return null;
  return (
    <View className="min-h-screen bg-gray-50">
      <View className="relative overflow-hidden bg-linear-to-r from-blue-500 to-indigo-600 px-6 pt-16 pb-20 text-white shadow-lg">
        <View className="absolute -right-10 -top-10 size-64 rounded-full bg-white/10 blur-3xl" />
        <View className="absolute -bottom-10 -left-10 size-40 rounded-full bg-white/10 blur-2xl" />
        <View className="relative z-10 flex items-center gap-4">
          <View className="shrink-0 overflow-hidden rounded-full border-4 border-white/30 bg-white/20 shadow-xl">
            <Image
              className="block size-20"
              mode="aspectFill"
              src={avatar}
              onClick={() => go("/pages/mine/avatar/index")}
            />
          </View>
          <View onClick={() => go("/pages/mine/info/index")}>
            <Text className="block text-xl font-bold">{name}</Text>
            <View className="flex items-center mt-1 text-sm text-blue-100">
              <Text>查看个人信息</Text>
              <View className="i-mdi-chevron-right ml-1 text-xs" />
            </View>
          </View>
        </View>
      </View>
      <View className="relative z-20 -mt-12 px-4 pb-8">
        <View className="mb-4 rounded-2xl bg-white p-4 shadow-lg grid grid-cols-4 gap-2">
          {[
            ["account-group", "交流群", "bg-pink-50 text-pink-500"],
            ["face-agent", "在线客服", "bg-blue-50 text-blue-500"],
            ["forum", "反馈社区", "bg-purple-50 text-purple-500"],
            ["thumb-up", "点赞我们", "bg-green-50 text-green-500"],
          ].map(([icon, label, color]) => (
            <View
              key={label}
              className="flex flex-col items-center gap-2"
              onClick={() => toast("模块建设中~")}
            >
              <View
                className={`size-12 rounded-full flex items-center justify-center ${color}`}
              >
                <View className={`i-mdi-${icon} text-2xl`} />
              </View>
              <Text className="text-xs font-medium text-gray-600">{label}</Text>
            </View>
          ))}
        </View>
        <View className="overflow-hidden rounded-2xl bg-white shadow-lg">
          {[
            ["account-edit", "编辑资料", "info/edit", "text-blue-500"],
            ["help-circle", "常见问题", "help/index", "text-orange-500"],
            ["heart-outline", "关于我们", "about/index", "text-red-500"],
            ["cog-outline", "应用设置", "setting/index", "text-gray-500"],
          ].map(([icon, label, path, color], index) => (
            <View
              key={path}
              className={`flex items-center justify-between p-4 ${index < 3 ? "border-b border-gray-100" : ""}`}
              onClick={() => go(`/pages/mine/${path}`)}
            >
              <View className="flex items-center gap-3">
                <View className={`i-mdi-${icon} ${color} text-xl`} />
                <Text className="text-base text-gray-700">{label}</Text>
              </View>
              <View className="i-mdi-chevron-right text-gray-400" />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
