import {
  ReloadOutlined,
  LockOutlined,
  KeyOutlined,
  ClockCircleOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { Empty } from 'antd'
import OAuthTag from '@/components/OAuthWorkspace/OAuthTag'
import RightToolbar from '@/components/RightToolbar'
import './style.css'
import FieldLabel from '@/components/OAuthWorkspace/FieldLabel'
import { TableAction } from '@/components/TableActions'

import '@/components/OAuthWorkspace/entities.css'
import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Tooltip } from 'antd'
import Table from '@/components/Table'
import {
  activateOidcKey,
  deleteOidcKey,
  listOidcKeys,
  retireOidcKey,
  rotateOidcKey,
} from '@/api/system/oauthSession'
import { parseTime } from '@/utils/ruoyi'
import { serializeTimeFieldsForSubmit } from '@/utils/time'
import { confirm, message } from '@/plugins/modal'
import PageFrame from '@/components/OAuthWorkspace/PageFrame'
import BusinessDateTimePicker from '@/components/BusinessDateTimePicker'
import Pagination from '@/components/Pagination'
import HasPermi from '@/directive/permission/hasPermi'
import {
  statusText,
  statusType,
  roleText,
  publicFingerprint,
  nextActionText,
  nextActionTime,
  activationDisabledReason,
} from './formatter'

