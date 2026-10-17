import { Menu } from "antd";
import { DownOutlined } from "@ant-design/icons";
import SvgIcon from "@/components/SvgIcon";
import { Link, useLocation } from "react-router-dom";
import { menuItems } from "../Sidebar";
import { firstLeaf, routeLocation } from "@/utils/router";
export default function TopNav({ routes, mixed = false, activeRoot }) {
  const { pathname } = useLocation();
  const items = mixed
    ? routes
        .filter((route) => !route.hidden)
        .map((route) => {
          const target = firstLeaf(route);
          return {
            key: route.path,
            icon: route.meta?.icon ? <SvgIcon iconClass={route.meta.icon} /> : undefined,
            label: /^https?:/.test(target.path) ? (
              <a href={target.path} target="_blank" rel="noreferrer">
                {route.meta?.title}
              </a>
            ) : (
              <Link to={routeLocation(target)}>{route.meta?.title || route.name}</Link>
            ),
          };
        })
    : menuItems(routes);
  return (
    <Menu
      className="layout-top-nav"
      mode="horizontal"
      overflowedIndicator={
        <span>
          更多菜单 <DownOutlined />
        </span>
      }
      selectedKeys={[mixed ? activeRoot?.path : pathname]}
      items={[{ key: "/index", label: <Link to="/index">首页</Link> }, ...items]}
    />
  );
}
