import { describeControl, resolveGeneratorIconName } from "./controls.js";
import { flattenFields, fieldRules } from "./model.js";
// 将配置值写成 JS 字面量，并转义尖括号，避免配置文本干扰生成的 JSX。
const json = (value) =>
  value === undefined
    ? "undefined"
    : JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
/**
 * 生成字段的表单校验规则，正则表达式保留为可执行的 RegExp 构造代码。
 * @param {Object} field 字段配置
 * @returns {string} 规则数组的 JS 源码
 */
function rulesCode(field) {
  return (
    "[" +
    fieldRules(field)
      .map(
        (rule) =>
          "{" +
          Object.entries(rule)
            .map(
              ([key, value]) =>
                `${key}: ${value instanceof RegExp ? `new RegExp(${json(value.source)},${json(value.flags)})` : json(value)}`,
            )
            .join(",") +
          "}",
      )
      .join(",") +
    "]"
  );
}
/**
 * 将字段配置转换为控件 JSX，包含图标、上传约束和输入框前后缀。
 * @param {Object} field 字段配置
 * @returns {string} 控件 JSX 源码
 */
function controlCode(field) {
  const { component, props } = describeControl(field);
  let attrs = ` {...${json(props)}}`;
  if (field.tag === "Input")
    for (const [key, prop] of [
      ["prefix-icon", "prefix"],
      ["suffix-icon", "suffix"],
    ])
      if (field[key])
        attrs += ` ${prop}={<SvgIcon iconClass={${json(resolveGeneratorIconName(field[key]))}} />}`;
  if (component === "Button")
    return `<Button${attrs}${field.icon ? ` icon={<SvgIcon iconClass={${json(resolveGeneratorIconName(field.icon))}} />}` : ""}>{${json(field.default || "按钮")}}</Button>`;
  if (component === "Upload") {
    // 将配置的文件大小单位换算为字节；手动上传时阻止自动提交。
    const bytes =
      (field.fileSize || 0) *
      ({ KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[field.sizeUnit] || 1024 ** 2);
    attrs += ` beforeUpload={file => ${!field["auto-upload"] ? "false" : bytes ? `file.size <= ${bytes} ? true : Upload.LIST_IGNORE` : "true"}}`;
    const trigger =
      field["list-type"] === "picture-card"
        ? '<PlusOutlined aria-label="添加文件" />'
        : `<Button type="primary" icon={<UploadOutlined />}>{${json(field.buttonText || "点击上传")}}</Button>`;
    return `<Upload${attrs}>${trigger}</Upload>`;
  }
  const control = `<${component}${attrs} />`;
  return field.tag === "Input" && (field.prepend || field.append)
    ? `<Space.Compact block>${field.prepend ? `<span className="generator-addon">{${json(field.prepend)}}</span>` : ""}${control}${field.append ? `<span className="generator-addon">{${json(field.append)}}</span>` : ""}</Space.Compact>`
    : control;
}
/**
 * 递归生成栅格与 Form.Item，同时适配开关、颜色和文件列表的值绑定。
 * @param {Object[]} fields 字段或嵌套行布局配置
 * @returns {string} 表单内容的 JSX 源码
 */
function fieldsCode(fields) {
  return fields
    .map((field) => {
      if (field.layout === "rowFormItem")
        return `<Col span={24}><Row gutter={${Number(field.gutter) || 0}} justify={${json(field.justify || "start")}} align={${json(field.align || "top")}}>${fieldsCode(field.children || [])}</Row></Col>`;
      let attrs = ` name={${json(field.vModel)}} label={${json(field.label)}} rules={${rulesCode(field)}}`;
      if (field.labelWidth != null)
        attrs += ` labelCol={{style:{width:${Number(field.labelWidth) || 0}}}}`;
      if (field.tag === "Switch")
        attrs += ` valuePropName="checked" getValueProps={value => ({checked:value === ${json(field["active-value"])}})} getValueFromEvent={checked => checked ? ${json(field["active-value"])} : ${json(field["inactive-value"])}}`;
      if (field.tag === "ColorPicker") attrs += " getValueFromEvent={(_,value) => value}";
      if (field.tag === "Upload")
        attrs += ' valuePropName="fileList" getValueFromEvent={event => event?.fileList || []}';
      return `<Col xs={24} md={${Number(field.span) || 24}}><Form.Item${attrs}>${controlCode(field)}</Form.Item></Col>`;
    })
    .join("\n");
}
/**
 * 生成包含默认值、校验规则和提交操作的 React 表单组件源码。
 * @param {Object[]} fields 字段及布局配置
 * @param {Object} config 表单尺寸、标签、栅格及按钮配置
 * @param {string} [type="file"] dialog 生成弹窗表单，其他值生成普通表单
 * @returns {string} 可导出的 React 组件模块源码
 */
export function makeUpJs(fields, config, type = "file") {
  // 从嵌套布局中收集字段默认值，排除没有字段名的布局节点。
  const initialValues = Object.fromEntries(
    flattenFields(fields)
      .filter((f) => f.vModel && f.defaultValue !== undefined)
      .map((f) => [f.vModel, f.defaultValue]),
  );
  const content = `<Form form={form} name={${json(config.formRef || "generatedForm")}} initialValues={${json(initialValues)}} layout="${config.labelPosition === "top" ? "vertical" : "horizontal"}" labelAlign="${config.labelPosition === "left" ? "left" : "right"}" labelCol={{style:{width:${Number(config.labelWidth) || 100}}}} disabled={${!!config.disabled}} size="${config.size === "default" ? "middle" : config.size}" onFinish={onSubmit}><Row gutter={${Number(config.gutter) || 0}}>${fieldsCode(fields)}</Row>${config.formBtns ? '<Space><Button type="primary" htmlType="submit">提交</Button><Button onClick={() => form.resetFields()}>重置</Button></Space>' : ""}</Form>`;
  return `import { PlusOutlined, UploadOutlined } from "@ant-design/icons";\nimport { GeneratorNumber, GeneratorSwitch, GeneratorRate, GeneratorChoice, GeneratorCascader, GeneratorColor } from "@/components/GeneratorControls";\nimport { Button, Cascader, Checkbox, Col, ColorPicker, Form, Input, InputNumber, Modal, Radio, Rate, Row, Select, Slider, Space, Switch, Upload } from 'antd';\nimport DateStringPicker from '@/components/DateStringPicker';\nimport SvgIcon from '@/components/SvgIcon';\n\nexport default function GeneratedForm({ onSubmit = () => {}, open = true, onClose = () => {} }) {\n  const [form] = Form.useForm();\n  return (${type === "dialog" ? `<Modal title="表单" open={open} onCancel={onClose} onOk={() => form.submit()} forceRender>${content}</Modal>` : content});\n}\n`;
}
