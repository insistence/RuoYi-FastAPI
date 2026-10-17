import useTagsViewStore from "@/store/modules/tagsView";
// 按需获取路由实例，避免初始化阶段与布局、页签模块形成循环依赖。
const currentRouter = async () => (await import("@/router")).default;
// 标签以路径标识；导航地址另行保留查询参数。
const keyOf = (view) =>
  typeof view === "string" ? view.split("?")[0] : view?.key || view?.path || view?.pathname;
const destination = (view) =>
  typeof view === "string"
    ? view
    : view.fullPath || `${view.path}${view.query ? `?${new URLSearchParams(view.query)}` : ""}`;
export default {
  // 刷新指定标签，未指定时刷新当前页面。
  async refreshPage(view) {
    const router = await currentRouter();
    const key = keyOf(view) || router.state.location.pathname;
    // 防止在重定向过程中重复刷新；通过版本号触发页面重新挂载。
    if (!key.startsWith("/redirect/")) useTagsViewStore.getState().refresh(key);
  },
  // 关闭当前标签，并导航到指定页面。
  async closeOpenPage(view) {
    const router = await currentRouter();
    useTagsViewStore.getState().closeView(router.state.location.pathname);
    if (view) await router.navigate(destination(view));
  },
  // 关闭指定标签；省略参数时关闭当前页并回到最后一个标签或首页。
  async closePage(view) {
    const router = await currentRouter();
    const key = keyOf(view) || router.state.location.pathname;
    useTagsViewStore.getState().closeView(key);
    if (!view)
      await router.navigate(useTagsViewStore.getState().visitedViews.at(-1)?.fullPath || "/index");
  },
  // 关闭所有可关闭的标签并返回首页。
  async closeAllPage() {
    const router = await currentRouter();
    useTagsViewStore.getState().closeViews("", "all");
    await router.navigate("/index");
  },
  // 关闭指定标签左侧的可关闭标签，默认以当前页为基准。
  async closeLeftPage(view) {
    const router = await currentRouter();
    useTagsViewStore.getState().closeViews(keyOf(view) || router.state.location.pathname, "left");
  },
  // 关闭指定标签右侧的可关闭标签，默认以当前页为基准。
  async closeRightPage(view) {
    const router = await currentRouter();
    useTagsViewStore.getState().closeViews(keyOf(view) || router.state.location.pathname, "right");
  },
  // 关闭其他可关闭标签，保留指定标签或当前页。
  async closeOtherPage(view) {
    const router = await currentRouter();
    useTagsViewStore.getState().closeViews(keyOf(view) || router.state.location.pathname, "others");
  },
  /**
   * 添加页面标签并导航到对应地址。
   * @param {string} title 标签标题
   * @param {string} path 页面路径
   * @param {Object} [query] 查询参数
   * @returns {Promise<void>}
   */
  async openPage(title, path, query) {
    const router = await currentRouter();
    const fullPath = destination({ path, query });
    useTagsViewStore.getState().addView({ key: path, fullPath, label: title, closable: true });
    await router.navigate(fullPath);
  },
  // 更新已打开标签的标题、地址等信息，不新增不存在的标签。
  updatePage(view) {
    const key = keyOf(view);
    const prior = useTagsViewStore.getState().visitedViews.find((item) => item.key === key);
    if (prior)
      useTagsViewStore.getState().addView({
        ...prior,
        ...view,
        key,
        label: view.label || view.meta?.title || prior.label,
        fullPath: view.fullPath || prior.fullPath,
      });
  },
};
