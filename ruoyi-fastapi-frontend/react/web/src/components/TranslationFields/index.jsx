import { Form, Input } from 'antd'
import { useI18n } from '@/i18n/adapter'
import { DATA_SOURCE_LOCALE } from '@/i18n/runtime.mjs'
import './index.css'

function LocaleFormItem(props) {
  return (
    <Form.Item
      {...props}
      className="locale-text-field"
      layout="vertical"
      labelCol={{}}
      wrapperCol={{}}
    />
  )
}

export function SourceLocaleLabel({ children }) {
  const { i18n, t } = useI18n()
  const language = i18n.registry.get(DATA_SOURCE_LOCALE)?.nativeName || DATA_SOURCE_LOCALE
  return (
    <>
      {children} · {t('common:i18n.sourceLanguage', { language })}
    </>
  )
}

export function SourceLocaleField({ label, ...props }) {
  return (
    <LocaleFormItem
      {...props}
      label={<SourceLocaleLabel>{label}</SourceLocaleLabel>}
    />
  )
}

export default function TranslationFields({ name, label }) {
  const { i18n } = useI18n()
  return i18n.registry.entries
    .filter((entry) => entry.code !== DATA_SOURCE_LOCALE)
    .map((entry) => (
      <LocaleFormItem
        key={entry.code}
        name={[name, entry.code]}
        label={`${label} · ${entry.nativeName}`}
      >
        <Input allowClear />
      </LocaleFormItem>
    ))
}
