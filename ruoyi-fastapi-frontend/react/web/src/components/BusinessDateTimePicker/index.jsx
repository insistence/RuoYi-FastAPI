import "./style.css";
import { DatePicker, TimePicker } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { formatBusinessTime, getDisplayTimezone, getWallTimeCandidates } from "@/utils/time";
dayjs.extend(utc);
const format = "YYYY-MM-DD HH:mm:ss";
// UTC is only the calendar model: preserve wall-clock strings for the business-time
// serializer, which validates DST gaps and asks about repeated local times.
const calendarValue = (value) => (value ? dayjs.utc(value.replace(" ", "T")) : null);
function wallTimeError(value, zone) {
  if (!value) return "";
  try {
    return getWallTimeCandidates(value, zone).length ? "" : "该时间在此时区不存在，请重新选择";
  } catch {
    return "请选择完整有效的日期和时间";
  }
}
export default function BusinessDateTimePicker({
  value,
  onChange,
  label = "日期时间",
  timezone,
  style,
  ...props
}) {
  const zone = timezone || getDisplayTimezone();
  const error = wallTimeError(value, zone);
  const date = value?.slice(0, 10) || "",
    time = value?.slice(11, 19) || "";
  return (
    <div className="business-datetime-input" style={style}>
      <div className="business-datetime-input__fields">
        <DatePicker
          {...props}
          aria-label={`${label}日期`}
          format="YYYY-MM-DD"
          value={calendarValue(value)}
          showNow={false}
          status={error ? "error" : props.status}
          onChange={(selected) =>
            onChange?.(selected ? `${selected.format("YYYY-MM-DD")} ${time || "00:00:00"}` : null)
          }
        />
        <TimePicker
          disabled={props.disabled}
          size={props.size}
          aria-label={`${label}时间`}
          format="HH:mm:ss"
          value={calendarValue(value)}
          showNow={false}
          status={error ? "error" : props.status}
          onChange={(selected) =>
            onChange?.(
              selected
                ? `${date || formatBusinessTime(new Date(), "YYYY-MM-DD", zone)} ${selected.format("HH:mm:ss")}`
                : null,
            )
          }
        />
      </div>
      <div className="business-datetime-input__zone">{zone}</div>
      {error && (
        <div role="alert" className="business-datetime-input__error">
          {error}
        </div>
      )}
    </div>
  );
}
export function BusinessDateTimeRangePicker({
  value,
  onChange,
  label = "日期时间范围",
  timezone,
  style,
  separator = "至",
  ...props
}) {
  const error = (value || [])
    .map((item) => wallTimeError(item, timezone || getDisplayTimezone()))
    .find(Boolean);
  return (
    <div className="business-datetime-input" style={style}>
      <DatePicker.RangePicker
        {...props}
        value={value?.length ? value.map(calendarValue) : null}
        onChange={(_, text) => onChange?.(text?.every(Boolean) ? text : [])}
        format={format}
        showTime
        aria-label={label}
        separator={separator}
        placeholder={["开始时间", "结束时间"]}
        status={error ? "error" : undefined}
        style={{ width: "100%" }}
      />
      {error && (
        <div role="alert" className="business-datetime-input__error">
          {error}
        </div>
      )}
    </div>
  );
}
