import { Fragment } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";
import "./style.css";
export default function AccessMap({
  application,
  type = "confidential",
  permissions = [],
  resources = [],
}) {
  const nodes = [
    ["应用", application || "尚未命名", type === "public" ? "网页或移动端应用" : "后端服务应用"],
    [
      "权限",
      permissions.slice(0, 2).join("、") || "尚未选择",
      permissions.length > 2
        ? "另有 " + (permissions.length - 2) + " 项权限"
        : "应用可以申请的信息",
    ],
    [
      "服务",
      resources.slice(0, 2).join("、") || "仅身份信息",
      resources.length > 2 ? "另有 " + (resources.length - 2) + " 个服务" : "令牌可以访问的目标",
    ],
  ];
  return (
    <div className="oauth-access-map">
      {nodes.map(([label, value, hint], index) => (
        <Fragment key={label}>
          {index > 0 && (
            <span className="oauth-access-link" aria-hidden="true">
              <span>{index === 1 ? "申请" : "访问"}</span><ArrowRightOutlined />
            </span>
          )}
          <div className="oauth-access-node">
            <span className="oauth-node-label">{label}</span>
            <strong title={value}>{value}</strong>
            <small title={hint}>{hint}</small>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
