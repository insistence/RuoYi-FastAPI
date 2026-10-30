import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import {
  FileOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  LockOutlined,
  ClockCircleOutlined,
  KeyOutlined,
} from '@ant-design/icons'
import './statistics.css'
import { formatFileSize } from './fileFormatters'

export default function FileStatistics({ stats = {} }) {
  useI18n()

  const percent = (size) =>
    stats.totalSize
      ? `${((Number(size || 0) / stats.totalSize) * 100).toFixed(Number(size || 0) / stats.totalSize >= 0.1 ? 0 : 1)}%`
      : '0%'
  const items = [
    [
      t('system:totalFiles'),
      stats.totalCount || 0,
      t('file:activeValueRecycleBinValue', {
        arg0: stats.activeCount || 0,
        arg1: stats.deletedCount || 0,
      }),
    ],
    [
      t('system:storageUsed'),
      formatFileSize(stats.totalSize),
      t('system:totalStorageUsedByAllFiles'),
    ],
    [
      t('system:publicFileStorage'),
      formatFileSize(stats.publicSize),
      t('file:valueOfTotalSpace', { arg0: percent(stats.publicSize) }),
    ],
    [
      t('system:protectedFileStorage'),
      formatFileSize(stats.privateSize),
      t('file:valueOfTotalSpace', { arg0: percent(stats.privateSize) }),
    ],
    [
      t('system:expiredFiles'),
      stats.expiredCount || 0,
      t('file:expiringWithin7DaysValue', { arg0: stats.retentionExpiringCount || 0 }),
    ],
    [
      t('system:expiringPermissions'),
      stats.aclExpiringCount || 0,
      t('system:aclEntriesExpiringWithin7Days'),
    ],
  ]
  const icons = [
    FileOutlined,
    DatabaseOutlined,
    FolderOpenOutlined,
    LockOutlined,
    ClockCircleOutlined,
    KeyOutlined,
  ]
  const colors = ['primary', 'purple', 'green', 'orange', 'red', 'cyan']
  return (
    <section
      className="file-statistics"
      aria-label={t('system:fileOverview')}
    >
      <div className="file-statistics-header">
        <div>
          <div className="file-statistics-title">{t('system:fileOverview')}</div>
          <div className="file-statistics-tip">
            {t('system:statisticsUpdateWithTheCurrentFilters')}
          </div>
        </div>
      </div>
      <div className="file-statistics-content">
        {items.map(([title, value, hint], index) => {
          const Icon = icons[index]
          return (
            <div
              className={'file-stat-item stat-' + colors[index]}
              key={title}
            >
              <div className="file-stat-main">
                <div>
                  <div className="file-stat-title">{title}</div>
                  <div className="file-stat-value">{value}</div>
                </div>
                <span className="file-stat-icon">
                  <Icon />
                </span>
              </div>
              <div className="file-stat-extra">{hint}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
