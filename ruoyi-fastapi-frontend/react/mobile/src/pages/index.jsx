import React from "react";
import { View, Text, Input, Image, ScrollView } from "@tarojs/components";
import { usePageAuth } from "@/permission";
export default function Home() {
  const allowed = usePageAuth();
  if (!allowed) return null;
  return (
    <View className="flex h-full flex-col bg-gray-50">
      <View className="bg-white pb-6 rounded-b-3xl shadow-sm z-50">
        <View className="pt-12 pb-4 px-4 flex justify-center items-center">
          <Text className="text-lg font-bold text-gray-800">
            RuoYi-FastAPI移动端
          </Text>
        </View>

        <View className="px-4 pb-2">
          <View className="flex items-center space-x-3">
            <View className="flex-1 relative">
              <View className="absolute left-3 top-0 bottom-0 flex items-center text-gray-400">
                <View className="i-mdi-magnify text-lg"></View>
              </View>
              <Input
                type="text"
                placeholder="搜索..."
                placeholderClassName="text-gray-400"
                className="w-full h-10 rounded-full bg-gray-100 pl-10 pr-4 text-sm text-gray-800"
              />
            </View>

            <View className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-600 active:scale-95 transition-transform border border-gray-100">
              <View className="i-mdi-bell-outline text-xl"></View>
              <View className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 border border-white"></View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        scrollY
        className="flex-1 overflow-hidden"
        showScrollbar={false}
      >
        <View className="p-4 space-y-5 pb-24">
          <View className="relative overflow-hidden rounded-3xl bg-linear-to-r from-indigo-500 to-purple-600 p-6 text-white shadow-xl shadow-indigo-200">
            <View className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl"></View>
            <View className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/20 blur-2xl"></View>

            <View className="relative z-10">
              <View className="mb-4 flex items-center justify-between">
                <View className="rounded-lg bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  系统运行正常
                </View>
                <View className="text-xs opacity-80">刚刚更新</View>
              </View>
              <View className="flex items-end justify-between">
                <View>
                  <View className="text-3xl font-bold">85%</View>
                  <View className="text-sm opacity-90">工作效率</View>
                </View>
                <View className="h-10 w-24 overflow-hidden rounded-lg bg-white/10 p-1">
                  <View className="h-full w-full flex items-end justify-between px-1">
                    <View className="w-1 bg-white/50 h-2 rounded-full"></View>
                    <View className="w-1 bg-white/70 h-4 rounded-full"></View>
                    <View className="w-1 bg-white/40 h-3 rounded-full"></View>
                    <View className="w-1 bg-white/90 h-6 rounded-full"></View>
                    <View className="w-1 bg-white/60 h-4 rounded-full"></View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View className="grid grid-cols-2 gap-4">
            <View className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 flex items-center justify-between">
              <View>
                <View className="text-xs text-gray-500 mb-1">新通知</View>
                <View className="text-2xl font-bold text-gray-800">12</View>
              </View>
              <View className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                <View className="i-mdi-bell text-xl"></View>
              </View>
            </View>
            <View className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 flex items-center justify-between">
              <View>
                <View className="text-xs text-gray-500 mb-1">待办任务</View>
                <View className="text-2xl font-bold text-gray-800">5</View>
              </View>
              <View className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-500">
                <View className="i-mdi-calendar text-xl"></View>
              </View>
            </View>
          </View>

          <View>
            <View className="mb-4 flex items-center justify-between">
              <View className="text-base font-bold text-gray-800">
                快捷入口
              </View>
            </View>
            <View className="grid grid-cols-4 gap-2 rounded-2xl bg-white p-4 shadow-sm">
              <View className="flex flex-col items-center space-y-2">
                <View className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                  <View className="i-mdi-file-document-edit text-xl"></View>
                </View>
                <View className="text-xs font-medium text-gray-600">申请</View>
              </View>
              <View className="flex flex-col items-center space-y-2">
                <View className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-500">
                  <View className="i-mdi-newspaper text-xl"></View>
                </View>
                <View className="text-xs font-medium text-gray-600">新闻</View>
              </View>
              <View className="flex flex-col items-center space-y-2">
                <View className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
                  <View className="i-mdi-chart-bar text-xl"></View>
                </View>
                <View className="text-xs font-medium text-gray-600">统计</View>
              </View>
              <View className="flex flex-col items-center space-y-2">
                <View className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
                  <View className="i-mdi-calendar text-xl"></View>
                </View>
                <View className="text-xs font-medium text-gray-600">计划</View>
              </View>
            </View>
          </View>

          <View>
            <View className="mb-4 flex items-center justify-between">
              <View className="text-base font-bold text-gray-800">
                最近更新
              </View>
              <View className="text-xs text-blue-500">查看全部</View>
            </View>
            <View className="space-y-3">
              <View className="flex items-center rounded-2xl bg-white p-4 shadow-sm border border-gray-50">
                <View className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
                  <View className="i-mdi-clipboard-text-outline text-xl"></View>
                </View>
                <View className="ml-4 flex-1">
                  <View className="font-bold text-gray-800">请假申请</View>
                  <View className="text-xs text-gray-500">等待经理审批</View>
                </View>
                <View className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-600">
                  待处理
                </View>
              </View>
              <View className="flex items-center rounded-2xl bg-white p-4 shadow-sm border border-gray-50">
                <View className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-500">
                  <View className="i-mdi-newspaper text-xl"></View>
                </View>
                <View className="ml-4 flex-1">
                  <View className="font-bold text-gray-800">周报</View>
                  <View className="text-xs text-gray-500">提交成功</View>
                </View>
                <View className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
                  已完成
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
