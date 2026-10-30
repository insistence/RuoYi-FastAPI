import { Form, Input } from 'antd'
import { useI18n } from '@/i18n/adapter'
import { meta } from '@/i18n/registry'

export function SourceLocaleLabel({ children }) {
  const { i18n, t } = useI18n()
  const source = i18n.registry.entries.find((entry) => entry.code === meta.sourceLocale)
  return (
    <>
      {children} · {t('common:i18n.sourceLanguage', { language: source.nativeName })}
    </>
  )
}

export default function TranslationFields({ name, label }) {
  const { i18n } = useI18n()
  return i18n.registry.entries
    .filter((entry) => entry.code !== meta.sourceLocale)
    .map((entry) => (
      <Form.Item
        key={entry.code}
        name={[name, entry.code]}
        label={`${label} · ${entry.nativeName}`}
      >
        <Input allowClear />
      </Form.Item>
    ))
}
