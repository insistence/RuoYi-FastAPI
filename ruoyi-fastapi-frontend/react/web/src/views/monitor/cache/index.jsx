import { useEffect, useState } from "react";
import { Col, Row, Spin } from "antd";
import { DesktopOutlined, PieChartOutlined, DashboardOutlined } from "@ant-design/icons";
import { getCache } from "@/api/monitor/cache";
import EChart from "@/components/EChart";
import MonitorPanel, { MetricTable } from "@/components/MonitorPanel";

export default function Cache() {
  const [cache, setCache] = useState({}), [loading,setLoading] = useState(true);
  useEffect(() => { let active = true; getCache().then(result => { if(active) setCache(result.data || {}); }).catch(() => {}).finally(() => { if(active) setLoading(false); }); return () => { active = false; }; }, []);
  const info = cache.info || {};
  const rows = [
    ["Redis版本", info.redis_version, "运行模式", info.redis_mode === "standalone" ? "单机" : "集群", "端口", info.tcp_port, "客户端数", info.connected_clients],
    ["运行时间(天)", info.uptime_in_days, "使用内存", info.used_memory_human, "使用CPU", Number(info.used_cpu_user_children || 0).toFixed(2), "内存配置", info.maxmemory_human],
    ["AOF是否开启", String(info.aof_enabled) === "0" ? "否" : "是", "RDB是否成功", info.rdb_last_bgsave_status, "Key数量", cache.dbSize, "网络入口/出口", `${info.instantaneous_input_kbps || 0}kps/${info.instantaneous_output_kbps || 0}kps`],
  ];
  return <div className="app-container monitor-page"><Spin spinning={loading}><Row gutter={[10, 10]}>
    <Col span={24}><MonitorPanel title="基本信息" icon={<DesktopOutlined />}><MetricTable rows={rows} /></MonitorPanel></Col>
    <Col xs={24} md={12}><MonitorPanel title="命令统计" icon={<PieChartOutlined />}><EChart height={420} option={{ tooltip: { trigger: "item", formatter: "{a} <br/>{b} : {c} ({d}%)" }, series: [{ name: "命令", type: "pie", roseType: "radius", radius: [15, 95], center: ["50%", "38%"], data: cache.commandStats || [], animationEasing: "cubicInOut", animationDuration: 1000 }] }} /></MonitorPanel></Col>
    <Col xs={24} md={12}><MonitorPanel title="内存信息" icon={<DashboardOutlined />}><EChart height={420} option={{ tooltip: { formatter: `{b} <br/>{a} : ${info.used_memory_human || "-"}` }, series: [{ name: "峰值", type: "gauge", min: 0, max: 1000, detail: { formatter: info.used_memory_human || "-" }, data: [{ value: parseFloat(info.used_memory_human) || 0, name: "内存消耗" }] }] }} /></MonitorPanel></Col>
  </Row></Spin></div>;
}
