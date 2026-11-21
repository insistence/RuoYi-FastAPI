import { useState } from 'react'
import { Button, Form, Input, Space, Typography } from 'antd'
import { useI18n } from '@/i18n/adapter'
import { DATA_SOURCE_LOCALE } from '@/i18n/runtime.mjs'
import './index.css'

export function SourceLocaleLabel({ children }) {
  const { i18n, t } = useI18n()
  const language = i18n.registry.get(DATA_SOURCE_LOCALE)?.nativeName || DATA_SOURCE_LOCALE
  return (
    <>
      {children} · {t('components:translations.sourceLanguage', { language })}
    </>
  )
}

function LanguageInput({ language, ...props }) {
  return (
    <Space.Compact
      block
      className="locale-name-input"
    >
      <Space.Addon>{language}</Space.Addon>
      <Input {...props} />
    </Space.Compact>
  )
}

export default function TranslationFields({
  name,
  label,
  rules,
  placeholder,
  translationName,
  original,
  maxLength,
}) {
  const { i18n, t } = useI18n()
  const language = i18n.registry.get(DATA_SOURCE_LOCALE)?.nativeName || DATA_SOURCE_LOCALE
  const locales = i18n.registry.entries.filter((entry) => entry.code !== DATA_SOURCE_LOCALE)
  const values = Form.useWatch(translationName, Form.useFormInstance())
  const [expanded, setExpanded] = useState(() => locales.some((entry) => original?.[entry.code]))
  const hasTranslation = locales.some((entry) => values?.[entry.code])
  return (
    <Form.Item
      name={name}
      label={label}
      rules={rules}
      extra={
        locales.length > 0 && (
          <div className="translation-fields">
            <Button
              type="link"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded
                ? t('components:translations.hide')
                : hasTranslation
                  ? t('components:translations.show')
                  : t('components:translations.add')}
            </Button>
            <div
              hidden={!expanded}
              className="translation-inputs"
            >
              {locales.map((entry) => (
                <Form.Item
                  key={entry.code}
                  name={[translationName, entry.code]}
                  noStyle
                >
                  <LanguageInput
                    language={entry.nativeName}
                    aria-label={`${label} · ${entry.nativeName}`}
                    allowClear
                    maxLength={maxLength}
                    showCount
                  />
                </Form.Item>
              ))}
              <Typography.Text type="secondary">
                {t('components:translations.fallback')}
              </Typography.Text>
            </div>
          </div>
        )
      }
    >
      <LanguageInput
        language={language}
        placeholder={placeholder}
      />
    </Form.Item>
  )
}
