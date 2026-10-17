import { useDidShow, useLaunch } from "@tarojs/taro";
import { refreshDeviceTimezone } from "@/utils/time";
import { useConfigStore } from "@/store";
import config from "./config";
import "./app.css";
export default function App({ children }) {
  useLaunch(() => useConfigStore.getState().setConfig(config));
  useDidShow(() => refreshDeviceTimezone());
  return children;
}
