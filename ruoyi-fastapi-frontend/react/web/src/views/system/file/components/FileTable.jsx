import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import FileTag from './FileTag'
import TableActions, { TableAction } from '@/components/TableActions'
import './style.css'
import { Button, Tooltip } from 'antd'
import Table from '@/components/Table'
import {
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  LockOutlined,
  SwapOutlined,
  AuditOutlined,
  UndoOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import { parseTime } from '@/utils/ruoyi'
import HasPermi from '@/directive/permission/hasPermi'
import {
  expirationLabel,
  expirationTagType,
  formatFileSize,
  isAclExpiring,
  storageStatusLabel,
  storageStatusTagType,
  statusLabel,
} from './fileFormatters'

export const tagColors = {
  primary: 'processing',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'default',
}
export default function FileTable({
  fileList,
  loading,
  selected,
  onSelectionChange,
  onView,
  onDownload,
  onReference,
  onAcl,
  onTransfer,
  onAudit,
  onDelete,
  onRestore,
  onPurge,
}) {
  useI18n()

  const action = (permission, label, icon, handler, row, danger = false, disabled = false) => (
    <HasPermi value={[`system:file:${permission}`]}>
      <TableAction
        iconOnly
        tooltip={disabled ? t('system:cannotDeleteAReferencedFile') : label}
        symbol={
          permission === 'query'
            ? handler === onAudit
              ? 'Tickets'
              : 'View'
            : {
                download: 'Download',
                edit: 'Lock',
                transfer: 'Switch',
                remove: 'Delete',
                restore: 'RefreshLeft',
                purge: 'DeleteFilled',
              }[permission]
        }
        tone={permission === 'restore' ? 'success' : 'primary'}
        danger={danger}
        disabled={disabled}
        aria-label={label}
        icon={icon}
        onClick={() => handler(row)}
      />
    </HasPermi>
  )
  const columns = [
    {
      title: t('file:originalName'),
      dataIndex: 'originalName',
      width: 200,
      ellipsis: true,
    },
    {
      align: 'center',
      title: t('file:accessType'),
      dataIndex: 'accessType',
      width: 110,
      render: (value) => (
        <FileTag type={value === 'public' ? 'success' : 'warning'}>
          {value === 'public' ? t('system:public') : t('system:protected')}
        </FileTag>
      ),
    },
    { align: 'center', title: t('system:extension'), dataIndex: 'extension', width: 90 },
    {
      align: 'right',
      title: t('system:fileSize'),
      dataIndex: 'fileSize',
      width: 120,
      render: formatFileSize,
    },
    { align: 'center', title: t('system:uploader'), dataIndex: 'createBy', width: 120 },
    {
      align: 'center',
      title: t('file:owner'),
      width: 120,
      render: (_, row) => row.ownerName || row.ownerUserId || '-',
    },
    {
      align: 'center',
      title: t('system:user.department'),
      width: 140,
      render: (_, row) => row.deptName || row.deptId || '-',
    },
    {
      align: 'center',
      title: t('system:fileExpiry'),
      dataIndex: 'expireTime',
      width: 150,
      render: (value) => (
        <FileTag type={expirationTagType(value)}>{expirationLabel(value)}</FileTag>
      ),
    },
    {
      align: 'center',
      title: 'ACL',
      width: 130,
      render: (_, row) => (
        <Tooltip
          title={
            row.aclNearestExpireTime
              ? t('file:mostRecentExpirationValue', { arg0: parseTime(row.aclNearestExpireTime) })
              : ''
          }
        >
          <FileTag type={isAclExpiring(row.aclNearestExpireTime) ? 'warning' : 'info'}>
            {row.aclEntryCount || 0} {t('system:items')}
            {isAclExpiring(row.aclNearestExpireTime) ? t('system:components.expiringSoon') : ''}
          </FileTag>
        </Tooltip>
      ),
    },
    {
      align: 'center',
      title: t('system:businessReferences'),
      dataIndex: 'referenceCount',
      width: 100,
      render: (value, row) =>
        value ? (
          <Button
            className="ruoyi-table-action"
            type="link"
            onClick={() => onReference(row)}
          >
            {value} {t('system:items')}
          </Button>
        ) : (
          t('system:0Items')
        ),
    },
    {
      align: 'center',
      title: t('system:storageStatus'),
      dataIndex: 'storageStatus',
      width: 110,
      render: (value) => (
        <FileTag type={storageStatusTagType(value)}>{storageStatusLabel(value)}</FileTag>
      ),
    },
    {
      align: 'center',
      title: t('system:uploadedAt'),
      dataIndex: 'createTime',
      width: 180,
      render: (value) => parseTime(value),
    },
    {
      align: 'center',
      title: t('common:status'),
      dataIndex: 'status',
      width: 90,
      render: (value) => (
        <FileTag type={value === 'active' ? 'success' : value === 'purging' ? 'warning' : 'info'}>
          {statusLabel(value)}
        </FileTag>
      ),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      width: 250,
      fixed: 'right',
      render: (_, row) => (
        <TableActions>
          {action('query', t('common:detail'), <EyeOutlined />, onView, row)}
          {row.status === 'active' &&
            action('download', t('common:download'), <DownloadOutlined />, onDownload, row)}
          {row.status === 'active' &&
            row.accessType === 'private' &&
            action('edit', t('system:permissions'), <LockOutlined />, onAcl, row)}
          {row.status === 'active' &&
            action('transfer', t('system:transfer'), <SwapOutlined />, onTransfer, row)}
          {action('query', t('system:audit'), <AuditOutlined />, onAudit, row)}
          {row.status === 'active' &&
            action(
              'remove',
              t('common:delete'),
              <DeleteOutlined />,
              onDelete,
              row,
              true,
              !!row.referenceCount
            )}
          {row.status === 'deleted' &&
            action('restore', t('common:restore'), <UndoOutlined />, onRestore, row)}
          {row.status !== 'active' &&
            action(
              'purge',
              row.status === 'purging'
                ? t('file:retryPermanentDeletion')
                : t('system:permanentlyDelete'),
              <ClearOutlined />,
              onPurge,
              row,
              true
            )}
        </TableActions>
      ),
    },
  ]
  return (
    <Table
      className="file-table"
      rowKey="fileId"
      dataSource={fileList}
      loading={loading}
      columns={columns}
      rowSelection={{
        selectedRowKeys: selected.map((row) => row.fileId),
        onChange: (_, rows) => onSelectionChange(rows),
      }}
      pagination={false}
      scroll={{ x: 2050 }}
    />
  )
}
