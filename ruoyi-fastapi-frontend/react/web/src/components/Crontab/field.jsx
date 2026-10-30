import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useEffect, useRef, useState } from 'react'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input, InputNumber, Radio, Select } from 'antd'
import { parseCronField, serializeCronField } from './model'

const weekdays = () =>
  [
    t('common:sunday'),
    t('common:monday'),
    t('common:tuesday'),
    t('common:wednesday'),
    t('common:thursday'),
    t('common:friday'),
    t('common:saturday'),
  ].map((label, index) => ({ label, value: index + 1 }))
const months = () => [
  t('common:january'),
  t('common:february'),
  t('common:march'),
  t('common:april'),
  t('common:may'),
  t('common:june'),
  t('common:july'),
  t('common:august'),
  t('common:september'),
  t('common:october'),
  t('common:november'),
  t('common:december'),
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
          aria-label={t('common:decreaseValue', { title })}
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
          aria-label={t('common:increaseValue', { title })}
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
      ? [row('omit', t('common:leaveBlankSupportedWildcardsValue', { wildcard }))]
      : []),
    row(
      'every',
      name === 'year'
        ? t('common:everyYear')
        : t('common:valueSupportedWildcardsValue', { label, wildcard })
    ),
    ...(['day', 'week'].includes(name) ? [row('omit', t('common:notSpecified'))] : []),
    row(
      'range',
      t('common:rangeFrom'),
      <>
        {name === 'week'
          ? weekday('rangeStart', t('common:startWeekday'), weekdays().slice(0, -1))
          : number('rangeStart', t('common:startValue', { label }), min, max - 1)}
        <span>-</span>
        {name === 'week'
          ? weekday(
              'rangeEnd',
              t('common:endWeekday'),
              weekdays().map((option) => ({
                ...option,
                disabled: option.value <= state.rangeStart,
              }))
            )
          : number('rangeEnd', t('common:endValue', { label }), state.rangeStart + 1, max)}
        {!['week', 'year'].includes(name) && <span>{label}</span>}
      </>
    ),
    ...(name !== 'week' || state.mode === 'step'
      ? [
          row(
            'step',
            t('common:from'),
            <>
              {number('stepStart', t('common:startValueInterval', { label }), min, max - 1)}
              <span>
                {name === 'day' ? t('common:Crontab.day') : label}
                {t('common:startingEvery')}
              </span>
              {number(
                'stepEvery',
                t('common:valueInterval', { label }),
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
            t('common:everyMonth'),
            <>
              {number('day', t('common:nearestWeekdayDate'), 1, 31)}
              <span>{t('common:nearestWeekday')}</span>
            </>
          ),
          row('lastDay', t('common:lastDayOfTheMonth')),
          ...(state.mode === 'lastWorkday'
            ? [row('lastWorkday', t('common:lastWeekdayOfTheMonth'))]
            : []),
        ]
      : []),
    ...(name === 'week'
      ? [
          row(
            'nthWeekday',
            t('common:number'),
            <>
              {number('occurrence', t('common:weekNumber'), 1, 5)}
              <span>{t('common:on')}</span>
              {weekday('nthWeekday', t('common:dayOfTheSelectedWeek'))}
            </>
          ),
          row(
            'lastWeekday',
            t('common:lastInTheMonth'),
            weekday('lastWeekday', t('common:lastWeekday'))
          ),
        ]
      : []),
    row(
      'values',
      t('common:specified'),
      <Select
        className="cron-values"
        placeholder={t('common:multipleSelect')}
        mode="multiple"
        allowClear
        aria-label={t('common:selectedValueValues', { label })}
        value={state.values}
        options={options}
        onChange={(values) => update({ values })}
      />
    ),
    ...(state.mode === 'custom'
      ? [
          row(
            'custom',
            t('common:custom'),
            <Input
              value={value}
              aria-label={t('common:valueExpression', { label })}
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
