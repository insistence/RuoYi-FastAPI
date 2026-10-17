import { App as AntApp, ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { RouterProvider } from "react-router-dom";
import { useEffect, useLayoutEffect } from "react";
import LoadingProgress from "./components/LoadingProgress";
import { finishSystemLoading } from "./components/SystemLoading";
import router from "./router";
import { bindFeedback } from "./plugins/modal";
import useSettingsStore from "./store/modules/settings";

function Content() {
  const feedback = AntApp.useApp();
  useEffect(() => {
    bindFeedback(feedback);
  }, [feedback]);
  useEffect(() => {
    // Let the router's error screen remain visible if an initial loader/chunk fails.
    const finishOnError = (state) => {
      if (state.errors) finishSystemLoading();
    };
    finishOnError(router.state);
    return router.subscribe(finishOnError);
  }, []);
  return (
    <>
      <LoadingProgress router={router} />
      <RouterProvider router={router} />
    </>
  );
}

export default function App() {
  const { dark, colorPrimary, size } = useSettingsStore();
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return (
    <ConfigProvider
      locale={zhCN}
      componentSize={size}
      theme={{
        cssVar: true,
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary,
          borderRadius: 4,
          colorBgLayout: dark ? "#141414" : "#ffffff",
          colorBgContainer: dark ? "#141414" : "#ffffff",
          colorBgElevated: dark ? "#1d1e1f" : "#ffffff",
          colorText: dark ? "#d0d0d0" : "#606266",
          colorTextSecondary: dark ? "#a3a6ad" : "#909399",
          colorBorderSecondary: dark ? "#434343" : "#ebeef5",
          motionDurationMid: "0.28s",
          motionDurationSlow: "0.3s",
          colorTextHeading: dark ? "#ffffff" : "#303133",
          colorBorder: dark ? "#434343" : "#dcdfe6",
          fontFamily:
            '"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif',
        },
        components: {
          Button: { primaryShadow: "none", defaultShadow: "none", paddingInline: 15, iconGap: 6 },
        },
      }}
    >
      <AntApp>
        <Content />
      </AntApp>
    </ConfigProvider>
  );
}
