export function getLoginRedirect(value) {
  if (typeof value !== "string" || !value.startsWith("/") || /^\/[\\/]/.test(value))
    return "/index";
  try {
    const target = new URL(value, "http://localhost");
    const path = decodeURIComponent(target.pathname).replace(/\/+$/, "").toLowerCase();
    if (
      target.origin !== "http://localhost" ||
      /[\\\u0000-\u001f]/.test(value) ||
      path === "/login" ||
      path === "/redirect/login"
    )
      return "/index";
    return target.pathname + target.search + target.hash;
  } catch {
    return "/index";
  }
}

export function routeLocation(route) {
  let query = {};
  try {
    query = typeof route.query === "string" ? JSON.parse(route.query) : route.query || {};
  } catch {}
  const search = new URLSearchParams(query).toString();
  return route.path + (search ? `?${search}` : "");
}
export function firstLeaf(route) {
  const children = route?.children?.filter((item) => !item.hidden);
  return children?.length ? firstLeaf(children[0]) : route;
}
