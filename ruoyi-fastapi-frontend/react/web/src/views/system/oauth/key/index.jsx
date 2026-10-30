import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

  const [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [enabled, setEnabled] = useState(true),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false),
    [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false)
  useLocalizedFormErrors(form)
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
        message.error(t('system:signingCannotStartBeforePublicKeyPublication'))
        return
      }
      setSaving(true)
      await rotateOidcKey(payload)
      message.success(t('system:rotationScheduledTheNewPublicKeyWillBePublished'))
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
        t('system:activateKeyValueValuetheCurrentSigningKeyWillEnter', {
          kid: row.kid,
          arg1: early
            ? t('system:signingWasScheduledToStartAtValueThisAction', {
                arg0: parseTime(row.signingStartAt),
              })
            : t('system:itWillImmediatelyTakeOverIssuanceOfNewCredentials'),
        })
      )
      await activateOidcKey(row.kid)
      message.success(t('system:theNewSigningKeyIsActive'))
      await getList()
    } catch {}
  }
  async function retire(row) {
    try {
      await confirm(t('system:stopIssuingNewCredentialsWithKeyValueItsPublic', { kid: row.kid }))
      await retireOidcKey(row.kid)
      message.success(t('system:theKeyHasStoppedSigningAndIsNowUsed'))
      await getList()
    } catch {}
  }
  async function remove(row) {
    try {
      await confirm(t('system:deleteTheRecordForKeyValueConfirmThatEvery', { kid: row.kid }))
      await deleteOidcKey(row.kid)
      message.success(t('system:keyRecordDeleted'))
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
    ? [t('system:notEnabled'), t('system:youCanPrepareKeysFirstAndStartIssuingCredentials')]
    : !ready
      ? [
          t('system:waitingForSigningKeyInitialization'),
          t('system:theAdminConsoleRemainsAvailableAuthenticationEndpointsWillTemporarily'),
        ]
      : [
          t('system:enabledAndReadyForAuthentication'),
          t('system:identityCredentialsAreSignedWithTheCurrentSigningKey'),
        ]
  const columns = [
    {
      title: t('system:key'),
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
      title: t('system:currentPurpose'),
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
      title: t('system:signingMethod'),
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
      title: t('system:lifecycle'),
      width: 280,
      render: (_, row) => (
        <div className="timeline-cell">
          <span>
            <small>{t('system:publishedToApplications')}</small>
            {parseTime(row.publishAt) || '—'}
          </span>
          <span>
            <small>
              {row.status === 'pending'
                ? t('system:scheduledSigningStart')
                : t('system:signingStarts')}
            </small>
            {parseTime(row.signingStartAt) || '—'}
          </span>
        </div>
      ),
    },
    {
      title: t('common:next'),
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
      title: t('common:actions'),
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
                {activationDisabledReason(row)
                  ? t('system:awaitingPublication')
                  : t('system:activate')}
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
              {t('system:stopSigning')}
            </TableAction>
          </HasPermi>
        ) : row.status === 'retired' ? (
          <HasPermi value={['system:oauthKey:retire']}>
            <TableAction
              tone="danger"
              symbol="Delete"
              onClick={() => remove(row)}
            >
              {t('monitor:deleteRecord')}
            </TableAction>
          </HasPermi>
        ) : null,
    },
  ]
  return (
    <PageFrame
      className="oauth-key-page"
      title={t('system:signingKeys')}
      description={t('system:manageSigningKeysUsedToProveTheAuthenticityOf')}
      section={t('monitor:securityOperations')}
      actions={
        <>
          <HasPermi value={['system:oauthKey:rotate']}>
            <Button
              icon={<ReloadOutlined />}
              type="primary"
              onClick={start}
            >
              {t('system:scheduleKeyRotation')}
            </Button>
          </HasPermi>
        </>
      }
      toolbar={
        <>
          <span className="result-count">
            {t('common:total')} <strong>{total}</strong> {t('system:keys')}
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
              <small>{t('system:authenticationService')}</small>
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
              <small>{t('system:currentSigningKey')}</small>
              <strong>{active?.kid || t('system:notActivated')}</strong>
              <p>
                {active
                  ? t('system:issuingNewCredentialsSinceValue', {
                      arg0: parseTime(active.signingStartAt) || t('monitor:scheduledTime'),
                    })
                  : t('system:firstActivateAKeyWhosePublicKeyHasBeen')}
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
              <small>{t('system:nextRotation')}</small>
              <strong>{next?.kid || t('system:notScheduled')}</strong>
              <p>
                {next
                  ? t('system:scheduledToTakeOverSigningAtValue', {
                      arg0: parseTime(next.signingStartAt) || t('system:timePendingConfirmation'),
                    })
                  : t('system:scheduleRotationBeforeTheCurrentKeyExpires')}
              </p>
            </div>
          </div>
        </div>
      }
    >
      <Table
        locale={{
          emptyText: (
            <Empty description={t('system:noSigningKeyPrepared')}>
              <HasPermi value={['system:oauthKey:rotate']}>
                <Button
                  type="primary"
                  onClick={start}
                >
                  {t('system:createTheFirstKey')}
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
        title={t('system:scheduleSigningKeyRotation')}
        okText={t('system:createRotationPlan')}
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
          aria-label={t('system:keyRotationProcess')}
        >
          <div>
            <span>1</span>
            <strong>{t('system:publishFirst')}</strong>
            <small>{t('system:applicationsObtainThePublicKeyInAdvance')}</small>
          </div>
          <i aria-hidden />
          <div>
            <span>2</span>
            <strong>{t('system:thenTakeOverSigning')}</strong>
            <small>{t('system:newCredentialsUseTheNewKey')}</small>
          </div>
          <i aria-hidden />
          <div>
            <span>3</span>
            <strong>{t('system:retainTheOldPublicKey')}</strong>
            <small>{t('system:oldCredentialsRemainVerifiableUntilTheyExpire')}</small>
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
            <h3>{t('system:rotationIdentifier')}</h3>
            <p>{t('system:giveThisRotationAnIdentifiableReferenceToHelpLocate')}</p>
            <Form.Item
              name="kid"
              label={
                <FieldLabel
                  label={t('system:keyId')}
                  help={t('authCenter:aUniqueIdentifierInThePublicKeyListConsiderIncluding')}
                />
              }
              rules={[
                { required: true, message: t('system:enterAnIdentifiableKeyId') },
                {
                  pattern: /^[A-Za-z0-9._-]+$/,
                  message: t('system:useOnlyLettersDigitsPeriodsHyphensAndUnderscores'),
                },
              ]}
            >
              <Input
                placeholder={t('system:forExample202609Primary')}
                maxLength={128}
              />
            </Form.Item>
            <Form.Item
              label={
                <FieldLabel
                  label={t('system:signingMethod')}
                  help={t(
                    'authCenter:rs256IsAWidelyCompatibleAsymmetricSigningAlgorithmApplicationsReceive'
                  )}
                />
              }
            >
              <div className="algorithm-value">
                <strong>RS256</strong>
                <span>{t('system:privateKeysAreNeverShownOrExportedOnThis')}</span>
              </div>
            </Form.Item>
          </section>
          <section className="form-section">
            <h3>{t('system:activationSchedule')}</h3>
            <p>{t('system:publishThePublicKeyBeforeUsingItToSign')}</p>
            <Form.Item
              name="publishAt"
              label={
                <FieldLabel
                  label={t('system:publicKeyPublicationTime')}
                  help={t('authCenter:fromThisTimeApplicationsCanObtainTheNewPublicKey')}
                />
              }
              rules={[{ required: true, message: t('system:chooseAPublicKeyPublicationTime') }]}
            >
              <BusinessDateTimePicker label={t('system:publicKeyPublicationTime')} />
            </Form.Item>
            <Form.Item
              name="activateAt"
              label={
                <FieldLabel
                  label={t('system:signingStartTime')}
                  help={t('authCenter:fromThisTimeNewlyIssuedIdentityAndAccessTokensUse')}
                />
              }
              rules={[{ required: true, message: t('system:chooseASigningStartTime') }]}
            >
              <BusinessDateTimePicker label={t('system:signingStartTime')} />
            </Form.Item>
            <Form.Item
              name="remark"
              label={
                <FieldLabel
                  label={t('system:changeDescription')}
                  help={t('authCenter:recordTheReasonForRotationOrARelatedTicketFor')}
                />
              }
            >
              <Input.TextArea
                placeholder={t('system:forExampleRoutineQuarterlyRotationRelatedTicketSec1024')}
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
