import "./style.css";
import { useEffect, useState } from "react";
import { previewJob } from "@/api/monitor/job";
import { formatBusinessTime } from "@/utils/time";

export default function CrontabResult({ expression, timeZone }) {
  const [result, setResult] = useState({ nextRunTimes: [], timeZone }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setResult({ nextRunTimes: [], timeZone });
    const timer = setTimeout(async () => {
      try {
        const response = await previewJob(
          { cronExpression: expression, timeZone, count: 5 },
          controller.signal,
        );
        if (!controller.signal.aborted) setResult(response.data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message || "无法获取运行时间");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [expression, timeZone]);
  return (
    <section className="cron-result" aria-busy={loading}>
      <p>最近 5 次运行时间（{result.timeZone}）</p>
      {error ? (
        <p role="alert" className="cron-preview-error">
          {error}
        </p>
      ) : (
        <ul className="cron-result-list" aria-live="polite">
          {loading ? (
            <li>正在获取运行时间…</li>
          ) : !result.nextRunTimes.length ? (
            <li>没有未来执行时间</li>
          ) : (
            result.nextRunTimes.map((item) => (
              <li key={item}>
                {formatBusinessTime(item, "YYYY-MM-DD HH:mm:ss Z", result.timeZone)}
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
