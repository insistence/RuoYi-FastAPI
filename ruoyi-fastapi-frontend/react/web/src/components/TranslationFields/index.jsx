import { useState } from 'react'
import { Button, Form, Input, Typography } from 'antd'
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

export default function TranslationFields({ name, label, original, maxLength }) {
  const { i18n, t } = useI18n()
  const locales = i18n.registry.entries.filter((entry) => entry.code !== DATA_SOURCE_LOCALE)
  const values = Form.useWatch(name, Form.useFormInstance())
  const [expanded, setExpanded] = useState(() => locales.some((entry) => original?.[entry.code]))
  if (!locales.length) return null
  const hasTranslation = locales.some((entry) => values?.[entry.code])
  return (
    <div className="translation-fields">
      <Button
        type="link"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? t('common:i18n.hide')
          : hasTranslation
            ? t('common:i18n.show')
            : t('common:i18n.add')}
      </Button>
      <div hidden={!expanded}>
        {locales.map((entry) => (
          <LocaleFormItem
            key={entry.code}
            name={[name, entry.code]}
            label={`${label} · ${entry.nativeName}`}
          >
            <Input
              allowClear
              maxLength={maxLength}
              showCount
            />
          </LocaleFormItem>
        ))}
        <Typography.Text type="secondary">{t('common:i18n.fallback')}</Typography.Text>
      </div>
    </div>
  )
}
