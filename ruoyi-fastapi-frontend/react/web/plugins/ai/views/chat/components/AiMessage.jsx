import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useId, useState } from 'react'
import { RightOutlined } from '@ant-design/icons'
import MarkdownRender from 'markstream-react'
import useSettingsStore from '@/store/modules/settings'
import 'markstream-react/index.css'
import 'katex/dist/katex.min.css'
import '../style.css'

export default function AiMessage({ content = '', reasoningContent = '', loading = false }) {
  useI18n()

  const isDark = useSettingsStore((state) => state.dark)
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(true)
  const reasoningId = useId()
  // Both streams stay incomplete until the chat request finishes or is stopped.
  const rendererProps = { isDark, final: !loading, htmlPolicy: 'safe' }
  return (
    <div className="ai-message-container">
      {reasoningContent && (
        <div className="reasoning-section">
          <button
            type="button"
            className="reasoning-header"
            aria-expanded={isReasoningExpanded}
            aria-controls={reasoningId}
            onClick={() => setIsReasoningExpanded((expanded) => !expanded)}
          >
            <RightOutlined className={isReasoningExpanded ? 'is-expanded' : ''} />
            <span>{t('plugin.ai:reasoningProcess')}</span>
            {!content && <span className="reasoning-status">{t('plugin.ai:thinking')}</span>}
          </button>
          <div
            id={reasoningId}
            className="reasoning-content"
            hidden={!isReasoningExpanded}
          >
            <MarkdownRender
              content={reasoningContent}
              {...rendererProps}
            />
          </div>
        </div>
      )}
      <div className="ai-message-content">
        <MarkdownRender
          content={content}
          {...rendererProps}
        />
      </div>
      {loading && !content && !reasoningContent && (
        <div
          className="typing-indicator"
          role="status"
          aria-label={t('plugin.ai:waitingForAReply')}
        >
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  )
}
