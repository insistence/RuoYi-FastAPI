import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import PluginConfigStatus from "@/views/system/plugin/components/PluginConfigStatus";
import PluginRuntimeMetrics from "@/views/system/plugin/components/PluginRuntimeMetrics";
import { getPluginConfigStatus, getPluginRuntimeMetrics } from "@/api/system/plugin";
vi.mock("@/api/system/plugin", () => ({
  getPluginConfigStatus: vi.fn(),
  getPluginRuntimeMetrics: vi.fn(),
}));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
beforeEach(() => vi.clearAllMocks());
describe("插件异步状态迁移回归", () => {
  it("配置切换取消旧请求，保存后清空旧状态，忽略迟到响应，失败后可重试", async () => {
    const calls = [];
    getPluginConfigStatus.mockImplementation((id, signal) => {
      const call = { ...deferred(), id, signal };
      calls.push(call);
      return call.promise;
    });
    const view = render(<PluginConfigStatus pluginId="first" />);
    view.rerender(<PluginConfigStatus pluginId="second" />);
    expect(calls[0].signal.aborted).toBe(true);
    await act(async () =>
      calls[1].resolve({ data: { state: "restart_required", pendingWorkers: 2 } }),
    );
    expect(screen.getByText("2 个已观测进程的启动配置待重启更新")).toBeTruthy();
    await act(async () =>
      calls[0].resolve({ data: { state: "observed_match", matchedWorkers: 99 } }),
    );
    expect(screen.queryByText(/99 个/)).toBeNull();
    view.rerender(<PluginConfigStatus pluginId="second" refreshKey={1} />);
    expect(screen.queryByText("2 个已观测进程的启动配置待重启更新")).toBeNull();
    await act(async () => calls[2].reject(new Error("unavailable")));
    expect(screen.getByText(/配置状态查询失败/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /刷新状态/ }));
    expect(screen.queryByText(/配置状态查询失败/)).toBeNull();
    await act(async () =>
      calls[3].resolve({ data: { state: "observed_match", matchedWorkers: 3 } }),
    );
    expect(screen.getByText("3 个已观测进程的启动配置与保存版本匹配")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /刷新状态/ }));
    view.unmount();
    expect(calls[4].signal.aborted).toBe(true);
    await act(async () => calls[4].resolve({ data: {} }));
  });
  it("运行指标切换取消请求并清除旧展示，错误后可重试且卸载取消请求", async () => {
    const calls = [];
    getPluginRuntimeMetrics.mockImplementation((id, signal) => {
      const call = { ...deferred(), id, signal };
      calls.push(call);
      return call.promise;
    });
    const view = render(<PluginRuntimeMetrics pluginId="first" />);
    view.rerender(<PluginRuntimeMetrics pluginId="second" />);
    expect(calls[0].signal.aborted).toBe(true);
    await act(async () => calls[1].resolve({ data: { supported: false, series: [] } }));
    await act(async () => calls[0].reject(new Error("stale")));
    expect(screen.queryByText(/运行指标查询失败/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /刷新指标/ }));
    await act(async () => calls[2].reject(new Error("unavailable")));
    expect(screen.getByText(/运行指标查询失败/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /刷新指标/ }));
    expect(screen.queryByText(/运行指标查询失败/)).toBeNull();
    view.unmount();
    expect(calls[3].signal.aborted).toBe(true);
    await act(async () => calls[3].resolve({ data: { series: [] } }));
  });
});
