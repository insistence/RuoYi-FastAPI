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
        message.error(t('oauth:key.signingCannotStartBeforePublicKeyPublication'))
        return
      }
      setSaving(true)
      await rotateOidcKey(payload)
      message.success(t('oauth:key.rotationScheduledTheNewPublicKeyWillBePublished'))
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
        t('oauth:key.activateKeyValueValuetheCurrentSigningKeyWillEnter', {
          kid: row.kid,
          arg1: early
            ? t('oauth:key.signingWasScheduledToStartAtValueThisAction', {
                arg0: parseTime(row.signingStartAt),
              })
            : t('oauth:key.itWillImmediatelyTakeOverIssuanceOfNewCredentials'),
        })
      )
      await activateOidcKey(row.kid)
      message.success(t('oauth:key.theNewSigningKeyIsActive'))
      await getList()
    } catch {}
  }
  async function retire(row) {
    try {
      await confirm(t('oauth:key.stopIssuingNewCredentialsWithKeyValueItsPublic', { kid: row.kid }))
      await retireOidcKey(row.kid)
      message.success(t('oauth:key.theKeyHasStoppedSigningAndIsNowUsed'))
      await getList()
    } catch {}
  }
  async function remove(row) {
    try {
      await confirm(t('oauth:key.deleteTheRecordForKeyValueConfirmThatEvery', { kid: row.kid }))
      await deleteOidcKey(row.kid)
      message.success(t('oauth:key.keyRecordDeleted'))
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
    ? [t('oauth:key.notEnabled'), t('oauth:key.youCanPrepareKeysFirstAndStartIssuingCredentials')]
    : !ready
      ? [
          t('oauth:key.waitingForSigningKeyInitialization'),
          t('oauth:key.theAdminConsoleRemainsAvailableAuthenticationEndpointsWillTemporarily'),
        ]
      : [
          t('oauth:key.enabledAndReadyForAuthentication'),
          t('oauth:key.identityCredentialsAreSignedWithTheCurrentSigningKey'),
        ]
  const columns = [
    {
      title: t('oauth:key.key'),
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
      title: t('oauth:key.currentPurpose'),
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
      title: t('oauth:key.signingMethod'),
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
      title: t('oauth:key.lifecycle'),
      width: 280,
      render: (_, row) => (
        <div className="timeline-cell">
          <span>
            <small>{t('oauth:key.publishedToApplications')}</small>
            {parseTime(row.publishAt) || '—'}
          </span>
          <span>
            <small>
              {row.status === 'pending'
                ? t('oauth:key.scheduledSigningStart')
                : t('oauth:key.signingStarts')}
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
                  ? t('oauth:key.awaitingPublication')
                  : t('oauth:key.activate')}
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
              {t('oauth:key.stopSigning')}
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
      title={t('oauth:key.signingKeys')}
      description={t('oauth:key.manageSigningKeysUsedToProveTheAuthenticityOf')}
      section={t('monitor:securityOperations')}
      actions={
        <>
          <HasPermi value={['system:oauthKey:rotate']}>
            <Button
              icon={<ReloadOutlined />}
              type="primary"
              onClick={start}
            >
              {t('oauth:key.scheduleKeyRotation')}
            </Button>
          </HasPermi>
        </>
      }
      toolbar={
        <>
          <span className="result-count">
            {t('common:total')} <strong>{total}</strong> {t('oauth:key.keys')}
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
              <small>{t('oauth:key.authenticationService')}</small>
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
              <small>{t('oauth:key.currentSigningKey')}</small>
              <strong>{active?.kid || t('system:notActivated')}</strong>
              <p>
                {active
                  ? t('oauth:key.issuingNewCredentialsSinceValue', {
                      arg0: parseTime(active.signingStartAt) || t('monitor:scheduledTime'),
                    })
                  : t('oauth:key.firstActivateAKeyWhosePublicKeyHasBeen')}
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
              <small>{t('oauth:key.nextRotation')}</small>
              <strong>{next?.kid || t('oauth:key.notScheduled')}</strong>
              <p>
                {next
                  ? t('oauth:key.scheduledToTakeOverSigningAtValue', {
                      arg0:
                        parseTime(next.signingStartAt) || t('oauth:key.timePendingConfirmation'),
                    })
                  : t('oauth:key.scheduleRotationBeforeTheCurrentKeyExpires')}
              </p>
            </div>
          </div>
        </div>
      }
    >
      <Table
        locale={{
          emptyText: (
            <Empty description={t('oauth:key.noSigningKeyPrepared')}>
              <HasPermi value={['system:oauthKey:rotate']}>
                <Button
                  type="primary"
                  onClick={start}
                >
                  {t('oauth:key.createTheFirstKey')}
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
        title={t('oauth:key.scheduleSigningKeyRotation')}
        okText={t('oauth:key.createRotationPlan')}
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
          aria-label={t('oauth:key.keyRotationProcess')}
        >
          <div>
            <span>1</span>
            <strong>{t('oauth:key.publishFirst')}</strong>
            <small>{t('oauth:key.applicationsObtainThePublicKeyInAdvance')}</small>
          </div>
          <i aria-hidden />
          <div>
            <span>2</span>
            <strong>{t('oauth:key.thenTakeOverSigning')}</strong>
            <small>{t('oauth:key.newCredentialsUseTheNewKey')}</small>
          </div>
          <i aria-hidden />
          <div>
            <span>3</span>
            <strong>{t('oauth:key.retainTheOldPublicKey')}</strong>
            <small>{t('oauth:key.oldCredentialsRemainVerifiableUntilTheyExpire')}</small>
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
            <h3>{t('oauth:key.rotationIdentifier')}</h3>
            <p>{t('oauth:key.giveThisRotationAnIdentifiableReferenceToHelpLocate')}</p>
            <Form.Item
              name="kid"
              label={
                <FieldLabel
                  label={t('oauth:key.keyId')}
                  help={t('oauth:key.aUniqueIdentifierInThePublicKeyListConsiderIncluding')}
                />
              }
              rules={[
                { required: true, message: t('oauth:key.enterAnIdentifiableKeyId') },
                {
                  pattern: /^[A-Za-z0-9._-]+$/,
                  message: t('oauth:key.useOnlyLettersDigitsPeriodsHyphensAndUnderscores'),
                },
              ]}
            >
              <Input
                placeholder={t('oauth:key.forExample202609Primary')}
                maxLength={128}
              />
            </Form.Item>
            <Form.Item
              label={
                <FieldLabel
                  label={t('oauth:key.signingMethod')}
                  help={t(
                    'oauth:key.rs256IsAWidelyCompatibleAsymmetricSigningAlgorithmApplicationsReceive'
                  )}
                />
              }
            >
              <div className="algorithm-value">
                <strong>RS256</strong>
                <span>{t('oauth:key.privateKeysAreNeverShownOrExportedOnThis')}</span>
              </div>
            </Form.Item>
          </section>
          <section className="form-section">
            <h3>{t('oauth:key.activationSchedule')}</h3>
            <p>{t('oauth:key.publishThePublicKeyBeforeUsingItToSign')}</p>
            <Form.Item
              name="publishAt"
              label={
                <FieldLabel
                  label={t('oauth:key.publicKeyPublicationTime')}
                  help={t('oauth:key.fromThisTimeApplicationsCanObtainTheNewPublicKey')}
                />
              }
              rules={[{ required: true, message: t('oauth:key.chooseAPublicKeyPublicationTime') }]}
            >
              <BusinessDateTimePicker label={t('oauth:key.publicKeyPublicationTime')} />
            </Form.Item>
            <Form.Item
              name="activateAt"
              label={
                <FieldLabel
                  label={t('oauth:key.signingStartTime')}
                  help={t('oauth:key.fromThisTimeNewlyIssuedIdentityAndAccessTokensUse')}
                />
              }
              rules={[{ required: true, message: t('oauth:key.chooseASigningStartTime') }]}
            >
              <BusinessDateTimePicker label={t('oauth:key.signingStartTime')} />
            </Form.Item>
            <Form.Item
              name="remark"
              label={
                <FieldLabel
                  label={t('oauth:key.changeDescription')}
                  help={t('oauth:key.recordTheReasonForRotationOrARelatedTicketFor')}
                />
              }
            >
              <Input.TextArea
                placeholder={t('oauth:key.forExampleRoutineQuarterlyRotationRelatedTicketSec1024')}
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
