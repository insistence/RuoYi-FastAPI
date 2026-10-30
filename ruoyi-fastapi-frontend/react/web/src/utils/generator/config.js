import { t } from '@/i18n'
export const formConf = {
  formRef: 'formRef',
  formModel: 'formData',
  size: 'default',
  labelPosition: 'right',
  labelWidth: 100,
  formRules: 'rules',
  gutter: 15,
  disabled: false,
  span: 24,
  formBtns: true,
}

export const inputComponents = [
  {
    get label() {
      return t('tool:singleLineText')
    },
    tag: 'Input',
    tagIcon: 'input',
    type: 'text',
    get placeholder() {
      return t('tool:enterAValue')
    },
    defaultValue: undefined,
    span: 24,
    labelWidth: null,
    style: { width: '100%' },
    clearable: true,
    prepend: '',
    append: '',
    'prefix-icon': '',
    'suffix-icon': '',
    maxlength: null,
    'show-word-limit': false,
    readonly: false,
    disabled: false,
    required: true,
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:multiLineText')
    },
    tag: 'Input',
    tagIcon: 'textarea',
    type: 'textarea',
    get placeholder() {
      return t('tool:enterAValue')
    },
    defaultValue: undefined,
    span: 24,
    labelWidth: null,
    autosize: {
      minRows: 4,
      maxRows: 4,
    },
    style: { width: '100%' },
    maxlength: null,
    'show-word-limit': false,
    readonly: false,
    disabled: false,
    required: true,
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('common:login.password')
    },
    tag: 'Input',
    tagIcon: 'password',
    type: 'password',
    get placeholder() {
      return t('tool:enterAValue')
    },
    defaultValue: undefined,
    span: 24,
    'show-password': true,
    labelWidth: null,
    style: { width: '100%' },
    clearable: true,
    prepend: '',
    append: '',
    'prefix-icon': '',
    'suffix-icon': '',
    maxlength: null,
    'show-word-limit': false,
    readonly: false,
    disabled: false,
    required: true,
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:numberInput')
    },
    tag: 'InputNumber',
    tagIcon: 'number',
    placeholder: '',
    defaultValue: undefined,
    span: 24,
    labelWidth: null,
    min: undefined,
    max: undefined,
    step: undefined,
    'step-strictly': false,
    precision: undefined,
    'controls-position': '',
    disabled: false,
    required: true,
    regList: [],
    changeTag: true,
  },
]

