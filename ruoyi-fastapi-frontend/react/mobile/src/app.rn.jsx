import React, { useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
import { useDidShow } from "@tarojs/taro";
import { hydrateStorage } from "@/utils/platformStorage";
import { refreshDeviceTimezone } from "@/utils/time";
import { useConfigStore, useUserStore } from "@/store";
import config from "./config";
export default function App({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const start = async () => {
    try {
      setError("");
      await hydrateStorage();
      useConfigStore.getState().setConfig(config);
      useUserStore.getState().restoreStorage();
      setReady(true);
    } catch {
      setError("无法读取本地账户信息，请重试");
    }
  };
  useEffect(() => {
    start();
  }, []);
  useDidShow(() => refreshDeviceTimezone());
  if (error)
    return (
      <View style={{ padding: 24 }}>
        <Text>{error}</Text>
        <Button title="重试" onPress={start} />
      </View>
    );
  return ready ? children : null;
}
