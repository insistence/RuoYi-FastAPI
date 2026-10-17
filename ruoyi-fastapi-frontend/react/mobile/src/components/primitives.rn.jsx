import React, { createContext, useContext } from "react";
import {
  View as RNView,
  Text as RNText,
  ScrollView as RNScrollView,
  Pressable,
  ActivityIndicator,
  Switch as RNSwitch,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import * as Base from "@tarojs/components";
import { LinearGradient } from "expo-linear-gradient";
import { SvgXml } from "react-native-svg";
import icons from "@/styles/native-icons.json";
import { nativeStyles, textStyles, textStyleKeys } from "@/utils/nativeStyles";

const InheritedText = createContext({ color: "#1f2937", fontSize: 14 });
function useStyles(utilityClass, inline) {
  const inherited = useContext(InheritedText);
  const { style, meta } = nativeStyles(utilityClass, useWindowDimensions());
  const merged = { ...inherited, ...style, ...StyleSheet.flatten(inline) };
  for (const key of Object.keys(merged))
    if (typeof merged[key] === "string" && /^-?[\d.]+px$/.test(merged[key]))
      merged[key] = parseFloat(merged[key]);
  return { style: merged, meta, text: textStyles(merged) };
}
function boxStyle(style) {
  const result = { ...style };
  for (const key of textStyleKeys) delete result[key];
  return result;
}
function accessibleProps(props) {
  const {
    "aria-label": label,
    "aria-live": live,
    "aria-hidden": hidden,
    "aria-pressed": pressed,
    role,
    ...rest
  } = props;
  return {
    ...rest,
    ...(label ? { accessibilityLabel: label } : {}),
    ...(live ? { accessibilityLiveRegion: live } : {}),
    ...(hidden
      ? { accessible: false, importantForAccessibility: "no-hide-descendants" }
      : {}),
    ...(pressed !== undefined
      ? { accessibilityState: { selected: pressed } }
      : {}),
    ...(role && role !== "group" ? { accessibilityRole: role } : {}),
  };
}
const touch = (event) => ({
  touches: event.nativeEvent.touches,
  stopPropagation: () => event.stopPropagation(),
  preventDefault: () => {},
});
export function View({
  utilityClass = "",
  style: input,
  children,
  onClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  ...props
}) {
  const { style, meta, text } = useStyles(utilityClass, input);
  const classes = utilityClass.split(/\s+/);
  if (meta.icon)
    return (
      <SvgXml
        xml={icons[meta.icon]}
        width={style.fontSize || 20}
        height={style.fontSize || 20}
        color={text.color}
        style={boxStyle(style)}
        {...accessibleProps(props)}
      />
    );
  let content = React.Children.toArray(children).map((child) =>
    typeof child === "string" || typeof child === "number" ? (
      <RNText key={String(child)} style={text}>
        {child}
      </RNText>
    ) : (
      child
    ),
  );
  if (meta.columns) {
    const rows = [];
    for (let i = 0; i < content.length; i += meta.columns)
      rows.push(
        <RNView
          key={i}
          style={{
            flexDirection: "row",
            columnGap: style.columnGap ?? style.gap ?? 0,
          }}
        >
          {content.slice(i, i + meta.columns).map((child, j) => (
            <RNView key={j} style={{ flex: 1 }}>
              {child}
            </RNView>
          ))}
        </RNView>,
      );
    content = rows;
    style.flexDirection = "column";
    style.flexWrap = "nowrap";
  }
  const NativeView = meta.gradient ? LinearGradient : RNView;
  const nativeProps = {
    ...accessibleProps(props),
    style: boxStyle(style),
    ...(meta.gradient
      ? {
          colors: [meta.from || "#3b82f6", meta.to || "#4f46e5"],
          start: { x: 0, y: 0 },
          end: { x: 1, y: meta.diagonal ? 1 : 0 },
        }
      : {}),
  };
  if (onClick) {
    nativeProps.onStartShouldSetResponder = () => true;
    nativeProps.onResponderRelease = onClick;
    nativeProps.accessibilityRole = "button";
  }
  if (onTouchStart) {
    nativeProps.onStartShouldSetResponder = () => true;
    nativeProps.onResponderGrant = (event) => onTouchStart(touch(event));
    nativeProps.onResponderMove = (event) => onTouchMove?.(touch(event));
    nativeProps.onResponderRelease = onTouchEnd;
  }
  let result = (
    <InheritedText.Provider value={text}>
      <NativeView {...nativeProps}>{content}</NativeView>
    </InheritedText.Provider>
  );
  if (
    classes.some((name) =>
      [
        "mobile-page",
        "list-page",
        "auth-screen",
        "min-h-screen",
        "min-h-full",
      ].includes(name),
    )
  )
    result = (
      <RNScrollView
        style={{ flex: 1, backgroundColor: style.backgroundColor || "#f7f8fa" }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {result}
      </RNScrollView>
    );
  return result;
}
export function Text({ utilityClass, style: input, onClick, ...props }) {
  const { style } = useStyles(utilityClass, input);
  return <RNText {...accessibleProps(props)} style={style} onPress={onClick} />;
}
function styled(Component) {
  return function Primitive({
    utilityClass,
    style: input,
    nativeProps,
    ...props
  }) {
    const { style } = useStyles(utilityClass, input);
    return <Component {...accessibleProps(props)} style={style} />;
  };
}
export const Input = styled(Base.Input);
export function Button({
  utilityClass,
  style: input,
  children,
  onClick,
  onPress,
  disabled,
  loading,
  size,
  ...props
}) {
  const { style, meta, text } = useStyles(utilityClass, input);
  const a11y = accessibleProps(props);
  return (
    <InheritedText.Provider value={text}>
      <Pressable
        {...a11y}
        accessibilityRole="button"
        accessibilityState={{
          ...a11y.accessibilityState,
          disabled: !!disabled,
          busy: !!loading,
        }}
        onPress={onPress || onClick}
        disabled={disabled}
        style={{
          minHeight: size === "mini" ? 32 : 44,
          borderRadius: 8,
          backgroundColor: "#f8f8f8",
          ...boxStyle(style),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: style.justifyContent || "center",
          overflow: "hidden",
          opacity: disabled ? 0.6 : (style.opacity ?? 1),
        }}
      >
        {meta.gradient && (
          <LinearGradient
            colors={[meta.from, meta.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {loading && (
          <ActivityIndicator color={text.color} style={{ marginRight: 8 }} />
        )}
        {React.Children.toArray(children).map((child, index) =>
          typeof child === "string" || typeof child === "number" ? (
            <RNText key={index} style={text}>
              {child}
            </RNText>
          ) : (
            child
          ),
        )}
      </Pressable>
    </InheritedText.Provider>
  );
}
export const Image = styled(Base.Image);
export const Picker = styled(Base.Picker);
export const Radio = styled(Base.Radio);
export const RadioGroup = styled(Base.RadioGroup);
export function Label({ for: target, ...props }) {
  return <View {...props} />;
}
export function Switch({
  utilityClass,
  style: input,
  checked,
  disabled,
  color,
  onChange,
  ...props
}) {
  const { style } = useStyles(utilityClass, input);
  return (
    <RNSwitch
      {...accessibleProps(props)}
      value={checked}
      disabled={disabled}
      trackColor={{ false: "#d1d5db", true: color }}
      onValueChange={(value) => onChange?.({ detail: { value } })}
      style={boxStyle(style)}
    />
  );
}
export const ScrollView = styled(Base.ScrollView);
export const Swiper = styled(Base.Swiper);
export const SwiperItem = styled(Base.SwiperItem);
export const WebView = styled(Base.WebView);
// Native avatar cropping is performed by expo-image-manipulator.
export const Canvas = () => null;
