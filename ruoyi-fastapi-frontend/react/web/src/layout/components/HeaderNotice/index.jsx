import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useEffect, useState } from 'react'
import { Badge, Button, Empty, Popover, Space, Spin, Tag } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { listNoticeTop, markNoticeRead, markNoticeReadAll } from '@/api/system/notice'
import { parseTime } from '@/utils/ruoyi'
import NoticeDetailView from './DetailView'
export default function HeaderNotice() {
  useI18n()

  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(false),
    [unread, setUnread] = useState(0),
    [noticeId, setNoticeId] = useState(null)
  async function load() {
    setLoading(true)
    try {
      const result = await listNoticeTop()
      setRows(result.data || [])
      setUnread(result.unreadCount ?? result.data?.filter((item) => !item.isRead).length ?? 0)
    } catch {
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  async function preview(row) {
    setNoticeId(row.noticeId)
    if (!row.isRead) {
      try {
        await markNoticeRead(row.noticeId)
        await load()
      } catch {}
    }
  }
  async function markAll() {
    if (!rows.length) return
    try {
      await markNoticeReadAll(rows.map((row) => row.noticeId).join(','))
      await load()
    } catch {}
  }
  const content = (
    <div className="notice-popover">
      <Space className="notice-header">
        <strong>{t('layout:notices.title')}</strong>
        <Button
          type="link"
          onClick={markAll}
          disabled={!unread}
        >
          {t('layout:notices.readAll')}
        </Button>
      </Space>
      <Spin spinning={loading}>
        <div className="notice-list">
          {rows.length ? (
            rows.map((row) => (
              <Button
                key={row.noticeId}
                type="text"
                block
                className={'notice-item' + (row.isRead ? ' is-read' : '')}
                onClick={() => preview(row)}
              >
                <Space
                  direction="vertical"
                  align="start"
                >
                  <span>
                    <Tag color="blue">
                      {row.noticeType === '2'
                        ? t('layout:notices.announcement')
                        : t('layout:notices.notification')}
                    </Tag>
                    {row.noticeTitle}
                  </span>
                  <small>{parseTime(row.createTime)}</small>
                </Space>
              </Button>
            ))
          ) : (
            <Empty
              description={t('layout:noNotifications')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
      </Spin>
    </div>
  )
  return (
    <>
      <Popover
        content={content}
        trigger="click"
        placement="bottomRight"
      >
        <Button
          type="text"
          aria-label={t('layout:announcementsValueUnread', { unread })}
        >
          <Badge
            count={unread}
            size="small"
          >
            <BellOutlined />
          </Badge>
        </Button>
      </Popover>
      <NoticeDetailView
        noticeId={noticeId}
        onClose={() => setNoticeId(null)}
      />
    </>
  )
}
