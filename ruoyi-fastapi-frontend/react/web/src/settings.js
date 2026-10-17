const defaultSettings = {
  // 网页默认标题；开启 dynamicTitle 后由布局结合当前页面标题更新。
  title: import.meta.env.VITE_APP_TITLE,
  // 是否显示系统布局配置入口。
  showSettings: true,
  // 是否启用暗黑模式。
  dark: false,
  // Ant Design 主题主色。
  colorPrimary: '#409eff',
  // 全局组件尺寸：small、middle 或 large。
  size: 'middle',
  // 是否显示页面标签栏。
  tagsView: true,
  // 是否在重新打开页面时恢复已保存的标签。
  tagsViewPersist: false,
  // 是否在标签上显示菜单图标。
  tagsIcon: false,
  // 标签栏样式：card 为卡片，chrome 为浏览器标签风格。
  tagsViewStyle: 'card',
  // 是否固定顶部导航区域。
  fixedHeader: true,
  // 是否显示导航区域的系统 Logo。
  sidebarLogo: true,
  // 侧边栏主题：dark 为深色，light 为浅色。
  sideTheme: 'dark',
  // 菜单导航模式：1 为左侧，2 为顶部与左侧混合，3 为顶部。
  navType: 1,
  // 是否根据当前页面动态设置网页标题。
  dynamicTitle: false,
  // 是否显示底部版权信息。
  footerVisible: false,
  // 底部版权文本内容。
  footerContent: 'Copyright © 2024-2026 insistence.tech All Rights Reserved.',
}
export default defaultSettings
