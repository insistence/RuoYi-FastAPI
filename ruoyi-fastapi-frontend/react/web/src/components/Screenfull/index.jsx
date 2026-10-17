import "@/assets/styles/components.css";
import { useEffect, useState } from "react";
import { Button } from "antd";
import { FullscreenExitOutlined, FullscreenOutlined } from "@ant-design/icons";
import { message } from "@/plugins/modal";
export default function Screenfull() {
  const [active, setActive] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const update = () => setActive(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  return (
    <Button
      className="header-icon-button"
      aria-label={active ? "退出全屏" : "全屏"}
      type="text"
      icon={active ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
      onClick={async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else if (document.documentElement.requestFullscreen)
            await document.documentElement.requestFullscreen();
          else message.warning("当前浏览器不支持全屏");
        } catch {
          message.warning("无法切换全屏，请检查浏览器设置");
        }
      }}
    />
  );
}
