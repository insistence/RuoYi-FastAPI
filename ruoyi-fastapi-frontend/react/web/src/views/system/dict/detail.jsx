import { UnorderedListOutlined } from '@ant-design/icons'
import './style.css'
import { useEffect, useState } from 'react'
import { Drawer, Spin, Empty, Tag } from 'antd'
import Table from '@/components/Table'
import { listData } from '@/api/system/dict/data'
export default function DictDataDrawer({ row, onClose }) {
  const [data, setData] = useState([]),
    [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!row) return
    let active = true
    setLoading(true)
    listData({ dictType: row.dictType, pageNum: 1, pageSize: 10000 })
      .then((result) => {
        if (active) setData(result.rows)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [row])
  return (
    <Drawer
      rootClassName="dict-detail"
      title={
        <div className="drawer-head">
          <UnorderedListOutlined style={{ color: '#5b9bd5', marginRight: 8 }} />
          <span className="drawer-head-name">{row?.dictName}</span>
          <span className="drawer-head-type">{row?.dictType}</span>
        </div>
      }
      open={!!row}
      onClose={onClose}
      size={700}
    >
      <div className="drawer-wrap">
        {loading ? (
          <div className="drawer-loading">
            <Spin size="small" />
            <span>加载中...</span>
          </div>
        ) : !data.length ? (
          <Empty description="暂无字典数据" />
        ) : (
          <>
            <div
              className="stat-row"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${data.some((item) => item.status !== '0') ? 3 : 2},1fr)`,
                gap: 12,
              }}
            >
              <div className="stat-card">
                <div className="stat-num">{data.length}</div>
                <div className="stat-label">共计条目</div>
              </div>
              <div className="stat-card">
                <div className="stat-num success">
                  {data.filter((item) => item.status === '0').length}
                </div>
                <div className="stat-label">正常</div>
              </div>
              {data.some((item) => item.status !== '0') && (
                <div className="stat-card">
                  <div className="stat-num danger">
                    {data.filter((item) => item.status !== '0').length}
                  </div>
                  <div className="stat-label">停用</div>
                </div>
              )}
            </div>
            {data.map((item) => (
              <div
                className="dict-item"
                key={item.dictCode}
              >
                <div className="dict-cell">
                  <div className="dict-cell-key">标签</div>
                  <div className="dict-cell-val">
                    {item.listClass && item.listClass !== 'default' ? (
                      <Tag
                        className="dict-tag"
                        color={
                          {
                            primary: 'processing',
                            success: 'success',
                            info: 'default',
                            warning: 'warning',
                            danger: 'error',
                          }[item.listClass]
                        }
                      >
                        {item.dictLabel}
                      </Tag>
                    ) : (
                      item.dictLabel
                    )}
                  </div>
                </div>
                <div className="dict-cell">
                  <div className="dict-cell-key">键值</div>
                  <div className="dict-cell-val">{item.dictValue}</div>
                </div>
                <div className="dict-cell">
                  <div className="dict-cell-key">状态</div>
                  <div className="dict-cell-val">
                    <Tag
                      className="dict-tag"
                      color={item.status === '0' ? 'success' : 'error'}
                    >
                      {item.status === '0' ? '正常' : '停用'}
                    </Tag>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Drawer>
  )
}
