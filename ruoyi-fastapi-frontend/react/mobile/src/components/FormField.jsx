import React from 'react'
import { View, Label, Input } from '@tarojs/components'
export default function FormField({
  label,
  value,
  onChange,
  password,
  icon,
  id,
  compact = false,
  ...props
}) {
  const inputId = id || `field-${label}`
  return (
    <View
      className={icon ? 'auth-field' : 'mobile-field'}
      style={compact ? { marginBottom: 0 } : undefined}
    >
      {label && !icon && (
        <Label
          for={process.env.TARO_ENV === 'h5' ? `${inputId}-input` : inputId}
          className="mobile-label"
        >
          {label}
        </Label>
      )}
      {icon && (
        <View
          className={`auth-field-icon i-mdi-${icon}`}
          aria-hidden="true"
        />
      )}
      <Input
        id={inputId}
        aria-label={label}
        nativeProps={
          process.env.TARO_ENV === 'h5'
            ? { id: `${inputId}-input`, 'aria-label': label }
            : undefined
        }
        className={icon ? 'auth-input' : 'mobile-input'}
        value={value ?? ''}
        password={password}
        onInput={(event) => onChange(event.detail.value)}
        {...props}
      />
    </View>
  )
}
