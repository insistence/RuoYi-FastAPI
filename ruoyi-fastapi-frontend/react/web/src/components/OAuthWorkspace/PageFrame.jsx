import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
export default function PageFrame({
  title,
  section = t('layout:route.authLogin'),
  description,
  actions,
  context,
  filters,
  filterHint,
  filterExtra,
  toolbar,
  children,
  className = '',
}) {
  useI18n()

  return (
    <div className={'app-container oauth-workspace ' + className}>
      <header className="workspace-header">
        <div className="workspace-heading">
          <h2>{title}</h2>
          <span className="workspace-section">{section}</span>
          <p title={description}>{description}</p>
        </div>
        {actions && <div className="workspace-actions">{actions}</div>}
      </header>
      {context && <section className="workspace-context">{context}</section>}
      {filters && (
        <section className="workspace-filters">
          <div className="filter-heading">
            <div>
              <strong className="filter-title">{t('common:filters')}</strong>
              {filterHint && <span className="filter-hint">{filterHint}</span>}
            </div>
            {filterExtra}
          </div>
          {filters}
        </section>
      )}
      <section className="workspace-data">
        {toolbar && <div className="data-toolbar">{toolbar}</div>}
        {children}
      </section>
    </div>
  )
}
