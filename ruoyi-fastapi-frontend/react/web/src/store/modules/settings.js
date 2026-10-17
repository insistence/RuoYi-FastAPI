import { create } from "zustand";
import { persist } from "zustand/middleware";
import defaultSettings from "@/settings";
import useAppStore from "./app";
export { defaultSettings };

// 只有这些布局选项进入显式保存的快照；外观偏好独立持久化。
const layoutKeys = [
  "navType",
  "sideTheme",
  "colorPrimary",
  "tagsView",
  "tagsViewPersist",
  "tagsIcon",
  "tagsViewStyle",
  "fixedHeader",
  "sidebarLogo",
  "dynamicTitle",
  "footerVisible",
];
const pickLayout = (state) => Object.fromEntries(layoutKeys.map((key) => [key, state[key]]));
// 读取独立保存的暗黑模式和组件尺寸偏好。
function readAppearance() {
  try {
    return JSON.parse(localStorage.getItem("react-appearance-settings")) || {};
  } catch {
    return {};
  }
}
function saveAppearance({ dark, size }) {
  localStorage.setItem("react-appearance-settings", JSON.stringify({ dark, size }));
}

const useSettingsStore = create(
  persist(
    (set, get) => ({
      ...defaultSettings,
      ...readAppearance(),
      savedLayout: pickLayout(defaultSettings),
      // 布局变更即时预览；暗黑模式和组件尺寸在变更时立即保存。
      update: (patch) => {
        const previousNavType = get().navType;
        set(patch);
        if (patch.navType !== undefined && patch.navType !== previousNavType)
          useAppStore.getState().setSidebarOpened(patch.navType !== 3);
        if (patch.dark !== undefined || patch.size !== undefined) saveAppearance(get());
      },
      // 显式保存当前布局；关闭标签持久化时清除已有的标签记录。
      save: () => {
        set({ savedLayout: pickLayout(get()) });
        if (!get().tagsViewPersist) localStorage.removeItem("react-visited-views");
      },
      reset: () => {
        // 恢复默认布局，同时保留独立的暗黑模式和组件尺寸偏好。
        saveAppearance(get());
        set({ ...pickLayout(defaultSettings), savedLayout: pickLayout(defaultSettings) });
        useSettingsStore.persist.clearStorage();
        localStorage.removeItem("react-visited-views");
        useAppStore.getState().setSidebarOpened(true);
      },
    }),
    {
      name: "react-layout-settings",
      // 布局只持久化已保存的快照，避免把尚未点击保存的预览设置写入存储。
      partialize: ({ savedLayout, dark, size }) => ({ ...savedLayout, dark, size }),
      // 合并默认值与已保存布局，再应用独立存储的最新外观偏好。
      merge: (persisted, current) => {
        const savedLayout = pickLayout({ ...defaultSettings, ...persisted });
        return {
          ...current,
          ...savedLayout,
          dark: persisted?.dark ?? current.dark,
          size: persisted?.size ?? current.size,
          ...readAppearance(),
          savedLayout,
        };
      },
    },
  ),
);
export default useSettingsStore;
