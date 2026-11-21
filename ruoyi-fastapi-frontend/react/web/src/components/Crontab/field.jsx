import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useEffect, useRef, useState } from 'react'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input, InputNumber, Radio, Select } from 'antd'
import { parseCronField, serializeCronField } from './model'

const weekdays = () =>
  [
    t('components:cron.sunday'),
    t('components:cron.monday'),
    t('components:cron.tuesday'),
    t('components:cron.wednesday'),
    t('components:cron.thursday'),
    t('components:cron.friday'),
    t('components:cron.saturday'),
  ].map((label, index) => ({ label, value: index + 1 }))
const months = () => [
  t('components:cron.january'),
  t('components:cron.february'),
  t('components:cron.march'),
  t('components:cron.april'),
  t('components:cron.may'),
  t('components:cron.june'),
  t('components:cron.july'),
  t('components:cron.august'),
  t('components:cron.september'),
  t('components:cron.october'),
  t('components:cron.november'),
  t('components:cron.december'),
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
  useI18n()

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
          aria-label={t('components:cron.decreaseValue', { title })}
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
          aria-label={t('components:cron.increaseValue', { title })}
          icon={<PlusOutlined />}
          disabled={state[key] >= upper}
          onClick={() => change(state[key] + 1)}
        />
      </span>
    )
  }
  const weekday = (key, title, options = weekdays()) => (
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
      ? weekdays()
      : Array.from({ length: max - (name === 'year' ? yearStart : min) + 1 }, (_, index) => {
          const value = index + (name === 'year' ? yearStart : min)
          return { label: name === 'month' ? months()[value - 1] : String(value), value }
        })
  const rows = [
    ...(name === 'year'
      ? [row('omit', t('components:cron.leaveBlankSupportedWildcardsValue', { wildcard }))]
      : []),
    row(
      'every',
      name === 'year'
        ? t('components:cron.everyYear')
        : t('components:cron.valueSupportedWildcardsValue', { label, wildcard })
    ),
    ...(['day', 'week'].includes(name) ? [row('omit', t('components:cron.notSpecified'))] : []),
    row(
      'range',
      t('components:cron.rangeFrom'),
      <>
        {name === 'week'
          ? weekday('rangeStart', t('components:cron.startWeekday'), weekdays().slice(0, -1))
          : number('rangeStart', t('components:cron.startValue', { label }), min, max - 1)}
        <span>-</span>
        {name === 'week'
          ? weekday(
              'rangeEnd',
              t('components:cron.endWeekday'),
              weekdays().map((option) => ({
                ...option,
                disabled: option.value <= state.rangeStart,
              }))
            )
          : number('rangeEnd', t('components:cron.endValue', { label }), state.rangeStart + 1, max)}
        {!['week', 'year'].includes(name) && <span>{label}</span>}
      </>
    ),
    ...(name !== 'week' || state.mode === 'step'
      ? [
          row(
            'step',
            t('common:from'),
            <>
              {number(
                'stepStart',
                t('components:cron.startValueInterval', { label }),
                min,
                max - 1
              )}
              <span>
                {name === 'day' ? t('components:cron.dayOfMonth') : label}
                {t('components:cron.startingEvery')}
              </span>
              {number(
                'stepEvery',
                t('components:cron.valueInterval', { label }),
                1,
                Math.max(1, max - state.stepStart)
              )}
              <span>
                {label}
                {t('common:runOnce')}
              </span>
            </>
          ),
        ]
      : []),
    ...(name === 'day'
      ? [
          row(
            'workday',
            t('components:cron.everyMonth'),
            <>
              {number('day', t('components:cron.nearestWeekdayDate'), 1, 31)}
              <span>{t('components:cron.nearestWeekday')}</span>
            </>
          ),
          row('lastDay', t('components:cron.lastDayOfTheMonth')),
          ...(state.mode === 'lastWorkday'
            ? [row('lastWorkday', t('components:cron.lastWeekdayOfTheMonth'))]
            : []),
        ]
      : []),
    ...(name === 'week'
      ? [
          row(
            'nthWeekday',
            t('components:cron.number'),
            <>
              {number('occurrence', t('components:cron.weekNumber'), 1, 5)}
              <span>{t('components:cron.on')}</span>
              {weekday('nthWeekday', t('components:cron.dayOfTheSelectedWeek'))}
            </>
          ),
          row(
            'lastWeekday',
            t('components:cron.lastInTheMonth'),
            weekday('lastWeekday', t('components:cron.lastWeekday'))
          ),
        ]
      : []),
    row(
      'values',
      t('components:cron.specified'),
      <Select
        className="cron-values"
        placeholder={t('components:cron.multipleSelect')}
        mode="multiple"
        allowClear
        aria-label={t('components:cron.selectedValueValues', { label })}
        value={state.values}
        options={options}
        onChange={(values) => update({ values })}
      />
    ),
    ...(state.mode === 'custom'
      ? [
          row(
            'custom',
            t('components:cron.custom'),
            <Input
              value={value}
              aria-label={t('components:cron.valueExpression', { label })}
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
