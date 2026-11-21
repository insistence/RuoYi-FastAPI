import { t } from '@/i18n/adapter'
export const formConf = {
  formRef: 'elForm',
  formModel: 'formData',
  size: 'medium',
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
      return t('tool:palette.singleLine')
    },
    tag: 'el-input',
    tagIcon: 'input',
    get placeholder() {
      return t('tool:palette.enterValue')
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
    document: 'https://element.eleme.cn/#/zh-CN/component/input',
  },
  {
    get label() {
      return t('tool:palette.multiLine')
    },
    tag: 'el-input',
    tagIcon: 'textarea',
    type: 'textarea',
    get placeholder() {
      return t('tool:palette.enterValue')
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
    document: 'https://element.eleme.cn/#/zh-CN/component/input',
  },
  {
    get label() {
      return t('tool:palette.password')
    },
    tag: 'el-input',
    tagIcon: 'password',
    get placeholder() {
      return t('tool:palette.enterValue')
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
    document: 'https://element.eleme.cn/#/zh-CN/component/input',
  },
  {
    get label() {
      return t('tool:palette.counter')
    },
    tag: 'el-input-number',
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
    document: 'https://element.eleme.cn/#/zh-CN/component/input-number',
  },
]

export const selectComponents = [
  {
    get label() {
      return t('tool:palette.select')
    },
    tag: 'el-select',
    tagIcon: 'select',
    get placeholder() {
      return t('tool:palette.selectValue')
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
          return t('tool:palette.optionOne')
        },
        value: 1,
      },
      {
        get label() {
          return t('tool:palette.optionTwo')
        },
        value: 2,
      },
    ],
    regList: [],
    changeTag: true,
    document: 'https://element.eleme.cn/#/zh-CN/component/select',
  },
  {
    get label() {
      return t('tool:palette.cascader')
    },
    tag: 'el-cascader',
    tagIcon: 'cascader',
    get placeholder() {
      return t('tool:palette.selectValue')
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
          return t('tool:palette.option1')
        },
        children: [
          {
            id: 2,
            value: 2,
            get label() {
              return t('tool:palette.option11')
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
    document: 'https://element.eleme.cn/#/zh-CN/component/cascader',
  },
  {
    get label() {
      return t('tool:palette.radioGroup')
    },
    tag: 'el-radio-group',
    tagIcon: 'radio',
    defaultValue: undefined,
    span: 24,
    labelWidth: null,
    style: {},
    optionType: 'default',
    border: false,
    size: 'medium',
    disabled: false,
    required: true,
    options: [
      {
        get label() {
          return t('tool:palette.optionOne')
        },
        value: 1,
      },
      {
        get label() {
          return t('tool:palette.optionTwo')
        },
        value: 2,
      },
    ],
    regList: [],
    changeTag: true,
    document: 'https://element.eleme.cn/#/zh-CN/component/radio',
  },
  {
    get label() {
      return t('tool:palette.checkboxGroup')
    },
    tag: 'el-checkbox-group',
    tagIcon: 'checkbox',
    defaultValue: [],
    span: 24,
    labelWidth: null,
    style: {},
    optionType: 'default',
    border: false,
    size: 'medium',
    disabled: false,
    required: true,
    options: [
      {
        get label() {
          return t('tool:palette.optionOne')
        },
        value: 1,
      },
      {
        get label() {
          return t('tool:palette.optionTwo')
        },
        value: 2,
      },
    ],
    regList: [],
    changeTag: true,
    document: 'https://element.eleme.cn/#/zh-CN/component/checkbox',
  },
  {
    get label() {
      return t('tool:palette.switch')
    },
    tag: 'el-switch',
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
    document: 'https://element.eleme.cn/#/zh-CN/component/switch',
  },
  {
    get label() {
      return t('tool:palette.slider')
    },
    tag: 'el-slider',
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
    document: 'https://element.eleme.cn/#/zh-CN/component/slider',
  },
  {
    get label() {
      return t('tool:palette.time')
    },
    tag: 'el-time-picker',
    tagIcon: 'time',
    get placeholder() {
      return t('tool:palette.selectValue')
    },
    defaultValue: null,
    span: 24,
    labelWidth: null,
    style: { width: '100%' },
    disabled: false,
    clearable: true,
    required: true,
    'picker-options': {
      selectableRange: '00:00:00-23:59:59',
    },
    format: 'HH:mm:ss',
    'value-format': 'HH:mm:ss',
    regList: [],
    changeTag: true,
    document: 'https://element.eleme.cn/#/zh-CN/component/time-picker',
  },
  {
    get label() {
      return t('tool:palette.timeRange')
    },
    tag: 'el-time-picker',
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
      return t('tool:palette.to')
    },
    get 'start-placeholder'() {
      return t('tool:palette.startTime')
    },
    get 'end-placeholder'() {
      return t('tool:palette.endTime')
    },
    format: 'HH:mm:ss',
    'value-format': 'HH:mm:ss',
    regList: [],
    changeTag: true,
    document: 'https://element.eleme.cn/#/zh-CN/component/time-picker',
  },
  {
    get label() {
      return t('tool:palette.date')
    },
    tag: 'el-date-picker',
    tagIcon: 'date',
    get placeholder() {
      return t('tool:palette.selectValue')
    },
    defaultValue: null,
    type: 'date',
    span: 24,
    labelWidth: null,
    style: { width: '100%' },
    disabled: false,
    clearable: true,
    required: true,
    format: 'yyyy-MM-dd',
    'value-format': 'yyyy-MM-dd',
    readonly: false,
    regList: [],
    changeTag: true,
    document: 'https://element.eleme.cn/#/zh-CN/component/date-picker',
  },
  {
    get label() {
      return t('tool:palette.dateRange')
    },
    tag: 'el-date-picker',
    tagIcon: 'date-range',
    defaultValue: null,
    span: 24,
    labelWidth: null,
    style: { width: '100%' },
    type: 'daterange',
    get 'range-separator'() {
      return t('tool:palette.to')
    },
    get 'start-placeholder'() {
      return t('tool:palette.startDate')
    },
    get 'end-placeholder'() {
      return t('tool:palette.endDate')
    },
    disabled: false,
    clearable: true,
    required: true,
    format: 'yyyy-MM-dd',
    'value-format': 'yyyy-MM-dd',
    readonly: false,
    regList: [],
    changeTag: true,
    document: 'https://element.eleme.cn/#/zh-CN/component/date-picker',
  },
  {
    get label() {
      return t('tool:palette.rating')
    },
    tag: 'el-rate',
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
    document: 'https://element.eleme.cn/#/zh-CN/component/rate',
  },
  {
    get label() {
      return t('tool:palette.color')
    },
    tag: 'el-color-picker',
    tagIcon: 'color',
    defaultValue: null,
    labelWidth: null,
    'show-alpha': false,
    'color-format': '',
    disabled: false,
    required: true,
    size: 'medium',
    regList: [],
    changeTag: true,
    document: 'https://element.eleme.cn/#/zh-CN/component/color-picker',
  },
  {
    get label() {
      return t('tool:palette.upload')
    },
    tag: 'el-upload',
    tagIcon: 'upload',
    action: 'https://jsonplaceholder.typicode.com/posts/',
    defaultValue: null,
    labelWidth: null,
    disabled: false,
    required: true,
    accept: '',
    name: 'file',
    'auto-upload': true,
    showTip: false,
    get buttonText() {
      return t('tool:palette.clickUpload')
    },
    fileSize: 2,
    sizeUnit: 'MB',
    'list-type': 'text',
    multiple: false,
    regList: [],
    changeTag: true,
    document: 'https://element.eleme.cn/#/zh-CN/component/upload',
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
      return t('tool:palette.row')
    },
    layoutTree: true,
    children: [],
    document: 'https://element.eleme.cn/#/zh-CN/component/layout',
  },
  {
    layout: 'colFormItem',
    get label() {
      return t('tool:palette.button')
    },
    changeTag: true,
    labelWidth: null,
    tag: 'el-button',
    tagIcon: 'button',
    span: 24,
    get default() {
      return t('tool:palette.primaryButton')
    },
    type: 'primary',
    icon: 'el-icon-search',
    size: 'medium',
    disabled: false,
    document: 'https://element.eleme.cn/#/zh-CN/component/button',
  },
]

// 组件rule的触发方式，无触发方式的组件不生成rule
export const trigger = {
  'el-input': 'blur',
  'el-input-number': 'blur',
  'el-select': 'change',
  'el-radio-group': 'change',
  'el-checkbox-group': 'change',
  'el-cascader': 'change',
  'el-time-picker': 'change',
  'el-date-picker': 'change',
  'el-rate': 'change',
}
