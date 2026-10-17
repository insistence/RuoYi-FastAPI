import './style.css'
import { Button, Descriptions, Modal, Typography } from 'antd'
import { parseTime } from '@/utils/ruoyi'
import { accessTypeLabel, formatFileSize, statusLabel, storageStatusLabel } from './fileFormatters'
import FileTag from './FileTag'

function uploaderPermission(file) {
  if (file.accessType !== 'private') return '公开文件无需单独授权'
  if (!file.uploadUserId) return '未记录上传人'
  const enabled = file.uploaderAccessEnabled === '1' || file.uploaderAccessEnabled === true
  if (file.uploadUserId === file.ownerUserId)
    return enabled ? '兼容访问已保留；同时为所有者' : '兼容访问已移除；仍通过所有者访问'
  return enabled ? '已保留，显式拒绝可覆盖' : '已移除，不再因上传身份放行'
}
export default function FileDetailDialog({ open, detail = {}, onClose, onReference }) {
  const items = [
    ['文件ID', detail.fileId],
    ['原始文件名', detail.originalName],
    ['存储文件名', detail.storedName],
    ['访问类型', accessTypeLabel(detail.accessType)],
    ['文件状态', statusLabel(detail.status)],
    ['上传用户', detail.createBy || '-'],
    ['上传用户ID', detail.uploadUserId || '-'],
    [
      '上传人权限',
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
    ['所有者', detail.ownerName || detail.ownerUserId],
    ['所属部门', detail.deptName || detail.deptId],
    ['存储状态', storageStatusLabel(detail.storageStatus)],
    ['ACL数量', detail.aclEntryCount || 0],
    [
      '业务引用',
      detail.referenceCount ? (
        <Button
          className="ruoyi-table-action"
          type="link"
          onClick={() => onReference(detail)}
        >
          {detail.referenceCount} 项
        </Button>
      ) : (
        '0 项'
      ),
    ],
    ['权限版本', detail.aclVersion],
    ['文件大小', formatFileSize(detail.fileSize)],
    ['内容类型', detail.contentType],
    ['扩展名', detail.extension],
    ['上传时间', parseTime(detail.createTime)],
    ['过期时间', parseTime(detail.expireTime) || '-'],
    ['移入回收站', parseTime(detail.deletedTime) || '-'],
    ['存储相对路径', detail.storageKey],
    [
      'SHA-256',
      <Typography.Text style={{ fontFamily: 'monospace' }}>{detail.fileHash}</Typography.Text>,
    ],
  ].map(([label, children]) => ({
    key: label,
    span: ['文件ID', '存储相对路径', 'SHA-256'].includes(label) ? 2 : 1,
    label,
    children: children ?? '-',
  }))
  return (
    <Modal
      className="file-dialog "
      open={open}
      title="文件详细信息"
      width="820px"
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
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
