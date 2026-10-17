import React from "react";
import Taro from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import { usePageAuth } from "@/permission";
const groups = [
  {
    title: "RuoYi-FastAPI问题",
    icon: "github",
    items: [
      ["RuoYi-FastAPI开源吗？", "开源"],
      ["RuoYi-FastAPI可以商用吗？", "可以"],
      ["RuoYi-FastAPI官网地址多少？", "https://vfadmin.insistence.tech"],
      ["RuoYi-FastAPI文档地址多少？", "https://vfadmin.insistence.tech"],
    ],
  },
  {
    title: "其他问题",
    icon: "help-circle-outline",
    items: [
      ["如何退出登录？", "请点击[我的] - [应用设置] - [退出登录]即可退出登录"],
      [
        "如何修改用户头像？",
        "请点击[我的] - [选择头像] - [点击提交]即可更换用户头像",
      ],
      [
        "如何修改登录密码？",
        "请点击[我的] - [应用设置] - [修改密码]即可修改登录密码",
      ],
    ],
  },
];
export default function Help() {
  const allowed = usePageAuth();
  if (!allowed) return null;
  return (
    <View className="mobile-page bg-gray-50">
      {groups.map((group) => (
        <View key={group.title} className="mb-6">
          <View className="mb-3 ml-2 flex items-center text-base font-bold text-gray-800">
            <View
              className={`i-mdi-${group.icon} mr-2 text-lg text-blue-500`}
            />
            <Text>{group.title}</Text>
          </View>
          <View className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
            {group.items.map(([title, content], index) => (
              <View
                className={`p-4 text-sm text-gray-600 ${index < group.items.length - 1 ? "border-b border-gray-100" : ""}`}
                key={title}
                onClick={() =>
                  Taro.navigateTo({
                    url: `/pages/common/textview/index?title=${encodeURIComponent(title)}&content=${encodeURIComponent(content)}`,
                  })
                }
              >
                <Text>{title}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
