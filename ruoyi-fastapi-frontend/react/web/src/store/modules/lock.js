import { create } from "zustand";
const key = "react-screen-lock";
// 锁屏返回地址只接受站内路径，避免解锁后跳向外部地址。
function safePath(path) {
  return typeof path === "string" && path.startsWith("/") && !/^\/[\\/]/.test(path)
    ? path
    : "/index";
}
// 恢复持久化锁屏状态，并兼容原 sessionStorage 中的锁屏路径。
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved.isLock === "boolean")
      return { isLock: saved.isLock, lockPath: safePath(saved.lockPath) };
  } catch {}
  const path = sessionStorage.getItem("screenLocked");
  return { isLock: !!path, lockPath: safePath(path) };
}
const useLockStore = create((set) => ({
  ...restore(),
  // 锁定屏幕，同时记录解锁后返回的路径。
  lockScreen(path = "/index") {
    const lockPath = safePath(path);
    const next = { isLock: true, lockPath };
    localStorage.setItem(key, JSON.stringify(next));
    set(next);
  },
  // 解锁屏幕，同时清除两种存储中的锁屏记录。
  unlockScreen() {
    const next = { isLock: false, lockPath: "/index" };
    localStorage.removeItem(key);
    sessionStorage.removeItem("screenLocked");
    set(next);
  },
}));
export default useLockStore;