export const selectComponents = [
  {
    get label() {
      return t('tool:builder.dropdown')
    },
    tag: 'Select',
    tagIcon: 'select',
    get placeholder() {
      return t('common:selectPlaceholder')
    },
    defaultValue: undefined,
    span: 24,
    labelWidth: null,
    style: { width: '100%' },
    clearable: true,
    disabled: false,
    required: true,
    filterable: false,
    multiple: false,
    options: [
      {
        get label() {
          return t('tool:optionOne')
        },
        value: 1,
      },
      {
        get label() {
          return t('tool:optionTwo')
        },
        value: 2,
      },
    ],
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:cascader')
    },
    tag: 'Cascader',
    tagIcon: 'cascader',
    get placeholder() {
      return t('common:selectPlaceholder')
    },
    defaultValue: [],
    span: 24,
    labelWidth: null,
    style: { width: '100%' },
    props: {
      props: {
        multiple: false,
      },
    },
    'show-all-levels': true,
    disabled: false,
    clearable: true,
    filterable: false,
    required: true,
    options: [
      {
        id: 1,
        value: 1,
        get label() {
          return t('tool:option1')
        },
        children: [
          {
            id: 2,
            value: 2,
            get label() {
              return t('tool:option11')
            },
          },
        ],
      },
    ],
    dataType: 'dynamic',
    labelKey: 'label',
    valueKey: 'value',
    childrenKey: 'children',
    separator: '/',
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:radioGroup')
    },
    tag: 'Radio.Group',
    tagIcon: 'radio',
    defaultValue: 0,
    span: 24,
    labelWidth: null,
    style: {},
    optionType: 'default',
    border: false,
    size: 'default',
    disabled: false,
    required: true,
    options: [
      {
        get label() {
          return t('tool:optionOne')
        },
        value: 1,
      },
      {
        get label() {
          return t('tool:optionTwo')
        },
        value: 2,
      },
    ],
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:checkboxGroup')
    },
    tag: 'Checkbox.Group',
    tagIcon: 'checkbox',
    defaultValue: [],
    span: 24,
    labelWidth: null,
    style: {},
    optionType: 'default',
    border: false,
    size: 'default',
    disabled: false,
    required: true,
    options: [
      {
        get label() {
          return t('tool:optionOne')
        },
        value: 1,
      },
      {
        get label() {
          return t('tool:optionTwo')
        },
        value: 2,
      },
    ],
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:switch')
    },
    tag: 'Switch',
    tagIcon: 'switch',
    defaultValue: false,
    span: 24,
    labelWidth: null,
    style: {},
    disabled: false,
    required: true,
    'active-text': '',
    'inactive-text': '',
    'active-color': null,
    'inactive-color': null,
    'active-value': true,
    'inactive-value': false,
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:slider')
    },
    tag: 'Slider',
    tagIcon: 'slider',
    defaultValue: null,
    span: 24,
    labelWidth: null,
    disabled: false,
    required: true,
    min: 0,
    max: 100,
    step: 1,
    'show-stops': false,
    range: false,
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:timePicker')
    },
    tag: 'TimePicker',
    'picker-options': { selectableRange: '00:00:00 - 23:59:59' },
    tagIcon: 'time',
    get placeholder() {
      return t('common:selectPlaceholder')
    },
    defaultValue: '',
    span: 24,
    labelWidth: null,
    style: { width: '100%' },
    disabled: false,
    clearable: true,
    required: true,
    format: 'HH:mm:ss',
    'value-format': 'HH:mm:ss',
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:timeRange')
    },
    tag: 'TimePicker',
    'picker-options': { selectableRange: '00:00:00 - 23:59:59' },
    tagIcon: 'time-range',
    defaultValue: null,
    span: 24,
    labelWidth: null,
    style: { width: '100%' },
    disabled: false,
    clearable: true,
    required: true,
    'is-range': true,
    get 'range-separator'() {
      return t('common:to')
    },
    get 'start-placeholder'() {
      return t('common:startTime')
    },
    get 'end-placeholder'() {
      return t('common:endTime')
    },
    format: 'HH:mm:ss',
    'value-format': 'HH:mm:ss',
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:datePicker')
    },
    tag: 'DatePicker',
    tagIcon: 'date',
    get placeholder() {
      return t('common:selectPlaceholder')
    },
    defaultValue: null,
    type: 'date',
    span: 24,
    labelWidth: null,
    style: { width: '100%' },
    disabled: false,
    clearable: true,
    required: true,
    format: 'YYYY-MM-DD',
    'value-format': 'YYYY-MM-DD',
    readonly: false,
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:dateRange')
    },
    tag: 'DatePicker',
    tagIcon: 'date-range',
    defaultValue: null,
    span: 24,
    labelWidth: null,
    style: { width: '100%' },
    type: 'daterange',
    get 'range-separator'() {
      return t('common:to')
    },
    get 'start-placeholder'() {
      return t('common:startDate')
    },
    get 'end-placeholder'() {
      return t('common:endDate')
    },
    disabled: false,
    clearable: true,
    required: true,
    format: 'YYYY-MM-DD',
    'value-format': 'YYYY-MM-DD',
    readonly: false,
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:rating')
    },
    tag: 'Rate',
    tagIcon: 'rate',
    defaultValue: 0,
    span: 24,
    labelWidth: null,
    style: {},
    max: 5,
    'allow-half': false,
    'show-text': false,
    'show-score': false,
    disabled: false,
    required: true,
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('tool:colorPicker')
    },
    tag: 'ColorPicker',
    tagIcon: 'color',
    defaultValue: null,
    labelWidth: null,
    'show-alpha': false,
    'color-format': '',
    disabled: false,
    required: true,
    size: 'default',
    regList: [],
    changeTag: true,
  },
  {
    get label() {
      return t('common:upload')
    },
    tag: 'Upload',
    tagIcon: 'upload',
    action: '/common/upload',
    defaultValue: null,
    labelWidth: null,
    disabled: false,
    required: true,
    accept: '',
    name: 'file',
    'auto-upload': true,
    showTip: false,
    get buttonText() {
      return t('file:upload.click')
    },
    fileSize: 2,
    sizeUnit: 'MB',
    'list-type': 'text',
    multiple: false,
    regList: [],
    changeTag: true,

    get tip() {
      return t('tool:uploadFilesNoLargerThan2Mb')
    },
    style: { width: '100%' },
  },
]

export const layoutComponents = [
  {
    layout: 'rowFormItem',
    tagIcon: 'row',
    type: 'default',
    justify: 'start',
    align: 'top',
    get label() {
      return t('tool:builder.rowContainer')
    },
    layoutTree: true,
    children: [],
  },
  {
    layout: 'colFormItem',
    get label() {
      return t('system:menu.button')
    },
    changeTag: true,
    labelWidth: null,
    tag: 'Button',
    tagIcon: 'button',
    span: 24,
    get default() {
      return t('tool:primaryButton')
    },
    type: 'primary',
    icon: 'search',
    size: 'default',
    disabled: false,
  },
]

// 组件rule的触发方式，无触发方式的组件不生成rule
export const trigger = {
  Input: 'blur',
  InputNumber: 'blur',
  Select: 'change',
  'Radio.Group': 'change',
  'Checkbox.Group': 'change',
  Cascader: 'change',
  TimePicker: 'change',
  DatePicker: 'change',
  Rate: 'change',
}
