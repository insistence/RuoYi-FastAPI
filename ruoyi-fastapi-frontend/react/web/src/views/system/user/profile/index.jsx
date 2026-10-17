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
            title="个人信息"
            className="profile-card"
          >
            <div className="profile-avatar">
              <UserAvatar />
            </div>
            <ul className="profile-info-list">
              {[
                ['user', '用户名称', user.userName],
                ['phone', '手机号码', user.phonenumber],
                ['email', '用户邮箱', user.email],
                [
                  'tree',
                  '所属部门',
                  user.dept ? `${user.dept.deptName} / ${result.postGroup || ''}` : '',
                ],
                ['peoples', '所属角色', result.roleGroup],
                ['date', '创建日期', parseTime(user.createTime) || '-'],
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
            title="基本资料"
            className="profile-card"
          >
            <Tabs
              activeKey={selectedTab}
              onChange={setSelectedTab}
              items={[
                {
                  key: 'userinfo',
                  label: '基本资料',
                  children: (
                    <UserInfo
                      user={user}
                      onSaved={getUser}
                    />
                  ),
                },
                { key: 'resetPwd', label: '修改密码', children: <ResetPwd /> },
                {
                  key: 'timezone',
                  label: '时区设置',
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
