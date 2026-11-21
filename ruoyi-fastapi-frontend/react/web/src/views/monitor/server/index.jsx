import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

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
                headers={[t('monitor:property'), t('monitor:value')]}
                rows={[
                  [t('monitor:cpuCores'), cpu.cpuNum],
                  [t('monitor:userCpuUsage'), `${cpu.used ?? 0}%`],
                  [t('monitor:systemCpuUsage'), `${cpu.sys ?? 0}%`],
                  [t('monitor:idleCpu'), `${cpu.free ?? 0}%`],
                ]}
              />
            </MonitorPanel>
          </Col>
          <Col
            xs={24}
            md={12}
          >
            <MonitorPanel
              title={t('monitor:memory')}
              icon={<DatabaseOutlined />}
            >
              <MetricTable
                headers={[t('monitor:property'), t('monitor:memory'), 'Python']}
                rows={[
                  ['total', t('monitor:totalMemory')],
                  ['used', t('monitor:server.usedMemory')],
                  ['free', t('monitor:availableMemory')],
                  ['usage', t('monitor:usage')],
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
              title={t('monitor:serverInformation')}
              icon={<DesktopOutlined />}
            >
              <MetricTable
                rows={[
                  [t('monitor:serverName'), sys.computerName, t('monitor:server.os'), sys.osName],
                  [
                    t('monitor:serverIp'),
                    sys.computerIp,
                    t('monitor:systemArchitecture'),
                    sys.osArch,
                  ],
                ]}
              />
            </MonitorPanel>
          </Col>
          <Col span={24}>
            <MonitorPanel
              title={t('monitor:pythonInterpreter')}
              icon={<CoffeeOutlined />}
            >
              <MetricTable
                rows={[
                  [t('monitor:pythonName'), py.name, t('monitor:pythonVersion'), py.version],
                  [
                    t('monitor:startedAt'),
                    parseTime(py.startTime),
                    t('monitor:uptime'),
                    py.runTime,
                  ],
                  [t('monitor:installationPath'), { span: 3, value: py.home }],
                  [t('monitor:projectPath'), { span: 3, value: sys.userDir }],
                ]}
              />
            </MonitorPanel>
          </Col>
          <Col span={24}>
            <MonitorPanel
              title={t('monitor:diskStatus')}
              icon={<HddOutlined />}
            >
              <MetricTable
                headers={[
                  t('monitor:mountPath'),
                  t('monitor:fileSystem'),
                  t('monitor:volumeName'),
                  t('monitor:totalSize'),
                  t('monitor:availableSpace'),
                  t('monitor:usedSpace'),
                  t('monitor:usedPercentage'),
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
