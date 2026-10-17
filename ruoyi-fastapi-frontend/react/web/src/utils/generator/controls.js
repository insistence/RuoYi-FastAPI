// Older saved forms still use the original icon name.
export function resolveGeneratorIconName(name) {
  return name === 'Search' ? 'search' : name
}

// Map each original form-designer control to its Ant Design equivalent.
export function describeControl(field) {
  let component = field.tag
  const props = {
    disabled: !!field.disabled,
    placeholder: field.placeholder,
    style: field.style,
  }
  switch (field.tag) {
    case 'Input':
      component =
        field.type === 'textarea'
          ? 'Input.TextArea'
          : field.type === 'password'
            ? 'Input.Password'
            : 'Input'
      Object.assign(props, {
        allowClear: field.clearable,
        readOnly: field.readonly,
        maxLength: field.maxlength ?? undefined,
        showCount: field['show-word-limit'],
        ...(field.type === 'textarea' ? { autoSize: field.autosize } : {}),
      })
      break
    case 'InputNumber':
      component = 'GeneratorNumber'
      Object.assign(props, {
        min: field.min,
        max: field.max,
        step: field.step,
        precision: field.precision,
        strictStep: field['step-strictly'],
        mode: field['controls-position'] === 'right' ? 'input' : 'spinner',
      })
      break
    case 'Select':
      Object.assign(props, {
        options: field.options,
        mode: field.multiple ? 'multiple' : undefined,
        allowClear: field.clearable,
        showSearch: field.filterable,
        optionFilterProp: 'label',
      })
      break
    case 'Cascader':
      component = 'GeneratorCascader'
      Object.assign(props, {
        options: field.options,
        multiple: field.props?.props?.multiple,
        allowClear: field.clearable,
        showSearch: field.filterable,
        separator: field.separator,
        showAllLevels: field['show-all-levels'],
        fieldNames: {
          label: field.labelKey || 'label',
          value: field.valueKey || 'value',
          children: field.childrenKey || 'children',
        },
      })
      break
    case 'Radio.Group':
    case 'Checkbox.Group':
      component = 'GeneratorChoice'
      Object.assign(props, {
        options: field.options,
        optionType: field.optionType,
        kind: field.tag === 'Checkbox.Group' ? 'checkbox' : 'radio',
        border: field.border,
        size: field.size === 'default' ? 'middle' : field.size,
      })
      break
    case 'Switch':
      component = 'GeneratorSwitch'
      Object.assign(props, {
        checkedChildren: field['active-text'],
        activeColor: field['active-color'],
        inactiveColor: field['inactive-color'],
        unCheckedChildren: field['inactive-text'],
      })
      break
    case 'Slider':
      Object.assign(props, {
        min: field.min,
        max: field.max,
        step: field.step,
        range: field.range,
        dots: field['show-stops'],
      })
      break
    case 'TimePicker':
    case 'DatePicker':
      component = 'DateStringPicker'
      Object.assign(props, {
        kind: field.tag === 'TimePicker' ? 'time' : 'date',
        range: !!field['is-range'] || String(field.type).includes('range'),
        format: field.format,
        valueFormat: field['value-format'] || field.format,
        inputReadOnly: field.readonly,
        separator: field['range-separator'],
        showTime: String(field.type).includes('datetime') || undefined,
        selectableRange: field['picker-options']?.selectableRange,
        allowClear: field.clearable,
        picker:
          field.type === 'monthrange'
            ? 'month'
            : ['year', 'month', 'week'].includes(field.type)
              ? field.type
              : undefined,
      })
      if (props.range)
        props.placeholder = [
          field['start-placeholder'] || '开始',
          field['end-placeholder'] || '结束',
        ]
      break
    case 'Rate':
      component = 'GeneratorRate'
      Object.assign(props, {
        count: field.max,
        allowHalf: field['allow-half'],
        showText: field['show-text'],
        showScore: field['show-score'],
      })
      break
    case 'ColorPicker':
      component = 'GeneratorColor'
      Object.assign(props, {
        disabledAlpha: !field['show-alpha'],
        format: field['color-format'] || undefined,
        size: field.size === 'default' ? 'middle' : field.size,
      })
      break
    case 'Upload':
      component = 'Upload'
      Object.assign(props, {
        action: field.action,
        name: field.name,
        accept: field.accept,
        multiple: field.multiple,
        listType: field['list-type'],
      })
      break
    case 'Button':
      Object.assign(props, {
        type: field.type,
        size: field.size === 'default' ? 'middle' : field.size,
      })
      break
  }
  return { component, props }
}
