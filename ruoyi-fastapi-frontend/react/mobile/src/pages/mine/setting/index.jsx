import React, { useState } from "react";
import Taro from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import Button from "@/components/ActionButton";
import { useUserStore } from "@/store";
import { usePageAuth } from "@/permission";
import { toast } from "@/utils/common";
export default function Settings() {
  const allowed = usePageAuth();
  const [busy, setBusy] = useState(false);
  async function logout() {
    if (busy) return;
    const answer = await Taro.showModal({
      title: "提示",
      content: "确定注销并退出系统吗？",
    });
    if (!answer.confirm) return;
    setBusy(true);
    try {
      await useUserStore.getState().logOut();
      await Taro.reLaunch({ url: "/pages/login" });
    } catch {
    } finally {
      setBusy(false);
    }
  }
  if (!allowed) return null;
  return (
    <View className="list-page">
      <View className="bg-white">
        {[
          ["修改密码", "lock", "/pages/mine/pwd/index"],
          ["时区设置", "earth", "/pages/mine/setting/timezone"],
          ["检查更新", "refresh"],
          ["清理缓存", "delete"],
        ].map(([label, icon, url], index) => (
          <View
            key={label}
            className={`flex items-center justify-between px-5 py-4 ${index < 3 ? "border-b border-gray-100" : ""}`}
            onClick={() =>
              url ? Taro.navigateTo({ url }) : toast("模块建设中~")
            }
          >
            <View className="flex items-center">
              <View className={`i-mdi-${icon} text-xl text-gray-600 mr-3`} />
              <Text className="text-base text-gray-800">{label}</Text>
            </View>
            <View className="i-mdi-chevron-right text-base text-gray-400" />
          </View>
        ))}
      </View>
      <View className="mt-8 px-4">
        <Button
          className="mobile-button mobile-button-danger"
          disabled={busy}
          loading={busy}
          onClick={logout}
        >
          退出登录
        </Button>
      </View>
    </View>
  );
}
