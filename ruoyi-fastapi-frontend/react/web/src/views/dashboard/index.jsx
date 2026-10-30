import { useI18n } from '@/i18n/adapter'
import { i18n, t } from '@/i18n'
import { Trans } from 'react-i18next'
import './style.css'
import { useEffect, useRef } from 'react'
import { Avatar, Card, Col, Row, Statistic, theme } from 'antd'
import * as echarts from 'echarts'
import { projectNotice, activities, radarData } from './data'
import EditableLinkGroup from './editable-link-group'

export default function Dashboard() {
  const { locale } = useI18n()

  const { token } = theme.useToken()
  const user = {
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png',
    name: '吴彦祖',
  }
  const radarContainer = useRef(null)
  useEffect(() => {
    const names = {
      personal: t('common:dashboard.individual'),
      team: t('common:team'),
      department: t('system:dept.nameShort'),
    }
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
            name: names[name],
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
  }, [locale, token.colorTextSecondary, token.colorBorderSecondary, token.colorSplit])
  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <div className="dashboard-greeting">
          <Avatar
            size={72}
            src={user.avatar}
          />
          <div>
            <h1>{t('common:dashboard.greeting', { name: user.name })}</h1>
            <p>
              {t('common:interactionDesignerAntFinancialBusinessGroupPlatformDivisionTechnology')}
            </p>
          </div>
        </div>
        <div className="dashboard-stats">
          <Statistic
            title={t('common:projects')}
            value={56}
          />
          <Statistic
            title={t('common:teamRanking')}
            value={8}
            suffix="/ 24"
          />
          <Statistic
            title={t('common:projectVisits')}
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
              extra={<a href="">{t('common:allProjects')}</a>}
              title={t('common:projectsInProgress')}
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
              title={t('common:activity')}
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
                        <Trans
                          i18n={i18n.engine}
                          i18nKey={item.messageKey}
                          components={{
                            user: <a className="dashboard-activity-user">{item.user.name}</a>,
                            group: <a href="">{item.group?.name}</a>,
                            project: <a href="">{item.project?.name}</a>,
                          }}
                        />
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
              title={t('common:quickStartShortcuts')}
              className="dashboard-section dashboard-navigation"
            >
              <EditableLinkGroup />
            </Card>
            <Card
              variant="borderless"
              title={t('common:performanceIndex')}
              className="dashboard-section"
            >
              <div
                ref={radarContainer}
                className="dashboard-radar"
                role="img"
                aria-label={t(
                  'common:exampleRadarChartComparingIndividualsTeamsAndDepartmentsAcross'
                )}
              />
            </Card>
            <Card
              variant="borderless"
              title={t('common:team')}
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
