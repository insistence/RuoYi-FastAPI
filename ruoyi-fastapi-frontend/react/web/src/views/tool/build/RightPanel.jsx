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
  return (
    <Input
      aria-label={label}
      placeholder={`请输入${label}`}
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
                子项
              </Button>
            )}
            <Button
              size="small"
              type="text"
              danger
              onClick={() => updateOption(path, null)}
            >
              删除
            </Button>
          </Space>
        ),
        children: option.children ? optionTree(option.children, path) : undefined,
      }
    })
  }
  const textFields = [
    ['vModel', '字段名', '请输入字段名（v-model）'],
    ['label', '标题', '请输入标题'],
    ['placeholder', '占位提示', '请输入占位提示'],
    ['start-placeholder', '开始占位', '请输入占位提示'],
    ['end-placeholder', '结束占位', '请输入占位提示'],
    ['style.width', '组件宽度'],
    ['prepend', '前缀'],
    ['append', '后缀'],
    ['separator', '选项分隔符'],
    ['active-text', '开启提示'],
    ['inactive-text', '关闭提示'],
    ['name', '文件字段名', '请输入上传文件字段名'],
    ['action', '上传地址'],
    ['buttonText', '按钮文字'],
    ['tip', '上传提示'],
    ['range-separator', '分隔符'],
    ['format', '时间格式', '请输入时间格式'],
    ['labelKey', '标签键名'],
    ['valueKey', '值键名'],
    ['childrenKey', '子级键名'],
  ]
  const numberFields = [
    ['gutter', '栅格间隔'],
    ['labelWidth', '标签宽度', '请输入标签宽度'],
    ['autosize.minRows', '最小行数'],
    ['autosize.maxRows', '最大行数'],
    ['min', '最小值'],
    ['max', '最大值'],
    ['step', '步长', '步数'],
    ['precision', '精度'],
  ]
  const boolFields = [
    ['props.props.multiple', '是否多选'],
    ['show-all-levels', '展示全路径'],
    ['allow-half', '允许半选'],
    ['show-text', '辅助文字'],
    ['show-score', '显示分数'],
    ['show-stops', '显示间断点'],
    ['range', '范围选择'],
    ['show-alpha', '透明度'],
    ['show-word-limit', '输入统计'],
    ['step-strictly', '严格步数'],
    ['showTip', '显示提示'],
    ['auto-upload', '自动上传'],
    ['clearable', '能否清空'],
    ['multiple', field?.tag === 'Upload' ? '多选文件' : '是否多选'],
    ['filterable', field?.tag === 'Cascader' ? '可否筛选' : '是否可搜索'],
    ['readonly', '是否只读'],
    ['disabled', '是否禁用'],
    ['required', '是否必填'],
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
            placeholder={placeholder || `请输入${label}`}
            value={get(field, key)}
            onChange={(event) => update(key, event.target.value)}
          />
        </Form.Item>
      ))
  return (
    <div className="builder-properties">
      <a
        className="builder-document-link"
        title="查看组件文档"
        aria-label="查看组件文档"
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
            label: '组件属性',
            children: field ? (
              <Form layout="vertical">
                {field.changeTag && (
                  <Form.Item label="组件类型">
                    <Select
                      placeholder="请选择组件类型"
                      value={field.tagIcon}
                      options={[
                        ['输入型组件', inputComponents],
                        ['选择型组件', selectComponents],
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
                  <Form.Item label="组件名">{field.componentName}</Form.Item>
                )}
                {renderTextFields(['label', 'placeholder', 'start-placeholder', 'end-placeholder'])}
                {exists('span') && (
                  <Form.Item label="表单栅格">
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
                  <Form.Item label="默认值">
                    <ValueInput
                      value={field.defaultValue}
                      onChange={(value) => update('defaultValue', value)}
                      label="默认值"
                    />
                  </Form.Item>
                )}
                {renderTextFields(['prepend', 'append'])}
                {['prefix-icon', 'suffix-icon', 'icon'].filter(exists).map((key) => (
                  <Form.Item
                    key={key}
                    label={key === 'icon' ? '图标' : key === 'prefix-icon' ? '前图标' : '后图标'}
                  >
                    <Space.Compact block>
                      <Input
                        placeholder={`请输入${key === 'prefix-icon' ? '前' : key === 'suffix-icon' ? '后' : ''}图标名称`}
                        value={field[key]}
                        onChange={(event) => update(key, event.target.value)}
                      />
                      <Button onClick={() => setIconKey(key)}>选择</Button>
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
                            ? '至少应选'
                            : '最多可选'
                          : label
                      }
                    >
                      <InputNumber
                        placeholder={
                          field.tag === 'Checkbox.Group' && ['min', 'max'].includes(key)
                            ? key === 'min'
                              ? '至少应选'
                              : '最多可选'
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
                      ['active-value', '开启值'],
                      ['inactive-value', '关闭值'],
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
                  <Form.Item label="时间类型">
                    <Select
                      placeholder="请选择时间类型"
                      value={field.type}
                      options={(field['start-placeholder'] === undefined
                        ? [
                            ['日(date)', 'date'],
                            ['周(week)', 'week'],
                            ['月(month)', 'month'],
                            ['年(year)', 'year'],
                            ['日期时间(datetime)', 'datetime'],
                          ]
                        : [
                            ['日期范围(daterange)', 'daterange'],
                            ['月范围(monthrange)', 'monthrange'],
                            ['日期时间范围(datetimerange)', 'datetimerange'],
                          ]
                      ).map(([label, value]) => ({ label, value }))}
                      onChange={(value) => update('type', value)}
                    />
                  </Form.Item>
                )}
                {field.tag === 'InputNumber' && (
                  <Form.Item label="按钮位置">
                    <Radio.Group
                      optionType="button"
                      value={field['controls-position']}
                      options={[
                        { label: '默认', value: '' },
                        { label: '右侧', value: 'right' },
                      ]}
                      onChange={(event) => update('controls-position', event.target.value)}
                    />
                  </Form.Item>
                )}
                {field.maxlength !== undefined && (
                  <Form.Item label="最多输入">
                    <Input
                      placeholder="请输入字符长度"
                      suffix="个字符"
                      value={field.maxlength}
                      onChange={(event) =>
                        update('maxlength', event.target.value ? Number(event.target.value) : null)
                      }
                    />
                  </Form.Item>
                )}
                {field['picker-options'] && (
                  <Form.Item label="时间段">
                    <Input
                      placeholder="请输入时间段"
                      value={field['picker-options'].selectableRange}
                      onChange={(event) =>
                        update('picker-options.selectableRange', event.target.value)
                      }
                    />
                  </Form.Item>
                )}
                {field.layout === 'rowFormItem' && (
                  <>
                    <Form.Item label="水平排列">
                      <Select
                        placeholder="请选择水平排列"
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
                    <Form.Item label="垂直排列">
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
                  <Form.Item label="数据类型">
                    <Radio.Group
                      optionType="button"
                      value={field.dataType}
                      onChange={(e) => update('dataType', e.target.value)}
                      options={[
                        { label: '静态数据', value: 'static' },
                        { label: '动态数据', value: 'dynamic' },
                      ]}
                    />
                  </Form.Item>
                )}
                {field.options && (field.tag !== 'Cascader' || field.dataType === 'static') && (
                  <>
                    <Divider>选项</Divider>
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
                            aria-label="拖动选项"
                          >
                            <HolderOutlined />
                          </span>
                          <Input
                            placeholder="选项名"
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
                            placeholder="选项值"
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
                            aria-label={`删除选项 ${index + 1}`}
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
                      {field.tag === 'Cascader' ? '添加父级' : '添加选项'}
                    </Button>
                    <Divider />
                  </>
                )}
                {field.optionType && (
                  <Form.Item label="选项样式">
                    <Radio.Group
                      optionType="button"
                      value={field.optionType}
                      onChange={(e) => update('optionType', e.target.value)}
                      options={[
                        { label: '默认', value: 'default' },
                        { label: '按钮', value: 'button' },
                      ]}
                    />
                  </Form.Item>
                )}
                {field.tag === 'Upload' && (
                  <>
                    <Form.Item label="文件类型">
                      <Select
                        allowClear
                        placeholder="请选择文件类型"
                        value={field.accept || undefined}
                        options={[
                          ['图片', 'image/*'],
                          ['视频', 'video/*'],
                          ['音频', 'audio/*'],
                          ['excel', '.xls,.xlsx'],
                          ['word', '.doc,.docx'],
                          ['pdf', '.pdf'],
                          ['txt', '.txt'],
                        ].map(([label, value]) => ({ label, value }))}
                        onChange={(value) => update('accept', value || '')}
                      />
                    </Form.Item>
                    <Form.Item label="文件大小">
                      <Space.Compact block>
                        <InputNumber
                          placeholder="请输入文件大小"
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
                    <Form.Item label="列表类型">
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
                    <Form.Item label="按钮文字">
                      <Input
                        placeholder="请输入按钮文字"
                        value={field.default}
                        onChange={(e) => update('default', e.target.value)}
                      />
                    </Form.Item>
                    <Form.Item label="按钮类型">
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
                    label={key === 'active-color' ? '开启颜色' : '关闭颜色'}
                  >
                    <ColorPicker
                      value={field[key] || undefined}
                      onChange={(_, value) => update(key, value)}
                    />
                  </Form.Item>
                ))}
                {exists('border') && field.optionType === 'default' && (
                  <Form.Item label="是否带边框">
                    <Switch
                      checked={field.border}
                      onChange={(value) => update('border', value)}
                    />
                  </Form.Item>
                )}
                {field.tag === 'ColorPicker' && (
                  <Form.Item label="颜色格式">
                    <Select
                      placeholder="请选择颜色格式"
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
                    <Form.Item label="选项尺寸">
                      <Radio.Group
                        optionType="button"
                        value={field.size}
                        options={[
                          { label: '较大', value: 'large' },
                          { label: '默认', value: 'default' },
                          { label: '较小', value: 'small' },
                        ]}
                        onChange={(event) => update('size', event.target.value)}
                      />
                    </Form.Item>
                  )}
                {field.layoutTree && (
                  <>
                    <Divider>布局结构树</Divider>
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
                    <Divider>正则校验</Divider>
                    {field.regList.map((rule, i) => (
                      <div
                        key={i}
                        className="builder-rule"
                      >
                        <Form.Item
                          label="表达式"
                          validateStatus={
                            rule.pattern && !parsePattern(rule.pattern) ? 'error' : undefined
                          }
                          help={
                            rule.pattern && !parsePattern(rule.pattern)
                              ? '无效的正则表达式'
                              : undefined
                          }
                        >
                          <Input
                            placeholder="请输入正则"
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
                        <Form.Item label="错误提示">
                          <Input
                            placeholder="请输入错误提示"
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
                          aria-label="删除规则"
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
                      添加规则
                    </Button>
                  </>
                )}
              </Form>
            ) : (
              <Empty description="请选择组件" />
            ),
          },
          {
            key: 'form',
            label: '表单属性',
            children: (
              <Form layout="vertical">
                {[
                  ['formRef', '表单名', '请输入表单名（ref）'],
                  ['formModel', '表单模型', '请输入数据模型'],
                  ['formRules', '校验模型', '请输入校验模型'],
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
                <Form.Item label="表单尺寸">
                  <Radio.Group
                    optionType="button"
                    value={formConf.size}
                    options={[
                      { label: '较大', value: 'large' },
                      { label: '默认', value: 'default' },
                      { label: '较小', value: 'small' },
                    ]}
                    onChange={(event) => onFormChange({ ...formConf, size: event.target.value })}
                  />
                </Form.Item>
                <Form.Item label="标签对齐">
                  <Radio.Group
                    optionType="button"
                    value={formConf.labelPosition}
                    options={[
                      { label: '左对齐', value: 'left' },
                      { label: '右对齐', value: 'right' },
                      { label: '顶部对齐', value: 'top' },
                    ]}
                    onChange={(event) =>
                      onFormChange({ ...formConf, labelPosition: event.target.value })
                    }
                  />
                </Form.Item>
                {[
                  ['labelWidth', '标签宽度'],
                  ['gutter', '栅格间隔'],
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
                  ['disabled', '禁用表单'],
                  ['formBtns', '表单按钮'],
                  ['unFocusedComponentBorder', '显示未选中组件边框'],
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
