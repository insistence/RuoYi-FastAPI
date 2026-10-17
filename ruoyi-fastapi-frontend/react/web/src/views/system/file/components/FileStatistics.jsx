import {
  FileOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  LockOutlined,
  ClockCircleOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import "./statistics.css";
import { formatFileSize } from "./fileFormatters";

export default function FileStatistics({ stats = {} }) {
  const percent = (size) =>
    stats.totalSize ? `${((Number(size || 0) / stats.totalSize) * 100).toFixed(Number(size || 0) / stats.totalSize >= 0.1 ? 0 : 1)}%` : "0%";
  const items = [
    [
      "文件总数",
      stats.totalCount || 0,
      `正常 ${stats.activeCount || 0}　回收站 ${stats.deletedCount || 0}`,
    ],
    ["占用空间", formatFileSize(stats.totalSize), "全部文件累计占用"],
    ["公开文件空间", formatFileSize(stats.publicSize), `占总空间 ${percent(stats.publicSize)}`],
    ["受保护文件空间", formatFileSize(stats.privateSize), `占总空间 ${percent(stats.privateSize)}`],
    ["已过期文件", stats.expiredCount || 0, `7天内到期 ${stats.retentionExpiringCount || 0}`],
    ["即将过期授权", stats.aclExpiringCount || 0, "7天内失效的 ACL 项"],
  ];
  const icons = [
    FileOutlined,
    DatabaseOutlined,
    FolderOpenOutlined,
    LockOutlined,
    ClockCircleOutlined,
    KeyOutlined,
  ];
  const colors = ["primary", "purple", "green", "orange", "red", "cyan"];
  return (
    <section className="file-statistics" aria-label="文件概览">
      <div className="file-statistics-header">
        <div>
          <div className="file-statistics-title">文件概览</div>
          <div className="file-statistics-tip">统计数据随当前查询条件实时更新</div>
        </div>
      </div>
      <div className="file-statistics-content">
        {items.map(([title, value, hint], index) => {
          const Icon = icons[index];
          return (
            <div className={"file-stat-item stat-" + colors[index]} key={title}>
              <div className="file-stat-main">
                <div>
                  <div className="file-stat-title">{title}</div>
                  <div className="file-stat-value">{value}</div>
                </div>
                <span className="file-stat-icon">
                  <Icon />
                </span>
              </div>
              <div className="file-stat-extra">{hint}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
