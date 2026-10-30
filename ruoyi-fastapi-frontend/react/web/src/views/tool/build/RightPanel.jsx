import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useState } from 'react'
import {
  CloseCircleFilled,
  HolderOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  Button,
  ColorPicker,
  Divider,
  Slider,
  Empty,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Switch,
  Tabs,
  Tree,
} from 'antd'
import { inputComponents, selectComponents } from '@/utils/generator/config'
import { findField, moveField, parsePattern } from '@/utils/generator/model'
import TreeNodeDialog from './TreeNodeDialog'
import IconsDialog from './IconsDialog'
function get(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object)
}
function set(object, path, value) {
  const next = structuredClone(object)
  const keys = path.split('.')
  let target = next
  for (const key of keys.slice(0, -1)) {
    target[key] ??= {}
    target = target[key]
  }
  target[keys.at(-1)] = value
  return next
}
function parseValue(text, previous) {
  const scalar = (value) =>
    ['true', 'false'].includes(value)
      ? value === 'true'
      : /^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())
        ? Number(value)
        : value
  return Array.isArray(previous) ? text.split(',').map(scalar) : scalar(text)
}
function ValueInput({ value, onChange, label }) {
  useI18n()

  return (
    <Input
      aria-label={label}
      placeholder={t('monitor:enterValue', { label })}
      value={Array.isArray(value) ? value.join(',') : value == null ? '' : String(value)}
      onChange={(event) => onChange(parseValue(event.target.value, value))}
    />
  )
}
const dateFormats = {
  date: 'YYYY-MM-DD',
  week: 'YYYY 第 ww 周',
  month: 'YYYY-MM',
  year: 'YYYY',
  datetime: 'YYYY-MM-DD HH:mm:ss',
  daterange: 'YYYY-MM-DD',
  monthrange: 'YYYY-MM',
  datetimerange: 'YYYY-MM-DD HH:mm:ss',
}
export default function RightPanel({ field, onChange, formConf, onFormChange, onTypeChange }) {
  useI18n()

  const [adding, setAdding] = useState(null)
  const [iconKey, setIconKey] = useState('')
  const update = (key, value) => {
    let next = set(field, key, value)
    if (key === 'label' && typeof field.placeholder === 'string')
      next.placeholder = field.placeholder.replace(field.label, '') + value
    if (key === 'span') onFormChange({ ...formConf, span: value })
    if (key === 'multiple' && field.tag === 'Select') next.defaultValue = value ? [] : ''
    if (key === 'range') next.defaultValue = value ? [field.min, field.max] : field.min
    if (key === 'show-text' && value) next['show-score'] = false
    if (key === 'show-score' && value) next['show-text'] = false
    if (key === 'color-format') {
      next.defaultValue = null
      next['show-alpha'] = value === 'rgba'
    }
    if (key === 'format' || (key === 'type' && field.tag === 'DatePicker')) {
      next.format = key === 'format' ? value : dateFormats[value]
      next['value-format'] = next.type === 'week' ? dateFormats.date : next.format
      next.defaultValue = null
    }
    onChange(next)
  }
  function layoutTree(items, parentId = null) {
    return items.map((item) => ({
      key: item.formId,
      title: item.componentName || `${item.label}: ${item.vModel || ''}`,
      parentId,
      isLeaf: item.layout !== 'rowFormItem',
      children: item.children ? layoutTree(item.children, item.formId) : undefined,
    }))
  }
  function moveLayout({ dragNode, node, dropToGap, dropPosition }) {
    if (dragNode.key === field.formId || (node.key === field.formId && dropToGap)) return
    const target = findField([field], node.key)
    if (!dropToGap && target.layout !== 'rowFormItem') return
    const parentId = dropToGap ? node.parentId : node.key
    const siblings = findField([field], parentId)?.children || []
    const after = dropPosition - Number(node.pos.split('-').at(-1)) > 0
    const beforeId = dropToGap
      ? after
        ? (siblings[siblings.findIndex((item) => item.formId === node.key) + 1]?.formId ?? null)
        : node.key
      : null
    onChange(moveField([field], dragNode.key, parentId, beforeId)[0])
  }
  function moveOption({ dragNode, node, dropToGap, dropPosition }) {
    const source = dragNode.key.split('.').map(Number),
      target = node.key.split('.').map(Number)
    if (node.key === dragNode.key || node.key.startsWith(`${dragNode.key}.`)) return
    const options = structuredClone(field.options)
    const at = (path) => path.reduce((list, index) => (list[index].children ||= []), options)
    const sourceList = at(source.slice(0, -1)),
      item = sourceList[source.at(-1)]
    const targetList = dropToGap ? at(target.slice(0, -1)) : at(target)
    let index = dropToGap
      ? target.at(-1) + (dropPosition - Number(node.pos.split('-').at(-1)) > 0 ? 1 : 0)
      : targetList.length
    if (sourceList === targetList && source.at(-1) < index) index--
    sourceList.splice(source.at(-1), 1)
    targetList.splice(index, 0, item)
    update('options', options)
  }
  function updateOption(path, change) {
    const options = structuredClone(field.options || [])
    let list = options
    for (const index of path.slice(0, -1)) list = list[index].children ??= []
    if (change === null) list.splice(path.at(-1), 1)
    else if (path.length) {
      list[path.at(-1)].children ??= []
      list[path.at(-1)].children.push(change)
    } else options.push(change)
    update('options', options)
  }
  function optionTree(options, parent = []) {
    return options.map((option, i) => {
      const path = [...parent, i]
      return {
        key: path.join('.'),
        title: (
          <Space>
            <span>
              {option.label} ({String(option.value)})
            </span>
            {field.tag === 'Cascader' && (
              <Button
                size="small"
                type="text"
                onClick={() => setAdding(path)}
              >
                {t('tool:childItem')}
              </Button>
            )}
            <Button
              size="small"
              type="text"
              danger
              onClick={() => updateOption(path, null)}
            >
              {t('common:delete')}
            </Button>
          </Space>
        ),
        children: option.children ? optionTree(option.children, path) : undefined,
      }
    })
  }
  const textFields = [
    ['vModel', t('tool:fieldName'), t('tool:enterAFieldNameVModel')],
    ['label', t('tool:title'), t('tool:enterATitle')],
    ['placeholder', t('tool:placeholder'), t('tool:enterPlaceholderText')],
    ['start-placeholder', t('tool:startPlaceholder'), t('tool:enterPlaceholderText')],
    ['end-placeholder', t('tool:endPlaceholder'), t('tool:enterPlaceholderText')],
    ['style.width', t('tool:componentWidth')],
    ['prepend', t('tool:prefix')],
    ['append', t('tool:suffix')],
    ['separator', t('tool:optionSeparator')],
    ['active-text', t('tool:onText')],
    ['inactive-text', t('tool:offText')],
    ['name', t('tool:fileFieldName'), t('tool:enterTheUploadFileFieldName')],
    ['action', t('tool:uploadUrl')],
    ['buttonText', t('tool:buttonText')],
    ['tip', t('tool:uploadHint')],
    ['range-separator', t('tool:separator')],
    ['format', t('tool:timeFormat'), t('tool:enterATimeFormat')],
    ['labelKey', t('tool:labelProperty')],
    ['valueKey', t('tool:valueProperty')],
    ['childrenKey', t('tool:childrenProperty')],
  ]
  const numberFields = [
    ['gutter', t('tool:gridGap')],
    ['labelWidth', t('tool:labelWidth'), t('tool:enterLabelWidth')],
    ['autosize.minRows', t('tool:minimumRows')],
    ['autosize.maxRows', t('tool:maximumRows')],
    ['min', t('tool:minimumValue')],
    ['max', t('tool:maximumValue')],
    ['step', t('tool:step'), t('tool:steps')],
    ['precision', t('tool:precision')],
  ]
  const boolFields = [
    ['props.props.multiple', t('tool:multipleSelection')],
    ['show-all-levels', t('tool:showFullPath')],
    ['allow-half', t('tool:allowHalfValues')],
    ['show-text', t('tool:helperText')],
    ['show-score', t('tool:showScore')],
    ['show-stops', t('tool:showStepMarks')],
    ['range', t('tool:rangeSelection')],
    ['show-alpha', t('tool:transparency')],
    ['show-word-limit', t('tool:characterCount')],
    ['step-strictly', t('tool:strictStep')],
    ['showTip', t('tool:showTooltip')],
    ['auto-upload', t('tool:uploadAutomatically')],
    ['clearable', t('tool:allowClearing')],
    ['multiple', field?.tag === 'Upload' ? t('tool:multipleFiles') : t('tool:multipleSelection')],
    ['filterable', field?.tag === 'Cascader' ? t('tool:allowFiltering') : t('tool:searchable')],
    ['readonly', t('tool:readOnly')],
    ['disabled', t('tool:disabled')],
    ['required', t('tool:required')],
  ]
  const exists = (key) =>
    get(field, key) !== undefined ||
    key === 'span' ||
    (['min', 'max', 'step', 'precision'].includes(key) && field.tag === 'InputNumber') ||
    (['min', 'max'].includes(key) && field.tag === 'Checkbox.Group')
  const renderTextFields = (keys) =>
    textFields
      .filter(
        ([key]) =>
          keys.includes(key) &&
          exists(key) &&
          (!['labelKey', 'valueKey', 'childrenKey'].includes(key) || field.dataType === 'dynamic')
      )
      .map(([key, label, placeholder]) => (
        <Form.Item
          key={key}
          label={label}
        >
          <Input
            placeholder={placeholder || t('monitor:enterValue', { label })}
            value={get(field, key)}
            onChange={(event) => update(key, event.target.value)}
          />
        </Form.Item>
      ))
  return (
    <div className="builder-properties">
      <a
        className="builder-document-link"
        title={t('tool:viewComponentDocumentation')}
        aria-label={t('tool:viewComponentDocumentation')}
        href={field?.document || 'https://ant.design/components/overview-cn'}
        target="_blank"
        rel="noreferrer"
      >
        <LinkOutlined />
      </a>
      <Tabs
        items={[
          {
            key: 'field',
            label: t('tool:componentProperties'),
            children: field ? (
              <Form layout="vertical">
                {field.changeTag && (
                  <Form.Item label={t('tool:componentType')}>
                    <Select
                      placeholder={t('tool:chooseAComponentType')}
                      value={field.tagIcon}
                      options={[
                        [t('tool:inputComponents'), inputComponents],
                        [t('tool:selectionComponents'), selectComponents],
                      ].map(([label, items]) => ({
                        label,
                        options: items.map((item) => ({ label: item.label, value: item.tagIcon })),
                      }))}
                      onChange={onTypeChange}
                    />
                  </Form.Item>
                )}
                {renderTextFields(['vModel'])}
                {field.componentName !== undefined && (
                  <Form.Item label={t('tool:componentName')}>{field.componentName}</Form.Item>
                )}
                {renderTextFields(['label', 'placeholder', 'start-placeholder', 'end-placeholder'])}
                {exists('span') && (
                  <Form.Item label={t('tool:formGrid')}>
                    <Slider
                      min={1}
                      max={24}
                      marks={{ 12: '' }}
                      value={field.span || 24}
                      onChange={(value) => update('span', value)}
                    />
                  </Form.Item>
                )}
                {renderTextFields(['style.width'])}
                {field.vModel !== undefined && (
                  <Form.Item label={t('system:defaultValue')}>
                    <ValueInput
                      value={field.defaultValue}
                      onChange={(value) => update('defaultValue', value)}
                      label={t('system:defaultValue')}
                    />
                  </Form.Item>
                )}
                {renderTextFields(['prepend', 'append'])}
                {['prefix-icon', 'suffix-icon', 'icon'].filter(exists).map((key) => (
                  <Form.Item
                    key={key}
                    label={
                      key === 'icon'
                        ? t('tool:icon')
                        : key === 'prefix-icon'
                          ? t('tool:prefixIcon')
                          : t('tool:suffixIcon')
                    }
                  >
                    <Space.Compact block>
                      <Input
                        placeholder={t('tool:enterTheValueIconName', {
                          arg0:
                            key === 'prefix-icon'
                              ? t('tool:build.prefix')
                              : key === 'suffix-icon'
                                ? t('tool:build.suffix')
                                : '',
                        })}
                        value={field[key]}
                        onChange={(event) => update(key, event.target.value)}
                      />
                      <Button onClick={() => setIconKey(key)}>{t('layout:search.select')}</Button>
                    </Space.Compact>
                  </Form.Item>
                ))}
                {numberFields
                  .filter(([key]) => exists(key))
                  .map(([key, label, placeholder]) => (
                    <Form.Item
                      key={key}
                      label={
                        field.tag === 'Checkbox.Group' && ['min', 'max'].includes(key)
                          ? key === 'min'
                            ? t('tool:minimumSelections')
                            : t('tool:maximumSelections')
                          : label
                      }
                    >
                      <InputNumber
                        placeholder={
                          field.tag === 'Checkbox.Group' && ['min', 'max'].includes(key)
                            ? key === 'min'
                              ? t('tool:minimumSelections')
                              : t('tool:maximumSelections')
                            : placeholder || label
                        }
                        value={get(field, key)}
                        min={key === 'span' ? 1 : undefined}
                        max={key === 'span' ? 24 : undefined}
                        onChange={(value) => update(key, value)}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  ))}
                {renderTextFields([
                  'separator',
                  'active-text',
                  'inactive-text',
                  'name',
                  'action',
                  'buttonText',
                  'tip',
                  'range-separator',
                  'format',
                  'labelKey',
                  'valueKey',
                  'childrenKey',
                ])}
                {field.tag === 'Switch' && (
                  <>
                    {[
                      ['active-value', t('tool:onValue')],
                      ['inactive-value', t('tool:offValue')],
                    ].map(([key, label]) => (
                      <Form.Item
                        key={key}
                        label={label}
                      >
                        <ValueInput
                          value={field[key]}
                          onChange={(value) => update(key, value)}
                          label={label}
                        />
                      </Form.Item>
                    ))}
                  </>
                )}
                {field.tag === 'DatePicker' && (
                  <Form.Item label={t('tool:timeType')}>
                    <Select
                      placeholder={t('tool:chooseATimeType')}
                      value={field.type}
                      options={(field['start-placeholder'] === undefined
                        ? [
                            [t('tool:dayDate'), 'date'],
                            [t('tool:weekWeek'), 'week'],
                            [t('tool:monthMonth'), 'month'],
                            [t('tool:yearYear'), 'year'],
                            [t('tool:dateAndTimeDatetime'), 'datetime'],
                          ]
                        : [
                            [t('tool:dateRangeDaterange'), 'daterange'],
                            [t('tool:monthRangeMonthrange'), 'monthrange'],
                            [t('tool:dateAndTimeRangeDatetimerange'), 'datetimerange'],
                          ]
                      ).map(([label, value]) => ({ label, value }))}
                      onChange={(value) => update('type', value)}
                    />
                  </Form.Item>
                )}
                {field.tag === 'InputNumber' && (
                  <Form.Item label={t('tool:buttonPosition')}>
                    <Radio.Group
                      optionType="button"
                      value={field['controls-position']}
                      options={[
                        { label: t('layout:size.default'), value: '' },
                        { label: t('tool:right'), value: 'right' },
                      ]}
                      onChange={(event) => update('controls-position', event.target.value)}
                    />
                  </Form.Item>
                )}
                {field.maxlength !== undefined && (
                  <Form.Item label={t('tool:maximumLength')}>
                    <Input
                      placeholder={t('tool:enterACharacterLimit')}
                      suffix={t('tool:characters')}
                      value={field.maxlength}
                      onChange={(event) =>
                        update('maxlength', event.target.value ? Number(event.target.value) : null)
                      }
                    />
                  </Form.Item>
                )}
                {field['picker-options'] && (
                  <Form.Item label={t('tool:timePeriod')}>
                    <Input
                      placeholder={t('tool:enterATimePeriod')}
                      value={field['picker-options'].selectableRange}
                      onChange={(event) =>
                        update('picker-options.selectableRange', event.target.value)
                      }
                    />
                  </Form.Item>
                )}
                {field.layout === 'rowFormItem' && (
                  <>
                    <Form.Item label={t('tool:horizontalAlignment')}>
                      <Select
                        placeholder={t('tool:chooseHorizontalAlignment')}
                        value={field.justify}
                        options={[
                          'start',
                          'end',
                          'center',
                          'space-around',
                          'space-between',
                          'space-evenly',
                        ].map((value) => ({ value, label: value }))}
                        onChange={(value) => update('justify', value)}
                      />
                    </Form.Item>
                    <Form.Item label={t('tool:verticalAlignment')}>
                      <Radio.Group
                        optionType="button"
                        value={field.align}
                        options={['top', 'middle', 'bottom'].map((value) => ({
                          value,
                          label: value,
                        }))}
                        onChange={(event) => update('align', event.target.value)}
                      />
                    </Form.Item>
                  </>
                )}
                {field.dataType && (
                  <Form.Item label={t('tool:dataType')}>
                    <Radio.Group
                      optionType="button"
                      value={field.dataType}
                      onChange={(e) => update('dataType', e.target.value)}
                      options={[
                        { label: t('tool:staticData'), value: 'static' },
                        { label: t('tool:dynamicData'), value: 'dynamic' },
                      ]}
                    />
                  </Form.Item>
                )}
                {field.options && (field.tag !== 'Cascader' || field.dataType === 'static') && (
                  <>
                    <Divider>{t('tool:options')}</Divider>
                    {field.tag === 'Cascader' ? (
                      <Tree
                        blockNode
                        draggable
                        onDrop={moveOption}
                        treeData={optionTree(field.options)}
                        defaultExpandAll
                      />
                    ) : (
                      field.options.map((option, index) => (
                        <div
                          key={index}
                          className="builder-option-row"
                          draggable
                          onDragStart={(event) =>
                            event.dataTransfer.setData('builder-option', String(index))
                          }
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault()
                            const raw = event.dataTransfer.getData('builder-option')
                            if (raw === '') return
                            const options = [...field.options]
                            const [item] = options.splice(Number(raw), 1)
                            options.splice(index, 0, item)
                            update('options', options)
                          }}
                        >
                          <span
                            className="builder-option-drag"
                            aria-label={t('tool:dragOption')}
                          >
                            <HolderOutlined />
                          </span>
                          <Input
                            placeholder={t('tool:optionLabel')}
                            value={option.label}
                            onChange={(event) =>
                              update(
                                'options',
                                field.options.map((item, i) =>
                                  i === index ? { ...item, label: event.target.value } : item
                                )
                              )
                            }
                          />
                          <Input
                            placeholder={t('tool:optionValue')}
                            value={option.value}
                            onChange={(event) =>
                              update(
                                'options',
                                field.options.map((item, i) =>
                                  i === index
                                    ? { ...item, value: parseValue(event.target.value, undefined) }
                                    : item
                                )
                              )
                            }
                          />
                          <Button
                            size="small"
                            type="text"
                            danger
                            aria-label={t('tool:deleteOptionValue', { arg0: index + 1 })}
                            onClick={() => updateOption([index], null)}
                          >
                            <MinusCircleOutlined />
                          </Button>
                        </div>
                      ))
                    )}
                    <Button
                      type="link"
                      icon={<PlusOutlined />}
                      onClick={() =>
                        field.tag === 'Cascader'
                          ? setAdding([])
                          : update('options', [...field.options, { label: '', value: '' }])
                      }
                    >
                      {field.tag === 'Cascader' ? t('tool:addParent') : t('tool:addOption')}
                    </Button>
                    <Divider />
                  </>
                )}
                {field.optionType && (
                  <Form.Item label={t('tool:optionStyle')}>
                    <Radio.Group
                      optionType="button"
                      value={field.optionType}
                      onChange={(e) => update('optionType', e.target.value)}
                      options={[
                        { label: t('layout:size.default'), value: 'default' },
                        { label: t('system:menu.button'), value: 'button' },
                      ]}
                    />
                  </Form.Item>
                )}
                {field.tag === 'Upload' && (
                  <>
                    <Form.Item label={t('tool:fileType')}>
                      <Select
                        allowClear
                        placeholder={t('tool:chooseAFileType')}
                        value={field.accept || undefined}
                        options={[
                          [t('file:image'), 'image/*'],
                          [t('tool:video'), 'video/*'],
                          [t('tool:audio'), 'audio/*'],
                          ['excel', '.xls,.xlsx'],
                          ['word', '.doc,.docx'],
                          ['pdf', '.pdf'],
                          ['txt', '.txt'],
                        ].map(([label, value]) => ({ label, value }))}
                        onChange={(value) => update('accept', value || '')}
                      />
                    </Form.Item>
                    <Form.Item label={t('system:fileSize')}>
                      <Space.Compact block>
                        <InputNumber
                          placeholder={t('tool:enterAFileSize')}
                          min={0}
                          value={field.fileSize}
                          onChange={(value) => update('fileSize', value)}
                        />
                        <Select
                          style={{ width: 76 }}
                          value={field.sizeUnit}
                          options={['KB', 'MB', 'GB'].map((value) => ({ value, label: value }))}
                          onChange={(value) => update('sizeUnit', value)}
                        />
                      </Space.Compact>
                    </Form.Item>
                    <Form.Item label={t('tool:listType')}>
                      <Radio.Group
                        optionType="button"
                        value={field['list-type']}
                        options={['text', 'picture', 'picture-card'].map((value) => ({
                          value,
                          label: value,
                        }))}
                        onChange={(event) => update('list-type', event.target.value)}
                      />
                    </Form.Item>
                  </>
                )}
                {field.tag === 'Button' && (
                  <>
                    <Form.Item label={t('tool:buttonText')}>
                      <Input
                        placeholder={t('tool:enterButtonText')}
                        value={field.default}
                        onChange={(e) => update('default', e.target.value)}
                      />
                    </Form.Item>
                    <Form.Item label={t('tool:buttonType')}>
                      <Select
                        value={field.type}
                        options={['primary', 'default', 'dashed', 'text', 'link'].map((value) => ({
                          value,
                          label: value,
                        }))}
                        onChange={(value) => update('type', value)}
                      />
                    </Form.Item>
                  </>
                )}
                {['active-color', 'inactive-color'].filter(exists).map((key) => (
                  <Form.Item
                    key={key}
                    label={key === 'active-color' ? t('tool:onColor') : t('tool:offColor')}
                  >
                    <ColorPicker
                      value={field[key] || undefined}
                      onChange={(_, value) => update(key, value)}
                    />
                  </Form.Item>
                ))}
                {exists('border') && field.optionType === 'default' && (
                  <Form.Item label={t('tool:bordered')}>
                    <Switch
                      checked={field.border}
                      onChange={(value) => update('border', value)}
                    />
                  </Form.Item>
                )}
                {field.tag === 'ColorPicker' && (
                  <Form.Item label={t('tool:colorFormat')}>
                    <Select
                      placeholder={t('tool:chooseAColorFormat')}
                      value={field['color-format'] || undefined}
                      options={['hex', 'rgb', 'rgba', 'hsv', 'hsl'].map((value) => ({
                        label: value,
                        value,
                      }))}
                      onChange={(value) => update('color-format', value)}
                    />
                  </Form.Item>
                )}
                {field.size !== undefined &&
                  (field.optionType === 'button' ||
                    field.border ||
                    field.tag === 'ColorPicker') && (
                    <Form.Item label={t('tool:optionSize')}>
                      <Radio.Group
                        optionType="button"
                        value={field.size}
                        options={[
                          { label: t('layout:size.large'), value: 'large' },
                          { label: t('layout:size.default'), value: 'default' },
                          { label: t('tool:smaller'), value: 'small' },
                        ]}
                        onChange={(event) => update('size', event.target.value)}
                      />
                    </Form.Item>
                  )}
                {field.layoutTree && (
                  <>
                    <Divider>{t('tool:layoutTree')}</Divider>
                    <Tree
                      defaultExpandAll
                      blockNode
                      draggable={{ nodeDraggable: (node) => node.key !== field.formId }}
                      treeData={layoutTree([field])}
                      onDrop={moveLayout}
                    />
                  </>
                )}
                {boolFields
                  .filter(([key]) => exists(key))
                  .map(([key, label]) => (
                    <Form.Item
                      key={key}
                      label={label}
                      className="builder-boolean-property"
                    >
                      <Switch
                        aria-label={label}
                        checked={!!get(field, key)}
                        onChange={(value) => update(key, value)}
                      />
                    </Form.Item>
                  ))}
                {field.regList && (
                  <>
                    <Divider>{t('tool:regularExpressionValidation')}</Divider>
                    {field.regList.map((rule, i) => (
                      <div
                        key={i}
                        className="builder-rule"
                      >
                        <Form.Item
                          label={t('tool:expression')}
                          validateStatus={
                            rule.pattern && !parsePattern(rule.pattern) ? 'error' : undefined
                          }
                          help={
                            rule.pattern && !parsePattern(rule.pattern)
                              ? t('tool:invalidRegularExpression')
                              : undefined
                          }
                        >
                          <Input
                            placeholder={t('tool:enterARegularExpression')}
                            value={rule.pattern}
                            onChange={(e) =>
                              update(
                                'regList',
                                field.regList.map((r, index) =>
                                  index === i ? { ...r, pattern: e.target.value } : r
                                )
                              )
                            }
                          />
                        </Form.Item>
                        <Form.Item label={t('tool:errorMessage')}>
                          <Input
                            placeholder={t('tool:enterAnErrorMessage')}
                            value={rule.message}
                            onChange={(e) =>
                              update(
                                'regList',
                                field.regList.map((r, index) =>
                                  index === i ? { ...r, message: e.target.value } : r
                                )
                              )
                            }
                          />
                        </Form.Item>
                        <Button
                          danger
                          type="text"
                          className="builder-rule-delete"
                          aria-label={t('tool:deleteRule')}
                          icon={<CloseCircleFilled />}
                          size="small"
                          onClick={() =>
                            update(
                              'regList',
                              field.regList.filter((_, index) => index !== i)
                            )
                          }
                        ></Button>
                      </div>
                    ))}
                    <Button
                      type="link"
                      icon={<PlusOutlined />}
                      onClick={() =>
                        update('regList', [...field.regList, { pattern: '', message: '' }])
                      }
                    >
                      {t('tool:addRule')}
                    </Button>
                  </>
                )}
              </Form>
            ) : (
              <Empty description={t('tool:chooseAComponent')} />
            ),
          },
          {
            key: 'form',
            label: t('tool:formProperties'),
            children: (
              <Form layout="vertical">
                {[
                  ['formRef', t('tool:formName'), t('tool:enterAFormNameRef')],
                  ['formModel', t('tool:formModel'), t('tool:enterADataModel')],
                  ['formRules', t('tool:validationModel'), t('tool:enterAValidationModel')],
                ].map(([key, label, placeholder]) => (
                  <Form.Item
                    key={key}
                    label={label}
                  >
                    <Input
                      placeholder={placeholder}
                      value={formConf[key]}
                      onChange={(e) => onFormChange({ ...formConf, [key]: e.target.value })}
                    />
                  </Form.Item>
                ))}
                <Form.Item label={t('tool:formSize')}>
                  <Radio.Group
                    optionType="button"
                    value={formConf.size}
                    options={[
                      { label: t('layout:size.large'), value: 'large' },
                      { label: t('layout:size.default'), value: 'default' },
                      { label: t('tool:smaller'), value: 'small' },
                    ]}
                    onChange={(event) => onFormChange({ ...formConf, size: event.target.value })}
                  />
                </Form.Item>
                <Form.Item label={t('tool:labelAlignment')}>
                  <Radio.Group
                    optionType="button"
                    value={formConf.labelPosition}
                    options={[
                      { label: t('tool:alignLeft'), value: 'left' },
                      { label: t('tool:alignRight'), value: 'right' },
                      { label: t('tool:alignTop'), value: 'top' },
                    ]}
                    onChange={(event) =>
                      onFormChange({ ...formConf, labelPosition: event.target.value })
                    }
                  />
                </Form.Item>
                {[
                  ['labelWidth', t('tool:labelWidth')],
                  ['gutter', t('tool:gridGap')],
                ].map(([key, label]) => (
                  <Form.Item
                    key={key}
                    label={label}
                  >
                    <InputNumber
                      placeholder={label}
                      value={formConf[key]}
                      min={0}
                      max={key === 'span' ? 24 : undefined}
                      onChange={(value) => onFormChange({ ...formConf, [key]: value })}
                    />
                  </Form.Item>
                ))}
                {[
                  ['disabled', t('tool:disableForm')],
                  ['formBtns', t('tool:formButtons')],
                  ['unFocusedComponentBorder', t('tool:showBordersOnUnselectedComponents')],
                ].map(([key, label]) => (
                  <Form.Item
                    key={key}
                    label={label}
                    className="builder-boolean-property"
                  >
                    <Switch
                      aria-label={label}
                      checked={formConf[key]}
                      onChange={(value) => onFormChange({ ...formConf, [key]: value })}
                    />
                  </Form.Item>
                ))}
              </Form>
            ),
          },
        ]}
      />
      <TreeNodeDialog
        open={adding !== null}
        onClose={() => setAdding(null)}
        onConfirm={(option) => {
          updateOption(adding, option)
          setAdding(null)
        }}
      />
      <IconsDialog
        open={!!iconKey}
        value={field?.[iconKey]}
        onClose={() => setIconKey('')}
        onSelect={(value) => update(iconKey, value)}
      />
    </div>
  )
}
