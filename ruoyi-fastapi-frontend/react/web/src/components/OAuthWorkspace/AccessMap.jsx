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
      application || t('components:oauthWorkspace.unnamed'),
      type === 'public'
        ? t('components:oauthWorkspace.webOrMobileApplication')
        : t('components:oauthWorkspace.backendServiceApplication'),
    ],
    [
      t('system:permission.title'),
      permissions.slice(0, 2).join('、') || t('components:oauthWorkspace.notSelected'),
      permissions.length > 2
        ? t('authCenter:access.morePermissions', { count: permissions.length - 2 })
        : t('components:oauthWorkspace.informationTheApplicationCanRequest'),
    ],
    [
      t('common:service'),
      resources.slice(0, 2).join('、') || t('common:identityInformationOnly'),
      resources.length > 2
        ? t('authCenter:access.moreServices', { count: resources.length - 2 })
        : t('components:oauthWorkspace.resourcesTheTokenCanAccess'),
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
              <span>
                {index === 1
                  ? t('components:oauthWorkspace.requests')
                  : t('components:oauthWorkspace.access')}
              </span>
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
