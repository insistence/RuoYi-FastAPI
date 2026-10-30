import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, Form, Input, InputNumber, Modal, Select, Space, Switch } from 'antd'
import HasPermi from '@/directive/permission/hasPermi'
import { message } from '@/plugins/modal'
import { formatConfigConstraint, formatConfigDefaultValue } from '../formatter'
import PluginConfigStatus from './PluginConfigStatus'
import PluginTag from './PluginTag'
import { FormatPainterOutlined } from '@ant-design/icons'

export default function PluginConfigDialog({
  open,
  pluginId,
  title = t('system:pluginConfiguration'),
  items = [],
  loading,
  onClose,
  onSubmit,
  refreshKey = 0,
}) {
  const { locale } = useI18n()

  const [form] = Form.useForm(),
    [validating, setValidating] = useState(false)
  useLocalizedFormErrors(form)
  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({
      values: Object.fromEntries(
        items.map((item) => [
          item.key,
          item.type === 'json' && typeof item.value === 'object' && item.value !== null
            ? JSON.stringify(item.value, null, 2)
            : item.value,
        ])
      ),
    })
  }, [items, form, open])
  const groups = useMemo(() => {
    const map = new Map()
    ;[...items]
      .sort(
        (a, b) =>
          String(a.group || 'default').localeCompare(b.group || 'default') ||
          Number(a.order || 0) - Number(b.order || 0) ||
          a.key.localeCompare(b.key)
      )
      .forEach((item) => {
        const group = item.group || 'default'
        if (!map.has(group)) map.set(group, [])
        map.get(group).push(item)
      })
    return [...map]
  }, [items, locale])
  function rules(item) {
    return [
      { required: !!item.required, message: t('system:required') },
      {
        validator: async (_, value) => {
          if (value === undefined || value === null || value === '') return
          if (item.type === 'number') {
            if (!Number.isFinite(Number(value))) throw new Error(t('system:enterANumber'))
            if (item.min != null && value < Number(item.min))
              throw new Error(t('pluginAdmin:mustBeAtLeastValue', { min: item.min }))
            if (item.max != null && value > Number(item.max))
              throw new Error(t('pluginAdmin:mustNotExceedValue', { max: item.max }))
          }
          if (item.pattern && ['string', 'textarea', 'password'].includes(item.type)) {
            let regex
            try {
              regex = new RegExp(item.pattern)
            } catch {
              throw new Error(t('system:invalidConfigurationRegularExpression'))
            }
            if (!regex.test(String(value))) throw new Error(t('system:invalidFormat'))
          }
          if (item.type === 'json') {
            try {
              JSON.parse(value)
            } catch {
              throw new Error(t('system:enterValidJson'))
            }
          }
        },
      },
    ]
  }
  async function submit() {
    setValidating(true)
    try {
      const result = await form.validateFields()
      const values = Object.fromEntries(
        items.map((item) => {
          const value = result.values[item.key]
          return [
            item.key,
            item.type === 'json' && typeof value === 'string' && value.trim()
              ? JSON.parse(value)
              : value,
          ]
        })
      )
      await onSubmit(values)
    } catch {
    } finally {
      setValidating(false)
    }
  }
  const control = (item) => {
    const placeholder = item.placeholder || item.description || ''
    switch (item.type) {
      case 'boolean':
        return <Switch />
      case 'number':
        return (
          <InputNumber
            mode="spinner"
            min={item.min ?? undefined}
            max={item.max ?? undefined}
            placeholder={placeholder}
            style={{ width: '100%' }}
          />
        )
      case 'select':
        return (
          <Select
            options={item.options || []}
            placeholder={placeholder}
          />
        )
      case 'textarea':
      case 'json':
        return (
          <Input.TextArea
            rows={4}
            placeholder={placeholder}
          />
        )
      default:
        return item.secret || item.type === 'password' ? (
          <Input.Password placeholder={placeholder} />
        ) : (
          <Input placeholder={placeholder} />
        )
    }
  }
  return (
    <Modal
      className="plugin-dialog plugin-config-dialog"
      title={title}
      open={open}
      width="min(720px, calc(100vw - 32px))"
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Space>
          <HasPermi value={['system:plugin:edit']}>
            <Button
              type="primary"
              loading={loading || validating}
              disabled={!items.length}
              onClick={submit}
            >
              {t('common:save')}
            </Button>
          </HasPermi>
          <Button onClick={onClose}>{t('layout:search.close')}</Button>
        </Space>
      }
    >
      {open && pluginId && (
        <PluginConfigStatus
          pluginId={pluginId}
          refreshKey={refreshKey}
        />
      )}
      <Form
        name="src-views-system-plugin-components-PluginConfigDialog-jsx-editor-16"
        colon={false}
        wrapperCol={{ flex: '1 1 0' }}
        labelCol={{ flex: '120px' }}
        className="plugin-config-form ruoyi-dialog-form"
        form={form}
        layout="horizontal"
      >
        {!items.length && <Empty description={t('system:noPluginConfiguration')} />}
        {groups.map(([group, groupItems]) => (
          <div
            key={group}
            className="plugin-config-section"
          >
            {(groups.length > 1 || group !== 'default') && (
              <div className="plugin-config-section-title">
                {{
                  default: t('system:basicConfiguration'),
                  model: t('system:modelConfiguration'),
                  security: t('system:securityConfiguration'),
                  advanced: t('system:advancedConfiguration'),
                }[group] || group}
              </div>
            )}
            {groupItems.map((item) => (
              <Form.Item
                key={item.key}
                label={item.label || item.key}
                required={item.required}
                extra={
                  <>
                    {item.type === 'json' && (
                      <div className="config-inline-actions">
                        <Button
                          type="link"
                          icon={<FormatPainterOutlined />}
                          onClick={() => {
                            try {
                              const value = form.getFieldValue(['values', item.key])
                              if (value)
                                form.setFieldValue(
                                  ['values', item.key],
                                  JSON.stringify(JSON.parse(value), null, 2)
                                )
                            } catch {
                              message.error(
                                t('pluginAdmin:valueIsNotValidJson', {
                                  arg0: item.label || item.key,
                                })
                              )
                            }
                          }}
                        >
                          {t('system:formatJson')}
                        </Button>
                      </div>
                    )}
                    <div>{item.description}</div>
                    <Space
                      wrap
                      size={6}
                      className="config-meta-list"
                    >
                      <PluginTag effect="plain">{item.key}</PluginTag>
                      {item.required && (
                        <PluginTag
                          type="warning"
                          effect="plain"
                        >
                          {t('system:components.required')}
                        </PluginTag>
                      )}
                      {item.secret && (
                        <PluginTag
                          type="warning"
                          effect="plain"
                        >
                          {t('system:sensitive')}
                        </PluginTag>
                      )}
                      {formatConfigDefaultValue(item) !== '-' && (
                        <PluginTag effect="plain">
                          {t('layout:size.default')} {formatConfigDefaultValue(item)}
                        </PluginTag>
                      )}
                      {formatConfigConstraint(item) !== '-' && (
                        <PluginTag effect="plain">{formatConfigConstraint(item)}</PluginTag>
                      )}
                    </Space>
                  </>
                }
              >
                <Form.Item
                  noStyle
                  name={['values', item.key]}
                  valuePropName={item.type === 'boolean' ? 'checked' : 'value'}
                  rules={rules(item)}
                >
                  {control(item)}
                </Form.Item>
              </Form.Item>
            ))}
          </div>
        ))}
      </Form>
    </Modal>
  )
}
