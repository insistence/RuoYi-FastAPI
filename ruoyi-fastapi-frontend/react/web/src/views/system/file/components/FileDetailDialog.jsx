import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { Button, Descriptions, Modal, Typography } from 'antd'
import { parseTime } from '@/utils/ruoyi'
import { accessTypeLabel, formatFileSize, statusLabel, storageStatusLabel } from './fileFormatters'
import FileTag from './FileTag'

function uploaderPermission(file) {
  if (file.accessType !== 'private') return t('system:publicFilesDoNotRequireIndividualPermissions')
  if (!file.uploadUserId) return t('system:uploaderNotRecorded')
  const enabled = file.uploaderAccessEnabled === '1' || file.uploaderAccessEnabled === true
  if (file.uploadUserId === file.ownerUserId)
    return enabled
      ? t('system:legacyAccessRetainedAlsoTheOwner')
      : t('system:legacyAccessRemovedAccessRemainsThroughOwnership')
  return enabled
    ? t('system:retainedAnExplicitDenyTakesPrecedence')
    : t('system:removedUploadingTheFileNoLongerGrantsAccess')
}
export default function FileDetailDialog({ open, detail = {}, onClose, onReference }) {
  useI18n()

  const items = [
    [t('system:fileId'), detail.fileId],
    [t('file:originalName'), detail.originalName],
    [t('system:storedFileName'), detail.storedName],
    [t('file:accessType'), accessTypeLabel(detail.accessType)],
    [t('system:fileStatus'), statusLabel(detail.status)],
    [t('system:uploader'), detail.createBy || '-'],
    [t('system:uploaderId'), detail.uploadUserId || '-'],
    [
      t('system:uploaderPermissions'),
      detail.accessType === 'private' && detail.uploadUserId ? (
        <FileTag
          effect="plain"
          type={
            detail.uploaderAccessEnabled !== '1' && detail.uploaderAccessEnabled !== true
              ? 'info'
              : detail.uploadUserId === detail.ownerUserId
                ? 'primary'
                : 'warning'
          }
        >
          {uploaderPermission(detail)}
        </FileTag>
      ) : (
        uploaderPermission(detail)
      ),
    ],
    [t('file:owner'), detail.ownerName || detail.ownerUserId],
    [t('system:user.department'), detail.deptName || detail.deptId],
    [t('system:storageStatus'), storageStatusLabel(detail.storageStatus)],
    [t('system:aclEntries'), detail.aclEntryCount || 0],
    [
      t('system:businessReferences'),
      detail.referenceCount ? (
        <Button
          className="ruoyi-table-action"
          type="link"
          onClick={() => onReference(detail)}
        >
          {detail.referenceCount} {t('system:items')}
        </Button>
      ) : (
        t('system:0Items')
      ),
    ],
    [t('system:permissionsVersion'), detail.aclVersion],
    [t('system:fileSize'), formatFileSize(detail.fileSize)],
    [t('system:contentType'), detail.contentType],
    [t('system:extension'), detail.extension],
    [t('system:uploadedAt'), parseTime(detail.createTime)],
    [t('system:expiresAt'), parseTime(detail.expireTime) || '-'],
    [t('system:moveToRecycleBin'), parseTime(detail.deletedTime) || '-'],
    [t('system:relativeStoragePath'), detail.storageKey],
    [
      'SHA-256',
      <Typography.Text style={{ fontFamily: 'monospace' }}>{detail.fileHash}</Typography.Text>,
    ],
  ].map(([label, children]) => ({
    key: label,
    span: [t('system:fileId'), t('system:relativeStoragePath'), 'SHA-256'].includes(label) ? 2 : 1,
    label,
    children: children ?? '-',
  }))
  return (
    <Modal
      className="file-dialog "
      open={open}
      title={t('system:fileDetails')}
      width="820px"
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t('layout:search.close')}</Button>}
    >
      <Descriptions
        styles={{
          label: { width: 110, whiteSpace: 'nowrap' },
          content: { overflowWrap: 'anywhere' },
        }}
        bordered
        column={2}
        items={items}
      />
    </Modal>
  )
}
