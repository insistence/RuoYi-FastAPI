import './style.css'
export default function PluginSummary({ items = [], columns = 4, autoFit = false }) {
  return (
    <dl
      className={`plugin-summary${autoFit ? ' plugin-summary--auto-fit' : ''}`}
      style={{ '--summary-columns': columns }}
    >
      {items.filter(Boolean).map((item, index) => (
        <div
          className="plugin-summary-item"
          key={item.key || index}
        >
          <dt>{item.label}</dt>
          <dd>{item.children ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
