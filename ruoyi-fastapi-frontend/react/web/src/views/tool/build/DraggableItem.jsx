import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Button, Col, Form, Row, Space } from 'antd'
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons'
import FieldControl, { fieldItemProps } from '@/utils/generator/render'
export default function DraggableItem({
  field,
  activeId,
  parentId,
  onSelect,
  onCopy,
  onDelete,
  onDrag,
  onDrop,
  onValueChange,
}) {
  useI18n()

  return (
    <Col
      xs={24}
      md={field.layout === 'rowFormItem' ? 24 : field.span || 24}
    >
      <div
        className={`builder-item ${field.formId === activeId ? 'active' : ''}`}
        draggable
        onClick={(event) => {
          event.stopPropagation()
          onSelect(field.formId)
        }}
        onDragStart={(event) => {
          event.stopPropagation()
          onDrag({ id: field.formId })
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onDrop(parentId, field.formId)
        }}
      >
        <Space className="builder-item-actions">
          <Button
            type="text"
            size="small"
            aria-label={t('tool:duplicateComponent')}
            icon={<CopyOutlined />}
            onClick={(event) => {
              event.stopPropagation()
              onCopy(field.formId, parentId)
            }}
          />
          <Button
            type="text"
            size="small"
            danger
            aria-label={t('tool:deleteComponent')}
            icon={<DeleteOutlined />}
            onClick={(event) => {
              event.stopPropagation()
              onDelete(field.formId)
            }}
          />
        </Space>
        {field.layout === 'rowFormItem' ? (
          <div
            className="builder-row"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onDrop(field.formId)
            }}
          >
            <small>
              {t('tool:rowContainer')} {field.componentName}
            </small>
            <Row
              gutter={field.gutter}
              justify={field.justify}
              align={field.align}
            >
              {field.children?.map((child) => (
                <DraggableItem
                  key={child.formId}
                  field={child}
                  activeId={activeId}
                  parentId={field.formId}
                  onSelect={onSelect}
                  onCopy={onCopy}
                  onDelete={onDelete}
                  onDrag={onDrag}
                  onDrop={onDrop}
                  onValueChange={onValueChange}
                />
              ))}
            </Row>
            {!field.children?.length && (
              <div className="builder-empty">{t('tool:dropAComponentHere')}</div>
            )}
          </div>
        ) : (
          <Form.Item
            label={field.label}
            required={field.required}
            labelCol={field.labelWidth != null ? { style: { width: field.labelWidth } } : undefined}
          >
            <FieldControl
              field={field}
              design
              {...(fieldItemProps(field).getValueProps?.(field.defaultValue) || {
                [fieldItemProps(field).valuePropName || 'value']: field.defaultValue,
              })}
              onChange={(...args) => {
                const adapter = fieldItemProps(field).getValueFromEvent
                const value = adapter
                  ? adapter(...args)
                  : args[0]?.target
                    ? args[0].target.value
                    : args[0]
                onValueChange?.(field.formId, value)
              }}
            />
          </Form.Item>
        )}
      </div>
    </Col>
  )
}
