import React, { useRef, useState } from "react";
import Taro, { useLoad } from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import Button from "@/components/ActionButton";
import { getUserProfile, updateUserProfile } from "@/api/system/user";
import { useUserStore } from "@/store";
import { usePageAuth } from "@/permission";
import { getToken } from "@/utils/auth";
import FormField from "@/components/FormField";
export default function EditProfile() {
  const allowed = usePageAuth();
  const [user, setUser] = useState({
    nickName: "",
    phonenumber: "",
    email: "",
    sex: "",
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const update = (key, value) => setUser((old) => ({ ...old, [key]: value }));
  async function load() {
    if (!getToken()) return;
    try {
      const { data } = await getUserProfile();
      setUser({
        nickName: data.nickName,
        phonenumber: data.phonenumber,
        email: data.email,
        sex: data.sex,
      });
      setReady(true);
      setError("");
    } catch (failure) {
      setError(failure.message || "资料加载失败");
    }
  }
  useLoad(load);
  async function submit() {
    if (lock.current || !ready) return;
    const message = !user.nickName?.trim()
      ? "用户昵称不能为空"
      : !/^1[3-9]\d{9}$/.test(user.phonenumber)
        ? "请输入正确的手机号码"
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
          ? "请输入正确的邮箱地址"
          : "";
    if (message) {
      setError(message);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await updateUserProfile(user);
      await useUserStore.getState().getInfo();
      await Taro.showToast({ title: "修改成功", icon: "success" });
      Taro.navigateBack();
    } catch (failure) {
      setError(failure.message || "修改失败");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!allowed) return null;
  return (
    <View className="mobile-page bg-white">
      <FormField
        label="用户昵称"
        placeholder="请输入昵称"
        maxlength={30}
        value={user.nickName}
        onChange={(value) => update("nickName", value)}
      />
      <FormField
        label="手机号码"
        placeholder="请输入手机号码"
        type="number"
        maxlength={11}
        value={user.phonenumber}
        onChange={(value) => update("phonenumber", value)}
      />
      <FormField
        label="邮箱"
        placeholder="请输入邮箱"
        maxlength={50}
        value={user.email}
        onChange={(value) => update("email", value)}
      />
      <Text className="mobile-label">性别</Text>
      <View className="flex gap-4" role="group" aria-label="性别">
        {[
          ["0", "男"],
          ["1", "女"],
        ].map(([value, label]) => (
          <Button
            key={value}
            className={`flex flex-1 items-center justify-center rounded-xl border py-2.5 text-sm font-medium ${user.sex === value ? "bg-blue-50 border-blue-500 text-blue-600" : "bg-gray-50 border-transparent text-gray-500"}`}
            aria-pressed={user.sex === value}
            disabled={busy || !ready}
            onClick={() => update("sex", value)}
          >
            {label}
          </Button>
        ))}
      </View>
      {error && <Text className="mobile-error">{error}</Text>}
      {!ready && <Button onClick={load}>重新加载</Button>}
      <Button
        className="mobile-button"
        disabled={busy || !ready}
        loading={busy}
        onClick={submit}
      >
        提 交
      </Button>
    </View>
  );
}
