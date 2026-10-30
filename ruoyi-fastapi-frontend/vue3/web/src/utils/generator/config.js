import { translateMessage } from '../../i18n/message.mjs'

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
      return translateMessage('tools:builder.fields.singleLine', '单行文本')
    },
    tag: 'el-input',
    tagIcon: 'input',
    type: 'text',
    get placeholder() {
      return translateMessage('tools:builder.fields.enter', '请输入')
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
    document: 'https://element-plus.org/zh-CN/component/input',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.multiLine', '多行文本')
    },
    tag: 'el-input',
    tagIcon: 'textarea',
    type: 'textarea',
    get placeholder() {
      return translateMessage('tools:builder.fields.enter', '请输入')
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
    document: 'https://element-plus.org/zh-CN/component/input',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.password', '密码')
    },
    tag: 'el-input',
    tagIcon: 'password',
    type: 'password',
    get placeholder() {
      return translateMessage('tools:builder.fields.enter', '请输入')
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
    document: 'https://element-plus.org/zh-CN/component/input',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.number', '计数器')
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
    document: 'https://element-plus.org/zh-CN/component/input-number',
  },
]

export const selectComponents = [
  {
    get label() {
      return translateMessage('tools:builder.fields.select', '下拉选择')
    },
    tag: 'el-select',
    tagIcon: 'select',
    get placeholder() {
      return translateMessage('tools:builder.fields.choose', '请选择')
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
          return translateMessage('tools:builder.fields.optionOne', '选项一')
        },
        value: 1,
      },
      {
        get label() {
          return translateMessage('tools:builder.fields.optionTwo', '选项二')
        },
        value: 2,
      },
    ],
    regList: [],
    changeTag: true,
    document: 'https://element-plus.org/zh-CN/component/select',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.cascader', '级联选择')
    },
    tag: 'el-cascader',
    tagIcon: 'cascader',
    get placeholder() {
      return translateMessage('tools:builder.fields.choose', '请选择')
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
          return translateMessage('tools:builder.fields.firstOption', '选项1')
        },
        children: [
          {
            id: 2,
            value: 2,
            get label() {
              return translateMessage('tools:builder.fields.nestedOption', '选项1-1')
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
    document: 'https://element-plus.org/zh-CN/component/cascader',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.radio', '单选框组')
    },
    tag: 'el-radio-group',
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
          return translateMessage('tools:builder.fields.optionOne', '选项一')
        },
        value: 1,
      },
      {
        get label() {
          return translateMessage('tools:builder.fields.optionTwo', '选项二')
        },
        value: 2,
      },
    ],
    regList: [],
    changeTag: true,
    document: 'https://element-plus.org/zh-CN/component/radio',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.checkbox', '多选框组')
    },
    tag: 'el-checkbox-group',
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
          return translateMessage('tools:builder.fields.optionOne', '选项一')
        },
        value: 1,
      },
      {
        get label() {
          return translateMessage('tools:builder.fields.optionTwo', '选项二')
        },
        value: 2,
      },
    ],
    regList: [],
    changeTag: true,
    document: 'https://element-plus.org/zh-CN/component/checkbox',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.switch', '开关')
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
    document: 'https://element-plus.org/zh-CN/component/switch',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.slider', '滑块')
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
    document: 'https://element-plus.org/zh-CN/component/slider',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.time', '时间选择')
    },
    tag: 'el-time-picker',
    tagIcon: 'time',
    get placeholder() {
      return translateMessage('tools:builder.fields.choose', '请选择')
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
    document: 'https://element-plus.org/zh-CN/component/time-picker',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.timeRange', '时间范围')
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
      return translateMessage('tools:builder.fields.to', '至')
    },
    get 'start-placeholder'() {
      return translateMessage('tools:builder.fields.startTime', '开始时间')
    },
    get 'end-placeholder'() {
      return translateMessage('tools:builder.fields.endTime', '结束时间')
    },
    format: 'HH:mm:ss',
    'value-format': 'HH:mm:ss',
    regList: [],
    changeTag: true,
    document: 'https://element-plus.org/zh-CN/component/time-picker',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.date', '日期选择')
    },
    tag: 'el-date-picker',
    tagIcon: 'date',
    get placeholder() {
      return translateMessage('tools:builder.fields.choose', '请选择')
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
    document: 'https://element-plus.org/zh-CN/component/date-picker',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.dateRange', '日期范围')
    },
    tag: 'el-date-picker',
    tagIcon: 'date-range',
    defaultValue: null,
    span: 24,
    labelWidth: null,
    style: { width: '100%' },
    type: 'daterange',
    get 'range-separator'() {
      return translateMessage('tools:builder.fields.to', '至')
    },
    get 'start-placeholder'() {
      return translateMessage('tools:builder.fields.startDate', '开始日期')
    },
    get 'end-placeholder'() {
      return translateMessage('tools:builder.fields.endDate', '结束日期')
    },
    disabled: false,
    clearable: true,
    required: true,
    format: 'YYYY-MM-DD',
    'value-format': 'YYYY-MM-DD',
    readonly: false,
    regList: [],
    changeTag: true,
    document: 'https://element-plus.org/zh-CN/component/date-picker',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.rate', '评分')
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
    document: 'https://element-plus.org/zh-CN/component/rate',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.color', '颜色选择')
    },
    tag: 'el-color-picker',
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
    document: 'https://element-plus.org/zh-CN/component/color-picker',
  },
  {
    get label() {
      return translateMessage('tools:builder.fields.upload', '上传')
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
      return translateMessage('tools:builder.fields.uploadAction', '点击上传')
    },
    fileSize: 2,
    sizeUnit: 'MB',
    'list-type': 'text',
    multiple: false,
    regList: [],
    changeTag: true,
    document: 'https://element-plus.org/zh-CN/component/upload',
    get tip() {
      return translateMessage('tools:builder.fields.uploadTip', '只能上传不超过 2MB 的文件')
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
      return translateMessage('tools:builder.fields.row', '行容器')
    },
    layoutTree: true,
    children: [],
    document: 'https://element-plus.org/zh-CN/component/layout',
  },
  {
    layout: 'colFormItem',
    get label() {
      return translateMessage('tools:builder.fields.button', '按钮')
    },
    changeTag: true,
    labelWidth: null,
    tag: 'el-button',
    tagIcon: 'button',
    span: 24,
    get default() {
      return translateMessage('tools:builder.fields.primaryButton', '主要按钮')
    },
    type: 'primary',
    icon: 'Search',
    size: 'default',
    disabled: false,
    document: 'https://element-plus.org/zh-CN/component/button',
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
