import { Activity, useLayoutEffect, useState } from "react";
import { UNSAFE_LocationContext, useLocation } from "react-router-dom";
import { DynamicView, findRoute } from "@/router";
import usePermissionStore from "@/store/modules/permission";
import useSettingsStore from "@/store/modules/settings";
import useTagsViewStore from "@/store/modules/tagsView";

// Hidden pages preserve their state while cleaning up polling and plugin sessions.
// Each cached page receives its own URL instead of the currently visible URL.
export default function AppMain() {
  const targetLocation = useLocation();
  const [displayedLocation, setDisplayedLocation] = useState(targetLocation);
  const [phase, setPhase] = useState("");
  const location = displayedLocation.pathname === targetLocation.pathname ? targetLocation : displayedLocation;
  useLayoutEffect(() => {
    if (displayedLocation.pathname === targetLocation.pathname) {
      setPhase((current) => current === "page-leave" ? "" : current);
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplayedLocation(targetLocation);
      setPhase("");
      return;
    }
    setPhase("page-leave");
    const timeout = setTimeout(() => {
      setDisplayedLocation(targetLocation);
      setPhase("page-enter");
    }, 500);
    return () => clearTimeout(timeout);
  }, [targetLocation, displayedLocation.pathname]);
  const routes = usePermissionStore((state) => state.routes);
  const enabled = useSettingsStore((state) => state.tagsView);
  const { visitedViews, revisions } = useTagsViewStore();
  const [pages, setPages] = useState([]);
  const route = findRoute(location.pathname, routes);
  const cacheable = enabled && !!route && !route.meta?.noCache;
  useLayoutEffect(() => {
    setPages((items) => {
      const allowed = new Set(visitedViews.map((tag) => tag.key));
      let next = items.filter((page) => enabled && allowed.has(page.key));
      if (cacheable) {
        const current = { key: location.pathname, location };
        next = next.some((page) => page.key === current.key)
          ? next.map((page) => (page.key === current.key ? current : page))
          : [...next, current];
      }
      return next;
    });
  }, [location, enabled, visitedViews, cacheable]);
  const visiblePages = pages.filter((page) => page.key !== location.pathname || cacheable);
  if (cacheable && !visiblePages.some((page) => page.key === location.pathname))
    visiblePages.push({ key: location.pathname, location });
  return (
    <main className={`app-main ${phase}`}>
      {visiblePages.map((page) => (
        <Activity
          key={`${page.key}:${revisions[page.key] || 0}`}
          mode={page.key === location.pathname ? "visible" : "hidden"}
        >
          <UNSAFE_LocationContext.Provider
            value={{
              location: page.key === location.pathname ? location : page.location,
              navigationType: "POP",
            }}
          >
            <DynamicView />
          </UNSAFE_LocationContext.Provider>
        </Activity>
      ))}
      {!cacheable && (
        <UNSAFE_LocationContext.Provider value={{ location, navigationType: "POP" }}>
          <DynamicView key={`${location.pathname}:${revisions[location.pathname] || 0}`} />
        </UNSAFE_LocationContext.Provider>
      )}
    </main>
  );
}
