import './view.css'
import { useEffect, useState } from 'react'
import { Drawer, Spin, Row, Col, Tag } from 'antd'
import { getUser } from '@/api/system/user'
import { useDict } from '@/utils/dict'
import { parseTime, selectDictLabel } from '@/utils/ruoyi'
export default function UserView({ userId, onClose }) {
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
      .join('、') || '无岗位'
  const roles =
    result?.roles
      ?.filter((item) => (result.roleIds || user.roleIds || []).includes(item.roleId))
      .map((item) => item.roleName)
      .join('、') || '无角色'
  const sections = [
    [
      '基本信息',
      [
        ['用户名称', user.nickName],
        ['归属部门', user.dept?.deptName],
        ['手机号码', user.phonenumber],
        ['邮箱', user.email],
        ['登录账号', user.userName],
        [
          '用户状态',
          <Tag
            className="dict-tag"
            color={user.status === '0' ? 'success' : 'error'}
          >
            {user.status === '0' ? '正常' : '停用'}
          </Tag>,
        ],
        ['岗位', posts],
        ['用户性别', selectDictLabel(sys_user_sex, user.sex) || '-'],
        ['角色', roles, 24],
      ],
    ],
    [
      '其他信息',
      [
        ['创建者', user.createBy],
        ['创建时间', parseTime(user.createTime)],
        ['更新者', user.updateBy],
        ['更新时间', parseTime(user.updateTime)],
        ['最后登录IP', user.loginIp],
        ['最后登录时间', parseTime(user.loginDate)],
        ['备注', user.remark, 24],
      ],
    ],
  ]
  return (
    <Drawer
      rootClassName="user-detail-drawer"
      title="用户信息详情"
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
