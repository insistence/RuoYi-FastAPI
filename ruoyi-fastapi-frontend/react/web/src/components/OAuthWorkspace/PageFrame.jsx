import './style.css'
export default function PageFrame({
  title,
  section = '统一认证',
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
              <strong className="filter-title">筛选条件</strong>
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
