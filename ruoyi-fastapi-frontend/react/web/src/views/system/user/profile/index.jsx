import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useEffect, useState } from 'react'
import { Card, Col, Row, Tabs } from 'antd'
import { PageLoading } from '@/components/LoadingProgress'
import { getUserProfile } from '@/api/system/user'
import { parseTime } from '@/utils/ruoyi'
import useUserStore from '@/store/modules/user'
import SvgIcon from '@/components/SvgIcon'
import UserAvatar from './userAvatar'
import UserInfo from './userInfo'
import ResetPwd from './resetPwd'
import TimezoneSettings from './timezoneSettings'
import './style.css'
export default function Profile({ params = {} }) {
  useI18n()

  const [result, setResult] = useState(null),
    [selectedTab, setSelectedTab] = useState(params.activeTab || 'userinfo')
  async function getUser() {
    try {
      const result = await getUserProfile()
      setResult(result)
      useUserStore.getState().applyTimezone(result.data.timeZone)
    } catch {}
  }
  useEffect(() => {
    void getUser()
  }, [])
  if (!result) return <PageLoading />
  const user = result.data
  return (
    <div className="app-container profile-page">
      <Row gutter={20}>
        <Col
          xs={24}
          md={6}
        >
          <Card
            title={t('system:profile')}
            className="profile-card"
          >
            <div className="profile-avatar">
              <UserAvatar />
            </div>
            <ul className="profile-info-list">
              {[
                ['user', t('system:user.username'), user.userName],
                ['phone', t('system:user.phone'), user.phonenumber],
                ['email', t('system:userEmail'), user.email],
                [
                  'tree',
                  t('system:user.department'),
                  user.dept ? `${user.dept.deptName} / ${result.postGroup || ''}` : '',
                ],
                ['peoples', t('system:roles'), result.roleGroup],
                ['date', t('common:createdDate'), parseTime(user.createTime) || '-'],
              ].map(([icon, label, value]) => (
                <li key={label}>
                  <SvgIcon iconClass={icon} />
                  {label}
                  <div className="profile-info-value">{value}</div>
                </li>
              ))}
            </ul>
          </Card>
        </Col>
        <Col
          xs={24}
          md={18}
        >
          <Card
            title={t('system:basicProfile')}
            className="profile-card"
          >
            <Tabs
              activeKey={selectedTab}
              onChange={setSelectedTab}
              items={[
                {
                  key: 'userinfo',
                  label: t('system:basicProfile'),
                  children: (
                    <UserInfo
                      user={user}
                      onSaved={getUser}
                    />
                  ),
                },
                { key: 'resetPwd', label: t('layout:changePassword'), children: <ResetPwd /> },
                {
                  key: 'timezone',
                  label: t('system:timeZoneSettings'),
                  children: (
                    <TimezoneSettings
                      user={user}
                      onSaved={getUser}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
