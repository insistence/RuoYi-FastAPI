import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useLocalizedFormErrors } from '@/i18n/form'
import { CopyOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { Button, Col, Form, Input, Modal, Row, Space, Typography } from 'antd'
import { saveAs } from 'file-saver'
import {
  inputComponents,
  selectComponents,
  layoutComponents,
  formConf as defaults,
} from '@/utils/generator/config'
import {
  findField,
  mapFields,
  removeField,
  insertField,
  moveField,
  flattenFields,
  fieldRules,
  parsePattern,
} from '@/utils/generator/model'
import { makeUpJs } from '@/utils/generator/js'
import FieldControl, { fieldItemProps } from '@/utils/generator/render'
import { message, confirm } from '@/plugins/modal'
import DraggableItem from './DraggableItem'
import RightPanel from './RightPanel'
import CodeTypeDialog from './CodeTypeDialog'
import SvgIcon from '@/components/SvgIcon'
import logo from '@/assets/logo/logo.png'
import './style.css'
const storageKey = 'react-form-generator'
const allTemplates = [...inputComponents, ...selectComponents, ...layoutComponents]
const initialField = {
  ...inputComponents[0],
  formId: 100,
  vModel: 'mobile',
  get label() {
    return t('tool:mobileNumber')
  },
  get placeholder() {
    return t('tool:enterAMobileNumber')
  },
  maxlength: 11,
  defaultValue: '',
  labelWidth: undefined,
  'prefix-icon': 'phone',
  'show-word-limit': true,
  regList: [
    {
      pattern: '/^1[3-9]\\d{9}$/',
      get message() {
        return t('tool:invalidMobileNumberFormat')
      },
    },
  ],
}
function loadSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey))
    if (Array.isArray(value?.fields) && value.config) return value
  } catch {}
  return { fields: [initialField], config: defaults }
}
function PreviewFields({ fields }) {
  useI18n()

  return fields.map((field) =>
    field.layout === 'rowFormItem' ? (
      <Col
        key={field.formId}
        span={24}
      >
        <Row
          gutter={field.gutter}
          justify={field.justify}
          align={field.align}
        >
          <PreviewFields fields={field.children || []} />
        </Row>
      </Col>
    ) : (
      <Col
        key={field.formId}
        xs={24}
        md={field.span || 24}
      >
        <Form.Item
          name={field.vModel}
          label={field.label}
          rules={fieldRules(field)}
          {...fieldItemProps(field)}
        >
          <FieldControl
            field={field}
            design
          />
        </Form.Item>
      </Col>
    )
  )
}
export default function Build() {
  useI18n()

  const [saved] = useState(loadSaved)
  const [fields, setFields] = useState(saved.fields)
  const [config, setConfig] = useState(saved.config)
  const [activeId, setActive] = useState(saved.fields[0]?.formId)
  const [operation, setOperation] = useState('')
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState(false)
  const [result, setResult] = useState(null)
  const [previewForm] = Form.useForm()
  useLocalizedFormErrors(previewForm)
  const nextId = useRef(
    Math.max(100, ...flattenFields(saved.fields).map((f) => Number(f.formId) || 0))
  )
  const dragging = useRef(null)
  const active = findField(fields, activeId)
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ fields, config }))
    } catch {}
  }, [fields, config])
  function clone(source, preserveSpan = false) {
    const field = structuredClone(source)
    field.formId = ++nextId.current
    field.span = preserveSpan ? source.span : config.span
    field.layout ??= 'colFormItem'
    if (field.layout === 'rowFormItem') {
      field.componentName = `row${field.formId}`
      field.gutter ??= config.gutter
      field.children = (field.children || []).map((child) => clone(child, true))
    } else field.vModel = `field${field.formId}`
    return field
  }
  function add(template, parentId = null, beforeId = null, preserveSpan = false) {
    const field = clone(template, preserveSpan)
    setFields((fields) => insertField(fields, field, parentId, beforeId))
    setActive(field.formId)
  }
  function drop(parentId = null, beforeId = null) {
    const value = dragging.current
    if (!value) return
    if (value.id) setFields((fields) => moveField(fields, value.id, parentId, beforeId))
    else if (value.template) add(value.template, parentId, beforeId)
    dragging.current = null
  }
  async function generate(values) {
    const names = flattenFields(fields)
      .map((f) => f.vModel)
      .filter(Boolean)
    if (new Set(names).size !== names.length) return message.error(t('tool:fieldNamesMustBeUnique'))
    if (flattenFields(fields).some((f) => f.layout !== 'rowFormItem' && !f.vModel))
      return message.error(t('tool:enterComponentFieldNames'))
    if (
      flattenFields(fields).some((field) =>
        (field.regList || []).some((rule) => rule.pattern && !parsePattern(rule.pattern))
      )
    )
      return message.error(t('tool:fixTheInvalidRegularExpressions'))
    const text = makeUpJs(fields, config, values.type)
    setCode(text)
    setOperation('')
    if (operation === 'download')
      saveAs(new Blob([text], { type: 'text/javascript;charset=utf-8' }), values.fileName)
    else if (operation === 'copy') {
      try {
        await navigator.clipboard.writeText(text)
        message.success(t('tool:codeCopied'))
      } catch {
        message.warning(t('tool:clipboardAccessIsUnavailableCopyFromTheCodePreview'))
      }
    }
  }
  return (
    <div className="form-builder">
      <aside className="builder-palette">
        <h3>
          <img
            src={logo}
            alt=""
          />
          {t('tool:formGenerator')}
        </h3>
        <div className="builder-palette-content">
          {[
            [inputComponents, t('tool:inputComponents')],
            [selectComponents, t('tool:selectionComponents')],
            [layoutComponents, t('tool:layoutComponents')],
          ].map(([items, title]) => (
            <section key={title}>
              <h4>
                <SvgIcon iconClass="component" />
                {title}
              </h4>
              <div className="builder-palette-grid">
                {items.map((item) => (
                  <Button
                    key={item.tagIcon}
                    icon={<SvgIcon iconClass={item.tagIcon} />}
                    draggable
                    onDragStart={() => {
                      dragging.current = { template: item }
                    }}
                    onClick={() => add(item)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>
      <section className="builder-main">
        <Space
          wrap
          className="builder-toolbar"
        >
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => setOperation('download')}
          >
            {t('tool:exportReactFile')}
          </Button>
          <Button
            type="link"
            icon={<CopyOutlined />}
            onClick={() => setOperation('copy')}
          >
            {t('tool:copyCode')}
          </Button>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              previewForm.resetFields()
              setResult(null)
              setPreview(true)
            }}
          >
            {t('common:preview')}
          </Button>
          <Button
            type="text"
            icon={<DeleteOutlined />}
            danger
            onClick={async () => {
              try {
                await confirm(t('tool:clearAllComponents'))
                setFields([])
                setActive(null)
              } catch {}
            }}
          >
            {t('common:clear')}
          </Button>
        </Space>
        <div
          className={`builder-canvas ${config.unFocusedComponentBorder ? 'show-borders' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            drop()
          }}
        >
          <Form
            colon={false}
            layout={config.labelPosition === 'top' ? 'vertical' : 'horizontal'}
            labelAlign={config.labelPosition === 'left' ? 'left' : 'right'}
            labelCol={{ style: { width: config.labelWidth } }}
            disabled={config.disabled}
            size={config.size === 'default' ? 'middle' : config.size}
          >
            <Row gutter={config.gutter}>
              {fields.map((field) => (
                <DraggableItem
                  key={field.formId}
                  field={field}
                  parentId={null}
                  activeId={activeId}
                  onSelect={setActive}
                  onCopy={(id, parent) => {
                    const field = findField(fields, id)
                    if (field) add(field, parent, null, true)
                  }}
                  onValueChange={(id, value) =>
                    setFields((fields) =>
                      mapFields(fields, id, (field) => ({ ...field, defaultValue: value }))
                    )
                  }
                  onDelete={(id) => {
                    setFields((fields) => removeField(fields, id))
                    if (id === activeId) setActive(null)
                  }}
                  onDrag={(value) => {
                    dragging.current = value
                  }}
                  onDrop={drop}
                />
              ))}
            </Row>
          </Form>
          {!fields.length && (
            <div className="builder-canvas-empty">
              {t('tool:dragOrSelectComponentsFromTheLeftToDesign')}
            </div>
          )}
        </div>
      </section>
      <RightPanel
        field={active}
        formConf={config}
        onFormChange={setConfig}
        onChange={(field) => setFields((fields) => mapFields(fields, activeId, () => field))}
        onTypeChange={(tagIcon) => {
          const template = allTemplates.find((item) => item.tagIcon === tagIcon)
          if (template && active)
            setFields((fields) =>
              mapFields(fields, activeId, () => ({
                ...clone(template),
                formId: active.formId,
                vModel: active.vModel,
                label: active.label,
                span: active.span,
              }))
            )
        }}
      />
      <CodeTypeDialog
        open={!!operation}
        showFileName={operation === 'download'}
        onClose={() => setOperation('')}
        onConfirm={generate}
      />
      <Modal
        title={t('tool:reactCodePreview')}
        open={!!code}
        onCancel={() => setCode('')}
        footer={null}
        width="85%"
      >
        <Typography.Paragraph copyable={{ text: code }}>{t('tool:copyCode')}</Typography.Paragraph>
        <Input.TextArea
          value={code}
          readOnly
          autoSize={{ minRows: 16, maxRows: 28 }}
          spellCheck={false}
        />
      </Modal>
      <Modal
        title={t('tool:formPreview')}
        open={preview}
        onCancel={() => setPreview(false)}
        footer={null}
        width={900}
        forceRender
      >
        <Form
          colon={false}
          key={preview ? JSON.stringify(fields) : 'closed'}
          form={previewForm}
          initialValues={Object.fromEntries(
            flattenFields(fields)
              .filter((f) => f.vModel)
              .map((f) => [f.vModel, f.defaultValue])
          )}
          layout={config.labelPosition === 'top' ? 'vertical' : 'horizontal'}
          labelAlign={config.labelPosition === 'left' ? 'left' : 'right'}
          labelCol={{ style: { width: config.labelWidth } }}
          disabled={config.disabled}
          size={config.size === 'default' ? 'middle' : config.size}
          onFinish={setResult}
        >
          <Row gutter={config.gutter}>
            <PreviewFields fields={fields} />
          </Row>
          {config.formBtns && (
            <Space>
              <Button
                type="primary"
                htmlType="submit"
              >
                {t('common:submit')}
              </Button>
              <Button onClick={() => previewForm.resetFields()}>{t('common:reset')}</Button>
            </Space>
          )}
        </Form>
        {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
      </Modal>
    </div>
  )
}
