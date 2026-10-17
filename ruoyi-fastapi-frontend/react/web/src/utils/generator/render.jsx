import {
  GeneratorNumber,
  GeneratorSwitch,
  GeneratorRate,
  GeneratorChoice,
  GeneratorCascader,
  GeneratorColor,
} from "@/components/GeneratorControls";
import {
  Button,
  Cascader,
  Checkbox,
  ColorPicker,
  Input,
  InputNumber,
  Radio,
  Rate,
  Select,
  Slider,
  Space,
  Switch,
  Upload,
} from "antd";
import DateStringPicker from "@/components/DateStringPicker";
import SvgIcon from "@/components/SvgIcon";
import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { describeControl, resolveGeneratorIconName } from "./controls";
/**
 * 为不同控件生成 Form.Item 的值读写适配配置。
 * @param {Object} field 字段配置
 * @returns {Object} 值属性、事件取值及开关值映射配置
 */
export function fieldItemProps(field) {
  if (field.tag === "Switch")
    return {
      valuePropName: "checked",
      getValueProps: (value) => ({ checked: value === field["active-value"] }),
      getValueFromEvent: (checked) => (checked ? field["active-value"] : field["inactive-value"]),
    };
  if (field.tag === "ColorPicker") return { getValueFromEvent: (_, value) => value };
  if (field.tag === "Upload")
    return {
      valuePropName: "fileList",
      getValueFromEvent: (event) => event?.fileList || [],
    };
  return {};
}
/**
 * 根据字段配置渲染设计器或预览中的表单控件。
 * @param {Object} props 组件属性
 * @param {Object} props.field 字段配置
 * @param {boolean} [props.design=false] 是否处于设计模式，设计时禁止自动上传
 * @returns {import("react").ReactElement} 字段控件
 */
export default function FieldControl({ field, design = false, ...valueProps }) {
  const { component, props } = describeControl(field);
  const registry = {
    GeneratorNumber,
    GeneratorSwitch,
    GeneratorRate,
    GeneratorChoice,
    GeneratorCascader,
    GeneratorColor,
    Button,
    Cascader,
    "Checkbox.Group": Checkbox.Group,
    ColorPicker,
    Input,
    "Input.TextArea": Input.TextArea,
    "Input.Password": Input.Password,
    InputNumber,
    "Radio.Group": Radio.Group,
    Rate,
    Select,
    Slider,
    Switch,
    Upload,
    DateStringPicker,
  };
  const Control = registry[component] || Input;
  const icons =
    field.tag === "Input"
      ? {
          prefix: field["prefix-icon"] ? (
            <SvgIcon iconClass={resolveGeneratorIconName(field["prefix-icon"])} />
          ) : undefined,
          suffix: field["suffix-icon"] ? (
            <SvgIcon iconClass={resolveGeneratorIconName(field["suffix-icon"])} />
          ) : undefined,
        }
      : {};
  if (component === "Upload")
    return (
      <Upload
        {...props}
        {...valueProps}
        beforeUpload={(file) => {
          const units = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
          // 设计模式仅展示控件；预览时按自动上传开关及文件大小限制处理。
          if (design || !field["auto-upload"]) return false;
          return !field.fileSize ||
            file.size <= field.fileSize * (units[field.sizeUnit] || 1024 ** 2)
            ? true
            : Upload.LIST_IGNORE;
        }}
      >
        {field["list-type"] === "picture-card" ? (
          <PlusOutlined aria-label="添加文件" />
        ) : (
          <Button type="primary" icon={<UploadOutlined />}>
            {field.buttonText || "点击上传"}
          </Button>
        )}
      </Upload>
    );
  if (component === "Button")
    return (
      <Button
        {...props}
        icon={field.icon ? <SvgIcon iconClass={resolveGeneratorIconName(field.icon)} /> : null}
      >
        {field.default || "按钮"}
      </Button>
    );
  const control = <Control {...props} {...icons} {...valueProps} />;
  return field.tag === "Input" && (field.prepend || field.append) ? (
    <Space.Compact block>
      {field.prepend && <span className="generator-addon">{field.prepend}</span>}
      {control}
      {field.append && <span className="generator-addon">{field.append}</span>}
    </Space.Compact>
  ) : (
    control
  );
}
