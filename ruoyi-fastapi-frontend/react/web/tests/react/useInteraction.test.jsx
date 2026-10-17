import { it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useInteractionContext } from "@/views/auth-center/useInteraction";
import { completeInteraction } from "@/api/authCenter";
vi.mock("@/api/authCenter", () => ({ completeInteraction: vi.fn() }));
it("认证上下文保存并移除片段令牌、保留步骤状态、拒绝伪造完成地址", async () => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/auth-center/consent?interaction=pending-1#csrf=csrf-1");
  const wrapper = ({ children }) => (
    <MemoryRouter initialEntries={["/auth-center/consent?interaction=pending-1"]}>
      {children}
    </MemoryRouter>
  );
  const { result } = renderHook(
    () => ({ context: useInteractionContext(), location: useLocation() }),
    { wrapper },
  );
  expect(window.location.hash).toBe("");
  expect(result.current.context.csrfToken()).toBe("csrf-1");
  await act(async () => result.current.context.goToAction("changePassword"));
  expect(result.current.location.pathname).toBe("/auth-center/change-password");
  expect(result.current.location.search).toBe("?interaction=pending-1");
  await expect(
    result.current.context.followServerRedirect("https://evil.example/complete"),
  ).rejects.toThrow("不受信任");
  expect(completeInteraction).not.toHaveBeenCalled();
  completeInteraction.mockResolvedValueOnce({ data: { redirectUrl: null } });
  await expect(
    result.current.context.followServerRedirect("/auth/interaction/pending-1/complete"),
  ).rejects.toThrow("无效跳转");
  expect(result.current.context.csrfToken()).toBe("csrf-1");
  completeInteraction.mockResolvedValueOnce({
    data: { redirectUrl: "https://client.example/callback?code=test" },
  });
  const realWindow = window,
    assign = vi.fn();
  vi.stubGlobal(
    "window",
    new Proxy(realWindow, {
      get(target, key) {
        return key === "location"
          ? { origin: realWindow.location.origin, assign }
          : Reflect.get(target, key);
      },
    }),
  );
  try {
    await result.current.context.followServerRedirect("/auth/interaction/pending-1/complete");
    expect(completeInteraction).toHaveBeenLastCalledWith("pending-1", "csrf-1");
    expect(assign).toHaveBeenCalledWith("https://client.example/callback?code=test");
    expect(result.current.context.csrfToken()).toBe("");
  } finally {
    vi.unstubAllGlobals();
  }
});
