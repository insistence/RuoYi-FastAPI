import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useLayoutEffect } from 'react'
import './style.css'

export function finishSystemLoading() {
  document.getElementById('app-bootstrap-loader')?.remove()
  document.documentElement.removeAttribute('data-app-booting')
}

// This must be inside Suspense: a loading fallback is not a ready page.
export function PageReady({ children }) {
  useI18n()

  useLayoutEffect(() => {
    finishSystemLoading()
  }, [])
  return children
}

export default function SystemLoading() {
  useI18n()

  // Reuse the HTML screen while JS, session information and route modules load.
  if (document.getElementById('app-bootstrap-loader')) return null
  return (
    <div
      className="system-loading"
      role="status"
      aria-live="polite"
    >
      <div
        className="system-loading-spinner"
        aria-hidden="true"
      />
      <p className="system-loading-title">{t('common:loadingSystemResourcesPleaseWait')}</p>
    </div>
  )
}
