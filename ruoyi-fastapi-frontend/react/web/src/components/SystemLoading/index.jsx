import { useLayoutEffect } from "react";
import "./style.css";

export function finishSystemLoading() {
  document.getElementById("app-bootstrap-loader")?.remove();
  document.documentElement.removeAttribute("data-app-booting");
}

// This must be inside Suspense: a loading fallback is not a ready page.
export function PageReady({ children }) {
  useLayoutEffect(() => {
    finishSystemLoading();
  }, []);
  return children;
}

export default function SystemLoading() {
  // Reuse the HTML screen while JS, session information and route modules load.
  if (document.getElementById("app-bootstrap-loader")) return null;
  return (
    <div className="system-loading" role="status" aria-live="polite">
      <div className="system-loading-spinner" aria-hidden="true" />
      <p className="system-loading-title">正在加载系统资源，请耐心等待</p>
    </div>
  );
}
