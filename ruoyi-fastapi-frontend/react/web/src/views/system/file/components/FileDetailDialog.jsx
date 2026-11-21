import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { Button, Descriptions, Modal, Typography } from 'antd'
import { parseTime } from '@/utils/ruoyi'
import { accessTypeLabel, formatFileSize, statusLabel, storageStatusLabel } from './fileFormatters'
import FileTag from './FileTag'

function uploaderPermission(file) {
  if (file.accessType !== 'private')
    return t('file:detail.publicFilesDoNotRequireIndividualPermissions')
  if (!file.uploadUserId) return t('file:detail.uploaderNotRecorded')
  const enabled = file.uploaderAccessEnabled === '1' || file.uploaderAccessEnabled === true
  if (file.uploadUserId === file.ownerUserId)
    return enabled
      ? t('file:detail.legacyAccessRetainedAlsoTheOwner')
      : t('file:detail.legacyAccessRemovedAccessRemainsThroughOwnership')
  return enabled
    ? t('file:detail.retainedAnExplicitDenyTakesPrecedence')
    : t('file:detail.removedUploadingTheFileNoLongerGrantsAccess')
}
export default function FileDetailDialog({ open, detail = {}, onClose, onReference }) {
  useI18n()

  const items = [
    [t('file:detail.fileId'), detail.fileId],
    [t('file:originalName'), detail.originalName],
    [t('file:detail.storedFileName'), detail.storedName],
    [t('file:accessType'), accessTypeLabel(detail.accessType)],
    [t('file:shared.fileStatus'), statusLabel(detail.status)],
    [t('file:shared.uploader'), detail.createBy || '-'],
    [t('file:detail.uploaderId'), detail.uploadUserId || '-'],
    [
      t('file:shared.uploaderPermissions'),
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
    [t('file:shared.storageStatus'), storageStatusLabel(detail.storageStatus)],
    [t('file:detail.aclEntries'), detail.aclEntryCount || 0],
    [
      t('file:shared.businessReferences'),
      detail.referenceCount ? (
        <Button
          className="ruoyi-table-action"
          type="link"
          onClick={() => onReference(detail)}
        >
          {detail.referenceCount} {t('file:shared.items')}
        </Button>
      ) : (
        t('file:shared.0Items')
      ),
    ],
    [t('file:detail.permissionsVersion'), detail.aclVersion],
    [t('system:fileSize'), formatFileSize(detail.fileSize)],
    [t('file:detail.contentType'), detail.contentType],
    [t('file:shared.extension'), detail.extension],
    [t('file:shared.uploadedAt'), parseTime(detail.createTime)],
    [t('file:detail.expiresAt'), parseTime(detail.expireTime) || '-'],
    [t('file:shared.moveToRecycleBin'), parseTime(detail.deletedTime) || '-'],
    [t('file:detail.relativeStoragePath'), detail.storageKey],
    [
      'SHA-256',
      <Typography.Text style={{ fontFamily: 'monospace' }}>{detail.fileHash}</Typography.Text>,
    ],
  ].map(([label, children]) => ({
    key: label,
    span: [t('file:detail.fileId'), t('file:detail.relativeStoragePath'), 'SHA-256'].includes(label)
      ? 2
      : 1,
    label,
    children: children ?? '-',
  }))
  return (
    <Modal
      className="file-dialog "
      open={open}
      title={t('file:detail.fileDetails')}
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
