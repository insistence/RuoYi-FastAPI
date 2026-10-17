import { Typography } from "antd";
import {
  AppstoreOutlined,
  ApiOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import "./entities.css";
const icons = {
  application: AppstoreOutlined,
  resource: ApiOutlined,
  key: KeyOutlined,
  scope: SafetyCertificateOutlined,
  person: UserOutlined,
};
export default function EntityCell({
  name,
  detail,
  kind = "application",
  copyable = false,
  large = false,
}) {
  const Icon = icons[kind] || AppstoreOutlined;
  return (
    <div className={"oauth-entity-cell " + kind + (large ? " is-large" : "")}>
      <span className="entity-mark">
        {kind === "application" ? String(name || "应").slice(0,1) : <Icon />}
      </span>
      <div className="entity-copy">
        <Typography.Text strong>{name || "—"}</Typography.Text>
        {detail != null && (
          <Typography.Text type="secondary" copyable={false}>
            {detail}
          </Typography.Text>
        )}
      </div>
    </div>
  );
}
