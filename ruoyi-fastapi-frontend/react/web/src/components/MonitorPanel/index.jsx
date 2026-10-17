import { Card } from 'antd'
import './style.css'
export default function MonitorPanel({ title, icon, children }) {
  return (
    <Card
      className="monitor-panel"
      title={
        <span>
          {icon} <span>{title}</span>
        </span>
      }
    >
      {children}
    </Card>
  )
}
export function MetricTable({ headers, rows }) {
  return (
    <div className="monitor-table-wrap">
      <table className="monitor-table">
        {headers && (
          <thead>
            <tr>
              {headers.map((label) => (
                <th
                  key={label}
                  scope="col"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  colSpan={cell?.span || 1}
                >
                  {cell && typeof cell === 'object' && 'span' in cell ? cell.value : (cell ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export const usage = (value) => (
  <span className={Number(value) > 80 ? 'monitor-danger' : undefined}>{value ?? 0}%</span>
)
