import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Fragment } from 'react'
import { ArrowRightOutlined } from '@ant-design/icons'
import './style.css'
export default function AccessMap({
  application,
  type = 'confidential',
  permissions = [],
  resources = [],
}) {
  useI18n()

  const nodes = [
    [
      t('common:apply'),
      application || t('common:unnamed'),
      type === 'public'
        ? t('common:webOrMobileApplication')
        : t('common:backendServiceApplication'),
    ],
    [
      t('system:permission.title'),
      permissions.slice(0, 2).join('、') || t('common:notSelected'),
      permissions.length > 2
        ? t('authCenter:access.morePermissions', { count: permissions.length - 2 })
        : t('common:informationTheApplicationCanRequest'),
    ],
    [
      t('common:service'),
      resources.slice(0, 2).join('、') || t('common:identityInformationOnly'),
      resources.length > 2
        ? t('authCenter:access.moreServices', { count: resources.length - 2 })
        : t('common:resourcesTheTokenCanAccess'),
    ],
  ]
  return (
    <div className="oauth-access-map">
      {nodes.map(([label, value, hint], index) => (
        <Fragment key={label}>
          {index > 0 && (
            <span
              className="oauth-access-link"
              aria-hidden="true"
            >
              <span>{index === 1 ? t('common:requests') : t('common:access')}</span>
              <ArrowRightOutlined />
            </span>
          )}
          <div className="oauth-access-node">
            <span className="oauth-node-label">{label}</span>
            <strong title={value}>{value}</strong>
            <small title={hint}>{hint}</small>
          </div>
        </Fragment>
      ))}
    </div>
  )
}
