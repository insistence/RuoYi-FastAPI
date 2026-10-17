import React, { useState } from "react";
import { useDidShow } from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import Button from "@/components/ActionButton";
import { getUserProfile } from "@/api/system/user";
import { useUserStore } from "@/store";
import { getToken } from "@/utils/auth";
import { formatBusinessTime } from "@/utils/time";
import { usePageAuth } from "@/permission";
export default function UserInfo() {
  const allowed = usePageAuth();
  const [data, setData] = useState({ data: {} });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() {
    if (!getToken()) return;
    setLoading(true);
    setError("");
    try {
      const [, result] = await Promise.all([
        useUserStore.getState().getInfo(),
        getUserProfile(),
      ]);
      setData(result);
    } catch (failure) {
      setError(failure.message || "个人信息加载失败");
    } finally {
      setLoading(false);
    }
  }
  useDidShow(load);
  if (!allowed) return null;
  const fields = [
    ["昵称", data.data.nickName, "account", "bg-blue-50 text-blue-500"],
    ["手机号码", data.data.phonenumber, "phone", "bg-green-50 text-green-500"],
    ["邮箱", data.data.email, "email", "bg-indigo-50 text-indigo-500"],
    ["岗位", data.postGroup, "shield-account", "bg-orange-50 text-orange-500"],
    ["角色", data.roleGroup, "badge-account", "bg-purple-50 text-purple-500"],
    [
      "创建日期",
      formatBusinessTime(data.data.createTime),
      "calendar",
      "bg-pink-50 text-pink-500",
    ],
  ];
  return (
    <View className="list-page">
      <View className="overflow-hidden bg-white shadow-sm">
        {fields.map(([label, value, icon, color], index) => (
          <View
            className={`flex items-center justify-between gap-3 px-5 py-4 ${index < fields.length - 1 ? "border-b border-gray-100" : ""}`}
            key={label}
          >
            <View className="flex items-center shrink-0">
              <View
                className={`flex size-9 items-center justify-center rounded-full ${color}`}
              >
                <View className={`i-mdi-${icon} text-xl`} />
              </View>
              <Text className="ml-3 text-base font-medium text-gray-800">
                {label}
              </Text>
            </View>
            <Text className="text-sm text-gray-500 text-right break-all">
              {value || "-"}
            </Text>
          </View>
        ))}
      </View>
      {error && (
        <>
          <Text className="mobile-error">{error}</Text>
          <Button onClick={load} loading={loading}>
            重试
          </Button>
        </>
      )}
    </View>
  );
}
