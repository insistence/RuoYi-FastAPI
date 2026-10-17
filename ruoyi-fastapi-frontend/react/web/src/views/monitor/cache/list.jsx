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
      await confirm(`确认清理缓存“${name}”？`)
      await clearCacheName(name)
      message.success('清理成功')
      if (current === name) await loadKeys(name)
    } catch {}
  }
  async function clearKey(key) {
    try {
      await clearCacheKey(key)
      message.success('清理成功')
      await loadKeys()
    } catch {}
  }
  async function clearAll() {
    try {
      await confirm('是否确认清理全部缓存？')
      await clearCacheAll()
      message.success('清理全部缓存成功')
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
                <DatabaseOutlined /> 缓存列表
              </>
            }
            extra={
              <Button
                aria-label="刷新缓存列表"
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
                { title: '序号', width: 60, render: (_, row, index) => index + 1 },
                {
                  align: 'center',
                  title: '缓存名称',
                  dataIndex: 'cacheName',
                  render: (name) => name.replace(':', ''),
                },
                { align: 'center', title: '备注', dataIndex: 'remark' },
                {
                  className: 'ruoyi-actions-cell',
                  align: 'center',
                  title: '操作',
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
                      清理
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
                <KeyOutlined /> 键名列表
              </>
            }
            extra={
              <Button
                aria-label="刷新键名列表"
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
                { title: '序号', width: 60, render: (_, row, index) => index + 1 },
                {
                  align: 'center',
                  title: '缓存键名',
                  dataIndex: 'key',
                  ellipsis: true,
                  render: (key) => (key.startsWith(current) ? key.slice(current.length) : key),
                },
                {
                  className: 'ruoyi-actions-cell',
                  align: 'center',
                  title: '操作',
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
                      清理
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
                <FileTextOutlined /> 缓存内容
              </>
            }
            extra={
              <Button
                icon={<ReloadOutlined />}
                className="ruoyi-table-action"
                type="link"
                onClick={clearAll}
              >
                清理全部
              </Button>
            }
          >
            <Form
              layout="vertical"
              colon={false}
              style={{ width: '91.6667%', margin: '0 auto' }}
            >
              <Form.Item label="缓存名称:">
                <Input
                  readOnly
                  value={value.cacheName || ''}
                />
              </Form.Item>
              <Form.Item label="缓存键名:">
                <Input
                  readOnly
                  value={value.cacheKey || ''}
                />
              </Form.Item>
              <Form.Item label="缓存内容:">
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
