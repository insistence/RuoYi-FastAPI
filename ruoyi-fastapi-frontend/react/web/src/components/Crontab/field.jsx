import './style.css'
import { useEffect, useRef, useState } from 'react'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input, InputNumber, Radio, Select } from 'antd'
import { parseCronField, serializeCronField } from './model'

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'].map(
  (label, index) => ({ label, value: index + 1 })
)
const months = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
]

function initialState(value, min, name) {
  const start = name === 'year' ? new Date().getFullYear() : name === 'week' ? 2 : min
  const parsed = parseCronField(value, start)
  return {
    ...parsed,
    rangeStart: parsed.mode === 'range' ? parsed.start : start,
    rangeEnd: parsed.mode === 'range' ? parsed.end : start + 1,
    stepStart: parsed.mode === 'step' ? parsed.start : start,
    stepEvery: parsed.mode === 'step' ? parsed.step : 1,
    nthWeekday: parsed.mode === 'nthWeekday' ? parsed.weekday : 2,
    lastWeekday: parsed.mode === 'lastWeekday' ? parsed.weekday : 2,
    values: parsed.mode === 'values' ? parsed.values : [],
  }
}

export default function CronField({ name, label, min, max, value, onChange }) {
  const [state, setState] = useState(() => initialState(value, min, name))
  const emitted = useRef(value)
  useEffect(() => {
    if (value !== emitted.current) {
      setState(initialState(value, min, name))
      emitted.current = value
    }
  }, [value, min, name])

  function update(patch) {
    const next = { ...state, ...patch }
    next.rangeEnd = Math.max(next.rangeStart + 1, next.rangeEnd)
    next.stepEvery = Math.min(next.stepEvery, Math.max(1, max - next.stepStart))
    if (next.mode === 'values' && !next.values.length)
      next.values = [
        state.values[0] ?? (name === 'week' ? 2 : name === 'year' ? new Date().getFullYear() : min),
      ]
    setState(next)
    const serialized = serializeCronField(
      {
        ...next,
        start: next.mode === 'range' ? next.rangeStart : next.stepStart,
        end: next.rangeEnd,
        step: next.stepEvery,
        weekday: next.mode === 'nthWeekday' ? next.nthWeekday : next.lastWeekday,
      },
      name,
      value
    )
    if (serialized !== value) {
      emitted.current = serialized
      onChange(serialized)
    }
  }

  const number = (key, title, lower, upper) => {
    if (name === 'year' && ['rangeStart', 'stepStart'].includes(key)) {
      lower = Math.min(new Date().getFullYear(), state[key])
    }
    const change = (next) =>
      update({ [key]: Math.max(lower, Math.min(upper, Math.floor(next ?? lower))) })
    return (
      <span className="cron-number">
        <Button
          type="text"
          aria-label={`减少${title}`}
          icon={<MinusOutlined />}
          disabled={state[key] <= lower}
          onClick={() => change(state[key] - 1)}
        />
        <InputNumber
          aria-label={title}
          min={lower}
          max={upper}
          precision={0}
          controls={false}
          value={state[key]}
          onChange={change}
        />
        <Button
          type="text"
          aria-label={`增加${title}`}
          icon={<PlusOutlined />}
          disabled={state[key] >= upper}
          onClick={() => change(state[key] + 1)}
        />
      </span>
    )
  }
  const weekday = (key, title, options = weekdays) => (
    <Select
      className="cron-weekday"
      aria-label={title}
      value={state[key]}
      options={options}
      onChange={(next) => update({ [key]: next })}
    />
  )
  const row = (mode, title, content) => (
    <div
      key={mode}
      className={`cron-field-row${state.mode === mode ? ' is-selected' : ''}`}
    >
      <Radio
        value={mode}
        aria-label={title}
      >
        {title}
      </Radio>
      {content && <div className="cron-field-controls">{content}</div>}
    </div>
  )
  const wildcard = name === 'day' ? ', - * ? / L W' : name === 'week' ? ', - * ? / L #' : ', - * /'
  const yearStart = Math.min(new Date().getFullYear(), ...state.values)
  const options =
    name === 'week'
      ? weekdays
      : Array.from({ length: max - (name === 'year' ? yearStart : min) + 1 }, (_, index) => {
          const value = index + (name === 'year' ? yearStart : min)
          return { label: name === 'month' ? months[value - 1] : String(value), value }
        })
  const rows = [
    ...(name === 'year' ? [row('omit', `不填，允许的通配符[${wildcard}]`)] : []),
    row('every', name === 'year' ? '每年' : `${label}，允许的通配符[${wildcard}]`),
    ...(['day', 'week'].includes(name) ? [row('omit', '不指定')] : []),
    row(
      'range',
      '周期从',
      <>
        {name === 'week'
          ? weekday('rangeStart', '周周期开始', weekdays.slice(0, -1))
          : number('rangeStart', `${label}周期开始`, min, max - 1)}
        <span>-</span>
        {name === 'week'
          ? weekday(
              'rangeEnd',
              '周周期结束',
              weekdays.map((option) => ({ ...option, disabled: option.value <= state.rangeStart }))
            )
          : number('rangeEnd', `${label}周期结束`, state.rangeStart + 1, max)}
        {!['week', 'year'].includes(name) && <span>{label}</span>}
      </>
    ),
    ...(name !== 'week' || state.mode === 'step'
      ? [
          row(
            'step',
            '从',
            <>
              {number('stepStart', `${label}间隔开始`, min, max - 1)}
              <span>{name === 'day' ? '号' : label}开始，每</span>
              {number('stepEvery', `${label}执行间隔`, 1, Math.max(1, max - state.stepStart))}
              <span>{label}执行一次</span>
            </>
          ),
        ]
      : []),
    ...(name === 'day'
      ? [
          row(
            'workday',
            '每月',
            <>
              {number('day', '最近工作日日期', 1, 31)}
              <span>号最近的那个工作日</span>
            </>
          ),
          row('lastDay', '本月最后一天'),
          ...(state.mode === 'lastWorkday' ? [row('lastWorkday', '本月最后工作日')] : []),
        ]
      : []),
    ...(name === 'week'
      ? [
          row(
            'nthWeekday',
            '第',
            <>
              {number('occurrence', '第几周', 1, 5)}
              <span>周的</span>
              {weekday('nthWeekday', '第几周的星期')}
            </>
          ),
          row('lastWeekday', '本月最后一个', weekday('lastWeekday', '最后一个星期')),
        ]
      : []),
    row(
      'values',
      '指定',
      <Select
        className="cron-values"
        placeholder="可多选"
        mode="multiple"
        allowClear
        aria-label={`${label}指定值`}
        value={state.values}
        options={options}
        onChange={(values) => update({ values })}
      />
    ),
    ...(state.mode === 'custom'
      ? [
          row(
            'custom',
            '自定义',
            <Input
              value={value}
              aria-label={`${label}表达式`}
              onChange={(event) => {
                emitted.current = event.target.value
                onChange(event.target.value)
              }}
            />
          ),
        ]
      : []),
  ]
  return (
    <Radio.Group
      className={`cron-field cron-field-${name}`}
      name={`cron-${name}-mode`}
      value={state.mode}
      onChange={(event) => update({ mode: event.target.value })}
    >
      {rows}
    </Radio.Group>
  )
}
