import './style.css'
import { UserOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { Drawer, Empty, Spin } from 'antd'
import DOMPurify from 'dompurify'
import { getNotice } from '@/api/system/notice'
import { parseTime } from '@/utils/ruoyi'
export default function NoticeDetailView({ noticeId, onClose }) {
  const [detail, setDetail] = useState(null),
    [loading, setLoading] = useState(false)
  useEffect(() => {
    if (noticeId == null) return
    let active = true
    setLoading(true)
    setDetail(null)
    getNotice(noticeId)
      .then((result) => {
        if (active) setDetail(result.data)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [noticeId])
  return (
    <Drawer
      rootClassName="notice-drawer"
      title="公告详情"
      open={noticeId != null}
      onClose={onClose}
      size="50%"
    >
      <Spin spinning={loading}>
        {detail ? <NoticeArticle detail={detail} /> : !loading && <Empty description="暂无公告" />}
      </Spin>
    </Drawer>
  )
}

export function NoticeArticle({ detail }) {
  return (
    <article className="notice-page">
      <span
        className={
          'notice-type-tag ' + (detail.noticeType === '2' ? 'type-announce' : 'type-notify')
        }
      >
        {detail.noticeType === '2' ? '公告' : '通知'}
      </span>
      <h2 className="notice-title">{detail.noticeTitle}</h2>
      <div className="notice-meta">
        <span className="meta-item">
          <UserOutlined />
          {detail.createBy || '—'}
        </span>
        <span className="meta-item">
          <ClockCircleOutlined />
          {parseTime(detail.createTime) || '—'}
        </span>
        <span className="meta-item">
          <i className={'notice-status-dot' + (detail.status === '0' ? '' : ' is-closed')} />
          {detail.status === '0' ? '正常' : '已关闭'}
        </span>
      </div>
      <div className="notice-body">
        {detail.noticeContent ? (
          <div
            className="notice-content ql-editor"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.noticeContent) }}
          />
        ) : (
          <Empty description="暂无内容" />
        )}
      </div>
      <div
        className="notice-divider"
        aria-hidden="true"
      >
        <i />
        <i />
        <i />
      </div>
    </article>
  )
}
