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
  const action = (permission, label, icon, handler, row, danger = false, disabled = false) => (
    <HasPermi value={[`system:file:${permission}`]}>
      <TableAction
        iconOnly
        tooltip={disabled ? '存在业务引用，无法删除' : label}
        symbol={
          permission === 'query'
            ? label === '审计'
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
      title: '原始文件名',
      dataIndex: 'originalName',
      width: 200,
      ellipsis: true,
    },
    {
      align: 'center',
      title: '访问类型',
      dataIndex: 'accessType',
      width: 110,
      render: (value) => (
        <FileTag type={value === 'public' ? 'success' : 'warning'}>
          {value === 'public' ? '公开' : '受保护'}
        </FileTag>
      ),
    },
    { align: 'center', title: '扩展名', dataIndex: 'extension', width: 90 },
    {
      align: 'right',
      title: '文件大小',
      dataIndex: 'fileSize',
      width: 120,
      render: formatFileSize,
    },
    { align: 'center', title: '上传用户', dataIndex: 'createBy', width: 120 },
    {
      align: 'center',
      title: '所有者',
      width: 120,
      render: (_, row) => row.ownerName || row.ownerUserId || '-',
    },
    {
      align: 'center',
      title: '所属部门',
      width: 140,
      render: (_, row) => row.deptName || row.deptId || '-',
    },
    {
      align: 'center',
      title: '文件有效期',
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
          title={row.aclNearestExpireTime ? `最近过期：${parseTime(row.aclNearestExpireTime)}` : ''}
        >
          <FileTag type={isAclExpiring(row.aclNearestExpireTime) ? 'warning' : 'info'}>
            {row.aclEntryCount || 0} 项
            {isAclExpiring(row.aclNearestExpireTime) ? ' · 即将过期' : ''}
          </FileTag>
        </Tooltip>
      ),
    },
    {
      align: 'center',
      title: '业务引用',
      dataIndex: 'referenceCount',
      width: 100,
      render: (value, row) =>
        value ? (
          <Button
            className="ruoyi-table-action"
            type="link"
            onClick={() => onReference(row)}
          >
            {value} 项
          </Button>
        ) : (
          '0 项'
        ),
    },
    {
      align: 'center',
      title: '存储状态',
      dataIndex: 'storageStatus',
      width: 110,
      render: (value) => (
        <FileTag type={storageStatusTagType(value)}>{storageStatusLabel(value)}</FileTag>
      ),
    },
    {
      align: 'center',
      title: '上传时间',
      dataIndex: 'createTime',
      width: 180,
      render: (value) => parseTime(value),
    },
    {
      align: 'center',
      title: '状态',
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
      title: '操作',
      width: 250,
      fixed: 'right',
      render: (_, row) => (
        <TableActions>
          {action('query', '详细', <EyeOutlined />, onView, row)}
          {row.status === 'active' &&
            action('download', '下载', <DownloadOutlined />, onDownload, row)}
          {row.status === 'active' &&
            row.accessType === 'private' &&
            action('edit', '授权', <LockOutlined />, onAcl, row)}
          {row.status === 'active' && action('transfer', '转移', <SwapOutlined />, onTransfer, row)}
          {action('query', '审计', <AuditOutlined />, onAudit, row)}
          {row.status === 'active' &&
            action('remove', '删除', <DeleteOutlined />, onDelete, row, true, !!row.referenceCount)}
          {row.status === 'deleted' && action('restore', '恢复', <UndoOutlined />, onRestore, row)}
          {row.status !== 'active' &&
            action(
              'purge',
              row.status === 'purging' ? '重试永久清理' : '永久清理',
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
