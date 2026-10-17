import { Tag } from "antd";
import "./style.css";

export default function PluginTag({ type = "info", effect = "light", className = "", ...props }) {
  return (
    <Tag
      {...props}
      className={`plugin-result-tag plugin-result-tag--${type} plugin-result-tag--${effect} ${className}`}
    />
  );
}
