import { Cascader, Checkbox, ColorPicker, InputNumber, Radio, Rate, Space, Switch } from "antd";

export function GeneratorNumber({ strictStep, step = 1, min, max, onChange, ...props }) {
  return (
    <InputNumber
      {...props}
      step={step}
      min={min}
      max={max}
      onChange={(value) => {
        const rounded =
          value != null && strictStep && step > 0
            ? Number((Math.round(value / step) * step).toFixed(12))
            : value;
        onChange?.(
          rounded == null
            ? rounded
            : Math.min(max ?? Infinity, Math.max(min ?? -Infinity, rounded)),
        );
      }}
    />
  );
}

export function GeneratorSwitch({ activeColor, inactiveColor, checked, style, ...props }) {
  return (
    <Switch
      {...props}
      checked={checked}
      style={{ ...style, background: (checked ? activeColor : inactiveColor) || undefined }}
    />
  );
}

export function GeneratorRate({ showScore, showText, value, ...props }) {
  return (
    <Space>
      <Rate {...props} value={value} />
      {showScore ? (
        <span>{value || 0}</span>
      ) : showText && value > 0 ? (
        <span>{["极差", "失望", "一般", "满意", "惊喜"][Math.min(4, Math.ceil(value) - 1)]}</span>
      ) : null}
    </Space>
  );
}

export function GeneratorChoice({ kind, options, border, optionType, size, ...props }) {
  const Group = kind === "checkbox" ? Checkbox.Group : Radio.Group;
  const Option = kind === "checkbox" ? Checkbox : optionType === "button" ? Radio.Button : Radio;
  const boxed = border || (kind === "checkbox" && optionType === "button");
  return (
    <Group {...props} size={size}>
      {options?.map((option) => (
        <Option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          style={
            boxed
              ? {
                  border: "1px solid var(--ruoyi-border-color, #dcdfe6)",
                  borderRadius: 4,
                  padding: size === "small" ? "0 8px" : "4px 12px",
                  marginInlineEnd: 10,
                }
              : undefined
          }
        >
          {option.label}
        </Option>
      ))}
    </Group>
  );
}

export function GeneratorCascader({ separator = "/", showAllLevels = true, ...props }) {
  return (
    <Cascader
      {...props}
      displayRender={(labels) => (showAllLevels ? labels : labels.slice(-1)).join(` ${separator} `)}
    />
  );
}

function formatColor(color, format) {
  if (format === "hsv") {
    const { h, s, b } = color.toHsb();
    return `hsv(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(b * 100)}%)`;
  }
  if (format === "hsl") {
    const { r, g, b } = color.toRgb();
    const channels = [r, g, b].map((value) => value / 255);
    const high = Math.max(...channels),
      low = Math.min(...channels),
      delta = high - low,
      light = (high + low) / 2;
    let hue = 0;
    if (delta) {
      const [red, green, blue] = channels;
      hue =
        high === red
          ? (green - blue) / delta + (green < blue ? 6 : 0)
          : high === green
            ? (blue - red) / delta + 2
            : (red - green) / delta + 4;
    }
    const saturation = delta ? delta / (1 - Math.abs(2 * light - 1)) : 0;
    return `hsl(${Math.round(hue * 60)}, ${Math.round(saturation * 100)}%, ${Math.round(light * 100)}%)`;
  }
  return ["rgb", "rgba"].includes(format) ? color.toRgbString() : color.toHexString();
}

export function GeneratorColor({ format, onChange, value, ...props }) {
  // Ant Design names HSV "hsb"; accept the Vue designer's saved HSV value as well.
  const input = typeof value === "string" ? value.replace(/^hsv\(/, "hsb(") : value;
  return (
    <ColorPicker
      {...props}
      value={input}
      format={format === "hsv" ? "hsb" : ["rgb", "rgba", "hsl"].includes(format) ? "rgb" : "hex"}
      onChange={(color) => onChange?.(color, formatColor(color, format))}
    />
  );
}
