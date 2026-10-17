import './style.css'
import { useEffect, useRef } from 'react'
import { Avatar, Card, Col, Row, Statistic, theme } from 'antd'
import * as echarts from 'echarts'
import { projectNotice, activities, radarData } from './data'
import EditableLinkGroup from './editable-link-group'

export default function Dashboard() {
  const { token } = theme.useToken()
  const user = {
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png',
    name: '吴彦祖',
  }
  const radarContainer = useRef(null)
  useEffect(() => {
    const chart = echarts.init(radarContainer.current)
    const labels = [...new Set(radarData.map((item) => item.label))]
    chart.setOption({
      color: ['#5b8ff9', '#5ad8a6', '#5d7092'],
      tooltip: {},
      legend: {
        bottom: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: token.colorTextSecondary, fontSize: 12 },
      },
      radar: {
        indicator: labels.map((name, index) => ({
          name,
          min: 0,
          max: 10,
          axisLabel: {
            show: index === 0,
            color: token.colorTextSecondary,
            fontSize: 12,
            formatter: (value) => value || '',
          },
        })),
        shape: 'circle',
        clockwise: true,
        center: ['50%', '45%'],
        radius: '80%',
        splitNumber: 4,
        axisNameGap: 12,
        axisName: { color: token.colorTextSecondary, fontSize: 12 },
        axisLine: { lineStyle: { color: token.colorBorderSecondary } },
        splitLine: { lineStyle: { color: token.colorSplit } },
        splitArea: { show: false },
      },
      series: [
        {
          type: 'radar',
          symbol: 'emptyCircle',
          symbolSize: 8,
          lineStyle: { width: 2 },
          data: [...new Set(radarData.map((item) => item.name))].map((name) => ({
            name,
            value: labels.map(
              (label) => radarData.find((item) => item.name === name && item.label === label).value
            ),
          })),
        },
      ],
    })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(radarContainer.current)
    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [token.colorTextSecondary, token.colorBorderSecondary, token.colorSplit])
  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <div className="dashboard-greeting">
          <Avatar
            size={72}
            src={user.avatar}
          />
          <div>
            <h1>早安，{user.name}，祝你开心每一天！</h1>
            <p>交互专家 |蚂蚁金服－某某某事业群－某某平台部－某某技术部－UED</p>
          </div>
        </div>
        <div className="dashboard-stats">
          <Statistic
            title="项目数"
            value={56}
          />
          <Statistic
            title="团队内排名"
            value={8}
            suffix="/ 24"
          />
          <Statistic
            title="项目访问"
            value={2223}
          />
        </div>
      </div>
      <div className="dashboard-content">
        <Row gutter={24}>
          <Col
            xs={24}
            xl={16}
          >
            <Card
              variant="borderless"
              extra={<a href="">全部项目</a>}
              title="进行中的项目"
              className="dashboard-section dashboard-projects"
            >
              {projectNotice.map((item) => (
                <Card.Grid
                  key={item.id}
                  className="dashboard-project"
                >
                  <Card
                    variant="borderless"
                    styles={{ body: { padding: 0 } }}
                  >
                    <Card.Meta
                      description={item.description}
                      title={
                        <div className="dashboard-project-heading">
                          <Avatar
                            src={item.logo}
                            size="small"
                          />
                          <a href={item.href}>{item.title}</a>
                        </div>
                      }
                    />
                    <div className="dashboard-project-meta">
                      <a href={item.memberLink}>{item.member}</a>
                      <time title={item.updatedAt}>{item.updatedAt}</time>
                    </div>
                  </Card>
                </Card.Grid>
              ))}
            </Card>
            <Card
              variant="borderless"
              title="动态"
              className="dashboard-activities"
            >
              <ul>
                {activities.map((item) => (
                  <li
                    key={item.id}
                    className="dashboard-activity"
                  >
                    <Avatar src={item.user.avatar} />
                    <div>
                      <p>
                        <a className="dashboard-activity-user">{item.user.name}</a> {item.template1}{' '}
                        <a href="">{item.group?.name}</a> {item.template2}{' '}
                        <a href="">{item.project?.name}</a>
                      </p>
                      <time title={item.updatedAt}>{item.updatedAt}</time>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </Col>
          <Col
            xs={24}
            xl={8}
          >
            <Card
              variant="borderless"
              title="快速开始 / 便捷导航"
              className="dashboard-section dashboard-navigation"
            >
              <EditableLinkGroup />
            </Card>
            <Card
              variant="borderless"
              title="XX 指数"
              className="dashboard-section"
            >
              <div
                ref={radarContainer}
                className="dashboard-radar"
                role="img"
                aria-label="个人、团队和部门在引用、口碑、产量、贡献、热度五个维度的示例雷达图"
              />
            </Card>
            <Card
              variant="borderless"
              title="团队"
              className="dashboard-teams"
            >
              <Row gutter={48}>
                {projectNotice.map((item) => (
                  <Col
                    span={12}
                    key={item.id}
                  >
                    <a
                      className="dashboard-team"
                      href={item.href}
                    >
                      <Avatar
                        src={item.logo}
                        size="small"
                      />
                      <span>{item.member}</span>
                    </a>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  )
}
