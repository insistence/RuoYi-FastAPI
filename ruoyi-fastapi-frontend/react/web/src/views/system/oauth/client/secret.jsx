import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import '@/components/OAuthWorkspace/entities.css'
import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, Modal, Space } from 'antd'
import { message } from '@/plugins/modal'
import FieldLabel from '@/components/OAuthWorkspace/FieldLabel'

export default function SecretDialog({ open, secret = {}, onClose }) {
  useI18n()

  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => {
    if (open) setConfirmed(false)
  }, [open])
  async function copy() {
    try {
      await navigator.clipboard.writeText(secret.clientSecret)
      message.success(t('system:secretCopied'))
    } catch {
      message.error(t('system:theBrowserDeniedClipboardAccessCopyTheSecretManually'))
    }
  }
  return (
    <Modal
      className="oauth-dialog oauth-secret-dialog"
      title={t('system:saveTheApplicationSecret')}
      open={open}
      width="min(680px, calc(100vw - 48px))"
      maskClosable={false}
      onCancel={onClose}
      footer={
        <Button
          type="primary"
          disabled={!confirmed}
          onClick={onClose}
        >
          {t('common:finish')}
        </Button>
      }
    >
      <Space
        orientation="vertical"
        style={{ width: '100%' }}
        size="middle"
      >
        <Alert
          type="warning"
          title={t('system:theApplicationSecretIsShownOnlyOnceStoreIt')}
        />
        <Form
          name="src-views-system-oauth-client-secret-jsx-editor-14"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '160px' }}
          layout="horizontal"
        >
          <Form.Item
            label={
              <FieldLabel
                label={t('authCenter:appId')}
                help={t('authCenter:theSystemGeneratedApplicationIdCopyItToConfigureThe')}
              />
            }
          >
            <Input
              readOnly
              value={secret.clientId || ''}
            />
          </Form.Item>
          <Form.Item
            label={
              <FieldLabel
                label={t('system:applicationSecret')}
                help={t('authCenter:theApplicationSecretActsAsItsPasswordAndIsShown')}
              />
            }
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input
                readOnly
                value={secret.clientSecret || ''}
              />
              <Button onClick={copy}>{t('common:copy')}</Button>
            </Space.Compact>
          </Form.Item>
        </Form>
        <Checkbox
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        >
          {t('system:iHaveStoredTheSecretSecurely')}
        </Checkbox>
      </Space>
    </Modal>
  )
}
