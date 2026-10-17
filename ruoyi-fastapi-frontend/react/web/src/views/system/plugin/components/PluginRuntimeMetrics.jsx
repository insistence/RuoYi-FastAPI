import { ReloadOutlined } from "@ant-design/icons";
import "./style.css";
import { Fragment, useEffect, useState } from "react";
import { Alert, Button, Empty, Spin } from "antd";
import { getPluginRuntimeMetrics } from "@/api/system/plugin";
import PluginTag from "./PluginTag";

export default function PluginRuntimeMetrics({ pluginId }) {
  const [data, setData] = useState(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [updatedAt, setUpdatedAt] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    setData(undefined);
    setUpdatedAt("");
    setError("");
    setLoading(false);
    if (!pluginId) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getPluginRuntimeMetrics(pluginId, controller.signal)
      .then((result) => {
        if (active) {
          setData(result.data);
          setUpdatedAt(new Date().toLocaleTimeString());
        }
      })
      .catch(() => active && setError("运行指标查询失败，请重试。"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      controller.abort();
    };
  }, [pluginId, revision]);
  const dropped = (data?.workers || []).reduce(
    (total, worker) => total + (worker.droppedSeries || 0),
    0,
  );
  return (
    <section className="plugin-metrics" aria-label="插件运行观测" aria-busy={loading}>
      <div className="metrics-toolbar">
        <span role="status">
          {updatedAt ? `查询时间：${updatedAt}` : "查询实际运行进程的累计指标"}
        </span>
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          刷新指标
        </Button>
      </div>
      {error ? (
        <Alert type="error" title={error} showIcon />
      ) : (
        <Spin spinning={loading}>
          {data && (
            <>
              {data.supported !== false && (
                <>
                  <Alert
                    title={
                      data.scope === "reporting_workers"
                        ? `已上报进程：${data.observedWorkers} 个`
                        : "当前仅显示接收本次请求的进程"
                    }
                    description="指标从进程启动后累计，重启会归零；已上报进程不代表全部预期进程。"
                    showIcon
                    type={data.scope === "reporting_workers" ? "info" : "warning"}
                  />
                  <p className="metrics-hint">
                    采样间隔 {data.sampleIntervalSeconds || "-"} 秒，有效期{" "}
                    {data.sampleTtlSeconds || "-"} 秒。耗时包含完整请求或任务，P95
                    为直方图估算上界。
                  </p>
                </>
              )}
              {data.workerLimitReached ||
              data.invalidSnapshots ||
              data.staleSnapshots ||
              dropped ? (
                <Alert
                  showIcon
                  type="warning"
                  title="部分采样未纳入统计"
                  description={`无效 ${data.invalidSnapshots || 0}，过期 ${data.staleSnapshots || 0}，超出指标容量 ${dropped}；进程读取上限${data.workerLimitReached ? "已达到" : "未达到"}。`}
                />
              ) : null}
              {!data.series?.length && (
                <Empty
                  description={
                    data.supported === false
                      ? "当前进程未启用运行观测"
                      : "暂无该插件的运行指标，仅支持已加载的 v2 插件"
                  }
                />
              )}{" "}
              {(data.series || []).map((row) => (
                <article
                  className="metrics-record"
                  key={[row.version, row.digest, row.generation, row.operation].join(":")}
                >
                  <div className="metrics-record-title">
                    <strong>{row.operation}</strong>
                    <PluginTag type="primary" effect="plain">
                      {row.version}
                    </PluginTag>
                  </div>
                  <dl className="metrics-values">
                    {[
                      ["调用", row.started],
                      ["在途", row.active],
                      ["成功", row.succeeded],
                      ["拒绝", row.rejected],
                      ["失败 / 失败率", `${row.failed} / ${row.failureRatePercent}%`],
                      ["取消", row.cancelled],
                      ["超时（计入失败）", row.timedOut],
                      ["平均耗时", `${row.averageDurationMs} ms`],
                      ["P95 估算上界", `${row.p95UpperBoundMs} ms`],
                      ["最大耗时", `${Number(row.durationMaxMs).toFixed(1)} ms`],
                    ].map(([title, value]) => (
                      <div key={title}>
                        <dt>{title}</dt>
                        <dd>{value ?? "-"}</dd>
                      </div>
                    ))}
                  </dl>
                  <details>
                    <summary>版本身份与最近异常</summary>
                    <dl className="metrics-identities">
                      {[
                        ["制品摘要", row.digest || "源码插件"],
                        ["发布代际", row.generation],
                        ["最近异常", row.lastErrorType],
                        ["追踪标识", row.lastErrorRequestId],
                      ].map(([label, children]) => (
                        <Fragment key={label}>
                          <dt>{label}</dt>
                          <dd>{children || "-"}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </details>
                </article>
              ))}
            </>
          )}
        </Spin>
      )}
    </section>
  );
}
