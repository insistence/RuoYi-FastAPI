import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { UserOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { Drawer, Empty, Spin } from 'antd'
import { sanitizeNoticeHtml } from '@/utils/noticeHtml'
import { getNotice } from '@/api/system/notice'
import { parseTime } from '@/utils/ruoyi'
export default function NoticeDetailView({ noticeId, onClose }) {
  useI18n()

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
      title={t('layout:notices.details')}
      open={noticeId != null}
      onClose={onClose}
      size="50%"
    >
      <Spin spinning={loading}>
        {detail ? (
          <NoticeArticle detail={detail} />
        ) : (
          !loading && <Empty description={t('layout:notices.empty')} />
        )}
      </Spin>
    </Drawer>
  )
}

export function NoticeArticle({ detail }) {
  useI18n()

  return (
    <article className="notice-page">
      <span
        className={
          'notice-type-tag ' + (detail.noticeType === '2' ? 'type-announce' : 'type-notify')
        }
      >
        {detail.noticeType === '2'
          ? t('layout:notices.announcement')
          : t('layout:notices.notification')}
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
          {detail.status === '0' ? t('layout:notices.active') : t('layout:notices.closed')}
        </span>
      </div>
      <div className="notice-body">
        {detail.noticeContent ? (
          <div
            className="notice-content ql-editor"
            dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(detail.noticeContent) }}
          />
        ) : (
          <Empty description={t('layout:notices.noContent')} />
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
