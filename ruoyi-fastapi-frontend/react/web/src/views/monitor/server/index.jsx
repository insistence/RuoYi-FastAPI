import { useEffect, useState } from 'react'
import { Col, Row, Spin } from 'antd'
import {
  DesktopOutlined,
  DatabaseOutlined,
  CoffeeOutlined,
  HddOutlined,
  ControlOutlined,
} from '@ant-design/icons'
import { getServer } from '@/api/monitor/server'
import { parseTime } from '@/utils/ruoyi'
import MonitorPanel, { MetricTable, usage } from '@/components/MonitorPanel'

export default function Server() {
  const [server, setServer] = useState({}),
    [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getServer()
      .then((result) => {
        if (active) setServer(result.data || {})
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  const { cpu = {}, mem = {}, py = {}, sys = {}, sysFiles = [] } = server
  return (
    <div className="app-container monitor-page">
      <Spin spinning={loading}>
        <Row gutter={[10, 10]}>
          <Col
            xs={24}
            md={12}
          >
            <MonitorPanel
              title="CPU"
              icon={<ControlOutlined />}
            >
              <MetricTable
                headers={['属性', '值']}
                rows={[
                  ['核心数', cpu.cpuNum],
                  ['用户使用率', `${cpu.used ?? 0}%`],
                  ['系统使用率', `${cpu.sys ?? 0}%`],
                  ['当前空闲率', `${cpu.free ?? 0}%`],
                ]}
              />
            </MonitorPanel>
          </Col>
          <Col
            xs={24}
            md={12}
          >
            <MonitorPanel
              title="内存"
              icon={<DatabaseOutlined />}
            >
              <MetricTable
                headers={['属性', '内存', 'Python']}
                rows={[
                  ['total', '总内存'],
                  ['used', '已用内存'],
                  ['free', '剩余内存'],
                  ['usage', '使用率'],
                ].map(([key, label]) => [
                  label,
                  key === 'usage' ? usage(mem[key]) : mem[key],
                  key === 'usage' ? usage(py[key]) : py[key],
                ])}
              />
            </MonitorPanel>
          </Col>
          <Col span={24}>
            <MonitorPanel
              title="服务器信息"
              icon={<DesktopOutlined />}
            >
              <MetricTable
                rows={[
                  ['服务器名称', sys.computerName, '操作系统', sys.osName],
                  ['服务器IP', sys.computerIp, '系统架构', sys.osArch],
                ]}
              />
            </MonitorPanel>
          </Col>
          <Col span={24}>
            <MonitorPanel
              title="Python解释器信息"
              icon={<CoffeeOutlined />}
            >
              <MetricTable
                rows={[
                  ['Python名称', py.name, 'Python版本', py.version],
                  ['启动时间', parseTime(py.startTime), '运行时长', py.runTime],
                  ['安装路径', { span: 3, value: py.home }],
                  ['项目路径', { span: 3, value: sys.userDir }],
                ]}
              />
            </MonitorPanel>
          </Col>
          <Col span={24}>
            <MonitorPanel
              title="磁盘状态"
              icon={<HddOutlined />}
            >
              <MetricTable
                headers={[
                  '盘符路径',
                  '文件系统',
                  '盘符名称',
                  '总大小',
                  '可用大小',
                  '已用大小',
                  '已用百分比',
                ]}
                rows={sysFiles.map((file) => [
                  file.dirName,
                  file.sysTypeName,
                  file.typeName,
                  file.total,
                  file.free,
                  file.used,
                  usage(file.usage),
                ])}
              />
            </MonitorPanel>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
