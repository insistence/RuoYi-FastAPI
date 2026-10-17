import { useEffect, useState } from "react";
import { Breadcrumb as AntBreadcrumb } from "antd";
import { Link, matchPath, useLocation } from "react-router-dom";
import usePermissionStore from "@/store/modules/permission";
import { findRoute } from "@/router";
import "./style.css";

function findAncestors(routes, path) {
  for (const route of routes) {
    if (route.path === path) return [route];
    const children = findAncestors(route.children || [], path);
    if (children) return [route, ...children];
  }
  return null;
}

function getBreadcrumbs(pathname, routes, sidebarRouters) {
  const home = { path: "/index", meta: { title: "首页" } };
  if (pathname === home.path) return [home];
  const current = findRoute(pathname, routes);
  // Permission routes preserve the menu hierarchy, including absolute child paths.
  // Built-in detail pages are outside that tree, so recover their URL ancestors.
  const matched = findAncestors(sidebarRouters || [], current?.path) || [
    ...routes
      .filter(
        (route) =>
          route.path !== current?.path && matchPath({ path: route.path, end: false }, pathname),
      )
      .sort((a, b) => a.path.split("/").length - b.path.split("/").length),
    ...(current ? [current] : []),
  ];
  const visible = matched.filter(
    (route) => route.path !== home.path && route.meta?.title && route.meta.breadcrumb !== false,
  );
  return [home, ...new Map(visible.map((route) => [route.path, route])).values()].map((route) => ({
    ...route,
    target:
      route.redirect ||
      matchPath({ path: route.path, end: false }, pathname)?.pathname ||
      route.path,
  }));
}

export default function Breadcrumb() {
  const { pathname } = useLocation();
  const routes = usePermissionStore((state) => state.routes);
  const sidebarRouters = usePermissionStore((state) => state.sidebarRouters);
  const [breadcrumbs, setBreadcrumbs] = useState(() =>
    getBreadcrumbs(pathname, routes, sidebarRouters),
  );
  useEffect(() => {
    // Keep the trail visible while TagsView refreshes the active page.
    if (!pathname.startsWith("/redirect/")) {
      setBreadcrumbs(getBreadcrumbs(pathname, routes, sidebarRouters));
    }
  }, [pathname, routes, sidebarRouters]);

  return (
    <AntBreadcrumb
      className="app-breadcrumb"
      aria-label="面包屑"
      separator="/"
      items={breadcrumbs.map((route, index) => {
        const last = index === breadcrumbs.length - 1;
        return {
          key: route.path,
          title:
            last || route.redirect === "noRedirect" ? (
              <span className="no-redirect" aria-current={last ? "page" : undefined}>
                {route.meta.title}
              </span>
            ) : (
              <Link to={route.target}>{route.meta.title}</Link>
            ),
        };
      })}
    />
  );
}
