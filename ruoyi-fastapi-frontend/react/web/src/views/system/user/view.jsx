import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './view.css'
import { useEffect, useState } from 'react'
import { Drawer, Spin, Row, Col, Tag } from 'antd'
import { getUser } from '@/api/system/user'
import { useDict } from '@/utils/dict'
import { parseTime, selectDictLabel } from '@/utils/ruoyi'
export default function UserView({ userId, onClose }) {
  useI18n()

  const [result, setResult] = useState(null),
    [loading, setLoading] = useState(false)
  const { sys_user_sex } = useDict('sys_user_sex')
  useEffect(() => {
    if (userId == null) return
    let active = true
    setLoading(true)
    getUser(userId)
      .then((result) => {
        if (active) setResult(result)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId])
  const user = result?.data || {}
  const posts =
    result?.posts
      ?.filter((item) => (result.postIds || user.postIds || []).includes(item.postId))
      .map((item) => item.postName)
      .join('、') || t('system:noPosts')
  const roles =
    result?.roles
      ?.filter((item) => (result.roleIds || user.roleIds || []).includes(item.roleId))
      .map((item) => item.roleName)
      .join('、') || t('system:noRoles')
  const sections = [
    [
      t('common:basicInfo'),
      [
        [t('system:user.username'), user.nickName],
        [t('system:department'), user.dept?.deptName],
        [t('system:user.phone'), user.phonenumber],
        [t('system:user.email'), user.email],
        [t('system:loginAccount'), user.userName],
        [
          t('system:user.status'),
          <Tag
            className="dict-tag"
            color={user.status === '0' ? 'success' : 'error'}
          >
            {user.status === '0' ? t('layout:notices.active') : t('common:disable')}
          </Tag>,
        ],
        [t('system:user.post'), posts],
        [t('system:gender'), selectDictLabel(sys_user_sex, user.sex) || '-'],
        [t('system:user.role'), roles, 24],
      ],
    ],
    [
      t('system:otherInformation'),
      [
        [t('system:createdBy'), user.createBy],
        [t('common:createdTime'), parseTime(user.createTime)],
        [t('system:updatedBy'), user.updateBy],
        [t('common:updatedTime'), parseTime(user.updateTime)],
        [t('system:lastSignInIp'), user.loginIp],
        [t('system:lastSignInTime'), parseTime(user.loginDate)],
        [t('common:remark'), user.remark, 24],
      ],
    ],
  ]
  return (
    <Drawer
      rootClassName="user-detail-drawer"
      title={t('system:userDetails')}
      open={userId != null}
      onClose={onClose}
      size="68%"
    >
      <Spin spinning={loading}>
        <div className="drawer-content">
          {sections.map(([heading, fields]) => (
            <section key={heading}>
              <h4 className="section-header">{heading}</h4>
              <Row gutter={20}>
                {fields.map(([label, children, span = 12]) => (
                  <Col
                    key={label}
                    span={span}
                  >
                    <div className="info-item">
                      <label className="info-label">{label}：</label>
                      <span className="info-value plaintext">{children ?? ''}</span>
                    </div>
                  </Col>
                ))}
              </Row>
            </section>
          ))}
        </div>
      </Spin>
    </Drawer>
  )
}
