import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './list.css'
import { DatabaseOutlined, KeyOutlined, FileTextOutlined } from '@ant-design/icons'
import { TableAction } from '@/components/TableActions'
import { ReloadOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { Button, Card, Col, Form, Input, Row } from 'antd'
import Table from '@/components/Table'
import {
  listCacheName,
  listCacheKey,
  getCacheValue,
  clearCacheName,
  clearCacheKey,
  clearCacheAll,
} from '@/api/monitor/cache'
import { confirm, message } from '@/plugins/modal'

export default function CacheList() {
  useI18n()

  const [names, setNames] = useState([]),
    [keys, setKeys] = useState([]),
    [current, setCurrent] = useState(''),
    [value, setValue] = useState({}),
    [loading, setLoading] = useState(false),
    [subLoading, setSubLoading] = useState(false)
  const keyRequest = useRef(0),
    valueRequest = useRef(0)
  async function loadNames() {
    setLoading(true)
    try {
      setNames((await listCacheName()).data || [])
    } catch {
    } finally {
      setLoading(false)
    }
  }
  async function loadKeys(name = current) {
    if (!name) return
    const id = ++keyRequest.current
    valueRequest.current++
    setCurrent(name)
    setValue({})
    setKeys([])
    setSubLoading(true)
    try {
      const response = await listCacheKey(name)
      if (id === keyRequest.current) setKeys(response.data || [])
    } catch {
    } finally {
      if (id === keyRequest.current) setSubLoading(false)
    }
  }
  async function loadValue(key) {
    const id = ++valueRequest.current
    try {
      const response = await getCacheValue(current, key)
      if (id === valueRequest.current) setValue(response.data || {})
    } catch {}
  }
  async function clearName(name) {
    try {
      await confirm(t('monitor:clearCacheValue', { name }))
      await clearCacheName(name)
      message.success(t('monitor:clearedSuccessfully'))
      if (current === name) await loadKeys(name)
    } catch {}
  }
  async function clearKey(key) {
    try {
      await clearCacheKey(key)
      message.success(t('monitor:clearedSuccessfully'))
      await loadKeys()
    } catch {}
  }
  async function clearAll() {
    try {
      await confirm(t('monitor:clearAllCaches'))
      await clearCacheAll()
      message.success(t('monitor:allCachesCleared'))
      setValue({})
      await loadKeys()
      await loadNames()
    } catch {}
  }
  useEffect(() => {
    void loadNames()
  }, [])
  return (
    <div className="app-container cache-list-page">
      <Row gutter={[10, 10]}>
        <Col
          xs={24}
          lg={8}
        >
          <Card
            title={
              <>
                <DatabaseOutlined /> {t('monitor:cacheList')}
              </>
            }
            extra={
              <Button
                aria-label={t('monitor:refreshCacheList')}
                type="link"
                icon={<ReloadOutlined />}
                onClick={loadNames}
              />
            }
          >
            <Table
              rowKey="cacheName"
              loading={loading}
              dataSource={names}
              pagination={false}
              scroll={{ y: 'calc(100vh - 240px)' }}
              onRow={(row) => ({ onClick: () => loadKeys(row.cacheName) })}
              columns={[
                { title: t('common:index'), width: 60, render: (_, row, index) => index + 1 },
                {
                  align: 'center',
                  title: t('monitor:cacheName'),
                  dataIndex: 'cacheName',
                  render: (name) => name.replace(':', ''),
                },
                { align: 'center', title: t('common:remark'), dataIndex: 'remark' },
                {
                  className: 'ruoyi-actions-cell',
                  align: 'center',
                  title: t('common:actions'),
                  width: 60,
                  render: (_, row) => (
                    <TableAction
                      iconOnly={true}
                      symbol="Delete"
                      onClick={(event) => {
                        event.stopPropagation()
                        void clearName(row.cacheName)
                      }}
                    >
                      {t('monitor:deletePermanently')}
                    </TableAction>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col
          xs={24}
          lg={8}
        >
          <Card
            title={
              <>
                <KeyOutlined /> {t('monitor:keyList')}
              </>
            }
            extra={
              <Button
                aria-label={t('monitor:refreshKeyList')}
                icon={<ReloadOutlined />}
                type="link"
                disabled={!current}
                onClick={() => loadKeys()}
              />
            }
          >
            <Table
              rowKey="key"
              loading={subLoading}
              dataSource={keys.map((key) => ({ key }))}
              pagination={false}
              scroll={{ y: 'calc(100vh - 240px)' }}
              onRow={(row) => ({ onClick: () => loadValue(row.key) })}
              columns={[
                { title: t('common:index'), width: 60, render: (_, row, index) => index + 1 },
                {
                  align: 'center',
                  title: t('monitor:cacheKey'),
                  dataIndex: 'key',
                  ellipsis: true,
                  render: (key) => (key.startsWith(current) ? key.slice(current.length) : key),
                },
                {
                  className: 'ruoyi-actions-cell',
                  align: 'center',
                  title: t('common:actions'),
                  width: 60,
                  render: (_, row) => (
                    <TableAction
                      iconOnly={true}
                      symbol="Delete"
                      onClick={(event) => {
                        event.stopPropagation()
                        void clearKey(row.key)
                      }}
                    >
                      {t('monitor:deletePermanently')}
                    </TableAction>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col
          xs={24}
          lg={8}
        >
          <Card
            title={
              <>
                <FileTextOutlined /> {t('monitor:cacheContent')}
              </>
            }
            extra={
              <Button
                icon={<ReloadOutlined />}
                className="ruoyi-table-action"
                type="link"
                onClick={clearAll}
              >
                {t('monitor:clearAll')}
              </Button>
            }
          >
            <Form
              layout="vertical"
              colon={false}
              style={{ width: '91.6667%', margin: '0 auto' }}
            >
              <Form.Item label={t('monitor:cache.cacheName')}>
                <Input
                  readOnly
                  value={value.cacheName || ''}
                />
              </Form.Item>
              <Form.Item label={t('monitor:cache.cacheKey')}>
                <Input
                  readOnly
                  value={value.cacheKey || ''}
                />
              </Form.Item>
              <Form.Item label={t('monitor:cache.cacheContent')}>
                <Input.TextArea
                  readOnly
                  rows={8}
                  value={value.cacheValue || ''}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
