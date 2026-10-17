import { DatePicker, TimePicker } from 'antd'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
dayjs.extend(customParseFormat)
export default function DateStringPicker({
  value,
  onChange,
  kind = 'date',
  range = false,
  format,
  valueFormat,
  selectableRange,
  ...props
}) {
  const pattern = format || (kind === 'time' ? 'HH:mm:ss' : 'YYYY-MM-DD')
  const storedPattern = valueFormat || pattern
  const parse = (value) => (value ? dayjs(value, storedPattern) : null)
  const ranges = (Array.isArray(selectableRange) ? selectableRange : [selectableRange])
    .filter(Boolean)
    .map((text) => text.split(/\s+-\s+/).map((value) => dayjs(value, 'HH:mm:ss')))
    .filter((pair) => pair.length === 2 && pair.every((value) => value.isValid()))
  const seconds = (date) => date.hour() * 3600 + date.minute() * 60 + date.second()
  const allowed = (start, end) =>
    !ranges.length || ranges.some(([from, to]) => start <= seconds(to) && end >= seconds(from))
  const blocked = (count, test) =>
    Array.from({ length: count }, (_, i) => i).filter((i) => !test(i))
  const disabledTime = ranges.length
    ? () => ({
        disabledHours: () => blocked(24, (h) => allowed(h * 3600, h * 3600 + 3599)),
        disabledMinutes: (h) =>
          blocked(60, (m) => allowed(h * 3600 + m * 60, h * 3600 + m * 60 + 59)),
        disabledSeconds: (h, m) =>
          blocked(60, (s) => allowed(h * 3600 + m * 60 + s, h * 3600 + m * 60 + s)),
      })
    : undefined
  const Picker =
    kind === 'time'
      ? range
        ? TimePicker.RangePicker
        : TimePicker
      : range
        ? DatePicker.RangePicker
        : DatePicker
  return (
    <Picker
      {...props}
      format={pattern}
      disabledTime={disabledTime}
      value={range ? (value || []).map(parse) : parse(value)}
      onChange={(date) =>
        onChange?.(
          range
            ? date?.map((item) => item?.format(storedPattern)) || null
            : date?.format(storedPattern) || null
        )
      }
    />
  )
}
