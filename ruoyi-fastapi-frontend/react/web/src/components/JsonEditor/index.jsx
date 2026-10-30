import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Space, Spin, Typography } from 'antd'
import { SlidersOutlined, FullscreenOutlined } from '@ant-design/icons'
import useSettingsStore from '@/store/modules/settings'
import { validateJson } from './validation'
import './style.css'

export default function JsonEditor({
  value = '',
  onChange,
  onBlur,
  readOnly = false,
  label = t('common:jsonParameters'),
  valueType = 'object',
  validate,
  rows = 7,
  ...props
}) {
  const { locale } = useI18n()

  const host = useRef(),
    instance = useRef(),
    latest = useRef({ value, onChange, onBlur })
  latest.current = { value, onChange, onBlur }
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [expanded, setExpanded] = useState(false),
    [marker, setMarker] = useState(null)
  const dark = useSettingsStore((state) => state.dark)
  const validation = useMemo(
    () => validateJson(value, valueType, validate),
    [value, valueType, validate, locale]
  )
  const name = props['aria-label'] || label
  useEffect(() => {
    let disposed = false,
      editor,
      model
    const listeners = []
    void (async () => {
      try {
        await import('@/utils/monacoEnvironment')
        const [monaco] = await Promise.all([
          import('monaco-editor/esm/vs/editor/editor.api'),
          import('monaco-editor/esm/vs/language/json/monaco.contribution'),
          import('monaco-editor/esm/vs/editor/contrib/format/browser/formatActions'),
          import('monaco-editor/esm/vs/editor/contrib/folding/browser/folding'),
          import('monaco-editor/esm/vs/editor/contrib/find/browser/findController'),
        ])
        if (disposed) return
        model = monaco.editor.createModel(latest.current.value, 'json')
        model.updateOptions({ tabSize: 2, insertSpaces: true })
        editor = monaco.editor.create(host.current, {
          model,
          ariaLabel: name,
          readOnly,
          automaticLayout: true,
          fontSize: 13,
          lineHeight: 22,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          folding: true,
          tabFocusMode: true,
          padding: { top: 8, bottom: 8 },
          stickyScroll: { enabled: false },
          formatOnPaste: true,
          suggest: { showWords: false },
          scrollbar: { alwaysConsumeMouseWheel: false },
          theme: useSettingsStore.getState().dark ? 'vs-dark' : 'vs',
        })
        instance.current = editor
        listeners.push(
          editor.onDidChangeModelContent(() => latest.current.onChange?.(model.getValue()))
        )
        listeners.push(editor.onDidBlurEditorText(() => latest.current.onBlur?.()))
        listeners.push(
          monaco.editor.onDidChangeMarkers((resources) => {
            if (
              !disposed &&
              resources.some((resource) => resource.toString() === model.uri.toString())
            )
              setMarker(
                monaco.editor
                  .getModelMarkers({ resource: model.uri })
                  .filter((item) => item.severity === monaco.MarkerSeverity.Error)
                  .sort(
                    (a, b) => a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn
                  )[0] || null
              )
          })
        )
        setReady(true)
      } catch {
        if (!disposed) setFailed(true)
      }
    })()
    return () => {
      disposed = true
      listeners.forEach((listener) => listener.dispose())
      editor?.dispose()
      model?.dispose()
      instance.current = undefined
    }
  }, [])
  useEffect(() => {
    const model = instance.current?.getModel()
    if (model && model.getValue() !== value) model.setValue(value)
  }, [value, ready])
  useEffect(() => {
    instance.current?.updateOptions({ readOnly, theme: dark ? 'vs-dark' : 'vs', ariaLabel: name })
  }, [readOnly, dark, name, ready])
  async function format() {
    if (instance.current) {
      await instance.current.getAction('editor.action.formatDocument')?.run()
      instance.current.focus()
    } else onChange?.(JSON.stringify(JSON.parse(value), null, 2))
  }
  function revealError() {
    const position = { lineNumber: marker?.startLineNumber || 1, column: marker?.startColumn || 1 }
    instance.current?.setPosition(position)
    instance.current?.revealPositionInCenter(position)
    instance.current?.focus()
  }
  return (
    <div
      className={`json-editor${validation.valid ? '' : ' has-error'}`}
      style={props.style}
    >
      <div className="json-editor-toolbar">
        <span>{valueType === 'array' ? t('common:jsonArray') : t('common:jsonObject')}</span>
        <Space>
          <Button
            type="link"
            size="small"
            icon={<SlidersOutlined />}
            disabled={readOnly || !validation.valid || (!ready && !failed)}
            onClick={format}
            aria-label={t('common:formatValue', { name })}
          >
            {t('common:format')}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<FullscreenOutlined />}
            onClick={() => setExpanded(!expanded)}
            aria-label={t('common:valuevalueEditor', {
              arg0: expanded ? t('common:collapse') : t('common:expand'),
              name,
            })}
            aria-expanded={expanded}
          >
            {expanded ? t('common:collapse') : t('common:expand')}
          </Button>
        </Space>
      </div>
      <div style={{ height: expanded ? 360 : Math.max(160, rows * 22), position: 'relative' }}>
        {!failed && (
          <div
            ref={host}
            style={{ width: '100%', height: '100%' }}
          />
        )}
        {!ready && !failed && (
          <div className="json-editor-loading">
            <Spin size="small" /> {t('common:loadingEditor')}
          </div>
        )}
        {failed && (
          <Input.TextArea
            value={value}
            readOnly={readOnly}
            aria-label={name}
            rows={expanded ? 16 : rows}
            onChange={(event) => onChange?.(event.target.value)}
            onBlur={onBlur}
          />
        )}
      </div>
      <div className="json-editor-footer">
        {validation.valid ? (
          <Typography.Text
            type="success"
            role="status"
            className="json-editor-valid"
          >
            {t('common:validFormat')}
          </Typography.Text>
        ) : (
          <Button
            type="link"
            danger
            onClick={revealError}
          >
            {marker &&
              t('common:lineValueColumnValue', {
                startLineNumber: marker.startLineNumber,
                startColumn: marker.startColumn,
              })}
            {validation.message}
          </Button>
        )}
        {validation.valid && (
          <Typography.Text type="secondary">
            {failed
              ? t('common:failedToLoadTheEditorPlainTextInputIs')
              : t('common:tabToChangeFocusAltShiftFToFormat')}
          </Typography.Text>
        )}
      </div>
    </div>
  )
}