export default function OAuthKey() {
  const [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [enabled, setEnabled] = useState(true),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false),
    [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listOidcKeys(query)
      setRows(result.rows || [])
      setTotal(result.total || 0)
      setEnabled(result.enabled !== false)
      setReady(result.ready === true)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  useEffect(() => {
    void getList()
  }, [getList])
  function start() {
    form.resetFields()
    form.setFieldsValue({
      alg: 'RS256',
      kid: '',
      publishAt: '',
      activateAt: '',
      remark: '',
    })
    setOpen(true)
  }
  async function rotate() {
    try {
      const values = await form.validateFields(),
        payload = await serializeTimeFieldsForSubmit({ ...values, alg: 'RS256' }, [
          'publishAt',
          'activateAt',
        ])
      if (!payload) return
      if (new Date(payload.activateAt) < new Date(payload.publishAt)) {
        message.error('开始签名时间不能早于公开公钥时间')
        return
      }
      setSaving(true)
      await rotateOidcKey(payload)
      message.success('轮换计划已创建，新公钥会按计划先行公开')
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  async function activate(row) {
    const reason = activationDisabledReason(row)
    if (reason) {
      message.warning(reason)
      return
    }
    try {
      const early = new Date(row.signingStartAt).getTime() > Date.now()
      await confirm(
        `开始使用密钥 ${row.kid}？${early ? `原计划在 ${parseTime(row.signingStartAt)} 开始签名，本次操作将提前生效。` : '它将立即接管新凭据的签发。'}当前签名密钥会进入旧凭据验证期。`
      )
      await activateOidcKey(row.kid)
      message.success('新的签名密钥已开始使用')
      await getList()
    } catch {}
  }
  async function retire(row) {
    try {
      await confirm(
        `停止使用密钥 ${row.kid} 签发新凭据？公钥仍会保留一段时间，用于验证尚未到期的旧凭据。`
      )
      await retireOidcKey(row.kid)
      message.success('密钥已停止签名，当前仅用于验证旧凭据')
      await getList()
    } catch {}
  }
  async function remove(row) {
    try {
      await confirm(`删除密钥 ${row.kid} 的记录？请确认所有由它签署的凭据都已到期。`)
      await deleteOidcKey(row.kid)
      message.success('密钥记录已删除')
      await getList()
    } catch {}
  }
  const active = rows.find((row) => row.status === 'active'),
    next = rows
      .filter((row) => row.status === 'pending')
      .sort((a, b) =>
        String(a.signingStartAt || '').localeCompare(String(b.signingStartAt || ''))
      )[0]
  const service = !enabled
    ? ['尚未启用', '可以先准备密钥，启用服务后再对外签发凭据。']
    : !ready
      ? ['等待初始化签名密钥', '管理后台可以正常使用，认证接口会暂时拒绝请求。']
      : ['已启用并可以提供认证', '身份凭据会使用当前签名密钥签署。']
  const columns = [
    {
      title: '密钥',
      width: 250,
      render: (_, row) => (
        <div className="key-cell">
          <span className={`key-mark is-${row.status}`}>
            <KeyOutlined />
          </span>
          <span>
            <strong>{row.kid}</strong>
            <small title={row.fingerprint || publicFingerprint(row.publicJwk)}>
              {row.fingerprint || publicFingerprint(row.publicJwk)}
            </small>
          </span>
        </div>
      ),
    },
    {
      title: '当前作用',
      width: 190,
      render: (_, row) => (
        <div className="role-cell">
          <OAuthTag type={statusType(row.status)}>{statusText(row.status)}</OAuthTag>
          <small>{roleText(row.status)}</small>
        </div>
      ),
    },
    {
      align: 'center',
      title: '签名方式',
      dataIndex: 'alg',
      width: 110,
      render: (value) => (
        <OAuthTag
          type="info"
          effect="plain"
        >
          {value}
        </OAuthTag>
      ),
    },
    {
      title: '生命周期',
      width: 280,
      render: (_, row) => (
        <div className="timeline-cell">
          <span>
            <small>公开给应用</small>
            {parseTime(row.publishAt) || '—'}
          </span>
          <span>
            <small>{row.status === 'pending' ? '计划开始签名' : '开始签名'}</small>
            {parseTime(row.signingStartAt) || '—'}
          </span>
        </div>
      ),
    },
    {
      title: '下一步',
      width: 220,
      render: (_, row) => (
        <div className="next-action">
          <strong>{nextActionText(row)}</strong>
          <small>{nextActionTime(row)}</small>
        </div>
      ),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      fixed: 'right',
      width: 150,
      render: (_, row) =>
        row.status === 'pending' ? (
          <HasPermi value={['system:oauthKey:activate']}>
            <Tooltip title={activationDisabledReason(row)}>
              <TableAction
                symbol="CircleCheck"
                disabled={!!activationDisabledReason(row)}
                onClick={() => activate(row)}
              >
                {activationDisabledReason(row) ? '等待公开' : '开始使用'}
              </TableAction>
            </Tooltip>
          </HasPermi>
        ) : row.status === 'active' ? (
          <HasPermi value={['system:oauthKey:retire']}>
            <TableAction
              tone="warning"
              symbol="VideoPause"
              onClick={() => retire(row)}
            >
              停止签名
            </TableAction>
          </HasPermi>
        ) : row.status === 'retired' ? (
          <HasPermi value={['system:oauthKey:retire']}>
            <TableAction
              tone="danger"
              symbol="Delete"
              onClick={() => remove(row)}
            >
              删除记录
            </TableAction>
          </HasPermi>
        ) : null,
    },
  ]
  return (
    <PageFrame
      className="oauth-key-page"
      title="签名密钥"
      description="管理系统用来证明身份凭据真实可信的签名密钥，并通过重叠验证窗口安全完成轮换。"
      section="安全运维"
      actions={
        <>
          <HasPermi value={['system:oauthKey:rotate']}>
            <Button
              icon={<ReloadOutlined />}
              type="primary"
              onClick={start}
            >
              安排密钥轮换
            </Button>
          </HasPermi>
        </>
      }
      toolbar={
        <>
          <span className="result-count">
            共 <strong>{total}</strong> 把密钥
          </span>
          <RightToolbar
            showSearch={false}
            onQuery={getList}
          />
        </>
      }
      context={
        <div className="key-overview">
          <div className={`overview-state ${!ready ? 'is-disabled' : ''}`}>
            <span className="overview-icon">
              <LockOutlined />
            </span>
            <div>
              <small>认证服务</small>
              <strong>{service[0]}</strong>
              <p>{service[1]}</p>
            </div>
          </div>
          <div
            className="overview-divider"
            aria-hidden
          >
            <RightOutlined />
          </div>
          <div className="overview-state">
            <span className="overview-icon is-success">
              <KeyOutlined />
            </span>
            <div>
              <small>当前签名密钥</small>
              <strong>{active?.kid || '尚未激活'}</strong>
              <p>
                {active
                  ? `自 ${parseTime(active.signingStartAt) || '计划时间'} 起签发新凭据`
                  : '需要先激活一把已公开的密钥。'}
              </p>
            </div>
          </div>
          <div
            className="overview-divider"
            aria-hidden
          >
            <RightOutlined />
          </div>
          <div className="overview-state">
            <span className="overview-icon is-next">
              <ClockCircleOutlined />
            </span>
            <div>
              <small>下一次轮换</small>
              <strong>{next?.kid || '尚未安排'}</strong>
              <p>
                {next
                  ? `计划在 ${parseTime(next.signingStartAt) || '待确认时间'} 接管签名`
                  : '建议在现有密钥到期前安排轮换。'}
              </p>
            </div>
          </div>
        </div>
      }
    >
      <Table
        locale={{
          emptyText: (
            <Empty description="尚未准备签名密钥">
              <HasPermi value={['system:oauthKey:rotate']}>
                <Button
                  type="primary"
                  onClick={start}
                >
                  创建第一把密钥
                </Button>
              </HasPermi>
            </Empty>
          ),
        }}
        rowKey="kid"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ x: 1250 }}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <Modal
        className="oauth-dialog oauth-key-editor"
        title="安排签名密钥轮换"
        okText="创建轮换计划"
        mask={{ closable: false }}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={rotate}
        confirmLoading={saving}
        width="min(780px, calc(100vw - 48px))"
        forceRender
      >
        <div
          className="rotation-preview"
          aria-label="密钥轮换过程"
        >
          <div>
            <span>1</span>
            <strong>先公开</strong>
            <small>应用提前拿到公钥</small>
          </div>
          <i aria-hidden />
          <div>
            <span>2</span>
            <strong>再接管签名</strong>
            <small>新凭据改用新密钥</small>
          </div>
          <i aria-hidden />
          <div>
            <span>3</span>
            <strong>保留旧公钥</strong>
            <small>旧凭据仍可验证到期</small>
          </div>
        </div>
        <Form
          name="src-views-system-oauth-key-index-jsx-editor-15"
          className="ruoyi-dialog-form rotation-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '160px' }}
          form={form}
          layout="horizontal"
        >
          <section className="form-section">
            <h3>轮换标识</h3>
            <p>给这次轮换一个易识别的编号，便于在日志和故障排查中定位。</p>
            <Form.Item
              name="kid"
              label={
                <FieldLabel
                  label="密钥编号"
                  help="公开密钥列表中的唯一编号。建议包含年份、月份或用途，例如 2026-09-primary。"
                />
              }
              rules={[
                { required: true, message: '请输入便于识别的密钥编号' },
                {
                  pattern: /^[A-Za-z0-9._-]+$/,
                  message: '只能使用字母、数字、点、横线和下划线',
                },
              ]}
            >
              <Input
                placeholder="例如：2026-09-primary"
                maxLength={128}
              />
            </Form.Item>
            <Form.Item
              label={
                <FieldLabel
                  label="签名方式"
                  help="RS256 是应用兼容性较好的非对称签名方式。应用只会获取公钥，无法据此伪造凭据。"
                />
              }
            >
              <div className="algorithm-value">
                <strong>RS256</strong>
                <span>私钥不会在此页面展示或导出</span>
              </div>
            </Form.Item>
          </section>
          <section className="form-section">
            <h3>生效安排</h3>
            <p>先公开公钥，再开始使用它签名，给接入应用留出同步时间。</p>
            <Form.Item
              name="publishAt"
              label={
                <FieldLabel
                  label="公开公钥时间"
                  help="从这个时间起，接入应用可以在公开密钥列表中获取新公钥，但系统还不会使用它签发新凭据。"
                />
              }
              rules={[{ required: true, message: '请选择公开公钥时间' }]}
            >
              <BusinessDateTimePicker label="公开公钥时间" />
            </Form.Item>
            <Form.Item
              name="activateAt"
              label={
                <FieldLabel
                  label="开始签名时间"
                  help="从这个时间起，新签发的身份和访问凭据会改用新密钥。该时间不能早于公开公钥时间。"
                />
              }
              rules={[{ required: true, message: '请选择开始签名时间' }]}
            >
              <BusinessDateTimePicker label="开始签名时间" />
            </Form.Item>
            <Form.Item
              name="remark"
              label={
                <FieldLabel
                  label="变更说明"
                  help="记录轮换原因或关联工单，便于后续审计；不会公开给接入应用。"
                />
              }
            >
              <Input.TextArea
                placeholder="例如：季度例行轮换，关联工单 SEC-1024"
                rows={3}
                showCount
                maxLength={500}
              />
            </Form.Item>
          </section>
        </Form>
      </Modal>
    </PageFrame>
  )
}
