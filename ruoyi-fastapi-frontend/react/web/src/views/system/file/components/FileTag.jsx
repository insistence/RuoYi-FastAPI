import { Tag } from "antd";
import "./style.css";

export default function FileTag({ type = "primary", effect = "light", ...props }) {
  return <Tag {...props} className={`file-tag file-tag--${type} file-tag--${effect}`} />;
}
